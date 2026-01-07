"""
Training Model
Manages training courses and staff training records.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum
import uuid


class TrainingCategory(str, Enum):
    SAFETY = "safety"
    PROCEDURES = "procedures"
    QUALITY = "quality"
    EMERGENCY = "emergency"
    COMPLIANCE = "compliance"
    TECHNICAL = "technical"
    GENERAL = "general"


class TrainingStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    EXPIRED = "expired"
    OVERDUE = "overdue"


class TrainingCourse(BaseModel):
    """A training course that staff can complete"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    category: TrainingCategory = TrainingCategory.GENERAL
    duration_hours: float = 1.0
    is_mandatory: bool = False
    applicable_roles: List[str] = []  # Empty means all roles
    validity_period_days: Optional[int] = 365  # How long certification is valid
    passing_score: Optional[int] = None  # Minimum passing score if applicable
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class TrainingCourseCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: TrainingCategory = TrainingCategory.GENERAL
    duration_hours: float = 1.0
    is_mandatory: bool = False
    applicable_roles: List[str] = []
    validity_period_days: Optional[int] = 365
    passing_score: Optional[int] = None


class TrainingCourseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[TrainingCategory] = None
    duration_hours: Optional[float] = None
    is_mandatory: Optional[bool] = None
    applicable_roles: Optional[List[str]] = None
    validity_period_days: Optional[int] = None
    passing_score: Optional[int] = None
    is_active: Optional[bool] = None


class StaffTrainingRecord(BaseModel):
    """Tracks a staff member's progress on a training course"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    org_id: str
    course_id: str
    status: TrainingStatus = TrainingStatus.NOT_STARTED
    assigned_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    assigned_by: Optional[str] = None
    started_at: Optional[datetime] = None
    completion_date: Optional[datetime] = None
    expiry_date: Optional[str] = None  # YYYY-MM-DD
    score: Optional[int] = None
    certificate_document_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None


class TrainingRecordCreate(BaseModel):
    user_id: str
    course_id: str
    notes: Optional[str] = None


class TrainingRecordUpdate(BaseModel):
    status: Optional[TrainingStatus] = None
    score: Optional[int] = None
    certificate_document_id: Optional[str] = None
    notes: Optional[str] = None


# Pre-configured training courses
DEFAULT_TRAINING_COURSES = [
    {
        "name": "Blood Safety Fundamentals",
        "description": "Core training on blood safety principles, handling, and storage requirements",
        "category": "safety",
        "duration_hours": 8.0,
        "is_mandatory": True,
        "applicable_roles": [],  # All roles
        "validity_period_days": 365,
        "passing_score": 80
    },
    {
        "name": "Infection Control & Prevention",
        "description": "Training on infection prevention protocols, PPE usage, and biohazard handling",
        "category": "safety",
        "duration_hours": 4.0,
        "is_mandatory": True,
        "applicable_roles": [],
        "validity_period_days": 365,
        "passing_score": 85
    },
    {
        "name": "Donor Screening Procedures",
        "description": "Comprehensive training on donor eligibility assessment and screening protocols",
        "category": "procedures",
        "duration_hours": 6.0,
        "is_mandatory": True,
        "applicable_roles": ["phlebotomist", "registration"],
        "validity_period_days": 730,
        "passing_score": 80
    },
    {
        "name": "Blood Component Processing",
        "description": "Training on blood component separation, processing, and quality standards",
        "category": "technical",
        "duration_hours": 8.0,
        "is_mandatory": True,
        "applicable_roles": ["processing", "lab_tech"],
        "validity_period_days": 730,
        "passing_score": 85
    },
    {
        "name": "Quality Control Procedures",
        "description": "Training on QC testing, documentation, and compliance requirements",
        "category": "quality",
        "duration_hours": 6.0,
        "is_mandatory": True,
        "applicable_roles": ["qc_manager", "lab_tech"],
        "validity_period_days": 365,
        "passing_score": 90
    },
    {
        "name": "Emergency Response Protocol",
        "description": "Training on handling emergencies, adverse reactions, and crisis management",
        "category": "emergency",
        "duration_hours": 2.0,
        "is_mandatory": True,
        "applicable_roles": [],
        "validity_period_days": 365,
        "passing_score": 80
    },
    {
        "name": "Cold Chain Management",
        "description": "Training on temperature monitoring, storage requirements, and cold chain integrity",
        "category": "technical",
        "duration_hours": 4.0,
        "is_mandatory": True,
        "applicable_roles": ["inventory", "distribution", "processing"],
        "validity_period_days": 365,
        "passing_score": 85
    },
    {
        "name": "Regulatory Compliance Overview",
        "description": "Overview of FDA, AABB, and state regulatory requirements",
        "category": "compliance",
        "duration_hours": 3.0,
        "is_mandatory": False,
        "applicable_roles": ["admin", "qc_manager"],
        "validity_period_days": 730,
        "passing_score": 75
    }
]
