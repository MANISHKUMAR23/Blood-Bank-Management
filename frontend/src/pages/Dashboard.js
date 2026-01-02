import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI, inventoryAPI, donationSessionAPI } from '../lib/api';
import { toast } from 'sonner';
import {
  Users, Droplet, AlertTriangle, Clock, Package, ClipboardList,
  TrendingUp, Activity, RefreshCw, Zap, Clipboard, CheckCircle, PlayCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const BLOOD_GROUP_COLORS = {
  'A+': '#0d9488',
  'A-': '#14b8a6',
  'B+': '#e11d48',
  'B-': '#f43f5e',
  'AB+': '#6366f1',
  'AB-': '#818cf8',
  'O+': '#f59e0b',
  'O-': '#fbbf24',
};

const roleLabels = {
  admin: 'Administrator',
  registration: 'Registration Staff',
  phlebotomist: 'Phlebotomist',
  lab_tech: 'Lab Technician',
  processing: 'Processing Tech',
  qc_manager: 'QC Manager',
  inventory: 'Inventory Manager',
  distribution: 'Distribution Staff',
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, inventoryRes, sessionsRes] = await Promise.all([
        dashboardAPI.getStats(),
        inventoryAPI.getByBloodGroup(),
        donationSessionAPI.getAll({ status: 'active' }).catch(() => ({ data: [] }))
      ]);
      setStats(statsRes.data);
      setInventory(inventoryRes.data);
      setActiveSessions(sessionsRes.data || []);
      setLastUpdated(new Date());
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchData();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const inventoryChartData = Object.entries(inventory || {}).map(([bloodGroup, data]) => ({
    name: bloodGroup,
    units: data.whole_blood_units || 0,
  })).filter(item => item.name !== 'Unknown');

  const componentChartData = Object.entries(inventory || {}).reduce((acc, [bloodGroup, data]) => {
    Object.entries(data.components || {}).forEach(([type, count]) => {
      const existing = acc.find(a => a.name === type.toUpperCase());
      if (existing) {
        existing.value += count;
      } else {
        acc.push({ name: type.toUpperCase(), value: count });
      }
    });
    return acc;
  }, []);

  const PIE_COLORS = ['#0d9488', '#e11d48', '#6366f1', '#f59e0b', '#10b981'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="dashboard">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Welcome back, {user?.full_name}</h1>
          <p className="page-subtitle">{roleLabels[user?.role]} Dashboard - Overview of blood bank operations</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? "bg-teal-600" : ""}
            >
              <Zap className={`w-4 h-4 mr-1 ${autoRefresh ? 'animate-pulse' : ''}`} />
              {autoRefresh ? 'Live' : 'Paused'}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          {lastUpdated && (
            <span className="text-xs text-slate-500">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Stats Cards - Clickable */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card 
          className="card-stat cursor-pointer hover:shadow-lg transition-shadow" 
          data-testid="stat-donations"
          onClick={() => navigate('/collection')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Today's Donations</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats?.today_donations || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                <Droplet className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
            </div>
            <p className="text-xs text-teal-600 mt-2">Click to view collections →</p>
          </CardContent>
        </Card>

        <Card 
          className="card-stat cursor-pointer hover:shadow-lg transition-shadow" 
          data-testid="stat-donors"
          onClick={() => navigate('/donors')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Donors</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats?.total_donors || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-2">Click to manage donors →</p>
          </CardContent>
        </Card>

        <Card 
          className="card-stat cursor-pointer hover:shadow-lg transition-shadow" 
          data-testid="stat-available"
          onClick={() => navigate('/inventory')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Available Units</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats?.available_units || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Package className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <p className="text-xs text-emerald-600 mt-2">Click to view inventory →</p>
          </CardContent>
        </Card>

        <Card 
          className="card-stat cursor-pointer hover:shadow-lg transition-shadow" 
          data-testid="stat-pending"
          onClick={() => navigate('/requests')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pending Requests</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats?.pending_requests || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <ClipboardList className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <p className="text-xs text-amber-600 mt-2">Click to view requests →</p>
          </CardContent>
        </Card>
      </div>

      {/* Alert Cards - Clickable */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card 
          className="border-l-4 border-l-amber-500 cursor-pointer hover:shadow-lg transition-shadow" 
          data-testid="alert-expiring"
          onClick={() => navigate('/inventory')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 dark:text-white">Expiring Soon</p>
                <p className="text-sm text-slate-500">{stats?.expiring_soon || 0} units expiring within 7 days</p>
              </div>
              {stats?.expiring_soon > 0 && (
                <Badge className="bg-amber-100 text-amber-700">Action Required</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card 
          className="border-l-4 border-l-red-500 cursor-pointer hover:shadow-lg transition-shadow" 
          data-testid="alert-quarantine"
          onClick={() => navigate('/inventory')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 dark:text-white">In Quarantine</p>
                <p className="text-sm text-slate-500">{stats?.quarantine_count || 0} units currently quarantined</p>
              </div>
              {stats?.quarantine_count > 0 && (
                <Badge className="bg-red-100 text-red-700">Review Needed</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Donation Sessions */}
      {activeSessions.length > 0 && (
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white" data-testid="active-sessions">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <PlayCircle className="w-5 h-5" />
              Active Donation Sessions
            </CardTitle>
            <CardDescription>Donors currently in the donation workflow</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {activeSessions.slice(0, 5).map((session) => (
                <div 
                  key={session.id || session.session_id}
                  className="flex items-center justify-between p-3 rounded-lg bg-white border border-blue-100 hover:shadow-sm transition-shadow cursor-pointer"
                  onClick={() => {
                    if (session.current_stage === 'screening') {
                      navigate(`/screening?donor=${session.donor_id}&session=${session.session_id}`);
                    } else if (session.current_stage === 'collection') {
                      navigate(`/collection?donor=${session.donor_id}&screening=${session.screening_id}`);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      session.current_stage === 'screening' 
                        ? 'bg-amber-100 text-amber-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {session.current_stage === 'screening' ? (
                        <Clipboard className="w-5 h-5" />
                      ) : (
                        <Droplet className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{session.donor_name || 'Unknown'}</p>
                      <p className="text-xs text-slate-500">{session.donor_code} • {session.blood_group || 'N/A'}</p>
                    </div>
                  </div>
                  
                  {/* Progress indicator */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        session.screening_started_at ? 'bg-emerald-500' : 'bg-slate-200'
                      }`}></div>
                      <span className="text-xs text-slate-500">Screening</span>
                      
                      <div className={`w-8 h-0.5 ${
                        session.screening_completed_at ? 'bg-emerald-500' : 'bg-slate-200'
                      }`}></div>
                      
                      <div className={`w-3 h-3 rounded-full ${
                        session.current_stage === 'collection' ? 'bg-red-500' : 'bg-slate-200'
                      }`}></div>
                      <span className="text-xs text-slate-500">Collection</span>
                      
                      <div className={`w-8 h-0.5 ${
                        session.collection_completed_at ? 'bg-emerald-500' : 'bg-slate-200'
                      }`}></div>
                      
                      <div className={`w-3 h-3 rounded-full ${
                        session.current_stage === 'completed' ? 'bg-emerald-500' : 'bg-slate-200'
                      }`}></div>
                      <span className="text-xs text-slate-500">Done</span>
                    </div>
                    
                    <Badge className={
                      session.current_stage === 'screening' 
                        ? 'bg-amber-100 text-amber-700' 
                        : 'bg-red-100 text-red-700'
                    }>
                      {session.current_stage === 'screening' ? 'In Screening' : 'In Collection'}
                    </Badge>
                  </div>
                </div>
              ))}
              
              {activeSessions.length > 5 && (
                <p className="text-sm text-center text-blue-600 cursor-pointer hover:underline" onClick={() => navigate('/screening')}>
                  View all {activeSessions.length} active sessions →
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="chart-inventory">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-teal-600" />
              Inventory by Blood Group
            </CardTitle>
            <CardDescription>Available whole blood units</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inventoryChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="units" fill="#0d9488" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="chart-components">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-teal-600" />
              Components Distribution
            </CardTitle>
            <CardDescription>Available blood components</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={componentChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {componentChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Blood Group Grid */}
      <Card data-testid="blood-group-grid">
        <CardHeader>
          <CardTitle>Blood Group Availability</CardTitle>
          <CardDescription>Current stock levels by blood type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {Object.keys(BLOOD_GROUP_COLORS).map((group) => {
              const data = inventory?.[group];
              return (
                <div 
                  key={group}
                  className="text-center p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow"
                >
                  <span 
                    className="blood-group-badge text-lg"
                    style={{ backgroundColor: `${BLOOD_GROUP_COLORS[group]}20`, color: BLOOD_GROUP_COLORS[group], borderColor: BLOOD_GROUP_COLORS[group] }}
                  >
                    {group}
                  </span>
                  <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{data?.whole_blood_units || 0}</p>
                  <p className="text-xs text-slate-500">units</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
