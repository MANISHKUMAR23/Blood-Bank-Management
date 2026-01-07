import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import DonorManagement from "./pages/DonorManagement";
import DonorRegistration from "./pages/DonorRegistration";
import DonorDetails from "./pages/DonorDetails";
import DonorRequests from "./pages/DonorRequests";
import DonorLanding from "./pages/DonorLanding";
import DonorDashboard from "./pages/DonorDashboard";
import DonorStatus from "./pages/DonorStatus";
import Screening from "./pages/Screening";
import Collection from "./pages/Collection";
import Traceability from "./pages/Traceability";
import Laboratory from "./pages/Laboratory";
import Processing from "./pages/Processing";
import QCValidation from "./pages/QCValidation";
import Inventory from "./pages/Inventory";
import InventoryEnhanced from "./pages/InventoryEnhanced";
import Requests from "./pages/Requests";
import Distribution from "./pages/Distribution";
import Returns from "./pages/Returns";
import Discards from "./pages/Discards";
import Reports from "./pages/Reports";
import Alerts from "./pages/Alerts";
import StorageManagement from "./pages/StorageManagement";
import PreLabQC from "./pages/PreLabQC";
import Logistics from "./pages/Logistics";
import UserManagement from "./pages/UserManagement";
import Leaderboard from "./pages/Leaderboard";
import Configuration from "./pages/Configuration";
import LogisticsEnhanced from "./pages/LogisticsEnhanced";
import PublicTracking from "./pages/PublicTracking";
import Organizations from "./pages/Organizations";
import OrganizationDetail from "./pages/OrganizationDetail";
import BloodRequests from "./pages/BloodRequests";
import NetworkDashboard from "./pages/NetworkDashboard";
import AuditLogs from "./pages/AuditLogs";
import "./App.css";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

function AppRoutes() {
  const { user } = useAuth();
  
  return (
    <Routes>
      {/* Public Routes (No auth required) */}
      <Route path="/donor" element={<DonorLanding />} />
      <Route path="/donor/dashboard" element={<DonorDashboard />} />
      <Route path="/donor/status" element={<DonorStatus />} />
      <Route path="/track/:trackingNumber" element={<PublicTracking />} />
      <Route path="/track" element={<PublicTracking />} />
      
      {/* Staff Login */}
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      
      {/* Protected Staff Routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        
        {/* Donor Management */}
        <Route path="donors" element={<DonorManagement />} />
        <Route path="donors/register" element={<DonorRegistration />} />
        <Route path="donors/:id" element={<DonorDetails />} />
        
        {/* Donor Registration Requests (Staff Approval) */}
        <Route path="donor-requests" element={
          <ProtectedRoute allowedRoles={['admin', 'registration']}>
            <DonorRequests />
          </ProtectedRoute>
        } />
        
        {/* Screening & Collection */}
        <Route path="screening" element={<Screening />} />
        <Route path="collection" element={<Collection />} />
        
        {/* Traceability */}
        <Route path="traceability" element={<Traceability />} />
        
        {/* Laboratory */}
        <Route path="laboratory" element={<Laboratory />} />
        
        {/* Processing */}
        <Route path="processing" element={<Processing />} />
        
        {/* QC */}
        <Route path="pre-lab-qc" element={<PreLabQC />} />
        <Route path="qc-validation" element={<QCValidation />} />
        
        {/* Inventory */}
        <Route path="inventory" element={<InventoryEnhanced />} />
        <Route path="inventory-old" element={<Inventory />} />
        <Route path="storage" element={<StorageManagement />} />
        
        {/* Distribution */}
        <Route path="requests" element={<Requests />} />
        <Route path="distribution" element={<Distribution />} />
        <Route path="logistics" element={<Logistics />} />
        <Route path="logistics-enhanced" element={<LogisticsEnhanced />} />
        
        {/* Returns & Discards */}
        <Route path="returns" element={<Returns />} />
        <Route path="discards" element={<Discards />} />
        
        {/* Reports */}
        <Route path="reports" element={<Reports />} />
        
        {/* Leaderboard */}
        <Route path="leaderboard" element={<Leaderboard />} />
        
        {/* Alerts */}
        <Route path="alerts" element={<Alerts />} />
        
        {/* Configuration (Admin Only) */}
        <Route path="configuration" element={
          <ProtectedRoute allowedRoles={['admin', 'config_manager']}>
            <Configuration />
          </ProtectedRoute>
        } />
        
        {/* Organizations (System/Super Admin Only) */}
        <Route path="organizations" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Organizations />
          </ProtectedRoute>
        } />
        <Route path="organizations/:orgId" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <OrganizationDetail />
          </ProtectedRoute>
        } />
        
        {/* Blood Requests (Inter-Org) */}
        <Route path="blood-requests" element={
          <ProtectedRoute allowedRoles={['admin', 'inventory', 'distribution']}>
            <BloodRequests />
          </ProtectedRoute>
        } />
        
        {/* Network Dashboard */}
        <Route path="network" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <NetworkDashboard />
          </ProtectedRoute>
        } />
        
        {/* Audit Logs */}
        <Route path="audit-logs" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AuditLogs />
          </ProtectedRoute>
        } />
        
        {/* Admin */}
        <Route path="users" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <UserManagement />
          </ProtectedRoute>
        } />
      </Route>
      
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster 
          position="top-right" 
          richColors 
          closeButton
          toastOptions={{
            duration: 4000,
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
