import React, { useState, useEffect } from 'react';
import { bloodUnitAPI, componentAPI } from '../lib/api';
import { toast } from 'sonner';
import { Layers, Plus, Search, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';

const componentTypes = [
  { value: 'prc', label: 'Packed Red Cells (PRC)', expiry: 42, temp: '2-6°C', defaultVolume: 250 },
  { value: 'plasma', label: 'Plasma', expiry: 365, temp: '≤ -25°C', defaultVolume: 200 },
  { value: 'ffp', label: 'Fresh Frozen Plasma (FFP)', expiry: 365, temp: '≤ -25°C', defaultVolume: 200 },
  { value: 'platelets', label: 'Platelets', expiry: 5, temp: '20-24°C', defaultVolume: 50 },
  { value: 'cryoprecipitate', label: 'Cryoprecipitate', expiry: 365, temp: '≤ -25°C', defaultVolume: 15 },
];

const storageLocations = [
  'Storage - PRC',
  'Storage - Plasma',
  'Storage - Platelets',
  'Freezer A',
  'Freezer B',
  'Refrigerator 1',
  'Refrigerator 2',
];

export default function Processing() {
  const [units, setUnits] = useState([]);
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Multi-component selection state
  const [selectedComponents, setSelectedComponents] = useState([]);
  const [componentVolumes, setComponentVolumes] = useState({});
  const [componentStorages, setComponentStorages] = useState({});
  const [batchId, setBatchId] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [unitsRes, componentsRes] = await Promise.all([
        bloodUnitAPI.getAll({ status: 'lab' }),
        componentAPI.getAll()
      ]);
      setUnits(unitsRes.data);
      setComponents(componentsRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedComponents([]);
    setComponentVolumes({});
    setComponentStorages({});
    setBatchId('');
    setSelectedUnit(null);
  };

  const toggleComponentSelection = (componentValue) => {
    setSelectedComponents(prev => {
      if (prev.includes(componentValue)) {
        return prev.filter(c => c !== componentValue);
      } else {
        // Set default volume when selecting
        const compType = componentTypes.find(c => c.value === componentValue);
        if (compType && !componentVolumes[componentValue]) {
          setComponentVolumes(v => ({ ...v, [componentValue]: compType.defaultVolume }));
        }
        return [...prev, componentValue];
      }
    });
  };

  const handleVolumeChange = (componentValue, volume) => {
    setComponentVolumes(prev => ({ ...prev, [componentValue]: volume }));
  };

  const handleStorageChange = (componentValue, storage) => {
    setComponentStorages(prev => ({ ...prev, [componentValue]: storage }));
  };

  const handleCreateMultipleComponents = async () => {
    if (!selectedUnit || selectedComponents.length === 0) {
      toast.error('Please select at least one component type');
      return;
    }

    // Validate all selected components have volumes
    for (const comp of selectedComponents) {
      if (!componentVolumes[comp] || componentVolumes[comp] <= 0) {
        toast.error(`Please enter volume for ${componentTypes.find(c => c.value === comp)?.label}`);
        return;
      }
    }

    setProcessing(true);
    let successCount = 0;
    let failCount = 0;
    const createdComponents = [];

    for (const compValue of selectedComponents) {
      try {
        const compType = componentTypes.find(c => c.value === compValue);
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + (compType?.expiry || 35));

        const response = await componentAPI.create({
          parent_unit_id: selectedUnit.id,
          component_type: compValue,
          volume: parseFloat(componentVolumes[compValue]),
          storage_location: componentStorages[compValue] || undefined,
          batch_id: batchId || undefined,
          expiry_date: expiryDate.toISOString().split('T')[0],
        });
        
        successCount++;
        createdComponents.push(response.data.component_id);
      } catch (error) {
        failCount++;
        console.error(`Failed to create ${compValue}:`, error);
      }
    }

    setProcessing(false);

    if (successCount > 0) {
      toast.success(
        <div>
          <p className="font-medium">Created {successCount} component(s)</p>
          <p className="text-xs mt-1">{createdComponents.join(', ')}</p>
        </div>
      );
    }
    if (failCount > 0) {
      toast.error(`Failed to create ${failCount} component(s)`);
    }

    setShowProcessDialog(false);
    fetchData();
    resetForm();
  };

  const getTotalVolume = () => {
    return selectedComponents.reduce((sum, comp) => {
      return sum + (parseFloat(componentVolumes[comp]) || 0);
    }, 0);
  };

  const filteredUnits = units.filter(u => 
    !searchTerm || 
    u.unit_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusColors = {
    processing: 'bg-amber-100 text-amber-700',
    ready_to_use: 'bg-emerald-100 text-emerald-700',
    quarantine: 'bg-red-100 text-red-700',
    reserved: 'bg-cyan-100 text-cyan-700',
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="processing-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Component Processing</h1>
          <p className="page-subtitle">Process blood units into multiple components</p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="process">
        <TabsList>
          <TabsTrigger value="process">Process Units</TabsTrigger>
          <TabsTrigger value="components">Components ({components.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="process" className="mt-4 space-y-4">
          {/* Search */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search by Unit ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                    data-testid="search-input"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Units ready for processing */}
          <Card>
            <CardHeader>
              <CardTitle>Units Ready for Processing</CardTitle>
              <CardDescription>Blood units that have passed lab testing - click Process to create multiple components</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                </div>
              ) : filteredUnits.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No units ready for processing
                </div>
              ) : (
                <Table className="table-dense">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unit ID</TableHead>
                      <TableHead>Blood Group</TableHead>
                      <TableHead>Volume</TableHead>
                      <TableHead>Collection Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnits.map((unit) => (
                      <TableRow key={unit.id} className="data-table-row">
                        <TableCell className="font-mono">{unit.unit_id}</TableCell>
                        <TableCell>
                          {unit.confirmed_blood_group ? (
                            <span className="blood-group-badge">{unit.confirmed_blood_group}</span>
                          ) : unit.blood_group ? (
                            <span className="blood-group-badge">{unit.blood_group}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>{unit.volume} mL</TableCell>
                        <TableCell>{unit.collection_date}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedUnit(unit);
                              setShowProcessDialog(true);
                            }}
                            className="bg-teal-600 hover:bg-teal-700"
                            data-testid={`process-unit-${unit.id}`}
                          >
                            <Layers className="w-4 h-4 mr-1" />
                            Process
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="components" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Blood Components</CardTitle>
              <CardDescription>All processed components</CardDescription>
            </CardHeader>
            <CardContent>
              {components.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No components processed yet
                </div>
              ) : (
                <Table className="table-dense">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Component ID</TableHead>
                      <TableHead>Parent Unit</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Blood Group</TableHead>
                      <TableHead>Volume</TableHead>
                      <TableHead>Storage</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {components.map((comp) => (
                      <TableRow key={comp.id} className="data-table-row">
                        <TableCell className="font-mono text-xs">{comp.component_id}</TableCell>
                        <TableCell className="font-mono text-xs">{comp.parent_unit_id?.slice(-8) || '-'}</TableCell>
                        <TableCell className="capitalize">{comp.component_type?.replace('_', ' ')}</TableCell>
                        <TableCell>
                          {comp.blood_group && (
                            <span className="blood-group-badge">{comp.blood_group}</span>
                          )}
                        </TableCell>
                        <TableCell>{comp.volume} mL</TableCell>
                        <TableCell className="text-sm">{comp.storage_location || '-'}</TableCell>
                        <TableCell>{comp.expiry_date}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[comp.status]}>
                            {comp.status?.replace('_', ' ')}
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

      {/* Multi-Component Process Dialog */}
      <Dialog open={showProcessDialog} onOpenChange={(open) => { setShowProcessDialog(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-teal-600" />
              Process Blood Unit into Components
            </DialogTitle>
            <DialogDescription>
              Select multiple component types to create from this blood unit
            </DialogDescription>
          </DialogHeader>
          
          {selectedUnit && (
            <div className="py-3 px-4 bg-slate-50 dark:bg-slate-800 rounded-lg mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Parent Blood Unit</p>
                  <p className="font-mono font-medium text-lg">{selectedUnit.unit_id}</p>
                </div>
                <div className="text-right">
                  <span className="blood-group-badge text-lg px-3 py-1">
                    {selectedUnit.confirmed_blood_group || selectedUnit.blood_group}
                  </span>
                  <p className="text-sm text-slate-500 mt-1">Volume: {selectedUnit.volume} mL</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            {/* Component Selection with Checkboxes */}
            <div>
              <Label className="text-base font-medium mb-3 block">Select Components to Create *</Label>
              <div className="space-y-3">
                {componentTypes.map((comp) => {
                  const isSelected = selectedComponents.includes(comp.value);
                  return (
                    <div 
                      key={comp.value}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        isSelected 
                          ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' 
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={`comp-${comp.value}`}
                          checked={isSelected}
                          onCheckedChange={() => toggleComponentSelection(comp.value)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <label 
                            htmlFor={`comp-${comp.value}`}
                            className="font-medium cursor-pointer block"
                          >
                            {comp.label}
                          </label>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {comp.temp} • {comp.expiry} days shelf life
                          </p>
                          
                          {isSelected && (
                            <div className="mt-3 grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">Volume (mL) *</Label>
                                <Input
                                  type="number"
                                  value={componentVolumes[comp.value] || ''}
                                  onChange={(e) => handleVolumeChange(comp.value, e.target.value)}
                                  placeholder={`Default: ${comp.defaultVolume}`}
                                  className="mt-1 h-9"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Storage Location</Label>
                                <Select 
                                  value={componentStorages[comp.value] || ''}
                                  onValueChange={(v) => handleStorageChange(comp.value, v)}
                                >
                                  <SelectTrigger className="mt-1 h-9">
                                    <SelectValue placeholder="Select storage" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {storageLocations.map(loc => (
                                      <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Batch ID */}
            <div>
              <Label htmlFor="batch-id">Batch ID (Optional - applies to all)</Label>
              <Input
                id="batch-id"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                placeholder="Enter batch ID"
                className="mt-1"
              />
            </div>

            {/* Summary */}
            {selectedComponents.length > 0 && (
              <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-200 dark:border-teal-800">
                <p className="font-medium text-teal-700 dark:text-teal-300">
                  Creating {selectedComponents.length} component(s)
                </p>
                <p className="text-sm text-teal-600 dark:text-teal-400 mt-1">
                  Total volume: {getTotalVolume()} mL
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedComponents.map(comp => {
                    const type = componentTypes.find(c => c.value === comp);
                    return (
                      <Badge key={comp} className="bg-teal-100 text-teal-700">
                        {type?.label} ({componentVolumes[comp] || 0} mL)
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => { setShowProcessDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateMultipleComponents}
              className="bg-teal-600 hover:bg-teal-700"
              disabled={selectedComponents.length === 0 || processing}
              data-testid="create-components-btn"
            >
              {processing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1" />
                  Create {selectedComponents.length} Component(s)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => { setShowBatchDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleBatchProcess}
              className="bg-teal-600 hover:bg-teal-700"
              disabled={!processForm.component_type || !processForm.volume || batchProcessing}
            >
              {batchProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4 mr-1" />
                  Create {selectedUnits.length} Components
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
