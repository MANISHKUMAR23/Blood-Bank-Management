"""
Session Management Router
Handles user sessions, context switching, and security events.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid

from database import db
from models.session import (
    UserSession, SessionCreate, SessionResponse, ContextSwitchRequest,
    ContextType, MAX_CONCURRENT_SESSIONS, SESSION_TIMEOUT_MINUTES
)
from models.audit import AuditAction, AuditModule
from services import get_current_user, create_token, AuditService
from middleware import require_super_admin_or_above

router = APIRouter(prefix="/sessions", tags=["Sessions"])


# ============== Session Management ==============

@router.get("/active")
async def get_active_sessions(
    current_user: dict = Depends(get_current_user)
):
    """Get all active sessions for the current user."""
    sessions = await db.user_sessions.find(
        {"user_id": current_user["id"], "is_active": True},
        {"_id": 0}
    ).to_list(20)
    
    return sessions


@router.get("/all")
async def get_all_sessions(
    user_id: Optional[str] = None,
    org_id: Optional[str] = None,
    current_user: dict = Depends(require_super_admin_or_above)
):
    """Get all active sessions (admin only)."""
    query = {"is_active": True}
    
    if user_id:
        query["user_id"] = user_id
    
    user_type = current_user.get("user_type")
    user_org_id = current_user.get("org_id")
    
    # Filter by org access
    if user_type != "system_admin":
        if user_type == "super_admin":
            # Get all orgs under this super admin
            child_orgs = await db.organizations.find(
                {"parent_org_id": user_org_id},
                {"id": 1}
            ).to_list(100)
            org_ids = [user_org_id] + [o["id"] for o in child_orgs]
            query["user_org_id"] = {"$in": org_ids}
    
    if org_id:
        query["user_org_id"] = org_id
    
    sessions = await db.user_sessions.find(query, {"_id": 0}).to_list(500)
    
    # Enrich with user info
    for session in sessions:
        user = await db.users.find_one({"id": session["user_id"]}, {"full_name": 1, "email": 1})
        if user:
            session["user_name"] = user.get("full_name")
            session["user_email"] = user.get("email")
    
    return sessions


@router.post("/{session_id}/terminate")
async def terminate_session(
    session_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Terminate a specific session."""
    session = await db.user_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Check permission - can terminate own sessions or if admin
    user_type = current_user.get("user_type")
    if session["user_id"] != current_user["id"]:
        if user_type not in ["system_admin", "super_admin", "tenant_admin"]:
            raise HTTPException(status_code=403, detail="Cannot terminate other users' sessions")
    
    await db.user_sessions.update_one(
        {"id": session_id},
        {"$set": {
            "is_active": False,
            "terminated_at": datetime.now(timezone.utc).isoformat(),
            "terminated_by": current_user["id"],
            "termination_reason": "Manual termination"
        }}
    )
    
    # Audit log
    await AuditService.log(
        action=AuditAction.SESSION_TERMINATED,
        module=AuditModule.AUTH,
        user=current_user,
        record_id=session_id,
        record_type="session",
        description=f"Terminated session for user {session.get('user_email')}",
        request=request
    )
    
    return {"message": "Session terminated"}


@router.post("/terminate-all")
async def terminate_all_sessions(
    request: Request,
    except_current: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """Terminate all sessions for the current user."""
    query = {"user_id": current_user["id"], "is_active": True}
    
    if except_current:
        # Keep current session active
        current_session = await db.user_sessions.find_one({
            "user_id": current_user["id"],
            "is_active": True
        }, sort=[("login_at", -1)])
        if current_session:
            query["id"] = {"$ne": current_session["id"]}
    
    result = await db.user_sessions.update_many(
        query,
        {"$set": {
            "is_active": False,
            "terminated_at": datetime.now(timezone.utc).isoformat(),
            "terminated_by": current_user["id"],
            "termination_reason": "Bulk termination"
        }}
    )
    
    # Audit log
    await AuditService.log(
        action=AuditAction.SESSION_TERMINATED,
        module=AuditModule.AUTH,
        user=current_user,
        description=f"Terminated {result.modified_count} sessions",
        request=request
    )
    
    return {"message": f"Terminated {result.modified_count} sessions"}


# ============== Context Switching ==============

@router.get("/context")
async def get_current_context(
    current_user: dict = Depends(get_current_user)
):
    """Get current user context."""
    user_type = current_user.get("user_type", "staff")
    user_org_id = current_user.get("org_id")
    
    # Get org info
    org_info = None
    if user_org_id:
        org_info = await db.organizations.find_one(
            {"id": user_org_id},
            {"_id": 0, "id": 1, "org_name": 1, "org_type": 1, "is_parent": 1}
        )
    
    # Determine context type
    if user_type == "system_admin":
        context_type = "global"
    elif user_type == "super_admin":
        context_type = "organization"
    else:
        context_type = "branch"
    
    # Check for active impersonation
    is_impersonating = current_user.get("is_impersonating", False)
    actual_user_type = current_user.get("actual_user_type", user_type)
    
    # Can switch context if actual user type allows it (not the impersonated type)
    can_switch = actual_user_type in ["system_admin", "super_admin"]
    
    return {
        "user_id": current_user["id"],
        "user_email": current_user["email"],
        "user_name": current_user.get("full_name"),
        "user_type": user_type,
        "actual_user_type": actual_user_type,
        "context_type": context_type,
        "org_id": user_org_id,
        "org_info": org_info,
        "is_impersonating": is_impersonating,
        "can_switch_context": can_switch
    }


@router.get("/switchable-contexts")
async def get_switchable_contexts(
    current_user: dict = Depends(get_current_user)
):
    """Get list of organizations/contexts the user can switch to."""
    user_type = current_user.get("user_type", "staff")
    user_org_id = current_user.get("org_id")
    
    contexts = []
    
    if user_type == "system_admin":
        # System admin can switch to any org
        orgs = await db.organizations.find(
            {"is_active": True},
            {"_id": 0, "id": 1, "org_name": 1, "org_type": 1, "is_parent": 1, "parent_org_id": 1}
        ).to_list(500)
        
        for org in orgs:
            contexts.append({
                "org_id": org["id"],
                "org_name": org["org_name"],
                "org_type": org["org_type"],
                "is_parent": org.get("is_parent", False),
                "switch_as": "super_admin" if org.get("is_parent") else "tenant_admin"
            })
    
    elif user_type == "super_admin":
        # Super admin can switch to child branches
        children = await db.organizations.find(
            {"parent_org_id": user_org_id, "is_active": True},
            {"_id": 0, "id": 1, "org_name": 1, "org_type": 1}
        ).to_list(100)
        
        for child in children:
            contexts.append({
                "org_id": child["id"],
                "org_name": child["org_name"],
                "org_type": child["org_type"],
                "is_parent": False,
                "switch_as": "tenant_admin"
            })
    
    return {
        "current_context": {
            "user_type": user_type,
            "org_id": user_org_id
        },
        "available_contexts": contexts
    }


@router.post("/switch-context")
async def switch_context(
    switch_request: ContextSwitchRequest,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Switch to a different organization context.
    System Admin can switch to any org.
    Super Admin can switch to child branches.
    """
    user_type = current_user.get("user_type", "staff")
    user_org_id = current_user.get("org_id")
    
    if user_type not in ["system_admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Context switching not allowed for your role")
    
    # Verify target org exists
    target_org = await db.organizations.find_one({"id": switch_request.target_org_id})
    if not target_org:
        raise HTTPException(status_code=404, detail="Target organization not found")
    
    # Check permission
    if user_type == "super_admin":
        # Can only switch to children
        if target_org.get("parent_org_id") != user_org_id:
            raise HTTPException(status_code=403, detail="Can only switch to child branches")
    
    # Determine the role to act as
    if switch_request.target_user_type:
        target_user_type = switch_request.target_user_type
    elif target_org.get("is_parent"):
        target_user_type = "super_admin"
    else:
        target_user_type = "tenant_admin"
    
    # Create new token with context and impersonation flag
    new_token = create_token(
        current_user["id"],
        current_user["role"],
        org_id=switch_request.target_org_id,
        user_type=target_user_type,
        is_impersonating=True,
        actual_user_type=user_type
    )
    
    # Audit log
    await AuditService.log(
        action=AuditAction.SWITCH_CONTEXT,
        module=AuditModule.AUTH,
        user=current_user,
        record_id=switch_request.target_org_id,
        record_type="organization",
        description=f"Switched context to {target_org.get('org_name')} as {target_user_type}",
        request=request,
        metadata={
            "from_user_type": user_type,
            "to_user_type": target_user_type,
            "target_org": target_org.get("org_name")
        }
    )
    
    return {
        "token": new_token,
        "context": {
            "user_type": target_user_type,
            "org_id": switch_request.target_org_id,
            "org_name": target_org.get("org_name"),
            "is_impersonating": True,
            "actual_user_type": user_type
        },
        "message": f"Switched to {target_org.get('org_name')} as {target_user_type}"
    }


@router.post("/exit-context")
async def exit_context(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Exit impersonation and return to original context."""
    actual_user_type = current_user.get("actual_user_type") or current_user.get("user_type")
    
    # Get user's actual org
    user = await db.users.find_one({"id": current_user["id"]}, {"org_id": 1, "user_type": 1})
    actual_org_id = user.get("org_id") if user else None
    actual_user_type = user.get("user_type") if user else actual_user_type
    
    # Create new token without impersonation
    new_token = create_token(
        current_user["id"],
        current_user["role"],
        org_id=actual_org_id,
        user_type=actual_user_type,
        is_impersonating=False,
        actual_user_type=actual_user_type
    )
    
    # Audit log
    await AuditService.log(
        action=AuditAction.EXIT_CONTEXT,
        module=AuditModule.AUTH,
        user=current_user,
        description=f"Exited context, returned to {actual_user_type}",
        request=request
    )
    
    # Get org info
    org_info = None
    if actual_org_id:
        org_info = await db.organizations.find_one(
            {"id": actual_org_id},
            {"_id": 0, "org_name": 1}
        )
    
    return {
        "token": new_token,
        "context": {
            "user_type": actual_user_type,
            "org_id": actual_org_id,
            "org_name": org_info.get("org_name") if org_info else None,
            "is_impersonating": False
        },
        "message": "Returned to original context"
    }


# ============== Security Events ==============

@router.get("/security-events")
async def get_security_events(
    days: int = 7,
    severity: Optional[str] = None,
    current_user: dict = Depends(require_super_admin_or_above)
):
    """Get security events for monitoring."""
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    query = {"timestamp": {"$gte": start_date}}
    if severity:
        query["severity"] = severity
    
    # Filter by org access
    user_type = current_user.get("user_type")
    if user_type != "system_admin":
        user_org_id = current_user.get("org_id")
        if user_type == "super_admin":
            child_orgs = await db.organizations.find(
                {"parent_org_id": user_org_id},
                {"id": 1}
            ).to_list(100)
            org_ids = [user_org_id] + [o["id"] for o in child_orgs]
            query["org_id"] = {"$in": org_ids}
        else:
            query["org_id"] = user_org_id
    
    events = await db.security_events.find(query, {"_id": 0}) \
        .sort("timestamp", -1) \
        .limit(500) \
        .to_list(500)
    
    # Summary stats
    failed_logins_24h = await db.audit_logs.count_documents({
        "action": "login_failed",
        "timestamp": {"$gte": (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()}
    })
    
    locked_accounts = await db.users.count_documents({"is_locked": True})
    
    return {
        "events": events,
        "summary": {
            "failed_logins_24h": failed_logins_24h,
            "locked_accounts": locked_accounts,
            "total_events": len(events)
        }
    }


# ============== Activity Tracking ==============

@router.post("/heartbeat")
async def session_heartbeat(
    current_user: dict = Depends(get_current_user)
):
    """Update session last activity timestamp."""
    await db.user_sessions.update_one(
        {"user_id": current_user["id"], "is_active": True},
        {"$set": {"last_activity": datetime.now(timezone.utc).isoformat()}},
        sort=[("login_at", -1)]
    )
    return {"status": "ok"}


# ============== Context Tree ==============

@router.get("/context-tree")
async def get_context_tree(
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get hierarchical tree of organizations and branches for context switching.
    Returns a tree structure with parent orgs containing their branch children.
    """
    user_type = current_user.get("user_type", "staff")
    user_org_id = current_user.get("org_id")
    
    if user_type not in ["system_admin", "super_admin"]:
        return {
            "organizations": [],
            "total_orgs": 0,
            "total_branches": 0,
            "can_switch": False
        }
    
    # Build query based on user type
    if user_type == "system_admin":
        # Get all parent orgs
        parent_query = {"is_parent": True, "is_active": True}
        if search:
            parent_query["org_name"] = {"$regex": search, "$options": "i"}
        
        parent_orgs = await db.organizations.find(
            parent_query,
            {"_id": 0, "id": 1, "org_name": 1, "org_type": 1, "city": 1, "is_parent": 1}
        ).sort("org_name", 1).to_list(500)
        
        # Get all branches
        all_branches = await db.organizations.find(
            {"is_parent": {"$ne": True}, "is_active": True},
            {"_id": 0, "id": 1, "org_name": 1, "org_type": 1, "city": 1, "parent_org_id": 1}
        ).sort("org_name", 1).to_list(500)
        
        # Build tree structure
        tree = []
        branch_map = {}
        for branch in all_branches:
            parent_id = branch.get("parent_org_id")
            if parent_id not in branch_map:
                branch_map[parent_id] = []
            branch_map[parent_id].append({
                "id": branch["id"],
                "name": branch["org_name"],
                "type": branch.get("org_type", "branch"),
                "city": branch.get("city", ""),
                "switch_as": "tenant_admin"
            })
        
        for org in parent_orgs:
            branches = branch_map.get(org["id"], [])
            # If searching, also include orgs that have matching branches
            if search and not branches:
                matching_branches = [b for b in all_branches 
                                   if b.get("parent_org_id") == org["id"] 
                                   and search.lower() in b.get("org_name", "").lower()]
                branches = [{
                    "id": b["id"],
                    "name": b["org_name"],
                    "type": b.get("org_type", "branch"),
                    "city": b.get("city", ""),
                    "switch_as": "tenant_admin"
                } for b in matching_branches]
            
            tree.append({
                "id": org["id"],
                "name": org["org_name"],
                "type": org.get("org_type", "organization"),
                "city": org.get("city", ""),
                "is_parent": True,
                "switch_as": "super_admin",
                "branches": branches,
                "branch_count": len(branches)
            })
        
        # If searching, also include standalone branches that match
        if search:
            for branch in all_branches:
                if search.lower() in branch.get("org_name", "").lower():
                    # Check if this branch's parent is already in tree
                    parent_in_tree = any(o["id"] == branch.get("parent_org_id") for o in tree)
                    if not parent_in_tree:
                        # Add as standalone
                        tree.append({
                            "id": branch["id"],
                            "name": branch["org_name"],
                            "type": branch.get("org_type", "branch"),
                            "city": branch.get("city", ""),
                            "is_parent": False,
                            "switch_as": "tenant_admin",
                            "branches": [],
                            "branch_count": 0
                        })
        
        total_orgs = len(parent_orgs)
        total_branches = len(all_branches)
        
    elif user_type == "super_admin":
        # Get current org and its branches
        current_org = await db.organizations.find_one(
            {"id": user_org_id},
            {"_id": 0, "id": 1, "org_name": 1, "org_type": 1, "city": 1}
        )
        
        branch_query = {"parent_org_id": user_org_id, "is_active": True}
        if search:
            branch_query["org_name"] = {"$regex": search, "$options": "i"}
        
        branches = await db.organizations.find(
            branch_query,
            {"_id": 0, "id": 1, "org_name": 1, "org_type": 1, "city": 1}
        ).sort("org_name", 1).to_list(100)
        
        branch_list = [{
            "id": b["id"],
            "name": b["org_name"],
            "type": b.get("org_type", "branch"),
            "city": b.get("city", ""),
            "switch_as": "tenant_admin"
        } for b in branches]
        
        tree = [{
            "id": current_org["id"] if current_org else user_org_id,
            "name": current_org.get("org_name", "Current Organization") if current_org else "Current Organization",
            "type": current_org.get("org_type", "organization") if current_org else "organization",
            "city": current_org.get("city", "") if current_org else "",
            "is_parent": True,
            "is_current": True,
            "switch_as": "super_admin",
            "branches": branch_list,
            "branch_count": len(branch_list)
        }]
        
        total_orgs = 1
        total_branches = len(branches)
    
    else:
        tree = []
        total_orgs = 0
        total_branches = 0
    
    return {
        "organizations": tree,
        "total_orgs": total_orgs,
        "total_branches": total_branches,
        "can_switch": user_type in ["system_admin", "super_admin"]
    }
