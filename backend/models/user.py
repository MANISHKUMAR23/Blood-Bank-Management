from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone
from typing import Optional
import uuid
from .enums import UserRole, UserType

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    password_hash: str
    full_name: str
    role: UserRole
    
    # Multi-tenancy fields
    org_id: Optional[str] = None  # None only for system_admin
    user_type: UserType = UserType.STAFF
    
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    role: UserRole
    org_id: Optional[str] = None  # Will be set based on creator's org
    user_type: UserType = UserType.STAFF

class UserLogin(BaseModel):
    email: str
    password: str
    org_id: Optional[str] = None  # Organization to log into

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    org_id: Optional[str] = None
    user_type: UserType = UserType.STAFF
    org_name: Optional[str] = None  # Populated by API
