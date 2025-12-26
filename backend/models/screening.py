from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid
from .enums import BloodGroup

class Screening(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    donor_id: str
    screening_date: str
    weight: float
    height: float
    blood_pressure_systolic: int
    blood_pressure_diastolic: int
    pulse: int
    temperature: float
    hemoglobin: float
    preliminary_blood_group: Optional[BloodGroup] = None
    questionnaire_passed: bool = False
    eligibility_status: str = "pending"
    rejection_reason: Optional[str] = None
    screened_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ScreeningCreate(BaseModel):
    donor_id: str
    screening_date: str
    weight: float
    height: float
    blood_pressure_systolic: int
    blood_pressure_diastolic: int
    pulse: int
    temperature: float
    hemoglobin: float
    preliminary_blood_group: Optional[BloodGroup] = None
    questionnaire_passed: bool = False
