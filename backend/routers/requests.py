from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone

import sys
sys.path.append('..')

from database import db
from models import BloodRequest, BloodRequestCreate, Issuance, RequestStatus, UnitStatus
from services import get_current_user, generate_request_id, generate_issue_id

router = APIRouter(prefix="/requests", tags=["Blood Requests"])

def calculate_priority_score(urgency: str, required_by_date: str = None, required_by_time: str = None) -> int:
    """Calculate priority score based on urgency and timing"""
    base_scores = {"emergency": 100, "urgent": 70, "normal": 30}
    score = base_scores.get(urgency, 30)
    
    if required_by_date:
        try:
            required = datetime.strptime(required_by_date, "%Y-%m-%d")
            now = datetime.now()
            days_until = (required - now).days
            
            if days_until <= 0:
                score += 50  # Overdue or same day
            elif days_until == 1:
                score += 30  # Tomorrow
            elif days_until <= 3:
                score += 15  # Within 3 days
        except Exception:
            pass
    
    return min(score, 150)  # Cap at 150

@router.post("")
async def create_blood_request(request_data: BloodRequestCreate, current_user: dict = Depends(get_current_user)):
    request = BloodRequest(**request_data.model_dump(exclude={'additional_items'}))
    request.request_id = await generate_request_id()
    
    # Calculate priority score
    request.priority_score = calculate_priority_score(
        request_data.urgency,
        request_data.required_by_date,
        request_data.required_by_time
    )
    
    doc = request.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    # Handle additional items for multi-component requests
    if request_data.additional_items:
        doc['additional_items'] = [item.model_dump() for item in request_data.additional_items]
    
    await db.blood_requests.insert_one(doc)
    return {"status": "success", "request_id": request.request_id, "id": request.id, "priority_score": request.priority_score}

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
    request_id: str = Query(..., description="Request ID"),
    component_ids: List[str] = Query(default=[], description="List of component IDs"),
    current_user: dict = Depends(get_current_user)
):
    if not component_ids:
        raise HTTPException(status_code=400, detail="At least one component ID is required")
    
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
