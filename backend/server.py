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
    storage_router, pre_lab_qc_router, notifications_router,
    logistics_router, labels_router, inventory_enhanced_router,
    relationships_router, donors_enhanced_router,
    configuration_router, logistics_enhanced_router,
    organizations_router, inter_org_requests_router,
    audit_logs_router, sessions_router, documents_router,
    compliance_router, training_router
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
app.include_router(storage_router, prefix="/api")
app.include_router(pre_lab_qc_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(logistics_router, prefix="/api")
app.include_router(labels_router, prefix="/api")
app.include_router(inventory_enhanced_router, prefix="/api")
app.include_router(relationships_router, prefix="/api")
app.include_router(donors_enhanced_router, prefix="/api")
app.include_router(configuration_router, prefix="/api")
app.include_router(logistics_enhanced_router, prefix="/api")
app.include_router(organizations_router, prefix="/api")
app.include_router(inter_org_requests_router, prefix="/api")
app.include_router(audit_logs_router, prefix="/api")
app.include_router(sessions_router, prefix="/api")
app.include_router(documents_router, prefix="/api")


async def create_default_admin():
    """Create default organization and admin user if none exists"""
    # Create default organization if none exists
    default_org = await db.organizations.find_one({"org_name": "BloodLink Central"})
    if not default_org:
        default_org_id = str(uuid.uuid4())
        default_org = {
            "id": default_org_id,
            "org_name": "BloodLink Central",
            "org_type": "standalone",
            "parent_org_id": None,
            "is_parent": True,
            "address": "Central Blood Bank",
            "city": "Main City",
            "state": "State",
            "country": "Country",
            "contact_person": "Admin",
            "contact_email": "admin@bloodbank.com",
            "license_number": "LIC-001",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.organizations.insert_one(default_org)
        logger.info(f"Default organization created: BloodLink Central (ID: {default_org_id})")
    else:
        default_org_id = default_org["id"]
    
    # Create or update default admin user
    admin_exists = await db.users.find_one({"email": "admin@bloodbank.com"})
    if not admin_exists:
        admin_user = {
            "id": str(uuid.uuid4()),
            "email": "admin@bloodbank.com",
            "password_hash": hash_password("adminpassword"),
            "full_name": "System Admin",
            "role": "admin",
            "org_id": None,  # System admin has no specific org
            "user_type": "system_admin",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_user)
        logger.info("Default system admin user created: admin@bloodbank.com")
    else:
        # Update existing admin to be system admin
        if admin_exists.get("user_type") != "system_admin":
            await db.users.update_one(
                {"email": "admin@bloodbank.com"},
                {"$set": {
                    "user_type": "system_admin",
                    "org_id": None,
                    "full_name": "System Admin",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            logger.info("Upgraded admin to system_admin")
    
    # Migrate existing data - add org_id to collections that don't have it
    collections_to_migrate = [
        "donors", "donations", "screenings", "blood_units", "components",
        "lab_tests", "storage_locations", "blood_requests", "issuances",
        "discards", "returns", "logistics", "notifications", "quarantine",
        "qc_validations", "pre_lab_qc", "chain_custody"
    ]
    
    for collection_name in collections_to_migrate:
        collection = db[collection_name]
        # Update documents that don't have org_id
        result = await collection.update_many(
            {"org_id": {"$exists": False}},
            {"$set": {"org_id": default_org_id}}
        )
        if result.modified_count > 0:
            logger.info(f"Migrated {result.modified_count} documents in {collection_name} to org_id: {default_org_id}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
