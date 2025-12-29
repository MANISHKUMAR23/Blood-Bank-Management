import React, { useState, useEffect } from 'react';
import { inventoryAPI, componentAPI, bloodUnitAPI, labelAPI } from '../lib/api';
import { toast } from 'sonner';
import { Package, Thermometer, Clock, AlertTriangle, Printer, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import LabelPrintDialog from '../components/LabelPrintDialog';
import BulkLabelPrintDialog from '../components/BulkLabelPrintDialog';

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

const COMPONENT_COLORS = ['#0d9488', '#e11d48', '#6366f1', '#f59e0b', '#10b981'];

export default function Inventory() {
  const [summary, setSummary] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [expiring, setExpiring] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allUnits, setAllUnits] = useState([]);
  const [allComponents, setAllComponents] = useState([]);
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [showBulkLabelDialog, setShowBulkLabelDialog] = useState(false);
  const [labelData, setLabelData] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [summaryRes, inventoryRes, expiringRes, unitsRes, componentsRes] = await Promise.all([
        inventoryAPI.getSummary(),
        inventoryAPI.getByBloodGroup(),
        inventoryAPI.getExpiring(7),
        bloodUnitAPI.getAll({ status: 'available' }),
        componentAPI.getAll({ status: 'ready_to_use' })
      ]);
      setSummary(summaryRes.data);
      setInventory(inventoryRes.data);
      setExpiring(expiringRes.data);
      setAllUnits(unitsRes.data || []);
      setAllComponents(componentsRes.data || []);
    } catch (error) {
      toast.error('Failed to fetch inventory data');
    } finally {
      setLoading(false);
    }
  };

  const bloodGroupChartData = Object.entries(inventory || {}).map(([bloodGroup, data]) => ({
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

  // Handle single item print label
  const handlePrintLabel = async (item, isComponent = false) => {
    try {
      const response = isComponent 
        ? await labelAPI.getComponentLabel(item.component_id || item.id)
        : await labelAPI.getBloodUnitLabel(item.unit_id || item.id);
      setLabelData(response.data);
      setShowLabelDialog(true);
    } catch (error) {
      toast.error('Failed to fetch label data');
    }
  };

  // Combine all items for bulk printing
  const allItemsForBulkPrint = [
    ...allUnits.map(u => ({ ...u, _type: 'unit' })),
    ...allComponents.map(c => ({ ...c, _type: 'component' }))
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="inventory-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Inventory Management</h1>
          <p className="page-subtitle">Blood stock monitoring and storage management</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowBulkLabelDialog(true)}
            disabled={allItemsForBulkPrint.length === 0}
          >
            <Printer className="w-4 h-4 mr-2" />
            Bulk Print Labels
          </Button>
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-stat">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Units</p>
                <p className="text-2xl font-bold">
                  {Object.values(inventory || {}).reduce((sum, data) => sum + (data?.whole_blood_units || 0), 0)}
                </p>
              </div>
              <Package className="w-8 h-8 text-teal-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-stat">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Components</p>
                <p className="text-2xl font-bold">
                  {Object.values(inventory || {}).reduce((sum, data) => {
                    const compSum = Object.values(data?.components || {}).reduce((s, c) => s + c, 0);
                    return sum + compSum;
                  }, 0)}
                </p>
              </div>
              <Thermometer className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-stat border-l-4 border-l-amber-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Expiring (7 days)</p>
                <p className="text-2xl font-bold text-amber-600">
                  {(expiring?.expiring_units?.length || 0) + (expiring?.expiring_components?.length || 0)}
                </p>
              </div>
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-stat border-l-4 border-l-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Critical Low</p>
                <p className="text-2xl font-bold text-red-600">
                  {inventory?.whole_blood?.filter(i => i.count < 5).length || 0}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Stock by Blood Group</CardTitle>
            <CardDescription>Available whole blood units</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bloodGroupChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="units" fill="#0d9488" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Components Distribution</CardTitle>
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
                      <Cell key={`cell-${index}`} fill={COMPONENT_COLORS[index % COMPONENT_COLORS.length]} />
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
      <Card>
        <CardHeader>
          <CardTitle>Blood Group Availability Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {Object.keys(BLOOD_GROUP_COLORS).map((group) => {
              const data = inventory?.[group];
              const count = data?.whole_blood_units || 0;
              const isLow = count < 5;
              const isCritical = count === 0;
              
              return (
                <div 
                  key={group}
                  className={`text-center p-4 rounded-lg border ${
                    isCritical ? 'border-red-300 bg-red-50' :
                    isLow ? 'border-amber-300 bg-amber-50' :
                    'border-slate-200 hover:shadow-md'
                  } transition-shadow`}
                >
                  <span 
                    className="blood-group-badge text-lg"
                    style={{ backgroundColor: `${BLOOD_GROUP_COLORS[group]}20`, color: BLOOD_GROUP_COLORS[group], borderColor: BLOOD_GROUP_COLORS[group] }}
                  >
                    {group}
                  </span>
                  <p className={`mt-2 text-2xl font-bold ${
                    isCritical ? 'text-red-600' :
                    isLow ? 'text-amber-600' :
                    'text-slate-900'
                  }`}>{count}</p>
                  <p className="text-xs text-slate-500">units</p>
                  {isCritical && (
                    <Badge className="mt-1 bg-red-100 text-red-700 text-xs">Critical</Badge>
                  )}
                  {isLow && !isCritical && (
                    <Badge className="mt-1 bg-amber-100 text-amber-700 text-xs">Low</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="expiring">
        <TabsList>
          <TabsTrigger value="expiring">Expiring Soon</TabsTrigger>
          <TabsTrigger value="storage">Storage Locations</TabsTrigger>
        </TabsList>

        <TabsContent value="expiring" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                Items Expiring Within 7 Days
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!expiring?.expiring_units?.length && !expiring?.expiring_components?.length) ? (
                <div className="text-center py-8 text-slate-500">
                  No items expiring within 7 days
                </div>
              ) : (
                <Table className="table-dense">
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Blood Group</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expiring?.expiring_units?.map((item) => (
                      <TableRow key={item.id} className="data-table-row">
                        <TableCell className="font-mono">{item.unit_id}</TableCell>
                        <TableCell>Whole Blood</TableCell>
                        <TableCell>
                          {item.confirmed_blood_group || item.blood_group ? (
                            <span className="blood-group-badge">{item.confirmed_blood_group || item.blood_group}</span>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-amber-600 font-medium">{item.expiry_date}</TableCell>
                        <TableCell>{item.current_location}</TableCell>
                      </TableRow>
                    ))}
                    {expiring?.expiring_components?.map((item) => (
                      <TableRow key={item.id} className="data-table-row">
                        <TableCell className="font-mono">{item.component_id}</TableCell>
                        <TableCell className="capitalize">{item.component_type}</TableCell>
                        <TableCell>
                          {item.blood_group && (
                            <span className="blood-group-badge">{item.blood_group}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-amber-600 font-medium">{item.expiry_date}</TableCell>
                        <TableCell>{item.storage_location}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Storage Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Thermometer className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-blue-700">PRC Storage</h3>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">2-6°C</p>
                  <p className="text-sm text-blue-600">Refrigerator</p>
                </div>
                
                <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Thermometer className="w-5 h-5 text-cyan-600" />
                    <h3 className="font-semibold text-cyan-700">Plasma/FFP</h3>
                  </div>
                  <p className="text-2xl font-bold text-cyan-600">≤ -25°C</p>
                  <p className="text-sm text-cyan-600">Freezer</p>
                </div>
                
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Thermometer className="w-5 h-5 text-amber-600" />
                    <h3 className="font-semibold text-amber-700">Platelets</h3>
                  </div>
                  <p className="text-2xl font-bold text-amber-600">20-24°C</p>
                  <p className="text-sm text-amber-600">Room Temp + Agitator</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
