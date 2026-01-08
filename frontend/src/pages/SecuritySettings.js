import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { securityAPI } from '../lib/api';
import { toast } from 'sonner';
import {
  Shield, Key, Lock, Smartphone, Mail, Clock, AlertTriangle,
  CheckCircle, XCircle, Copy, Eye, EyeOff, RefreshCw,
  Monitor, Trash2, Plus, Settings, Download
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '../components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import SensitiveActionModal from '../components/SensitiveActionModal';

export default function SecuritySettings() {
  const { user, isSystemAdmin, isSuperAdmin } = useAuth();
  const isAdmin = isSystemAdmin() || isSuperAdmin();
  
  const [activeTab, setActiveTab] = useState('mfa');
  const [loading, setLoading] = useState(false);
  
  // MFA State
  const [mfaStatus, setMfaStatus] = useState(null);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  
  // Password Policy State
  const [passwordPolicy, setPasswordPolicy] = useState(null);
  const [editingPolicy, setEditingPolicy] = useState(false);
  const [policyForm, setPolicyForm] = useState({});
  
  // Sessions State
  const [sessions, setSessions] = useState([]);
  const [sessionConfig, setSessionConfig] = useState(null);
  
  // API Keys State
  const [apiKeys, setApiKeys] = useState([]);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyData, setNewKeyData] = useState({
    name: '',
    description: '',
    scopes: ['read'],
    expires_at: '',
    rate_limit_per_minute: 60
  });
  const [createdKey, setCreatedKey] = useState(null);
  const [showKeySecret, setShowKeySecret] = useState(false);
  
  // Sensitive Action State
  const [showSensitiveModal, setShowSensitiveModal] = useState(false);
  const [sensitiveAction, setSensitiveAction] = useState(null);

  useEffect(() => {
    fetchMfaStatus();
    fetchPasswordPolicy();
    fetchSessions();
    if (user?.org_id) {
      fetchApiKeys();
    }
  }, [user]);

  const fetchMfaStatus = async () => {
    try {
      const res = await securityAPI.getMfaStatus();
      setMfaStatus(res.data);
    } catch (error) {
      console.error('Failed to fetch MFA status:', error);
    }
  };

  const fetchPasswordPolicy = async () => {
    try {
      const res = await securityAPI.getPasswordPolicy(user?.org_id);
      setPasswordPolicy(res.data);
      setPolicyForm(res.data);
    } catch (error) {
      console.error('Failed to fetch password policy:', error);
    }
  };

  const fetchSessions = async () => {
    try {
      const [sessionsRes, configRes] = await Promise.all([
        securityAPI.getSessions(),
        securityAPI.getSessionConfig(user?.org_id)
      ]);
      setSessions(sessionsRes.data || []);
      setSessionConfig(configRes.data);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  };

  const fetchApiKeys = async () => {
    if (!user?.org_id) return;
    try {
      const res = await securityAPI.listApiKeys(user.org_id);
      setApiKeys(res.data || []);
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    }
  };

  // MFA Handlers
  const handleSetupMfa = async () => {
    setLoading(true);
    try {
      const res = await securityAPI.setupTotpMfa();
      setMfaSetupData(res.data);
      setShowMfaSetup(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to setup MFA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfa = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }
    
    setLoading(true);
    try {
      await securityAPI.verifyTotpSetup(verificationCode);
      toast.success('MFA enabled successfully!');
      setShowMfaSetup(false);
      setMfaSetupData(null);
      setVerificationCode('');
      fetchMfaStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleDisableMfa = async () => {
    if (!window.confirm('Are you sure you want to disable MFA? This will reduce your account security.')) {
      return;
    }
    
    try {
      await securityAPI.disableMfa();
      toast.success('MFA disabled');
      fetchMfaStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to disable MFA');
    }
  };

  const handleEnableEmailOtp = async () => {
    try {
      await securityAPI.enableEmailOtp();
      toast.success('Email OTP enabled as backup');
      fetchMfaStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to enable email OTP');
    }
  };

  const handleRegenerateBackupCodes = async () => {
    if (!window.confirm('This will invalidate your existing backup codes. Continue?')) {
      return;
    }
    
    try {
      const res = await securityAPI.regenerateBackupCodes();
      setMfaSetupData({ ...mfaSetupData, backup_codes: res.data.backup_codes });
      setShowBackupCodes(true);
      toast.success('New backup codes generated');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to regenerate codes');
    }
  };

  // Password Policy Handlers
  const handleUpdatePolicy = async () => {
    // Require verification for security settings changes
    setSensitiveAction('update_password_policy');
    setShowSensitiveModal(true);
  };

  const executeUpdatePolicy = async () => {
    setLoading(true);
    try {
      await securityAPI.updatePasswordPolicy(policyForm, isSystemAdmin() ? null : user?.org_id);
      toast.success('Password policy updated');
      setEditingPolicy(false);
      fetchPasswordPolicy();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update policy');
    } finally {
      setLoading(false);
    }
  };

  const handleSensitiveActionVerified = async (verificationToken) => {
    if (sensitiveAction === 'update_password_policy') {
      await executeUpdatePolicy();
    }
    setSensitiveAction(null);
  };

  // Session Handlers
  const handleRevokeSession = async (sessionId) => {
    try {
      await securityAPI.revokeSession(sessionId);
      toast.success('Session revoked');
      fetchSessions();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to revoke session');
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!window.confirm('This will log you out from all other devices. Continue?')) {
      return;
    }
    
    try {
      await securityAPI.revokeAllSessions(true);
      toast.success('All other sessions revoked');
      fetchSessions();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to revoke sessions');
    }
  };

  // API Key Handlers
  const handleCreateApiKey = async () => {
    if (!newKeyData.name) {
      toast.error('Please enter a key name');
      return;
    }
    
    setLoading(true);
    try {
      const res = await securityAPI.createApiKey(user.org_id, newKeyData);
      setCreatedKey(res.data);
      setShowCreateKey(false);
      setNewKeyData({ name: '', description: '', scopes: ['read'], expires_at: '', rate_limit_per_minute: 60 });
      fetchApiKeys();
      toast.success('API key created');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create API key');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeApiKey = async (keyId) => {
    if (!window.confirm('This will permanently revoke this API key. Continue?')) {
      return;
    }
    
    try {
      await securityAPI.revokeApiKey(keyId, user.org_id);
      toast.success('API key revoked');
      fetchApiKeys();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to revoke API key');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6" data-testid="security-settings">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-teal-600" />
            Security Settings
          </h1>
          <p className="text-slate-500">Manage your account security and access controls</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="mfa">
            <Smartphone className="w-4 h-4 mr-1" />
            MFA
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <Monitor className="w-4 h-4 mr-1" />
            Sessions
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="password-policy">
              <Lock className="w-4 h-4 mr-1" />
              Password Policy
            </TabsTrigger>
          )}
          {user?.org_id && (
            <TabsTrigger value="api-keys">
              <Key className="w-4 h-4 mr-1" />
              API Keys
            </TabsTrigger>
          )}
        </TabsList>

        {/* MFA Tab */}
        <TabsContent value="mfa" className="mt-4">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5" />
                    Two-Factor Authentication
                  </span>
                  {mfaStatus?.status === 'enabled' ? (
                    <Badge className="bg-green-100 text-green-700">Enabled</Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-600">Disabled</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Add an extra layer of security to your account using an authenticator app
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {mfaStatus?.status === 'enabled' ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-green-50 rounded-lg">
                      <CheckCircle className="w-8 h-8 text-green-600" />
                      <div>
                        <p className="font-medium text-green-800">MFA is Active</p>
                        <p className="text-sm text-green-600">
                          Your account is protected with two-factor authentication
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium">Backup Codes Remaining</p>
                        <p className="text-sm text-slate-500">
                          {mfaStatus.backup_codes_remaining} codes available
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleRegenerateBackupCodes}>
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Regenerate
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium">Email OTP Backup</p>
                        <p className="text-sm text-slate-500">
                          {mfaStatus.email_otp_enabled ? 'Enabled' : 'Disabled'} - Use email as backup method
                        </p>
                      </div>
                      {!mfaStatus.email_otp_enabled && (
                        <Button variant="outline" size="sm" onClick={handleEnableEmailOtp}>
                          <Mail className="w-4 h-4 mr-1" />
                          Enable
                        </Button>
                      )}
                    </div>

                    <Button variant="destructive" onClick={handleDisableMfa} className="mt-4">
                      <XCircle className="w-4 h-4 mr-1" />
                      Disable MFA
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-lg">
                      <AlertTriangle className="w-8 h-8 text-amber-600" />
                      <div>
                        <p className="font-medium text-amber-800">MFA is Not Enabled</p>
                        <p className="text-sm text-amber-600">
                          Enable two-factor authentication for better security
                        </p>
                      </div>
                    </div>
                    
                    <Button onClick={handleSetupMfa} disabled={loading} data-testid="setup-mfa-btn">
                      <Smartphone className="w-4 h-4 mr-1" />
                      {loading ? 'Setting up...' : 'Setup MFA'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="w-5 h-5" />
                  Active Sessions
                </CardTitle>
                <CardDescription>Manage your active login sessions</CardDescription>
              </div>
              <Button variant="outline" onClick={handleRevokeAllSessions}>
                <Trash2 className="w-4 h-4 mr-1" />
                Revoke All Others
              </Button>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No active sessions found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Monitor className="w-4 h-4 text-slate-400" />
                            <div>
                              <p className="font-medium">{session.device_info || 'Unknown Device'}</p>
                              {session.is_current && (
                                <Badge className="bg-green-100 text-green-700 text-xs">Current</Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{session.ip_address || '-'}</TableCell>
                        <TableCell>{formatDate(session.last_activity)}</TableCell>
                        <TableCell>
                          {!session.is_current && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500"
                              onClick={() => handleRevokeSession(session.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Password Policy Tab */}
        {isAdmin && (
          <TabsContent value="password-policy" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    Password Policy
                  </CardTitle>
                  <CardDescription>
                    {isSystemAdmin() ? 'System-wide password requirements' : 'Organization password requirements'}
                  </CardDescription>
                </div>
                {!editingPolicy ? (
                  <Button onClick={() => setEditingPolicy(true)}>
                    <Settings className="w-4 h-4 mr-1" />
                    Edit Policy
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setEditingPolicy(false); setPolicyForm(passwordPolicy); }}>
                      Cancel
                    </Button>
                    <Button onClick={handleUpdatePolicy} disabled={loading}>
                      Save Changes
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {passwordPolicy && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <Label>Minimum Length</Label>
                        {editingPolicy ? (
                          <Input
                            type="number"
                            className="w-20"
                            value={policyForm.min_length}
                            onChange={(e) => setPolicyForm({ ...policyForm, min_length: parseInt(e.target.value) })}
                          />
                        ) : (
                          <span className="font-medium">{passwordPolicy.min_length} characters</span>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <Label>Require Uppercase</Label>
                        {editingPolicy ? (
                          <Switch
                            checked={policyForm.require_uppercase}
                            onCheckedChange={(v) => setPolicyForm({ ...policyForm, require_uppercase: v })}
                          />
                        ) : (
                          <Badge className={passwordPolicy.require_uppercase ? 'bg-green-100 text-green-700' : 'bg-slate-100'}>
                            {passwordPolicy.require_uppercase ? 'Yes' : 'No'}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <Label>Require Lowercase</Label>
                        {editingPolicy ? (
                          <Switch
                            checked={policyForm.require_lowercase}
                            onCheckedChange={(v) => setPolicyForm({ ...policyForm, require_lowercase: v })}
                          />
                        ) : (
                          <Badge className={passwordPolicy.require_lowercase ? 'bg-green-100 text-green-700' : 'bg-slate-100'}>
                            {passwordPolicy.require_lowercase ? 'Yes' : 'No'}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <Label>Require Numbers</Label>
                        {editingPolicy ? (
                          <Switch
                            checked={policyForm.require_numbers}
                            onCheckedChange={(v) => setPolicyForm({ ...policyForm, require_numbers: v })}
                          />
                        ) : (
                          <Badge className={passwordPolicy.require_numbers ? 'bg-green-100 text-green-700' : 'bg-slate-100'}>
                            {passwordPolicy.require_numbers ? 'Yes' : 'No'}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <Label>Require Special Characters</Label>
                        {editingPolicy ? (
                          <Switch
                            checked={policyForm.require_special_chars}
                            onCheckedChange={(v) => setPolicyForm({ ...policyForm, require_special_chars: v })}
                          />
                        ) : (
                          <Badge className={passwordPolicy.require_special_chars ? 'bg-green-100 text-green-700' : 'bg-slate-100'}>
                            {passwordPolicy.require_special_chars ? 'Yes' : 'No'}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <Label>Password Expires After</Label>
                        {editingPolicy ? (
                          <Input
                            type="number"
                            className="w-20"
                            value={policyForm.max_age_days || ''}
                            onChange={(e) => setPolicyForm({ ...policyForm, max_age_days: e.target.value ? parseInt(e.target.value) : null })}
                            placeholder="Never"
                          />
                        ) : (
                          <span className="font-medium">
                            {passwordPolicy.max_age_days ? `${passwordPolicy.max_age_days} days` : 'Never'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <Label>Max Failed Attempts</Label>
                        {editingPolicy ? (
                          <Input
                            type="number"
                            className="w-20"
                            value={policyForm.max_failed_attempts}
                            onChange={(e) => setPolicyForm({ ...policyForm, max_failed_attempts: parseInt(e.target.value) })}
                          />
                        ) : (
                          <span className="font-medium">{passwordPolicy.max_failed_attempts} attempts</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <Label>Lockout Duration</Label>
                        {editingPolicy ? (
                          <Input
                            type="number"
                            className="w-20"
                            value={policyForm.lockout_duration_minutes}
                            onChange={(e) => setPolicyForm({ ...policyForm, lockout_duration_minutes: parseInt(e.target.value) })}
                          />
                        ) : (
                          <span className="font-medium">{passwordPolicy.lockout_duration_minutes} minutes</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* API Keys Tab */}
        {user?.org_id && (
          <TabsContent value="api-keys" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="w-5 h-5" />
                    API Keys
                  </CardTitle>
                  <CardDescription>Manage API keys for external integrations</CardDescription>
                </div>
                {isAdmin && (
                  <Button onClick={() => setShowCreateKey(true)} data-testid="create-api-key-btn">
                    <Plus className="w-4 h-4 mr-1" />
                    Create API Key
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {apiKeys.length === 0 ? (
                  <div className="text-center py-8">
                    <Key className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500">No API keys created yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Key Prefix</TableHead>
                        <TableHead>Scopes</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Last Used</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apiKeys.map((key) => (
                        <TableRow key={key.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{key.name}</p>
                              {key.description && (
                                <p className="text-xs text-slate-400">{key.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="bg-slate-100 px-2 py-1 rounded text-sm">
                              {key.key_prefix}...
                            </code>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {key.scopes?.map((scope) => (
                                <Badge key={scope} variant="outline" className="text-xs">
                                  {scope}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>{formatDate(key.created_at)}</TableCell>
                          <TableCell>{key.last_used_at ? formatDate(key.last_used_at) : 'Never'}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500"
                              onClick={() => handleRevokeApiKey(key.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* MFA Setup Dialog */}
      <Dialog open={showMfaSetup} onOpenChange={setShowMfaSetup}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Setup Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app
            </DialogDescription>
          </DialogHeader>
          {mfaSetupData && (
            <div className="space-y-3">
              <div className="flex justify-center">
                <img src={mfaSetupData.qr_code_uri} alt="MFA QR Code" className="border rounded-lg w-40 h-40" />
              </div>
              
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">Or enter manually:</p>
                <div className="flex items-center justify-center gap-2">
                  <code className="bg-slate-100 px-2 py-1 rounded font-mono text-xs break-all">
                    {mfaSetupData.secret}
                  </code>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(mfaSetupData.secret)}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-sm">Enter verification code</Label>
                <Input
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-lg tracking-widest"
                  data-testid="mfa-code-input"
                />
              </div>

              <div className="bg-amber-50 p-2 rounded-lg">
                <p className="text-xs font-medium text-amber-800 mb-1">Save your backup codes</p>
                <div className="grid grid-cols-5 gap-1 text-xs font-mono">
                  {mfaSetupData.backup_codes?.map((code, idx) => (
                    <div key={idx} className="bg-white px-1 py-0.5 rounded text-center">{code}</div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full text-xs h-7"
                  onClick={() => copyToClipboard(mfaSetupData.backup_codes.join('\n'))}
                >
                  <Download className="w-3 h-3 mr-1" />
                  Copy All Codes
                </Button>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowMfaSetup(false)}>Cancel</Button>
            <Button size="sm" onClick={handleVerifyMfa} disabled={loading || verificationCode.length !== 6}>
              {loading ? 'Verifying...' : 'Enable MFA'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create API Key Dialog */}
      <Dialog open={showCreateKey} onOpenChange={setShowCreateKey}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>Generate a new API key for external integrations</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Key Name *</Label>
              <Input
                value={newKeyData.name}
                onChange={(e) => setNewKeyData({ ...newKeyData, name: e.target.value })}
                placeholder="e.g., Production Integration"
                data-testid="api-key-name-input"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newKeyData.description}
                onChange={(e) => setNewKeyData({ ...newKeyData, description: e.target.value })}
                placeholder="Optional description..."
                rows={2}
              />
            </div>
            <div>
              <Label>Scopes</Label>
              <Select
                value={newKeyData.scopes[0]}
                onValueChange={(v) => setNewKeyData({ ...newKeyData, scopes: [v] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Read Only</SelectItem>
                  <SelectItem value="write">Read & Write</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Expires (optional)</Label>
              <Input
                type="date"
                value={newKeyData.expires_at}
                onChange={(e) => setNewKeyData({ ...newKeyData, expires_at: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateKey(false)}>Cancel</Button>
            <Button onClick={handleCreateApiKey} disabled={loading || !newKeyData.name}>
              Create Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Created API Key Dialog */}
      <Dialog open={!!createdKey} onOpenChange={() => setCreatedKey(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>
              Copy your API key now. You won't be able to see it again!
            </DialogDescription>
          </DialogHeader>
          {createdKey && (
            <div className="space-y-4">
              <div className="bg-amber-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Label>API Key</Label>
                  <Button variant="ghost" size="sm" onClick={() => setShowKeySecret(!showKeySecret)}>
                    {showKeySecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                <code className="block bg-white p-3 rounded font-mono text-sm break-all">
                  {showKeySecret ? createdKey.key : '•'.repeat(40)}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => copyToClipboard(createdKey.key)}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy to Clipboard
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCreatedKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sensitive Action Verification Modal */}
      <SensitiveActionModal
        open={showSensitiveModal}
        onOpenChange={setShowSensitiveModal}
        actionType={sensitiveAction}
        actionTitle="Update Security Settings"
        actionDescription="You are about to modify security settings. This change will affect all users in your organization."
        onVerified={handleSensitiveActionVerified}
        onCancel={() => setSensitiveAction(null)}
      />
    </div>
  );
}
