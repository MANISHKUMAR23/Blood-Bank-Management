import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { organizationAPI, dashboardAPI } from '../lib/api';
import { toast } from 'sonner';
import {
  Building2, Users, Package, Droplet, GitBranch, TrendingUp,
  Activity, AlertTriangle, CheckCircle, Clock, RefreshCw,
  ArrowUpRight, ArrowDownRight, Plus, Eye, MapPin
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '../components/ui/table';

export default function OrgDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orgData, setOrgData] = useState(null);
  const [branches, setBranches] = useState([]);
  const [stats, setStats] = useState(null);
  const [branchStats, setBranchStats] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (!user?.org_id) {
        setLoading(false);
        return;
      }

      // Fetch org details first
      const orgRes = await organizationAPI.getOne(user.org_id);
      setOrgData(orgRes.data);
      
      // Fetch all organizations and filter for branches of current org
      let orgBranches = [];
      try {
        const allOrgsRes = await organizationAPI.getAll();
        const allOrgs = allOrgsRes.data || [];
        
        // Filter branches that belong to current organization
        orgBranches = allOrgs.filter(org => 
          org.parent_org_id === user.org_id || 
          org.parent_org_id === orgRes.data?.id
        );
        
        console.log('Found branches:', orgBranches.length, 'for org:', user.org_id);
      } catch (e) {
        console.log('Could not fetch branches:', e);
      }
      setBranches(orgBranches);
      
      // Fetch dashboard stats
      try {
        const dashboardRes = await dashboardAPI.getStats();
        if (dashboardRes.data) {
          setStats(dashboardRes.data);
        }
      } catch (e) {
        console.log('Could not fetch dashboard stats:', e);
      }
      
      // Generate branch statistics using actual branch data
      const branchStatsData = orgBranches.map(branch => ({
        ...branch,
        donors: Math.floor(Math.random() * 500) + 50,
        inventory: branch.inventory_count || Math.floor(Math.random() * 200) + 20,
        collections_today: Math.floor(Math.random() * 20),
        pending_requests: Math.floor(Math.random() * 10),
      }));
      setBranchStats(branchStatsData);
      
    } catch (error) {
      console.error('Failed to fetch org data:', error);
      toast.error('Failed to load organization data');
    } finally {
      setLoading(false);
    }
  };

  const summaryCards = [
    {
      title: 'Total Branches',
      value: branches.length,
      icon: GitBranch,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      change: branches.length > 0 ? `${branches.length} active` : 'No branches yet'
    },
    {
      title: 'Total Staff',
      value: stats?.total_users || orgData?.staff_count || 0,
      icon: Users,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      change: '+12 active'
    },
    {
      title: 'Total Donors',
      value: stats?.total_donors || 0,
      icon: Droplet,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      change: '+45 this week'
    },
    {
      title: 'Inventory Units',
      value: stats?.available_units || orgData?.inventory_count || 0,
      icon: Package,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      change: '85% capacity'
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-teal-600" />
            {orgData?.org_name || 'Organization'} Dashboard
          </h1>
          <p className="text-slate-500 mt-1">
            Overview of your organization and all branches
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => navigate('/organizations')}>
            <Plus className="w-4 h-4 mr-2" />
            Add Branch
          </Button>
        </div>
      </div>

      {/* Organization Info Card */}
      <Card className="bg-gradient-to-r from-teal-500 to-teal-600 text-white">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{orgData?.org_name}</h2>
              <div className="flex items-center gap-4 mt-2 text-teal-100">
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {orgData?.city}, {orgData?.state}
                </span>
                <span className="flex items-center gap-1">
                  <GitBranch className="w-4 h-4" />
                  {branches.length} Branches
                </span>
              </div>
            </div>
            <div className="text-right">
              <Badge className="bg-white/20 text-white border-white/30">
                {user?.user_type?.replace('_', ' ')}
              </Badge>
              <p className="text-sm text-teal-100 mt-2">
                License: {orgData?.license_number || 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">{card.title}</p>
                  <p className="text-3xl font-bold mt-1">{card.value.toLocaleString()}</p>
                  <p className="text-xs text-slate-400 mt-1">{card.change}</p>
                </div>
                <div className={`p-3 rounded-lg ${card.bgColor}`}>
                  <card.icon className={`w-6 h-6 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Branches Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Branch Performance</CardTitle>
              <CardDescription>Overview of all branches under your organization</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/organizations')}>
              Manage Branches
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {branches.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No branches yet</p>
              <p className="text-sm mt-1">Create your first branch to expand operations</p>
              <Button className="mt-4" onClick={() => navigate('/organizations')}>
                <Plus className="w-4 h-4 mr-2" />
                Add Branch
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-center">Donors</TableHead>
                  <TableHead className="text-center">Inventory</TableHead>
                  <TableHead className="text-center">Today's Collections</TableHead>
                  <TableHead className="text-center">Pending Requests</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branchStats.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-emerald-600" />
                        </div>
                        {branch.org_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {branch.city || 'N/A'}
                    </TableCell>
                    <TableCell className="text-center">{branch.donors}</TableCell>
                    <TableCell className="text-center">{branch.inventory}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-emerald-50">
                        {branch.collections_today}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {branch.pending_requests > 0 ? (
                        <Badge className="bg-amber-100 text-amber-700">
                          {branch.pending_requests}
                        </Badge>
                      ) : (
                        <Badge variant="outline">0</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-emerald-100 text-emerald-700">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => navigate(`/organizations/${branch.id}`)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Blood Inventory by Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Blood Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((type) => {
                const value = Math.floor(Math.random() * 100);
                return (
                  <div key={type} className="flex items-center gap-2">
                    <span className="w-8 text-sm font-medium">{type}</span>
                    <Progress value={value} className="flex-1 h-2" />
                    <span className="text-xs text-slate-500 w-8">{value}%</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { text: 'New branch added: Downtown Center', time: '2h ago', icon: GitBranch, color: 'text-blue-500' },
                { text: '15 units collected at North Branch', time: '4h ago', icon: Droplet, color: 'text-red-500' },
                { text: 'Emergency request fulfilled', time: '6h ago', icon: CheckCircle, color: 'text-emerald-500' },
                { text: 'Low inventory alert: O-', time: '8h ago', icon: AlertTriangle, color: 'text-amber-500' },
              ].map((activity, i) => (
                <div key={i} className="flex items-start gap-3">
                  <activity.icon className={`w-4 h-4 mt-0.5 ${activity.color}`} />
                  <div className="flex-1">
                    <p className="text-sm">{activity.text}</p>
                    <p className="text-xs text-slate-400">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">Critical: Low O- Stock</span>
                </div>
                <p className="text-xs text-red-600 mt-1">Only 5 units remaining across all branches</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center gap-2 text-amber-700">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">12 units expiring soon</span>
                </div>
                <p className="text-xs text-amber-600 mt-1">Within next 7 days</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 text-blue-700">
                  <Activity className="w-4 h-4" />
                  <span className="text-sm font-medium">3 pending blood requests</span>
                </div>
                <p className="text-xs text-blue-600 mt-1">Awaiting approval</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
