from enum import Enum

# Organization Types
class OrgType(str, Enum):
    HOSPITAL_NETWORK = "hospital_network"
    BLOOD_BANK_CHAIN = "blood_bank_chain"
    STANDALONE = "standalone"
    BRANCH = "branch"

# User Types for Multi-Tenancy
class UserType(str, Enum):
    SYSTEM_ADMIN = "system_admin"  # Above all orgs
    SUPER_ADMIN = "super_admin"    # Parent org admin
    TENANT_ADMIN = "tenant_admin"  # Branch admin
    STAFF = "staff"                # Regular staff

class UserRole(str, Enum):
    ADMIN = "admin"
    REGISTRATION = "registration"
    PHLEBOTOMIST = "phlebotomist"
    LAB_TECH = "lab_tech"
    PROCESSING = "processing"
    QC_MANAGER = "qc_manager"
    INVENTORY = "inventory"
    DISTRIBUTION = "distribution"

class DonorStatus(str, Enum):
    ACTIVE = "active"
    DEFERRED_TEMPORARY = "deferred_temporary"
    DEFERRED_PERMANENT = "deferred_permanent"

class BloodGroup(str, Enum):
    A_POSITIVE = "A+"
    A_NEGATIVE = "A-"
    B_POSITIVE = "B+"
    B_NEGATIVE = "B-"
    AB_POSITIVE = "AB+"
    AB_NEGATIVE = "AB-"
    O_POSITIVE = "O+"
    O_NEGATIVE = "O-"

class DonationType(str, Enum):
    WHOLE_BLOOD = "whole_blood"
    APHERESIS = "apheresis"

class UnitStatus(str, Enum):
    COLLECTED = "collected"
    LAB = "lab"
    PROCESSING = "processing"
    QUARANTINE = "quarantine"
    HOLD = "hold"
    READY_TO_USE = "ready_to_use"
    RESERVED = "reserved"
    ISSUED = "issued"
    ISSUED_EXTERNAL = "issued_external"  # For external distributions
    RETURNED = "returned"
    DISCARDED = "discarded"
    TRANSFERRED = "transferred"  # For inter-org transfers

class ScreeningResult(str, Enum):
    NON_REACTIVE = "non_reactive"
    GRAY = "gray"
    REACTIVE = "reactive"

class ComponentType(str, Enum):
    WHOLE_BLOOD = "whole_blood"
    PRC = "prc"
    PLASMA = "plasma"
    FFP = "ffp"
    PLATELETS = "platelets"
    CRYOPRECIPITATE = "cryoprecipitate"

class RequestStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    FULFILLED = "fulfilled"
    REJECTED = "rejected"

class RequestType(str, Enum):
    INTERNAL = "internal"
    EXTERNAL = "external"

class DiscardReason(str, Enum):
    EXPIRED = "expired"
    FAILED_QC = "failed_qc"
    REJECTED_RETURN = "rejected_return"
    REACTIVE = "reactive"
    DAMAGED = "damaged"
    OTHER = "other"

class DonorRequestStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class DonorRequestType(str, Enum):
    NEW_REGISTRATION = "new_registration"
    UPDATE = "update"

# Inter-Organization Request Status
class InterOrgRequestStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    FULFILLED = "fulfilled"
    DISPATCHED = "dispatched"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

# Urgency Levels
class UrgencyLevel(str, Enum):
    ROUTINE = "routine"
    URGENT = "urgent"
    EMERGENCY = "emergency"
