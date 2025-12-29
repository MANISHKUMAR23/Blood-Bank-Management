import React, { useState, useEffect } from 'react';
import { preLabQCAPI, bloodUnitAPI } from '../lib/api';
import { toast } from 'sonner';
import { 
  ClipboardCheck, Search, CheckCircle, XCircle, AlertTriangle,
  RefreshCw, Scan, Eye, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';

const QC_CHECKS = [
  { key: 'bag_integrity', label: 'Bag Integrity', description: 'Check for leaks, punctures, or damage' },
  { key: 'color_appearance', label: 'Color Appearance', description: 'Normal red color, no unusual discoloration' },
  { key: 'clots_visible', label: 'Clots Visible', description: 'No visible clots in the bag' },
  { key: 'hemolysis_check', label: 'Hemolysis Check', description: 'No signs of hemolysis (pink/red plasma)' },
  { key: 'volume_adequate', label: 'Volume Adequate', description: 'Volume meets minimum requirements' },
];

export default function PreLabQC() {
  const [loading, setLoading] = useState(true);
  const [pendingUnits, setPendingUnits] = useState([]);
  const [qcRecords, setQcRecords] = useState([]);
  const [showQCDialog, setShowQCDialog] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [qcForm, setQcForm] = useState({
    bag_integrity: null,
    color_appearance: null,
    clots_visible: null,
    hemolysis_check: null,
    volume_adequate: null,
    failure_reason: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pendingRes, recordsRes] = await Promise.all([
        preLabQCAPI.getPending(),
        preLabQCAPI.getAll()
      ]);
      setPendingUnits(pendingRes.data);
      setQcRecords(recordsRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm) {
      toast.error('Enter a Unit ID or scan barcode');
      return;
    }
    
    try {
      const res = await preLabQCAPI.getByUnit(searchTerm);
      if (res.data.has_qc) {
        toast.info('This unit already has Pre-Lab QC completed');
      } else if (res.data.unit) {
        setSelectedUnit(res.data.unit);
        setShowQCDialog(true);
        resetForm();
      } else {
        toast.error('Unit not found');
      }
    } catch (error) {
      toast.error('Unit not found');
    }
  };

  const resetForm = () => {
    setQcForm({
      bag_integrity: null,
      color_appearance: null,
      clots_visible: null,
      hemolysis_check: null,
      volume_adequate: null,
      failure_reason: ''
    });
  };

  const startQC = (unit) => {
    setSelectedUnit(unit);
    setShowQCDialog(true);
    resetForm();
  };

  const handleCheckChange = (key, value) => {
    setQcForm({ ...qcForm, [key]: value });
  };

  const isFormComplete = () => {
    return QC_CHECKS.every(check => qcForm[check.key] !== null);
  };

  const hasFailure = () => {
    return QC_CHECKS.some(check => qcForm[check.key] === 'fail');
  };

  const handleSubmit = async () => {
    if (!isFormComplete()) {
      toast.error('Please complete all checks');
      return;
    }
    
    if (hasFailure() && !qcForm.failure_reason) {
      toast.error('Please provide a reason for failure');
      return;
    }
    
    try {
      const res = await preLabQCAPI.create({
        unit_id: selectedUnit.id,
        ...qcForm
      });
      
      if (res.data.overall_result === 'pass') {
        toast.success(`Unit ${selectedUnit.unit_id} passed Pre-Lab QC - Sent to Lab`);
      } else {
        toast.warning(`Unit ${selectedUnit.unit_id} failed Pre-Lab QC - Sent to Quarantine`);
      }
      
      setShowQCDialog(false);
      setSearchTerm('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit QC');
    }
  };

  const passCount = qcRecords.filter(r => r.overall_result === 'pass').length;
  const failCount = qcRecords.filter(r => r.overall_result === 'fail').length;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="pre-lab-qc-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ClipboardCheck className="w-8 h-8 text-teal-600" />
            Pre-Lab QC
          </h1>
          <p className="page-subtitle">Visual inspection before laboratory testing</p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Search/Scan Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Scan className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                placeholder="Scan barcode or enter Unit ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSearch}>
              <Search className="w-4 h-4 mr-2" />
              Find Unit
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-stat border-l-4 border-l-amber-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pending QC</p>
                <p className="text-2xl font-bold text-amber-600">{pendingUnits.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-stat border-l-4 border-l-emerald-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Passed</p>
                <p className="text-2xl font-bold text-emerald-600">{passCount}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-stat border-l-4 border-l-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Failed</p>
                <p className="text-2xl font-bold text-red-600">{failCount}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-stat border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Inspected</p>
                <p className="text-2xl font-bold">{qcRecords.length}</p>
              </div>
              <Eye className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Pending ({pendingUnits.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Completed ({qcRecords.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Units Awaiting Pre-Lab QC</CardTitle>
              <CardDescription>Blood units that need visual inspection before lab testing</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                </div>
              ) : pendingUnits.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-emerald-300" />
                  All units have been inspected
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unit ID</TableHead>
                      <TableHead>Blood Group</TableHead>
                      <TableHead>Collection Date</TableHead>
                      <TableHead>Volume</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingUnits.map((unit) => (
                      <TableRow key={unit.id} className="data-table-row">
                        <TableCell className="font-mono font-medium">{unit.unit_id}</TableCell>
                        <TableCell>
                          <span className="blood-group-badge">{unit.blood_group || unit.confirmed_blood_group}</span>
                        </TableCell>
                        <TableCell>{unit.collection_date}</TableCell>
                        <TableCell>{unit.volume} mL</TableCell>
                        <TableCell>
                          <Badge className="bg-amber-100 text-amber-700">Collected</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            className="bg-teal-600 hover:bg-teal-700"
                            onClick={() => startQC(unit)}
                          >
                            <ClipboardCheck className="w-4 h-4 mr-1" />
                            Inspect
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

        <TabsContent value="completed" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Completed Inspections</CardTitle>
              <CardDescription>Recent pre-lab QC results</CardDescription>
            </CardHeader>
            <CardContent>
              {qcRecords.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No inspections completed yet</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>QC ID</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Bag Integrity</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>Clots</TableHead>
                      <TableHead>Hemolysis</TableHead>
                      <TableHead>Volume</TableHead>
                      <TableHead>Inspector</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {qcRecords.slice(0, 20).map((record) => (
                      <TableRow key={record.id} className="data-table-row">
                        <TableCell className="font-mono">{record.pre_qc_id}</TableCell>
                        <TableCell>
                          {record.overall_result === 'pass' ? (
                            <Badge className="bg-emerald-100 text-emerald-700">
                              <CheckCircle className="w-3 h-3 mr-1" />Pass
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700">
                              <XCircle className="w-3 h-3 mr-1" />Fail
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{record.bag_integrity === 'pass' ? '✓' : '✗'}</TableCell>
                        <TableCell>{record.color_appearance === 'pass' ? '✓' : '✗'}</TableCell>
                        <TableCell>{record.clots_visible === 'pass' ? '✓' : '✗'}</TableCell>
                        <TableCell>{record.hemolysis_check === 'pass' ? '✓' : '✗'}</TableCell>
                        <TableCell>{record.volume_adequate === 'pass' ? '✓' : '✗'}</TableCell>
                        <TableCell>{record.inspector_name || '-'}</TableCell>
                        <TableCell>{record.created_at?.split('T')[0]}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* QC Dialog */}
      <Dialog open={showQCDialog} onOpenChange={setShowQCDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pre-Lab QC Inspection</DialogTitle>
            <DialogDescription>
              Unit: <span className="font-mono font-medium">{selectedUnit?.unit_id}</span> | 
              Blood Group: <span className="font-medium">{selectedUnit?.blood_group}</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {QC_CHECKS.map((check) => (
              <div key={check.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium">{check.label}</p>
                  <p className="text-xs text-slate-500">{check.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={qcForm[check.key] === 'pass' ? 'default' : 'outline'}
                    className={qcForm[check.key] === 'pass' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                    onClick={() => handleCheckChange(check.key, 'pass')}
                  >
                    <ThumbsUp className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={qcForm[check.key] === 'fail' ? 'default' : 'outline'}
                    className={qcForm[check.key] === 'fail' ? 'bg-red-600 hover:bg-red-700' : ''}
                    onClick={() => handleCheckChange(check.key, 'fail')}
                  >
                    <ThumbsDown className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            {hasFailure() && (
              <div>
                <Label>Failure Reason *</Label>
                <Textarea
                  placeholder="Describe the reason for failure..."
                  value={qcForm.failure_reason}
                  onChange={(e) => setQcForm({...qcForm, failure_reason: e.target.value})}
                />
              </div>
            )}
            
            {isFormComplete() && (
              <div className={`p-4 rounded-lg ${hasFailure() ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}>
                <p className={`font-medium ${hasFailure() ? 'text-red-700' : 'text-emerald-700'}`}>
                  {hasFailure() ? (
                    <><XCircle className="w-4 h-4 inline mr-2" />Unit will be sent to QUARANTINE</>
                  ) : (
                    <><CheckCircle className="w-4 h-4 inline mr-2" />Unit will proceed to LAB TESTING</>
                  )}
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQCDialog(false)}>Cancel</Button>
            <Button 
              className={hasFailure() ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}
              onClick={handleSubmit}
              disabled={!isFormComplete() || (hasFailure() && !qcForm.failure_reason)}
            >
              {hasFailure() ? 'Submit & Quarantine' : 'Submit & Send to Lab'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
