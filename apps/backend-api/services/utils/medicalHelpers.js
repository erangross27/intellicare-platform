/**
 * MedicalHelpers - Extracted helper functions from agentServiceV4
 * Auto-generated on 2025-10-06T13:43:17.481Z
 */

class MedicalHelpers {

    detectMedicalIntent(message) {
      if (!message) return 'GENERAL';
  
      const messageStr = typeof message === 'string' ? message.toLowerCase() : String(message || '').toLowerCase();
  
      if (/\b(labs?|blood|glucose|a1c|results|test)\b/i.test(messageStr)) return 'ANALYZE';
      if (/\b(summary|overview|status|how is|doing)\b/i.test(messageStr)) return 'SUMMARY';
      if (/\b(history|past|timeline|previous visits)\b/i.test(messageStr)) return 'HISTORY';
      if (/\b(urgent|critical|emergency|stat)\b/i.test(messageStr)) return 'CRITICAL';
      if (/\b(schedule|order|prescribe|refer)\b/i.test(messageStr)) return 'ACTION';
  
      return 'GENERAL';
    }

    parseSearchCriteria(params) {
      // If params already has the right structure, use it
      if (params.medicalConditions || params.medications || params.ageRange) {
        return params;
      }
  
      // If it's a simple name query, return it as a name search
      if (params.query || params.text) {
        const query = params.query || params.text;
  
        // Check if SearchQueryParser exists and can handle it
        try {
          const SearchQueryParser = require('./searchQueryParser');
          const parser = new SearchQueryParser();
          const parsed = parser.parsePatientSearch(query);
  
          // If parser returned empty, treat as name search
          if (!parsed || Object.keys(parsed).length === 0) {
            return { query: query };
          }
          return parsed;
        } catch (error) {
          // If parser doesn't exist or fails, treat as name search
          console.log('SearchQueryParser not available, treating as name search');
          return { query: query };
        }
      }
  
      // Otherwise return params as is
      return params;
    }

    detectSearchMode(params, session) {
      const progressiveKeywords = [
        'filter', 'narrow', 'from those', 'of these',
        'additionally', 'also', 'further'
      ];
  
      const query = params.query || params.text || '';
      const isProgressive = progressiveKeywords.some(k =>
        query.toLowerCase().includes(k)
      );
  
      return isProgressive && session?.lastSearch ? 'progressive' : 'fresh';
    }

    getConditionCollectionName(condition) {
      const conditionMap = {
        'diabetes': 'diabetes_management_notes',
        'asthma': 'asthma_management_notes',
        'copd': 'copd_assessments',
        'arthritis': 'arthritis_assessments',
        'kidney': 'kidney_function_reports',
        'liver': 'liver_function_assessments',
        'thyroid': 'thyroid_evaluations',
        'hypertension': 'hypertension_management',
        'heart disease': 'cardiac_assessments',
        'cancer': 'oncology_reports',
        'depression': 'mental_health_assessments',
        'anxiety': 'mental_health_assessments'
      };
  
      const lowerCondition = condition.toLowerCase();
      for (const [key, collection] of Object.entries(conditionMap)) {
        if (lowerCondition.includes(key)) {
          return collection;
        }
      }
  
      return null;
    }

    isSensitiveFunction(functionName) {
      const sensitiveFunctions = [
        'addPatient', 'updatePatient', 'getPatient',
        'getDocuments', 'analyzeUploadedDocuments',
        'getBillingInfo', 'processPayment'
      ];
      return sensitiveFunctions.includes(functionName);
    }

    isCriticalFunction(functionName) {
      const criticalFunctions = [
        'addPatient', 'updatePatient', 'searchPatients',
        'bookAppointment', 'cancelAppointment'
      ];
      return criticalFunctions.includes(functionName);
    }

    getCategoryIcon(categoryName) {
      const iconLoader = require('./gridMappings/iconLoader');
      return iconLoader.getIcon(categoryName);
    }

    getServiceByName(serviceName) {
      const services = {
        'conversationalAnalytics': conversationalAnalytics,
        'predictiveAnalyticsAI': predictiveAnalyticsAI,
        'realtimeChart': realtimeChart,
        'referralManagement': referralManagement,
        'billingService': billingService,
        'diagnosisSupport': diagnosisSupport,
        'clinicalNotes': clinicalNotes,
        'treatmentPlanning': treatmentPlanning
      };
      
      return services[serviceName];
    }
}

module.exports = MedicalHelpers;
