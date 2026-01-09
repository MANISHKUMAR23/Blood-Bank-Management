from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid

import sys
sys.path.append('..')

from database import db
from models import UserResponse
from services import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])

# Default permissions by role
DEFAULT_PERMISSIONS = {
    "admin": ["*"],
    "registration": ["donors", "screening", "donor_requests"],
    "phlebotomist": ["screening", "collection"],
    "lab_tech": ["laboratory", "traceability"],
    "processing": ["processing", "traceability"],
    "qc_manager": ["qc_validation", "pre_lab_qc", "returns", "discards", "alerts"],
    "inventory": ["inventory", "storage", "requests", "returns", "discards", "alerts"],
    "distribution": ["requests", "distribution", "logistics"]
}

class CustomRoleCreate(BaseModel):
    name: str
    display_name: str
    permissions: List[str]
    description: Optional[str] = None

@router.get("", response_model=List[UserResponse])
async def get_users(
    org_id: Optional[str] = None,
    include_children: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """
    Get users based on current user's access level:
    - System Admin: Can see ALL users, with optional org filtering
    - Super Admin: Can see users in their org and child branches only
    - Tenant Admin: Can see users in their own branch only
    """
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    user_type = current_user.get("user_type", "staff")
    user_org_id = current_user.get("org_id")
    
    query = {}
    
    if user_type == "system_admin":
        # System admin can see all users, optionally filtered by org
        if org_id:
            if include_children:
                # Get this org + all child branches
                child_orgs = await db.organizations.find(
                    {"parent_org_id": org_id},
                    {"id": 1}
                ).to_list(100)
                org_ids = [org_id] + [o["id"] for o in child_orgs]
                query["org_id"] = {"$in": org_ids}
            else:
                query["org_id"] = org_id
        # If no org_id filter, return all users
        
    elif user_type == "super_admin":
        # Super admin can only see users in their org and child branches
        # Never see system_admin users
        if not user_org_id:
            return []
        
        # Get child branches
        child_orgs = await db.organizations.find(
            {"parent_org_id": user_org_id},
            {"id": 1}
        ).to_list(100)
        org_ids = [user_org_id] + [o["id"] for o in child_orgs]
        
        query["$and"] = [
            {"org_id": {"$in": org_ids}},
            {"user_type": {"$ne": "system_admin"}}  # Never show system admins
        ]
        
    elif user_type == "tenant_admin":
        # Tenant admin can only see users in their own branch
        if not user_org_id:
            return []
        
        query["$and"] = [
            {"org_id": user_org_id},
            {"user_type": {"$in": ["tenant_admin", "staff"]}}  # Only tenant admins and staff
        ]
        
    else:
        # Staff users cannot access user management
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@router.put("/{user_id}")
async def update_user(user_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    if "password" in updates:
        from services import hash_password
        updates["password_hash"] = hash_password(updates.pop("password"))
    
    result = await db.users.update_one({"id": user_id}, {"$set": updates})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "success"}

@router.put("/{user_id}/permissions")
async def update_user_permissions(
    user_id: str, 
    permissions: List[str],
    current_user: dict = Depends(get_current_user)
):
    """Update custom permissions for a user"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.users.update_one(
        {"id": user_id}, 
        {
            "$set": {
                "custom_permissions": permissions,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "success"}

@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "success"}

# Custom Roles Management
@router.get("/roles")
async def get_custom_roles(current_user: dict = Depends(get_current_user)):
    """Get all custom roles"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    roles = await db.custom_roles.find({}, {"_id": 0}).to_list(100)
    return {"default_permissions": DEFAULT_PERMISSIONS, "custom_roles": roles}

@router.post("/roles")
async def create_custom_role(
    role: CustomRoleCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a custom role"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if role name already exists
    existing = await db.custom_roles.find_one({"name": role.name})
    if existing:
        raise HTTPException(status_code=400, detail="Role with this name already exists")
    
    role_doc = {
        "id": str(uuid.uuid4()),
        "name": role.name,
        "display_name": role.display_name,
        "permissions": role.permissions,
        "description": role.description,
        "is_custom": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.custom_roles.insert_one(role_doc)
    # Remove MongoDB _id field for JSON serialization
    role_doc.pop('_id', None)
    return {"status": "success", "role": role_doc}

@router.delete("/roles/{role_id}")
async def delete_custom_role(role_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a custom role"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if any users have this role
    users_with_role = await db.users.count_documents({"role": role_id})
    if users_with_role > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete role: {users_with_role} user(s) have this role"
        )
    
    result = await db.custom_roles.delete_one({"id": role_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Role not found")
    return {"status": "success"}

@router.get("/permissions/modules")
async def get_available_modules(current_user: dict = Depends(get_current_user)):
    """Get list of available modules for permission assignment"""
    modules = [
        {"id": "dashboard", "name": "Dashboard", "category": "Core"},
        {"id": "donors", "name": "Donor Management", "category": "Registration"},
        {"id": "donor_requests", "name": "Donor Requests", "category": "Registration"},
        {"id": "screening", "name": "Screening", "category": "Registration"},
        {"id": "collection", "name": "Collection", "category": "Collection"},
        {"id": "traceability", "name": "Traceability", "category": "Laboratory"},
        {"id": "pre_lab_qc", "name": "Pre-Lab QC", "category": "Laboratory"},
        {"id": "laboratory", "name": "Laboratory Testing", "category": "Laboratory"},
        {"id": "processing", "name": "Component Processing", "category": "Processing"},
        {"id": "qc_validation", "name": "QC Validation", "category": "Quality Control"},
        {"id": "inventory", "name": "Inventory", "category": "Inventory"},
        {"id": "storage", "name": "Storage Management", "category": "Inventory"},
        {"id": "requests", "name": "Blood Requests", "category": "Distribution"},
        {"id": "distribution", "name": "Distribution", "category": "Distribution"},
        {"id": "logistics", "name": "Logistics", "category": "Distribution"},
        {"id": "returns", "name": "Returns", "category": "Disposition"},
        {"id": "discards", "name": "Discards", "category": "Disposition"},
        {"id": "reports", "name": "Reports", "category": "Analytics"},
        {"id": "alerts", "name": "Alerts", "category": "System"},
        {"id": "users", "name": "User Management", "category": "Admin"},
    ]
    return modules
