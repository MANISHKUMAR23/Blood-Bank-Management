from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPAuthorizationCredentials
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import os
import uuid
import base64

import sys
sys.path.append('..')

from database import db
from models import (
    Donor, DonorCreate, DonorRequest, DonorRequestCreate, DonorOTP,
    DonorRequestStatus, DonorRequestType, DonorStatus
)
from services import (
    get_current_user, security, decode_token, create_token,
    generate_donor_id, generate_donor_request_id, generate_qr_base64, generate_otp
)

router = APIRouter(tags=["Donors"])

# File upload directory
UPLOAD_DIR = "/app/uploads/donors"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ==================== FILE UPLOAD ROUTES ====================
@router.post("/donors/upload")
async def upload_donor_file(
    file: UploadFile = File(...),
    file_type: str = Form(...),  # photo, id_proof, medical_report
    current_user: dict = Depends(get_current_user)
):
    """Upload a file for donor registration"""
    allowed_types = ["photo", "id_proof", "medical_report"]
    if file_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"File type must be one of: {allowed_types}")
    
    # Validate file extension
    allowed_extensions = [".jpg", ".jpeg", ".png", ".pdf"]
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"File extension must be one of: {allowed_extensions}")
    
    # Limit file size (5MB)
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be less than 5MB")
    
    # Generate unique filename
    unique_id = str(uuid.uuid4())[:8]
    filename = f"{file_type}_{unique_id}{file_ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    # Save file
    with open(filepath, "wb") as f:
        f.write(contents)
    
    # Return the URL path
    file_url = f"/uploads/donors/{filename}"
    
    return {
        "status": "success",
        "file_url": file_url,
        "file_type": file_type,
        "filename": filename
    }

@router.post("/donors/upload-base64")
async def upload_donor_file_base64(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Upload a file as base64 for donor registration"""
    file_type = data.get("file_type")
    file_data = data.get("file_data")
    file_ext = data.get("file_ext", ".jpg")
    
    allowed_types = ["photo", "id_proof", "medical_report"]
    if file_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"File type must be one of: {allowed_types}")
    
    if not file_data:
        raise HTTPException(status_code=400, detail="file_data is required")
    
    # Decode base64
    try:
        # Remove data URL prefix if present
        if "," in file_data:
            file_data = file_data.split(",")[1]
        contents = base64.b64decode(file_data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 data")
    
    # Limit file size (5MB)
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be less than 5MB")
    
    # Generate unique filename
    unique_id = str(uuid.uuid4())[:8]
    filename = f"{file_type}_{unique_id}{file_ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    # Save file
    with open(filepath, "wb") as f:
        f.write(contents)
    
    # Return the URL path
    file_url = f"/uploads/donors/{filename}"
    
    return {
        "status": "success",
        "file_url": file_url,
        "file_type": file_type,
        "filename": filename
    }

# ==================== PUBLIC DONOR ROUTES ====================
@router.post("/public/donor-register")
async def public_donor_register(data: DonorRequestCreate):
    if not data.consent_given:
        raise HTTPException(status_code=400, detail="Consent is required for registration")
    
    existing_request = await db.donor_requests.find_one({
        "identity_type": data.identity_type,
        "identity_number": data.identity_number,
        "status": "pending"
    })
    if existing_request:
        raise HTTPException(status_code=400, detail="A registration request with this ID is already pending")
    
    existing_donor = await db.donors.find_one({
        "identity_type": data.identity_type,
        "identity_number": data.identity_number
    })
    if existing_donor:
        raise HTTPException(status_code=400, detail="Donor with this identity already exists. Please use donor login.")
    
    request = DonorRequest(
        identity_type=data.identity_type,
        identity_number=data.identity_number,
        full_name=data.full_name,
        date_of_birth=data.date_of_birth,
        gender=data.gender,
        weight=data.weight,
        phone=data.phone,
        email=data.email,
        address=data.address,
        id_proof_image=data.id_proof_image,
        consent_given=data.consent_given,
        request_type=DonorRequestType.NEW_REGISTRATION,
        status=DonorRequestStatus.PENDING
    )
    request.request_id = await generate_donor_request_id()
    
    doc = request.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    if doc.get('reviewed_at'):
        doc['reviewed_at'] = doc['reviewed_at'].isoformat()
    
    await db.donor_requests.insert_one(doc)
    
    return {
        "status": "success",
        "message": "Registration request submitted successfully. Please wait for staff approval.",
        "request_id": request.request_id,
        "id": request.id
    }

@router.get("/public/donor-status/{identity_type}/{identity_number}")
async def check_donor_status(identity_type: str, identity_number: str):
    donor = await db.donors.find_one({
        "identity_type": identity_type,
        "identity_number": identity_number
    }, {"_id": 0, "qr_code": 0})
    
    if donor:
        return {
            "status": "approved",
            "is_donor": True,
            "donor_id": donor.get("donor_id"),
            "full_name": donor.get("full_name"),
            "message": "You are a registered donor. Please login to access your profile."
        }
    
    request = await db.donor_requests.find_one({
        "identity_type": identity_type,
        "identity_number": identity_number
    }, {"_id": 0, "id_proof_image": 0})
    
    if request:
        return {
            "status": request.get("status"),
            "is_donor": False,
            "request_id": request.get("request_id"),
            "full_name": request.get("full_name"),
            "rejection_reason": request.get("rejection_reason") if request.get("status") == "rejected" else None,
            "message": "Pending Approval" if request.get("status") == "pending" else "Registration rejected"
        }
    
    return {
        "status": "not_found",
        "is_donor": False,
        "message": "No registration found. Please register first."
    }

@router.post("/public/donor-login/request-otp")
async def request_donor_otp(
    donor_id: Optional[str] = None,
    identity_type: Optional[str] = None,
    identity_number: Optional[str] = None,
    date_of_birth: Optional[str] = None
):
    donor = None
    
    if donor_id:
        donor = await db.donors.find_one({"donor_id": donor_id}, {"_id": 0})
    elif identity_type and identity_number and date_of_birth:
        donor = await db.donors.find_one({
            "identity_type": identity_type,
            "identity_number": identity_number,
            "date_of_birth": date_of_birth
        }, {"_id": 0})
    
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found. Please check your details or register first.")
    
    otp = generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    otp_record = DonorOTP(
        donor_id=donor["id"],
        otp=otp,
        expires_at=expires_at
    )
    
    doc = otp_record.model_dump()
    doc['expires_at'] = doc['expires_at'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.donor_otps.insert_one(doc)
    
    return {
        "status": "success",
        "message": f"OTP sent to registered phone number ending in ***{donor.get('phone', '')[-4:]}",
        "otp_for_demo": otp,
        "donor_id": donor["donor_id"],
        "expires_in_minutes": 10
    }

@router.post("/public/donor-login/verify-otp")
async def verify_donor_otp(donor_id: str, otp: str):
    donor = await db.donors.find_one({"donor_id": donor_id}, {"_id": 0})
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")
    
    otp_record = await db.donor_otps.find_one({
        "donor_id": donor["id"],
        "otp": otp,
        "used": False
    }, {"_id": 0})
    
    if not otp_record:
        raise HTTPException(status_code=401, detail="Invalid OTP")
    
    expires_at = datetime.fromisoformat(otp_record["expires_at"].replace('Z', '+00:00'))
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="OTP expired")
    
    await db.donor_otps.update_one({"id": otp_record["id"]}, {"$set": {"used": True}})
    
    token = create_token(donor["id"], "donor")
    
    return {
        "status": "success",
        "token": token,
        "donor": {
            "id": donor["id"],
            "donor_id": donor["donor_id"],
            "full_name": donor["full_name"],
            "blood_group": donor.get("blood_group")
        }
    }

@router.get("/public/donor-profile")
async def get_donor_profile(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = decode_token(credentials.credentials)
    donor = await db.donors.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not donor:
        raise HTTPException(status_code=404, detail="Donor profile not found")
    
    donations = await db.donations.find({"donor_id": donor["id"]}, {"_id": 0}).to_list(100)
    
    return {
        "donor": donor,
        "donations": donations
    }

# ==================== STAFF DONOR REQUEST ROUTES ====================
@router.get("/donor-requests")
async def get_donor_requests(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status
    
    requests = await db.donor_requests.find(query, {"_id": 0, "id_proof_image": 0}).to_list(1000)
    return requests

@router.get("/donor-requests/{request_id}")
async def get_donor_request(request_id: str, current_user: dict = Depends(get_current_user)):
    request = await db.donor_requests.find_one(
        {"$or": [{"id": request_id}, {"request_id": request_id}]},
        {"_id": 0}
    )
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    return request

@router.post("/donor-requests/{request_id}/check-duplicate")
async def check_duplicate_donor(request_id: str, current_user: dict = Depends(get_current_user)):
    request = await db.donor_requests.find_one(
        {"$or": [{"id": request_id}, {"request_id": request_id}]},
        {"_id": 0}
    )
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    existing_donor = await db.donors.find_one({
        "identity_type": request["identity_type"],
        "identity_number": request["identity_number"]
    }, {"_id": 0, "qr_code": 0})
    
    return {
        "is_duplicate": existing_donor is not None,
        "existing_donor": existing_donor
    }

@router.post("/donor-requests/{request_id}/approve")
async def approve_donor_request(request_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "registration"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    request = await db.donor_requests.find_one(
        {"$or": [{"id": request_id}, {"request_id": request_id}]},
        {"_id": 0}
    )
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")
    
    existing_donor = await db.donors.find_one({
        "identity_type": request["identity_type"],
        "identity_number": request["identity_number"]
    })
    if existing_donor:
        raise HTTPException(status_code=400, detail="Donor with this identity already exists")
    
    donor_id = await generate_donor_id()
    qr_code = generate_qr_base64(donor_id)
    
    donor = Donor(
        donor_id=donor_id,
        full_name=request["full_name"],
        date_of_birth=request["date_of_birth"],
        gender=request["gender"],
        phone=request["phone"],
        email=request.get("email"),
        address=request["address"],
        identity_type=request["identity_type"],
        identity_number=request["identity_number"],
        status=DonorStatus.ACTIVE,
        consent_given=request["consent_given"],
        registration_channel="online",
        qr_code=qr_code,
        created_by=current_user["id"]
    )
    
    donor_doc = donor.model_dump()
    donor_doc['created_at'] = donor_doc['created_at'].isoformat()
    donor_doc['updated_at'] = donor_doc['updated_at'].isoformat()
    
    await db.donors.insert_one(donor_doc)
    
    await db.donor_requests.update_one(
        {"$or": [{"id": request_id}, {"request_id": request_id}]},
        {
            "$set": {
                "status": "approved",
                "donor_id": donor_id,
                "reviewed_by": current_user["id"],
                "reviewed_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "status": "success",
        "message": "Donor registration approved",
        "donor_id": donor_id,
        "donor_internal_id": donor.id
    }

@router.post("/donor-requests/{request_id}/reject")
async def reject_donor_request(
    request_id: str,
    rejection_reason: str,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] not in ["admin", "registration"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    if not rejection_reason or not rejection_reason.strip():
        raise HTTPException(status_code=400, detail="Rejection reason is required")
    
    request = await db.donor_requests.find_one(
        {"$or": [{"id": request_id}, {"request_id": request_id}]},
        {"_id": 0}
    )
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")
    
    await db.donor_requests.update_one(
        {"$or": [{"id": request_id}, {"request_id": request_id}]},
        {
            "$set": {
                "status": "rejected",
                "rejection_reason": rejection_reason,
                "reviewed_by": current_user["id"],
                "reviewed_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"status": "success", "message": "Registration request rejected"}

# ==================== STAFF DONOR MANAGEMENT ROUTES ====================
@router.post("/donors")
async def create_donor(donor_data: DonorCreate, current_user: dict = Depends(get_current_user)):
    existing = await db.donors.find_one({
        "identity_type": donor_data.identity_type,
        "identity_number": donor_data.identity_number
    })
    if existing:
        raise HTTPException(status_code=400, detail="Donor with this identity already exists")
    
    donor = Donor(**donor_data.model_dump())
    donor.donor_id = await generate_donor_id()
    donor.qr_code = generate_qr_base64(donor.donor_id)
    donor.created_by = current_user["id"]
    
    doc = donor.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.donors.insert_one(doc)
    return {"status": "success", "donor_id": donor.donor_id, "id": donor.id}

@router.get("/donors")
async def get_donors(
    search: Optional[str] = None,
    status: Optional[str] = None,
    blood_group: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status
    if blood_group:
        query["blood_group"] = blood_group
    if search:
        query["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"donor_id": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
    
    donors = await db.donors.find(query, {"_id": 0}).to_list(1000)
    return donors

@router.get("/donors/{donor_id}")
async def get_donor(donor_id: str, current_user: dict = Depends(get_current_user)):
    donor = await db.donors.find_one(
        {"$or": [{"id": donor_id}, {"donor_id": donor_id}]},
        {"_id": 0}
    )
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")
    return donor

@router.put("/donors/{donor_id}")
async def update_donor(donor_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    updates["updated_by"] = current_user["id"]
    
    result = await db.donors.update_one(
        {"$or": [{"id": donor_id}, {"donor_id": donor_id}]},
        {"$set": updates}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Donor not found")
    return {"status": "success"}

@router.get("/donors/{donor_id}/eligibility")
async def check_donor_eligibility(donor_id: str, current_user: dict = Depends(get_current_user)):
    donor = await db.donors.find_one(
        {"$or": [{"id": donor_id}, {"donor_id": donor_id}]},
        {"_id": 0}
    )
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")
    
    issues = []
    eligible = True
    
    if donor.get("status") == "deferred_permanent":
        issues.append("Donor is permanently deferred")
        eligible = False
    elif donor.get("status") == "deferred_temporary":
        if donor.get("deferral_end_date"):
            end_date = datetime.fromisoformat(donor["deferral_end_date"])
            if end_date > datetime.now(timezone.utc):
                issues.append(f"Donor is deferred until {donor['deferral_end_date']}")
                eligible = False
    
    if donor.get("last_donation_date"):
        last_donation = datetime.fromisoformat(donor["last_donation_date"])
        days_since = (datetime.now(timezone.utc) - last_donation).days
        if days_since < 56:
            issues.append(f"Only {days_since} days since last donation. Minimum 56 days required.")
            eligible = False
    
    return {
        "eligible": eligible,
        "issues": issues,
        "donor_status": donor.get("status"),
        "total_donations": donor.get("total_donations", 0),
        "last_donation_date": donor.get("last_donation_date")
    }

@router.get("/donors/{donor_id}/history")
async def get_donor_history(donor_id: str, current_user: dict = Depends(get_current_user)):
    donor = await db.donors.find_one(
        {"$or": [{"id": donor_id}, {"donor_id": donor_id}]},
        {"_id": 0}
    )
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")
    
    donations = await db.donations.find({"donor_id": donor["id"]}, {"_id": 0}).to_list(100)
    screenings = await db.screenings.find({"donor_id": donor["id"]}, {"_id": 0}).to_list(100)
    
    return {
        "donor": donor,
        "donations": donations,
        "screenings": screenings
    }
