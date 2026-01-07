from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel, Field
import uuid

import sys
sys.path.append('..')

from database import db
from services import get_current_user
from middleware import ReadAccess, WriteAccess, OrgAccessHelper

router = APIRouter(prefix="/logistics", tags=["Logistics"])

# Models
class ShipmentCreate(BaseModel):
    issuance_id: str
    destination: str
    destination_address: str
    contact_person: str
    contact_phone: str
    transport_method: str = "vehicle"
    special_instructions: Optional[str] = None

class ShipmentUpdate(BaseModel):
    status: Optional[str] = None
    current_location: Optional[str] = None
    temperature_reading: Optional[float] = None
    notes: Optional[str] = None

async def generate_shipment_id():
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    count = await db.shipments.count_documents({"shipment_id": {"$regex": f"^SHP-{today}"}})
    return f"SHP-{today}-{str(count + 1).zfill(4)}"

@router.post("/shipments")
async def create_shipment(
    data: ShipmentCreate, 
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(WriteAccess)
):
    """Create a new shipment for an issuance"""
    # Verify issuance exists
    issuance = await db.issuances.find_one(
        access.filter({"$or": [{"id": data.issuance_id}, {"issue_id": data.issuance_id}]}),
        {"_id": 0}
    )
    if not issuance:
        raise HTTPException(status_code=404, detail="Issuance not found")
    
    shipment = {
        "id": str(uuid.uuid4()),
        "shipment_id": await generate_shipment_id(),
        "issuance_id": issuance["id"],
        "destination": data.destination,
        "destination_address": data.destination_address,
        "contact_person": data.contact_person,
        "contact_phone": data.contact_phone,
        "transport_method": data.transport_method,
        "special_instructions": data.special_instructions,
        "status": "preparing",
        "tracking_history": [
            {
                "status": "preparing",
                "location": "Blood Bank",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "notes": "Shipment created"
            }
        ],
        "temperature_log": [],
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "org_id": issuance.get("org_id") or access.get_default_org_id()
    }
    
    await db.shipments.insert_one(shipment)
    
    return {"status": "success", "shipment_id": shipment["shipment_id"], "id": shipment["id"]}

@router.get("/shipments")
async def get_shipments(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """Get all shipments"""
    query = {}
    if status:
        query["status"] = status
    
    shipments = await db.shipments.find(access.filter(query), {"_id": 0}).sort("created_at", -1).to_list(1000)
    return shipments

@router.get("/shipments/{shipment_id}")
async def get_shipment(
    shipment_id: str, 
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """Get shipment details with tracking history"""
    shipment = await db.shipments.find_one(
        access.filter({"$or": [{"id": shipment_id}, {"shipment_id": shipment_id}]}),
        {"_id": 0}
    )
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    # Get associated issuance details
    if shipment.get("issuance_id"):
        issuance = await db.issuances.find_one({"id": shipment["issuance_id"]}, {"_id": 0})
        shipment["issuance"] = issuance
    
    return shipment

@router.put("/shipments/{shipment_id}/dispatch")
async def dispatch_shipment(shipment_id: str, current_user: dict = Depends(get_current_user)):
    """Mark shipment as dispatched/in transit"""
    shipment = await db.shipments.find_one(
        {"$or": [{"id": shipment_id}, {"shipment_id": shipment_id}]},
        {"_id": 0}
    )
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    tracking_entry = {
        "status": "in_transit",
        "location": "En route to destination",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "notes": f"Dispatched by {current_user.get('full_name', current_user['email'])}"
    }
    
    await db.shipments.update_one(
        {"$or": [{"id": shipment_id}, {"shipment_id": shipment_id}]},
        {
            "$set": {
                "status": "in_transit",
                "dispatch_time": datetime.now(timezone.utc).isoformat()
            },
            "$push": {"tracking_history": tracking_entry}
        }
    )
    
    return {"status": "success"}

@router.put("/shipments/{shipment_id}/update-location")
async def update_shipment_location(
    shipment_id: str,
    location: str,
    temperature: Optional[float] = None,
    notes: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update shipment location and optionally log temperature"""
    shipment = await db.shipments.find_one(
        {"$or": [{"id": shipment_id}, {"shipment_id": shipment_id}]},
        {"_id": 0}
    )
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    tracking_entry = {
        "status": "in_transit",
        "location": location,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "notes": notes
    }
    
    update_ops = {
        "$set": {"current_location": location},
        "$push": {"tracking_history": tracking_entry}
    }
    
    if temperature is not None:
        temp_entry = {
            "temperature": temperature,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "location": location
        }
        update_ops["$push"]["temperature_log"] = temp_entry
    
    await db.shipments.update_one(
        {"$or": [{"id": shipment_id}, {"shipment_id": shipment_id}]},
        update_ops
    )
    
    return {"status": "success"}

@router.put("/shipments/{shipment_id}/deliver")
async def deliver_shipment(
    shipment_id: str,
    received_by: str,
    notes: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Mark shipment as delivered"""
    shipment = await db.shipments.find_one(
        {"$or": [{"id": shipment_id}, {"shipment_id": shipment_id}]},
        {"_id": 0}
    )
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    tracking_entry = {
        "status": "delivered",
        "location": shipment.get("destination", "Destination"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "notes": f"Received by {received_by}. {notes or ''}"
    }
    
    await db.shipments.update_one(
        {"$or": [{"id": shipment_id}, {"shipment_id": shipment_id}]},
        {
            "$set": {
                "status": "delivered",
                "delivery_time": datetime.now(timezone.utc).isoformat(),
                "received_by": received_by
            },
            "$push": {"tracking_history": tracking_entry}
        }
    )
    
    # Update associated issuance
    if shipment.get("issuance_id"):
        await db.issuances.update_one(
            {"id": shipment["issuance_id"]},
            {"$set": {"status": "delivered", "received_by": received_by}}
        )
    
    return {"status": "success"}

@router.get("/dashboard")
async def get_logistics_dashboard(
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """Get logistics dashboard stats"""
    org_filter = access.filter()
    total = await db.shipments.count_documents(org_filter)
    preparing = await db.shipments.count_documents({**org_filter, "status": "preparing"})
    in_transit = await db.shipments.count_documents({**org_filter, "status": "in_transit"})
    delivered = await db.shipments.count_documents({**org_filter, "status": "delivered"})
    
    # Get recent shipments
    recent = await db.shipments.find(org_filter, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    
    # Calculate average delivery time
    delivered_shipments = await db.shipments.find(
        {**org_filter, "status": "delivered", "dispatch_time": {"$exists": True}, "delivery_time": {"$exists": True}},
        {"_id": 0, "dispatch_time": 1, "delivery_time": 1}
    ).to_list(100)
    
    avg_delivery_hours = 0
    if delivered_shipments:
        total_hours = 0
        for s in delivered_shipments:
            try:
                dispatch = datetime.fromisoformat(s["dispatch_time"].replace("Z", "+00:00"))
                delivery = datetime.fromisoformat(s["delivery_time"].replace("Z", "+00:00"))
                total_hours += (delivery - dispatch).total_seconds() / 3600
            except Exception:
                pass
        avg_delivery_hours = total_hours / len(delivered_shipments) if delivered_shipments else 0
    
    return {
        "total_shipments": total,
        "preparing": preparing,
        "in_transit": in_transit,
        "delivered": delivered,
        "avg_delivery_hours": round(avg_delivery_hours, 1),
        "recent_shipments": recent
    }
