"""
Enhanced Inventory Management API
Provides comprehensive inventory views, transfers, reservations, and reporting
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import uuid

import sys
sys.path.append('..')

from database import db
from services import get_current_user

router = APIRouter(prefix="/inventory-enhanced", tags=["Enhanced Inventory"])

# ============ PYDANTIC MODELS ============

class MoveRequest(BaseModel):
    item_ids: List[str]
    item_type: str  # "unit" or "component"
    destination_storage_id: str
    reason: str  # "temp_optimization", "maintenance", "space_mgmt", "qc", "other"
    notes: Optional[str] = None

class ReserveRequest(BaseModel):
    item_ids: List[str]
    item_type: str
    request_id: Optional[str] = None
    reserved_for: str
    reserved_until: Optional[str] = None  # ISO datetime, default +24hrs
    notes: Optional[str] = None

class SearchFilters(BaseModel):
    blood_groups: Optional[List[str]] = None
    component_types: Optional[List[str]] = None
    storage_ids: Optional[List[str]] = None
    statuses: Optional[List[str]] = None
    expiry_from: Optional[str] = None
    expiry_to: Optional[str] = None
    volume_min: Optional[float] = None
    volume_max: Optional[float] = None
    search_query: Optional[str] = None

# ============ STORAGE TEMPERATURE COMPATIBILITY ============

STORAGE_TEMP_REQUIREMENTS = {
    "prc": {"min": 2, "max": 6, "compatible_types": ["refrigerator", "blood_fridge"]},
    "whole_blood": {"min": 2, "max": 6, "compatible_types": ["refrigerator", "blood_fridge"]},
    "plasma": {"min": -30, "max": -18, "compatible_types": ["freezer", "plasma_freezer"]},
    "ffp": {"min": -30, "max": -18, "compatible_types": ["freezer", "plasma_freezer"]},
    "platelets": {"min": 20, "max": 24, "compatible_types": ["platelet_agitator", "room_temp"]},
    "cryoprecipitate": {"min": -30, "max": -18, "compatible_types": ["freezer", "plasma_freezer"]},
}

def is_temp_compatible(component_type: str, storage: dict) -> bool:
    """Check if a component type is compatible with a storage location"""
    requirements = STORAGE_TEMP_REQUIREMENTS.get(component_type.lower(), {})
    if not requirements:
        return True
    
    storage_type = storage.get("storage_type", "").lower()
    compatible_types = requirements.get("compatible_types", [])
    
    # Check by storage type name
    for ct in compatible_types:
        if ct in storage_type:
            return True
    
    # Check by temperature range
    storage_temp_min = storage.get("temp_min")
    storage_temp_max = storage.get("temp_max")
    if storage_temp_min is not None and storage_temp_max is not None:
        req_min = requirements.get("min", -100)
        req_max = requirements.get("max", 100)
        return storage_temp_min <= req_max and storage_temp_max >= req_min
    
    return True

# ============ DASHBOARD VIEWS ============

@router.get("/dashboard/by-storage")
async def get_inventory_by_storage(current_user: dict = Depends(get_current_user)):
    """Get inventory grouped by storage location with occupancy stats"""
    locations = await db.storage_locations.find({"is_active": True}, {"_id": 0}).to_list(1000)
    
    result = []
    for loc in locations:
        storage_id = loc.get("id")
        
        # Count units and components in this storage
        units_count = await db.blood_units.count_documents({
            "$or": [
                {"storage_location_id": storage_id},
                {"storage_location": loc.get("location_code")}
            ],
            "status": {"$in": ["ready_to_use", "reserved", "quarantine"]}
        })
        
        components_count = await db.components.count_documents({
            "$or": [
                {"storage_location_id": storage_id},
                {"storage_location": loc.get("location_code")}
            ],
            "status": {"$in": ["ready_to_use", "reserved", "quarantine"]}
        })
        
        total_items = units_count + components_count
        capacity = loc.get("capacity", 100)
        occupancy_percent = round((total_items / capacity) * 100, 1) if capacity > 0 else 0
        
        # Get expiring items count
        expiry_date = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat().split("T")[0]
        expiring_units = await db.blood_units.count_documents({
            "$or": [{"storage_location_id": storage_id}, {"storage_location": loc.get("location_code")}],
            "status": "ready_to_use",
            "expiry_date": {"$lte": expiry_date}
        })
        expiring_components = await db.components.count_documents({
            "$or": [{"storage_location_id": storage_id}, {"storage_location": loc.get("location_code")}],
            "status": "ready_to_use",
            "expiry_date": {"$lte": expiry_date}
        })
        
        result.append({
            "id": storage_id,
            "location_code": loc.get("location_code"),
            "storage_name": loc.get("storage_name"),
            "storage_type": loc.get("storage_type"),
            "facility": loc.get("facility"),
            "capacity": capacity,
            "current_occupancy": total_items,
            "occupancy_percent": occupancy_percent,
            "units_count": units_count,
            "components_count": components_count,
            "expiring_count": expiring_units + expiring_components,
            "temp_min": loc.get("temp_min"),
            "temp_max": loc.get("temp_max"),
        })
    
    return sorted(result, key=lambda x: x["storage_name"])


@router.get("/dashboard/by-blood-group")
async def get_inventory_by_blood_group(current_user: dict = Depends(get_current_user)):
    """Get inventory grouped by blood group"""
    blood_groups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
    result = []
    
    for bg in blood_groups:
        # Units
        units = await db.blood_units.find({
            "$or": [{"blood_group": bg}, {"confirmed_blood_group": bg}],
            "status": {"$in": ["ready_to_use", "reserved"]}
        }, {"_id": 0, "unit_id": 1, "volume": 1, "expiry_date": 1, "status": 1, "storage_location": 1}).to_list(1000)
        
        # Components
        components = await db.components.find({
            "blood_group": bg,
            "status": {"$in": ["ready_to_use", "reserved"]}
        }, {"_id": 0, "component_id": 1, "component_type": 1, "volume": 1, "expiry_date": 1, "status": 1, "storage_location": 1}).to_list(1000)
        
        # Group components by type
        components_by_type = {}
        for comp in components:
            ct = comp.get("component_type", "unknown")
            if ct not in components_by_type:
                components_by_type[ct] = []
            components_by_type[ct].append(comp)
        
        total_volume = sum(u.get("volume", 0) for u in units) + sum(c.get("volume", 0) for c in components)
        
        result.append({
            "blood_group": bg,
            "units": units,
            "units_count": len(units),
            "components_by_type": components_by_type,
            "components_count": len(components),
            "total_items": len(units) + len(components),
            "total_volume": total_volume,
        })
    
    return result


@router.get("/dashboard/by-component-type")
async def get_inventory_by_component_type(current_user: dict = Depends(get_current_user)):
    """Get inventory grouped by component type"""
    component_types = ["prc", "plasma", "ffp", "platelets", "cryoprecipitate"]
    result = []
    
    # Add whole blood units
    units = await db.blood_units.find({
        "status": {"$in": ["ready_to_use", "reserved"]}
    }, {"_id": 0}).to_list(1000)
    
    result.append({
        "component_type": "whole_blood",
        "display_name": "Whole Blood",
        "items": units,
        "count": len(units),
        "total_volume": sum(u.get("volume", 0) for u in units),
        "storage_temp": "2-6°C",
    })
    
    for ct in component_types:
        components = await db.components.find({
            "component_type": ct,
            "status": {"$in": ["ready_to_use", "reserved"]}
        }, {"_id": 0}).to_list(1000)
        
        temp_req = STORAGE_TEMP_REQUIREMENTS.get(ct, {})
        temp_display = f"{temp_req.get('min', 2)}-{temp_req.get('max', 6)}°C" if temp_req else "N/A"
        
        result.append({
            "component_type": ct,
            "display_name": ct.upper().replace("_", " "),
            "items": components,
            "count": len(components),
            "total_volume": sum(c.get("volume", 0) for c in components),
            "storage_temp": temp_display,
        })
    
    return result


@router.get("/dashboard/by-expiry")
async def get_inventory_by_expiry(current_user: dict = Depends(get_current_user)):
    """Get inventory sorted by expiration date (FEFO - First Expiry First Out)"""
    today = datetime.now(timezone.utc).date()
    
    # Get all available items
    units = await db.blood_units.find({
        "status": {"$in": ["ready_to_use", "reserved"]},
        "expiry_date": {"$ne": None}
    }, {"_id": 0}).to_list(1000)
    
    components = await db.components.find({
        "status": {"$in": ["ready_to_use", "reserved"]},
        "expiry_date": {"$ne": None}
    }, {"_id": 0}).to_list(1000)
    
    # Calculate days remaining and categorize
    all_items = []
    
    for unit in units:
        try:
            expiry = datetime.fromisoformat(unit["expiry_date"].replace("Z", "")).date()
            days_remaining = (expiry - today).days
            all_items.append({
                **unit,
                "item_type": "unit",
                "item_id": unit.get("unit_id"),
                "days_remaining": days_remaining,
                "expiry_category": get_expiry_category(days_remaining),
            })
        except:
            continue
    
    for comp in components:
        try:
            expiry = datetime.fromisoformat(comp["expiry_date"].replace("Z", "")).date()
            days_remaining = (expiry - today).days
            all_items.append({
                **comp,
                "item_type": "component",
                "item_id": comp.get("component_id"),
                "days_remaining": days_remaining,
                "expiry_category": get_expiry_category(days_remaining),
            })
        except:
            continue
    
    # Sort by days remaining
    all_items.sort(key=lambda x: x["days_remaining"])
    
    # Group by category
    categories = {
        "expired": [],
        "critical": [],  # <3 days
        "warning": [],   # 3-7 days
        "caution": [],   # 7-14 days
        "normal": [],    # >14 days
    }
    
    for item in all_items:
        cat = item["expiry_category"]
        if cat in categories:
            categories[cat].append(item)
    
    return {
        "items": all_items,
        "categories": categories,
        "summary": {
            "expired": len(categories["expired"]),
            "critical": len(categories["critical"]),
            "warning": len(categories["warning"]),
            "caution": len(categories["caution"]),
            "normal": len(categories["normal"]),
        }
    }


@router.get("/dashboard/by-status")
async def get_inventory_by_status(current_user: dict = Depends(get_current_user)):
    """Get inventory grouped by status"""
    statuses = ["ready_to_use", "reserved", "quarantine", "processing", "collected"]
    result = []
    
    for status in statuses:
        units = await db.blood_units.find({"status": status}, {"_id": 0}).to_list(1000)
        components = await db.components.find({"status": status}, {"_id": 0}).to_list(1000)
        
        result.append({
            "status": status,
            "display_name": status.replace("_", " ").title(),
            "units": units,
            "units_count": len(units),
            "components": components,
            "components_count": len(components),
            "total_count": len(units) + len(components),
        })
    
    return result


def get_expiry_category(days_remaining: int) -> str:
    """Categorize items by days remaining until expiry"""
    if days_remaining < 0:
        return "expired"
    elif days_remaining < 3:
        return "critical"
    elif days_remaining < 7:
        return "warning"
    elif days_remaining < 14:
        return "caution"
    else:
        return "normal"


# ============ STORAGE CONTENTS ============

@router.get("/storage/{storage_id}/contents")
async def get_storage_contents(
    storage_id: str,
    page: int = 1,
    page_size: int = 50,
    sort_by: str = "expiry_date",
    current_user: dict = Depends(get_current_user)
):
    """Get detailed contents of a storage location"""
    location = await db.storage_locations.find_one(
        {"$or": [{"id": storage_id}, {"location_code": storage_id}]},
        {"_id": 0}
    )
    if not location:
        raise HTTPException(status_code=404, detail="Storage location not found")
    
    storage_query = {
        "$or": [
            {"storage_location_id": location["id"]},
            {"storage_location": location.get("location_code")}
        ]
    }
    
    # Get units
    units = await db.blood_units.find(storage_query, {"_id": 0}).to_list(1000)
    components = await db.components.find(storage_query, {"_id": 0}).to_list(1000)
    
    # Combine and add metadata
    today = datetime.now(timezone.utc).date()
    all_items = []
    
    for unit in units:
        days_remaining = None
        if unit.get("expiry_date"):
            try:
                expiry = datetime.fromisoformat(unit["expiry_date"].replace("Z", "")).date()
                days_remaining = (expiry - today).days
            except:
                pass
        
        all_items.append({
            **unit,
            "item_type": "unit",
            "item_id": unit.get("unit_id"),
            "component_type": "whole_blood",
            "days_remaining": days_remaining,
            "expiry_category": get_expiry_category(days_remaining) if days_remaining is not None else "unknown",
        })
    
    for comp in components:
        days_remaining = None
        if comp.get("expiry_date"):
            try:
                expiry = datetime.fromisoformat(comp["expiry_date"].replace("Z", "")).date()
                days_remaining = (expiry - today).days
            except:
                pass
        
        all_items.append({
            **comp,
            "item_type": "component",
            "item_id": comp.get("component_id"),
            "days_remaining": days_remaining,
            "expiry_category": get_expiry_category(days_remaining) if days_remaining is not None else "unknown",
        })
    
    # Sort
    if sort_by == "expiry_date":
        all_items.sort(key=lambda x: x.get("expiry_date") or "9999-99-99")
    elif sort_by == "blood_group":
        all_items.sort(key=lambda x: x.get("blood_group") or x.get("confirmed_blood_group") or "ZZ")
    elif sort_by == "component_type":
        all_items.sort(key=lambda x: x.get("component_type", "whole_blood"))
    
    # Paginate
    total = len(all_items)
    start = (page - 1) * page_size
    end = start + page_size
    paginated_items = all_items[start:end]
    
    return {
        "location": location,
        "items": paginated_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


# ============ MOVE/TRANSFER ============

@router.post("/move")
async def move_items(request: MoveRequest, current_user: dict = Depends(get_current_user)):
    """Move items to a different storage location"""
    # Get destination storage
    destination = await db.storage_locations.find_one(
        {"$or": [{"id": request.destination_storage_id}, {"location_code": request.destination_storage_id}]},
        {"_id": 0}
    )
    if not destination:
        raise HTTPException(status_code=404, detail="Destination storage not found")
    
    # Check capacity
    available_capacity = destination.get("capacity", 0) - destination.get("current_occupancy", 0)
    if len(request.item_ids) > available_capacity:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient capacity. Only {available_capacity} slots available, trying to move {len(request.item_ids)} items."
        )
    
    collection = db.blood_units if request.item_type == "unit" else db.components
    id_field = "unit_id" if request.item_type == "unit" else "component_id"
    
    moved = []
    failed = []
    
    for item_id in request.item_ids:
        try:
            # Get item
            item = await collection.find_one(
                {"$or": [{"id": item_id}, {id_field: item_id}]},
                {"_id": 0}
            )
            if not item:
                failed.append({"id": item_id, "reason": "Not found"})
                continue
            
            # Check temp compatibility
            component_type = item.get("component_type", "whole_blood") if request.item_type == "component" else "whole_blood"
            if not is_temp_compatible(component_type, destination):
                failed.append({"id": item_id, "reason": "Temperature incompatible"})
                continue
            
            old_location = item.get("storage_location", "Unknown")
            old_storage_id = item.get("storage_location_id")
            
            # Update item
            await collection.update_one(
                {"$or": [{"id": item_id}, {id_field: item_id}]},
                {"$set": {
                    "storage_location_id": destination["id"],
                    "storage_location": destination["location_code"],
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Update occupancy
            await db.storage_locations.update_one(
                {"id": destination["id"]},
                {"$inc": {"current_occupancy": 1}}
            )
            if old_storage_id:
                await db.storage_locations.update_one(
                    {"id": old_storage_id},
                    {"$inc": {"current_occupancy": -1}}
                )
            
            # Log chain of custody
            custody_record = {
                "id": str(uuid.uuid4()),
                "unit_id": item["id"],
                "item_type": request.item_type,
                "stage": "Storage Transfer",
                "from_location": old_location,
                "to_location": destination["location_code"],
                "reason": request.reason,
                "giver_id": current_user["id"],
                "receiver_id": current_user["id"],
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "confirmed": True,
                "notes": request.notes or f"Transfer reason: {request.reason}"
            }
            await db.chain_custody.insert_one(custody_record)
            
            moved.append(item_id)
        except Exception as e:
            failed.append({"id": item_id, "reason": str(e)})
    
    return {
        "status": "success" if moved else "failed",
        "moved": moved,
        "moved_count": len(moved),
        "failed": failed,
        "failed_count": len(failed),
        "destination": destination["storage_name"]
    }


@router.get("/move/validate")
async def validate_move(
    item_ids: str,  # comma-separated
    item_type: str,
    destination_storage_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Validate a move operation before execution"""
    ids = [i.strip() for i in item_ids.split(",") if i.strip()]
    
    destination = await db.storage_locations.find_one(
        {"$or": [{"id": destination_storage_id}, {"location_code": destination_storage_id}]},
        {"_id": 0}
    )
    if not destination:
        return {"valid": False, "error": "Destination storage not found"}
    
    # Check capacity
    available = destination.get("capacity", 0) - destination.get("current_occupancy", 0)
    if len(ids) > available:
        return {
            "valid": False, 
            "error": f"Insufficient capacity. {available} slots available, need {len(ids)}",
            "available_capacity": available
        }
    
    # Check temp compatibility
    collection = db.blood_units if item_type == "unit" else db.components
    id_field = "unit_id" if item_type == "unit" else "component_id"
    
    incompatible = []
    for item_id in ids:
        item = await collection.find_one(
            {"$or": [{"id": item_id}, {id_field: item_id}]},
            {"_id": 0}
        )
        if item:
            ct = item.get("component_type", "whole_blood") if item_type == "component" else "whole_blood"
            if not is_temp_compatible(ct, destination):
                incompatible.append({"id": item_id, "type": ct})
    
    if incompatible:
        return {
            "valid": False,
            "error": "Some items are temperature incompatible",
            "incompatible_items": incompatible
        }
    
    return {
        "valid": True,
        "items_count": len(ids),
        "destination": destination["storage_name"],
        "available_capacity": available
    }


# ============ SEARCH & LOCATE ============

@router.get("/search")
async def search_inventory(
    q: Optional[str] = None,
    blood_groups: Optional[str] = None,  # comma-separated
    component_types: Optional[str] = None,  # comma-separated
    storage_ids: Optional[str] = None,  # comma-separated
    statuses: Optional[str] = None,  # comma-separated
    expiry_from: Optional[str] = None,
    expiry_to: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Advanced search for inventory items"""
    units_query = {}
    components_query = {}
    
    # Text search
    if q:
        text_match = {"$regex": q, "$options": "i"}
        units_query["$or"] = [
            {"unit_id": text_match},
            {"donor_id": text_match},
            {"bag_barcode": text_match}
        ]
        components_query["$or"] = [
            {"component_id": text_match},
            {"parent_unit_id": text_match},
            {"batch_id": text_match}
        ]
    
    # Blood group filter
    if blood_groups:
        bg_list = [b.strip() for b in blood_groups.split(",")]
        units_query["$or"] = units_query.get("$or", []) + [
            {"blood_group": {"$in": bg_list}},
            {"confirmed_blood_group": {"$in": bg_list}}
        ]
        components_query["blood_group"] = {"$in": bg_list}
    
    # Component type filter
    if component_types:
        ct_list = [c.strip() for c in component_types.split(",")]
        if "whole_blood" not in ct_list:
            units_query = {"_skip": True}  # Skip units if not searching for whole blood
        components_query["component_type"] = {"$in": ct_list}
    
    # Storage filter
    if storage_ids:
        s_list = [s.strip() for s in storage_ids.split(",")]
        storage_match = {"$or": [
            {"storage_location_id": {"$in": s_list}},
            {"storage_location": {"$in": s_list}}
        ]}
        units_query.update(storage_match)
        components_query.update(storage_match)
    
    # Status filter
    if statuses:
        status_list = [s.strip() for s in statuses.split(",")]
        units_query["status"] = {"$in": status_list}
        components_query["status"] = {"$in": status_list}
    
    # Expiry filter
    if expiry_from:
        units_query["expiry_date"] = units_query.get("expiry_date", {})
        units_query["expiry_date"]["$gte"] = expiry_from
        components_query["expiry_date"] = components_query.get("expiry_date", {})
        components_query["expiry_date"]["$gte"] = expiry_from
    if expiry_to:
        units_query["expiry_date"] = units_query.get("expiry_date", {})
        units_query["expiry_date"]["$lte"] = expiry_to
        components_query["expiry_date"] = components_query.get("expiry_date", {})
        components_query["expiry_date"]["$lte"] = expiry_to
    
    # Execute queries
    units = []
    if "_skip" not in units_query:
        units = await db.blood_units.find(units_query, {"_id": 0}).to_list(1000)
    
    components = await db.components.find(components_query, {"_id": 0}).to_list(1000)
    
    # Combine results
    all_items = []
    today = datetime.now(timezone.utc).date()
    
    for unit in units:
        days_remaining = None
        if unit.get("expiry_date"):
            try:
                expiry = datetime.fromisoformat(unit["expiry_date"].replace("Z", "")).date()
                days_remaining = (expiry - today).days
            except:
                pass
        
        all_items.append({
            **unit,
            "item_type": "unit",
            "item_id": unit.get("unit_id"),
            "component_type": "whole_blood",
            "days_remaining": days_remaining,
        })
    
    for comp in components:
        days_remaining = None
        if comp.get("expiry_date"):
            try:
                expiry = datetime.fromisoformat(comp["expiry_date"].replace("Z", "")).date()
                days_remaining = (expiry - today).days
            except:
                pass
        
        all_items.append({
            **comp,
            "item_type": "component",
            "item_id": comp.get("component_id"),
            "days_remaining": days_remaining,
        })
    
    # Paginate
    total = len(all_items)
    start = (page - 1) * page_size
    end = start + page_size
    
    return {
        "items": all_items[start:end],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/locate/{item_id}")
async def locate_item(item_id: str, current_user: dict = Depends(get_current_user)):
    """Quick locate an item by ID, barcode, or donor ID"""
    # Search in units
    unit = await db.blood_units.find_one(
        {"$or": [
            {"id": item_id},
            {"unit_id": item_id},
            {"bag_barcode": item_id},
            {"donor_id": item_id}
        ]},
        {"_id": 0}
    )
    
    if unit:
        storage = None
        if unit.get("storage_location_id"):
            storage = await db.storage_locations.find_one(
                {"id": unit["storage_location_id"]},
                {"_id": 0}
            )
        
        return {
            "found": True,
            "item_type": "unit",
            "item": unit,
            "location": {
                "storage": storage,
                "current_location": unit.get("storage_location") or unit.get("current_location"),
                "display": f"Located in: {storage['storage_name'] if storage else unit.get('storage_location', 'Unknown')}"
            }
        }
    
    # Search in components
    component = await db.components.find_one(
        {"$or": [
            {"id": item_id},
            {"component_id": item_id},
            {"batch_id": item_id}
        ]},
        {"_id": 0}
    )
    
    if component:
        storage = None
        if component.get("storage_location_id"):
            storage = await db.storage_locations.find_one(
                {"id": component["storage_location_id"]},
                {"_id": 0}
            )
        
        return {
            "found": True,
            "item_type": "component",
            "item": component,
            "location": {
                "storage": storage,
                "current_location": component.get("storage_location"),
                "display": f"Located in: {storage['storage_name'] if storage else component.get('storage_location', 'Unknown')}"
            }
        }
    
    return {"found": False, "message": "Item not found"}


# ============ RESERVE SYSTEM ============

@router.post("/reserve")
async def reserve_items(request: ReserveRequest, current_user: dict = Depends(get_current_user)):
    """Reserve items for a request or manual reservation"""
    collection = db.blood_units if request.item_type == "unit" else db.components
    id_field = "unit_id" if request.item_type == "unit" else "component_id"
    
    # Default reserved_until to 24 hours from now
    reserved_until = request.reserved_until
    if not reserved_until:
        reserved_until = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    
    reserved = []
    failed = []
    
    for item_id in request.item_ids:
        try:
            item = await collection.find_one(
                {"$or": [{"id": item_id}, {id_field: item_id}]},
                {"_id": 0}
            )
            
            if not item:
                failed.append({"id": item_id, "reason": "Not found"})
                continue
            
            if item.get("status") != "ready_to_use":
                failed.append({"id": item_id, "reason": f"Cannot reserve - current status: {item.get('status')}"})
                continue
            
            # Update item
            await collection.update_one(
                {"$or": [{"id": item_id}, {id_field: item_id}]},
                {"$set": {
                    "status": "reserved",
                    "reserved_for": request.reserved_for,
                    "reserved_until": reserved_until,
                    "reserved_request_id": request.request_id,
                    "reserved_by": current_user["id"],
                    "reserved_at": datetime.now(timezone.utc).isoformat(),
                    "reservation_notes": request.notes,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Log chain of custody
            custody_record = {
                "id": str(uuid.uuid4()),
                "unit_id": item["id"],
                "item_type": request.item_type,
                "stage": "Reservation",
                "from_location": item.get("storage_location", "Unknown"),
                "to_location": item.get("storage_location", "Reserved"),
                "reason": f"Reserved for: {request.reserved_for}",
                "giver_id": current_user["id"],
                "receiver_id": current_user["id"],
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "confirmed": True,
                "notes": request.notes
            }
            await db.chain_custody.insert_one(custody_record)
            
            reserved.append(item_id)
        except Exception as e:
            failed.append({"id": item_id, "reason": str(e)})
    
    return {
        "status": "success" if reserved else "failed",
        "reserved": reserved,
        "reserved_count": len(reserved),
        "failed": failed,
        "failed_count": len(failed),
        "reserved_until": reserved_until
    }


@router.post("/reserve/{item_id}/release")
async def release_reservation(
    item_id: str,
    item_type: str = "component",
    current_user: dict = Depends(get_current_user)
):
    """Release a reserved item back to available"""
    collection = db.blood_units if item_type == "unit" else db.components
    id_field = "unit_id" if item_type == "unit" else "component_id"
    
    item = await collection.find_one(
        {"$or": [{"id": item_id}, {id_field: item_id}]},
        {"_id": 0}
    )
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if item.get("status") != "reserved":
        raise HTTPException(status_code=400, detail="Item is not currently reserved")
    
    await collection.update_one(
        {"$or": [{"id": item_id}, {id_field: item_id}]},
        {
            "$set": {
                "status": "ready_to_use",
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$unset": {
                "reserved_for": "",
                "reserved_until": "",
                "reserved_request_id": "",
                "reserved_by": "",
                "reserved_at": "",
                "reservation_notes": ""
            }
        }
    )
    
    # Log chain of custody
    custody_record = {
        "id": str(uuid.uuid4()),
        "unit_id": item["id"],
        "item_type": item_type,
        "stage": "Reservation Release",
        "from_location": "Reserved",
        "to_location": item.get("storage_location", "Available"),
        "reason": "Reservation released",
        "giver_id": current_user["id"],
        "receiver_id": current_user["id"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "confirmed": True,
    }
    await db.chain_custody.insert_one(custody_record)
    
    return {"status": "success", "message": "Reservation released"}


@router.get("/reserved")
async def get_reserved_items(current_user: dict = Depends(get_current_user)):
    """Get all reserved items"""
    units = await db.blood_units.find({"status": "reserved"}, {"_id": 0}).to_list(1000)
    components = await db.components.find({"status": "reserved"}, {"_id": 0}).to_list(1000)
    
    now = datetime.now(timezone.utc)
    all_reserved = []
    
    for unit in units:
        time_remaining = None
        if unit.get("reserved_until"):
            try:
                until = datetime.fromisoformat(unit["reserved_until"].replace("Z", "+00:00"))
                time_remaining = (until - now).total_seconds() / 3600  # hours
            except:
                pass
        
        all_reserved.append({
            **unit,
            "item_type": "unit",
            "item_id": unit.get("unit_id"),
            "component_type": "whole_blood",
            "time_remaining_hours": round(time_remaining, 1) if time_remaining else None,
            "is_expired": time_remaining is not None and time_remaining < 0,
        })
    
    for comp in components:
        time_remaining = None
        if comp.get("reserved_until"):
            try:
                until = datetime.fromisoformat(comp["reserved_until"].replace("Z", "+00:00"))
                time_remaining = (until - now).total_seconds() / 3600
            except:
                pass
        
        all_reserved.append({
            **comp,
            "item_type": "component",
            "item_id": comp.get("component_id"),
            "time_remaining_hours": round(time_remaining, 1) if time_remaining else None,
            "is_expired": time_remaining is not None and time_remaining < 0,
        })
    
    return all_reserved


@router.post("/reserve/auto-release")
async def auto_release_expired_reservations(current_user: dict = Depends(get_current_user)):
    """Auto-release reservations that have expired"""
    if current_user["role"] not in ["admin", "inventory"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Release expired unit reservations
    units_result = await db.blood_units.update_many(
        {
            "status": "reserved",
            "reserved_until": {"$lt": now}
        },
        {
            "$set": {"status": "ready_to_use", "updated_at": now},
            "$unset": {
                "reserved_for": "",
                "reserved_until": "",
                "reserved_request_id": "",
                "reserved_by": "",
                "reserved_at": "",
                "reservation_notes": ""
            }
        }
    )
    
    # Release expired component reservations
    components_result = await db.components.update_many(
        {
            "status": "reserved",
            "reserved_until": {"$lt": now}
        },
        {
            "$set": {"status": "ready_to_use", "updated_at": now},
            "$unset": {
                "reserved_for": "",
                "reserved_until": "",
                "reserved_request_id": "",
                "reserved_by": "",
                "reserved_at": "",
                "reservation_notes": ""
            }
        }
    )
    
    return {
        "status": "success",
        "units_released": units_result.modified_count,
        "components_released": components_result.modified_count,
        "total_released": units_result.modified_count + components_result.modified_count
    }


# ============ REPORTS ============

@router.get("/reports/stock")
async def get_stock_report(current_user: dict = Depends(get_current_user)):
    """Current stock report with summary and breakdown"""
    # Summary stats
    total_units = await db.blood_units.count_documents({"status": {"$in": ["ready_to_use", "reserved"]}})
    total_components = await db.components.count_documents({"status": {"$in": ["ready_to_use", "reserved"]}})
    
    # By blood group
    units_by_bg = await db.blood_units.aggregate([
        {"$match": {"status": {"$in": ["ready_to_use", "reserved"]}}},
        {"$group": {"_id": {"$ifNull": ["$confirmed_blood_group", "$blood_group"]}, "count": {"$sum": 1}, "volume": {"$sum": "$volume"}}}
    ]).to_list(20)
    
    components_by_bg = await db.components.aggregate([
        {"$match": {"status": {"$in": ["ready_to_use", "reserved"]}}},
        {"$group": {"_id": "$blood_group", "count": {"$sum": 1}, "volume": {"$sum": "$volume"}}}
    ]).to_list(20)
    
    # By component type
    components_by_type = await db.components.aggregate([
        {"$match": {"status": {"$in": ["ready_to_use", "reserved"]}}},
        {"$group": {"_id": "$component_type", "count": {"$sum": 1}, "volume": {"$sum": "$volume"}}}
    ]).to_list(20)
    
    # By storage
    units_by_storage = await db.blood_units.aggregate([
        {"$match": {"status": {"$in": ["ready_to_use", "reserved"]}}},
        {"$group": {"_id": "$storage_location", "count": {"$sum": 1}}}
    ]).to_list(100)
    
    components_by_storage = await db.components.aggregate([
        {"$match": {"status": {"$in": ["ready_to_use", "reserved"]}}},
        {"$group": {"_id": "$storage_location", "count": {"$sum": 1}}}
    ]).to_list(100)
    
    return {
        "summary": {
            "total_units": total_units,
            "total_components": total_components,
            "total_items": total_units + total_components,
        },
        "by_blood_group": {
            "units": {item["_id"]: {"count": item["count"], "volume": item["volume"]} for item in units_by_bg if item["_id"]},
            "components": {item["_id"]: {"count": item["count"], "volume": item["volume"]} for item in components_by_bg if item["_id"]},
        },
        "by_component_type": {item["_id"]: {"count": item["count"], "volume": item["volume"]} for item in components_by_type if item["_id"]},
        "by_storage": {
            "units": {item["_id"]: item["count"] for item in units_by_storage if item["_id"]},
            "components": {item["_id"]: item["count"] for item in components_by_storage if item["_id"]},
        }
    }


@router.get("/reports/movement")
async def get_movement_report(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Stock movement report"""
    query = {"stage": {"$in": ["Storage Assignment", "Storage Transfer", "Reservation", "Reservation Release"]}}
    
    if from_date:
        query["timestamp"] = query.get("timestamp", {})
        query["timestamp"]["$gte"] = from_date
    if to_date:
        query["timestamp"] = query.get("timestamp", {})
        query["timestamp"]["$lte"] = to_date
    
    movements = await db.chain_custody.find(query, {"_id": 0}).sort("timestamp", -1).to_list(1000)
    
    # Group by day
    by_day = {}
    by_reason = {}
    by_location = {"from": {}, "to": {}}
    
    for mov in movements:
        # By day
        day = mov.get("timestamp", "")[:10]
        if day not in by_day:
            by_day[day] = {"transfers": 0, "reservations": 0, "releases": 0}
        
        stage = mov.get("stage", "")
        if "Transfer" in stage:
            by_day[day]["transfers"] += 1
        elif stage == "Reservation":
            by_day[day]["reservations"] += 1
        elif "Release" in stage:
            by_day[day]["releases"] += 1
        
        # By reason
        reason = mov.get("reason", "Unknown")
        by_reason[reason] = by_reason.get(reason, 0) + 1
        
        # By location
        from_loc = mov.get("from_location", "Unknown")
        to_loc = mov.get("to_location", "Unknown")
        by_location["from"][from_loc] = by_location["from"].get(from_loc, 0) + 1
        by_location["to"][to_loc] = by_location["to"].get(to_loc, 0) + 1
    
    return {
        "movements": movements[:100],  # Latest 100
        "total_movements": len(movements),
        "by_day": by_day,
        "by_reason": by_reason,
        "by_location": by_location,
    }


@router.get("/reports/expiry-analysis")
async def get_expiry_analysis_report(current_user: dict = Depends(get_current_user)):
    """Expiry analysis report"""
    today = datetime.now(timezone.utc).date()
    
    # Get all items with expiry dates
    units = await db.blood_units.find({
        "status": {"$in": ["ready_to_use", "reserved"]},
        "expiry_date": {"$ne": None}
    }, {"_id": 0, "unit_id": 1, "expiry_date": 1, "blood_group": 1, "confirmed_blood_group": 1}).to_list(1000)
    
    components = await db.components.find({
        "status": {"$in": ["ready_to_use", "reserved"]},
        "expiry_date": {"$ne": None}
    }, {"_id": 0, "component_id": 1, "component_type": 1, "expiry_date": 1, "blood_group": 1}).to_list(1000)
    
    # Categorize
    categories = {
        "expired": {"units": [], "components": []},
        "3_days": {"units": [], "components": []},
        "7_days": {"units": [], "components": []},
        "14_days": {"units": [], "components": []},
        "30_days": {"units": [], "components": []},
        "beyond_30": {"units": [], "components": []},
    }
    
    for unit in units:
        try:
            expiry = datetime.fromisoformat(unit["expiry_date"].replace("Z", "")).date()
            days = (expiry - today).days
            
            if days < 0:
                categories["expired"]["units"].append(unit)
            elif days <= 3:
                categories["3_days"]["units"].append(unit)
            elif days <= 7:
                categories["7_days"]["units"].append(unit)
            elif days <= 14:
                categories["14_days"]["units"].append(unit)
            elif days <= 30:
                categories["30_days"]["units"].append(unit)
            else:
                categories["beyond_30"]["units"].append(unit)
        except:
            continue
    
    for comp in components:
        try:
            expiry = datetime.fromisoformat(comp["expiry_date"].replace("Z", "")).date()
            days = (expiry - today).days
            
            if days < 0:
                categories["expired"]["components"].append(comp)
            elif days <= 3:
                categories["3_days"]["components"].append(comp)
            elif days <= 7:
                categories["7_days"]["components"].append(comp)
            elif days <= 14:
                categories["14_days"]["components"].append(comp)
            elif days <= 30:
                categories["30_days"]["components"].append(comp)
            else:
                categories["beyond_30"]["components"].append(comp)
        except:
            continue
    
    # Get historical discard data
    discards = await db.discards.find({}, {"_id": 0, "discard_date": 1, "reason": 1}).to_list(1000)
    discard_by_reason = {}
    for d in discards:
        reason = d.get("reason", "Unknown")
        discard_by_reason[reason] = discard_by_reason.get(reason, 0) + 1
    
    return {
        "categories": {
            cat: {
                "units_count": len(data["units"]),
                "components_count": len(data["components"]),
                "total": len(data["units"]) + len(data["components"]),
                "units": data["units"][:10],
                "components": data["components"][:10],
            }
            for cat, data in categories.items()
        },
        "summary": {
            "expired": len(categories["expired"]["units"]) + len(categories["expired"]["components"]),
            "expiring_3_days": len(categories["3_days"]["units"]) + len(categories["3_days"]["components"]),
            "expiring_7_days": len(categories["7_days"]["units"]) + len(categories["7_days"]["components"]),
            "expiring_14_days": len(categories["14_days"]["units"]) + len(categories["14_days"]["components"]),
            "expiring_30_days": len(categories["30_days"]["units"]) + len(categories["30_days"]["components"]),
        },
        "historical_discards": {
            "total": len(discards),
            "by_reason": discard_by_reason,
        }
    }


@router.get("/reports/storage-utilization")
async def get_storage_utilization_report(current_user: dict = Depends(get_current_user)):
    """Storage utilization report"""
    locations = await db.storage_locations.find({"is_active": True}, {"_id": 0}).to_list(1000)
    
    utilization = []
    for loc in locations:
        capacity = loc.get("capacity", 0)
        occupancy = loc.get("current_occupancy", 0)
        
        if capacity > 0:
            percent = round((occupancy / capacity) * 100, 1)
        else:
            percent = 0
        
        status = "normal"
        if percent >= 90:
            status = "critical"
        elif percent >= 70:
            status = "warning"
        elif percent < 30:
            status = "underutilized"
        
        utilization.append({
            "id": loc.get("id"),
            "location_code": loc.get("location_code"),
            "storage_name": loc.get("storage_name"),
            "storage_type": loc.get("storage_type"),
            "capacity": capacity,
            "occupancy": occupancy,
            "available": capacity - occupancy,
            "utilization_percent": percent,
            "status": status,
        })
    
    # Summary stats
    total_capacity = sum(l["capacity"] for l in utilization)
    total_occupancy = sum(l["occupancy"] for l in utilization)
    overall_utilization = round((total_occupancy / total_capacity) * 100, 1) if total_capacity > 0 else 0
    
    return {
        "locations": sorted(utilization, key=lambda x: -x["utilization_percent"]),
        "summary": {
            "total_capacity": total_capacity,
            "total_occupancy": total_occupancy,
            "overall_utilization": overall_utilization,
            "critical_count": len([l for l in utilization if l["status"] == "critical"]),
            "warning_count": len([l for l in utilization if l["status"] == "warning"]),
            "underutilized_count": len([l for l in utilization if l["status"] == "underutilized"]),
        }
    }


# ============ AUDIT TRAIL ============

@router.get("/audit/{item_id}")
async def get_item_audit_trail(
    item_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get complete audit trail for an item"""
    # Find item first
    unit = await db.blood_units.find_one(
        {"$or": [{"id": item_id}, {"unit_id": item_id}]},
        {"_id": 0}
    )
    
    component = await db.components.find_one(
        {"$or": [{"id": item_id}, {"component_id": item_id}]},
        {"_id": 0}
    )
    
    if not unit and not component:
        raise HTTPException(status_code=404, detail="Item not found")
    
    item = unit or component
    item_type = "unit" if unit else "component"
    
    # Get chain of custody records
    custody_records = await db.chain_custody.find(
        {"unit_id": item["id"]},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(1000)
    
    # Get related records
    audit_trail = []
    
    # Add creation event
    audit_trail.append({
        "type": "created",
        "timestamp": item.get("created_at") if isinstance(item.get("created_at"), str) else item.get("created_at", "").isoformat() if item.get("created_at") else None,
        "description": f"{item_type.capitalize()} created",
        "user": item.get("created_by") or item.get("processed_by"),
        "details": {
            "item_id": item.get("unit_id") or item.get("component_id"),
            "status": "collected" if item_type == "unit" else "processing",
        }
    })
    
    # Add custody records
    for record in custody_records:
        audit_trail.append({
            "type": "custody",
            "timestamp": record.get("timestamp"),
            "description": record.get("stage"),
            "user": record.get("giver_id"),
            "details": {
                "from": record.get("from_location"),
                "to": record.get("to_location"),
                "reason": record.get("reason"),
                "notes": record.get("notes"),
            }
        })
    
    # Sort by timestamp
    audit_trail.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
    
    return {
        "item": item,
        "item_type": item_type,
        "audit_trail": audit_trail,
        "total_events": len(audit_trail),
    }
