"""
Phase G: Compliance & Training Module Tests
Tests for compliance requirements, organization compliance tracking,
training courses, and staff training records.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://bbms-security.preview.emergentagent.com').rstrip('/')

# Test credentials
SYSTEM_ADMIN = {"email": "admin@bloodbank.com", "password": "adminpassword"}
SUPER_ADMIN = {"email": "superadmin@bloodlink.com", "password": "superadmin123"}
TEST_ORG_ID = "61d41b01-1b7d-4064-9cff-3fa8a0fd554b"


class TestComplianceRequirements:
    """Tests for compliance requirements CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get system admin token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SYSTEM_ADMIN)
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.system_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.system_token}"}
    
    def test_get_compliance_requirements(self):
        """Test GET /api/compliance/requirements returns seeded requirements"""
        response = requests.get(f"{BASE_URL}/api/compliance/requirements", headers=self.headers)
        assert response.status_code == 200
        
        requirements = response.json()
        assert isinstance(requirements, list)
        assert len(requirements) == 6  # 6 default requirements seeded
        
        # Verify structure
        req = requirements[0]
        assert "id" in req
        assert "name" in req
        assert "category" in req
        assert "is_mandatory" in req
        assert "requires_document" in req
    
    def test_get_requirements_filter_by_category(self):
        """Test filtering requirements by category"""
        response = requests.get(
            f"{BASE_URL}/api/compliance/requirements",
            params={"category": "regulatory"},
            headers=self.headers
        )
        assert response.status_code == 200
        
        requirements = response.json()
        for req in requirements:
            assert req["category"] == "regulatory"
    
    def test_get_requirements_mandatory_only(self):
        """Test filtering mandatory requirements only"""
        response = requests.get(
            f"{BASE_URL}/api/compliance/requirements",
            params={"mandatory_only": True},
            headers=self.headers
        )
        assert response.status_code == 200
        
        requirements = response.json()
        assert len(requirements) == 4  # 4 mandatory requirements
        for req in requirements:
            assert req["is_mandatory"] == True
    
    def test_seed_defaults_idempotent(self):
        """Test that seeding defaults is idempotent"""
        response = requests.post(f"{BASE_URL}/api/compliance/seed-defaults", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "success"
        assert "Created 0 compliance requirements" in data["message"]  # Already seeded


class TestOrganizationCompliance:
    """Tests for organization compliance tracking"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get super admin token for org-level tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get a requirement ID for testing
        req_response = requests.get(f"{BASE_URL}/api/compliance/requirements", headers=self.headers)
        self.requirements = req_response.json()
        self.test_req_id = self.requirements[0]["id"]
    
    def test_get_organization_compliance(self):
        """Test GET /api/compliance/organizations/{org_id}"""
        response = requests.get(
            f"{BASE_URL}/api/compliance/organizations/{TEST_ORG_ID}",
            headers=self.headers
        )
        assert response.status_code == 200
        
        compliance_data = response.json()
        assert isinstance(compliance_data, list)
        assert len(compliance_data) == 6  # One entry per requirement
        
        # Verify structure
        item = compliance_data[0]
        assert "requirement" in item
        assert "compliance" in item
        assert "status" in item
        assert "is_expired" in item
        assert "days_until_expiry" in item
    
    def test_get_compliance_summary(self):
        """Test GET /api/compliance/organizations/{org_id}/summary"""
        response = requests.get(
            f"{BASE_URL}/api/compliance/organizations/{TEST_ORG_ID}/summary",
            headers=self.headers
        )
        assert response.status_code == 200
        
        summary = response.json()
        assert "total_requirements" in summary
        assert "mandatory_requirements" in summary
        assert "compliant" in summary
        assert "non_compliant" in summary
        assert "pending" in summary
        assert "compliance_rate" in summary
        assert summary["total_requirements"] == 6
        assert summary["mandatory_requirements"] == 4
    
    def test_update_compliance_status(self):
        """Test POST /api/compliance/organizations/{org_id}?requirement_id=xxx"""
        # Find a requirement that's not already compliant
        req_id = self.requirements[1]["id"]  # Use second requirement
        
        response = requests.post(
            f"{BASE_URL}/api/compliance/organizations/{TEST_ORG_ID}",
            params={"requirement_id": req_id},
            json={"status": "compliant", "expiry_date": "2027-06-30", "notes": "Test compliance update"},
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "success"
        assert data["message"] == "Compliance updated"
        
        # Verify the update
        verify_response = requests.get(
            f"{BASE_URL}/api/compliance/organizations/{TEST_ORG_ID}",
            headers=self.headers
        )
        compliance_data = verify_response.json()
        updated_item = next((c for c in compliance_data if c["requirement"]["id"] == req_id), None)
        assert updated_item is not None
        assert updated_item["status"] == "compliant"
    
    def test_unauthorized_org_access(self):
        """Test that unauthorized users cannot access other org's compliance"""
        # Create a new session without org access
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SYSTEM_ADMIN)
        system_token = response.json()["token"]
        system_headers = {"Authorization": f"Bearer {system_token}"}
        
        # System admin should have access to all orgs
        response = requests.get(
            f"{BASE_URL}/api/compliance/organizations/{TEST_ORG_ID}",
            headers=system_headers
        )
        # System admin has access
        assert response.status_code == 200


class TestTrainingCourses:
    """Tests for training courses CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get system admin token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SYSTEM_ADMIN)
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.system_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.system_token}"}
    
    def test_get_training_courses(self):
        """Test GET /api/training/courses returns seeded courses"""
        response = requests.get(f"{BASE_URL}/api/training/courses", headers=self.headers)
        assert response.status_code == 200
        
        courses = response.json()
        assert isinstance(courses, list)
        assert len(courses) == 8  # 8 default courses seeded
        
        # Verify structure
        course = courses[0]
        assert "id" in course
        assert "name" in course
        assert "category" in course
        assert "duration_hours" in course
        assert "is_mandatory" in course
        assert "validity_period_days" in course
    
    def test_get_courses_filter_by_category(self):
        """Test filtering courses by category"""
        response = requests.get(
            f"{BASE_URL}/api/training/courses",
            params={"category": "safety"},
            headers=self.headers
        )
        assert response.status_code == 200
        
        courses = response.json()
        assert len(courses) == 2  # Blood Safety Fundamentals, Infection Control
        for course in courses:
            assert course["category"] == "safety"
    
    def test_get_courses_mandatory_only(self):
        """Test filtering mandatory courses only"""
        response = requests.get(
            f"{BASE_URL}/api/training/courses",
            params={"mandatory_only": True},
            headers=self.headers
        )
        assert response.status_code == 200
        
        courses = response.json()
        assert len(courses) == 7  # 7 mandatory courses
        for course in courses:
            assert course["is_mandatory"] == True
    
    def test_seed_defaults_idempotent(self):
        """Test that seeding defaults is idempotent"""
        response = requests.post(f"{BASE_URL}/api/training/seed-defaults", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "success"
        assert "Created 0 training courses" in data["message"]  # Already seeded


class TestTrainingRecords:
    """Tests for staff training records"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get super admin token and user info for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get user info
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        self.user_id = me_response.json()["id"]
        
        # Get a course ID for testing
        courses_response = requests.get(f"{BASE_URL}/api/training/courses", headers=self.headers)
        self.courses = courses_response.json()
        # Use a different course than the one already assigned
        self.test_course_id = self.courses[1]["id"]  # Infection Control
    
    def test_get_organization_training_records(self):
        """Test GET /api/training/organizations/{org_id}/records"""
        response = requests.get(
            f"{BASE_URL}/api/training/organizations/{TEST_ORG_ID}/records",
            headers=self.headers
        )
        assert response.status_code == 200
        
        records = response.json()
        assert isinstance(records, list)
        # Should have at least one record from previous test
        if len(records) > 0:
            record = records[0]
            assert "id" in record
            assert "user_id" in record
            assert "course_id" in record
            assert "status" in record
            assert "course" in record
            assert "user" in record
    
    def test_get_training_summary(self):
        """Test GET /api/training/organizations/{org_id}/summary"""
        response = requests.get(
            f"{BASE_URL}/api/training/organizations/{TEST_ORG_ID}/summary",
            headers=self.headers
        )
        assert response.status_code == 200
        
        summary = response.json()
        assert "total_staff" in summary
        assert "total_courses" in summary
        assert "mandatory_courses" in summary
        assert "total_assignments" in summary
        assert "completed" in summary
        assert "in_progress" in summary
        assert "not_started" in summary
        assert "completion_rate" in summary
        assert "by_status" in summary
        assert summary["total_courses"] == 8
        assert summary["mandatory_courses"] == 7
    
    def test_assign_training_workflow(self):
        """Test full training workflow: assign -> start -> complete"""
        # Step 1: Assign training
        assign_response = requests.post(
            f"{BASE_URL}/api/training/organizations/{TEST_ORG_ID}/assign",
            json={
                "user_id": self.user_id,
                "course_id": self.test_course_id,
                "notes": "Test training assignment"
            },
            headers=self.headers
        )
        assert assign_response.status_code == 200
        
        assign_data = assign_response.json()
        assert assign_data["status"] == "success"
        record_id = assign_data["id"]
        
        # Step 2: Start training
        start_response = requests.put(
            f"{BASE_URL}/api/training/records/{record_id}/start",
            headers=self.headers
        )
        assert start_response.status_code == 200
        assert start_response.json()["message"] == "Training started"
        
        # Verify status changed to in_progress
        records_response = requests.get(
            f"{BASE_URL}/api/training/organizations/{TEST_ORG_ID}/records",
            headers=self.headers
        )
        records = records_response.json()
        record = next((r for r in records if r["id"] == record_id), None)
        assert record is not None
        assert record["status"] == "in_progress"
        
        # Step 3: Complete training with score
        complete_response = requests.put(
            f"{BASE_URL}/api/training/records/{record_id}/complete",
            params={"score": 90},
            headers=self.headers
        )
        assert complete_response.status_code == 200
        
        complete_data = complete_response.json()
        assert complete_data["status"] == "success"
        assert "expiry_date" in complete_data
        
        # Verify final status
        records_response = requests.get(
            f"{BASE_URL}/api/training/organizations/{TEST_ORG_ID}/records",
            headers=self.headers
        )
        records = records_response.json()
        record = next((r for r in records if r["id"] == record_id), None)
        assert record is not None
        assert record["status"] == "completed"
    
    def test_assign_duplicate_training_fails(self):
        """Test that assigning same training twice fails"""
        # First assignment
        first_response = requests.post(
            f"{BASE_URL}/api/training/organizations/{TEST_ORG_ID}/assign",
            json={
                "user_id": self.user_id,
                "course_id": self.courses[2]["id"],  # Use third course
                "notes": "First assignment"
            },
            headers=self.headers
        )
        assert first_response.status_code == 200
        
        # Second assignment should fail
        second_response = requests.post(
            f"{BASE_URL}/api/training/organizations/{TEST_ORG_ID}/assign",
            json={
                "user_id": self.user_id,
                "course_id": self.courses[2]["id"],
                "notes": "Duplicate assignment"
            },
            headers=self.headers
        )
        assert second_response.status_code == 400
        assert "already assigned" in second_response.json()["detail"]
    
    def test_complete_training_below_passing_score_fails(self):
        """Test that completing training below passing score fails"""
        # Assign a new training
        assign_response = requests.post(
            f"{BASE_URL}/api/training/organizations/{TEST_ORG_ID}/assign",
            json={
                "user_id": self.user_id,
                "course_id": self.courses[3]["id"],  # Use fourth course
                "notes": "Test low score"
            },
            headers=self.headers
        )
        assert assign_response.status_code == 200
        record_id = assign_response.json()["id"]
        
        # Start training
        requests.put(f"{BASE_URL}/api/training/records/{record_id}/start", headers=self.headers)
        
        # Try to complete with low score (passing score is 80-90 for most courses)
        complete_response = requests.put(
            f"{BASE_URL}/api/training/records/{record_id}/complete",
            params={"score": 50},
            headers=self.headers
        )
        assert complete_response.status_code == 400
        assert "below passing score" in complete_response.json()["detail"]


class TestComplianceDocumentLinking:
    """Tests for linking documents to compliance requirements"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get super admin token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get a requirement ID
        req_response = requests.get(f"{BASE_URL}/api/compliance/requirements", headers=self.headers)
        self.requirements = req_response.json()
        self.test_req_id = self.requirements[2]["id"]  # Use third requirement
    
    def test_link_document_requires_valid_document(self):
        """Test that linking requires a valid document ID"""
        response = requests.post(
            f"{BASE_URL}/api/compliance/organizations/{TEST_ORG_ID}/link-document",
            params={
                "requirement_id": self.test_req_id,
                "document_id": "invalid-doc-id"
            },
            headers=self.headers
        )
        assert response.status_code == 404
        assert "Document not found" in response.json()["detail"]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
