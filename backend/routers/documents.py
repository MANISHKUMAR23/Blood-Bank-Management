"""
Document Management Router
Handles document upload, retrieval, and management for organizations.
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import os
import uuid
import shutil

from database import db
from models.document import (
    Document, DocumentCreate, DocumentUpdate, DocumentResponse,
    DocumentType, DocumentStatus
)
from services import get_current_user
from middleware import ReadAccess, WriteAccess, OrgAccessHelper

router = APIRouter(prefix="/documents", tags=["Documents"])

# Configuration
UPLOAD_DIR = "/app/uploads/documents"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".jpg", ".jpeg", ".png", ".gif", ".webp",
    ".txt", ".csv", ".zip"
}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "text/plain", "text/csv",
    "application/zip", "application/x-zip-compressed",
    "application/octet-stream"
}


def get_file_extension(filename: str) -> str:
    return os.path.splitext(filename)[1].lower()


def calculate_days_until_expiry(expiry_date: str) -> Optional[int]:
    if not expiry_date:
        return None
    try:
        expiry = datetime.strptime(expiry_date, "%Y-%m-%d")
        today = datetime.now()
        delta = (expiry - today).days
        return delta
    except:
        return None


def is_document_expired(expiry_date: str) -> bool:
    days = calculate_days_until_expiry(expiry_date)
    if days is None:
        return False
    return days < 0


@router.post("/{org_id}")
async def upload_document(
    org_id: str,
    file: UploadFile = File(...),
    doc_type: str = Form(default="other"),
    title: str = Form(...),
    description: str = Form(default=""),
    issue_date: str = Form(default=""),
    expiry_date: str = Form(default=""),
    issuing_authority: str = Form(default=""),
    reference_number: str = Form(default=""),
    tags: str = Form(default=""),  # Comma-separated
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(WriteAccess)
):
    """Upload a document for an organization"""
    
    # Verify org access
    if org_id not in access.org_ids:
        raise HTTPException(status_code=403, detail="No write access to this organization")
    
    # Validate file extension
    ext = get_file_extension(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Validate file size (read in chunks to check)
    file_size = 0
    chunks = []
    while True:
        chunk = await file.read(1024 * 1024)  # 1MB chunks
        if not chunk:
            break
        file_size += len(chunk)
        chunks.append(chunk)
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB")
    
    # Generate unique filename
    doc_id = str(uuid.uuid4())
    safe_filename = f"{doc_id}{ext}"
    org_upload_dir = os.path.join(UPLOAD_DIR, org_id)
    os.makedirs(org_upload_dir, exist_ok=True)
    file_path = os.path.join(org_upload_dir, safe_filename)
    
    # Write file
    with open(file_path, "wb") as f:
        for chunk in chunks:
            f.write(chunk)
    
    # Parse tags
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    
    # Create document record
    doc = {
        "id": doc_id,
        "org_id": org_id,
        "doc_type": doc_type,
        "title": title,
        "description": description or None,
        "file_name": file.filename,
        "file_path": file_path,
        "file_size": file_size,
        "mime_type": file.content_type or "application/octet-stream",
        "issue_date": issue_date or None,
        "expiry_date": expiry_date or None,
        "issuing_authority": issuing_authority or None,
        "reference_number": reference_number or None,
        "status": "active",
        "is_verified": False,
        "verified_by": None,
        "verified_at": None,
        "uploaded_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": None,
        "tags": tag_list
    }
    
    await db.documents.insert_one(doc)
    
    return {
        "status": "success",
        "message": "Document uploaded successfully",
        "document": {
            "id": doc_id,
            "title": title,
            "file_name": file.filename,
            "file_size": file_size
        }
    }


@router.get("/{org_id}")
async def get_organization_documents(
    org_id: str,
    doc_type: Optional[str] = None,
    status: Optional[str] = None,
    include_expired: bool = True,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """Get all documents for an organization"""
    
    if org_id not in access.org_ids:
        raise HTTPException(status_code=403, detail="No access to this organization")
    
    query = {"org_id": org_id}
    if doc_type:
        query["doc_type"] = doc_type
    if status:
        query["status"] = status
    
    docs = await db.documents.find(query, {"_id": 0, "file_path": 0}).sort("created_at", -1).to_list(500)
    
    # Add computed fields
    for doc in docs:
        doc["is_expired"] = is_document_expired(doc.get("expiry_date"))
        doc["days_until_expiry"] = calculate_days_until_expiry(doc.get("expiry_date"))
    
    if not include_expired:
        docs = [d for d in docs if not d.get("is_expired")]
    
    return docs


@router.get("/{org_id}/{doc_id}")
async def get_document(
    org_id: str,
    doc_id: str,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """Get a specific document's metadata"""
    
    if org_id not in access.org_ids:
        raise HTTPException(status_code=403, detail="No access to this organization")
    
    doc = await db.documents.find_one({"id": doc_id, "org_id": org_id}, {"_id": 0, "file_path": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    doc["is_expired"] = is_document_expired(doc.get("expiry_date"))
    doc["days_until_expiry"] = calculate_days_until_expiry(doc.get("expiry_date"))
    
    return doc


@router.get("/{org_id}/{doc_id}/download")
async def download_document(
    org_id: str,
    doc_id: str,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """Download a document file"""
    
    if org_id not in access.org_ids:
        raise HTTPException(status_code=403, detail="No access to this organization")
    
    doc = await db.documents.find_one({"id": doc_id, "org_id": org_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    file_path = doc.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server")
    
    return FileResponse(
        path=file_path,
        filename=doc.get("file_name"),
        media_type=doc.get("mime_type", "application/octet-stream")
    )


@router.put("/{org_id}/{doc_id}")
async def update_document(
    org_id: str,
    doc_id: str,
    updates: DocumentUpdate,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(WriteAccess)
):
    """Update document metadata"""
    
    if org_id not in access.writable_org_ids:
        raise HTTPException(status_code=403, detail="No write access to this organization")
    
    doc = await db.documents.find_one({"id": doc_id, "org_id": org_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    update_data = updates.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.documents.update_one({"id": doc_id}, {"$set": update_data})
    
    return {"status": "success", "message": "Document updated"}


@router.put("/{org_id}/{doc_id}/verify")
async def verify_document(
    org_id: str,
    doc_id: str,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(WriteAccess)
):
    """Mark a document as verified"""
    
    user_type = current_user.get("user_type", "staff")
    if user_type not in ["system_admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can verify documents")
    
    if org_id not in access.writable_org_ids:
        raise HTTPException(status_code=403, detail="No write access to this organization")
    
    doc = await db.documents.find_one({"id": doc_id, "org_id": org_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    await db.documents.update_one(
        {"id": doc_id},
        {"$set": {
            "is_verified": True,
            "verified_by": current_user["id"],
            "verified_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"status": "success", "message": "Document verified"}


@router.delete("/{org_id}/{doc_id}")
async def delete_document(
    org_id: str,
    doc_id: str,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(WriteAccess)
):
    """Delete a document"""
    
    if org_id not in access.writable_org_ids:
        raise HTTPException(status_code=403, detail="No write access to this organization")
    
    doc = await db.documents.find_one({"id": doc_id, "org_id": org_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete file from filesystem
    file_path = doc.get("file_path")
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"Warning: Could not delete file {file_path}: {e}")
    
    # Delete database record
    await db.documents.delete_one({"id": doc_id})
    
    return {"status": "success", "message": "Document deleted"}


@router.get("/{org_id}/summary/stats")
async def get_document_stats(
    org_id: str,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """Get document statistics for an organization"""
    
    if org_id not in access.org_ids:
        raise HTTPException(status_code=403, detail="No access to this organization")
    
    docs = await db.documents.find({"org_id": org_id}, {"_id": 0}).to_list(500)
    
    total = len(docs)
    verified = sum(1 for d in docs if d.get("is_verified"))
    expired = sum(1 for d in docs if is_document_expired(d.get("expiry_date")))
    expiring_soon = sum(1 for d in docs if 0 < (calculate_days_until_expiry(d.get("expiry_date")) or 999) <= 30)
    
    by_type = {}
    for doc in docs:
        doc_type = doc.get("doc_type", "other")
        by_type[doc_type] = by_type.get(doc_type, 0) + 1
    
    return {
        "total": total,
        "verified": verified,
        "unverified": total - verified,
        "expired": expired,
        "expiring_soon": expiring_soon,
        "active": total - expired,
        "by_type": by_type
    }
