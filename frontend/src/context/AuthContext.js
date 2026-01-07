import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);
  const [contextInfo, setContextInfo] = useState(null);
  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/me`);
      setUser(response.data);
      // Fetch context info
      await fetchContext();
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const fetchContext = async () => {
    try {
      const response = await axios.get(`${API_URL}/sessions/context`);
      setContextInfo(response.data);
      setIsImpersonating(response.data.is_impersonating || false);
    } catch (error) {
      console.error('Failed to fetch context:', error);
    }
  };

  const login = async (email, password, orgId = null) => {
    const payload = { email, password };
    if (orgId) {
      payload.org_id = orgId;
    }
    
    const response = await axios.post(`${API_URL}/auth/login`, payload);
    const { token: newToken, user: userData } = response.data;
    
    localStorage.setItem('token', newToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(userData);
    
    return userData;
  };

  const register = async (userData) => {
    // This requires admin authentication - token must be set
    const response = await axios.post(`${API_URL}/auth/register`, userData);
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    setContextInfo(null);
    setIsImpersonating(false);
  };

  // Context switching functions
  const switchContext = async (targetOrgId, targetUserType = null) => {
    try {
      const response = await axios.post(`${API_URL}/sessions/switch-context`, {
        target_org_id: targetOrgId,
        target_user_type: targetUserType
      });
      
      const { token: newToken, context } = response.data;
      
      localStorage.setItem('token', newToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      setToken(newToken);
      setIsImpersonating(true);
      
      // Refresh user info with new context
      await fetchUser();
      
      return response.data;
    } catch (error) {
      console.error('Failed to switch context:', error);
      throw error;
    }
  };

  const exitContext = async () => {
    try {
      const response = await axios.post(`${API_URL}/sessions/exit-context`);
      
      const { token: newToken, context } = response.data;
      
      localStorage.setItem('token', newToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      setToken(newToken);
      setIsImpersonating(false);
      
      // Refresh user info
      await fetchUser();
      
      return response.data;
    } catch (error) {
      console.error('Failed to exit context:', error);
      throw error;
    }
  };

  const getSwitchableContexts = async () => {
    try {
      const response = await axios.get(`${API_URL}/sessions/switchable-contexts`);
      return response.data;
    } catch (error) {
      console.error('Failed to get switchable contexts:', error);
      return { available_contexts: [] };
    }
  };

  // Helper functions for permission checks
  const isSystemAdmin = () => user?.user_type === 'system_admin';
  const isSuperAdmin = () => user?.user_type === 'super_admin';
  const isTenantAdmin = () => user?.user_type === 'tenant_admin';
  const isStaff = () => user?.user_type === 'staff';
  
  const canManageOrganizations = () => isSystemAdmin() || isSuperAdmin();
  const canManageUsers = () => isSystemAdmin() || isSuperAdmin() || isTenantAdmin();
  const canViewNetworkInventory = () => isSystemAdmin() || isSuperAdmin() || isTenantAdmin();
  const canSwitchContext = () => isSystemAdmin() || isSuperAdmin();

  const value = {
    user,
    token,
    isLoading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    // Context switching
    contextInfo,
    isImpersonating,
    switchContext,
    exitContext,
    getSwitchableContexts,
    // Permission helpers
    isSystemAdmin,
    isSuperAdmin,
    isTenantAdmin,
    isStaff,
    canManageOrganizations,
    canManageUsers,
    canViewNetworkInventory,
    canSwitchContext,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
