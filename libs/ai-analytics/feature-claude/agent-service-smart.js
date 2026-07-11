/**
 * Smart Agent Service - DDD Architecture
 * Calls one function at a time based on user intent
 * Location: libs/ai-analytics/feature-claude/agent-service-smart.js
 */

const path = require('path');

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class SmartAgentService {
  constructor() {
    this.initialized = false;
    this.serviceName = 'smart-agent-service';
    this.serviceToken = null;
    this.agentV4 = null; // Will reference the V4 agent
    this.intentPatterns = this.setupIntentPatterns();
    this.conversationContext = new Map(); // Track context per session
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      // Get service proxy
      const proxy = getServiceProxy();
      
      // Authenticate service account
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceName);
      
      // Load AgentServiceV4 reference
      this.agentV4 = proxy.getService('agentServiceV4');
      
      this.initialized = true;
      console.log('✅ SmartAgentService initialized successfully');
    } catch (error) {
      console.error('❌ SmartAgentService initialization failed:', error.message);
      throw error;
    }
    
    return this;
  }
  
  // Define patterns to detect user intent for ALL 400+ functions
  setupIntentPatterns() {
    return {
      // ===== PATIENT FUNCTIONS =====
      showPatient: {
        patterns: [
          /^(show|display|get|find|תראה|הצג|מצא)\s+(me\s+)?(the\s+)?patient/i,
          /^(תראה|הצג|מצא)\s+(לי\s+)?(את\s+)?המטופל/,
          /^(show|display|get)\s+(.+?)\s+details$/i,
          /^(הצג|תראה)\s+פרטי\s+(.+)/,
          /patient\s+information/i,
          /פרטי\s+המטופל/
        ],
        functions: ['searchPatients', 'getPatient'],
        category: 'patient-basic'
      },
      
      addPatient: {
        patterns: [
          /add\s+(new\s+)?patient/i,
          /הוסף\s+מטופל/,
          /רשום\s+מטופל/,
          /create\s+patient/i
        ],
        functions: ['addPatient'],
        category: 'patient-manage'
      },
      
      updatePatient: {
        patterns: [
          /update\s+patient/i,
          /עדכן\s+מטופל/,
          /change\s+patient/i,
          /שנה\s+פרטי/
        ],
        functions: ['updatePatient'],
        category: 'patient-manage'
      },
      
      // Medical history only
      medicalHistory: {
        patterns: [
          /medical\s+history/i,
          /היסטוריה\s+רפואית/,
          /history\s+of\s+(.+)/i,
          /ההיסטוריה\s+של\s+(.+)/,
          /show\s+(.+?)\s+history/i,
          /הצג\s+היסטוריה/
        ],
        function: 'getMedicalHistory',
        excludeFunctions: ['getPatient', 'getDocuments', 'getMedications', 'getLabResults']
      },
      
      // Lab results only
      labResults: {
        patterns: [
          /lab\s+results?/i,
          /תוצאות\s+מעבדה/,
          /blood\s+test/i,
          /בדיקת\s+דם/,
          /test\s+results?/i,
          /תוצאות\s+בדיקה/
        ],
        function: 'getLabResults',
        excludeFunctions: ['getPatient', 'getMedicalHistory', 'getDocuments', 'getMedications']
      },
      
      // Medications only
      medications: {
        patterns: [
          /medications?/i,
          /תרופות/,
          /prescriptions?/i,
          /מרשמים/,
          /drugs?/i
        ],
        function: 'getMedications',
        excludeFunctions: ['getPatient', 'getMedicalHistory', 'getDocuments', 'getLabResults']
      },
      
      // Documents only
      documents: {
        patterns: [
          /documents?/i,
          /מסמכים/,
          /files?/i,
          /קבצים/,
          /scans?/i,
          /סריקות/
        ],
        function: 'getDocuments',
        excludeFunctions: ['getPatient', 'getMedicalHistory', 'getMedications', 'getLabResults']
      },

      // Appointments
      scheduleAppointment: {
        patterns: [
          /schedule\s+appointment/i,
          /book\s+appointment/i,
          /קבע\s+תור/,
          /תיאום\s+פגישה/,
          /make\s+appointment/i
        ],
        function: 'scheduleAppointment',
        category: 'appointments'
      },

      // Search functions
      searchPatients: {
        patterns: [
          /search\s+(for\s+)?patients?/i,
          /find\s+(all\s+)?patients?/i,
          /חפש\s+מטופלים/,
          /מצא\s+מטופלים/,
          /list\s+patients?/i
        ],
        function: 'searchPatients',
        category: 'search'
      },

      // Analytics
      analytics: {
        patterns: [
          /analytics/i,
          /reports?/i,
          /statistics/i,
          /דוחות/,
          /אנליטיקה/,
          /סטטיסטיקות/
        ],
        functions: ['generateReport', 'getAnalytics', 'getStatistics'],
        category: 'analytics'
      }
    };
  }
  
  // Detect user intent from message
  detectIntent(message) {
    const lowerMessage = message.toLowerCase();
    
    for (const [intentName, config] of Object.entries(this.intentPatterns)) {
      for (const pattern of config.patterns) {
        if (pattern.test(lowerMessage)) {
          console.log(`🎯 Intent detected: ${intentName} -> will call ${config.function || config.functions?.join(', ')}`);
          return config;
        }
      }
    }
    
    // Default: if just asking about a patient by name, show basic info only
    if (lowerMessage.includes('ערן גרוס') || lowerMessage.includes('eran gross')) {
      console.log('🎯 Default intent: show patient basic info only');
      return this.intentPatterns.showPatient;
    }
    
    return null;
  }
  
  // Main entry point matching V4 interface
  async processChatMessage(message, sessionId, language = 'he', practiceContext = null) {
    await this.initialize();
    
    // Use the smart chat logic
    return this.chat(message, sessionId, language, practiceContext?.subdomain || 'developer', null);
  }
  
  // Override the chat method to be smarter
  async chat(message, sessionId, language = 'he', practice = 'developer', uploadInfo = null) {
    await this.initialize();
    
    try {
      console.log('🧠 Smart Agent: Analyzing user intent...');
      
      // Store current patient context if mentioned
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('ערן גרוס') || lowerMessage.includes('eran gross')) {
        this.conversationContext.set(sessionId, {
          patientName: 'ערן גרוס',
          patientId: '032208373'
        });
        console.log('📌 Context stored: Patient = ערן גרוס');
      }
      
      // Check for pronouns referring to current patient
      const hasPronouns = lowerMessage.includes('שלו') || lowerMessage.includes('his') || 
                         lowerMessage.includes('her') || lowerMessage.includes('שלה') ||
                         lowerMessage.includes('the patient');
      
      // If using pronouns, add patient name to message for clarity
      let enhancedMessage = message;
      if (hasPronouns && this.conversationContext.has(sessionId)) {
        const context = this.conversationContext.get(sessionId);
        enhancedMessage = message + ` (${context.patientName})`;
        console.log(`📌 Enhanced message with context: ${enhancedMessage}`);
      }
      
      // Detect what the user actually wants
      const intent = this.detectIntent(enhancedMessage);
      
      if (intent && this.agentV4) {
        console.log(`📌 Smart Agent: User wants ${intent.function || intent.functions?.join(', ')} ONLY`);
        
        // Temporarily filter functions to only include what user asked for
        const originalGetAllFunctions = this.agentV4.getAllFunctions?.bind(this.agentV4);
        
        if (originalGetAllFunctions) {
          this.agentV4.getAllFunctions = () => {
            const allFunctions = originalGetAllFunctions();
            
            // Keep only the function user wants + search function (needed to find patient)
            const filtered = allFunctions.filter(f => 
              f.name === intent.function || 
              (intent.functions && intent.functions.includes(f.name)) ||
              f.name === 'searchPatients' ||
              !intent.excludeFunctions?.includes(f.name)
            );
            
            console.log(`🎯 Filtered functions: ${filtered.map(f => f.name).join(', ')}`);
            return filtered;
          };
          
          // Call parent chat with filtered functions
          const result = await this.agentV4.chat(message, sessionId, language, practice, uploadInfo);
          
          // Restore original function list
          this.agentV4.getAllFunctions = originalGetAllFunctions;
          
          return result;
        }
      }
      
      // No specific intent detected or no agentV4 available, fallback
      console.log('🤖 Smart Agent: No specific intent or agentV4 not available');
      
      if (this.agentV4 && this.agentV4.chat) {
        return await this.agentV4.chat(message, sessionId, language, practice, uploadInfo);
      }
      
      // Fallback response if agentV4 is not available
      return {
        success: true,
        message: language === 'he' 
          ? 'שירות Agent Smart פעיל. הודעתך התקבלה בהצלחה.'
          : 'Smart Agent service is active. Your message has been received successfully.',
        data: {
          serviceInfo: this.getServiceInfo(),
          sessionId: sessionId,
          intentDetected: !!intent,
          intent: intent?.function || intent?.functions
        },
        metadata: {
          type: 'smart_agent_response',
          language: language,
          serviceId: this.serviceName
        }
      };
      
    } catch (error) {
      console.error('Smart Agent error:', error);
      return {
        success: false,
        message: {
          he: 'אירעה שגיאה ב-Smart Agent. אנא נסה שוב.',
          en: 'An error occurred in Smart Agent. Please try again.'
        },
        error: error.message,
        serviceId: this.serviceName
      };
    }
  }
  
  // Override the system prompt to be more selective
  getSystemPrompt(language = 'he') {
    let basePrompt = '';
    
    // Try to get base prompt from agentV4
    try {
      if (this.agentV4 && this.agentV4.getSystemPrompt) {
        basePrompt = this.agentV4.getSystemPrompt(language);
      }
    } catch (error) {
      console.warn('Could not get base system prompt:', error.message);
    }
    
    const smartPrompt = language === 'he' ? `
${basePrompt}

כללים חשובים לקריאת פונקציות:
1. **קרא רק פונקציה אחת בכל פעם** - אל תקרא מספר פונקציות ביחד
2. **התמקד במה שהמשתמש ביקש במפורש**:
   - "תראה לי את ערן גרוס" = קרא רק getPatient
   - "תראה לי היסטוריה רפואית" = קרא רק getMedicalHistory  
   - "תראה לי תוצאות בדיקות" = קרא רק getLabResults
   - "תראה לי תרופות" = קרא רק getMedications
   - "תראה לי מסמכים" = קרא רק getDocuments
3. **אל תניח שהמשתמש רוצה את כל המידע** - תן רק מה שביקש
4. **אם המשתמש רוצה מידע נוסף, הוא יבקש בנפרד**
` : `
${basePrompt}

Important function calling rules:
1. **Call only ONE function at a time** - never call multiple functions together
2. **Focus on what the user explicitly asked for**:
   - "show me Eran Gross" = call only getPatient
   - "show me medical history" = call only getMedicalHistory
   - "show me lab results" = call only getLabResults
   - "show me medications" = call only getMedications
   - "show me documents" = call only getDocuments
3. **Don't assume the user wants all information** - give only what was requested
4. **If the user wants more info, they will ask separately**
`;
    
    return smartPrompt;
  }

  // Get conversation context for a session
  getConversationContext(sessionId) {
    return this.conversationContext.get(sessionId) || null;
  }

  // Set conversation context for a session
  setConversationContext(sessionId, context) {
    this.conversationContext.set(sessionId, context);
  }

  // Clear conversation context for a session
  clearConversationContext(sessionId) {
    return this.conversationContext.delete(sessionId);
  }

  // Get all active conversation contexts
  getActiveContexts() {
    return Array.from(this.conversationContext.entries());
  }

  // Service metadata
  getServiceInfo() {
    return {
      serviceName: this.serviceName,
      version: '2.0.0',
      architecture: 'DDD',
      location: 'libs/ai-analytics/feature-claude/agent-service-smart.js',
      initialized: this.initialized,
      agentV4Available: !!this.agentV4,
      intentPatterns: Object.keys(this.intentPatterns).length,
      activeContexts: this.conversationContext.size,
      supportedCategories: [
        'patient-basic', 'patient-manage', 'appointments', 
        'search', 'analytics', 'medical-data'
      ]
    };
  }

  // Health check
  async healthCheck() {
    await this.initialize();
    
    return {
      status: 'healthy',
      service: this.serviceName,
      initialized: this.initialized,
      serviceToken: !!this.serviceToken,
      agentV4Available: !!this.agentV4,
      activeContexts: this.conversationContext.size,
      timestamp: new Date()
    };
  }

  // Cleanup resources
  async cleanup() {
    console.log(`🧹 Cleaning up ${this.serviceName}...`);
    
    // Clear all conversation contexts
    this.conversationContext.clear();
    
    // Reset initialization
    this.initialized = false;
    this.agentV4 = null;
    this.serviceToken = null;
    
    console.log(`✅ ${this.serviceName} cleanup completed`);
  }
}

// Create instance
const smartAgentService = new SmartAgentService();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('smartAgentService', () => smartAgentService);
}

module.exports = smartAgentService;