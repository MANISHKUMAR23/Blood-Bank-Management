from fastapi import APIRouter, Depends, Query
from datetime import datetime, timezone, timedelta
from typing import Optional

import sys
sys.path.append('..')

from database import db
from services import get_current_user, generate_barcode_base64, generate_qr_base64
from middleware import ReadAccess, OrgAccessHelper

router = APIRouter(tags=["Dashboard & Utilities"])

@router.get("/dashboard/stats")
async def get_dashboard_stats(
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """Get dashboard stats filtered by accessible organizations."""
    org_filter = access.filter()
    today = datetime.now(timezone.utc).isoformat().split("T")[0]
    
    todays_donations = await db.donations.count_documents({
        "collection_start_time": {"$regex": f"^{today}"},
        **org_filter
    })
    
    total_donors = await db.donors.count_documents(org_filter)
    
    available_units = await db.blood_units.count_documents({"status": "ready_to_use", **org_filter})
    
    pending_requests = await db.blood_requests.count_documents({"status": "pending", **org_filter})
    
    expiring_soon = datetime.now(timezone.utc) + timedelta(days=7)
    expiring_count = await db.blood_units.count_documents({
        "status": "ready_to_use",
        "expiry_date": {"$lte": expiring_soon.isoformat().split("T")[0]},
        **org_filter
    })
    
    quarantine_count = await db.blood_units.count_documents({"status": "quarantine", **org_filter})
    
    inventory_pipeline = [
        {"$match": {"status": "ready_to_use", **org_filter}},
        {"$group": {"_id": {"$ifNull": ["$confirmed_blood_group", "$blood_group"]}, "count": {"$sum": 1}}}
    ]
    inventory_by_group = await db.blood_units.aggregate(inventory_pipeline).to_list(10)
    
    components_pipeline = [
        {"$match": {"status": "ready_to_use", **org_filter}},
        {"$group": {"_id": "$component_type", "count": {"$sum": 1}}}
    ]
    components_by_type = await db.components.aggregate(components_pipeline).to_list(10)
    
    # Get inter-org request stats
    inter_org_pending = 0
    if access.get_default_org_id():
        inter_org_pending = await db.inter_org_requests.count_documents({
            "fulfilling_org_id": access.get_default_org_id(),
            "status": "pending"
        })
    
    return {
        "todays_donations": todays_donations,
        "total_donors": total_donors,
        "available_units": available_units,
        "pending_requests": pending_requests,
        "expiring_within_7_days": expiring_count,
        "in_quarantine": quarantine_count,
        "inventory_by_blood_group": {item["_id"]: item["count"] for item in inventory_by_group if item["_id"]},
        "components_by_type": {item["_id"]: item["count"] for item in components_by_type if item["_id"]},
        "inter_org_requests_pending": inter_org_pending,
        "user_org_id": access.get_default_org_id(),
        "user_type": access.user_type
    }


@router.get("/dashboard/network")
async def get_network_dashboard(
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """
    Get network-wide dashboard for Super Admin / Tenant Admin.
    Shows consolidated data across all accessible branches.
    """
    if not access.can_view_network():
        return {"error": "Network view not available for staff users"}
    
    org_filter = access.filter()
    
    # Get all accessible organizations with their stats
    org_stats = []
    for org_id in access.org_ids:
        org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
        if not org:
            continue
        
        # Get counts for this org
        donor_count = await db.donors.count_documents({"org_id": org_id})
        inventory_count = await db.components.count_documents({
            "org_id": org_id,
            "status": "ready_to_use"
        })
        expiring_soon = datetime.now(timezone.utc) + timedelta(days=7)
        expiring_count = await db.components.count_documents({
            "org_id": org_id,
            "status": "ready_to_use",
            "expiry_date": {"$lte": expiring_soon.isoformat().split("T")[0]}
        })
        
        org_stats.append({
            "id": org_id,
            "org_name": org.get("org_name"),
            "org_type": org.get("org_type"),
            "city": org.get("city"),
            "is_parent": org.get("is_parent", False),
            "parent_org_id": org.get("parent_org_id"),
            "donor_count": donor_count,
            "inventory_count": inventory_count,
            "expiring_count": expiring_count,
            "is_own_org": org_id == access.get_default_org_id()
        })
    
    # Get inter-branch transfer stats
    transfer_pipeline = [
        {"$match": {
            "request_type": "internal",
            "$or": [
                {"requesting_org_id": {"$in": access.org_ids}},
                {"fulfilling_org_id": {"$in": access.org_ids}}
            ]
        }},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1}
        }}
    ]
    transfer_stats = await db.inter_org_requests.aggregate(transfer_pipeline).to_list(10)
    
    # Aggregate inventory by blood group across network
    network_inventory = [
        {"$match": {"status": "ready_to_use", **org_filter}},
        {"$group": {
            "_id": "$blood_group",
            "total": {"$sum": 1}
        }}
    ]
    inventory_by_group = await db.components.aggregate(network_inventory).to_list(10)
    
    # Recent inter-org activity
    recent_transfers = await db.inter_org_requests.find(
        {"$or": [
            {"requesting_org_id": {"$in": access.org_ids}},
            {"fulfilling_org_id": {"$in": access.org_ids}}
        ]},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Enrich recent transfers with org names
    for transfer in recent_transfers:
        req_org = await db.organizations.find_one({"id": transfer.get("requesting_org_id")}, {"org_name": 1})
        ful_org = await db.organizations.find_one({"id": transfer.get("fulfilling_org_id")}, {"org_name": 1})
        transfer["requesting_org_name"] = req_org.get("org_name") if req_org else "Unknown"
        transfer["fulfilling_org_name"] = ful_org.get("org_name") if ful_org else transfer.get("external_org_name", "Unknown")
    
    return {
        "organizations": org_stats,
        "total_organizations": len(org_stats),
        "transfer_stats": {item["_id"]: item["count"] for item in transfer_stats},
        "network_inventory_by_group": {item["_id"]: item["total"] for item in inventory_by_group if item["_id"]},
        "recent_transfers": recent_transfers,
        "user_type": access.user_type
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
