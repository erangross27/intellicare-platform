// Auth API utility functions - MIGRATED TO SECURE API
// 🔒 SECURITY: This file now uses secureApiClient for all requests
import secureApi from '../services/secureApiClient';

import secureStorage from '../utils/secureStorage';
const authAPI = {
  login: async (userData) => {
    // Clear any expired sessions first
    secureStorage.removeItem('token');
    secureStorage.removeItem('user');
    secureStorage.removeItem('tokenTimestamp');
    
    // SECURE API: Login request
    const response = await secureApi.post('/auth/login', userData);
    
    if (response.error) {
      throw new Error(response.error.errors?.[0]?.msg || response.error.message || 'Login failed');
    }
    
    return response;
  },
  
  signup: async (userData) => {
    // SECURE API: Signup request
    const response = await secureApi.post('/auth/signup', userData);
    
    if (response.error) {
      throw new Error(response.error.errors?.[0]?.msg || response.error.message || 'Signup failed');
    }
    
    return response;
  },
  
  practiceLogin: async (userData, practiceSubdomain) => {
    // SECURE API: Practice login with subdomain header
    const response = await secureApi.post('/practice-auth/login', userData, {
      headers: {
        'x-practice-subdomain': practiceSubdomain
      }
    });
    
    if (response.error) {
      throw new Error(response.error.errors?.[0]?.msg || response.error.message || 'Login failed');
    }
    
    return response;
  },
  
  updateLanguage: async (language) => {
    // SECURE API: Update user language preference
    const response = await secureApi.put('/practice-auth/language', { language });
    
    if (response.error) {
      throw new Error(response.error.message || 'Failed to update language');
    }
    
    return response;
  },
  
  getUserClinics: async (email) => {
    // SECURE API: Get practices for user
    const response = await secureApi.post('/practice-auth/user-practices', { email });
    
    if (response.error) {
      throw new Error(response.error.message || 'Failed to get practices');
    }
    
    return response;
  },
  
  validatePractice: async (subdomain) => {
    // SECURE API: Validate practice subdomain
    const response = await secureApi.get(`/practice-auth/validate/${subdomain}`);
    
    if (response.error) {
      throw new Error(response.error.message || 'Invalid practice');
    }
    
    return response;
  }
};

export default authAPI;