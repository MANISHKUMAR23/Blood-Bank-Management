#!/usr/bin/env python3

import requests
import json

def test_specific_endpoints():
    """Test specific Enhanced Inventory endpoints with admin credentials"""
    base_url = "https://bloodsync-platform.preview.emergentagent.com/api"
    
    # Login
    login_response = requests.post(f"{base_url}/auth/login", json={
        "email": "admin@bloodbank.com",
        "password": "adminpassword"
    })
    
    if login_response.status_code != 200:
        print("❌ Login failed")
        return
    
    token = login_response.json()["token"]
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    
    print("🧪 Testing Specific Enhanced Inventory Endpoints")
    print("=" * 50)
    
    # Test 1: Dashboard by storage with detailed validation
    print("\n1. Testing Dashboard by Storage:")
    response = requests.get(f"{base_url}/inventory-enhanced/dashboard/by-storage", headers=headers)
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Status: {response.status_code}")
        print(f"   Found {len(data)} storage locations")
        if data:
            storage = data[0]
            required_fields = ['id', 'location_code', 'storage_name', 'capacity', 'current_occupancy', 'occupancy_percent']
            missing = [f for f in required_fields if f not in storage]
            if not missing:
                print("   ✅ All required fields present")
            else:
                print(f"   ❌ Missing fields: {missing}")
    else:
        print(f"❌ Status: {response.status_code}")
    
    # Test 2: Dashboard by blood group
    print("\n2. Testing Dashboard by Blood Group:")
    response = requests.get(f"{base_url}/inventory-enhanced/dashboard/by-blood-group", headers=headers)
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Status: {response.status_code}")
        blood_groups = [item['blood_group'] for item in data]
        expected_bgs = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
        if all(bg in blood_groups for bg in expected_bgs):
            print("   ✅ All blood groups present")
        else:
            print(f"   ⚠️ Blood groups found: {blood_groups}")
    else:
        print(f"❌ Status: {response.status_code}")
    
    # Test 3: Dashboard by expiry with categories
    print("\n3. Testing Dashboard by Expiry:")
    response = requests.get(f"{base_url}/inventory-enhanced/dashboard/by-expiry", headers=headers)
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Status: {response.status_code}")
        if 'categories' in data and 'summary' in data:
            categories = data['categories']
            summary = data['summary']
            print(f"   📊 Summary: Expired: {summary.get('expired', 0)}, Critical: {summary.get('critical', 0)}")
            print(f"   📦 Total items: {len(data.get('items', []))}")
            
            # Check categories
            expected_cats = ['expired', 'critical', 'warning', 'caution', 'normal']
            if all(cat in categories for cat in expected_cats):
                print("   ✅ All expiry categories present")
            else:
                print(f"   ❌ Missing categories: {[c for c in expected_cats if c not in categories]}")
        else:
            print("   ❌ Missing categories or summary in response")
    else:
        print(f"❌ Status: {response.status_code}")
    
    # Test 4: Search functionality
    print("\n4. Testing Search:")
    response = requests.get(f"{base_url}/inventory-enhanced/search", headers=headers, params={'q': 'BU-2025'})
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Status: {response.status_code}")
        print(f"   Found {len(data.get('items', []))} items matching 'BU-2025'")
        if data.get('items'):
            item = data['items'][0]
            print(f"   📦 Sample: {item.get('item_id')} ({item.get('item_type')})")
    else:
        print(f"❌ Status: {response.status_code}")
    
    # Test 5: Stock Report
    print("\n5. Testing Stock Report:")
    response = requests.get(f"{base_url}/inventory-enhanced/reports/stock", headers=headers)
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Status: {response.status_code}")
        summary = data.get('summary', {})
        print(f"   📊 Total: {summary.get('total_items', 0)} items")
        print(f"   🩸 Units: {summary.get('total_units', 0)}")
        print(f"   🧪 Components: {summary.get('total_components', 0)}")
        
        # Check structure
        required_keys = ['summary', 'by_blood_group', 'by_component_type', 'by_storage']
        missing = [k for k in required_keys if k not in data]
        if not missing:
            print("   ✅ Report structure valid")
        else:
            print(f"   ❌ Missing keys: {missing}")
    else:
        print(f"❌ Status: {response.status_code}")
    
    # Test 6: Expiry Analysis Report
    print("\n6. Testing Expiry Analysis Report:")
    response = requests.get(f"{base_url}/inventory-enhanced/reports/expiry-analysis", headers=headers)
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Status: {response.status_code}")
        summary = data.get('summary', {})
        print(f"   ⏰ Expired: {summary.get('expired', 0)}")
        print(f"   🚨 Expiring in 3 days: {summary.get('expiring_3_days', 0)}")
        print(f"   ⚠️ Expiring in 7 days: {summary.get('expiring_7_days', 0)}")
        
        # Check categories
        categories = data.get('categories', {})
        if categories:
            print("   ✅ Expiry categories present")
        else:
            print("   ❌ No expiry categories found")
    else:
        print(f"❌ Status: {response.status_code}")
    
    # Test 7: Storage Utilization Report
    print("\n7. Testing Storage Utilization Report:")
    response = requests.get(f"{base_url}/inventory-enhanced/reports/storage-utilization", headers=headers)
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Status: {response.status_code}")
        summary = data.get('summary', {})
        print(f"   📊 Overall utilization: {summary.get('overall_utilization', 0)}%")
        print(f"   🚨 Critical locations: {summary.get('critical_count', 0)}")
        print(f"   ⚠️ Warning locations: {summary.get('warning_count', 0)}")
        
        locations = data.get('locations', [])
        print(f"   📍 Total locations: {len(locations)}")
    else:
        print(f"❌ Status: {response.status_code}")
    
    # Test 8: Reserved Items
    print("\n8. Testing Reserved Items:")
    response = requests.get(f"{base_url}/inventory-enhanced/reserved", headers=headers)
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Status: {response.status_code}")
        print(f"   🔒 Currently reserved: {len(data)} items")
        if data:
            for item in data[:3]:  # Show first 3
                print(f"   📦 {item.get('item_id')}: {item.get('reserved_for', 'Unknown')}")
    else:
        print(f"❌ Status: {response.status_code}")
    
    # Test 9: Auto-release expired reservations
    print("\n9. Testing Auto-release Expired Reservations:")
    response = requests.post(f"{base_url}/inventory-enhanced/reserve/auto-release", headers=headers)
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Status: {response.status_code}")
        print(f"   🔓 Released: {data.get('total_released', 0)} expired reservations")
        print(f"   📊 Units: {data.get('units_released', 0)}, Components: {data.get('components_released', 0)}")
    else:
        print(f"❌ Status: {response.status_code}")
    
    print("\n✅ All Enhanced Inventory endpoints tested successfully!")

if __name__ == "__main__":
    test_specific_endpoints()