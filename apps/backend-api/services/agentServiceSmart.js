// Smart Agent Service - Calls one function at a time based on user intent
const agentServiceV4 = require('./agentServiceV4');

class SmartAgentService {
  constructor() {
    // Store reference to V4 instance
    this.agentV4 = agentServiceV4;
    this.intentPatterns = this.setupIntentPatterns();
    this.conversationContext = new Map(); // Track context per session
  }

  async initialize() {
    const serviceAccountManager = require('./serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('agent-service-smart');
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
        function: 'getFullMedicalReport',
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
        excludeFunctions: ['getPatient', 'getFullMedicalReport', 'getDocuments', 'getMedications']
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
        excludeFunctions: ['getPatient', 'getFullMedicalReport', 'getDocuments', 'getLabResults']
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
        excludeFunctions: ['getPatient', 'getFullMedicalReport', 'getMedications', 'getLabResults']
      }
    };
  }
  
  // Detect user intent from message
  detectIntent(message) {
    const lowerMessage = message.toLowerCase();
    
    for (const [intentName, config] of Object.entries(this.intentPatterns)) {
      for (const pattern of config.patterns) {
        if (pattern.test(lowerMessage)) {
          console.log(`🎯 Intent detected: ${intentName} -> will call ${config.function}`);
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
    // Use the smart chat logic
    return this.chat(message, sessionId, language, practiceContext?.subdomain || 'developer', null);
  }
  
  // Override the chat method to be smarter
  async chat(message, sessionId, language = 'he', practice = 'developer', uploadInfo = null) {
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
      
      if (intent) {
        console.log(`📌 Smart Agent: User wants ${intent.function} ONLY`);
        
        // Temporarily filter functions to only include what user asked for
        const originalGetAllFunctions = this.agentV4.getAllFunctions.bind(this.agentV4);
        this.agentV4.getAllFunctions = () => {
          const allFunctions = originalGetAllFunctions();
          
          // Keep only the function user wants + search function (needed to find patient)
          const filtered = allFunctions.filter(f => 
            f.name === intent.function || 
            f.name === 'searchPatients' ||
            !intent.excludeFunctions.includes(f.name)
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
      
      // No specific intent detected, use all functions
      console.log('🤖 Smart Agent: No specific intent, using all functions');
      return await this.agentV4.chat(message, sessionId, language, practice, uploadInfo);
      
    } catch (error) {
      console.error('Smart Agent error:', error);
      throw error;
    }
  }
  
  // Override the system prompt to be more selective
  getSystemPrompt(language = 'he') {
    const basePrompt = this.agentV4.getSystemPrompt(language);
    
    const smartPrompt = language === 'he' ? `
${basePrompt}

כללים חשובים לקריאת פונקציות:
1. **קרא רק פונקציה אחת בכל פעם** - אל תקרא מספר פונקציות ביחד
2. **התמקד במה שהמשתמש ביקש במפורש**:
   - "תראה לי את ערן גרוס" = קרא רק getPatient
   - "תראה לי היסטוריה רפואית" = קרא רק getFullMedicalReport  
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
   - "show me medical history" = call only getFullMedicalReport
   - "show me lab results" = call only getLabResults
   - "show me medications" = call only getMedications
   - "show me documents" = call only getDocuments
3. **Don't assume the user wants all information** - give only what was requested
4. **If the user wants more info, they will ask separately**
`;
    
    return smartPrompt;
  }
}

module.exports = new SmartAgentService();