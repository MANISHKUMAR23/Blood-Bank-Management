#!/usr/bin/env python3

import requests
import json
from datetime import datetime

class LabelContentTest:
    def __init__(self, base_url="https://bloodsync-platform.preview.emergentagent.com/api"):
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
    
    def get_test_data(self):
        """Get some test blood units and components"""
        headers = {'Authorization': f'Bearer {self.token}'}
        
        # Get blood units
        units_response = requests.get(f"{self.base_url}/blood-units", headers=headers)
        units = units_response.json() if units_response.status_code == 200 else []
        
        # Get components
        components_response = requests.get(f"{self.base_url}/components", headers=headers)
        components = components_response.json() if components_response.status_code == 200 else []
        
        return units, components
    
    def test_label_content(self):
        """Test actual label content"""
        headers = {'Authorization': f'Bearer {self.token}'}
        
        print("🏷️ Testing Label Content Accuracy...")
        
        units, components = self.get_test_data()
        
        if units:
            unit = units[0]
            unit_id = unit.get('unit_id') or unit.get('id')
            print(f"\n📋 Testing Blood Unit: {unit_id}")
            
            # Get label data
            response = requests.get(f"{self.base_url}/labels/blood-unit/{unit_id}", headers=headers)
            if response.status_code == 200:
                label_data = response.json()
                
                print("   Label Data Structure:")
                for key, value in label_data.items():
                    print(f"     {key}: {value}")
                
                # Validate critical fields
                critical_fields = ['unit_id', 'blood_group', 'component_type', 'storage_temp', 'blood_bank_name']
                missing_critical = [field for field in critical_fields if not label_data.get(field)]
                
                if not missing_critical:
                    print("   ✅ All critical fields present")
                else:
                    print(f"   ❌ Missing critical fields: {missing_critical}")
                
                # Validate storage temperature format
                storage_temp = label_data.get('storage_temp')
                if storage_temp and ('°C' in storage_temp or '°F' in storage_temp):
                    print("   ✅ Storage temperature has proper unit")
                else:
                    print(f"   ⚠️ Storage temperature format issue: {storage_temp}")
                
                # Validate blood bank name
                if label_data.get('blood_bank_name') == 'BLOODLINK BLOOD BANK':
                    print("   ✅ Blood bank name is correct")
                else:
                    print(f"   ⚠️ Blood bank name issue: {label_data.get('blood_bank_name')}")
                
                # Validate warnings is a list
                warnings = label_data.get('warnings')
                if isinstance(warnings, list):
                    print(f"   ✅ Warnings is a list with {len(warnings)} items")
                else:
                    print(f"   ❌ Warnings should be a list, got: {type(warnings)}")
            else:
                print(f"   ❌ Failed to get label data: {response.status_code}")
        
        if components:
            component = components[0]
            comp_id = component.get('component_id') or component.get('id')
            print(f"\n📋 Testing Component: {comp_id}")
            
            # Get label data
            response = requests.get(f"{self.base_url}/labels/component/{comp_id}", headers=headers)
            if response.status_code == 200:
                label_data = response.json()
                
                print("   Component Label Data Structure:")
                for key, value in label_data.items():
                    print(f"     {key}: {value}")
                
                # Validate component-specific fields
                component_fields = ['component_type', 'parent_unit_id']
                missing_comp_fields = [field for field in component_fields if not label_data.get(field)]
                
                if not missing_comp_fields:
                    print("   ✅ All component-specific fields present")
                else:
                    print(f"   ⚠️ Missing component fields: {missing_comp_fields}")
                
                # Validate component type
                comp_type = label_data.get('component_type')
                valid_types = ['prc', 'plasma', 'ffp', 'platelets', 'cryoprecipitate', 'whole_blood']
                if comp_type in valid_types:
                    print(f"   ✅ Valid component type: {comp_type}")
                else:
                    print(f"   ⚠️ Invalid component type: {comp_type}")
            else:
                print(f"   ❌ Failed to get component label data: {response.status_code}")
        
        # Test bulk API with real data
        if units or components:
            print(f"\n📋 Testing Bulk API with real data...")
            unit_ids = [units[0].get('unit_id') or units[0].get('id')] if units else []
            comp_ids = [components[0].get('component_id') or components[0].get('id')] if components else []
            
            response = requests.post(
                f"{self.base_url}/labels/bulk",
                json={"unit_ids": unit_ids, "component_ids": comp_ids},
                headers=headers
            )
            
            if response.status_code == 200:
                bulk_data = response.json()
                print(f"   ✅ Bulk API returned {len(bulk_data)} labels")
                
                # Validate each label in bulk response
                for i, label in enumerate(bulk_data):
                    if 'unit_id' in label and 'blood_group' in label:
                        print(f"     Label {i+1}: {label['unit_id']} - {label['blood_group']} - {label['component_type']}")
                    else:
                        print(f"     Label {i+1}: Missing required fields")
            else:
                print(f"   ❌ Bulk API failed: {response.status_code}")
        
        print("\n✅ Label content testing complete!")

def main():
    tester = LabelContentTest()
    if tester.login():
        print("✅ Login successful")
        tester.test_label_content()
    else:
        print("❌ Login failed")

if __name__ == "__main__":
    main()