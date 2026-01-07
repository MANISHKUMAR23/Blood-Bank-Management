"""
Phase H: Security Suite Tests
Tests for Password Policy, MFA (TOTP + Email OTP), Session Management, and API Keys.
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://docusafe-17.preview.emergentagent.com').rstrip('/')

# Test credentials
SYSTEM_ADMIN = {"email": "admin@bloodbank.com", "password": "adminpassword"}
SUPER_ADMIN = {"email": "superadmin@bloodlink.com", "password": "superadmin123"}
TEST_ORG_ID = "61d41b01-1b7d-4064-9cff-3fa8a0fd554b"


@pytest.fixture(scope="module")
def system_admin_token():
    """Get system admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=SYSTEM_ADMIN)
    assert response.status_code == 200, f"System admin login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def super_admin_token():
    """Get super admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
    assert response.status_code == 200, f"Super admin login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture
def system_admin_headers(system_admin_token):
    """Headers with system admin auth"""
    return {"Authorization": f"Bearer {system_admin_token}", "Content-Type": "application/json"}


@pytest.fixture
def super_admin_headers(super_admin_token):
    """Headers with super admin auth"""
    return {"Authorization": f"Bearer {super_admin_token}", "Content-Type": "application/json"}


# ==================== Password Policy Tests ====================

class TestPasswordPolicy:
    """Password Policy API tests"""
    
    def test_get_default_password_policy(self, system_admin_headers):
        """GET /api/security/password-policy - Get default password policy"""
        response = requests.get(f"{BASE_URL}/api/security/password-policy", headers=system_admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Verify default policy structure
        assert "min_length" in data
        assert "require_uppercase" in data
        assert "require_lowercase" in data
        assert "require_numbers" in data
        assert "require_special_chars" in data
        assert "max_failed_attempts" in data
        assert "lockout_duration_minutes" in data
        
        # Verify default values
        assert data["min_length"] == 8
        assert data["require_uppercase"] == True
        assert data["require_lowercase"] == True
        assert data["require_numbers"] == True
        assert data["require_special_chars"] == True
        print(f"✓ Default password policy retrieved: min_length={data['min_length']}")
    
    def test_get_org_password_policy(self, super_admin_headers):
        """GET /api/security/password-policy?org_id=xxx - Get org-specific policy"""
        response = requests.get(
            f"{BASE_URL}/api/security/password-policy",
            params={"org_id": TEST_ORG_ID},
            headers=super_admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "min_length" in data
        print(f"✓ Org password policy retrieved")
    
    def test_update_password_policy_system_admin(self, system_admin_headers):
        """PUT /api/security/password-policy - System admin updates system-wide policy"""
        update_data = {
            "min_length": 10,
            "max_failed_attempts": 3
        }
        response = requests.put(
            f"{BASE_URL}/api/security/password-policy",
            json=update_data,
            headers=system_admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["status"] == "success"
        print(f"✓ System-wide password policy updated")
        
        # Verify update
        verify_response = requests.get(f"{BASE_URL}/api/security/password-policy", headers=system_admin_headers)
        verify_data = verify_response.json()
        assert verify_data["min_length"] == 10
        assert verify_data["max_failed_attempts"] == 3
        print(f"✓ Password policy update verified: min_length={verify_data['min_length']}")
        
        # Reset to default
        reset_data = {"min_length": 8, "max_failed_attempts": 5}
        requests.put(f"{BASE_URL}/api/security/password-policy", json=reset_data, headers=system_admin_headers)
    
    def test_update_org_password_policy_super_admin(self, super_admin_headers):
        """PUT /api/security/password-policy?org_id=xxx - Super admin updates org policy"""
        update_data = {
            "min_length": 12,
            "require_special_chars": True
        }
        response = requests.put(
            f"{BASE_URL}/api/security/password-policy",
            params={"org_id": TEST_ORG_ID},
            json=update_data,
            headers=super_admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        print(f"✓ Org-specific password policy updated")
    
    def test_validate_password_success(self, system_admin_headers):
        """POST /api/security/validate-password - Valid password passes"""
        response = requests.post(
            f"{BASE_URL}/api/security/validate-password",
            params={"password": "SecurePass123!"},
            headers=system_admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["is_valid"] == True
        assert len(data["errors"]) == 0
        print(f"✓ Valid password validated successfully")
    
    def test_validate_password_failure(self, system_admin_headers):
        """POST /api/security/validate-password - Invalid password fails"""
        response = requests.post(
            f"{BASE_URL}/api/security/validate-password",
            params={"password": "weak"},
            headers=system_admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["is_valid"] == False
        assert len(data["errors"]) > 0
        print(f"✓ Invalid password correctly rejected with {len(data['errors'])} errors")


# ==================== MFA Tests ====================

class TestMFA:
    """Multi-Factor Authentication API tests"""
    
    def test_get_mfa_status_disabled(self, system_admin_headers):
        """GET /api/security/mfa/status - Get MFA status (initially disabled)"""
        response = requests.get(f"{BASE_URL}/api/security/mfa/status", headers=system_admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "status" in data
        assert "primary_method" in data
        assert "email_otp_enabled" in data
        assert "backup_codes_remaining" in data
        assert "is_required" in data
        print(f"✓ MFA status retrieved: status={data['status']}")
    
    def test_setup_totp_mfa(self, super_admin_headers):
        """POST /api/security/mfa/setup/totp - Setup TOTP MFA returns QR code"""
        response = requests.post(f"{BASE_URL}/api/security/mfa/setup/totp", headers=super_admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "secret" in data
        assert "qr_code_uri" in data
        assert "backup_codes" in data
        
        # Verify QR code is base64 encoded PNG
        assert data["qr_code_uri"].startswith("data:image/png;base64,")
        
        # Verify backup codes
        assert len(data["backup_codes"]) == 10
        assert all(len(code) == 8 for code in data["backup_codes"])  # 4 bytes hex = 8 chars
        
        print(f"✓ TOTP MFA setup initiated: secret length={len(data['secret'])}, backup_codes={len(data['backup_codes'])}")
    
    def test_verify_totp_invalid_code(self, super_admin_headers):
        """POST /api/security/mfa/verify/totp - Invalid code returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/security/mfa/verify/totp",
            params={"code": "000000"},
            headers=super_admin_headers
        )
        # Should fail with invalid code
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print(f"✓ Invalid TOTP code correctly rejected")
    
    def test_enable_email_otp(self, super_admin_headers):
        """POST /api/security/mfa/enable-email - Enable email OTP backup"""
        response = requests.post(f"{BASE_URL}/api/security/mfa/enable-email", headers=super_admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "success"
        print(f"✓ Email OTP enabled as backup method")
        
        # Verify status updated
        status_response = requests.get(f"{BASE_URL}/api/security/mfa/status", headers=super_admin_headers)
        status_data = status_response.json()
        assert status_data["email_otp_enabled"] == True
        print(f"✓ Email OTP status verified")
    
    def test_regenerate_backup_codes(self, super_admin_headers):
        """POST /api/security/mfa/regenerate-backup-codes - Generate new backup codes"""
        response = requests.post(f"{BASE_URL}/api/security/mfa/regenerate-backup-codes", headers=super_admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "backup_codes" in data
        assert len(data["backup_codes"]) == 10
        print(f"✓ Backup codes regenerated: {len(data['backup_codes'])} codes")
    
    def test_disable_mfa(self, super_admin_headers):
        """POST /api/security/mfa/disable - Disable MFA"""
        response = requests.post(f"{BASE_URL}/api/security/mfa/disable", headers=super_admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "success"
        print(f"✓ MFA disabled successfully")
        
        # Verify status
        status_response = requests.get(f"{BASE_URL}/api/security/mfa/status", headers=super_admin_headers)
        status_data = status_response.json()
        assert status_data["status"] == "disabled"
        print(f"✓ MFA disabled status verified")


# ==================== Session Management Tests ====================

class TestSessionManagement:
    """Session Management API tests"""
    
    def test_get_active_sessions(self, system_admin_headers):
        """GET /api/security/sessions - Get active sessions"""
        response = requests.get(f"{BASE_URL}/api/security/sessions", headers=system_admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Active sessions retrieved: {len(data)} sessions")
    
    def test_get_session_config(self, system_admin_headers):
        """GET /api/security/sessions/config - Get session configuration"""
        response = requests.get(f"{BASE_URL}/api/security/sessions/config", headers=system_admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "session_timeout_minutes" in data
        assert "max_concurrent_sessions" in data
        assert "require_re_auth_for_sensitive" in data
        print(f"✓ Session config retrieved: timeout={data['session_timeout_minutes']}min, max_sessions={data['max_concurrent_sessions']}")
    
    def test_update_session_config(self, system_admin_headers):
        """PUT /api/security/sessions/config - Update session configuration"""
        response = requests.put(
            f"{BASE_URL}/api/security/sessions/config",
            params={"session_timeout_minutes": 240, "max_concurrent_sessions": 3},
            headers=system_admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "success"
        print(f"✓ Session config updated")
    
    def test_revoke_all_sessions(self, system_admin_headers):
        """POST /api/security/sessions/revoke-all - Revoke all sessions (keep current)"""
        response = requests.post(
            f"{BASE_URL}/api/security/sessions/revoke-all",
            params={"keep_current": True},
            headers=system_admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "success"
        print(f"✓ All other sessions revoked: {data['message']}")


# ==================== API Key Tests ====================

class TestAPIKeys:
    """API Key Management tests"""
    
    created_key_id = None
    
    def test_list_api_keys_empty(self, super_admin_headers):
        """GET /api/security/api-keys?org_id=xxx - List API keys (initially empty)"""
        response = requests.get(
            f"{BASE_URL}/api/security/api-keys",
            params={"org_id": TEST_ORG_ID},
            headers=super_admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ API keys listed: {len(data)} keys")
    
    def test_create_api_key(self, super_admin_headers):
        """POST /api/security/api-keys?org_id=xxx - Create API key"""
        key_data = {
            "name": "TEST_Integration_Key",
            "description": "Test API key for integration testing",
            "scopes": ["read", "write"],
            "rate_limit_per_minute": 100
        }
        response = requests.post(
            f"{BASE_URL}/api/security/api-keys",
            params={"org_id": TEST_ORG_ID},
            json=key_data,
            headers=super_admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert "key" in data  # Full key only shown at creation
        assert "key_prefix" in data
        assert data["name"] == "TEST_Integration_Key"
        assert data["key"].startswith("bbk_")  # Blood Bank Key prefix
        
        TestAPIKeys.created_key_id = data["id"]
        print(f"✓ API key created: prefix={data['key_prefix']}, scopes={data['scopes']}")
    
    def test_list_api_keys_with_created(self, super_admin_headers):
        """GET /api/security/api-keys - Verify created key appears in list"""
        response = requests.get(
            f"{BASE_URL}/api/security/api-keys",
            params={"org_id": TEST_ORG_ID},
            headers=super_admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Find our created key
        test_keys = [k for k in data if k.get("name") == "TEST_Integration_Key"]
        assert len(test_keys) >= 1, "Created key not found in list"
        
        # Verify key_hash is not exposed
        for key in data:
            assert "key_hash" not in key, "key_hash should not be exposed"
        
        print(f"✓ Created API key found in list")
    
    def test_revoke_api_key(self, super_admin_headers):
        """DELETE /api/security/api-keys/{id}?org_id=xxx - Revoke API key"""
        if not TestAPIKeys.created_key_id:
            pytest.skip("No key created to revoke")
        
        response = requests.delete(
            f"{BASE_URL}/api/security/api-keys/{TestAPIKeys.created_key_id}",
            params={"org_id": TEST_ORG_ID},
            headers=super_admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "success"
        print(f"✓ API key revoked successfully")
    
    def test_create_api_key_unauthorized(self, super_admin_headers):
        """POST /api/security/api-keys - Non-admin cannot create keys"""
        # First create a regular user token (we'll use the existing super admin but test wrong org)
        key_data = {
            "name": "Unauthorized_Key",
            "scopes": ["read"]
        }
        # Try to create key for a different org (should fail access check)
        response = requests.post(
            f"{BASE_URL}/api/security/api-keys",
            params={"org_id": "non-existent-org-id"},
            json=key_data,
            headers=super_admin_headers
        )
        # Should fail with 403 (no access to this org)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"✓ Unauthorized API key creation correctly rejected")


# ==================== Account Lockout Tests ====================

class TestAccountLockout:
    """Account Lockout API tests"""
    
    def test_get_lockout_status_self(self, system_admin_headers, system_admin_token):
        """GET /api/security/lockout/status/{user_id} - Get own lockout status"""
        # First get user ID from token
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=system_admin_headers)
        user_id = me_response.json()["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/security/lockout/status/{user_id}",
            headers=system_admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "is_locked" in data
        assert "failed_attempts" in data
        print(f"✓ Lockout status retrieved: is_locked={data['is_locked']}, failed_attempts={data['failed_attempts']}")


# ==================== MFA Enforcement Tests ====================

class TestMFAEnforcement:
    """MFA Enforcement API tests (Admin only)"""
    
    def test_enforce_mfa_for_user(self, system_admin_headers, super_admin_token):
        """POST /api/security/mfa/enforce/{user_id} - Enforce MFA for a user"""
        # Get super admin user ID
        super_headers = {"Authorization": f"Bearer {super_admin_token}", "Content-Type": "application/json"}
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=super_headers)
        target_user_id = me_response.json()["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/security/mfa/enforce/{target_user_id}",
            headers=system_admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "success"
        print(f"✓ MFA enforcement enabled for user")
        
        # Verify MFA is now required
        status_response = requests.get(f"{BASE_URL}/api/security/mfa/status", headers=super_headers)
        status_data = status_response.json()
        assert status_data["is_required"] == True
        print(f"✓ MFA requirement verified")


# ==================== Email OTP Tests ====================

class TestEmailOTP:
    """Email OTP API tests"""
    
    def test_send_email_otp(self, system_admin_headers):
        """POST /api/security/mfa/send-email-otp - Send OTP to email"""
        response = requests.post(
            f"{BASE_URL}/api/security/mfa/send-email-otp",
            params={"email": "admin@bloodbank.com"},
            headers=system_admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "success"
        print(f"✓ Email OTP sent (logged to console in dev mode)")
    
    def test_verify_email_otp_invalid(self, system_admin_headers):
        """POST /api/security/mfa/verify-email-otp - Invalid OTP returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/security/mfa/verify-email-otp",
            params={"email": "admin@bloodbank.com", "otp": "000000"},
            headers=system_admin_headers
        )
        # Should fail with invalid OTP
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✓ Invalid email OTP correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
