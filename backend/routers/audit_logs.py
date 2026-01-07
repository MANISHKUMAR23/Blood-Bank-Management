"""
Audit Logs Router
API endpoints for viewing and exporting audit logs.
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Response
from fastapi.responses import StreamingResponse
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import csv
import io

from database import db
from models.audit import AuditAction, AuditModule, AuditLogResponse
from services import get_current_user
from middleware import ReadAccess, OrgAccessHelper, require_tenant_admin_or_above

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get("")
async def get_audit_logs(
    org_id: Optional[str] = None,
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    module: Optional[str] = None,
    record_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(require_tenant_admin_or_above),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """
    Get audit logs with filtering.
    
    Access:
    - System Admin: All logs
    - Super Admin: Own org + children
    - Tenant Admin: Own branch only
    """
    # Build query based on access level
    query = {}
    
    if access.is_system_admin():
        # Can see all logs, optionally filter by org
        if org_id:
            query["org_id"] = org_id
    elif access.is_super_admin():
        # Can see own org + children
        query["org_id"] = {"$in": access.org_ids}
        if org_id and org_id in access.org_ids:
            query["org_id"] = org_id
    else:
        # Tenant admin - own org only
        query["org_id"] = access.get_default_org_id()
    
    # Apply filters
    if user_id:
        query["user_id"] = user_id
    if action:
        query["action"] = action
    if module:
        query["module"] = module
    if record_id:
        query["record_id"] = record_id
    
    # Date range
    if start_date:
        query["timestamp"] = query.get("timestamp", {})
        query["timestamp"]["$gte"] = start_date
    if end_date:
        query["timestamp"] = query.get("timestamp", {})
        query["timestamp"]["$lte"] = end_date
    
    # Search in description or record_id
    if search:
        query["$or"] = [
            {"description": {"$regex": search, "$options": "i"}},
            {"record_id": {"$regex": search, "$options": "i"}},
            {"user_name": {"$regex": search, "$options": "i"}},
            {"user_email": {"$regex": search, "$options": "i"}}
        ]
    
    # Get total count
    total = await db.audit_logs.count_documents(query)
    
    # Calculate skip
    skip = (page - 1) * page_size
    
    # Fetch logs
    logs = await db.audit_logs.find(query, {"_id": 0}) \
        .sort("timestamp", -1) \
        .skip(skip) \
        .limit(page_size) \
        .to_list(page_size)
    
    # Enrich with org names
    for log in logs:
        if log.get("org_id"):
            org = await db.organizations.find_one({"id": log["org_id"]}, {"org_name": 1})
            log["org_name"] = org.get("org_name") if org else None
    
    return {
        "logs": logs,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_more": skip + len(logs) < total,
        "total_pages": (total + page_size - 1) // page_size
    }


@router.get("/summary")
async def get_audit_summary(
    days: int = Query(7, ge=1, le=90),
    current_user: dict = Depends(require_tenant_admin_or_above),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """Get audit log summary statistics."""
    # Build org filter
    if access.is_system_admin():
        org_filter = {}
    else:
        org_filter = {"org_id": {"$in": access.org_ids}}
    
    # Time range
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    time_filter = {"timestamp": {"$gte": start_date}}
    
    query = {**org_filter, **time_filter}
    
    # Actions by type
    actions_pipeline = [
        {"$match": query},
        {"$group": {"_id": "$action", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    actions = await db.audit_logs.aggregate(actions_pipeline).to_list(20)
    
    # Modules by activity
    modules_pipeline = [
        {"$match": query},
        {"$group": {"_id": "$module", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    modules = await db.audit_logs.aggregate(modules_pipeline).to_list(20)
    
    # Users by activity
    users_pipeline = [
        {"$match": query},
        {"$group": {"_id": {"user_id": "$user_id", "user_name": "$user_name"}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    users = await db.audit_logs.aggregate(users_pipeline).to_list(10)
    
    # Daily activity
    daily_pipeline = [
        {"$match": query},
        {"$group": {
            "_id": {"$substr": ["$timestamp", 0, 10]},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    daily = await db.audit_logs.aggregate(daily_pipeline).to_list(90)
    
    # Security events
    security_actions = ["login_failed", "account_locked", "permission_denied", "session_terminated"]
    security_count = await db.audit_logs.count_documents({
        **query,
        "action": {"$in": security_actions}
    })
    
    # Total counts
    total_logs = await db.audit_logs.count_documents(query)
    
    return {
        "period_days": days,
        "total_logs": total_logs,
        "actions_breakdown": {a["_id"]: a["count"] for a in actions},
        "modules_breakdown": {m["_id"]: m["count"] for m in modules},
        "top_users": [{"user_id": u["_id"]["user_id"], "user_name": u["_id"]["user_name"], "count": u["count"]} for u in users],
        "daily_activity": {d["_id"]: d["count"] for d in daily},
        "security_events": security_count
    }


@router.get("/{log_id}")
async def get_audit_log_detail(
    log_id: str,
    current_user: dict = Depends(require_tenant_admin_or_above),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """Get detailed view of a specific audit log."""
    log = await db.audit_logs.find_one({"id": log_id}, {"_id": 0})
    if not log:
        raise HTTPException(status_code=404, detail="Audit log not found")
    
    # Check access
    if not access.is_system_admin():
        if log.get("org_id") and log["org_id"] not in access.org_ids:
            raise HTTPException(status_code=403, detail="Access denied to this audit log")
    
    # Get related record if exists
    if log.get("record_id") and log.get("module"):
        collection_map = {
            "donors": "donors",
            "donations": "donations",
            "blood_units": "blood_units",
            "components": "components",
            "requests": "blood_requests",
            "users": "users",
            "organizations": "organizations",
            "inter_org_requests": "inter_org_requests"
        }
        collection_name = collection_map.get(log["module"])
        if collection_name:
            related = await db[collection_name].find_one(
                {"$or": [{"id": log["record_id"]}, {"donor_id": log["record_id"]}]},
                {"_id": 0}
            )
            log["related_record"] = related
    
    # Get org info
    if log.get("org_id"):
        org = await db.organizations.find_one({"id": log["org_id"]}, {"_id": 0, "org_name": 1, "org_type": 1})
        log["org_info"] = org
    
    # Get user info
    if log.get("user_id"):
        user = await db.users.find_one({"id": log["user_id"]}, {"_id": 0, "id": 1, "email": 1, "full_name": 1, "role": 1})
        log["user_info"] = user
    
    return log


@router.get("/export/csv")
async def export_audit_logs_csv(
    org_id: Optional[str] = None,
    action: Optional[str] = None,
    module: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(require_tenant_admin_or_above),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """Export audit logs to CSV."""
    # Build query (same as get_audit_logs)
    query = {}
    
    if access.is_system_admin():
        if org_id:
            query["org_id"] = org_id
    elif access.is_super_admin():
        query["org_id"] = {"$in": access.org_ids}
        if org_id and org_id in access.org_ids:
            query["org_id"] = org_id
    else:
        query["org_id"] = access.get_default_org_id()
    
    if action:
        query["action"] = action
    if module:
        query["module"] = module
    if start_date:
        query["timestamp"] = query.get("timestamp", {})
        query["timestamp"]["$gte"] = start_date
    if end_date:
        query["timestamp"] = query.get("timestamp", {})
        query["timestamp"]["$lte"] = end_date
    
    # Fetch logs (limit to 10000)
    logs = await db.audit_logs.find(query, {"_id": 0}) \
        .sort("timestamp", -1) \
        .limit(10000) \
        .to_list(10000)
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "Timestamp", "User", "Email", "User Type", "Action", "Module",
        "Record ID", "Record Type", "Description", "IP Address", "Context"
    ])
    
    # Data rows
    for log in logs:
        writer.writerow([
            log.get("timestamp", ""),
            log.get("user_name", ""),
            log.get("user_email", ""),
            log.get("user_type", ""),
            log.get("action", ""),
            log.get("module", ""),
            log.get("record_id", ""),
            log.get("record_type", ""),
            log.get("description", ""),
            log.get("ip_address", ""),
            log.get("context_info", "")
        ])
    
    output.seek(0)
    
    filename = f"audit_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/actions/list")
async def get_action_types():
    """Get list of available action types."""
    return [{"value": a.value, "label": a.value.replace("_", " ").title()} for a in AuditAction]


@router.get("/modules/list")
async def get_module_types():
    """Get list of available module types."""
    return [{"value": m.value, "label": m.value.replace("_", " ").title()} for m in AuditModule]


@router.get("/recent")
async def get_recent_activity(
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_tenant_admin_or_above),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """Get recent audit activity for dashboard."""
    if access.is_system_admin():
        query = {}
    else:
        query = {"org_id": {"$in": access.org_ids}}
    
    logs = await db.audit_logs.find(query, {"_id": 0}) \
        .sort("timestamp", -1) \
        .limit(limit) \
        .to_list(limit)
    
    # Enrich with org names
    for log in logs:
        if log.get("org_id"):
            org = await db.organizations.find_one({"id": log["org_id"]}, {"org_name": 1})
            log["org_name"] = org.get("org_name") if org else None
    
    return logs


@router.get("/security-events")
async def get_security_events(
    days: int = Query(7, ge=1, le=30),
    current_user: dict = Depends(require_tenant_admin_or_above),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """Get security-related audit events."""
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    security_actions = [
        "login_failed", "account_locked", "account_unlocked",
        "permission_denied", "session_terminated", "mfa_enabled", "mfa_disabled",
        "password_change", "password_reset"
    ]
    
    query = {
        "action": {"$in": security_actions},
        "timestamp": {"$gte": start_date}
    }
    
    if not access.is_system_admin():
        query["org_id"] = {"$in": access.org_ids}
    
    logs = await db.audit_logs.find(query, {"_id": 0}) \
        .sort("timestamp", -1) \
        .limit(200) \
        .to_list(200)
    
    # Group by type
    failed_logins = [log for log in logs if log.get("action") == "login_failed"]
    locked_accounts = [log for log in logs if log.get("action") == "account_locked"]
    permission_denied = [log for log in logs if log.get("action") == "permission_denied"]
    
    return {
        "total_events": len(logs),
        "failed_logins": len(failed_logins),
        "locked_accounts": len(locked_accounts),
        "permission_denied": len(permission_denied),
        "recent_events": logs[:50]
    }
