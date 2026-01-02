"""
Enhanced Logistics Module - Transport Methods, Tracking, and Consignment Management
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel, Field
import uuid

from database import db
from services import get_current_user
from models.configuration import TransportMethod, TrackingStatus, TrackingUpdate

router = APIRouter(prefix="/logistics", tags=["Logistics"])

# ==================== MODELS ====================

class ShipmentCreate(BaseModel):
    issuance_id: str
    destination: str
    destination_address: str
    contact_person: str
    contact_phone: str
    transport_method: TransportMethod = TransportMethod.SELF_VEHICLE
    # Self Vehicle fields
    vehicle_id: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    driver_license: Optional[str] = None
    # Third Party fields
    courier_company: Optional[str] = None
    courier_contact: Optional[str] = None
    courier_tracking_number: Optional[str] = None
    # Common
    special_instructions: Optional[str] = None
    estimated_arrival: Optional[str] = None

class TrackingUpdateCreate(BaseModel):
    location: str
    status: TrackingStatus
    notes: Optional[str] = None

class ShipmentUpdate(BaseModel):
    status: Optional[str] = None
    current_location: Optional[str] = None
    temperature_reading: Optional[float] = None
    notes: Optional[str] = None

# ==================== UTILITY FUNCTIONS ====================

async def generate_shipment_id():
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    count = await db.shipments.count_documents({"shipment_id": {"$regex": f"^SHP-{today}"}})
    return f"SHP-{today}-{str(count + 1).zfill(4)}"

async def generate_tracking_number():
    """Generate unique tracking number for public tracking"""
    import random
    import string
    prefix = "TRK"
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
    return f"{prefix}{suffix}"

# ==================== SHIPMENT APIs ====================

@router.post("/shipments")
async def create_shipment(data: ShipmentCreate, current_user: dict = Depends(get_current_user)):
    """Create a new shipment for an issuance"""
    # Verify issuance exists
    issuance = await db.issuances.find_one(
        {"$or": [{"id": data.issuance_id}, {"issue_id": data.issuance_id}]},
        {"_id": 0}
    )
    if not issuance:
        raise HTTPException(status_code=404, detail="Issuance not found")
    
    # Validate transport method specific fields
    if data.transport_method == TransportMethod.SELF_VEHICLE:
        if data.vehicle_id:
            vehicle = await db.vehicles.find_one(
                {"$or": [{"id": data.vehicle_id}, {"vehicle_id": data.vehicle_id}]},
                {"_id": 0}
            )
            if not vehicle:
                raise HTTPException(status_code=404, detail="Vehicle not found")
            if not vehicle.get("is_active"):
                raise HTTPException(status_code=400, detail="Vehicle is not active")
    
    tracking_number = await generate_tracking_number()
    
    shipment = {
        "id": str(uuid.uuid4()),
        "shipment_id": await generate_shipment_id(),
        "tracking_number": tracking_number,
        "issuance_id": issuance["id"],
        "destination": data.destination,
        "destination_address": data.destination_address,
        "contact_person": data.contact_person,
        "contact_phone": data.contact_phone,
        "transport_method": data.transport_method.value,
        # Vehicle info
        "vehicle_id": data.vehicle_id,
        "driver_name": data.driver_name,
        "driver_phone": data.driver_phone,
        "driver_license": data.driver_license,
        # Courier info
        "courier_company": data.courier_company,
        "courier_contact": data.courier_contact,
        "courier_tracking_number": data.courier_tracking_number,
        # Common
        "special_instructions": data.special_instructions,
        "estimated_arrival": data.estimated_arrival,
        "status": "preparing",
        "current_location": "Blood Bank",
        "tracking_updates": [
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "location": "Blood Bank",
                "status": "preparing",
                "updated_by": current_user["id"],
                "notes": "Shipment created"
            }
        ],
        "temperature_log": [],
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Add vehicle/courier details
    if data.transport_method == TransportMethod.SELF_VEHICLE and data.vehicle_id:
        vehicle = await db.vehicles.find_one(
            {"$or": [{"id": data.vehicle_id}, {"vehicle_id": data.vehicle_id}]},
            {"_id": 0}
        )
        if vehicle:
            shipment["vehicle_details"] = {
                "vehicle_type": vehicle.get("vehicle_type"),
                "vehicle_model": vehicle.get("vehicle_model"),
                "registration_number": vehicle.get("registration_number")
            }
    
    await db.shipments.insert_one(shipment)
    
    # Update issuance status
    await db.issuances.update_one(
        {"id": issuance["id"]},
        {"$set": {"status": "dispatching", "shipment_id": shipment["id"]}}
    )
    
    return {
        "status": "success",
        "shipment_id": shipment["shipment_id"],
        "tracking_number": tracking_number,
        "id": shipment["id"]
    }

@router.get("/shipments")
async def get_shipments(
    status: Optional[str] = None,
    transport_method: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all shipments with filters"""
    query = {}
    if status:
        query["status"] = status
    if transport_method:
        query["transport_method"] = transport_method
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    
    shipments = await db.shipments.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return shipments

@router.get("/shipments/{shipment_id}")
async def get_shipment(shipment_id: str, current_user: dict = Depends(get_current_user)):
    """Get shipment details with full tracking history"""
    shipment = await db.shipments.find_one(
        {"$or": [{"id": shipment_id}, {"shipment_id": shipment_id}, {"tracking_number": shipment_id}]},
        {"_id": 0}
    )
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    # Get associated issuance details
    if shipment.get("issuance_id"):
        issuance = await db.issuances.find_one({"id": shipment["issuance_id"]}, {"_id": 0})
        shipment["issuance"] = issuance
        
        # Get items in issuance
        if issuance:
            items = await db.issued_items.find({"issuance_id": issuance["id"]}, {"_id": 0}).to_list(100)
            shipment["items"] = items
    
    # Enrich with user names
    if shipment.get("created_by"):
        user = await db.users.find_one({"id": shipment["created_by"]}, {"_id": 0, "full_name": 1})
        shipment["created_by_name"] = user.get("full_name") if user else None
    
    return shipment

@router.put("/shipments/{shipment_id}/dispatch")
async def dispatch_shipment(shipment_id: str, current_user: dict = Depends(get_current_user)):
    """Mark shipment as dispatched/picked up"""
    shipment = await db.shipments.find_one(
        {"$or": [{"id": shipment_id}, {"shipment_id": shipment_id}]},
        {"_id": 0}
    )
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    tracking_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "location": "Blood Bank",
        "status": "picked_up",
        "updated_by": current_user["id"],
        "notes": f"Dispatched by {current_user.get('full_name', current_user['email'])}"
    }
    
    await db.shipments.update_one(
        {"$or": [{"id": shipment_id}, {"shipment_id": shipment_id}]},
        {
            "$set": {
                "status": "in_transit",
                "dispatch_time": datetime.now(timezone.utc).isoformat()
            },
            "$push": {"tracking_updates": tracking_entry}
        }
    )
    
    # Update issuance
    if shipment.get("issuance_id"):
        await db.issuances.update_one(
            {"id": shipment["issuance_id"]},
            {"$set": {"status": "in_transit"}}
        )
    
    return {"status": "success"}

@router.post("/shipments/{shipment_id}/tracking")
async def add_tracking_update(
    shipment_id: str,
    update: TrackingUpdateCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a tracking update to shipment"""
    shipment = await db.shipments.find_one(
        {"$or": [{"id": shipment_id}, {"shipment_id": shipment_id}]},
        {"_id": 0}
    )
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    tracking_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "location": update.location,
        "status": update.status.value,
        "updated_by": current_user["id"],
        "notes": update.notes
    }
    
    update_status = update.status.value
    if update.status == TrackingStatus.DELIVERED:
        update_status = "delivered"
    elif update.status in [TrackingStatus.PICKED_UP, TrackingStatus.IN_TRANSIT, TrackingStatus.OUT_FOR_DELIVERY]:
        update_status = "in_transit"
    elif update.status == TrackingStatus.DELAYED:
        update_status = "delayed"
    elif update.status == TrackingStatus.FAILED:
        update_status = "failed"
    
    update_data = {
        "current_location": update.location,
        "status": update_status
    }
    
    if update.status == TrackingStatus.DELIVERED:
        update_data["delivery_time"] = datetime.now(timezone.utc).isoformat()
        update_data["actual_arrival"] = datetime.now(timezone.utc).isoformat()
    
    await db.shipments.update_one(
        {"$or": [{"id": shipment_id}, {"shipment_id": shipment_id}]},
        {
            "$set": update_data,
            "$push": {"tracking_updates": tracking_entry}
        }
    )
    
    # Update issuance if delivered
    if update.status == TrackingStatus.DELIVERED and shipment.get("issuance_id"):
        await db.issuances.update_one(
            {"id": shipment["issuance_id"]},
            {"$set": {"status": "delivered"}}
        )
    
    return {"status": "success", "tracking_entry": tracking_entry}

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
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "location": shipment.get("destination", "Destination"),
        "status": "delivered",
        "updated_by": current_user["id"],
        "notes": f"Received by {received_by}. {notes or ''}"
    }
    
    await db.shipments.update_one(
        {"$or": [{"id": shipment_id}, {"shipment_id": shipment_id}]},
        {
            "$set": {
                "status": "delivered",
                "delivery_time": datetime.now(timezone.utc).isoformat(),
                "actual_arrival": datetime.now(timezone.utc).isoformat(),
                "received_by": received_by,
                "current_location": shipment.get("destination", "Destination")
            },
            "$push": {"tracking_updates": tracking_entry}
        }
    )
    
    # Update associated issuance
    if shipment.get("issuance_id"):
        await db.issuances.update_one(
            {"id": shipment["issuance_id"]},
            {"$set": {"status": "delivered", "received_by": received_by}}
        )
    
    return {"status": "success"}

@router.put("/shipments/{shipment_id}/temperature")
async def log_temperature(
    shipment_id: str,
    temperature: float,
    location: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Log temperature reading during transport"""
    shipment = await db.shipments.find_one(
        {"$or": [{"id": shipment_id}, {"shipment_id": shipment_id}]},
        {"_id": 0}
    )
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    temp_entry = {
        "temperature": temperature,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "location": location or shipment.get("current_location", "Unknown"),
        "recorded_by": current_user["id"]
    }
    
    await db.shipments.update_one(
        {"$or": [{"id": shipment_id}, {"shipment_id": shipment_id}]},
        {"$push": {"temperature_log": temp_entry}}
    )
    
    # Check for temperature excursion
    # (In a real system, this would trigger alerts)
    
    return {"status": "success", "temperature_logged": temp_entry}

# ==================== PUBLIC TRACKING ====================

@router.get("/track/{tracking_number}")
async def public_track_shipment(tracking_number: str):
    """Public endpoint for tracking a shipment (no auth required)"""
    shipment = await db.shipments.find_one(
        {"$or": [{"tracking_number": tracking_number}, {"shipment_id": tracking_number}]},
        {"_id": 0}
    )
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    # Return limited info for public tracking
    return {
        "tracking_number": shipment.get("tracking_number"),
        "shipment_id": shipment.get("shipment_id"),
        "status": shipment.get("status"),
        "destination": shipment.get("destination"),
        "current_location": shipment.get("current_location"),
        "dispatch_time": shipment.get("dispatch_time"),
        "estimated_arrival": shipment.get("estimated_arrival"),
        "actual_arrival": shipment.get("actual_arrival"),
        "contact_phone": shipment.get("contact_phone"),
        "transport_method": shipment.get("transport_method"),
        "tracking_timeline": [
            {
                "timestamp": u.get("timestamp"),
                "location": u.get("location"),
                "status": u.get("status"),
                "notes": u.get("notes")
            }
            for u in shipment.get("tracking_updates", [])
        ]
    }

# ==================== DASHBOARD ====================

@router.get("/dashboard")
async def get_logistics_dashboard(current_user: dict = Depends(get_current_user)):
    """Get logistics dashboard stats"""
    total = await db.shipments.count_documents({})
    preparing = await db.shipments.count_documents({"status": "preparing"})
    in_transit = await db.shipments.count_documents({"status": "in_transit"})
    delivered = await db.shipments.count_documents({"status": "delivered"})
    delayed = await db.shipments.count_documents({"status": "delayed"})
    failed = await db.shipments.count_documents({"status": "failed"})
    
    # By transport method
    self_vehicle = await db.shipments.count_documents({"transport_method": "self_vehicle"})
    third_party = await db.shipments.count_documents({"transport_method": "third_party"})
    
    # Get recent shipments
    recent = await db.shipments.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    
    # Get active shipments (not delivered/failed)
    active = await db.shipments.find(
        {"status": {"$in": ["preparing", "in_transit", "delayed"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Calculate average delivery time
    delivered_shipments = await db.shipments.find(
        {"status": "delivered", "dispatch_time": {"$exists": True}, "delivery_time": {"$exists": True}},
        {"_id": 0, "dispatch_time": 1, "delivery_time": 1}
    ).to_list(100)
    
    avg_delivery_hours = 0
    if delivered_shipments:
        total_hours = 0
        valid_count = 0
        for s in delivered_shipments:
            try:
                dispatch = datetime.fromisoformat(s["dispatch_time"].replace("Z", "+00:00"))
                delivery = datetime.fromisoformat(s["delivery_time"].replace("Z", "+00:00"))
                total_hours += (delivery - dispatch).total_seconds() / 3600
                valid_count += 1
            except Exception:
                pass
        avg_delivery_hours = total_hours / valid_count if valid_count > 0 else 0
    
    # Get vehicles count
    active_vehicles = await db.vehicles.count_documents({"is_active": True})
    
    return {
        "total_shipments": total,
        "preparing": preparing,
        "in_transit": in_transit,
        "delivered": delivered,
        "delayed": delayed,
        "failed": failed,
        "by_transport_method": {
            "self_vehicle": self_vehicle,
            "third_party": third_party
        },
        "avg_delivery_hours": round(avg_delivery_hours, 1),
        "active_vehicles": active_vehicles,
        "recent_shipments": recent,
        "active_shipments": active
    }
