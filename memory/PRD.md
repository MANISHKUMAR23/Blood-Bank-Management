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

---

## Prioritized Backlog

### P0 (Critical - Next)
- [ ] **Phase D: Interactive Master & System Admin Dashboards** - Clickable cards, charts, activity feeds

### P1 (High Priority)
- [ ] Phase E: Interactive Org & Branch Detail Pages

### P2 (Medium Priority)
- [ ] Phase F: Document Management
- [ ] Phase G: Compliance & Training Modules

### P3 (Future)
- [ ] Phase H: Full Security Suite (MFA, Password Policy, API Keys, Backups)
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
- `/app/backend/services/helpers.py` - JWT token creation with impersonation

### Frontend
- `/app/frontend/src/context/AuthContext.js` - Auth state + context switching
- `/app/frontend/src/components/Layout.js` - Header with context switcher
- `/app/frontend/src/pages/AuditLogs.js` - Audit trail viewer

---

## Latest Test Reports
- `/app/test_reports/iteration_5.json` - Phase B testing (100% pass rate)
- `/app/tests/test_phase_b_context_switching.py` - 12 automated tests
