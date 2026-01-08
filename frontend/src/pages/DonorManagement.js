import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { donorAPI, donationSessionAPI, organizationAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { 
  Plus, Search, Filter, Eye, UserCheck, UserX, Clipboard, Droplet, 
  RefreshCw, Users, CheckCircle, XCircle, Clock, Ban, Activity,
  Building2, MapPin
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ScrollArea } from '../components/ui/scroll-area';

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Status badge configurations
const STATUS_CONFIG = {
  eligible: { bg: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  deactivated: { bg: 'bg-slate-100 text-slate-500', icon: Ban },
  deferred: { bg: 'bg-red-100 text-red-700', icon: XCircle },
  not_eligible: { bg: 'bg-amber-100 text-amber-700', icon: Clock },
  age_restriction: { bg: 'bg-orange-100 text-orange-700', icon: UserX },
  in_progress: { bg: 'bg-blue-100 text-blue-700', icon: Activity },
};

export default function DonorManagement() {
  const navigate = useNavigate();
  const { isSystemAdmin } = useAuth();
  const [donors, setDonors] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('active'); // active, deactivated, all
  const [eligibilityFilter, setEligibilityFilter] = useState('all'); // all, eligible, not_eligible
  const [bloodGroupFilter, setBloodGroupFilter] = useState('all');
  const [orgFilter, setOrgFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchDonors();
  }, [activeFilter, eligibilityFilter, bloodGroupFilter, orgFilter, branchFilter]);

  const fetchData = async () => {
    try {
      const [donorsRes, orgsRes] = await Promise.all([
        donorAPI.getDonorsWithStatus({ is_active: activeFilter }),
        organizationAPI.getAll()
      ]);
      setDonors(donorsRes.data || []);
      setOrganizations(orgsRes.data || []);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const fetchDonors = async () => {
    setLoading(true);
    try {
      const params = {
        is_active: activeFilter,
        filter_status: eligibilityFilter !== 'all' ? eligibilityFilter : undefined,
        blood_group: bloodGroupFilter !== 'all' ? bloodGroupFilter : undefined,
        search: search || undefined,
      };
      
      const response = await donorAPI.getDonorsWithStatus(params);
      setDonors(response.data || []);
    } catch (error) {
      toast.error('Failed to fetch donors');
    } finally {
      setLoading(false);
    }
  };

  // Separate parent orgs and branches
  const parentOrgs = useMemo(() => {
    return organizations.filter(o => o.is_parent);
  }, [organizations]);

  const branches = useMemo(() => {
    if (orgFilter === 'all') return [];
    return organizations.filter(o => o.parent_org_id === orgFilter);
  }, [organizations, orgFilter]);

  // Get org/branch name by ID
  const getOrgName = (orgId) => {
    const org = organizations.find(o => o.id === orgId);
    return org?.org_name || '-';
  };

  // Check if org is a branch
  const getOrgType = (orgId) => {
    const org = organizations.find(o => o.id === orgId);
    return org?.is_parent ? 'org' : 'branch';
  };

  const handleSearch = () => {
    fetchDonors();
  };

  const handleStartScreening = async (donor) => {
    if (donor.eligibility_status !== 'eligible') {
      toast.error(donor.eligibility_reason || 'Donor is not eligible');
      return;
    }
    
    setActionLoading(donor.id);
    try {
      const response = await donationSessionAPI.create(donor.id);
      toast.success(`Session started: ${response.data.session_id}`);
      navigate(`/screening?donor=${donor.id}&session=${response.data.session_id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start screening');
    } finally {
      setActionLoading(null);
    }
  };

  // Filter donors by search and org/branch
  const filteredDonors = useMemo(() => {
    return donors.filter(donor => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch = (
          donor.full_name?.toLowerCase().includes(searchLower) ||
          donor.donor_id?.toLowerCase().includes(searchLower) ||
          donor.phone?.includes(search)
        );
        if (!matchesSearch) return false;
      }
      
      // Org filter
      if (orgFilter !== 'all') {
        const donorOrg = organizations.find(o => o.id === donor.org_id);
        // Check if donor belongs to the selected org or its branches
        if (donor.org_id !== orgFilter && donorOrg?.parent_org_id !== orgFilter) {
          return false;
        }
      }
      
      // Branch filter
      if (branchFilter !== 'all' && donor.org_id !== branchFilter) {
        return false;
      }
      
      return true;
    });
  }, [donors, search, orgFilter, branchFilter, organizations]);

  // Count statistics
  const stats = {
    total: donors.length,
    eligible: donors.filter(d => d.eligibility_status === 'eligible').length,
    active: donors.filter(d => d.is_active !== false).length,
    deactivated: donors.filter(d => d.is_active === false).length,
  };

  const renderStatusBadge = (status) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.not_eligible;
    const Icon = config.icon;
    return (
      <Badge className={config.bg}>
        <Icon className="w-3 h-3 mr-1" />
        {status?.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="donor-management">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Donor Management</h1>
          <p className="page-subtitle">Register and manage blood donors</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchDonors} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            onClick={() => navigate('/donors/register')}
            className="bg-teal-600 hover:bg-teal-700"
            data-testid="register-donor-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Register New Donor
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Donors</p>
                <p className="text-2xl font-bold text-slate-700">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                <Users className="w-6 h-6 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600">Eligible</p>
                <p className="text-2xl font-bold text-emerald-700">{stats.eligible}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-200 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-teal-50 to-teal-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-teal-600">Active</p>
                <p className="text-2xl font-bold text-teal-700">{stats.active}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-teal-200 flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-teal-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-50 to-red-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">Deactivated</p>
                <p className="text-2xl font-bold text-red-700">{stats.deactivated}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-200 flex items-center justify-center">
                <Ban className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by ID, name, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9"
              data-testid="search-input"
            />
          </div>
          
          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger className="w-[140px]" data-testid="active-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="deactivated">Deactivated</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={eligibilityFilter} onValueChange={setEligibilityFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Eligibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Eligibility</SelectItem>
              <SelectItem value="eligible">Eligible Only</SelectItem>
              <SelectItem value="not_eligible">Not Eligible</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={bloodGroupFilter} onValueChange={setBloodGroupFilter}>
            <SelectTrigger className="w-[130px]" data-testid="blood-group-filter">
              <SelectValue placeholder="Blood Group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Blood</SelectItem>
              {bloodGroups.map(bg => (
                <SelectItem key={bg} value={bg}>{bg}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isSystemAdmin && isSystemAdmin() && (
            <>
              <Select value={orgFilter} onValueChange={(v) => { setOrgFilter(v); setBranchFilter('all'); }}>
                <SelectTrigger className="w-[180px]" data-testid="org-filter">
                  <SelectValue placeholder="Organization" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizations</SelectItem>
                  {parentOrgs.map(org => (
                    <SelectItem key={org.id} value={org.id}>{org.org_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {branches.length > 0 && (
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger className="w-[160px]" data-testid="branch-filter">
                    <SelectValue placeholder="Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map(branch => (
                      <SelectItem key={branch.id} value={branch.id}>{branch.org_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </>
          )}
          
          <Button onClick={handleSearch} disabled={loading}>
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>
        </div>
      </Card>

      {/* Donor Table */}
      <Card>
        <CardHeader>
          <CardTitle>Donors ({filteredDonors.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : filteredDonors.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p>No donors found</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Donor ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Blood Group</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Donations</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDonors.map((donor) => (
                    <TableRow key={donor.id} className={donor.is_active === false ? 'opacity-60' : ''}>
                      <TableCell className="font-mono text-sm">{donor.donor_id}</TableCell>
                      <TableCell className="font-medium">{donor.full_name}</TableCell>
                      <TableCell>
                        <span className={`text-sm ${donor.age < 18 || donor.age > 65 ? 'text-red-600 font-medium' : ''}`}>
                          {donor.age} yrs
                        </span>
                      </TableCell>
                      <TableCell>
                        {donor.blood_group ? (
                          <span className="blood-group-badge">{donor.blood_group}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          {getOrgType(donor.org_id) === 'branch' ? (
                            <MapPin className="w-3 h-3 text-slate-400" />
                          ) : (
                            <Building2 className="w-3 h-3 text-slate-400" />
                          )}
                          <span className="truncate max-w-[120px]" title={getOrgName(donor.org_id)}>
                            {getOrgName(donor.org_id)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{donor.phone}</TableCell>
                      <TableCell>
                        {renderStatusBadge(donor.eligibility_status)}
                      </TableCell>
                      <TableCell className="text-center">{donor.total_donations || 0}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {/* Start Screening */}
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Start Screening"
                            onClick={() => handleStartScreening(donor)}
                            disabled={donor.eligibility_status !== 'eligible' || actionLoading === donor.id}
                            className={donor.eligibility_status === 'eligible' ? 'text-teal-600 hover:text-teal-700 hover:bg-teal-50' : ''}
                          >
                            {actionLoading === donor.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Clipboard className="w-4 h-4" />
                            )}
                          </Button>
                          
                          {/* View Details */}
                          <Button
                            size="sm"
                            variant="ghost"
                            title="View Details"
                            onClick={() => navigate(`/donors/${donor.donor_id}`)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
