"""
Audit Log Models
Comprehensive audit logging for all system actions.
"""
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional, List, Any
from enum import Enum
import uuid


class AuditAction(str, Enum):
    # CRUD Actions
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    
    # Auth Actions
    LOGIN = "login"
    LOGOUT = "logout"
    LOGIN_FAILED = "login_failed"
    PASSWORD_CHANGE = "password_change"
    PASSWORD_RESET = "password_reset"
    MFA_ENABLED = "mfa_enabled"
    MFA_DISABLED = "mfa_disabled"
    
    # Workflow Actions
    APPROVE = "approve"
    REJECT = "reject"
    FULFILL = "fulfill"
    DISPATCH = "dispatch"
    DELIVER = "deliver"
    CANCEL = "cancel"
    
    # Transfer Actions
    TRANSFER = "transfer"
    RECEIVE = "receive"
    
    # Admin Actions
    SWITCH_CONTEXT = "switch_context"
    EXIT_CONTEXT = "exit_context"
    IMPERSONATE = "impersonate"
    
    # Security Actions
    ACCOUNT_LOCKED = "account_locked"
    ACCOUNT_UNLOCKED = "account_unlocked"
    SESSION_TERMINATED = "session_terminated"
    PERMISSION_DENIED = "permission_denied"
    
    # System Actions
    EXPORT = "export"
    IMPORT = "import"
    BACKUP = "backup"
    RESTORE = "restore"


class AuditModule(str, Enum):
    AUTH = "auth"
    USERS = "users"
    ORGANIZATIONS = "organizations"
    DONORS = "donors"
    DONATIONS = "donations"
    SCREENING = "screening"
    BLOOD_UNITS = "blood_units"
    COMPONENTS = "components"
    LAB_TESTS = "lab_tests"
    QC_VALIDATION = "qc_validation"
    INVENTORY = "inventory"
    STORAGE = "storage"
    REQUESTS = "requests"
    ISSUANCES = "issuances"
    RETURNS = "returns"
    DISCARDS = "discards"
    LOGISTICS = "logistics"
    INTER_ORG_REQUESTS = "inter_org_requests"
    CONFIGURATION = "configuration"
    COMPLIANCE = "compliance"
    REPORTS = "reports"
    SYSTEM = "system"


class AuditLog(BaseModel):
    """Audit log entry for tracking all system actions."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Organization context
    org_id: Optional[str] = None
    branch_id: Optional[str] = None  # For branch-specific actions
    
    # User info
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_type: Optional[str] = None  # system_admin, super_admin, tenant_admin, staff
    
    # Action details
    action: AuditAction
    module: AuditModule
    record_id: Optional[str] = None
    record_type: Optional[str] = None  # e.g., "donor", "blood_unit", "component"
    description: Optional[str] = None
    
    # Data changes
    old_values: Optional[dict] = None
    new_values: Optional[dict] = None
    
    # Request info
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    request_method: Optional[str] = None
    request_path: Optional[str] = None
    
    # Context info (for impersonation/context switching)
    context_info: Optional[str] = None  # e.g., "System Admin acting as Super Admin of Org XYZ"
    context_org_id: Optional[str] = None
    context_user_type: Optional[str] = None
    
    # Metadata
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Additional details
    metadata: Optional[dict] = None


class AuditLogCreate(BaseModel):
    """Input model for creating audit logs."""
    action: AuditAction
    module: AuditModule
    record_id: Optional[str] = None
    record_type: Optional[str] = None
    description: Optional[str] = None
    old_values: Optional[dict] = None
    new_values: Optional[dict] = None
    metadata: Optional[dict] = None


class AuditLogFilter(BaseModel):
    """Filter parameters for querying audit logs."""
    org_id: Optional[str] = None
    user_id: Optional[str] = None
    action: Optional[str] = None
    module: Optional[str] = None
    record_id: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    search: Optional[str] = None
    limit: int = 100
    skip: int = 0


class AuditLogResponse(BaseModel):
    """Response model for audit log queries."""
    logs: List[AuditLog]
    total: int
    page: int
    page_size: int
    has_more: bool
