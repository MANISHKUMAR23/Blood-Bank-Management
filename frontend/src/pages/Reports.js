import React, { useState, useEffect } from 'react';
import { reportAPI } from '../lib/api';
import { toast } from 'sonner';
import { BarChart3, Download, Calendar, RefreshCw, FileDown, Users, Package, Droplet, Trash2, ClipboardList } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';

const COLORS = ['#0d9488', '#e11d48', '#6366f1', '#f59e0b', '#10b981', '#8b5cf6'];

export default function Reports() {
  const [loading, setLoading] = useState(false);
  const [dailyReport, setDailyReport] = useState(null);
  const [inventoryReport, setInventoryReport] = useState(null);
  const [expiryReport, setExpiryReport] = useState(null);
  const [discardReport, setDiscardReport] = useState(null);
  const [testingReport, setTestingReport] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchAllReports();
  }, []);

  const fetchAllReports = async () => {
    setLoading(true);
    try {
      const [daily, inventory, expiry, discard, testing] = await Promise.all([
        reportAPI.dailyCollections(selectedDate),
        reportAPI.inventoryStatus(),
        reportAPI.expiryAnalysis(),
        reportAPI.discardAnalysis({}),
        reportAPI.testingOutcomes({})
      ]);
      setDailyReport(daily.data);
      setInventoryReport(inventory.data);
      setExpiryReport(expiry.data);
      setDiscardReport(discard.data);
      setTestingReport(testing.data);
    } catch (error) {
      toast.error('Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyReport = async () => {
    try {
      const response = await reportAPI.dailyCollections(selectedDate);
      setDailyReport(response.data);
    } catch (error) {
      toast.error('Failed to fetch daily report');
    }
  };

  const inventoryChartData = inventoryReport?.by_blood_group ? 
    Object.entries(inventoryReport.by_blood_group).map(([group, data]) => ({
      name: group,
      units: data.whole_blood,
      components: data.components
    })) : [];

  const discardChartData = discardReport?.by_reason ?
    Object.entries(discardReport.by_reason).map(([reason, count]) => ({
      name: reason.replace('_', ' '),
      value: count
    })) : [];

  const testingChartData = testingReport?.by_overall_status ?
    Object.entries(testingReport.by_overall_status).map(([status, count]) => ({
      name: status.replace('_', ' '),
      value: count
    })) : [];

  const componentChartData = inventoryReport?.by_component_type ?
    Object.entries(inventoryReport.by_component_type).map(([type, count]) => ({
      name: type.toUpperCase(),
      value: count
    })) : [];

  return (
    <div className="space-y-6 animate-fade-in" data-testid="reports-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Comprehensive blood bank operational reports</p>
        </div>
        <Button 
          onClick={fetchAllReports}
          variant="outline"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="daily">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="daily">Daily Collections</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="expiry">Expiry</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
          <TabsTrigger value="discards">Discards</TabsTrigger>
        </TabsList>

        {/* Daily Collections */}
        <TabsContent value="daily" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Daily Collections Report</CardTitle>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-40"
                  />
                  <Button onClick={fetchDailyReport} size="sm">
                    <Calendar className="w-4 h-4 mr-1" />
                    Load
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {dailyReport ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-teal-50 rounded-lg text-center">
                    <p className="text-sm text-teal-600">Total Donations</p>
                    <p className="text-3xl font-bold text-teal-700">{dailyReport.total_donations}</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg text-center">
                    <p className="text-sm text-blue-600">Total Volume</p>
                    <p className="text-3xl font-bold text-blue-700">{dailyReport.total_volume} mL</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg text-center">
                    <p className="text-sm text-red-600">Rejections</p>
                    <p className="text-3xl font-bold text-red-700">{dailyReport.rejections}</p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg text-center">
                    <p className="text-sm text-amber-600">Failed Screenings</p>
                    <p className="text-3xl font-bold text-amber-700">{dailyReport.failed_screenings}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">Select a date to view report</div>
              )}
              
              {dailyReport?.by_type && Object.keys(dailyReport.by_type).length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium mb-4">By Donation Type</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={Object.entries(dailyReport.by_type).map(([type, data]) => ({
                        name: type.replace('_', ' '),
                        count: data.count,
                        volume: data.volume
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#0d9488" name="Count" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory */}
        <TabsContent value="inventory" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Inventory by Blood Group</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={inventoryChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="units" fill="#0d9488" name="Whole Blood" />
                      <Bar dataKey="components" fill="#6366f1" name="Components" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Components Distribution</CardTitle>
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
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Expiry */}
        <TabsContent value="expiry" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Expiry Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              {expiryReport ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 bg-red-50 rounded-lg text-center border border-red-200">
                    <p className="text-sm text-red-600 font-medium">Already Expired</p>
                    <p className="text-4xl font-bold text-red-700 mt-2">{expiryReport.expired}</p>
                    <p className="text-xs text-red-500 mt-1">Requires immediate action</p>
                  </div>
                  <div className="p-6 bg-amber-50 rounded-lg text-center border border-amber-200">
                    <p className="text-sm text-amber-600 font-medium">Expiring in 3 Days</p>
                    <p className="text-4xl font-bold text-amber-700 mt-2">{expiryReport.expiring_in_3_days}</p>
                    <p className="text-xs text-amber-500 mt-1">High priority</p>
                  </div>
                  <div className="p-6 bg-blue-50 rounded-lg text-center border border-blue-200">
                    <p className="text-sm text-blue-600 font-medium">Expiring in 7 Days</p>
                    <p className="text-4xl font-bold text-blue-700 mt-2">{expiryReport.expiring_in_7_days}</p>
                    <p className="text-xs text-blue-500 mt-1">Monitor closely</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">Loading...</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Testing */}
        <TabsContent value="testing" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Testing Outcomes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={testingChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {testingChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={
                            entry.name === 'non reactive' ? '#10b981' :
                            entry.name === 'reactive' ? '#ef4444' :
                            entry.name === 'gray' ? '#f59e0b' : '#64748b'
                          } />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Test Results Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {testingReport && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
                      <span className="text-emerald-700">Non-Reactive</span>
                      <span className="text-2xl font-bold text-emerald-700">
                        {testingReport.by_overall_status?.non_reactive || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                      <span className="text-amber-700">Gray Zone</span>
                      <span className="text-2xl font-bold text-amber-700">
                        {testingReport.by_overall_status?.gray || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                      <span className="text-red-700">Reactive</span>
                      <span className="text-2xl font-bold text-red-700">
                        {testingReport.by_overall_status?.reactive || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-700">Pending</span>
                      <span className="text-2xl font-bold text-slate-700">
                        {testingReport.by_overall_status?.pending || 0}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Discards */}
        <TabsContent value="discards" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Discard Reasons Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={discardChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {discardChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Discard Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {discardReport && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="font-medium">Total Discards</span>
                      <span className="text-2xl font-bold">{discardReport.total_discards}</span>
                    </div>
                    {discardReport.by_reason && Object.entries(discardReport.by_reason).map(([reason, count]) => (
                      <div key={reason} className="flex justify-between items-center p-2 border-b">
                        <span className="capitalize text-sm">{reason.replace('_', ' ')}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
