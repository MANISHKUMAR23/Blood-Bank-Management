import React, { useState, useEffect } from 'react';
import { donorRequestAPI } from '../lib/api';
import { toast } from 'sonner';
import { UserPlus, Check, X, Eye, Search, Clock, CheckCircle, XCircle, AlertTriangle, Users } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

export default function DonorRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [duplicateCheck, setDuplicateCheck] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const fetchRequests = async () => {
    try {
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const response = await donorRequestAPI.getAll(params);
      setRequests(response.data);
    } catch (error) {
      toast.error('Failed to fetch donor requests');
    } finally {
      setLoading(false);
    }
  };

  const handleViewRequest = async (request) => {
    setSelectedRequest(request);
    setDuplicateCheck(null);
    setShowDetailDialog(true);
    
    // Check for duplicate
    try {
      const response = await donorRequestAPI.checkDuplicate(request.id);
      setDuplicateCheck(response.data);
    } catch (error) {
      console.error('Failed to check duplicate:', error);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    
    try {
      const response = await donorRequestAPI.approve(selectedRequest.id);
      toast.success(`Donor approved! New Donor ID: ${response.data.donor_id}`);
      setShowDetailDialog(false);
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve request');
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !rejectionReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    
    try {
      await donorRequestAPI.reject(selectedRequest.id, rejectionReason);
      toast.success('Registration rejected');
      setShowRejectDialog(false);
      setShowDetailDialog(false);
      setRejectionReason('');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject request');
    }
  };

  const statusColors = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
  };

  const statusIcons = {
    pending: <Clock className="w-4 h-4" />,
    approved: <CheckCircle className="w-4 h-4" />,
    rejected: <XCircle className="w-4 h-4" />,
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="donor-requests-page">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Donor Registration Requests</h1>
        <p className="page-subtitle">Review and approve donor self-registrations</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-stat">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Requests</p>
                <p className="text-2xl font-bold">{requests.length}</p>
              </div>
              <Users className="w-8 h-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-stat border-l-4 border-l-amber-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pending</p>
                <p className="text-2xl font-bold text-amber-600">
                  {requests.filter(r => r.status === 'pending').length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-amber-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-stat border-l-4 border-l-emerald-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Approved</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {requests.filter(r => r.status === 'approved').length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-stat border-l-4 border-l-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Rejected</p>
                <p className="text-2xl font-bold text-red-600">
                  {requests.filter(r => r.status === 'rejected').length}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48" data-testid="status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Requests</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registration Requests</CardTitle>
          <CardDescription>Self-registered donors awaiting approval</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No registration requests found
            </div>
          ) : (
            <Table className="table-dense">
              <TableHeader>
                <TableRow>
                  <TableHead>Request ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>ID Type</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id} className="data-table-row" data-testid={`request-row-${req.id}`}>
                    <TableCell className="font-mono text-sm">{req.request_id}</TableCell>
                    <TableCell className="font-medium">{req.full_name}</TableCell>
                    <TableCell>{req.identity_type}</TableCell>
                    <TableCell>{req.phone}</TableCell>
                    <TableCell>
                      <Badge className={`${statusColors[req.status]} flex items-center gap-1 w-fit`}>
                        {statusIcons[req.status]}
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(req.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewRequest(req)}
                          data-testid={`view-request-${req.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {req.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-emerald-600 hover:bg-emerald-50"
                              onClick={() => { setSelectedRequest(req); handleViewRequest(req); }}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => { setSelectedRequest(req); setShowRejectDialog(true); }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-teal-600" />
              Registration Request Details
            </DialogTitle>
            <DialogDescription>
              Request ID: {selectedRequest?.request_id}
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-6 py-4">
              {/* Duplicate Warning */}
              {duplicateCheck?.is_duplicate && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700 font-medium">
                    <AlertTriangle className="w-5 h-5" />
                    Duplicate Donor Found!
                  </div>
                  <p className="text-sm text-red-600 mt-1">
                    A donor with this identity already exists: {duplicateCheck.existing_donor?.donor_id} - {duplicateCheck.existing_donor?.full_name}
                  </p>
                </div>
              )}

              {/* Status */}
              <div className="flex items-center gap-4">
                <Badge className={`${statusColors[selectedRequest.status]} text-sm px-3 py-1`}>
                  {statusIcons[selectedRequest.status]}
                  <span className="ml-1 capitalize">{selectedRequest.status}</span>
                </Badge>
                {selectedRequest.donor_id && (
                  <span className="text-sm text-slate-500">
                    Assigned Donor ID: <span className="font-mono font-bold text-teal-600">{selectedRequest.donor_id}</span>
                  </span>
                )}
              </div>

              {/* Identity Info */}
              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-medium text-sm text-slate-700 mb-3">Identity Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">ID Type</p>
                    <p className="font-medium">{selectedRequest.identity_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">ID Number</p>
                    <p className="font-mono">{selectedRequest.identity_number}</p>
                  </div>
                </div>
              </div>

              {/* Demographics */}
              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-medium text-sm text-slate-700 mb-3">Demographics</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Full Name</p>
                    <p className="font-medium">{selectedRequest.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Date of Birth</p>
                    <p className="font-medium">{selectedRequest.date_of_birth}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Gender</p>
                    <p className="font-medium">{selectedRequest.gender}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Weight</p>
                    <p className="font-medium">{selectedRequest.weight ? `${selectedRequest.weight} kg` : '-'}</p>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-medium text-sm text-slate-700 mb-3">Contact Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Phone</p>
                    <p className="font-medium">{selectedRequest.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Email</p>
                    <p className="font-medium">{selectedRequest.email || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-slate-500">Address</p>
                    <p className="font-medium">{selectedRequest.address}</p>
                  </div>
                </div>
              </div>

              {/* Consent */}
              <div className="flex items-center gap-2">
                {selectedRequest.consent_given ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <span className="text-sm">
                  Consent {selectedRequest.consent_given ? 'given' : 'not given'}
                </span>
              </div>

              {/* Rejection Reason */}
              {selectedRequest.rejection_reason && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-700">Rejection Reason</p>
                  <p className="text-sm text-red-600 mt-1">{selectedRequest.rejection_reason}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedRequest?.status === 'pending' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => { setShowDetailDialog(false); setShowRejectDialog(true); }}
                  className="text-red-600 hover:bg-red-50"
                >
                  <X className="w-4 h-4 mr-1" />
                  Reject
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={duplicateCheck?.is_duplicate}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  data-testid="approve-request-btn"
                >
                  <Check className="w-4 h-4 mr-1" />
                  Approve
                </Button>
              </>
            )}
            {selectedRequest?.status !== 'pending' && (
              <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              Reject Registration
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this registration request.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="rejection_reason">Rejection Reason *</Label>
            <Textarea
              id="rejection_reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter the reason for rejection..."
              rows={3}
              className="mt-2"
              data-testid="rejection-reason-input"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRejectDialog(false); setRejectionReason(''); }}>
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={!rejectionReason.trim()}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-reject-btn"
            >
              Reject Registration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
