// Agent Service Helpers - Common SecureDataAccess operations for all agent services
// These helpers ensure consistent and secure database access across all AI agents

const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');
const encryptionService = require('./encryptionService');

class AgentServiceHelpers {
  /**
   * Find a patient by ID or nationalId
   * @param {string} patientId - ObjectId or nationalId
   * @param {object} context - Security context with serviceId, apiKey, practiceId
   */
  static async findPatient(patientId, context) {
    try {
      // Check if it's a valid ObjectId format (24 hex chars)
      const filter = patientId.match(/^[0-9a-fA-F]{24}$/) 
        ? { _id: new ObjectId(patientId) }
        : { nationalId: patientId };
      
      const patients = await SecureDataAccess.query('patients', filter, {}, {
        ...context,
        apiKey: context.apiKey
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
  static async updatePatient(patientId, updates, context) {
    try {
      const filter = patientId.match(/^[0-9a-fA-F]{24}$/)
        ? { _id: new ObjectId(patientId) }  
        : { nationalId: patientId };
      
      // Ensure we use $set for updates
      const updateDoc = updates.$set ? updates : { $set: updates };
      
      return await SecureDataAccess.update('patients', filter, updateDoc, {
        ...context,
        apiKey: context.apiKey
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
  static async deletePatient(patientId, context) {
    try {
      const filter = patientId.match(/^[0-9a-fA-F]{24}$/)
        ? { _id: new ObjectId(patientId) }
        : { nationalId: patientId };
      
      return await SecureDataAccess.delete('patients', filter, {
        ...context,
        apiKey: context.apiKey
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
  static async findUser(userIdOrEmail, context) {
    try {
      const filter = userIdOrEmail.includes('@') 
        ? { email: userIdOrEmail }
        : { _id: new ObjectId(userIdOrEmail) };
      
      const users = await SecureDataAccess.query('users', filter, {}, {
        ...context,
        apiKey: context.apiKey
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
  static async updateUser(userId, updates, context) {
    try {
      const updateDoc = updates.$set ? updates : { $set: updates };
      const userObjectId = new ObjectId(userId);
      return await SecureDataAccess.update('users', { _id: userObjectId }, updateDoc, {
        ...context,
        apiKey: context.apiKey
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
  static async storeMemory(sessionId, memoryData, context) {
    try {
      return await SecureDataAccess.insert('agent_memory', {
        sessionId,
        ...memoryData,
        timestamp: new Date(),
        practiceId: context.practiceId
      }, {
        ...context,
        apiKey: context.apiKey
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
  static async getMemory(sessionId, context) {
    try {
      const memories = await SecureDataAccess.query('agent_memory', 
        { sessionId }, 
        { sort: { timestamp: -1 }, limit: 10 }, 
        {
          ...context,
          apiKey: context.apiKey
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
  static async storeSession(sessionId, sessionData, context) {
    try {
      // Check if session exists
      const existing = await SecureDataAccess.query('agent_sessions', 
        { sessionId }, 
        {}, 
        {
          ...context,
          apiKey: context.apiKey
        }
      );

      if (existing && existing.length > 0) {
        // Update existing session
        return await SecureDataAccess.update('agent_sessions', 
          { sessionId },
          { $set: { ...sessionData, updatedAt: new Date() } },
          {
            ...context,
            apiKey: context.apiKey
          }
        );
      } else {
        // Create new session
        return await SecureDataAccess.insert('agent_sessions', {
          sessionId,
          ...sessionData,
          createdAt: new Date(),
          practiceId: context.practiceId
        }, {
          ...context,
          apiKey: context.apiKey
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
  static async storeOAuthToken(userId, tokenData, context) {
    try {
      // Encrypt sensitive token data
      const encryptedAccessToken = await encryptionService.encrypt(
        tokenData.accessToken, 
        'auth'
      );
      
      const encryptedRefreshToken = tokenData.refreshToken 
        ? await encryptionService.encrypt(tokenData.refreshToken, 'auth')
        : null;

      return await SecureDataAccess.insert('oauth_tokens', {
        userId,
        provider: tokenData.provider || 'claude',
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: tokenData.expiresAt,
        scope: tokenData.scope,
        createdAt: new Date(),
        practiceId: context.practiceId
      }, {
        ...context,
        apiKey: context.apiKey
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
  static async createAppointment(appointmentData, context) {
    try {
      return await SecureDataAccess.insert('appointments', {
        ...appointmentData,
        createdAt: new Date(),
        practiceId: context.practiceId
      }, {
        ...context,
        apiKey: context.apiKey
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
  static async updateAppointment(appointmentId, updates, context) {
    try {
      const updateDoc = updates.$set ? updates : { $set: updates };
      const appointmentObjectId = new ObjectId(appointmentId);
      return await SecureDataAccess.update('appointments', 
        { _id: appointmentObjectId }, 
        updateDoc, 
        {
          ...context,
          apiKey: context.apiKey
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
  static async findAppointments(filter, options, context) {
    try {
      return await SecureDataAccess.query('appointments', filter, options, {
        ...context,
        apiKey: context.apiKey
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
  static async createAuditLog(auditData, context) {
    try {
      return await SecureDataAccess.insert('audit_logs', {
        ...auditData,
        timestamp: new Date(),
        practiceId: context.practiceId,
        serviceId: context.serviceId
      }, {
        ...context,
        apiKey: context.apiKey
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
  static async findAvailabilityBlocks(filter, options, context) {
    try {
      return await SecureDataAccess.query('availability_blocks', filter, options, {
        ...context,
        apiKey: context.apiKey
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
  static async createAvailabilityBlock(blockData, context) {
    try {
      return await SecureDataAccess.insert('availability_blocks', {
        ...blockData,
        createdAt: new Date(),
        practiceId: context.practiceId
      }, {
        ...context,
        apiKey: context.apiKey
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
  static async deleteAvailabilityBlock(blockId, context) {
    try {
      const blockObjectId = new ObjectId(blockId);
      return await SecureDataAccess.delete('availability_blocks', 
        { _id: blockObjectId }, 
        {
          ...context,
          apiKey: context.apiKey
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
  static buildSecurityContext(serviceId, serviceToken, practiceContext) {
    return {
      serviceId,
      apiKey: serviceToken?.apiKey || serviceToken,
      practiceId: practiceContext?.practiceId || 'global',
      userId: practiceContext?.currentUser?.id,
      practiceSubdomain: practiceContext?.practiceSubdomain
    };
  }
}

module.exports = AgentServiceHelpers;