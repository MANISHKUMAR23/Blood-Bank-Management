from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
import uuid
from .enums import BloodGroup, UnitStatus

class BloodUnit(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    unit_id: str = ""
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
    stage: str
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
