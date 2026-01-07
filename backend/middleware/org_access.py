"""
Organization Access Control Middleware
Provides Row-Level Security (RLS) filtering based on user's organization access.
"""
from typing import List, Optional, Callable
from functools import wraps
from fastapi import HTTPException, Depends

from database import db
from services import get_current_user


async def get_user_accessible_org_ids(user: dict) -> List[str]:
    """
    Get list of organization IDs the user can ACCESS (read).
    
    When impersonating (context switched), ONLY return the target org - no children.
    This ensures the user sees exactly what that org's admin would see.
    
    Access Rules (when NOT impersonating):
    - System Admin: All organizations
    - Super Admin: Own org + all child branches
    - Tenant Admin: Own org + parent + sibling branches
    - Staff: Own org only
    """
    user_type = user.get("user_type", "staff")
    user_org_id = user.get("org_id")
    is_impersonating = user.get("is_impersonating", False)
    
    # When impersonating, restrict to ONLY the target org
    if is_impersonating and user_org_id:
        return [user_org_id]
    
    # Not impersonating - use normal access rules
    
    # System admin can access everything
    if user_type == "system_admin":
        orgs = await db.organizations.find({"is_active": True}, {"id": 1, "_id": 0}).to_list(1000)
        return [org["id"] for org in orgs]
    
    # If user has no org, they can't access anything
    if not user_org_id:
        return []
    
    org_ids = [user_org_id]
    
    # Get user's organization info
    user_org = await db.organizations.find_one({"id": user_org_id}, {"_id": 0})
    if not user_org:
        return org_ids
    
    if user_type == "super_admin":
        # Super Admin: Own org + all children
        children = await db.organizations.find(
            {"parent_org_id": user_org_id, "is_active": True},
            {"id": 1, "_id": 0}
        ).to_list(100)
        org_ids.extend([c["id"] for c in children])
    
    elif user_type == "tenant_admin":
        # Tenant Admin: Own org + parent + siblings
        parent_org_id = user_org.get("parent_org_id")
        if parent_org_id:
            org_ids.append(parent_org_id)
            # Get siblings (other branches under same parent)
            siblings = await db.organizations.find(
                {"parent_org_id": parent_org_id, "id": {"$ne": user_org_id}, "is_active": True},
                {"id": 1, "_id": 0}
            ).to_list(100)
            org_ids.extend([s["id"] for s in siblings])
    
    # Staff: Only own org (already in org_ids)
    
    return org_ids


async def get_user_writable_org_ids(user: dict) -> List[str]:
    """
    Get list of organization IDs the user can WRITE to (create/update/delete).
    
    When impersonating (context switched), ONLY return the target org - no children.
    
    Write Rules (when NOT impersonating):
    - System Admin: All organizations
    - Super Admin: Own org + child branches
    - Tenant Admin: Own org only
    - Staff: Own org only
    """
    user_type = user.get("user_type", "staff")
    user_org_id = user.get("org_id")
    is_impersonating = user.get("is_impersonating", False)
    
    # When impersonating, restrict to ONLY the target org
    if is_impersonating and user_org_id:
        return [user_org_id]
    
    # Not impersonating - use normal access rules
    
    # System admin can write to everything
    if user_type == "system_admin":
        orgs = await db.organizations.find({"is_active": True}, {"id": 1, "_id": 0}).to_list(1000)
        return [org["id"] for org in orgs]
    
    if not user_org_id:
        return []
    
    org_ids = [user_org_id]
    
    if user_type == "super_admin":
        # Super Admin can also write to child branches
        children = await db.organizations.find(
            {"parent_org_id": user_org_id, "is_active": True},
            {"id": 1, "_id": 0}
        ).to_list(100)
        org_ids.extend([c["id"] for c in children])
    
    # Tenant Admin and Staff can only write to their own org
    
    return org_ids


async def can_access_org(user: dict, target_org_id: str) -> bool:
    """Check if user can access (read) a specific organization."""
    accessible_orgs = await get_user_accessible_org_ids(user)
    return target_org_id in accessible_orgs


async def can_write_org(user: dict, target_org_id: str) -> bool:
    """Check if user can write to a specific organization."""
    writable_orgs = await get_user_writable_org_ids(user)
    return target_org_id in writable_orgs


def build_org_filter(user: dict, accessible_org_ids: List[str], additional_filter: dict = None) -> dict:
    """
    Build MongoDB query filter with org_id restriction.
    
    Args:
        user: Current user dict
        accessible_org_ids: List of org IDs user can access
        additional_filter: Additional query conditions
    
    Returns:
        MongoDB query filter dict
    """
    # Base filter with org_id restriction
    query = {"org_id": {"$in": accessible_org_ids}}
    
    # Merge with additional filter if provided
    if additional_filter:
        query.update(additional_filter)
    
    return query


class OrgAccessControl:
    """
    Dependency class for organization-based access control.
    Use in FastAPI route dependencies.
    """
    
    def __init__(self, require_write: bool = False):
        self.require_write = require_write
    
    async def __call__(self, current_user: dict = Depends(get_current_user)):
        """
        Returns a helper object with access control methods.
        """
        if self.require_write:
            org_ids = await get_user_writable_org_ids(current_user)
        else:
            org_ids = await get_user_accessible_org_ids(current_user)
        
        return OrgAccessHelper(current_user, org_ids, self.require_write)


class OrgAccessHelper:
    """Helper class providing org-filtered query building."""
    
    def __init__(self, user: dict, org_ids: List[str], is_write: bool = False):
        self.user = user
        self.org_ids = org_ids
        self.is_write = is_write
        self.user_type = user.get("user_type", "staff")
        self.user_org_id = user.get("org_id")
    
    def filter(self, additional_query: dict = None) -> dict:
        """Build query filter with org restriction."""
        query = {"org_id": {"$in": self.org_ids}}
        if additional_query:
            query.update(additional_query)
        return query
    
    def can_access(self, org_id: str) -> bool:
        """Check if user can access given org_id."""
        return org_id in self.org_ids
    
    def is_own_org(self, org_id: str) -> bool:
        """Check if org_id is user's own organization."""
        return org_id == self.user_org_id
    
    def get_default_org_id(self) -> Optional[str]:
        """Get user's default org_id for creating new records."""
        return self.user_org_id
    
    def is_system_admin(self) -> bool:
        return self.user_type == "system_admin"
    
    def is_super_admin(self) -> bool:
        return self.user_type == "super_admin"
    
    def is_tenant_admin(self) -> bool:
        return self.user_type == "tenant_admin"
    
    def is_staff(self) -> bool:
        return self.user_type == "staff"
    
    def can_manage_users(self) -> bool:
        """Check if user can create/manage other users."""
        return self.user_type in ["system_admin", "super_admin", "tenant_admin"]
    
    def can_view_network(self) -> bool:
        """Check if user can view network-wide data."""
        return self.user_type in ["system_admin", "super_admin", "tenant_admin"]


# Convenience dependencies
ReadAccess = OrgAccessControl(require_write=False)
WriteAccess = OrgAccessControl(require_write=True)


async def require_system_admin(current_user: dict = Depends(get_current_user)):
    """Dependency that requires system admin role."""
    if current_user.get("user_type") != "system_admin":
        raise HTTPException(status_code=403, detail="System Admin access required")
    return current_user


async def require_super_admin_or_above(current_user: dict = Depends(get_current_user)):
    """Dependency that requires super admin or system admin role."""
    if current_user.get("user_type") not in ["system_admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Super Admin or higher access required")
    return current_user


async def require_tenant_admin_or_above(current_user: dict = Depends(get_current_user)):
    """Dependency that requires tenant admin or higher role."""
    if current_user.get("user_type") not in ["system_admin", "super_admin", "tenant_admin"]:
        raise HTTPException(status_code=403, detail="Tenant Admin or higher access required")
    return current_user
