from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta

import sys
sys.path.append('..')

from database import db
from services import get_current_user, generate_barcode_base64, generate_qr_base64

router = APIRouter(tags=["Dashboard & Utilities"])

@router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).isoformat().split("T")[0]
    
    todays_donations = await db.donations.count_documents({
        "collection_start_time": {"$regex": f"^{today}"}
    })
    
    total_donors = await db.donors.count_documents({})
    
    available_units = await db.blood_units.count_documents({"status": "ready_to_use"})
    
    pending_requests = await db.blood_requests.count_documents({"status": "pending"})
    
    expiring_soon = datetime.now(timezone.utc) + timedelta(days=7)
    expiring_count = await db.blood_units.count_documents({
        "status": "ready_to_use",
        "expiry_date": {"$lte": expiring_soon.isoformat().split("T")[0]}
    })
    
    quarantine_count = await db.blood_units.count_documents({"status": "quarantine"})
    
    inventory_pipeline = [
        {"$match": {"status": "ready_to_use"}},
        {"$group": {"_id": {"$ifNull": ["$confirmed_blood_group", "$blood_group"]}, "count": {"$sum": 1}}}
    ]
    inventory_by_group = await db.blood_units.aggregate(inventory_pipeline).to_list(10)
    
    components_pipeline = [
        {"$match": {"status": "ready_to_use"}},
        {"$group": {"_id": "$component_type", "count": {"$sum": 1}}}
    ]
    components_by_type = await db.components.aggregate(components_pipeline).to_list(10)
    
    return {
        "todays_donations": todays_donations,
        "total_donors": total_donors,
        "available_units": available_units,
        "pending_requests": pending_requests,
        "expiring_within_7_days": expiring_count,
        "in_quarantine": quarantine_count,
        "inventory_by_blood_group": {item["_id"]: item["count"] for item in inventory_by_group if item["_id"]},
        "components_by_type": {item["_id"]: item["count"] for item in components_by_type if item["_id"]}
    }

@router.get("/")
async def root():
    return {"status": "healthy", "service": "Blood Bank Management System API"}

@router.get("/barcode/{data}")
async def get_barcode(data: str):
    barcode_b64 = generate_barcode_base64(data)
    return {"barcode": barcode_b64}

@router.get("/qrcode/{data}")
async def get_qrcode(data: str):
    qr_b64 = generate_qr_base64(data)
    return {"qrcode": qr_b64}
