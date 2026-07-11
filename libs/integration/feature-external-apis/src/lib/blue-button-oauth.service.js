/**
 * Blue Button 2.0 OAuth Service
 * REAL implementation for CMS Medicare data access
 * SECURITY: All database access through SecureDataAccess
 */

const axios = require('axios');
const crypto = require('crypto');
const serviceAccountManager = require('../../../../../backend/services/serviceAccountManager');
const productionKMS = require('../../../../../backend/services/productionKMS');
const SecureDataAccess = require('../../../../../backend/services/secureDataAccess');

class BlueButtonOAuthService {
  constructor() {
    this.initialized = false;
    this.serviceToken = null;
    
    // REAL CMS Blue Button endpoints
    this.endpoints = {
      sandbox: {
        authorize: 'https://sandbox.bluebutton.cms.gov/v2/o/authorize/',
        token: 'https://sandbox.bluebutton.cms.gov/v2/o/token/',
        userinfo: 'https://sandbox.bluebutton.cms.gov/v2/connect/userinfo',
        fhir: 'https://sandbox.bluebutton.cms.gov/v2/fhir'
      },
      production: {
        authorize: 'https://api.bluebutton.cms.gov/v2/o/authorize/',
        token: 'https://api.bluebutton.cms.gov/v2/o/token/',
        userinfo: 'https://api.bluebutton.cms.gov/v2/connect/userinfo',
        fhir: 'https://api.bluebutton.cms.gov/v2/fhir'
      }
    };
    
    // Use sandbox for development
    this.environment = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox';
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('blue-button-oauth-service');
      
      // Get OAuth credentials from KMS
      this.clientId = await productionKMS.getInternalKey('BLUE_BUTTON_CLIENT_ID');
      this.clientSecret = await productionKMS.getInternalKey('BLUE_BUTTON_CLIENT_SECRET');
      
      this.initialized = true;
      console.log('✅ Blue Button OAuth Service initialized');
    } catch (error) {
      console.error('Blue Button OAuth initialization failed:', error);
      throw new Error('Blue Button OAuth not configured. Please register at https://sandbox.bluebutton.cms.gov/');
    }
  }

  getServiceContext(practiceId = 'global', operation = 'blue-button-oauth') {
    return {
      serviceId: 'blue-button-oauth-service',
      operation,
      practiceId
    };
  }

  /**
   * Step 1: Generate authorization URL for user to log in
   */
  async getAuthorizationUrl(redirectUri, state = null) {
    await this.initialize();
    
    if (!state) {
      state = crypto.randomBytes(32).toString('hex');
    }
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state: state,
      scope: 'profile patient/Patient.read patient/Coverage.read patient/ExplanationOfBenefit.read'
    });
    
    const authUrl = `${this.endpoints[this.environment].authorize}?${params.toString()}`;
    
    // Store state for verification
    await this.storeOAuthState(state, redirectUri);
    
    return {
      authUrl,
      state,
      message: 'Redirect user to this URL to log in with Medicare.gov'
    };
  }

  /**
   * Step 2: Exchange authorization code for access token
   */
  async exchangeCodeForToken(code, redirectUri, state) {
    await this.initialize();
    
    // Verify state to prevent CSRF
    const isValidState = await this.verifyOAuthState(state, redirectUri);
    if (!isValidState) {
      throw new Error('Invalid OAuth state - possible CSRF attack');
    }
    
    try {
      const response = await axios.post(
        this.endpoints[this.environment].token,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri,
          client_id: this.clientId,
          client_secret: this.clientSecret
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      const tokenData = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
        scope: response.data.scope,
        patientId: response.data.patient,
        timestamp: new Date().toISOString()
      };
      
      // Get user info to complete profile
      const userInfo = await this.getUserInfo(tokenData.accessToken);
      tokenData.userInfo = userInfo;
      
      // Store token securely
      await this.storeTokens(tokenData);
      
      return {
        success: true,
        patientId: tokenData.patientId,
        userInfo: userInfo,
        message: 'Successfully authenticated with Medicare'
      };
      
    } catch (error) {
      console.error('Token exchange failed:', error.response?.data || error);
      throw new Error('Failed to authenticate with Medicare');
    }
  }

  /**
   * Step 3: Get user information
   */
  async getUserInfo(accessToken) {
    try {
      const response = await axios.get(
        this.endpoints[this.environment].userinfo,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
      
      return {
        sub: response.data.sub,
        name: response.data.name,
        givenName: response.data.given_name,
        familyName: response.data.family_name,
        email: response.data.email
      };
    } catch (error) {
      console.error('Failed to get user info:', error);
      return null;
    }
  }

  /**
   * Get patient demographics from FHIR
   */
  async getPatientDemographics(accessToken, patientId) {
    try {
      const response = await axios.get(
        `${this.endpoints[this.environment].fhir}/Patient/${patientId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/fhir+json'
          }
        }
      );
      
      const patient = response.data;
      
      return {
        id: patient.id,
        mbi: patient.identifier?.find(id => id.system?.includes('mbi'))?.value,
        name: {
          given: patient.name?.[0]?.given,
          family: patient.name?.[0]?.family
        },
        birthDate: patient.birthDate,
        gender: patient.gender,
        address: patient.address?.[0],
        telecom: patient.telecom
      };
    } catch (error) {
      console.error('Failed to get patient demographics:', error);
      throw error;
    }
  }

  /**
   * Get coverage information
   */
  async getCoverage(accessToken, patientId) {
    try {
      const response = await axios.get(
        `${this.endpoints[this.environment].fhir}/Coverage`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/fhir+json'
          },
          params: {
            patient: patientId
          }
        }
      );
      
      return response.data.entry?.map(entry => entry.resource) || [];
    } catch (error) {
      console.error('Failed to get coverage:', error);
      return [];
    }
  }

  /**
   * Get claims (Explanation of Benefits)
   */
  async getClaims(accessToken, patientId, count = 10) {
    try {
      const response = await axios.get(
        `${this.endpoints[this.environment].fhir}/ExplanationOfBenefit`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/fhir+json'
          },
          params: {
            patient: patientId,
            _count: count,
            _sort: '-created'
          }
        }
      );
      
      return response.data.entry?.map(entry => entry.resource) || [];
    } catch (error) {
      console.error('Failed to get claims:', error);
      return [];
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken) {
    await this.initialize();
    
    try {
      const response = await axios.post(
        this.endpoints[this.environment].token,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || refreshToken,
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Store OAuth state for CSRF protection
   */
  async storeOAuthState(state, redirectUri) {
    await SecureDataAccess.create('oauth_states', {
      state: state,
      redirectUri: redirectUri,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    }, this.getServiceContext('global', 'store-oauth-state'));
  }

  /**
   * Verify OAuth state
   */
  async verifyOAuthState(state, redirectUri) {
    const storedStates = await SecureDataAccess.query('oauth_states', {
      state: state,
      redirectUri: redirectUri,
      expiresAt: { $gt: new Date() }
    }, {}, this.getServiceContext('global', 'verify-oauth-state'));
    
    if (storedStates && storedStates.length > 0) {
      // Delete used state
      await SecureDataAccess.delete('oauth_states', { state: state }, {}, this.getServiceContext('global', 'delete-used-state'));
      return true;
    }
    
    return false;
  }

  /**
   * Store tokens securely
   */
  async storeTokens(tokenData) {
    // Encrypt sensitive tokens
    const encryptionService = require('../../../../../backend/services/encryptionService');
    tokenData.accessToken = await encryptionService.encrypt(tokenData.accessToken, 'phi');
    if (tokenData.refreshToken) {
      tokenData.refreshToken = await encryptionService.encrypt(tokenData.refreshToken, 'phi');
    }
    
    await SecureDataAccess.create('medicare_tokens', tokenData, this.getServiceContext('global', 'store-tokens'));
  }
}

module.exports = BlueButtonOAuthService;