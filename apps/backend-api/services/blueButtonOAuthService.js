/**
 * Blue Button 2.0 OAuth Service
 * REAL implementation for CMS Medicare data access
 * 
 * This is the ACTUAL OAuth flow - no mocks!
 * User must log in with their Medicare.gov credentials
 */

const axios = require('axios');
const crypto = require('crypto');
const serviceAccountManager = require('./serviceAccountManager');
const productionKMS = require('./productionKMS');
const SecureDataAccess = require('./secureDataAccess');

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

  /**
   * Generate PKCE code verifier and challenge (required by CMS Blue Button v2)
   */
  generatePKCE() {
    // Generate a random code verifier (43-128 chars, URL-safe)
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    // SHA256 hash it for the challenge
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    return { codeVerifier, codeChallenge };
  }

  /**
   * Step 1: Generate authorization URL for user to log in
   * User will be redirected to Medicare.gov to authenticate
   */
  async getAuthorizationUrl(redirectUri, state = null) {
    await this.initialize();

    if (!state) {
      state = crypto.randomBytes(32).toString('hex');
    }

    // PKCE is required by CMS Blue Button v2
    const { codeVerifier, codeChallenge } = this.generatePKCE();

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      // Request all available scopes
      scope: 'profile patient/Patient.read patient/Coverage.read patient/ExplanationOfBenefit.read'
    });

    const authUrl = `${this.endpoints[this.environment].authorize}?${params.toString()}`;

    // Store state + code_verifier for verification and token exchange
    await this.storeOAuthState(state, redirectUri, codeVerifier);

    return {
      authUrl,
      state,
      message: 'Redirect user to this URL to log in with Medicare.gov'
    };
  }

  /**
   * Step 2: Exchange authorization code for access token
   * Called after user approves and is redirected back
   */
  async exchangeCodeForToken(code, redirectUri, state) {
    await this.initialize();

    // Verify state to prevent CSRF and retrieve PKCE code_verifier
    const stateResult = await this.verifyOAuthState(state, redirectUri);
    if (!stateResult.valid) {
      throw new Error('Invalid OAuth state - possible CSRF attack');
    }

    try {
      const tokenParams = {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret
      };
      // Include PKCE code_verifier if available
      if (stateResult.codeVerifier) {
        tokenParams.code_verifier = stateResult.codeVerifier;
      }

      const response = await axios.post(
        this.endpoints[this.environment].token,
        new URLSearchParams(tokenParams),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      // Log token response fields for debugging
      console.log('🔵 CMS Token Response fields:', Object.keys(response.data));
      console.log('🔵 CMS Token scope:', response.data.scope);
      console.log('🔵 CMS Token patient field:', response.data.patient);

      const tokenData = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
        scope: response.data.scope,
        patientId: response.data.patient, // May be undefined - BB 2.0 returns this in userinfo instead
        timestamp: new Date().toISOString()
      };

      // Get user info to complete profile AND get patient FHIR ID
      const userInfo = await this.getUserInfo(tokenData.accessToken);
      tokenData.userInfo = userInfo;

      // Patient ID: try token response first, then userInfo (but NOT email-like sub)
      if (!tokenData.patientId && userInfo) {
        if (userInfo.patient) {
          tokenData.patientId = userInfo.patient;
        } else if (userInfo.fhirId) {
          tokenData.patientId = userInfo.fhirId;
        } else if (userInfo.sub && !userInfo.sub.includes('@')) {
          // Only use sub if it's a FHIR ID, not an email address
          tokenData.patientId = userInfo.sub;
        }
        console.log('🔵 Patient ID from userInfo:', tokenData.patientId || 'NOT FOUND - will discover from /Patient/');
      }
      console.log('🔵 Final patientId:', tokenData.patientId || 'unknown - will call /Patient/ to discover');

      // Store token securely
      await this.storeTokens(tokenData);

      return {
        success: true,
        patientId: tokenData.patientId,
        accessToken: response.data.access_token, // Raw token for immediate use
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
      
      console.log('🔵 UserInfo response fields:', Object.keys(response.data));
      return {
        sub: response.data.sub, // Unique beneficiary ID
        patient: response.data.patient, // FHIR patient ID (from BB 2.0 userinfo)
        fhirId: response.data.fhir_id, // Alternative FHIR ID field
        name: response.data.name,
        givenName: response.data.given_name,
        familyName: response.data.family_name,
        email: response.data.email,
      };
    } catch (error) {
      console.error('Failed to get user info:', error);
      return null;
    }
  }

  /**
   * Step 4: Get patient demographics from FHIR
   */
  async getPatientDemographics(accessToken, patientId) {
    try {
      // Always call /Patient/ (token-scoped) — CMS BB 2.0 sandbox may not provide patientId
      // The bearer token scopes the request to the authenticated beneficiary
      const url = `${this.endpoints[this.environment].fhir}/Patient/`;
      console.log('🔵 Calling /Patient/ (token-scoped, patientId hint:', patientId || 'none', ')');

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/fhir+json'
        }
      });

      // Response is a Bundle — extract first entry (the authenticated patient)
      let patient = response.data;
      if (patient.resourceType === 'Bundle' && patient.entry?.length > 0) {
        patient = patient.entry[0].resource;
        console.log('🔵 Extracted patient from Bundle, FHIR id:', patient.id);
      } else if (patient.resourceType === 'Patient') {
        console.log('🔵 Direct Patient resource, FHIR id:', patient.id);
      }
      
      return {
        id: patient.id,
        mbi: patient.identifier?.find(id => id.system?.includes('mbi'))?.value,
        name: {
          given: patient.name?.[0]?.given,
          family: patient.name?.[0]?.family
        },
        birthDate: patient.birthDate,
        gender: patient.gender,
        address: patient.address?.[0] ? {
          line: patient.address[0].line,
          city: patient.address[0].city,
          state: patient.address[0].state,
          postalCode: patient.address[0].postalCode,
          country: patient.address[0].country || 'USA'
        } : null,
        telecom: patient.telecom?.map(t => ({
          system: t.system,
          value: t.value
        })),
        race: patient.extension?.find(e => e.url?.includes('race'))?.valueCodeableConcept?.coding?.[0]?.display,
        ethnicity: patient.extension?.find(e => e.url?.includes('ethnicity'))?.valueCodeableConcept?.coding?.[0]?.display
      };
    } catch (error) {
      console.error('Failed to get patient demographics:', error);
      throw error;
    }
  }

  /**
   * Step 5: Get coverage information
   */
  async getCoverage(accessToken, patientId) {
    try {
      const params = {};
      if (patientId) params.patient = patientId;

      const response = await axios.get(
        `${this.endpoints[this.environment].fhir}/Coverage`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/fhir+json'
          },
          params
        }
      );
      
      const coverages = response.data.entry?.map(entry => {
        const coverage = entry.resource;
        return {
          id: coverage.id,
          status: coverage.status,
          type: coverage.type?.coding?.[0]?.display,
          beneficiary: coverage.beneficiary?.reference,
          period: coverage.period,
          payor: coverage.payor?.[0]?.display
        };
      }) || [];
      
      return coverages;
    } catch (error) {
      console.error('Failed to get coverage:', error);
      return [];
    }
  }

  /**
   * Step 6: Get claims (Explanation of Benefits)
   */
  async getClaims(accessToken, patientId, count = 10) {
    try {
      const params = { _count: count, _sort: '-created' };
      if (patientId) params.patient = patientId;

      const response = await axios.get(
        `${this.endpoints[this.environment].fhir}/ExplanationOfBenefit`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/fhir+json'
          },
          params
        }
      );
      
      const claims = response.data.entry?.map(entry => {
        const eob = entry.resource;
        return {
          id: eob.id,
          status: eob.status,
          type: eob.type?.coding?.[0]?.display,
          use: eob.use,
          created: eob.created,
          provider: eob.provider?.display,
          diagnosis: eob.diagnosis?.map(d => ({
            sequence: d.sequence,
            code: d.diagnosisCodeableConcept?.coding?.[0]?.code,
            display: d.diagnosisCodeableConcept?.coding?.[0]?.display
          })),
          procedure: eob.procedure?.map(p => ({
            sequence: p.sequence,
            code: p.procedureCodeableConcept?.coding?.[0]?.code,
            display: p.procedureCodeableConcept?.coding?.[0]?.display,
            date: p.date
          })),
          total: eob.total?.map(t => ({
            category: t.category?.coding?.[0]?.display,
            amount: t.amount
          }))
        };
      }) || [];
      
      return claims;
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
   * Store OAuth state for CSRF protection + PKCE code_verifier
   */
  async storeOAuthState(state, redirectUri, codeVerifier = null) {
    const context = {
      serviceId: 'blue-button-oauth-service',
      operation: 'storeOAuthState',
      practiceId: 'global',
      apiKey: this.serviceToken
    };

    const doc = {
      state: state,
      redirectUri: redirectUri,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes (match import session TTL)
    };
    if (codeVerifier) doc.codeVerifier = codeVerifier;

    await SecureDataAccess.insert('oauth_states', doc, context);
  }

  /**
   * Verify OAuth state and return stored data (including code_verifier for PKCE)
   */
  async verifyOAuthState(state, redirectUri) {
    const context = {
      serviceId: 'blue-button-oauth-service',
      operation: 'verifyOAuthState',
      practiceId: 'global',
      apiKey: this.serviceToken
    };

    const storedState = await SecureDataAccess.query('oauth_states', {
      state: state,
      redirectUri: redirectUri,
      expiresAt: { $gt: new Date() }
    }, {}, context);

    if (storedState && storedState.length > 0) {
      const record = storedState[0];
      // Delete used state
      await SecureDataAccess.delete('oauth_states', { state: state }, context);
      return { valid: true, codeVerifier: record.codeVerifier || null };
    }

    return { valid: false, codeVerifier: null };
  }

  /**
   * Store tokens securely
   */
  async storeTokens(tokenData) {
    const context = {
      serviceId: 'blue-button-oauth-service',
      operation: 'storeTokens',
      practiceId: 'global',
      apiKey: this.serviceToken
    };
    
    // Encrypt sensitive tokens
    const encryptionService = require('./encryptionService');
    tokenData.accessToken = await encryptionService.encrypt(tokenData.accessToken, 'phi');
    if (tokenData.refreshToken) {
      tokenData.refreshToken = await encryptionService.encrypt(tokenData.refreshToken, 'phi');
    }
    
    await SecureDataAccess.insert('medicare_tokens', tokenData, context);
  }
}

module.exports = new BlueButtonOAuthService();