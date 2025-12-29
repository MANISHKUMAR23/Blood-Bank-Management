import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { donorAPI, screeningAPI, donationAPI, labelAPI } from '../lib/api';
import { toast } from 'sonner';
import { Search, Droplet, Clock, CheckCircle, AlertTriangle, Printer } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import LabelPrintDialog from '../components/LabelPrintDialog';

export default function Collection() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [donor, setDonor] = useState(null);
  const [screening, setScreening] = useState(null);
  const [activeDonation, setActiveDonation] = useState(null);
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
    const donorId = searchParams.get('donor');
    const screeningId = searchParams.get('screening');
    if (donorId && screeningId) {
      fetchDonorAndScreening(donorId, screeningId);
    }
  }, [searchParams]);

  const fetchDonorAndScreening = async (donorId, screeningId) => {
    try {
      const [donorRes, screeningRes] = await Promise.all([
        donorAPI.getById(donorId),
        screeningAPI.getById(screeningId)
      ]);
      setDonor(donorRes.data);
      setScreening(screeningRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
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
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete collection');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintLabel = async () => {
    if (!completionResult?.unit_id) {
      toast.error('No unit ID available for label');
      return;
    }
    
    try {
      const response = await labelAPI.getBloodUnitLabel(completionResult.unit_id);
      setLabelData(response.data);
      setShowLabelDialog(true);
    } catch (error) {
      // Fallback to basic label data if API fails
      setLabelData({
        unit_id: completionResult.unit_id,
        blood_group: screening?.preliminary_blood_group || 'Unknown',
        component_type: 'whole_blood',
        volume: parseFloat(completeForm.volume) || 450,
        collection_date: new Date().toISOString().split('T')[0],
        expiry_date: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        donor_id: donor?.donor_id?.slice(-8) || 'Anonymous',
        test_status: 'pending',
        blood_bank_name: 'BLOODLINK BLOOD BANK',
        warnings: [],
      });
      setShowLabelDialog(true);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="collection-page">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Blood Collection</h1>
        <p className="page-subtitle">Start and manage blood donation collection</p>
      </div>

      {/* Donor Search */}
      {!donor && (
        <Card>
          <CardHeader>
            <CardTitle>Find Eligible Donor</CardTitle>
            <CardDescription>Search for a donor who has passed screening</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Enter donor ID, name, or phone..."
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
          </CardContent>
        </Card>
      )}

      {/* Selected Donor */}
      {donor && screening && !activeDonation && (
        <>
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold">{donor.full_name}</p>
                    <p className="text-sm text-slate-500 font-mono">{donor.donor_id}</p>
                  </div>
                  {screening.preliminary_blood_group && (
                    <span className="blood-group-badge ml-4">{screening.preliminary_blood_group}</span>
                  )}
                </div>
                <Button variant="outline" onClick={() => { setDonor(null); setScreening(null); }}>
                  Change Donor
                </Button>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Screening Date</p>
                  <p className="font-medium">{screening.screening_date}</p>
                </div>
                <div>
                  <p className="text-slate-500">Hemoglobin</p>
                  <p className="font-medium">{screening.hemoglobin} g/dL</p>
                </div>
                <div>
                  <p className="text-slate-500">Weight</p>
                  <p className="font-medium">{screening.weight} kg</p>
                </div>
                <div>
                  <p className="text-slate-500">BP</p>
                  <p className="font-medium">{screening.blood_pressure_systolic}/{screening.blood_pressure_diastolic}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Start Collection Form */}
          <Card className="form-section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Droplet className="w-5 h-5 text-teal-600" />
                Start Collection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Donation Type</Label>
                <Select 
                  value={startForm.donation_type} 
                  onValueChange={(v) => setStartForm({ ...startForm, donation_type: v })}
                >
                  <SelectTrigger data-testid="select-donation-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whole_blood">Whole Blood</SelectItem>
                    <SelectItem value="apheresis">Apheresis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={handleStartCollection}
                className="w-full bg-teal-600 hover:bg-teal-700"
                disabled={loading}
                data-testid="start-collection-btn"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : (
                  <Droplet className="w-4 h-4 mr-2" />
                )}
                Start Collection
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Active Collection */}
      {activeDonation && (
        <div className="space-y-6">
          <Card className="border-l-4 border-l-amber-500 bg-amber-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center animate-pulse">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-amber-700">Collection In Progress</p>
                  <p className="text-sm text-amber-600 font-mono">{activeDonation.donation_id}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-amber-600">Started at</p>
                  <p className="font-mono">{new Date(activeDonation.collection_start_time).toLocaleTimeString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="form-section">
            <CardHeader>
              <CardTitle>Complete Collection</CardTitle>
              <CardDescription>Record the final collection details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="volume">Volume Collected (mL) *</Label>
                <Input
                  id="volume"
                  type="number"
                  value={completeForm.volume}
                  onChange={(e) => setCompleteForm({ ...completeForm, volume: e.target.value })}
                  placeholder="e.g., 450"
                  data-testid="input-volume"
                />
                <p className="text-xs text-slate-500">Standard whole blood donation: 450 mL</p>
              </div>
              
              <div className="pt-4 border-t">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="adverse"
                    checked={completeForm.adverse_reaction}
                    onCheckedChange={(checked) => setCompleteForm({ ...completeForm, adverse_reaction: checked })}
                    data-testid="checkbox-adverse"
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
                    data-testid="input-reaction-details"
                  />
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setActiveDonation(null)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCompleteCollection}
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                  disabled={loading || !completeForm.volume}
                  data-testid="complete-collection-btn"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Complete Collection
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/traceability')}>
              View Traceability
            </Button>
            <Button 
              onClick={() => {
                setShowCompleteDialog(false);
                setActiveDonation(null);
                setDonor(null);
                setScreening(null);
              }}
              className="bg-teal-600 hover:bg-teal-700"
            >
              New Collection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
