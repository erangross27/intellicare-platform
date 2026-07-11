const serviceAccountManager = require('../../../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../../../backend/services/secureDataAccess');

class MedicalParsingService {
  constructor() {
    this.initialized = false;
    // Cache for parsed results to improve performance
    this.parseCache = new Map();
    this.maxCacheSize = 1000;
    this.hebrewMedicalPatterns = {
      // Lab Results (Hebrew + English)
      bloodPressure: [
        /לחץ דם[:\s]*(\d+\/\d+)/g,
        /blood pressure[:\s]*(\d+\/\d+)/gi,
        /bp[:\s]*(\d+\/\d+)/gi
      ],
      glucose: [
        /גלוקוז[:\s]*(\d+\.?\d*)/g,
        /glucose[:\s]*(\d+\.?\d*)/gi,
        /sugar[:\s]*(\d+\.?\d*)/gi
      ],
      cholesterol: [
        /כולסטרול[:\s]*(\d+\.?\d*)/g,
        /cholesterol[:\s]*(\d+\.?\d*)/gi,
        /chol[:\s]*(\d+\.?\d*)/gi
      ],
      hemoglobin: [
        /המוגלובין[:\s]*(\d+\.?\d*)/g,
        /hemoglobin[:\s]*(\d+\.?\d*)/gi,
        /hb[:\s]*(\d+\.?\d*)/gi
      ],
      heartRate: [
        /דופק[:\s]*(\d+)/g,
        /heart rate[:\s]*(\d+)/gi,
        /hr[:\s]*(\d+)/gi,
        /pulse[:\s]*(\d+)/gi
      ],
      temperature: [
        /חום[:\s]*(\d+\.?\d*)/g,
        /temperature[:\s]*(\d+\.?\d*)/gi,
        /temp[:\s]*(\d+\.?\d*)/gi,
        /fever[:\s]*(\d+\.?\d*)/gi
      ],
      
      // Symptoms (Hebrew + English)
      symptoms: [
        /תסמינים[:\s]*([^•\n\.]+)/g,
        /symptoms[:\s]*([^•\n\.]+)/gi,
        /סימפטומים[:\s]*([^•\n\.]+)/g,
        /תלונות[:\s]*([^•\n\.]+)/g,
        /complaints[:\s]*([^•\n\.]+)/gi
      ],
      pain: [
        /כאב[:\s]*([^•\n\.]+)/g,
        /pain[:\s]*([^•\n\.]+)/gi,
        /כאבים[:\s]*([^•\n\.]+)/g,
        /צער[:\s]*([^•\n\.]+)/g,
        /discomfort[:\s]*([^•\n\.]+)/gi
      ],
      fatigue: [
        /עייפות[:\s]*([^•\n\.]+)/g,
        /fatigue[:\s]*([^•\n\.]+)/gi,
        /חולשה[:\s]*([^•\n\.]+)/g,
        /weakness[:\s]*([^•\n\.]+)/gi
      ],
      nausea: [
        /בחילה[:\s]*([^•\n\.]+)/g,
        /nausea[:\s]*([^•\n\.]+)/gi,
        /הקאה[:\s]*([^•\n\.]+)/g,
        /vomiting[:\s]*([^•\n\.]+)/gi
      ],
      dizziness: [
        /סחרחורת[:\s]*([^•\n\.]+)/g,
        /dizziness[:\s]*([^•\n\.]+)/gi,
        /חוסר איזון[:\s]*([^•\n\.]+)/g,
        /vertigo[:\s]*([^•\n\.]+)/gi
      ],
      headache: [
        /כאב ראש[:\s]*([^•\n\.]+)/g,
        /headache[:\s]*([^•\n\.]+)/gi,
        /מיגרנה[:\s]*([^•\n\.]+)/g,
        /migraine[:\s]*([^•\n\.]+)/gi
      ],
      breathing: [
        /קושי בנשימה[:\s]*([^•\n\.]+)/g,
        /difficulty breathing[:\s]*([^•\n\.]+)/gi,
        /דיספנאה[:\s]*([^•\n\.]+)/g,
        /dyspnea[:\s]*([^•\n\.]+)/gi,
        /קוצר נשימה[:\s]*([^•\n\.]+)/g,
        /shortness of breath[:\s]*([^•\n\.]+)/gi
      ],
      cough: [
        /שיעול[:\s]*([^•\n\.]+)/g,
        /cough[:\s]*([^•\n\.]+)/gi,
        /כיח[:\s]*([^•\n\.]+)/g,
        /sputum[:\s]*([^•\n\.]+)/gi
      ],
      
      // Medications (Hebrew + English)
      medications: [
        /תרופות[:\s]*([^•\n\.]+)/g,
        /medications[:\s]*([^•\n\.]+)/gi,
        /drugs[:\s]*([^•\n\.]+)/gi,
        /טיפול תרופתי[:\s]*([^•\n\.]+)/g
      ],
      dosage: [
        /מינון[:\s]*([^•\n\.]+)/g,
        /dosage[:\s]*([^•\n\.]+)/gi,
        /dose[:\s]*([^•\n\.]+)/gi
      ],
      
      // Recommendations (Hebrew + English)
      recommendations: [
        /המלצות[:\s]*([^•\n\.]+)/g,
        /recommendations[:\s]*([^•\n\.]+)/gi,
        /המלצה[:\s]*([^•\n\.]+)/g,
        /recommendation[:\s]*([^•\n\.]+)/gi
      ],
      followUp: [
        /מעקב[:\s]*([^•\n\.]+)/g,
        /follow.?up[:\s]*([^•\n\.]+)/gi,
        /ביקור חוזר[:\s]*([^•\n\.]+)/g
      ],
      
      // Diagnosis (Hebrew + English)
      diagnosis: [
        /אבחנה[:\s]*([^•\n\.]+)/g,
        /diagnosis[:\s]*([^•\n\.]+)/gi,
        /אבחון[:\s]*([^•\n\.]+)/g,
        /מחלה[:\s]*([^•\n\.]+)/g,
        /disease[:\s]*([^•\n\.]+)/gi,
        /מצב רפואי[:\s]*([^•\n\.]+)/g,
        /medical condition[:\s]*([^•\n\.]+)/gi,
        /הערכה רפואית[:\s]*([^•\n\.]+)/g,
        /medical assessment[:\s]*([^•\n\.]+)/gi
      ],

      // Common Medical Conditions (Hebrew + English)
      diabetes: [
        /סוכרת[:\s]*([^•\n\.]*)/g,
        /diabetes[:\s]*([^•\n\.]*)/gi,
        /דיאבטס[:\s]*([^•\n\.]*)/g
      ],
      hypertension: [
        /יתר לחץ דם[:\s]*([^•\n\.]*)/g,
        /hypertension[:\s]*([^•\n\.]*)/gi,
        /לחץ דם גבוה[:\s]*([^•\n\.]*)/g,
        /high blood pressure[:\s]*([^•\n\.]*)/gi
      ],
      heartDisease: [
        /מחלת לב[:\s]*([^•\n\.]*)/g,
        /heart disease[:\s]*([^•\n\.]*)/gi,
        /קרדיולוגי[:\s]*([^•\n\.]*)/g,
        /cardiac[:\s]*([^•\n\.]*)/gi
      ],
      asthma: [
        /אסתמה[:\s]*([^•\n\.]*)/g,
        /asthma[:\s]*([^•\n\.]*)/gi,
        /קוצר נשימה כרוני[:\s]*([^•\n\.]*)/g
      ],
      
      // Test Results (Hebrew + English)
      labResults: [
        /תוצאות מעבדה[:\s]*([^•\n\.]+)/g,
        /lab results[:\s]*([^•\n\.]+)/gi,
        /בדיקות[:\s]*([^•\n\.]+)/g,
        /tests[:\s]*([^•\n\.]+)/gi
      ]
    };
    
    this.normalRanges = {
      bloodPressure: { min: 90, max: 140, unit: 'mmHg' },
      glucose: { min: 70, max: 100, unit: 'mg/dL' },
      cholesterol: { min: 0, max: 200, unit: 'mg/dL' },
      hemoglobin: { min: 12, max: 16, unit: 'g/dL' },
      heartRate: { min: 60, max: 100, unit: 'bpm' },
      temperature: { min: 36, max: 37.5, unit: '°C' }
    };
  }
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Authenticate service with serviceAccountManager
      this.serviceToken = await serviceAccountManager.authenticate('medical-parsing-service');
      
      // Set initialized flag
      this.initialized = true;
      
      // Log initialization using SecureDataAccess
      const context = {
        serviceId: 'medical-parsing-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: 'global',
        isSystemService: true,
        queryType: 'INTERNAL_SERVICE'
      };
      
      try {
        await SecureDataAccess.create('audit_logs', {
          action: 'SERVICE_INITIALIZED',
          service: 'medical-parsing-service',
          timestamp: new Date(),
          performedBy: context.serviceId
        }, context);
      } catch (auditError) {
        console.warn('Failed to log service initialization:', auditError.message);
      }
      
      return this;
    } catch (error) {
      throw new Error(`Failed to initialize MedicalParsingService: ${error.message}`);
    }
  }


  parseHebrewMedicalText(text, language = 'he') {
    if (!text || typeof text !== 'string') {
      return { categories: {}, confidence: 0 };
    }

    // Check cache first for performance
    const cacheKey = `${text.substring(0, 100)}_${language}`;
    if (this.parseCache.has(cacheKey)) {
      return this.parseCache.get(cacheKey);
    }

    const categories = {
      labResults: [],
      symptoms: [],
      medications: [],
      recommendations: [],
      diagnosis: [],
      other: []
    };

    let totalMatches = 0;

    // Process each pattern category
    Object.entries(this.hebrewMedicalPatterns).forEach(([category, patterns]) => {
      patterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) {
          matches.forEach(match => {
            const processed = this.processMatch(match, category);
            if (processed) {
              // Determine target category
              const targetCategory = this.categorizeMatch(category, processed);
              categories[targetCategory].push(processed);
              totalMatches++;
            }
          });
        }
      });
    });

    // If no specific matches, add as general medical data
    if (totalMatches === 0) {
      const sentences = text.split(/[.•\n]/).filter(s => s.trim().length > 0);
      sentences.forEach((sentence, index) => {
        if (sentence.trim()) {
          categories.other.push({
            category: language === 'he' ? 'מידע רפואי' : 'Medical Information',
            details: sentence.trim(),
            index: index + 1
          });
        }
      });
    }

    // Remove empty categories
    Object.keys(categories).forEach(key => {
      if (categories[key].length === 0) {
        delete categories[key];
      }
    });

    const confidence = totalMatches > 0 ? Math.min(0.95, 0.6 + (totalMatches * 0.1)) : 0.3;

    const result = {
      categories,
      confidence,
      totalMatches,
      originalText: text
    };

    // Cache the result for performance
    if (this.parseCache.size >= this.maxCacheSize) {
      // Remove oldest entry if cache is full
      const firstKey = this.parseCache.keys().next().value;
      this.parseCache.delete(firstKey);
    }
    this.parseCache.set(cacheKey, result);

    return result;
  }

  processMatch(match, category) {
    // Extract value and details from match
    const colonIndex = match.indexOf(':');
    if (colonIndex === -1) return null;

    const label = match.substring(0, colonIndex).trim();
    const value = match.substring(colonIndex + 1).trim();

    if (!value) return null;

    // Check if it's a numeric value (lab result)
    const numericMatch = value.match(/(\d+\.?\d*)/);
    if (numericMatch && this.normalRanges[category]) {
      const numValue = parseFloat(numericMatch[1]);
      const range = this.normalRanges[category];
      
      return {
        label,
        value: numValue,
        unit: range.unit,
        abnormal: numValue < range.min || numValue > range.max,
        details: value,
        category
      };
    }

    // Regular text match
    return {
      label,
      details: value,
      category
    };
  }

  categorizeMatch(originalCategory, processed) {
    // Map specific categories to main categories
    const categoryMap = {
      bloodPressure: 'labResults',
      glucose: 'labResults',
      cholesterol: 'labResults',
      hemoglobin: 'labResults',
      heartRate: 'labResults',
      temperature: 'labResults',
      labResults: 'labResults',
      
      symptoms: 'symptoms',
      pain: 'symptoms',
      nausea: 'symptoms',
      headache: 'symptoms',
      
      medications: 'medications',
      dosage: 'medications',
      
      recommendations: 'recommendations',
      followUp: 'recommendations',
      
      diagnosis: 'diagnosis'
    };

    return categoryMap[originalCategory] || 'other';
  }

  async enhanceWithMedicalContext(parsedData, patientId) {
    // If patientId provided, could enhance with patient history context
    // For now, return enhanced parsed data
    return {
      ...parsedData,
      enhanced: true,
      timestamp: new Date()
    };
  }

  // AI Analysis Methods

  // NEW: Medical relevance check - AI determines if document is medical
  async checkMedicalRelevance(text, language = 'he') {
    try {
      console.log('🤖 Starting medical relevance check...');

      // Use axios for better timeout control
      const axios = require('axios');

      const response = await axios.post('http://localhost:5001/predict', {
        documentText: text,
        language: language,
        requestType: 'medical_relevance_check'
      }, {
        timeout: 30 * 60 * 1000, // 30 minutes
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ AI relevance check response received');

      // Extract relevance from AI response (axios automatically parses JSON)
      const result = response.data;
      const relevance = await this.extractRelevanceFromResponse(result.prediction || '');

      return {
        success: true,
        data: {
          relevance: relevance,
          confidence: result.confidence || 0.8,
          rawResponse: result.prediction
        }
      };

    } catch (error) {
      console.error('❌ AI relevance check failed:', error);

      // 🔒 SECURITY: No fallbacks - medical parsing failure must halt processing
      throw new Error(`Medical relevance check failed: ${error.message}`);
    }
  }

  // Extract relevance from AI response - AI ONLY
  async extractRelevanceFromResponse(response) {
    const cleanResponse = response.trim().toUpperCase();

    // AI should return MEDICAL or NON_MEDICAL
    if (cleanResponse.includes('NON_MEDICAL') || cleanResponse.includes('NON-MEDICAL')) {
      return 'NON_MEDICAL';
    } else if (cleanResponse.includes('MEDICAL')) {
      return 'MEDICAL';
    }

    // If unclear, default to MEDICAL to avoid rejecting medical documents
    return 'MEDICAL';
  }

  // NEW: Document categorization method
  async categorizeDocument(text, language = 'he') {
    try {
      console.log('🤖 Starting document categorization...');

      // Use axios for better timeout control
      const axios = require('axios');

      const response = await axios.post('http://localhost:5001/predict', {
        documentText: text,
        language: language,
        requestType: 'document_categorization'
      }, {
        timeout: 30 * 60 * 1000, // 30 minutes
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = response.data;
      console.log('✅ AI categorization response received');

      // Parse category from AI response
      const category = await this.extractCategoryFromResponse(result.prediction || '');

      return {
        success: true,
        data: {
          category: category,
          confidence: result.confidence || 0.8,
          rawResponse: result.prediction
        }
      };

    } catch (error) {
      console.error('❌ AI categorization failed:', error);

      // NO FALLBACK - Throw error to stop processing
      throw new Error(`Document categorization failed: ${error.message}`);
    }
  }

  // NEW: Category-specific data extraction method
  async extractCategoryData(text, category, language = 'he') {
    try {
      console.log(`🤖 Starting ${category} data extraction...`);

      // Use axios for better timeout control
      const axios = require('axios');

      const response = await axios.post('http://localhost:5001/predict', {
        documentText: text,
        language: language,
        requestType: `${category}_extraction`
      }, {
        timeout: 30 * 60 * 1000, // 30 minutes
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = response.data;
      console.log('✅ AI extraction response received');

      // Parse structured data from AI response
      const structuredData = await this.parseStructuredDataFromResponse(result.prediction || '', category);

      return {
        success: true,
        data: structuredData
      };

    } catch (error) {
      console.error('❌ AI data extraction failed:', error);

      // NO FALLBACK - Throw error to stop processing
      throw new Error(`Category data extraction failed: ${error.message}`);
    }
  }

  // Extract category from AI response - AI ONLY
  async extractCategoryFromResponse(response) {
    // Let AI return the exact category - no static parsing
    // AI should return just the category name like "lab_results"
    const cleanResponse = response.trim().toLowerCase();

    // Valid categories - AI must return one of these
    const validCategories = [
      'lab_results', 'prescriptions', 'discharge_summary', 'imaging_reports',
      'consultation_notes', 'vaccination_records', 'referrals', 'medical_certificate'
    ];

    // Find the category in AI response
    for (const category of validCategories) {
      if (cleanResponse.includes(category)) {
        return category;
      }
    }

    // If AI didn't return a valid category, use the full response as category
    return cleanResponse || 'consultation_notes';
  }

  // Parse structured data from AI response - AI ONLY
  async parseStructuredDataFromResponse(response, category) {
    // AI should return structured data - no static parsing
    // Just return the AI response as structured data
    try {
      // Try to parse as JSON if AI returns JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Otherwise, return the raw AI response as text data
      return {
        aiResponse: response,
        category: category,
        rawData: response
      };
    } catch (error) {
      // If JSON parsing fails, return raw response
      return {
        aiResponse: response,
        category: category,
        rawData: response,
        parseError: error.message
      };
    }
  }

  async analyzeWithAI(text, language = 'he', patientId = null) {
    try {
      const axios = require('axios');

      // Call MedGemma microservice via HTTP API
      const response = await axios.post('http://localhost:5001/api/analyze', {
        text: text,
        language: language,
        task: 'comprehensive_analysis',
        patient_id: patientId || null,
        request_type: 'document_analysis'
      }, {
        timeout: 600000, // 10 minute timeout for AI processing
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.success) {
        return {
          success: true,
          data: {
            category: response.data.category || 'consultation_notes',
            symptoms: response.data.symptoms || [],
            recommendations: response.data.recommendations || [],
            confidence: response.data.confidence || 0.7,
            aiProcessed: true,
            processedAt: new Date()
          }
        };
      } else {
        throw new Error('AI analysis failed: ' + (response.data?.error || 'Unknown error'));
      }

    } catch (error) {
      console.error('AI analysis failed:', error);
      return {
        success: false,
        error: error.message,
        data: {
          category: 'Visit Notes',
          symptoms: [],
          recommendations: [],
          confidence: 0.0,
          aiProcessed: false
        }
      };
    }
  }

  async updatePatientRecord(patientId, analysisData) {
    try {
      // Create service context for SecureDataAccess
      const context = {
        serviceId: 'medical-parsing-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: analysisData.practiceId || 'global',
        isSystemService: true,
        queryType: 'INTERNAL_SERVICE'
      };

      // Query patient using SecureDataAccess
      const patients = await SecureDataAccess.query('patients', {_id: patientId}, {}, context);
      if (!patients || patients.length === 0) {
        throw new Error('Patient not found');
      }

      // Add to medical history with AI analysis
      const historyEntry = {
        date: new Date(),
        diagnosis: analysisData.aiAnalysis?.category || 'Medical Record',
        symptoms: analysisData.aiAnalysis?.symptoms?.join(', ') || '',
        treatment: analysisData.aiAnalysis?.recommendations?.join(', ') || '',
        confidence: analysisData.aiAnalysis?.confidence || 0.7,
        aiProcessed: true,
        taskId: analysisData.taskId,
        status: analysisData.status
      };

      // Update patient record using SecureDataAccess
      await SecureDataAccess.update('patients', 
        {_id: patientId},
        {$push: {medicalHistory: historyEntry}},
        context
      );

      return {
        success: true,
        data: historyEntry
      };

    } catch (error) {
      console.error('Failed to update patient record:', error);
      throw error;
    }
  }

  async getProcessingStatus(taskId) {
    try {
      // Create service context for SecureDataAccess
      const context = {
        serviceId: 'medical-parsing-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: 'global',
        isSystemService: true,
        queryType: 'INTERNAL_SERVICE'
      };

      // Find patient with this task ID in medical history using SecureDataAccess
      const patients = await SecureDataAccess.query('patients', {
        'medicalHistory.taskId': taskId
      }, {}, context);

      if (!patients || patients.length === 0) {
        return {
          taskId,
          status: 'not_found',
          message: 'Task not found'
        };
      }

      const patient = patients[0];
      const historyEntry = patient.medicalHistory.find(entry => entry.taskId === taskId);

      return {
        taskId,
        status: historyEntry.status || 'processing',
        aiProcessed: historyEntry.aiProcessed || false,
        confidence: historyEntry.confidence || 0.0,
        category: historyEntry.diagnosis,
        symptoms: historyEntry.symptoms ? historyEntry.symptoms.split(', ') : [],
        recommendations: historyEntry.treatment ? historyEntry.treatment.split(', ') : [],
        updatedAt: historyEntry.date
      };

    } catch (error) {
      console.error('Failed to get processing status:', error);
      return {
        taskId,
        status: 'error',
        error: error.message
      };
    }
  }

  async queueAnalysisTask(taskData) {
    try {
      // For now, process immediately in background
      // In production, you'd use a proper queue like Bull or Agenda

      // ✅ REMOVED DUPLICATE ANALYSIS: Document analysis is already handled by documentAnalysisService.js
      console.log(`📋 Analysis task queued (handled by document upload workflow): ${taskData.taskId}`);

      return {
        success: true,
        position: 1, // Simple queue position
        estimatedTime: taskData.priority === 'high' ? 300000 : 600000 // 5-10 minutes
      };

    } catch (error) {
      console.error('Failed to queue analysis task:', error);
      throw error;
    }
  }
}

module.exports = MedicalParsingService;