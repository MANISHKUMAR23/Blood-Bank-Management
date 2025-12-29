from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid
from .enums import BloodGroup, ComponentType, RequestStatus, RequestType

class RequestItem(BaseModel):
    """Individual product request item for multi-component requests"""
    product_type: ComponentType
    blood_group: BloodGroup
    quantity: int

class BloodRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    request_id: str = ""
    request_type: RequestType
    requester_name: str
    requester_contact: str
    hospital_name: Optional[str] = None
    hospital_address: Optional[str] = None
    hospital_contact: Optional[str] = None
    patient_name: Optional[str] = None
    patient_id: Optional[str] = None
    patient_diagnosis: Optional[str] = None
    blood_group: BloodGroup
    product_type: ComponentType
    quantity: int
    # Multi-component support
    additional_items: Optional[List[dict]] = None
    urgency: str = "normal"
    urgency_reason: Optional[str] = None
    status: RequestStatus = RequestStatus.PENDING
    requested_date: str
    required_by_date: Optional[str] = None
    required_by_time: Optional[str] = None
    approved_by: Optional[str] = None
    approval_date: Optional[str] = None
    notes: Optional[str] = None
    priority_score: Optional[int] = None  # Calculated based on urgency and time
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BloodRequestCreate(BaseModel):
    request_type: RequestType
    requester_name: str
    requester_contact: str
    hospital_name: Optional[str] = None
    hospital_address: Optional[str] = None
    hospital_contact: Optional[str] = None
    patient_name: Optional[str] = None
    patient_id: Optional[str] = None
    patient_diagnosis: Optional[str] = None
    blood_group: BloodGroup
    product_type: ComponentType
    quantity: int
    additional_items: Optional[List[RequestItem]] = None
    urgency: str = "normal"
    urgency_reason: Optional[str] = None
    requested_date: str
    required_by_date: Optional[str] = None
    required_by_time: Optional[str] = None
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
    status: str = "picking"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
