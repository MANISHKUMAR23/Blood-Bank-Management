import bcrypt
import jwt
import barcode
from barcode.writer import ImageWriter
import qrcode
import io
import base64
import logging
import random
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os

from database import db

logger = logging.getLogger(__name__)

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'bloodbank-secret-key-2024')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

security = HTTPBearer()

# ==================== PASSWORD FUNCTIONS ====================
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

# ==================== JWT FUNCTIONS ====================
def create_token(user_id: str, role: str, org_id: str = None, user_type: str = "staff") -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "org_id": org_id,
        "user_type": user_type,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = decode_token(credentials.credentials)
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Add org_id and user_type from token (may differ from DB for system admins)
    user["org_id"] = payload.get("org_id") or user.get("org_id")
    user["user_type"] = payload.get("user_type") or user.get("user_type", "staff")
    
    return user

# ==================== BARCODE/QR FUNCTIONS ====================
def generate_barcode_base64(data: str) -> str:
    try:
        CODE128 = barcode.get_barcode_class('code128')
        code = CODE128(data, writer=ImageWriter())
        buffer = io.BytesIO()
        code.write(buffer)
        return base64.b64encode(buffer.getvalue()).decode('utf-8')
    except Exception as e:
        logger.error(f"Barcode generation error: {e}")
        return ""

def generate_qr_base64(data: str) -> str:
    try:
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        return base64.b64encode(buffer.getvalue()).decode('utf-8')
    except Exception as e:
        logger.error(f"QR generation error: {e}")
        return ""

# ==================== ID GENERATORS ====================
def generate_otp() -> str:
    return str(random.randint(100000, 999999))

async def generate_donor_id() -> str:
    year = datetime.now().year
    count = await db.donors.count_documents({})
    return f"D-{year}-{str(count + 1).zfill(4)}"

async def generate_donor_request_id() -> str:
    year = datetime.now().year
    count = await db.donor_requests.count_documents({})
    return f"REG-{year}-{str(count + 1).zfill(5)}"

async def generate_donation_id() -> str:
    year = datetime.now().year
    count = await db.donations.count_documents({})
    return f"DON-{year}-{str(count + 1).zfill(5)}"

async def generate_unit_id() -> str:
    year = datetime.now().year
    count = await db.blood_units.count_documents({})
    return f"BU-{year}-{str(count + 1).zfill(6)}"

async def generate_component_id() -> str:
    year = datetime.now().year
    count = await db.components.count_documents({})
    return f"COMP-{year}-{str(count + 1).zfill(6)}"

async def generate_request_id() -> str:
    year = datetime.now().year
    count = await db.blood_requests.count_documents({})
    return f"REQ-{year}-{str(count + 1).zfill(5)}"

async def generate_issue_id() -> str:
    year = datetime.now().year
    count = await db.issuances.count_documents({})
    return f"ISS-{year}-{str(count + 1).zfill(5)}"

async def generate_return_id() -> str:
    year = datetime.now().year
    count = await db.returns.count_documents({})
    return f"RET-{year}-{str(count + 1).zfill(5)}"

async def generate_discard_id() -> str:
    year = datetime.now().year
    count = await db.discards.count_documents({})
    return f"DIS-{year}-{str(count + 1).zfill(5)}"
