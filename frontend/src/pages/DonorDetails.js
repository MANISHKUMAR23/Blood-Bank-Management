import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { donorAPI, donationSessionAPI, rewardsAPI } from '../lib/api';
import { toast } from 'sonner';
import { 
  ArrowLeft, QrCode, CheckCircle, XCircle, History, Droplet, AlertTriangle,
  Edit, Ban, RefreshCw, Clipboard, Trophy, Award, Star, Upload, FileText,
  Clock, Activity, User, Phone, Mail, MapPin, Calendar, Scale, Heart,
  ChevronDown, ChevronUp, Loader2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Progress } from '../components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';

const DEACTIVATION_REASONS = [
  { value: 'medical', label: 'Medical Condition' },
  { value: 'failed_screening', label: 'Failed Screening' },
  { value: 'fraud', label: 'Fraud/Misrepresentation' },
  { value: 'request', label: 'Donor Request' },
  { value: 'deceased', label: 'Deceased' },
  { value: 'other', label: 'Other' },
];

const TIER_COLORS = {
  bronze: 'bg-amber-100 text-amber-700 border-amber-300',
  silver: 'bg-slate-100 text-slate-700 border-slate-300',
  gold: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  platinum: 'bg-cyan-100 text-cyan-700 border-cyan-300',
};

const BADGE_ICONS = {
  first_donation: '🎉',
  donation_5: '⭐',
  donation_10: '🌟',
  donation_25: '💫',
  donation_50: '👑',
  rare_blood_type: '💎',
  emergency_donor: '🚨'
};

// Calculate age from DOB
const calculateAge = (dob) => {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

export default function DonorDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Data
  const [fullProfile, setFullProfile] = useState(null);
  const [donor, setDonor] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [rewards, setRewards] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [donations, setDonations] = useState([]);
  const [screenings, setScreenings] = useState([]);
  
  // Dialogs
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [showReactivateDialog, setShowReactivateDialog] = useState(false);
  
  // Deactivation form
  const [deactivateForm, setDeactivateForm] = useState({
    reason: '',
    notes: '',
    proofFile: null,
  });
  const [reactivateReason, setReactivateReason] = useState('');

  useEffect(() => {
    fetchDonorData();
  }, [id]);

  const fetchDonorData = async () => {
    try {
      const response = await donorAPI.getFullProfile(id);
      const data = response.data;
      
      setFullProfile(data);
      setDonor(data.donor);
      setEligibility(data.eligibility);
      setRewards(data.rewards);
      setActiveSession(data.active_session);
      setDonations(data.recent_donations || []);
      setScreenings(data.recent_screenings || []);
    } catch (error) {
      toast.error('Failed to load donor details');
      navigate('/donors');
    } finally {
      setLoading(false);
    }
  };

  const handleStartScreening = async () => {
    if (!eligibility?.can_start_screening) {
      toast.error(eligibility?.reasons?.[0] || 'Cannot start screening');
      return;
    }
    
    setActionLoading(true);
    try {
      const response = await donationSessionAPI.create(donor.id);
      toast.success(`Session started: ${response.data.session_id}`);
      navigate(`/screening?donor=${donor.id}&session=${response.data.session_id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start screening');
    } finally {
      setActionLoading(false);
    }
  };

  const handleContinueSession = () => {
    if (activeSession?.current_stage === 'screening') {
      navigate(`/screening?donor=${donor.id}&session=${activeSession.session_id}`);
    } else if (activeSession?.current_stage === 'collection') {
      navigate(`/collection?donor=${donor.id}&screening=${activeSession.screening_id}`);
    }
  };

  const handleStartCollection = () => {
    if (!activeSession || activeSession.current_stage !== 'collection') {
      toast.error('Complete screening first');
      return;
    }
    navigate(`/collection?donor=${donor.id}&screening=${activeSession.screening_id}`);
  };

  const handleDeactivate = async () => {
    if (!deactivateForm.reason) {
      toast.error('Please select a reason');
      return;
    }
    
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('reason', deactivateForm.reason);
      if (deactivateForm.notes) formData.append('notes', deactivateForm.notes);
      if (deactivateForm.proofFile) formData.append('proof_file', deactivateForm.proofFile);
      
      await donorAPI.deactivate(donor.id, formData);
      toast.success('Donor deactivated successfully');
      setShowDeactivateDialog(false);
      fetchDonorData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to deactivate donor');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!reactivateReason) {
      toast.error('Please provide a reason');
      return;
    }
    
    setActionLoading(true);
    try {
      await donorAPI.reactivate(donor.id, reactivateReason);
      toast.success('Donor reactivated successfully');
      setShowReactivateDialog(false);
      setReactivateReason('');
      fetchDonorData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reactivate donor');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!donor) return null;

  const age = calculateAge(donor.date_of_birth);
  const isActive = donor.is_active !== false;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="donor-details">
      {/* Header with Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/donors')} data-testid="back-btn">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="page-title">{donor.full_name}, {age} years</h1>
            {donor.blood_group && <span className="blood-group-badge text-lg">{donor.blood_group}</span>}
            {!isActive && <Badge className="bg-slate-200 text-slate-600">Deactivated</Badge>}
          </div>
          <p className="page-subtitle font-mono">{donor.donor_id}</p>
        </div>
        
        {/* Quick Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {/* Active Session - Continue */}
          {activeSession && (
            <Button
              onClick={handleContinueSession}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Activity className="w-4 h-4 mr-2" />
              Continue {activeSession.current_stage === 'screening' ? 'Screening' : 'Collection'}
            </Button>
          )}
          
          {/* Start Screening */}
          {!activeSession && isActive && (
            <Button
              onClick={handleStartScreening}
              className="bg-teal-600 hover:bg-teal-700"
              disabled={!eligibility?.can_start_screening || actionLoading}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Clipboard className="w-4 h-4 mr-2" />}
              Start Screening
            </Button>
          )}
          
          {/* Start Collection (only if screening completed) */}
          {activeSession?.current_stage === 'collection' && (
            <Button
              onClick={handleStartCollection}
              className="bg-red-600 hover:bg-red-700"
            >
              <Droplet className="w-4 h-4 mr-2" />
              Start Collection
            </Button>
          )}
          
          {/* Edit */}
          <Button variant="outline" onClick={() => navigate(`/donors/${id}/edit`)}>
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          
          {/* Deactivate/Reactivate */}
          {isActive ? (
            <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => setShowDeactivateDialog(true)}>
              <Ban className="w-4 h-4 mr-2" />
              Deactivate
            </Button>
          ) : (
            <Button variant="outline" className="border-emerald-300 text-emerald-600 hover:bg-emerald-50" onClick={() => setShowReactivateDialog(true)}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Reactivate
            </Button>
          )}
        </div>
      </div>

      {/* Active Session Progress Indicator */}
      {activeSession && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium text-blue-800">Active Session: {activeSession.session_id}</span>
              <span className="text-sm text-blue-600">Started: {new Date(activeSession.screening_started_at).toLocaleString()}</span>
            </div>
            
            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-4">
              {/* Screening Step */}
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  activeSession.current_stage === 'screening' 
                    ? 'bg-blue-600 text-white' 
                    : activeSession.screening_completed_at 
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-500'
                }`}>
                  {activeSession.screening_completed_at ? <CheckCircle className="w-5 h-5" /> : <Clipboard className="w-5 h-5" />}
                </div>
                <span className={`ml-2 text-sm font-medium ${activeSession.current_stage === 'screening' ? 'text-blue-700' : ''}`}>
                  Screening
                </span>
              </div>
              
              <div className={`w-16 h-1 ${activeSession.screening_completed_at ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
              
              {/* Collection Step */}
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  activeSession.current_stage === 'collection' 
                    ? 'bg-blue-600 text-white' 
                    : activeSession.collection_completed_at 
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-500'
                }`}>
                  {activeSession.collection_completed_at ? <CheckCircle className="w-5 h-5" /> : <Droplet className="w-5 h-5" />}
                </div>
                <span className={`ml-2 text-sm font-medium ${activeSession.current_stage === 'collection' ? 'text-blue-700' : ''}`}>
                  Collection
                </span>
              </div>
              
              <div className={`w-16 h-1 ${activeSession.collection_completed_at ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
              
              {/* Completed Step */}
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  activeSession.current_stage === 'completed' 
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  <CheckCircle className="w-5 h-5" />
                </div>
                <span className={`ml-2 text-sm font-medium ${activeSession.current_stage === 'completed' ? 'text-emerald-700' : ''}`}>
                  Completed
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Eligibility Status */}
      <Card className={`border-l-4 ${eligibility?.status === 'eligible' ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            {eligibility?.status === 'eligible' ? (
              <>
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-700">Eligible for Donation</p>
                  <p className="text-sm text-slate-500">This donor can donate blood</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="font-semibold text-red-700 capitalize">{eligibility?.status?.replace('_', ' ')}</p>
                  <ul className="text-sm text-red-600 list-disc ml-4">
                    {eligibility?.reasons?.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                  {eligibility?.eligible_date && (
                    <p className="text-sm text-slate-500 mt-1">Eligible from: {eligibility.eligible_date}</p>
                  )}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Donor Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-teal-600" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Date of Birth</p>
                  <p className="font-medium">{donor.date_of_birth} ({age} years)</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Gender</p>
                  <p className="font-medium">{donor.gender}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Blood Group</p>
                  <p className="font-medium">{donor.blood_group || 'Not determined'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Weight</p>
                  <p className="font-medium">{donor.weight ? `${donor.weight} kg` : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Height</p>
                  <p className="font-medium">{donor.height ? `${donor.height} cm` : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">ID Type / Number</p>
                  <p className="font-medium">{donor.identity_type}: {donor.identity_number}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span>{donor.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span>{donor.email || '-'}</span>
                </div>
                <div className="flex items-start gap-2 md:col-span-2">
                  <MapPin className="w-4 h-4 text-slate-400 mt-1" />
                  <span>{donor.address}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Donation History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-teal-600" />
                Donation History
              </CardTitle>
              <CardDescription>Total Donations: {donor.total_donations || 0}</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="donations">
                <TabsList>
                  <TabsTrigger value="donations">Donations ({donations.length})</TabsTrigger>
                  <TabsTrigger value="screenings">Screenings ({screenings.length})</TabsTrigger>
                </TabsList>
                
                <TabsContent value="donations" className="mt-4">
                  {donations.length === 0 ? (
                    <p className="text-center py-4 text-slate-500">No donation history</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Donation ID</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Volume</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {donations.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell>{d.collection_start_time?.split('T')[0]}</TableCell>
                            <TableCell className="font-mono text-sm">{d.donation_id}</TableCell>
                            <TableCell className="capitalize">{d.donation_type?.replace('_', ' ')}</TableCell>
                            <TableCell>{d.volume_collected} mL</TableCell>
                            <TableCell>
                              <Badge className={d.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                                {d.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
                
                <TabsContent value="screenings" className="mt-4">
                  {screenings.length === 0 ? (
                    <p className="text-center py-4 text-slate-500">No screening history</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Hemoglobin</TableHead>
                          <TableHead>BP</TableHead>
                          <TableHead>Result</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {screenings.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell>{s.screening_date}</TableCell>
                            <TableCell>{s.hemoglobin} g/dL</TableCell>
                            <TableCell>{s.blood_pressure_systolic}/{s.blood_pressure_diastolic}</TableCell>
                            <TableCell>
                              <Badge className={s.eligibility_status === 'eligible' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                                {s.eligibility_status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Rewards & Status */}
        <div className="space-y-6">
          {/* Rewards Card */}
          <Card className={`${TIER_COLORS[rewards?.tier] || TIER_COLORS.bronze} border`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Donor Rewards
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tier Badge */}
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50">
                  <Award className="w-6 h-6" />
                  <span className="text-lg font-bold capitalize">{rewards?.tier || 'Bronze'} Tier</span>
                </div>
              </div>
              
              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-white/50 rounded-lg p-3">
                  <p className="text-2xl font-bold">{rewards?.total_donations || 0}</p>
                  <p className="text-sm text-slate-600">Donations</p>
                </div>
                <div className="bg-white/50 rounded-lg p-3">
                  <p className="text-2xl font-bold">{rewards?.points_earned || 0}</p>
                  <p className="text-sm text-slate-600">Points</p>
                </div>
              </div>
              
              {/* Progress to Next Tier */}
              {rewards?.tier_progress && rewards.tier_progress.next_tier && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progress to {rewards.tier_progress.next_tier}</span>
                    <span>{rewards.tier_progress.current}/{rewards.tier_progress.target}</span>
                  </div>
                  <Progress value={rewards.tier_progress.progress} className="h-2" />
                </div>
              )}
              
              {/* Badges */}
              {rewards?.badges?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Badges Earned</p>
                  <div className="flex flex-wrap gap-2">
                    {rewards.badges.map((badge, idx) => (
                      <span key={idx} className="text-2xl" title={badge.badge}>
                        {BADGE_ICONS[badge.badge] || '🏅'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deactivation Info (if deactivated) */}
          {!isActive && donor.deactivation_reason && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <Ban className="w-5 h-5" />
                  Deactivation Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="text-slate-500">Reason:</span>
                  <span className="ml-2 font-medium capitalize">{donor.deactivation_reason.replace('_', ' ')}</span>
                </div>
                {donor.deactivation_notes && (
                  <div>
                    <span className="text-slate-500">Notes:</span>
                    <p className="mt-1">{donor.deactivation_notes}</p>
                  </div>
                )}
                <div>
                  <span className="text-slate-500">Deactivated:</span>
                  <span className="ml-2">{donor.deactivated_at?.split('T')[0]}</span>
                </div>
                {donor.deactivation_proof_url && (
                  <div>
                    <a href={donor.deactivation_proof_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      View Proof Document
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* QR Code */}
          {donor.qr_code && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-teal-600" />
                  Donor QR Code
                </CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <img src={donor.qr_code} alt="Donor QR Code" className="w-32 h-32" />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Deactivate Dialog */}
      <Dialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Ban className="w-5 h-5" />
              Deactivate Donor
            </DialogTitle>
            <DialogDescription>
              This will prevent the donor from making donations. You can reactivate later.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Select value={deactivateForm.reason} onValueChange={(v) => setDeactivateForm(f => ({ ...f, reason: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {DEACTIVATION_REASONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={deactivateForm.notes}
                onChange={(e) => setDeactivateForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Proof Document (PDF/Image, max 10MB)</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setDeactivateForm(f => ({ ...f, proofFile: e.target.files?.[0] }))}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeactivateDialog(false)}>Cancel</Button>
            <Button 
              className="bg-red-600 hover:bg-red-700" 
              onClick={handleDeactivate}
              disabled={actionLoading || !deactivateForm.reason}
            >
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reactivate Dialog */}
      <Dialog open={showReactivateDialog} onOpenChange={setShowReactivateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <RefreshCw className="w-5 h-5" />
              Reactivate Donor
            </DialogTitle>
            <DialogDescription>
              This will allow the donor to make donations again.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason for Reactivation *</Label>
              <Textarea
                value={reactivateReason}
                onChange={(e) => setReactivateReason(e.target.value)}
                placeholder="Why is this donor being reactivated?"
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReactivateDialog(false)}>Cancel</Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700" 
              onClick={handleReactivate}
              disabled={actionLoading || !reactivateReason}
            >
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
