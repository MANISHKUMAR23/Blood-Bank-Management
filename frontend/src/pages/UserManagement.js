import React, { useState, useEffect, useMemo } from 'react';
import { userAPI, organizationAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { 
  Users, Plus, Edit, Trash2, Shield, Key, Settings, Check, X, RefreshCw,
  Building2, Search, Filter, UserCog, UserCheck, Mail, Clock, MapPin
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import SensitiveActionModal from '../components/SensitiveActionModal';

const USER_TYPE_CONFIG = {
  system_admin: { label: 'System Admin', color: 'bg-red-100 text-red-700', icon: Shield },
  super_admin: { label: 'Super Admin', color: 'bg-purple-100 text-purple-700', icon: UserCog },
  tenant_admin: { label: 'Tenant Admin', color: 'bg-blue-100 text-blue-700', icon: UserCheck },
  staff: { label: 'Staff', color: 'bg-slate-100 text-slate-700', icon: Users },
};

const STAFF_ROLES = {
  admin: { label: 'Administrator', color: 'bg-purple-100 text-purple-700' },
  registration: { label: 'Registration', color: 'bg-blue-100 text-blue-700' },
  phlebotomist: { label: 'Phlebotomist', color: 'bg-red-100 text-red-700' },
  lab_tech: { label: 'Lab Tech', color: 'bg-amber-100 text-amber-700' },
  processing: { label: 'Processing', color: 'bg-cyan-100 text-cyan-700' },
  qc_manager: { label: 'QC Manager', color: 'bg-emerald-100 text-emerald-700' },
  inventory: { label: 'Inventory', color: 'bg-orange-100 text-orange-700' },
  distribution: { label: 'Distribution', color: 'bg-pink-100 text-pink-700' },
};

export default function UserManagement() {
  const { user: currentUser, isSystemAdmin, isSuperAdmin, isTenantAdmin, register } = useAuth();
  const [users, setUsers] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('admins');
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUserType, setFilterUserType] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [filterOrg, setFilterOrg] = useState('all');
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Dialog state
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'registration',
    user_type: 'staff',
    org_id: '',
    is_active: true,
  });
  
  // Sensitive action state
  const [showSensitiveModal, setShowSensitiveModal] = useState(false);
  const [sensitiveAction, setSensitiveAction] = useState(null);
  const [pendingActionUser, setPendingActionUser] = useState(null);

  // Determine current user type for access control
  const currentUserType = currentUser?.user_type;
  const canSeeAllOrgs = currentUserType === 'system_admin';
  const canSeeOrgAndBranches = currentUserType === 'super_admin';
  const canOnlySeeOwnBranch = currentUserType === 'tenant_admin';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, orgsRes] = await Promise.all([
        userAPI.getAll(),
        organizationAPI.getAll()
      ]);
      setUsers(usersRes.data || []);
      setOrganizations(orgsRes.data || []);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // Separate users into admins and staff
  const { adminUsers, staffUsers, adminCounts, staffCounts } = useMemo(() => {
    const admins = users.filter(u => 
      ['system_admin', 'super_admin', 'tenant_admin'].includes(u.user_type)
    );
    const staff = users.filter(u => u.user_type === 'staff');
    
    // Count by user type for admins
    const adminCounts = {
      system_admin: admins.filter(u => u.user_type === 'system_admin').length,
      super_admin: admins.filter(u => u.user_type === 'super_admin').length,
      tenant_admin: admins.filter(u => u.user_type === 'tenant_admin').length,
    };
    
    // Count by role for staff
    const staffCounts = {};
    Object.keys(STAFF_ROLES).forEach(role => {
      staffCounts[role] = staff.filter(u => u.role === role).length;
    });
    
    return { adminUsers: admins, staffUsers: staff, adminCounts, staffCounts };
  }, [users]);

  // Filter users based on current filters
  const filteredAdmins = useMemo(() => {
    return adminUsers.filter(user => {
      if (searchTerm && !user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !user.email?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (filterUserType !== 'all' && user.user_type !== filterUserType) return false;
      if (filterOrg !== 'all' && user.org_id !== filterOrg) return false;
      if (filterStatus !== 'all') {
        if (filterStatus === 'active' && !user.is_active) return false;
        if (filterStatus === 'inactive' && user.is_active) return false;
      }
      return true;
    });
  }, [adminUsers, searchTerm, filterUserType, filterOrg, filterStatus]);

  const filteredStaff = useMemo(() => {
    return staffUsers.filter(user => {
      if (searchTerm && !user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !user.email?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (filterRole !== 'all' && user.role !== filterRole) return false;
      if (filterOrg !== 'all' && user.org_id !== filterOrg) return false;
      if (filterStatus !== 'all') {
        if (filterStatus === 'active' && !user.is_active) return false;
        if (filterStatus === 'inactive' && user.is_active) return false;
      }
      return true;
    });
  }, [staffUsers, searchTerm, filterRole, filterOrg, filterStatus]);

  // Get branches for selected org
  const branches = useMemo(() => {
    if (filterOrg === 'all') return [];
    return organizations.filter(o => o.parent_org_id === filterOrg);
  }, [organizations, filterOrg]);

  const parentOrgs = useMemo(() => {
    return organizations.filter(o => o.is_parent);
  }, [organizations]);

  const getOrgName = (orgId) => {
    const org = organizations.find(o => o.id === orgId);
    return org?.org_name || '-';
  };

  const handleCreateUser = async () => {
    try {
      await register({
        ...userForm,
        org_id: userForm.org_id || undefined
      });
      toast.success('User created successfully');
      setShowUserDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user');
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      const updates = { ...userForm };
      if (!updates.password) delete updates.password;
      await userAPI.update(editingUser.id, updates);
      toast.success('User updated successfully');
      setShowUserDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error('Failed to update user');
    }
  };

  const handleDeleteUser = async (userId) => {
    const user = users.find(u => u.id === userId);
    // Check if the target is an admin - require verification
    if (['system_admin', 'super_admin', 'tenant_admin'].includes(user?.user_type)) {
      setSensitiveAction('delete_user');
      setPendingActionUser(user);
      setShowSensitiveModal(true);
      return;
    }
    
    // For staff, use simple confirmation
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    await executeDeleteUser(userId);
  };

  const executeDeleteUser = async (userId) => {
    try {
      await userAPI.delete(userId);
      toast.success('User deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  const handleToggleActive = async (user) => {
    // Check if the target is an admin - require verification
    if (['system_admin', 'super_admin', 'tenant_admin'].includes(user?.user_type)) {
      setSensitiveAction('toggle_user_status');
      setPendingActionUser(user);
      setShowSensitiveModal(true);
      return;
    }
    
    await executeToggleActive(user);
  };

  const executeToggleActive = async (user) => {
    try {
      await userAPI.update(user.id, { is_active: !user.is_active });
      toast.success(`User ${user.is_active ? 'deactivated' : 'activated'}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update user status');
    }
  };

  const handleSensitiveActionVerified = async (verificationToken) => {
    if (sensitiveAction === 'delete_user' && pendingActionUser) {
      await executeDeleteUser(pendingActionUser.id);
    } else if (sensitiveAction === 'toggle_user_status' && pendingActionUser) {
      await executeToggleActive(pendingActionUser);
    }
    
    // Reset sensitive action state
    setSensitiveAction(null);
    setPendingActionUser(null);
  };

  const resetForm = () => {
    setUserForm({
      full_name: '',
      email: '',
      password: '',
      role: 'registration',
      user_type: 'staff',
      org_id: '',
      is_active: true,
    });
    setEditingUser(null);
  };

  const openAddDialog = (isAdmin = false) => {
    resetForm();
    if (isAdmin) {
      setUserForm(prev => ({ ...prev, user_type: 'tenant_admin', role: 'admin' }));
    }
    setShowUserDialog(true);
  };

  const openEditDialog = (user) => {
    setEditingUser(user);
    setUserForm({
      full_name: user.full_name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'registration',
      user_type: user.user_type || 'staff',
      org_id: user.org_id || '',
      is_active: user.is_active ?? true,
    });
    setShowUserDialog(true);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  return (
    <div className="space-y-6" data-testid="user-management">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-teal-600" />
            User Management
          </h1>
          <p className="text-slate-500">Manage administrators and staff members</p>
        </div>
        <Button onClick={() => fetchData()} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="admins" className="gap-2">
            <Shield className="w-4 h-4" />
            Admin Users ({adminUsers.length})
          </TabsTrigger>
          <TabsTrigger value="staff" className="gap-2">
            <Users className="w-4 h-4" />
            Staff Users ({staffUsers.length})
          </TabsTrigger>
        </TabsList>

        {/* Admin Users Tab */}
        <TabsContent value="admins" className="mt-4 space-y-4">
          {/* Breakdown Cards */}
          <div className={`grid gap-4 ${canSeeAllOrgs ? 'grid-cols-3' : canSeeOrgAndBranches ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {canSeeAllOrgs && (
              <Card className="cursor-pointer hover:border-red-300 transition-colors" onClick={() => setFilterUserType('system_admin')}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">System Admins</p>
                      <p className="text-2xl font-bold text-red-600">{adminCounts.system_admin}</p>
                    </div>
                    <Shield className="w-8 h-8 text-red-200" />
                  </div>
                </CardContent>
              </Card>
            )}
            {(canSeeAllOrgs || canSeeOrgAndBranches) && (
              <Card className="cursor-pointer hover:border-purple-300 transition-colors" onClick={() => setFilterUserType('super_admin')}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Super Admins</p>
                      <p className="text-2xl font-bold text-purple-600">{adminCounts.super_admin}</p>
                    </div>
                    <UserCog className="w-8 h-8 text-purple-200" />
                  </div>
                </CardContent>
              </Card>
            )}
            <Card className="cursor-pointer hover:border-blue-300 transition-colors" onClick={() => setFilterUserType('tenant_admin')}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Tenant Admins</p>
                    <p className="text-2xl font-bold text-blue-600">{adminCounts.tenant_admin}</p>
                  </div>
                  <UserCheck className="w-8 h-8 text-blue-200" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-3 items-center">
                {/* User Type Filter - only show relevant options */}
                <Select value={filterUserType} onValueChange={setFilterUserType}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="User Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {canSeeAllOrgs && <SelectItem value="system_admin">System Admin</SelectItem>}
                    {(canSeeAllOrgs || canSeeOrgAndBranches) && <SelectItem value="super_admin">Super Admin</SelectItem>}
                    <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
                  </SelectContent>
                </Select>

                {/* Organization Filter - only for System Admin */}
                {canSeeAllOrgs && (
                  <Select value={filterOrg} onValueChange={setFilterOrg}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Organization" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Organizations</SelectItem>
                      {parentOrgs.map(org => (
                        <SelectItem key={org.id} value={org.id}>{org.org_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>

                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Button onClick={() => openAddDialog(true)} data-testid="add-admin-btn">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Admin
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Admin Table */}
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>User Type</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAdmins.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                        No admin users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAdmins.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="font-medium">{user.full_name}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-slate-500">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={USER_TYPE_CONFIG[user.user_type]?.color}>
                            {USER_TYPE_CONFIG[user.user_type]?.label || user.user_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            {getOrgName(user.org_id)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={user.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-slate-500">
                            <Clock className="w-3 h-3" />
                            {formatDate(user.last_login)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(user)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleToggleActive(user)}>
                              {user.is_active ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeleteUser(user.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Staff Users Tab */}
        <TabsContent value="staff" className="mt-4 space-y-4">
          {/* Role Breakdown Cards */}
          <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
            {Object.entries(STAFF_ROLES).map(([role, config]) => (
              <Card 
                key={role}
                className={`cursor-pointer hover:border-slate-400 transition-colors ${filterRole === role ? 'border-teal-500' : ''}`}
                onClick={() => setFilterRole(filterRole === role ? 'all' : role)}
              >
                <CardContent className="pt-3 pb-3 px-3">
                  <p className="text-xs text-slate-500 truncate">{config.label}</p>
                  <p className="text-xl font-bold">{staffCounts[role] || 0}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-3 items-center">
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {Object.entries(STAFF_ROLES).map(([role, config]) => (
                      <SelectItem key={role} value={role}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterOrg} onValueChange={setFilterOrg}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Organization" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Organizations</SelectItem>
                    {parentOrgs.map(org => (
                      <SelectItem key={org.id} value={org.id}>{org.org_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>

                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Button onClick={() => openAddDialog(false)} data-testid="add-staff-btn">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Staff
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Staff Table */}
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                        No staff users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStaff.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="font-medium">{user.full_name}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-slate-500">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={STAFF_ROLES[user.role]?.color || 'bg-slate-100 text-slate-700'}>
                            {STAFF_ROLES[user.role]?.label || user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            {getOrgName(user.org_id)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={user.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-slate-500">
                            <Clock className="w-3 h-3" />
                            {formatDate(user.last_login)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(user)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleToggleActive(user)}>
                              {user.is_active ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeleteUser(user.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit User Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
            <DialogDescription>
              {editingUser ? 'Update user details' : 'Create a new user account'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Full Name *</Label>
              <Input
                value={userForm.full_name}
                onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div>
              <Label>{editingUser ? 'New Password (leave blank to keep)' : 'Password *'}</Label>
              <Input
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>User Type</Label>
                <Select
                  value={userForm.user_type}
                  onValueChange={(v) => setUserForm({ ...userForm, user_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {isSystemAdmin() && <SelectItem value="system_admin">System Admin</SelectItem>}
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Role</Label>
                <Select
                  value={userForm.role}
                  onValueChange={(v) => setUserForm({ ...userForm, role: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STAFF_ROLES).map(([role, config]) => (
                      <SelectItem key={role} value={role}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Organization</Label>
              <Select
                value={userForm.org_id || 'none'}
                onValueChange={(v) => setUserForm({ ...userForm, org_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Organization</SelectItem>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.org_name} {!org.is_parent && '(Branch)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={userForm.is_active}
                onCheckedChange={(v) => setUserForm({ ...userForm, is_active: v })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>Cancel</Button>
            <Button onClick={editingUser ? handleUpdateUser : handleCreateUser}>
              {editingUser ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sensitive Action Verification Modal */}
      <SensitiveActionModal
        open={showSensitiveModal}
        onOpenChange={setShowSensitiveModal}
        actionType={sensitiveAction}
        actionTitle={
          sensitiveAction === 'delete_user' 
            ? 'Delete Administrator' 
            : 'Change Administrator Status'
        }
        actionDescription={
          sensitiveAction === 'delete_user'
            ? `You are about to delete ${pendingActionUser?.full_name || 'an administrator'}. This action cannot be undone and will remove all access for this user.`
            : `You are about to ${pendingActionUser?.is_active ? 'deactivate' : 'activate'} ${pendingActionUser?.full_name || 'an administrator'}. This will ${pendingActionUser?.is_active ? 'revoke' : 'restore'} their system access.`
        }
        targetId={pendingActionUser?.id}
        onVerified={handleSensitiveActionVerified}
        onCancel={() => {
          setSensitiveAction(null);
          setPendingActionUser(null);
        }}
      />
    </div>
  );
}
