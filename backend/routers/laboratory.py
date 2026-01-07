from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone

import sys
sys.path.append('..')

from database import db
from models import LabTest, LabTestCreate, Quarantine, UnitStatus, ScreeningResult
from services import get_current_user
from middleware import ReadAccess, WriteAccess, OrgAccessHelper

router = APIRouter(prefix="/lab-tests", tags=["Laboratory"])

@router.post("")
async def create_lab_test(
    test_data: LabTestCreate, 
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(WriteAccess)
):
    unit = await db.blood_units.find_one(
        access.filter({"$or": [{"id": test_data.unit_id}, {"unit_id": test_data.unit_id}]}),
        {"_id": 0}
    )
    if not unit:
        raise HTTPException(status_code=404, detail="Blood unit not found")
    
    lab_test = LabTest(**test_data.model_dump())
    lab_test.tested_by = current_user["id"]
    lab_test.org_id = unit.get("org_id") or access.get_default_org_id()
    
    results = [test_data.hiv_result, test_data.hbsag_result, test_data.hcv_result, test_data.syphilis_result]
    results = [r for r in results if r]
    
    if any(r == ScreeningResult.REACTIVE for r in results):
        lab_test.overall_status = "reactive"
    elif any(r == ScreeningResult.GRAY for r in results):
        lab_test.overall_status = "gray"
    elif all(r == ScreeningResult.NON_REACTIVE for r in results) and len(results) == 4:
        lab_test.overall_status = "non_reactive"
    else:
        lab_test.overall_status = "pending"
    
    doc = lab_test.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.lab_tests.insert_one(doc)
    
    update_data = {"status": UnitStatus.LAB.value, "updated_at": datetime.now(timezone.utc).isoformat()}
    
    if test_data.confirmed_blood_group and test_data.verified_by_1 and test_data.verified_by_2:
        update_data["confirmed_blood_group"] = test_data.confirmed_blood_group.value
        update_data["blood_group_verified_by"] = [test_data.verified_by_1, test_data.verified_by_2]
    
    if lab_test.overall_status in ["reactive", "gray"]:
        update_data["status"] = UnitStatus.QUARANTINE.value
        
        quarantine = Quarantine(
            unit_component_id=unit["id"],
            unit_type="unit",
            reason=f"Test result: {lab_test.overall_status}",
            quarantine_date=datetime.now(timezone.utc).isoformat().split("T")[0],
            org_id=unit.get("org_id") or access.get_default_org_id()
        )
        q_doc = quarantine.model_dump()
        q_doc['created_at'] = q_doc['created_at'].isoformat()
        await db.quarantine.insert_one(q_doc)
    
    await db.blood_units.update_one(
        {"$or": [{"id": test_data.unit_id}, {"unit_id": test_data.unit_id}]},
        {"$set": update_data}
    )
    
    return {
        "status": "success",
        "test_id": lab_test.id,
        "overall_status": lab_test.overall_status
    }

@router.get("")
async def get_lab_tests(
    unit_id: Optional[str] = None,
    overall_status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    query = {}
    if unit_id:
        query["unit_id"] = unit_id
    if overall_status:
        query["overall_status"] = overall_status
    
    tests = await db.lab_tests.find(access.filter(query), {"_id": 0}).to_list(1000)
    return tests

@router.get("/{test_id}")
async def get_lab_test(
    test_id: str, 
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    test = await db.lab_tests.find_one(access.filter({"id": test_id}), {"_id": 0})
    if not test:
        raise HTTPException(status_code=404, detail="Lab test not found")
    return test
