from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid
from enum import Enum

class StorageType(str, Enum):
    REFRIGERATOR = "refrigerator"
    FREEZER = "freezer"
    PLATELET_INCUBATOR = "platelet_incubator"
    QUARANTINE_AREA = "quarantine_area"

class StorageLocation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    storage_name: str
    storage_type: StorageType
    temperature_range: str
    capacity: int
    current_occupancy: int = 0
    location_code: str
    facility: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None

class StorageLocationCreate(BaseModel):
    storage_name: str
    storage_type: StorageType
    temperature_range: str
    capacity: int
    location_code: str
    facility: str
