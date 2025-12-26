from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from datetime import datetime, timezone

import sys
sys.path.append('..')

from database import db
from models import BloodRequest, BloodRequestCreate, Issuance, RequestStatus, UnitStatus
from services import get_current_user, generate_request_id, generate_issue_id

router = APIRouter(prefix="/requests", tags=["Blood Requests"])

@router.post("")
async def create_blood_request(request_data: BloodRequestCreate, current_user: dict = Depends(get_current_user)):
    request = BloodRequest(**request_data.model_dump())
    request.request_id = await generate_request_id()
    
    doc = request.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.blood_requests.insert_one(doc)
    return {"status": "success", "request_id": request.request_id, "id": request.id}

@router.get("")
async def get_blood_requests(
    status: Optional[str] = None,
    urgency: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status
    if urgency:
        query["urgency"] = urgency
    
    requests = await db.blood_requests.find(query, {"_id": 0}).to_list(1000)
    return requests

@router.get("/{request_id}")
async def get_blood_request(request_id: str, current_user: dict = Depends(get_current_user)):
    request = await db.blood_requests.find_one(
        {"$or": [{"id": request_id}, {"request_id": request_id}]},
        {"_id": 0}
    )
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    return request

@router.put("/{request_id}/approve")
async def approve_request(request_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.blood_requests.update_one(
        {"$or": [{"id": request_id}, {"request_id": request_id}]},
        {
            "$set": {
                "status": RequestStatus.APPROVED.value,
                "approved_by": current_user["id"],
                "approval_date": datetime.now(timezone.utc).isoformat().split("T")[0]
            }
        }
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    return {"status": "success"}

@router.put("/{request_id}/reject")
async def reject_request(request_id: str, reason: str, current_user: dict = Depends(get_current_user)):
    result = await db.blood_requests.update_one(
        {"$or": [{"id": request_id}, {"request_id": request_id}]},
        {"$set": {"status": RequestStatus.REJECTED.value, "notes": reason}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    return {"status": "success"}

# Issuance Router
issuance_router = APIRouter(prefix="/issuances", tags=["Issuances"])

@issuance_router.post("")
async def create_issuance(
    request_id: str,
    component_ids: List[str],
    current_user: dict = Depends(get_current_user)
):
    request = await db.blood_requests.find_one(
        {"$or": [{"id": request_id}, {"request_id": request_id}]},
        {"_id": 0}
    )
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request["status"] != "approved":
        raise HTTPException(status_code=400, detail="Request must be approved first")
    
    issuance = Issuance(
        issue_id=await generate_issue_id(),
        request_id=request["id"],
        component_ids=component_ids,
        pick_timestamp=datetime.now(timezone.utc).isoformat(),
        issued_by=current_user["id"]
    )
    
    doc = issuance.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.issuances.insert_one(doc)
    
    for comp_id in component_ids:
        await db.components.update_one(
            {"$or": [{"id": comp_id}, {"component_id": comp_id}]},
            {"$set": {"status": UnitStatus.RESERVED.value}}
        )
    
    return {"status": "success", "issue_id": issuance.issue_id, "id": issuance.id}

@issuance_router.get("")
async def get_issuances(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status
    
    issuances = await db.issuances.find(query, {"_id": 0}).to_list(1000)
    return issuances

@issuance_router.put("/{issue_id}/pack")
async def pack_issuance(issue_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.issuances.update_one(
        {"$or": [{"id": issue_id}, {"issue_id": issue_id}]},
        {"$set": {"pack_timestamp": datetime.now(timezone.utc).isoformat(), "status": "packing"}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Issuance not found")
    return {"status": "success"}

@issuance_router.put("/{issue_id}/ship")
async def ship_issuance(issue_id: str, current_user: dict = Depends(get_current_user)):
    issuance = await db.issuances.find_one(
        {"$or": [{"id": issue_id}, {"issue_id": issue_id}]},
        {"_id": 0}
    )
    if not issuance:
        raise HTTPException(status_code=404, detail="Issuance not found")
    
    await db.issuances.update_one(
        {"$or": [{"id": issue_id}, {"issue_id": issue_id}]},
        {"$set": {"ship_timestamp": datetime.now(timezone.utc).isoformat(), "status": "shipped"}}
    )
    
    for comp_id in issuance.get("component_ids", []):
        await db.components.update_one(
            {"$or": [{"id": comp_id}, {"component_id": comp_id}]},
            {"$set": {"status": UnitStatus.ISSUED.value}}
        )
    
    await db.blood_requests.update_one(
        {"id": issuance["request_id"]},
        {"$set": {"status": RequestStatus.FULFILLED.value}}
    )
    
    return {"status": "success"}

@issuance_router.put("/{issue_id}/deliver")
async def deliver_issuance(issue_id: str, received_by: str, current_user: dict = Depends(get_current_user)):
    result = await db.issuances.update_one(
        {"$or": [{"id": issue_id}, {"issue_id": issue_id}]},
        {"$set": {"received_by": received_by, "status": "delivered"}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Issuance not found")
    return {"status": "success"}
