from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from enum import Enum
import barcode
from barcode.writer import ImageWriter
import qrcode
import io
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'bloodbank-secret-key-2024')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# Create the main app without a prefix
app = FastAPI(title="Blood Bank Management System API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== ENUMS ====================
class UserRole(str, Enum):
    ADMIN = "admin"
    REGISTRATION = "registration"
    PHLEBOTOMIST = "phlebotomist"
    LAB_TECH = "lab_tech"
    PROCESSING = "processing"
    QC_MANAGER = "qc_manager"
    INVENTORY = "inventory"
    DISTRIBUTION = "distribution"

class DonorStatus(str, Enum):
    ACTIVE = "active"
    DEFERRED_TEMPORARY = "deferred_temporary"
    DEFERRED_PERMANENT = "deferred_permanent"

class BloodGroup(str, Enum):
    A_POSITIVE = "A+"
    A_NEGATIVE = "A-"
    B_POSITIVE = "B+"
    B_NEGATIVE = "B-"
    AB_POSITIVE = "AB+"
    AB_NEGATIVE = "AB-"
    O_POSITIVE = "O+"
    O_NEGATIVE = "O-"

class DonationType(str, Enum):
    WHOLE_BLOOD = "whole_blood"
    APHERESIS = "apheresis"

class UnitStatus(str, Enum):
    COLLECTED = "collected"
    LAB = "lab"
    PROCESSING = "processing"
    QUARANTINE = "quarantine"
    HOLD = "hold"
    READY_TO_USE = "ready_to_use"
    RESERVED = "reserved"
    ISSUED = "issued"
    RETURNED = "returned"
    DISCARDED = "discarded"

class ScreeningResult(str, Enum):
    NON_REACTIVE = "non_reactive"
    GRAY = "gray"
    REACTIVE = "reactive"

class ComponentType(str, Enum):
    WHOLE_BLOOD = "whole_blood"
    PRC = "prc"  # Packed Red Cells
    PLASMA = "plasma"
    FFP = "ffp"  # Fresh Frozen Plasma
    PLATELETS = "platelets"
    CRYOPRECIPITATE = "cryoprecipitate"

class RequestStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    FULFILLED = "fulfilled"
    REJECTED = "rejected"

class RequestType(str, Enum):
    INTERNAL = "internal"
    EXTERNAL = "external"

class DiscardReason(str, Enum):
    EXPIRED = "expired"
    FAILED_QC = "failed_qc"
    REJECTED_RETURN = "rejected_return"
    REACTIVE = "reactive"
    DAMAGED = "damaged"
    OTHER = "other"

class DonorRequestStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class DonorRequestType(str, Enum):
    NEW_REGISTRATION = "new_registration"
    UPDATE = "update"

# ==================== MODELS ====================
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    password_hash: str
    full_name: str
    role: UserRole
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    role: UserRole

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: UserRole
    is_active: bool

class Donor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    donor_id: str = ""  # Auto-generated unique ID like "D-2024-0001"
    full_name: str
    date_of_birth: str
    gender: str
    blood_group: Optional[BloodGroup] = None
    phone: str
    email: Optional[str] = None
    address: str
    identity_type: str  # Aadhar, Passport, etc.
    identity_number: str
    status: DonorStatus = DonorStatus.ACTIVE
    deferral_end_date: Optional[str] = None
    deferral_reason: Optional[str] = None
    consent_given: bool = False
    registration_channel: str = "on_site"  # on_site, online
    qr_code: Optional[str] = None
    total_donations: int = 0
    last_donation_date: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None

class DonorCreate(BaseModel):
    full_name: str
    date_of_birth: str
    gender: str
    blood_group: Optional[BloodGroup] = None
    phone: str
    email: Optional[str] = None
    address: str
    identity_type: str
    identity_number: str
    consent_given: bool = False
    registration_channel: str = "on_site"

class Screening(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    donor_id: str
    screening_date: str
    weight: float
    height: float
    blood_pressure_systolic: int
    blood_pressure_diastolic: int
    pulse: int
    temperature: float
    hemoglobin: float
    preliminary_blood_group: Optional[BloodGroup] = None
    questionnaire_passed: bool = False
    eligibility_status: str = "pending"  # eligible, ineligible, pending
    rejection_reason: Optional[str] = None
    screened_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ScreeningCreate(BaseModel):
    donor_id: str
    screening_date: str
    weight: float
    height: float
    blood_pressure_systolic: int
    blood_pressure_diastolic: int
    pulse: int
    temperature: float
    hemoglobin: float
    preliminary_blood_group: Optional[BloodGroup] = None
    questionnaire_passed: bool = False

class Donation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    donation_id: str = ""  # Auto-generated
    donor_id: str
    screening_id: str
    donation_type: DonationType
    collection_start_time: str
    collection_end_time: Optional[str] = None
    volume_collected: Optional[float] = None
    adverse_reaction: bool = False
    adverse_reaction_details: Optional[str] = None
    phlebotomist_id: Optional[str] = None
    status: str = "in_progress"  # in_progress, completed, aborted
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DonationCreate(BaseModel):
    donor_id: str
    screening_id: str
    donation_type: DonationType
    collection_start_time: str

class BloodUnit(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    unit_id: str = ""  # Auto-generated
    donor_id: str
    donation_id: str
    bag_barcode: str = ""
    sample_labels: List[str] = []
    blood_group: Optional[BloodGroup] = None
    confirmed_blood_group: Optional[BloodGroup] = None
    blood_group_verified_by: Optional[List[str]] = None
    status: UnitStatus = UnitStatus.COLLECTED
    current_location: str = "collection"
    storage_location: Optional[str] = None
    collection_date: str
    expiry_date: Optional[str] = None
    volume: float = 450.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChainOfCustody(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    unit_id: str
    stage: str  # collection, lab, processing, storage, issue
    from_location: str
    to_location: str
    giver_id: str
    receiver_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    confirmed: bool = False
    notes: Optional[str] = None

class ChainOfCustodyCreate(BaseModel):
    unit_id: str
    stage: str
    from_location: str
    to_location: str
    giver_id: str
    receiver_id: str
    notes: Optional[str] = None

class LabTest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    unit_id: str
    confirmed_blood_group: Optional[BloodGroup] = None
    verified_by_1: Optional[str] = None
    verified_by_2: Optional[str] = None
    hiv_result: Optional[ScreeningResult] = None
    hbsag_result: Optional[ScreeningResult] = None
    hcv_result: Optional[ScreeningResult] = None
    syphilis_result: Optional[ScreeningResult] = None
    test_method: str = "ELISA"  # ELISA, CLIA, NAT
    overall_status: Optional[str] = None  # reactive, non_reactive, gray, pending
    tested_by: Optional[str] = None
    test_date: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LabTestCreate(BaseModel):
    unit_id: str
    confirmed_blood_group: Optional[BloodGroup] = None
    verified_by_1: Optional[str] = None
    verified_by_2: Optional[str] = None
    hiv_result: Optional[ScreeningResult] = None
    hbsag_result: Optional[ScreeningResult] = None
    hcv_result: Optional[ScreeningResult] = None
    syphilis_result: Optional[ScreeningResult] = None
    test_method: str = "ELISA"
    test_date: str

class Component(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    component_id: str = ""
    parent_unit_id: str
    component_type: ComponentType
    volume: float
    blood_group: Optional[BloodGroup] = None
    status: UnitStatus = UnitStatus.PROCESSING
    storage_temp_min: Optional[float] = None
    storage_temp_max: Optional[float] = None
    storage_location: Optional[str] = None
    batch_id: Optional[str] = None
    expiry_date: Optional[str] = None
    qc_values: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processed_by: Optional[str] = None

class ComponentCreate(BaseModel):
    parent_unit_id: str
    component_type: ComponentType
    volume: float
    storage_temp_min: Optional[float] = None
    storage_temp_max: Optional[float] = None
    storage_location: Optional[str] = None
    batch_id: Optional[str] = None
    expiry_date: Optional[str] = None

class Quarantine(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    unit_component_id: str
    unit_type: str  # unit, component
    reason: str
    retest_result: Optional[ScreeningResult] = None
    disposition: Optional[str] = None  # release, discard
    quarantine_date: str
    resolved_date: Optional[str] = None
    resolved_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class QCValidation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    unit_component_id: str
    unit_type: str  # unit, component
    data_complete: bool = False
    screening_complete: bool = False
    custody_complete: bool = False
    status: str = "pending"  # approved, hold, pending
    hold_reason: Optional[str] = None
    approved_by: Optional[str] = None
    approval_timestamp: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class QCValidationCreate(BaseModel):
    unit_component_id: str
    unit_type: str
    data_complete: bool = False
    screening_complete: bool = False
    custody_complete: bool = False

class BloodRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    request_id: str = ""
    request_type: RequestType
    requester_name: str
    requester_contact: str
    hospital_name: Optional[str] = None
    patient_name: Optional[str] = None
    patient_id: Optional[str] = None
    blood_group: BloodGroup
    product_type: ComponentType
    quantity: int
    urgency: str = "normal"  # normal, urgent, emergency
    status: RequestStatus = RequestStatus.PENDING
    requested_date: str
    required_by_date: Optional[str] = None
    approved_by: Optional[str] = None
    approval_date: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BloodRequestCreate(BaseModel):
    request_type: RequestType
    requester_name: str
    requester_contact: str
    hospital_name: Optional[str] = None
    patient_name: Optional[str] = None
    patient_id: Optional[str] = None
    blood_group: BloodGroup
    product_type: ComponentType
    quantity: int
    urgency: str = "normal"
    requested_date: str
    required_by_date: Optional[str] = None
    notes: Optional[str] = None

class Issuance(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    issue_id: str = ""
    request_id: str
    component_ids: List[str]
    pick_timestamp: Optional[str] = None
    pack_timestamp: Optional[str] = None
    ship_timestamp: Optional[str] = None
    received_by: Optional[str] = None
    issued_by: Optional[str] = None
    status: str = "picking"  # picking, packing, shipped, delivered
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Return(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    return_id: str = ""
    component_id: str
    return_date: str
    source: str  # internal, external
    reason: str
    qc_pass: Optional[bool] = None
    decision: Optional[str] = None  # accept, reject
    processed_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Discard(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    discard_id: str = ""
    component_id: str
    reason: DiscardReason
    reason_details: Optional[str] = None
    discard_date: str
    destruction_date: Optional[str] = None
    approved_by: Optional[str] = None
    processed_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== HELPER FUNCTIONS ====================
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = decode_token(credentials.credentials)
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def generate_barcode_base64(data: str) -> str:
    """Generate Code128 barcode and return as base64 string"""
    try:
        CODE128 = barcode.get_barcode_class('code128')
        code = CODE128(data, writer=ImageWriter())
        buffer = io.BytesIO()
        code.write(buffer)
        return base64.b64encode(buffer.getvalue()).decode('utf-8')
    except Exception as e:
        logger.error(f"Barcode generation error: {e}")
        return ""

def generate_qr_base64(data: str) -> str:
    """Generate QR code and return as base64 string"""
    try:
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        return base64.b64encode(buffer.getvalue()).decode('utf-8')
    except Exception as e:
        logger.error(f"QR generation error: {e}")
        return ""

async def generate_donor_id() -> str:
    """Generate unique donor ID like D-2024-0001"""
    year = datetime.now().year
    count = await db.donors.count_documents({})
    return f"D-{year}-{str(count + 1).zfill(4)}"

async def generate_donation_id() -> str:
    """Generate unique donation ID"""
    year = datetime.now().year
    count = await db.donations.count_documents({})
    return f"DON-{year}-{str(count + 1).zfill(5)}"

async def generate_unit_id() -> str:
    """Generate unique blood unit ID"""
    year = datetime.now().year
    count = await db.blood_units.count_documents({})
    return f"BU-{year}-{str(count + 1).zfill(6)}"

async def generate_component_id() -> str:
    """Generate unique component ID"""
    year = datetime.now().year
    count = await db.components.count_documents({})
    return f"COMP-{year}-{str(count + 1).zfill(6)}"

async def generate_request_id() -> str:
    """Generate unique request ID"""
    year = datetime.now().year
    count = await db.blood_requests.count_documents({})
    return f"REQ-{year}-{str(count + 1).zfill(5)}"

async def generate_issue_id() -> str:
    """Generate unique issue ID"""
    year = datetime.now().year
    count = await db.issuances.count_documents({})
    return f"ISS-{year}-{str(count + 1).zfill(5)}"

async def generate_return_id() -> str:
    """Generate unique return ID"""
    year = datetime.now().year
    count = await db.returns.count_documents({})
    return f"RET-{year}-{str(count + 1).zfill(5)}"

async def generate_discard_id() -> str:
    """Generate unique discard ID"""
    year = datetime.now().year
    count = await db.discards.count_documents({})
    return f"DIS-{year}-{str(count + 1).zfill(5)}"

# ==================== AUTH ROUTES ====================
@api_router.post("/auth/register", response_model=UserResponse)
async def register(user_data: UserCreate):
    # Check if email exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        full_name=user_data.full_name,
        role=user_data.role
    )
    
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.users.insert_one(doc)
    return UserResponse(id=user.id, email=user.email, full_name=user.full_name, role=user.role, is_active=user.is_active)

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is disabled")
    
    token = create_token(user["id"], user["role"])
    return {
        "token": token,
        "user": UserResponse(
            id=user["id"],
            email=user["email"],
            full_name=user["full_name"],
            role=user["role"],
            is_active=user.get("is_active", True)
        )
    }

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        full_name=current_user["full_name"],
        role=current_user["role"],
        is_active=current_user.get("is_active", True)
    )

# ==================== USER MANAGEMENT ROUTES ====================
@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    if "password" in updates:
        updates["password_hash"] = hash_password(updates.pop("password"))
    
    result = await db.users.update_one({"id": user_id}, {"$set": updates})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "success"}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "success"}

# ==================== DONOR ROUTES ====================
@api_router.post("/donors")
async def create_donor(donor_data: DonorCreate, current_user: dict = Depends(get_current_user)):
    # Check for duplicate identity
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

@api_router.get("/donors")
async def get_donors(
    status: Optional[str] = None,
    blood_group: Optional[str] = None,
    search: Optional[str] = None,
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

@api_router.get("/donors/{donor_id}")
async def get_donor(donor_id: str, current_user: dict = Depends(get_current_user)):
    donor = await db.donors.find_one(
        {"$or": [{"id": donor_id}, {"donor_id": donor_id}]},
        {"_id": 0}
    )
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")
    return donor

@api_router.put("/donors/{donor_id}")
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

@api_router.get("/donors/{donor_id}/eligibility")
async def check_donor_eligibility(donor_id: str, current_user: dict = Depends(get_current_user)):
    donor = await db.donors.find_one(
        {"$or": [{"id": donor_id}, {"donor_id": donor_id}]},
        {"_id": 0}
    )
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")
    
    issues = []
    eligible = True
    
    # Check deferral status
    if donor.get("status") == "deferred_permanent":
        issues.append("Donor is permanently deferred")
        eligible = False
    elif donor.get("status") == "deferred_temporary":
        if donor.get("deferral_end_date"):
            end_date = datetime.fromisoformat(donor["deferral_end_date"])
            if end_date > datetime.now(timezone.utc):
                issues.append(f"Donor is deferred until {donor['deferral_end_date']}")
                eligible = False
    
    # Check last donation date (minimum 56 days for whole blood)
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

@api_router.get("/donors/{donor_id}/history")
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

# ==================== SCREENING ROUTES ====================
@api_router.post("/screenings")
async def create_screening(screening_data: ScreeningCreate, current_user: dict = Depends(get_current_user)):
    # Verify donor exists
    donor = await db.donors.find_one({"id": screening_data.donor_id}, {"_id": 0})
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")
    
    screening = Screening(**screening_data.model_dump())
    screening.screened_by = current_user["id"]
    
    # Auto-check eligibility based on vitals
    issues = []
    if screening.hemoglobin < 12.5:
        issues.append("Hemoglobin below minimum (12.5 g/dL)")
    if screening.weight < 45:
        issues.append("Weight below minimum (45 kg)")
    if screening.blood_pressure_systolic < 90 or screening.blood_pressure_systolic > 180:
        issues.append("Blood pressure systolic out of range (90-180)")
    if screening.blood_pressure_diastolic < 60 or screening.blood_pressure_diastolic > 100:
        issues.append("Blood pressure diastolic out of range (60-100)")
    if screening.pulse < 50 or screening.pulse > 100:
        issues.append("Pulse rate out of range (50-100)")
    if screening.temperature < 36.0 or screening.temperature > 37.5:
        issues.append("Temperature out of range (36.0-37.5)")
    if not screening.questionnaire_passed:
        issues.append("Health questionnaire not passed")
    
    if issues:
        screening.eligibility_status = "ineligible"
        screening.rejection_reason = "; ".join(issues)
    else:
        screening.eligibility_status = "eligible"
    
    doc = screening.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.screenings.insert_one(doc)
    return {
        "status": "success",
        "screening_id": screening.id,
        "eligibility_status": screening.eligibility_status,
        "rejection_reason": screening.rejection_reason
    }

@api_router.get("/screenings")
async def get_screenings(
    donor_id: Optional[str] = None,
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if donor_id:
        query["donor_id"] = donor_id
    if date:
        query["screening_date"] = date
    
    screenings = await db.screenings.find(query, {"_id": 0}).to_list(1000)
    return screenings

@api_router.get("/screenings/{screening_id}")
async def get_screening(screening_id: str, current_user: dict = Depends(get_current_user)):
    screening = await db.screenings.find_one({"id": screening_id}, {"_id": 0})
    if not screening:
        raise HTTPException(status_code=404, detail="Screening not found")
    return screening

# ==================== DONATION ROUTES ====================
@api_router.post("/donations")
async def create_donation(donation_data: DonationCreate, current_user: dict = Depends(get_current_user)):
    # Verify screening passed
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

@api_router.put("/donations/{donation_id}/complete")
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
    
    # Update donor stats
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
    
    # Create blood unit
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

@api_router.get("/donations")
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

# ==================== BLOOD UNIT ROUTES ====================
@api_router.get("/blood-units")
async def get_blood_units(
    status: Optional[str] = None,
    blood_group: Optional[str] = None,
    location: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status
    if blood_group:
        query["$or"] = [
            {"blood_group": blood_group},
            {"confirmed_blood_group": blood_group}
        ]
    if location:
        query["current_location"] = location
    
    units = await db.blood_units.find(query, {"_id": 0}).to_list(1000)
    return units

@api_router.get("/blood-units/{unit_id}")
async def get_blood_unit(unit_id: str, current_user: dict = Depends(get_current_user)):
    unit = await db.blood_units.find_one(
        {"$or": [{"id": unit_id}, {"unit_id": unit_id}]},
        {"_id": 0}
    )
    if not unit:
        raise HTTPException(status_code=404, detail="Blood unit not found")
    return unit

@api_router.put("/blood-units/{unit_id}")
async def update_blood_unit(unit_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.blood_units.update_one(
        {"$or": [{"id": unit_id}, {"unit_id": unit_id}]},
        {"$set": updates}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Blood unit not found")
    return {"status": "success"}

@api_router.get("/blood-units/{unit_id}/traceability")
async def get_unit_traceability(unit_id: str, current_user: dict = Depends(get_current_user)):
    unit = await db.blood_units.find_one(
        {"$or": [{"id": unit_id}, {"unit_id": unit_id}]},
        {"_id": 0}
    )
    if not unit:
        raise HTTPException(status_code=404, detail="Blood unit not found")
    
    custody = await db.chain_custody.find({"unit_id": unit["id"]}, {"_id": 0}).to_list(100)
    lab_tests = await db.lab_tests.find({"unit_id": unit["id"]}, {"_id": 0}).to_list(10)
    components = await db.components.find({"parent_unit_id": unit["id"]}, {"_id": 0}).to_list(10)
    
    return {
        "unit": unit,
        "chain_of_custody": custody,
        "lab_tests": lab_tests,
        "components": components
    }

# ==================== CHAIN OF CUSTODY ROUTES ====================
@api_router.post("/chain-custody")
async def create_custody_record(custody_data: ChainOfCustodyCreate, current_user: dict = Depends(get_current_user)):
    custody = ChainOfCustody(**custody_data.model_dump())
    
    doc = custody.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    await db.chain_custody.insert_one(doc)
    
    # Update unit location
    await db.blood_units.update_one(
        {"$or": [{"id": custody_data.unit_id}, {"unit_id": custody_data.unit_id}]},
        {"$set": {"current_location": custody_data.to_location, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"status": "success", "custody_id": custody.id}

@api_router.get("/chain-custody")
async def get_custody_records(
    unit_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if unit_id:
        query["unit_id"] = unit_id
    
    records = await db.chain_custody.find(query, {"_id": 0}).to_list(1000)
    return records

@api_router.put("/chain-custody/{custody_id}/confirm")
async def confirm_custody(custody_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.chain_custody.update_one(
        {"id": custody_id},
        {"$set": {"confirmed": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Custody record not found")
    return {"status": "success"}

# ==================== LAB TEST ROUTES ====================
@api_router.post("/lab-tests")
async def create_lab_test(test_data: LabTestCreate, current_user: dict = Depends(get_current_user)):
    # Verify unit exists
    unit = await db.blood_units.find_one(
        {"$or": [{"id": test_data.unit_id}, {"unit_id": test_data.unit_id}]},
        {"_id": 0}
    )
    if not unit:
        raise HTTPException(status_code=404, detail="Blood unit not found")
    
    lab_test = LabTest(**test_data.model_dump())
    lab_test.tested_by = current_user["id"]
    
    # Calculate overall status
    results = [test_data.hiv_result, test_data.hbsag_result, test_data.hcv_result, test_data.syphilis_result]
    results = [r for r in results if r]
    
    if any(r == ScreeningResult.REACTIVE for r in results):
        lab_test.overall_status = "reactive"
    elif any(r == ScreeningResult.GRAY for r in results):
        lab_test.overall_status = "gray"
    elif all(r == ScreeningResult.NON_REACTIVE for r in results) and len(results) == 4:
        lab_test.overall_status = "non_reactive"
    else:
        lab_test.overall_status = "pending"
    
    doc = lab_test.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.lab_tests.insert_one(doc)
    
    # Update unit status and blood group
    update_data = {"status": UnitStatus.LAB.value, "updated_at": datetime.now(timezone.utc).isoformat()}
    
    if test_data.confirmed_blood_group and test_data.verified_by_1 and test_data.verified_by_2:
        update_data["confirmed_blood_group"] = test_data.confirmed_blood_group.value
        update_data["blood_group_verified_by"] = [test_data.verified_by_1, test_data.verified_by_2]
    
    # Auto-quarantine if reactive or gray
    if lab_test.overall_status in ["reactive", "gray"]:
        update_data["status"] = UnitStatus.QUARANTINE.value
        
        # Create quarantine record
        quarantine = Quarantine(
            unit_component_id=unit["id"],
            unit_type="unit",
            reason=f"Test result: {lab_test.overall_status}",
            quarantine_date=datetime.now(timezone.utc).isoformat().split("T")[0]
        )
        q_doc = quarantine.model_dump()
        q_doc['created_at'] = q_doc['created_at'].isoformat()
        await db.quarantine.insert_one(q_doc)
    
    await db.blood_units.update_one(
        {"$or": [{"id": test_data.unit_id}, {"unit_id": test_data.unit_id}]},
        {"$set": update_data}
    )
    
    return {
        "status": "success",
        "test_id": lab_test.id,
        "overall_status": lab_test.overall_status
    }

@api_router.get("/lab-tests")
async def get_lab_tests(
    unit_id: Optional[str] = None,
    overall_status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if unit_id:
        query["unit_id"] = unit_id
    if overall_status:
        query["overall_status"] = overall_status
    
    tests = await db.lab_tests.find(query, {"_id": 0}).to_list(1000)
    return tests

@api_router.get("/lab-tests/{test_id}")
async def get_lab_test(test_id: str, current_user: dict = Depends(get_current_user)):
    test = await db.lab_tests.find_one({"id": test_id}, {"_id": 0})
    if not test:
        raise HTTPException(status_code=404, detail="Lab test not found")
    return test

# ==================== COMPONENT ROUTES ====================
@api_router.post("/components")
async def create_component(component_data: ComponentCreate, current_user: dict = Depends(get_current_user)):
    # Verify parent unit exists
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
    
    # Set storage temperature based on component type
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
    
    # Update parent unit status
    await db.blood_units.update_one(
        {"$or": [{"id": component_data.parent_unit_id}, {"unit_id": component_data.parent_unit_id}]},
        {"$set": {"status": UnitStatus.PROCESSING.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"status": "success", "component_id": component.component_id, "id": component.id}

@api_router.get("/components")
async def get_components(
    status: Optional[str] = None,
    component_type: Optional[str] = None,
    blood_group: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status
    if component_type:
        query["component_type"] = component_type
    if blood_group:
        query["blood_group"] = blood_group
    
    components = await db.components.find(query, {"_id": 0}).to_list(1000)
    return components

@api_router.get("/components/{component_id}")
async def get_component(component_id: str, current_user: dict = Depends(get_current_user)):
    component = await db.components.find_one(
        {"$or": [{"id": component_id}, {"component_id": component_id}]},
        {"_id": 0}
    )
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    return component

@api_router.put("/components/{component_id}")
async def update_component(component_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    result = await db.components.update_one(
        {"$or": [{"id": component_id}, {"component_id": component_id}]},
        {"$set": updates}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Component not found")
    return {"status": "success"}

# ==================== QUARANTINE ROUTES ====================
@api_router.get("/quarantine")
async def get_quarantine_items(current_user: dict = Depends(get_current_user)):
    items = await db.quarantine.find({"disposition": None}, {"_id": 0}).to_list(1000)
    return items

@api_router.put("/quarantine/{quarantine_id}/resolve")
async def resolve_quarantine(
    quarantine_id: str,
    retest_result: ScreeningResult,
    disposition: str,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] not in ["admin", "qc_manager", "lab_tech"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    update_data = {
        "retest_result": retest_result.value,
        "disposition": disposition,
        "resolved_date": datetime.now(timezone.utc).isoformat().split("T")[0],
        "resolved_by": current_user["id"]
    }
    
    quarantine = await db.quarantine.find_one({"id": quarantine_id}, {"_id": 0})
    if not quarantine:
        raise HTTPException(status_code=404, detail="Quarantine record not found")
    
    await db.quarantine.update_one({"id": quarantine_id}, {"$set": update_data})
    
    # Update unit/component status
    new_status = UnitStatus.READY_TO_USE.value if disposition == "release" else UnitStatus.DISCARDED.value
    
    if quarantine["unit_type"] == "unit":
        await db.blood_units.update_one(
            {"id": quarantine["unit_component_id"]},
            {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        await db.components.update_one(
            {"id": quarantine["unit_component_id"]},
            {"$set": {"status": new_status}}
        )
    
    return {"status": "success"}

# ==================== QC VALIDATION ROUTES ====================
@api_router.post("/qc-validation")
async def create_qc_validation(validation_data: QCValidationCreate, current_user: dict = Depends(get_current_user)):
    validation = QCValidation(**validation_data.model_dump())
    
    # Determine status
    if validation.data_complete and validation.screening_complete and validation.custody_complete:
        validation.status = "approved"
        validation.approved_by = current_user["id"]
        validation.approval_timestamp = datetime.now(timezone.utc)
    else:
        validation.status = "hold"
        missing = []
        if not validation.data_complete:
            missing.append("data incomplete")
        if not validation.screening_complete:
            missing.append("screening incomplete")
        if not validation.custody_complete:
            missing.append("custody incomplete")
        validation.hold_reason = ", ".join(missing)
    
    doc = validation.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    if doc.get('approval_timestamp'):
        doc['approval_timestamp'] = doc['approval_timestamp'].isoformat()
    
    await db.qc_validation.insert_one(doc)
    
    # Update unit/component status if approved
    if validation.status == "approved":
        new_status = UnitStatus.READY_TO_USE.value
        if validation.unit_type == "unit":
            await db.blood_units.update_one(
                {"id": validation.unit_component_id},
                {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        else:
            await db.components.update_one(
                {"id": validation.unit_component_id},
                {"$set": {"status": new_status}}
            )
    
    return {"status": "success", "validation_id": validation.id, "qc_status": validation.status}

@api_router.get("/qc-validation")
async def get_qc_validations(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status
    
    validations = await db.qc_validation.find(query, {"_id": 0}).to_list(1000)
    return validations

@api_router.put("/qc-validation/{validation_id}/approve")
async def approve_qc_validation(validation_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "qc_manager"]:
        raise HTTPException(status_code=403, detail="QC Manager access required")
    
    validation = await db.qc_validation.find_one({"id": validation_id}, {"_id": 0})
    if not validation:
        raise HTTPException(status_code=404, detail="Validation record not found")
    
    update_data = {
        "status": "approved",
        "approved_by": current_user["id"],
        "approval_timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.qc_validation.update_one({"id": validation_id}, {"$set": update_data})
    
    # Update unit/component status
    if validation["unit_type"] == "unit":
        await db.blood_units.update_one(
            {"id": validation["unit_component_id"]},
            {"$set": {"status": UnitStatus.READY_TO_USE.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        await db.components.update_one(
            {"id": validation["unit_component_id"]},
            {"$set": {"status": UnitStatus.READY_TO_USE.value}}
        )
    
    return {"status": "success"}

# ==================== INVENTORY ROUTES ====================
@api_router.get("/inventory/summary")
async def get_inventory_summary(current_user: dict = Depends(get_current_user)):
    # Get counts by blood group and status
    pipeline = [
        {"$match": {"status": {"$in": ["ready_to_use", "reserved"]}}},
        {"$group": {
            "_id": {
                "blood_group": {"$ifNull": ["$confirmed_blood_group", "$blood_group"]},
                "status": "$status"
            },
            "count": {"$sum": 1}
        }}
    ]
    
    unit_stats = await db.blood_units.aggregate(pipeline).to_list(100)
    component_stats = await db.components.aggregate(pipeline).to_list(100)
    
    # Get expiring soon (within 7 days)
    today = datetime.now(timezone.utc).isoformat().split("T")[0]
    seven_days = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat().split("T")[0]
    
    expiring_units = await db.blood_units.count_documents({
        "status": "ready_to_use",
        "expiry_date": {"$lte": seven_days, "$gte": today}
    })
    
    expiring_components = await db.components.count_documents({
        "status": "ready_to_use",
        "expiry_date": {"$lte": seven_days, "$gte": today}
    })
    
    return {
        "unit_stats": unit_stats,
        "component_stats": component_stats,
        "expiring_soon": {
            "units": expiring_units,
            "components": expiring_components
        }
    }

@api_router.get("/inventory/by-blood-group")
async def get_inventory_by_blood_group(current_user: dict = Depends(get_current_user)):
    pipeline = [
        {"$match": {"status": "ready_to_use"}},
        {"$group": {
            "_id": {"$ifNull": ["$confirmed_blood_group", "$blood_group"]},
            "count": {"$sum": 1},
            "total_volume": {"$sum": "$volume"}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    unit_inventory = await db.blood_units.aggregate(pipeline).to_list(20)
    
    # Component inventory by type and blood group
    component_pipeline = [
        {"$match": {"status": "ready_to_use"}},
        {"$group": {
            "_id": {
                "blood_group": "$blood_group",
                "component_type": "$component_type"
            },
            "count": {"$sum": 1},
            "total_volume": {"$sum": "$volume"}
        }},
        {"$sort": {"_id.component_type": 1, "_id.blood_group": 1}}
    ]
    
    component_inventory = await db.components.aggregate(component_pipeline).to_list(100)
    
    return {
        "whole_blood": unit_inventory,
        "components": component_inventory
    }

@api_router.get("/inventory/expiring")
async def get_expiring_inventory(days: int = 7, current_user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).isoformat().split("T")[0]
    target_date = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat().split("T")[0]
    
    expiring_units = await db.blood_units.find({
        "status": "ready_to_use",
        "expiry_date": {"$lte": target_date, "$gte": today}
    }, {"_id": 0}).to_list(1000)
    
    expiring_components = await db.components.find({
        "status": "ready_to_use",
        "expiry_date": {"$lte": target_date, "$gte": today}
    }, {"_id": 0}).to_list(1000)
    
    return {
        "expiring_units": expiring_units,
        "expiring_components": expiring_components
    }

@api_router.get("/inventory/fefo")
async def get_fefo_list(
    blood_group: str,
    component_type: Optional[str] = None,
    quantity: int = 1,
    current_user: dict = Depends(get_current_user)
):
    """Get items following First Expired First Out principle"""
    if component_type and component_type != "whole_blood":
        items = await db.components.find({
            "status": "ready_to_use",
            "blood_group": blood_group,
            "component_type": component_type
        }, {"_id": 0}).sort("expiry_date", 1).limit(quantity).to_list(quantity)
    else:
        items = await db.blood_units.find({
            "status": "ready_to_use",
            "$or": [
                {"confirmed_blood_group": blood_group},
                {"blood_group": blood_group}
            ]
        }, {"_id": 0}).sort("expiry_date", 1).limit(quantity).to_list(quantity)
    
    return items

# ==================== REQUEST ROUTES ====================
@api_router.post("/requests")
async def create_blood_request(request_data: BloodRequestCreate, current_user: dict = Depends(get_current_user)):
    request = BloodRequest(**request_data.model_dump())
    request.request_id = await generate_request_id()
    
    doc = request.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.blood_requests.insert_one(doc)
    return {"status": "success", "request_id": request.request_id, "id": request.id}

@api_router.get("/requests")
async def get_blood_requests(
    status: Optional[str] = None,
    request_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status
    if request_type:
        query["request_type"] = request_type
    
    requests = await db.blood_requests.find(query, {"_id": 0}).to_list(1000)
    return requests

@api_router.get("/requests/{request_id}")
async def get_blood_request(request_id: str, current_user: dict = Depends(get_current_user)):
    request = await db.blood_requests.find_one(
        {"$or": [{"id": request_id}, {"request_id": request_id}]},
        {"_id": 0}
    )
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    return request

@api_router.put("/requests/{request_id}/approve")
async def approve_request(request_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "inventory", "distribution"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    result = await db.blood_requests.update_one(
        {"$or": [{"id": request_id}, {"request_id": request_id}]},
        {"$set": {
            "status": RequestStatus.APPROVED.value,
            "approved_by": current_user["id"],
            "approval_date": datetime.now(timezone.utc).isoformat().split("T")[0]
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    return {"status": "success"}

@api_router.put("/requests/{request_id}/reject")
async def reject_request(request_id: str, reason: str, current_user: dict = Depends(get_current_user)):
    result = await db.blood_requests.update_one(
        {"$or": [{"id": request_id}, {"request_id": request_id}]},
        {"$set": {
            "status": RequestStatus.REJECTED.value,
            "notes": reason
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    return {"status": "success"}

# ==================== ISSUANCE ROUTES ====================
@api_router.post("/issuances")
async def create_issuance(
    request_id: str,
    component_ids: List[str],
    current_user: dict = Depends(get_current_user)
):
    # Verify request is approved
    request = await db.blood_requests.find_one(
        {"$or": [{"id": request_id}, {"request_id": request_id}]},
        {"_id": 0}
    )
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    if request["status"] != "approved":
        raise HTTPException(status_code=400, detail="Request not approved")
    
    issuance = Issuance(
        request_id=request["id"],
        component_ids=component_ids,
        pick_timestamp=datetime.now(timezone.utc).isoformat(),
        issued_by=current_user["id"]
    )
    issuance.issue_id = await generate_issue_id()
    
    doc = issuance.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.issuances.insert_one(doc)
    
    # Reserve the components
    for comp_id in component_ids:
        await db.components.update_one(
            {"$or": [{"id": comp_id}, {"component_id": comp_id}]},
            {"$set": {"status": UnitStatus.RESERVED.value}}
        )
        await db.blood_units.update_one(
            {"$or": [{"id": comp_id}, {"unit_id": comp_id}]},
            {"$set": {"status": UnitStatus.RESERVED.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"status": "success", "issue_id": issuance.issue_id, "id": issuance.id}

@api_router.get("/issuances")
async def get_issuances(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status
    
    issuances = await db.issuances.find(query, {"_id": 0}).to_list(1000)
    return issuances

@api_router.put("/issuances/{issue_id}/pack")
async def pack_issuance(issue_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.issuances.update_one(
        {"$or": [{"id": issue_id}, {"issue_id": issue_id}]},
        {"$set": {
            "pack_timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "packing"
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Issuance not found")
    return {"status": "success"}

@api_router.put("/issuances/{issue_id}/ship")
async def ship_issuance(issue_id: str, current_user: dict = Depends(get_current_user)):
    issuance = await db.issuances.find_one(
        {"$or": [{"id": issue_id}, {"issue_id": issue_id}]},
        {"_id": 0}
    )
    if not issuance:
        raise HTTPException(status_code=404, detail="Issuance not found")
    
    await db.issuances.update_one(
        {"$or": [{"id": issue_id}, {"issue_id": issue_id}]},
        {"$set": {
            "ship_timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "shipped"
        }}
    )
    
    # Update components to issued
    for comp_id in issuance["component_ids"]:
        await db.components.update_one(
            {"$or": [{"id": comp_id}, {"component_id": comp_id}]},
            {"$set": {"status": UnitStatus.ISSUED.value}}
        )
        await db.blood_units.update_one(
            {"$or": [{"id": comp_id}, {"unit_id": comp_id}]},
            {"$set": {"status": UnitStatus.ISSUED.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    # Update request status
    await db.blood_requests.update_one(
        {"id": issuance["request_id"]},
        {"$set": {"status": RequestStatus.FULFILLED.value}}
    )
    
    return {"status": "success"}

@api_router.put("/issuances/{issue_id}/deliver")
async def deliver_issuance(issue_id: str, received_by: str, current_user: dict = Depends(get_current_user)):
    result = await db.issuances.update_one(
        {"$or": [{"id": issue_id}, {"issue_id": issue_id}]},
        {"$set": {
            "received_by": received_by,
            "status": "delivered"
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Issuance not found")
    return {"status": "success"}

# ==================== RETURN ROUTES ====================
@api_router.post("/returns")
async def create_return(
    component_id: str,
    return_date: str,
    source: str,
    reason: str,
    current_user: dict = Depends(get_current_user)
):
    ret = Return(
        component_id=component_id,
        return_date=return_date,
        source=source,
        reason=reason,
        processed_by=current_user["id"]
    )
    ret.return_id = await generate_return_id()
    
    doc = ret.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.returns.insert_one(doc)
    
    # Update component status
    await db.components.update_one(
        {"$or": [{"id": component_id}, {"component_id": component_id}]},
        {"$set": {"status": UnitStatus.RETURNED.value}}
    )
    await db.blood_units.update_one(
        {"$or": [{"id": component_id}, {"unit_id": component_id}]},
        {"$set": {"status": UnitStatus.RETURNED.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"status": "success", "return_id": ret.return_id, "id": ret.id}

@api_router.get("/returns")
async def get_returns(current_user: dict = Depends(get_current_user)):
    returns = await db.returns.find({}, {"_id": 0}).to_list(1000)
    return returns

@api_router.put("/returns/{return_id}/process")
async def process_return(
    return_id: str,
    qc_pass: bool,
    decision: str,
    current_user: dict = Depends(get_current_user)
):
    ret = await db.returns.find_one(
        {"$or": [{"id": return_id}, {"return_id": return_id}]},
        {"_id": 0}
    )
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")
    
    await db.returns.update_one(
        {"$or": [{"id": return_id}, {"return_id": return_id}]},
        {"$set": {"qc_pass": qc_pass, "decision": decision}}
    )
    
    # Update component status based on decision
    new_status = UnitStatus.READY_TO_USE.value if decision == "accept" else UnitStatus.DISCARDED.value
    await db.components.update_one(
        {"$or": [{"id": ret["component_id"]}, {"component_id": ret["component_id"]}]},
        {"$set": {"status": new_status}}
    )
    await db.blood_units.update_one(
        {"$or": [{"id": ret["component_id"]}, {"unit_id": ret["component_id"]}]},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"status": "success"}

# ==================== DISCARD ROUTES ====================
@api_router.post("/discards")
async def create_discard(
    component_id: str,
    reason: DiscardReason,
    reason_details: Optional[str] = None,
    discard_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] not in ["admin", "qc_manager", "inventory"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    discard = Discard(
        component_id=component_id,
        reason=reason,
        reason_details=reason_details,
        discard_date=discard_date or datetime.now(timezone.utc).isoformat().split("T")[0],
        processed_by=current_user["id"]
    )
    discard.discard_id = await generate_discard_id()
    
    doc = discard.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.discards.insert_one(doc)
    
    # Update component status
    await db.components.update_one(
        {"$or": [{"id": component_id}, {"component_id": component_id}]},
        {"$set": {"status": UnitStatus.DISCARDED.value}}
    )
    await db.blood_units.update_one(
        {"$or": [{"id": component_id}, {"unit_id": component_id}]},
        {"$set": {"status": UnitStatus.DISCARDED.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"status": "success", "discard_id": discard.discard_id, "id": discard.id}

@api_router.get("/discards")
async def get_discards(
    reason: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if reason:
        query["reason"] = reason
    
    discards = await db.discards.find(query, {"_id": 0}).to_list(1000)
    return discards

@api_router.put("/discards/{discard_id}/destroy")
async def mark_destroyed(discard_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.discards.update_one(
        {"$or": [{"id": discard_id}, {"discard_id": discard_id}]},
        {"$set": {
            "destruction_date": datetime.now(timezone.utc).isoformat().split("T")[0],
            "approved_by": current_user["id"]
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Discard record not found")
    return {"status": "success"}

# ==================== REPORTS ROUTES ====================
@api_router.get("/reports/daily-collections")
async def get_daily_collections_report(
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    target_date = date or datetime.now(timezone.utc).isoformat().split("T")[0]
    
    donations = await db.donations.find({
        "collection_start_time": {"$regex": f"^{target_date}"}
    }, {"_id": 0}).to_list(1000)
    
    # Group by donation type
    by_type = {}
    rejections = 0
    total_volume = 0
    
    for d in donations:
        dtype = d.get("donation_type", "unknown")
        if dtype not in by_type:
            by_type[dtype] = {"count": 0, "volume": 0}
        by_type[dtype]["count"] += 1
        by_type[dtype]["volume"] += d.get("volume_collected", 0) or 0
        total_volume += d.get("volume_collected", 0) or 0
        if d.get("status") == "aborted":
            rejections += 1
    
    # Get screenings that failed
    screenings = await db.screenings.find({
        "screening_date": target_date,
        "eligibility_status": "ineligible"
    }, {"_id": 0}).to_list(1000)
    
    return {
        "date": target_date,
        "total_donations": len(donations),
        "by_type": by_type,
        "total_volume": total_volume,
        "rejections": rejections,
        "failed_screenings": len(screenings)
    }

@api_router.get("/reports/inventory-status")
async def get_inventory_status_report(current_user: dict = Depends(get_current_user)):
    # Get all blood groups
    blood_groups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
    
    inventory = {}
    for bg in blood_groups:
        units = await db.blood_units.count_documents({
            "status": "ready_to_use",
            "$or": [{"confirmed_blood_group": bg}, {"blood_group": bg}]
        })
        
        components = await db.components.count_documents({
            "status": "ready_to_use",
            "blood_group": bg
        })
        
        inventory[bg] = {
            "whole_blood": units,
            "components": components
        }
    
    # Get component breakdown
    component_types = ["prc", "plasma", "ffp", "platelets", "cryoprecipitate"]
    components_by_type = {}
    
    for ct in component_types:
        count = await db.components.count_documents({
            "status": "ready_to_use",
            "component_type": ct
        })
        components_by_type[ct] = count
    
    return {
        "by_blood_group": inventory,
        "by_component_type": components_by_type,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

@api_router.get("/reports/expiry-analysis")
async def get_expiry_analysis_report(current_user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).isoformat().split("T")[0]
    
    # Expired
    expired_units = await db.blood_units.count_documents({
        "expiry_date": {"$lt": today},
        "status": {"$in": ["ready_to_use", "reserved"]}
    })
    
    # Expiring in 3 days
    three_days = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat().split("T")[0]
    expiring_3_days = await db.blood_units.count_documents({
        "expiry_date": {"$gte": today, "$lte": three_days},
        "status": "ready_to_use"
    })
    
    # Expiring in 7 days
    seven_days = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat().split("T")[0]
    expiring_7_days = await db.blood_units.count_documents({
        "expiry_date": {"$gte": today, "$lte": seven_days},
        "status": "ready_to_use"
    })
    
    return {
        "expired": expired_units,
        "expiring_in_3_days": expiring_3_days,
        "expiring_in_7_days": expiring_7_days,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

@api_router.get("/reports/discard-analysis")
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
    
    # Group by reason
    by_reason = {}
    for d in discards:
        reason = d.get("reason", "unknown")
        if reason not in by_reason:
            by_reason[reason] = 0
        by_reason[reason] += 1
    
    return {
        "total_discards": len(discards),
        "by_reason": by_reason,
        "discards": discards
    }

@api_router.get("/reports/testing-outcomes")
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
    
    # Group by overall status
    by_status = {"reactive": 0, "non_reactive": 0, "gray": 0, "pending": 0}
    by_test = {
        "hiv": {"reactive": 0, "non_reactive": 0, "gray": 0},
        "hbsag": {"reactive": 0, "non_reactive": 0, "gray": 0},
        "hcv": {"reactive": 0, "non_reactive": 0, "gray": 0},
        "syphilis": {"reactive": 0, "non_reactive": 0, "gray": 0}
    }
    
    for t in tests:
        status = t.get("overall_status", "pending")
        if status in by_status:
            by_status[status] += 1
        
        for test_name in ["hiv", "hbsag", "hcv", "syphilis"]:
            result = t.get(f"{test_name}_result")
            if result and result in by_test[test_name]:
                by_test[test_name][result] += 1
    
    return {
        "total_tests": len(tests),
        "by_overall_status": by_status,
        "by_individual_test": by_test,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

# ==================== DASHBOARD STATS ====================
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).isoformat().split("T")[0]
    
    # Today's donations
    today_donations = await db.donations.count_documents({
        "collection_start_time": {"$regex": f"^{today}"}
    })
    
    # Total donors
    total_donors = await db.donors.count_documents({})
    
    # Available units
    available_units = await db.blood_units.count_documents({"status": "ready_to_use"})
    
    # Available components
    available_components = await db.components.count_documents({"status": "ready_to_use"})
    
    # Pending requests
    pending_requests = await db.blood_requests.count_documents({"status": "pending"})
    
    # Units in quarantine
    quarantine_count = await db.blood_units.count_documents({"status": "quarantine"})
    
    # Expiring soon (7 days)
    seven_days = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat().split("T")[0]
    expiring_soon = await db.blood_units.count_documents({
        "status": "ready_to_use",
        "expiry_date": {"$lte": seven_days, "$gte": today}
    })
    
    return {
        "today_donations": today_donations,
        "total_donors": total_donors,
        "available_units": available_units,
        "available_components": available_components,
        "pending_requests": pending_requests,
        "quarantine_count": quarantine_count,
        "expiring_soon": expiring_soon
    }

# ==================== UTILITY ROUTES ====================
@api_router.get("/")
async def root():
    return {"message": "Blood Bank Management System API", "version": "1.0.0"}

@api_router.get("/barcode/{data}")
async def get_barcode(data: str):
    barcode_base64 = generate_barcode_base64(data)
    return {"barcode": barcode_base64}

@api_router.get("/qrcode/{data}")
async def get_qrcode(data: str):
    qr_base64 = generate_qr_base64(data)
    return {"qrcode": qr_base64}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
