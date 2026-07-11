/**
 * Drug Interaction Service
 * Uses Gemini AI for comprehensive drug interaction checking instead of hardcoded rules
 * 
 * ⚠️ CRITICAL: Life-critical functionality for patient safety
 */

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class DrugInteractionService {
  constructor() {
    this.serviceId = 'drug-interaction-service';
    this.serviceToken = null;
    this.initialized = false;
    // Keep minimal fallback data for when API is unavailable
    // This is NOT for medical decisions, just basic categorization
    this.drugClasses = {
      'nsaids': ['ibuprofen', 'naproxen', 'diclofenac', 'celecoxib', 'meloxicam'],
      'ace_inhibitors': ['lisinopril', 'enalapril', 'ramipril', 'captopril'],
      'beta_blockers': ['metoprolol', 'atenolol', 'propranolol', 'carvedilol'],
      'statins': ['atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin'],
      'ssri': ['sertraline', 'escitalopram', 'fluoxetine', 'paroxetine', 'citalopram'],
      'blood_thinners': ['warfarin', 'rivaroxaban', 'apixaban', 'dabigatran', 'clopidogrel']
    };
    
    // Common brand to generic mappings (for normalization only)
    this.brandToGeneric = {
      'coumadin': 'warfarin',
      'zocor': 'simvastatin',
      'lipitor': 'atorvastatin',
      'plavix': 'clopidogrel',
      'glucophage': 'metformin',
      'zoloft': 'sertraline',
      'lexapro': 'escitalopram',
      'prinivil': 'lisinopril',
      'norvasc': 'amlodipine',
      'cipro': 'ciprofloxacin',
      'amoxil': 'amoxicillin',
      'advil': 'ibuprofen',
      'motrin': 'ibuprofen',
      'ultram': 'tramadol'
    };
  }
  async initialize() {
    if (this.initialized) return;
    
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      const secureDataAccess = proxy.getService('secureDataAccess');
      
      // Authenticate service with serviceAccountManager
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Initialize secure config service
      // SecureConfigService already initialized globally
      // Set initialized flag
      this.initialized = true;
      
      // Log initialization
      await secureDataAccess.insert('audit_logs', {
        action: 'SERVICE_INITIALIZED',
        service: 'drugInteractionService',
        timestamp: new Date()
      }, {
        serviceId: 'drug-interaction-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: 'global'
      });
      
      return this;
    } catch (error) {
      throw new Error(`Failed to initialize DrugInteractionService: ${error.message}`);
    }
  }

  // Helper methods for service access - CRITICAL for life-safety operations
  getSecureDataAccess() {
    return getServiceProxy().getService('secureDataAccess');
  }

  getGeminiMedicalService() {
    return getServiceProxy().getService('geminiMedicalService');
  }

  getSecureConfigService() {
    return getServiceProxy().getService('secureConfigService');
  }

  /**
   * Main drug interaction checking function - now uses Gemini AI
   */
  async checkInteractions(medications, patientContext = {}, language = 'en') {
    const isHebrew = language === 'he';
    
    // Normalize medication names for consistency
    const normalizedMeds = medications.map(med => {
      const name = typeof med === 'string' ? med : (med.name || med.medicationName);
      return {
        name: this.normalizeDrugName(name),
        dose: typeof med === 'object' ? med.dose : undefined,
        frequency: typeof med === 'object' ? med.frequency : undefined
      };
    });
    
    try {
      // Use Gemini AI for drug interaction checking
      const geminiResult = await this.getGeminiMedicalService().checkDrugInteractions(normalizedMeds);
      
      // Format the response to match expected structure
      const interactions = {
        contraindicated: this.formatInteractions(geminiResult.interactions, 'contraindicated'),
        major: this.formatInteractions(geminiResult.interactions, 'major'),
        moderate: this.formatInteractions(geminiResult.interactions, 'moderate'),
        minor: this.formatInteractions(geminiResult.interactions, 'minor'),
        food: this.formatFoodInteractions(geminiResult.interactions),
        monitoring: this.formatMonitoring(geminiResult.interactions),
        recommendations: this.formatRecommendations(geminiResult.recommendations || [], isHebrew),
        alternatives: geminiResult.alternativeRegimens || [],
        summary: this.formatSummary(geminiResult, isHebrew),
        aiAnalysis: geminiResult // Keep raw AI analysis for reference
      };
      
      return interactions;
      
    } catch (error) {
      console.error('Gemini API error, using fallback:', error);
      // Fallback to basic response without medical decisions
      return this.basicFallbackResponse(normalizedMeds, isHebrew);
    }
  }
  
  /**
   * Format interactions by severity
   */
  formatInteractions(interactions, severity) {
    if (!interactions) return [];
    
    return interactions
      .filter(i => i.severity === severity)
      .map(i => ({
        drugs: [i.drug1, i.drug2],
        severity: i.severity,
        message: i.clinicalEffect || `${severity} interaction detected`,
        mechanism: i.mechanism,
        management: i.management
      }));
  }
  
  /**
   * Format food interactions
   */
  formatFoodInteractions(interactions) {
    if (!interactions) return [];
    
    const foodInteractions = [];
    const processedDrugs = new Set();
    
    interactions.forEach(i => {
      if (i.foodInteraction && !processedDrugs.has(i.drug1)) {
        foodInteractions.push({
          drug: i.drug1,
          foods: Array.isArray(i.foodInteraction) ? i.foodInteraction : [i.foodInteraction]
        });
        processedDrugs.add(i.drug1);
      }
    });
    
    return foodInteractions;
  }
  
  /**
   * Format monitoring requirements
   */
  formatMonitoring(interactions) {
    if (!interactions) return [];
    
    const monitoring = [];
    const processedDrugs = new Set();
    
    interactions.forEach(i => {
      if (i.monitoringRequired && Array.isArray(i.monitoringRequired)) {
        i.monitoringRequired.forEach(req => {
          const drug = i.drug1 || i.drug2;
          if (!processedDrugs.has(`${drug}-${req}`)) {
            monitoring.push({
              drug: drug,
              requirement: req
            });
            processedDrugs.add(`${drug}-${req}`);
          }
        });
      }
    });
    
    return monitoring;
  }
  
  /**
   * Format recommendations
   */
  formatRecommendations(recommendations, isHebrew) {
    return recommendations.map(rec => ({
      severity: this.mapRecommendationSeverity(rec.priority || rec),
      text: isHebrew ? this.translateRecommendation(rec) : (rec.text || rec),
      action: rec.action || 'consultation_recommended'
    }));
  }
  
  /**
   * Format summary from Gemini result
   */
  formatSummary(geminiResult, isHebrew) {
    const hasContraindicated = geminiResult.severityLevel === 'contraindicated';
    const hasMajor = geminiResult.severityLevel === 'major';
    const hasInteractions = geminiResult.hasInteractions;
    
    if (hasContraindicated) {
      return isHebrew
        ? 'זוהו אינטראקציות מסוכנות - אסור לתת תרופות אלו יחד'
        : 'Dangerous interactions detected - Do not administer these medications together';
    } else if (hasMajor) {
      return isHebrew
        ? 'זוהו אינטראקציות משמעותיות - נדרשת התייעצות רפואית'
        : 'Major interactions detected - Medical consultation required';
    } else if (hasInteractions) {
      return isHebrew
        ? 'זוהו אינטראקציות - נדרש מעקב'
        : 'Interactions detected - Monitoring required';
    } else {
      return isHebrew
        ? 'לא זוהו אינטראקציות משמעותיות'
        : 'No significant interactions detected';
    }
  }
  
  /**
   * Basic fallback response when API is unavailable
   * NO medical decisions - just data formatting
   */
  basicFallbackResponse(medications, isHebrew) {
    return {
      contraindicated: [],
      major: [],
      moderate: [],
      minor: [],
      food: [],
      monitoring: [],
      recommendations: [{
        severity: 'critical',
        text: isHebrew 
          ? 'נדרשת בדיקת אינטראקציות על ידי רופא - המערכת לא זמינה כעת'
          : 'Drug interaction check by physician required - System temporarily unavailable',
        action: 'immediate_consultation'
      }],
      alternatives: [],
      summary: isHebrew
        ? 'נדרשת הערכה רפואית - המערכת לא זמינה כעת'
        : 'Medical evaluation required - System temporarily unavailable',
      fallbackMode: true
    };
  }
  
  /**
   * Normalize drug name (remove brand names, standardize)
   */
  normalizeDrugName(drugName) {
    if (!drugName) return '';
    
    const normalized = drugName.toLowerCase().trim();
    return this.brandToGeneric[normalized] || normalized;
  }
  
  /**
   * Map recommendation priority to severity
   */
  mapRecommendationSeverity(priority) {
    const severityMap = {
      'critical': 'critical',
      'high': 'high',
      'medium': 'medium',
      'low': 'low',
      'routine': 'info'
    };
    return severityMap[priority] || 'info';
  }
  
  /**
   * Translate recommendation to Hebrew
   */
  translateRecommendation(rec) {
    const text = rec.text || rec;
    const translations = {
      'Do not administer together': 'אסור לתת יחד',
      'Medical consultation required': 'נדרשת התייעצות רפואית',
      'Monitor closely': 'נדרש מעקב צמוד',
      'Use with caution': 'להשתמש בזהירות',
      'Consider alternatives': 'לשקול חלופות'
    };
    
    for (const [en, he] of Object.entries(translations)) {
      if (text.includes(en)) {
        return text.replace(en, he);
      }
    }
    
    return text;
  }
  
  /**
   * Generate recommendations based on interactions (legacy method for backward compatibility)
   */
  async generateRecommendations(interactions, language = 'en') {
    // This method is kept for backward compatibility
    // It now just formats the recommendations that already came from Gemini
    const isHebrew = language === 'he';
    
    if (interactions.recommendations && interactions.recommendations.length > 0) {
      return interactions.recommendations;
    }
    
    // If no recommendations from main check, generate basic ones
    const recommendations = [];
    
    if (interactions.contraindicated && interactions.contraindicated.length > 0) {
      recommendations.push({
        severity: 'critical',
        text: isHebrew 
          ? 'יש תרופות שאסור לקחת יחד. יש להתייעץ עם רופא מיידית!'
          : 'There are contraindicated medications. Consult a doctor immediately!',
        action: 'immediate_consultation'
      });
    }
    
    if (interactions.major && interactions.major.length > 0) {
      recommendations.push({
        severity: 'high',
        text: isHebrew
          ? 'יש אינטראקציות משמעותיות בין התרופות. נדרשת התייעצות עם רופא.'
          : 'Major drug interactions detected. Medical consultation required.',
        action: 'consultation_required'
      });
    }
    
    if (interactions.moderate && interactions.moderate.length > 0) {
      recommendations.push({
        severity: 'medium',
        text: isHebrew
          ? 'יש אינטראקציות בינוניות. מומלץ להתייעץ עם רופא או רוקח.'
          : 'Moderate interactions found. Consult with doctor or pharmacist.',
        action: 'monitoring_recommended'
      });
    }
    
    return recommendations;
  }
}

// Create and export singleton instance
const drugInteractionService = new DrugInteractionService();

// Register service with proxy manager - CRITICAL for patient safety
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('drugInteractionService', () => drugInteractionService);
}

module.exports = drugInteractionService;