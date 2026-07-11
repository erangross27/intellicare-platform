/**
 * 🔒 SECURE API MIGRATION
 * 
 * This file provides secure versions of all API calls.
 * It uses secureApiClient for all requests.
 * 
 * MIGRATION GUIDE:
 * 1. Replace: import { authAPI } from './api';
 *    With:    import { authAPI } from './apiMigration';
 * 
 * 2. All function signatures remain the same
 * 3. Security headers are automatically added
 */

import secureApi from './secureApiClient';

// Auth API - Secure version with session management
export const authAPI = {
  // Legacy single-tenant auth (for backward compatibility)
  signup: (userData) => secureApi.post('/api/auth/signup', userData),
  login: (userData) => secureApi.post('/api/auth/login', userData),

  // New practice-aware authentication - FIXED PATHS
  practiceLogin: (userData, practiceSubdomain) => {
    return secureApi.post('/api/practice-auth/login', userData, {
      headers: {
        'x-practice-subdomain': practiceSubdomain
      }
    });
  },

  clinicSignup: (userData, practiceSubdomain) => {
    return secureApi.post('/api/practice-auth/signup', userData, {
      headers: {
        'x-practice-subdomain': practiceSubdomain
      }
    });
  },

  // Self-registration to existing practice
  selfRegister: (userData) => secureApi.post('/api/practice-auth/self-register', userData),

  // Create new practice with admin user
  createPractice: (practiceData) => secureApi.post('/api/practices/create', practiceData),

  // ✅ NEW SESSION ENDPOINTS - REAL SECURITY
  sessionCheck: () => secureApi.get('/api/practice-auth/session-check'),
  logout: () => secureApi.post('/api/practice-auth/logout'),
  refreshSession: () => secureApi.post('/api/practice-auth/refresh-session'),
  setSessionCookie: (sessionToken) => secureApi.post('/api/practice-auth/session-from-token', { sessionToken }),

  // Get available practices for user
  getUserClinics: (email) => secureApi.post('/api/practice-auth/user-practices', { email }),

  // Validate practice subdomain
  validatePractice: (subdomain) => secureApi.get(`/api/practice-auth/validate/${subdomain}`),

  // Update language (practice-aware)
  updateLanguage: (language) => secureApi.put('/api/practice-auth/language', { language }),

  // Get current user and practice info (uses session validation)
  getCurrentUserAndPractice: () => secureApi.get('/api/practice-auth/session-check'),

  // Passwordless auth - FIXED ENDPOINTS
  requestMagicLink: (email, practiceId) => 
    secureApi.post('/api/passwordless-auth/request-login', { email, practiceId }),
  
  verifyMagicLink: ({ token, userId, practice }) => 
    secureApi.post('/api/passwordless-auth/magic-login', { token, userId, practice })
};

// Patient API - REMOVED: Now handled by Claude functions (listAllPatients, getPatient, etc.)

// Deleted Patients API - REMOVED: Now handled by Claude functions

// Diagnosis API - REMOVED: Now handled by Claude functions

// Documents API - REMOVED: Now handled by Claude functions

// Medical API - REMOVED: Now handled by Claude functions

// MFA API - Secure version
export const mfaAPI = {
  getStatus: () => secureApi.get('/api/mfa/status'),
  setup: () => secureApi.post('/api/mfa/setup'),
  enable: (token) => secureApi.post('/api/mfa/enable', { token }),
  disable: (token) => secureApi.post('/api/mfa/disable', { token }),
  verify: (token) => secureApi.post('/api/mfa/verify', { token }),
  getBackupCodes: () => secureApi.get('/api/mfa/backup-codes'),
  regenerateBackupCodes: () => secureApi.post('/api/mfa/regenerate-backup-codes')
};

// Chat API - Secure version
export const chatAPI = {
  sendMessage: (message, sessionId) => secureApi.post('/api/agent/chat', { message, sessionId }),
  getChatHistory: (sessionId) => secureApi.get(`/api/agent/history/${sessionId}`),
  startSession: () => secureApi.post('/api/agent/session'),
  endSession: (sessionId) => secureApi.post(`/api/agent/session/${sessionId}/end`)
};

// Security API - Secure version
export const securityAPI = {
  getSecurityDashboard: () => secureApi.get('/api/security-monitoring/dashboard'),
  getSecurityLogs: (params) => secureApi.get('/api/security-monitoring/logs', { params }),
  getThreatStatus: () => secureApi.get('/api/security-monitoring/threats'),
  // REMOVED: getComplianceStatus - endpoint deleted from backend
  // getComplianceStatus: () => secureApi.get('/api/compliance/status'),
  runSecurityScan: () => secureApi.post('/api/security-monitoring/scan'),
  exportSecurityReport: (format) => secureApi.get(`/api/security-monitoring/export?format=${format}`)
};

// Address APIs - REMOVED: These endpoints have been deleted from backend
// If address functionality is needed in the future, implement via Claude functions
// export const streetsAPI = {
//   getStreets: (city) => secureApi.get(`/api/streets/city/${encodeURIComponent(city)}`),
//   searchStreets: (query) => secureApi.get(`/api/streets/search?q=${encodeURIComponent(query)}`)
// };

// export const postalCodesAPI = {
//   getPostalCode: (city, street) =>
//     secureApi.get(`/api/postal-codes/${encodeURIComponent(city)}/${encodeURIComponent(street)}`),
//   validatePostalCode: (code) => secureApi.get(`/api/postal-codes/validate/${code}`)
// };

// export const addressAPI = {
//   searchAddress: (query) => secureApi.post('/api/addresses/search', { query }),
//   validateAddress: (address) => secureApi.post('/api/addresses/validate', address),
//   getCities: () => secureApi.get('/api/addresses/cities'),
//   getStreetsForCity: (city) => secureApi.get(`/api/addresses/streets/${encodeURIComponent(city)}`),
//   getPostalCode: (city, street) =>
//     secureApi.get(`/api/addresses/postal-code/${encodeURIComponent(city)}/${encodeURIComponent(street)}`)
// };

// Cost Tracking API - Secure version
export const costAPI = {
  getCurrentCost: () => secureApi.get('/api/cost-tracking/current'),
  getCostHistory: (period) => secureApi.get(`/api/cost-tracking/history?period=${period}`),
  getCostByService: () => secureApi.get('/api/cost-tracking/by-service'),
  resetCost: () => secureApi.post('/api/cost-tracking/reset')
};

// User Management API - REMOVED: Now handled by Claude functions

// Practice Management API - REMOVED: Now handled by Claude functions

// Export default for easy migration
export default {
  authAPI,
  mfaAPI,
  chatAPI,
  securityAPI,
  // REMOVED: streetsAPI, postalCodesAPI, addressAPI - endpoints deleted
  costAPI
};