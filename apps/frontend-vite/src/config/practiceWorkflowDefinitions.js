/**
 * Detailed Practice Workflow Definitions
 * Smart workflow steps that adapt to the conversation
 */

export const practiceWorkflowDefinitions = {
  // Main practice creation workflow
  'practice-creation': {
    id: 'practice-creation',
    name: {
      en: 'New Practice Setup',
      he: 'הגדרת מרפאה חדשה'
    },
    description: {
      en: 'Complete process to register a new practice',
      he: 'תהליך מלא לרישום מרפאה חדשה'
    },
    steps: [
      {
        id: 'practice-name-input',
        triggers: ['practice-name'],
        title: {
          en: 'Enter Practice Name',
          he: 'הכניסו שם מרפאה'
        },
        help: {
          en: 'Type your practice name exactly as registered (e.g., "Boston Medical Center")',
          he: 'הקלידו את שם המרפאה בדיוק כפי שרשום (לדוגמה: "המרכז הרפואי בוסטון")'
        },
        tips: {
          en: [
            'Include the full official name',
            'The AI will search and find complete details',
            'Examples: Stanford Medical, Boston Medical Center'
          ],
          he: [
            'כללו את השם הרשמי המלא',
            'הAI יחפש וימצא את הפרטים המלאים',
            'דוגמאות: המרכז הרפואי סטנפורד, בית החולים בוסטון'
          ]
        },
        validation: {
          minLength: 3,
          pattern: /\w+/,
          required: true
        }
      },
      {
        id: 'location-confirmation',
        triggers: ['practice-location', 'practice-confirmation'],
        title: {
          en: 'Confirm Location',
          he: 'אשרו מיקום'
        },
        help: {
          en: 'Verify the practice address and details are correct',
          he: 'ודאו שכתובת ופרטי המרפאה נכונים'
        },
        tips: {
          en: [
            'Review the address carefully',
            'Say "yes" if correct',
            'Say "no" to search again'
          ],
          he: [
            'בדקו את הכתובת בקפידה',
            'אמרו "כן" אם נכון',
            'אמרו "לא" כדי לחפש שוב'
          ]
        },
        quickActions: [
          { text: 'Yes', value: 'yes' },
          { text: 'No', value: 'no' },
          { text: 'Change', value: 'search again' }
        ]
      },
      {
        id: 'admin-details',
        triggers: ['admin-info'],
        title: {
          en: 'Administrator Information',
          he: 'פרטי מנהל'
        },
        help: {
          en: 'Provide the practice administrator\'s name and email',
          he: 'ספקו את שם וכתובת האימייל של מנהל המרפאה'
        },
        tips: {
          en: [
            'Format: FirstName LastName email@example.com',
            'Use the primary administrator\'s details',
            'This person will have full system access'
          ],
          he: [
            'פורמט: שם פרטי שם משפחה email@example.com',
            'השתמשו בפרטי המנהל הראשי',
            'לאדם זה תהיה גישה מלאה למערכת'
          ]
        },
        example: 'John Smith john.smith@practice.com'
      },
      {
        id: 'phone-number',
        triggers: ['admin-phone'],
        title: {
          en: 'Contact Phone',
          he: 'טלפון ליצירת קשר'
        },
        help: {
          en: 'Provide administrator phone or use practice\'s main number',
          he: 'ספקו טלפון מנהל או השתמשו במספר הראשי של המרפאה'
        },
        tips: {
          en: [
            'Enter: (XXX) XXX-XXXX',
            'Or say: "use the practice"',
            'This is for account verification'
          ],
          he: [
            'הכניסו: XXX-XXXXXXX',
            'או אמרו: "השתמש במרפאה"',
            'זה לצורך אימות חשבון'
          ]
        },
        quickActions: [
          { text: 'Use practice number', value: 'use the practice' }
        ]
      },
      {
        id: 'review-confirm',
        triggers: ['review-details'],
        title: {
          en: 'Review & Confirm',
          he: 'סקירה ואישור'
        },
        help: {
          en: 'Review all details before creating the practice',
          he: 'סקרו את כל הפרטים לפני יצירת המרפאה'
        },
        summary: true,
        showProgress: true
      },
      {
        id: 'email-verify',
        triggers: ['email-verification', 'email-otp-verification'],
        title: {
          en: 'Email Verification',
          he: 'אימות אימייל'
        },
        help: {
          en: 'Enter the 6-digit code sent to your email',
          he: 'הכניסו את הקוד בן 6 הספרות שנשלח לאימייל שלכם'
        },
        tips: {
          en: [
            'Check your email for the verification code',
            'Enter the 6-digit code in the chat',
            'Code expires in 10 minutes'
          ],
          he: [
            'בדקו את האימייל לקוד האימות',
            'הכניסו את הקוד בן 6 הספרות בצ\'אט',
            'הקוד תקף ל-10 דקות'
          ]
        },
        validation: {
          pattern: /^\d{6}$/,
          required: true
        },
        status: 'waiting'
      }
    ]
  },
  
  // Login workflow
  'user-login': {
    id: 'user-login',
    name: {
      en: 'Login',
      he: 'כניסה'
    },
    description: {
      en: 'Login to your existing account',
      he: 'כניסה לחשבון קיים'
    },
    steps: [
      {
        id: 'email-input',
        triggers: ['login-email'],
        title: {
          en: 'Enter Email',
          he: 'הכניסו אימייל'
        },
        help: {
          en: 'Enter your registered email address',
          he: 'הכניסו את כתובת האימייל הרשומה שלכם'
        },
        validation: {
          type: 'email',
          required: true
        }
      },
      {
        id: 'otp-code',
        triggers: ['otp-sent', 'otp-verification'],
        title: {
          en: 'Verification Code',
          he: 'קוד אימות'
        },
        help: {
          en: 'Enter the 6-digit code from your email',
          he: 'הכניסו את הקוד בן 6 הספרות מהאימייל'
        },
        tips: {
          en: [
            'Check your email inbox',
            'Code expires in 10 minutes',
            'Enter exactly 6 digits'
          ],
          he: [
            'בדקו את תיבת הדואר',
            'הקוד תקף ל-10 דקות',
            'הכניסו בדיוק 6 ספרות'
          ]
        },
        validation: {
          pattern: /^\d{6}$/,
          required: true
        }
      }
    ]
  },
  
  // Signup workflow
  'user-signup': {
    id: 'user-signup',
    name: {
      en: 'Sign Up',
      he: 'הרשמה'
    },
    description: {
      en: 'Join an existing practice',
      he: 'הצטרפות למרפאה קיימת'
    },
    steps: [
      {
        id: 'practice-code',
        triggers: ['signup-practice'],
        title: {
          en: 'Practice Code',
          he: 'קוד מרפאה'
        },
        help: {
          en: 'Enter practice subdomain or invitation code',
          he: 'הכניסו תת-דומיין מרפאה או קוד הזמנה'
        },
        tips: {
          en: [
            'Get code from practice administrator',
            'Format: practice-name or ABC123',
            'Case-sensitive'
          ],
          he: [
            'קבלו קוד ממנהל המרפאה',
            'פורמט: שם-מרפאה או ABC123',
            'רגיש לאותיות גדולות/קטנות'
          ]
        }
      },
      {
        id: 'signup-email',
        triggers: ['signup-email'],
        title: {
          en: 'Your Email',
          he: 'האימייל שלכם'
        },
        help: {
          en: 'Enter your email to create account',
          he: 'הכניסו אימייל ליצירת חשבון'
        },
        validation: {
          type: 'email',
          required: true
        }
      }
    ]
  }
};

// Workflow step matcher - maps AI conversation patterns to workflow steps
export const workflowStepMatcher = {
  // Patterns that indicate specific workflow steps
  patterns: {
    'choosing-path': [
      /choose.*(?:new practice|login|sign)/i,
      /what would you like/i,
      /get started/i,
      /three.*options/i
    ],
    'entering-practice-name': [
      /what.*practice.*name/i,
      /name.*your practice/i,
      /tell.*about.*practice/i
    ],
    'confirming-location': [
      /is this.*practice/i,
      /correct.*address/i,
      /found.*practice/i,
      /confirm.*details/i
    ],
    'providing-admin': [
      /who.*administrator/i,
      /admin.*details/i,
      /name.*email/i
    ],
    'providing-phone': [
      /phone.*number/i,
      /contact.*number/i,
      /different.*number/i
    ],
    'reviewing': [
      /ready.*create/i,
      /everything.*needed/i,
      /review.*details/i
    ],
    'verifying-email': [
      /check.*email/i,
      /verification.*sent/i,
      /verification.*code/i,
      /enter.*code.*email/i,
      /6.*digit.*code/i
    ],
    'entering-otp': [
      /enter.*code/i,
      /6.*digit/i,
      /verification.*code/i
    ]
  },
  
  // Map detected patterns to workflow IDs
  getWorkflowStep(message, isAI = false) {
    for (const [stepId, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        if (pattern.test(message)) {
          return stepId;
        }
      }
    }
    return null;
  }
};

// Helper to get current workflow based on conversation
export function getCurrentWorkflow(conversationState) {
  if (conversationState.includes('practice-name') || 
      conversationState.includes('admin-info')) {
    return practiceWorkflowDefinitions['practice-creation'];
  }
  
  if (conversationState.includes('login-email') || 
      conversationState.includes('otp-')) {
    return practiceWorkflowDefinitions['user-login'];
  }
  
  if (conversationState.includes('signup-')) {
    return practiceWorkflowDefinitions['user-signup'];
  }
  
  return null;
}

// Get contextual help based on current step
export function getStepHelp(workflowId, stepId, language = 'en') {
  const workflow = practiceWorkflowDefinitions[workflowId];
  if (!workflow) return null;
  
  const step = workflow.steps.find(s => s.id === stepId || s.triggers?.includes(stepId));
  if (!step) return null;
  
  return {
    title: step.title[language],
    help: step.help[language],
    tips: step.tips?.[language] || [],
    quickActions: step.quickActions || [],
    example: step.example
  };
}

// Export for use in components
export default {
  workflows: practiceWorkflowDefinitions,
  matcher: workflowStepMatcher,
  getCurrentWorkflow,
  getStepHelp
};