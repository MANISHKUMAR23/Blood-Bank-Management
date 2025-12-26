from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid
from .enums import DonationType

class Donation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    donation_id: str = ""
    donor_id: str
    screening_id: str
    donation_type: DonationType
    collection_start_time: str
    collection_end_time: Optional[str] = None
    volume_collected: Optional[float] = None
    adverse_reaction: bool = False
    adverse_reaction_details: Optional[str] = None
    phlebotomist_id: Optional[str] = None
    status: str = "in_progress"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DonationCreate(BaseModel):
    donor_id: str
    screening_id: str
    donation_type: DonationType
    collection_start_time: str
