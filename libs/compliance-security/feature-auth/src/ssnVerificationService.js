/**
 * SSN Verification Service
 * 
 * Integrates with SSA eCBSV (Electronic Consent Based SSN Verification) 
 * to verify patient identity before looking up medical records.
 * 
 * IMPORTANT: This service ONLY verifies SSN validity - it does NOT provide medical data.
 * For medical data, we need to use the verified SSN with other services like:
 * - Medicare/Medicaid APIs (for beneficiaries)
 * - Health Information Exchanges (HIEs)
 * - Insurance provider APIs
 * - EHR/EMR systems
 * 
 * Workflow:
 * 1. Verify SSN with SSA eCBSV (confirms identity)
 * 2. Use verified SSN to lookup MBI from Medicare
 * 3. Use MBI to retrieve medical data from CMS/insurance APIs
 */

const axios = require('axios');
const crypto = require('crypto');

// Add ServiceProxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class SSNVerificationService {
  constructor() {
    this.initialized = false;
    this.serviceToken = null;
    
    // SSA eCBSV endpoints
    this.endpoints = {
      production: 'https://api.ssa.gov/ecbsv/v1/verify',
      testing: 'https://ete.ssa.gov/ecbsv/v1/verify',
      oauth: 'https://api.ssa.gov/oauth/v2/token'
    };
    
    // Use testing environment in development
    this.useTestEnvironment = process.env.NODE_ENV === 'development';
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Authenticate service
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate('ssn-verification-service');
      
      // Get SSA API credentials from KMS
      try {
        const productionKMS = proxy.getService('productionKMS');
        this.ssaClientId = await productionKMS.getInternalKey('SSA_ECBSV_CLIENT_ID');
        this.ssaClientSecret = await productionKMS.getInternalKey('SSA_ECBSV_CLIENT_SECRET');
        this.ssaApiKey = await productionKMS.getInternalKey('SSA_ECBSV_API_KEY');
      } catch (e) {
        console.log('SSA eCBSV credentials not found - service will need configuration');
      }
      
      this.initialized = true;
      console.log('✅ SSN Verification Service initialized');
    } catch (error) {
      console.error('Failed to initialize SSN Verification Service:', error);
      this.initialized = true;
    }
  }

  /**
   * Get service context for database operations
   */
  getServiceContext(practiceId = 'global') {
    return {
      serviceId: 'ssn-verification-service',
      operation: 'database-access',
      practiceId: practiceId
    };
  }

  /**
   * Verify SSN with SSA eCBSV
   * This ONLY verifies identity - does NOT return medical data
   * 
   * @param {Object} params
   * @param {string} params.ssn - Social Security Number (9 digits)
   * @param {string} params.firstName - First name
   * @param {string} params.lastName - Last name
   * @param {string} params.dateOfBirth - Date of birth (YYYY-MM-DD)
   * @param {string} params.consentId - Consent record ID (required by SSA)
   * @returns {Object} Verification result
   */
  async verifySSN(params) {
    await this.initialize();
    
    try {
      // Format SSN (remove dashes/spaces)
      const formattedSSN = params.ssn.replace(/[-\s]/g, '');
      
      // Validate SSN format
      if (!/^\d{9}$/.test(formattedSSN)) {
        return {
          success: false,
          verified: false,
          message: 'Invalid SSN format'
        };
      }
      
      // Get OAuth token for SSA API
      const accessToken = await this.getSSAAccessToken();
      
      // Build verification request
      const verificationRequest = {
        ssn: formattedSSN,
        firstName: params.firstName.toUpperCase(),
        lastName: params.lastName.toUpperCase(),
        birthDate: this.formatDateForSSA(params.dateOfBirth),
        consentId: params.consentId || this.generateConsentId()
      };
      
      // Call SSA eCBSV API
      const endpoint = this.useTestEnvironment ? 
        this.endpoints.testing : 
        this.endpoints.production;
      
      const response = await axios.post(
        endpoint,
        verificationRequest,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-API-Key': this.ssaApiKey
          }
        }
      );
      
      // Process SSA response
      const result = {
        success: true,
        verified: response.data.verificationCode === 'YES',
        verificationCode: response.data.verificationCode,
        deathIndicator: response.data.deathIndicator || false,
        ssnValid: response.data.ssnValid !== false,
        nameMatch: response.data.nameMatch !== false,
        dobMatch: response.data.dobMatch !== false,
        message: this.getVerificationMessage(response.data),
        transactionId: response.data.transactionId,
        timestamp: new Date().toISOString()
      };
      
      // Log verification for audit
      await this.logVerification(params, result);
      
      return result;
      
    } catch (error) {
      console.error('SSN verification error:', error.response?.data || error.message);
      return {
        success: false,
        verified: false,
        message: 'SSN verification failed',
        error: error.message
      };
    }
  }

  /**
   * Get OAuth access token for SSA API
   */
  async getSSAAccessToken() {
    if (!this.ssaClientId || !this.ssaClientSecret) {
      throw new Error('SSA eCBSV credentials not configured');
    }
    
    try {
      const response = await axios.post(
        this.endpoints.oauth,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.ssaClientId,
          client_secret: this.ssaClientSecret,
          scope: 'ecbsv:verify'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      return response.data.access_token;
    } catch (error) {
      console.error('Failed to get SSA access token:', error);
      throw error;
    }
  }

  /**
   * Format date for SSA API (YYYYMMDD)
   */
  formatDateForSSA(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  /**
   * Generate consent ID for tracking
   */
  generateConsentId() {
    return 'CONSENT-' + Date.now() + '-' + crypto.randomBytes(8).toString('hex').toUpperCase();
  }

  /**
   * Get human-readable verification message
   */
  getVerificationMessage(data) {
    if (data.verificationCode === 'YES') {
      return 'SSN verified successfully';
    }
    
    const issues = [];
    if (data.ssnValid === false) issues.push('SSN not valid');
    if (data.nameMatch === false) issues.push('Name does not match');
    if (data.dobMatch === false) issues.push('Date of birth does not match');
    if (data.deathIndicator) issues.push('Death indicator present');
    
    return issues.length > 0 ? 
      `Verification failed: ${issues.join(', ')}` : 
      'Verification failed';
  }

  /**
   * Log verification attempt for audit
   */
  async logVerification(params, result) {
    try {
      const context = this.getServiceContext(params.practiceId || 'global');
      
      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      await SecureDataAccess.create('audit_logs', {
        action: 'SSN_VERIFICATION',
        userId: params.userId,
        timestamp: new Date(),
        metadata: {
          ssnLast4: params.ssn.slice(-4),
          verified: result.verified,
          verificationCode: result.verificationCode,
          transactionId: result.transactionId
        }
      }, context);
    } catch (error) {
      console.error('Failed to log SSN verification:', error);
    }
  }

  /**
   * Store consent record (required by SSA for 5 years)
   */
  async storeConsent(params) {
    const context = this.getServiceContext(params.practiceId || 'global');
    
    const consentRecord = {
      consentId: this.generateConsentId(),
      patientId: params.patientId,
      ssn: params.ssn, // Should be encrypted
      consentDate: new Date(),
      consentType: 'SSN_VERIFICATION',
      signature: params.signature,
      signatureType: params.signatureType || 'electronic',
      expirationDate: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000), // 5 years
      metadata: {
        purpose: params.purpose || 'Medical record lookup',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent
      }
    };
    
    const proxy = getServiceProxy();
    const SecureDataAccess = proxy.getService('secureDataAccess');
    await SecureDataAccess.create('consent_records', consentRecord, context);
    
    return consentRecord.consentId;
  }
}

module.exports = new SSNVerificationService();