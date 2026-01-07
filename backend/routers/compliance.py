"""
Compliance Management Router
Handles compliance requirements and organization compliance tracking.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone, timedelta

from database import db
from models.compliance import (
    ComplianceRequirement, ComplianceRequirementCreate, ComplianceRequirementUpdate,
    OrganizationCompliance, OrganizationComplianceUpdate,
    ComplianceStatus, ComplianceCategory, DEFAULT_COMPLIANCE_REQUIREMENTS
)
from services import get_current_user
from middleware import ReadAccess, WriteAccess, OrgAccessHelper

router = APIRouter(prefix="/compliance", tags=["Compliance"])


def calculate_days_until_expiry(expiry_date: str) -> Optional[int]:
    if not expiry_date:
        return None
    try:
        expiry = datetime.strptime(expiry_date, "%Y-%m-%d")
        today = datetime.now()
        return (expiry - today).days
    except:
        return None


def is_expired(expiry_date: str) -> bool:
    days = calculate_days_until_expiry(expiry_date)
    return days is not None and days < 0


# ==================== Compliance Requirements CRUD ====================

@router.get("/requirements")
async def get_compliance_requirements(
    category: Optional[str] = None,
    mandatory_only: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get all compliance requirements"""
    query = {"is_active": True}
    if category:
        query["category"] = category
    if mandatory_only:
        query["is_mandatory"] = True
    
    requirements = await db.compliance_requirements.find(query, {"_id": 0}).sort("name", 1).to_list(100)
    return requirements


@router.post("/requirements")
async def create_compliance_requirement(
    requirement: ComplianceRequirementCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new compliance requirement (System Admin only)"""
    if current_user.get("user_type") != "system_admin":
        raise HTTPException(status_code=403, detail="Only system admins can create compliance requirements")
    
    req_dict = requirement.model_dump()
    req_dict["id"] = str(__import__("uuid").uuid4())
    req_dict["is_active"] = True
    req_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    req_dict["created_by"] = current_user["id"]
    
    await db.compliance_requirements.insert_one(req_dict)
    
    return {"status": "success", "message": "Requirement created", "id": req_dict["id"]}


@router.put("/requirements/{req_id}")
async def update_compliance_requirement(
    req_id: str,
    updates: ComplianceRequirementUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a compliance requirement (System Admin only)"""
    if current_user.get("user_type") != "system_admin":
        raise HTTPException(status_code=403, detail="Only system admins can update compliance requirements")
    
    req = await db.compliance_requirements.find_one({"id": req_id})
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")
    
    update_data = updates.model_dump(exclude_unset=True)
    if update_data:
        await db.compliance_requirements.update_one({"id": req_id}, {"$set": update_data})
    
    return {"status": "success", "message": "Requirement updated"}


@router.delete("/requirements/{req_id}")
async def delete_compliance_requirement(
    req_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Deactivate a compliance requirement (System Admin only)"""
    if current_user.get("user_type") != "system_admin":
        raise HTTPException(status_code=403, detail="Only system admins can delete compliance requirements")
    
    req = await db.compliance_requirements.find_one({"id": req_id})
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")
    
    await db.compliance_requirements.update_one({"id": req_id}, {"$set": {"is_active": False}})
    
    return {"status": "success", "message": "Requirement deactivated"}


# ==================== Organization Compliance ====================

@router.get("/organizations/{org_id}")
async def get_organization_compliance(
    org_id: str,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """Get compliance status for an organization"""
    if org_id not in access.org_ids:
        raise HTTPException(status_code=403, detail="No access to this organization")
    
    # Get all active requirements
    requirements = await db.compliance_requirements.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    # Get organization's compliance records
    org_compliance = await db.organization_compliance.find(
        {"org_id": org_id}, {"_id": 0}
    ).to_list(100)
    
    compliance_map = {c["requirement_id"]: c for c in org_compliance}
    
    # Build response with requirement details and compliance status
    result = []
    for req in requirements:
        compliance = compliance_map.get(req["id"])
        
        item = {
            "requirement": req,
            "compliance": compliance,
            "status": ComplianceStatus.PENDING.value,
            "is_expired": False,
            "days_until_expiry": None
        }
        
        if compliance:
            item["status"] = compliance.get("status", ComplianceStatus.PENDING.value)
            expiry = compliance.get("expiry_date")
            if expiry:
                item["is_expired"] = is_expired(expiry)
                item["days_until_expiry"] = calculate_days_until_expiry(expiry)
                # Auto-update status if expired
                if item["is_expired"] and item["status"] == ComplianceStatus.COMPLIANT.value:
                    item["status"] = ComplianceStatus.EXPIRED.value
        
        result.append(item)
    
    return result


@router.post("/organizations/{org_id}")
async def update_organization_compliance(
    org_id: str,
    requirement_id: str,
    updates: OrganizationComplianceUpdate,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(WriteAccess)
):
    """Update compliance status for an organization"""
    if org_id not in access.org_ids:
        raise HTTPException(status_code=403, detail="No write access to this organization")
    
    # Verify requirement exists
    req = await db.compliance_requirements.find_one({"id": requirement_id, "is_active": True})
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")
    
    # Check if compliance record exists
    existing = await db.organization_compliance.find_one({
        "org_id": org_id, "requirement_id": requirement_id
    })
    
    update_data = updates.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Add verification info if status is being set to compliant
    if update_data.get("status") == ComplianceStatus.COMPLIANT.value:
        update_data["verified_by"] = current_user["id"]
        update_data["verified_at"] = datetime.now(timezone.utc).isoformat()
    
    if existing:
        await db.organization_compliance.update_one(
            {"id": existing["id"]},
            {"$set": update_data}
        )
    else:
        new_compliance = {
            "id": str(__import__("uuid").uuid4()),
            "org_id": org_id,
            "requirement_id": requirement_id,
            "status": update_data.get("status", ComplianceStatus.PENDING.value),
            "linked_document_id": update_data.get("linked_document_id"),
            "expiry_date": update_data.get("expiry_date"),
            "notes": update_data.get("notes"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            **update_data
        }
        await db.organization_compliance.insert_one(new_compliance)
    
    return {"status": "success", "message": "Compliance updated"}


@router.post("/organizations/{org_id}/link-document")
async def link_document_to_compliance(
    org_id: str,
    requirement_id: str,
    document_id: str,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(WriteAccess)
):
    """Link a document to a compliance requirement"""
    if org_id not in access.org_ids:
        raise HTTPException(status_code=403, detail="No write access to this organization")
    
    # Verify document exists and belongs to org
    doc = await db.documents.find_one({"id": document_id, "org_id": org_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Get or create compliance record
    existing = await db.organization_compliance.find_one({
        "org_id": org_id, "requirement_id": requirement_id
    })
    
    update_data = {
        "linked_document_id": document_id,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Use document expiry date if available
    if doc.get("expiry_date"):
        update_data["expiry_date"] = doc["expiry_date"]
    
    if existing:
        await db.organization_compliance.update_one(
            {"id": existing["id"]},
            {"$set": update_data}
        )
    else:
        new_compliance = {
            "id": str(__import__("uuid").uuid4()),
            "org_id": org_id,
            "requirement_id": requirement_id,
            "status": ComplianceStatus.PENDING.value,
            "created_at": datetime.now(timezone.utc).isoformat(),
            **update_data
        }
        await db.organization_compliance.insert_one(new_compliance)
    
    return {"status": "success", "message": "Document linked to compliance"}


@router.get("/organizations/{org_id}/summary")
async def get_compliance_summary(
    org_id: str,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """Get compliance summary/statistics for an organization"""
    if org_id not in access.org_ids:
        raise HTTPException(status_code=403, detail="No access to this organization")
    
    # Get all requirements
    requirements = await db.compliance_requirements.find({"is_active": True}, {"_id": 0}).to_list(100)
    mandatory_count = sum(1 for r in requirements if r.get("is_mandatory"))
    
    # Get compliance records
    compliance_records = await db.organization_compliance.find({"org_id": org_id}, {"_id": 0}).to_list(100)
    compliance_map = {c["requirement_id"]: c for c in compliance_records}
    
    # Calculate stats
    compliant = 0
    non_compliant = 0
    pending = 0
    expired = 0
    expiring_soon = 0
    mandatory_compliant = 0
    
    for req in requirements:
        compliance = compliance_map.get(req["id"])
        
        if compliance:
            status = compliance.get("status", "pending")
            expiry = compliance.get("expiry_date")
            
            # Check for expired
            if expiry and is_expired(expiry):
                expired += 1
                status = "expired"
            elif expiry:
                days = calculate_days_until_expiry(expiry)
                if days is not None and 0 < days <= 30:
                    expiring_soon += 1
            
            if status == "compliant":
                compliant += 1
                if req.get("is_mandatory"):
                    mandatory_compliant += 1
            elif status == "non_compliant":
                non_compliant += 1
            elif status == "expired":
                pass  # Already counted
            else:
                pending += 1
        else:
            pending += 1
    
    return {
        "total_requirements": len(requirements),
        "mandatory_requirements": mandatory_count,
        "compliant": compliant,
        "non_compliant": non_compliant,
        "pending": pending,
        "expired": expired,
        "expiring_soon": expiring_soon,
        "mandatory_compliant": mandatory_compliant,
        "compliance_rate": round((compliant / len(requirements) * 100) if requirements else 0, 1),
        "mandatory_compliance_rate": round((mandatory_compliant / mandatory_count * 100) if mandatory_count else 0, 1)
    }


# ==================== Seed Default Requirements ====================

@router.post("/seed-defaults")
async def seed_default_requirements(
    current_user: dict = Depends(get_current_user)
):
    """Seed default compliance requirements (System Admin only)"""
    if current_user.get("user_type") != "system_admin":
        raise HTTPException(status_code=403, detail="Only system admins can seed requirements")
    
    created = 0
    for req_data in DEFAULT_COMPLIANCE_REQUIREMENTS:
        # Check if already exists
        existing = await db.compliance_requirements.find_one({"name": req_data["name"]})
        if not existing:
            req_dict = {
                "id": str(__import__("uuid").uuid4()),
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": current_user["id"],
                **req_data
            }
            await db.compliance_requirements.insert_one(req_dict)
            created += 1
    
    return {"status": "success", "message": f"Created {created} compliance requirements"}
