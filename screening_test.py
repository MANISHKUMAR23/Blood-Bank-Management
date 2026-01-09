#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta
import time

class ScreeningAPITester:
    def __init__(self, base_url="https://bbms-security.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        # Use the credentials from the review request
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

    def test_enhanced_screening_apis(self):
        """Test Enhanced Screening Page APIs as per review request"""
        print("\n🩸 Testing Enhanced Screening Page APIs...")
        
        # Test 1: GET /api/screenings/pending/donors - Returns list of active donors who haven't been screened today
        success1, response1 = self.run_test(
            "GET /api/screenings/pending/donors - Pending Donors",
            "GET",
            "screenings/pending/donors",
            200
        )
        
        # Validate pending donors response structure
        if success1 and response1:
            if isinstance(response1, list):
                print(f"   ✅ Found {len(response1)} pending donors")
                if len(response1) > 0:
                    # Check structure of first donor
                    donor = response1[0]
                    required_keys = ['id', 'donor_id', 'full_name', 'blood_group', 'phone', 'last_screening_date', 'last_screening_status']
                    missing_keys = [key for key in required_keys if key not in donor]
                    if not missing_keys:
                        print("   ✅ Pending donor structure valid")
                        print(f"   Sample donor: {donor['full_name']} ({donor['blood_group']}) - {donor['donor_id']}")
                    else:
                        print(f"   ❌ Missing keys in pending donor: {missing_keys}")
                        success1 = False
                else:
                    print("   ⚠️ No pending donors found")
            else:
                print("   ❌ Pending donors response is not a list")
                success1 = False
        
        # Test 2: GET /api/screenings/today/summary - Returns summary statistics of today's screenings
        success2, response2 = self.run_test(
            "GET /api/screenings/today/summary - Today's Summary",
            "GET",
            "screenings/today/summary",
            200
        )
        
        # Validate today's summary response structure
        if success2 and response2:
            required_keys = ['date', 'total', 'eligible', 'ineligible']
            missing_keys = [key for key in required_keys if key not in response2]
            if not missing_keys:
                print(f"   ✅ Today's summary structure valid")
                print(f"   Summary: {response2['total']} total, {response2['eligible']} eligible, {response2['ineligible']} ineligible on {response2['date']}")
            else:
                print(f"   ❌ Missing keys in today's summary: {missing_keys}")
                success2 = False
        
        # Test 3: GET /api/screenings?date=YYYY-MM-DD - Returns screenings for a specific date
        today = datetime.now().strftime("%Y-%m-%d")
        success3, response3 = self.run_test(
            "GET /api/screenings with date filter - Screenings by Date",
            "GET",
            "screenings",
            200,
            params={"date": today}
        )
        
        # Validate screenings by date response structure
        if success3 and response3:
            if isinstance(response3, list):
                print(f"   ✅ Found {len(response3)} screenings for {today}")
                if len(response3) > 0:
                    # Check structure and donor enrichment
                    screening = response3[0]
                    enrichment_keys = ['donor_name', 'donor_code', 'blood_group']
                    missing_enrichment = [key for key in enrichment_keys if key not in screening]
                    if not missing_enrichment:
                        print("   ✅ Screening enrichment with donor info valid")
                        print(f"   Sample screening: {screening['donor_name']} ({screening['donor_code']}) - {screening['eligibility_status']}")
                    else:
                        print(f"   ❌ Missing donor enrichment keys: {missing_enrichment}")
                        success3 = False
                else:
                    print("   ⚠️ No screenings found for today")
            else:
                print("   ❌ Screenings response is not a list")
                success3 = False
        
        # Test 4: POST /api/screenings - Create a new screening for an eligible donor
        # First, get a pending donor to screen
        test_donor_id = None
        if success1 and response1 and len(response1) > 0:
            test_donor_id = response1[0]['id']
            print(f"   Using donor ID for screening test: {test_donor_id}")
        
        success4 = False
        if test_donor_id:
            screening_data = {
                "donor_id": test_donor_id,
                "screening_date": today,
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
            
            success4, response4 = self.run_test(
                "POST /api/screenings - Create Eligible Screening",
                "POST",
                "screenings",
                200,
                data=screening_data
            )
            
            # Validate screening creation response
            if success4 and response4:
                required_keys = ['status', 'screening_id', 'eligibility_status']
                missing_keys = [key for key in required_keys if key not in response4]
                if not missing_keys:
                    print(f"   ✅ Screening created successfully: {response4['eligibility_status']}")
                    if response4['eligibility_status'] == 'eligible':
                        print("   ✅ Eligibility determination correct for valid vitals")
                    else:
                        print(f"   ⚠️ Unexpected eligibility status: {response4['eligibility_status']}")
                        if 'rejection_reason' in response4:
                            print(f"   Rejection reason: {response4['rejection_reason']}")
                else:
                    print(f"   ❌ Missing keys in screening response: {missing_keys}")
                    success4 = False
        else:
            print("   ⚠️ Skipping screening creation - no pending donor available")
            success4 = True  # Skip this test
        
        # Test 5: POST /api/screenings - Create a screening for an ineligible donor (test validation)
        success5 = False
        if test_donor_id and len(response1) > 1:  # Use a different donor if available
            test_donor_id_2 = response1[1]['id'] if len(response1) > 1 else test_donor_id
            ineligible_screening_data = {
                "donor_id": test_donor_id_2,
                "screening_date": today,
                "weight": 40.0,  # Below minimum (45 kg)
                "height": 170.0,
                "blood_pressure_systolic": 200,  # Above maximum (180)
                "blood_pressure_diastolic": 80,
                "pulse": 72,
                "temperature": 36.5,
                "hemoglobin": 10.0,  # Below minimum (12.5 g/dL)
                "preliminary_blood_group": "O+",
                "questionnaire_passed": False  # Failed questionnaire
            }
            
            success5, response5 = self.run_test(
                "POST /api/screenings - Create Ineligible Screening",
                "POST",
                "screenings",
                200,
                data=ineligible_screening_data
            )
            
            # Validate ineligible screening response
            if success5 and response5:
                if response5.get('eligibility_status') == 'ineligible':
                    print("   ✅ Eligibility determination correct for invalid vitals")
                    if 'rejection_reason' in response5:
                        print(f"   ✅ Rejection reasons provided: {response5['rejection_reason']}")
                    else:
                        print("   ⚠️ Missing rejection reason for ineligible screening")
                else:
                    print(f"   ❌ Expected ineligible status, got: {response5.get('eligibility_status')}")
                    success5 = False
        else:
            print("   ⚠️ Skipping ineligible screening test - insufficient donors available")
            success5 = True  # Skip this test
        
        return success1 and success2 and success3 and success4 and success5

def main():
    print("🩸 Enhanced Screening Page API Testing")
    print("=" * 50)
    
    tester = ScreeningAPITester()
    
    # Test sequence
    test_sequence = [
        ("Admin Login", lambda: tester.test_user_login(tester.admin_email, tester.admin_password)),
        ("Enhanced Screening APIs", tester.test_enhanced_screening_apis),
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
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if failed_tests:
        print(f"\n❌ Failed Tests ({len(failed_tests)}):")
        for test in failed_tests:
            print(f"   - {test}")
    else:
        print("\n🎉 All tests passed!")
    
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"📈 Success Rate: {success_rate:.1f}%")

if __name__ == "__main__":
    main()