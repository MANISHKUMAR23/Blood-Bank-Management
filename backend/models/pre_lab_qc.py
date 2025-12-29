from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid
from enum import Enum

class QCResult(str, Enum):
    PASS = "pass"
    FAIL = "fail"

class PreLabQC(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pre_qc_id: str = ""
    unit_id: str
    bag_integrity: QCResult
    color_appearance: QCResult
    clots_visible: QCResult
    hemolysis_check: QCResult
    volume_adequate: QCResult
    overall_result: QCResult
    failure_reason: Optional[str] = None
    inspector_id: Optional[str] = None
    inspector_name: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PreLabQCCreate(BaseModel):
    unit_id: str
    bag_integrity: QCResult
    color_appearance: QCResult
    clots_visible: QCResult
    hemolysis_check: QCResult
    volume_adequate: QCResult
    failure_reason: Optional[str] = None
