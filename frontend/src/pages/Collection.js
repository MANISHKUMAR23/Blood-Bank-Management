import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { donorAPI, screeningAPI, donationAPI, labelAPI } from '../lib/api';
import { toast } from 'sonner';
import { 
  Search, Droplet, Clock, CheckCircle, AlertTriangle, Printer, 
  RefreshCw, Users, Activity, ChevronRight, Beaker, Heart
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import LabelPrintDialog from '../components/LabelPrintDialog';

export default function Collection() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('eligible');
  
  // Lists
  const [eligibleDonors, setEligibleDonors] = useState([]);
  const [todayDonations, setTodayDonations] = useState([]);
  const [todaySummary, setTodaySummary] = useState(null);
  
  // Search
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selected donor for collection
  const [donor, setDonor] = useState(null);
  const [screening, setScreening] = useState(null);
  const [activeDonation, setActiveDonation] = useState(null);
  const [showCollectionForm, setShowCollectionForm] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completionResult, setCompletionResult] = useState(null);
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [labelData, setLabelData] = useState(null);

  const [startForm, setStartForm] = useState({
    donation_type: 'whole_blood',
  });

  const [completeForm, setCompleteForm] = useState({
    volume: '',
    adverse_reaction: false,
    adverse_reaction_details: '',
  });

  useEffect(() => {
    fetchData();
    const donorId = searchParams.get('donor');
    const screeningId = searchParams.get('screening');
    if (donorId && screeningId) {
      fetchDonorAndStartCollection(donorId, screeningId);
    }
  }, [searchParams]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [eligibleRes, donationsRes, summaryRes] = await Promise.all([
        donationAPI.getEligibleDonors(),
        donationAPI.getTodayDonations(),
        donationAPI.getTodaySummary(),
      ]);
      setEligibleDonors(eligibleRes.data || []);
      setTodayDonations(donationsRes.data || []);
      setTodaySummary(summaryRes.data);
    } catch (error) {
      console.error('Failed to fetch collection data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDonorAndStartCollection = async (donorId, screeningId) => {
    try {
      const [donorRes, screeningRes] = await Promise.all([
        donorAPI.getById(donorId),
        screeningAPI.getById(screeningId)
      ]);
      setDonor(donorRes.data);
      setScreening(screeningRes.data);
      setShowCollectionForm(true);
    } catch (error) {
      toast.error('Failed to fetch donor data');
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setLoading(true);
    try {
      const response = await donorAPI.getAll({ search: searchTerm });
      if (response.data.length === 0) {
        toast.error('No donor found');
      } else if (response.data.length === 1) {
        const donor = response.data[0];
        setDonor(donor);
        
        // Get latest eligible screening
        const screeningsRes = await screeningAPI.getAll({ donor_id: donor.id });
        const eligibleScreening = screeningsRes.data.find(s => s.eligibility_status === 'eligible');
        if (eligibleScreening) {
          setScreening(eligibleScreening);
          setShowCollectionForm(true);
        } else {
          toast.warning('No eligible screening found. Please complete screening first.');
        }
      } else {
        toast.info(`Found ${response.data.length} donors. Please be more specific.`);
      }
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStartCollectionFromList = (eligibleDonor) => {
    fetchDonorAndStartCollection(eligibleDonor.id, eligibleDonor.screening_id);
  };

  const handleStartCollection = async () => {
    if (!donor || !screening) {
      toast.error('Donor and screening are required');
      return;
    }

    setLoading(true);
    try {
      const response = await donationAPI.create({
        donor_id: donor.id,
        screening_id: screening.id,
        donation_type: startForm.donation_type,
        collection_start_time: new Date().toISOString(),
      });
      
      setActiveDonation(response.data);
      toast.success(`Collection started! Donation ID: ${response.data.donation_id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start collection');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteCollection = async () => {
    if (!activeDonation) return;

    setLoading(true);
    try {
      const response = await donationAPI.complete(activeDonation.id, {
        volume: parseFloat(completeForm.volume),
        adverse_reaction: completeForm.adverse_reaction,
        adverse_reaction_details: completeForm.adverse_reaction_details || undefined,
      });
      
      setCompletionResult(response.data);
      setShowCompleteDialog(true);
      fetchData(); // Refresh lists
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete collection');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintLabel = async () => {
    if (!completionResult?.unit_id) return;
    try {
      const response = await labelAPI.getBloodUnitLabel(completionResult.unit_id);
      setLabelData(response.data);
      setShowLabelDialog(true);
    } catch (error) {
      toast.error('Failed to fetch label data');
    }
  };

  const handleCloseForm = () => {
    setShowCollectionForm(false);
    setDonor(null);
    setScreening(null);
    setActiveDonation(null);
    setStartForm({ donation_type: 'whole_blood' });
    setCompleteForm({ volume: '', adverse_reaction: false, adverse_reaction_details: '' });
  };

  // Filter eligible donors by search
  const filteredEligibleDonors = eligibleDonors.filter(d => 
    !searchTerm || 
    d.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.donor_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.phone?.includes(searchTerm)
  );

  return (
    <div className="space-y-6 animate-fade-in" data-testid="collection-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Blood Collection</h1>
          <p className="page-subtitle">Manage blood donation collection process</p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Today's Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-teal-50 to-teal-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-teal-600">Eligible Donors</p>
                <p className="text-2xl font-bold text-teal-700">{eligibleDonors.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-teal-200 flex items-center justify-center">
                <Users className="w-6 h-6 text-teal-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Today's Total</p>
                <p className="text-2xl font-bold text-blue-700">{todaySummary?.total || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600">Completed</p>
                <p className="text-2xl font-bold text-emerald-700">{todaySummary?.completed || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-200 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600">In Progress</p>
                <p className="text-2xl font-bold text-amber-700">{todaySummary?.in_progress || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-amber-200 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-50 to-red-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">Total Volume</p>
                <p className="text-2xl font-bold text-red-700">{todaySummary?.total_volume || 0} mL</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-200 flex items-center justify-center">
                <Droplet className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <Card className="p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by donor ID, name, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9"
              data-testid="donor-search"
            />
          </div>
          <Button onClick={handleSearch} disabled={loading} data-testid="search-btn">
            Search
          </Button>
        </div>
      </Card>

      {/* Tabs for Eligible and Today's Collections */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="eligible" className="flex items-center gap-2">
            <Heart className="w-4 h-4" />
            Eligible ({filteredEligibleDonors.length})
          </TabsTrigger>
          <TabsTrigger value="today" className="flex items-center gap-2">
            <Beaker className="w-4 h-4" />
            Today ({todayDonations.length})
          </TabsTrigger>
        </TabsList>

        {/* Eligible Donors Tab */}
        <TabsContent value="eligible" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Eligible Donors Awaiting Collection</CardTitle>
              <CardDescription>
                Donors who have passed screening and are ready to donate
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredEligibleDonors.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p>No eligible donors awaiting collection</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table className="table-dense">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Donor ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Blood Group</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Screening Date</TableHead>
                        <TableHead>Hemoglobin</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEligibleDonors.map((d) => (
                        <TableRow key={d.id} className="cursor-pointer hover:bg-slate-50">
                          <TableCell className="font-mono text-sm">{d.donor_id}</TableCell>
                          <TableCell className="font-medium">{d.full_name}</TableCell>
                          <TableCell>
                            {d.blood_group ? (
                              <span className="blood-group-badge">{d.blood_group}</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">{d.phone || '-'}</TableCell>
                          <TableCell className="text-sm">{d.screening_date}</TableCell>
                          <TableCell className="text-sm">
                            <span className={d.hemoglobin >= 12.5 ? 'text-emerald-600' : 'text-red-600'}>
                              {d.hemoglobin} g/dL
                            </span>
                          </TableCell>
                          <TableCell>
                            {d.has_active_donation ? (
                              <Badge className="bg-amber-100 text-amber-700">In Progress</Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-700">Ready</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              size="sm" 
                              onClick={() => handleStartCollectionFromList(d)}
                              className="bg-teal-600 hover:bg-teal-700"
                              disabled={d.has_active_donation}
                            >
                              {d.has_active_donation ? 'Continue' : 'Start Collection'}
                              <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Today's Collections Tab */}
        <TabsContent value="today" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Today's Collections</CardTitle>
              <CardDescription>
                Donations collected on {new Date().toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {todayDonations.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Droplet className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p>No collections today yet</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table className="table-dense">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Donation ID</TableHead>
                        <TableHead>Donor</TableHead>
                        <TableHead>Blood Group</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Volume</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {todayDonations.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="text-sm text-slate-600">
                            {d.collection_start_time ? new Date(d.collection_start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{d.donation_id}</TableCell>
                          <TableCell className="font-medium">{d.donor_name || '-'}</TableCell>
                          <TableCell>
                            {d.blood_group ? (
                              <span className="blood-group-badge">{d.blood_group}</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="capitalize text-sm">{d.donation_type?.replace('_', ' ') || '-'}</TableCell>
                          <TableCell className="text-sm">
                            {d.volume_collected ? `${d.volume_collected} mL` : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              d.status === 'completed' 
                                ? 'bg-emerald-100 text-emerald-700' 
                                : 'bg-amber-100 text-amber-700'
                            }>
                              {d.status === 'completed' ? (
                                <><CheckCircle className="w-3 h-3 mr-1" /> Completed</>
                              ) : (
                                <><Clock className="w-3 h-3 mr-1" /> In Progress</>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {d.status === 'completed' && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => navigate(`/traceability?unit=${d.donation_id}`)}
                              >
                                View Unit
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Collection Form Dialog */}
      <Dialog open={showCollectionForm} onOpenChange={setShowCollectionForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Droplet className="w-5 h-5 text-red-600" />
              Blood Collection
            </DialogTitle>
          </DialogHeader>
          
          {/* Selected Donor Info */}
          {donor && screening && (
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-semibold">{donor.full_name}</p>
                      <p className="text-sm text-slate-500 font-mono">{donor.donor_id}</p>
                    </div>
                    {(donor.blood_group || screening.preliminary_blood_group) && (
                      <span className="blood-group-badge ml-4">{donor.blood_group || screening.preliminary_blood_group}</span>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-slate-500">Hemoglobin</p>
                    <p className="font-semibold text-emerald-600">{screening.hemoglobin} g/dL</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Start Collection Form */}
          {donor && screening && !activeDonation && (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Donation Type</Label>
                <Select 
                  value={startForm.donation_type} 
                  onValueChange={(v) => setStartForm({ ...startForm, donation_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whole_blood">Whole Blood</SelectItem>
                    <SelectItem value="apheresis_platelets">Apheresis Platelets</SelectItem>
                    <SelectItem value="apheresis_plasma">Apheresis Plasma</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleCloseForm}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleStartCollection}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={loading}
                >
                  {loading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                  <Droplet className="w-4 h-4 mr-2" />
                  Start Collection
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Active Collection - Complete Form */}
          {activeDonation && (
            <div className="space-y-4 mt-4">
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-amber-700">
                    <Clock className="w-5 h-5 animate-pulse" />
                    <span className="font-medium">Collection in Progress</span>
                    <span className="ml-auto font-mono">{activeDonation.donation_id}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label htmlFor="volume">Volume Collected (mL) *</Label>
                <Input
                  id="volume"
                  type="number"
                  value={completeForm.volume}
                  onChange={(e) => setCompleteForm({ ...completeForm, volume: e.target.value })}
                  placeholder="450"
                  required
                />
                <p className="text-xs text-slate-500">Standard whole blood donation: 450 mL</p>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="adverse"
                    checked={completeForm.adverse_reaction}
                    onCheckedChange={(checked) => setCompleteForm({ ...completeForm, adverse_reaction: checked })}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label htmlFor="adverse" className="text-sm font-medium cursor-pointer">
                      Adverse Reaction Occurred
                    </label>
                    <p className="text-sm text-slate-500">
                      Check if the donor experienced any adverse reaction during donation
                    </p>
                  </div>
                </div>
              </div>

              {completeForm.adverse_reaction && (
                <div className="space-y-2">
                  <Label htmlFor="reaction_details">Reaction Details</Label>
                  <Textarea
                    id="reaction_details"
                    value={completeForm.adverse_reaction_details}
                    onChange={(e) => setCompleteForm({ ...completeForm, adverse_reaction_details: e.target.value })}
                    placeholder="Describe the adverse reaction..."
                    rows={3}
                  />
                </div>
              )}

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={handleCloseForm}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCompleteCollection}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={loading || !completeForm.volume}
                >
                  {loading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Complete Collection
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Completion Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              Collection Completed
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-slate-600">
              Blood collection has been completed successfully!
            </p>
            <div className="bg-slate-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Unit ID:</span>
                <span className="font-mono font-bold">{completionResult?.unit_id}</span>
              </div>
              {completionResult?.barcode && (
                <div className="flex justify-center pt-2">
                  <img 
                    src={`data:image/png;base64,${completionResult.barcode}`} 
                    alt="Unit Barcode"
                    className="h-16"
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => navigate('/traceability')}>
              View Traceability
            </Button>
            <Button 
              variant="outline"
              onClick={handlePrintLabel}
              className="border-teal-600 text-teal-600 hover:bg-teal-50"
            >
              <Printer className="w-4 h-4 mr-1" />
              Print Label
            </Button>
            <Button 
              onClick={() => {
                setShowCompleteDialog(false);
                handleCloseForm();
              }}
              className="bg-teal-600 hover:bg-teal-700"
            >
              New Collection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Label Print Dialog */}
      <LabelPrintDialog 
        open={showLabelDialog}
        onOpenChange={setShowLabelDialog}
        labelData={labelData}
        title="Print Blood Pack Label"
      />
    </div>
  );
}
