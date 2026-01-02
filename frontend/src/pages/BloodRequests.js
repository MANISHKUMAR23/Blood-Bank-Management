import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { organizationAPI } from '../lib/api';
import api from '../lib/api';
import { toast } from 'sonner';
import {
  ArrowLeftRight, Plus, Eye, Check, X, Truck, Package,
  Clock, AlertTriangle, CheckCircle, XCircle, Building2,
  RefreshCw, Filter, Send, Inbox, Search
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';

const URGENCY_COLORS = {
  routine: 'bg-slate-100 text-slate-700',
  urgent: 'bg-amber-100 text-amber-700',
  emergency: 'bg-red-100 text-red-700'
};

const STATUS_CONFIG = {
  pending: { color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  approved: { color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  rejected: { color: 'bg-red-100 text-red-700', icon: XCircle },
  fulfilled: { color: 'bg-purple-100 text-purple-700', icon: Package },
  dispatched: { color: 'bg-indigo-100 text-indigo-700', icon: Truck },
  delivered: { color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { color: 'bg-slate-100 text-slate-700', icon: XCircle }
};

const COMPONENT_TYPES = [
  { value: 'whole_blood', label: 'Whole Blood' },
  { value: 'prc', label: 'Packed Red Cells (PRC)' },
  { value: 'ffp', label: 'Fresh Frozen Plasma (FFP)' },
  { value: 'platelets', label: 'Platelets' },
  { value: 'cryoprecipitate', label: 'Cryoprecipitate' }
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function BloodRequests() {
  const { user, isTenantAdmin, isSuperAdmin, isSystemAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('incoming');
  
  // Data
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [externalOrgs, setExternalOrgs] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [availableComponents, setAvailableComponents] = useState([]);
  
  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showFulfillDialog, setShowFulfillDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showDeliveryDialog, setShowDeliveryDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  
  // Form data
  const [createForm, setCreateForm] = useState({
    request_type: 'internal',
    fulfilling_org_id: '',
    external_org_id: '',
    external_org_name: '',
    external_org_address: '',
    external_contact_person: '',
    external_contact_phone: '',
    external_contact_email: '',
    component_type: '',
    blood_group: '',
    quantity: 1,
    urgency_level: 'routine',
    clinical_indication: '',
    required_by: ''
  });
  
  const [fulfillForm, setFulfillForm] = useState({
    component_ids: [],
    transport_method: 'self_vehicle',
    vehicle_id: '',
    courier_id: '',
    expected_delivery: '',
    notes: ''
  });
  
  const [rejectReason, setRejectReason] = useState('');
  const [deliveryForm, setDeliveryForm] = useState({
    received_by: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, [statusFilter, urgencyFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [incomingRes, outgoingRes, orgsRes, statsRes] = await Promise.all([
        api.get('/inter-org-requests/incoming', { params: { status: statusFilter || undefined, urgency: urgencyFilter || undefined } }),
        api.get('/inter-org-requests/outgoing', { params: { status: statusFilter || undefined } }),
        organizationAPI.getAll(),
        api.get('/inter-org-requests/dashboard/stats')
      ]);
      
      setIncomingRequests(incomingRes.data);
      setOutgoingRequests(outgoingRes.data);
      setOrganizations(orgsRes.data);
      setDashboardStats(statsRes.data);
      
      // Also fetch external orgs
      try {
        const extRes = await organizationAPI.getExternalOrgs();
        setExternalOrgs(extRes.data);
      } catch (e) {
        console.error('Failed to fetch external orgs:', e);
      }
    } catch (error) {
      toast.error('Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async () => {
    if (!createForm.component_type || !createForm.blood_group) {
      toast.error('Component type and blood group are required');
      return;
    }
    
    if (createForm.request_type === 'internal' && !createForm.fulfilling_org_id) {
      toast.error('Please select a fulfilling organization');
      return;
    }
    
    if (createForm.request_type === 'external' && !createForm.external_org_name) {
      toast.error('External organization name is required');
      return;
    }
    
    try {
      await api.post('/inter-org-requests', createForm);
      toast.success('Blood request submitted successfully');
      setShowCreateDialog(false);
      resetCreateForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create request');
    }
  };

  const handleApprove = async (requestId) => {
    try {
      await api.post(`/inter-org-requests/${requestId}/approve`);
      toast.success('Request approved');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve request');
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    
    try {
      await api.post(`/inter-org-requests/${selectedRequest.id}/reject`, { reason: rejectReason });
      toast.success('Request rejected');
      setShowRejectDialog(false);
      setRejectReason('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject request');
    }
  };

  const openFulfillDialog = async (request) => {
    setSelectedRequest(request);
    
    // Fetch available components matching the request
    try {
      const res = await api.get('/components', {
        params: {
          status: 'ready_to_use',
          component_type: request.component_type,
          blood_group: request.blood_group
        }
      });
      setAvailableComponents(res.data);
    } catch (error) {
      toast.error('Failed to fetch available components');
    }
    
    setShowFulfillDialog(true);
  };

  const handleFulfill = async () => {
    if (!selectedRequest) return;
    
    if (fulfillForm.component_ids.length === 0) {
      toast.error('Please select at least one component');
      return;
    }
    
    try {
      await api.post(`/inter-org-requests/${selectedRequest.id}/fulfill`, fulfillForm);
      toast.success('Request fulfilled and dispatched');
      setShowFulfillDialog(false);
      setFulfillForm({
        component_ids: [],
        transport_method: 'self_vehicle',
        vehicle_id: '',
        courier_id: '',
        expected_delivery: '',
        notes: ''
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to fulfill request');
    }
  };

  const handleConfirmDelivery = async () => {
    if (!selectedRequest) return;
    
    try {
      await api.post(`/inter-org-requests/${selectedRequest.id}/confirm-delivery`, deliveryForm);
      toast.success('Delivery confirmed. Inventory updated.');
      setShowDeliveryDialog(false);
      setDeliveryForm({ received_by: '', notes: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to confirm delivery');
    }
  };

  const handleCancel = async (requestId) => {
    if (!window.confirm('Are you sure you want to cancel this request?')) return;
    
    try {
      await api.post(`/inter-org-requests/${requestId}/cancel`);
      toast.success('Request cancelled');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel request');
    }
  };

  const resetCreateForm = () => {
    setCreateForm({
      request_type: 'internal',
      fulfilling_org_id: '',
      external_org_id: '',
      external_org_name: '',
      external_org_address: '',
      external_contact_person: '',
      external_contact_phone: '',
      external_contact_email: '',
      component_type: '',
      blood_group: '',
      quantity: 1,
      urgency_level: 'routine',
      clinical_indication: '',
      required_by: ''
    });
  };

  const toggleComponentSelection = (compId) => {
    setFulfillForm(prev => ({
      ...prev,
      component_ids: prev.component_ids.includes(compId)
        ? prev.component_ids.filter(id => id !== compId)
        : [...prev.component_ids, compId]
    }));
  };

  const getStatusBadge = (status) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  const renderRequestRow = (request, isIncoming = true) => (
    <TableRow key={request.id}>
      <TableCell>
        <div className="font-mono text-sm">{request.id.slice(0, 8)}...</div>
        <div className="text-xs text-slate-500">
          {new Date(request.created_at).toLocaleDateString()}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">
          {request.request_type === 'internal' ? 'Internal' : 'External'}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-400" />
          {isIncoming ? request.requesting_org_name : request.fulfilling_org_name}
        </div>
      </TableCell>
      <TableCell>
        <div className="font-medium">{request.component_type?.replace('_', ' ')}</div>
        <div className="text-sm text-slate-500">{request.blood_group}</div>
      </TableCell>
      <TableCell className="text-center">{request.quantity}</TableCell>
      <TableCell>
        <Badge className={URGENCY_COLORS[request.urgency_level]}>
          {request.urgency_level}
        </Badge>
      </TableCell>
      <TableCell>{getStatusBadge(request.status)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => {
            setSelectedRequest(request);
            setShowDetailsDialog(true);
          }}>
            <Eye className="w-4 h-4" />
          </Button>
          
          {isIncoming && request.status === 'pending' && (
            <>
              <Button variant="ghost" size="sm" className="text-green-600" onClick={() => handleApprove(request.id)}>
                <Check className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-red-600" onClick={() => {
                setSelectedRequest(request);
                setShowRejectDialog(true);
              }}>
                <X className="w-4 h-4" />
              </Button>
            </>
          )}
          
          {isIncoming && (request.status === 'pending' || request.status === 'approved') && (
            <Button variant="ghost" size="sm" className="text-indigo-600" onClick={() => openFulfillDialog(request)}>
              <Truck className="w-4 h-4" />
            </Button>
          )}
          
          {!isIncoming && request.status === 'dispatched' && (
            <Button variant="ghost" size="sm" className="text-green-600" onClick={() => {
              setSelectedRequest(request);
              setShowDeliveryDialog(true);
            }}>
              <CheckCircle className="w-4 h-4" />
            </Button>
          )}
          
          {!isIncoming && ['pending', 'approved'].includes(request.status) && (
            <Button variant="ghost" size="sm" className="text-slate-600" onClick={() => handleCancel(request.id)}>
              <XCircle className="w-4 h-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ArrowLeftRight className="w-8 h-8 text-teal-600" />
            Blood Requests
          </h1>
          <p className="page-subtitle">Manage inter-organization blood requests</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Request Blood
          </Button>
        </div>
      </div>

      {/* Dashboard Stats */}
      {dashboardStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Incoming Pending</p>
                  <p className="text-2xl font-bold">{dashboardStats.incoming?.pending || 0}</p>
                </div>
                <Inbox className="w-8 h-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Incoming Approved</p>
                  <p className="text-2xl font-bold">{dashboardStats.incoming?.approved || 0}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-indigo-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Outgoing Dispatched</p>
                  <p className="text-2xl font-bold">{dashboardStats.outgoing?.dispatched || 0}</p>
                </div>
                <Truck className="w-8 h-8 text-indigo-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-teal-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Action Required</p>
                  <p className="text-2xl font-bold">{dashboardStats.incoming?.total_pending_action || 0}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-teal-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-500">Filters:</span>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="dispatched">Dispatched</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Urgency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Urgency</SelectItem>
                <SelectItem value="routine">Routine</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="incoming" className="flex items-center gap-2">
            <Inbox className="w-4 h-4" />
            Incoming Requests
            {dashboardStats?.incoming?.total_pending_action > 0 && (
              <Badge className="bg-red-500 text-white ml-1">
                {dashboardStats.incoming.total_pending_action}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="outgoing" className="flex items-center gap-2">
            <Send className="w-4 h-4" />
            My Requests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="incoming" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Incoming Blood Requests</CardTitle>
              <CardDescription>Requests from other organizations to your branch</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                </div>
              ) : incomingRequests.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Inbox className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  No incoming requests
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Requesting Org</TableHead>
                      <TableHead>Component</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead>Urgency</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomingRequests.map(req => renderRequestRow(req, true))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outgoing" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>My Blood Requests</CardTitle>
              <CardDescription>Requests you&apos;ve made to other organizations</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                </div>
              ) : outgoingRequests.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Send className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  No outgoing requests
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Fulfilling Org</TableHead>
                      <TableHead>Component</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead>Urgency</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outgoingRequests.map(req => renderRequestRow(req, false))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Request Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Blood</DialogTitle>
            <DialogDescription>Create a new blood request from another organization</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Request Type */}
            <div>
              <Label>Request Type</Label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="request_type"
                    checked={createForm.request_type === 'internal'}
                    onChange={() => setCreateForm({ ...createForm, request_type: 'internal' })}
                    className="text-teal-600"
                  />
                  <span>Internal (Network Branch)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="request_type"
                    checked={createForm.request_type === 'external'}
                    onChange={() => setCreateForm({ ...createForm, request_type: 'external' })}
                    className="text-teal-600"
                  />
                  <span>External Organization</span>
                </label>
              </div>
            </div>

            {/* Internal - Select Org */}
            {createForm.request_type === 'internal' && (
              <div>
                <Label>Request From *</Label>
                <Select
                  value={createForm.fulfilling_org_id}
                  onValueChange={(v) => setCreateForm({ ...createForm, fulfilling_org_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.filter(org => org.id !== user?.org_id).map(org => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.org_name} {org.city && `(${org.city})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* External - Org Details */}
            {createForm.request_type === 'external' && (
              <div className="space-y-3 p-3 border rounded-lg bg-slate-50">
                <div>
                  <Label>Organization Name *</Label>
                  <Input
                    value={createForm.external_org_name}
                    onChange={(e) => setCreateForm({ ...createForm, external_org_name: e.target.value })}
                    placeholder="Hospital / Blood Bank name"
                  />
                </div>
                <div>
                  <Label>Address</Label>
                  <Input
                    value={createForm.external_org_address}
                    onChange={(e) => setCreateForm({ ...createForm, external_org_address: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Contact Person</Label>
                    <Input
                      value={createForm.external_contact_person}
                      onChange={(e) => setCreateForm({ ...createForm, external_contact_person: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Contact Phone</Label>
                    <Input
                      value={createForm.external_contact_phone}
                      onChange={(e) => setCreateForm({ ...createForm, external_contact_phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Blood Request Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Component Type *</Label>
                <Select
                  value={createForm.component_type}
                  onValueChange={(v) => setCreateForm({ ...createForm, component_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPONENT_TYPES.map(ct => (
                      <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Blood Group *</Label>
                <Select
                  value={createForm.blood_group}
                  onValueChange={(v) => setCreateForm({ ...createForm, blood_group: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOOD_GROUPS.map(bg => (
                      <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  min="1"
                  value={createForm.quantity}
                  onChange={(e) => setCreateForm({ ...createForm, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <Label>Urgency</Label>
                <Select
                  value={createForm.urgency_level}
                  onValueChange={(v) => setCreateForm({ ...createForm, urgency_level: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="routine">Routine</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Clinical Indication</Label>
              <Textarea
                value={createForm.clinical_indication}
                onChange={(e) => setCreateForm({ ...createForm, clinical_indication: e.target.value })}
                placeholder="Reason for request"
                rows={2}
              />
            </div>

            <div>
              <Label>Required By</Label>
              <Input
                type="datetime-local"
                value={createForm.required_by}
                onChange={(e) => setCreateForm({ ...createForm, required_by: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleCreateRequest}>
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm text-slate-500">Request ID</p>
                  <p className="font-mono">{selectedRequest.id.slice(0, 12)}...</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Status</p>
                  {getStatusBadge(selectedRequest.status)}
                </div>
                <div>
                  <p className="text-sm text-slate-500">Type</p>
                  <p className="capitalize">{selectedRequest.request_type}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Urgency</p>
                  <Badge className={URGENCY_COLORS[selectedRequest.urgency_level]}>
                    {selectedRequest.urgency_level}
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Component</p>
                  <p className="font-medium">{selectedRequest.component_type?.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Blood Group</p>
                  <p className="font-medium">{selectedRequest.blood_group}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Quantity</p>
                  <p className="font-medium">{selectedRequest.quantity} unit(s)</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Required By</p>
                  <p className="font-medium">
                    {selectedRequest.required_by 
                      ? new Date(selectedRequest.required_by).toLocaleString()
                      : 'Not specified'}
                  </p>
                </div>
              </div>
              
              {selectedRequest.clinical_indication && (
                <div>
                  <p className="text-sm text-slate-500">Clinical Indication</p>
                  <p>{selectedRequest.clinical_indication}</p>
                </div>
              )}
              
              {selectedRequest.rejection_reason && (
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-600 font-medium">Rejection Reason</p>
                  <p className="text-red-700">{selectedRequest.rejection_reason}</p>
                </div>
              )}
              
              {selectedRequest.fulfilled_components && selectedRequest.fulfilled_components.length > 0 && (
                <div>
                  <p className="text-sm text-slate-500">Fulfilled Components</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedRequest.fulfilled_components.map(id => (
                      <Badge key={id} variant="outline">{id.slice(0, 8)}...</Badge>
                    ))}
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

      {/* Fulfill Dialog */}
      <Dialog open={showFulfillDialog} onOpenChange={setShowFulfillDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Fulfill Request</DialogTitle>
            <DialogDescription>Select components and arrange delivery</DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm">
                  <strong>Request:</strong> {selectedRequest.quantity} unit(s) of {selectedRequest.component_type?.replace('_', ' ')} ({selectedRequest.blood_group})
                </p>
              </div>
              
              <div>
                <Label>Select Components ({fulfillForm.component_ids.length} selected)</Label>
                <div className="border rounded-lg max-h-48 overflow-y-auto mt-2">
                  {availableComponents.length === 0 ? (
                    <div className="p-4 text-center text-slate-500">
                      No matching components available
                    </div>
                  ) : (
                    availableComponents.map(comp => (
                      <div
                        key={comp.id}
                        className={`flex items-center justify-between p-3 border-b cursor-pointer hover:bg-slate-50 ${
                          fulfillForm.component_ids.includes(comp.id) ? 'bg-teal-50' : ''
                        }`}
                        onClick={() => toggleComponentSelection(comp.id)}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={fulfillForm.component_ids.includes(comp.id)}
                            onChange={() => {}}
                            className="text-teal-600"
                          />
                          <div>
                            <p className="font-mono text-sm">{comp.component_id || comp.id.slice(0, 12)}</p>
                            <p className="text-xs text-slate-500">Exp: {comp.expiry_date}</p>
                          </div>
                        </div>
                        <Badge>{comp.blood_group}</Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Transport Method</Label>
                  <Select
                    value={fulfillForm.transport_method}
                    onValueChange={(v) => setFulfillForm({ ...fulfillForm, transport_method: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="self_vehicle">Self Vehicle</SelectItem>
                      <SelectItem value="third_party">Third Party Courier</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Expected Delivery</Label>
                  <Input
                    type="datetime-local"
                    value={fulfillForm.expected_delivery}
                    onChange={(e) => setFulfillForm({ ...fulfillForm, expected_delivery: e.target.value })}
                  />
                </div>
              </div>
              
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={fulfillForm.notes}
                  onChange={(e) => setFulfillForm({ ...fulfillForm, notes: e.target.value })}
                  placeholder="Handling instructions, special requirements..."
                  rows={2}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFulfillDialog(false)}>Cancel</Button>
            <Button 
              className="bg-teal-600 hover:bg-teal-700" 
              onClick={handleFulfill}
              disabled={fulfillForm.component_ids.length === 0}
            >
              <Truck className="w-4 h-4 mr-2" />
              Fulfill & Dispatch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
            <DialogDescription>Provide a reason for rejection</DialogDescription>
          </DialogHeader>
          
          <div>
            <Label>Reason *</Label>
            <Select value={rejectReason} onValueChange={setRejectReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Insufficient stock">Insufficient stock</SelectItem>
                <SelectItem value="Invalid request">Invalid request</SelectItem>
                <SelectItem value="Component not available">Component not available</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason}>
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery Confirmation Dialog */}
      <Dialog open={showDeliveryDialog} onOpenChange={setShowDeliveryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delivery</DialogTitle>
            <DialogDescription>Confirm receipt of blood units</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Received By</Label>
              <Input
                value={deliveryForm.received_by}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, received_by: e.target.value })}
                placeholder="Name of person receiving"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={deliveryForm.notes}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, notes: e.target.value })}
                placeholder="Any notes about the delivery"
                rows={2}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeliveryDialog(false)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleConfirmDelivery}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Confirm Delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
