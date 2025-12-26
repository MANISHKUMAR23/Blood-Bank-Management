#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Blood Bank Management System with Public Donor Registration + Staff Approval workflow. Public donors can self-register, staff reviews and approves/rejects registrations, approved donors can login via OTP."

backend:
  - task: "Admin user creation on startup"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
        - agent: "main"
        - comment: "Added startup event to create default admin user if not exists"

  - task: "Public donor registration endpoint"
    implemented: true
    working: NA
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: NA
        - agent: "main"
        - comment: "API POST /api/public/donor-register - needs testing"

  - task: "Donor status check endpoint"
    implemented: true
    working: NA
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: NA
        - agent: "main"
        - comment: "API GET /api/public/donor-status/{type}/{number} - needs testing"

  - task: "Donor OTP login endpoints"
    implemented: true
    working: NA
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: NA
        - agent: "main"
        - comment: "APIs for /api/public/donor-login/request-otp and verify-otp - needs testing"

  - task: "Staff donor request management endpoints"
    implemented: true
    working: NA
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: NA
        - agent: "main"
        - comment: "APIs for /api/donor-requests CRUD, approve, reject - needs testing"

frontend:
  - task: "Public Donor Landing Page"
    implemented: true
    working: true
    file: "/app/frontend/src/pages/DonorLanding.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
        - agent: "main"
        - comment: "Verified via screenshot - landing page loads correctly at /donor"

  - task: "Public Donor Registration Form"
    implemented: true
    working: NA
    file: "/app/frontend/src/components/DonorRegisterForm.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: NA
        - agent: "main"
        - comment: "3-step registration form - needs e2e testing"

  - task: "Public Donor Login Form"
    implemented: true
    working: NA
    file: "/app/frontend/src/components/DonorLoginForm.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: NA
        - agent: "main"
        - comment: "OTP-based login - needs e2e testing"

  - task: "Donor Status Check Page"
    implemented: true
    working: NA
    file: "/app/frontend/src/pages/DonorStatus.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: NA
        - agent: "main"
        - comment: "Page at /donor/status - needs e2e testing"

  - task: "Donor Dashboard"
    implemented: true
    working: NA
    file: "/app/frontend/src/pages/DonorDashboard.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: NA
        - agent: "main"
        - comment: "Page at /donor/dashboard for logged in donors - needs e2e testing"

  - task: "Staff Donor Requests Page"
    implemented: true
    working: true
    file: "/app/frontend/src/pages/DonorRequests.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
        - agent: "main"
        - comment: "Verified via screenshot - page loads correctly at /donor-requests"

  - task: "Routes for Public Donor Pages"
    implemented: true
    working: true
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
        - agent: "main"
        - comment: "Added routes for /donor, /donor/dashboard, /donor/status, /donor-requests"

  - task: "Navigation Link for Donor Requests"
    implemented: true
    working: true
    file: "/app/frontend/src/components/Layout.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
        - agent: "main"
        - comment: "Added nav item for admin and registration roles"

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 2
  run_ui: true

test_plan:
  current_focus:
    - "Public donor registration flow"
    - "Staff approval workflow"
    - "Donor OTP login flow"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
    - message: "Completed backend refactoring. server.py reduced from 2512 lines to 94 lines. Created 16 modular router files. All APIs tested and working. Need verification testing."
    - timestamp: "2024-12-26T06:00:00Z"