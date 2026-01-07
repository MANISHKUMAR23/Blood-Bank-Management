"""
Organization Management Router
Handles multi-tenancy operations for the blood bank network.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, EmailStr

from database import db
from models import (
    Organization, OrganizationCreate, OrganizationUpdate, OrganizationResponse,
    ExternalOrganization, ExternalOrganizationCreate,
    UserType, OrgType
)
from services import get_current_user, hash_password
import uuid

router = APIRouter(prefix="/organizations", tags=["Organizations"])


# ============== Combined Creation Models ==============

class CreateOrgWithAdmin(BaseModel):
    """Create organization with its admin in one request"""
    # Organization fields
    org_name: str
    org_type: str = "standalone"
    is_parent: bool = True
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    license_number: Optional[str] = None
    
    # Admin user fields
    admin_email: EmailStr
    admin_password: str
    admin_full_name: str
    admin_phone: Optional[str] = None


class CreateBranchWithAdmin(BaseModel):
    """Create branch under parent org with tenant admin"""
    # Branch fields
    org_name: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    license_number: Optional[str] = None
    
    # Admin user fields
    admin_email: EmailStr
    admin_password: str
    admin_full_name: str
    admin_phone: Optional[str] = None


# ============== Helper Functions ==============

async def get_org_staff_count(org_id: str) -> int:
    """Get count of staff in an organization"""
    return await db.users.count_documents({"org_id": org_id, "is_active": True})


async def get_org_inventory_count(org_id: str) -> int:
    """Get count of inventory items (components) in an organization"""
    return await db.components.count_documents({
        "org_id": org_id,
        "status": {"$in": ["ready_to_use", "reserved"]}
    })


async def check_org_access(current_user: dict, target_org_id: str, write_access: bool = False) -> bool:
    """
    Check if user has access to target organization.
    write_access=True means user needs edit permissions.
    """
    user_type = current_user.get("user_type", "staff")
    user_org_id = current_user.get("org_id")
    
    # System admin has access to everything
    if user_type == "system_admin":
        return True
    
    # If user has no org, they can't access anything
    if not user_org_id:
        return False
    
    # Same org - full access
    if user_org_id == target_org_id:
        return True
    
    # Get user's org info
    user_org = await db.organizations.find_one({"id": user_org_id}, {"_id": 0})
    if not user_org:
        return False
    
    # Get target org info
    target_org = await db.organizations.find_one({"id": target_org_id}, {"_id": 0})
    if not target_org:
        return False
    
    if user_type == "super_admin":
        # Super admin can access own org + all children
        if target_org.get("parent_org_id") == user_org_id:
            return True
        return False
    
    if user_type == "tenant_admin":
        if write_access:
            # Tenant admin can only write to own org
            return False
        
        # Can read parent org
        if target_org_id == user_org.get("parent_org_id"):
            return True
        
        # Can read sibling orgs
        if user_org.get("parent_org_id") and target_org.get("parent_org_id") == user_org.get("parent_org_id"):
            return True
        
        return False
    
    # Staff can only access own org
    return False


async def get_accessible_org_ids(current_user: dict) -> List[str]:
    """Get list of organization IDs the user can access"""
    user_type = current_user.get("user_type", "staff")
    user_org_id = current_user.get("org_id")
    
    if user_type == "system_admin":
        # All orgs
        orgs = await db.organizations.find({}, {"id": 1, "_id": 0}).to_list(1000)
        return [org["id"] for org in orgs]
    
    if not user_org_id:
        return []
    
    org_ids = [user_org_id]
    
    user_org = await db.organizations.find_one({"id": user_org_id}, {"_id": 0})
    if not user_org:
        return org_ids
    
    if user_type == "super_admin":
        # Own org + all children
        children = await db.organizations.find(
            {"parent_org_id": user_org_id},
            {"id": 1, "_id": 0}
        ).to_list(100)
        org_ids.extend([c["id"] for c in children])
    
    elif user_type == "tenant_admin":
        # Own org + parent + siblings
        if user_org.get("parent_org_id"):
            org_ids.append(user_org["parent_org_id"])
            siblings = await db.organizations.find(
                {"parent_org_id": user_org["parent_org_id"], "id": {"$ne": user_org_id}},
                {"id": 1, "_id": 0}
            ).to_list(100)
            org_ids.extend([s["id"] for s in siblings])
    
    return org_ids


# ============== Public Endpoints ==============

@router.get("/public")
async def get_public_organizations():
    """
    Get list of active organizations for login dropdown.
    No authentication required.
    """
    orgs = await db.organizations.find(
        {"is_active": True},
        {"_id": 0}
    ).to_list(500)
    
    # Return simplified list for login dropdown
    result = []
    for org in orgs:
        result.append({
            "id": org.get("id"),
            "org_name": org.get("org_name"),
            "org_type": org.get("org_type"),
            "city": org.get("city"),
            "state": org.get("state"),
            "parent_org_id": org.get("parent_org_id"),
            "is_parent": org.get("is_parent", False)
        })
    
    return result


# ============== Organization CRUD ==============

@router.post("", response_model=OrganizationResponse)
async def create_organization(
    org_data: OrganizationCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new organization/branch.
    - System Admin: Can create any org
    - Super Admin: Can create child branches under their org
    """
    user_type = current_user.get("user_type", "staff")
    
    # Permission check
    if user_type not in ["system_admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only System Admin or Super Admin can create organizations")
    
    # Super Admin can only create branches under their org
    if user_type == "super_admin":
        if org_data.parent_org_id != current_user.get("org_id"):
            raise HTTPException(status_code=403, detail="Super Admin can only create branches under their organization")
        org_data.is_parent = False
    
    # Check if parent exists (if specified)
    if org_data.parent_org_id:
        parent = await db.organizations.find_one({"id": org_data.parent_org_id})
        if not parent:
            raise HTTPException(status_code=404, detail="Parent organization not found")
    
    # Create organization
    org = Organization(
        **org_data.model_dump(),
        created_by=current_user["id"],
        updated_by=current_user["id"]
    )
    
    doc = org.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    
    await db.organizations.insert_one(doc)
    
    return OrganizationResponse(**doc)


@router.get("", response_model=List[OrganizationResponse])
async def list_organizations(
    include_inactive: bool = Query(False),
    parent_only: bool = Query(False),
    current_user: dict = Depends(get_current_user)
):
    """
    List organizations based on user's access level.
    """
    accessible_org_ids = await get_accessible_org_ids(current_user)
    
    query = {"id": {"$in": accessible_org_ids}}
    if not include_inactive:
        query["is_active"] = True
    if parent_only:
        query["is_parent"] = True
    
    orgs = await db.organizations.find(query, {"_id": 0}).to_list(500)
    
    # Enrich with counts
    result = []
    for org in orgs:
        org["staff_count"] = await get_org_staff_count(org["id"])
        org["inventory_count"] = await get_org_inventory_count(org["id"])
        result.append(OrganizationResponse(**org))
    
    return result


@router.get("/hierarchy")
async def get_organization_hierarchy(current_user: dict = Depends(get_current_user)):
    """
    Get organization hierarchy tree.
    Returns parent orgs with their children nested.
    """
    accessible_org_ids = await get_accessible_org_ids(current_user)
    
    # Get all accessible orgs
    orgs = await db.organizations.find(
        {"id": {"$in": accessible_org_ids}, "is_active": True},
        {"_id": 0}
    ).to_list(500)
    
    # Build hierarchy
    org_map = {org["id"]: org for org in orgs}
    
    # Enrich with counts
    for org_id, org in org_map.items():
        org["staff_count"] = await get_org_staff_count(org_id)
        org["inventory_count"] = await get_org_inventory_count(org_id)
        org["children"] = []
    
    # Build tree
    roots = []
    for org in orgs:
        parent_id = org.get("parent_org_id")
        if parent_id and parent_id in org_map:
            org_map[parent_id]["children"].append(org)
        elif not parent_id or parent_id not in org_map:
            roots.append(org)
    
    return roots


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get organization details"""
    if not await check_org_access(current_user, org_id):
        raise HTTPException(status_code=403, detail="Access denied to this organization")
    
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    org["staff_count"] = await get_org_staff_count(org_id)
    org["inventory_count"] = await get_org_inventory_count(org_id)
    
    return OrganizationResponse(**org)


@router.put("/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: str,
    update_data: OrganizationUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update organization details"""
    if not await check_org_access(current_user, org_id, write_access=True):
        raise HTTPException(status_code=403, detail="No write access to this organization")
    
    org = await db.organizations.find_one({"id": org_id})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Build update
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_dict["updated_by"] = current_user["id"]
    
    await db.organizations.update_one(
        {"id": org_id},
        {"$set": update_dict}
    )
    
    updated = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    updated["staff_count"] = await get_org_staff_count(org_id)
    updated["inventory_count"] = await get_org_inventory_count(org_id)
    
    return OrganizationResponse(**updated)


@router.delete("/{org_id}")
async def deactivate_organization(
    org_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Deactivate an organization (soft delete)"""
    user_type = current_user.get("user_type", "staff")
    
    if user_type not in ["system_admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only System Admin or Super Admin can deactivate organizations")
    
    if not await check_org_access(current_user, org_id, write_access=True):
        raise HTTPException(status_code=403, detail="No write access to this organization")
    
    # Check if org has children
    children_count = await db.organizations.count_documents({"parent_org_id": org_id, "is_active": True})
    if children_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot deactivate organization with {children_count} active branches")
    
    await db.organizations.update_one(
        {"id": org_id},
        {"$set": {
            "is_active": False,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": current_user["id"]
        }}
    )
    
    return {"message": "Organization deactivated successfully"}


# ============== Inventory Summary ==============

@router.get("/{org_id}/inventory-summary")
async def get_org_inventory_summary(
    org_id: str,
    include_children: bool = Query(False),
    current_user: dict = Depends(get_current_user)
):
    """
    Get inventory summary for an organization.
    Super Admin can include_children=True to get consolidated view.
    """
    if not await check_org_access(current_user, org_id):
        raise HTTPException(status_code=403, detail="Access denied to this organization")
    
    org_ids = [org_id]
    
    if include_children:
        children = await db.organizations.find(
            {"parent_org_id": org_id, "is_active": True},
            {"id": 1, "_id": 0}
        ).to_list(100)
        org_ids.extend([c["id"] for c in children])
    
    # Aggregate inventory by blood group
    pipeline = [
        {"$match": {"org_id": {"$in": org_ids}, "status": {"$in": ["ready_to_use", "reserved"]}}},
        {"$group": {
            "_id": {"blood_group": "$blood_group", "component_type": "$component_type"},
            "count": {"$sum": 1}
        }}
    ]
    
    by_group_type = await db.components.aggregate(pipeline).to_list(100)
    
    # Count by blood group
    blood_group_counts = {}
    component_type_counts = {}
    total = 0
    
    for item in by_group_type:
        bg = item["_id"]["blood_group"]
        ct = item["_id"]["component_type"]
        count = item["count"]
        
        blood_group_counts[bg] = blood_group_counts.get(bg, 0) + count
        component_type_counts[ct] = component_type_counts.get(ct, 0) + count
        total += count
    
    # Get expiring soon (next 7 days)
    from datetime import timedelta
    expiry_date = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    expiring_count = await db.components.count_documents({
        "org_id": {"$in": org_ids},
        "status": {"$in": ["ready_to_use", "reserved"]},
        "expiry_date": {"$lte": expiry_date}
    })
    
    # Get by branch if include_children
    by_branch = []
    if include_children and len(org_ids) > 1:
        branch_pipeline = [
            {"$match": {"org_id": {"$in": org_ids}, "status": {"$in": ["ready_to_use", "reserved"]}}},
            {"$group": {"_id": "$org_id", "count": {"$sum": 1}}}
        ]
        branch_counts = await db.components.aggregate(branch_pipeline).to_list(100)
        
        for bc in branch_counts:
            org = await db.organizations.find_one({"id": bc["_id"]}, {"_id": 0, "org_name": 1})
            by_branch.append({
                "org_id": bc["_id"],
                "org_name": org.get("org_name", "Unknown") if org else "Unknown",
                "count": bc["count"]
            })
    
    return {
        "total_inventory": total,
        "by_blood_group": blood_group_counts,
        "by_component_type": component_type_counts,
        "expiring_soon": expiring_count,
        "by_branch": by_branch,
        "org_ids_included": org_ids
    }


# ============== External Organizations ==============

@router.get("/external/list")
async def list_external_organizations(
    is_active: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """List external organizations for the user's org"""
    user_org_id = current_user.get("org_id")
    if not user_org_id and current_user.get("user_type") != "system_admin":
        raise HTTPException(status_code=400, detail="User has no organization")
    
    query = {}
    if user_org_id:
        query["org_id"] = user_org_id
    if is_active is not None:
        query["is_active"] = is_active
    
    external_orgs = await db.external_organizations.find(query, {"_id": 0}).to_list(500)
    return external_orgs


@router.post("/external")
async def create_external_organization(
    ext_org_data: ExternalOrganizationCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new external organization entry"""
    user_org_id = current_user.get("org_id")
    user_type = current_user.get("user_type", "staff")
    
    if user_type == "staff":
        raise HTTPException(status_code=403, detail="Staff cannot create external organizations")
    
    if not user_org_id and user_type != "system_admin":
        raise HTTPException(status_code=400, detail="User has no organization")
    
    ext_org = ExternalOrganization(
        **ext_org_data.model_dump(),
        org_id=user_org_id or "system",
        created_by=current_user["id"]
    )
    
    doc = ext_org.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    
    await db.external_organizations.insert_one(doc)
    
    return {"id": ext_org.id, "message": "External organization created successfully"}


@router.put("/external/{ext_org_id}")
async def update_external_organization(
    ext_org_id: str,
    update_data: ExternalOrganizationCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update external organization"""
    ext_org = await db.external_organizations.find_one({"id": ext_org_id})
    if not ext_org:
        raise HTTPException(status_code=404, detail="External organization not found")
    
    # Check access
    if current_user.get("user_type") != "system_admin":
        if ext_org.get("org_id") != current_user.get("org_id"):
            raise HTTPException(status_code=403, detail="Access denied")
    
    await db.external_organizations.update_one(
        {"id": ext_org_id},
        {"$set": update_data.model_dump()}
    )
    
    return {"message": "External organization updated successfully"}


@router.get("/external/{ext_org_id}/history")
async def get_external_org_history(
    ext_org_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get transaction history with an external organization"""
    ext_org = await db.external_organizations.find_one({"id": ext_org_id}, {"_id": 0})
    if not ext_org:
        raise HTTPException(status_code=404, detail="External organization not found")
    
    # Get inter-org requests involving this external org
    requests = await db.inter_org_requests.find(
        {"external_org_id": ext_org_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {
        "external_org": ext_org,
        "transactions": requests,
        "total_transactions": len(requests)
    }
