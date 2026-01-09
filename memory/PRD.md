# Blood Bank Management System (BBMS) - Product Requirements Document

## Original Problem Statement
Build a comprehensive Blood Bank Management System with multi-tenancy support, featuring:
1. Multi-Tenancy System (Blood Bank Network) - Organizations, branches, hierarchical roles
2. Security, Audit, Compliance & Admin Enhancements - Audit logs, context switching, user management

## Core Architecture

### Tech Stack
- **Backend**: FastAPI (Python)
- **Frontend**: React with Shadcn/UI components
- **Database**: MongoDB
- **Authentication**: JWT tokens with role-based access

### User Role Hierarchy (4-tier)
1. **System Admin** - Global access, manages all organizations
2. **Super Admin** - Organization-level, manages own org + child branches
3. **Tenant Admin** - Branch-level management
4. **Staff** - Standard operations within assigned branch

### Key Database Collections
- `organizations` - Organization hierarchy
- `users` - User accounts with org_id and user_type
- `audit_logs` - Comprehensive audit trail
- `user_sessions` - Session tracking for context switching
- `donors`, `donations`, `screenings`, `blood_units`, `components`, etc.

---

## What's Been Implemented

### Phase 1-4: Multi-Tenancy System (COMPLETE)
- [x] Organization CRUD operations
- [x] Parent-child organization hierarchy
- [x] Role-based access control with 4-tier hierarchy
- [x] System Admin and Super Admin login flows
- [x] Network Dashboard for system-wide overview
- [x] Inter-Organization Blood Requests module

### Phase A: Audit Logs System (COMPLETE)
- [x] Backend audit service (`/app/backend/services/audit_service.py`)
- [x] Audit log router (`/app/backend/routers/audit_logs.py`)
- [x] Authentication event logging (login, failed login)
- [x] Frontend Audit Logs page (`/app/frontend/src/pages/AuditLogs.js`)

### Phase B: Context Switching & Session Management (COMPLETE - Jan 7, 2026)
- [x] Session model (`/app/backend/models/session.py`)
- [x] Sessions router (`/app/backend/routers/sessions.py`)
  - `GET /api/sessions/context` - Get current context
  - `GET /api/sessions/switchable-contexts` - Get available orgs to switch to
  - `POST /api/sessions/switch-context` - Switch to another org
  - `POST /api/sessions/exit-context` - Return to original context
- [x] JWT tokens with impersonation flags (is_impersonating, actual_user_type)
- [x] Frontend context switching UI in Layout.js
- [x] Impersonation banner with "Exit Context" button
- [x] AuthContext.js with switchContext and exitContext functions
- [x] **RLS respects impersonation context** - When switched, user only sees target org's data
- [x] Dashboard refreshes on context switch to show filtered data

### Row-Level Security (RLS) Implementation (COMPLETE - Jan 7, 2026)
- [x] `donors.py` - Uses ReadAccess/WriteAccess middleware
- [x] `inventory.py` - Uses ReadAccess middleware
- [x] `donations.py` - Uses ReadAccess/WriteAccess middleware
- [x] `screening.py` - Uses ReadAccess/WriteAccess middleware
- [x] `blood_units.py` - Uses ReadAccess/WriteAccess middleware
- [x] `requests.py` - Uses ReadAccess/WriteAccess middleware
- [x] `storage.py` - Uses ReadAccess/WriteAccess middleware
- [x] `components.py` - Uses ReadAccess/WriteAccess middleware
- [x] `laboratory.py` - Uses ReadAccess/WriteAccess middleware
- [x] `disposition.py` (returns/discards) - Uses ReadAccess/WriteAccess middleware
- [x] `logistics.py` - Uses ReadAccess/WriteAccess middleware
- [x] `dashboard.py` - Uses ReadAccess middleware

### Phase C: Org & User Management (COMPLETE - Jan 7, 2026)
- [x] Combined creation endpoint: `POST /organizations/with-admin` - Creates org + super_admin
- [x] Combined creation endpoint: `POST /organizations/{id}/branches/with-admin` - Creates branch + tenant_admin
- [x] User management: `GET/POST/PUT/DELETE /organizations/{id}/users`
- [x] Frontend: "Add Organization + Admin" dialog with org details + admin details
- [x] Frontend: "Add Branch with Admin" button on parent orgs
- [x] Frontend: "Add User" button on each organization
- [x] Frontend: Users list in organization details dialog

### Phase D: Interactive Dashboards (COMPLETE - Jan 7, 2026)
- [x] **Main Dashboard** - All stat cards clickable with navigation to respective pages
- [x] **Network Dashboard Enhanced**:
  - [x] Quick Actions bar for System Admins (Add Org, Audit Logs, Manage Transfers)
  - [x] All 5 stat cards clickable with navigation
  - [x] Branch Overview table with clickable rows
  - [x] Inventory Distribution with clickable blood group cards
  - [x] Transfer Activity with clickable transfer rows
  - [x] Recent Activity feed showing audit log events
  - [x] Tab interface for different views (Overview, Inventory, Transfers)

### Phase E: Interactive Org & Branch Detail Pages (COMPLETE - Jan 7, 2026)
- [x] **Organization Detail Page** (`/organizations/:orgId`):
  - [x] Overview tab with org details and contact information
  - [x] Users tab with full user management (add, edit, deactivate)
  - [x] Inventory tab showing blood group distribution and stats
  - [x] Branches tab (for parent orgs) listing child branches with navigation
  - [x] Activity tab showing org-specific audit logs
  - [x] Edit organization dialog
  - [x] Add/Edit user dialogs with role and type selection
- [x] Navigation from Organizations list to detail page
- [x] Back navigation to Organizations list

### Phase F: Document Management (COMPLETE - Jan 7, 2026)
- [x] **Backend Document API** (`/app/backend/routers/documents.py`):
  - [x] `POST /api/documents/{org_id}` - Upload document with metadata
  - [x] `GET /api/documents/{org_id}` - List org documents with filters
  - [x] `GET /api/documents/{org_id}/{doc_id}` - Get single document metadata
  - [x] `GET /api/documents/{org_id}/{doc_id}/download` - Download document file
  - [x] `PUT /api/documents/{org_id}/{doc_id}/verify` - Verify document (admin only)
  - [x] `DELETE /api/documents/{org_id}/{doc_id}` - Delete document
  - [x] `GET /api/documents/{org_id}/summary/stats` - Document statistics
- [x] **Frontend Documents Tab** in OrganizationDetail page:
  - [x] Document stats cards (Total, Verified, Pending, Expiring Soon, Expired)
  - [x] Documents table with title, type, expiry, status, actions
  - [x] Upload Document dialog with full metadata fields
  - [x] Download, verify, and delete actions
  - [x] Empty state with upload prompt
- [x] File validation: extensions (.pdf, .doc, .docx, .xls, .xlsx, etc.), max 10MB
- [x] RLS enforced via OrgAccessHelper middleware

### Phase G: Compliance & Training Modules (COMPLETE - Jan 7, 2026)
- [x] **Compliance Backend API** (`/app/backend/routers/compliance.py`):
  - [x] `GET /api/compliance/requirements` - List all compliance requirements
  - [x] `POST /api/compliance/requirements` - Create requirement (system admin)
  - [x] `POST /api/compliance/seed-defaults` - Seed 6 default requirements
  - [x] `GET /api/compliance/organizations/{org_id}` - Get org compliance status
  - [x] `POST /api/compliance/organizations/{org_id}` - Update org compliance
  - [x] `POST /api/compliance/organizations/{org_id}/link-document` - Link document to compliance
  - [x] `GET /api/compliance/organizations/{org_id}/summary` - Compliance statistics
- [x] **Training Backend API** (`/app/backend/routers/training.py`):
  - [x] `GET /api/training/courses` - List all training courses
  - [x] `POST /api/training/courses` - Create course (system admin)
  - [x] `POST /api/training/seed-defaults` - Seed 8 default courses
  - [x] `GET /api/training/organizations/{org_id}/records` - Get training records
  - [x] `POST /api/training/organizations/{org_id}/assign` - Assign training to staff
  - [x] `PUT /api/training/records/{id}/start` - Start training
  - [x] `PUT /api/training/records/{id}/complete` - Complete training with score
  - [x] `GET /api/training/organizations/{org_id}/summary` - Training statistics
- [x] **Frontend Compliance Tab** in OrganizationDetail:
  - [x] Stats cards (Requirements, Compliant, Pending, Expiring Soon, Compliance Rate)
  - [x] Requirements table with status, expiry, document linking
  - [x] Mark compliant and link document actions
- [x] **Frontend Training Tab** in OrganizationDetail:
  - [x] Stats cards (Assignments, Completed, In Progress, Not Started, Completion Rate)
  - [x] Training records table with staff, course, status, progress
  - [x] Assign Training dialog with user/course selection
  - [x] Start and Complete training actions
- [x] Pre-seeded data: 6 compliance requirements, 8 training courses

---

### Phase H: Full Security Suite (COMPLETE - Jan 7, 2026)
- [x] **Password Policy** (`/app/backend/routers/security.py`):
  - [x] Configurable requirements (min length, uppercase, lowercase, numbers, special chars)
  - [x] Password expiry (max_age_days)
  - [x] Account lockout (max_failed_attempts, lockout_duration_minutes)
  - [x] Password validation API
  - [x] System-wide and org-specific policies
- [x] **Multi-Factor Authentication (MFA)**:
  - [x] TOTP setup with QR code generation (Google Authenticator/Authy compatible)
  - [x] Email OTP as backup method (MOCKED - prints to console)
  - [x] 10 backup recovery codes
  - [x] MFA enable/disable/status
  - [x] Admin can enforce MFA for users
- [x] **Session Management**:
  - [x] Active session tracking
  - [x] Revoke single session or all sessions
  - [x] Session configuration (timeout, max concurrent)
- [x] **API Key Management**:
  - [x] Create API keys with scopes (read/write/admin)
  - [x] List, revoke API keys
  - [x] Key prefix (bbk_) and secure hashing
  - [x] Expiry and usage tracking
- [x] **Frontend Security Settings Page** (`/app/frontend/src/pages/SecuritySettings.js`):
  - [x] MFA tab with setup dialog, QR code, backup codes
  - [x] Sessions tab with active session list
  - [x] Password Policy tab (admin only) with editable settings
  - [x] API Keys tab (org users) with create/revoke

### Phase I: Data Backup & Recovery (COMPLETE - Jan 9, 2026)
- [x] **Backend Backup API** (`/app/backend/routers/backups.py`):
  - [x] `POST /api/backups/create` - Create backup (role-scoped)
  - [x] `GET /api/backups/list` - List accessible backups
  - [x] `GET /api/backups/collections` - List collections for backup
  - [x] `POST /api/backups/restore` - Restore from backup
  - [x] `DELETE /api/backups/{backup_id}` - Delete backup
  - [x] `GET /api/backups/{backup_id}/preview` - Preview backup contents
  - [x] `GET /api/backups/download/{backup_id}` - Download backup as ZIP
- [x] **Role-Based Access Control**:
  - [x] System Admin: Full system-wide backups using mongodump/mongorestore
  - [x] Super Admin: Org + branches data as filtered JSON (cannot see system backups)
  - [x] Tenant Admin: Branch-only data as filtered JSON (cannot see system/org backups)
- [x] **Frontend Backup Management Page** (`/app/frontend/src/pages/BackupManagement.js`):
  - [x] Create backup with optional file inclusion
  - [x] Backup list with scope, size, creation date
  - [x] Preview backup contents before restore
  - [x] Selective restore by collections
  - [x] Download backup as ZIP
  - [x] Delete backups (own backups only for non-system admins)
- [x] Backups stored locally at `/app/backups/`
- [x] Audit logging for all backup operations

### UI/UX Fixes (COMPLETE - Jan 9, 2026)
- [x] Blood Request form dialog made scrollable (`/app/frontend/src/pages/BloodRequests.js`)
- [x] Login page organization selector upgraded to hierarchical searchable UI (`/app/frontend/src/pages/Login.js`)
- [x] Inventory Management view-switching runtime error fixed (`/app/frontend/src/pages/InventoryEnhanced.js`)
- [x] Duplicate Security Settings nav item for Tenant Admins fixed (`/app/frontend/src/components/Layout.js`)
- [x] Added stable `data-testid` attributes to Inventory view selector for test reliability

### Access Control Fixes (COMPLETE - Jan 9, 2026)
- [x] Active sessions now correctly tracked and displayed on login
- [x] Tenant Admins granted access to Audit Logs and Security Settings
- [x] System Admins granted access to Configuration module
- [x] User Management scoped by role (System sees all, Super sees org+branches, Tenant sees branch only)

### Malaysian ID Support (COMPLETE - Jan 9, 2026)
- [x] All donor forms updated to use Malaysian ID types (MyKad, MyKas, MyKid, MyPR, Passport)
- [x] Auto-formatting for MyKad (XXXXXX-XX-XXXX)
- [x] Updated validation patterns
- [x] Files: DonorRegistration.js, DonorLoginForm.js, DonorRegisterForm.js

---

## Prioritized Backlog

### P0 (Critical - Next)
- All P0 tasks complete!

### P1 (High Priority)
- All P1 tasks complete!

### P2 (Medium Priority)
- All P2 tasks complete!

### P3 (Future)
- [ ] API Rate Limiting (deferred by user)
- [ ] Logistics Module Notifications
- [ ] MFA Enforcement at Login (login flow doesn't prompt for MFA code even if enabled)
- [ ] Email Service Integration (Email OTP is MOCKED - prints to console)

---

## Test Credentials

| User | Email | Password | Type | Notes |
|------|-------|----------|------|-------|
| System Admin | admin@bloodbank.com | adminpassword | system_admin | Select "No organization" |
| Super Admin | superadmin@bloodlink.com | superadmin123 | super_admin | BloodLink Central |
| Tenant Admin | admin@northbranch.com | northadmin123 | tenant_admin | North Branch Updated |

---

## Key Files Reference

### Backend
- `/app/backend/middleware/org_access.py` - RLS middleware
- `/app/backend/services/audit_service.py` - Audit logging service
- `/app/backend/routers/sessions.py` - Context switching API
- `/app/backend/routers/documents.py` - Document management API
- `/app/backend/routers/compliance.py` - Compliance management API
- `/app/backend/routers/training.py` - Training management API
- `/app/backend/routers/security.py` - Security Suite API (MFA, Password Policy, Sessions, API Keys)
- `/app/backend/models/security.py` - Security models
- `/app/backend/services/helpers.py` - JWT token creation with impersonation

### Frontend
- `/app/frontend/src/context/AuthContext.js` - Auth state + context switching
- `/app/frontend/src/components/Layout.js` - Header with context switcher
- `/app/frontend/src/pages/AuditLogs.js` - Audit trail viewer
- `/app/frontend/src/pages/OrganizationDetail.js` - Org detail with Documents, Compliance, Training tabs
- `/app/frontend/src/pages/SecuritySettings.js` - Security Settings page (MFA, Sessions, Password Policy, API Keys)

---

## Latest Test Reports
- `/app/test_reports/iteration_5.json` - Phase B testing (100% pass rate)
- `/app/test_reports/iteration_6.json` - Phase F Document Management (100% pass rate, 13 tests)
- `/app/test_reports/iteration_7.json` - Phase G Compliance & Training (100% pass rate, 18 tests)
- `/app/test_reports/iteration_8.json` - Phase H Security Suite (100% pass rate, 25 tests)
- `/app/tests/test_phase_f_documents.py` - Document management API tests
- `/app/tests/test_phase_g_compliance_training.py` - Compliance & Training API tests
- `/app/tests/test_phase_h_security.py` - Security Suite API tests
