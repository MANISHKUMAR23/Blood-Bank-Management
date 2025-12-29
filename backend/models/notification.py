from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid
from enum import Enum

class AlertType(str, Enum):
    EMERGENCY = "emergency"
    URGENT = "urgent"
    WARNING = "warning"
    INFO = "info"

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None  # None means broadcast to all
    role: Optional[str] = None  # Target specific role
    alert_type: AlertType
    title: str
    message: str
    link_to: Optional[str] = None
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None

class NotificationCreate(BaseModel):
    user_id: Optional[str] = None
    role: Optional[str] = None
    alert_type: AlertType
    title: str
    message: str
    link_to: Optional[str] = None
