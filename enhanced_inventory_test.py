#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta

class EnhancedInventoryTester:
    def __init__(self, base_url="https://bloodsync-platform.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.admin_email = "admin@bloodbank.com"
        self.admin_password = "adminpassword"

    def login(self):
        """Login as admin"""
        url = f"{self.base_url}/auth/login"
        response = requests.post(url, json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        if response.status_code == 200:
            self.token = response.json()["token"]
            print("✅ Admin login successful")
            return True
        print("❌ Admin login failed")
        return False

    def make_request(self, method, endpoint, data=None, params=None):
        """Make authenticated request"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, params=params)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            return response.status_code, response.json() if response.content else {}
        except Exception as e:
            print(f"Request error: {e}")
            return 500, {}

    def test_dashboard_views(self):
        """Test all dashboard views with real data"""
        print("\n📊 Testing Dashboard Views...")
        
        # Test By Storage
        status, data = self.make_request('GET', 'inventory-enhanced/dashboard/by-storage')
        if status == 200:
            print(f"✅ By Storage: Found {len(data)} storage locations")
            if data:
                storage = data[0]
                print(f"   📍 Sample: {storage.get('storage_name')} - {storage.get('current_occupancy')}/{storage.get('capacity')} ({storage.get('occupancy_percent')}%)")
        else:
            print(f"❌ By Storage failed: {status}")

        # Test By Blood Group
        status, data = self.make_request('GET', 'inventory-enhanced/dashboard/by-blood-group')
        if status == 200:
            print(f"✅ By Blood Group: Found data for {len(data)} blood groups")
            for bg_data in data:
                if bg_data.get('total_items', 0) > 0:
                    print(f"   🩸 {bg_data['blood_group']}: {bg_data['total_items']} items ({bg_data['units_count']} units, {bg_data['components_count']} components)")
        else:
            print(f"❌ By Blood Group failed: {status}")

        # Test By Component Type
        status, data = self.make_request('GET', 'inventory-enhanced/dashboard/by-component-type')
        if status == 200:
            print(f"✅ By Component Type: Found {len(data)} component types")
            for comp_data in data:
                if comp_data.get('count', 0) > 0:
                    print(f"   🧪 {comp_data['display_name']}: {comp_data['count']} items, {comp_data['total_volume']}ml")
        else:
            print(f"❌ By Component Type failed: {status}")

        # Test By Expiry
        status, data = self.make_request('GET', 'inventory-enhanced/dashboard/by-expiry')
        if status == 200:
            print(f"✅ By Expiry: Found {len(data.get('items', []))} items")
            summary = data.get('summary', {})
            print(f"   ⏰ Expired: {summary.get('expired', 0)}, Critical: {summary.get('critical', 0)}, Warning: {summary.get('warning', 0)}")
        else:
            print(f"❌ By Expiry failed: {status}")

        # Test By Status
        status, data = self.make_request('GET', 'inventory-enhanced/dashboard/by-status')
        if status == 200:
            print(f"✅ By Status: Found {len(data)} status categories")
            for status_data in data:
                if status_data.get('total_count', 0) > 0:
                    print(f"   📋 {status_data['display_name']}: {status_data['total_count']} items")
        else:
            print(f"❌ By Status failed: {status}")

    def test_search_and_locate(self):
        """Test search and locate functionality"""
        print("\n🔍 Testing Search & Locate...")
        
        # Get some real data first
        status, data = self.make_request('GET', 'inventory-enhanced/dashboard/by-expiry')
        if status == 200 and data.get('items'):
            # Test with real unit ID
            real_item = data['items'][0]
            item_id = real_item.get('item_id') or real_item.get('unit_id') or real_item.get('component_id')
            
            if item_id:
                print(f"   Testing with real item ID: {item_id}")
                
                # Test search
                status, search_data = self.make_request('GET', 'inventory-enhanced/search', params={'q': item_id[:8]})
                if status == 200:
                    print(f"✅ Search: Found {len(search_data.get('items', []))} items")
                else:
                    print(f"❌ Search failed: {status}")
                
                # Test locate
                status, locate_data = self.make_request('GET', f'inventory-enhanced/locate/{item_id}')
                if status == 200:
                    if locate_data.get('found'):
                        print(f"✅ Locate: {locate_data['location']['display']}")
                    else:
                        print("✅ Locate: Item not found (expected for some items)")
                else:
                    print(f"❌ Locate failed: {status}")
        else:
            print("⚠️ No items found for testing search/locate")

    def test_reports(self):
        """Test all report endpoints"""
        print("\n📈 Testing Reports...")
        
        # Stock Report
        status, data = self.make_request('GET', 'inventory-enhanced/reports/stock')
        if status == 200:
            summary = data.get('summary', {})
            print(f"✅ Stock Report: {summary.get('total_items', 0)} total items ({summary.get('total_units', 0)} units, {summary.get('total_components', 0)} components)")
        else:
            print(f"❌ Stock Report failed: {status}")

        # Expiry Analysis
        status, data = self.make_request('GET', 'inventory-enhanced/reports/expiry-analysis')
        if status == 200:
            summary = data.get('summary', {})
            print(f"✅ Expiry Analysis: {summary.get('expired', 0)} expired, {summary.get('expiring_3_days', 0)} expiring in 3 days")
        else:
            print(f"❌ Expiry Analysis failed: {status}")

        # Storage Utilization
        status, data = self.make_request('GET', 'inventory-enhanced/reports/storage-utilization')
        if status == 200:
            summary = data.get('summary', {})
            print(f"✅ Storage Utilization: {summary.get('overall_utilization', 0)}% overall utilization")
            print(f"   🚨 Critical: {summary.get('critical_count', 0)}, Warning: {summary.get('warning_count', 0)}")
        else:
            print(f"❌ Storage Utilization failed: {status}")

        # Movement Report
        status, data = self.make_request('GET', 'inventory-enhanced/reports/movement')
        if status == 200:
            print(f"✅ Movement Report: {data.get('total_movements', 0)} total movements")
        else:
            print(f"❌ Movement Report failed: {status}")

    def test_reserve_system(self):
        """Test reserve system with real data"""
        print("\n🔒 Testing Reserve System...")
        
        # Get reserved items
        status, data = self.make_request('GET', 'inventory-enhanced/reserved')
        if status == 200:
            print(f"✅ Reserved Items: {len(data)} currently reserved")
            for item in data[:3]:  # Show first 3
                print(f"   📦 {item.get('item_id')}: Reserved for {item.get('reserved_for', 'Unknown')}")
        else:
            print(f"❌ Get Reserved Items failed: {status}")

        # Test auto-release
        status, data = self.make_request('POST', 'inventory-enhanced/reserve/auto-release')
        if status == 200:
            print(f"✅ Auto-release: Released {data.get('total_released', 0)} expired reservations")
        else:
            print(f"❌ Auto-release failed: {status}")

    def test_with_real_component(self):
        """Test reserve/move operations with real component if available"""
        print("\n🧪 Testing with Real Component...")
        
        # Get a real component
        status, data = self.make_request('GET', 'inventory-enhanced/dashboard/by-component-type')
        if status == 200:
            for comp_type in data:
                if comp_type.get('count', 0) > 0 and comp_type.get('items'):
                    component = comp_type['items'][0]
                    comp_id = component.get('component_id') or component.get('id')
                    
                    if comp_id:
                        print(f"   Found component: {comp_id}")
                        
                        # Test reservation
                        reserve_data = {
                            "item_ids": [comp_id],
                            "item_type": "component",
                            "reserved_for": "Test Hospital - Enhanced Inventory Test",
                            "notes": "Testing enhanced inventory reserve system"
                        }
                        
                        status, reserve_result = self.make_request('POST', 'inventory-enhanced/reserve', data=reserve_data)
                        if status == 200:
                            if reserve_result.get('reserved_count', 0) > 0:
                                print(f"✅ Successfully reserved component {comp_id}")
                                
                                # Test release
                                status, release_result = self.make_request('POST', f'inventory-enhanced/reserve/{comp_id}/release', params={'item_type': 'component'})
                                if status == 200:
                                    print(f"✅ Successfully released reservation for {comp_id}")
                                else:
                                    print(f"❌ Failed to release reservation: {status}")
                            else:
                                print(f"⚠️ Reservation failed: {reserve_result.get('failed', [])}")
                        else:
                            print(f"❌ Reservation request failed: {status}")
                        return
            
            print("⚠️ No available components found for testing")

def main():
    print("🧪 Enhanced Inventory Management System - Comprehensive Testing")
    print("=" * 70)
    
    tester = EnhancedInventoryTester()
    
    if not tester.login():
        return 1
    
    # Run comprehensive tests
    tester.test_dashboard_views()
    tester.test_search_and_locate()
    tester.test_reports()
    tester.test_reserve_system()
    tester.test_with_real_component()
    
    print("\n✅ Enhanced Inventory Management System testing completed!")
    return 0

if __name__ == "__main__":
    sys.exit(main())