/**
 * Chat Analysis Service
 * Intelligently analyzes chat messages to detect workflow steps and context
 */

class ChatAnalysisService {
  constructor() {
    // Workflow step patterns for practice creation
    this.workflowPatterns = {
      'welcome': {
        aiPatterns: [
          /welcome to intellicare/i,
          /get started/i,
          /choose.*(?:new practice|login|sign\s?up)/i,
          /what would you like to do/i,
          /three options/i,
          /click one of the.*boxes/i
        ],
        userPatterns: [],
        nextSteps: ['practice-name', 'login-email', 'signup-practice']
      },
      
      'practice-name': {
        aiPatterns: [
          /what.*name.*practice/i,
          /practice.*name/i,
          /what.*your practice.*called/i,
          /tell me.*practice name/i,
          /enter.*practice name/i
        ],
        userPatterns: [
          /(?:new practice|create.*practice)/i,
          /i want to (?:create|register|setup)/i
        ],
        nextSteps: ['practice-location']
      },
      
      'practice-location': {
        aiPatterns: [
          /found your practice/i,
          /is this.*practice/i,
          /correct.*address/i,
          /confirm.*location/i,
          /are all.*details correct/i,
          /boston medical center/i,
          /stanford medical/i
        ],
        userPatterns: [
          /^[a-z\s]+(?:medical|practice|hospital|center)/i
        ],
        nextSteps: ['practice-confirmation', 'admin-info']
      },
      
      'practice-confirmation': {
        aiPatterns: [
          /is this correct/i,
          /confirm.*details/i,
          /are these.*right/i
        ],
        userPatterns: [
          /^yes$/i,
          /^correct$/i,
          /that.*right/i,
          /^confirm$/i
        ],
        nextSteps: ['admin-info']
      },
      
      'admin-info': {
        aiPatterns: [
          /who.*administrator/i,
          /admin.*name.*email/i,
          /provide.*name.*email/i,
          /administrator.*details/i,
          /contact.*information/i
        ],
        userPatterns: [
          /^yes$/i,
          /correct/i
        ],
        nextSteps: ['admin-phone']
      },
      
      'admin-phone': {
        aiPatterns: [
          /phone.*number/i,
          /contact.*number/i,
          /telephone/i,
          /different.*number/i,
          /practice.*main.*number/i
        ],
        userPatterns: [
          /\w+.*@.*\.\w+/  // Email pattern
        ],
        nextSteps: ['review-details']
      },
      
      'review-details': {
        aiPatterns: [
          /everything.*needed/i,
          /ready.*create/i,
          /have.*everything/i,
          /confirm.*create/i,
          /review.*details/i
        ],
        userPatterns: [
          /use.*practice/i,
          /\d{3}.*\d{3}.*\d{4}/  // Phone pattern
        ],
        nextSteps: ['creating-practice']
      },
      
      'creating-practice': {
        aiPatterns: [
          /creating.*practice/i,
          /setting.*up/i,
          /processing/i,
          /initializing/i
        ],
        userPatterns: [],
        nextSteps: ['email-verification']
      },
      
      'email-verification': {
        aiPatterns: [
          /verification.*code/i,
          /check.*email.*code/i,
          /sent.*verification.*code/i,
          /verify.*email.*address/i,
          /enter.*verification.*code/i,
          /6.*digit.*code.*verification/i,
          /email.*verification.*code/i
        ],
        userPatterns: [],
        nextSteps: ['email-otp-verification']
      },
      
      'email-otp-verification': {
        aiPatterns: [
          /enter.*verification.*code/i,
          /provide.*verification.*code/i,
          /6.*digit.*verification/i
        ],
        userPatterns: [
          /\d{6}/  // 6-digit code
        ],
        nextSteps: ['complete']
      },
      
      'login-email': {
        aiPatterns: [
          /enter.*email/i,
          /what.*email.*address/i,
          /provide.*email/i,
          /email.*login/i
        ],
        userPatterns: [
          /^login$/i,
          /sign\s?in/i,
          /log\s?in/i
        ],
        nextSteps: ['otp-sent']
      },
      
      'otp-sent': {
        aiPatterns: [
          /sent.*code/i,
          /check.*email.*code/i,
          /enter.*code/i,
          /6.*digit.*code/i,
          /otp.*sent/i
        ],
        userPatterns: [
          /\w+@\w+\.\w+/  // Email pattern
        ],
        nextSteps: ['otp-verification']
      },
      
      'otp-verification': {
        aiPatterns: [
          /enter.*code/i,
          /provide.*code/i,
          /verification.*code/i
        ],
        userPatterns: [
          /\d{6}/  // 6-digit code
        ],
        nextSteps: ['logged-in']
      },
      
      'signup-practice': {
        aiPatterns: [
          /practice.*code/i,
          /subdomain/i,
          /enter.*identifier/i,
          /which.*practice.*join/i
        ],
        userPatterns: [
          /sign\s?up/i,
          /join.*practice/i,
          /register/i
        ],
        nextSteps: ['signup-email']
      }
    };
    
    this.currentStep = null;
    this.conversationHistory = [];
    this.detectedData = {};
  }
  
  /**
   * Analyze a message to detect workflow step
   */
  analyzeMessage(message, isAI = false) {
    // Guard: workflow analysis only handles plain text. AI responses can be
    // objects, structured-only payloads, or undefined (e.g. join-practice
    // responses with no top-level message) — skip those instead of crashing.
    if (typeof message !== 'string' || !message.trim()) {
      return { step: this.currentStep, data: this.detectedData, confidence: 0 };
    }

    // Add to conversation history
    this.conversationHistory.push({
      content: message,
      isAI,
      timestamp: Date.now()
    });
    
    // Keep only last 20 messages for context
    if (this.conversationHistory.length > 20) {
      this.conversationHistory.shift();
    }
    
    // Extract data from message
    this.extractData(message, isAI);
    
    // Detect workflow step
    const detectedStep = this.detectWorkflowStep(message, isAI);
    
    if (detectedStep && detectedStep !== this.currentStep) {
      console.log(`📊 Workflow step detected: ${this.currentStep} → ${detectedStep}`);
      this.currentStep = detectedStep;
      return {
        step: detectedStep,
        data: this.detectedData,
        confidence: this.calculateConfidence(message, detectedStep, isAI)
      };
    }
    
    return {
      step: this.currentStep,
      data: this.detectedData,
      confidence: 0.5
    };
  }
  
  /**
   * Detect which workflow step we're in based on message patterns
   */
  detectWorkflowStep(message, isAI) {
    const patterns = isAI ? 'aiPatterns' : 'userPatterns';
    
    // Check each workflow step
    for (const [stepId, stepConfig] of Object.entries(this.workflowPatterns)) {
      const stepPatterns = stepConfig[patterns];
      
      // Check if message matches any pattern for this step
      for (const pattern of stepPatterns) {
        if (pattern.test(message)) {
          // If we have a current step, check if this is a valid next step
          if (this.currentStep) {
            const currentConfig = this.workflowPatterns[this.currentStep];
            if (currentConfig && currentConfig.nextSteps.includes(stepId)) {
              return stepId;
            }
          } else {
            // No current step, this is the first detection
            return stepId;
          }
        }
      }
    }
    
    // If AI is asking a question that matches a next step pattern
    if (isAI && this.currentStep) {
      const currentConfig = this.workflowPatterns[this.currentStep];
      if (currentConfig) {
        for (const nextStep of currentConfig.nextSteps) {
          const nextConfig = this.workflowPatterns[nextStep];
          if (nextConfig) {
            for (const pattern of nextConfig.aiPatterns) {
              if (pattern.test(message)) {
                return nextStep;
              }
            }
          }
        }
      }
    }
    
    return null;
  }
  
  /**
   * Extract relevant data from messages
   */
  extractData(message, isAI) {
    if (!isAI) {
      // Extract email
      const emailMatch = message.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) {
        this.detectedData.email = emailMatch[1];
      }
      
      // Extract phone number
      const phoneMatch = message.match(/(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
      if (phoneMatch) {
        this.detectedData.phone = phoneMatch[1];
      }
      
      // Extract 6-digit OTP code
      const otpMatch = message.match(/\b(\d{6})\b/);
      if (otpMatch) {
        this.detectedData.otpCode = otpMatch[1];
      }
      
      // Extract names (simple heuristic)
      if (this.currentStep === 'admin-info' && message.includes(' ')) {
        const parts = message.trim().split(/\s+/);
        if (parts.length >= 2 && !message.includes('@')) {
          // Likely a name if it's 2-3 words and no email
          if (parts.length <= 4) {
            this.detectedData.adminName = message.trim();
          }
        }
      }
      
      // Extract practice name
      if (this.currentStep === 'practice-name' || 
          (!this.currentStep && /(?:medical|practice|hospital|center)/i.test(message))) {
        this.detectedData.practiceName = message.trim();
      }
      
      // Extract yes/no confirmations
      if (/^(yes|no|correct|wrong|confirm)$/i.test(message.trim())) {
        this.detectedData.lastConfirmation = message.trim().toLowerCase();
      }
    } else {
      // Extract data from AI messages
      // Look for practice details in formatted AI response
      const practiceMatch = message.match(/📍\s*([^🏢\n]+)/);
      if (practiceMatch) {
        this.detectedData.detectedPracticeName = practiceMatch[1].trim();
      }
      
      const addressMatch = message.match(/🏢\s*([^📌\n]+)/);
      if (addressMatch) {
        this.detectedData.detectedAddress = addressMatch[1].trim();
      }
      
      const phoneMatch = message.match(/📞\s*([^🌐\n]+)/);
      if (phoneMatch) {
        this.detectedData.detectedPhone = phoneMatch[1].trim();
      }
    }
  }
  
  /**
   * Calculate confidence score for step detection
   */
  calculateConfidence(message, step, isAI) {
    let confidence = 0.5;
    
    // Higher confidence for AI messages (they're more structured)
    if (isAI) {
      confidence += 0.2;
    }
    
    // Check multiple patterns
    const patterns = this.workflowPatterns[step][isAI ? 'aiPatterns' : 'userPatterns'];
    let matchCount = 0;
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        matchCount++;
      }
    }
    
    // More matches = higher confidence
    confidence += Math.min(matchCount * 0.15, 0.3);
    
    // Check if this follows expected flow
    if (this.currentStep) {
      const currentConfig = this.workflowPatterns[this.currentStep];
      if (currentConfig && currentConfig.nextSteps.includes(step)) {
        confidence += 0.1;
      }
    }
    
    return Math.min(confidence, 1.0);
  }
  
  /**
   * Get helpful explanations and tips for current step
   */
  getSuggestedActions() {
    if (!this.currentStep) {
      // Return translation keys that the component will translate
      return {
        keys: ['newPracticeTip', 'signupTip', 'loginTip'],
        en: [
          'New Practice: Choose this if you\'re the first from your practice - you\'ll become the administrator',
          'Sign Up: Choose this if your practice is already on IntelliCare and you need to join (you\'ll need the practice domain from your admin)',
          'Login: Choose this if you\'ve used IntelliCare before and need to access your existing account'
        ],
        he: [
          'מרפאה חדשה: בחרו זאת אם אתם הראשונים מהמרפאה שלכם - תהפכו למנהלים',
          'הרשמה: בחרו זאת אם המרפאה שלכם כבר ב-IntelliCare ואתם צריכים להצטרף (תצטרכו את דומיין המרפאה מהמנהל שלכם)',
          'כניסה: בחרו זאת אם השתמשתם ב-IntelliCare בעבר וצריכים לגשת לחשבון הקיים שלכם'
        ]
      };
    }
    
    const suggestions = {
      'practice-name': {
        en: [
          'The AI will search for your practice\'s complete details',
          'Include the full official name for best results',
          'The system will verify the location automatically'
        ],
        he: [
          'הAI יחפש את הפרטים המלאים של המרפאה שלך',
          'כלול את השם הרשמי המלא לתוצאות הטובות ביותר',
          'המערכת תאמת את המיקום באופן אוטומטי'
        ]
      },
      'practice-location': {
        en: [
          'Verify all details are correct before confirming',
          'You can search again if information is wrong',
          'The address will be used for your practice portal'
        ],
        he: [
          'ודא שכל הפרטים נכונים לפני האישור',
          'תוכל לחפש שוב אם המידע שגוי',
          'הכתובת תשמש עבור פורטל המרפאה שלך'
        ]
      },
      'admin-info': {
        en: [
          'The administrator will have full system access',
          'Use the primary contact person for the practice',
          'They will receive the verification email'
        ],
        he: [
          'למנהל תהיה גישה מלאה למערכת',
          'השתמש באיש הקשר הראשי של המרפאה',
          'הם יקבלו את אימייל האימות'
        ]
      },
      'admin-phone': {
        en: [
          'This number is for account recovery',
          'You can use the practice\'s main number',
          'Required for two-factor authentication'
        ],
        he: [
          'מספר זה לשחזור חשבון',
          'ניתן להשתמש במספר הראשי של המרפאה',
          'נדרש לאימות דו-שלבי'
        ]
      },
      'review-details': {
        en: [
          'Double-check all information is accurate',
          'These details will be used for your practice setup',
          'You can still make changes if needed'
        ],
        he: [
          'בדוק שוב שכל המידע מדויק',
          'פרטים אלה ישמשו להגדרת המרפאה שלך',
          'עדיין ניתן לבצע שינויים במידת הצורך'
        ]
      },
      'creating-practice': {
        en: [
          'Your practice is being set up in the system',
          'Administrator account is being created',
          'You will receive an email once complete'
        ],
        he: [
          'המרפאה שלך מוגדרת במערכת',
          'חשבון המנהל נוצר',
          'תקבל אימייל ברגע שהתהליך יושלם'
        ]
      },
      'email-verification': {
        en: [
          'A 6-digit verification code was sent to your email',
          'Enter the code here in the chat',
          'Code expires in 10 minutes'
        ],
        he: [
          'קוד אימות בן 6 ספרות נשלח לאימייל שלך',
          'הכנס את הקוד כאן בצ\'אט',
          'הקוד פג תוקף תוך 10 דקות'
        ]
      },
      'email-otp-verification': {
        en: [
          'Type the 6-digit code from your email',
          'Make sure to enter all 6 digits',
          'Request new code if expired'
        ],
        he: [
          'הקלד את הקוד בן 6 הספרות מהאימייל',
          'וודא שהזנת את כל 6 הספרות',
          'בקש קוד חדש אם פג תוקף'
        ]
      },
      'otp-verification': {
        en: [
          'Code was sent to your email',
          'Valid for 10 minutes only',
          'Request new code if expired'
        ],
        he: [
          'הקוד נשלח לאימייל שלך',
          'תקף ל-10 דקות בלבד',
          'בקש קוד חדש אם פג תוקף'
        ]
      }
    };
    
    return suggestions[this.currentStep] || { en: [], he: [] };
  }
  
  /**
   * Get progress percentage for current workflow
   */
  getProgress() {
    const practiceCreationSteps = [
      'welcome', 'practice-name', 'practice-location', 'practice-confirmation',
      'admin-info', 'admin-phone', 'review-details', 'creating-practice',
      'email-verification'
    ];
    
    const loginSteps = ['welcome', 'login-email', 'otp-sent', 'otp-verification', 'logged-in'];
    
    const signupSteps = ['welcome', 'signup-practice', 'signup-email', 'email-verification'];
    
    // Determine which flow we're in
    let steps = practiceCreationSteps;
    if (this.currentStep && loginSteps.includes(this.currentStep)) {
      steps = loginSteps;
    } else if (this.currentStep && signupSteps.includes(this.currentStep)) {
      steps = signupSteps;
    }
    
    const currentIndex = steps.indexOf(this.currentStep);
    if (currentIndex === -1) return 0;
    
    return Math.round(((currentIndex + 1) / steps.length) * 100);
  }
  
  /**
   * Reset the analysis state
   */
  reset() {
    this.currentStep = null;
    this.conversationHistory = [];
    this.detectedData = {};
  }
  
  /**
   * Get current state summary
   */
  getState() {
    return {
      currentStep: this.currentStep,
      detectedData: this.detectedData,
      progress: this.getProgress(),
      suggestions: this.getSuggestedActions(),
      conversationLength: this.conversationHistory.length
    };
  }
}

// Create singleton instance
const chatAnalysisService = new ChatAnalysisService();

export default chatAnalysisService;