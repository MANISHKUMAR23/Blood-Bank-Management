"""
Inter-Organization Blood Requests Router
Handles blood requests between organizations (internal and external).
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from database import db
from models import (
    InterOrgRequest, InterOrgRequestCreate, InterOrgRequestStatus, UrgencyLevel
)
from services import get_current_user
from middleware import ReadAccess, WriteAccess, OrgAccessHelper, require_tenant_admin_or_above

router = APIRouter(prefix="/inter-org-requests", tags=["Inter-Org Requests"])


# ============== Create Request ==============

@router.post("")
async def create_inter_org_request(
    request_data: InterOrgRequestCreate,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(WriteAccess)
):
    """
    Create a new inter-organization blood request.
    - Internal: Request from another branch in the network
    - External: Request from/to external organization
    """
    user_org_id = access.get_default_org_id()
    
    # System admins can create requests on behalf of any organization
    if not user_org_id and not access.is_system_admin():
        raise HTTPException(status_code=400, detail="User must belong to an organization")
    
    # For system admins, use the fulfilling org as the requesting org for testing purposes
    # In a real scenario, system admins would specify which org they're creating the request for
    if access.is_system_admin() and not user_org_id:
        if request_data.request_type == "internal" and request_data.fulfilling_org_id:
            user_org_id = request_data.fulfilling_org_id
        else:
            # Get the first available organization for system admin
            first_org = await db.organizations.find_one({"is_active": True}, {"id": 1, "_id": 0})
            if first_org:
                user_org_id = first_org["id"]
            else:
                raise HTTPException(status_code=400, detail="No organizations available")
    
    # Validate request type
    if request_data.request_type == "internal":
        if not request_data.fulfilling_org_id:
            raise HTTPException(status_code=400, detail="Fulfilling organization is required for internal requests")
        
        # Check if fulfilling org exists and user can access it
        fulfilling_org = await db.organizations.find_one({"id": request_data.fulfilling_org_id})
        if not fulfilling_org:
            raise HTTPException(status_code=404, detail="Fulfilling organization not found")
        
        # Check user has access to request from this org (must be in same network)
        # System admins can access any org
        if not access.is_system_admin() and not access.can_access(request_data.fulfilling_org_id):
            raise HTTPException(status_code=403, detail="Cannot request from this organization")
    
    elif request_data.request_type == "external":
        if not request_data.external_org_id and not request_data.external_org_name:
            raise HTTPException(status_code=400, detail="External organization details required")
    
    # Create request
    inter_request = InterOrgRequest(
        request_type=request_data.request_type,
        requesting_org_id=user_org_id,
        fulfilling_org_id=request_data.fulfilling_org_id,
        external_org_id=request_data.external_org_id,
        external_org_name=request_data.external_org_name,
        external_org_address=request_data.external_org_address,
        external_contact_person=request_data.external_contact_person,
        external_contact_phone=request_data.external_contact_phone,
        external_contact_email=request_data.external_contact_email,
        component_type=request_data.component_type,
        blood_group=request_data.blood_group,
        quantity=request_data.quantity,
        urgency_level=request_data.urgency_level,
        clinical_indication=request_data.clinical_indication,
        required_by=request_data.required_by,
        status=InterOrgRequestStatus.PENDING,
        created_by=current_user["id"]
    )
    
    doc = inter_request.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    if doc.get("required_by"):
        doc["required_by"] = doc["required_by"].isoformat()
    
    await db.inter_org_requests.insert_one(doc)
    
    # TODO: Send notification to fulfilling org
    
    return {
        "id": inter_request.id,
        "status": "pending",
        "message": "Blood request submitted successfully"
    }


# ============== List Requests ==============

@router.get("/incoming")
async def get_incoming_requests(
    status: Optional[str] = None,
    request_type: Optional[str] = None,
    urgency: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """
    Get incoming blood requests to user's organization.
    These are requests where current org is the fulfilling org.
    """
    user_org_id = access.get_default_org_id()
    if not user_org_id:
        return []
    
    query = {"fulfilling_org_id": user_org_id}
    
    if status:
        query["status"] = status
    if request_type:
        query["request_type"] = request_type
    if urgency:
        query["urgency_level"] = urgency
    
    requests = await db.inter_org_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Enrich with requesting org info
    for req in requests:
        requesting_org = await db.organizations.find_one(
            {"id": req.get("requesting_org_id")}, 
            {"_id": 0, "org_name": 1, "city": 1}
        )
        req["requesting_org_name"] = requesting_org.get("org_name") if requesting_org else "Unknown"
        req["requesting_org_city"] = requesting_org.get("city") if requesting_org else None
    
    return requests


@router.get("/outgoing")
async def get_outgoing_requests(
    status: Optional[str] = None,
    request_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """
    Get outgoing blood requests from user's organization.
    These are requests where current org is the requesting org.
    """
    user_org_id = access.get_default_org_id()
    if not user_org_id:
        return []
    
    query = {"requesting_org_id": user_org_id}
    
    if status:
        query["status"] = status
    if request_type:
        query["request_type"] = request_type
    
    requests = await db.inter_org_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Enrich with fulfilling org info
    for req in requests:
        if req.get("fulfilling_org_id"):
            fulfilling_org = await db.organizations.find_one(
                {"id": req.get("fulfilling_org_id")}, 
                {"_id": 0, "org_name": 1, "city": 1}
            )
            req["fulfilling_org_name"] = fulfilling_org.get("org_name") if fulfilling_org else "Unknown"
            req["fulfilling_org_city"] = fulfilling_org.get("city") if fulfilling_org else None
        elif req.get("external_org_name"):
            req["fulfilling_org_name"] = req.get("external_org_name")
    
    return requests


@router.get("/all")
async def get_all_requests(
    status: Optional[str] = None,
    request_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """
    Get all requests visible to current user (both incoming and outgoing).
    For Super/System Admin - shows all requests in accessible orgs.
    """
    user_org_id = access.get_default_org_id()
    
    # Build query based on user type
    if access.is_system_admin():
        query = {}
    elif access.is_super_admin() or access.is_tenant_admin():
        # Show requests where user's org is either requesting or fulfilling
        query = {
            "$or": [
                {"requesting_org_id": {"$in": access.org_ids}},
                {"fulfilling_org_id": {"$in": access.org_ids}}
            ]
        }
    else:
        query = {
            "$or": [
                {"requesting_org_id": user_org_id},
                {"fulfilling_org_id": user_org_id}
            ]
        }
    
    if status:
        query["status"] = status
    if request_type:
        query["request_type"] = request_type
    
    requests = await db.inter_org_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Enrich with org names
    for req in requests:
        req_org = await db.organizations.find_one({"id": req.get("requesting_org_id")}, {"_id": 0, "org_name": 1})
        req["requesting_org_name"] = req_org.get("org_name") if req_org else "Unknown"
        
        if req.get("fulfilling_org_id"):
            ful_org = await db.organizations.find_one({"id": req.get("fulfilling_org_id")}, {"_id": 0, "org_name": 1})
            req["fulfilling_org_name"] = ful_org.get("org_name") if ful_org else "Unknown"
        elif req.get("external_org_name"):
            req["fulfilling_org_name"] = req.get("external_org_name")
    
    return requests


@router.get("/{request_id}")
async def get_request_details(
    request_id: str,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """Get details of a specific request."""
    request = await db.inter_org_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Check access
    if not access.is_system_admin():
        if request.get("requesting_org_id") not in access.org_ids and \
           request.get("fulfilling_org_id") not in access.org_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Enrich with org info
    req_org = await db.organizations.find_one({"id": request.get("requesting_org_id")}, {"_id": 0})
    request["requesting_org"] = req_org
    
    if request.get("fulfilling_org_id"):
        ful_org = await db.organizations.find_one({"id": request.get("fulfilling_org_id")}, {"_id": 0})
        request["fulfilling_org"] = ful_org
    
    # Get logistics if linked
    if request.get("logistics_id"):
        logistics = await db.logistics.find_one({"id": request.get("logistics_id")}, {"_id": 0})
        request["logistics"] = logistics
    
    return request


# ============== Approve/Reject ==============

@router.post("/{request_id}/approve")
async def approve_request(
    request_id: str,
    current_user: dict = Depends(require_tenant_admin_or_above),
    access: OrgAccessHelper = Depends(WriteAccess)
):
    """Approve an incoming blood request."""
    request = await db.inter_org_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Check user is from fulfilling org
    if request.get("fulfilling_org_id") != access.get_default_org_id():
        if not access.is_system_admin():
            raise HTTPException(status_code=403, detail="Only fulfilling organization can approve")
    
    if request.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Only pending requests can be approved")
    
    # Check inventory availability
    available = await db.components.count_documents({
        "org_id": request.get("fulfilling_org_id"),
        "component_type": request.get("component_type"),
        "blood_group": request.get("blood_group"),
        "status": "ready_to_use"
    })
    
    if available < request.get("quantity", 1):
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient inventory. Available: {available}, Requested: {request.get('quantity')}"
        )
    
    await db.inter_org_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "approved",
            "approved_by": current_user["id"],
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"status": "approved", "message": "Request approved successfully"}


@router.post("/{request_id}/reject")
async def reject_request(
    request_id: str,
    data: dict,
    current_user: dict = Depends(require_tenant_admin_or_above),
    access: OrgAccessHelper = Depends(WriteAccess)
):
    """Reject an incoming blood request."""
    request = await db.inter_org_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Check user is from fulfilling org
    if request.get("fulfilling_org_id") != access.get_default_org_id():
        if not access.is_system_admin():
            raise HTTPException(status_code=403, detail="Only fulfilling organization can reject")
    
    if request.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Only pending requests can be rejected")
    
    rejection_reason = data.get("reason", "No reason provided")
    
    await db.inter_org_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "rejected",
            "rejection_reason": rejection_reason,
            "approved_by": current_user["id"],
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"status": "rejected", "message": "Request rejected"}


# ============== Fulfill Request ==============

@router.post("/{request_id}/fulfill")
async def fulfill_request(
    request_id: str,
    data: dict,
    current_user: dict = Depends(require_tenant_admin_or_above),
    access: OrgAccessHelper = Depends(WriteAccess)
):
    """
    Fulfill an approved request by selecting components and creating logistics.
    
    Expected data:
    {
        "component_ids": ["comp-1", "comp-2"],  // Selected component IDs
        "transport_method": "self_vehicle|third_party",
        "vehicle_id": "vehicle-id",  // Optional, for self_vehicle
        "courier_id": "courier-id",  // Optional, for third_party
        "expected_delivery": "2024-01-15T10:00:00Z",
        "notes": "Handling instructions"
    }
    """
    request = await db.inter_org_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    user_org_id = access.get_default_org_id()
    
    # Check user is from fulfilling org
    if request.get("fulfilling_org_id") != user_org_id:
        if not access.is_system_admin():
            raise HTTPException(status_code=403, detail="Only fulfilling organization can fulfill")
    
    if request.get("status") not in ["pending", "approved"]:
        raise HTTPException(status_code=400, detail="Only pending/approved requests can be fulfilled")
    
    component_ids = data.get("component_ids", [])
    if not component_ids:
        raise HTTPException(status_code=400, detail="Component IDs are required")
    
    # Verify components exist and are available
    components = await db.components.find({
        "id": {"$in": component_ids},
        "org_id": request.get("fulfilling_org_id"),
        "status": "ready_to_use"
    }, {"_id": 0}).to_list(100)
    
    if len(components) != len(component_ids):
        raise HTTPException(status_code=400, detail="Some components are not available or not found")
    
    # Create logistics record
    logistics_id = str(uuid.uuid4())
    logistics_doc = {
        "id": logistics_id,
        "shipment_type": "inter_org_transfer",
        "reference_id": request_id,
        "origin_org_id": request.get("fulfilling_org_id"),
        "destination_org_id": request.get("requesting_org_id"),
        "component_ids": component_ids,
        "transport_method": data.get("transport_method", "self_vehicle"),
        "vehicle_id": data.get("vehicle_id"),
        "courier_id": data.get("courier_id"),
        "expected_delivery": data.get("expected_delivery"),
        "notes": data.get("notes"),
        "status": "dispatched",
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "org_id": user_org_id
    }
    await db.logistics.insert_one(logistics_doc)
    
    # Update components status to 'transferred'
    await db.components.update_many(
        {"id": {"$in": component_ids}},
        {"$set": {
            "status": "transferred",
            "transfer_request_id": request_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update request status
    await db.inter_org_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "dispatched",
            "fulfilled_components": component_ids,
            "logistics_id": logistics_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "status": "dispatched",
        "logistics_id": logistics_id,
        "components_dispatched": len(component_ids),
        "message": "Request fulfilled and dispatched"
    }


# ============== Delivery Confirmation ==============

@router.post("/{request_id}/confirm-delivery")
async def confirm_delivery(
    request_id: str,
    data: dict,
    current_user: dict = Depends(require_tenant_admin_or_above),
    access: OrgAccessHelper = Depends(WriteAccess)
):
    """
    Confirm delivery of an inter-org transfer.
    For internal transfers, this also transfers inventory ownership.
    
    Expected data:
    {
        "delivery_proof": "base64-encoded-image-or-url",
        "received_by": "Receiver Name",
        "notes": "Delivery notes"
    }
    """
    request = await db.inter_org_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    user_org_id = access.get_default_org_id()
    
    # Check user is from requesting (receiving) org
    if request.get("requesting_org_id") != user_org_id:
        if not access.is_system_admin():
            raise HTTPException(status_code=403, detail="Only requesting organization can confirm delivery")
    
    if request.get("status") != "dispatched":
        raise HTTPException(status_code=400, detail="Only dispatched requests can be confirmed")
    
    component_ids = request.get("fulfilled_components", [])
    
    # For internal transfers - transfer component ownership
    if request.get("request_type") == "internal":
        await db.components.update_many(
            {"id": {"$in": component_ids}},
            {"$set": {
                "org_id": request.get("requesting_org_id"),
                "status": "ready_to_use",
                "transfer_completed_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Add chain of custody record
        for comp_id in component_ids:
            custody_record = {
                "id": str(uuid.uuid4()),
                "component_id": comp_id,
                "action": "inter_org_transfer",
                "from_org_id": request.get("fulfilling_org_id"),
                "to_org_id": request.get("requesting_org_id"),
                "request_id": request_id,
                "performed_by": current_user["id"],
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "notes": data.get("notes")
            }
            await db.chain_custody.insert_one(custody_record)
    else:
        # External transfer - just mark as issued
        await db.components.update_many(
            {"id": {"$in": component_ids}},
            {"$set": {
                "status": "issued_external",
                "issued_to_external": request.get("external_org_name"),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    # Update logistics status
    if request.get("logistics_id"):
        await db.logistics.update_one(
            {"id": request.get("logistics_id")},
            {"$set": {
                "status": "delivered",
                "delivered_at": datetime.now(timezone.utc).isoformat(),
                "delivery_proof": data.get("delivery_proof"),
                "received_by": data.get("received_by"),
                "delivery_notes": data.get("notes")
            }}
        )
    
    # Update request status
    await db.inter_org_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "delivered",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "status": "delivered",
        "components_received": len(component_ids),
        "message": "Delivery confirmed. Inventory updated."
    }


# ============== Cancel Request ==============

@router.post("/{request_id}/cancel")
async def cancel_request(
    request_id: str,
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(WriteAccess)
):
    """Cancel a pending or approved request (by requesting org only)."""
    request = await db.inter_org_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Check user is from requesting org
    if request.get("requesting_org_id") != access.get_default_org_id():
        if not access.is_system_admin():
            raise HTTPException(status_code=403, detail="Only requesting organization can cancel")
    
    if request.get("status") not in ["pending", "approved"]:
        raise HTTPException(status_code=400, detail="Only pending/approved requests can be cancelled")
    
    await db.inter_org_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "cancelled",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"status": "cancelled", "message": "Request cancelled"}


# ============== Dashboard Stats ==============

@router.get("/dashboard/stats")
async def get_request_dashboard_stats(
    current_user: dict = Depends(get_current_user),
    access: OrgAccessHelper = Depends(ReadAccess)
):
    """Get dashboard statistics for inter-org requests."""
    user_org_id = access.get_default_org_id()
    
    if not user_org_id and not access.is_system_admin():
        return {"incoming": {}, "outgoing": {}}
    
    # Incoming stats (as fulfilling org)
    incoming_pending = await db.inter_org_requests.count_documents({
        "fulfilling_org_id": user_org_id,
        "status": "pending"
    }) if user_org_id else 0
    
    incoming_approved = await db.inter_org_requests.count_documents({
        "fulfilling_org_id": user_org_id,
        "status": "approved"
    }) if user_org_id else 0
    
    incoming_dispatched = await db.inter_org_requests.count_documents({
        "fulfilling_org_id": user_org_id,
        "status": "dispatched"
    }) if user_org_id else 0
    
    # Outgoing stats (as requesting org)
    outgoing_pending = await db.inter_org_requests.count_documents({
        "requesting_org_id": user_org_id,
        "status": "pending"
    }) if user_org_id else 0
    
    outgoing_approved = await db.inter_org_requests.count_documents({
        "requesting_org_id": user_org_id,
        "status": "approved"
    }) if user_org_id else 0
    
    outgoing_dispatched = await db.inter_org_requests.count_documents({
        "requesting_org_id": user_org_id,
        "status": "dispatched"
    }) if user_org_id else 0
    
    # Recent requests
    recent_incoming = await db.inter_org_requests.find(
        {"fulfilling_org_id": user_org_id} if user_org_id else {},
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    return {
        "incoming": {
            "pending": incoming_pending,
            "approved": incoming_approved,
            "dispatched": incoming_dispatched,
            "total_pending_action": incoming_pending + incoming_approved
        },
        "outgoing": {
            "pending": outgoing_pending,
            "approved": outgoing_approved,
            "dispatched": outgoing_dispatched
        },
        "recent_incoming": recent_incoming
    }
