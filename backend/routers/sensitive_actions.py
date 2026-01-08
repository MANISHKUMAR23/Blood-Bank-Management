"""
Sensitive Actions Router
Handles re-authentication for sensitive admin operations.
Supports password verification and email OTP.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, EmailStr
from typing import Optional, Literal
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import secrets
import hashlib

from database import db
from services import get_current_user, verify_password

router = APIRouter(prefix="/sensitive-actions", tags=["Sensitive Actions"])

# OTP settings
OTP_EXPIRY_MINUTES = 10
OTP_LENGTH = 6

class PasswordVerifyRequest(BaseModel):
    password: str
    action_type: str  # e.g., "delete_user", "delete_org", "update_security"
    target_id: Optional[str] = None

class OTPRequestModel(BaseModel):
    action_type: str
    target_id: Optional[str] = None

class OTPVerifyRequest(BaseModel):
    otp: str
    verification_id: str
    action_type: str
    target_id: Optional[str] = None

class VerificationResponse(BaseModel):
    verified: bool
    verification_token: str
    expires_at: str
    message: str


def generate_verification_token():
    """Generate a secure verification token"""
    return secrets.token_urlsafe(32)


def hash_otp(otp: str) -> str:
    """Hash OTP for secure storage"""
    return hashlib.sha256(otp.encode()).hexdigest()


@router.post("/verify-password", response_model=VerificationResponse)
async def verify_password_for_action(
    request: PasswordVerifyRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Verify user's password before performing a sensitive action.
    Returns a short-lived verification token if successful.
    """
    user_type = current_user.get("user_type")
    
    # Only admins need re-authentication
    if user_type not in ["system_admin", "super_admin", "tenant_admin"]:
        raise HTTPException(status_code=403, detail="Only administrators can perform sensitive actions")
    
    # Get user from database to verify password
    user = await db.users.find_one({"id": current_user["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify password
    if not verify_password(request.password, user.get("password", "")):
        # Log failed attempt
        await db.sensitive_action_logs.insert_one({
            "id": str(uuid4()),
            "user_id": current_user["user_id"],
            "action_type": request.action_type,
            "target_id": request.target_id,
            "verification_method": "password",
            "success": False,
            "ip_address": None,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        raise HTTPException(status_code=401, detail="Invalid password")
    
    # Generate verification token
    verification_token = generate_verification_token()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    
    # Store verification
    await db.action_verifications.insert_one({
        "id": str(uuid4()),
        "user_id": current_user["user_id"],
        "verification_token": hash_otp(verification_token),
        "action_type": request.action_type,
        "target_id": request.target_id,
        "verification_method": "password",
        "expires_at": expires_at.isoformat(),
        "used": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Log successful verification
    await db.sensitive_action_logs.insert_one({
        "id": str(uuid4()),
        "user_id": current_user["user_id"],
        "action_type": request.action_type,
        "target_id": request.target_id,
        "verification_method": "password",
        "success": True,
        "ip_address": None,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return VerificationResponse(
        verified=True,
        verification_token=verification_token,
        expires_at=expires_at.isoformat(),
        message="Password verified successfully"
    )


@router.post("/request-otp")
async def request_email_otp(
    request: OTPRequestModel,
    current_user: dict = Depends(get_current_user)
):
    """
    Send an OTP to user's email for sensitive action verification.
    """
    user_type = current_user.get("user_type")
    
    if user_type not in ["system_admin", "super_admin", "tenant_admin"]:
        raise HTTPException(status_code=403, detail="Only administrators can perform sensitive actions")
    
    # Get user email
    user = await db.users.find_one({"id": current_user["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    email = user.get("email")
    
    # Generate OTP
    otp = ''.join([str(secrets.randbelow(10)) for _ in range(OTP_LENGTH)])
    verification_id = str(uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)
    
    # Store OTP (hashed)
    await db.email_otps.insert_one({
        "id": verification_id,
        "user_id": current_user["user_id"],
        "otp_hash": hash_otp(otp),
        "action_type": request.action_type,
        "target_id": request.target_id,
        "expires_at": expires_at.isoformat(),
        "verified": False,
        "attempts": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # In production, send email here
    # For now, we'll log it and return it in development
    print(f"[DEV] OTP for {email}: {otp}")
    
    # Store in notifications for demo purposes
    await db.notifications.insert_one({
        "id": str(uuid4()),
        "user_id": current_user["user_id"],
        "type": "security_otp",
        "title": "Security Verification Code",
        "message": f"Your verification code is: {otp}. Valid for {OTP_EXPIRY_MINUTES} minutes.",
        "otp_code": otp,  # Only for demo - remove in production
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Mask email for response
    email_parts = email.split("@")
    masked_email = email_parts[0][:2] + "***@" + email_parts[1] if len(email_parts) == 2 else "***"
    
    return {
        "message": f"OTP sent to {masked_email}",
        "verification_id": verification_id,
        "expires_in_minutes": OTP_EXPIRY_MINUTES,
        # Include OTP in response for demo/development only
        "demo_otp": otp
    }


@router.post("/verify-otp", response_model=VerificationResponse)
async def verify_email_otp(
    request: OTPVerifyRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Verify the email OTP for sensitive action.
    """
    user_type = current_user.get("user_type")
    
    if user_type not in ["system_admin", "super_admin", "tenant_admin"]:
        raise HTTPException(status_code=403, detail="Only administrators can perform sensitive actions")
    
    # Get OTP record
    otp_record = await db.email_otps.find_one({
        "id": request.verification_id,
        "user_id": current_user["user_id"]
    }, {"_id": 0})
    
    if not otp_record:
        raise HTTPException(status_code=404, detail="Verification not found")
    
    # Check if already verified
    if otp_record.get("verified"):
        raise HTTPException(status_code=400, detail="OTP already used")
    
    # Check expiry
    expires_at = datetime.fromisoformat(otp_record["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="OTP has expired")
    
    # Check attempts
    if otp_record.get("attempts", 0) >= 5:
        raise HTTPException(status_code=400, detail="Too many failed attempts")
    
    # Verify OTP
    if hash_otp(request.otp) != otp_record["otp_hash"]:
        # Increment attempts
        await db.email_otps.update_one(
            {"id": request.verification_id},
            {"$inc": {"attempts": 1}}
        )
        
        # Log failed attempt
        await db.sensitive_action_logs.insert_one({
            "id": str(uuid4()),
            "user_id": current_user["user_id"],
            "action_type": request.action_type,
            "target_id": request.target_id,
            "verification_method": "email_otp",
            "success": False,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        raise HTTPException(status_code=401, detail="Invalid OTP")
    
    # Mark OTP as verified
    await db.email_otps.update_one(
        {"id": request.verification_id},
        {"$set": {"verified": True}}
    )
    
    # Generate verification token
    verification_token = generate_verification_token()
    token_expires = datetime.now(timezone.utc) + timedelta(minutes=5)
    
    # Store verification
    await db.action_verifications.insert_one({
        "id": str(uuid4()),
        "user_id": current_user["user_id"],
        "verification_token": hash_otp(verification_token),
        "action_type": request.action_type,
        "target_id": request.target_id,
        "verification_method": "email_otp",
        "expires_at": token_expires.isoformat(),
        "used": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Log successful verification
    await db.sensitive_action_logs.insert_one({
        "id": str(uuid4()),
        "user_id": current_user["user_id"],
        "action_type": request.action_type,
        "target_id": request.target_id,
        "verification_method": "email_otp",
        "success": True,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return VerificationResponse(
        verified=True,
        verification_token=verification_token,
        expires_at=token_expires.isoformat(),
        message="OTP verified successfully"
    )


@router.post("/validate-token")
async def validate_verification_token(
    verification_token: str,
    action_type: str,
    target_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Validate a verification token before performing the sensitive action.
    This should be called by other endpoints that require verification.
    """
    # Find the verification record
    verification = await db.action_verifications.find_one({
        "user_id": current_user["user_id"],
        "verification_token": hash_otp(verification_token),
        "action_type": action_type,
        "used": False
    }, {"_id": 0})
    
    if not verification:
        raise HTTPException(status_code=401, detail="Invalid or expired verification token")
    
    # Check expiry
    expires_at = datetime.fromisoformat(verification["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=401, detail="Verification token has expired")
    
    # Check target_id if provided
    if target_id and verification.get("target_id") != target_id:
        raise HTTPException(status_code=401, detail="Token not valid for this target")
    
    # Mark as used
    await db.action_verifications.update_one(
        {"id": verification["id"]},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"valid": True, "message": "Verification successful"}


@router.get("/action-logs")
async def get_sensitive_action_logs(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get logs of sensitive action verifications (for audit purposes)"""
    user_type = current_user.get("user_type")
    
    if user_type != "system_admin":
        # Non-system admins can only see their own logs
        logs = await db.sensitive_action_logs.find(
            {"user_id": current_user["user_id"]},
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit).to_list(limit)
    else:
        logs = await db.sensitive_action_logs.find(
            {},
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return logs
