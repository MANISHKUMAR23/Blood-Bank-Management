#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta
import time

class DonorRegistrationTester:
    def __init__(self, base_url="https://veinsaver.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.staff_token = None
        self.donor_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.request_id = None
        self.donor_id = None
        self.test_identity_number = f"TEST{int(time.time())}"
        
    def run_test(self, name, method, endpoint, expected_status, data=None, params=None, use_donor_token=False):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        # Use appropriate token
        token = self.donor_token if use_donor_token else self.staff_token
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, params=params)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"   Response: {response.json()}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_staff_login(self):
        """Test staff login"""
        success, response = self.run_test(
            "Staff Login",
            "POST",
            "auth/login",
            200,
            data={
                "email": "admin@bloodbank.com",
                "password": "adminpassword"
            }
        )
        if success and 'token' in response:
            self.staff_token = response['token']
            return True
        return False

    def test_public_donor_registration(self):
        """Test public donor self-registration"""
        success, response = self.run_test(
            "Public Donor Registration",
            "POST",
            "public/donor-register",
            200,
            data={
                "identity_type": "Aadhar",
                "identity_number": self.test_identity_number,
                "full_name": "Test Donor User",
                "date_of_birth": "1990-05-15",
                "gender": "Male",
                "weight": 70.0,
                "phone": "9876543210",
                "email": "testdonor@example.com",
                "address": "123 Test Street, Test City, Test State",
                "consent_given": True
            }
        )
        if success and 'request_id' in response:
            self.request_id = response['request_id']
            return True
        return False

    def test_duplicate_registration_prevention(self):
        """Test that duplicate registration is prevented"""
        success, response = self.run_test(
            "Duplicate Registration Prevention",
            "POST",
            "public/donor-register",
            400,  # Should fail with 400
            data={
                "identity_type": "Aadhar",
                "identity_number": self.test_identity_number,  # Same ID as before
                "full_name": "Another Test User",
                "date_of_birth": "1985-03-20",
                "gender": "Female",
                "phone": "9876543211",
                "address": "456 Another Street",
                "consent_given": True
            }
        )
        return success  # Success means it correctly rejected duplicate

    def test_donor_status_check_pending(self):
        """Test checking donor status while pending"""
        success, response = self.run_test(
            "Donor Status Check (Pending)",
            "GET",
            f"public/donor-status/Aadhar/{self.test_identity_number}",
            200
        )
        if success:
            status = response.get('status')
            is_donor = response.get('is_donor')
            return status == 'pending' and not is_donor
        return False

    def test_get_donor_requests(self):
        """Test getting donor requests (staff only)"""
        success, response = self.run_test(
            "Get Donor Requests",
            "GET",
            "donor-requests",
            200,
            params={"status": "pending"}
        )
        if success and isinstance(response, list):
            # Check if our request is in the list
            for req in response:
                if req.get('identity_number') == self.test_identity_number:
                    return True
        return False

    def test_get_specific_donor_request(self):
        """Test getting specific donor request details"""
        if not self.request_id:
            return False
            
        success, response = self.run_test(
            "Get Specific Donor Request",
            "GET",
            f"donor-requests/{self.request_id}",
            200
        )
        if success:
            return response.get('identity_number') == self.test_identity_number
        return False

    def test_check_duplicate_donor(self):
        """Test duplicate donor check"""
        if not self.request_id:
            return False
            
        success, response = self.run_test(
            "Check Duplicate Donor",
            "POST",
            f"donor-requests/{self.request_id}/check-duplicate",
            200
        )
        if success:
            return not response.get('is_duplicate', True)  # Should not be duplicate
        return False

    def test_approve_donor_request(self):
        """Test approving donor request"""
        if not self.request_id:
            return False
            
        success, response = self.run_test(
            "Approve Donor Request",
            "POST",
            f"donor-requests/{self.request_id}/approve",
            200
        )
        if success and 'donor_id' in response:
            self.donor_id = response['donor_id']
            return True
        return False

    def test_donor_status_check_approved(self):
        """Test checking donor status after approval"""
        success, response = self.run_test(
            "Donor Status Check (Approved)",
            "GET",
            f"public/donor-status/Aadhar/{self.test_identity_number}",
            200
        )
        if success:
            status = response.get('status')
            is_donor = response.get('is_donor')
            donor_id = response.get('donor_id')
            return status == 'approved' and is_donor and donor_id == self.donor_id
        return False

    def test_request_donor_otp_by_id(self):
        """Test requesting OTP using donor ID"""
        if not self.donor_id:
            return False
            
        success, response = self.run_test(
            "Request Donor OTP (by ID)",
            "POST",
            "public/donor-login/request-otp",
            200,
            params={"donor_id": self.donor_id}
        )
        if success:
            self.demo_otp = response.get('otp_for_demo')  # Store demo OTP
            return 'otp_for_demo' in response
        return False

    def test_request_donor_otp_by_identity(self):
        """Test requesting OTP using identity details"""
        success, response = self.run_test(
            "Request Donor OTP (by Identity)",
            "POST",
            "public/donor-login/request-otp",
            200,
            params={
                "identity_type": "Aadhar",
                "identity_number": self.test_identity_number,
                "date_of_birth": "1990-05-15"
            }
        )
        if success:
            self.demo_otp = response.get('otp_for_demo')  # Store demo OTP
            return 'otp_for_demo' in response
        return False

    def test_verify_donor_otp(self):
        """Test verifying donor OTP"""
        if not self.donor_id or not hasattr(self, 'demo_otp'):
            return False
            
        success, response = self.run_test(
            "Verify Donor OTP",
            "POST",
            "public/donor-login/verify-otp",
            200,
            params={
                "donor_id": self.donor_id,
                "otp": self.demo_otp
            }
        )
        if success and 'token' in response:
            self.donor_token = response['token']
            return True
        return False

    def test_get_donor_profile(self):
        """Test getting donor profile (requires donor token)"""
        success, response = self.run_test(
            "Get Donor Profile",
            "GET",
            "public/donor-profile",
            200,
            use_donor_token=True
        )
        if success:
            donor = response.get('donor', {})
            return donor.get('donor_id') == self.donor_id
        return False

    def test_reject_workflow(self):
        """Test rejection workflow with a new registration"""
        # Create another test registration
        reject_identity = f"REJECT{int(time.time())}"
        
        # Register
        success, response = self.run_test(
            "Registration for Rejection Test",
            "POST",
            "public/donor-register",
            200,
            data={
                "identity_type": "Passport",
                "identity_number": reject_identity,
                "full_name": "Reject Test User",
                "date_of_birth": "1985-12-25",
                "gender": "Female",
                "phone": "9876543299",
                "address": "456 Reject Street",
                "consent_given": True
            }
        )
        
        if not success:
            return False
            
        reject_request_id = response.get('request_id')
        if not reject_request_id:
            return False
        
        # Reject the request
        success, response = self.run_test(
            "Reject Donor Request",
            "POST",
            f"donor-requests/{reject_request_id}/reject",
            200,
            params={"rejection_reason": "Test rejection for incomplete documentation"}
        )
        
        if not success:
            return False
        
        # Check status after rejection
        success, response = self.run_test(
            "Check Status After Rejection",
            "GET",
            f"public/donor-status/Passport/{reject_identity}",
            200
        )
        
        if success:
            status = response.get('status')
            rejection_reason = response.get('rejection_reason')
            return status == 'rejected' and rejection_reason is not None
        
        return False

def main():
    print("🩸 Donor Registration + Staff Approval Feature Testing")
    print("=" * 60)
    
    tester = DonorRegistrationTester()
    
    # Test sequence for the complete donor registration workflow
    test_sequence = [
        ("Staff Login", tester.test_staff_login),
        ("Public Donor Registration", tester.test_public_donor_registration),
        ("Duplicate Registration Prevention", tester.test_duplicate_registration_prevention),
        ("Donor Status Check (Pending)", tester.test_donor_status_check_pending),
        ("Get Donor Requests", tester.test_get_donor_requests),
        ("Get Specific Donor Request", tester.test_get_specific_donor_request),
        ("Check Duplicate Donor", tester.test_check_duplicate_donor),
        ("Approve Donor Request", tester.test_approve_donor_request),
        ("Donor Status Check (Approved)", tester.test_donor_status_check_approved),
        ("Request Donor OTP (by ID)", tester.test_request_donor_otp_by_id),
        ("Request Donor OTP (by Identity)", tester.test_request_donor_otp_by_identity),
        ("Verify Donor OTP", tester.test_verify_donor_otp),
        ("Get Donor Profile", tester.test_get_donor_profile),
        ("Rejection Workflow", tester.test_reject_workflow),
    ]
    
    failed_tests = []
    
    for test_name, test_func in test_sequence:
        print(f"\n📋 Running: {test_name}")
        try:
            if not test_func():
                failed_tests.append(test_name)
                print(f"❌ {test_name} failed")
            else:
                print(f"✅ {test_name} passed")
        except Exception as e:
            failed_tests.append(test_name)
            print(f"❌ {test_name} failed with exception: {str(e)}")
    
    # Print final results
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if failed_tests:
        print(f"\n❌ Failed Tests ({len(failed_tests)}):")
        for test in failed_tests:
            print(f"   - {test}")
    else:
        print("\n🎉 All donor registration tests passed!")
    
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"📈 Success Rate: {success_rate:.1f}%")
    
    return 0 if len(failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())