import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI, inventoryAPI } from '../lib/api';
import { toast } from 'sonner';
import {
  Users, Droplet, AlertTriangle, Clock, Package, ClipboardList,
  TrendingUp, Activity, RefreshCw, Zap
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
  const [stats, setStats] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, inventoryRes] = await Promise.all([
        dashboardAPI.getStats(),
        inventoryAPI.getByBloodGroup()
      ]);
      setStats(statsRes.data);
      setInventory(inventoryRes.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

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
      <div className="page-header">
        <h1 className="page-title">Welcome back, {user?.full_name}</h1>
        <p className="page-subtitle">{roleLabels[user?.role]} Dashboard - Overview of blood bank operations</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="card-stat" data-testid="stat-donations">
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
          </CardContent>
        </Card>

        <Card className="card-stat" data-testid="stat-donors">
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
          </CardContent>
        </Card>

        <Card className="card-stat" data-testid="stat-available">
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
          </CardContent>
        </Card>

        <Card className="card-stat" data-testid="stat-pending">
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
          </CardContent>
        </Card>
      </div>

      {/* Alert Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-l-4 border-l-amber-500" data-testid="alert-expiring">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Expiring Soon</p>
                <p className="text-sm text-slate-500">{stats?.expiring_soon || 0} units expiring within 7 days</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500" data-testid="alert-quarantine">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">In Quarantine</p>
                <p className="text-sm text-slate-500">{stats?.quarantine_count || 0} units currently quarantined</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
