"""
Session Management Models
Tracks user sessions for security and context switching.
"""
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from enum import Enum
import uuid


class ContextType(str, Enum):
    GLOBAL = "global"  # System Admin - no specific org
    ORGANIZATION = "organization"  # Super Admin level
    BRANCH = "branch"  # Tenant Admin / Staff level


class UserSession(BaseModel):
    """User session tracking."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_token: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # User info
    user_id: str
    user_email: str
    user_name: Optional[str] = None
    user_type: str  # system_admin, super_admin, tenant_admin, staff
    user_org_id: Optional[str] = None  # User's actual org
    
    # Context (for impersonation/switching)
    context_type: ContextType = ContextType.GLOBAL
    context_org_id: Optional[str] = None  # Org being acted as
    context_org_name: Optional[str] = None
    context_user_type: Optional[str] = None  # Role being acted as
    is_impersonating: bool = False
    
    # Session info
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    device_info: Optional[str] = None
    
    # Timestamps
    login_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_activity: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(hours=24))
    
    # Status
    is_active: bool = True
    terminated_at: Optional[datetime] = None
    terminated_by: Optional[str] = None
    termination_reason: Optional[str] = None


class SessionCreate(BaseModel):
    """Input for creating a session."""
    user_id: str
    user_email: str
    user_name: Optional[str] = None
    user_type: str
    user_org_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class SessionResponse(BaseModel):
    """Session response for API."""
    id: str
    user_id: str
    user_email: str
    user_name: Optional[str] = None
    user_type: str
    context_type: ContextType
    context_org_id: Optional[str] = None
    context_org_name: Optional[str] = None
    context_user_type: Optional[str] = None
    is_impersonating: bool
    ip_address: Optional[str] = None
    login_at: str
    last_activity: str
    is_active: bool


class ContextSwitchRequest(BaseModel):
    """Request to switch context."""
    target_org_id: str
    target_user_type: Optional[str] = None  # If not provided, will be determined by org type


class SecurityEvent(BaseModel):
    """Security event tracking."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: str  # failed_login, account_locked, suspicious_activity, etc.
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    details: Optional[str] = None
    severity: str = "medium"  # low, medium, high, critical
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved: bool = False
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None


# Constants
MAX_CONCURRENT_SESSIONS = 3
SESSION_TIMEOUT_MINUTES = 30
SESSION_EXPIRY_HOURS = 24
MAX_FAILED_LOGINS = 5
LOCKOUT_DURATION_MINUTES = 30
