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
import Requests from "./pages/Requests";
import Distribution from "./pages/Distribution";
import Returns from "./pages/Returns";
import Discards from "./pages/Discards";
import Reports from "./pages/Reports";
import Alerts from "./pages/Alerts";
import UserManagement from "./pages/UserManagement";
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
      {/* Public Donor Routes (No auth required) */}
      <Route path="/donor" element={<DonorLanding />} />
      <Route path="/donor/dashboard" element={<DonorDashboard />} />
      <Route path="/donor/status" element={<DonorStatus />} />
      
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
        <Route path="qc-validation" element={<QCValidation />} />
        
        {/* Inventory */}
        <Route path="inventory" element={<Inventory />} />
        
        {/* Distribution */}
        <Route path="requests" element={<Requests />} />
        <Route path="distribution" element={<Distribution />} />
        
        {/* Returns & Discards */}
        <Route path="returns" element={<Returns />} />
        <Route path="discards" element={<Discards />} />
        
        {/* Reports */}
        <Route path="reports" element={<Reports />} />
        
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
