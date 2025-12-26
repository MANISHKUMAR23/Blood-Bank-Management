from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone

import sys
sys.path.append('..')

from database import db
from models import QCValidation, QCValidationCreate, UnitStatus
from services import get_current_user

router = APIRouter(prefix="/qc-validation", tags=["QC Validation"])

@router.post("")
async def create_qc_validation(validation_data: QCValidationCreate, current_user: dict = Depends(get_current_user)):
    validation = QCValidation(**validation_data.model_dump())
    
    if validation.data_complete and validation.screening_complete and validation.custody_complete:
        validation.status = "approved"
        validation.approved_by = current_user["id"]
        validation.approval_timestamp = datetime.now(timezone.utc)
    else:
        validation.status = "hold"
        missing = []
        if not validation.data_complete:
            missing.append("data incomplete")
        if not validation.screening_complete:
            missing.append("screening incomplete")
        if not validation.custody_complete:
            missing.append("custody incomplete")
        validation.hold_reason = ", ".join(missing)
    
    doc = validation.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    if doc.get('approval_timestamp'):
        doc['approval_timestamp'] = doc['approval_timestamp'].isoformat()
    
    await db.qc_validation.insert_one(doc)
    
    if validation.status == "approved":
        new_status = UnitStatus.READY_TO_USE.value
        if validation.unit_type == "unit":
            await db.blood_units.update_one(
                {"id": validation.unit_component_id},
                {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        else:
            await db.components.update_one(
                {"id": validation.unit_component_id},
                {"$set": {"status": new_status}}
            )
    
    return {"status": "success", "validation_id": validation.id, "qc_status": validation.status}

@router.get("")
async def get_qc_validations(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status
    
    validations = await db.qc_validation.find(query, {"_id": 0}).to_list(1000)
    return validations

@router.put("/{validation_id}/approve")
async def approve_qc_validation(validation_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "qc_manager"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    validation = await db.qc_validation.find_one({"id": validation_id}, {"_id": 0})
    if not validation:
        raise HTTPException(status_code=404, detail="Validation record not found")
    
    await db.qc_validation.update_one(
        {"id": validation_id},
        {
            "$set": {
                "status": "approved",
                "approved_by": current_user["id"],
                "approval_timestamp": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if validation["unit_type"] == "unit":
        await db.blood_units.update_one(
            {"id": validation["unit_component_id"]},
            {"$set": {"status": UnitStatus.READY_TO_USE.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        await db.components.update_one(
            {"id": validation["unit_component_id"]},
            {"$set": {"status": UnitStatus.READY_TO_USE.value}}
        )
    
    return {"status": "success"}
