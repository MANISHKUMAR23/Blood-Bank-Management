from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import uuid
from .enums import BloodGroup, UnitStatus, ComponentType, ScreeningResult

class Component(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    component_id: str = ""
    parent_unit_id: str
    component_type: ComponentType
    volume: float
    blood_group: Optional[BloodGroup] = None
    status: UnitStatus = UnitStatus.PROCESSING
    storage_temp_min: Optional[float] = None
    storage_temp_max: Optional[float] = None
    storage_location: Optional[str] = None
    batch_id: Optional[str] = None
    expiry_date: Optional[str] = None
    qc_values: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processed_by: Optional[str] = None

class ComponentCreate(BaseModel):
    parent_unit_id: str
    component_type: ComponentType
    volume: float
    storage_temp_min: Optional[float] = None
    storage_temp_max: Optional[float] = None
    storage_location: Optional[str] = None
    batch_id: Optional[str] = None
    expiry_date: Optional[str] = None

class Quarantine(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    unit_component_id: str
    unit_type: str
    reason: str
    retest_result: Optional[ScreeningResult] = None
    disposition: Optional[str] = None
    quarantine_date: str
    resolved_date: Optional[str] = None
    resolved_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
