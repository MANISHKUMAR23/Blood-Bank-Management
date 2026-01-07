"""
Training Management Router
Handles training courses and staff training records.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone, timedelta

from database import db
from models.training import (
    TrainingCourse, TrainingCourseCreate, TrainingCourseUpdate,
    StaffTrainingRecord, TrainingRecordCreate, TrainingRecordUpdate,
    TrainingStatus, TrainingCategory, DEFAULT_TRAINING_COURSES
)
from services import get_current_user
from middleware import ReadAccess, WriteAccess, OrgAccessHelper

router = APIRouter(prefix="/training", tags=["Training"])


def calculate_days_until_expiry(expiry_date: str) -> Optional[int]:
    if not expiry_date:
        return None
    try:
        expiry = datetime.strptime(expiry_date, "%Y-%m-%d")
        today = datetime.now()
        return (expiry - today).days
    except:
        return None


def is_expired(expiry_date: str) -> bool:
    days = calculate_days_until_expiry(expiry_date)
    return days is not None and days < 0


# ==================== Training Courses CRUD ====================

@router.get("/courses")
async def get_training_courses(
    category: Optional[str] = None,
    mandatory_only: bool = False,
    role: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all training courses"""
    query = {"is_active": True}
    if category:
        query["category"] = category
    if mandatory_only:
        query["is_mandatory"] = True
    
    courses = await db.training_courses.find(query, {"_id": 0}).sort("name", 1).to_list(100)
    
    # Filter by role if specified
    if role:
        courses = [c for c in courses if not c.get("applicable_roles") or role in c.get("applicable_roles", [])]
    
    return courses


@router.post("/courses")
async def create_training_course(
    course: TrainingCourseCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new training course (System Admin only)"""
    if current_user.get("user_type") != "system_admin":
        raise HTTPException(status_code=403, detail="Only system admins can create training courses")
    
    course_dict = course.model_dump()
    course_dict["id"] = str(__import__("uuid").uuid4())
    course_dict["is_active"] = True
    course_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    course_dict["created_by"] = current_user["id"]
    
    await db.training_courses.insert_one(course_dict)
    
    return {"status": "success", "message": "Course created", "id": course_dict["id"]}


@router.put("/courses/{course_id}")
async def update_training_course(
    course_id: str,
    updates: TrainingCourseUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a training course (System Admin only)"""
    if current_user.get("user_type") != "system_admin":
        raise HTTPException(status_code=403, detail="Only system admins can update training courses")
    
    course = await db.training_courses.find_one({"id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    update_data = updates.model_dump(exclude_unset=True)
    if update_data:
        await db.training_courses.update_one({"id": course_id}, {"$set": update_data})
    
    return {"status": "success", "message": "Course updated"}


@router.delete("/courses/{course_id}")
async def delete_training_course(
    course_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Deactivate a training course (System Admin only)"""
    if current_user.get("user_type") != "system_admin":
        raise HTTPException(status_code=403, detail="Only system admins can delete training courses")
    
    course = await db.training_courses.find_one({"id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    await db.training_courses.update_one({"id": course_id}, {"$set": {"is_active": False}})
    
    return {"status": "success", "message": "Course deactivated"}


# ==================== Training Records ====================

@router.get("/organizations/{org_id}/records")
async def get_organization_training_records(
    org_id: str,
    user_id: Optional[str] = None,
    course_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """Get training records for an organization"""
    if org_id not in access.org_ids:
        raise HTTPException(status_code=403, detail="No access to this organization")
    
    query = {"org_id": org_id}
    if user_id:
        query["user_id"] = user_id
    if course_id:
        query["course_id"] = course_id
    if status:
        query["status"] = status
    
    records = await db.training_records.find(query, {"_id": 0}).sort("assigned_at", -1).to_list(500)
    
    # Enrich with course and user info
    course_ids = list(set(r["course_id"] for r in records))
    user_ids = list(set(r["user_id"] for r in records))
    
    courses = await db.training_courses.find({"id": {"$in": course_ids}}, {"_id": 0}).to_list(100)
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "password": 0}).to_list(500)
    
    course_map = {c["id"]: c for c in courses}
    user_map = {u["id"]: u for u in users}
    
    for record in records:
        record["course"] = course_map.get(record["course_id"])
        record["user"] = user_map.get(record["user_id"])
        
        # Check expiry
        expiry = record.get("expiry_date")
        if expiry:
            record["is_expired"] = is_expired(expiry)
            record["days_until_expiry"] = calculate_days_until_expiry(expiry)
            if record["is_expired"] and record["status"] == TrainingStatus.COMPLETED.value:
                record["status"] = TrainingStatus.EXPIRED.value
    
    return records


@router.post("/organizations/{org_id}/assign")
async def assign_training(
    org_id: str,
    record: TrainingRecordCreate,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(WriteAccess)
):
    """Assign training to a staff member"""
    if org_id not in access.org_ids:
        raise HTTPException(status_code=403, detail="No write access to this organization")
    
    # Verify user belongs to org
    user = await db.users.find_one({"id": record.user_id, "org_id": org_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found in organization")
    
    # Verify course exists
    course = await db.training_courses.find_one({"id": record.course_id, "is_active": True})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Check if already assigned
    existing = await db.training_records.find_one({
        "user_id": record.user_id,
        "course_id": record.course_id,
        "status": {"$in": [TrainingStatus.NOT_STARTED.value, TrainingStatus.IN_PROGRESS.value]}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Training already assigned to this user")
    
    record_dict = {
        "id": str(__import__("uuid").uuid4()),
        "user_id": record.user_id,
        "org_id": org_id,
        "course_id": record.course_id,
        "status": TrainingStatus.NOT_STARTED.value,
        "assigned_at": datetime.now(timezone.utc).isoformat(),
        "assigned_by": current_user["id"],
        "notes": record.notes,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.training_records.insert_one(record_dict)
    
    return {"status": "success", "message": "Training assigned", "id": record_dict["id"]}


@router.put("/records/{record_id}/start")
async def start_training(
    record_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark training as started"""
    record = await db.training_records.find_one({"id": record_id})
    if not record:
        raise HTTPException(status_code=404, detail="Training record not found")
    
    # Verify access - user can start their own training or admin can start for others
    if record["user_id"] != current_user["id"]:
        user_type = current_user.get("user_type", "staff")
        if user_type not in ["system_admin", "super_admin", "tenant_admin"]:
            raise HTTPException(status_code=403, detail="Cannot start training for another user")
    
    await db.training_records.update_one(
        {"id": record_id},
        {"$set": {
            "status": TrainingStatus.IN_PROGRESS.value,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"status": "success", "message": "Training started"}


@router.put("/records/{record_id}/complete")
async def complete_training(
    record_id: str,
    score: Optional[int] = None,
    certificate_document_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Mark training as completed"""
    record = await db.training_records.find_one({"id": record_id})
    if not record:
        raise HTTPException(status_code=404, detail="Training record not found")
    
    # Verify access - admins can mark as complete
    user_type = current_user.get("user_type", "staff")
    if user_type not in ["system_admin", "super_admin", "tenant_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can mark training as complete")
    
    # Get course for validity period
    course = await db.training_courses.find_one({"id": record["course_id"]})
    
    # Check passing score if applicable
    if course and course.get("passing_score") and score is not None:
        if score < course["passing_score"]:
            raise HTTPException(
                status_code=400, 
                detail=f"Score {score} is below passing score of {course['passing_score']}"
            )
    
    # Calculate expiry date
    expiry_date = None
    if course and course.get("validity_period_days"):
        expiry = datetime.now() + timedelta(days=course["validity_period_days"])
        expiry_date = expiry.strftime("%Y-%m-%d")
    
    update_data = {
        "status": TrainingStatus.COMPLETED.value,
        "completion_date": datetime.now(timezone.utc).isoformat(),
        "expiry_date": expiry_date,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if score is not None:
        update_data["score"] = score
    if certificate_document_id:
        update_data["certificate_document_id"] = certificate_document_id
    
    await db.training_records.update_one({"id": record_id}, {"$set": update_data})
    
    return {"status": "success", "message": "Training completed", "expiry_date": expiry_date}


@router.get("/organizations/{org_id}/summary")
async def get_training_summary(
    org_id: str,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """Get training summary/statistics for an organization"""
    if org_id not in access.org_ids:
        raise HTTPException(status_code=403, detail="No access to this organization")
    
    # Get org users
    users = await db.users.find({"org_id": org_id, "is_active": True}, {"_id": 0}).to_list(500)
    user_ids = [u["id"] for u in users]
    
    # Get all courses
    courses = await db.training_courses.find({"is_active": True}, {"_id": 0}).to_list(100)
    mandatory_courses = [c for c in courses if c.get("is_mandatory")]
    
    # Get training records
    records = await db.training_records.find({"org_id": org_id}, {"_id": 0}).to_list(1000)
    
    # Calculate stats
    total_records = len(records)
    completed = sum(1 for r in records if r.get("status") == TrainingStatus.COMPLETED.value)
    in_progress = sum(1 for r in records if r.get("status") == TrainingStatus.IN_PROGRESS.value)
    not_started = sum(1 for r in records if r.get("status") == TrainingStatus.NOT_STARTED.value)
    expired = sum(1 for r in records if r.get("expiry_date") and is_expired(r.get("expiry_date")))
    expiring_soon = sum(1 for r in records if r.get("expiry_date") and not is_expired(r.get("expiry_date")) and (calculate_days_until_expiry(r.get("expiry_date")) or 999) <= 30)
    
    # Calculate completion rate
    completion_rate = round((completed / total_records * 100) if total_records else 0, 1)
    
    # Calculate mandatory training compliance
    mandatory_compliance = 0
    for user in users:
        user_records = [r for r in records if r.get("user_id") == user["id"]]
        user_mandatory_complete = 0
        for course in mandatory_courses:
            # Check if applicable to user's role
            if course.get("applicable_roles") and user.get("role") not in course.get("applicable_roles", []):
                continue
            # Check if completed
            completed_record = next((r for r in user_records if r.get("course_id") == course["id"] and r.get("status") == TrainingStatus.COMPLETED.value), None)
            if completed_record and not is_expired(completed_record.get("expiry_date", "")):
                user_mandatory_complete += 1
    
    return {
        "total_staff": len(users),
        "total_courses": len(courses),
        "mandatory_courses": len(mandatory_courses),
        "total_assignments": total_records,
        "completed": completed,
        "in_progress": in_progress,
        "not_started": not_started,
        "expired": expired,
        "expiring_soon": expiring_soon,
        "completion_rate": completion_rate,
        "by_status": {
            "completed": completed,
            "in_progress": in_progress,
            "not_started": not_started,
            "expired": expired
        }
    }


@router.get("/users/{user_id}/records")
async def get_user_training_records(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get training records for a specific user"""
    # Verify access
    if user_id != current_user["id"]:
        user_type = current_user.get("user_type", "staff")
        if user_type not in ["system_admin", "super_admin", "tenant_admin"]:
            raise HTTPException(status_code=403, detail="Cannot view training for another user")
    
    records = await db.training_records.find({"user_id": user_id}, {"_id": 0}).sort("assigned_at", -1).to_list(100)
    
    # Enrich with course info
    course_ids = list(set(r["course_id"] for r in records))
    courses = await db.training_courses.find({"id": {"$in": course_ids}}, {"_id": 0}).to_list(100)
    course_map = {c["id"]: c for c in courses}
    
    for record in records:
        record["course"] = course_map.get(record["course_id"])
        expiry = record.get("expiry_date")
        if expiry:
            record["is_expired"] = is_expired(expiry)
            record["days_until_expiry"] = calculate_days_until_expiry(expiry)
    
    return records


# ==================== Seed Default Courses ====================

@router.post("/seed-defaults")
async def seed_default_courses(
    current_user: dict = Depends(get_current_user)
):
    """Seed default training courses (System Admin only)"""
    if current_user.get("user_type") != "system_admin":
        raise HTTPException(status_code=403, detail="Only system admins can seed courses")
    
    created = 0
    for course_data in DEFAULT_TRAINING_COURSES:
        # Check if already exists
        existing = await db.training_courses.find_one({"name": course_data["name"]})
        if not existing:
            course_dict = {
                "id": str(__import__("uuid").uuid4()),
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": current_user["id"],
                **course_data
            }
            await db.training_courses.insert_one(course_dict)
            created += 1
    
    return {"status": "success", "message": f"Created {created} training courses"}
