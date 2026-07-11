const serviceAccountManager = require('./serviceAccountManager');
/**
 * 🔐 PATIENT CONSENT MANAGEMENT SERVICE
 * HIPAA-compliant consent tracking with full audit trail
 * Supports data sharing, research participation, and marketing consents
 */

const crypto = require('crypto');
const immutableAuditService = require('./immutableAuditService');
const encryptionService = require('./encryptionService');
const SecureDataAccess = require('./secureDataAccess');

class ConsentManagementService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    // Consent types with descriptions
    this.consentTypes = {
      DATA_SHARING: {
        code: 'data_sharing',
        description: {
          he: 'שיתוף נתונים רפואיים עם גורמים רפואיים אחרים',
          en: 'Share medical data with other healthcare providers'
        },
        required: false,
        defaultValue: false
      },
      RESEARCH: {
        code: 'research',
        description: {
          he: 'השתתפות במחקרים רפואיים אנונימיים',
          en: 'Participate in anonymous medical research'
        },
        required: false,
        defaultValue: false
      },
      MARKETING: {
        code: 'marketing',
        description: {
          he: 'קבלת מידע שיווקי ועדכונים על שירותים חדשים',
          en: 'Receive marketing information and updates about new services'
        },
        required: false,
        defaultValue: false
      },
      EMERGENCY_ACCESS: {
        code: 'emergency_access',
        description: {
          he: 'גישה לנתונים במקרי חירום רפואיים',
          en: 'Emergency medical access to data'
        },
        required: true,
        defaultValue: true
      },
      FAMILY_ACCESS: {
        code: 'family_access',
        description: {
          he: 'גישה של בני משפחה מורשים לנתונים רפואיים',
          en: 'Authorized family member access to medical data'
        },
        required: false,
        defaultValue: false
      },
      INSURANCE_SHARING: {
        code: 'insurance_sharing',
        description: {
          he: 'שיתוף נתונים עם חברות ביטוח',
          en: 'Share data with insurance companies'
        },
        required: false,
        defaultValue: false
      },
      LAB_RESULTS_SHARING: {
        code: 'lab_results_sharing',
        description: {
          he: 'שיתוף תוצאות בדיקות עם מעבדות חיצוניות',
          en: 'Share lab results with external laboratories'
        },
        required: false,
        defaultValue: true
      },
      TELEMEDICINE: {
        code: 'telemedicine',
        description: {
          he: 'השתתפות בביקורים רפואיים מרחוק',
          en: 'Participate in telemedicine visits'
        },
        required: false,
        defaultValue: true
      },
      AI_ANALYSIS: {
        code: 'ai_analysis',
        description: {
          he: 'ניתוח נתונים רפואיים באמצעות בינה מלאכותית',
          en: 'AI-powered analysis of medical data'
        },
        required: false,
        defaultValue: true
      },
      QUALITY_IMPROVEMENT: {
        code: 'quality_improvement',
        description: {
          he: 'שימוש בנתונים לשיפור איכות הטיפול',
          en: 'Use data for quality improvement purposes'
        },
        required: false,
        defaultValue: true
      }
    };

    // Consent storage (in production, this would be in MongoDB)
    this.consents = new Map();
    
    // Withdrawal reasons
    this.withdrawalReasons = {
      PRIVACY_CONCERN: { he: 'חששות פרטיות', en: 'Privacy concerns' },
      NO_LONGER_NEEDED: { he: 'לא נדרש יותר', en: 'No longer needed' },
      CHANGING_PROVIDER: { he: 'מעבר לספק שירות אחר', en: 'Changing provider' },
      DISSATISFIED: { he: 'חוסר שביעות רצון', en: 'Dissatisfied with service' },
      OTHER: { he: 'אחר', en: 'Other' }
    };
  }

  async initialize() {
    if (this.initialized) return;
    const serviceAccountManager = require('./serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('consent-management-service');
    this.initialized = true;
  }

  /**
   * Initialize consent management service with database
   */
  async initializeWithDb(db) {
    this.db = db;
    this.practiceId = db.databaseName?.replace('intellicare_practice_', '') || 'global';
    
    // Note: Indexes should be created at database initialization level
    // Not in service layer when using SecureDataAccess
    
    console.log('✅ Consent Management Service initialized');
  }

  /**
   * Grant consent for a specific type
   */
  async grantConsent(patientId, consentType, options = {}) {
    try {
      // Initialize if not already done
      if (!this.collection && options.practiceDb) {
        await this.initialize(options.practiceDb);
      }
      
      if (!this.practiceId && !this.db) {
        throw new Error('ConsentManagementService not initialized. Please provide practiceDb in options.');
      }

      const {
        grantedBy = patientId,
        ipAddress = null,
        userAgent = null,
        sessionId = null,
        practiceId = null,
        expiresAt = null,
        scope = 'full',
        conditions = {},
        authorizedParties = []
      } = options;

      // Validate consent type
      if (!this.consentTypes[consentType]) {
        throw new Error(`Invalid consent type: ${consentType}`);
      }

      const consentRecord = {
        id: crypto.randomUUID(),
        patientId,
        consentType: this.consentTypes[consentType].code,
        status: 'active',
        grantedAt: new Date(),
        grantedBy,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        scope,
        conditions,
        authorizedParties,
        metadata: {
          ipAddress,
          userAgent,
          sessionId,
          practiceId,
          version: '1.0'
        },
        history: [{
          action: 'granted',
          timestamp: new Date(),
          by: grantedBy,
          reason: 'Initial consent',
          metadata: { ipAddress, userAgent }
        }]
      };

      // Encrypt sensitive fields
      const encryptedConsent = {
        ...consentRecord,
        encryptedData: encryptionService.encrypt({
          authorizedParties,
          conditions,
          metadata: consentRecord.metadata
        }, 'phi')
      };

      // Store in database
      await this.collection.insertOne(encryptedConsent);

      // Log to immutable audit
      await immutableAuditService.addAuditEntry({
        eventType: 'consent_granted',
        userId: grantedBy,
        sessionId,
        clientIp: ipAddress,
        userAgent,
        details: `Consent granted for ${consentType}`,
        metadata: {
          patientId,
          consentType,
          consentId: consentRecord.id,
          scope,
          expiresAt
        }
      });

      return {
        success: true,
        consentId: consentRecord.id,
        message: {
          he: `הסכמה ל${this.consentTypes[consentType].description.he} ניתנה בהצלחה`,
          en: `Consent for ${this.consentTypes[consentType].description.en} granted successfully`
        }
      };
    } catch (error) {
      console.error('Error granting consent:', error);
      throw error;
    }
  }

  /**
   * Withdraw consent with full audit trail
   */
  async withdrawConsent(patientId, consentType, options = {}) {
    try {
      // Initialize if not already done
      if (!this.collection && options.practiceDb) {
        await this.initialize(options.practiceDb);
      }
      
      if (!this.practiceId && !this.db) {
        throw new Error('ConsentManagementService not initialized. Please provide practiceDb in options.');
      }

      const {
        withdrawnBy = patientId,
        reason = 'PRIVACY_CONCERN',
        details = '',
        ipAddress = null,
        userAgent = null,
        sessionId = null,
        immediate = true
      } = options;

      // Find active consent
      const context = {
        serviceId: 'consent-management-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'withdrawConsent',
        practiceId: this.practiceId || 'global'
      };
      const existingConsents = await SecureDataAccess.query('patient_consents', {
        patientId,
        consentType: this.consentTypes[consentType]?.code,
        status: 'active'
      }, { limit: 1 }, context);
      const existingConsent = existingConsents[0];

      if (!existingConsent) {
        throw new Error('No active consent found to withdraw');
      }

      // Update consent status
      const withdrawalRecord = {
        action: 'withdrawn',
        timestamp: new Date(),
        by: withdrawnBy,
        reason: this.withdrawalReasons[reason] || reason,
        details,
        metadata: { ipAddress, userAgent, immediate }
      };

      await this.collection.updateOne(
        { id: existingConsent.id },
        {
          $set: {
            status: 'withdrawn',
            withdrawnAt: new Date(),
            withdrawalReason: reason,
            withdrawalDetails: details
          },
          $push: {
            history: withdrawalRecord
          }
        }
      );

      // Log to immutable audit
      await immutableAuditService.addAuditEntry({
        eventType: 'consent_withdrawn',
        userId: withdrawnBy,
        sessionId,
        clientIp: ipAddress,
        userAgent,
        details: `Consent withdrawn for ${consentType}: ${reason}`,
        metadata: {
          patientId,
          consentType,
          consentId: existingConsent.id,
          reason,
          withdrawalDetails: details,
          immediate
        }
      });

      // If immediate withdrawal, trigger data deletion workflows
      if (immediate) {
        await this.triggerDataDeletionWorkflow(patientId, consentType);
      }

      return {
        success: true,
        message: {
          he: `ההסכמה בוטלה בהצלחה`,
          en: `Consent withdrawn successfully`
        },
        withdrawalId: crypto.randomUUID(),
        effectiveDate: immediate ? new Date() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      };
    } catch (error) {
      console.error('Error withdrawing consent:', error);
      throw error;
    }
  }

  /**
   * Check if patient has active consent for a specific type
   */
  async hasConsent(patientId, consentType, options = {}) {
    try {
      // Initialize if not already done
      if (!this.collection && options.practiceDb) {
        await this.initialize(options.practiceDb);
      }
      
      if (!this.practiceId && !this.db) {
        throw new Error('ConsentManagementService not initialized. Please provide practiceDb in options.');
      }

      const { checkExpiry = true, scope = null } = options;

      const checkContext = {
        serviceId: 'consent-management-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'hasActiveConsent',
        practiceId: this.practiceId || 'global'
      };
      const consents = await SecureDataAccess.query('patient_consents', {
        patientId,
        consentType: this.consentTypes[consentType]?.code,
        status: 'active'
      }, { limit: 1 }, checkContext);
      const consent = consents[0];

      if (!consent) {
        return false;
      }

      // Check expiry
      if (checkExpiry && consent.expiresAt && new Date(consent.expiresAt) < new Date()) {
        // Mark as expired
        await this.collection.updateOne(
          { id: consent.id },
          { $set: { status: 'expired' } }
        );
        return false;
      }

      // Check scope if specified
      if (scope && consent.scope !== 'full' && consent.scope !== scope) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking consent:', error);
      return false;
    }
  }

  /**
   * Get all consents for a patient
   */
  async getPatientConsents(patientId, options = {}) {
    try {
      // Initialize if not already done
      if (!this.collection && options.practiceDb) {
        await this.initialize(options.practiceDb);
      }
      
      if (!this.practiceId && !this.db) {
        throw new Error('ConsentManagementService not initialized. Please provide practiceDb in options.');
      }

      const { includeHistory = false, activeOnly = false } = options;

      const query = { patientId };
      if (activeOnly) {
        query.status = 'active';
      }

      const context = {
        serviceId: 'consent-management-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'getPatientConsents',
        practiceId: this.practiceId || 'global'
      };
      const consents = await SecureDataAccess.query('patient_consents', query, {}, context);

      // Decrypt sensitive data
      const decryptedConsents = consents.map(consent => {
        if (consent.encryptedData) {
          const decrypted = encryptionService.decrypt(consent.encryptedData);
          return {
            ...consent,
            authorizedParties: decrypted.authorizedParties,
            conditions: decrypted.conditions,
            metadata: decrypted.metadata,
            history: includeHistory ? consent.history : undefined
          };
        }
        return consent;
      });

      return decryptedConsents;
    } catch (error) {
      console.error('Error getting patient consents:', error);
      throw error;
    }
  }

  /**
   * Update consent conditions or scope
   */
  async updateConsent(consentId, updates, options = {}) {
    try {
      // Initialize if not already done
      if (!this.collection && options.practiceDb) {
        await this.initialize(options.practiceDb);
      }
      
      if (!this.practiceId && !this.db) {
        throw new Error('ConsentManagementService not initialized. Please provide practiceDb in options.');
      }

      const {
        updatedBy,
        reason,
        ipAddress = null,
        userAgent = null,
        sessionId = null
      } = options;

      const context = {
        serviceId: 'consent-management-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'verifyConsent',
        practiceId: this.practiceId || 'global'
      };
      const consents = await SecureDataAccess.query('patient_consents', { id: consentId }, { limit: 1 }, context);
      const consent = consents[0];
      if (!consent) {
        throw new Error('Consent not found');
      }

      // Prepare update
      const updateRecord = {
        action: 'updated',
        timestamp: new Date(),
        by: updatedBy,
        reason,
        changes: updates,
        metadata: { ipAddress, userAgent }
      };

      // Apply updates
      const updateQuery = {
        $set: {
          ...updates,
          lastModified: new Date()
        },
        $push: {
          history: updateRecord
        }
      };

      await this.collection.updateOne({ id: consentId }, updateQuery);

      // Log to audit
      await immutableAuditService.addAuditEntry({
        eventType: 'consent_updated',
        userId: updatedBy,
        sessionId,
        clientIp: ipAddress,
        userAgent,
        details: `Consent updated: ${reason}`,
        metadata: {
          consentId,
          updates,
          patientId: consent.patientId
        }
      });

      return {
        success: true,
        message: {
          he: 'ההסכמה עודכנה בהצלחה',
          en: 'Consent updated successfully'
        }
      };
    } catch (error) {
      console.error('Error updating consent:', error);
      throw error;
    }
  }

  /**
   * Bulk consent management for multiple types
   */
  async manageBulkConsents(patientId, consentSettings, options = {}) {
    try {
      const results = [];
      
      for (const [consentType, granted] of Object.entries(consentSettings)) {
        if (granted) {
          const result = await this.grantConsent(patientId, consentType, options);
          results.push(result);
        } else {
          const hasConsent = await this.hasConsent(patientId, consentType);
          if (hasConsent) {
            const result = await this.withdrawConsent(patientId, consentType, options);
            results.push(result);
          }
        }
      }

      return {
        success: true,
        message: {
          he: 'הגדרות ההסכמה עודכנו בהצלחה',
          en: 'Consent settings updated successfully'
        },
        results
      };
    } catch (error) {
      console.error('Error managing bulk consents:', error);
      throw error;
    }
  }

  /**
   * Get consent audit trail
   */
  async getConsentAuditTrail(patientId, options = {}) {
    try {
      const { startDate, endDate, consentType } = options;

      // Search immutable audit logs
      const auditCriteria = {
        eventType: /^consent_/,
        details: patientId,
        startDate,
        endDate
      };

      const auditResults = await immutableAuditService.searchAuditLogs(auditCriteria);

      // Filter by consent type if specified
      let filteredResults = auditResults.results;
      if (consentType) {
        filteredResults = filteredResults.filter(
          entry => entry.metadata?.consentType === consentType
        );
      }

      return {
        patientId,
        auditTrail: filteredResults,
        totalEvents: filteredResults.length,
        integrityVerified: auditResults.integrityVerified
      };
    } catch (error) {
      console.error('Error getting consent audit trail:', error);
      throw error;
    }
  }

  /**
   * Export consent records for compliance
   */
  async exportConsentRecords(patientId, format = 'json') {
    try {
      const consents = await this.getPatientConsents(patientId, { includeHistory: true });
      const auditTrail = await this.getConsentAuditTrail(patientId);

      const exportData = {
        exportDate: new Date().toISOString(),
        patientId,
        consents,
        auditTrail: auditTrail.auditTrail,
        integrityVerified: auditTrail.integrityVerified
      };

      if (format === 'pdf') {
        // In production, use a PDF generation library
        return this.generateConsentPDF(exportData);
      }

      return exportData;
    } catch (error) {
      console.error('Error exporting consent records:', error);
      throw error;
    }
  }

  /**
   * Trigger data deletion workflow for withdrawn consent
   */
  async triggerDataDeletionWorkflow(patientId, consentType) {
    try {
      // This would integrate with data retention policies
      // For now, we'll log the intention
      await immutableAuditService.addAuditEntry({
        eventType: 'data_deletion_requested',
        userId: 'system',
        details: `Data deletion workflow triggered for withdrawn consent`,
        metadata: {
          patientId,
          consentType,
          requestedAt: new Date()
        }
      });

      // In production, this would:
      // 1. Identify all data covered by the consent
      // 2. Schedule deletion based on legal requirements
      // 3. Notify relevant systems
      // 4. Generate compliance report

      return true;
    } catch (error) {
      console.error('Error triggering data deletion:', error);
      throw error;
    }
  }

  /**
   * Check consent compliance status
   */
  async checkComplianceStatus(patientId) {
    try {
      const consents = await this.getPatientConsents(patientId, { activeOnly: true });
      
      const requiredConsents = Object.entries(this.consentTypes)
        .filter(([_, type]) => type.required)
        .map(([key, _]) => key);

      const activeConsentTypes = consents.map(c => c.consentType);
      const missingRequired = requiredConsents.filter(
        required => !activeConsentTypes.includes(this.consentTypes[required].code)
      );

      return {
        compliant: missingRequired.length === 0,
        missingRequired,
        activeConsents: activeConsentTypes,
        totalConsents: consents.length,
        lastReview: consents.reduce((latest, consent) => {
          const consentDate = new Date(consent.grantedAt);
          return consentDate > latest ? consentDate : latest;
        }, new Date(0))
      };
    } catch (error) {
      console.error('Error checking compliance status:', error);
      throw error;
    }
  }

  /**
   * Generate consent form for patient signature
   */
  async generateConsentForm(patientId, consentTypes, language = 'en') {
    try {
      const formData = {
        formId: crypto.randomUUID(),
        generatedAt: new Date(),
        patientId,
        language,
        consentSections: []
      };

      for (const consentType of consentTypes) {
        const typeConfig = this.consentTypes[consentType];
        if (!typeConfig) continue;

        formData.consentSections.push({
          type: consentType,
          description: typeConfig.description[language],
          required: typeConfig.required,
          legalText: this.getConsentLegalText(consentType, language)
        });
      }

      // In production, this would generate a PDF or HTML form
      return formData;
    } catch (error) {
      console.error('Error generating consent form:', error);
      throw error;
    }
  }

  /**
   * Get legal text for consent type
   */
  getConsentLegalText(consentType, language = 'en') {
    const legalTexts = {
      DATA_SHARING: {
        he: 'אני מסכים/ה לשתף את המידע הרפואי שלי עם ספקי שירותי בריאות אחרים לצורך המשך טיפול.',
        en: 'I consent to share my medical information with other healthcare providers for continuity of care.'
      },
      RESEARCH: {
        he: 'אני מסכים/ה שהמידע הרפואי שלי ישמש למחקר רפואי באופן אנונימי.',
        en: 'I consent to my medical information being used for anonymous medical research.'
      },
      MARKETING: {
        he: 'אני מסכים/ה לקבל מידע שיווקי ועדכונים על שירותים חדשים.',
        en: 'I consent to receive marketing information and updates about new services.'
      }
    };

    return legalTexts[consentType]?.[language] || '';
  }
}

// Singleton instance
const consentManagementService = new ConsentManagementService();

module.exports = consentManagementService;