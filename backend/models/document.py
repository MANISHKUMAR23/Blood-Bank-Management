"""
Document Model
Supports uploading and managing organizational documents like licenses, certifications, etc.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum
import uuid


class DocumentType(str, Enum):
    LICENSE = "license"
    CERTIFICATION = "certification"
    ACCREDITATION = "accreditation"
    INSURANCE = "insurance"
    POLICY = "policy"
    TRAINING = "training"
    AUDIT_REPORT = "audit_report"
    COMPLIANCE = "compliance"
    CONTRACT = "contract"
    OTHER = "other"


class DocumentStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    PENDING_REVIEW = "pending_review"
    ARCHIVED = "archived"


class Document(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    org_id: str
    doc_type: DocumentType = DocumentType.OTHER
    title: str
    description: Optional[str] = None
    file_name: str
    file_path: str
    file_size: int = 0  # in bytes
    mime_type: str = "application/octet-stream"
    
    # Metadata
    issue_date: Optional[str] = None  # YYYY-MM-DD
    expiry_date: Optional[str] = None  # YYYY-MM-DD
    issuing_authority: Optional[str] = None
    reference_number: Optional[str] = None
    
    # Status tracking
    status: DocumentStatus = DocumentStatus.ACTIVE
    is_verified: bool = False
    verified_by: Optional[str] = None
    verified_at: Optional[str] = None
    
    # Audit
    uploaded_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    
    # Tags for better organization
    tags: List[str] = []


class DocumentCreate(BaseModel):
    doc_type: DocumentType = DocumentType.OTHER
    title: str
    description: Optional[str] = None
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    issuing_authority: Optional[str] = None
    reference_number: Optional[str] = None
    tags: List[str] = []


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    doc_type: Optional[DocumentType] = None
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    issuing_authority: Optional[str] = None
    reference_number: Optional[str] = None
    status: Optional[DocumentStatus] = None
    tags: Optional[List[str]] = None


class DocumentResponse(BaseModel):
    id: str
    org_id: str
    doc_type: str
    title: str
    description: Optional[str]
    file_name: str
    file_size: int
    mime_type: str
    issue_date: Optional[str]
    expiry_date: Optional[str]
    issuing_authority: Optional[str]
    reference_number: Optional[str]
    status: str
    is_verified: bool
    uploaded_by: str
    created_at: str
    tags: List[str]
    
    # Computed fields
    is_expired: bool = False
    days_until_expiry: Optional[int] = None
