/**
 * Patient Registration Confirmation Module
 * Handles final confirmation and database persistence of patient registration
 */

// ServiceProxy setup for dependency management
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class PatientRegistrationConfirmation {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    // Authenticate service
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('patient-registration-confirmation');
    this.initialized = true;
    console.log('✅ [PatientRegConfirmation] Service initialized');
  }

  /**
   * Confirm and finalize patient registration
   * @param {Object} processedData - Fully processed and validated patient data
   * @param {Object} practiceContext - Practice context information
   * @param {Object} session - Current session
   * @returns {Object} Confirmation result
   */
  async confirmRegistration(processedData, practiceContext, session) {
    console.log('🔍 [PatientRegConfirmation] Starting registration confirmation');

    try {
      // Final validation before persistence
      const finalValidation = this.performFinalValidation(processedData, practiceContext);
      if (!finalValidation.success) {
        return finalValidation;
      }

      // Prepare patient record for database
      const patientRecord = this.preparePatientRecord(processedData, practiceContext, session);

      // Save to database
      const dbResult = await this.savePatientToDatabase(patientRecord, practiceContext);
      if (!dbResult.success) {
        return dbResult;
      }

      // Generate confirmation details
      const confirmation = this.generateConfirmationDetails(dbResult.patient, practiceContext);

      // Log successful registration
      this.logSuccessfulRegistration(dbResult.patient, practiceContext, session);

      return {
        success: true,
        patient: dbResult.patient,
        confirmation,
        message: practiceContext.language === 'he'
          ? `המטופל ${processedData.firstName} ${processedData.lastName} נרשם בהצלחה`
          : `Patient ${processedData.firstName} ${processedData.lastName} registered successfully`
      };

    } catch (error) {
      console.error('❌ [PatientRegConfirmation] Confirmation failed:', error);
      return {
        success: false,
        error: 'CONFIRMATION_FAILED',
        message: error.message || 'Patient registration confirmation failed'
      };
    }
  }

  /**
   * Perform final validation before saving to database
   * @param {Object} data - Processed patient data
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Validation result
   */
  performFinalValidation(data, practiceContext) {
    const errors = [];

    // Ensure required fields are present
    if (!data.firstName || !data.lastName) {
      errors.push('Missing required patient name fields');
    }

    // Validate unique identifiers
    const detectedCountry = data.registrationMetadata?.detectedCountry;
    if (detectedCountry === 'Israel' && !data.nationalId && !data.healthFund) {
      errors.push('Israeli patients require national ID or health fund');
    }
    if (detectedCountry === 'USA' && !data.socialSecurityNumber && !data.insuranceProvider) {
      errors.push('US patients require SSN or insurance provider');
    }

    // Validate practice context
    if (!practiceContext.practiceId) {
      errors.push('Invalid practice context');
    }

    return {
      success: errors.length === 0,
      errors
    };
  }

  /**
   * Prepare patient record for database storage
   * @param {Object} data - Processed patient data
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @returns {Object} Patient record
   */
  preparePatientRecord(data, practiceContext, session) {
    const now = new Date();
    
    // Create base patient record
    const patientRecord = {
      // Basic information
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      
      // Contact information
      email: data.email,
      phone: data.phone,
      
      // Address
      street: data.street,
      city: data.city,
      state: data.state,
      zipCode: data.zipCode,
      country: data.country,
      
      // Registration metadata
      practiceId: practiceContext.practiceId,
      registeredBy: session?.userId || 'system',
      registrationDate: now,
      createdAt: now,
      updatedAt: now,
      
      // Status
      status: 'active',
      verified: false,
      
      // Consent tracking
      consents: {
        dataProcessing: true,
        communications: data.communicationConsent || false,
        marketing: data.marketingConsent || false,
        consentDate: now
      }
    };

    // Add country-specific fields
    if (data.registrationMetadata?.detectedCountry === 'Israel') {
      patientRecord.nationalId = data.nationalId;
      patientRecord.healthFund = data.healthFund;
    } else {
      patientRecord.socialSecurityNumber = data.socialSecurityNumber;
      patientRecord.insuranceProvider = data.insuranceProvider;
      patientRecord.insuranceNumber = data.insuranceNumber;
    }

    // Add optional fields if provided
    if (data.emergencyContact) {
      patientRecord.emergencyContact = data.emergencyContact;
    }
    if (data.preferredLanguage) {
      patientRecord.preferredLanguage = data.preferredLanguage;
    }
    if (data.medicalAlerts) {
      patientRecord.medicalAlerts = data.medicalAlerts;
    }

    return patientRecord;
  }

  /**
   * Save patient record to database
   * @param {Object} patientRecord - Patient record to save
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Database result
   */
  async savePatientToDatabase(patientRecord, practiceContext) {
    try {
      const context = {
        serviceId: 'patient-registration-confirmation',
        operation: 'create-patient',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      console.log('💾 [PatientRegConfirmation] Saving patient to database');
      
      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const result = await secureDataAccess.create('patients', patientRecord, context);
      
      if (!result || !result._id) {
        throw new Error('Failed to create patient record in database');
      }

      console.log('✅ [PatientRegConfirmation] Patient saved successfully:', result._id);
      
      return {
        success: true,
        patient: result
      };

    } catch (error) {
      console.error('❌ [PatientRegConfirmation] Database save failed:', error);
      return {
        success: false,
        error: 'DATABASE_SAVE_FAILED',
        message: `Failed to save patient: ${error.message}`
      };
    }
  }

  /**
   * Generate confirmation details for the registration
   * @param {Object} patient - Saved patient record
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Confirmation details
   */
  generateConfirmationDetails(patient, practiceContext) {
    const isHebrew = practiceContext.language === 'he';
    
    return {
      patientId: patient._id,
      patientNumber: patient.patientNumber || patient._id.toString().slice(-8).toUpperCase(),
      registrationDate: patient.registrationDate,
      practiceName: practiceContext.practiceName,
      
      // Confirmation message
      confirmationMessage: isHebrew
        ? `רישום המטופל הושלם בהצלחה. מספר מטופל: ${patient._id.toString().slice(-8).toUpperCase()}`
        : `Patient registration completed successfully. Patient ID: ${patient._id.toString().slice(-8).toUpperCase()}`,
      
      // Next steps
      nextSteps: isHebrew
        ? [
            'מטופל יכול לתאם תור',
            'מטופל יכול להעלות מסמכים',
            'מטופל יכול לעדכן פרטים אישיים',
            'מטופל יכול לגשת לפורטל המטופלים'
          ]
        : [
            'Patient can schedule appointments',
            'Patient can upload documents',
            'Patient can update personal information',
            'Patient can access the patient portal'
          ],
      
      // Important information
      importantInfo: isHebrew
        ? [
            'שמור את מספר המטופל לעיון עתידי',
            'בדוק את הפרטים האישיים לוודא שהם נכונים',
            'עדכן אותנו על כל שינוי בפרטי הקשר'
          ]
        : [
            'Keep your patient ID for future reference',
            'Verify your personal information is correct',
            'Update us about any contact information changes'
          ]
    };
  }

  /**
   * Log successful registration for audit purposes
   * @param {Object} patient - Registered patient
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   */
  logSuccessfulRegistration(patient, practiceContext, session) {
    const logData = {
      action: 'PATIENT_REGISTERED',
      patientId: patient._id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      practiceId: practiceContext.practiceId,
      registeredBy: session?.userId || 'system',
      timestamp: new Date(),
      metadata: {
        country: patient.country,
        hasEmail: !!patient.email,
        hasPhone: !!patient.phone,
        registrationSource: 'agent-service-v4'
      }
    };

    console.log('📝 [PatientRegConfirmation] Registration logged:', logData);
    
    // In a full implementation, this would be sent to an audit service
    // For now, we're just logging to console
  }

  /**
   * Send confirmation notifications
   * @param {Object} patient - Registered patient
   * @param {Object} confirmation - Confirmation details
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Notification result
   */
  async sendConfirmationNotifications(patient, confirmation, practiceContext) {
    const notifications = [];
    
    try {
      // Email notification if email provided
      if (patient.email) {
        const emailResult = await this.sendConfirmationEmail(patient, confirmation, practiceContext);
        notifications.push({
          type: 'email',
          success: emailResult.success,
          message: emailResult.message
        });
      }

      // SMS notification if phone provided
      if (patient.phone) {
        const smsResult = await this.sendConfirmationSMS(patient, confirmation, practiceContext);
        notifications.push({
          type: 'sms',
          success: smsResult.success,
          message: smsResult.message
        });
      }

      return {
        success: notifications.some(n => n.success),
        notifications,
        message: 'Confirmation notifications processed'
      };

    } catch (error) {
      console.error('❌ [PatientRegConfirmation] Notification sending failed:', error);
      return {
        success: false,
        error: 'NOTIFICATION_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Send confirmation email
   * @param {Object} patient - Patient data
   * @param {Object} confirmation - Confirmation details
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Email result
   */
  async sendConfirmationEmail(patient, confirmation, practiceContext) {
    // This would integrate with email service
    console.log(`📧 [PatientRegConfirmation] Would send confirmation email to: ${patient.email}`);
    
    return {
      success: true,
      message: 'Confirmation email queued for sending'
    };
  }

  /**
   * Send confirmation SMS
   * @param {Object} patient - Patient data
   * @param {Object} confirmation - Confirmation details
   * @param {Object} practiceContext - Practice context
   * @returns {Object} SMS result
   */
  async sendConfirmationSMS(patient, confirmation, practiceContext) {
    // This would integrate with SMS service
    console.log(`📱 [PatientRegConfirmation] Would send confirmation SMS to: ${patient.phone}`);
    
    return {
      success: true,
      message: 'Confirmation SMS queued for sending'
    };
  }
}

const patientRegistrationConfirmation = new PatientRegistrationConfirmation();

// Register with ServiceProxy
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('patientRegistrationConfirmation', () => patientRegistrationConfirmation);
}

module.exports = patientRegistrationConfirmation;