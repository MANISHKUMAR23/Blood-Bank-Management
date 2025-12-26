from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone

import sys
sys.path.append('..')

from database import db
from models import UnitStatus, ScreeningResult
from services import get_current_user

router = APIRouter(prefix="/quarantine", tags=["Quarantine"])

@router.get("")
async def get_quarantine_items(current_user: dict = Depends(get_current_user)):
    items = await db.quarantine.find({"disposition": None}, {"_id": 0}).to_list(1000)
    return items

@router.put("/{quarantine_id}/resolve")
async def resolve_quarantine(
    quarantine_id: str,
    retest_result: ScreeningResult,
    disposition: str,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] not in ["admin", "qc_manager", "lab_tech"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    update_data = {
        "retest_result": retest_result.value,
        "disposition": disposition,
        "resolved_date": datetime.now(timezone.utc).isoformat().split("T")[0],
        "resolved_by": current_user["id"]
    }
    
    quarantine = await db.quarantine.find_one({"id": quarantine_id}, {"_id": 0})
    if not quarantine:
        raise HTTPException(status_code=404, detail="Quarantine record not found")
    
    await db.quarantine.update_one({"id": quarantine_id}, {"$set": update_data})
    
    new_status = UnitStatus.READY_TO_USE.value if disposition == "release" else UnitStatus.DISCARDED.value
    
    if quarantine["unit_type"] == "unit":
        await db.blood_units.update_one(
            {"id": quarantine["unit_component_id"]},
            {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        await db.components.update_one(
            {"id": quarantine["unit_component_id"]},
            {"$set": {"status": new_status}}
        )
    
    return {"status": "success"}
