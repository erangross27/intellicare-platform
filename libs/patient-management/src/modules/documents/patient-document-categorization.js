/**
 * Patient Document Categorization Module
 * Handles automatic document categorization, tagging, and organization using AI and ML
 */

// Add ServiceProxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class PatientDocumentCategorization {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.categoryRules = this.initializeCategoryRules();
    this.tagSuggestions = this.initializeTagSuggestions();
  }

  async initialize() {
    if (this.initialized) return;
    
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('patient-document-categorization');
    this.initialized = true;
    console.log('✅ [PatientDocumentCategorization] Service initialized');
  }

  /**
   * Automatically categorize document based on content and metadata
   * @param {string} documentId - Document ID
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @param {Object} options - Categorization options
   * @returns {Object} Categorization result
   */
  async categorizeDocument(documentId, practiceContext, session, options = {}) {
    console.log('🏷️ [PatientDocumentCategorization] Categorizing document:', documentId);

    try {
      if (!documentId) {
        return {
          success: false,
          error: 'MISSING_DOCUMENT_ID',
          message: 'Document ID is required'
        };
      }

      // Get document with extracted data
      const document = await this.getDocumentWithExtractedData(documentId, practiceContext);
      if (!document) {
        return {
          success: false,
          error: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found'
        };
      }

      // Perform categorization analysis
      const categoryAnalysis = await this.performCategoryAnalysis(document, options);
      
      // Generate tags
      const tagAnalysis = await this.generateTags(document, categoryAnalysis);
      
      // Apply categorization rules
      const ruleBasedCategory = this.applyCategorizationRules(document, categoryAnalysis);
      
      // Combine results
      const categorizationResult = {
        documentId,
        previousCategory: document.category,
        suggestedCategory: ruleBasedCategory.category,
        confidence: ruleBasedCategory.confidence,
        alternativeCategories: categoryAnalysis.alternativeCategories,
        suggestedTags: tagAnalysis.tags,
        reasoning: ruleBasedCategory.reasoning,
        needsReview: ruleBasedCategory.confidence < 0.8,
        categorizedAt: new Date()
      };

      // Store categorization results
      await this.storeCategorization(categorizationResult, practiceContext);

      // Update document if confidence is high enough or auto-update is enabled
      if (options.autoUpdate || ruleBasedCategory.confidence >= 0.9) {
        await this.updateDocumentCategory(documentId, categorizationResult, practiceContext);
        categorizationResult.applied = true;
      } else {
        categorizationResult.applied = false;
      }

      // Create audit trail
      await this.createAuditTrail(document.patientId, 'DOCUMENT_CATEGORIZED', categorizationResult, session, practiceContext);

      return {
        success: true,
        categorization: categorizationResult,
        message: 'Document categorization completed'
      };

    } catch (error) {
      console.error('❌ [PatientDocumentCategorization] Categorization failed:', error);
      return {
        success: false,
        error: 'CATEGORIZATION_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Batch categorize multiple documents
   * @param {Array} documentIds - Array of document IDs
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @param {Object} options - Batch options
   * @returns {Object} Batch categorization result
   */
  async batchCategorizeDocuments(documentIds, practiceContext, session, options = {}) {
    console.log('🏷️ [PatientDocumentCategorization] Batch categorizing documents:', documentIds.length);

    try {
      const results = [];
      const errors = [];

      for (const documentId of documentIds) {
        try {
          const result = await this.categorizeDocument(documentId, practiceContext, session, options);
          results.push({
            documentId,
            success: result.success,
            categorization: result.categorization
          });
        } catch (error) {
          errors.push({
            documentId,
            error: error.message
          });
        }
      }

      return {
        success: true,
        totalProcessed: documentIds.length,
        successCount: results.filter(r => r.success).length,
        errorCount: errors.length,
        results,
        errors,
        message: 'Batch categorization completed'
      };

    } catch (error) {
      console.error('❌ [PatientDocumentCategorization] Batch categorization failed:', error);
      return {
        success: false,
        error: 'BATCH_CATEGORIZATION_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Get category suggestions based on content
   * @param {Object} document - Document object
   * @param {string} extractedText - Extracted text content
   * @returns {Object} Category suggestions
   */
  async getCategorySuggestions(document, extractedText) {
    try {
      const suggestions = [];
      
      // Analyze filename
      const filenameAnalysis = this.analyzeFilename(document.filename);
      if (filenameAnalysis.category) {
        suggestions.push({
          category: filenameAnalysis.category,
          confidence: filenameAnalysis.confidence,
          source: 'filename'
        });
      }

      // Analyze content keywords
      if (extractedText) {
        const contentAnalysis = this.analyzeContentKeywords(extractedText);
        suggestions.push(...contentAnalysis);
      }

      // Analyze MIME type
      const mimeTypeAnalysis = this.analyzeMimeType(document.mimeType);
      if (mimeTypeAnalysis.category) {
        suggestions.push({
          category: mimeTypeAnalysis.category,
          confidence: mimeTypeAnalysis.confidence,
          source: 'mime_type'
        });
      }

      // Sort by confidence and return top suggestions
      return suggestions
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);

    } catch (error) {
      console.error('❌ [PatientDocumentCategorization] Category suggestion failed:', error);
      return [];
    }
  }

  /**
   * Perform category analysis on document
   */
  async performCategoryAnalysis(document, options) {
    const extractedText = document.extractedData?.fullText || '';
    const suggestions = await this.getCategorySuggestions(document, extractedText);
    
    const analysis = {
      primarySuggestion: suggestions[0] || { category: 'other', confidence: 0.5 },
      alternativeCategories: suggestions.slice(1),
      analysisMethod: 'rule_based_with_content',
      analysisDate: new Date()
    };

    return analysis;
  }

  /**
   * Generate tags for document
   */
  async generateTags(document, categoryAnalysis) {
    const tags = new Set();
    const extractedText = document.extractedData?.fullText || '';

    // Add category-based tags
    const category = categoryAnalysis.primarySuggestion.category;
    if (this.tagSuggestions[category]) {
      this.tagSuggestions[category].forEach(tag => tags.add(tag));
    }

    // Add content-based tags
    const contentTags = this.extractContentTags(extractedText);
    contentTags.forEach(tag => tags.add(tag));

    // Add metadata-based tags
    if (document.fileSize > 5 * 1024 * 1024) tags.add('large_file');
    if (document.mimeType.startsWith('image/')) tags.add('image');
    if (document.filename.toLowerCase().includes('urgent')) tags.add('urgent');

    // Add date-based tags
    const uploadDate = new Date(document.uploadedAt);
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    tags.add(`${uploadDate.getFullYear()}`);
    tags.add(`${monthNames[uploadDate.getMonth()]}_${uploadDate.getFullYear()}`);

    return {
      tags: Array.from(tags).slice(0, 10), // Limit to 10 tags
      tagSource: 'auto_generated',
      generatedAt: new Date()
    };
  }

  /**
   * Apply categorization rules
   */
  applyCategorizationRules(document, analysis) {
    const rules = this.categoryRules;
    let bestMatch = { category: 'other', confidence: 0.5, reasoning: 'default' };

    // Check each rule
    for (const rule of rules) {
      const match = rule.evaluate(document, analysis);
      if (match.confidence > bestMatch.confidence) {
        bestMatch = {
          category: rule.category,
          confidence: match.confidence,
          reasoning: match.reasoning
        };
      }
    }

    return bestMatch;
  }

  /**
   * Initialize categorization rules
   */
  initializeCategoryRules() {
    return [
      {
        category: 'lab_results',
        evaluate: (doc, analysis) => {
          const text = doc.extractedData?.fullText?.toLowerCase() || '';
          const filename = doc.filename.toLowerCase();
          
          const labKeywords = ['lab', 'blood', 'urine', 'test results', 'glucose', 'cholesterol', 'hemoglobin'];
          const keywordMatches = labKeywords.filter(keyword => 
            text.includes(keyword) || filename.includes(keyword)
          );
          
          const confidence = Math.min(0.95, keywordMatches.length * 0.2 + 0.3);
          return {
            confidence,
            reasoning: `Found lab keywords: ${keywordMatches.join(', ')}`
          };
        }
      },
      {
        category: 'imaging',
        evaluate: (doc, analysis) => {
          const text = doc.extractedData?.fullText?.toLowerCase() || '';
          const filename = doc.filename.toLowerCase();
          
          const imagingKeywords = ['x-ray', 'mri', 'ct scan', 'ultrasound', 'radiology', 'imaging'];
          const keywordMatches = imagingKeywords.filter(keyword => 
            text.includes(keyword) || filename.includes(keyword)
          );
          
          const confidence = Math.min(0.9, keywordMatches.length * 0.25 + 0.2);
          return {
            confidence,
            reasoning: `Found imaging keywords: ${keywordMatches.join(', ')}`
          };
        }
      },
      {
        category: 'prescription',
        evaluate: (doc, analysis) => {
          const text = doc.extractedData?.fullText?.toLowerCase() || '';
          const filename = doc.filename.toLowerCase();
          
          const prescriptionKeywords = ['prescription', 'medication', 'pharmacy', 'rx', 'dosage', 'refill'];
          const keywordMatches = prescriptionKeywords.filter(keyword => 
            text.includes(keyword) || filename.includes(keyword)
          );
          
          const confidence = Math.min(0.92, keywordMatches.length * 0.2 + 0.4);
          return {
            confidence,
            reasoning: `Found prescription keywords: ${keywordMatches.join(', ')}`
          };
        }
      },
      {
        category: 'insurance_card',
        evaluate: (doc, analysis) => {
          const text = doc.extractedData?.fullText?.toLowerCase() || '';
          const filename = doc.filename.toLowerCase();
          
          const insuranceKeywords = ['insurance', 'member id', 'group number', 'coverage', 'plan', 'ppo', 'hmo'];
          const keywordMatches = insuranceKeywords.filter(keyword => 
            text.includes(keyword) || filename.includes(keyword)
          );
          
          const confidence = Math.min(0.88, keywordMatches.length * 0.15 + 0.3);
          return {
            confidence,
            reasoning: `Found insurance keywords: ${keywordMatches.join(', ')}`
          };
        }
      }
    ];
  }

  /**
   * Initialize tag suggestions by category
   */
  initializeTagSuggestions() {
    return {
      lab_results: ['lab', 'blood_work', 'diagnostic', 'results', 'medical_test'],
      imaging: ['radiology', 'scan', 'image', 'diagnostic_imaging', 'medical_image'],
      prescription: ['medication', 'pharmacy', 'treatment', 'prescription', 'drug'],
      insurance_card: ['insurance', 'coverage', 'member_info', 'benefits', 'plan'],
      medical_history: ['history', 'medical_record', 'patient_info', 'clinical', 'health_record'],
      consent_form: ['consent', 'authorization', 'legal', 'signature', 'agreement'],
      referral: ['referral', 'specialist', 'consultation', 'appointment', 'provider'],
      discharge_summary: ['discharge', 'summary', 'hospital', 'admission', 'care_plan']
    };
  }

  /**
   * Analyze filename for category hints
   */
  analyzeFilename(filename) {
    const lower = filename.toLowerCase();
    
    const patterns = {
      lab_results: /lab|blood|test.*result|glucose|cholesterol/i,
      imaging: /x.*ray|mri|ct|scan|ultrasound|radiology/i,
      prescription: /prescription|rx|medication|pharmacy/i,
      insurance_card: /insurance|coverage|member.*card/i
    };

    for (const [category, pattern] of Object.entries(patterns)) {
      if (pattern.test(lower)) {
        return { category, confidence: 0.7 };
      }
    }

    return { category: null, confidence: 0 };
  }

  /**
   * Analyze MIME type for category hints
   */
  analyzeMimeType(mimeType) {
    if (mimeType.startsWith('image/')) {
      return { category: 'imaging', confidence: 0.4 };
    }
    
    return { category: null, confidence: 0 };
  }

  /**
   * Analyze content keywords
   */
  analyzeContentKeywords(text) {
    const suggestions = [];
    const lower = text.toLowerCase();

    // Define keyword patterns
    const categoryKeywords = {
      lab_results: ['laboratory', 'specimen', 'reference range', 'normal', 'abnormal', 'mg/dl'],
      prescription: ['take', 'daily', 'twice', 'refills', 'generic', 'brand name'],
      imaging: ['impression', 'findings', 'no acute', 'unremarkable', 'contrast'],
      medical_history: ['history of', 'diagnosed with', 'chronic', 'acute', 'symptoms']
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const matches = keywords.filter(keyword => lower.includes(keyword));
      if (matches.length > 0) {
        suggestions.push({
          category,
          confidence: Math.min(0.8, matches.length * 0.15 + 0.2),
          source: 'content_keywords',
          keywords: matches
        });
      }
    }

    return suggestions;
  }

  /**
   * Extract content-based tags
   */
  extractContentTags(text) {
    const tags = [];
    const lower = text.toLowerCase();

    // Medical specialties
    const specialties = ['cardiology', 'neurology', 'orthopedic', 'dermatology', 'psychiatry'];
    specialties.forEach(specialty => {
      if (lower.includes(specialty)) tags.push(specialty);
    });

    // Urgency indicators
    if (lower.includes('urgent') || lower.includes('stat') || lower.includes('emergency')) {
      tags.push('urgent');
    }

    // Follow-up indicators
    if (lower.includes('follow up') || lower.includes('return') || lower.includes('recheck')) {
      tags.push('follow_up');
    }

    return tags;
  }

  /**
   * Get document with extracted data
   */
  async getDocumentWithExtractedData(documentId, practiceContext) {
    const context = {
      serviceId: 'patient-document-categorization',
      operation: 'get-document',
      practiceId: practiceContext.practiceId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };

    const proxy = getServiceProxy();
    const SecureDataAccess = proxy.getService('secureDataAccess');
    const documents = await SecureDataAccess.query(
      'patient_documents',
      { documentId },
      { limit: 1 },
      context
    );

    return documents && documents.length > 0 ? documents[0] : null;
  }

  /**
   * Store categorization results
   */
  async storeCategorization(categorization, practiceContext) {
    const context = {
      serviceId: 'patient-document-categorization',
      operation: 'store-categorization',
      practiceId: practiceContext.practiceId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };

    const proxy = getServiceProxy();
    const SecureDataAccess = proxy.getService('secureDataAccess');
    await SecureDataAccess.create('document_categorizations', {
      ...categorization,
      practiceId: practiceContext.practiceId
    }, context);
  }

  /**
   * Update document category
   */
  async updateDocumentCategory(documentId, categorization, practiceContext) {
    const context = {
      serviceId: 'patient-document-categorization',
      operation: 'update-category',
      practiceId: practiceContext.practiceId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };

    const proxy = getServiceProxy();
    const SecureDataAccess = proxy.getService('secureDataAccess');
    await SecureDataAccess.update(
      'patient_documents',
      { documentId },
      {
        category: categorization.suggestedCategory,
        tags: categorization.suggestedTags,
        categorizedAt: categorization.categorizedAt,
        categoryConfidence: categorization.confidence
      },
      context
    );
  }

  /**
   * Create audit trail for categorization operations
   */
  async createAuditTrail(patientId, action, data, session, practiceContext) {
    const auditRecord = {
      action,
      patientId,
      data: {
        documentId: data.documentId,
        previousCategory: data.previousCategory,
        suggestedCategory: data.suggestedCategory,
        confidence: data.confidence
      },
      userId: session?.userId || 'system',
      timestamp: new Date(),
      practiceId: practiceContext.practiceId
    };

    console.log('📝 [PatientDocumentCategorization] Audit trail created:', auditRecord);
  }
}

// Create singleton instance
const patientDocumentCategorization = new PatientDocumentCategorization();

// Register with service proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('patientDocumentCategorization', () => patientDocumentCategorization);
}

module.exports = patientDocumentCategorization;