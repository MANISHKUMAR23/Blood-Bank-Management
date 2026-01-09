import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicDonorAPI } from '../lib/api';
import { toast } from 'sonner';
import { Phone, CreditCard, Loader2, ArrowRight, KeyRound } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { InputOTP, InputOTPGroup, InputOTPSlot } from './ui/input-otp';

// Malaysian Identity Document Types
const identityTypes = [
  { value: 'MyKad', label: 'MyKad (IC)', placeholder: 'e.g., 901231-14-5678' },
  { value: 'MyKAS', label: 'MyKAS (Temporary IC)', placeholder: 'e.g., 901231-14-5678' },
  { value: 'MyPR', label: 'MyPR (Permanent Resident)', placeholder: 'e.g., 901231-14-5678' },
  { value: 'MyTentera', label: 'MyTentera (Military)', placeholder: 'e.g., T1234567' },
  { value: 'MyPolis', label: 'MyPolis (Police)', placeholder: 'e.g., P1234567' },
  { value: 'Passport', label: 'Passport', placeholder: 'e.g., A12345678' },
];

// Helper function to format MyKad number with dashes
const formatMyKadNumber = (value) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 6) {
    return digits;
  } else if (digits.length <= 8) {
    return `${digits.slice(0, 6)}-${digits.slice(6)}`;
  } else {
    return `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 12)}`;
  }
};

export default function DonorLoginForm({ onSuccess }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('credentials'); // 'credentials' | 'otp'
  const [loginMethod, setLoginMethod] = useState('donor_id'); // 'donor_id' | 'identity'
  const [otpSent, setOtpSent] = useState(false);
  const [donorId, setDonorId] = useState('');
  const [otp, setOtp] = useState('');
  
  const [identityForm, setIdentityForm] = useState({
    identity_type: '',
    identity_number: '',
    date_of_birth: '',
  });
  
  const [donorIdForm, setDonorIdForm] = useState({
    donor_id: '',
  });

  const handleIdentityNumberChange = (value) => {
    // Auto-format MyKad numbers
    if (['MyKad', 'MyKAS', 'MyPR'].includes(identityForm.identity_type)) {
      value = formatMyKadNumber(value);
    }
    setIdentityForm({ ...identityForm, identity_number: value });
  };

  const handleIdentityTypeChange = (value) => {
    setIdentityForm({ ...identityForm, identity_type: value, identity_number: '' });
  };

  const handleRequestOTP = async () => {
    setLoading(true);
    try {
      let params = {};
      
      if (loginMethod === 'donor_id') {
        params = { donor_id: donorIdForm.donor_id };
      } else {
        params = {
          identity_type: identityForm.identity_type,
          identity_number: identityForm.identity_number,
          date_of_birth: identityForm.date_of_birth,
        };
      }
      
      const response = await publicDonorAPI.requestOTP(params);
      setDonorId(response.data.donor_id);
      setOtpSent(true);
      setStep('otp');
      toast.success(response.data.message);
      
      // For demo: show OTP in toast
      if (response.data.otp_for_demo) {
        toast.info(`Demo OTP: ${response.data.otp_for_demo}`, { duration: 30000 });
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter the complete 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await publicDonorAPI.verifyOTP(donorId, otp);
      
      // Store donor token
      localStorage.setItem('donor_token', response.data.token);
      localStorage.setItem('donor_info', JSON.stringify(response.data.donor));
      
      toast.success('Login successful!');
      onSuccess(response.data.donor);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = () => {
    if (loginMethod === 'identity' && identityForm.identity_type && identityForm.identity_number) {
      navigate(`/donor/status?identity_type=${identityForm.identity_type}&identity_number=${identityForm.identity_number}`);
    }
  };

  if (step === 'otp') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-teal-100 flex items-center justify-center mb-4">
            <KeyRound className="w-8 h-8 text-teal-600" />
          </div>
          <h3 className="font-semibold text-lg">Enter OTP</h3>
          <p className="text-sm text-slate-500 mt-1">
            We've sent a 6-digit code to your registered phone number
          </p>
        </div>

        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={setOtp}
            data-testid="otp-input"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleVerifyOTP}
            disabled={loading || otp.length !== 6}
            className="w-full bg-teal-600 hover:bg-teal-700"
            data-testid="verify-otp-btn"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</>
            ) : (
              'Verify & Login'
            )}
          </Button>
          
          <Button
            variant="ghost"
            onClick={() => { setStep('credentials'); setOtp(''); }}
            className="w-full text-slate-600"
          >
            Back to login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={loginMethod} onValueChange={setLoginMethod}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="donor_id">Donor ID</TabsTrigger>
          <TabsTrigger value="identity">ID Proof</TabsTrigger>
        </TabsList>
        
        <TabsContent value="donor_id" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="donor_id">Donor ID</Label>
            <Input
              id="donor_id"
              value={donorIdForm.donor_id}
              onChange={(e) => setDonorIdForm({ donor_id: e.target.value })}
              placeholder="e.g., D-2024-0001"
              data-testid="input-donor-id"
            />
            <p className="text-xs text-slate-500">
              Your unique donor ID received after approval
            </p>
          </div>
        </TabsContent>
        
        <TabsContent value="identity" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>ID Type</Label>
            <Select 
              value={identityForm.identity_type} 
              onValueChange={(v) => setIdentityForm({ ...identityForm, identity_type: v })}
            >
              <SelectTrigger data-testid="login-identity-type">
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
              value={identityForm.identity_number}
              onChange={(e) => setIdentityForm({ ...identityForm, identity_number: e.target.value })}
              placeholder="Enter your ID number"
              data-testid="login-identity-number"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="date_of_birth">Date of Birth</Label>
            <Input
              id="date_of_birth"
              type="date"
              value={identityForm.date_of_birth}
              onChange={(e) => setIdentityForm({ ...identityForm, date_of_birth: e.target.value })}
              data-testid="login-dob"
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="space-y-3 pt-2">
        <Button
          onClick={handleRequestOTP}
          disabled={loading || (loginMethod === 'donor_id' ? !donorIdForm.donor_id : !identityForm.identity_type || !identityForm.identity_number || !identityForm.date_of_birth)}
          className="w-full bg-teal-600 hover:bg-teal-700"
          data-testid="request-otp-btn"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending OTP...</>
          ) : (
            <>
              Send OTP
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>

        {loginMethod === 'identity' && identityForm.identity_type && identityForm.identity_number && (
          <Button
            variant="outline"
            onClick={handleCheckStatus}
            className="w-full"
            data-testid="check-status-btn"
          >
            Check Registration Status
          </Button>
        )}
      </div>
    </div>
  );
}
