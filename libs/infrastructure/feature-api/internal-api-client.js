/**
 * InternalApiClient - Secure client for service-to-service communication
 * 
 * This client is specifically designed for internal service communication
 * with enhanced security features and automatic service discovery
 */

const config = require('../../../backend/config/default.json');

// Add ServiceProxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class InternalApiClient {
  constructor(serviceId) {
    this.serviceId = serviceId;
    this.baseUrl = process.env.INTERNAL_API_URL || `http://localhost:${process.env.PORT || 5000}`;
    this.initialized = false;
    this.serviceToken = null;
    this.httpClient = null;
  }

  /**
   * Initialize the client with service authentication
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Authenticate service and get token
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Create secure HTTP client with service credentials
      const { SecureHttpClient } = proxy.getService('secureHttpClient');
      this.httpClient = new SecureHttpClient({
        serviceId: this.serviceId,
        apiKey: this.serviceToken.apiKey,
        maxRetries: 5,
        timeout: 60000, // 60 seconds for internal calls
        enableEncryption: true,
        enableSigning: true,
        enableAudit: true,
        maxRequestsPerMinute: 500 // Higher limit for internal services
      });
      
      this.initialized = true;
      
      // Set up token refresh
      this.setupTokenRefresh();
    } catch (error) {
      console.error(`Failed to initialize InternalApiClient for ${this.serviceId}:`, error);
      throw new Error('Service authentication failed');
    }
  }

  /**
   * Set up automatic token refresh
   */
  setupTokenRefresh() {
    // Refresh token every 23 hours (tokens expire in 24 hours)
    setInterval(async () => {
      try {
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.refreshToken(this.serviceId);
        this.httpClient.apiKey = this.serviceToken.apiKey;
      } catch (error) {
        console.error('Token refresh failed:', error);
      }
    }, 23 * 60 * 60 * 1000);
  }

  /**
   * Ensure client is initialized
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Build full URL
   */
  buildUrl(path) {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    return `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  /**
   * Add service headers
   */
  buildHeaders(headers = {}) {
    return {
      ...headers,
      'X-Service-ID': this.serviceId,
      'X-Service-Token': this.serviceToken?.token,
      'X-Internal-Request': 'true',
      'Authorization': `Bearer ${this.serviceToken?.token}`
    };
  }

  /**
   * Make internal API request
   */
  async request(method, path, data = null, options = {}) {
    await this.ensureInitialized();
    
    const url = this.buildUrl(path);
    const headers = this.buildHeaders(options.headers);
    
    try {
      const response = await this.httpClient.request({
        method,
        url,
        body: data,
        headers,
        ...options
      });
      
      // Handle different response formats
      if (response.status >= 200 && response.status < 300) {
        return {
          success: true,
          data: response.data,
          status: response.status,
          headers: response.headers
        };
      } else {
        throw new Error(`Internal API error: ${response.status} - ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      console.error(`Internal API request failed: ${method} ${path}`, error);
      throw error;
    }
  }

  /**
   * Service-specific endpoints
   */
  
  // Patient management
  async getPatient(patientId, practiceId) {
    return this.request('GET', `/api/internal/patients/${patientId}`, null, {
      headers: { 'X-Practice-ID': practiceId }
    });
  }

  async updatePatient(patientId, practiceId, data) {
    return this.request('PUT', `/api/internal/patients/${patientId}`, data, {
      headers: { 'X-Practice-ID': practiceId }
    });
  }

  async searchPatients(practiceId, query) {
    return this.request('POST', '/api/internal/patients/search', query, {
      headers: { 'X-Practice-ID': practiceId }
    });
  }

  // Document management
  async uploadDocument(practiceId, patientId, document) {
    return this.request('POST', '/api/internal/documents/upload', {
      practiceId,
      patientId,
      document
    });
  }

  async getDocument(documentId, practiceId) {
    return this.request('GET', `/api/internal/documents/${documentId}`, null, {
      headers: { 'X-Practice-ID': practiceId }
    });
  }

  // AI services
  async processWithAI(serviceType, data, practiceId) {
    return this.request('POST', `/api/internal/ai/${serviceType}`, data, {
      headers: { 'X-Practice-ID': practiceId }
    });
  }

  // Audit and monitoring
  async logAuditEvent(event) {
    return this.request('POST', '/api/internal/audit/log', event);
  }

  async getServiceHealth(serviceId) {
    return this.request('GET', `/api/internal/health/${serviceId}`);
  }

  // Security operations
  async validatePermission(serviceId, resource, action) {
    return this.request('POST', '/api/internal/security/validate-permission', {
      serviceId,
      resource,
      action
    });
  }

  async reportSecurityEvent(event) {
    return this.request('POST', '/api/internal/security/report-event', event);
  }

  // Cache operations
  async getFromCache(key) {
    return this.request('GET', `/api/internal/cache/${key}`);
  }

  async setCache(key, value, ttl = 3600) {
    return this.request('POST', '/api/internal/cache', { key, value, ttl });
  }

  async invalidateCache(pattern) {
    return this.request('DELETE', '/api/internal/cache', { pattern });
  }

  // Batch operations
  async batchRequest(operations) {
    return this.request('POST', '/api/internal/batch', { operations });
  }

  /**
   * Convenience methods
   */
  async get(path, options = {}) {
    return this.request('GET', path, null, options);
  }

  async post(path, data, options = {}) {
    return this.request('POST', path, data, options);
  }

  async put(path, data, options = {}) {
    return this.request('PUT', path, data, options);
  }

  async patch(path, data, options = {}) {
    return this.request('PATCH', path, data, options);
  }

  async delete(path, options = {}) {
    return this.request('DELETE', path, null, options);
  }

  /**
   * Service discovery
   */
  async discoverService(serviceName) {
    try {
      const response = await this.request('GET', `/api/internal/discovery/${serviceName}`);
      return response.data;
    } catch (error) {
      console.error(`Service discovery failed for ${serviceName}:`, error);
      return null;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const response = await this.request('GET', '/api/internal/health');
      return response.data;
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Metrics reporting
   */
  async reportMetrics(metrics) {
    return this.request('POST', '/api/internal/metrics', metrics);
  }
}

/**
 * Factory function to create service-specific clients
 */
function createInternalClient(serviceId) {
  return new InternalApiClient(serviceId);
}

/**
 * Pre-configured clients for common services
 */
const clients = {
  diagnostic: () => createInternalClient('diagnostic-service'),
  agent: () => createInternalClient('agent-service'),
  document: () => createInternalClient('document-service'),
  audit: () => createInternalClient('audit-service'),
  security: () => createInternalClient('security-service'),
  notification: () => createInternalClient('notification-service'),
  patient: () => createInternalClient('patient-service'),
  appointment: () => createInternalClient('appointment-service'),
  billing: () => createInternalClient('billing-service'),
  analytics: () => createInternalClient('analytics-service')
};

module.exports = {
  InternalApiClient,
  createInternalClient,
  clients
};