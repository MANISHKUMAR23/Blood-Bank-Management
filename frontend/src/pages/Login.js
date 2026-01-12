import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { organizationAPI, authAPI } from '../lib/api';
import { toast } from 'sonner';
import { 
  Droplet, Eye, EyeOff, LogIn, Shield, Building2, 
  ChevronRight, ChevronDown, Search, MapPin, Check, X, KeyRound
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../components/ui/input-otp';

export default function Login() {
  const navigate = useNavigate();
  const { login, setAuthData } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  
  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaUser, setMfaUser] = useState(null);
  const [useBackupCode, setUseBackupCode] = useState(false);
  
  // Organization selector state
  const [showOrgSelector, setShowOrgSelector] = useState(false);
  const [orgSearchTerm, setOrgSearchTerm] = useState('');
  const [expandedOrgs, setExpandedOrgs] = useState(new Set());
  const [selectedOrg, setSelectedOrg] = useState(null);
  
  const [loginForm, setLoginForm] = useState({ email: '', password: '', org_id: '' });

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const res = await organizationAPI.getPublicOrgs();
      setOrganizations(res.data);
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setLoadingOrgs(false);
    }
  };

  // Build hierarchical tree from flat org list
  const orgTree = useMemo(() => {
    const parentOrgs = organizations.filter(o => o.is_parent || !o.parent_org_id);
    const branchMap = {};
    
    organizations.forEach(org => {
      if (org.parent_org_id) {
        if (!branchMap[org.parent_org_id]) {
          branchMap[org.parent_org_id] = [];
        }
        branchMap[org.parent_org_id].push(org);
      }
    });
    
    return parentOrgs.map(parent => ({
      ...parent,
      branches: branchMap[parent.id] || []
    }));
  }, [organizations]);

  // Filter organizations based on search
  const filteredOrgTree = useMemo(() => {
    if (!orgSearchTerm) return orgTree;
    
    const term = orgSearchTerm.toLowerCase();
    return orgTree.filter(org => {
      const orgMatches = org.org_name?.toLowerCase().includes(term) ||
                        org.city?.toLowerCase().includes(term);
      const branchMatches = org.branches?.some(b => 
        b.org_name?.toLowerCase().includes(term) || 
        b.city?.toLowerCase().includes(term)
      );
      return orgMatches || branchMatches;
    }).map(org => ({
      ...org,
      branches: org.branches?.filter(b =>
        b.org_name?.toLowerCase().includes(term) ||
        b.city?.toLowerCase().includes(term) ||
        org.org_name?.toLowerCase().includes(term)
      ) || []
    }));
  }, [orgTree, orgSearchTerm]);

  // Auto-expand when searching
  useEffect(() => {
    if (orgSearchTerm) {
      setExpandedOrgs(new Set(filteredOrgTree.map(o => o.id)));
    }
  }, [orgSearchTerm, filteredOrgTree]);

  const toggleExpand = (orgId, e) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedOrgs);
    if (newExpanded.has(orgId)) {
      newExpanded.delete(orgId);
    } else {
      newExpanded.add(orgId);
    }
    setExpandedOrgs(newExpanded);
  };

  const selectOrganization = (org) => {
    setSelectedOrg(org);
    setLoginForm({ ...loginForm, org_id: org.id });
    setShowOrgSelector(false);
    setOrgSearchTerm('');
  };

  const clearSelection = () => {
    setSelectedOrg(null);
    setLoginForm({ ...loginForm, org_id: '' });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await authAPI.login({
        email: loginForm.email,
        password: loginForm.password,
        org_id: loginForm.org_id || null
      });
      
      // Check if MFA is required
      if (response.data.mfa_required) {
        setMfaRequired(true);
        setMfaToken(response.data.mfa_token);
        setMfaUser(response.data.user);
        toast.info('Please enter your MFA code to continue');
      } else {
        // No MFA required - complete login
        const { token, user } = response.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        if (setAuthData) {
          setAuthData({ token, user });
        }
        toast.success('Login successful!');
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaVerify = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await authAPI.verifyMfaLogin({
        mfa_token: mfaToken,
        mfa_code: mfaCode,
        mfa_method: useBackupCode ? 'backup_code' : 'totp'
      });
      
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      if (setAuthData) {
        setAuthData({ token, user });
      }
      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid MFA code');
      setMfaCode('');
    } finally {
      setIsLoading(false);
    }
  };

  const resetMfaFlow = () => {
    setMfaRequired(false);
    setMfaToken('');
    setMfaCode('');
    setMfaUser(null);
    setUseBackupCode(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showOrgSelector && !e.target.closest('[data-org-selector]')) {
        setShowOrgSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOrgSelector]);

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Image */}
      <div 
        className="hidden lg:flex lg:w-1/2 relative bg-cover bg-center"
        style={{ 
          backgroundImage: 'url(https://images.unsplash.com/photo-1616996691604-26dfd478cbbc?crop=entropy&cs=srgb&fm=jpg&q=85)'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-900/90 to-slate-800/50" />
        <div className="relative z-10 flex flex-col justify-center p-12 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
              <Droplet className="w-7 h-7 text-white" />
            </div>
            <span className="text-3xl font-bold">BloodLink</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">
            Blood Bank Management System
          </h1>
          <p className="text-lg text-slate-300 max-w-md">
            Comprehensive solution for managing blood bank operations from donor registration to blood unit distribution.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-3xl font-bold text-teal-400">99.9%</p>
              <p className="text-sm text-slate-300">Traceability</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-3xl font-bold text-teal-400">24/7</p>
              <p className="text-sm text-slate-300">Monitoring</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form Only */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-900">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4 lg:hidden">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                <Droplet className="w-7 h-7 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">Staff Portal</CardTitle>
            <CardDescription>
              Sign in to access the Blood Bank Management System
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Organization Selection - Hierarchical Dropdown */}
              <div className="space-y-2">
                <Label>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Organization
                  </div>
                </Label>
                
                <div className="relative" data-org-selector>
                  {/* Selected Org Display / Trigger */}
                  <div
                    onClick={() => setShowOrgSelector(!showOrgSelector)}
                    className="w-full flex items-center justify-between px-3 py-2 border rounded-md cursor-pointer hover:border-teal-400 transition-colors bg-white"
                    data-testid="org-select"
                  >
                    {selectedOrg ? (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${
                          selectedOrg.is_parent || !selectedOrg.parent_org_id 
                            ? 'bg-blue-500' 
                            : 'bg-emerald-500'
                        }`}>
                          <Building2 className="w-3 h-3 text-white" />
                        </div>
                        <span className="truncate font-medium">{selectedOrg.org_name}</span>
                        {selectedOrg.city && (
                          <span className="text-xs text-slate-500">({selectedOrg.city})</span>
                        )}
                        {selectedOrg.parent_org_id && (
                          <Badge variant="outline" className="text-xs">Branch</Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-500">
                        {loadingOrgs ? "Loading organizations..." : "Select organization (optional for System Admin)"}
                      </span>
                    )}
                    <div className="flex items-center gap-1">
                      {selectedOrg && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); clearSelection(); }}
                          className="p-1 hover:bg-slate-100 rounded"
                        >
                          <X className="w-4 h-4 text-slate-400" />
                        </button>
                      )}
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showOrgSelector ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {/* Dropdown Panel */}
                  {showOrgSelector && (
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg overflow-hidden">
                      {/* Search */}
                      <div className="p-2 border-b">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            placeholder="Search organizations..."
                            value={orgSearchTerm}
                            onChange={(e) => setOrgSearchTerm(e.target.value)}
                            className="pl-9 h-9"
                            autoFocus
                          />
                        </div>
                      </div>

                      {/* System Admin Option */}
                      <div
                        onClick={() => { clearSelection(); setShowOrgSelector(false); }}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b"
                      >
                        <div className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center">
                          <Shield className="w-3 h-3 text-slate-600" />
                        </div>
                        <span className="text-slate-600">No organization (System Admin)</span>
                      </div>

                      {/* Organizations Tree - Scrollable */}
                      <div className="max-h-64 overflow-y-auto">
                        {loadingOrgs ? (
                          <div className="p-4 text-center text-slate-500">Loading...</div>
                        ) : filteredOrgTree.length === 0 ? (
                          <div className="p-4 text-center text-slate-500">No organizations found</div>
                        ) : (
                          <div className="py-1">
                            {filteredOrgTree.map((org) => (
                              <div key={org.id}>
                                {/* Parent Organization */}
                                <div
                                  className={`flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer ${
                                    selectedOrg?.id === org.id ? 'bg-teal-50' : ''
                                  }`}
                                >
                                  {/* Expand Button */}
                                  {org.branches && org.branches.length > 0 ? (
                                    <button
                                      type="button"
                                      onClick={(e) => toggleExpand(org.id, e)}
                                      className="p-0.5 hover:bg-slate-200 rounded"
                                    >
                                      {expandedOrgs.has(org.id) ? (
                                        <ChevronDown className="w-4 h-4 text-slate-500" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-slate-500" />
                                      )}
                                    </button>
                                  ) : (
                                    <div className="w-5" />
                                  )}

                                  {/* Org Details */}
                                  <div 
                                    className="flex items-center gap-2 flex-1"
                                    onClick={() => selectOrganization(org)}
                                  >
                                    <div className="w-7 h-7 rounded bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                                      <Building2 className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-slate-900 truncate">{org.org_name}</div>
                                      {org.city && (
                                        <div className="flex items-center gap-1 text-xs text-slate-500">
                                          <MapPin className="w-3 h-3" />
                                          {org.city}
                                        </div>
                                      )}
                                    </div>
                                    {org.branches && org.branches.length > 0 && (
                                      <Badge variant="outline" className="text-xs">
                                        {org.branches.length} branches
                                      </Badge>
                                    )}
                                    {selectedOrg?.id === org.id && (
                                      <Check className="w-4 h-4 text-teal-600" />
                                    )}
                                  </div>
                                </div>

                                {/* Branches */}
                                {expandedOrgs.has(org.id) && org.branches && org.branches.length > 0 && (
                                  <div className="bg-slate-50">
                                    {org.branches.map((branch) => (
                                      <div
                                        key={branch.id}
                                        onClick={() => selectOrganization(branch)}
                                        className={`flex items-center gap-2 px-3 py-2 pl-10 hover:bg-slate-100 cursor-pointer ${
                                          selectedOrg?.id === branch.id ? 'bg-teal-50' : ''
                                        }`}
                                      >
                                        <div className="w-6 h-6 rounded bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                                          <Building2 className="w-3 h-3 text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium text-sm text-slate-800 truncate">{branch.org_name}</div>
                                          {branch.city && (
                                            <div className="flex items-center gap-1 text-xs text-slate-500">
                                              <MapPin className="w-3 h-3" />
                                              {branch.city}
                                            </div>
                                          )}
                                        </div>
                                        {selectedOrg?.id === branch.id && (
                                          <Check className="w-4 h-4 text-teal-600" />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="Enter your email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  required
                  data-testid="login-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    required
                    data-testid="login-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full bg-teal-600 hover:bg-teal-700"
                disabled={isLoading}
                data-testid="login-submit"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : (
                  <LogIn className="w-4 h-4 mr-2" />
                )}
                Sign In
              </Button>
            </form>
            
            {/* Security Notice */}
            <div className="mt-6 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-teal-600 mt-0.5" />
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  <p className="font-medium text-slate-700 dark:text-slate-300">Secure Access</p>
                  <p className="mt-1">
                    Staff accounts are created by administrators only. Contact your system administrator if you need access.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Donor Portal Link */}
            <div className="mt-4 text-center">
              <p className="text-sm text-slate-500">
                Are you a donor?{' '}
                <a href="/donor" className="text-teal-600 hover:underline font-medium">
                  Go to Donor Portal
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
