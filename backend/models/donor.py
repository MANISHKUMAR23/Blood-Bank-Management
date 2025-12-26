from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid
from .enums import DonorStatus, BloodGroup, DonorRequestStatus, DonorRequestType

class Donor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    donor_id: str = ""
    full_name: str
    date_of_birth: str
    gender: str
    blood_group: Optional[BloodGroup] = None
    phone: str
    email: Optional[str] = None
    address: str
    identity_type: str
    identity_number: str
    status: DonorStatus = DonorStatus.ACTIVE
    deferral_end_date: Optional[str] = None
    deferral_reason: Optional[str] = None
    consent_given: bool = False
    registration_channel: str = "on_site"
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

class DonorRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    request_id: str = ""
    donor_id: Optional[str] = None
    identity_type: str
    identity_number: str
    full_name: str
    date_of_birth: str
    gender: str
    weight: Optional[float] = None
    phone: str
    email: Optional[str] = None
    address: str
    id_proof_image: Optional[str] = None
    consent_given: bool = False
    request_type: DonorRequestType = DonorRequestType.NEW_REGISTRATION
    status: DonorRequestStatus = DonorRequestStatus.PENDING
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DonorRequestCreate(BaseModel):
    identity_type: str
    identity_number: str
    full_name: str
    date_of_birth: str
    gender: str
    weight: Optional[float] = None
    phone: str
    email: Optional[str] = None
    address: str
    id_proof_image: Optional[str] = None
    consent_given: bool = False

class DonorOTP(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    donor_id: str
    otp: str
    expires_at: datetime
    used: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
