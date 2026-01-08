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

// Organization APIs
export const organizationAPI = {
  // Public (no auth)
  getPublicOrgs: () => api.get('/organizations/public'),
  
  // Authenticated
  getAll: (params) => api.get('/organizations', { params }),
  getOne: (id) => api.get(`/organizations/${id}`),
  getHierarchy: () => api.get('/organizations/hierarchy'),
  create: (data) => api.post('/organizations', data),
  update: (id, data) => api.put(`/organizations/${id}`, data),
  deactivate: (id) => api.delete(`/organizations/${id}`),
  getInventorySummary: (id, includeChildren = false) => 
    api.get(`/organizations/${id}/inventory-summary`, { params: { include_children: includeChildren } }),
  
  // Combined creation endpoints
  createWithAdmin: (data) => api.post('/organizations/with-admin', data),
  createBranchWithAdmin: (parentOrgId, data) => api.post(`/organizations/${parentOrgId}/branches/with-admin`, data),
  
  // User management
  getUsers: (orgId, includeChildren = false) => 
    api.get(`/organizations/${orgId}/users`, { params: { include_children: includeChildren } }),
  createUser: (orgId, queryString) => api.post(`/organizations/${orgId}/users?${queryString}`),
  updateUser: (orgId, userId, data) => api.put(`/organizations/${orgId}/users/${userId}`, data),
  deactivateUser: (orgId, userId) => api.delete(`/organizations/${orgId}/users/${userId}`),
  
  // External organizations
  getExternalOrgs: (params) => api.get('/organizations/external/list', { params }),
  createExternalOrg: (data) => api.post('/organizations/external', data),
  updateExternalOrg: (id, data) => api.put(`/organizations/external/${id}`, data),
  getExternalOrgHistory: (id) => api.get(`/organizations/external/${id}/history`),
};

// Session/Context APIs
export const sessionAPI = {
  getContextTree: (search) => api.get('/sessions/context-tree', { params: { search } }),
  switchContext: (targetOrgId, targetUserType) => api.post('/sessions/switch-context', {
    target_org_id: targetOrgId,
    target_user_type: targetUserType
  }),
  exitContext: () => api.post('/sessions/exit-context'),
  getSwitchableContexts: () => api.get('/sessions/switchable-contexts'),
};

// Document APIs
export const documentAPI = {
  getAll: (orgId, params) => api.get(`/documents/${orgId}`, { params }),
  getOne: (orgId, docId) => api.get(`/documents/${orgId}/${docId}`),
  upload: (orgId, formData) => api.post(`/documents/${orgId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  update: (orgId, docId, data) => api.put(`/documents/${orgId}/${docId}`, data),
  verify: (orgId, docId) => api.put(`/documents/${orgId}/${docId}/verify`),
  delete: (orgId, docId) => api.delete(`/documents/${orgId}/${docId}`),
  getStats: (orgId) => api.get(`/documents/${orgId}/summary/stats`),
  getDownloadUrl: (orgId, docId) => `${API_URL}/documents/${orgId}/${docId}/download`,
};

// Compliance APIs
export const complianceAPI = {
  // Requirements
  getRequirements: (params) => api.get('/compliance/requirements', { params }),
  createRequirement: (data) => api.post('/compliance/requirements', data),
  updateRequirement: (id, data) => api.put(`/compliance/requirements/${id}`, data),
  deleteRequirement: (id) => api.delete(`/compliance/requirements/${id}`),
  seedDefaults: () => api.post('/compliance/seed-defaults'),
  
  // Organization Compliance
  getOrgCompliance: (orgId) => api.get(`/compliance/organizations/${orgId}`),
  updateOrgCompliance: (orgId, requirementId, data) => 
    api.post(`/compliance/organizations/${orgId}`, data, { params: { requirement_id: requirementId } }),
  linkDocument: (orgId, requirementId, documentId) => 
    api.post(`/compliance/organizations/${orgId}/link-document`, null, { 
      params: { requirement_id: requirementId, document_id: documentId } 
    }),
  getOrgSummary: (orgId) => api.get(`/compliance/organizations/${orgId}/summary`),
};

// Training APIs
export const trainingAPI = {
  // Courses
  getCourses: (params) => api.get('/training/courses', { params }),
  createCourse: (data) => api.post('/training/courses', data),
  updateCourse: (id, data) => api.put(`/training/courses/${id}`, data),
  deleteCourse: (id) => api.delete(`/training/courses/${id}`),
  seedDefaults: () => api.post('/training/seed-defaults'),
  
  // Training Records
  getOrgRecords: (orgId, params) => api.get(`/training/organizations/${orgId}/records`, { params }),
  assignTraining: (orgId, data) => api.post(`/training/organizations/${orgId}/assign`, data),
  startTraining: (recordId) => api.put(`/training/records/${recordId}/start`),
  completeTraining: (recordId, score, certDocId) => 
    api.put(`/training/records/${recordId}/complete`, null, { 
      params: { score, certificate_document_id: certDocId } 
    }),
  getUserRecords: (userId) => api.get(`/training/users/${userId}/records`),
  getOrgSummary: (orgId) => api.get(`/training/organizations/${orgId}/summary`),
};

// Security APIs
export const securityAPI = {
  // Password Policy
  getPasswordPolicy: (orgId) => api.get('/security/password-policy', { params: { org_id: orgId } }),
  updatePasswordPolicy: (updates, orgId) => api.put('/security/password-policy', updates, { params: { org_id: orgId } }),
  validatePassword: (password, orgId) => api.post('/security/validate-password', null, { params: { password, org_id: orgId } }),
  
  // MFA
  getMfaStatus: () => api.get('/security/mfa/status'),
  setupTotpMfa: () => api.post('/security/mfa/setup/totp'),
  verifyTotpSetup: (code) => api.post('/security/mfa/verify/totp', null, { params: { code } }),
  enableEmailOtp: () => api.post('/security/mfa/enable-email'),
  sendEmailOtp: (email) => api.post('/security/mfa/send-email-otp', null, { params: { email } }),
  verifyEmailOtp: (email, otp) => api.post('/security/mfa/verify-email-otp', null, { params: { email, otp } }),
  disableMfa: () => api.post('/security/mfa/disable'),
  regenerateBackupCodes: () => api.post('/security/mfa/regenerate-backup-codes'),
  enforceMfa: (userId) => api.post(`/security/mfa/enforce/${userId}`),
  
  // Sessions
  getSessions: () => api.get('/security/sessions'),
  revokeSession: (sessionId) => api.post(`/security/sessions/revoke/${sessionId}`),
  revokeAllSessions: (keepCurrent) => api.post('/security/sessions/revoke-all', null, { params: { keep_current: keepCurrent } }),
  getSessionConfig: (orgId) => api.get('/security/sessions/config', { params: { org_id: orgId } }),
  updateSessionConfig: (params) => api.put('/security/sessions/config', null, { params }),
  
  // API Keys
  listApiKeys: (orgId) => api.get('/security/api-keys', { params: { org_id: orgId } }),
  createApiKey: (orgId, data) => api.post('/security/api-keys', data, { params: { org_id: orgId } }),
  revokeApiKey: (keyId, orgId) => api.delete(`/security/api-keys/${keyId}`, { params: { org_id: orgId } }),
  getApiKeyUsage: (keyId, orgId) => api.get(`/security/api-keys/${keyId}/usage`, { params: { org_id: orgId } }),
  
  // Lockout
  getLockoutStatus: (userId) => api.get(`/security/lockout/status/${userId}`),
  unlockAccount: (userId) => api.post(`/security/lockout/unlock/${userId}`),
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
  updatePermissions: (id, permissions) => api.put(`/users/${id}/permissions`, permissions),
  delete: (id) => api.delete(`/users/${id}`),
  getRoles: () => api.get('/users/roles'),
  createRole: (data) => api.post('/users/roles', data),
  deleteRole: (id) => api.delete(`/users/roles/${id}`),
  getModules: () => api.get('/users/permissions/modules'),
};

// Donor APIs
export const donorAPI = {
  create: (data) => api.post('/donors', data),
  getAll: (params) => api.get('/donors', { params }),
  getById: (id) => api.get(`/donors/${id}`),
  update: (id, data) => api.put(`/donors/${id}`, data),
  checkEligibility: (id) => api.get(`/donors/${id}/eligibility`),
  getHistory: (id) => api.get(`/donors/${id}/history`),
  // Enhanced APIs
  getFullProfile: (id) => api.get(`/donors/${id}/full-profile`),
  getDonorsWithStatus: (params) => api.get('/donors-with-status', { params }),
  deactivate: (id, formData) => api.post(`/donors/${id}/deactivate`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  reactivate: (id, reason) => api.post(`/donors/${id}/reactivate`, null, { params: { reason } }),
  getEligibleForScreening: (params) => api.get('/screening/eligible-donors', { params }),
};

// Donation Session APIs
export const donationSessionAPI = {
  create: (donorId) => api.post('/donation-sessions', null, { params: { donor_id: donorId } }),
  getAll: (params) => api.get('/donation-sessions', { params }),
  getById: (id) => api.get(`/donation-sessions/${id}`),
  completeScreening: (id, screeningId, status, rejectionReason) => 
    api.put(`/donation-sessions/${id}/complete-screening`, null, { 
      params: { screening_id: screeningId, status, rejection_reason: rejectionReason } 
    }),
  completeCollection: (id, donationId, unitId) => 
    api.put(`/donation-sessions/${id}/complete-collection`, null, { 
      params: { donation_id: donationId, unit_id: unitId } 
    }),
  cancel: (id, reason) => api.put(`/donation-sessions/${id}/cancel`, null, { params: { reason } }),
};

// Rewards & Leaderboard APIs
export const rewardsAPI = {
  getDonorRewards: (donorId) => api.get(`/donor-rewards/${donorId}`),
  getLeaderboard: (period = 'all_time', limit = 50) => 
    api.get('/leaderboard', { params: { period, limit } }),
};

// Screening APIs
export const screeningAPI = {
  create: (data) => api.post('/screenings', data),
  getAll: (params) => api.get('/screenings', { params }),
  getById: (id) => api.get(`/screenings/${id}`),
  getPendingDonors: () => api.get('/screenings/pending/donors'),
  getTodaySummary: () => api.get('/screenings/today/summary'),
};

// Donation APIs
export const donationAPI = {
  create: (data) => api.post('/donations', data),
  getAll: (params) => api.get('/donations', { params }),
  complete: (id, data) => api.put(`/donations/${id}/complete`, null, { params: data }),
  getEligibleDonors: () => api.get('/donations/eligible-donors'),
  getTodaySummary: () => api.get('/donations/today/summary'),
  getTodayDonations: () => api.get('/donations/today'),
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
  createMultiple: (data) => api.post('/components/multi', data),
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
  create: (requestId, componentIds) => {
    // Build query string manually for proper array parameter format
    const params = new URLSearchParams();
    params.append('request_id', requestId);
    componentIds.forEach(id => params.append('component_ids', id));
    return api.post(`/issuances?${params.toString()}`);
  },
  getAll: (params) => api.get('/issuances', { params }),
  pack: (id) => api.put(`/issuances/${id}/pack`),
  ship: (id) => api.put(`/issuances/${id}/ship`),
  deliver: (id, receivedBy) => api.put(`/issuances/${id}/deliver`, null, { params: { received_by: receivedBy } }),
};

// Return APIs
export const returnAPI = {
  create: (data) => api.post('/returns', data),
  getAll: (params) => api.get('/returns', { params }),
  process: (id, data) => api.put(`/returns/${id}/process`, data),
};

// Discard APIs
export const discardAPI = {
  create: (data) => api.post('/discards', data),
  getAll: (params) => api.get('/discards', { params }),
  getSummary: () => api.get('/discards/summary'),
  authorize: (id, data) => api.put(`/discards/${id}/authorize`, data),
  markDestroyed: (id) => api.put(`/discards/${id}/destroy`),
  autoExpire: () => api.post('/discards/auto-expire'),
};

// Logistics APIs
export const logisticsAPI = {
  createShipment: (data) => api.post('/logistics/shipments', data),
  getShipments: (params) => api.get('/logistics/shipments', { params }),
  getShipment: (id) => api.get(`/logistics/shipments/${id}`),
  dispatchShipment: (id) => api.put(`/logistics/shipments/${id}/dispatch`),
  updateLocation: (id, params) => api.put(`/logistics/shipments/${id}/update-location`, null, { params }),
  deliverShipment: (id, receivedBy, notes) => api.put(`/logistics/shipments/${id}/deliver`, null, { params: { received_by: receivedBy, notes } }),
  getDashboard: () => api.get('/logistics/dashboard'),
};

// Report APIs
export const reportAPI = {
  dailyCollections: (date) => api.get('/reports/daily-collections', { params: { date } }),
  inventoryStatus: () => api.get('/reports/inventory-status'),
  expiryAnalysis: () => api.get('/reports/expiry-analysis'),
  discardAnalysis: (params) => api.get('/reports/discard-analysis', { params }),
  testingOutcomes: (params) => api.get('/reports/testing-outcomes', { params }),
  // Export endpoints
  exportDonors: (params) => api.get('/reports/export/donors', { params, responseType: 'blob' }),
  exportInventory: (params) => api.get('/reports/export/inventory', { params, responseType: 'blob' }),
  exportDonations: (params) => api.get('/reports/export/donations', { params, responseType: 'blob' }),
  exportDiscards: (params) => api.get('/reports/export/discards', { params, responseType: 'blob' }),
  exportRequests: (params) => api.get('/reports/export/requests', { params, responseType: 'blob' }),
};

// Dashboard APIs
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
};

// Alerts APIs
export const alertsAPI = {
  getSummary: () => api.get('/alerts/summary'),
  getExpiringItems: (params) => api.get('/alerts/expiring-items', { params }),
  getLowStock: (params) => api.get('/alerts/low-stock', { params }),
  getUrgentRequests: () => api.get('/alerts/urgent-requests'),
};

// Storage Management APIs
export const storageAPI = {
  getAll: (params) => api.get('/storage', { params }),
  getSummary: () => api.get('/storage/summary'),
  getOne: (id) => api.get(`/storage/${id}`),
  create: (data) => api.post('/storage', data),
  update: (id, data) => api.put(`/storage/${id}`, data),
  assignItem: (storageId, itemId, itemType) => api.post(`/storage/${storageId}/assign`, null, { params: { item_id: itemId, item_type: itemType } }),
  transferItems: (storageId, data) => api.post(`/storage/${storageId}/transfer`, data),
};

// Pre-Lab QC APIs
export const preLabQCAPI = {
  getAll: (params) => api.get('/pre-lab-qc', { params }),
  getPending: () => api.get('/pre-lab-qc/pending'),
  getOne: (id) => api.get(`/pre-lab-qc/${id}`),
  getByUnit: (unitId) => api.get(`/pre-lab-qc/unit/${unitId}`),
  create: (data) => api.post('/pre-lab-qc', data),
};

// Notifications APIs
export const notificationAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/count'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  create: (data) => api.post('/notifications', data),
  delete: (id) => api.delete(`/notifications/${id}`),
  generateAlerts: () => api.post('/notifications/generate-alerts'),
};

// Utility APIs
export const utilityAPI = {
  getBarcode: (data) => api.get(`/barcode/${data}`),
  getQRCode: (data) => api.get(`/qrcode/${data}`),
};

// Label Printing APIs
export const labelAPI = {
  getBloodUnitLabel: (unitId) => api.get(`/labels/blood-unit/${unitId}`),
  getComponentLabel: (componentId) => api.get(`/labels/component/${componentId}`),
  getBulkLabels: (unitIds = [], componentIds = []) => api.post('/labels/bulk', { unit_ids: unitIds, component_ids: componentIds }),
};

// Enhanced Inventory APIs
export const inventoryEnhancedAPI = {
  // Dashboard views
  getByStorage: () => api.get('/inventory-enhanced/dashboard/by-storage'),
  getByBloodGroup: () => api.get('/inventory-enhanced/dashboard/by-blood-group'),
  getByComponentType: () => api.get('/inventory-enhanced/dashboard/by-component-type'),
  getByExpiry: () => api.get('/inventory-enhanced/dashboard/by-expiry'),
  getByStatus: () => api.get('/inventory-enhanced/dashboard/by-status'),
  
  // Storage contents
  getStorageContents: (storageId, params) => api.get(`/inventory-enhanced/storage/${storageId}/contents`, { params }),
  
  // Move/Transfer
  moveItems: (data) => api.post('/inventory-enhanced/move', data),
  validateMove: (params) => api.get('/inventory-enhanced/move/validate', { params }),
  
  // Search
  search: (params) => api.get('/inventory-enhanced/search', { params }),
  locate: (itemId) => api.get(`/inventory-enhanced/locate/${itemId}`),
  
  // Reserve
  reserveItems: (data) => api.post('/inventory-enhanced/reserve', data),
  releaseReservation: (itemId, itemType) => api.post(`/inventory-enhanced/reserve/${itemId}/release`, null, { params: { item_type: itemType } }),
  getReservedItems: () => api.get('/inventory-enhanced/reserved'),
  autoReleaseExpired: () => api.post('/inventory-enhanced/reserve/auto-release'),
  
  // Reports
  getStockReport: () => api.get('/inventory-enhanced/reports/stock'),
  getMovementReport: (params) => api.get('/inventory-enhanced/reports/movement', { params }),
  getExpiryAnalysis: () => api.get('/inventory-enhanced/reports/expiry-analysis'),
  getStorageUtilization: () => api.get('/inventory-enhanced/reports/storage-utilization'),
  
  // Audit
  getAuditTrail: (itemId) => api.get(`/inventory-enhanced/audit/${itemId}`),
};

// Component-Unit Relationship APIs
export const relationshipAPI = {
  getUnitRelationships: (unitId) => api.get(`/relationships/unit/${unitId}`),
  getComponentRelationships: (componentId) => api.get(`/relationships/component/${componentId}`),
  getRelationshipTree: (itemId, itemType) => api.get(`/relationships/tree/${itemId}`, { params: { item_type: itemType } }),
  getBatchRelationships: (unitIds, componentIds) => api.get('/relationships/batch', { params: { unit_ids: unitIds, component_ids: componentIds } }),
};

// Configuration APIs
export const configAPI = {
  // Forms
  getForms: () => api.get('/config/forms'),
  getForm: (formName) => api.get(`/config/forms/${formName}`),
  updateForm: (formName, formSchema) => api.put(`/config/forms/${formName}`, formSchema),
  addFormField: (formName, field) => api.post(`/config/forms/${formName}/fields`, field),
  
  // Workflow Rules
  getRules: (params) => api.get('/config/rules', { params }),
  getRule: (ruleId) => api.get(`/config/rules/${ruleId}`),
  createRule: (rule) => api.post('/config/rules', rule),
  updateRule: (ruleId, rule) => api.put(`/config/rules/${ruleId}`, rule),
  duplicateRule: (ruleId) => api.post(`/config/rules/${ruleId}/duplicate`),
  toggleRule: (ruleId) => api.put(`/config/rules/${ruleId}/toggle`),
  deleteRule: (ruleId) => api.delete(`/config/rules/${ruleId}`),
  
  // Triggers
  getTriggers: (params) => api.get('/config/triggers', { params }),
  createTrigger: (trigger) => api.post('/config/triggers', trigger),
  toggleTrigger: (triggerId) => api.put(`/config/triggers/${triggerId}/toggle`),
  deleteTrigger: (triggerId) => api.delete(`/config/triggers/${triggerId}`),
  
  // Vehicles
  getVehicles: (params) => api.get('/config/vehicles', { params }),
  createVehicle: (vehicle) => api.post('/config/vehicles', vehicle),
  updateVehicle: (vehicleId, vehicle) => api.put(`/config/vehicles/${vehicleId}`, vehicle),
  toggleVehicle: (vehicleId) => api.put(`/config/vehicles/${vehicleId}/toggle`),
  
  // Courier Partners
  getCouriers: (params) => api.get('/config/couriers', { params }),
  createCourier: (courier) => api.post('/config/couriers', courier),
  updateCourier: (courierId, courier) => api.put(`/config/couriers/${courierId}`, courier),
  toggleCourier: (courierId) => api.put(`/config/couriers/${courierId}/toggle`),
  
  // System Settings
  getSettings: () => api.get('/config/settings'),
  updateSettings: (settings) => api.put('/config/settings', settings),
  
  // Audit Logs
  getAuditLogs: (params) => api.get('/config/audit-logs', { params }),
  
  // Enums
  getEnums: () => api.get('/config/enums'),
  
  // Custom Storage Types
  getStorageTypes: (params) => api.get('/config/storage-types', { params }),
  getStorageType: (typeCode) => api.get(`/config/storage-types/${typeCode}`),
  createStorageType: (data) => api.post('/config/storage-types', data),
  updateStorageType: (typeCode, data) => api.put(`/config/storage-types/${typeCode}`, data),
  toggleStorageType: (typeCode) => api.put(`/config/storage-types/${typeCode}/toggle`),
  deleteStorageType: (typeCode) => api.delete(`/config/storage-types/${typeCode}`),
};

// Enhanced Logistics APIs
export const logisticsEnhancedAPI = {
  createShipment: (data) => api.post('/logistics/shipments', data),
  getShipments: (params) => api.get('/logistics/shipments', { params }),
  getShipment: (id) => api.get(`/logistics/shipments/${id}`),
  dispatchShipment: (id) => api.put(`/logistics/shipments/${id}/dispatch`),
  addTrackingUpdate: (id, update) => api.post(`/logistics/shipments/${id}/tracking`, update),
  deliverShipment: (id, receivedBy, notes) => 
    api.put(`/logistics/shipments/${id}/deliver`, null, { params: { received_by: receivedBy, notes } }),
  logTemperature: (id, temperature, location) => 
    api.put(`/logistics/shipments/${id}/temperature`, null, { params: { temperature, location } }),
  publicTrack: (trackingNumber) => api.get(`/logistics/track/${trackingNumber}`),
  getDashboard: () => api.get('/logistics/dashboard'),
};

// Sensitive Actions API - Re-authentication for admin operations
export const sensitiveActionsAPI = {
  verifyPassword: (data) => api.post('/sensitive-actions/verify-password', data),
  requestOtp: (data) => api.post('/sensitive-actions/request-otp', data),
  verifyOtp: (data) => api.post('/sensitive-actions/verify-otp', data),
  validateToken: (token, actionType, targetId) => 
    api.post('/sensitive-actions/validate-token', null, { 
      params: { verification_token: token, action_type: actionType, target_id: targetId } 
    }),
  getActionLogs: (limit = 50) => api.get('/sensitive-actions/action-logs', { params: { limit } }),
};

export default api;
