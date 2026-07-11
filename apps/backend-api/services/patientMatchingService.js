const { ObjectId } = require('mongodb');
const crypto = require('crypto');
const serviceProxyManager = require('./serviceProxyManager');

class PatientMatchingService {
  constructor() {
    this.initialized = false;
    this.serviceToken = null;
    this.matchingStrategies = ['exactMatch', 'fuzzyMatch', 'partialMatch'];
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      console.log('🚀 Initializing Patient Matching Service...');
      
      // Get service from proxy manager
      const serviceAccountManager = serviceProxyManager.get('serviceAccountManager');
      
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('patient-matching-service');
      
      this.initialized = true;
      console.log('✅ Patient Matching Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Patient Matching Service:', error);
      throw error;
    }
  }

  /**
   * Find or create patient based on extracted information
   * @param {Object} patientInfo - Extracted patient information
   * @param {String} practiceId - Practice identifier
   * @returns {Object} Matched or created patient
   */
  async findOrCreatePatient(patientInfo, practiceId) {
    await this.initialize();
    
    const context = {
      serviceId: 'patient-matching-service',
      apiKey: this.serviceToken?.apiKey || 'system',
      operation: 'find-or-create-patient',
      practiceId,
      queryType: 'INTERNAL_SERVICE'  // Mark as internal to bypass injection detection for $regex
    };
    
    try {
      console.log(`🔍 Searching for patient match in practice ${practiceId}`);
      
      // Try different matching strategies
      let matchedPatient = null;
      
      // 1. Try exact match first (using unique identifiers)
      matchedPatient = await this.exactMatch(patientInfo, practiceId, context);
      
      if (!matchedPatient) {
        // 2. Try fuzzy match (name + DOB combination)
        matchedPatient = await this.fuzzyMatch(patientInfo, practiceId, context);
      }
      
      if (!matchedPatient) {
        // 3. Try partial match with confirmation threshold
        const partialMatches = await this.partialMatch(patientInfo, practiceId, context);
        if (partialMatches.length === 1 && partialMatches[0].confidence > 0.8) {
          matchedPatient = partialMatches[0].patient;
        }
      }
      
      // If no match found, create new patient
      if (!matchedPatient) {
        console.log('🆕 No existing patient found, creating new patient record');
        matchedPatient = await this.createPatient(patientInfo, practiceId, context);
      } else {
        console.log(`✅ Found existing patient: ${matchedPatient._id}`);
        // Update patient info if new data is available
        await this.updatePatientInfo(matchedPatient, patientInfo, practiceId, context);
      }
      
      return {
        patient: matchedPatient,
        isNew: !matchedPatient._id,
        matchMethod: matchedPatient._id ? 'existing' : 'created'
      };
      
    } catch (error) {
      console.error('❌ Patient matching error:', error);
      throw error;
    }
  }

  /**
   * Exact match using unique identifiers
   */
  async exactMatch(patientInfo, practiceId, context) {
    const filters = [];
    
    // Check for national ID/SSN
    if (patientInfo.nationalId) {
      filters.push({ nationalId: patientInfo.nationalId });
    }
    
    // Check for health insurance number
    if (patientInfo.healthInsuranceNumber) {
      filters.push({ healthInsuranceNumber: patientInfo.healthInsuranceNumber });
    }
    
    // Check for email (unique per patient)
    if (patientInfo.email) {
      filters.push({ email: patientInfo.email.toLowerCase() });
    }
    
    if (filters.length === 0) return null;
    
    try {
      const SecureDataAccess = serviceProxyManager.get('secureDataAccess');
      const patients = await SecureDataAccess.query('patients', 
        { $or: filters },
        { limit: 1 },
        context
      );
      
      return patients.length > 0 ? patients[0] : null;
    } catch (error) {
      console.error('Exact match error:', error);
      return null;
    }
  }

  /**
   * Fuzzy match using name and DOB
   */
  async fuzzyMatch(patientInfo, practiceId, context) {
    // Allow matching with just last name if first name is missing
    if (!patientInfo.lastName) {
      return null;
    }
    
    // Date of birth is optional for fuzzy matching
    const hasDOB = !!patientInfo.dateOfBirth;
    
    try {
      // Normalize names for comparison
      const firstName = this.normalizeString(patientInfo.firstName || '');
      const lastName = this.normalizeString(patientInfo.lastName);
      
      // Escape regex special characters to prevent injection
      const escapedFirstName = this.escapeRegex(firstName);
      const escapedLastName = this.escapeRegex(lastName);
      
      // Build query based on available data
      const query = {
        lastName: { $regex: new RegExp(`^${escapedLastName}`, 'i') }
      };
      
      // Add first name if available
      if (firstName && escapedFirstName) {
        query.firstName = { $regex: new RegExp(`^${escapedFirstName}`, 'i') };
      }
      
      // Add date of birth if available
      if (hasDOB) {
        query.dateOfBirth = new Date(patientInfo.dateOfBirth);
      }
      
      const SecureDataAccess = serviceProxyManager.get('secureDataAccess');
      const patients = await SecureDataAccess.query('patients',
        query,
        { limit: 5 }, // Get top 5 matches to check similarity
        context
      );
      
      if (patients.length > 0) {
        // Check each patient for best match
        for (const patient of patients) {
          // If we have both first and last name, check full name similarity
          if (firstName && patient.firstName) {
            const similarity = this.calculateNameSimilarity(
              `${patient.firstName} ${patient.lastName}`,
              `${patientInfo.firstName || ''} ${patientInfo.lastName}`
            );
            
            if (similarity > 0.85) {
              console.log(`✅ Fuzzy match found: ${patient.firstName} ${patient.lastName} (similarity: ${similarity})`);
              return patient;
            }
          } else if (!firstName) {
            // If we only have last name, that's enough for a match if DOB also matches
            if (hasDOB || patient.lastName.toLowerCase() === lastName.toLowerCase()) {
              console.log(`✅ Fuzzy match found by last name: ${patient.firstName} ${patient.lastName}`);
              return patient;
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Fuzzy match error:', error);
      return null;
    }
  }

  /**
   * Partial match with confidence scoring
   */
  async partialMatch(patientInfo, practiceId, context) {
    const matches = [];
    
    try {
      // Build search criteria
      const searchCriteria = {};
      
      if (patientInfo.lastName) {
        const escapedLastName = this.escapeRegex(patientInfo.lastName);
        searchCriteria.lastName = { $regex: new RegExp(escapedLastName, 'i') };
      }
      
      if (patientInfo.phone) {
        // Normalize phone number (remove non-digits)
        const normalizedPhone = patientInfo.phone.replace(/\D/g, '');
        // Escape regex special characters
        const escapedPhone = this.escapeRegex(normalizedPhone);
        searchCriteria.phone = { $regex: escapedPhone };
      }
      
      if (Object.keys(searchCriteria).length === 0) {
        return matches;
      }
      
      const SecureDataAccess = serviceProxyManager.get('secureDataAccess');
      const patients = await SecureDataAccess.query('patients',
        searchCriteria,
        { limit: 10 },
        context
      );
      
      // Calculate confidence for each match
      for (const patient of patients) {
        const confidence = this.calculateMatchConfidence(patient, patientInfo);
        if (confidence > 0.5) {
          matches.push({ patient, confidence });
        }
      }
      
      // Sort by confidence
      matches.sort((a, b) => b.confidence - a.confidence);
      
      return matches;
    } catch (error) {
      console.error('Partial match error:', error);
      return matches;
    }
  }

  /**
   * Create new patient record
   */
  async createPatient(patientInfo, practiceId, context) {
    try {
      // Prepare patient data with defaults
      const patientData = {
        firstName: patientInfo.firstName || 'Unknown',
        lastName: patientInfo.lastName || 'Unknown',
        dateOfBirth: patientInfo.dateOfBirth ? new Date(patientInfo.dateOfBirth) : null,
        email: patientInfo.email ? patientInfo.email.toLowerCase() : null,
        phone: patientInfo.phone || null,
        street: patientInfo.address || null,
        city: patientInfo.city || null,
        zipCode: patientInfo.zipCode || null,
        status: 'active',
        country: patientInfo.country || 'Israel',
        documentCount: 0,
        documents: [],
        medicalHistory: [],
        analyses: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Add country-specific fields
      if (patientInfo.nationalId) {
        patientData.nationalId = patientInfo.nationalId;
      }
      
      if (patientInfo.healthFund) {
        patientData.healthFund = patientInfo.healthFund;
      }
      
      if (patientInfo.healthInsuranceNumber) {
        patientData.healthInsuranceNumber = patientInfo.healthInsuranceNumber;
      }
      
      // Generate patient ID if not provided
      if (!patientData._id) {
        const prefix = practiceId.substring(0, 3).toUpperCase();
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
        patientData.patientId = `${prefix}-${timestamp}-${random}`;
      }
      
      const SecureDataAccess = serviceProxyManager.get('secureDataAccess');
      const newPatient = await SecureDataAccess.insert('patients', patientData, context);
      
      console.log(`✅ Created new patient: ${newPatient._id || newPatient.patientId}`);
      
      return newPatient;
    } catch (error) {
      console.error('❌ Failed to create patient:', error);
      throw error;
    }
  }

  /**
   * Update existing patient with new information
   */
  async updatePatientInfo(patient, newInfo, practiceId, context) {
    const updates = {};
    
    // Only update fields that are missing or empty in existing patient
    if (!patient.email && newInfo.email) {
      updates.email = newInfo.email.toLowerCase();
    }
    
    if (!patient.phone && newInfo.phone) {
      updates.phone = newInfo.phone;
    }
    
    if (!patient.street && newInfo.address) {
      updates.street = newInfo.address;
    }
    
    if (!patient.city && newInfo.city) {
      updates.city = newInfo.city;
    }
    
    if (!patient.zipCode && newInfo.zipCode) {
      updates.zipCode = newInfo.zipCode;
    }
    
    if (!patient.nationalId && newInfo.nationalId) {
      updates.nationalId = newInfo.nationalId;
    }
    
    if (!patient.healthInsuranceNumber && newInfo.healthInsuranceNumber) {
      updates.healthInsuranceNumber = newInfo.healthInsuranceNumber;
    }
    
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      
      const SecureDataAccess = serviceProxyManager.get('secureDataAccess');
      await SecureDataAccess.update('patients',
        { _id: patient._id },
        { $set: updates },
        context
      );
      
      console.log(`📝 Updated patient ${patient._id} with new information`);
    }
  }

  /**
   * Add medical history entry to patient
   */
  async addMedicalHistory(patientId, medicalData, documentInfo, practiceId) {
    await this.initialize();
    
    const context = {
      serviceId: 'patient-matching-service',
      apiKey: this.serviceToken?.apiKey || 'system',
      operation: 'add-medical-history',
      practiceId,
      queryType: 'INTERNAL_SERVICE'  // Mark as internal to bypass injection detection
    };
    
    try {
      // Prepare medical history entry
      const historyEntry = {
        date: medicalData.date || new Date(),
        category: medicalData.category || 'consultation_notes',
        ...medicalData,
        documentId: documentInfo.documentId,
        documentName: documentInfo.documentName,
        source: documentInfo.source || 'document-upload',
        aiProcessed: true,
        aiGenerated: false,
        confidence: medicalData.confidence || 0.8,
        createdAt: new Date()
      };
      
      // Add category-specific required fields
      this.validateAndCompleteHistoryEntry(historyEntry);
      
      // Update patient's medical history
      const SecureDataAccess = serviceProxyManager.get('secureDataAccess');
      const result = await SecureDataAccess.update('patients',
        { _id: new ObjectId(patientId) },
        {
          $push: { medicalHistory: historyEntry },
          $set: { updatedAt: new Date() }
        },
        context
      );
      
      console.log(`✅ Added medical history entry to patient ${patientId}`);
      
      return historyEntry;
    } catch (error) {
      console.error('❌ Failed to add medical history:', error);
      throw error;
    }
  }

  /**
   * Validate and complete history entry based on category
   */
  validateAndCompleteHistoryEntry(entry) {
    switch (entry.category) {
      case 'consultation_notes':
        // Use any available diagnosis data, or document summary if no diagnosis
        entry.diagnosis = entry.diagnosis || entry.summary || entry.findings || 'Document uploaded - analysis pending';
        entry.visitType = entry.visitType || 'routine';
        break;
      
      case 'prescriptions':
        entry.medications = entry.medications || [];
        entry.prescribingDoctor = entry.prescribingDoctor || 'Unknown';
        break;
      
      case 'lab_results':
        entry.testType = entry.testType || entry.summary || 'Laboratory Test';
        entry.results = entry.results || entry.extractedData || [];
        break;
      
      case 'imaging_reports':
        entry.imagingType = entry.imagingType || entry.bodyPart || 'Medical Imaging';
        entry.findings = entry.findings || entry.summary || entry.impression || 'See attached document';
        break;
      
      case 'discharge_summary':
        entry.dischargeSummary = entry.dischargeSummary || 'See attached document';
        break;
      
      case 'vaccination_records':
        entry.vaccine = entry.vaccine || 'Unknown vaccine';
        break;
      
      case 'referrals':
        entry.referredTo = entry.referredTo || 'Specialist';
        entry.reason = entry.reason || 'Medical consultation';
        break;
      
      case 'medical_certificate':
        entry.purpose = entry.purpose || 'Medical documentation';
        break;
      
      case 'medical_procedures':
        entry.procedure = entry.procedure || 'Medical procedure';
        entry.outcome = entry.outcome || 'Completed';
        break;
    }
  }

  /**
   * Batch process patient assignments
   */
  async batchAssignDocuments(analysisResults, practiceId) {
    await this.initialize();
    
    const assignments = [];
    
    for (const result of analysisResults) {
      if (!result.success || !result.analysis) {
        assignments.push({
          documentId: result.documentId,
          success: false,
          error: result.error || 'No analysis data'
        });
        continue;
      }
      
      try {
        // Extract patient info from analysis result
        let patientInfo = {};
        
        // Check if we have a patientName in the extracted data
        if (result.analysis.patientName) {
          console.log(`🔍 Found patient name in analysis: ${result.analysis.patientName}`);
          // Parse the patient name into first and last name
          const nameParts = result.analysis.patientName.trim().split(/\s+/);
          if (nameParts.length >= 2) {
            patientInfo.firstName = nameParts[0];
            patientInfo.lastName = nameParts.slice(1).join(' ');
          } else if (nameParts.length === 1) {
            // Single name - use as last name for better matching
            patientInfo.lastName = nameParts[0];
          }
        }
        
        // Also check for patientId if available
        if (result.analysis.patientId) {
          patientInfo.nationalId = result.analysis.patientId;
        }
        
        // Add any other patient data that might be in the analysis
        if (result.analysis.dateOfBirth) {
          patientInfo.dateOfBirth = result.analysis.dateOfBirth;
        }
        
        // If analysis has a patientInfo object, merge it
        if (result.analysis.patientInfo) {
          patientInfo = { ...patientInfo, ...result.analysis.patientInfo };
        }
        
        console.log(`📋 Patient info for matching:`, patientInfo);
        
        // Find or create patient
        const patientMatch = await this.findOrCreatePatient(
          patientInfo,
          practiceId
        );
        
        // Log the analysis result to debug
        console.log(`📊 Document analysis for ${result.originalName}:`, {
          hasCategory: !!result.analysis.category,
          category: result.analysis.category,
          hasMedicalData: !!result.analysis.medicalData,
          medicalDataKeys: result.analysis.medicalData ? Object.keys(result.analysis.medicalData) : [],
          fullAnalysis: JSON.stringify(result.analysis, null, 2)
        });
        
        // Add medical history if category exists (even if medicalData is missing)
        if (result.analysis.category) {
          await this.addMedicalHistory(
            patientMatch.patient._id,
            {
              ...(result.analysis.medicalData || {}),
              category: result.analysis.category,
              summary: result.analysis.summary,
              confidence: result.analysis.confidence || 0.9
            },
            {
              documentId: result.documentId,
              documentName: result.originalName,
              source: 'batch-upload'
            },
            practiceId
          );
        }
        
        assignments.push({
          documentId: result.documentId,
          documentName: result.originalName,
          success: true,
          patientId: patientMatch.patient._id,
          patientName: `${patientMatch.patient.firstName} ${patientMatch.patient.lastName}`,
          isNewPatient: patientMatch.isNew,
          category: result.analysis.category,
          summary: result.analysis.summary
        });
        
      } catch (error) {
        console.error(`Failed to assign document ${result.documentId}:`, error);
        assignments.push({
          documentId: result.documentId,
          success: false,
          error: error.message
        });
      }
    }
    
    return assignments;
  }

  /**
   * Escape special regex characters in a string
   */
  escapeRegex(str) {
    if (!str) return '';
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Calculate name similarity score
   */
  calculateNameSimilarity(name1, name2) {
    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const n1 = normalize(name1);
    const n2 = normalize(name2);
    
    if (n1 === n2) return 1;
    
    // Levenshtein distance calculation
    const matrix = [];
    for (let i = 0; i <= n2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= n1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= n2.length; i++) {
      for (let j = 1; j <= n1.length; j++) {
        if (n2.charAt(i - 1) === n1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    const distance = matrix[n2.length][n1.length];
    const maxLength = Math.max(n1.length, n2.length);
    
    return 1 - (distance / maxLength);
  }

  /**
   * Calculate overall match confidence
   */
  calculateMatchConfidence(patient, targetInfo) {
    let score = 0;
    let factors = 0;
    
    // Name matching
    if (targetInfo.firstName && targetInfo.lastName) {
      const nameSimilarity = this.calculateNameSimilarity(
        `${patient.firstName} ${patient.lastName}`,
        `${targetInfo.firstName} ${targetInfo.lastName}`
      );
      score += nameSimilarity * 0.4;
      factors += 0.4;
    }
    
    // Date of birth matching
    if (targetInfo.dateOfBirth && patient.dateOfBirth) {
      const targetDOB = new Date(targetInfo.dateOfBirth).toDateString();
      const patientDOB = new Date(patient.dateOfBirth).toDateString();
      if (targetDOB === patientDOB) {
        score += 0.3;
      }
      factors += 0.3;
    }
    
    // Phone matching
    if (targetInfo.phone && patient.phone) {
      const targetPhone = targetInfo.phone.replace(/\D/g, '');
      const patientPhone = patient.phone.replace(/\D/g, '');
      if (targetPhone === patientPhone) {
        score += 0.2;
      }
      factors += 0.2;
    }
    
    // Email matching
    if (targetInfo.email && patient.email) {
      if (targetInfo.email.toLowerCase() === patient.email.toLowerCase()) {
        score += 0.1;
      }
      factors += 0.1;
    }
    
    return factors > 0 ? score / factors : 0;
  }

  /**
   * Normalize string for comparison
   */
  normalizeString(str) {
    if (!str) return '';
    return str.trim().toLowerCase().replace(/[^\w\s]/g, '');
  }
}

// Export singleton instance
module.exports = new PatientMatchingService();