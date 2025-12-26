#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta
import time

class BloodBankAPITester:
    def __init__(self, base_url="https://veinsaver.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.admin_user_id = None
        self.donor_id = None
        self.donor_request_id = None
        self.donor_otp = None
        self.donor_token = None
        self.screening_id = None
        self.donation_id = None
        self.unit_id = None
        self.component_id = None
        self.request_id = None
        # Use the default admin credentials from the review request
        self.admin_email = "admin@bloodbank.com"
        self.admin_password = "adminpassword"

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, params=params)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

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

    def test_auth_me(self):
        """Test auth/me endpoint"""
        success, response = self.run_test(
            "Auth Me Endpoint",
            "GET",
            "auth/me",
            200
        )
        if success and 'id' in response:
            self.admin_user_id = response['id']
            return True
        return False

    def test_public_donor_register(self):
        """Test public donor registration"""
        # Store the identity details for later OTP testing
        self.test_identity_type = "Aadhar"
        self.test_identity_number = f"123456789{int(time.time()) % 1000}"
        self.test_dob = "1990-01-01"
        
        success, response = self.run_test(
            "Public Donor Registration",
            "POST",
            "public/donor-register",
            200,
            data={
                "identity_type": self.test_identity_type,
                "identity_number": self.test_identity_number,
                "full_name": "Test Donor",
                "date_of_birth": self.test_dob,
                "gender": "male",
                "weight": 65.0,
                "phone": "9876543210",
                "email": "testdonor@example.com",
                "address": "123 Test Street, Test City",
                "id_proof_image": "base64_image_data",
                "consent_given": True
            }
        )
        if success and 'request_id' in response:
            self.donor_request_id = response['request_id']
            return True
        return False

    def test_public_donor_status(self):
        """Test public donor status check"""
        success, response = self.run_test(
            "Public Donor Status Check",
            "GET",
            "public/donor-status/Aadhar/123456789012",
            200
        )
        return success

    def test_donor_requests_list(self):
        """Test staff donor requests list"""
        success, response = self.run_test(
            "Staff Donor Requests List",
            "GET",
            "donor-requests",
            200
        )
        return success

    def test_donor_request_approve(self):
        """Test staff approve donor request"""
        if not self.donor_request_id:
            return False
        
        success, response = self.run_test(
            "Staff Approve Donor Request",
            "POST",
            f"donor-requests/{self.donor_request_id}/approve",
            200
        )
        if success and 'donor_id' in response:
            self.donor_id = response['donor_internal_id']  # Use internal ID for further tests
            return True
        return False

    def test_donor_otp_request(self):
        """Test donor OTP request"""
        success, response = self.run_test(
            "Donor OTP Request",
            "POST",
            "public/donor-login/request-otp",
            200,
            data={
                "identity_type": "Aadhar",
                "identity_number": "123456789012",
                "date_of_birth": "1990-01-01"
            }
        )
        if success and 'otp_for_demo' in response:
            self.donor_otp = response['otp_for_demo']
            return True
        return False

    def test_donor_otp_verify(self):
        """Test donor OTP verification"""
        if not self.donor_otp:
            return False
            
        success, response = self.run_test(
            "Donor OTP Verification",
            "POST",
            "public/donor-login/verify-otp",
            200,
            data={
                "donor_id": "D-2025-0001",  # This should be dynamic based on created donor
                "otp": self.donor_otp
            }
        )
        if success and 'token' in response:
            self.donor_token = response['token']
            return True
        return False

    def test_user_login(self, email, password):
        """Test user login and get token"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'token' in response:
            self.token = response['token']
            return True
        return False

    def test_donors_list(self):
        """Test donors CRUD - GET /api/donors"""
        success, response = self.run_test(
            "Donors List (CRUD)",
            "GET",
            "donors",
            200
        )
        return success

    def test_donor_eligibility(self):
        """Test donor eligibility check"""
        if not self.donor_id:
            return False
        
        success, response = self.run_test(
            "Donor Eligibility Check",
            "GET",
            f"donors/{self.donor_id}/eligibility",
            200
        )
        return success and response.get('eligible', False)

    def test_health_screening(self):
        """Test health screening"""
        if not self.donor_id:
            return False
            
        success, response = self.run_test(
            "Health Screening",
            "POST",
            "screenings",
            200,
            data={
                "donor_id": self.donor_id,
                "screening_date": datetime.now().strftime("%Y-%m-%d"),
                "weight": 65.0,
                "height": 170.0,
                "blood_pressure_systolic": 120,
                "blood_pressure_diastolic": 80,
                "pulse": 72,
                "temperature": 36.5,
                "hemoglobin": 14.0,
                "preliminary_blood_group": "O+",
                "questionnaire_passed": True
            }
        )
        if success and 'screening_id' in response:
            self.screening_id = response['screening_id']
            return True
        return False

    def test_blood_collection_start(self):
        """Test starting blood collection"""
        if not self.donor_id or not self.screening_id:
            return False
            
        success, response = self.run_test(
            "Start Blood Collection",
            "POST",
            "donations",
            200,
            data={
                "donor_id": self.donor_id,
                "screening_id": self.screening_id,
                "donation_type": "whole_blood",
                "collection_start_time": datetime.now().isoformat()
            }
        )
        if success and 'id' in response:
            self.donation_id = response['id']
            return True
        return False

    def test_blood_collection_complete(self):
        """Test completing blood collection"""
        if not self.donation_id:
            return False
            
        success, response = self.run_test(
            "Complete Blood Collection",
            "PUT",
            f"donations/{self.donation_id}/complete",
            200,
            params={
                "volume": 450.0,
                "adverse_reaction": False
            }
        )
        if success and 'unit_id' in response:
            self.unit_id = response['unit_id']
            return True
        return False

    def test_lab_testing(self):
        """Test lab testing"""
        if not self.unit_id:
            return False
            
        success, response = self.run_test(
            "Lab Testing",
            "POST",
            "lab-tests",
            200,
            data={
                "unit_id": self.unit_id,
                "confirmed_blood_group": "O+",
                "verified_by_1": "LAB001",
                "verified_by_2": "LAB002",
                "hiv_result": "non_reactive",
                "hbsag_result": "non_reactive",
                "hcv_result": "non_reactive",
                "syphilis_result": "non_reactive",
                "test_method": "ELISA",
                "test_date": datetime.now().strftime("%Y-%m-%d")
            }
        )
        return success

    def test_component_processing(self):
        """Test component processing"""
        if not self.unit_id:
            return False
            
        success, response = self.run_test(
            "Component Processing",
            "POST",
            "components",
            200,
            data={
                "parent_unit_id": self.unit_id,
                "component_type": "prc",
                "volume": 300.0,
                "storage_temp_min": 2.0,
                "storage_temp_max": 6.0,
                "storage_location": "Fridge-A1",
                "expiry_date": (datetime.now() + timedelta(days=35)).strftime("%Y-%m-%d")
            }
        )
        if success and 'id' in response:
            self.component_id = response['id']
            return True
        return False

    def test_qc_validation(self):
        """Test QC validation"""
        if not self.unit_id:
            return False
            
        success, response = self.run_test(
            "QC Validation",
            "POST",
            "qc-validation",
            200,
            data={
                "unit_component_id": self.unit_id,
                "unit_type": "unit",
                "data_complete": True,
                "screening_complete": True,
                "custody_complete": True
            }
        )
        return success

    def test_inventory_summary(self):
        """Test inventory summary"""
        success, response = self.run_test(
            "Inventory Summary",
            "GET",
            "inventory/summary",
            200
        )
        return success

    def test_blood_request(self):
        """Test blood request creation"""
        success, response = self.run_test(
            "Blood Request Creation",
            "POST",
            "requests",
            200,
            data={
                "request_type": "internal",
                "requester_name": "Dr. Smith",
                "requester_contact": "dr.smith@hospital.com",
                "hospital_name": "City Hospital",
                "patient_name": "Jane Patient",
                "patient_id": "P001",
                "blood_group": "O+",
                "product_type": "prc",
                "quantity": 2,
                "urgency": "normal",
                "requested_date": datetime.now().strftime("%Y-%m-%d"),
                "required_by_date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
                "notes": "Routine surgery"
            }
        )
        if success and 'id' in response:
            self.request_id = response['id']
            return True
        return False

    def test_request_approval(self):
        """Test request approval"""
        if not self.request_id:
            return False
            
        success, response = self.run_test(
            "Request Approval",
            "PUT",
            f"requests/{self.request_id}/approve",
            200
        )
        return success

    def test_dashboard_stats(self):
        """Test dashboard stats API"""
        success, response = self.run_test(
            "Dashboard Stats",
            "GET",
            "dashboard/stats",
            200
        )
        return success

    def test_reports_endpoints(self):
        """Test various report endpoints"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Daily collections report
        success1, _ = self.run_test(
            "Daily Collections Report",
            "GET",
            "reports/daily-collections",
            200,
            params={"date": today}
        )
        
        # Inventory status report
        success2, _ = self.run_test(
            "Inventory Status Report",
            "GET",
            "reports/inventory-status",
            200
        )
        
        # Expiry analysis report
        success3, _ = self.run_test(
            "Expiry Analysis Report",
            "GET",
            "reports/expiry-analysis",
            200
        )
        
        return success1 and success2 and success3

def main():
    print("🩸 Blood Bank Management System API Testing - Refactored Backend")
    print("=" * 60)
    
    tester = BloodBankAPITester()
    
    # Test sequence focused on the review request requirements
    test_sequence = [
        # Core Auth APIs
        ("Admin Login", lambda: tester.test_user_login(tester.admin_email, tester.admin_password)),
        ("Auth Me Endpoint", tester.test_auth_me),
        
        # Public Donor Registration Flow
        ("Public Donor Registration", tester.test_public_donor_register),
        ("Public Donor Status Check", tester.test_public_donor_status),
        
        # Staff Donor Request Management
        ("Staff Donor Requests List", tester.test_donor_requests_list),
        ("Staff Approve Donor Request", tester.test_donor_request_approve),
        
        # Donor OTP Login Flow
        ("Donor OTP Request", tester.test_donor_otp_request),
        ("Donor OTP Verification", tester.test_donor_otp_verify),
        
        # Dashboard and Core APIs
        ("Dashboard Stats", tester.test_dashboard_stats),
        ("Donors CRUD List", tester.test_donors_list),
        ("Inventory Summary", tester.test_inventory_summary),
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
        print("\n🎉 All tests passed!")
    
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"📈 Success Rate: {success_rate:.1f}%")
    
    return 0 if len(failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())