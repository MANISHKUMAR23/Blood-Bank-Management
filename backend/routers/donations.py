from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone

import sys
sys.path.append('..')

from database import db
from models import Donation, DonationCreate, BloodUnit, UnitStatus
from services import (
    get_current_user, generate_donation_id, generate_unit_id, generate_barcode_base64
)

router = APIRouter(prefix="/donations", tags=["Donations"])

@router.post("")
async def create_donation(donation_data: DonationCreate, current_user: dict = Depends(get_current_user)):
    screening = await db.screenings.find_one({"id": donation_data.screening_id}, {"_id": 0})
    if not screening:
        raise HTTPException(status_code=404, detail="Screening not found")
    if screening["eligibility_status"] != "eligible":
        raise HTTPException(status_code=400, detail="Donor not eligible for donation")
    
    donation = Donation(**donation_data.model_dump())
    donation.donation_id = await generate_donation_id()
    donation.phlebotomist_id = current_user["id"]
    
    doc = donation.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.donations.insert_one(doc)
    return {"status": "success", "donation_id": donation.donation_id, "id": donation.id}

@router.put("/{donation_id}/complete")
async def complete_donation(
    donation_id: str,
    volume: float,
    adverse_reaction: bool = False,
    adverse_reaction_details: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    donation = await db.donations.find_one(
        {"$or": [{"id": donation_id}, {"donation_id": donation_id}]},
        {"_id": 0}
    )
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    
    update_data = {
        "collection_end_time": datetime.now(timezone.utc).isoformat(),
        "volume_collected": volume,
        "adverse_reaction": adverse_reaction,
        "adverse_reaction_details": adverse_reaction_details,
        "status": "completed"
    }
    
    await db.donations.update_one(
        {"$or": [{"id": donation_id}, {"donation_id": donation_id}]},
        {"$set": update_data}
    )
    
    donor = await db.donors.find_one({"id": donation["donor_id"]}, {"_id": 0})
    if donor:
        await db.donors.update_one(
            {"id": donation["donor_id"]},
            {
                "$set": {
                    "last_donation_date": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                },
                "$inc": {"total_donations": 1}
            }
        )
    
    unit_id = await generate_unit_id()
    screening = await db.screenings.find_one({"id": donation["screening_id"]}, {"_id": 0})
    
    blood_unit = BloodUnit(
        unit_id=unit_id,
        donor_id=donation["donor_id"],
        donation_id=donation["id"],
        bag_barcode=generate_barcode_base64(unit_id),
        sample_labels=[f"{unit_id}-S1", f"{unit_id}-S2"],
        blood_group=screening.get("preliminary_blood_group") if screening else None,
        collection_date=datetime.now(timezone.utc).isoformat().split("T")[0],
        volume=volume,
        created_by=current_user["id"]
    )
    
    unit_doc = blood_unit.model_dump()
    unit_doc['created_at'] = unit_doc['created_at'].isoformat()
    unit_doc['updated_at'] = unit_doc['updated_at'].isoformat()
    
    await db.blood_units.insert_one(unit_doc)
    
    return {
        "status": "success",
        "unit_id": unit_id,
        "barcode": blood_unit.bag_barcode
    }

@router.get("")
async def get_donations(
    donor_id: Optional[str] = None,
    date: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if donor_id:
        query["donor_id"] = donor_id
    if date:
        query["collection_start_time"] = {"$regex": f"^{date}"}
    if status:
        query["status"] = status
    
    donations = await db.donations.find(query, {"_id": 0}).to_list(1000)
    return donations


@router.get("/eligible-donors")
async def get_eligible_donors_for_collection(
    current_user: dict = Depends(get_current_user)
):
    """Get all eligible donors who have passed screening but haven't donated yet"""
    
    # Get all eligible screenings
    eligible_screenings = await db.screenings.find(
        {"eligibility_status": "eligible"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    eligible_donors = []
    seen_donor_ids = set()
    
    for screening in eligible_screenings:
        donor_id = screening.get("donor_id")
        
        # Skip if we've already processed this donor
        if donor_id in seen_donor_ids:
            continue
        
        # Check if there's a donation for this screening
        donation = await db.donations.find_one({
            "screening_id": screening.get("id"),
            "status": "completed"
        })
        
        if donation:
            seen_donor_ids.add(donor_id)
            continue
        
        # Check if there's an active/in-progress donation
        active_donation = await db.donations.find_one({
            "screening_id": screening.get("id"),
            "status": {"$in": ["in_progress", "started"]}
        })
        
        # Get donor info
        donor = await db.donors.find_one({"id": donor_id}, {"_id": 0})
        if not donor:
            continue
        
        seen_donor_ids.add(donor_id)
        
        eligible_donors.append({
            "id": donor.get("id"),
            "donor_id": donor.get("donor_id"),
            "full_name": donor.get("full_name"),
            "blood_group": donor.get("blood_group") or screening.get("preliminary_blood_group"),
            "phone": donor.get("phone"),
            "screening_id": screening.get("id"),
            "screening_date": screening.get("screening_date"),
            "hemoglobin": screening.get("hemoglobin"),
            "has_active_donation": active_donation is not None,
            "active_donation_id": active_donation.get("id") if active_donation else None,
        })
    
    return eligible_donors


@router.get("/today/summary")
async def get_today_collection_summary(
    current_user: dict = Depends(get_current_user)
):
    """Get summary of today's collections"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Count today's donations
    today_donations = await db.donations.find({
        "collection_start_time": {"$regex": f"^{today}"}
    }, {"_id": 0}).to_list(1000)
    
    completed = sum(1 for d in today_donations if d.get("status") == "completed")
    in_progress = sum(1 for d in today_donations if d.get("status") in ["in_progress", "started"])
    total_volume = sum(d.get("volume_collected", 0) for d in today_donations if d.get("status") == "completed")
    adverse_reactions = sum(1 for d in today_donations if d.get("adverse_reaction"))
    
    return {
        "date": today,
        "total": len(today_donations),
        "completed": completed,
        "in_progress": in_progress,
        "total_volume": total_volume,
        "adverse_reactions": adverse_reactions,
    }


@router.get("/today")
async def get_today_donations(
    current_user: dict = Depends(get_current_user)
):
    """Get all donations for today with donor info"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    donations = await db.donations.find({
        "collection_start_time": {"$regex": f"^{today}"}
    }, {"_id": 0}).sort("collection_start_time", -1).to_list(1000)
    
    # Enrich with donor info
    for donation in donations:
        donor = await db.donors.find_one({"id": donation.get("donor_id")}, {"_id": 0, "full_name": 1, "donor_id": 1, "blood_group": 1})
        if donor:
            donation["donor_name"] = donor.get("full_name")
            donation["donor_code"] = donor.get("donor_id")
            donation["blood_group"] = donor.get("blood_group")
    
    return donations
