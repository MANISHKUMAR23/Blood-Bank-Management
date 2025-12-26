from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta

import sys
sys.path.append('..')

from database import db
from models import BloodGroup, ComponentType
from services import get_current_user

router = APIRouter(prefix="/inventory", tags=["Inventory"])

@router.get("/summary")
async def get_inventory_summary(current_user: dict = Depends(get_current_user)):
    units_pipeline = [
        {"$match": {"status": "ready_to_use"}},
        {"$group": {"_id": "$confirmed_blood_group", "count": {"$sum": 1}}}
    ]
    units_by_group = await db.blood_units.aggregate(units_pipeline).to_list(20)
    
    components_pipeline = [
        {"$match": {"status": "ready_to_use"}},
        {"$group": {"_id": {"type": "$component_type", "blood_group": "$blood_group"}, "count": {"$sum": 1}}}
    ]
    components_by_type = await db.components.aggregate(components_pipeline).to_list(100)
    
    total_units = await db.blood_units.count_documents({"status": "ready_to_use"})
    total_components = await db.components.count_documents({"status": "ready_to_use"})
    
    expiring_soon = datetime.now(timezone.utc) + timedelta(days=7)
    expiring_count = await db.blood_units.count_documents({
        "status": "ready_to_use",
        "expiry_date": {"$lte": expiring_soon.isoformat().split("T")[0]}
    })
    
    return {
        "total_units_available": total_units,
        "total_components_available": total_components,
        "units_by_blood_group": {item["_id"]: item["count"] for item in units_by_group if item["_id"]},
        "components_by_type": components_by_type,
        "expiring_within_7_days": expiring_count
    }

@router.get("/by-blood-group")
async def get_inventory_by_blood_group(current_user: dict = Depends(get_current_user)):
    result = {}
    for bg in BloodGroup:
        units = await db.blood_units.count_documents({
            "status": "ready_to_use",
            "$or": [{"blood_group": bg.value}, {"confirmed_blood_group": bg.value}]
        })
        
        components_pipeline = [
            {
                "$match": {
                    "status": "ready_to_use",
                    "blood_group": bg.value
                }
            },
            {"$group": {"_id": "$component_type", "count": {"$sum": 1}}}
        ]
        components = await db.components.aggregate(components_pipeline).to_list(10)
        
        result[bg.value] = {
            "whole_blood_units": units,
            "components": {c["_id"]: c["count"] for c in components}
        }
    
    return result

@router.get("/expiring")
async def get_expiring_inventory(days: int = 7, current_user: dict = Depends(get_current_user)):
    expiry_date = datetime.now(timezone.utc) + timedelta(days=days)
    
    units = await db.blood_units.find({
        "status": "ready_to_use",
        "expiry_date": {"$lte": expiry_date.isoformat().split("T")[0]}
    }, {"_id": 0}).to_list(1000)
    
    components = await db.components.find({
        "status": "ready_to_use",
        "expiry_date": {"$lte": expiry_date.isoformat().split("T")[0]}
    }, {"_id": 0}).to_list(1000)
    
    return {"expiring_units": units, "expiring_components": components}

@router.get("/fefo")
async def get_fefo_list(
    blood_group: Optional[str] = None,
    component_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"status": "ready_to_use"}
    if blood_group:
        query["blood_group"] = blood_group
    if component_type:
        query["component_type"] = component_type
    
    components = await db.components.find(query, {"_id": 0}).sort("expiry_date", 1).to_list(100)
    
    return components
