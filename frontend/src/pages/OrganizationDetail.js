import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { organizationAPI, documentAPI } from '../lib/api';
import api from '../lib/api';
import { toast } from 'sonner';
import {
  Building2, Users, Package, Activity, Settings, ArrowLeft,
  Edit2, Trash2, UserPlus, Mail, Phone, MapPin, FileText,
  Shield, Clock, CheckCircle, AlertTriangle, RefreshCw,
  BarChart3, Droplet, Calendar, Upload, Download, Eye,
  File, FileCheck, FileWarning, X
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '../components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';

const USER_ROLES = [
  { value: 'admin', label: 'Administrator' },
  { value: 'registration', label: 'Registration Staff' },
  { value: 'phlebotomist', label: 'Phlebotomist' },
  { value: 'lab_tech', label: 'Lab Technician' },
  { value: 'processing', label: 'Processing Tech' },
  { value: 'qc_manager', label: 'QC Manager' },
  { value: 'inventory', label: 'Inventory Manager' },
  { value: 'distribution', label: 'Distribution Staff' },
];

const USER_TYPE_COLORS = {
  system_admin: 'bg-red-100 text-red-700',
  super_admin: 'bg-purple-100 text-purple-700',
  tenant_admin: 'bg-blue-100 text-blue-700',
  staff: 'bg-slate-100 text-slate-700',
};

const DOCUMENT_TYPES = [
  { value: 'license', label: 'License' },
  { value: 'certification', label: 'Certification' },
  { value: 'accreditation', label: 'Accreditation' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'policy', label: 'Policy Document' },
  { value: 'training', label: 'Training Certificate' },
  { value: 'audit_report', label: 'Audit Report' },
  { value: 'compliance', label: 'Compliance Document' },
  { value: 'contract', label: 'Contract' },
  { value: 'other', label: 'Other' },
];

const DOC_TYPE_COLORS = {
  license: 'bg-green-100 text-green-700',
  certification: 'bg-blue-100 text-blue-700',
  accreditation: 'bg-purple-100 text-purple-700',
  insurance: 'bg-amber-100 text-amber-700',
  policy: 'bg-slate-100 text-slate-700',
  training: 'bg-teal-100 text-teal-700',
  audit_report: 'bg-indigo-100 text-indigo-700',
  compliance: 'bg-cyan-100 text-cyan-700',
  contract: 'bg-rose-100 text-rose-700',
  other: 'bg-gray-100 text-gray-700',
};

export default function OrganizationDetail() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const { user, isSystemAdmin, isSuperAdmin } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState(null);
  const [users, setUsers] = useState([]);
  const [inventory, setInventory] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [branches, setBranches] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [docStats, setDocStats] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Dialogs
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [showEditUserDialog, setShowEditUserDialog] = useState(false);
  const [showUploadDocDialog, setShowUploadDocDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  
  // Form data
  const [editFormData, setEditFormData] = useState({});
  const [userFormData, setUserFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'registration',
    user_type: 'staff',
  });
  const [docFormData, setDocFormData] = useState({
    file: null,
    doc_type: 'other',
    title: '',
    description: '',
    issue_date: '',
    expiry_date: '',
    issuing_authority: '',
    reference_number: '',
    tags: '',
  });

  useEffect(() => {
    fetchOrganization();
  }, [orgId]);

  useEffect(() => {
    if (organization) {
      fetchUsers();
      fetchInventory();
      fetchAuditLogs();
      fetchDocuments();
      if (organization.is_parent) {
        fetchBranches();
      }
    }
  }, [organization]);

  const fetchOrganization = async () => {
    setLoading(true);
    try {
      const res = await organizationAPI.getOne(orgId);
      setOrganization(res.data);
      setEditFormData(res.data);
    } catch (error) {
      toast.error('Failed to load organization');
      navigate('/organizations');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await organizationAPI.getUsers(orgId, organization?.is_parent);
      setUsers(res.data || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await organizationAPI.getInventorySummary(orgId, organization?.is_parent);
      setInventory(res.data);
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await api.get('/audit-logs/', { params: { org_id: orgId, limit: 20 } });
      setAuditLogs(res.data.logs || []);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await organizationAPI.getAll();
      const childBranches = res.data.filter(o => o.parent_org_id === orgId);
      setBranches(childBranches);
    } catch (error) {
      console.error('Failed to fetch branches:', error);
    }
  };

  const fetchDocuments = async () => {
    try {
      const [docsRes, statsRes] = await Promise.all([
        documentAPI.getAll(orgId),
        documentAPI.getStats(orgId)
      ]);
      setDocuments(docsRes.data || []);
      setDocStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  };

  const handleUploadDocument = async () => {
    if (!docFormData.file || !docFormData.title) {
      toast.error('Please select a file and provide a title');
      return;
    }
    
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append('file', docFormData.file);
      formData.append('doc_type', docFormData.doc_type);
      formData.append('title', docFormData.title);
      formData.append('description', docFormData.description || '');
      formData.append('issue_date', docFormData.issue_date || '');
      formData.append('expiry_date', docFormData.expiry_date || '');
      formData.append('issuing_authority', docFormData.issuing_authority || '');
      formData.append('reference_number', docFormData.reference_number || '');
      formData.append('tags', docFormData.tags || '');
      
      await documentAPI.upload(orgId, formData);
      toast.success('Document uploaded successfully');
      setShowUploadDocDialog(false);
      resetDocForm();
      fetchDocuments();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload document');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleVerifyDocument = async (docId) => {
    try {
      await documentAPI.verify(orgId, docId);
      toast.success('Document verified');
      fetchDocuments();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to verify document');
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    
    try {
      await documentAPI.delete(orgId, docId);
      toast.success('Document deleted');
      fetchDocuments();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete document');
    }
  };

  const handleDownloadDocument = (docId) => {
    const url = documentAPI.getDownloadUrl(orgId, docId);
    window.open(url, '_blank');
  };

  const resetDocForm = () => {
    setDocFormData({
      file: null,
      doc_type: 'other',
      title: '',
      description: '',
      issue_date: '',
      expiry_date: '',
      issuing_authority: '',
      reference_number: '',
      tags: '',
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleUpdateOrganization = async () => {
    try {
      await organizationAPI.update(orgId, editFormData);
      toast.success('Organization updated successfully');
      setShowEditDialog(false);
      fetchOrganization();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update organization');
    }
  };

  const handleAddUser = async () => {
    if (!userFormData.email || !userFormData.password || !userFormData.full_name) {
      toast.error('Email, password, and full name are required');
      return;
    }
    
    try {
      const params = new URLSearchParams({
        email: userFormData.email,
        password: userFormData.password,
        full_name: userFormData.full_name,
        role: userFormData.role,
        user_type: userFormData.user_type,
      });
      if (userFormData.phone) params.append('phone', userFormData.phone);
      
      await organizationAPI.createUser(orgId, params.toString());
      toast.success('User created successfully');
      setShowAddUserDialog(false);
      resetUserForm();
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user');
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    
    try {
      const updates = { ...userFormData };
      delete updates.email; // Can't update email
      if (!updates.password) delete updates.password;
      
      await organizationAPI.updateUser(orgId, selectedUser.id, updates);
      toast.success('User updated successfully');
      setShowEditUserDialog(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update user');
    }
  };

  const handleDeactivateUser = async (userId) => {
    if (!window.confirm('Are you sure you want to deactivate this user?')) return;
    
    try {
      await organizationAPI.deactivateUser(orgId, userId);
      toast.success('User deactivated');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to deactivate user');
    }
  };

  const openEditUserDialog = (u) => {
    setSelectedUser(u);
    setUserFormData({
      email: u.email,
      password: '',
      full_name: u.full_name,
      phone: u.phone || '',
      role: u.role,
      user_type: u.user_type,
    });
    setShowEditUserDialog(true);
  };

  const resetUserForm = () => {
    setUserFormData({
      email: '',
      password: '',
      full_name: '',
      phone: '',
      role: 'registration',
      user_type: 'staff',
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-16 h-16 mx-auto text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-700">Organization Not Found</h2>
      </div>
    );
  }

  const canEdit = isSystemAdmin() || (isSuperAdmin() && organization.id === user?.org_id);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="org-detail">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/organizations')}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-teal-100 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-teal-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{organization.org_name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="capitalize">
                    {organization.org_type?.replace('_', ' ')}
                  </Badge>
                  {organization.is_parent && (
                    <Badge className="bg-purple-100 text-purple-700">Parent Org</Badge>
                  )}
                  <Badge className={organization.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                    {organization.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowEditDialog(true)} data-testid="edit-org-btn">
              <Edit2 className="w-4 h-4 mr-1" />
              Edit
            </Button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Users</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Inventory Units</p>
                <p className="text-2xl font-bold">{inventory?.total_units || 0}</p>
              </div>
              <Package className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Expiring Soon</p>
                <p className="text-2xl font-bold text-amber-600">{inventory?.expiring_soon || 0}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{organization.is_parent ? 'Branches' : 'Donors'}</p>
                <p className="text-2xl font-bold">{organization.is_parent ? branches.length : (inventory?.donor_count || 0)}</p>
              </div>
              {organization.is_parent ? <Building2 className="w-8 h-8 text-teal-500" /> : <Users className="w-8 h-8 text-teal-500" />}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          {organization.is_parent && <TabsTrigger value="branches">Branches ({branches.length})</TabsTrigger>}
          <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Organization Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Organization Name</p>
                    <p className="font-medium">{organization.org_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Type</p>
                    <p className="font-medium capitalize">{organization.org_type?.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">License Number</p>
                    <p className="font-medium">{organization.license_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Created</p>
                    <p className="font-medium">{formatDate(organization.created_at)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <Users className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Contact Person</p>
                    <p className="font-medium">{organization.contact_person || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Email</p>
                    <p className="font-medium">{organization.contact_email || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <Phone className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Phone</p>
                    <p className="font-medium">{organization.contact_phone || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Address</p>
                    <p className="font-medium">
                      {[organization.address, organization.city, organization.state, organization.country]
                        .filter(Boolean).join(', ') || '-'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Organization Users</CardTitle>
                <CardDescription>Manage users in this organization</CardDescription>
              </div>
              {canEdit && (
                <Button onClick={() => { resetUserForm(); setShowAddUserDialog(true); }} data-testid="add-user-btn">
                  <UserPlus className="w-4 h-4 mr-1" />
                  Add User
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    {canEdit && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 6 : 5} className="text-center py-8 text-slate-500">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map(u => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                              <span className="text-sm font-medium text-teal-700">
                                {u.full_name?.charAt(0) || 'U'}
                              </span>
                            </div>
                            <span className="font-medium">{u.full_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-500">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{u.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={USER_TYPE_COLORS[u.user_type] || USER_TYPE_COLORS.staff}>
                            {u.user_type?.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEditUserDialog(u)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              {u.id !== user?.id && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-red-500"
                                  onClick={() => handleDeactivateUser(u.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Droplet className="w-5 h-5" />
                  Inventory by Blood Group
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {inventory?.by_blood_group && Object.keys(inventory.by_blood_group).length > 0 ? (
                    Object.entries(inventory.by_blood_group).map(([group, count]) => (
                      <div key={group} className="p-3 bg-slate-50 rounded-lg text-center">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                          <span className="font-bold text-red-600">{group}</span>
                        </div>
                        <p className="text-xl font-bold mt-2">{count}</p>
                        <p className="text-xs text-slate-500">units</p>
                      </div>
                    ))
                  ) : (
                    <p className="col-span-2 text-center text-slate-500 py-4">No inventory data</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Inventory Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-600">Total Units</span>
                  <span className="text-xl font-bold">{inventory?.total_units || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                  <span className="text-amber-700">Expiring Soon (7 days)</span>
                  <span className="text-xl font-bold text-amber-600">{inventory?.expiring_soon || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span className="text-blue-700">Donors</span>
                  <span className="text-xl font-bold text-blue-600">{inventory?.donor_count || 0}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Branches Tab (for parent orgs) */}
        {organization.is_parent && (
          <TabsContent value="branches" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Child Branches</CardTitle>
                <CardDescription>Branches under this organization</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Branch Name</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branches.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                          No branches found
                        </TableCell>
                      </TableRow>
                    ) : (
                      branches.map(branch => (
                        <TableRow key={branch.id} className="cursor-pointer hover:bg-slate-50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-slate-400" />
                              <span className="font-medium">{branch.org_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{branch.city || '-'}</TableCell>
                          <TableCell>{branch.contact_email || '-'}</TableCell>
                          <TableCell>
                            <Badge className={branch.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                              {branch.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => navigate(`/organizations/${branch.id}`)}
                            >
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Audit log for this organization</CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No activity recorded</p>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log, idx) => (
                    <div key={log.id || idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        log.action === 'login' ? 'bg-green-100 text-green-600' :
                        log.action === 'create' ? 'bg-blue-100 text-blue-600' :
                        log.action === 'delete' ? 'bg-red-100 text-red-600' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        <Shield className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{log.user_email || 'System'}</p>
                        <p className="text-sm text-slate-500">
                          {log.action} - {log.module}
                          {log.details && `: ${log.details}`}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">{formatTimeAgo(log.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-4">
          <div className="space-y-6">
            {/* Document Stats */}
            {docStats && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <File className="w-6 h-6 mx-auto text-blue-500 mb-1" />
                      <p className="text-2xl font-bold">{docStats.total}</p>
                      <p className="text-xs text-slate-500">Total Documents</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <FileCheck className="w-6 h-6 mx-auto text-green-500 mb-1" />
                      <p className="text-2xl font-bold text-green-600">{docStats.verified}</p>
                      <p className="text-xs text-slate-500">Verified</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <Clock className="w-6 h-6 mx-auto text-slate-400 mb-1" />
                      <p className="text-2xl font-bold text-slate-600">{docStats.unverified}</p>
                      <p className="text-xs text-slate-500">Pending</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <AlertTriangle className="w-6 h-6 mx-auto text-amber-500 mb-1" />
                      <p className="text-2xl font-bold text-amber-600">{docStats.expiring_soon}</p>
                      <p className="text-xs text-slate-500">Expiring Soon</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <FileWarning className="w-6 h-6 mx-auto text-red-500 mb-1" />
                      <p className="text-2xl font-bold text-red-600">{docStats.expired}</p>
                      <p className="text-xs text-slate-500">Expired</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Documents List */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Organization Documents
                  </CardTitle>
                  <CardDescription>Licenses, certifications, and compliance documents</CardDescription>
                </div>
                {canEdit && (
                  <Button onClick={() => { resetDocForm(); setShowUploadDocDialog(true); }} data-testid="upload-doc-btn">
                    <Upload className="w-4 h-4 mr-1" />
                    Upload Document
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500">No documents uploaded yet</p>
                    {canEdit && (
                      <Button 
                        variant="outline" 
                        className="mt-4" 
                        onClick={() => { resetDocForm(); setShowUploadDocDialog(true); }}
                      >
                        <Upload className="w-4 h-4 mr-1" />
                        Upload First Document
                      </Button>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Uploaded</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((doc) => (
                        <TableRow key={doc.id} data-testid={`doc-row-${doc.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <File className="w-4 h-4 text-slate-400" />
                              <div>
                                <p className="font-medium">{doc.title}</p>
                                <p className="text-xs text-slate-400">{doc.file_name}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={DOC_TYPE_COLORS[doc.doc_type] || DOC_TYPE_COLORS.other}>
                              {DOCUMENT_TYPES.find(t => t.value === doc.doc_type)?.label || doc.doc_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {doc.expiry_date ? (
                              <div>
                                <p className={doc.is_expired ? 'text-red-600' : doc.days_until_expiry <= 30 ? 'text-amber-600' : ''}>
                                  {formatDate(doc.expiry_date)}
                                </p>
                                {doc.days_until_expiry !== null && (
                                  <p className={`text-xs ${doc.is_expired ? 'text-red-500' : doc.days_until_expiry <= 30 ? 'text-amber-500' : 'text-slate-400'}`}>
                                    {doc.is_expired ? 'Expired' : `${doc.days_until_expiry} days left`}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">No expiry</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {doc.is_verified ? (
                                <Badge className="bg-green-100 text-green-700">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Verified
                                </Badge>
                              ) : (
                                <Badge className="bg-slate-100 text-slate-600">Pending</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm">{formatDate(doc.created_at)}</p>
                              <p className="text-xs text-slate-400">{formatFileSize(doc.file_size)}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleDownloadDocument(doc.id)}
                                title="Download"
                                data-testid={`download-doc-${doc.id}`}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              {canEdit && !doc.is_verified && (isSystemAdmin() || isSuperAdmin()) && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-green-600"
                                  onClick={() => handleVerifyDocument(doc.id)}
                                  title="Verify"
                                  data-testid={`verify-doc-${doc.id}`}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                              )}
                              {canEdit && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-red-500"
                                  onClick={() => handleDeleteDocument(doc.id)}
                                  title="Delete"
                                  data-testid={`delete-doc-${doc.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Organization Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Organization Name</Label>
                <Input
                  value={editFormData.org_name || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, org_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Contact Person</Label>
                <Input
                  value={editFormData.contact_person || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, contact_person: e.target.value })}
                />
              </div>
              <div>
                <Label>Contact Email</Label>
                <Input
                  value={editFormData.contact_email || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, contact_email: e.target.value })}
                />
              </div>
              <div>
                <Label>Contact Phone</Label>
                <Input
                  value={editFormData.contact_phone || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, contact_phone: e.target.value })}
                />
              </div>
              <div>
                <Label>License Number</Label>
                <Input
                  value={editFormData.license_number || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, license_number: e.target.value })}
                />
              </div>
              <div>
                <Label>City</Label>
                <Input
                  value={editFormData.city || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                />
              </div>
              <div>
                <Label>State</Label>
                <Input
                  value={editFormData.state || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleUpdateOrganization}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Create a new user for this organization</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Full Name *</Label>
                <Input
                  value={userFormData.full_name}
                  onChange={(e) => setUserFormData({ ...userFormData, full_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                />
              </div>
              <div>
                <Label>Password *</Label>
                <Input
                  type="password"
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={userFormData.phone}
                  onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select
                  value={userFormData.role}
                  onValueChange={(value) => setUserFormData({ ...userFormData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {USER_ROLES.map(role => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>User Type</Label>
                <Select
                  value={userFormData.user_type}
                  onValueChange={(value) => setUserFormData({ ...userFormData, user_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUserDialog(false)}>Cancel</Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleAddUser}>
              Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditUserDialog} onOpenChange={setShowEditUserDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Full Name</Label>
                <Input
                  value={userFormData.full_name}
                  onChange={(e) => setUserFormData({ ...userFormData, full_name: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label>Email (cannot be changed)</Label>
                <Input value={userFormData.email} disabled className="bg-slate-50" />
              </div>
              <div>
                <Label>New Password (leave blank to keep)</Label>
                <Input
                  type="password"
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={userFormData.phone}
                  onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select
                  value={userFormData.role}
                  onValueChange={(value) => setUserFormData({ ...userFormData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {USER_ROLES.map(role => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditUserDialog(false)}>Cancel</Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleUpdateUser}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
