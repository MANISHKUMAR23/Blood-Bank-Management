from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid

class QCValidation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    unit_component_id: str
    unit_type: str
    data_complete: bool = False
    screening_complete: bool = False
    custody_complete: bool = False
    status: str = "pending"
    hold_reason: Optional[str] = None
    approved_by: Optional[str] = None
    approval_timestamp: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class QCValidationCreate(BaseModel):
    unit_component_id: str
    unit_type: str
    data_complete: bool = False
    screening_complete: bool = False
    custody_complete: bool = False
