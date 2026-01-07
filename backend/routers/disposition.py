from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel

import sys
sys.path.append('..')

from database import db
from models import Return, Discard, UnitStatus, DiscardReason
from services import get_current_user, generate_return_id, generate_discard_id
from middleware import ReadAccess, WriteAccess, OrgAccessHelper

return_router = APIRouter(prefix="/returns", tags=["Returns"])
discard_router = APIRouter(prefix="/discards", tags=["Discards"])

# Enhanced Return Models
class ReturnCreate(BaseModel):
    component_id: str
    return_date: str
    source: str
    reason: str
    hospital_name: Optional[str] = None
    contact_person: Optional[str] = None
    transport_conditions: Optional[str] = None

class ReturnProcess(BaseModel):
    qc_pass: bool
    decision: str
    storage_location_id: Optional[str] = None
    qc_notes: Optional[str] = None

# Enhanced Discard Models
class DiscardCreate(BaseModel):
    component_id: str
    reason: DiscardReason
    discard_date: str
    reason_details: Optional[str] = None
    category: Optional[str] = "manual"  # manual, auto_expired, auto_qc_fail
    requires_authorization: bool = False

class DiscardAuthorize(BaseModel):
    authorized: bool
    authorization_notes: Optional[str] = None

# Returns
@return_router.post("")
async def create_return(
    data: ReturnCreate,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(WriteAccess)
):
    component = await db.components.find_one(
        access.filter({"$or": [{"id": data.component_id}, {"component_id": data.component_id}]}),
        {"_id": 0}
    )
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    
    return_record = Return(
        return_id=await generate_return_id(),
        component_id=component["id"],
        return_date=data.return_date,
        source=data.source,
        reason=data.reason,
        org_id=component.get("org_id") or access.get_default_org_id()
    )
    
    doc = return_record.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['hospital_name'] = data.hospital_name
    doc['contact_person'] = data.contact_person
    doc['transport_conditions'] = data.transport_conditions
    doc['storage_location_id'] = None
    doc['qc_notes'] = None
    
    await db.returns.insert_one(doc)
    
    await db.components.update_one(
        {"id": component["id"]},
        {"$set": {"status": UnitStatus.RETURNED.value}}
    )
    
    return {"status": "success", "return_id": return_record.return_id}

@return_router.get("")
async def get_returns(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    query = {}
    if status == "pending":
        query["decision"] = None
    elif status == "accepted":
        query["decision"] = "accept"
    elif status == "rejected":
        query["decision"] = "reject"
    
    returns = await db.returns.find(access.filter(query), {"_id": 0}).to_list(1000)
    return returns

@return_router.put("/{return_id}/process")
async def process_return(
    return_id: str,
    data: ReturnProcess,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(WriteAccess)
):
    return_record = await db.returns.find_one(
        access.filter({"$or": [{"id": return_id}, {"return_id": return_id}]}),
        {"_id": 0}
    )
    if not return_record:
        raise HTTPException(status_code=404, detail="Return record not found")
    
    update_data = {
        "qc_pass": data.qc_pass,
        "decision": data.decision,
        "processed_by": current_user["id"],
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "qc_notes": data.qc_notes
    }
    
    # If accepted with storage location, update storage assignment
    if data.decision == "accept" and data.storage_location_id:
        update_data["storage_location_id"] = data.storage_location_id
        
        # Get component to update its location
        component = await db.components.find_one(
            {"id": return_record["component_id"]},
            {"_id": 0}
        )
        
        if component:
            await db.components.update_one(
                {"id": return_record["component_id"]},
                {
                    "$set": {
                        "status": UnitStatus.READY_TO_USE.value,
                        "storage_location": data.storage_location_id,
                        "current_location": data.storage_location_id
                    }
                }
            )
            
            # Update storage location occupancy
            storage = await db.storage_locations.find_one({"id": data.storage_location_id})
            if storage:
                await db.storage_locations.update_one(
                    {"id": data.storage_location_id},
                    {"$inc": {"current_occupancy": 1}}
                )
    else:
        new_status = UnitStatus.READY_TO_USE.value if data.decision == "accept" else UnitStatus.DISCARDED.value
        await db.components.update_one(
            {"id": return_record["component_id"]},
            {"$set": {"status": new_status}}
        )
    
    await db.returns.update_one(
        {"$or": [{"id": return_id}, {"return_id": return_id}]},
        {"$set": update_data}
    )
    
    # Create discard record if rejected
    if data.decision == "reject":
        discard = Discard(
            discard_id=await generate_discard_id(),
            component_id=return_record["component_id"],
            reason=DiscardReason.REJECTED_RETURN,
            reason_details=f"Failed return QC: {return_record.get('reason')}. {data.qc_notes or ''}",
            discard_date=datetime.now(timezone.utc).isoformat().split("T")[0]
        )
        discard_doc = discard.model_dump()
        discard_doc['created_at'] = discard_doc['created_at'].isoformat()
        discard_doc['category'] = 'return_rejection'
        discard_doc['requires_authorization'] = False
        discard_doc['authorized'] = True
        discard_doc['authorized_by'] = current_user["id"]
        await db.discards.insert_one(discard_doc)
    
    return {"status": "success"}

# Discards
@discard_router.post("")
async def create_discard(
    data: DiscardCreate,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(WriteAccess)
):
    component = await db.components.find_one(
        access.filter({"$or": [{"id": data.component_id}, {"component_id": data.component_id}]}),
        {"_id": 0}
    )
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    
    # Determine if authorization is required based on reason
    requires_auth = data.requires_authorization
    if data.reason in [DiscardReason.REACTIVE, DiscardReason.FAILED_QC]:
        requires_auth = True  # Always require authorization for reactive/QC failures
    
    discard = Discard(
        discard_id=await generate_discard_id(),
        component_id=component["id"],
        reason=data.reason,
        reason_details=data.reason_details,
        discard_date=data.discard_date,
        processed_by=current_user["id"],
        org_id=component.get("org_id") or access.get_default_org_id()
    )
    
    doc = discard.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['category'] = data.category
    doc['requires_authorization'] = requires_auth
    doc['authorized'] = not requires_auth  # Auto-authorize if not required
    doc['authorized_by'] = current_user["id"] if not requires_auth else None
    doc['authorization_date'] = datetime.now(timezone.utc).isoformat() if not requires_auth else None
    
    await db.discards.insert_one(doc)
    
    # Only update component status if no authorization required
    if not requires_auth:
        await db.components.update_one(
            {"id": component["id"]},
            {"$set": {"status": UnitStatus.DISCARDED.value}}
        )
    else:
        await db.components.update_one(
            {"id": component["id"]},
            {"$set": {"status": "pending_discard"}}
        )
    
    return {
        "status": "success", 
        "discard_id": discard.discard_id,
        "requires_authorization": requires_auth
    }

@discard_router.get("")
async def get_discards(
    reason: Optional[str] = None,
    category: Optional[str] = None,
    pending_authorization: Optional[bool] = None,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    query = {}
    if reason:
        query["reason"] = reason
    if category:
        query["category"] = category
    if pending_authorization is True:
        query["requires_authorization"] = True
        query["authorized"] = False
    
    discards = await db.discards.find(access.filter(query), {"_id": 0}).to_list(1000)
    return discards

@discard_router.get("/summary")
async def get_discard_summary(
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """Get discard summary statistics"""
    org_filter = access.filter()
    total = await db.discards.count_documents(org_filter)
    pending_auth = await db.discards.count_documents({**org_filter, "requires_authorization": True, "authorized": False})
    pending_destruction = await db.discards.count_documents({**org_filter, "destruction_date": None, "authorized": True})
    destroyed = await db.discards.count_documents({**org_filter, "destruction_date": {"$ne": None}})
    
    # Count by reason
    by_reason = {}
    for reason in DiscardReason:
        count = await db.discards.count_documents({"reason": reason.value})
        by_reason[reason.value] = count
    
    # Count by category
    manual = await db.discards.count_documents({"category": "manual"})
    auto_expired = await db.discards.count_documents({"category": "auto_expired"})
    auto_qc = await db.discards.count_documents({"category": "auto_qc_fail"})
    
    return {
        "total": total,
        "pending_authorization": pending_auth,
        "pending_destruction": pending_destruction,
        "destroyed": destroyed,
        "by_reason": by_reason,
        "by_category": {
            "manual": manual,
            "auto_expired": auto_expired,
            "auto_qc_fail": auto_qc
        }
    }

@discard_router.put("/{discard_id}/authorize")
async def authorize_discard(
    discard_id: str,
    data: DiscardAuthorize,
    current_user: dict = Depends(get_current_user)
):
    """Authorize or reject a pending discard"""
    discard = await db.discards.find_one(
        {"$or": [{"id": discard_id}, {"discard_id": discard_id}]},
        {"_id": 0}
    )
    if not discard:
        raise HTTPException(status_code=404, detail="Discard record not found")
    
    if not discard.get("requires_authorization"):
        raise HTTPException(status_code=400, detail="This discard does not require authorization")
    
    await db.discards.update_one(
        {"$or": [{"id": discard_id}, {"discard_id": discard_id}]},
        {
            "$set": {
                "authorized": data.authorized,
                "authorized_by": current_user["id"],
                "authorization_date": datetime.now(timezone.utc).isoformat(),
                "authorization_notes": data.authorization_notes
            }
        }
    )
    
    # Update component status based on authorization decision
    if data.authorized:
        await db.components.update_one(
            {"id": discard["component_id"]},
            {"$set": {"status": UnitStatus.DISCARDED.value}}
        )
    else:
        # If not authorized, return to quarantine for re-evaluation
        await db.components.update_one(
            {"id": discard["component_id"]},
            {"$set": {"status": UnitStatus.QUARANTINE.value}}
        )
    
    return {"status": "success", "authorized": data.authorized}

@discard_router.put("/{discard_id}/destroy")
async def mark_destroyed(discard_id: str, current_user: dict = Depends(get_current_user)):
    discard = await db.discards.find_one(
        {"$or": [{"id": discard_id}, {"discard_id": discard_id}]},
        {"_id": 0}
    )
    if not discard:
        raise HTTPException(status_code=404, detail="Discard record not found")
    
    if discard.get("requires_authorization") and not discard.get("authorized"):
        raise HTTPException(status_code=400, detail="Discard must be authorized before destruction")
    
    result = await db.discards.update_one(
        {"$or": [{"id": discard_id}, {"discard_id": discard_id}]},
        {
            "$set": {
                "destruction_date": datetime.now(timezone.utc).isoformat().split("T")[0],
                "destroyed_by": current_user["id"]
            }
        }
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Discard record not found")
    return {"status": "success"}

@discard_router.post("/auto-expire")
async def auto_discard_expired(current_user: dict = Depends(get_current_user)):
    """Automatically create discard records for expired components"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Find expired components
    expired = await db.components.find({
        "expiry_date": {"$lt": today},
        "status": {"$nin": [UnitStatus.DISCARDED.value, UnitStatus.ISSUED.value, "pending_discard"]}
    }, {"_id": 0}).to_list(1000)
    
    created_count = 0
    for component in expired:
        # Check if already has a discard record
        existing = await db.discards.find_one({"component_id": component["id"]})
        if existing:
            continue
        
        discard = Discard(
            discard_id=await generate_discard_id(),
            component_id=component["id"],
            reason=DiscardReason.EXPIRED,
            reason_details=f"Auto-discarded: Expired on {component.get('expiry_date')}",
            discard_date=today
        )
        
        doc = discard.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['category'] = 'auto_expired'
        doc['requires_authorization'] = False
        doc['authorized'] = True
        doc['authorized_by'] = 'system'
        doc['authorization_date'] = datetime.now(timezone.utc).isoformat()
        
        await db.discards.insert_one(doc)
        
        await db.components.update_one(
            {"id": component["id"]},
            {"$set": {"status": UnitStatus.DISCARDED.value}}
        )
        
        created_count += 1
    
    return {"status": "success", "discards_created": created_count}
