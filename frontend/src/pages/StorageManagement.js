import React, { useState, useEffect } from 'react';
import { storageAPI, configAPI } from '../lib/api';
import { toast } from 'sonner';
import { 
  Package, Plus, Edit2, Thermometer, AlertTriangle, RefreshCw,
  Warehouse, MapPin, CheckCircle, XCircle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Progress } from '../components/ui/progress';

export default function StorageManagement() {
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [summary, setSummary] = useState(null);
  const [storageTypes, setStorageTypes] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationDetails, setLocationDetails] = useState(null);
  
  const [formData, setFormData] = useState({
    storage_name: '',
    storage_type: '',
    temperature_range: '',
    capacity: '',
    location_code: '',
    facility: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [locRes, summaryRes, typesRes] = await Promise.all([
        storageAPI.getAll(),
        storageAPI.getSummary(),
        configAPI.getStorageTypes({ is_active: true })
      ]);
      setLocations(locRes.data);
      setSummary(summaryRes.data);
      setStorageTypes(typesRes.data);
    } catch (error) {
      toast.error('Failed to fetch storage data');
    } finally {
      setLoading(false);
    }
  };

  const getStorageTypeInfo = (typeCode) => {
    return storageTypes.find(t => t.type_code === typeCode) || { 
      type_name: typeCode, 
      icon: '📦', 
      default_temp_range: 'N/A' 
    };
  };

  const handleCreate = async () => {
    if (!formData.storage_name || !formData.storage_type || !formData.location_code) {
      toast.error('Please fill all required fields');
      return;
    }
    
    try {
      await storageAPI.create({
        ...formData,
        capacity: parseInt(formData.capacity) || 100
      });
      toast.success('Storage location created');
      setShowCreateDialog(false);
      setFormData({ storage_name: '', storage_type: '', temperature_range: '', capacity: '', location_code: '', facility: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create storage location');
    }
  };

  const handleTypeChange = (typeCode) => {
    const typeInfo = getStorageTypeInfo(typeCode);
    setFormData({
      ...formData,
      storage_type: typeCode,
      temperature_range: typeInfo.default_temp_range || ''
    });
  };

  const viewDetails = async (location) => {
    try {
      const res = await storageAPI.getOne(location.id);
      setLocationDetails(res.data);
      setSelectedLocation(location);
      setShowDetailsDialog(true);
    } catch (error) {
      toast.error('Failed to fetch location details');
    }
  };

  const getOccupancyColor = (occupancy, capacity) => {
    const percent = (occupancy / capacity) * 100;
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 80) return 'bg-amber-500';
    if (percent >= 50) return 'bg-blue-500';
    return 'bg-emerald-500';
  };

  const getStorageIcon = (type) => {
    const typeInfo = getStorageTypeInfo(type);
    return typeInfo?.icon || '📦';
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="storage-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Warehouse className="w-8 h-8 text-teal-600" />
            Storage Management
          </h1>
          <p className="page-subtitle">Manage blood storage locations and capacity</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Location
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-stat">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Locations</p>
                <p className="text-2xl font-bold">{summary?.total_locations || 0}</p>
              </div>
              <Warehouse className="w-8 h-8 text-teal-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-stat">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Capacity</p>
                <p className="text-2xl font-bold">{summary?.total_capacity || 0}</p>
              </div>
              <Package className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-stat">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Occupied</p>
                <p className="text-2xl font-bold">{summary?.total_occupied || 0}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className={`card-stat ${summary?.capacity_alerts?.length > 0 ? 'border-amber-300 bg-amber-50' : ''}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Capacity Alerts</p>
                <p className="text-2xl font-bold text-amber-600">{summary?.capacity_alerts?.length || 0}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Capacity Alerts */}
      {summary?.capacity_alerts?.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-700 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Capacity Alerts (&gt;80% Full)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {summary.capacity_alerts.map((alert, idx) => (
                <Badge key={idx} className="bg-amber-100 text-amber-700">
                  {alert.storage_name} - {alert.occupancy_percent}%
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Storage Locations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Storage Locations</CardTitle>
          <CardDescription>All registered storage locations</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
            </div>
          ) : locations.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Warehouse className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              No storage locations configured
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Temperature</TableHead>
                  <TableHead>Facility</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Occupancy</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((loc) => {
                  const occupancyPercent = loc.capacity > 0 ? Math.round((loc.current_occupancy / loc.capacity) * 100) : 0;
                  return (
                    <TableRow key={loc.id} className="data-table-row">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{getStorageIcon(loc.storage_type)}</span>
                          <div>
                            <p className="font-medium">{loc.storage_name}</p>
                            <p className="text-xs text-slate-500 font-mono">{loc.location_code}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {getStorageTypeInfo(loc.storage_type)?.type_name || loc.storage_type?.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Thermometer className="w-4 h-4 text-blue-500" />
                          {loc.temperature_range}
                        </div>
                      </TableCell>
                      <TableCell>{loc.facility}</TableCell>
                      <TableCell>{loc.capacity}</TableCell>
                      <TableCell>
                        <div className="w-24">
                          <div className="flex justify-between text-xs mb-1">
                            <span>{loc.current_occupancy}</span>
                            <span>{occupancyPercent}%</span>
                          </div>
                          <Progress value={occupancyPercent} className={getOccupancyColor(loc.current_occupancy, loc.capacity)} />
                        </div>
                      </TableCell>
                      <TableCell>
                        {loc.is_active ? (
                          <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-700">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => viewDetails(loc)}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Storage Location</DialogTitle>
            <DialogDescription>Create a new storage location</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Storage Name *</Label>
              <Input 
                placeholder="e.g., Main Refrigerator 1"
                value={formData.storage_name}
                onChange={(e) => setFormData({...formData, storage_name: e.target.value})}
              />
            </div>
            
            <div>
              <Label>Storage Type *</Label>
              <Select value={formData.storage_type} onValueChange={handleTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {storageTypes.map(type => (
                    <SelectItem key={type.type_code} value={type.type_code}>
                      {type.icon} {type.type_name} ({type.default_temp_range})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Temperature Range</Label>
              <Input 
                placeholder="e.g., 2-6°C"
                value={formData.temperature_range}
                onChange={(e) => setFormData({...formData, temperature_range: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Capacity *</Label>
                <Input 
                  type="number"
                  placeholder="100"
                  value={formData.capacity}
                  onChange={(e) => setFormData({...formData, capacity: e.target.value})}
                />
              </div>
              <div>
                <Label>Location Code *</Label>
                <Input 
                  placeholder="e.g., REF-A01"
                  value={formData.location_code}
                  onChange={(e) => setFormData({...formData, location_code: e.target.value})}
                />
              </div>
            </div>
            
            <div>
              <Label>Facility</Label>
              <Input 
                placeholder="e.g., Main Building"
                value={formData.facility}
                onChange={(e) => setFormData({...formData, facility: e.target.value})}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedLocation?.storage_name}</DialogTitle>
            <DialogDescription>Location code: {selectedLocation?.location_code}</DialogDescription>
          </DialogHeader>
          
          {locationDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm text-slate-500">Type</p>
                  <p className="font-medium capitalize">{locationDetails.location?.storage_type?.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Temperature</p>
                  <p className="font-medium">{locationDetails.location?.temperature_range}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Items Stored</p>
                  <p className="font-medium">{locationDetails.item_count}</p>
                </div>
              </div>
              
              {locationDetails.units?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Blood Units ({locationDetails.units.length})</h4>
                  <div className="max-h-40 overflow-y-auto">
                    <Table className="table-dense">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Unit ID</TableHead>
                          <TableHead>Blood Group</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {locationDetails.units.map(unit => (
                          <TableRow key={unit.id}>
                            <TableCell className="font-mono">{unit.unit_id}</TableCell>
                            <TableCell><span className="blood-group-badge">{unit.blood_group}</span></TableCell>
                            <TableCell><Badge>{unit.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              
              {locationDetails.components?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Components ({locationDetails.components.length})</h4>
                  <div className="max-h-40 overflow-y-auto">
                    <Table className="table-dense">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Component ID</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Blood Group</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {locationDetails.components.map(comp => (
                          <TableRow key={comp.id}>
                            <TableCell className="font-mono">{comp.component_id}</TableCell>
                            <TableCell className="capitalize">{comp.component_type}</TableCell>
                            <TableCell><span className="blood-group-badge">{comp.blood_group}</span></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
