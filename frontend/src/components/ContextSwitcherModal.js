import React, { useState, useEffect, useMemo } from 'react';
import { sessionAPI } from '../lib/api';
import { toast } from 'sonner';
import {
  Building2, ChevronRight, ChevronDown, Search, Globe,
  ArrowRightLeft, Loader2, MapPin, Users
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';

export default function ContextSwitcherModal({ open, onOpenChange, onSwitch, currentContext }) {
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [treeData, setTreeData] = useState(null);
  const [expandedOrgs, setExpandedOrgs] = useState(new Set());

  useEffect(() => {
    if (open) {
      fetchContextTree();
    }
  }, [open]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (open) {
        fetchContextTree(searchTerm);
      }
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, open]);

  const fetchContextTree = async (search = '') => {
    setLoading(true);
    try {
      const res = await sessionAPI.getContextTree(search || undefined);
      setTreeData(res.data);
      // Auto-expand all orgs when searching
      if (search) {
        const allOrgIds = res.data.organizations?.map(o => o.id) || [];
        setExpandedOrgs(new Set(allOrgIds));
      }
    } catch (error) {
      console.error('Failed to fetch context tree:', error);
      toast.error('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (orgId) => {
    const newExpanded = new Set(expandedOrgs);
    if (newExpanded.has(orgId)) {
      newExpanded.delete(orgId);
    } else {
      newExpanded.add(orgId);
    }
    setExpandedOrgs(newExpanded);
  };

  const handleSwitch = async (orgId, switchAs, orgName) => {
    setSwitching(orgId);
    try {
      await onSwitch(orgId, switchAs);
      toast.success(`Switched to ${orgName}`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to switch context');
    } finally {
      setSwitching(null);
    }
  };

  const filteredOrgs = useMemo(() => {
    if (!treeData?.organizations) return [];
    if (!searchTerm) return treeData.organizations;
    
    const term = searchTerm.toLowerCase();
    return treeData.organizations.filter(org => {
      const orgMatches = org.name.toLowerCase().includes(term) ||
                        org.city?.toLowerCase().includes(term);
      const branchMatches = org.branches?.some(b => 
        b.name.toLowerCase().includes(term) || 
        b.city?.toLowerCase().includes(term)
      );
      return orgMatches || branchMatches;
    });
  }, [treeData, searchTerm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-teal-600" />
            Switch Context
          </DialogTitle>
          <DialogDescription>
            Select an organization or branch to switch your working context
          </DialogDescription>
        </DialogHeader>

        {/* Search Bar */}
        <div className="relative flex-shrink-0">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search organizations or branches..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="context-search-input"
          />
        </div>

        {/* Stats */}
        {treeData && (
          <div className="flex items-center gap-4 text-sm text-slate-500 py-1 flex-shrink-0">
            <span className="flex items-center gap-1">
              <Building2 className="w-4 h-4" />
              {treeData.total_orgs} organizations
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {treeData.total_branches} branches
            </span>
          </div>
        )}

        {/* Tree View - Scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
            </div>
          ) : filteredOrgs.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No organizations found</p>
            </div>
          ) : (
            <div className="space-y-1 pr-2">
              {filteredOrgs.map((org) => (
                <div key={org.id} className="rounded-lg border border-slate-200 overflow-hidden">
                  {/* Organization Row */}
                  <div 
                    className={`flex items-center gap-2 p-3 bg-white hover:bg-slate-50 ${
                      org.is_current ? 'bg-teal-50' : ''
                    }`}
                  >
                    {/* Expand/Collapse Button */}
                    {org.branches && org.branches.length > 0 ? (
                      <button
                        onClick={() => toggleExpand(org.id)}
                        className="p-1 hover:bg-slate-100 rounded"
                      >
                        {expandedOrgs.has(org.id) ? (
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        )}
                      </button>
                    ) : (
                      <div className="w-6" />
                    )}

                    {/* Org Icon */}
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-4 h-4 text-white" />
                    </div>

                    {/* Org Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 truncate">{org.name}</span>
                        {org.is_current && (
                          <Badge className="bg-teal-100 text-teal-700 text-xs">Current</Badge>
                        )}
                      </div>
                      {org.city && (
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <MapPin className="w-3 h-3" />
                          {org.city}
                        </div>
                      )}
                    </div>

                    {/* Branch Count Badge */}
                    {org.branch_count > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {org.branch_count} branches
                      </Badge>
                    )}

                    {/* Switch Button */}
                    {!org.is_current && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSwitch(org.id, org.switch_as, org.name)}
                        disabled={switching === org.id}
                        className="flex-shrink-0"
                        data-testid={`switch-to-${org.id}`}
                      >
                        {switching === org.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          'Switch To'
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Branches (Expanded) */}
                  {expandedOrgs.has(org.id) && org.branches && org.branches.length > 0 && (
                    <div className="border-t border-slate-100 bg-slate-50">
                      {org.branches.map((branch) => (
                        <div
                          key={branch.id}
                          className="flex items-center gap-2 p-3 pl-12 hover:bg-slate-100 border-b border-slate-100 last:border-b-0"
                        >
                          {/* Branch Icon */}
                          <div className="w-6 h-6 rounded bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-3 h-3 text-white" />
                          </div>

                          {/* Branch Info */}
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-sm text-slate-800 truncate block">
                              {branch.name}
                            </span>
                            {branch.city && (
                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                <MapPin className="w-3 h-3" />
                                {branch.city}
                              </div>
                            )}
                          </div>

                          {/* Switch Button */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSwitch(branch.id, branch.switch_as, branch.name)}
                            disabled={switching === branch.id}
                            className="flex-shrink-0 text-xs"
                            data-testid={`switch-to-${branch.id}`}
                          >
                            {switching === branch.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              'Switch To'
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Current Context Info */}
        {currentContext && (
          <div className="pt-3 border-t border-slate-200 flex-shrink-0">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Globe className="w-4 h-4" />
              <span>Current: </span>
              <Badge variant="outline">
                {currentContext.org_name || 'Global Context'}
              </Badge>
              <span className="text-slate-400">as</span>
              <Badge className="bg-slate-100 text-slate-700">
                {currentContext.user_type?.replace('_', ' ')}
              </Badge>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
