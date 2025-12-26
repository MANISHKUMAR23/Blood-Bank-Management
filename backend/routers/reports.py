from fastapi import APIRouter, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta

import sys
sys.path.append('..')

from database import db
from services import get_current_user

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("/daily-collections")
async def get_daily_collections_report(
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    if not date:
        date = datetime.now(timezone.utc).isoformat().split("T")[0]
    
    donations = await db.donations.find({
        "collection_start_time": {"$regex": f"^{date}"}
    }, {"_id": 0}).to_list(1000)
    
    total_volume = sum(d.get("volume_collected", 0) or 0 for d in donations)
    
    by_type = {}
    for d in donations:
        dtype = d.get("donation_type", "unknown")
        if dtype not in by_type:
            by_type[dtype] = 0
        by_type[dtype] += 1
    
    adverse_reactions = [d for d in donations if d.get("adverse_reaction")]
    
    return {
        "date": date,
        "total_donations": len(donations),
        "total_volume_ml": total_volume,
        "by_donation_type": by_type,
        "adverse_reactions_count": len(adverse_reactions),
        "adverse_reactions": adverse_reactions
    }

@router.get("/inventory-status")
async def get_inventory_status_report(current_user: dict = Depends(get_current_user)):
    status_counts = {}
    for status in ["collected", "lab", "processing", "quarantine", "ready_to_use", "reserved", "issued", "discarded"]:
        count = await db.blood_units.count_documents({"status": status})
        status_counts[status] = count
    
    component_status = {}
    for status in ["processing", "ready_to_use", "reserved", "issued", "discarded"]:
        count = await db.components.count_documents({"status": status})
        component_status[status] = count
    
    return {
        "report_date": datetime.now(timezone.utc).isoformat(),
        "blood_units_by_status": status_counts,
        "components_by_status": component_status,
        "total_units": sum(status_counts.values()),
        "total_components": sum(component_status.values())
    }

@router.get("/expiry-analysis")
async def get_expiry_analysis_report(current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    
    expired = await db.blood_units.count_documents({
        "status": "ready_to_use",
        "expiry_date": {"$lt": now.isoformat().split("T")[0]}
    })
    
    expiring_7_days = await db.blood_units.count_documents({
        "status": "ready_to_use",
        "expiry_date": {
            "$gte": now.isoformat().split("T")[0],
            "$lte": (now + timedelta(days=7)).isoformat().split("T")[0]
        }
    })
    
    expiring_30_days = await db.blood_units.count_documents({
        "status": "ready_to_use",
        "expiry_date": {
            "$gte": now.isoformat().split("T")[0],
            "$lte": (now + timedelta(days=30)).isoformat().split("T")[0]
        }
    })
    
    return {
        "report_date": now.isoformat(),
        "expired_units": expired,
        "expiring_within_7_days": expiring_7_days,
        "expiring_within_30_days": expiring_30_days
    }

@router.get("/discard-analysis")
async def get_discard_analysis_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if start_date:
        query["discard_date"] = {"$gte": start_date}
    if end_date:
        if "discard_date" in query:
            query["discard_date"]["$lte"] = end_date
        else:
            query["discard_date"] = {"$lte": end_date}
    
    discards = await db.discards.find(query, {"_id": 0}).to_list(1000)
    
    by_reason = {}
    for d in discards:
        reason = d.get("reason", "unknown")
        if reason not in by_reason:
            by_reason[reason] = 0
        by_reason[reason] += 1
    
    return {
        "total_discards": len(discards),
        "by_reason": by_reason,
        "period": {"start": start_date, "end": end_date}
    }

@router.get("/testing-outcomes")
async def get_testing_outcomes_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if start_date:
        query["test_date"] = {"$gte": start_date}
    if end_date:
        if "test_date" in query:
            query["test_date"]["$lte"] = end_date
        else:
            query["test_date"] = {"$lte": end_date}
    
    tests = await db.lab_tests.find(query, {"_id": 0}).to_list(1000)
    
    by_status = {}
    for t in tests:
        status = t.get("overall_status", "pending")
        if status not in by_status:
            by_status[status] = 0
        by_status[status] += 1
    
    reactive_details = {
        "hiv": len([t for t in tests if t.get("hiv_result") == "reactive"]),
        "hbsag": len([t for t in tests if t.get("hbsag_result") == "reactive"]),
        "hcv": len([t for t in tests if t.get("hcv_result") == "reactive"]),
        "syphilis": len([t for t in tests if t.get("syphilis_result") == "reactive"])
    }
    
    return {
        "total_tests": len(tests),
        "by_overall_status": by_status,
        "reactive_breakdown": reactive_details,
        "period": {"start": start_date, "end": end_date}
    }
