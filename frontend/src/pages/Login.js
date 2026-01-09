import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { organizationAPI } from '../lib/api';
import { toast } from 'sonner';
import { 
  Droplet, Eye, EyeOff, LogIn, Shield, Building2, 
  ChevronRight, ChevronDown, Search, MapPin, Check, X
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  
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
      await login(loginForm.email, loginForm.password, loginForm.org_id || null);
      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

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
              {/* Organization Selection */}
              {organizations.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="org-select">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Organization
                    </div>
                  </Label>
                  <Select 
                    value={loginForm.org_id} 
                    onValueChange={(value) => setLoginForm({ ...loginForm, org_id: value })}
                  >
                    <SelectTrigger id="org-select" data-testid="org-select">
                      <SelectValue placeholder={loadingOrgs ? "Loading..." : "Select organization (optional for system admin)"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-slate-500">No organization (System Admin)</span>
                      </SelectItem>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          <div className="flex items-center gap-2">
                            <span>{org.org_name}</span>
                            {org.city && (
                              <span className="text-xs text-slate-500">({org.city})</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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
