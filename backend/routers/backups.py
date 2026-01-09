"""
Backup & Recovery Router
Handles database backups and restoration for admins based on their access level:
- System Admin: Full access to all data
- Super Admin: Access to their org and branches data
- Tenant Admin: Access to their branch data only
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import FileResponse
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel
import os
import shutil
import subprocess
import json
import zipfile
import asyncio

import sys
sys.path.append('..')

from database import db
from services import get_current_user

router = APIRouter(prefix="/backups", tags=["Backups"])

# Backup directory
BACKUP_DIR = "/app/backups"
UPLOADS_DIR = "/app/uploads"

# Ensure backup directory exists
os.makedirs(BACKUP_DIR, exist_ok=True)

# Collections that can be filtered by org_id
ORG_SCOPED_COLLECTIONS = [
    'donors', 'donations', 'blood_units', 'components', 'inventory',
    'blood_requests', 'issuances', 'screenings', 'laboratory_results',
    'qc_validations', 'storage_locations', 'custody_records', 'alerts',
    'donation_sessions', 'donor_requests'
]

# Collections only for system admin (global data)
SYSTEM_ONLY_COLLECTIONS = [
    'users', 'organizations', 'audit_logs', 'system_settings', 
    'password_policies', 'email_otps', 'user_sessions'
]


def get_user_access_level(user: dict) -> tuple:
    """Returns (access_level, org_ids) based on user type"""
    user_type = user.get("user_type", "staff")
    org_id = user.get("org_id")
    
    if user_type == "system_admin":
        return ("system", None)  # Full access
    elif user_type == "super_admin":
        return ("org", org_id)  # Org and branches
    elif user_type == "tenant_admin":
        return ("branch", org_id)  # Branch only
    else:
        return ("none", None)


class BackupInfo(BaseModel):
    id: str
    filename: str
    created_at: str
    size_mb: float
    type: str  # 'full', 'database_only', 'org_backup', 'branch_backup'
    status: str  # 'completed', 'in_progress', 'failed'
    collections: List[str]
    includes_files: bool
    created_by: str
    org_id: Optional[str] = None  # For org/branch specific backups
    org_name: Optional[str] = None
    backup_scope: str = "system"  # 'system', 'org', 'branch'


class RestoreRequest(BaseModel):
    backup_id: str
    collections: Optional[List[str]] = None  # None = full restore
    restore_files: bool = True


class BackupResponse(BaseModel):
    success: bool
    message: str
    backup_id: Optional[str] = None


def get_backup_metadata(backup_id: str) -> Optional[dict]:
    """Read backup metadata from JSON file"""
    metadata_path = os.path.join(BACKUP_DIR, backup_id, "metadata.json")
    if os.path.exists(metadata_path):
        with open(metadata_path, 'r') as f:
            return json.load(f)
    return None


def get_directory_size(path: str) -> float:
    """Get directory size in MB"""
    total_size = 0
    if os.path.exists(path):
        for dirpath, dirnames, filenames in os.walk(path):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                if os.path.exists(fp):
                    total_size += os.path.getsize(fp)
    return round(total_size / (1024 * 1024), 2)


@router.get("/collections")
async def get_collections(current_user: dict = Depends(get_current_user)):
    """Get list of database collections based on user access level"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    access_level, org_id = get_user_access_level(current_user)
    
    if access_level == "none":
        raise HTTPException(status_code=403, detail="Access denied")
    
    collections = await db.list_collection_names()
    
    # Filter collections based on access level
    if access_level != "system":
        # Non-system admins only see org-scoped collections
        collections = [c for c in collections if c in ORG_SCOPED_COLLECTIONS]
    
    # Get document counts for each collection
    collection_info = []
    for coll_name in collections:
        if access_level == "system":
            count = await db[coll_name].count_documents({})
        else:
            # Get org IDs for filtering
            if access_level == "org":
                # Super admin: get org + branches
                branches = await db.organizations.find(
                    {"parent_org_id": org_id}, {"id": 1}
                ).to_list(100)
                org_ids = [org_id] + [b["id"] for b in branches]
            else:
                # Tenant admin: only their branch
                org_ids = [org_id]
            
            # Count documents for this org scope
            count = await db[coll_name].count_documents({"org_id": {"$in": org_ids}})
        
        collection_info.append({
            "name": coll_name,
            "document_count": count
        })
    
    return collection_info


@router.post("/create", response_model=BackupResponse)
async def create_backup(
    include_files: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """Create a backup based on user's access level"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    access_level, org_id = get_user_access_level(current_user)
    
    if access_level == "none":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get org name for non-system backups
    org_name = None
    backup_scope = access_level
    org_ids = []
    
    if access_level == "org":
        org = await db.organizations.find_one({"id": org_id}, {"_id": 0, "org_name": 1})
        org_name = org.get("org_name") if org else None
        # Get org + branches
        branches = await db.organizations.find({"parent_org_id": org_id}, {"id": 1}).to_list(100)
        org_ids = [org_id] + [b["id"] for b in branches]
    elif access_level == "branch":
        org = await db.organizations.find_one({"id": org_id}, {"_id": 0, "org_name": 1})
        org_name = org.get("org_name") if org else None
        org_ids = [org_id]
    
    # Generate backup ID with timestamp
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    scope_suffix = f"_{org_id[:8]}" if org_id else ""
    backup_id = f"backup_{timestamp}{scope_suffix}"
    backup_path = os.path.join(BACKUP_DIR, backup_id)
    
    try:
        # Create backup directory
        os.makedirs(backup_path, exist_ok=True)
        db_backup_path = os.path.join(backup_path, "database")
        os.makedirs(db_backup_path, exist_ok=True)
        
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")
        
        if access_level == "system":
            # Full database backup using mongodump
            dump_path = os.path.join(backup_path, "database")
            dump_cmd = [
                "mongodump",
                f"--uri={mongo_url}",
                f"--db={db_name}",
                f"--out={dump_path}"
            ]
            
            result = subprocess.run(dump_cmd, capture_output=True, text=True)
            if result.returncode != 0:
                raise Exception(f"mongodump failed: {result.stderr}")
            
            collections = await db.list_collection_names()
        else:
            # Org/Branch specific backup - export filtered data as JSON
            collections = ORG_SCOPED_COLLECTIONS
            db_data_path = os.path.join(db_backup_path, db_name)
            os.makedirs(db_data_path, exist_ok=True)
            
            for coll_name in collections:
                # Get filtered data
                query = {"org_id": {"$in": org_ids}}
                docs = await db[coll_name].find(query, {"_id": 0}).to_list(10000)
                
                if docs:
                    # Save as JSON
                    with open(os.path.join(db_data_path, f"{coll_name}.json"), 'w') as f:
                        json.dump(docs, f, default=str)
        
        # Copy uploaded files if requested (org-scoped for non-system)
        files_copied = False
        if include_files and os.path.exists(UPLOADS_DIR):
            files_backup_path = os.path.join(backup_path, "files")
            if os.path.exists(UPLOADS_DIR) and os.listdir(UPLOADS_DIR):
                # For org/branch backups, we'd ideally filter files by org
                # For now, copy all (can be enhanced later)
                shutil.copytree(UPLOADS_DIR, files_backup_path)
                files_copied = True
        
        # Calculate backup size
        size_mb = get_directory_size(backup_path)
        
        # Determine backup type
        if access_level == "system":
            backup_type = "full" if include_files else "database_only"
        elif access_level == "org":
            backup_type = "org_backup"
        else:
            backup_type = "branch_backup"
        
        # Save metadata
        metadata = {
            "id": backup_id,
            "filename": backup_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "size_mb": size_mb,
            "type": backup_type,
            "status": "completed",
            "collections": collections if isinstance(collections, list) else list(collections),
            "includes_files": files_copied,
            "created_by": current_user.get("email", "unknown"),
            "db_name": db_name,
            "org_id": org_id,
            "org_name": org_name,
            "backup_scope": backup_scope
        }
        
        with open(os.path.join(backup_path, "metadata.json"), 'w') as f:
            json.dump(metadata, f, indent=2)
        
        # Log to audit
        await db.audit_logs.insert_one({
            "action": "backup_created",
            "module": "backups",
            "user_id": current_user.get("id"),
            "user_email": current_user.get("email"),
            "org_id": org_id,
            "details": f"Created {backup_type} backup {backup_id}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": {"backup_id": backup_id, "size_mb": size_mb, "scope": backup_scope}
        })
        
        return BackupResponse(
            success=True,
            message=f"Backup created successfully ({size_mb} MB)",
            backup_id=backup_id
        )
        
    except Exception as e:
        # Clean up failed backup
        if os.path.exists(backup_path):
            shutil.rmtree(backup_path)
        raise HTTPException(status_code=500, detail=f"Backup failed: {str(e)}")


@router.get("/list", response_model=List[BackupInfo])
async def list_backups(current_user: dict = Depends(get_current_user)):
    """List backups based on user's access level"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    access_level, org_id = get_user_access_level(current_user)
    
    if access_level == "none":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get org IDs for filtering (for super admin)
    org_ids = []
    if access_level == "org" and org_id:
        branches = await db.organizations.find({"parent_org_id": org_id}, {"id": 1}).to_list(100)
        org_ids = [org_id] + [b["id"] for b in branches]
    elif access_level == "branch" and org_id:
        org_ids = [org_id]
    
    backups = []
    
    if os.path.exists(BACKUP_DIR):
        for item in os.listdir(BACKUP_DIR):
            item_path = os.path.join(BACKUP_DIR, item)
            if os.path.isdir(item_path) and item.startswith("backup_"):
                metadata = get_backup_metadata(item)
                if metadata:
                    # Filter based on access level
                    backup_org_id = metadata.get("org_id")
                    backup_scope = metadata.get("backup_scope", "system")
                    
                    # System admin sees all
                    if access_level == "system":
                        backups.append(BackupInfo(**metadata))
                    # Super admin sees only their org and branch backups (NOT system backups)
                    elif access_level == "org":
                        if backup_scope != "system" and backup_org_id in org_ids:
                            backups.append(BackupInfo(**metadata))
                    # Tenant admin sees only their branch backups (NOT system or org backups)
                    elif access_level == "branch":
                        if backup_scope == "branch" and backup_org_id == org_id:
                            backups.append(BackupInfo(**metadata))
                else:
                    # Create basic info for backups without metadata (only visible to system admin)
                    if access_level == "system":
                        backups.append(BackupInfo(
                            id=item,
                            filename=item,
                            created_at=datetime.fromtimestamp(os.path.getctime(item_path)).isoformat(),
                            size_mb=get_directory_size(item_path),
                            type="unknown",
                            status="completed",
                            collections=[],
                            includes_files=os.path.exists(os.path.join(item_path, "files")),
                            created_by="unknown",
                            backup_scope="system"
                        ))
    
    # Sort by creation date (newest first)
    backups.sort(key=lambda x: x.created_at, reverse=True)
    return backups


async def validate_backup_access(backup_id: str, current_user: dict) -> dict:
    """Validate user has access to a specific backup and return metadata"""
    access_level, org_id = get_user_access_level(current_user)
    
    if access_level == "none":
        raise HTTPException(status_code=403, detail="Access denied")
    
    backup_path = os.path.join(BACKUP_DIR, backup_id)
    if not os.path.exists(backup_path):
        raise HTTPException(status_code=404, detail="Backup not found")
    
    metadata = get_backup_metadata(backup_id)
    if not metadata:
        if access_level != "system":
            raise HTTPException(status_code=403, detail="Access denied to this backup")
        return {"backup_path": backup_path, "metadata": None, "access_level": access_level}
    
    backup_org_id = metadata.get("org_id")
    backup_scope = metadata.get("backup_scope", "system")
    
    # Check access based on user type and backup scope
    if access_level == "system":
        pass  # Full access to all backups
    elif access_level == "org":
        # Super admin: NO access to system backups, only their org + branches
        if backup_scope == "system":
            raise HTTPException(status_code=403, detail="Access denied. System backups are only accessible by System Administrators.")
        # Get org + branches
        branches = await db.organizations.find({"parent_org_id": org_id}, {"id": 1}).to_list(100)
        org_ids = [org_id] + [b["id"] for b in branches]
        if backup_org_id not in org_ids:
            raise HTTPException(status_code=403, detail="Access denied to this backup")
    elif access_level == "branch":
        # Tenant admin: NO access to system or org backups, only their branch
        if backup_scope in ["system", "org"]:
            raise HTTPException(status_code=403, detail="Access denied. You can only access backups for your branch.")
        if backup_org_id != org_id:
            raise HTTPException(status_code=403, detail="Access denied to this backup")
    
    return {"backup_path": backup_path, "metadata": metadata, "access_level": access_level}


@router.get("/download/{backup_id}")
async def download_backup(backup_id: str, current_user: dict = Depends(get_current_user)):
    """Download a backup as a ZIP file"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    access_info = await validate_backup_access(backup_id, current_user)
    backup_path = access_info["backup_path"]
    
    # Create ZIP file
    zip_path = os.path.join(BACKUP_DIR, f"{backup_id}.zip")
    
    try:
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(backup_path):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, backup_path)
                    zipf.write(file_path, arcname)
        
        # Log download
        await db.audit_logs.insert_one({
            "action": "backup_downloaded",
            "module": "backups",
            "user_id": current_user.get("id"),
            "user_email": current_user.get("email"),
            "org_id": current_user.get("org_id"),
            "details": f"Downloaded backup {backup_id}",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        return FileResponse(
            zip_path,
            media_type="application/zip",
            filename=f"{backup_id}.zip"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create download: {str(e)}")


@router.post("/restore", response_model=BackupResponse)
async def restore_backup(
    request: RestoreRequest,
    current_user: dict = Depends(get_current_user)
):
    """Restore database from a backup (full or selective)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    access_info = await validate_backup_access(request.backup_id, current_user)
    backup_path = access_info["backup_path"]
    metadata = access_info["metadata"]
    access_level = access_info["access_level"]
    
    if not metadata:
        raise HTTPException(status_code=400, detail="Backup metadata not found")
    
    backup_scope = metadata.get("backup_scope", "system")
    
    # Only system admin can restore system-wide backups
    if backup_scope == "system" and access_level != "system":
        raise HTTPException(
            status_code=403, 
            detail="Only System Admins can restore system-wide backups. You can only restore backups created for your organization."
        )
    
    try:
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")
        dump_path = os.path.join(backup_path, "database", db_name)
        
        # Determine which collections to restore
        collections_to_restore = request.collections if request.collections else metadata.get("collections", [])
        
        # For non-system admins, filter to only org-scoped collections
        if access_level != "system":
            collections_to_restore = [c for c in collections_to_restore if c in ORG_SCOPED_COLLECTIONS]
        
        restored_collections = []
        
        for collection in collections_to_restore:
            # Check for BSON file (mongodump format)
            bson_file = os.path.join(dump_path, f"{collection}.bson")
            # Check for JSON file (org/branch backup format)
            json_file = os.path.join(dump_path, f"{collection}.json")
            
            if os.path.exists(bson_file):
                # Restore from BSON using mongorestore
                if access_level == "system":
                    # Full restore - drop and restore entire collection
                    await db[collection].drop()
                    
                    restore_cmd = [
                        "mongorestore",
                        f"--uri={mongo_url}",
                        f"--db={db_name}",
                        f"--collection={collection}",
                        bson_file
                    ]
                    
                    result = subprocess.run(restore_cmd, capture_output=True, text=True)
                    if result.returncode == 0:
                        restored_collections.append(collection)
                    else:
                        print(f"Warning: Failed to restore {collection}: {result.stderr}")
                        
            elif os.path.exists(json_file):
                # Restore from JSON (org/branch backups)
                with open(json_file, 'r') as f:
                    docs = json.load(f)
                
                if docs:
                    # For org/branch restore, delete existing docs for this org then insert
                    org_id = metadata.get("org_id")
                    if org_id:
                        await db[collection].delete_many({"org_id": org_id})
                    
                    await db[collection].insert_many(docs)
                    restored_collections.append(collection)
        
        # Restore files if requested
        files_restored = False
        if request.restore_files and metadata.get("includes_files"):
            files_backup_path = os.path.join(backup_path, "files")
            if os.path.exists(files_backup_path):
                if access_level == "system":
                    if os.path.exists(UPLOADS_DIR):
                        shutil.rmtree(UPLOADS_DIR)
                    shutil.copytree(files_backup_path, UPLOADS_DIR)
                    files_restored = True
                # For org/branch, we'd need to selectively restore files (future enhancement)
        
        # Log restore
        await db.audit_logs.insert_one({
            "action": "backup_restored",
            "module": "backups",
            "user_id": current_user.get("id"),
            "user_email": current_user.get("email"),
            "org_id": current_user.get("org_id"),
            "details": f"Restored from backup {request.backup_id}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": {
                "backup_id": request.backup_id,
                "collections_restored": restored_collections,
                "files_restored": files_restored,
                "selective": request.collections is not None
            }
        })
        
        return BackupResponse(
            success=True,
            message=f"Restored {len(restored_collections)} collections" + 
                   (f" and files" if files_restored else ""),
            backup_id=request.backup_id
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")


@router.delete("/{backup_id}", response_model=BackupResponse)
async def delete_backup(backup_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a backup (users can only delete their own org's backups)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    access_info = await validate_backup_access(backup_id, current_user)
    backup_path = access_info["backup_path"]
    metadata = access_info["metadata"]
    access_level = access_info["access_level"]
    
    # Only allow deletion of own backups (system admin can delete all)
    if access_level != "system" and metadata:
        backup_scope = metadata.get("backup_scope", "system")
        if backup_scope == "system":
            raise HTTPException(
                status_code=403, 
                detail="You cannot delete system-wide backups. Only System Admins can do that."
            )
        backup_created_by = metadata.get("created_by")
        if backup_created_by != current_user.get("email"):
            raise HTTPException(
                status_code=403,
                detail="You can only delete backups that you created"
            )
    
    zip_path = os.path.join(BACKUP_DIR, f"{backup_id}.zip")
    
    try:
        # Delete backup directory
        shutil.rmtree(backup_path)
        
        # Delete ZIP if exists
        if os.path.exists(zip_path):
            os.remove(zip_path)
        
        # Log deletion
        await db.audit_logs.insert_one({
            "action": "backup_deleted",
            "module": "backups",
            "user_id": current_user.get("id"),
            "user_email": current_user.get("email"),
            "org_id": current_user.get("org_id"),
            "details": f"Deleted backup {backup_id}",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        return BackupResponse(
            success=True,
            message="Backup deleted successfully",
            backup_id=backup_id
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")


@router.get("/{backup_id}/preview")
async def preview_backup(backup_id: str, current_user: dict = Depends(get_current_user)):
    """Preview backup contents before restoring"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    access_info = await validate_backup_access(backup_id, current_user)
    backup_path = access_info["backup_path"]
    metadata = access_info["metadata"]
    
    if not metadata:
        raise HTTPException(status_code=400, detail="Backup metadata not found")
    
    # Get collection details from backup
    db_name = metadata.get("db_name", os.environ.get("DB_NAME", "test_database"))
    dump_path = os.path.join(backup_path, "database", db_name)
    
    collection_details = []
    if os.path.exists(dump_path):
        for file in os.listdir(dump_path):
            if file.endswith(".bson") or file.endswith(".json"):
                coll_name = file.replace(".bson", "").replace(".json", "")
                file_path = os.path.join(dump_path, file)
                size_kb = round(os.path.getsize(file_path) / 1024, 2)
                collection_details.append({
                    "name": coll_name,
                    "size_kb": size_kb
                })
    
    # Check for files
    files_info = None
    files_path = os.path.join(backup_path, "files")
    if os.path.exists(files_path):
        file_count = sum(len(files) for _, _, files in os.walk(files_path))
        files_size_mb = get_directory_size(files_path)
        files_info = {
            "file_count": file_count,
            "size_mb": files_size_mb
        }
    
    return {
        "backup_id": backup_id,
        "created_at": metadata.get("created_at"),
        "created_by": metadata.get("created_by"),
        "total_size_mb": metadata.get("size_mb"),
        "backup_scope": metadata.get("backup_scope", "system"),
        "org_name": metadata.get("org_name"),
        "collections": collection_details,
        "files": files_info
    }
