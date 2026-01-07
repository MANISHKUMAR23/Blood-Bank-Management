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

---

## Prioritized Backlog

### P0 (Critical - Next)
- All P0 tasks complete!

### P1 (High Priority)
- [ ] Phase G: Compliance & Training Modules

### P2 (Medium Priority)
- [ ] Phase H: Full Security Suite (MFA, Password Policy, API Keys, Backups)

### P3 (Future)
- [ ] API Rate Limiting (deferred by user)

---

## Test Credentials

| User | Email | Password | Type | Notes |
|------|-------|----------|------|-------|
| System Admin | admin@bloodbank.com | adminpassword | system_admin | Select "No organization" |
| Super Admin | superadmin@bloodlink.com | superadmin123 | super_admin | Select "BloodLink Central" |

---

## Key Files Reference

### Backend
- `/app/backend/middleware/org_access.py` - RLS middleware
- `/app/backend/services/audit_service.py` - Audit logging service
- `/app/backend/routers/sessions.py` - Context switching API
- `/app/backend/routers/documents.py` - Document management API
- `/app/backend/services/helpers.py` - JWT token creation with impersonation

### Frontend
- `/app/frontend/src/context/AuthContext.js` - Auth state + context switching
- `/app/frontend/src/components/Layout.js` - Header with context switcher
- `/app/frontend/src/pages/AuditLogs.js` - Audit trail viewer
- `/app/frontend/src/pages/OrganizationDetail.js` - Org detail with Documents tab

---

## Latest Test Reports
- `/app/test_reports/iteration_5.json` - Phase B testing (100% pass rate)
- `/app/test_reports/iteration_6.json` - Phase F Document Management (100% pass rate, 13 tests)
- `/app/tests/test_phase_f_documents.py` - Document management API tests
