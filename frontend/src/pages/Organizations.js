import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { organizationAPI } from '../lib/api';
import { toast } from 'sonner';
import {
  Building2, Plus, Edit2, Trash2, Users, Package, ChevronRight,
  ChevronDown, RefreshCw, MapPin, Phone, Mail, FileText, Eye,
  Building, GitBranch, UserPlus, Shield
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';

const ORG_TYPES = [
  { value: 'hospital_network', label: 'Hospital Network' },
  { value: 'blood_bank_chain', label: 'Blood Bank Chain' },
  { value: 'standalone', label: 'Standalone' },
  { value: 'branch', label: 'Branch' },
];

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

export default function Organizations() {
  const { user, isSystemAdmin, isSuperAdmin, isTenantAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState([]);
  const [hierarchy, setHierarchy] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [inventorySummary, setInventorySummary] = useState(null);
  const [orgUsers, setOrgUsers] = useState([]);
  
  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showCreateWithAdminDialog, setShowCreateWithAdminDialog] = useState(false);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [expandedOrgs, setExpandedOrgs] = useState({});
  
  // Form data for org
  const [formData, setFormData] = useState({
    org_name: '',
    org_type: 'standalone',
    parent_org_id: '',
    is_parent: false,
    address: '',
    city: '',
    state: '',
    country: '',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    license_number: '',
  });
  
  // Form data for combined org + admin creation
  const [orgWithAdminData, setOrgWithAdminData] = useState({
    org_name: '',
    org_type: 'standalone',
    address: '',
    city: '',
    state: '',
    country: '',
    contact_phone: '',
    license_number: '',
    admin_email: '',
    admin_password: '',
    admin_full_name: '',
    admin_phone: '',
  });
  
  // Form data for adding user
  const [userFormData, setUserFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'registration',
    user_type: 'staff',
  });
  
  // For branch creation
  const [parentOrgForBranch, setParentOrgForBranch] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [orgsRes, hierarchyRes] = await Promise.all([
        organizationAPI.getAll({ include_inactive: false }),
        organizationAPI.getHierarchy()
      ]);
      setOrganizations(orgsRes.data);
      setHierarchy(hierarchyRes.data);
    } catch (error) {
      toast.error('Failed to fetch organizations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.org_name) {
      toast.error('Organization name is required');
      return;
    }
    
    try {
      const payload = { ...formData };
      if (!payload.parent_org_id) {
        delete payload.parent_org_id;
        payload.is_parent = true;
      }
      
      await organizationAPI.create(payload);
      toast.success('Organization created successfully');
      setShowCreateDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create organization');
    }
  };

  const handleUpdate = async () => {
    if (!selectedOrg) return;
    
    try {
      await organizationAPI.update(selectedOrg.id, formData);
      toast.success('Organization updated successfully');
      setShowEditDialog(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update organization');
    }
  };

  const handleDeactivate = async (org) => {
    if (!window.confirm(`Are you sure you want to deactivate "${org.org_name}"?`)) return;
    
    try {
      await organizationAPI.deactivate(org.id);
      toast.success('Organization deactivated');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to deactivate organization');
    }
  };

  const viewDetails = async (org) => {
    setSelectedOrg(org);
    setShowDetailsDialog(true);
    
    try {
      const res = await organizationAPI.getInventorySummary(org.id, org.is_parent);
      setInventorySummary(res.data);
    } catch (error) {
      console.error('Failed to fetch inventory summary:', error);
    }
  };

  const openEditDialog = (org) => {
    setSelectedOrg(org);
    setFormData({
      org_name: org.org_name || '',
      org_type: org.org_type || 'standalone',
      address: org.address || '',
      city: org.city || '',
      state: org.state || '',
      country: org.country || '',
      contact_person: org.contact_person || '',
      contact_phone: org.contact_phone || '',
      contact_email: org.contact_email || '',
      license_number: org.license_number || '',
    });
    setShowEditDialog(true);
  };

  const openCreateDialog = (parentOrg = null) => {
    resetForm();
    if (parentOrg) {
      setFormData(prev => ({
        ...prev,
        parent_org_id: parentOrg.id,
        org_type: 'branch',
        is_parent: false
      }));
    }
    setShowCreateDialog(true);
  };

  const resetForm = () => {
    setFormData({
      org_name: '',
      org_type: 'standalone',
      parent_org_id: '',
      is_parent: false,
      address: '',
      city: '',
      state: '',
      country: '',
      contact_person: '',
      contact_phone: '',
      contact_email: '',
      license_number: '',
    });
  };

  const toggleExpand = (orgId) => {
    setExpandedOrgs(prev => ({ ...prev, [orgId]: !prev[orgId] }));
  };

  const getOrgTypeBadge = (type) => {
    const styles = {
      hospital_network: 'bg-blue-100 text-blue-700',
      blood_bank_chain: 'bg-purple-100 text-purple-700',
      standalone: 'bg-slate-100 text-slate-700',
      branch: 'bg-teal-100 text-teal-700',
    };
    return <Badge className={styles[type] || styles.standalone}>{type?.replace('_', ' ')}</Badge>;
  };

  // Render hierarchy tree node
  const renderOrgNode = (org, level = 0) => {
    const hasChildren = org.children && org.children.length > 0;
    const isExpanded = expandedOrgs[org.id];
    
    return (
      <div key={org.id}>
        <div 
          className={`flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg border-l-4 ${
            level === 0 ? 'border-teal-500 bg-teal-50/50' : 'border-slate-200 ml-6'
          }`}
        >
          {hasChildren ? (
            <button onClick={() => toggleExpand(org.id)} className="p-1 hover:bg-slate-200 rounded">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <div className="w-6" />
          )}
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-slate-500" />
              <span className="font-medium">{org.org_name}</span>
              {getOrgTypeBadge(org.org_type)}
              {org.is_parent && <Badge className="bg-amber-100 text-amber-700">Parent</Badge>}
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
              {org.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {org.city}, {org.state}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {org.staff_count || 0} staff
              </span>
              <span className="flex items-center gap-1">
                <Package className="w-3 h-3" />
                {org.inventory_count || 0} units
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => viewDetails(org)}>
              <Eye className="w-4 h-4" />
            </Button>
            {(isSystemAdmin() || (isSuperAdmin() && org.id === user?.org_id)) && (
              <>
                <Button variant="ghost" size="sm" onClick={() => openEditDialog(org)}>
                  <Edit2 className="w-4 h-4" />
                </Button>
                {level === 0 && (
                  <Button variant="ghost" size="sm" onClick={() => openCreateDialog(org)}>
                    <Plus className="w-4 h-4" />
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-red-500 hover:text-red-600"
                  onClick={() => handleDeactivate(org)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div className="mt-2">
            {org.children.map(child => renderOrgNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Building2 className="w-8 h-8 text-teal-600" />
            Organization Management
          </h1>
          <p className="page-subtitle">Manage blood bank network hierarchy</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {isSystemAdmin() && (
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => openCreateDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Organization
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Organizations</p>
                <p className="text-2xl font-bold">{organizations.length}</p>
              </div>
              <Building className="w-8 h-8 text-teal-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Parent Orgs</p>
                <p className="text-2xl font-bold">
                  {organizations.filter(o => o.is_parent).length}
                </p>
              </div>
              <GitBranch className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Branches</p>
                <p className="text-2xl font-bold">
                  {organizations.filter(o => !o.is_parent).length}
                </p>
              </div>
              <Building2 className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Staff</p>
                <p className="text-2xl font-bold">
                  {organizations.reduce((sum, o) => sum + (o.staff_count || 0), 0)}
                </p>
              </div>
              <Users className="w-8 h-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="hierarchy">
        <TabsList>
          <TabsTrigger value="hierarchy">Hierarchy View</TabsTrigger>
          <TabsTrigger value="list">List View</TabsTrigger>
        </TabsList>

        <TabsContent value="hierarchy" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization Hierarchy</CardTitle>
              <CardDescription>Parent organizations with their branches</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                </div>
              ) : hierarchy.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Building2 className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  No organizations found
                </div>
              ) : (
                <div className="space-y-2">
                  {hierarchy.map(org => renderOrgNode(org))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>All Organizations</CardTitle>
              <CardDescription>Complete list of all organizations</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>Inventory</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizations.map(org => (
                    <TableRow key={org.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          <div>
                            <p className="font-medium">{org.org_name}</p>
                            {org.is_parent && (
                              <Badge variant="outline" className="text-xs">Parent</Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getOrgTypeBadge(org.org_type)}</TableCell>
                      <TableCell>
                        {org.city && `${org.city}, ${org.state}`}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{org.contact_person}</p>
                          <p className="text-slate-500">{org.contact_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{org.staff_count || 0}</TableCell>
                      <TableCell>{org.inventory_count || 0}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => viewDetails(org)}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setShowEditDialog(false);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {showEditDialog ? 'Edit Organization' : 'Create Organization'}
            </DialogTitle>
            <DialogDescription>
              {showEditDialog 
                ? 'Update organization details' 
                : formData.parent_org_id 
                  ? 'Add a new branch to the parent organization'
                  : 'Create a new parent organization'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Organization Name *</Label>
                <Input
                  value={formData.org_name}
                  onChange={(e) => setFormData({ ...formData, org_name: e.target.value })}
                  placeholder="e.g., City Blood Bank"
                />
              </div>
              
              <div>
                <Label>Organization Type</Label>
                <Select
                  value={formData.org_type}
                  onValueChange={(value) => setFormData({ ...formData, org_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORG_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>License Number</Label>
                <Input
                  value={formData.license_number}
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                  placeholder="LIC-XXX"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Address</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street address"
                />
              </div>
              <div>
                <Label>City</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div>
                <Label>State</Label>
                <Input
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Contact Person</Label>
                <Input
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                />
              </div>
              <div>
                <Label>Contact Phone</Label>
                <Input
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label>Contact Email</Label>
                <Input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              setShowEditDialog(false);
            }}>
              Cancel
            </Button>
            <Button 
              className="bg-teal-600 hover:bg-teal-700"
              onClick={showEditDialog ? handleUpdate : handleCreate}
            >
              {showEditDialog ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {selectedOrg?.org_name}
            </DialogTitle>
            <DialogDescription>Organization details and inventory summary</DialogDescription>
          </DialogHeader>
          
          {selectedOrg && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm text-slate-500">Type</p>
                  <p className="font-medium capitalize">{selectedOrg.org_type?.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">License</p>
                  <p className="font-medium">{selectedOrg.license_number || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Location</p>
                  <p className="font-medium">
                    {selectedOrg.city ? `${selectedOrg.city}, ${selectedOrg.state}` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Contact</p>
                  <p className="font-medium">{selectedOrg.contact_person || '-'}</p>
                  <p className="text-sm text-slate-500">{selectedOrg.contact_email}</p>
                </div>
              </div>
              
              {/* Inventory Summary */}
              {inventorySummary && (
                <div>
                  <h4 className="font-medium mb-3">Inventory Summary</h4>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="p-3 bg-teal-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-teal-600">
                        {inventorySummary.total_inventory}
                      </p>
                      <p className="text-xs text-slate-500">Total Units</p>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-amber-600">
                        {inventorySummary.expiring_soon}
                      </p>
                      <p className="text-xs text-slate-500">Expiring Soon</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {Object.keys(inventorySummary.by_blood_group || {}).length}
                      </p>
                      <p className="text-xs text-slate-500">Blood Groups</p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-purple-600">
                        {inventorySummary.by_branch?.length || 1}
                      </p>
                      <p className="text-xs text-slate-500">Branches</p>
                    </div>
                  </div>
                  
                  {/* Blood Group Breakdown */}
                  {inventorySummary.by_blood_group && Object.keys(inventorySummary.by_blood_group).length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-2">By Blood Group</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(inventorySummary.by_blood_group).map(([group, count]) => (
                          <Badge key={group} variant="outline" className="px-3 py-1">
                            {group}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
