"""
Audit Logging Service
Provides centralized audit logging functionality.
"""
from typing import Optional, Any
from datetime import datetime, timezone
from fastapi import Request

from database import db
from models.audit import AuditLog, AuditAction, AuditModule


class AuditService:
    """Service class for creating and managing audit logs."""
    
    @staticmethod
    async def log(
        action: AuditAction,
        module: AuditModule,
        user: Optional[dict] = None,
        record_id: Optional[str] = None,
        record_type: Optional[str] = None,
        description: Optional[str] = None,
        old_values: Optional[dict] = None,
        new_values: Optional[dict] = None,
        request: Optional[Request] = None,
        org_id: Optional[str] = None,
        metadata: Optional[dict] = None
    ) -> str:
        """
        Create an audit log entry.
        
        Args:
            action: The action being performed
            module: The module where action occurred
            user: Current user dict (from get_current_user)
            record_id: ID of the affected record
            record_type: Type of record (e.g., "donor", "component")
            description: Human-readable description
            old_values: Previous values (for updates)
            new_values: New values (for creates/updates)
            request: FastAPI request object for IP/user-agent
            org_id: Override org_id (for cross-org actions)
            metadata: Additional metadata
        
        Returns:
            ID of created audit log
        """
        # Extract request info
        ip_address = None
        user_agent = None
        request_method = None
        request_path = None
        
        if request:
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent", "")[:500]  # Limit length
            request_method = request.method
            request_path = str(request.url.path)
        
        # Extract user info
        user_id = None
        user_name = None
        user_email = None
        user_type = None
        user_org_id = None
        context_info = None
        context_org_id = None
        context_user_type = None
        
        if user:
            user_id = user.get("id")
            user_name = user.get("full_name")
            user_email = user.get("email")
            user_type = user.get("user_type", "staff")
            user_org_id = user.get("org_id")
            
            # Check for context switching
            actual_user_type = user.get("actual_user_type")
            if actual_user_type and actual_user_type != user_type:
                context_info = f"{actual_user_type.replace('_', ' ').title()} acting as {user_type.replace('_', ' ').title()}"
                context_org_id = user.get("context_org_id")
                context_user_type = user_type
        
        # Determine org_id
        final_org_id = org_id or user_org_id
        
        # Clean sensitive data from values
        clean_old = AuditService._clean_sensitive_data(old_values)
        clean_new = AuditService._clean_sensitive_data(new_values)
        
        # Create audit log
        audit_log = AuditLog(
            org_id=final_org_id,
            user_id=user_id,
            user_name=user_name,
            user_email=user_email,
            user_type=user_type,
            action=action,
            module=module,
            record_id=record_id,
            record_type=record_type,
            description=description,
            old_values=clean_old,
            new_values=clean_new,
            ip_address=ip_address,
            user_agent=user_agent,
            request_method=request_method,
            request_path=request_path,
            context_info=context_info,
            context_org_id=context_org_id,
            context_user_type=context_user_type,
            metadata=metadata
        )
        
        # Convert to dict and store
        doc = audit_log.model_dump()
        doc["timestamp"] = doc["timestamp"].isoformat()
        
        await db.audit_logs.insert_one(doc)
        
        return audit_log.id
    
    @staticmethod
    def _clean_sensitive_data(data: Optional[dict]) -> Optional[dict]:
        """Remove sensitive fields from audit data."""
        if not data:
            return None
        
        sensitive_fields = {
            "password", "password_hash", "token", "secret", "api_key",
            "mfa_secret", "backup_codes", "otp", "otp_code"
        }
        
        cleaned = {}
        for key, value in data.items():
            if key.lower() in sensitive_fields:
                cleaned[key] = "[REDACTED]"
            elif isinstance(value, dict):
                cleaned[key] = AuditService._clean_sensitive_data(value)
            else:
                cleaned[key] = value
        
        return cleaned
    
    @staticmethod
    async def log_auth(
        action: AuditAction,
        user_email: str,
        success: bool,
        request: Optional[Request] = None,
        user: Optional[dict] = None,
        details: Optional[str] = None
    ):
        """Log authentication-related actions."""
        ip_address = None
        user_agent = None
        
        if request:
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent", "")[:500]
        
        doc = {
            "id": str(__import__('uuid').uuid4()),
            "action": action.value,
            "module": AuditModule.AUTH.value,
            "user_email": user_email,
            "user_id": user.get("id") if user else None,
            "user_name": user.get("full_name") if user else None,
            "user_type": user.get("user_type") if user else None,
            "org_id": user.get("org_id") if user else None,
            "description": details or f"{'Successful' if success else 'Failed'} {action.value}",
            "ip_address": ip_address,
            "user_agent": user_agent,
            "metadata": {"success": success},
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await db.audit_logs.insert_one(doc)


# Convenience functions
async def audit_log(
    action: AuditAction,
    module: AuditModule,
    user: Optional[dict] = None,
    **kwargs
):
    """Convenience function for creating audit logs."""
    return await AuditService.log(action, module, user, **kwargs)


async def audit_create(module: AuditModule, user: dict, record_id: str, record_type: str, new_values: dict, **kwargs):
    """Log a CREATE action."""
    return await AuditService.log(
        AuditAction.CREATE, module, user,
        record_id=record_id, record_type=record_type,
        new_values=new_values,
        description=f"Created {record_type} {record_id}",
        **kwargs
    )


async def audit_update(module: AuditModule, user: dict, record_id: str, record_type: str, old_values: dict, new_values: dict, **kwargs):
    """Log an UPDATE action."""
    return await AuditService.log(
        AuditAction.UPDATE, module, user,
        record_id=record_id, record_type=record_type,
        old_values=old_values, new_values=new_values,
        description=f"Updated {record_type} {record_id}",
        **kwargs
    )


async def audit_delete(module: AuditModule, user: dict, record_id: str, record_type: str, old_values: dict = None, **kwargs):
    """Log a DELETE action."""
    return await AuditService.log(
        AuditAction.DELETE, module, user,
        record_id=record_id, record_type=record_type,
        old_values=old_values,
        description=f"Deleted {record_type} {record_id}",
        **kwargs
    )
