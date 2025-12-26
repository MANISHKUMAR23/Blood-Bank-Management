from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid
from .enums import BloodGroup, ScreeningResult

class LabTest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    unit_id: str
    confirmed_blood_group: Optional[BloodGroup] = None
    verified_by_1: Optional[str] = None
    verified_by_2: Optional[str] = None
    hiv_result: Optional[ScreeningResult] = None
    hbsag_result: Optional[ScreeningResult] = None
    hcv_result: Optional[ScreeningResult] = None
    syphilis_result: Optional[ScreeningResult] = None
    test_method: str = "ELISA"
    overall_status: Optional[str] = None
    tested_by: Optional[str] = None
    test_date: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LabTestCreate(BaseModel):
    unit_id: str
    confirmed_blood_group: Optional[BloodGroup] = None
    verified_by_1: Optional[str] = None
    verified_by_2: Optional[str] = None
    hiv_result: Optional[ScreeningResult] = None
    hbsag_result: Optional[ScreeningResult] = None
    hcv_result: Optional[ScreeningResult] = None
    syphilis_result: Optional[ScreeningResult] = None
    test_method: str = "ELISA"
    test_date: str
