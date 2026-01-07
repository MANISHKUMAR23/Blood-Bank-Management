"""
Compliance Model
Tracks compliance requirements and organization compliance status.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum
import uuid


class ComplianceCategory(str, Enum):
    LICENSING = "licensing"
    ACCREDITATION = "accreditation"
    REGULATORY = "regulatory"
    SAFETY = "safety"
    QUALITY = "quality"
    EQUIPMENT = "equipment"
    OTHER = "other"


class ComplianceStatus(str, Enum):
    COMPLIANT = "compliant"
    NON_COMPLIANT = "non_compliant"
    PENDING = "pending"
    EXPIRED = "expired"
    NOT_APPLICABLE = "not_applicable"


class ComplianceRequirement(BaseModel):
    """A compliance requirement that organizations must meet"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    category: ComplianceCategory = ComplianceCategory.OTHER
    is_mandatory: bool = True
    requires_document: bool = True
    accepted_document_types: List[str] = []  # e.g., ["license", "certification"]
    renewal_period_days: Optional[int] = 365  # How often it needs renewal
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class ComplianceRequirementCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: ComplianceCategory = ComplianceCategory.OTHER
    is_mandatory: bool = True
    requires_document: bool = True
    accepted_document_types: List[str] = []
    renewal_period_days: Optional[int] = 365


class ComplianceRequirementUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[ComplianceCategory] = None
    is_mandatory: Optional[bool] = None
    requires_document: Optional[bool] = None
    accepted_document_types: Optional[List[str]] = None
    renewal_period_days: Optional[int] = None
    is_active: Optional[bool] = None


class OrganizationCompliance(BaseModel):
    """Tracks an organization's compliance status for a specific requirement"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    org_id: str
    requirement_id: str
    status: ComplianceStatus = ComplianceStatus.PENDING
    linked_document_id: Optional[str] = None
    expiry_date: Optional[str] = None  # YYYY-MM-DD
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None


class OrganizationComplianceUpdate(BaseModel):
    status: Optional[ComplianceStatus] = None
    linked_document_id: Optional[str] = None
    expiry_date: Optional[str] = None
    notes: Optional[str] = None


# Pre-configured compliance requirements
DEFAULT_COMPLIANCE_REQUIREMENTS = [
    {
        "name": "Blood Bank Operating License",
        "description": "Valid operating license from state/local health authority",
        "category": "licensing",
        "is_mandatory": True,
        "requires_document": True,
        "accepted_document_types": ["license"],
        "renewal_period_days": 365
    },
    {
        "name": "FDA Registration",
        "description": "Registration with FDA for blood establishment",
        "category": "regulatory",
        "is_mandatory": True,
        "requires_document": True,
        "accepted_document_types": ["certification", "compliance"],
        "renewal_period_days": 365
    },
    {
        "name": "AABB Accreditation",
        "description": "Accreditation from AABB (Association for the Advancement of Blood & Biotherapies)",
        "category": "accreditation",
        "is_mandatory": False,
        "requires_document": True,
        "accepted_document_types": ["accreditation"],
        "renewal_period_days": 730
    },
    {
        "name": "State Health Department Approval",
        "description": "Approval from state health department to operate",
        "category": "regulatory",
        "is_mandatory": True,
        "requires_document": True,
        "accepted_document_types": ["license", "compliance"],
        "renewal_period_days": 365
    },
    {
        "name": "Equipment Calibration Certificate",
        "description": "Certification that all critical equipment is properly calibrated",
        "category": "equipment",
        "is_mandatory": True,
        "requires_document": True,
        "accepted_document_types": ["certification"],
        "renewal_period_days": 365
    },
    {
        "name": "Quality Management System Certification",
        "description": "ISO or equivalent QMS certification",
        "category": "quality",
        "is_mandatory": False,
        "requires_document": True,
        "accepted_document_types": ["certification"],
        "renewal_period_days": 1095
    }
]
