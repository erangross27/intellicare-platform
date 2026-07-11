/**
 * Workflow Tracker Service
 * Coordinates between chat analysis and workflow store
 */

import chatAnalysisService from './chatAnalysisService';
import useWorkflowStore from '../stores/workflowStore';

class WorkflowTrackerService {
  constructor() {
    this.isTracking = false;
    this.lastDetectedStep = null;
    this.workflowStarted = false;
    this.messageQueue = [];
    this.processingMessage = false;
  }
  
  /**
   * Start tracking workflow from chat messages
   */
  startTracking() {
    if (this.isTracking) return;
    
    this.isTracking = true;
    this.workflowStarted = false;
    console.log('🎯 Workflow tracking started');
    
    // Check if we should auto-start the onboarding workflow
    const store = useWorkflowStore.getState();
    if (!store.activeWorkflow) {
      // Auto-start onboarding for new users
      this.startOnboardingWorkflow();
    }
  }
  
  /**
   * Stop tracking workflow
   */
  stopTracking() {
    this.isTracking = false;
    this.lastDetectedStep = null;
    this.workflowStarted = false;
    console.log('🛑 Workflow tracking stopped');
  }
  
  /**
   * Process a chat message and update workflow accordingly
   */
  async processMessage(message, isAI = false) {
    if (!this.isTracking) return;
    
    // Queue message to handle rapid messages
    this.messageQueue.push({ message, isAI, timestamp: Date.now() });
    
    // Process queue if not already processing
    if (!this.processingMessage) {
      await this.processMessageQueue();
    }
  }
  
  /**
   * Process queued messages
   */
  async processMessageQueue() {
    if (this.processingMessage || this.messageQueue.length === 0) return;
    
    this.processingMessage = true;
    
    while (this.messageQueue.length > 0) {
      const { message, isAI } = this.messageQueue.shift();
      
      // Analyze message for workflow context
      const analysis = chatAnalysisService.analyzeMessage(message, isAI);
      
      if (analysis.step && analysis.confidence > 0.6) {
        await this.updateWorkflowStep(analysis.step, analysis.data);
      }
      
      // Small delay between processing to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.processingMessage = false;
  }
  
  /**
   * Update workflow step based on detected context
   */
  async updateWorkflowStep(detectedStep, data) {
    const store = useWorkflowStore.getState();
    
    // Start workflow if not started
    if (!store.activeWorkflow && !this.workflowStarted) {
      this.startOnboardingWorkflow();
      this.workflowStarted = true;
      await new Promise(resolve => setTimeout(resolve, 200)); // Wait for workflow to initialize
    }
    
    // Map detected step to workflow step index
    const stepMapping = {
      'welcome': 0,
      'practice-name': 1,
      'practice-location': 2,
      'practice-confirmation': 2,
      'admin-info': 3,
      'admin-phone': 4,
      'review-details': 5,
      'creating-practice': 6,
      'email-verification': 6,
      'email-otp-verification': 6,
      'login-email': 1,
      'otp-sent': 2,
      'otp-verification': 3,
      'signup-practice': 1,
      'signup-email': 2
    };
    
    const workflowStepIndex = stepMapping[detectedStep];
    
    if (workflowStepIndex !== undefined && workflowStepIndex !== this.lastDetectedStep) {
      console.log(`📍 Updating workflow to step: ${detectedStep} (index: ${workflowStepIndex})`);
      
      // Update the workflow store
      const currentStore = useWorkflowStore.getState();
      
      // Only update if we're moving forward or it's a significant change
      if (workflowStepIndex > currentStore.currentStep || 
          Math.abs(workflowStepIndex - currentStore.currentStep) > 1) {
        currentStore.jumpToStep(workflowStepIndex);
      }
      
      // Store any extracted data
      if (data && Object.keys(data).length > 0) {
        currentStore.updateStepData(detectedStep, data);
      }
      
      this.lastDetectedStep = workflowStepIndex;
      
      // Emit event for UI updates
      this.emitWorkflowUpdate(detectedStep, data);
    }
  }
  
  /**
   * Start the onboarding workflow
   */
  startOnboardingWorkflow() {
    const store = useWorkflowStore.getState();
    
    // Define the dynamic practice onboarding workflow
    const practiceOnboardingWorkflow = {
      id: 'practice-onboarding',
      name: {
        en: 'Getting Started',
        he: 'מתחילים'
      },
      steps: [
        {
          id: 'welcome',
          name: {
            en: 'Welcome',
            he: 'ברוכים הבאים'
          },
          description: {
            en: 'Choose how to get started',
            he: 'בחרו איך להתחיל'
          },
          help: {
            en: 'Click one of the three options below to begin',
            he: 'לחצו על אחת משלוש האפשרויות למטה כדי להתחיל'
          },
          commands: [{
            example: {
              en: 'New Practice, Login, or Sign Up',
              he: 'מרפאה חדשה, כניסה, או הרשמה'
            }
          }]
        },
        {
          id: 'practice-details',
          name: {
            en: 'Practice Information',
            he: 'פרטי המרפאה'
          },
          description: {
            en: 'Provide practice details',
            he: 'ספקו פרטי מרפאה'
          },
          help: {
            en: 'Tell us about your practice - name and location',
            he: 'ספרו לנו על המרפאה שלכם - שם ומיקום'
          },
          commands: [{
            example: {
              en: 'Enter practice name like "Boston Medical Center"',
              he: 'הכניסו שם מרפאה כמו "המרכז הרפואי בוסטון"'
            }
          }]
        },
        {
          id: 'administrator',
          name: {
            en: 'Administrator Setup',
            he: 'הגדרת מנהל'
          },
          description: {
            en: 'Set up administrator account',
            he: 'הגדרת חשבון מנהל'
          },
          help: {
            en: 'Provide the administrator name and email',
            he: 'ספקו את שם וכתובת האימייל של המנהל'
          },
          commands: [{
            example: {
              en: 'John Smith john@example.com',
              he: 'ישראל ישראלי israel@example.com'
            }
          }]
        },
        {
          id: 'contact',
          name: {
            en: 'Contact Information',
            he: 'פרטי יצירת קשר'
          },
          description: {
            en: 'Add contact phone number',
            he: 'הוספת מספר טלפון ליצירת קשר'
          },
          help: {
            en: 'Provide a phone number for the administrator',
            he: 'ספקו מספר טלפון למנהל'
          },
          commands: [{
            example: {
              en: 'Enter phone or say "use the practice"',
              he: 'הכניסו טלפון או אמרו "השתמש במרפאה"'
            }
          }]
        },
        {
          id: 'review',
          name: {
            en: 'Review Details',
            he: 'סקירת פרטים'
          },
          description: {
            en: 'Confirm all information',
            he: 'אישור כל המידע'
          },
          help: {
            en: 'Review all details before creating the practice',
            he: 'סקרו את כל הפרטים לפני יצירת המרפאה'
          },
          commands: [{
            example: {
              en: 'Confirm to proceed',
              he: 'אשרו כדי להמשיך'
            }
          }]
        },
        {
          id: 'creating',
          name: {
            en: 'Setting Up Your Practice',
            he: 'מגדירים את המרפאה שלכם'
          },
          description: {
            en: 'Your practice is being created',
            he: 'המרפאה שלכם נוצרת'
          },
          help: {
            en: 'We\'re setting up your practice portal and administrator account. This will take just a moment.',
            he: 'אנחנו מגדירים את פורטל המרפאה וחשבון המנהל שלכם. זה ייקח רק רגע.'
          },
          commands: []
        },
        {
          id: 'verification',
          name: {
            en: 'Email Verification',
            he: 'אימות אימייל'
          },
          description: {
            en: 'Enter verification code',
            he: 'הכניסו קוד אימות'
          },
          help: {
            en: 'A 6-digit verification code has been sent to the administrator\'s email. Please enter the code here in the chat to complete setup.',
            he: 'קוד אימות בן 6 ספרות נשלח לאימייל של המנהל. אנא הכניסו את הקוד כאן בצ\'אט כדי להשלים את ההגדרה.'
          },
          commands: []
        }
      ]
    };
    
    store.startWorkflow(practiceOnboardingWorkflow);
    console.log('🚀 Started practice onboarding workflow');
  }
  
  /**
   * Emit workflow update event
   */
  emitWorkflowUpdate(step, data) {
    // Create custom event for other components to listen to
    const event = new CustomEvent('workflowUpdate', {
      detail: { step, data, timestamp: Date.now() }
    });
    window.dispatchEvent(event);
  }
  
  /**
   * Get current workflow state
   */
  getState() {
    const analysisState = chatAnalysisService.getState();
    const workflowState = useWorkflowStore.getState();
    
    return {
      isTracking: this.isTracking,
      currentStep: analysisState.currentStep,
      workflowStep: workflowState.currentStep,
      progress: analysisState.progress,
      detectedData: analysisState.detectedData,
      suggestions: analysisState.suggestions,
      activeWorkflow: workflowState.activeWorkflow
    };
  }
  
  /**
   * Get contextual help for current step
   */
  getContextualHelp(language = 'en') {
    const state = chatAnalysisService.getState();
    const step = state.currentStep;
    
    // For welcome step, return a special key that the component will handle
    if (!step || step === 'welcome') {
      return 'welcomeHelp'; // Return a key that the component will translate
    }
    
    const helpTexts = {
      'practice-name': {
        en: 'Enter your practice\'s full name. The AI will search for it and find the complete details.',
        he: 'הכניסו את השם המלא של המרפאה. הAI יחפש אותה וימצא את הפרטים המלאים.'
      },
      'practice-location': {
        en: 'Confirm the practice details are correct. Say "yes" to proceed or "no" to search again.',
        he: 'אשרו שפרטי המרפאה נכונים. אמרו "כן" להמשיך או "לא" לחפש שוב.'
      },
      'admin-info': {
        en: 'Provide the administrator\'s full name and email address in one message.',
        he: 'ספקו את השם המלא וכתובת האימייל של המנהל בהודעה אחת.'
      },
      'admin-phone': {
        en: 'Enter a phone number or say "use the practice" to use the practice\'s main number.',
        he: 'הכניסו מספר טלפון או אמרו "השתמש במרפאה" לשימוש במספר הראשי של המרפאה.'
      },
      'creating-practice': {
        en: 'Great! We\'re now setting up your practice. This includes creating your secure portal, setting up the administrator account, and configuring your practice\'s settings.',
        he: 'מצוין! אנחנו מגדירים כעת את המרפאה שלכם. זה כולל יצירת הפורטל המאובטח, הגדרת חשבון המנהל, והגדרת ההגדרות של המרפאה.'
      },
      'review-details': {
        en: 'Please review all the information carefully. Once you confirm, we\'ll create your practice with these details.',
        he: 'אנא סקרו את כל המידע בקפידה. ברגע שתאשרו, ניצור את המרפאה עם הפרטים האלה.'
      },
      'email-verification': {
        en: 'A verification code has been sent to your email. Check your inbox and enter the 6-digit code here in the chat.',
        he: 'קוד אימות נשלח לאימייל שלך. בדקו את תיבת הדואר והכניסו את הקוד בן 6 הספרות כאן בצ\'אט.'
      },
      'email-otp-verification': {
        en: 'Please enter the 6-digit verification code from your email. Just type the numbers in the chat.',
        he: 'אנא הכניסו את קוד האימות בן 6 הספרות מהאימייל. פשוט הקלידו את המספרים בצ\'אט.'
      },
      'otp-verification': {
        en: 'Enter the 6-digit verification code from your email.',
        he: 'הכניסו את קוד האימות בן 6 הספרות מהאימייל שלכם.'
      }
    };
    
    return helpTexts[step]?.[language] || null;
  }
  
  /**
   * Reset tracker state
   */
  reset() {
    this.isTracking = false;
    this.lastDetectedStep = null;
    this.workflowStarted = false;
    this.messageQueue = [];
    this.processingMessage = false;
    chatAnalysisService.reset();
    
    const store = useWorkflowStore.getState();
    store.cancelWorkflow();
  }
}

// Create singleton instance
const workflowTrackerService = new WorkflowTrackerService();

// Auto-start tracking when imported
if (typeof window !== 'undefined') {
  // Start tracking after a small delay to ensure everything is initialized
  setTimeout(() => {
    workflowTrackerService.startTracking();
  }, 500);
}

export default workflowTrackerService;