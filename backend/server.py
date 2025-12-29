"""
Blood Bank Management System API
Modular FastAPI application with separate routers for each module.
"""
import logging
import uuid
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import db, client
from services import hash_password
from routers import (
    auth_router, users_router, donors_router, screening_router,
    donations_router, blood_units_router, custody_router, laboratory_router,
    components_router, quarantine_router, qc_validation_router, inventory_router,
    requests_router, issuance_router, return_router, discard_router,
    reports_router, dashboard_router, alerts_router,
    storage_router, pre_lab_qc_router, notifications_router
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await create_default_admin()
    yield
    # Shutdown
    client.close()

# Create FastAPI app
app = FastAPI(
    title="Blood Bank Management System",
    description="Comprehensive API for blood bank operations management",
    version="2.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers with /api prefix
app.include_router(auth_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(donors_router, prefix="/api")
app.include_router(screening_router, prefix="/api")
app.include_router(donations_router, prefix="/api")
app.include_router(blood_units_router, prefix="/api")
app.include_router(custody_router, prefix="/api")
app.include_router(laboratory_router, prefix="/api")
app.include_router(components_router, prefix="/api")
app.include_router(quarantine_router, prefix="/api")
app.include_router(qc_validation_router, prefix="/api")
app.include_router(inventory_router, prefix="/api")
app.include_router(requests_router, prefix="/api")
app.include_router(issuance_router, prefix="/api")
app.include_router(return_router, prefix="/api")
app.include_router(discard_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(alerts_router, prefix="/api")


async def create_default_admin():
    """Create default admin user if none exists"""
    admin_exists = await db.users.find_one({"email": "admin@bloodbank.com"})
    if not admin_exists:
        admin_user = {
            "id": str(uuid.uuid4()),
            "email": "admin@bloodbank.com",
            "password_hash": hash_password("adminpassword"),
            "full_name": "Admin User",
            "role": "admin",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_user)
        logger.info("Default admin user created: admin@bloodbank.com")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
