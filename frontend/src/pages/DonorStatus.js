import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { publicDonorAPI } from '../lib/api';
import { toast } from 'sonner';
import { Clock, CheckCircle, XCircle, AlertTriangle, ArrowLeft, Search, Droplet } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const identityTypes = ['Aadhar', 'Passport', 'Driving License', 'Voter ID', 'PAN Card'];

export default function DonorStatus() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({
    identity_type: searchParams.get('identity_type') || '',
    identity_number: searchParams.get('identity_number') || '',
  });

  useEffect(() => {
    if (form.identity_type && form.identity_number) {
      checkStatus();
    }
  }, []);

  const checkStatus = async () => {
    if (!form.identity_type || !form.identity_number) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await publicDonorAPI.checkStatus(form.identity_type, form.identity_number);
      setStatus(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to check status');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = () => {
    if (!status) return null;
    
    switch (status.status) {
      case 'approved':
        return <CheckCircle className="w-16 h-16 text-emerald-500" />;
      case 'pending':
        return <Clock className="w-16 h-16 text-amber-500" />;
      case 'rejected':
        return <XCircle className="w-16 h-16 text-red-500" />;
      default:
        return <AlertTriangle className="w-16 h-16 text-slate-400" />;
    }
  };

  const getStatusColor = () => {
    if (!status) return 'bg-slate-50';
    
    switch (status.status) {
      case 'approved':
        return 'bg-emerald-50 border-emerald-200';
      case 'pending':
        return 'bg-amber-50 border-amber-200';
      case 'rejected':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/donor')} className="p-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Droplet className="w-6 h-6 text-teal-600" />
              <span className="font-bold text-lg">BBMS</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-12">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Check Registration Status</CardTitle>
            <CardDescription>
              Enter your ID details to check your donor registration status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Search Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>ID Type</Label>
                <Select 
                  value={form.identity_type} 
                  onValueChange={(v) => setForm({ ...form, identity_type: v })}
                >
                  <SelectTrigger data-testid="status-identity-type">
                    <SelectValue placeholder="Select ID type" />
                  </SelectTrigger>
                  <SelectContent>
                    {identityTypes.map(it => (
                      <SelectItem key={it} value={it}>{it}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="identity_number">ID Number</Label>
                <Input
                  id="identity_number"
                  value={form.identity_number}
                  onChange={(e) => setForm({ ...form, identity_number: e.target.value })}
                  placeholder="Enter your ID number"
                  data-testid="status-identity-number"
                />
              </div>
              
              <Button
                onClick={checkStatus}
                disabled={loading || !form.identity_type || !form.identity_number}
                className="w-full bg-teal-600 hover:bg-teal-700"
                data-testid="check-status-submit"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : (
                  <Search className="w-4 h-4 mr-2" />
                )}
                Check Status
              </Button>
            </div>

            {/* Status Result */}
            {status && (
              <div className={`p-6 rounded-lg border ${getStatusColor()} text-center`}>
                <div className="flex justify-center mb-4">
                  {getStatusIcon()}
                </div>
                
                <h3 className="text-lg font-semibold mb-2">
                  {status.status === 'approved' && 'Registration Approved!'}
                  {status.status === 'pending' && 'Pending Approval'}
                  {status.status === 'rejected' && 'Registration Rejected'}
                  {status.status === 'not_found' && 'No Registration Found'}
                </h3>
                
                <p className="text-sm text-slate-600 mb-4">
                  {status.message}
                </p>
                
                {status.full_name && (
                  <p className="text-sm">
                    <span className="text-slate-500">Name:</span> <span className="font-medium">{status.full_name}</span>
                  </p>
                )}
                
                {status.donor_id && (
                  <p className="text-sm">
                    <span className="text-slate-500">Donor ID:</span> <span className="font-mono font-bold text-teal-600">{status.donor_id}</span>
                  </p>
                )}
                
                {status.request_id && (
                  <p className="text-sm">
                    <span className="text-slate-500">Request ID:</span> <span className="font-mono">{status.request_id}</span>
                  </p>
                )}
                
                {status.rejection_reason && (
                  <div className="mt-4 p-3 bg-red-100 rounded-lg text-left">
                    <p className="text-sm text-red-700">
                      <strong>Reason:</strong> {status.rejection_reason}
                    </p>
                  </div>
                )}

                {status.status === 'approved' && status.is_donor && (
                  <Button
                    onClick={() => navigate('/donor')}
                    className="mt-4 bg-teal-600 hover:bg-teal-700"
                  >
                    Login to Your Account
                  </Button>
                )}
                
                {status.status === 'not_found' && (
                  <Button
                    onClick={() => navigate('/donor')}
                    className="mt-4 bg-teal-600 hover:bg-teal-700"
                  >
                    Register as Donor
                  </Button>
                )}
                
                {status.status === 'rejected' && (
                  <Button
                    onClick={() => navigate('/donor')}
                    variant="outline"
                    className="mt-4"
                  >
                    Submit New Registration
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
