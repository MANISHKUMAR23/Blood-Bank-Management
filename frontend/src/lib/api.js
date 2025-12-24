import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || localStorage.getItem('donor_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't redirect for public pages
      const isPublicPage = window.location.pathname.startsWith('/donor') && !window.location.pathname.startsWith('/donors');
      if (!isPublicPage) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
};

// Public Donor APIs (no auth required)
export const publicDonorAPI = {
  register: (data) => api.post('/public/donor-register', data),
  checkStatus: (identityType, identityNumber) => api.get(`/public/donor-status/${identityType}/${identityNumber}`),
  requestOTP: (data) => api.post('/public/donor-login/request-otp', null, { params: data }),
  verifyOTP: (donorId, otp) => api.post('/public/donor-login/verify-otp', null, { params: { donor_id: donorId, otp } }),
  getProfile: () => api.get('/public/donor-profile'),
};

// Donor Request APIs (Staff only)
export const donorRequestAPI = {
  getAll: (params) => api.get('/donor-requests', { params }),
  getById: (id) => api.get(`/donor-requests/${id}`),
  checkDuplicate: (id) => api.post(`/donor-requests/${id}/check-duplicate`),
  approve: (id) => api.post(`/donor-requests/${id}/approve`),
  reject: (id, reason) => api.post(`/donor-requests/${id}/reject`, null, { params: { rejection_reason: reason } }),
};

// User APIs
export const userAPI = {
  getAll: () => api.get('/users'),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

// Donor APIs
export const donorAPI = {
  create: (data) => api.post('/donors', data),
  getAll: (params) => api.get('/donors', { params }),
  getById: (id) => api.get(`/donors/${id}`),
  update: (id, data) => api.put(`/donors/${id}`, data),
  checkEligibility: (id) => api.get(`/donors/${id}/eligibility`),
  getHistory: (id) => api.get(`/donors/${id}/history`),
};

// Screening APIs
export const screeningAPI = {
  create: (data) => api.post('/screenings', data),
  getAll: (params) => api.get('/screenings', { params }),
  getById: (id) => api.get(`/screenings/${id}`),
};

// Donation APIs
export const donationAPI = {
  create: (data) => api.post('/donations', data),
  getAll: (params) => api.get('/donations', { params }),
  complete: (id, data) => api.put(`/donations/${id}/complete`, null, { params: data }),
};

// Blood Unit APIs
export const bloodUnitAPI = {
  getAll: (params) => api.get('/blood-units', { params }),
  getById: (id) => api.get(`/blood-units/${id}`),
  update: (id, data) => api.put(`/blood-units/${id}`, data),
  getTraceability: (id) => api.get(`/blood-units/${id}/traceability`),
};

// Chain of Custody APIs
export const custodyAPI = {
  create: (data) => api.post('/chain-custody', data),
  getAll: (params) => api.get('/chain-custody', { params }),
  confirm: (id) => api.put(`/chain-custody/${id}/confirm`),
};

// Lab Test APIs
export const labTestAPI = {
  create: (data) => api.post('/lab-tests', data),
  getAll: (params) => api.get('/lab-tests', { params }),
  getById: (id) => api.get(`/lab-tests/${id}`),
};

// Component APIs
export const componentAPI = {
  create: (data) => api.post('/components', data),
  getAll: (params) => api.get('/components', { params }),
  getById: (id) => api.get(`/components/${id}`),
  update: (id, data) => api.put(`/components/${id}`, data),
};

// Quarantine APIs
export const quarantineAPI = {
  getAll: () => api.get('/quarantine'),
  resolve: (id, data) => api.put(`/quarantine/${id}/resolve`, null, { params: data }),
};

// QC Validation APIs
export const qcAPI = {
  create: (data) => api.post('/qc-validation', data),
  getAll: (params) => api.get('/qc-validation', { params }),
  approve: (id) => api.put(`/qc-validation/${id}/approve`),
};

// Inventory APIs
export const inventoryAPI = {
  getSummary: () => api.get('/inventory/summary'),
  getByBloodGroup: () => api.get('/inventory/by-blood-group'),
  getExpiring: (days) => api.get('/inventory/expiring', { params: { days } }),
  getFEFO: (params) => api.get('/inventory/fefo', { params }),
};

// Request APIs
export const requestAPI = {
  create: (data) => api.post('/requests', data),
  getAll: (params) => api.get('/requests', { params }),
  getById: (id) => api.get(`/requests/${id}`),
  approve: (id) => api.put(`/requests/${id}/approve`),
  reject: (id, reason) => api.put(`/requests/${id}/reject`, null, { params: { reason } }),
};

// Issuance APIs
export const issuanceAPI = {
  create: (requestId, componentIds) => api.post('/issuances', null, { params: { request_id: requestId, component_ids: componentIds } }),
  getAll: (params) => api.get('/issuances', { params }),
  pack: (id) => api.put(`/issuances/${id}/pack`),
  ship: (id) => api.put(`/issuances/${id}/ship`),
  deliver: (id, receivedBy) => api.put(`/issuances/${id}/deliver`, null, { params: { received_by: receivedBy } }),
};

// Return APIs
export const returnAPI = {
  create: (data) => api.post('/returns', null, { params: data }),
  getAll: () => api.get('/returns'),
  process: (id, data) => api.put(`/returns/${id}/process`, null, { params: data }),
};

// Discard APIs
export const discardAPI = {
  create: (data) => api.post('/discards', null, { params: data }),
  getAll: (params) => api.get('/discards', { params }),
  markDestroyed: (id) => api.put(`/discards/${id}/destroy`),
};

// Report APIs
export const reportAPI = {
  dailyCollections: (date) => api.get('/reports/daily-collections', { params: { date } }),
  inventoryStatus: () => api.get('/reports/inventory-status'),
  expiryAnalysis: () => api.get('/reports/expiry-analysis'),
  discardAnalysis: (params) => api.get('/reports/discard-analysis', { params }),
  testingOutcomes: (params) => api.get('/reports/testing-outcomes', { params }),
};

// Dashboard APIs
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
};

// Utility APIs
export const utilityAPI = {
  getBarcode: (data) => api.get(`/barcode/${data}`),
  getQRCode: (data) => api.get(`/qrcode/${data}`),
};

export default api;
