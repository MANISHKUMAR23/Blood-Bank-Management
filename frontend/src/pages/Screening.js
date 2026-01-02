import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { donorAPI, screeningAPI, donationSessionAPI } from '../lib/api';
import { toast } from 'sonner';
import { 
  Search, Clipboard, CheckCircle, XCircle, AlertTriangle, 
  RefreshCw, Clock, Users, UserCheck, UserX, ChevronRight,
  Calendar, Activity, ChevronDown, ChevronUp, User, FileText,
  Heart, Pill, Droplet, Scale
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Age calculation utility
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

// BMI calculation
const calculateBMI = (weight, height) => {
  if (!weight || !height) return null;
  const heightM = height / 100;
  return (weight / (heightM * heightM)).toFixed(1);
};

export default function Screening() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  
  // Lists
  const [pendingDonors, setPendingDonors] = useState([]);
  const [completedScreenings, setCompletedScreenings] = useState([]);
  const [todaySummary, setTodaySummary] = useState(null);
  
  // Search
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selected donor for screening
  const [donor, setDonor] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [showScreeningForm, setShowScreeningForm] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [screeningResult, setScreeningResult] = useState(null);
  
  // Registration info collapsible state
  const [showRegistrationInfo, setShowRegistrationInfo] = useState(true);
  
  // Active session
  const [activeSession, setActiveSession] = useState(null);

  const [formData, setFormData] = useState({
    screening_date: new Date().toISOString().split('T')[0],
    weight: '',
    height: '',
    blood_pressure_systolic: '',
    blood_pressure_diastolic: '',
    pulse: '',
    temperature: '',
    hemoglobin: '',
    preliminary_blood_group: '',
    questionnaire_passed: false,
  });

  useEffect(() => {
    fetchData();
    const donorId = searchParams.get('donor');
    if (donorId) {
      fetchDonorAndStartScreening(donorId);
    }
  }, [searchParams]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pendingRes, completedRes, summaryRes] = await Promise.all([
        screeningAPI.getPendingDonors(),
        screeningAPI.getAll({ date: new Date().toISOString().split('T')[0] }),
        screeningAPI.getTodaySummary(),
      ]);
      setPendingDonors(pendingRes.data || []);
      setCompletedScreenings(completedRes.data || []);
      setTodaySummary(summaryRes.data);
    } catch (error) {
      console.error('Failed to fetch screening data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDonorAndStartScreening = async (id) => {
    try {
      const [donorRes, eligibilityRes] = await Promise.all([
        donorAPI.getById(id),
        donorAPI.checkEligibility(id)
      ]);
      setDonor(donorRes.data);
      setEligibility(eligibilityRes.data);
      if (donorRes.data.blood_group) {
        setFormData(prev => ({ ...prev, preliminary_blood_group: donorRes.data.blood_group }));
      }
      setShowScreeningForm(true);
    } catch (error) {
      toast.error('Failed to fetch donor');
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
        fetchDonorAndStartScreening(response.data[0].id);
      } else {
        toast.info(`Found ${response.data.length} donors. Please be more specific.`);
      }
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStartScreening = (donorItem) => {
    fetchDonorAndStartScreening(donorItem.id);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!donor) {
      toast.error('Please select a donor first');
      return;
    }

    setLoading(true);
    try {
      const response = await screeningAPI.create({
        ...formData,
        donor_id: donor.id,
        weight: parseFloat(formData.weight),
        height: parseFloat(formData.height),
        blood_pressure_systolic: parseInt(formData.blood_pressure_systolic),
        blood_pressure_diastolic: parseInt(formData.blood_pressure_diastolic),
        pulse: parseInt(formData.pulse),
        temperature: parseFloat(formData.temperature),
        hemoglobin: parseFloat(formData.hemoglobin),
      });
      
      setScreeningResult(response.data);
      setShowResultDialog(true);
      fetchData(); // Refresh lists
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit screening');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseForm = () => {
    setShowScreeningForm(false);
    setDonor(null);
    setEligibility(null);
    setFormData({
      screening_date: new Date().toISOString().split('T')[0],
      weight: '',
      height: '',
      blood_pressure_systolic: '',
      blood_pressure_diastolic: '',
      pulse: '',
      temperature: '',
      hemoglobin: '',
      preliminary_blood_group: '',
      questionnaire_passed: false,
    });
  };

  // Filter pending donors by search
  const filteredPendingDonors = pendingDonors.filter(d => 
    !searchTerm || 
    d.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.donor_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.phone?.includes(searchTerm)
  );

  return (
    <div className="space-y-6 animate-fade-in" data-testid="screening-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Health Screening</h1>
          <p className="page-subtitle">Pre-donation health assessment and eligibility check</p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Today's Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pending</p>
                <p className="text-2xl font-bold text-slate-700">{pendingDonors.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                <Clock className="w-6 h-6 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-teal-50 to-teal-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-teal-600">Today's Total</p>
                <p className="text-2xl font-bold text-teal-700">{todaySummary?.total || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-teal-200 flex items-center justify-center">
                <Users className="w-6 h-6 text-teal-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600">Eligible</p>
                <p className="text-2xl font-bold text-emerald-700">{todaySummary?.eligible || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-200 flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-50 to-red-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">Ineligible</p>
                <p className="text-2xl font-bold text-red-700">{todaySummary?.ineligible || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-200 flex items-center justify-center">
                <UserX className="w-6 h-6 text-red-600" />
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

      {/* Tabs for Pending and Completed */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Pending ({filteredPendingDonors.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Completed Today ({completedScreenings.length})
          </TabsTrigger>
        </TabsList>

        {/* Pending Donors Tab */}
        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Donors Awaiting Screening</CardTitle>
              <CardDescription>
                Active donors who haven't been screened today
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredPendingDonors.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p>No pending donors found</p>
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
                        <TableHead>Last Screening</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPendingDonors.map((d) => (
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
                          <TableCell>
                            {d.last_screening_date ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{d.last_screening_date}</span>
                                <Badge className={
                                  d.last_screening_status === 'eligible' 
                                    ? 'bg-emerald-100 text-emerald-700' 
                                    : 'bg-red-100 text-red-700'
                                }>
                                  {d.last_screening_status}
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-sm">Never screened</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              size="sm" 
                              onClick={() => handleStartScreening(d)}
                              className="bg-teal-600 hover:bg-teal-700"
                            >
                              Start Screening
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

        {/* Completed Screenings Tab */}
        <TabsContent value="completed" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Today's Completed Screenings</CardTitle>
              <CardDescription>
                Screenings completed on {new Date().toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {completedScreenings.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Activity className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p>No screenings completed today</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table className="table-dense">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Donor ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Blood Group</TableHead>
                        <TableHead>Hemoglobin</TableHead>
                        <TableHead>BP</TableHead>
                        <TableHead>Result</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completedScreenings.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-sm text-slate-600">
                            {s.created_at ? new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{s.donor_code || s.donor_id?.slice(-8)}</TableCell>
                          <TableCell className="font-medium">{s.donor_name || '-'}</TableCell>
                          <TableCell>
                            {s.preliminary_blood_group ? (
                              <span className="blood-group-badge">{s.preliminary_blood_group}</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            <span className={s.hemoglobin < 12.5 ? 'text-red-600 font-medium' : ''}>
                              {s.hemoglobin} g/dL
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">
                            {s.blood_pressure_systolic}/{s.blood_pressure_diastolic}
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              s.eligibility_status === 'eligible' 
                                ? 'bg-emerald-100 text-emerald-700' 
                                : 'bg-red-100 text-red-700'
                            }>
                              {s.eligibility_status === 'eligible' ? (
                                <><CheckCircle className="w-3 h-3 mr-1" /> Eligible</>
                              ) : (
                                <><XCircle className="w-3 h-3 mr-1" /> Ineligible</>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {s.eligibility_status === 'eligible' && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => navigate(`/collection?donor=${s.donor_id}&screening=${s.id}`)}
                              >
                                Proceed to Collection
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

      {/* Screening Form Dialog */}
      <Dialog open={showScreeningForm} onOpenChange={setShowScreeningForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clipboard className="w-5 h-5 text-teal-600" />
              Health Screening Form
            </DialogTitle>
          </DialogHeader>
          
          {/* Selected Donor Info */}
          {donor && (
            <Card className={`border-l-4 ${eligibility?.eligible ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      eligibility?.eligible ? 'bg-emerald-100' : 'bg-red-100'
                    }`}>
                      {eligibility?.eligible ? (
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">{donor.full_name}</p>
                      <p className="text-sm text-slate-500 font-mono">{donor.donor_id}</p>
                    </div>
                    {donor.blood_group && (
                      <span className="blood-group-badge ml-4">{donor.blood_group}</span>
                    )}
                  </div>
                </div>
                {!eligibility?.eligible && eligibility?.issues && (
                  <div className="mt-3 p-2 bg-red-50 rounded-lg">
                    <p className="text-sm font-medium text-red-700 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Eligibility Issues:
                    </p>
                    <ul className="text-sm text-red-600 list-disc ml-6 mt-1">
                      {eligibility.issues.map((issue, idx) => (
                        <li key={idx}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Screening Form */}
          {donor && eligibility?.eligible && (
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Vitals */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Vital Signs</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="weight" className="text-sm">Weight (kg) *</Label>
                        <Input
                          id="weight"
                          type="number"
                          step="0.1"
                          value={formData.weight}
                          onChange={(e) => handleChange('weight', e.target.value)}
                          placeholder="65"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="height" className="text-sm">Height (cm) *</Label>
                        <Input
                          id="height"
                          type="number"
                          step="0.1"
                          value={formData.height}
                          onChange={(e) => handleChange('height', e.target.value)}
                          placeholder="170"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-sm">BP Systolic *</Label>
                        <Input
                          type="number"
                          value={formData.blood_pressure_systolic}
                          onChange={(e) => handleChange('blood_pressure_systolic', e.target.value)}
                          placeholder="120"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm">BP Diastolic *</Label>
                        <Input
                          type="number"
                          value={formData.blood_pressure_diastolic}
                          onChange={(e) => handleChange('blood_pressure_diastolic', e.target.value)}
                          placeholder="80"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-sm">Pulse (bpm) *</Label>
                        <Input
                          type="number"
                          value={formData.pulse}
                          onChange={(e) => handleChange('pulse', e.target.value)}
                          placeholder="72"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm">Temperature (°C) *</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={formData.temperature}
                          onChange={(e) => handleChange('temperature', e.target.value)}
                          placeholder="36.5"
                          required
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Blood Assessment */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Blood Assessment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-sm">Hemoglobin (g/dL) *</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.hemoglobin}
                        onChange={(e) => handleChange('hemoglobin', e.target.value)}
                        placeholder="14.0"
                        required
                      />
                      <p className="text-xs text-slate-500">Minimum: 12.5 g/dL</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Preliminary Blood Group</Label>
                      <Select 
                        value={formData.preliminary_blood_group} 
                        onValueChange={(v) => handleChange('preliminary_blood_group', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select blood group" />
                        </SelectTrigger>
                        <SelectContent>
                          {bloodGroups.map(bg => (
                            <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="pt-3 border-t">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="questionnaire"
                          checked={formData.questionnaire_passed}
                          onCheckedChange={(checked) => handleChange('questionnaire_passed', checked)}
                        />
                        <div className="grid gap-1 leading-none">
                          <label htmlFor="questionnaire" className="text-sm font-medium cursor-pointer">
                            Health Questionnaire Passed *
                          </label>
                          <p className="text-xs text-slate-500">
                            Donor completed all health questionnaire requirements
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={handleCloseForm}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-teal-600 hover:bg-teal-700"
                  disabled={loading || !formData.questionnaire_passed}
                >
                  {loading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                  Submit Screening
                </Button>
              </DialogFooter>
            </form>
          )}

          {/* Show close button if donor not eligible */}
          {donor && !eligibility?.eligible && (
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseForm}>
                Close
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Result Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {screeningResult?.eligibility_status === 'eligible' ? (
                <><CheckCircle className="w-5 h-5 text-emerald-600" /> Screening Passed</>
              ) : (
                <><XCircle className="w-5 h-5 text-red-600" /> Screening Failed</>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {screeningResult?.eligibility_status === 'eligible' ? (
              <p className="text-slate-600">
                Donor is eligible to donate blood. Proceed to the Collection module.
              </p>
            ) : (
              <div>
                <p className="text-slate-600 mb-2">Donor is not eligible due to:</p>
                <p className="text-red-600 text-sm">{screeningResult?.rejection_reason}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            {screeningResult?.eligibility_status === 'eligible' ? (
              <>
                <Button variant="outline" onClick={() => { setShowResultDialog(false); handleCloseForm(); }}>
                  Screen Another
                </Button>
                <Button 
                  onClick={() => navigate(`/collection?donor=${donor?.id}&screening=${screeningResult.screening_id}`)}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  Proceed to Collection
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => { setShowResultDialog(false); handleCloseForm(); }}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
