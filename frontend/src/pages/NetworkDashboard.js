import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { toast } from 'sonner';
import {
  Building2, Package, Users, AlertTriangle, ArrowLeftRight,
  RefreshCw, TrendingUp, Droplet, Clock, CheckCircle,
  Globe, BarChart3, History, Plus, Settings, Eye, Activity,
  UserPlus, FileText, Shield
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  dispatched: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-700'
};

const ACTION_ICONS = {
  login: Shield,
  create: Plus,
  update: Settings,
  delete: AlertTriangle,
  view: Eye,
};

export default function NetworkDashboard() {
  const { user, isSystemAdmin, isSuperAdmin, isTenantAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [networkData, setNetworkData] = useState(null);
  const [selectedOrg, setSelectedOrg] = useState('all');
  const [viewMode, setViewMode] = useState('overview');
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    fetchNetworkData();
    fetchRecentActivity();
  }, []);

  const fetchNetworkData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/network');
      setNetworkData(res.data);
    } catch (error) {
      toast.error('Failed to fetch network data');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const res = await api.get('/audit-logs/', { params: { limit: 10 } });
      setRecentActivity(res.data.logs || []);
    } catch (error) {
      console.error('Failed to fetch activity:', error);
    }
  };

  const getTotalInventory = () => {
    if (!networkData?.organizations) return 0;
    return networkData.organizations.reduce((sum, org) => sum + (org.inventory_count || 0), 0);
  };

  const getTotalDonors = () => {
    if (!networkData?.organizations) return 0;
    return networkData.organizations.reduce((sum, org) => sum + (org.donor_count || 0), 0);
  };

  const getTotalExpiring = () => {
    if (!networkData?.organizations) return 0;
    return networkData.organizations.reduce((sum, org) => sum + (org.expiring_count || 0), 0);
  };

  const filteredOrgs = useMemo(() => {
    if (!networkData?.organizations) return [];
    
    if (selectedOrg === 'all') {
      return networkData.organizations;
    }
    
    // Find the selected org
    const selected = networkData.organizations.find(o => o.id === selectedOrg);
    
    if (!selected) return [];
    
    // If it's a parent org, also include its branches
    if (selected.is_parent) {
      return networkData.organizations.filter(o => 
        o.id === selectedOrg || o.parent_org_id === selectedOrg
      );
    }
    
    // Otherwise just return the selected org
    return [selected];
  }, [selectedOrg, networkData?.organizations]);

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

  if (!networkData || networkData.error) {
    return (
      <div className="text-center py-12">
        <Globe className="w-16 h-16 mx-auto text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-700">Network View Not Available</h2>
        <p className="text-slate-500 mt-2">
          Network dashboard is only available for System Admin, Super Admin, and Tenant Admin users.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="network-dashboard">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Globe className="w-8 h-8 text-teal-600" />
            Network Dashboard
          </h1>
          <p className="page-subtitle">
            {isSystemAdmin() ? 'System-wide overview' : 
             isSuperAdmin() ? 'Parent organization + branches' :
             'Your organization network'}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedOrg} onValueChange={setSelectedOrg}>
            <SelectTrigger className="w-48" data-testid="org-filter">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {networkData?.organizations?.map(org => (
                <SelectItem key={org.id} value={org.id}>
                  {org.org_name}
                  {org.is_own_org && ' (You)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchNetworkData} data-testid="refresh-network">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Actions - System Admin Only */}
      {isSystemAdmin() && (
        <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white" data-testid="quick-actions">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Quick Actions</h3>
                <p className="text-slate-400 text-sm">Common administrative tasks</p>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => navigate('/organizations')}
                  data-testid="quick-add-org"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Organization
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => navigate('/audit-logs')}
                  data-testid="quick-audit"
                >
                  <History className="w-4 h-4 mr-1" />
                  View Audit Logs
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => navigate('/blood-requests')}
                  data-testid="quick-requests"
                >
                  <ArrowLeftRight className="w-4 h-4 mr-1" />
                  Manage Transfers
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Network Summary Cards - Clickable */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card 
          className="bg-gradient-to-br from-teal-50 to-white border-teal-200 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/organizations')}
          data-testid="card-branches"
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-teal-600">Total Branches</p>
                <p className="text-3xl font-bold text-teal-700">
                  {networkData?.total_organizations || 0}
                </p>
              </div>
              <Building2 className="w-10 h-10 text-teal-500" />
            </div>
            <p className="text-xs text-teal-500 mt-2">Click to manage →</p>
          </CardContent>
        </Card>

        <Card 
          className="bg-gradient-to-br from-blue-50 to-white border-blue-200 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/donors')}
          data-testid="card-donors"
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Total Donors</p>
                <p className="text-3xl font-bold text-blue-700">{getTotalDonors()}</p>
              </div>
              <Users className="w-10 h-10 text-blue-500" />
            </div>
            <p className="text-xs text-blue-500 mt-2">Click to view donors →</p>
          </CardContent>
        </Card>

        <Card 
          className="bg-gradient-to-br from-purple-50 to-white border-purple-200 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/inventory')}
          data-testid="card-inventory"
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600">Network Inventory</p>
                <p className="text-3xl font-bold text-purple-700">{getTotalInventory()}</p>
              </div>
              <Package className="w-10 h-10 text-purple-500" />
            </div>
            <p className="text-xs text-purple-500 mt-2">Click to view inventory →</p>
          </CardContent>
        </Card>

        <Card 
          className="bg-gradient-to-br from-amber-50 to-white border-amber-200 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/inventory')}
          data-testid="card-expiring"
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600">Expiring Soon</p>
                <p className="text-3xl font-bold text-amber-700">{getTotalExpiring()}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-amber-500" />
            </div>
            <p className="text-xs text-amber-500 mt-2">Click to review →</p>
          </CardContent>
        </Card>

        <Card 
          className="bg-gradient-to-br from-indigo-50 to-white border-indigo-200 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/blood-requests')}
          data-testid="card-transfers"
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-indigo-600">Pending Transfers</p>
                <p className="text-3xl font-bold text-indigo-700">
                  {networkData?.transfer_stats?.pending || 0}
                </p>
              </div>
              <ArrowLeftRight className="w-10 h-10 text-indigo-500" />
            </div>
            <p className="text-xs text-indigo-500 mt-2">Click to manage →</p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - 2 columns */}
        <div className="lg:col-span-2">
          <Tabs value={viewMode} onValueChange={setViewMode}>
            <TabsList>
              <TabsTrigger value="overview">Branch Overview</TabsTrigger>
              <TabsTrigger value="inventory">Inventory Distribution</TabsTrigger>
              <TabsTrigger value="transfers">Transfer Activity</TabsTrigger>
            </TabsList>

            {/* Branch Overview Tab */}
            <TabsContent value="overview" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Branch Performance</CardTitle>
                  <CardDescription>Overview of all branches in the network</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Branch</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-center">Donors</TableHead>
                        <TableHead className="text-center">Inventory</TableHead>
                        <TableHead className="text-center">Expiring</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrgs.map(org => (
                        <TableRow 
                          key={org.id} 
                          className={`${org.is_own_org ? 'bg-teal-50' : ''} cursor-pointer hover:bg-slate-50`}
                          onClick={() => navigate('/organizations')}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-slate-400" />
                              <div>
                                <p className="font-medium">{org.org_name}</p>
                                <p className="text-xs text-slate-500">{org.city || '-'}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {org.org_type?.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-medium">{org.donor_count}</TableCell>
                          <TableCell className="text-center">
                            <span className={`font-medium ${org.inventory_count < 10 ? 'text-red-600' : 'text-green-600'}`}>
                              {org.inventory_count}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-medium ${org.expiring_count > 5 ? 'text-amber-600' : 'text-slate-600'}`}>
                              {org.expiring_count}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate('/organizations');
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Inventory Distribution Tab */}
            <TabsContent value="inventory" className="mt-4">
              <div className="grid grid-cols-1 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Droplet className="w-5 h-5" />
                      Inventory by Blood Group
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {Object.entries(networkData?.network_inventory_by_group || {}).map(([group, count]) => (
                        <div 
                          key={group} 
                          className="p-4 bg-slate-50 rounded-lg text-center cursor-pointer hover:bg-slate-100 transition-colors"
                          onClick={() => navigate('/inventory')}
                        >
                          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                            <span className="font-bold text-red-600">{group}</span>
                          </div>
                          <p className="text-2xl font-bold mt-2">{count}</p>
                          <p className="text-xs text-slate-500">units</p>
                        </div>
                      ))}
                      {Object.keys(networkData?.network_inventory_by_group || {}).length === 0 && (
                        <p className="col-span-4 text-center text-slate-500 py-4">No inventory data</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Transfer Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                      {Object.entries(networkData?.transfer_stats || {}).map(([status, count]) => (
                        <div 
                          key={status} 
                          className="p-3 bg-slate-50 rounded-lg text-center cursor-pointer hover:bg-slate-100"
                          onClick={() => navigate('/blood-requests')}
                        >
                          <Badge className={STATUS_COLORS[status] || 'bg-slate-100'}>{status}</Badge>
                          <p className="text-xl font-bold mt-2">{count}</p>
                        </div>
                      ))}
                      {Object.keys(networkData?.transfer_stats || {}).length === 0 && (
                        <p className="col-span-6 text-center text-slate-500 py-4">No transfer data</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Transfer Activity Tab */}
            <TabsContent value="transfers" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Inter-Branch Transfers</CardTitle>
                  <CardDescription>Latest blood transfer activity across the network</CardDescription>
                </CardHeader>
                <CardContent>
                  {networkData?.recent_transfers?.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <ArrowLeftRight className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      No recent transfers
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>From → To</TableHead>
                          <TableHead>Component</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {networkData?.recent_transfers?.map(transfer => (
                          <TableRow 
                            key={transfer.id}
                            className="cursor-pointer hover:bg-slate-50"
                            onClick={() => navigate('/blood-requests')}
                          >
                            <TableCell>
                              <div className="text-sm">
                                {new Date(transfer.created_at).toLocaleDateString()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                <span className="font-medium">{transfer.fulfilling_org_name}</span>
                                <span className="text-slate-400">→</span>
                                <span>{transfer.requesting_org_name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{transfer.blood_group}</p>
                                <p className="text-xs text-slate-500">{transfer.component_type?.replace('_', ' ')}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-medium">{transfer.quantity}</TableCell>
                            <TableCell>
                              <Badge className={STATUS_COLORS[transfer.status]}>
                                {transfer.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Activity Feed - 1 column */}
        <div>
          <Card className="h-fit" data-testid="activity-feed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-teal-600" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest system events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity.length === 0 ? (
                  <p className="text-center text-slate-500 py-4">No recent activity</p>
                ) : (
                  recentActivity.map((activity, idx) => {
                    const IconComponent = ACTION_ICONS[activity.action] || History;
                    return (
                      <div 
                        key={activity.id || idx}
                        className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                        onClick={() => navigate('/audit-logs')}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          activity.action === 'login' ? 'bg-green-100 text-green-600' :
                          activity.action === 'create' ? 'bg-blue-100 text-blue-600' :
                          activity.action === 'delete' ? 'bg-red-100 text-red-600' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {activity.user_email || 'System'}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {activity.action} - {activity.module}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatTimeAgo(activity.timestamp)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                
                {recentActivity.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full text-teal-600"
                    onClick={() => navigate('/audit-logs')}
                  >
                    View All Activity →
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
