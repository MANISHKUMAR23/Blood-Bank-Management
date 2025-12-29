import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Users, Droplet, Clipboard, FlaskConical, Layers, ShieldCheck,
  Package, ClipboardList, Truck, RotateCcw, Trash2, BarChart3,
  Settings, LogOut, Menu, X, Sun, Moon, Home, Microscope, UserPlus, Bell,
  Warehouse, ClipboardCheck
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
} from './ui/dropdown-menu';
import NotificationBell from './NotificationBell';

const roleLabels = {
  admin: 'Administrator',
  registration: 'Registration Staff',
  phlebotomist: 'Phlebotomist',
  lab_tech: 'Lab Technician',
  processing: 'Processing Tech',
  qc_manager: 'QC Manager',
  inventory: 'Inventory Manager',
  distribution: 'Distribution Staff',
};

const navItems = [
  { path: '/dashboard', icon: Home, label: 'Dashboard', roles: ['admin', 'registration', 'phlebotomist', 'lab_tech', 'processing', 'qc_manager', 'inventory', 'distribution'] },
  { path: '/donor-requests', icon: UserPlus, label: 'Donor Requests', roles: ['admin', 'registration'] },
  { path: '/donors', icon: Users, label: 'Donor Management', roles: ['admin', 'registration'] },
  { path: '/screening', icon: Clipboard, label: 'Screening', roles: ['admin', 'registration', 'phlebotomist'] },
  { path: '/collection', icon: Droplet, label: 'Collection', roles: ['admin', 'phlebotomist'] },
  { path: '/traceability', icon: Microscope, label: 'Traceability', roles: ['admin', 'lab_tech', 'processing', 'qc_manager'] },
  { path: '/pre-lab-qc', icon: ClipboardCheck, label: 'Pre-Lab QC', roles: ['admin', 'lab_tech', 'qc_manager'] },
  { path: '/laboratory', icon: FlaskConical, label: 'Laboratory', roles: ['admin', 'lab_tech'] },
  { path: '/processing', icon: Layers, label: 'Processing', roles: ['admin', 'processing'] },
  { path: '/qc-validation', icon: ShieldCheck, label: 'QC Validation', roles: ['admin', 'qc_manager'] },
  { path: '/inventory', icon: Package, label: 'Inventory', roles: ['admin', 'inventory', 'distribution'] },
  { path: '/storage', icon: Warehouse, label: 'Storage', roles: ['admin', 'inventory'] },
  { path: '/requests', icon: ClipboardList, label: 'Requests', roles: ['admin', 'inventory', 'distribution'] },
  { path: '/distribution', icon: Truck, label: 'Distribution', roles: ['admin', 'distribution'] },
  { path: '/returns', icon: RotateCcw, label: 'Returns', roles: ['admin', 'inventory', 'qc_manager'] },
  { path: '/discards', icon: Trash2, label: 'Discards', roles: ['admin', 'inventory', 'qc_manager'] },
  { path: '/reports', icon: BarChart3, label: 'Reports', roles: ['admin', 'qc_manager', 'inventory'] },
  { path: '/alerts', icon: Bell, label: 'Alerts', roles: ['admin', 'qc_manager', 'inventory', 'registration'] },
  { path: '/users', icon: Settings, label: 'User Management', roles: ['admin'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const filteredNavItems = navItems.filter(item => 
    item.roles.includes(user?.role)
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
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

        {/* Navigation */}
        <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-8rem)]">
          {filteredNavItems.map((item) => (
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
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
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
              <div className="hidden sm:block">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                  Blood Bank Management System
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
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
                      <p className="text-xs text-slate-500">{roleLabels[user?.role]}</p>
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
