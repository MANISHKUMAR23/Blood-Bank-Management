"""
Security Router
Handles Password Policy, MFA, Session Management, and API Keys.
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import pyotp
import qrcode
import base64
from io import BytesIO
import hashlib
import secrets
import re

from database import db
from models.security import (
    PasswordPolicy, PasswordPolicyUpdate, PasswordHistory,
    UserMFA, MFAMethod, MFAStatus, MFASetupResponse, MFAVerifyRequest,
    UserSession, SessionConfig,
    APIKey, APIKeyCreate, APIKeyResponse, APIKeyScope,
    AccountLockout,
    generate_backup_codes, generate_api_key, hash_token,
    DEFAULT_PASSWORD_POLICY
)
from services import get_current_user
from middleware import ReadAccess, WriteAccess, OrgAccessHelper

router = APIRouter(prefix="/security", tags=["Security"])


# ==================== Password Policy ====================

@router.get("/password-policy")
async def get_password_policy(
    org_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get password policy (org-specific or system default)"""
    # Try org-specific first
    if org_id:
        policy = await db.password_policies.find_one({"org_id": org_id, "is_active": True}, {"_id": 0})
        if policy:
            return policy
    
    # Fall back to system default
    policy = await db.password_policies.find_one({"org_id": None, "is_active": True}, {"_id": 0})
    if policy:
        return policy
    
    # Return hardcoded default
    return DEFAULT_PASSWORD_POLICY


@router.put("/password-policy")
async def update_password_policy(
    updates: PasswordPolicyUpdate,
    org_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update password policy (System Admin for system-wide, Super Admin for org-specific)"""
    user_type = current_user.get("user_type")
    
    if org_id is None and user_type != "system_admin":
        raise HTTPException(status_code=403, detail="Only system admins can update system-wide policy")
    
    if org_id and user_type not in ["system_admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can update password policy")
    
    update_data = updates.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    existing = await db.password_policies.find_one({"org_id": org_id, "is_active": True})
    
    if existing:
        await db.password_policies.update_one(
            {"id": existing["id"]},
            {"$set": update_data}
        )
    else:
        new_policy = {
            "id": str(__import__("uuid").uuid4()),
            "org_id": org_id,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            **DEFAULT_PASSWORD_POLICY,
            **update_data
        }
        await db.password_policies.insert_one(new_policy)
    
    return {"status": "success", "message": "Password policy updated"}


def validate_password(password: str, policy: dict) -> tuple:
    """Validate password against policy, returns (is_valid, errors)"""
    errors = []
    
    if len(password) < policy.get("min_length", 8):
        errors.append(f"Password must be at least {policy['min_length']} characters")
    
    if policy.get("require_uppercase") and not re.search(r"[A-Z]", password):
        errors.append("Password must contain at least one uppercase letter")
    
    if policy.get("require_lowercase") and not re.search(r"[a-z]", password):
        errors.append("Password must contain at least one lowercase letter")
    
    if policy.get("require_numbers") and not re.search(r"\d", password):
        errors.append("Password must contain at least one number")
    
    if policy.get("require_special_chars"):
        special_chars = policy.get("special_chars", "!@#$%^&*()_+-=[]{}|;:,.<>?")
        if not any(c in special_chars for c in password):
            errors.append(f"Password must contain at least one special character ({special_chars})")
    
    return len(errors) == 0, errors


@router.post("/validate-password")
async def check_password_validity(
    password: str,
    org_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Check if a password meets policy requirements"""
    policy = await get_password_policy(org_id, current_user)
    is_valid, errors = validate_password(password, policy)
    return {"is_valid": is_valid, "errors": errors}


# ==================== MFA ====================

@router.get("/mfa/status")
async def get_mfa_status(
    current_user: dict = Depends(get_current_user)
):
    """Get current user's MFA status"""
    mfa = await db.user_mfa.find_one({"user_id": current_user["id"]}, {"_id": 0, "totp_secret": 0})
    
    if not mfa:
        return {
            "status": MFAStatus.DISABLED.value,
            "primary_method": None,
            "email_otp_enabled": False,
            "backup_codes_remaining": 0,
            "is_required": False
        }
    
    return {
        "status": mfa.get("status", MFAStatus.DISABLED.value),
        "primary_method": mfa.get("primary_method"),
        "email_otp_enabled": mfa.get("email_otp_enabled", False),
        "backup_codes_remaining": len(mfa.get("backup_codes", [])) - len(mfa.get("backup_codes_used", [])),
        "is_required": mfa.get("is_required", False)
    }


@router.post("/mfa/setup/totp")
async def setup_totp_mfa(
    current_user: dict = Depends(get_current_user)
):
    """Initialize TOTP MFA setup - returns QR code and backup codes"""
    user_id = current_user["id"]
    user_email = current_user.get("email", "user")
    
    # Generate new TOTP secret
    secret = pyotp.random_base32()
    
    # Generate QR code URI
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=user_email,
        issuer_name="BloodBank System"
    )
    
    # Generate QR code as base64
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    # Generate backup codes
    backup_codes = generate_backup_codes(10)
    
    # Store pending setup
    existing = await db.user_mfa.find_one({"user_id": user_id})
    
    mfa_data = {
        "user_id": user_id,
        "status": MFAStatus.PENDING_SETUP.value,
        "primary_method": MFAMethod.TOTP.value,
        "totp_secret": secret,
        "totp_verified": False,
        "backup_codes": backup_codes,
        "backup_codes_used": [],
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if existing:
        await db.user_mfa.update_one({"user_id": user_id}, {"$set": mfa_data})
    else:
        mfa_data["id"] = str(__import__("uuid").uuid4())
        mfa_data["created_at"] = datetime.now(timezone.utc).isoformat()
        mfa_data["is_required"] = False
        mfa_data["email_otp_enabled"] = False
        await db.user_mfa.insert_one(mfa_data)
    
    return MFASetupResponse(
        secret=secret,
        qr_code_uri=f"data:image/png;base64,{qr_base64}",
        backup_codes=backup_codes
    )


@router.post("/mfa/verify/totp")
async def verify_totp_setup(
    code: str,
    current_user: dict = Depends(get_current_user)
):
    """Verify TOTP code to complete MFA setup"""
    user_id = current_user["id"]
    
    mfa = await db.user_mfa.find_one({"user_id": user_id})
    if not mfa or not mfa.get("totp_secret"):
        raise HTTPException(status_code=400, detail="MFA setup not initiated")
    
    # Verify the code
    totp = pyotp.TOTP(mfa["totp_secret"])
    if not totp.verify(code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Mark as verified and enabled
    await db.user_mfa.update_one(
        {"user_id": user_id},
        {"$set": {
            "status": MFAStatus.ENABLED.value,
            "totp_verified": True,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"status": "success", "message": "MFA enabled successfully"}


@router.post("/mfa/enable-email")
async def enable_email_otp(
    current_user: dict = Depends(get_current_user)
):
    """Enable email OTP as backup method"""
    user_id = current_user["id"]
    
    existing = await db.user_mfa.find_one({"user_id": user_id})
    
    if existing:
        await db.user_mfa.update_one(
            {"user_id": user_id},
            {"$set": {
                "email_otp_enabled": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    else:
        await db.user_mfa.insert_one({
            "id": str(__import__("uuid").uuid4()),
            "user_id": user_id,
            "status": MFAStatus.DISABLED.value,
            "email_otp_enabled": True,
            "backup_codes": [],
            "backup_codes_used": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"status": "success", "message": "Email OTP enabled as backup"}


@router.post("/mfa/send-email-otp")
async def send_email_otp(
    email: str,
    current_user: dict = Depends(get_current_user)
):
    """Send OTP to user's email"""
    # Generate 6-digit OTP
    otp = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
    
    # Store OTP with expiry (5 minutes)
    await db.email_otps.delete_many({"email": email})
    await db.email_otps.insert_one({
        "email": email,
        "otp": otp,
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # In production, this would send an actual email
    # For now, we'll just return success (and log the OTP for testing)
    print(f"[EMAIL OTP] Code for {email}: {otp}")
    
    return {"status": "success", "message": "OTP sent to email"}


@router.post("/mfa/verify-email-otp")
async def verify_email_otp(
    email: str,
    otp: str,
    current_user: dict = Depends(get_current_user)
):
    """Verify email OTP"""
    stored = await db.email_otps.find_one({"email": email, "otp": otp})
    
    if not stored:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Check expiry
    expires_at = datetime.fromisoformat(stored["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        await db.email_otps.delete_one({"email": email})
        raise HTTPException(status_code=400, detail="OTP expired")
    
    # Delete used OTP
    await db.email_otps.delete_one({"email": email})
    
    return {"status": "success", "message": "OTP verified"}


@router.post("/mfa/disable")
async def disable_mfa(
    current_user: dict = Depends(get_current_user)
):
    """Disable MFA for current user"""
    user_id = current_user["id"]
    
    mfa = await db.user_mfa.find_one({"user_id": user_id})
    if mfa and mfa.get("is_required"):
        raise HTTPException(status_code=400, detail="MFA is required for your account and cannot be disabled")
    
    await db.user_mfa.update_one(
        {"user_id": user_id},
        {"$set": {
            "status": MFAStatus.DISABLED.value,
            "totp_secret": None,
            "totp_verified": False,
            "email_otp_enabled": False,
            "backup_codes": [],
            "backup_codes_used": [],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"status": "success", "message": "MFA disabled"}


@router.post("/mfa/regenerate-backup-codes")
async def regenerate_backup_codes(
    current_user: dict = Depends(get_current_user)
):
    """Generate new backup codes (invalidates old ones)"""
    user_id = current_user["id"]
    
    new_codes = generate_backup_codes(10)
    
    await db.user_mfa.update_one(
        {"user_id": user_id},
        {"$set": {
            "backup_codes": new_codes,
            "backup_codes_used": [],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"backup_codes": new_codes}


# ==================== Session Management ====================

@router.get("/sessions")
async def get_active_sessions(
    current_user: dict = Depends(get_current_user)
):
    """Get all active sessions for current user"""
    sessions = await db.user_sessions.find(
        {"user_id": current_user["id"], "is_active": True},
        {"_id": 0, "token_hash": 0}
    ).sort("last_activity", -1).to_list(20)
    
    return sessions


@router.post("/sessions/revoke/{session_id}")
async def revoke_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Revoke a specific session"""
    session = await db.user_sessions.find_one({
        "id": session_id,
        "user_id": current_user["id"]
    })
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await db.user_sessions.update_one(
        {"id": session_id},
        {"$set": {"is_active": False}}
    )
    
    return {"status": "success", "message": "Session revoked"}


@router.post("/sessions/revoke-all")
async def revoke_all_sessions(
    keep_current: bool = True,
    current_token_hash: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Revoke all sessions for current user"""
    query = {"user_id": current_user["id"], "is_active": True}
    
    if keep_current and current_token_hash:
        query["token_hash"] = {"$ne": current_token_hash}
    
    result = await db.user_sessions.update_many(query, {"$set": {"is_active": False}})
    
    return {"status": "success", "message": f"Revoked {result.modified_count} sessions"}


@router.get("/sessions/config")
async def get_session_config(
    org_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get session configuration"""
    if org_id:
        config = await db.session_configs.find_one({"org_id": org_id, "is_active": True}, {"_id": 0})
        if config:
            return config
    
    # Default config
    return {
        "session_timeout_minutes": 480,
        "max_concurrent_sessions": 5,
        "require_re_auth_for_sensitive": True,
        "track_device_info": True
    }


@router.put("/sessions/config")
async def update_session_config(
    session_timeout_minutes: Optional[int] = None,
    max_concurrent_sessions: Optional[int] = None,
    org_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update session configuration (Admin only)"""
    user_type = current_user.get("user_type")
    if user_type not in ["system_admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {}
    if session_timeout_minutes is not None:
        update_data["session_timeout_minutes"] = session_timeout_minutes
    if max_concurrent_sessions is not None:
        update_data["max_concurrent_sessions"] = max_concurrent_sessions
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    existing = await db.session_configs.find_one({"org_id": org_id, "is_active": True})
    
    if existing:
        await db.session_configs.update_one({"id": existing["id"]}, {"$set": update_data})
    else:
        new_config = {
            "id": str(__import__("uuid").uuid4()),
            "org_id": org_id,
            "session_timeout_minutes": session_timeout_minutes or 480,
            "max_concurrent_sessions": max_concurrent_sessions or 5,
            "require_re_auth_for_sensitive": True,
            "track_device_info": True,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.session_configs.insert_one(new_config)
    
    return {"status": "success", "message": "Session config updated"}


# ==================== API Keys ====================

@router.get("/api-keys")
async def list_api_keys(
    org_id: str,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """List API keys for an organization"""
    if org_id not in access.org_ids:
        raise HTTPException(status_code=403, detail="No access to this organization")
    
    keys = await db.api_keys.find(
        {"org_id": org_id, "is_active": True},
        {"_id": 0, "key_hash": 0}
    ).sort("created_at", -1).to_list(50)
    
    return keys


@router.post("/api-keys")
async def create_api_key(
    org_id: str,
    key_data: APIKeyCreate,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(WriteAccess)
):
    """Create a new API key"""
    if org_id not in access.org_ids:
        raise HTTPException(status_code=403, detail="No access to this organization")
    
    user_type = current_user.get("user_type")
    if user_type not in ["system_admin", "super_admin", "tenant_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required to create API keys")
    
    # Generate key
    full_key, prefix, key_hash = generate_api_key()
    
    api_key = {
        "id": str(__import__("uuid").uuid4()),
        "org_id": org_id,
        "name": key_data.name,
        "description": key_data.description,
        "key_prefix": prefix,
        "key_hash": key_hash,
        "scopes": [s.value for s in key_data.scopes],
        "is_active": True,
        "expires_at": key_data.expires_at,
        "rate_limit_per_minute": key_data.rate_limit_per_minute,
        "usage_count": 0,
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.api_keys.insert_one(api_key)
    
    # Return the full key ONLY at creation time
    return APIKeyResponse(
        id=api_key["id"],
        name=api_key["name"],
        key=full_key,
        key_prefix=prefix,
        scopes=api_key["scopes"],
        expires_at=api_key["expires_at"],
        created_at=api_key["created_at"]
    )


@router.delete("/api-keys/{key_id}")
async def revoke_api_key(
    key_id: str,
    org_id: str,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(WriteAccess)
):
    """Revoke an API key"""
    if org_id not in access.org_ids:
        raise HTTPException(status_code=403, detail="No access to this organization")
    
    key = await db.api_keys.find_one({"id": key_id, "org_id": org_id})
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    await db.api_keys.update_one(
        {"id": key_id},
        {"$set": {
            "is_active": False,
            "revoked_at": datetime.now(timezone.utc).isoformat(),
            "revoked_by": current_user["id"]
        }}
    )
    
    return {"status": "success", "message": "API key revoked"}


@router.get("/api-keys/{key_id}/usage")
async def get_api_key_usage(
    key_id: str,
    org_id: str,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """Get usage statistics for an API key"""
    if org_id not in access.org_ids:
        raise HTTPException(status_code=403, detail="No access to this organization")
    
    key = await db.api_keys.find_one({"id": key_id, "org_id": org_id}, {"_id": 0, "key_hash": 0})
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Get recent usage logs
    usage_logs = await db.api_key_usage.find(
        {"key_id": key_id}
    ).sort("timestamp", -1).limit(100).to_list(100)
    
    return {
        "key": key,
        "usage_logs": usage_logs
    }


# ==================== Account Lockout ====================

@router.get("/lockout/status/{user_id}")
async def get_lockout_status(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get account lockout status (Admin only or self)"""
    if user_id != current_user["id"]:
        user_type = current_user.get("user_type")
        if user_type not in ["system_admin", "super_admin", "tenant_admin"]:
            raise HTTPException(status_code=403, detail="Cannot view lockout status for other users")
    
    lockout = await db.account_lockouts.find_one({"user_id": user_id}, {"_id": 0})
    
    if not lockout:
        return {"is_locked": False, "failed_attempts": 0}
    
    # Check if lockout has expired
    if lockout.get("locked_until"):
        locked_until = datetime.fromisoformat(lockout["locked_until"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > locked_until:
            return {"is_locked": False, "failed_attempts": 0, "lockout_expired": True}
    
    return lockout


@router.post("/lockout/unlock/{user_id}")
async def unlock_account(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Manually unlock a user account (Admin only)"""
    user_type = current_user.get("user_type")
    if user_type not in ["system_admin", "super_admin", "tenant_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.account_lockouts.update_one(
        {"user_id": user_id},
        {"$set": {
            "is_locked": False,
            "failed_attempts": 0,
            "locked_until": None,
            "unlock_reason": f"Manual unlock by {current_user['email']}"
        }}
    )
    
    return {"status": "success", "message": "Account unlocked"}


# ==================== Admin: Enforce MFA ====================

@router.post("/mfa/enforce/{user_id}")
async def enforce_mfa_for_user(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Enforce MFA requirement for a specific user (Admin only)"""
    user_type = current_user.get("user_type")
    if user_type not in ["system_admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    existing = await db.user_mfa.find_one({"user_id": user_id})
    
    if existing:
        await db.user_mfa.update_one(
            {"user_id": user_id},
            {"$set": {"is_required": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        await db.user_mfa.insert_one({
            "id": str(__import__("uuid").uuid4()),
            "user_id": user_id,
            "status": MFAStatus.DISABLED.value,
            "is_required": True,
            "backup_codes": [],
            "backup_codes_used": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"status": "success", "message": "MFA enforcement enabled for user"}
