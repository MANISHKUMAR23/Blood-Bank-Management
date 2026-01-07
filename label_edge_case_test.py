#!/usr/bin/env python3

import requests
import json

class LabelEdgeCaseTest:
    def __init__(self, base_url="https://docusafe-17.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        
    def login(self):
        """Login as admin"""
        response = requests.post(
            f"{self.base_url}/auth/login",
            json={"email": "admin@bloodbank.com", "password": "adminpassword"}
        )
        if response.status_code == 200:
            self.token = response.json()["token"]
            return True
        return False
    
    def test_edge_cases(self):
        """Test edge cases for label APIs"""
        headers = {'Authorization': f'Bearer {self.token}'}
        
        print("🧪 Testing Label API Edge Cases...")
        
        # Test 1: Empty unit ID
        print("\n1. Testing empty unit ID...")
        response = requests.get(f"{self.base_url}/labels/blood-unit/", headers=headers)
        print(f"   Empty unit ID: {response.status_code} (expected 404/405)")
        
        # Test 2: Special characters in ID
        print("\n2. Testing special characters in ID...")
        response = requests.get(f"{self.base_url}/labels/blood-unit/test@#$%", headers=headers)
        print(f"   Special chars: {response.status_code} (expected 404)")
        
        # Test 3: Very long ID
        print("\n3. Testing very long ID...")
        long_id = "a" * 1000
        response = requests.get(f"{self.base_url}/labels/blood-unit/{long_id}", headers=headers)
        print(f"   Long ID: {response.status_code} (expected 404)")
        
        # Test 4: SQL injection attempt
        print("\n4. Testing SQL injection attempt...")
        sql_id = "'; DROP TABLE blood_units; --"
        response = requests.get(f"{self.base_url}/labels/blood-unit/{sql_id}", headers=headers)
        print(f"   SQL injection: {response.status_code} (expected 404)")
        
        # Test 5: Bulk API with empty arrays
        print("\n5. Testing bulk API with empty arrays...")
        response = requests.post(
            f"{self.base_url}/labels/bulk",
            json={"unit_ids": [], "component_ids": []},
            headers=headers
        )
        print(f"   Empty bulk: {response.status_code} (expected 200)")
        if response.status_code == 200:
            data = response.json()
            print(f"   Empty bulk result: {len(data)} items (expected 0)")
        
        # Test 6: Bulk API with mix of valid and invalid IDs
        print("\n6. Testing bulk API with mixed IDs...")
        response = requests.post(
            f"{self.base_url}/labels/bulk",
            json={"unit_ids": ["valid-id", "invalid-id"], "component_ids": ["valid-comp", "invalid-comp"]},
            headers=headers
        )
        print(f"   Mixed bulk: {response.status_code} (expected 200)")
        if response.status_code == 200:
            data = response.json()
            print(f"   Mixed bulk result: {len(data)} items (should skip invalid IDs)")
        
        # Test 7: Test without authentication
        print("\n7. Testing without authentication...")
        response = requests.get(f"{self.base_url}/labels/blood-unit/test-id")
        print(f"   No auth: {response.status_code} (expected 401/403)")
        
        print("\n✅ Edge case testing complete!")

def main():
    tester = LabelEdgeCaseTest()
    if tester.login():
        print("✅ Login successful")
        tester.test_edge_cases()
    else:
        print("❌ Login failed")

if __name__ == "__main__":
    main()