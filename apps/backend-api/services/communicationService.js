/**
 * CommunicationService
 *
 * Domain: communication
 * Extracted from: agentServiceV4.js
 * Functions: 4
 *
 * Purpose: Orchestrate communication operations (delegates to external APIs)
 *
 * Architecture:
 * - Uses SecureDataAccess for all database operations (no HTTP calls)
 * - Practice-aware multi-tenant isolation
 * - Proper error handling and logging
 * - Service authentication via ServiceAccountManager
 */

const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const { ObjectId } = require('mongodb');

class CommunicationService {
  constructor() {
    this.serviceName = 'communicationService';
    this.serviceAuth = null;
  }

  /**
   * Initialize service with authentication
   */
  async initialize() {
    if (!this.serviceAuth) {
      this.serviceAuth = await serviceAccountManager.authenticate(this.serviceName);
      console.log(`✅ ${this.serviceName} authenticated successfully`);
    }
    return this.serviceAuth;
  }

  /**
   * Create secure context for database operations
   * @param {Object} practiceContext - Practice context from request
   * @param {string} operation - Operation name
   * @returns {Object} Security context
   */
  createSecureContext(practiceContext, operation) {
    return {
      serviceId: this.serviceName,
      operation: operation,
      practiceId: practiceContext?.subdomain || practiceContext?.practiceId || practiceContext?.id || 'global',
      apiKey: this.serviceAuth?.apiKey || this.serviceAuth
    };
  }

  /**
   * Normalize practice context to ensure consistent format
   * @param {Object} practiceContext - Raw practice context
   * @returns {Object} Normalized practice context
   */
  normalizePracticeContext(practiceContext) {
    if (!practiceContext) {
      return { id: 'global', subdomain: 'global' };
    }

    return {
      id: practiceContext.practiceId || practiceContext.id || 'global',
      subdomain: practiceContext.subdomain || practiceContext.practiceSubdomain || 'global',
      name: practiceContext.name || practiceContext.practiceName,
      language: practiceContext.language || 'en'
    };
  }

  // ============================================================================
  // SERVICE FUNCTIONS - EXTRACTED FROM agentServiceV4.js
  // ============================================================================

async sendTestResultNotifications(params, practiceContext, session) {
    try {
      const { patientId, testType, method = 'email' } = params;
      const isHebrew = session.language === 'he';
      
      // Build query for lab results
      let query = { practiceId: practiceContext.practiceSubdomain || practiceContext.practiceId, status: 'completed' };
      
      if (patientId) {
        query.patientId = patientId;
      }
      
      if (testType) {
        query.testType = testType;
      }
      
      // Only get results that haven't been notified yet
      query.notificationSent = { $ne: true };
      
      const labResults = await SecureDataAccess.query(
        'lab_results',
        query,
        { limit: 100, sort: { createdAt: -1 } },
        {
          serviceId: this.serviceToken || 'agent-service',
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: practiceContext.practiceId
        }
      );
      
      if (labResults.length === 0) {
        return {
          success: true,
          message: isHebrew 
            ? 'לא נמצאו תוצאות בדיקות החדשות'
            : 'No new test results found',
          sent: 0
        };
      }
      
      let sent = 0;
      const errors = [];
      
      for (const result of labResults) {
        try {
          // Get patient details
          const patientResults = await SecureDataAccess.query(
            'patients',
            { _id: result.patientId }, { limit: 1 },
            {
              serviceId: this.serviceToken || 'agent-service',
              apiKey: this.serviceToken?.apiKey || this.serviceToken,
              practiceId: practiceContext.practiceSubdomain || practiceContext.practiceId
            }
          );

          const patient = patientResults[0];
          
          if (!patient) continue;
          
          const notificationMessage = isHebrew 
            ? `תוצאות הבדיקה שלך מוכנות. אנא צרו קשר עם הקליניקה לקבלת פרטים נוספים.`
            : `Your test results are ready. Please contact the practice for more details.`;
          
          // Send notification based on method
          if ((method === 'sms' || method === 'both') && patient.phone) {
            await this.callAPI('/communication/sms', 'POST', {
              patientId: patient._id,
              message: notificationMessage,
              type: 'test_results'
            }, practiceContext);
            sent++;
          }
          
          if ((method === 'email' || method === 'both') && patient.email) {
            await this.callAPI('/communication/email', 'POST', {
              patientId: patient._id,
              subject: isHebrew ? 'תוצאות בדיקה מוכנות' : 'Test Results Available',
              body: notificationMessage
            }, practiceContext);
            sent++;
          }
          
          // Mark as notified
          await SecureDataAccess.update(
            'lab_results',
            { _id: result._id },
            { notificationSent: true, notificationSentAt: new Date() },
            {
              serviceId: this.serviceToken || 'agent-service',
              apiKey: this.serviceToken?.apiKey || this.serviceToken,
              practiceId: practiceContext.practiceSubdomain || practiceContext.practiceId
            }
          );
          
        } catch (error) {
          errors.push({
            resultId: result._id,
            error: error.message
          });
        }
      }
      
      return {
        success: true,
        message: isHebrew 
          ? `נשלחו ${sent} התראות תוצאות בדיקות`
          : `Sent ${sent} test result notifications`,
        sent,
        totalResults: labResults.length,
        errors: errors.length > 0 ? errors : undefined
      };
      
    } catch (error) {
      console.error('Error sending test result notifications:', error);
      return {
        success: false,
        message: session.language === 'he' 
          ? 'שגיאה בשליחת התראות תוצאות' 
          : 'Error sending test result notifications',
        error: error.message
      };
    }
  }

}

module.exports = new CommunicationService();
