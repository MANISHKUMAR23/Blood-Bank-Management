from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid
from .enums import BloodGroup, ComponentType, RequestStatus, RequestType

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
    urgency: str = "normal"
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
    status: str = "picking"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
