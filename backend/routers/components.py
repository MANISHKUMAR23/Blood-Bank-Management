from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel

import sys
sys.path.append('..')

from database import db
from models import Component, ComponentCreate, UnitStatus, ComponentType
from services import get_current_user, generate_component_id

router = APIRouter(prefix="/components", tags=["Components"])

class MultiComponentCreate(BaseModel):
    parent_unit_id: str
    components: List[dict]  # [{component_type, volume, batch_id?, expiry_days?}]

@router.post("")
async def create_component(component_data: ComponentCreate, current_user: dict = Depends(get_current_user)):
    unit = await db.blood_units.find_one(
        {"$or": [{"id": component_data.parent_unit_id}, {"unit_id": component_data.parent_unit_id}]},
        {"_id": 0}
    )
    if not unit:
        raise HTTPException(status_code=404, detail="Parent blood unit not found")
    
    component = Component(**component_data.model_dump())
    component.component_id = await generate_component_id()
    component.blood_group = unit.get("confirmed_blood_group") or unit.get("blood_group")
    component.processed_by = current_user["id"]
    
    temp_ranges = {
        ComponentType.PRC: (2, 6),
        ComponentType.PLASMA: (-30, -25),
        ComponentType.FFP: (-30, -25),
        ComponentType.PLATELETS: (20, 24),
        ComponentType.CRYOPRECIPITATE: (-30, -25)
    }
    
    if component.component_type in temp_ranges:
        component.storage_temp_min, component.storage_temp_max = temp_ranges[component.component_type]
    
    doc = component.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.components.insert_one(doc)
    
    await db.blood_units.update_one(
        {"$or": [{"id": component_data.parent_unit_id}, {"unit_id": component_data.parent_unit_id}]},
        {"$set": {"status": UnitStatus.PROCESSING.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"status": "success", "component_id": component.component_id, "id": component.id}

@router.post("/multi")
async def create_multiple_components(data: MultiComponentCreate, current_user: dict = Depends(get_current_user)):
    """Create multiple components from a single blood unit (multi-select)"""
    unit = await db.blood_units.find_one(
        {"$or": [{"id": data.parent_unit_id}, {"unit_id": data.parent_unit_id}]},
        {"_id": 0}
    )
    if not unit:
        raise HTTPException(status_code=404, detail="Parent blood unit not found")
    
    # Validate total volume
    total_volume = sum(c.get("volume", 0) for c in data.components)
    if total_volume > unit.get("volume", 450):
        raise HTTPException(
            status_code=400, 
            detail=f"Total component volume ({total_volume}ml) exceeds collected volume ({unit.get('volume', 450)}ml)"
        )
    
    blood_group = unit.get("confirmed_blood_group") or unit.get("blood_group")
    collection_date = datetime.strptime(unit.get("collection_date", datetime.now().strftime("%Y-%m-%d")), "%Y-%m-%d")
    
    temp_ranges = {
        "prc": (2, 6),
        "plasma": (-30, -25),
        "ffp": (-30, -25),
        "platelets": (20, 24),
        "cryoprecipitate": (-30, -25)
    }
    
    expiry_days = {
        "prc": 42,
        "plasma": 365,
        "ffp": 365,
        "platelets": 5,
        "cryoprecipitate": 365
    }
    
    created_components = []
    
    for comp_data in data.components:
        comp_type = comp_data.get("component_type", "prc")
        volume = comp_data.get("volume", 150)
        
        component_id = await generate_component_id()
        expiry = collection_date + timedelta(days=comp_data.get("expiry_days", expiry_days.get(comp_type, 42)))
        
        temp_min, temp_max = temp_ranges.get(comp_type, (2, 6))
        
        component = {
            "id": str(__import__('uuid').uuid4()),
            "component_id": component_id,
            "parent_unit_id": unit["id"],
            "component_type": comp_type,
            "volume": volume,
            "blood_group": blood_group,
            "status": "processing",
            "storage_temp_min": temp_min,
            "storage_temp_max": temp_max,
            "storage_location": comp_data.get("storage_location"),
            "storage_location_id": comp_data.get("storage_location_id"),
            "batch_id": comp_data.get("batch_id"),
            "expiry_date": expiry.strftime("%Y-%m-%d"),
            "qc_values": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "processed_by": current_user["id"]
        }
        
        await db.components.insert_one(component)
        created_components.append({
            "component_id": component_id,
            "component_type": comp_type,
            "volume": volume,
            "blood_group": blood_group,
            "expiry_date": expiry.strftime("%Y-%m-%d")
        })
    
    # Update parent unit status
    await db.blood_units.update_one(
        {"id": unit["id"]},
        {"$set": {
            "status": UnitStatus.PROCESSING.value, 
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "components_created": len(created_components)
        }}
    )
    
    return {
        "status": "success",
        "parent_unit_id": unit.get("unit_id"),
        "components_created": len(created_components),
        "components": created_components,
        "total_volume_processed": total_volume
    }

@router.get("")
async def get_components(
    status: Optional[str] = None,
    component_type: Optional[str] = None,
    blood_group: Optional[str] = None,
    parent_unit_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status
    if component_type:
        query["component_type"] = component_type
    if blood_group:
        query["blood_group"] = blood_group
    if parent_unit_id:
        query["parent_unit_id"] = parent_unit_id
    
    components = await db.components.find(query, {"_id": 0}).to_list(1000)
    return components

@router.get("/{component_id}")
async def get_component(component_id: str, current_user: dict = Depends(get_current_user)):
    component = await db.components.find_one(
        {"$or": [{"id": component_id}, {"component_id": component_id}]},
        {"_id": 0}
    )
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    
    # Get parent unit details
    parent_unit = await db.blood_units.find_one({"id": component["parent_unit_id"]}, {"_id": 0})
    
    # Get sibling components
    siblings = await db.components.find(
        {"parent_unit_id": component["parent_unit_id"], "id": {"$ne": component["id"]}},
        {"_id": 0}
    ).to_list(10)
    
    # Get donor info if available
    donor = None
    if parent_unit and parent_unit.get("donor_id"):
        donor = await db.donors.find_one({"id": parent_unit["donor_id"]}, {"_id": 0, "qr_code": 0})
    
    return {
        "component": component,
        "parent_unit": parent_unit,
        "sibling_components": siblings,
        "donor": donor
    }

@router.put("/{component_id}")
async def update_component(component_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    result = await db.components.update_one(
        {"$or": [{"id": component_id}, {"component_id": component_id}]},
        {"$set": updates}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Component not found")
    return {"status": "success"}

