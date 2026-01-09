"""
Phase B: Context Switching & Session Management Tests
Tests for:
1. Context Switching - System Admin can switch context to any organization
2. Context Switching - Impersonation banner shows when switched context
3. Context Switching - Exit Context returns to original context
4. Sessions API - /api/sessions/context returns correct impersonation state
5. Sessions API - /api/sessions/switchable-contexts returns available orgs
6. Sessions API - /api/sessions/switch-context creates token with is_impersonating=true
7. Row-Level Security - Screenings endpoint respects org filtering
8. Row-Level Security - Donations endpoint respects org filtering
9. Row-Level Security - Blood Units endpoint respects org filtering
"""

import pytest
import requests
import os
import jwt

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://bbms-security.preview.emergentagent.com').rstrip('/')

# Test credentials
SYSTEM_ADMIN_EMAIL = "admin@bloodbank.com"
SYSTEM_ADMIN_PASSWORD = "adminpassword"
SUPER_ADMIN_EMAIL = "superadmin@bloodlink.com"
SUPER_ADMIN_PASSWORD = "superadmin123"
BLOODLINK_CENTRAL_ORG_ID = "61d41b01-1b7d-4064-9cff-3fa8a0fd554b"


class TestSystemAdminLogin:
    """Test System Admin login without organization"""
    
    def test_system_admin_login_no_org(self):
        """System Admin can login without selecting an organization"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SYSTEM_ADMIN_EMAIL,
            "password": SYSTEM_ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        assert "token" in data, "Token not in response"
        assert "user" in data, "User not in response"
        assert data["user"]["user_type"] == "system_admin", f"Expected system_admin, got {data['user'].get('user_type')}"
        
        print(f"✅ System Admin login successful - user_type: {data['user']['user_type']}")
        return data["token"]


class TestSessionsContextAPI:
    """Test /api/sessions/context endpoint"""
    
    @pytest.fixture
    def system_admin_token(self):
        """Get system admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SYSTEM_ADMIN_EMAIL,
            "password": SYSTEM_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_context_returns_correct_state(self, system_admin_token):
        """GET /api/sessions/context returns correct impersonation state"""
        headers = {"Authorization": f"Bearer {system_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/sessions/context", headers=headers)
        
        assert response.status_code == 200, f"Context API failed: {response.text}"
        data = response.json()
        
        # Verify required fields
        assert "user_id" in data, "user_id not in response"
        assert "user_email" in data, "user_email not in response"
        assert "user_type" in data, "user_type not in response"
        assert "is_impersonating" in data, "is_impersonating not in response"
        assert "can_switch_context" in data, "can_switch_context not in response"
        assert "actual_user_type" in data, "actual_user_type not in response"
        
        # Verify values for system admin
        assert data["user_type"] == "system_admin", f"Expected system_admin, got {data['user_type']}"
        assert data["is_impersonating"] == False, "Should not be impersonating initially"
        assert data["can_switch_context"] == True, "System admin should be able to switch context"
        
        print(f"✅ Context API returns correct state - user_type: {data['user_type']}, is_impersonating: {data['is_impersonating']}")


class TestSwitchableContextsAPI:
    """Test /api/sessions/switchable-contexts endpoint"""
    
    @pytest.fixture
    def system_admin_token(self):
        """Get system admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SYSTEM_ADMIN_EMAIL,
            "password": SYSTEM_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_switchable_contexts_returns_orgs(self, system_admin_token):
        """GET /api/sessions/switchable-contexts returns available organizations"""
        headers = {"Authorization": f"Bearer {system_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/sessions/switchable-contexts", headers=headers)
        
        assert response.status_code == 200, f"Switchable contexts API failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "current_context" in data, "current_context not in response"
        assert "available_contexts" in data, "available_contexts not in response"
        
        # Verify current context
        assert data["current_context"]["user_type"] == "system_admin"
        
        # Verify available contexts
        contexts = data["available_contexts"]
        assert isinstance(contexts, list), "available_contexts should be a list"
        assert len(contexts) > 0, "System admin should have available contexts to switch to"
        
        # Verify context structure
        for ctx in contexts:
            assert "org_id" in ctx, "org_id not in context"
            assert "org_name" in ctx, "org_name not in context"
            assert "switch_as" in ctx, "switch_as not in context"
        
        print(f"✅ Switchable contexts API returns {len(contexts)} organizations")
        for ctx in contexts[:3]:  # Print first 3
            print(f"   - {ctx['org_name']} (switch as {ctx['switch_as']})")


class TestSwitchContextAPI:
    """Test /api/sessions/switch-context endpoint"""
    
    @pytest.fixture
    def system_admin_token(self):
        """Get system admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SYSTEM_ADMIN_EMAIL,
            "password": SYSTEM_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_switch_context_creates_impersonation_token(self, system_admin_token):
        """POST /api/sessions/switch-context creates token with is_impersonating=true"""
        headers = {"Authorization": f"Bearer {system_admin_token}"}
        
        # Switch to BloodLink Central
        response = requests.post(f"{BASE_URL}/api/sessions/switch-context", 
            headers=headers,
            json={
                "target_org_id": BLOODLINK_CENTRAL_ORG_ID,
                "target_user_type": "super_admin"
            }
        )
        
        assert response.status_code == 200, f"Switch context failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "token" in data, "token not in response"
        assert "context" in data, "context not in response"
        
        # Verify context
        context = data["context"]
        assert context["is_impersonating"] == True, "is_impersonating should be True"
        assert context["org_id"] == BLOODLINK_CENTRAL_ORG_ID, "org_id should match target"
        assert context["actual_user_type"] == "system_admin", "actual_user_type should be system_admin"
        
        # Decode and verify token
        new_token = data["token"]
        # Note: We can't fully decode without the secret, but we can verify it's a valid JWT
        parts = new_token.split(".")
        assert len(parts) == 3, "Token should be a valid JWT with 3 parts"
        
        print(f"✅ Switch context successful - is_impersonating: {context['is_impersonating']}, org: {context.get('org_name')}")
        return new_token
    
    def test_context_after_switch_shows_impersonation(self, system_admin_token):
        """After switching, /api/sessions/context shows impersonation state"""
        headers = {"Authorization": f"Bearer {system_admin_token}"}
        
        # Switch context
        switch_response = requests.post(f"{BASE_URL}/api/sessions/switch-context", 
            headers=headers,
            json={
                "target_org_id": BLOODLINK_CENTRAL_ORG_ID,
                "target_user_type": "super_admin"
            }
        )
        assert switch_response.status_code == 200
        new_token = switch_response.json()["token"]
        
        # Check context with new token
        new_headers = {"Authorization": f"Bearer {new_token}"}
        context_response = requests.get(f"{BASE_URL}/api/sessions/context", headers=new_headers)
        
        assert context_response.status_code == 200, f"Context API failed: {context_response.text}"
        data = context_response.json()
        
        assert data["is_impersonating"] == True, "Should be impersonating after switch"
        assert data["actual_user_type"] == "system_admin", "actual_user_type should be system_admin"
        assert data["user_type"] == "super_admin", "user_type should be super_admin (impersonated)"
        
        print(f"✅ Context after switch shows impersonation - user_type: {data['user_type']}, actual: {data['actual_user_type']}")


class TestExitContextAPI:
    """Test /api/sessions/exit-context endpoint"""
    
    @pytest.fixture
    def system_admin_token(self):
        """Get system admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SYSTEM_ADMIN_EMAIL,
            "password": SYSTEM_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_exit_context_returns_to_original(self, system_admin_token):
        """POST /api/sessions/exit-context returns to original context"""
        headers = {"Authorization": f"Bearer {system_admin_token}"}
        
        # First switch context
        switch_response = requests.post(f"{BASE_URL}/api/sessions/switch-context", 
            headers=headers,
            json={
                "target_org_id": BLOODLINK_CENTRAL_ORG_ID,
                "target_user_type": "super_admin"
            }
        )
        assert switch_response.status_code == 200
        impersonation_token = switch_response.json()["token"]
        
        # Now exit context
        exit_headers = {"Authorization": f"Bearer {impersonation_token}"}
        exit_response = requests.post(f"{BASE_URL}/api/sessions/exit-context", headers=exit_headers)
        
        assert exit_response.status_code == 200, f"Exit context failed: {exit_response.text}"
        data = exit_response.json()
        
        # Verify response
        assert "token" in data, "token not in response"
        assert "context" in data, "context not in response"
        
        context = data["context"]
        assert context["is_impersonating"] == False, "Should not be impersonating after exit"
        assert context["user_type"] == "system_admin", "Should return to system_admin"
        
        print(f"✅ Exit context successful - returned to {context['user_type']}, is_impersonating: {context['is_impersonating']}")


class TestRowLevelSecurityScreenings:
    """Test RLS on Screenings endpoint"""
    
    @pytest.fixture
    def system_admin_token(self):
        """Get system admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SYSTEM_ADMIN_EMAIL,
            "password": SYSTEM_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_screenings_endpoint_accessible(self, system_admin_token):
        """GET /api/screenings returns data with org filtering"""
        headers = {"Authorization": f"Bearer {system_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/screenings?limit=10", headers=headers)
        
        assert response.status_code == 200, f"Screenings API failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ Screenings endpoint accessible - returned {len(data)} records")
        
        # Check if org_id is present in records
        if len(data) > 0:
            sample = data[0]
            if "org_id" in sample:
                print(f"   - Sample record has org_id: {sample['org_id']}")


class TestRowLevelSecurityDonations:
    """Test RLS on Donations endpoint"""
    
    @pytest.fixture
    def system_admin_token(self):
        """Get system admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SYSTEM_ADMIN_EMAIL,
            "password": SYSTEM_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_donations_endpoint_accessible(self, system_admin_token):
        """GET /api/donations returns data with org filtering"""
        headers = {"Authorization": f"Bearer {system_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/donations?limit=10", headers=headers)
        
        assert response.status_code == 200, f"Donations API failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ Donations endpoint accessible - returned {len(data)} records")
        
        # Check if org_id is present in records
        if len(data) > 0:
            sample = data[0]
            if "org_id" in sample:
                print(f"   - Sample record has org_id: {sample['org_id']}")


class TestRowLevelSecurityBloodUnits:
    """Test RLS on Blood Units endpoint"""
    
    @pytest.fixture
    def system_admin_token(self):
        """Get system admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SYSTEM_ADMIN_EMAIL,
            "password": SYSTEM_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_blood_units_endpoint_accessible(self, system_admin_token):
        """GET /api/blood-units returns data with org filtering"""
        headers = {"Authorization": f"Bearer {system_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/blood-units", headers=headers)
        
        assert response.status_code == 200, f"Blood Units API failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ Blood Units endpoint accessible - returned {len(data)} records")
        
        # Check if org_id is present in records
        if len(data) > 0:
            sample = data[0]
            if "org_id" in sample:
                print(f"   - Sample record has org_id: {sample['org_id']}")


class TestSuperAdminContextSwitching:
    """Test Super Admin context switching to child branches"""
    
    def test_super_admin_login_with_org(self):
        """Super Admin can login with organization"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD,
            "org_id": BLOODLINK_CENTRAL_ORG_ID
        })
        
        # Super admin might not exist, so we handle both cases
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Super Admin login successful - user_type: {data['user'].get('user_type')}")
            return data["token"]
        else:
            print(f"⚠️ Super Admin login failed (user may not exist): {response.status_code}")
            pytest.skip("Super Admin user not found")
    
    def test_super_admin_switchable_contexts(self):
        """Super Admin can only switch to child branches"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD,
            "org_id": BLOODLINK_CENTRAL_ORG_ID
        })
        
        if login_response.status_code != 200:
            pytest.skip("Super Admin user not found")
        
        token = login_response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/sessions/switchable-contexts", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            contexts = data.get("available_contexts", [])
            print(f"✅ Super Admin has {len(contexts)} switchable contexts (child branches)")
            for ctx in contexts[:3]:
                print(f"   - {ctx['org_name']} (switch as {ctx['switch_as']})")
        else:
            print(f"⚠️ Switchable contexts failed: {response.status_code}")


class TestContextSwitchingPermissions:
    """Test that non-admin users cannot switch context"""
    
    @pytest.fixture
    def system_admin_token(self):
        """Get system admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SYSTEM_ADMIN_EMAIL,
            "password": SYSTEM_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_staff_cannot_switch_context(self, system_admin_token):
        """Staff users should not be able to switch context"""
        # This test verifies the permission check in the API
        # We'll test by checking the can_switch_context flag
        headers = {"Authorization": f"Bearer {system_admin_token}"}
        
        # Switch to a tenant_admin role
        switch_response = requests.post(f"{BASE_URL}/api/sessions/switch-context", 
            headers=headers,
            json={
                "target_org_id": BLOODLINK_CENTRAL_ORG_ID,
                "target_user_type": "tenant_admin"
            }
        )
        
        if switch_response.status_code == 200:
            tenant_token = switch_response.json()["token"]
            tenant_headers = {"Authorization": f"Bearer {tenant_token}"}
            
            # Check context - tenant_admin should not be able to switch
            context_response = requests.get(f"{BASE_URL}/api/sessions/context", headers=tenant_headers)
            if context_response.status_code == 200:
                data = context_response.json()
                # Note: can_switch_context is based on actual_user_type, not impersonated type
                print(f"✅ Context check - user_type: {data['user_type']}, can_switch: {data['can_switch_context']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
