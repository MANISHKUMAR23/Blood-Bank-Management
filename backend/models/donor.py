from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid
from .enums import DonorStatus, BloodGroup, DonorRequestStatus, DonorRequestType

# Deactivation reasons enum
DEACTIVATION_REASONS = [
    "medical",
    "failed_screening", 
    "fraud",
    "request",
    "deceased",
    "other"
]

# Reward tiers
REWARD_TIERS = {
    "bronze": {"min": 1, "max": 5},
    "silver": {"min": 6, "max": 15},
    "gold": {"min": 16, "max": 30},
    "platinum": {"min": 31, "max": float('inf')}
}

# Points configuration
POINTS_CONFIG = {
    "whole_blood": 10,
    "apheresis_platelets": 20,
    "apheresis_plasma": 20,
    "emergency_bonus": 15,
    "milestone_5": 50,
    "milestone_10": 100,
    "milestone_25": 250,
    "milestone_50": 500
}

class HealthQuestionnaire(BaseModel):
    """Extended health questionnaire for donor registration"""
    # General Health
    feeling_well_today: bool = True
    had_cold_flu_last_week: bool = False
    taking_medications: bool = False
    medication_details: Optional[str] = None
    
    # Medical History
    had_surgery_last_year: bool = False
    surgery_details: Optional[str] = None
    has_chronic_illness: bool = False
    chronic_illness_details: Optional[str] = None
    has_heart_condition: bool = False
    has_diabetes: bool = False
    has_hypertension: bool = False
    has_bleeding_disorder: bool = False
    
    # Infectious Disease Risk
    had_hepatitis: bool = False
    had_jaundice: bool = False
    had_malaria_last_year: bool = False
    had_typhoid_last_year: bool = False
    had_tuberculosis: bool = False
    hiv_risk_behavior: bool = False
    
    # Recent Activities
    had_tattoo_last_year: bool = False
    had_piercing_last_year: bool = False
    received_blood_last_year: bool = False
    dental_procedure_last_month: bool = False
    
    # Lifestyle
    alcohol_consumption: str = "none"  # none, occasional, regular
    smoking_status: str = "non_smoker"  # non_smoker, former, current
    
    # Women Only
    is_pregnant: Optional[bool] = None
    is_breastfeeding: Optional[bool] = None
    had_miscarriage_last_6_months: Optional[bool] = None

class DonorUpload(BaseModel):
    """File upload references for donor"""
    photo_url: Optional[str] = None
    id_proof_url: Optional[str] = None
    medical_report_urls: List[str] = []

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
    weight: Optional[float] = None
    height: Optional[float] = None
    status: DonorStatus = DonorStatus.ACTIVE
    deferral_end_date: Optional[str] = None
    deferral_reason: Optional[str] = None
    consent_given: bool = False
    registration_channel: str = "on_site"
    qr_code: Optional[str] = None
    total_donations: int = 0
    last_donation_date: Optional[str] = None
    # File uploads
    photo_url: Optional[str] = None
    id_proof_url: Optional[str] = None
    medical_report_urls: List[str] = []
    # Health questionnaire
    health_questionnaire: Optional[dict] = None
    questionnaire_date: Optional[str] = None
    # Deactivation fields
    is_active: bool = True
    deactivation_reason: Optional[str] = None
    deactivation_notes: Optional[str] = None
    deactivation_proof_url: Optional[str] = None
    deactivated_by: Optional[str] = None
    deactivated_at: Optional[str] = None
    reactivation_history: List[dict] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None


class DonorReward(BaseModel):
    """Donor rewards and leaderboard tracking"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    donor_id: str
    points_earned: int = 0
    total_donations: int = 0
    tier: str = "bronze"  # bronze, silver, gold, platinum
    badges: List[dict] = []  # [{"badge": "first_donation", "earned_at": "..."}]
    last_donation_points: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DonationSession(BaseModel):
    """Track donation process from screening to collection"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str = ""
    donor_id: str
    donation_id: Optional[str] = None
    screening_id: Optional[str] = None
    unit_id: Optional[str] = None
    # Timestamps
    screening_started_at: Optional[str] = None
    screening_completed_at: Optional[str] = None
    screening_status: Optional[str] = None  # eligible, rejected
    collection_started_at: Optional[str] = None
    collection_completed_at: Optional[str] = None
    # Stage tracking
    current_stage: str = "screening"  # screening, collection, completed, rejected, cancelled
    rejection_reason: Optional[str] = None
    cancelled_reason: Optional[str] = None
    cancelled_by: Optional[str] = None
    # Metadata
    started_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    weight: Optional[float] = None
    height: Optional[float] = None
    consent_given: bool = False
    registration_channel: str = "on_site"
    photo_url: Optional[str] = None
    id_proof_url: Optional[str] = None
    medical_report_urls: List[str] = []
    health_questionnaire: Optional[dict] = None

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
    height: Optional[float] = None
    phone: str
    email: Optional[str] = None
    address: str
    id_proof_image: Optional[str] = None
    photo_url: Optional[str] = None
    id_proof_url: Optional[str] = None
    medical_report_urls: List[str] = []
    health_questionnaire: Optional[dict] = None
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
    height: Optional[float] = None
    phone: str
    email: Optional[str] = None
    address: str
    id_proof_image: Optional[str] = None
    photo_url: Optional[str] = None
    id_proof_url: Optional[str] = None
    medical_report_urls: List[str] = []
    health_questionnaire: Optional[dict] = None
    consent_given: bool = False

class DonorOTP(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    donor_id: str
    otp: str
    expires_at: datetime
    used: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
