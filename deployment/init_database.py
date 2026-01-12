"""
BBMS Database Initialization Script
Creates the initial system admin and default configurations.
Run this script after fresh deployment.

Usage:
    python init_database.py

Requirements:
    - MongoDB running and accessible
    - Environment variables set (MONGO_URL, DB_NAME)
"""

import asyncio
import os
import sys
from datetime import datetime, timezone
import uuid
import bcrypt

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from motor.motor_asyncio import AsyncIOMotorClient


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


async def init_database():
    """Initialize the database with required data."""
    
    # Connect to MongoDB
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "bbms_production")
    
    print(f"Connecting to MongoDB: {mongo_url}")
    print(f"Database: {db_name}")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Check if already initialized
    existing_admin = await db.users.find_one({"user_type": "system_admin"})
    if existing_admin:
        print("\n⚠️  Database already initialized!")
        print(f"   System admin exists: {existing_admin['email']}")
        response = input("   Do you want to reset? (yes/no): ")
        if response.lower() != 'yes':
            print("   Aborted.")
            return
        # Delete existing system admin
        await db.users.delete_many({"user_type": "system_admin"})
    
    print("\n📦 Initializing database...")
    
    # 1. Create System Admin
    print("\n1. Creating System Admin...")
    admin_id = str(uuid.uuid4())
    admin_email = "admin@bbms.local"
    admin_password = "Admin@123456"  # Change immediately after first login
    
    admin_user = {
        "id": admin_id,
        "email": admin_email,
        "password_hash": hash_password(admin_password),
        "full_name": "System Administrator",
        "role": "admin",
        "user_type": "system_admin",
        "org_id": None,
        "is_active": True,
        "phone": "",
        "department": "IT Administration",
        "permissions": ["*"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(admin_user)
    print(f"   ✅ Created: {admin_email}")
    
    # 2. Create Default Password Policy
    print("\n2. Creating default password policy...")
    password_policy = {
        "id": str(uuid.uuid4()),
        "org_id": None,  # System-wide
        "min_length": 8,
        "require_uppercase": True,
        "require_lowercase": True,
        "require_numbers": True,
        "require_special": True,
        "max_age_days": 90,
        "max_failed_attempts": 5,
        "lockout_duration_minutes": 30,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.password_policies.delete_many({"org_id": None})
    await db.password_policies.insert_one(password_policy)
    print("   ✅ Default password policy created")
    
    # 3. Create Default Session Config
    print("\n3. Creating default session configuration...")
    session_config = {
        "id": str(uuid.uuid4()),
        "org_id": None,  # System-wide
        "session_timeout_minutes": 480,  # 8 hours
        "max_concurrent_sessions": 5,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.session_configs.delete_many({"org_id": None})
    await db.session_configs.insert_one(session_config)
    print("   ✅ Default session config created")
    
    # 4. Create Indexes
    print("\n4. Creating database indexes...")
    
    # Users indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("org_id")
    print("   ✅ users indexes")
    
    # Organizations indexes
    await db.organizations.create_index("org_code", unique=True, sparse=True)
    await db.organizations.create_index("parent_org_id")
    print("   ✅ organizations indexes")
    
    # Donors indexes
    await db.donors.create_index("donor_code", unique=True, sparse=True)
    await db.donors.create_index("org_id")
    await db.donors.create_index("email")
    print("   ✅ donors indexes")
    
    # Blood units indexes
    await db.blood_units.create_index("unit_id", unique=True, sparse=True)
    await db.blood_units.create_index([("org_id", 1), ("status", 1)])
    await db.blood_units.create_index([("blood_group", 1), ("status", 1)])
    await db.blood_units.create_index("expiry_date")
    print("   ✅ blood_units indexes")
    
    # Components indexes
    await db.components.create_index("component_id", unique=True, sparse=True)
    await db.components.create_index([("org_id", 1), ("status", 1)])
    print("   ✅ components indexes")
    
    # Audit logs indexes
    await db.audit_logs.create_index([("timestamp", -1)])
    await db.audit_logs.create_index([("org_id", 1), ("timestamp", -1)])
    await db.audit_logs.create_index([("user_id", 1), ("timestamp", -1)])
    print("   ✅ audit_logs indexes")
    
    # Sessions indexes
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index([("user_id", 1), ("is_active", 1)])
    print("   ✅ user_sessions indexes")
    
    # 5. Summary
    print("\n" + "="*50)
    print("✅ DATABASE INITIALIZATION COMPLETE")
    print("="*50)
    print(f"\n🔐 System Admin Credentials:")
    print(f"   Email:    {admin_email}")
    print(f"   Password: {admin_password}")
    print(f"\n⚠️  IMPORTANT: Change password immediately after first login!")
    print("="*50)


async def clear_sample_data():
    """Remove all sample/seed data from the database."""
    
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "bbms_production")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("\n🗑️  Clearing sample data...")
    
    # Collections to clear (except system config)
    collections_to_clear = [
        "donors", "donations", "blood_units", "components",
        "lab_tests", "screenings", "blood_requests", "issuances",
        "returns", "discards", "logistics", "qc_validation",
        "chain_custody", "notifications", "donor_requests",
        "donor_otps", "inter_org_requests"
    ]
    
    for collection in collections_to_clear:
        result = await db[collection].delete_many({})
        if result.deleted_count > 0:
            print(f"   Cleared {collection}: {result.deleted_count} documents")
    
    # Clear non-system users (keep system_admin)
    result = await db.users.delete_many({"user_type": {"$ne": "system_admin"}})
    if result.deleted_count > 0:
        print(f"   Cleared users (non-system): {result.deleted_count} documents")
    
    # Clear organizations
    result = await db.organizations.delete_many({})
    if result.deleted_count > 0:
        print(f"   Cleared organizations: {result.deleted_count} documents")
    
    print("\n✅ Sample data cleared!")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="BBMS Database Initialization")
    parser.add_argument("--clear", action="store_true", help="Clear all sample data")
    parser.add_argument("--init", action="store_true", help="Initialize database")
    
    args = parser.parse_args()
    
    if args.clear:
        asyncio.run(clear_sample_data())
    elif args.init:
        asyncio.run(init_database())
    else:
        # Default: initialize
        asyncio.run(init_database())
