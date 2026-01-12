"""
BBMS Database Connection
MongoDB connection using Motor (async driver)

Usage:
    from database import db
    
    # Then use db to access collections:
    await db.users.find_one({"email": "admin@bbms.local"})
    await db.organizations.insert_one({...})

Environment Variables Required:
    MONGO_URL - MongoDB connection string (e.g., mongodb://localhost:27017)
    DB_NAME   - Database name (e.g., bbms_production)
"""

from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from .env file
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Export for use in other modules
__all__ = ['client', 'db']
