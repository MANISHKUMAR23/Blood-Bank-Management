"""
Configuration & Logistics Module - API Router
Handles Form Builder, Workflow Rules, Triggers, Vehicles, and System Settings
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from database import db
from services import get_current_user
from models.configuration import (
    FormConfiguration, FormConfigurationCreate, FormField, FormFieldCreate,
    WorkflowRule, WorkflowRuleCreate, RuleCondition, RuleAction,
    DatabaseTrigger, TriggerCreate,
    Vehicle, VehicleCreate,
    CourierPartner, CourierPartnerCreate,
    SystemSettings, ConfigAuditLog,
    FieldType, TriggerEvent, TriggerType, ActionType, ConditionOperator
)

router = APIRouter(prefix="/config", tags=["Configuration"])

# ==================== UTILITY FUNCTIONS ====================

async def log_config_change(config_type: str, config_id: str, action: str, 
                            old_value: dict, new_value: dict, user_id: str):
    """Log configuration changes for audit trail"""
    log_entry = ConfigAuditLog(
        config_type=config_type,
        config_id=config_id,
        action=action,
        old_value=old_value,
        new_value=new_value,
        changed_by=user_id
    )
    await db.config_audit_logs.insert_one(log_entry.model_dump())

async def generate_vehicle_id():
    """Generate unique vehicle ID"""
    count = await db.vehicles.count_documents({})
    return f"VEH-{str(count + 1).zfill(4)}"

# ==================== FORM BUILDER APIs ====================

# Default form schemas for initialization
DEFAULT_FORMS = {
    "donor_registration": [
        {"name": "donor_id", "label": "Donor ID", "field_type": "text", "required": True, "is_system_field": True, "order": 0},
        {"name": "full_name", "label": "Full Name", "field_type": "text", "required": True, "order": 1},
        {"name": "date_of_birth", "label": "Date of Birth", "field_type": "date", "required": True, "order": 2},
        {"name": "gender", "label": "Gender", "field_type": "radio", "required": True, "options": ["Male", "Female", "Other"], "order": 3},
        {"name": "blood_group", "label": "Blood Group", "field_type": "dropdown", "required": False, "is_system_field": True, "options": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"], "order": 4},
        {"name": "phone", "label": "Phone Number", "field_type": "phone", "required": True, "order": 5},
        {"name": "email", "label": "Email", "field_type": "email", "required": False, "order": 6},
        {"name": "address", "label": "Address", "field_type": "textarea", "required": True, "order": 7},
        {"name": "identity_type", "label": "Identity Type", "field_type": "dropdown", "required": True, "options": ["Aadhar", "PAN", "Passport", "Driving License", "Voter ID"], "order": 8},
        {"name": "identity_number", "label": "Identity Number", "field_type": "text", "required": True, "order": 9},
    ],
    "health_screening": [
        {"name": "weight", "label": "Weight (kg)", "field_type": "number", "required": True, "validation": {"min": 30, "max": 200}, "order": 0},
        {"name": "height", "label": "Height (cm)", "field_type": "number", "required": False, "order": 1},
        {"name": "blood_pressure_systolic", "label": "BP Systolic", "field_type": "number", "required": True, "validation": {"min": 60, "max": 250}, "order": 2},
        {"name": "blood_pressure_diastolic", "label": "BP Diastolic", "field_type": "number", "required": True, "validation": {"min": 40, "max": 150}, "order": 3},
        {"name": "pulse", "label": "Pulse (bpm)", "field_type": "number", "required": True, "validation": {"min": 40, "max": 150}, "order": 4},
        {"name": "temperature", "label": "Temperature (°C)", "field_type": "number", "required": True, "validation": {"min": 35, "max": 42}, "order": 5},
        {"name": "hemoglobin", "label": "Hemoglobin (g/dL)", "field_type": "number", "required": True, "validation": {"min": 5, "max": 20}, "order": 6},
        {"name": "health_questionnaire_passed", "label": "Health Questionnaire Passed", "field_type": "checkbox", "required": True, "order": 7},
    ],
    "collection": [
        {"name": "donation_type", "label": "Donation Type", "field_type": "dropdown", "required": True, "options": ["whole_blood", "plasma", "platelets"], "order": 0},
        {"name": "arm_used", "label": "Arm Used", "field_type": "radio", "required": True, "options": ["Left", "Right"], "order": 1},
        {"name": "bag_type", "label": "Bag Type", "field_type": "dropdown", "required": True, "options": ["Single", "Double", "Triple", "Quadruple"], "order": 2},
        {"name": "volume_collected", "label": "Volume Collected (mL)", "field_type": "number", "required": True, "validation": {"min": 100, "max": 550}, "order": 3},
        {"name": "adverse_reaction", "label": "Adverse Reaction", "field_type": "checkbox", "required": False, "order": 4},
        {"name": "reaction_details", "label": "Reaction Details", "field_type": "textarea", "required": False, "order": 5},
    ],
    "lab_tests": [
        {"name": "hiv", "label": "HIV Test", "field_type": "dropdown", "required": True, "options": ["Non-Reactive", "Reactive", "Gray"], "order": 0},
        {"name": "hbsag", "label": "HBsAg Test", "field_type": "dropdown", "required": True, "options": ["Non-Reactive", "Reactive", "Gray"], "order": 1},
        {"name": "hcv", "label": "HCV Test", "field_type": "dropdown", "required": True, "options": ["Non-Reactive", "Reactive", "Gray"], "order": 2},
        {"name": "vdrl", "label": "VDRL Test", "field_type": "dropdown", "required": True, "options": ["Non-Reactive", "Reactive", "Gray"], "order": 3},
        {"name": "malaria", "label": "Malaria Test", "field_type": "dropdown", "required": True, "options": ["Non-Reactive", "Reactive", "Gray"], "order": 4},
        {"name": "blood_grouping", "label": "Blood Grouping", "field_type": "dropdown", "required": True, "is_system_field": True, "options": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"], "order": 5},
        {"name": "crossmatch", "label": "Crossmatch", "field_type": "dropdown", "required": False, "options": ["Compatible", "Incompatible"], "order": 6},
    ],
    "component_processing": [
        {"name": "component_type", "label": "Component Type", "field_type": "dropdown", "required": True, "options": ["PRC", "Plasma", "FFP", "Platelets", "Cryoprecipitate"], "order": 0},
        {"name": "volume", "label": "Volume (mL)", "field_type": "number", "required": True, "order": 1},
        {"name": "expiry_date", "label": "Expiry Date", "field_type": "date", "required": True, "order": 2},
        {"name": "storage_location", "label": "Storage Location", "field_type": "dropdown", "required": True, "order": 3},
    ],
    "qc_validation": [
        {"name": "visual_inspection", "label": "Visual Inspection", "field_type": "dropdown", "required": True, "options": ["Pass", "Fail"], "order": 0},
        {"name": "volume_check", "label": "Volume Check", "field_type": "dropdown", "required": True, "options": ["Pass", "Fail"], "order": 1},
        {"name": "seal_integrity", "label": "Seal Integrity", "field_type": "dropdown", "required": True, "options": ["Pass", "Fail"], "order": 2},
        {"name": "labeling_check", "label": "Labeling Check", "field_type": "dropdown", "required": True, "options": ["Pass", "Fail"], "order": 3},
        {"name": "temperature_log", "label": "Temperature Log OK", "field_type": "checkbox", "required": True, "order": 4},
        {"name": "overall_result", "label": "Overall Result", "field_type": "dropdown", "required": True, "is_system_field": True, "options": ["approved", "rejected", "hold"], "order": 5},
    ],
    "blood_request": [
        {"name": "request_type", "label": "Request Type", "field_type": "dropdown", "required": True, "options": ["routine", "urgent", "emergency"], "order": 0},
        {"name": "blood_group", "label": "Blood Group Required", "field_type": "dropdown", "required": True, "options": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"], "order": 1},
        {"name": "component_type", "label": "Component Type", "field_type": "dropdown", "required": True, "options": ["Whole Blood", "PRC", "Plasma", "FFP", "Platelets"], "order": 2},
        {"name": "units_required", "label": "Units Required", "field_type": "number", "required": True, "validation": {"min": 1, "max": 20}, "order": 3},
        {"name": "patient_name", "label": "Patient Name", "field_type": "text", "required": True, "order": 4},
        {"name": "hospital", "label": "Hospital/Facility", "field_type": "text", "required": True, "order": 5},
        {"name": "required_by", "label": "Required By Date", "field_type": "date", "required": True, "order": 6},
    ],
}

@router.get("/forms")
async def get_form_configurations(current_user: dict = Depends(get_current_user)):
    """Get all form configurations"""
    forms = await db.form_configurations.find({}, {"_id": 0}).to_list(100)
    
    # If no forms exist, create defaults
    if not forms:
        for form_name, schema in DEFAULT_FORMS.items():
            form = FormConfiguration(
                form_name=form_name,
                form_schema=[FormField(**f) for f in schema],
                updated_by=current_user["id"]
            )
            await db.form_configurations.insert_one(form.model_dump())
        forms = await db.form_configurations.find({}, {"_id": 0}).to_list(100)
    
    return forms

@router.get("/forms/{form_name}")
async def get_form_configuration(form_name: str, current_user: dict = Depends(get_current_user)):
    """Get a specific form configuration"""
    form = await db.form_configurations.find_one({"form_name": form_name}, {"_id": 0})
    if not form:
        # Check if it's a default form
        if form_name in DEFAULT_FORMS:
            schema = DEFAULT_FORMS[form_name]
            form = FormConfiguration(
                form_name=form_name,
                form_schema=[FormField(**f) for f in schema],
                updated_by=current_user["id"]
            )
            await db.form_configurations.insert_one(form.model_dump())
            return form.model_dump()
        raise HTTPException(status_code=404, detail="Form not found")
    return form

@router.put("/forms/{form_name}")
async def update_form_configuration(
    form_name: str,
    form_schema: List[dict],
    current_user: dict = Depends(get_current_user)
):
    """Update form configuration (add/edit/delete/reorder fields)"""
    if current_user["role"] not in ["admin", "config_manager"]:
        raise HTTPException(status_code=403, detail="Only admins can edit form configurations")
    
    # Get existing form
    existing = await db.form_configurations.find_one({"form_name": form_name}, {"_id": 0})
    
    # Validate: system fields cannot be deleted
    if existing:
        existing_system_fields = {f["name"] for f in existing.get("form_schema", []) if f.get("is_system_field")}
        new_field_names = {f["name"] for f in form_schema}
        
        missing_system = existing_system_fields - new_field_names
        if missing_system:
            raise HTTPException(status_code=400, detail=f"Cannot delete system fields: {missing_system}")
    
    # Update fields with order
    for idx, field in enumerate(form_schema):
        field["order"] = idx
    
    update_data = {
        "form_schema": form_schema,
        "version": (existing.get("version", 0) if existing else 0) + 1,
        "updated_by": current_user["id"],
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if existing:
        await db.form_configurations.update_one(
            {"form_name": form_name},
            {"$set": update_data}
        )
        await log_config_change("form", form_name, "update", existing, update_data, current_user["id"])
    else:
        new_form = FormConfiguration(form_name=form_name, **update_data)
        await db.form_configurations.insert_one(new_form.model_dump())
        await log_config_change("form", form_name, "create", None, new_form.model_dump(), current_user["id"])
    
    return {"status": "success", "message": "Form updated successfully"}

@router.post("/forms/{form_name}/fields")
async def add_form_field(
    form_name: str,
    field: FormFieldCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a new field to a form"""
    if current_user["role"] not in ["admin", "config_manager"]:
        raise HTTPException(status_code=403, detail="Only admins can edit form configurations")
    
    form = await db.form_configurations.find_one({"form_name": form_name}, {"_id": 0})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Check for duplicate field name
    existing_names = {f["name"] for f in form.get("form_schema", [])}
    if field.name in existing_names:
        raise HTTPException(status_code=400, detail=f"Field '{field.name}' already exists")
    
    # Add field with next order
    max_order = max((f.get("order", 0) for f in form.get("form_schema", [])), default=-1)
    new_field = field.model_dump()
    new_field["order"] = max_order + 1
    new_field["is_system_field"] = False
    
    await db.form_configurations.update_one(
        {"form_name": form_name},
        {
            "$push": {"form_schema": new_field},
            "$set": {"updated_by": current_user["id"], "updated_at": datetime.now(timezone.utc).isoformat()},
            "$inc": {"version": 1}
        }
    )
    
    return {"status": "success", "field": new_field}

# ==================== WORKFLOW RULES APIs ====================

@router.get("/rules")
async def get_workflow_rules(
    module: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all workflow rules"""
    query = {}
    if module:
        query["module"] = module
    if is_active is not None:
        query["is_active"] = is_active
    
    rules = await db.workflow_rules.find(query, {"_id": 0}).sort("priority", -1).to_list(1000)
    return rules

@router.get("/rules/{rule_id}")
async def get_workflow_rule(rule_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific workflow rule"""
    rule = await db.workflow_rules.find_one({"id": rule_id}, {"_id": 0})
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule

@router.post("/rules")
async def create_workflow_rule(
    rule: WorkflowRuleCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new workflow rule"""
    if current_user["role"] not in ["admin", "config_manager"]:
        raise HTTPException(status_code=403, detail="Only admins can create workflow rules")
    
    new_rule = WorkflowRule(
        **rule.model_dump(),
        created_by=current_user["id"]
    )
    
    await db.workflow_rules.insert_one(new_rule.model_dump())
    await log_config_change("rule", new_rule.id, "create", None, new_rule.model_dump(), current_user["id"])
    
    return {"status": "success", "rule_id": new_rule.id}

@router.put("/rules/{rule_id}")
async def update_workflow_rule(
    rule_id: str,
    rule: WorkflowRuleCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update a workflow rule"""
    if current_user["role"] not in ["admin", "config_manager"]:
        raise HTTPException(status_code=403, detail="Only admins can edit workflow rules")
    
    existing = await db.workflow_rules.find_one({"id": rule_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    update_data = rule.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.workflow_rules.update_one(
        {"id": rule_id},
        {"$set": update_data}
    )
    
    await log_config_change("rule", rule_id, "update", existing, update_data, current_user["id"])
    
    return {"status": "success"}

@router.post("/rules/{rule_id}/duplicate")
async def duplicate_workflow_rule(
    rule_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Duplicate a workflow rule"""
    if current_user["role"] not in ["admin", "config_manager"]:
        raise HTTPException(status_code=403, detail="Only admins can duplicate workflow rules")
    
    existing = await db.workflow_rules.find_one({"id": rule_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    # Create copy
    new_rule = {**existing}
    new_rule["id"] = str(uuid.uuid4())
    new_rule["rule_name"] = f"{existing['rule_name']} (Copy)"
    new_rule["is_active"] = False  # Duplicates start inactive
    new_rule["created_by"] = current_user["id"]
    new_rule["created_at"] = datetime.now(timezone.utc).isoformat()
    new_rule.pop("updated_at", None)
    
    await db.workflow_rules.insert_one(new_rule)
    
    return {"status": "success", "rule_id": new_rule["id"]}

@router.put("/rules/{rule_id}/toggle")
async def toggle_workflow_rule(
    rule_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Toggle workflow rule active status"""
    if current_user["role"] not in ["admin", "config_manager"]:
        raise HTTPException(status_code=403, detail="Only admins can toggle workflow rules")
    
    existing = await db.workflow_rules.find_one({"id": rule_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    new_status = not existing.get("is_active", True)
    
    await db.workflow_rules.update_one(
        {"id": rule_id},
        {"$set": {"is_active": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    action = "activate" if new_status else "deactivate"
    await log_config_change("rule", rule_id, action, existing, {"is_active": new_status}, current_user["id"])
    
    return {"status": "success", "is_active": new_status}

@router.delete("/rules/{rule_id}")
async def delete_workflow_rule(
    rule_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a workflow rule"""
    if current_user["role"] not in ["admin", "config_manager"]:
        raise HTTPException(status_code=403, detail="Only admins can delete workflow rules")
    
    existing = await db.workflow_rules.find_one({"id": rule_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    await db.workflow_rules.delete_one({"id": rule_id})
    await log_config_change("rule", rule_id, "delete", existing, None, current_user["id"])
    
    return {"status": "success"}

# ==================== TRIGGERS APIs ====================

@router.get("/triggers")
async def get_triggers(
    table_name: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all triggers"""
    query = {}
    if table_name:
        query["table_name"] = table_name
    
    triggers = await db.triggers.find(query, {"_id": 0}).to_list(1000)
    return triggers

@router.post("/triggers")
async def create_trigger(
    trigger: TriggerCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new trigger"""
    if current_user["role"] not in ["admin", "config_manager"]:
        raise HTTPException(status_code=403, detail="Only admins can create triggers")
    
    new_trigger = DatabaseTrigger(**trigger.model_dump())
    await db.triggers.insert_one(new_trigger.model_dump())
    
    return {"status": "success", "trigger_id": new_trigger.id}

@router.put("/triggers/{trigger_id}/toggle")
async def toggle_trigger(
    trigger_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Toggle trigger active status"""
    if current_user["role"] not in ["admin", "config_manager"]:
        raise HTTPException(status_code=403, detail="Only admins can toggle triggers")
    
    existing = await db.triggers.find_one({"id": trigger_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Trigger not found")
    
    new_status = not existing.get("is_active", True)
    
    await db.triggers.update_one(
        {"id": trigger_id},
        {"$set": {"is_active": new_status}}
    )
    
    return {"status": "success", "is_active": new_status}

@router.delete("/triggers/{trigger_id}")
async def delete_trigger(
    trigger_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a trigger"""
    if current_user["role"] not in ["admin", "config_manager"]:
        raise HTTPException(status_code=403, detail="Only admins can delete triggers")
    
    await db.triggers.delete_one({"id": trigger_id})
    return {"status": "success"}

# ==================== VEHICLES APIs ====================

@router.get("/vehicles")
async def get_vehicles(
    is_active: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all vehicles"""
    query = {}
    if is_active is not None:
        query["is_active"] = is_active
    
    vehicles = await db.vehicles.find(query, {"_id": 0}).to_list(1000)
    return vehicles

@router.post("/vehicles")
async def create_vehicle(
    vehicle: VehicleCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new vehicle"""
    if current_user["role"] not in ["admin", "config_manager", "distribution"]:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Check duplicate registration
    existing = await db.vehicles.find_one({"registration_number": vehicle.registration_number})
    if existing:
        raise HTTPException(status_code=400, detail="Vehicle with this registration already exists")
    
    new_vehicle = Vehicle(
        **vehicle.model_dump(),
        vehicle_id=await generate_vehicle_id()
    )
    
    await db.vehicles.insert_one(new_vehicle.model_dump())
    await log_config_change("vehicle", new_vehicle.id, "create", None, new_vehicle.model_dump(), current_user["id"])
    
    return {"status": "success", "vehicle_id": new_vehicle.vehicle_id, "id": new_vehicle.id}

@router.put("/vehicles/{vehicle_id}")
async def update_vehicle(
    vehicle_id: str,
    vehicle: VehicleCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update a vehicle"""
    if current_user["role"] not in ["admin", "config_manager", "distribution"]:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    existing = await db.vehicles.find_one(
        {"$or": [{"id": vehicle_id}, {"vehicle_id": vehicle_id}]},
        {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    update_data = vehicle.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.vehicles.update_one(
        {"$or": [{"id": vehicle_id}, {"vehicle_id": vehicle_id}]},
        {"$set": update_data}
    )
    
    await log_config_change("vehicle", vehicle_id, "update", existing, update_data, current_user["id"])
    
    return {"status": "success"}

@router.put("/vehicles/{vehicle_id}/toggle")
async def toggle_vehicle(
    vehicle_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Toggle vehicle active status"""
    if current_user["role"] not in ["admin", "config_manager", "distribution"]:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    existing = await db.vehicles.find_one(
        {"$or": [{"id": vehicle_id}, {"vehicle_id": vehicle_id}]},
        {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    new_status = not existing.get("is_active", True)
    
    await db.vehicles.update_one(
        {"$or": [{"id": vehicle_id}, {"vehicle_id": vehicle_id}]},
        {"$set": {"is_active": new_status}}
    )
    
    action = "activate" if new_status else "deactivate"
    await log_config_change("vehicle", vehicle_id, action, existing, {"is_active": new_status}, current_user["id"])
    
    return {"status": "success", "is_active": new_status}

# ==================== COURIER PARTNERS APIs ====================

@router.get("/couriers")
async def get_courier_partners(
    is_active: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all courier partners"""
    query = {}
    if is_active is not None:
        query["is_active"] = is_active
    
    couriers = await db.courier_partners.find(query, {"_id": 0}).to_list(1000)
    return couriers

@router.post("/couriers")
async def create_courier_partner(
    courier: CourierPartnerCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new courier partner"""
    if current_user["role"] not in ["admin", "config_manager", "distribution"]:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    new_courier = CourierPartner(**courier.model_dump())
    await db.courier_partners.insert_one(new_courier.model_dump())
    
    return {"status": "success", "courier_id": new_courier.id}

@router.put("/couriers/{courier_id}")
async def update_courier_partner(
    courier_id: str,
    courier: CourierPartnerCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update a courier partner"""
    if current_user["role"] not in ["admin", "config_manager", "distribution"]:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    existing = await db.courier_partners.find_one({"id": courier_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Courier partner not found")
    
    await db.courier_partners.update_one(
        {"id": courier_id},
        {"$set": courier.model_dump()}
    )
    
    return {"status": "success"}

@router.put("/couriers/{courier_id}/toggle")
async def toggle_courier_partner(
    courier_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Toggle courier partner active status"""
    existing = await db.courier_partners.find_one({"id": courier_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Courier partner not found")
    
    new_status = not existing.get("is_active", True)
    
    await db.courier_partners.update_one(
        {"id": courier_id},
        {"$set": {"is_active": new_status}}
    )
    
    return {"status": "success", "is_active": new_status}

# ==================== SYSTEM SETTINGS APIs ====================

@router.get("/settings")
async def get_system_settings(current_user: dict = Depends(get_current_user)):
    """Get system settings"""
    settings = await db.system_settings.find_one({"id": "system_settings"}, {"_id": 0})
    if not settings:
        # Create default settings
        default = SystemSettings()
        await db.system_settings.insert_one(default.model_dump())
        return default.model_dump()
    return settings

@router.put("/settings")
async def update_system_settings(
    settings: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update system settings"""
    if current_user["role"] not in ["admin", "config_manager"]:
        raise HTTPException(status_code=403, detail="Only admins can update system settings")
    
    existing = await db.system_settings.find_one({"id": "system_settings"}, {"_id": 0})
    
    settings["id"] = "system_settings"
    settings["updated_by"] = current_user["id"]
    settings["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.system_settings.update_one(
        {"id": "system_settings"},
        {"$set": settings},
        upsert=True
    )
    
    await log_config_change("settings", "system_settings", "update", existing, settings, current_user["id"])
    
    return {"status": "success"}

# ==================== AUDIT LOG APIs ====================

@router.get("/audit-logs")
async def get_audit_logs(
    config_type: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    current_user: dict = Depends(get_current_user)
):
    """Get configuration audit logs"""
    if current_user["role"] not in ["admin", "config_manager"]:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    query = {}
    if config_type:
        query["config_type"] = config_type
    
    logs = await db.config_audit_logs.find(query, {"_id": 0}).sort("changed_at", -1).to_list(limit)
    return logs

# ==================== ENUMS/OPTIONS APIs ====================

@router.get("/enums")
async def get_config_enums():
    """Get available enum values for configuration UI"""
    return {
        "field_types": [e.value for e in FieldType],
        "trigger_events": [e.value for e in TriggerEvent],
        "trigger_types": [e.value for e in TriggerType],
        "condition_operators": [e.value for e in ConditionOperator],
        "action_types": [e.value for e in ActionType],
        "modules": ["donor", "screening", "collection", "lab", "inventory", "request", "processing", "qc"],
        "tables": ["donors", "screenings", "donations", "blood_units", "lab_tests", "components", "inventory", "requests", "issuances"]
    }

# ==================== CUSTOM STORAGE TYPES APIs ====================

# Default storage types
DEFAULT_STORAGE_TYPES = [
    {"type_code": "refrigerator", "type_name": "Refrigerator", "default_temp_range": "2-6°C", "icon": "🧊", "color": "blue", "suitable_for": ["whole_blood", "prc"], "is_system": True},
    {"type_code": "freezer", "type_name": "Freezer", "default_temp_range": "-25 to -30°C", "icon": "❄️", "color": "indigo", "suitable_for": ["plasma", "ffp", "cryoprecipitate"], "is_system": True},
    {"type_code": "platelet_incubator", "type_name": "Platelet Incubator", "default_temp_range": "20-24°C", "icon": "🔬", "color": "amber", "suitable_for": ["platelets"], "is_system": True},
    {"type_code": "quarantine_area", "type_name": "Quarantine Area", "default_temp_range": "Variable", "icon": "⚠️", "color": "red", "suitable_for": ["quarantine"], "is_system": True},
]

@router.get("/storage-types")
async def get_storage_types(
    is_active: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all storage types (default + custom)"""
    # Get custom types from database
    query = {}
    if is_active is not None:
        query["is_active"] = is_active
    
    custom_types = await db.custom_storage_types.find(query, {"_id": 0}).to_list(100)
    
    # Combine with default types
    all_types = []
    
    # Add default types first
    for dt in DEFAULT_STORAGE_TYPES:
        all_types.append({
            **dt,
            "id": dt["type_code"],
            "is_active": True,
            "is_custom": False
        })
    
    # Add custom types
    for ct in custom_types:
        ct["is_custom"] = True
        all_types.append(ct)
    
    return all_types

@router.get("/storage-types/{type_code}")
async def get_storage_type(type_code: str, current_user: dict = Depends(get_current_user)):
    """Get a specific storage type"""
    # Check default types first
    for dt in DEFAULT_STORAGE_TYPES:
        if dt["type_code"] == type_code:
            return {**dt, "id": dt["type_code"], "is_active": True, "is_custom": False}
    
    # Check custom types
    custom = await db.custom_storage_types.find_one({"type_code": type_code}, {"_id": 0})
    if custom:
        custom["is_custom"] = True
        return custom
    
    raise HTTPException(status_code=404, detail="Storage type not found")

@router.post("/storage-types")
async def create_storage_type(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Create a new custom storage type"""
    if current_user["role"] not in ["admin", "config_manager", "inventory"]:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    type_code = data.get("type_code", "")
    type_name = data.get("type_name", "")
    default_temp_range = data.get("default_temp_range", "")
    description = data.get("description")
    icon = data.get("icon", "📦")
    color = data.get("color", "slate")
    suitable_for = data.get("suitable_for", [])
    
    if not type_code or not type_name or not default_temp_range:
        raise HTTPException(status_code=400, detail="type_code, type_name, and default_temp_range are required")
    
    # Normalize type_code
    type_code = type_code.lower().replace(" ", "_").replace("-", "_")
    
    # Check if type_code already exists in defaults
    for dt in DEFAULT_STORAGE_TYPES:
        if dt["type_code"] == type_code:
            raise HTTPException(status_code=400, detail=f"Storage type '{type_code}' already exists as a default type")
    
    # Check if type_code already exists in custom types
    existing = await db.custom_storage_types.find_one({"type_code": type_code})
    if existing:
        raise HTTPException(status_code=400, detail=f"Storage type '{type_code}' already exists")
    
    new_type = {
        "id": str(uuid.uuid4()),
        "type_code": type_code,
        "type_name": type_name,
        "description": description,
        "default_temp_range": default_temp_range,
        "icon": icon,
        "color": color,
        "suitable_for": suitable_for or [],
        "is_active": True,
        "is_custom": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.custom_storage_types.insert_one(new_type)
    await log_config_change("storage_type", type_code, "create", None, new_type, current_user["id"])
    
    return {"status": "success", "storage_type": new_type}

@router.put("/storage-types/{type_code}")
async def update_storage_type(
    type_code: str,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update a custom storage type"""
    if current_user["role"] not in ["admin", "config_manager", "inventory"]:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Check if it's a default type
    for dt in DEFAULT_STORAGE_TYPES:
        if dt["type_code"] == type_code:
            raise HTTPException(status_code=400, detail="Cannot modify default storage types")
    
    existing = await db.custom_storage_types.find_one({"type_code": type_code}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Custom storage type not found")
    
    update_data = {}
    if data.get("type_name") is not None:
        update_data["type_name"] = data["type_name"]
    if data.get("default_temp_range") is not None:
        update_data["default_temp_range"] = data["default_temp_range"]
    if data.get("description") is not None:
        update_data["description"] = data["description"]
    if data.get("icon") is not None:
        update_data["icon"] = data["icon"]
    if data.get("color") is not None:
        update_data["color"] = data["color"]
    if data.get("suitable_for") is not None:
        update_data["suitable_for"] = data["suitable_for"]
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.custom_storage_types.update_one(
            {"type_code": type_code},
            {"$set": update_data}
        )
        await log_config_change("storage_type", type_code, "update", existing, update_data, current_user["id"])
    
    return {"status": "success"}

@router.put("/storage-types/{type_code}/toggle")
async def toggle_storage_type(
    type_code: str,
    current_user: dict = Depends(get_current_user)
):
    """Toggle custom storage type active status"""
    if current_user["role"] not in ["admin", "config_manager", "inventory"]:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Check if it's a default type
    for dt in DEFAULT_STORAGE_TYPES:
        if dt["type_code"] == type_code:
            raise HTTPException(status_code=400, detail="Cannot deactivate default storage types")
    
    existing = await db.custom_storage_types.find_one({"type_code": type_code}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Custom storage type not found")
    
    new_status = not existing.get("is_active", True)
    
    await db.custom_storage_types.update_one(
        {"type_code": type_code},
        {"$set": {"is_active": new_status}}
    )
    
    action = "activate" if new_status else "deactivate"
    await log_config_change("storage_type", type_code, action, existing, {"is_active": new_status}, current_user["id"])
    
    return {"status": "success", "is_active": new_status}

@router.delete("/storage-types/{type_code}")
async def delete_storage_type(
    type_code: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a custom storage type"""
    if current_user["role"] not in ["admin", "config_manager"]:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Check if it's a default type
    for dt in DEFAULT_STORAGE_TYPES:
        if dt["type_code"] == type_code:
            raise HTTPException(status_code=400, detail="Cannot delete default storage types")
    
    existing = await db.custom_storage_types.find_one({"type_code": type_code}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Custom storage type not found")
    
    # Check if any storage locations use this type
    in_use = await db.storage_locations.count_documents({"storage_type": type_code})
    if in_use > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete: {in_use} storage locations use this type")
    
    await db.custom_storage_types.delete_one({"type_code": type_code})
    await log_config_change("storage_type", type_code, "delete", existing, None, current_user["id"])
    
    return {"status": "success"}
