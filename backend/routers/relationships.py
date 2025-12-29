"""
Component-Unit Relationship API
Provides visual relationship data between blood units and their derived components
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from datetime import datetime, timezone

import sys
sys.path.append('..')

from database import db
from services import get_current_user

router = APIRouter(prefix="/relationships", tags=["Component Relationships"])

@router.get("/unit/{unit_id}")
async def get_unit_relationships(
    unit_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a blood unit and all its derived components"""
    # Find the blood unit
    unit = await db.blood_units.find_one(
        {"$or": [{"id": unit_id}, {"unit_id": unit_id}]},
        {"_id": 0}
    )
    
    if not unit:
        raise HTTPException(status_code=404, detail="Blood unit not found")
    
    # Get all components derived from this unit
    components = await db.components.find(
        {"parent_unit_id": unit["id"]},
        {"_id": 0}
    ).to_list(100)
    
    # Get donation info
    donation = None
    if unit.get("donation_id"):
        donation = await db.donations.find_one(
            {"id": unit["donation_id"]},
            {"_id": 0, "donation_date": 1, "phlebotomist": 1, "volume_collected": 1}
        )
    
    # Get donor info (anonymized)
    donor = None
    if unit.get("donor_id"):
        donor = await db.donors.find_one(
            {"id": unit["donor_id"]},
            {"_id": 0, "donor_id": 1, "blood_group": 1}
        )
    
    # Get lab results
    lab_test = await db.lab_tests.find_one(
        {"unit_id": unit["id"]},
        {"_id": 0}
    )
    
    # Calculate total volume of components
    total_component_volume = sum(c.get("volume", 0) for c in components)
    
    # Build relationship tree
    relationship = {
        "parent_unit": {
            **unit,
            "node_type": "unit",
            "display_id": unit.get("unit_id"),
            "donation_info": donation,
            "donor_info": {
                "donor_id": donor.get("donor_id") if donor else None,
                "blood_group": donor.get("blood_group") if donor else unit.get("blood_group"),
            } if donor else None,
            "lab_result": {
                "overall_result": lab_test.get("overall_result") if lab_test else None,
                "tested_at": lab_test.get("completed_at") if lab_test else None,
            } if lab_test else None,
        },
        "components": [
            {
                **comp,
                "node_type": "component",
                "display_id": comp.get("component_id"),
                "parent_display_id": unit.get("unit_id"),
            }
            for comp in components
        ],
        "summary": {
            "total_components": len(components),
            "parent_volume": unit.get("volume", 450),
            "total_component_volume": total_component_volume,
            "component_types": list(set(c.get("component_type") for c in components)),
            "statuses": {
                "available": len([c for c in components if c.get("status") == "ready_to_use"]),
                "reserved": len([c for c in components if c.get("status") == "reserved"]),
                "quarantine": len([c for c in components if c.get("status") == "quarantine"]),
                "issued": len([c for c in components if c.get("status") == "issued"]),
                "discarded": len([c for c in components if c.get("status") == "discarded"]),
            }
        }
    }
    
    return relationship


@router.get("/component/{component_id}")
async def get_component_relationships(
    component_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a component, its parent unit, and sibling components"""
    # Find the component
    component = await db.components.find_one(
        {"$or": [{"id": component_id}, {"component_id": component_id}]},
        {"_id": 0}
    )
    
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    
    # Get parent unit
    parent_unit = None
    if component.get("parent_unit_id"):
        parent_unit = await db.blood_units.find_one(
            {"id": component["parent_unit_id"]},
            {"_id": 0}
        )
    
    if not parent_unit:
        return {
            "component": {
                **component,
                "node_type": "component",
                "display_id": component.get("component_id"),
            },
            "parent_unit": None,
            "siblings": [],
            "summary": {
                "total_siblings": 0,
            }
        }
    
    # Get sibling components (same parent)
    siblings = await db.components.find(
        {
            "parent_unit_id": parent_unit["id"],
            "id": {"$ne": component["id"]}
        },
        {"_id": 0}
    ).to_list(100)
    
    # Get full relationship from parent
    full_relationship = await get_unit_relationships(parent_unit["id"], current_user)
    
    # Mark the current component
    full_relationship["current_component_id"] = component["id"]
    full_relationship["current_component"] = {
        **component,
        "node_type": "component",
        "display_id": component.get("component_id"),
        "is_current": True,
    }
    
    return full_relationship


@router.get("/tree/{item_id}")
async def get_relationship_tree(
    item_id: str,
    item_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get relationship tree for any item (auto-detect type)"""
    
    # Try to find as unit first
    unit = await db.blood_units.find_one(
        {"$or": [{"id": item_id}, {"unit_id": item_id}]},
        {"_id": 0}
    )
    
    if unit:
        return await get_unit_relationships(unit["id"], current_user)
    
    # Try to find as component
    component = await db.components.find_one(
        {"$or": [{"id": item_id}, {"component_id": item_id}]},
        {"_id": 0}
    )
    
    if component:
        return await get_component_relationships(component["id"], current_user)
    
    raise HTTPException(status_code=404, detail="Item not found")


@router.get("/batch")
async def get_batch_relationships(
    unit_ids: Optional[str] = None,  # comma-separated
    component_ids: Optional[str] = None,  # comma-separated
    current_user: dict = Depends(get_current_user)
):
    """Get relationships for multiple items"""
    results = []
    
    if unit_ids:
        for uid in unit_ids.split(","):
            try:
                rel = await get_unit_relationships(uid.strip(), current_user)
                results.append(rel)
            except:
                continue
    
    if component_ids:
        for cid in component_ids.split(","):
            try:
                rel = await get_component_relationships(cid.strip(), current_user)
                results.append(rel)
            except:
                continue
    
    return results
