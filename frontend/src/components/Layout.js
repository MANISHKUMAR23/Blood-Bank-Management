import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Users, Droplet, Clipboard, FlaskConical, Layers, ShieldCheck,
  Package, ClipboardList, Truck, RotateCcw, Trash2, BarChart3,
  Settings, LogOut, Menu, X, Sun, Moon, Home, Microscope, UserPlus, Bell,
  Warehouse, ClipboardCheck, Navigation, Trophy, Cog, Building2, ArrowLeftRight, Globe, History,
  RefreshCw, ChevronDown, ArrowLeft, Lock, HardDrive
} from 'lucide-react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from './ui/dropdown-menu';
import { Badge } from './ui/badge';
import NotificationBell from './NotificationBell';
import ContextSwitcherModal from './ContextSwitcherModal';

const roleLabels = {
  admin: 'Administrator',
  registration: 'Registration Staff',
  phlebotomist: 'Phlebotomist',
  lab_tech: 'Lab Technician',
  processing: 'Processing Tech',
  qc_manager: 'QC Manager',
  inventory: 'Inventory Manager',
  distribution: 'Distribution Staff',
  config_manager: 'Config Manager',
};

// Platform/Admin modules - visible to System Admin in global context
const platformModules = [
  { path: '/network', icon: Globe, label: 'Network Overview', category: 'platform' },
  { path: '/organizations', icon: Building2, label: 'Organizations', category: 'platform' },
  { path: '/audit-logs', icon: History, label: 'Audit Logs', category: 'platform' },
  { path: '/users', icon: Settings, label: 'User Management', category: 'platform' },
  { path: '/security', icon: Lock, label: 'Security Settings', category: 'platform' },
  { path: '/backups', icon: HardDrive, label: 'Backup & Recovery', category: 'platform' },
  { path: '/configuration', icon: Cog, label: 'Configuration', category: 'platform' },
];

// Operational modules - visible when in org/branch context
const operationalModules = [
  { path: '/dashboard', icon: Home, label: 'Dashboard', roles: ['admin', 'registration', 'phlebotomist', 'lab_tech', 'processing', 'qc_manager', 'inventory', 'distribution', 'config_manager'], category: 'operational' },
  { path: '/blood-requests', icon: ArrowLeftRight, label: 'Blood Requests', roles: ['admin', 'inventory', 'distribution'], category: 'operational' },
  { path: '/donor-requests', icon: UserPlus, label: 'Donor Requests', roles: ['admin', 'registration'], category: 'operational' },
  { path: '/donors', icon: Users, label: 'Donor Management', roles: ['admin', 'registration'], category: 'operational' },
  { path: '/screening', icon: Clipboard, label: 'Screening', roles: ['admin', 'registration', 'phlebotomist'], category: 'operational' },
  { path: '/collection', icon: Droplet, label: 'Collection', roles: ['admin', 'phlebotomist'], category: 'operational' },
  { path: '/traceability', icon: Microscope, label: 'Traceability', roles: ['admin', 'lab_tech', 'processing', 'qc_manager'], category: 'operational' },
  { path: '/pre-lab-qc', icon: ClipboardCheck, label: 'Pre-Lab QC', roles: ['admin', 'lab_tech', 'qc_manager'], category: 'operational' },
  { path: '/laboratory', icon: FlaskConical, label: 'Laboratory', roles: ['admin', 'lab_tech'], category: 'operational' },
  { path: '/processing', icon: Layers, label: 'Processing', roles: ['admin', 'processing'], category: 'operational' },
  { path: '/qc-validation', icon: ShieldCheck, label: 'QC Validation', roles: ['admin', 'qc_manager'], category: 'operational' },
  { path: '/inventory', icon: Package, label: 'Inventory', roles: ['admin', 'inventory', 'distribution'], category: 'operational' },
  { path: '/storage', icon: Warehouse, label: 'Storage', roles: ['admin', 'inventory'], category: 'operational' },
  { path: '/requests', icon: ClipboardList, label: 'Requests', roles: ['admin', 'inventory', 'distribution'], category: 'operational' },
  { path: '/distribution', icon: Truck, label: 'Distribution', roles: ['admin', 'distribution'], category: 'operational' },
  { path: '/logistics-enhanced', icon: Navigation, label: 'Logistics', roles: ['admin', 'distribution'], category: 'operational' },
  { path: '/returns', icon: RotateCcw, label: 'Returns', roles: ['admin', 'inventory', 'qc_manager'], category: 'operational' },
  { path: '/discards', icon: Trash2, label: 'Discards', roles: ['admin', 'inventory', 'qc_manager'], category: 'operational' },
  { path: '/reports', icon: BarChart3, label: 'Reports', roles: ['admin', 'qc_manager', 'inventory'], category: 'operational' },
  { path: '/leaderboard', icon: Trophy, label: 'Leaderboard', roles: ['admin', 'registration', 'phlebotomist', 'lab_tech', 'processing', 'qc_manager', 'inventory', 'distribution'], category: 'operational' },
  { path: '/alerts', icon: Bell, label: 'Alerts', roles: ['admin', 'qc_manager', 'inventory', 'registration'], category: 'operational' },
  { path: '/configuration', icon: Cog, label: 'Configuration', roles: ['admin', 'config_manager'], category: 'operational' },
  { path: '/security', icon: Lock, label: 'Security', roles: ['admin', 'registration', 'phlebotomist', 'lab_tech', 'processing', 'qc_manager', 'inventory', 'distribution', 'config_manager'], category: 'operational' },
];

export default function Layout() {
  const { user, logout, isImpersonating, switchContext, exitContext, getSwitchableContexts, canSwitchContext, contextInfo } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [switchableContexts, setSwitchableContexts] = useState([]);
  const [loadingContexts, setLoadingContexts] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [showContextModal, setShowContextModal] = useState(false);

  // Determine if user is in global context (no org selected)
  const isGlobalContext = useMemo(() => {
    if (!user) return false;
    // System admin with no org_id and not impersonating = global context
    if (user.user_type === 'system_admin' && !user.org_id && !isImpersonating) {
      return true;
    }
    return false;
  }, [user, isImpersonating]);

  // Build dynamic navigation based on user type and context
  const navItems = useMemo(() => {
    if (!user) return [];
    
    const userType = user.user_type;
    const userRole = user.role || 'admin';
    const inOrgContext = !!user.org_id || isImpersonating;
    
    let items = [];
    
    // System Admin logic
    if (userType === 'system_admin') {
      if (!inOrgContext) {
        // Global context - show only platform modules
        items = [...platformModules];
      } else {
        // In org context - show operational modules + some admin modules
        items = [
          ...operationalModules.filter(item => 
            !item.roles || item.roles.includes('admin')
          ),
          // Add some platform modules for admin visibility
          { path: '/organizations', icon: Building2, label: 'Organizations', category: 'admin' },
          { path: '/users', icon: Settings, label: 'User Management', category: 'admin' },
          { path: '/audit-logs', icon: History, label: 'Audit Logs', category: 'admin' },
        ];
      }
    }
    // Super Admin logic - manages their organization and its branches
    else if (userType === 'super_admin') {
      items = [
        // Organization Dashboard first
        { path: '/org-dashboard', icon: Home, label: 'Org Dashboard', category: 'platform' },
        { path: '/organizations', icon: Building2, label: 'Branches', category: 'platform' },
        { path: '/users', icon: Settings, label: 'User Management', category: 'platform' },
        { path: '/backups', icon: HardDrive, label: 'Backup & Recovery', category: 'platform' },
        // Separator - operational modules
        ...operationalModules.filter(item => 
          !item.roles || item.roles.includes('admin')
        ),
        { path: '/audit-logs', icon: History, label: 'Audit Logs', category: 'admin' },
      ];
    }
    // Tenant Admin logic - manages their branch
    else if (userType === 'tenant_admin') {
      items = [
        // Branch management
        { path: '/users', icon: Settings, label: 'User Management', category: 'platform' },
        { path: '/audit-logs', icon: History, label: 'Audit Logs', category: 'platform' },
        { path: '/backups', icon: HardDrive, label: 'Backup & Recovery', category: 'platform' },
        // Operational modules
        ...operationalModules.filter(item => 
          !item.roles || item.roles.includes('admin')
        ),
      ];
    }
    // Staff users
    else {
      items = operationalModules.filter(item => 
        item.roles && item.roles.includes(userRole)
      );
    }
    
    return items;
  }, [user, isImpersonating]);

  const loadSwitchableContexts = async () => {
    setLoadingContexts(true);
    try {
      const data = await getSwitchableContexts();
      setSwitchableContexts(data.available_contexts || []);
    } catch (error) {
      console.error('Failed to load switchable contexts:', error);
    } finally {
      setLoadingContexts(false);
    }
  };

  useEffect(() => {
    if (user && (user.user_type === 'system_admin' || user.user_type === 'super_admin')) {
      loadSwitchableContexts();
    }
  }, [user]);

  const handleSwitchContext = async (orgId, userType) => {
    setSwitching(true);
    try {
      await switchContext(orgId, userType);
      // Reload contexts after switching
      loadSwitchableContexts();
      // Navigate to dashboard after context switch
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to switch context:', error);
    } finally {
      setSwitching(false);
    }
  };

  const handleExitContext = async () => {
    setSwitching(true);
    try {
      await exitContext();
      loadSwitchableContexts();
      // Navigate to network overview after exiting context
      navigate('/network');
    } catch (error) {
      console.error('Failed to exit context:', error);
    } finally {
      setSwitching(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  // Group nav items by category for display
  const groupedNavItems = useMemo(() => {
    const groups = {
      platform: [],
      operational: [],
      admin: []
    };
    
    navItems.forEach(item => {
      const category = item.category || 'operational';
      if (groups[category]) {
        groups[category].push(item);
      }
    });
    
    return groups;
  }, [navItems]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-200 ease-in-out flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
              <Droplet className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-900 dark:text-white">BloodLink</span>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Context Indicator */}
        {isGlobalContext && (
          <div className="mx-4 mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg flex-shrink-0">
            <div className="flex items-center gap-2 text-blue-700">
              <Globe className="w-4 h-4" />
              <span className="text-xs font-medium">Global Context</span>
            </div>
            <p className="text-xs text-blue-600 mt-1">Switch to an org to access operational modules</p>
          </div>
        )}
        
        {isImpersonating && (
          <div className="mx-4 mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg flex-shrink-0">
            <div className="flex items-center gap-2 text-amber-700">
              <Building2 className="w-4 h-4" />
              <span className="text-xs font-medium">{contextInfo?.org_name || 'Organization'}</span>
            </div>
            <p className="text-xs text-amber-600 mt-1">Viewing as {contextInfo?.user_type?.replace('_', ' ')}</p>
          </div>
        )}

        {/* Navigation - Scrollable */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
          {/* Platform Modules */}
          {groupedNavItems.platform.length > 0 && (
            <>
              <div className="px-2 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Platform
              </div>
              {groupedNavItems.platform.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}`
                  }
                  data-testid={`nav-${item.path.slice(1)}`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </>
          )}
          
          {/* Operational Modules */}
          {groupedNavItems.operational.length > 0 && (
            <>
              {groupedNavItems.platform.length > 0 && (
                <div className="my-2 border-t border-slate-200 dark:border-slate-700" />
              )}
              <div className="px-2 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Operations
              </div>
              {groupedNavItems.operational.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}`
                  }
                  data-testid={`nav-${item.path.slice(1)}`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </>
          )}
          
          {/* Admin Modules (when in org context) */}
          {groupedNavItems.admin.length > 0 && (
            <>
              <div className="my-2 border-t border-slate-200 dark:border-slate-700" />
              <div className="px-2 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Admin
              </div>
              {groupedNavItems.admin.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}`
                  }
                  data-testid={`nav-${item.path.slice(1)}`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex-shrink-0">
          <button
            onClick={toggleDarkMode}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            data-testid="theme-toggle"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`lg:ml-64 min-h-screen transition-all duration-200`}>
        {/* Impersonation Banner */}
        {isImpersonating && (
          <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              <span className="text-sm font-medium">
                Acting as {contextInfo?.org_info?.org_name || 'another organization'} ({user?.user_type?.replace('_', ' ')})
              </span>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              className="bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-600 h-7"
              onClick={handleExitContext}
              disabled={switching}
              data-testid="exit-context-btn"
            >
              <ArrowLeft className="w-3 h-3 mr-1" />
              Exit Context
            </Button>
          </div>
        )}

        {/* Header */}
        <header className="h-16 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
          <div className="h-full px-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                data-testid="menu-toggle"
              >
                <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
              <div className="hidden sm:flex items-center gap-3">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                  Blood Bank Management System
                </span>
                {user?.org_name && (
                  <Badge variant="outline" className="text-xs bg-slate-100 text-slate-600">
                    {user.org_name}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Context Switcher */}
              {canSwitchContext() && !isImpersonating && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 text-slate-600"
                  onClick={() => setShowContextModal(true)}
                  disabled={switching}
                  data-testid="context-switcher"
                >
                  <ArrowLeftRight className={`w-4 h-4 ${switching ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Switch Context</span>
                </Button>
              )}

              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2" data-testid="user-menu">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300">
                        {user?.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden md:block text-left">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{user?.full_name}</p>
                      <p className="text-xs text-slate-500">{user?.user_type?.replace('_', ' ') || roleLabels[user?.role]}</p>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-slate-600">
                    <span className="font-medium">{user?.email}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-slate-600">
                    <span>Role: {roleLabels[user?.role]}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-slate-600">
                    <span>Type: {user?.user_type?.replace('_', ' ')}</span>
                  </DropdownMenuItem>
                  {user?.org_name && (
                    <DropdownMenuItem className="text-slate-600">
                      <Building2 className="w-4 h-4 mr-2" />
                      <span>{user.org_name}</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600" data-testid="logout-btn">
                    <LogOut className="w-4 h-4 mr-2" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>

      {/* Context Switcher Modal */}
      <ContextSwitcherModal
        open={showContextModal}
        onOpenChange={setShowContextModal}
        onSwitch={handleSwitchContext}
        currentContext={contextInfo}
      />

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
