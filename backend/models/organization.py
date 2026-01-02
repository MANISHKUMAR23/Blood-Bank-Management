from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional, List
import uuid

from .enums import OrgType, UserType, InterOrgRequestStatus, UrgencyLevel


class Organization(BaseModel):
    """Organization/Branch in the blood bank network"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    org_name: str
    org_type: OrgType
    parent_org_id: Optional[str] = None  # None for parent orgs
    is_parent: bool = False
    
    # Address
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    
    # Contact
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    
    # Licensing
    license_number: Optional[str] = None
    
    # Status
    is_active: bool = True
    
    # Audit
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None


class OrganizationCreate(BaseModel):
    org_name: str
    org_type: OrgType
    parent_org_id: Optional[str] = None
    is_parent: bool = False
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    license_number: Optional[str] = None


class OrganizationUpdate(BaseModel):
    org_name: Optional[str] = None
    org_type: Optional[OrgType] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    license_number: Optional[str] = None
    is_active: Optional[bool] = None


class OrganizationResponse(BaseModel):
    id: str
    org_name: str
    org_type: OrgType
    parent_org_id: Optional[str] = None
    is_parent: bool
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    license_number: Optional[str] = None
    is_active: bool
    created_at: Optional[str] = None
    # Computed fields (populated by API)
    staff_count: Optional[int] = None
    inventory_count: Optional[int] = None
    children: Optional[List['OrganizationResponse']] = None


class ExternalOrganization(BaseModel):
    """External organizations (hospitals, other blood banks) for transactions"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    org_name: str
    org_type: Optional[str] = None  # Hospital, Blood Bank, etc.
    
    # Address
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    
    # Contact
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    
    # Relationship
    relationship_type: Optional[str] = None  # Partner, Customer, Supplier
    
    # Status
    is_active: bool = True
    
    # Which org added this external org
    org_id: str  # The internal org that created this record
    
    # Audit
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ExternalOrganizationCreate(BaseModel):
    org_name: str
    org_type: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    relationship_type: Optional[str] = None


class InterOrgRequest(BaseModel):
    """Blood requests between organizations (internal or external)"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    request_type: str  # 'internal' or 'external'
    
    # Requesting org (always internal)
    requesting_org_id: str
    
    # Fulfilling org
    fulfilling_org_id: Optional[str] = None  # For internal requests
    
    # External org details (for external requests)
    external_org_id: Optional[str] = None
    external_org_name: Optional[str] = None
    external_org_address: Optional[str] = None
    external_contact_person: Optional[str] = None
    external_contact_phone: Optional[str] = None
    external_contact_email: Optional[str] = None
    
    # Request details
    component_type: str
    blood_group: str
    quantity: int
    urgency_level: UrgencyLevel = UrgencyLevel.ROUTINE
    clinical_indication: Optional[str] = None
    required_by: Optional[datetime] = None
    
    # Status workflow
    status: InterOrgRequestStatus = InterOrgRequestStatus.PENDING
    
    # Approval
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    
    # Fulfillment
    fulfilled_components: Optional[List[str]] = None  # List of component IDs
    logistics_id: Optional[str] = None
    
    # Audit
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class InterOrgRequestCreate(BaseModel):
    request_type: str  # 'internal' or 'external'
    fulfilling_org_id: Optional[str] = None
    external_org_id: Optional[str] = None
    external_org_name: Optional[str] = None
    external_org_address: Optional[str] = None
    external_contact_person: Optional[str] = None
    external_contact_phone: Optional[str] = None
    external_contact_email: Optional[str] = None
    component_type: str
    blood_group: str
    quantity: int
    urgency_level: UrgencyLevel = UrgencyLevel.ROUTINE
    clinical_indication: Optional[str] = None
    required_by: Optional[datetime] = None
