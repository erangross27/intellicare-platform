/**
 * Agent Service Helpers - DDD Architecture
 * Common SecureDataAccess operations for all agent services
 * These helpers ensure consistent and secure database access across all AI agents
 * Location: libs/ai-analytics/feature-claude/agent-service-helpers.js
 */

const path = require('path');

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class AgentServiceHelpersService {
  constructor() {
    this.initialized = false;
    this.serviceName = 'agent-service-helpers';
    this.serviceToken = null;
    this.secureDataAccess = null;
    this.encryptionService = null;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Get service proxy
      const proxy = getServiceProxy();
      
      // Authenticate service account
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceName);
      
      // Load dependencies
      this.secureDataAccess = proxy.getService('secureDataAccess');
      this.encryptionService = proxy.getService('encryptionService');
      
      this.initialized = true;
      console.log('✅ AgentServiceHelpers initialized successfully');
    } catch (error) {
      console.error('❌ AgentServiceHelpers initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Find a patient by ID or nationalId
   * @param {string} patientId - ObjectId or nationalId
   * @param {object} context - Security context with serviceId, apiKey, practiceId
   */
  async findPatient(patientId, context) {
    await this.initialize();
    
    try {
      // Check if it's a valid ObjectId format (24 hex chars)
      const filter = patientId.match(/^[0-9a-fA-F]{24}$/) 
        ? { _id: patientId }
        : { nationalId: patientId };
      
      const patients = await this.secureDataAccess.query('patients', filter, {}, {
        serviceId: this.serviceName,
        operation: 'findPatient',
        practiceId: context.practiceId || 'global',
        apiKey: this.serviceToken?.apiKey || context.apiKey
      });
      return patients[0] || null;
    } catch (error) {
      console.error('Error finding patient:', error);
      throw error;
    }
  }

  /**
   * Update a patient record
   * @param {string} patientId - ObjectId or nationalId
   * @param {object} updates - Fields to update
   * @param {object} context - Security context
   */
  async updatePatient(patientId, updates, context) {
    await this.initialize();
    
    try {
      const filter = patientId.match(/^[0-9a-fA-F]{24}$/)
        ? { _id: patientId }  
        : { nationalId: patientId };
      
      // Ensure we use $set for updates
      const updateDoc = updates.$set ? updates : { $set: updates };
      
      return await this.secureDataAccess.update('patients', filter, updateDoc, {
        serviceId: this.serviceName,
        operation: 'updatePatient',
        practiceId: context.practiceId || 'global',
        apiKey: this.serviceToken?.apiKey || context.apiKey
      });
    } catch (error) {
      console.error('Error updating patient:', error);
      throw error;
    }
  }

  /**
   * Delete a patient record
   * @param {string} patientId - ObjectId or nationalId
   * @param {object} context - Security context
   */
  async deletePatient(patientId, context) {
    await this.initialize();
    
    try {
      const filter = patientId.match(/^[0-9a-fA-F]{24}$/)
        ? { _id: patientId }
        : { nationalId: patientId };
      
      return await this.secureDataAccess.delete('patients', filter, {
        serviceId: this.serviceName,
        operation: 'deletePatient',
        practiceId: context.practiceId || 'global',
        apiKey: this.serviceToken?.apiKey || context.apiKey
      });
    } catch (error) {
      console.error('Error deleting patient:', error);
      throw error;
    }
  }

  /**
   * Find a user by ID or email
   * @param {string} userIdOrEmail - ObjectId or email
   * @param {object} context - Security context
   */
  async findUser(userIdOrEmail, context) {
    await this.initialize();
    
    try {
      const filter = userIdOrEmail.includes('@') 
        ? { email: userIdOrEmail }
        : { _id: userIdOrEmail };
      
      const users = await this.secureDataAccess.query('users', filter, {}, {
        serviceId: this.serviceName,
        operation: 'findUser',
        practiceId: context.practiceId || 'global',
        apiKey: this.serviceToken?.apiKey || context.apiKey
      });
      return users[0] || null;
    } catch (error) {
      console.error('Error finding user:', error);
      throw error;
    }
  }

  /**
   * Update a user record
   * @param {string} userId - User ObjectId
   * @param {object} updates - Fields to update
   * @param {object} context - Security context
   */
  async updateUser(userId, updates, context) {
    await this.initialize();
    
    try {
      const updateDoc = updates.$set ? updates : { $set: updates };
      return await this.secureDataAccess.update('users', { _id: userId }, updateDoc, {
        serviceId: this.serviceName,
        operation: 'updateUser',
        practiceId: context.practiceId || 'global',
        apiKey: this.serviceToken?.apiKey || context.apiKey
      });
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Store agent memory/context
   * @param {string} sessionId - Session identifier
   * @param {object} memoryData - Memory data to store
   * @param {object} context - Security context
   */
  async storeMemory(sessionId, memoryData, context) {
    await this.initialize();
    
    try {
      return await this.secureDataAccess.create('agent_memory', {
        sessionId,
        ...memoryData,
        timestamp: new Date(),
        practiceId: context.practiceId || 'global'
      }, {
        serviceId: this.serviceName,
        operation: 'storeMemory',
        practiceId: context.practiceId || 'global',
        apiKey: this.serviceToken?.apiKey || context.apiKey
      });
    } catch (error) {
      console.error('Error storing agent memory:', error);
      throw error;
    }
  }

  /**
   * Retrieve agent memory
   * @param {string} sessionId - Session identifier
   * @param {object} context - Security context
   */
  async getMemory(sessionId, context) {
    await this.initialize();
    
    try {
      const memories = await this.secureDataAccess.query('agent_memory', 
        { sessionId }, 
        { sort: { timestamp: -1 }, limit: 10 }, 
        {
          serviceId: this.serviceName,
          operation: 'getMemory',
          practiceId: context.practiceId || 'global',
          apiKey: this.serviceToken?.apiKey || context.apiKey
        }
      );
      return memories;
    } catch (error) {
      console.error('Error retrieving agent memory:', error);
      throw error;
    }
  }

  /**
   * Store agent session data
   * @param {string} sessionId - Session identifier
   * @param {object} sessionData - Session data to store
   * @param {object} context - Security context
   */
  async storeSession(sessionId, sessionData, context) {
    await this.initialize();
    
    try {
      // Check if session exists
      const existing = await this.secureDataAccess.query('agent_sessions', 
        { sessionId }, 
        {}, 
        {
          serviceId: this.serviceName,
          operation: 'checkSession',
          practiceId: context.practiceId || 'global',
          apiKey: this.serviceToken?.apiKey || context.apiKey
        }
      );

      if (existing && existing.length > 0) {
        // Update existing session
        return await this.secureDataAccess.update('agent_sessions', 
          { sessionId },
          { $set: { ...sessionData, updatedAt: new Date() } },
          {
            serviceId: this.serviceName,
            operation: 'updateSession',
            practiceId: context.practiceId || 'global',
            apiKey: this.serviceToken?.apiKey || context.apiKey
          }
        );
      } else {
        // Create new session
        return await this.secureDataAccess.create('agent_sessions', {
          sessionId,
          ...sessionData,
          createdAt: new Date(),
          practiceId: context.practiceId || 'global'
        }, {
          serviceId: this.serviceName,
          operation: 'createSession',
          practiceId: context.practiceId || 'global',
          apiKey: this.serviceToken?.apiKey || context.apiKey
        });
      }
    } catch (error) {
      console.error('Error storing agent session:', error);
      throw error;
    }
  }

  /**
   * Store OAuth token securely (encrypted)
   * @param {string} userId - User ID
   * @param {object} tokenData - OAuth token data
   * @param {object} context - Security context
   */
  async storeOAuthToken(userId, tokenData, context) {
    await this.initialize();
    
    try {
      // Encrypt sensitive token data
      const encryptedAccessToken = await this.encryptionService.encrypt(
        tokenData.accessToken, 
        'auth'
      );
      
      const encryptedRefreshToken = tokenData.refreshToken 
        ? await this.encryptionService.encrypt(tokenData.refreshToken, 'auth')
        : null;

      return await this.secureDataAccess.create('oauth_tokens', {
        userId,
        provider: tokenData.provider || 'claude',
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: tokenData.expiresAt,
        scope: tokenData.scope,
        createdAt: new Date(),
        practiceId: context.practiceId || 'global'
      }, {
        serviceId: this.serviceName,
        operation: 'storeOAuthToken',
        practiceId: context.practiceId || 'global',
        apiKey: this.serviceToken?.apiKey || context.apiKey
      });
    } catch (error) {
      console.error('Error storing OAuth token:', error);
      throw error;
    }
  }

  /**
   * Create an appointment
   * @param {object} appointmentData - Appointment details
   * @param {object} context - Security context
   */
  async createAppointment(appointmentData, context) {
    await this.initialize();
    
    try {
      return await this.secureDataAccess.create('appointments', {
        ...appointmentData,
        createdAt: new Date(),
        practiceId: context.practiceId || 'global'
      }, {
        serviceId: this.serviceName,
        operation: 'createAppointment',
        practiceId: context.practiceId || 'global',
        apiKey: this.serviceToken?.apiKey || context.apiKey
      });
    } catch (error) {
      console.error('Error creating appointment:', error);
      throw error;
    }
  }

  /**
   * Update an appointment
   * @param {string} appointmentId - Appointment ID
   * @param {object} updates - Fields to update
   * @param {object} context - Security context
   */
  async updateAppointment(appointmentId, updates, context) {
    await this.initialize();
    
    try {
      const updateDoc = updates.$set ? updates : { $set: updates };
      return await this.secureDataAccess.update('appointments', 
        { _id: appointmentId }, 
        updateDoc, 
        {
          serviceId: this.serviceName,
          operation: 'updateAppointment',
          practiceId: context.practiceId || 'global',
          apiKey: this.serviceToken?.apiKey || context.apiKey
        }
      );
    } catch (error) {
      console.error('Error updating appointment:', error);
      throw error;
    }
  }

  /**
   * Find appointments by filter
   * @param {object} filter - Query filter
   * @param {object} options - Query options
   * @param {object} context - Security context
   */
  async findAppointments(filter, options, context) {
    await this.initialize();
    
    try {
      return await this.secureDataAccess.query('appointments', filter, options, {
        serviceId: this.serviceName,
        operation: 'findAppointments',
        practiceId: context.practiceId || 'global',
        apiKey: this.serviceToken?.apiKey || context.apiKey
      });
    } catch (error) {
      console.error('Error finding appointments:', error);
      throw error;
    }
  }

  /**
   * Create an audit log entry
   * @param {object} auditData - Audit log details
   * @param {object} context - Security context
   */
  async createAuditLog(auditData, context) {
    await this.initialize();
    
    try {
      return await this.secureDataAccess.create('audit_logs', {
        ...auditData,
        timestamp: new Date(),
        practiceId: context.practiceId || 'global',
        serviceId: this.serviceName
      }, {
        serviceId: this.serviceName,
        operation: 'createAuditLog',
        practiceId: context.practiceId || 'global',
        apiKey: this.serviceToken?.apiKey || context.apiKey
      });
    } catch (error) {
      console.error('Error creating audit log:', error);
      throw error;
    }
  }

  /**
   * Find availability blocks
   * @param {object} filter - Query filter
   * @param {object} options - Query options
   * @param {object} context - Security context
   */
  async findAvailabilityBlocks(filter, options, context) {
    await this.initialize();
    
    try {
      return await this.secureDataAccess.query('availability_blocks', filter, options, {
        serviceId: this.serviceName,
        operation: 'findAvailabilityBlocks',
        practiceId: context.practiceId || 'global',
        apiKey: this.serviceToken?.apiKey || context.apiKey
      });
    } catch (error) {
      console.error('Error finding availability blocks:', error);
      throw error;
    }
  }

  /**
   * Create an availability block
   * @param {object} blockData - Availability block details
   * @param {object} context - Security context
   */
  async createAvailabilityBlock(blockData, context) {
    await this.initialize();
    
    try {
      return await this.secureDataAccess.create('availability_blocks', {
        ...blockData,
        createdAt: new Date(),
        practiceId: context.practiceId || 'global'
      }, {
        serviceId: this.serviceName,
        operation: 'createAvailabilityBlock',
        practiceId: context.practiceId || 'global',
        apiKey: this.serviceToken?.apiKey || context.apiKey
      });
    } catch (error) {
      console.error('Error creating availability block:', error);
      throw error;
    }
  }

  /**
   * Delete an availability block
   * @param {string} blockId - Block ID
   * @param {object} context - Security context
   */
  async deleteAvailabilityBlock(blockId, context) {
    await this.initialize();
    
    try {
      return await this.secureDataAccess.delete('availability_blocks', 
        { _id: blockId }, 
        {
          serviceId: this.serviceName,
          operation: 'deleteAvailabilityBlock',
          practiceId: context.practiceId || 'global',
          apiKey: this.serviceToken?.apiKey || context.apiKey
        }
      );
    } catch (error) {
      console.error('Error deleting availability block:', error);
      throw error;
    }
  }

  /**
   * Build security context for SecureDataAccess
   * @param {string} serviceId - Service identifier
   * @param {string} serviceToken - Service authentication token
   * @param {object} practiceContext - Practice context from request
   */
  buildSecurityContext(serviceId, serviceToken, practiceContext) {
    return {
      serviceId: serviceId || this.serviceName,
      apiKey: serviceToken?.apiKey || serviceToken || this.serviceToken?.apiKey,
      practiceId: practiceContext?.practiceId || practiceContext?.practice?.id || 'global',
      userId: practiceContext?.currentUser?.id || practiceContext?.user?.id,
      practiceSubdomain: practiceContext?.practiceSubdomain || practiceContext?.subdomain,
      operation: 'helper-operation'
    };
  }

  /**
   * Get patients with pagination
   * @param {object} filter - Query filter
   * @param {object} options - Query options (limit, skip, sort)
   * @param {object} context - Security context
   */
  async getPatients(filter = {}, options = {}, context) {
    await this.initialize();
    
    try {
      const defaultOptions = {
        limit: options.limit || 50,
        skip: options.skip || 0,
        sort: options.sort || { lastName: 1, firstName: 1 }
      };

      return await this.secureDataAccess.query('patients', filter, defaultOptions, {
        serviceId: this.serviceName,
        operation: 'getPatients',
        practiceId: context.practiceId || 'global',
        apiKey: this.serviceToken?.apiKey || context.apiKey
      });
    } catch (error) {
      console.error('Error getting patients:', error);
      throw error;
    }
  }

  /**
   * Search patients by name or national ID
   * @param {string} searchTerm - Search term
   * @param {object} context - Security context
   */
  async searchPatients(searchTerm, context) {
    await this.initialize();
    
    try {
      const filter = {
        $or: [
          { firstName: { $regex: searchTerm, $options: 'i' } },
          { lastName: { $regex: searchTerm, $options: 'i' } },
          { nationalId: searchTerm }
        ]
      };

      return await this.secureDataAccess.query('patients', filter, { limit: 20 }, {
        serviceId: this.serviceName,
        operation: 'searchPatients',
        practiceId: context.practiceId || 'global',
        apiKey: this.serviceToken?.apiKey || context.apiKey
      });
    } catch (error) {
      console.error('Error searching patients:', error);
      throw error;
    }
  }

  // Service metadata
  getServiceInfo() {
    return {
      serviceName: this.serviceName,
      version: '2.0.0',
      architecture: 'DDD',
      location: 'libs/ai-analytics/feature-claude/agent-service-helpers.js',
      initialized: this.initialized,
      availableMethods: [
        'findPatient', 'updatePatient', 'deletePatient',
        'findUser', 'updateUser',
        'storeMemory', 'getMemory',
        'storeSession', 'storeOAuthToken',
        'createAppointment', 'updateAppointment', 'findAppointments',
        'createAuditLog',
        'findAvailabilityBlocks', 'createAvailabilityBlock', 'deleteAvailabilityBlock',
        'buildSecurityContext', 'getPatients', 'searchPatients'
      ]
    };
  }

  // Health check
  async healthCheck() {
    await this.initialize();
    
    return {
      status: 'healthy',
      service: this.serviceName,
      initialized: this.initialized,
      serviceToken: !!this.serviceToken,
      secureDataAccess: !!this.secureDataAccess,
      encryptionService: !!this.encryptionService,
      timestamp: new Date()
    };
  }
}

// Create instance
const agentServiceHelpers = new AgentServiceHelpersService();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('agentServiceHelpers', () => agentServiceHelpers);
}

module.exports = agentServiceHelpers;