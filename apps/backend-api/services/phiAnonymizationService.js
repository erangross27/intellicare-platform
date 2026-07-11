const serviceAccountManager = require('./serviceAccountManager');
/**
 * 🔐 PHI ANONYMIZATION SERVICE
 * HIPAA Safe Harbor de-identification implementation
 * Removes all 18 HIPAA identifiers while maintaining data utility for research
 */

const crypto = require('crypto');
const immutableAuditService = require('./immutableAuditService');
const SecureDataAccess = require('./secureDataAccess');

class PHIAnonymizationService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    // HIPAA Safe Harbor 18 identifiers that must be removed
    this.hipaaIdentifiers = {
      NAMES: {
        description: 'Names (patient, relatives, employers)',
        fields: ['firstName', 'lastName', 'middleName', 'fullName', 'relativeName', 'employerName']
      },
      GEOGRAPHIC: {
        description: 'Geographic subdivisions smaller than state',
        fields: ['streetAddress', 'city', 'county', 'precinct', 'zipCode']
      },
      DATES: {
        description: 'All dates except year (for age > 89)',
        fields: ['birthDate', 'admissionDate', 'dischargeDate', 'deathDate', 'appointmentDate']
      },
      PHONE: {
        description: 'Telephone numbers',
        fields: ['phone', 'mobilePhone', 'workPhone', 'fax', 'emergencyContact']
      },
      FAX: {
        description: 'Fax numbers',
        fields: ['faxNumber']
      },
      EMAIL: {
        description: 'Email addresses',
        fields: ['email', 'alternateEmail', 'workEmail']
      },
      SSN: {
        description: 'Social Security numbers',
        fields: ['ssn', 'socialSecurityNumber', 'taxId']
      },
      MRN: {
        description: 'Medical record numbers',
        fields: ['mrn', 'medicalRecordNumber', 'patientId', 'accountNumber']
      },
      HEALTH_PLAN: {
        description: 'Health plan beneficiary numbers',
        fields: ['insuranceId', 'memberId', 'groupNumber', 'policyNumber']
      },
      ACCOUNT: {
        description: 'Account numbers',
        fields: ['accountNumber', 'billingAccount', 'financialAccount']
      },
      LICENSE: {
        description: 'Certificate/license numbers',
        fields: ['licenseNumber', 'certificateNumber', 'deaNumber', 'npiNumber']
      },
      VEHICLE: {
        description: 'Vehicle identifiers and serial numbers',
        fields: ['vehicleId', 'licensePlate', 'vin']
      },
      DEVICE: {
        description: 'Device identifiers and serial numbers',
        fields: ['deviceId', 'serialNumber', 'imei', 'macAddress']
      },
      URL: {
        description: 'Web URLs',
        fields: ['url', 'website', 'profileUrl', 'socialMediaUrl']
      },
      IP: {
        description: 'IP addresses',
        fields: ['ipAddress', 'clientIp', 'sourceIp']
      },
      BIOMETRIC: {
        description: 'Biometric identifiers',
        fields: ['fingerprint', 'retinalScan', 'voiceprint', 'faceId']
      },
      PHOTO: {
        description: 'Full-face photos and comparable images',
        fields: ['photo', 'profileImage', 'faceImage', 'identificationPhoto']
      },
      OTHER: {
        description: 'Any other unique identifying characteristics',
        fields: ['uniqueId', 'customId', 'otherIdentifier']
      }
    };

    // Re-identification key storage (encrypted)
    this.reIdentificationKeys = new Map();
    
    // Anonymization methods
    this.anonymizationMethods = {
      REMOVE: 'remove',
      GENERALIZE: 'generalize',
      SUPPRESS: 'suppress',
      PSEUDONYMIZE: 'pseudonymize',
      AGGREGATE: 'aggregate',
      NOISE: 'noise_addition'
    };

    // Geographic generalization rules
    this.geoGeneralization = {
      zipCode: (zip) => {
        // For populations > 20,000, keep first 3 digits
        // Otherwise, set to 00000
        const population = this.getZipPopulation(zip);
        return population > 20000 ? zip.substring(0, 3) + '00' : '00000';
      }
    };
  }

  async initialize() {
    if (this.initialized) return;
    this.serviceToken = await serviceAccountManager.authenticate('phi-anonymization-service');
    this.initialized = true;
    return this;
  }

  /**
   * Get service context for SecureDataAccess operations
   */
  getServiceContext(practiceId = 'global') {
    return {
      serviceId: 'phiAnonymizationService',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: practiceId
    };
  }

  /**
   * Initialize the anonymization service with database
   */
  async initializeWithDb(practiceId = 'global') {
    // Note: SecureDataAccess handles indexes internally
    // No direct database access needed
    console.log('✅ PHI Anonymization Service initialized');
  }

  /**
   * Anonymize patient data using HIPAA Safe Harbor method
   */
  async anonymizeData(data, options = {}) {
    try {
      // Initialize if not already done
      if (!this.reIdCollection && options.practiceDb) {
        await this.initialize(options.practiceDb);
      }
      
      const {
        method = 'SAFE_HARBOR',
        preserveFields = [],
        datasetId = crypto.randomUUID(),
        purpose = 'research',
        userId = 'system',
        sessionId = null,
        retainReIdentification = true
      } = options;

      // Create a deep copy to avoid modifying original
      const anonymizedData = JSON.parse(JSON.stringify(data));
      
      // Track what was anonymized
      const anonymizationLog = {
        datasetId,
        timestamp: new Date(),
        method,
        purpose,
        fieldsAnonymized: [],
        preservedFields: preserveFields
      };

      // Generate re-identification key if needed
      const reIdKey = retainReIdentification ? crypto.randomUUID() : null;
      const reIdMap = new Map();

      // Apply Safe Harbor de-identification
      if (method === 'SAFE_HARBOR') {
        await this.applySafeHarbor(
          anonymizedData,
          preserveFields,
          anonymizationLog,
          reIdMap
        );
      }

      // Handle dates specially
      this.anonymizeDates(anonymizedData, anonymizationLog);

      // Handle geographic data
      this.anonymizeGeographic(anonymizedData, anonymizationLog);

      // Store re-identification keys securely if requested
      if (retainReIdentification && reIdMap.size > 0) {
        await this.storeReIdentificationKeys(
          datasetId,
          reIdKey,
          reIdMap,
          userId
        );
      }

      // Log the anonymization event
      await immutableAuditService.addAuditEntry({
        eventType: 'data_anonymization',
        userId,
        sessionId,
        details: `Data anonymized using ${method} method`,
        metadata: {
          datasetId,
          purpose,
          fieldsAnonymized: anonymizationLog.fieldsAnonymized.length,
          reIdentificationEnabled: retainReIdentification
        }
      });

      return {
        success: true,
        anonymizedData,
        datasetId,
        reIdKey: retainReIdentification ? reIdKey : null,
        anonymizationLog,
        message: {
          he: 'הנתונים עברו אנונימיזציה בהצלחה',
          en: 'Data anonymized successfully'
        }
      };
    } catch (error) {
      console.error('Error anonymizing data:', error);
      throw error;
    }
  }

  /**
   * Apply HIPAA Safe Harbor de-identification
   */
  async applySafeHarbor(data, preserveFields, log, reIdMap) {
    // Iterate through all HIPAA identifiers
    for (const [identifierType, config] of Object.entries(this.hipaaIdentifiers)) {
      for (const field of config.fields) {
        if (preserveFields.includes(field)) continue;
        
        // Check if field exists in data (handle nested objects)
        const fieldValue = this.getNestedValue(data, field);
        if (fieldValue !== undefined && fieldValue !== null) {
          // Store original value for re-identification
          const pseudonym = this.generatePseudonym(identifierType);
          reIdMap.set(pseudonym, fieldValue);
          
          // Replace with pseudonym or remove
          this.setNestedValue(data, field, pseudonym);
          log.fieldsAnonymized.push({
            field,
            type: identifierType,
            method: 'pseudonymize'
          });
        }
      }
    }
  }

  /**
   * Anonymize dates according to HIPAA rules
   */
  anonymizeDates(data, log) {
    const dateFields = this.hipaaIdentifiers.DATES.fields;
    
    for (const field of dateFields) {
      const value = this.getNestedValue(data, field);
      if (value && value instanceof Date || typeof value === 'string') {
        const date = new Date(value);
        
        // Calculate age if birth date
        if (field.includes('birth') || field.includes('Birth')) {
          const age = this.calculateAge(date);
          
          // For age > 89, only keep "90+"
          if (age > 89) {
            this.setNestedValue(data, field, '90+');
            this.setNestedValue(data, 'age', '90+');
          } else {
            // Keep only year
            this.setNestedValue(data, field, date.getFullYear());
            this.setNestedValue(data, 'age', age);
          }
        } else {
          // For other dates, keep only year
          this.setNestedValue(data, field, date.getFullYear());
        }
        
        log.fieldsAnonymized.push({
          field,
          type: 'DATE',
          method: 'generalize'
        });
      }
    }
  }

  /**
   * Anonymize geographic data
   */
  anonymizeGeographic(data, log) {
    const geoFields = this.hipaaIdentifiers.GEOGRAPHIC.fields;
    
    for (const field of geoFields) {
      const value = this.getNestedValue(data, field);
      if (value) {
        if (field.includes('zip') || field.includes('Zip')) {
          // Apply ZIP code generalization
          const generalizedZip = this.geoGeneralization.zipCode(value);
          this.setNestedValue(data, field, generalizedZip);
          log.fieldsAnonymized.push({
            field,
            type: 'GEOGRAPHIC',
            method: 'generalize'
          });
        } else if (field !== 'state' && field !== 'country') {
          // Remove all geographic data smaller than state
          this.setNestedValue(data, field, null);
          log.fieldsAnonymized.push({
            field,
            type: 'GEOGRAPHIC',
            method: 'remove'
          });
        }
      }
    }
  }

  /**
   * Re-identify anonymized data (requires proper authorization)
   */
  async reIdentifyData(datasetId, reIdKey, data, options = {}) {
    try {
      const { userId, reason, sessionId, practiceId = 'global' } = options;
      const context = this.getServiceContext(practiceId);

      // Verify re-identification key using SecureDataAccess
      const storedKeysArray = await SecureDataAccess.query(
        'reidentification_keys',
        {
          datasetId,
          reIdKey
        },
        { limit: 1 },
        context
      );
      
      const storedKeys = storedKeysArray[0];

      if (!storedKeys) {
        throw new Error({
          he: 'מפתח זיהוי מחדש לא נמצא או לא תקף',
          en: 'Re-identification key not found or invalid'
        });
      }

      // Decrypt the mapping
      const decryptedMapping = encryptionService.decrypt(storedKeys.encryptedMapping);
      
      // Apply re-identification
      const reIdentifiedData = JSON.parse(JSON.stringify(data));
      for (const [pseudonym, originalValue] of Object.entries(decryptedMapping)) {
        this.replaceAllOccurrences(reIdentifiedData, pseudonym, originalValue);
      }

      // Log the re-identification event
      await immutableAuditService.addAuditEntry({
        eventType: 'data_reidentification',
        userId,
        sessionId,
        details: `Data re-identified for dataset ${datasetId}`,
        metadata: {
          datasetId,
          reason,
          authorizedBy: userId
        }
      });

      return {
        success: true,
        reIdentifiedData,
        message: {
          he: 'הנתונים זוהו מחדש בהצלחה',
          en: 'Data re-identified successfully'
        }
      };
    } catch (error) {
      console.error('Error re-identifying data:', error);
      throw error;
    }
  }

  /**
   * Store re-identification keys securely
   */
  async storeReIdentificationKeys(datasetId, reIdKey, mapping, userId) {
    try {
      // Convert Map to object for encryption
      const mappingObject = Object.fromEntries(mapping);
      
      // Encrypt the mapping
      const encryptedMapping = encryptionService.encrypt(mappingObject, 'critical');
      
      // Store in database
      await this.reIdCollection.insertOne({
        datasetId,
        reIdKey,
        encryptedMapping,
        createdAt: new Date(),
        createdBy: userId,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        accessLog: []
      });

      return true;
    } catch (error) {
      console.error('Error storing re-identification keys:', error);
      throw error;
    }
  }

  /**
   * Export anonymized data for research
   */
  async exportForResearch(query, options = {}) {
    try {
      // Initialize if not already done
      if (!this.reIdCollection && options.practiceDb) {
        await this.initialize(options.practiceDb);
      }
      
      const {
        format = 'json',
        includeMetadata = true,
        userId = 'system',
        purpose = 'research',
        retainReId = false
      } = options;

      // Fetch data based on query
      const data = await this.fetchDataForExport(query);
      
      // Anonymize all records
      const anonymizedRecords = [];
      const datasetId = crypto.randomUUID();
      
      for (const record of data) {
        const result = await this.anonymizeData(record, {
          datasetId,
          purpose,
          userId,
          retainReIdentification: retainReId
        });
        anonymizedRecords.push(result.anonymizedData);
      }

      // Prepare export
      const exportData = {
        datasetId,
        exportDate: new Date(),
        purpose,
        recordCount: anonymizedRecords.length,
        anonymizationMethod: 'HIPAA_SAFE_HARBOR',
        data: anonymizedRecords
      };

      if (includeMetadata) {
        exportData.metadata = {
          exportedBy: userId,
          dataRetention: '90 days',
          reIdentificationAvailable: retainReId,
          complianceStandard: 'HIPAA Safe Harbor'
        };
      }

      // Log export
      await immutableAuditService.addAuditEntry({
        eventType: 'research_data_export',
        userId,
        details: `Research data exported: ${anonymizedRecords.length} records`,
        metadata: {
          datasetId,
          purpose,
          format,
          recordCount: anonymizedRecords.length
        }
      });

      // Format output
      if (format === 'csv') {
        return this.convertToCSV(exportData);
      } else if (format === 'json') {
        return exportData;
      }

      return exportData;
    } catch (error) {
      console.error('Error exporting research data:', error);
      throw error;
    }
  }

  /**
   * Check if data is properly anonymized
   */
  async validateAnonymization(data) {
    try {
      const violations = [];
      
      // Check for each HIPAA identifier
      for (const [identifierType, config] of Object.entries(this.hipaaIdentifiers)) {
        for (const field of config.fields) {
          const value = this.getNestedValue(data, field);
          
          if (value && !this.isPseudonym(value)) {
            // Check if value looks like real PHI
            if (this.looksLikePHI(value, identifierType)) {
              violations.push({
                field,
                type: identifierType,
                value: value.substring(0, 10) + '...', // Don't log full PHI
                severity: 'high'
              });
            }
          }
        }
      }

      return {
        isAnonymized: violations.length === 0,
        violations,
        complianceLevel: violations.length === 0 ? 'HIPAA_COMPLIANT' : 'NON_COMPLIANT',
        message: violations.length === 0 
          ? { he: 'הנתונים אנונימיים לחלוטין', en: 'Data is fully anonymized' }
          : { he: `נמצאו ${violations.length} הפרות אנונימיזציה`, en: `Found ${violations.length} anonymization violations` }
      };
    } catch (error) {
      console.error('Error validating anonymization:', error);
      throw error;
    }
  }

  /**
   * Generate statistical report on anonymized dataset
   */
  async generateStatisticalReport(anonymizedData) {
    try {
      const report = {
        totalRecords: anonymizedData.length,
        demographics: {},
        clinicalMetrics: {},
        temporalDistribution: {},
        dataQuality: {
          completeness: 0,
          nullFields: 0,
          pseudonymizedFields: 0
        }
      };

      // Analyze demographics (safe aggregates only)
      report.demographics = {
        ageGroups: this.calculateAgeDistribution(anonymizedData),
        genderDistribution: this.calculateGenderDistribution(anonymizedData),
        geographicDistribution: this.calculateGeographicDistribution(anonymizedData)
      };

      // Calculate data quality metrics
      for (const record of anonymizedData) {
        const nullCount = this.countNullFields(record);
        const pseudonymCount = this.countPseudonyms(record);
        report.dataQuality.nullFields += nullCount;
        report.dataQuality.pseudonymizedFields += pseudonymCount;
      }

      report.dataQuality.completeness = 
        ((report.totalRecords * 100) - report.dataQuality.nullFields) / (report.totalRecords * 100);

      return report;
    } catch (error) {
      console.error('Error generating statistical report:', error);
      throw error;
    }
  }

  // Helper functions

  /**
   * Generate a pseudonym for a given identifier type
   */
  generatePseudonym(type) {
    const prefix = type.substring(0, 3).toUpperCase();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}_${random}`;
  }

  /**
   * Check if a value is a pseudonym
   */
  isPseudonym(value) {
    if (typeof value !== 'string') return false;
    return /^[A-Z]{3}_[A-Z0-9]{8}$/.test(value);
  }

  /**
   * Check if value looks like PHI
   */
  looksLikePHI(value, type) {
    const patterns = {
      SSN: /^\d{3}-\d{2}-\d{4}$/,
      PHONE: /^\d{3}-\d{3}-\d{4}$/,
      EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      IP: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
      MRN: /^[A-Z0-9]{6,}$/
    };

    return patterns[type] ? patterns[type].test(value) : false;
  }

  /**
   * Get nested object value
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, part) => current?.[part], obj);
  }

  /**
   * Set nested object value
   */
  setNestedValue(obj, path, value) {
    const parts = path.split('.');
    const last = parts.pop();
    const target = parts.reduce((current, part) => {
      if (!current[part]) current[part] = {};
      return current[part];
    }, obj);
    target[last] = value;
  }

  /**
   * Replace all occurrences of a value
   */
  replaceAllOccurrences(obj, searchValue, replaceValue) {
    if (typeof obj === 'string') {
      return obj === searchValue ? replaceValue : obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.replaceAllOccurrences(item, searchValue, replaceValue));
    }
    if (typeof obj === 'object' && obj !== null) {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.replaceAllOccurrences(value, searchValue, replaceValue);
      }
      return result;
    }
    return obj;
  }

  /**
   * Calculate age from date
   */
  calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  /**
   * Get ZIP code population (mock implementation)
   */
  getZipPopulation(zipCode) {
    // In production, this would query a real ZIP code database
    // For now, return a mock value
    return 25000; // Mock population > 20,000
  }

  /**
   * Fetch data for export (mock implementation)
   */
  async fetchDataForExport(query) {
    // In production, this would query the database
    // For now, return empty array
    return [];
  }

  /**
   * Convert to CSV format
   */
  convertToCSV(data) {
    // Simple CSV conversion for flat data structures
    const records = data.data || [];
    if (records.length === 0) return '';

    const headers = Object.keys(records[0]);
    const rows = records.map(record =>
      headers.map(header => {
        const value = record[header];
        return typeof value === 'string' ? `"${value}"` : value;
      }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Calculate age distribution
   */
  calculateAgeDistribution(data) {
    const distribution = {
      '0-17': 0,
      '18-29': 0,
      '30-49': 0,
      '50-69': 0,
      '70-89': 0,
      '90+': 0
    };

    for (const record of data) {
      const age = record.age;
      if (age === '90+') distribution['90+']++;
      else if (age < 18) distribution['0-17']++;
      else if (age < 30) distribution['18-29']++;
      else if (age < 50) distribution['30-49']++;
      else if (age < 70) distribution['50-69']++;
      else if (age < 90) distribution['70-89']++;
      else distribution['90+']++;
    }

    return distribution;
  }

  /**
   * Calculate gender distribution
   */
  calculateGenderDistribution(data) {
    const distribution = {};
    for (const record of data) {
      const gender = record.gender || 'unknown';
      distribution[gender] = (distribution[gender] || 0) + 1;
    }
    return distribution;
  }

  /**
   * Calculate geographic distribution
   */
  calculateGeographicDistribution(data) {
    const distribution = {};
    for (const record of data) {
      const state = record.state || 'unknown';
      distribution[state] = (distribution[state] || 0) + 1;
    }
    return distribution;
  }

  /**
   * Count null fields in a record
   */
  countNullFields(record, obj = record, count = 0) {
    for (const value of Object.values(obj)) {
      if (value === null || value === undefined) {
        count++;
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        count = this.countNullFields(record, value, count);
      }
    }
    return count;
  }

  /**
   * Count pseudonymized fields
   */
  countPseudonyms(record, obj = record, count = 0) {
    for (const value of Object.values(obj)) {
      if (this.isPseudonym(value)) {
        count++;
      } else if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
        count = this.countPseudonyms(record, value, count);
      }
    }
    return count;
  }
}

// Singleton instance
const phiAnonymizationService = new PHIAnonymizationService();

module.exports = phiAnonymizationService;