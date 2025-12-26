from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid
from .enums import DiscardReason

class Return(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    return_id: str = ""
    component_id: str
    return_date: str
    source: str
    reason: str
    qc_pass: Optional[bool] = None
    decision: Optional[str] = None
    processed_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Discard(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    discard_id: str = ""
    component_id: str
    reason: DiscardReason
    reason_details: Optional[str] = None
    discard_date: str
    destruction_date: Optional[str] = None
    approved_by: Optional[str] = None
    processed_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
