from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel

import sys
sys.path.append('..')

from database import db
from models import Return, Discard, UnitStatus, DiscardReason
from services import get_current_user, generate_return_id, generate_discard_id

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
    current_user: dict = Depends(get_current_user)
):
    component = await db.components.find_one(
        {"$or": [{"id": data.component_id}, {"component_id": data.component_id}]},
        {"_id": 0}
    )
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    
    return_record = Return(
        return_id=await generate_return_id(),
        component_id=component["id"],
        return_date=data.return_date,
        source=data.source,
        reason=data.reason
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
async def get_returns(current_user: dict = Depends(get_current_user)):
    returns = await db.returns.find({}, {"_id": 0}).to_list(1000)
    return returns

@return_router.put("/{return_id}/process")
async def process_return(
    return_id: str,
    qc_pass: bool,
    decision: str,
    current_user: dict = Depends(get_current_user)
):
    return_record = await db.returns.find_one(
        {"$or": [{"id": return_id}, {"return_id": return_id}]},
        {"_id": 0}
    )
    if not return_record:
        raise HTTPException(status_code=404, detail="Return record not found")
    
    await db.returns.update_one(
        {"$or": [{"id": return_id}, {"return_id": return_id}]},
        {
            "$set": {
                "qc_pass": qc_pass,
                "decision": decision,
                "processed_by": current_user["id"]
            }
        }
    )
    
    new_status = UnitStatus.READY_TO_USE.value if decision == "accept" else UnitStatus.DISCARDED.value
    await db.components.update_one(
        {"id": return_record["component_id"]},
        {"$set": {"status": new_status}}
    )
    
    if decision == "reject":
        discard = Discard(
            discard_id=await generate_discard_id(),
            component_id=return_record["component_id"],
            reason=DiscardReason.REJECTED_RETURN,
            reason_details=f"Failed return QC: {return_record.get('reason')}",
            discard_date=datetime.now(timezone.utc).isoformat().split("T")[0]
        )
        discard_doc = discard.model_dump()
        discard_doc['created_at'] = discard_doc['created_at'].isoformat()
        await db.discards.insert_one(discard_doc)
    
    return {"status": "success"}

# Discards
@discard_router.post("")
async def create_discard(
    component_id: str,
    reason: DiscardReason,
    discard_date: str,
    reason_details: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    component = await db.components.find_one(
        {"$or": [{"id": component_id}, {"component_id": component_id}]},
        {"_id": 0}
    )
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    
    discard = Discard(
        discard_id=await generate_discard_id(),
        component_id=component["id"],
        reason=reason,
        reason_details=reason_details,
        discard_date=discard_date,
        processed_by=current_user["id"]
    )
    
    doc = discard.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.discards.insert_one(doc)
    
    await db.components.update_one(
        {"id": component["id"]},
        {"$set": {"status": UnitStatus.DISCARDED.value}}
    )
    
    return {"status": "success", "discard_id": discard.discard_id}

@discard_router.get("")
async def get_discards(
    reason: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if reason:
        query["reason"] = reason
    
    discards = await db.discards.find(query, {"_id": 0}).to_list(1000)
    return discards

@discard_router.put("/{discard_id}/destroy")
async def mark_destroyed(discard_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.discards.update_one(
        {"$or": [{"id": discard_id}, {"discard_id": discard_id}]},
        {
            "$set": {
                "destruction_date": datetime.now(timezone.utc).isoformat().split("T")[0],
                "approved_by": current_user["id"]
            }
        }
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Discard record not found")
    return {"status": "success"}
