import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../config/languagesStatic';
import MinimalLanguageSwitcher from './MinimalLanguageSwitcher';
import enhancedSessionManager from '../utils/enhancedSessionManager';
import ReactMarkdown from 'react-markdown';
// Removed crossTabAuth import - not needed for single-tab OTP flow
import secureApi from '../services/secureApiClient';
import { authAPI } from '../services/apiMigration';
import OTPInput from './OTPInput';
import { detectPracticeLanguage } from '../services/practiceLanguageDetector';

import secureStorage from '../utils/secureStorage';
import OnboardingTooltips from './onboarding/OnboardingTooltips';
import useWorkflowStore from '../stores/workflowStore';
import workflowSocketService from '../services/workflowSocketService';
import workflowTrackerService from '../services/workflowTrackerService';
import PatientListViewer from './viewers/PatientListViewer';
import CategoriesListExport from './CategoriesListExport';
import './ChatAuthAI.css';
// Lazy load the heavy ChatContainer component
const ChatContainer = lazy(() => import('./chat/ChatContainer'));

/**
 * ChatAuthAI - AI-powered authentication using Claude (Anthropic)
 * All the beautiful UI from ChatAuthConversational with Claude AI backend
 */
const ChatAuthAI = ({ domainContext, detectUserPractice, handleAuthSuccess }) => {
  // Apply language from URL or detect from subdomain immediately before any rendering
  React.useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const langParam = urlParams.get('lang');
    const verifiedParam = urlParams.get('verified');
    const seamlessParam = urlParams.get('seamless');
    
    // Detect language from subdomain first
    const hostname = window.location.hostname;
    const detectedConfig = detectPracticeLanguage(hostname);
    
    // If on practice subdomain, force detected language
    if (!detectedConfig.allowSwitcher) {
      secureStorage.setItem('selectedLanguage', detectedConfig.language);
      console.log(`🏥 Forced practice language: ${detectedConfig.language} (from ${detectedConfig.detectedFrom})`);
    } else if (langParam) {
      // Only allow URL param on parent domain
      secureStorage.setItem('selectedLanguage', langParam);
      console.log(`🌐 Applied language from URL: ${langParam}`);
    }
    
    // Store verification flags for later use
    if (verifiedParam === 'true') {
      sessionStorage.setItem('justVerified', 'true');
    }
    if (seamlessParam === 'true') {
      sessionStorage.setItem('seamlessLogin', 'true');
    }
  }, []); // Run only once on mount

  const { login, signup, isAuthenticated, user, practice, setUser, setPractice, trackActivity } = useAuth();
  const { currentLanguage, isRTL, changeLanguage, allowSwitcher, t } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Memoized callback to prevent ChatContainer reloading messages on every render
  const handleSessionChange = useCallback((newSessionId) => {
    // Update sessionId when ChatContainer creates a new session
    setSessionId(newSessionId);
    console.log('📋 ChatAuthAI: Session changed to:', newSessionId);
  }, []);
  const [authState, setAuthState] = useState('welcome');
  const [authCheckComplete, setAuthCheckComplete] = useState(false);
  const [conversationComplete, setConversationComplete] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpError, setOtpError] = useState(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [practiceSubdomain, setPracticeSubdomain] = useState('');
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const rateLimitTimerRef = useRef(null);
  
  // Workflow state from Zustand store
  const { 
    isHelperVisible, 
    activeWorkflow,
    currentStep,
    startWorkflow,
    advanceStep,
    updateStepData,
    updateWorkflowStep
  } = useWorkflowStore();

  // Start workflow tracking when component mounts
  useEffect(() => {
    // Start tracking workflows
    workflowTrackerService.startTracking();
    
    return () => {
      // Clean up on unmount
      workflowTrackerService.stopTracking();
    };
  }, []);
  
  // Handle session cleanup for fresh starts
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isEmailVerified = urlParams.get('emailVerified');
    
    // Only preserve session if coming from email verification
    if (!isEmailVerified && !isAuthenticated) {
      // Clear any stale auth data for fresh login
      secureStorage.removeItem('authAISessionId');
      secureStorage.removeItem('pendingLogin');
      secureStorage.removeItem('pendingVerification');
      secureStorage.removeItem('magicLinkLogin');
      secureStorage.removeItem('authData');
      secureStorage.removeItem('pendingLogin');
      secureStorage.removeItem('pendingVerification');
      secureStorage.removeItem('magicLinkLogin');
      secureStorage.removeItem('magicLinkCompleted');
      // Generate new sessionId to trigger tooltip clear
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newSessionId);
      process.env.NODE_ENV !== 'production' && console.log('🔒 [DEBUG] Starting fresh session with ID:', newSessionId);
    }
    
    // Mark auth check as complete after a brief delay to prevent flash
    // For verified users, extend delay to ensure auth completes
    const isVerified = urlParams.get('verified') === 'true';
    const authDelay = isVerified ? 500 : 150;
    
    setTimeout(() => {
      setAuthCheckComplete(true);
    }, authDelay);
    
    // REMOVED: BroadcastChannel for email verification - not needed for single-tab OTP flow
    
    // No cleanup needed since no channel is created
    return () => {
      // Removed channel cleanup
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (rateLimitTimerRef.current) {
        clearInterval(rateLimitTimerRef.current);
      }
    };
  }, []);

  // Focus input on mount and after messages
  useEffect(() => {
    if (!isProcessing && inputRef.current) {
      inputRef.current.removeAttribute('readonly');
      inputRef.current.focus();
    }
  }, [isProcessing]);

  // Initialize workflow socket service
  useEffect(() => {
    // The service auto-connects when imported, so we don't need to call connect again
    // Just ensure it's connected
    if (!workflowSocketService.connected) {
      workflowSocketService.connect();
    }
    return () => {
      // Don't disconnect on cleanup as it's a singleton
    };
  }, []);
  
  // Auto-start onboarding workflow for new visitors
  useEffect(() => {
    // Only start workflow if:
    // 1. Not authenticated
    // 2. No active workflow
    // 3. Not in the middle of an auth flow
    if (!isAuthenticated && !activeWorkflow && authState === 'welcome') {
      // Always start the workflow for unauthenticated users
        
        // Start the onboarding workflow
        const onboardingWorkflow = {
          id: 'practice-onboarding',
          nameKey: 'welcomeToIntelliCare',
          name: {
            he: 'ברוכים הבאים ל-IntelliCare',
            en: 'Welcome to IntelliCare'
          },
          steps: [
            {
              id: 'welcome',
              nameKey: 'welcome',
              name: {
                he: 'ברוך הבא',
                en: 'Welcome'
              },
              commands: [
                {
                  templateKey: 'chooseOption',
                  template: {
                    he: 'אני יכול לעזור לך ליצור מרפאה חדשה, להתחבר, או להצטרף כמשתמש חדש',
                    en: 'I can help you create a new practice, login, or join as a new user'
                  },
                  exampleKey: 'startConversation',
                  example: {
                    he: 'התחילו לדבר איתי ואני אדריך אתכם',
                    en: 'Start talking to me and I\'ll guide you'
                  },
                  required: true,
                  field: 'pathChoice'
                }
              ]
            }
          ]
        };
        
        startWorkflow(onboardingWorkflow);
    }
  }, [isAuthenticated, activeWorkflow, authState, currentLanguage, startWorkflow]);
  
  // No initial greeting needed - we have the prompt boxes
  
  // Initial welcome message or handle authentication completion
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const completeLogin = urlParams.get('completeLogin');
    const emailVerified = urlParams.get('emailVerified');
    const verified = urlParams.get('verified');
    const error = urlParams.get('error');
    const welcomeName = urlParams.get('welcome');
    const reason = urlParams.get('reason');
    const message = urlParams.get('message');
    const verifiedEmail = secureStorage.getItem('verifiedEmail'); // Check if we just verified an email
    
    // Check both sessionStorage and localStorage
    const pendingLogin = secureStorage.getItem('pendingLogin') || secureStorage.getItem('pendingLogin');
    const pendingVerification = secureStorage.getItem('pendingVerification') || secureStorage.getItem('pendingVerification');
    const isMagicLink = secureStorage.getItem('magicLinkLogin') || secureStorage.getItem('magicLinkLogin');
    
    process.env.NODE_ENV !== 'production' && console.log('🔍 [DEBUG] ChatAuthAI: Auth completion check on mount:', {
      completeLogin,
      emailVerified,
      verified,
      error,
      welcomeName,
      reason,
      message,
      verifiedEmail,
      hasPendingLogin: !!pendingLogin,
      hasPendingVerification: !!pendingVerification,
      isMagicLink,
      pendingLoginData: pendingLogin ? JSON.parse(pendingLogin) : null,
      currentIsAuthenticated: isAuthenticated,
      currentUser: user
    });
    
    // Handle backend restart message
    if (reason === 'backend_restart' && !messages.find(m => m.id === 'backend-restart')) {
      const restartMsg = {
        id: 'backend-restart',
        type: 'agent',
        content: currentLanguage === 'he'
          ? `⚠️ השרת הופעל מחדש והחיבור שלך אבד.\n\n📧 אנא הזן את האימייל שלך כדי להתחבר מחדש:`
          : `⚠️ The server was restarted and your session was lost.\n\n📧 Please enter your email to login again:`,
        timestamp: new Date().toISOString()
      };
      setMessages([restartMsg]);
      setAuthState('awaiting-email');
      
      // Clean up the URL to remove parameters
      window.history.replaceState({}, document.title, '/');
      
      // Clear the backend restart flag from session storage
      sessionStorage.removeItem('backendRestart');
      
      return;
    }
    
    // Handle session expired message
    if (reason === 'session_expired' && !messages.find(m => m.id === 'session-expired')) {
      const expiredMsg = {
        id: 'session-expired',
        type: 'agent',
        content: currentLanguage === 'he'
          ? `⏱️ פג תוקף החיבור שלך.\n\n📧 אנא הזן את האימייל שלך כדי להתחבר מחדש:`
          : `⏱️ Your session has expired.\n\n📧 Please enter your email to login again:`,
        timestamp: new Date().toISOString()
      };
      setMessages([expiredMsg]);
      setAuthState('awaiting-email');
      
      // Clean up the URL to remove parameters
      window.history.replaceState({}, document.title, '/');
      
      return;
    }
    
    // Handle successful email verification with auto-login (seamless flow)
    if (verified === 'true' && !messages.find(m => m.id === 'auto-login-success')) {
      const isSeamless = sessionStorage.getItem('seamlessLogin') === 'true';
      const welcomeMsg = {
        id: 'auto-login-success',
        type: 'agent',
        content: `✅ ${t('welcomeBack')}${welcomeName ? `, ${welcomeName}` : ''}! ${t('practiceActive')}.\n\n${t('howCanIHelp')}`,
        timestamp: new Date().toISOString()
      };
      setMessages([welcomeMsg]);
      setAuthState('authenticated');
      
      // Clean up the URL to remove parameters
      window.history.replaceState({}, document.title, '/');
      
      // Clear the seamless flags
      sessionStorage.removeItem('seamlessLogin');
      sessionStorage.removeItem('justVerified');
      
      return;
    }
    
    // Handle invalid verification token
    if (error === 'invalid-verification' && !messages.find(m => m.id === 'invalid-verification')) {
      const errorMsg = {
        id: 'invalid-verification',
        type: 'agent',
        content: currentLanguage === 'he'
          ? `❌ קישור האימות לא תקף או פג תוקף.\n\nאנא בקש קישור חדש על ידי הקלדת "שלח אימות מחדש" או צור משתמש חדש.`
          : `❌ Invalid or expired verification link.\n\nPlease request a new one by typing "resend verification" or create a new account.`,
        timestamp: new Date().toISOString()
      };
      setMessages([errorMsg]);
      setAuthState('error');
      return;
    }
    
    // Check if we just came from email verification
    if (verifiedEmail && !isAuthenticated) {
      // User just verified their email, prompt them to login
      const welcomeMsg = {
        id: 'email-verified',
        type: 'agent',
        content: currentLanguage === 'he'
          ? `✅ האימייל שלך אומת בהצלחה!\n\nעכשיו אתה יכול להתחבר עם האימייל שלך: ${verifiedEmail}\n\nפשוט הקלד "התחבר" או "כניסה" כדי להתחיל.`
          : `✅ Your email has been verified successfully!\n\nYou can now login with your email: ${verifiedEmail}\n\nJust type "login" or "sign in" to get started.`,
        timestamp: new Date().toISOString()
      };
      setMessages([welcomeMsg]);
      setAuthState('post-verification');
      
      // Clear the verified email flag after showing the message
      setTimeout(() => {
        secureStorage.removeItem('verifiedEmail');
      }, 5000);
      
    } else if (emailVerified && pendingVerification) {
      // Coming from email verification
      const verificationData = JSON.parse(pendingVerification);
      
      const welcomeMsg = {
        id: 'welcome',
        type: 'agent',
        content: isRTL 
          ? `✅ האימייל אומת בהצלחה!\n\nברוך הבא, ${verificationData.user?.profile?.firstName || 'משתמש'} 👋\n\nלכמה זמן תרצה להישאר מחובר?\n\n• יום אחד - אבטחה גבוהה (מומלץ למחשבים משותפים)\n• 7 ימים - מאוזן (למכשירים אישיים)\n• 30 יום - הישאר מחובר (רק למכשיר אישי)\n\nפשוט הקלד: "יום", "7 ימים", או "30 יום"`
          : `✅ Email verified successfully!\n\nWelcome, ${verificationData.user?.profile?.firstName || 'User'} 👋\n\nHow long would you like to stay logged in?\n\n• 1 day - High security (recommended for shared computers)\n• 7 days - Balanced (for personal devices)\n• 30 days - Stay logged in (personal device only)\n\nJust type: "1 day", "7 days", or "30 days"`,
        timestamp: new Date().toISOString()
      };
      setMessages([welcomeMsg]);
      setAuthState('email-verification-session');
      
      // Store verification data for later use
      secureStorage.setItem('authData', JSON.stringify(verificationData));
      
      // Clear URL parameter
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // Start with empty messages - Claude will provide the welcome
      setMessages([]);
      setAuthState('welcome');
    }
  }, [isRTL]);

  // Inject CSS animations and scrollbar styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.8; }
      }
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      /* Scrollbar styling for chat area */
      .chat-container {
        scrollbar-width: thin;
        scrollbar-color: #565869 #343541;
      }
      
      .chat-container::-webkit-scrollbar {
        width: 8px;
      }
      
      .chat-container::-webkit-scrollbar-track {
        background: #343541;
        border-radius: 4px;
      }
      
      .chat-container::-webkit-scrollbar-thumb {
        background: #565869;
        border-radius: 4px;
      }
      
      .chat-container::-webkit-scrollbar-thumb:hover {
        background: #40414f;
      }
      
      /* RTL specific - scrollbar on left */
      .chat-container[dir="rtl"] {
        direction: rtl;
      }
      
      /* LTR specific - scrollbar on right */
      .chat-container[dir="ltr"] {
        direction: ltr;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Handle session duration selection
  const handleSessionDuration = async (userMessage) => {
    const lowerInput = userMessage.toLowerCase().trim();
    const authData = JSON.parse(secureStorage.getItem('authData') || '{}');
    
    process.env.NODE_ENV !== 'production' && console.log('🔐 [DEBUG] Handling session duration:', {
      userMessage,
      authState,
      hasAuthData: !!authData.token,
      authData,
      currentUser: user,
      currentClinic: practice,
      isAuthenticated
    });
    
    // Check for session duration choices
    let sessionDays = 0;
    if (lowerInput.includes('30') || lowerInput.includes('month') || lowerInput.includes('חודש')) {
      sessionDays = 30;
    } else if (lowerInput.includes('7') || lowerInput.includes('week') || lowerInput.includes('שבוע')) {
      sessionDays = 7;
    } else if (lowerInput.includes('1') || lowerInput.includes('day') || lowerInput.includes('יום אחד') || lowerInput === 'יום') {
      sessionDays = 1;
    } else {
      return {
        message: currentLanguage === 'he' 
          ? 'אנא בחר: "יום", "7 ימים", או "30 יום"'
          : 'Please choose: "1 day", "7 days", or "30 days"'
      };
    }
    
    process.env.NODE_ENV !== 'production' && console.log('🔑 [DEBUG] Storing authentication data:', {
      sessionDays,
      token: authData.token?.substring(0, 20) + '...',
      user: authData.user,
      practice: authData.practice
    });

    // Store token and auth data based on session preference
    if (sessionDays >= 7) {
      // Long-term storage
      secureStorage.setItem('authToken', authData.token);
      secureStorage.setItem('rememberMe', 'true');
      secureStorage.setItem('sessionExpiry', (Date.now() + sessionDays * 24 * 60 * 60 * 1000).toString());
      secureStorage.setItem('user', JSON.stringify(authData.user));
      secureStorage.setItem('practice', JSON.stringify(authData.practice));
      // Also set in session storage for immediate use
      secureStorage.setItem('token', authData.token);
      secureStorage.setItem('user', JSON.stringify(authData.user));
      secureStorage.setItem('practice', JSON.stringify(authData.practice));
      process.env.NODE_ENV !== 'production' && console.log('📦 [DEBUG] Stored in localStorage + sessionStorage');
    } else {
      // Session-only storage
      secureStorage.setItem('token', authData.token);
      secureStorage.setItem('sessionExpiry', (Date.now() + 24 * 60 * 60 * 1000).toString());
      secureStorage.setItem('user', JSON.stringify(authData.user));
      secureStorage.setItem('practice', JSON.stringify(authData.practice));
      process.env.NODE_ENV !== 'production' && console.log('📦 [DEBUG] Stored in sessionStorage only');
    }
    
    process.env.NODE_ENV !== 'production' && console.log('👤 [DEBUG] Setting user and practice in context:', {
      user: authData.user,
      practice: authData.practice
    });
    
    // Set the authentication state through context
    // This will trigger re-render and show the authenticated view
    process.env.NODE_ENV !== 'production' && console.log('🔄 [DEBUG] About to set user and practice:', {
      userToSet: authData.user,
      practiceToSet: authData.practice
    });
    
    setUser(authData.user);
    setPractice(authData.practice);
    
    // Force a state update to trigger re-render
    setTimeout(() => {
      process.env.NODE_ENV !== 'production' && console.log('⏱️ [DEBUG] Checking auth state after timeout:', {
        isAuthenticated,
        user,
        practice
      });
    }, 100);
    
    process.env.NODE_ENV !== 'production' && console.log('✅ [DEBUG] Authentication state set, should redirect now');
    
    // Clear pending data after setting auth
    setTimeout(() => {
      secureStorage.removeItem('pendingLogin');
      secureStorage.removeItem('pendingVerification');
      secureStorage.removeItem('authData');
      secureStorage.removeItem('magicLinkLogin');
      // Also clear from localStorage
      secureStorage.removeItem('pendingLogin');
      secureStorage.removeItem('pendingVerification');
      secureStorage.removeItem('magicLinkLogin');
    }, 100);
    
    return {
      message: currentLanguage === 'he'
        ? `✅ מעולה! אתה מחובר ל-${sessionDays} ${sessionDays === 1 ? 'יום' : 'ימים'}.\n\n🏥 ברוך הבא ל-IntelliCare!`
        : `✅ Perfect! You're logged in for ${sessionDays} ${sessionDays === 1 ? 'day' : 'days'}.\n\n🏥 Welcome to IntelliCare!`
    };
  };

  // Helper to extract subdomain from current URL
  const getCurrentSubdomain = () => {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    
    // Check if we have a subdomain (not on main domain)
    if (parts.length >= 2) {
      const subdomain = parts[0];
      // Exclude common non-practice subdomains
      if (subdomain && !['www', 'localhost', '127', 'intellicare'].includes(subdomain)) {
        return subdomain;
      }
    }
    return null;
  };
  
  // Send message to AI backend  
  const sendToAI = async (userMessage) => {
    // Handle email verification session specially
    if (authState === 'email-verification-session') {
      return await handleSessionDuration(userMessage);
    }
    
    try {
      // Extract current subdomain
      const currentSubdomain = getCurrentSubdomain();
      
      // 🔒 SECURE API: Using secureApiClient instead of fetch()
      const response = await secureApi.post('/api/auth-ai/chat', {
          message: userMessage,
          language: currentLanguage,
          sessionId: sessionId,
          subdomain: currentSubdomain  // Pass subdomain to backend
      });

      // SecureApiClient returns parsed JSON data
      const data = response.data || response;
      
      // Update session ID if provided (keep in memory only, not storage)
      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
        // DO NOT store in sessionStorage for security
      }
      
      // Log cache stats if available
      if (data.cacheStats) {
        process.env.NODE_ENV !== 'production' && console.log('📊 Cache stats:', data.cacheStats);
        if (data.cacheStats.cacheHit) {
          process.env.NODE_ENV !== 'production' && console.log(`✅ Cache HIT! Saved ${data.cacheStats.tokensFromCache} tokens from cache`);
        } else if (data.cacheStats.tokensCached > 0) {
          process.env.NODE_ENV !== 'production' && console.log(`📝 Cached ${data.cacheStats.tokensCached} tokens for future use`);
        }
      }
      
      // Handle conversation complete flag
      if (data.conversationComplete || data.functionResult?.conversationComplete) {
        setConversationComplete(true); // Set conversation complete state
        setInputValue(''); // Clear input
        console.log('🔒 Conversation complete - input disabled');
      }
      
      // Handle successful authentication
      if (data.functionCalled === 'loginUser' && data.functionResult?.success) {
        process.env.NODE_ENV !== 'production' && console.log('✅ Login email sent successfully');
      } else if (data.functionCalled === 'createNewPractice' && data.functionResult?.success) {
        console.log('✅ Practice created successfully');
        console.log('📊 Function result:', data.functionResult);
        
        // DON'T redirect automatically - wait for email verification
        // The backend already returns a perfect message telling the user to check their email
        // The BroadcastChannel listener (lines 63-85) will handle the redirect after verification
        
        // Optional: Add a visual indicator that we're waiting for verification
        // This could be a spinner or status message in the chat
        console.log('⏳ Waiting for email verification...');
        
        // Store that we're waiting for this practice verification (optional)
        const subdomain = data.functionResult?.practice?.subdomain || 
                         data.functionResult?.subdomain ||
                         data.functionResult?.data?.subdomain ||
                         data.functionResult?.data?.practice?.subdomain;
        if (subdomain) {
          secureStorage.setItem('pendingPracticeVerification', subdomain);
        }
      } else if (data.functionCalled === 'signupUser' && data.functionResult?.success) {
        process.env.NODE_ENV !== 'production' && console.log('✅ Signup successful');
      }
      
      return data;
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('AI chat error:', error);
      return {
        message: currentLanguage === 'he' 
          ? 'מצטער, יש בעיה טכנית. נסה שוב.'
          : 'Sorry, there\'s a technical issue. Please try again.',
        error: true
      };
    }
  };

  // Handle OTP request
  const handleSendOTP = async (email) => {
    try {
      setOtpLoading(true);
      setOtpError(null);

      // DEV MODE: Check if in development and bypass OTP
      if (import.meta.env.MODE === 'development' || import.meta.env.DEV) {
        console.log('🔓 [DEV] Bypassing OTP - using dev-login endpoint');

        const response = await secureApi.post('/api/passwordless-auth/dev-login', {
          email: email
        });

        const data = response.data || response;

        if (data.success) {
          console.log('✅ [DEV] Direct login successful:', data.user);

          // Add success message to chat
          setMessages(prev => [...prev, {
            id: `msg_${Date.now()}_dev`,
            type: 'agent',
            content: currentLanguage === 'he'
              ? `✅ מצב פיתוח: התחברת ישירות כ-${data.user.name}`
              : `✅ DEV MODE: Logged in directly as ${data.user.name}`,
            timestamp: new Date().toISOString()
          }]);

          // Trigger auth success
          if (handleAuthSuccess) {
            handleAuthSuccess(data.user);
          }

          setOtpLoading(false);
          return data;
        }
      }

      // PRODUCTION MODE: Normal OTP flow
      const response = await secureApi.post('/api/passwordless-auth/send-otp', {
        email: email
      });

      const data = response.data || response;

      if (data.success) {
        setOtpEmail(email);
        setShowOTP(true);

        // Add message to chat
        setMessages(prev => [...prev, {
          id: `msg_${Date.now()}_otp`,
          type: 'agent',
          content: currentLanguage === 'he'
            ? `📧 שלחנו קוד אימות בן 6 ספרות לכתובת ${email}. אנא הזן את הקוד למטה:`
            : `📧 We've sent a 6-digit verification code to ${email}. Please enter the code below:`,
          timestamp: new Date().toISOString()
        }]);

        // Store practice info if user needs redirect
        if (data.needsRedirect && data.subdomain) {
          secureStorage.setItem('pendingRedirect', {
            subdomain: data.subdomain,
            email: email
          });
        }
      }

      setOtpLoading(false);
      return data;
    } catch (error) {
      console.error('❌ Failed to send OTP:', error);
      setOtpError(error.response?.data?.message?.[currentLanguage] || 'Failed to send code');
      setOtpLoading(false);
      return { success: false };
    }
  };
  
  // Handle OTP verification
  const handleVerifyOTP = async (code) => {
    try {
      setOtpLoading(true);
      setOtpError(null);
      
      // Check if this is email verification or login OTP
      const isEmailVerification = authState === 'email-verification';
      
      let data;
      if (isEmailVerification) {
        // For email verification, send to AI to handle with verifyEmailOTP function
        // Include email and subdomain in the message for the AI to parse
        const verifyMessage = `verify ${code} ${otpEmail} ${practiceSubdomain}`;
        const response = await sendToAI(verifyMessage);
        
        // Check if verification was successful
        if (response.functionCalled === 'verifyEmailOTP' && response.functionResult?.emailVerified) {
          // Email verified successfully
          data = response.functionResult;
          
          // If session token is provided, store it temporarily for the redirect
          if (data.sessionToken) {
            secureStorage.setItem('pendingSessionToken', data.sessionToken);
            console.log('🔑 Session token stored for practice redirect');
          }
          
          // If CSRF token is provided, store it globally
          if (data.csrfToken) {
            window.__CSRF_TOKEN = data.csrfToken;
            console.log('🔐 CSRF token stored for mutations');
          }
          
          // Redirect to the practice URL with auto-login
          if (data.practiceUrl) {
            // Add query params to indicate auto-login
            const redirectUrl = data.autoLogin 
              ? `${data.practiceUrl}?verified=true&autoLogin=true`
              : data.practiceUrl;
            
            setTimeout(() => {
              console.log('🚀 Redirecting to practice with auto-login:', redirectUrl);
              window.location.href = redirectUrl;
            }, 2000);
          }
        } else {
          data = response.functionResult || { success: false };
        }
      } else {
        // For login OTP, use the existing passwordless auth endpoint
        const response = await secureApi.post('/api/passwordless-auth/verify-otp', {
          email: otpEmail,
          code: code
        });
        data = response.data || response;
      }
      
      if (data.success) {
        // Hide OTP input
        setShowOTP(false);
        
        // Store CSRF token immediately if provided
        if (data.csrfToken) {
          window.__CSRF_TOKEN = data.csrfToken;
          sessionStorage.setItem('pendingCSRFToken', data.csrfToken);
          console.log('🔐 [ChatAuthAI] CSRF token stored for post-redirect use');
        }
        
        // Don't set user/practice state here - let the page reload handle it
        // This prevents double rendering of the authenticated view
        
        // Add success message
        setMessages(prev => [...prev, {
          id: `msg_${Date.now()}_success`,
          type: 'agent',
          content: `✅ ${t('verifiedSuccessfully')} ${data.needsRedirect || data.practiceUrl ? t('redirectingToPractice') : t('welcome')}`,
          timestamp: new Date().toISOString()
        }]);
        
        // Handle redirect if needed
        if (data.needsRedirect && data.redirectUrl) {
          // Store session token in sessionStorage for use after redirect
          if (data.sessionToken) {
            console.log('🔒 [ChatAuthAI] Storing session token for redirect:', data.sessionToken.substring(0, 10) + '...');
            sessionStorage.setItem('pendingSessionToken', data.sessionToken);
            
            // Also add as URL parameter as fallback
            const redirectUrlWithToken = new URL(data.redirectUrl);
            redirectUrlWithToken.searchParams.set('st', data.sessionToken);
            
            console.log('🚀 [ChatAuthAI] Redirecting to:', redirectUrlWithToken.toString());
            setTimeout(() => {
              window.location.href = redirectUrlWithToken.toString();
            }, 1500);
          } else {
            console.warn('⚠️ [ChatAuthAI] No session token in response to store');
            console.log('🚀 [ChatAuthAI] Redirecting to:', data.redirectUrl);
            setTimeout(() => {
              window.location.href = data.redirectUrl;
            }, 1500);
          }
        } else if (!isEmailVerification) {
          // Reload the page to properly initialize auth context with the new session cookie (for login only)
          setTimeout(() => {
            console.log('🔄 Reloading page to complete login...');
            window.location.reload();
          }, 1500);
        }
        
        setConversationComplete(true);
      } else {
        setOtpError(data.message?.[currentLanguage] || data.message || 'Invalid code');
      }
      
      setOtpLoading(false);
    } catch (error) {
      console.error('❌ Failed to verify OTP:', error);
      const errorMsg = error.response?.data?.message;
      setOtpError(
        typeof errorMsg === 'object' ? errorMsg[currentLanguage] : 
        errorMsg || 'Verification failed'
      );
      setOtpLoading(false);
    }
  };
  
  // Handle OTP resend
  const handleResendOTP = async () => {
    await handleSendOTP(otpEmail);
  };

  // Handle message submission
  const handleSendMessage = async (e, messageOverride = null) => {
    e?.preventDefault();
    
    // Track user activity when sending a message
    if (trackActivity && typeof trackActivity === 'function') {
      trackActivity();
    }
    
    console.log('🎯 handleSendMessage called with:', { messageOverride, inputValue, isProcessing, conversationComplete });
    
    // Prevent sending if conversation is complete
    if (conversationComplete) {
      console.log('🔒 Cannot send message - conversation complete. Check your email.');
      return;
    }
    
    // Use messageOverride if provided, otherwise use inputValue
    const userMessage = messageOverride || inputValue;
    if (!userMessage || !userMessage.trim()) {
      console.log('❌ Message empty');
      return;
    }
    
    if (isProcessing) {
      console.log('❌ Already processing');
      return;
    }
    
    // Check if message is an email address (for OTP flow)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmail = emailRegex.test(userMessage.trim());
    
    // Check if message is a 6-digit OTP code and we're waiting for one
    const otpRegex = /^\d{6}$/;
    const isOTPCode = otpRegex.test(userMessage.trim());
    
    // If user typed OTP code while OTP input is showing, handle it directly
    if (isOTPCode && showOTP) {
      console.log('📱 User typed OTP code in chat, verifying...');
      await handleVerifyOTP(userMessage.trim());
      setInputValue('');
      return;
    }
    
    // Add user message
    setMessages(prev => [...prev, {
      id: `msg_${Date.now()}`,
      type: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    }]);
    
    // Track user message for workflow
    workflowTrackerService.processMessage(userMessage, false);
    
    setInputValue('');
    setIsProcessing(true);
    
    // Always send to AI - it will handle email detection and OTP sending
    try {
      console.log('📤 Sending message to AI:', userMessage);
      const aiResponse = await sendToAI(userMessage);

      // Check if this is a rate limit error
      // Handle translation objects properly
      let messageContent = aiResponse.message;
      // Some flows (e.g. joining an existing practice) return the text under
      // functionResult instead of at the top level — fall back to it.
      if (messageContent == null) {
        messageContent = aiResponse.functionResult?.message;
      }
      if (typeof messageContent === 'object' && messageContent !== null && ('he' in messageContent || 'en' in messageContent)) {
        messageContent = messageContent[currentLanguage] || messageContent.en || messageContent.he || 'No message';
      }
      let isRateLimitError = false;
      const rateLimitMatch = messageContent?.match(/Please wait (\d+) seconds?/i) ||
                            messageContent?.match(/אנא המתן (\d+) שניות?/i);

      if (rateLimitMatch) {
        const waitSeconds = parseInt(rateLimitMatch[1]);
        setRateLimitCountdown(waitSeconds);
        isRateLimitError = true;

        // Start countdown timer
        if (rateLimitTimerRef.current) {
          clearInterval(rateLimitTimerRef.current);
        }

        rateLimitTimerRef.current = setInterval(() => {
          setRateLimitCountdown(prev => {
            if (prev <= 1) {
              clearInterval(rateLimitTimerRef.current);

              // Add a helpful message when timer ends
              setMessages(messages => [...messages, {
                id: `msg_${Date.now()}_timer_done`,
                type: 'agent',
                content: currentLanguage === 'he'
                  ? '✅ עכשיו ניתן לבקש קוד חדש. אם הקוד שקיבלת לא עבד, ניתן להקליד שוב את כתובת האימייל.'
                  : '✅ You can now request a new code. If the code you received didn\'t work, you can type your email address again.',
                timestamp: new Date().toISOString()
              }]);

              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        // Create a more user-friendly message
        messageContent = currentLanguage === 'he'
          ? `⏰ **נשלח קוד אימות לאחרונה**\n\nכדי למנוע ספאם, עליך להמתין ${waitSeconds} שניות לפני בקשת קוד חדש.\n\nהקוד שנשלח עדיין תקף למשך 10 דקות. אנא בדוק את תיבת האימייל שלך.`
          : `⏰ **A verification code was recently sent**\n\nTo prevent spam, you need to wait ${waitSeconds} seconds before requesting a new code.\n\nThe code that was sent is still valid for 10 minutes. Please check your email.`;
      }

      // Final safety net: never store a non-string content. If the backend sent
      // no text and no structured display data, show a friendly retry message so
      // the chat never renders a blank bubble or crashes on .replace().
      if (typeof messageContent !== 'string' || messageContent.trim() === '') {
        const hasStructuredContent = !!(aiResponse.displayData || aiResponse.functionResult?.displayData);
        messageContent = hasStructuredContent
          ? ''
          : (currentLanguage === 'he'
              ? 'מצטער, לא התקבלה תשובה מהשרת. אנא נסה שוב.'
              : 'Sorry, no response was received from the server. Please try again.');
      }

      // Debug log to check what we're receiving
      if (aiResponse.displayData || aiResponse.displayType) {
        console.log('🎯 [ChatAuthAI] Received display data from backend:', {
          displayType: aiResponse.displayType,
          patientCount: aiResponse.displayData?.patients?.length || 0
        });
      }

      // Add AI response with potentially modified content and function result data
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}_ai`,
        type: 'agent',
        content: messageContent,
        timestamp: new Date().toISOString(),
        isRateLimitError: isRateLimitError,
        // Include function result data for structured display
        functionResult: aiResponse.functionResult,
        // Check for displayData at root level first (new structure), then fallback to functionResult (old structure)
        displayData: aiResponse.displayData || aiResponse.functionResult?.displayData,
        displayType: aiResponse.displayType || aiResponse.functionResult?.displayType || aiResponse.functionResult?.displayData?.displayType
      }]);
      
      // Track AI response for workflow
      workflowTrackerService.processMessage(messageContent, true);
      
      // Check if AI detected login and requires OTP
      if (aiResponse.functionCalled === 'loginUser' && aiResponse.functionResult?.requiresOTP) {
        // AI sent OTP, now show the OTP input
        setOtpEmail(aiResponse.functionResult.email);
        setShowOTP(true);
        setAuthState('otp-verification');
        console.log('📱 [ChatAuthAI] Showing OTP input for login:', aiResponse.functionResult.email);
      }

      // DEV MODE: Check if AI logged in directly (dev mode bypass)
      if (aiResponse.functionCalled === 'loginUser' && aiResponse.functionResult?.devMode && aiResponse.functionResult?.redirectToChat) {
        console.log('🔓 [DEV] Direct login successful, reloading page to initialize chat...');
        setConversationComplete(true);

        // Reload the page to properly initialize auth context with the session cookie
        setTimeout(() => {
          console.log('🔄 Reloading page to complete dev-mode login...');
          window.location.reload();
        }, 1500);
      }

      // Check if AI created practice and requires email verification OTP
      if (aiResponse.functionCalled === 'createNewPractice' && aiResponse.functionResult?.waitingForOTP) {
        // Practice created, now show OTP input for email verification
        const adminEmail = aiResponse.functionResult.email || 
                          // Try to extract email from the success message
                          aiResponse.functionResult.message?.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0];
        
        if (adminEmail) {
          setOtpEmail(adminEmail);
          setShowOTP(true);
          setAuthState('email-verification');
          // Store subdomain for verification
          setPracticeSubdomain(aiResponse.functionResult.practiceSubdomain);
          console.log('📱 [ChatAuthAI] Showing OTP input for email verification:', adminEmail);
        }
      }

      // Auto-login after joining an existing practice. Registration happens on the
      // root domain, but the practice login lives at <subdomain>.intellicare.health.
      // Reuse dev-login (from the root domain it finds the user across practices and
      // returns a redirectUrl to the practice's dev-login-callback with a session
      // token) so the user lands logged-in without retyping anything.
      if (aiResponse.functionCalled === 'signupUser' && aiResponse.functionResult?.success) {
        const signupEmail = aiResponse.functionResult.email;
        const signupSubdomain = aiResponse.functionResult.practiceSubdomain;
        const isDev = import.meta.env.MODE === 'development' || import.meta.env.DEV;
        const buildPracticeUrl = (sub) => {
          const port = window.location.port ? `:${window.location.port}` : '';
          return `${window.location.protocol}//${sub}.intellicare.health${port}`;
        };

        let redirected = false;
        if (signupEmail && isDev) {
          try {
            console.log('🔓 [Signup] Auto-login via dev-login for:', signupEmail);
            const loginResp = await secureApi.post('/api/passwordless-auth/dev-login', { email: signupEmail });
            const loginData = loginResp.data || loginResp;

            if (loginData?.needsRedirect && loginData?.redirectUrl) {
              setMessages(prev => [...prev, {
                id: `msg_${Date.now()}_redirect`,
                type: 'agent',
                content: currentLanguage === 'he' ? '🚀 מתחבר אותך למרפאה…' : '🚀 Logging you in…',
                timestamp: new Date().toISOString()
              }]);
              redirected = true;
              setTimeout(() => { window.location.href = loginData.redirectUrl; }, 800);
            } else if (loginData?.success) {
              // Logged in on the same domain — reload to enter the app.
              redirected = true;
              setTimeout(() => window.location.reload(), 800);
            }
          } catch (err) {
            console.error('❌ [Signup] Auto-login failed, falling back to manual link:', err);
          }
        }

        // Fallback (production, or auto-login failed): clear, clickable login link.
        if (!redirected && signupSubdomain) {
          const url = buildPracticeUrl(signupSubdomain);
          setMessages(prev => [...prev, {
            id: `msg_${Date.now()}_manuallogin`,
            type: 'agent',
            content: currentLanguage === 'he'
              ? `כדי להתחבר, פתח את כתובת המרפאה שלך ואמור "התחברות":\n\n[${url}](${url})`
              : `To log in, open your practice address and say "login":\n\n[${url}](${url})`,
            timestamp: new Date().toISOString()
          }]);
        }
      }
    } catch (error) {
      console.error('❌ Failed to send message to AI:', error);
      
      // Add error message to chat
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}_error`,
        type: 'agent',
        content: currentLanguage === 'he' 
          ? 'מצטער, נתקלתי בבעיה. אנא נסה שוב.'
          : 'Sorry, I encountered an issue. Please try again.',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      // Always reset processing state
      setIsProcessing(false);
      console.log('✅ Reset isProcessing to false');
    }
    
    // Refocus the input field after processing
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.removeAttribute('readonly');
        inputRef.current.focus();
      }
    }, 100);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Get prompt suggestions with SVG icons
  const getPromptSuggestions = () => {
    if (messages.length > 1) return [];

    // SVG icon components
    const ClinicIcon = () => (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
        <path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2" />
        <rect x="8" y="2" width="8" height="3" rx="1" />
        <line x1="12" y1="11" x2="12" y2="17" />
        <line x1="9" y1="14" x2="15" y2="14" />
      </svg>
    );

    const LoginIcon = () => (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <polyline points="10 17 15 12 10 7" />
        <line x1="15" y1="12" x2="3" y2="12" />
      </svg>
    );

    const SignupIcon = () => (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <line x1="20" y1="8" x2="20" y2="14" />
        <line x1="23" y1="11" x2="17" y2="11" />
      </svg>
    );

    return isRTL ? [
      { icon: <ClinicIcon />, text: 'מרפאה חדשה', description: 'יצירת מרפאה חדשה במערכת' },
      { icon: <LoginIcon />, text: 'התחבר', description: 'כניסה למרפאה קיימת' },
      { icon: <SignupIcon />, text: 'הרשמה', description: 'הצטרפות למרפאה קיימת' }
    ] : [
      { icon: <ClinicIcon />, text: 'New Practice', description: 'Create a new medical practice' },
      { icon: <LoginIcon />, text: 'Login', description: 'Login to existing practice' },
      { icon: <SignupIcon />, text: 'Join', description: 'Join existing practice' }
    ];
  };

  // Debug authentication state
  useEffect(() => {
    process.env.NODE_ENV !== 'production' && console.log('🔍 [DEBUG] Authentication state changed:', {
      isAuthenticated,
      user,
      practice,
      hasToken: !!secureStorage.getItem('token') || !!secureStorage.getItem('authToken'),
      sessionToken: secureStorage.getItem('token')?.substring(0, 20) + '...',
      localToken: secureStorage.getItem('authToken')?.substring(0, 20) + '...'
    });
  }, [isAuthenticated, user, practice]);

  // REMOVED: Cross-tab sync listeners - not needed for single-tab OTP flow
  // The login now happens entirely in the same tab via OTP code entry


  // Show loading while checking auth to prevent flash
  if (!authCheckComplete) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#0a0e27',
        color: '#fff'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(255, 255, 255, 0.3)',
          borderTop: '3px solid #fff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
      </div>
    );
  }

  // If authenticated, show the main chat
  if (isAuthenticated) {
    process.env.NODE_ENV !== 'production' && console.log('🚀 [DEBUG] Rendering authenticated ChatContainer:', {
      practice: practice?.subdomain,
      user: user?.email
    });
    
    // Don't persist auth data for security - use actual practice from auth
    const practiceSubdomain = practice?.subdomain || secureStorage.getItem('practiceSubdomain') || '';
    // No token needed - using httpOnly cookies for authentication
    const authToken = null;
    
    process.env.NODE_ENV !== 'production' && console.log('🏥 [DEBUG] Practice info:', {
      practice: practice,
      subdomain: practiceSubdomain,
      usingCookieAuth: true
    });
    
    return (
      <>
        <Suspense fallback={
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            backgroundColor: '#0a0e27',
            color: '#fff',
            fontSize: '18px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: '20px' }}>
                {t('loadingChat')}
              </div>
              <div style={{
                width: '50px',
                height: '50px',
                border: '3px solid rgba(255, 255, 255, 0.3)',
                borderTop: '3px solid #fff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto'
              }}></div>
            </div>
          </div>
        }>
          <ChatContainer
            apiUrl="/api"
            practice={practiceSubdomain}
            authToken={authToken}
            language={currentLanguage}
            onSessionChange={handleSessionChange}
          />
        </Suspense>
      </>
    );
  }

  // Add spinner animation styles
  if (!document.getElementById('spinner-animation')) {
    const style = document.createElement('style');
    style.id = 'spinner-animation';
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  // Styles - All from ChatAuthConversational
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    background: '#060A14',
    backgroundAttachment: 'fixed',
    direction: isRTL ? 'rtl' : 'ltr',
    fontFamily: "'Comfortaa', 'Segoe UI', sans-serif"
  };
  
  const chatAreaWrapperStyle = {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    background: '#060A14',
    width: '100%'
  };
  
  const chatAreaStyle = {
    padding: '24px 24px 100px',  // Adjusted bottom padding for 20px raised input
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    maxWidth: '580px',  // Match the info banner width
    margin: '0 auto',
    width: '90%',       // Match the info banner width
    boxSizing: 'border-box',
    minHeight: '100%'
  };
  
  const messageStyle = (isUser) => ({
    maxWidth: '75%',
    padding: '16px 20px',
    borderRadius: isUser 
      ? (isRTL ? '20px 20px 6px 20px' : '20px 20px 20px 6px')
      : (isRTL ? '20px 20px 20px 6px' : '20px 20px 6px 20px'),
    background: isUser
      ? '#0E1626'
      : '#121E33',
    color: '#E9EFFA',
    alignSelf: 'flex-start',
    fontSize: '16px',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
    direction: isRTL ? 'rtl' : 'ltr',
    wordBreak: 'break-word',
    border: isUser ? '1px solid #28395C' : 'none',
    transition: 'all 0.2s ease'
  });
  
  const inputAreaStyle = {
    padding: '16px',
    background: 'transparent',
    borderTop: 'none',
    position: 'fixed',
    bottom: '20px',  // Raised 20px from bottom
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    zIndex: 1000  // Ensure it's above other elements
  };
  
  const formStyle = {
    display: 'flex',
    gap: '8px',
    maxWidth: '768px',
    width: '100%',
    margin: '0 auto',
    alignItems: 'center',
    background: 'linear-gradient(180deg, #121E33, #0E1626)',
    borderRadius: '14px',
    padding: '6px 6px 6px 8px',
    border: '1px solid #28395C'
  };
  
  const inputStyle = {
    flex: 1,
    padding: '14px 20px',
    borderRadius: '20px',
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: '16px',
    outline: 'none',
    direction: isRTL ? 'rtl' : 'ltr',
    fontFamily: 'inherit',
    color: '#E9EFFA',
    '::placeholder': {
      color: '#7C8AA8'
    },
    WebkitTextSecurity: authState.includes('password') ? 'disc' : 'none'
  };
  
  const sendButtonStyle = {
    padding: '12px 20px',
    borderRadius: '10px',
    border: 'none',
    background: isProcessing || !inputValue.trim() ? '#28395C' : '#3D8BFF',
    color: isProcessing || !inputValue.trim() ? '#7C8AA8' : '#04122e',
    fontSize: '15px',
    fontWeight: '600',
    cursor: isProcessing || !inputValue.trim() ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    opacity: 1,
    fontFamily: 'inherit'
  };

  const infoBannerStyle = {
    background: '#0E1626',
    padding: '14px 18px',
    margin: '20px auto',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    color: '#ececf1',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    animation: 'fadeIn 0.5s ease-out',
    maxWidth: '580px',  // Limit width for better readability
    width: '90%',       // Responsive width
    border: '1px solid #1A2740'
  };

  const promptSuggestionsContainerStyle = {
    padding: '20px',
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    flexWrap: 'wrap',
    maxWidth: '800px',
    margin: '0 auto'
  };

  const promptSuggestionStyle = {
    padding: '16px 20px',
    background: '#444654',
    border: '1px solid #565869',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    minWidth: '140px',
    color: '#ececf1',
    textAlign: 'center'
  };

  // Check if this is the first user message (only welcome message exists)
  const hasUserMessages = messages.some(msg => msg.type === 'user');
  const isCenteredLayout = !hasUserMessages && messages.length <= 1;

  return (
    <div style={containerStyle}>
      
      {/* Language Switcher - only shows on parent domain based on allowSwitcher flag */}
      {allowSwitcher && !isAuthenticated && (
        <div style={{
          position: 'fixed',
          top: '20px',
          [isRTL ? 'left' : 'right']: '20px',
          zIndex: 1000
        }}>
          <MinimalLanguageSwitcher />
        </div>
      )}

      {/* Centered layout when no user messages */}
      {isCenteredLayout ? (
        <div className="ica-stage" style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px',
          paddingBottom: '60px' // Add extra padding at bottom to push content up
        }}>
          <div className="ica-amb" aria-hidden="true"><span className="b1"></span><span className="b2"></span></div>

          {/* Welcome message at top */}
          <div className="ica-welcome" style={{
            marginBottom: '24px',
            textAlign: 'center',
            marginTop: '-40px'
          }}>
            {/* Medical icon */}
            <div style={{
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg className="ica-mark" width="68" height="68" viewBox="0 0 32 32" fill="none">
                <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="#0A1020" stroke="#3D8BFF" strokeWidth="1.4" />
                <path d="M4 17 H10 L12.5 9 L16 24 L19 13 L21 17 H28" stroke="#3D8BFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="ica-title" style={{ fontSize: '34px' }}>
              {t('welcomeToIntelliCare')}
            </div>
          </div>

          {/* Prompt Suggestions - Full width */}
          <div className="ica-cards">
            {getPromptSuggestions().map((suggestion, index) => (
              <button
                key={`suggestion-${index}`}
                type="button"
                data-onboarding-target={index === 0 ? 'new-practice' : index === 1 ? 'login' : 'signup'}
                className="ica-card"
                onClick={() => {
                  console.log('🔵 Box clicked:', suggestion.text);
                  
                  // Send the clicked option text directly as a message
                  // This will trigger Claude to respond appropriately
                  handleSendMessage({ preventDefault: () => {} }, suggestion.text);
                  
                  // Update workflow step data if active
                  if (activeWorkflow && activeWorkflow.id === 'practice-onboarding') {
                    // Map suggestion text to workflow path choice
                    let pathChoice = '';
                    if (suggestion.text.includes('New Practice') || suggestion.text.includes('New Practice') || suggestion.text.includes('מרפאה חדשה')) {
                      pathChoice = 'new-practice';
                    } else if (suggestion.text.includes('Login') || suggestion.text.includes('התחבר')) {
                      pathChoice = 'login';
                    } else if (suggestion.text.includes('Join') || suggestion.text.includes('Signup') || suggestion.text.includes('הרשמה')) {
                      pathChoice = 'signup';
                    }
                    
                    if (pathChoice) {
                      updateStepData('welcome', { pathChoice });
                      
                      // Update the workflow step to show context-appropriate messages
                      const contextMessage = pathChoice === 'login' 
                        ? {
                            en: 'Great! Let\'s log you in. Please tell me your email address.',
                            he: 'מצוין! בואו נחבר אותך. אנא ספר לי את כתובת האימייל שלך.'
                          }
                        : pathChoice === 'signup'
                        ? {
                            en: 'Welcome! Let\'s get you signed up. Which practice would you like to join?',
                            he: 'ברוך הבא! בואו נרשום אותך. לאיזו מרפאה תרצה להצטרף?'
                          }
                        : {
                            en: 'Excellent! Let\'s create your new practice. What\'s the name of your practice?',
                            he: 'מעולה! בואו ניצור את המרפאה החדשה שלך. מה שם המרפאה?'
                          };
                      
                      // Update the workflow step with appropriate context
                      updateWorkflowStep('welcome', {
                        commands: [{
                          templateKey: 'contextMessage',
                          template: contextMessage,
                          exampleKey: 'providedInfo',
                          example: {
                            en: 'Please provide the requested information',
                            he: 'אנא ספק את המידע המבוקש'
                          },
                          required: true,
                          field: 'userInput'
                        }]
                      });
                    }
                  }
                }}
              >
                <span className="ica-go" aria-hidden="true">→</span>
                <div className="ica-ico">{suggestion.icon}</div>
                <div className="ica-ct">{suggestion.text}</div>
                <div className="ica-cd">{suggestion.description}</div>
              </button>
            ))}
          </div>

          {/* Centered input form */}
          <div style={{
            width: '100%',
            maxWidth: '768px',
            padding: '0 20px',
            position: 'relative'
          }}>
            <form onSubmit={handleSendMessage} style={formStyle}>
              {/* Hidden decoy field to prevent autofill */}
              <input 
                type="text" 
                name="_decoy" 
                autoComplete="username" 
                aria-hidden="true" 
                tabIndex={-1} 
                style={{ 
                  position: 'absolute', 
                  top: '-9999px', 
                  left: '-9999px', 
                  width: '1px', 
                  height: '1px', 
                  opacity: 0, 
                  pointerEvents: 'none' 
                }} 
              />
              <input
                ref={inputRef}
                className="ica-input"
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={(e) => {
                  e.currentTarget.removeAttribute('readonly');
                }}
                onMouseDown={(e) => {
                  e.currentTarget.removeAttribute('readonly');
                }}
                placeholder={conversationComplete 
                  ? t('checkYourEmail')
                  : t('typeMessage')
                }
                style={inputStyle}
                disabled={conversationComplete || isProcessing}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-autocomplete="none"
                data-lpignore="true"
                data-1p-ignore
                data-bw-ignore
                readOnly
                autoFocus
              />
              
              {/* Send Button */}
              <button 
                type="submit" 
                style={sendButtonStyle}
                disabled={conversationComplete || isProcessing || !inputValue.trim()}
                onMouseEnter={(e) => {
                  if (!isProcessing && inputValue.trim()) {
                    e.target.style.backgroundColor = '#5BA0FF';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isProcessing) {
                    e.target.style.backgroundColor = inputValue.trim() ? '#3D8BFF' : '#28395C';
                  }
                }}
              >
                {isProcessing ? (currentLanguage === 'he' ? 'מעבד...' : 'Processing...') : t('send')}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Regular layout when messages exist */
        <>
          {/* Info Banner for New Users */}
          {authState === 'welcome' && !isAuthenticated && messages.length <= 2 && (
            <div style={infoBannerStyle}>
              <div style={{ marginTop: '2px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 255, 255, 0.8)" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M9 12h6M12 9v6"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontWeight: '500',
                  marginBottom: '4px',
                  fontSize: '16px',
                  fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  letterSpacing: '-0.3px'
                }}>
                  {t('welcome') + '!'}
                </div>
                <div style={{
                  fontSize: '14px',
                  opacity: 0.9,
                  lineHeight: '1.5',
                  fontFamily: '"Inter", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontWeight: '400',
                  letterSpacing: '0.1px'
                }}>
                  {(() => {
                    // Check if user has already selected an option
                    const lastUserMessage = messages.find(m => m.type === 'user');
                    if (lastUserMessage) {
                      const messageText = lastUserMessage.content.toLowerCase();
                      if (messageText.includes('new practice') || messageText.includes('מרפאה חדשה')) {
                        return t('infoBannerNewPractice');
                      } else if (messageText.includes('login') || messageText.includes('התחבר')) {
                        return t('infoBannerLogin');
                      } else if (messageText.includes('join') || messageText.includes('signup') || messageText.includes('הרשמה')) {
                        return t('infoBannerSignup');
                      }
                    }
                    // Default message if no selection made yet
                    return t('infoBannerMessage');
                  })()}
                </div>
              </div>
            </div>
          )}

          <div style={chatAreaWrapperStyle} className="chat-container" dir={isRTL ? 'rtl' : 'ltr'}>
            <div style={chatAreaStyle}>
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  style={{
                    ...messageStyle(message.type === 'user'),
                    animation: 'fadeInUp 0.3s ease-out',
                    animationDelay: `${index * 0.1}s`,
                    animationFillMode: 'both'
                  }}
                >
                  {/* Show countdown timer above rate limit messages */}
                  {message.isRateLimitError && rateLimitCountdown > 0 && (
                    <div style={{
                      marginBottom: '12px',
                      padding: '12px 16px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: 'rgba(239, 68, 68, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: '#ef4444'
                      }}>
                        {rateLimitCountdown}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', color: '#ef4444', fontWeight: '600' }}>
                          {currentLanguage === 'he' ? 'המתן לפני בקשת קוד חדש' : 'Wait before requesting new code'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#a0a0a0', marginTop: '4px' }}>
                          {currentLanguage === 'he' ? 'הקוד שנשלח עדיין תקף' : 'The code sent is still valid'}
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Render structured data based on displayType, or fallback to markdown */}
                  {message.displayType === 'patientList' && message.displayData?.patients ? (
                    <PatientListViewer
                      patients={message.displayData.patients}
                      language={currentLanguage}
                    />
                  ) : message.displayType === 'categoriesList' && message.functionResult?.exportable ? (
                    <>
                      <ReactMarkdown
                        components={{
                          // Use same markdown styling for the message content
                          h1: ({children}) => (
                            <p style={{color: '#ececf1', fontSize: '1em', margin: '8px 0 4px 0', fontWeight: 500, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'}}><strong>{children}</strong></p>
                          ),
                          p: ({children}) => (
                            <p style={{
                              margin: '3px 0',
                              lineHeight: '1.4',
                              fontSize: '1em',
                              color: '#ececf1',
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                            }}>{children}</p>
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                      <CategoriesListExport
                        categories={message.functionResult.categories}
                        patientName={message.functionResult.patientName}
                        patientId={message.functionResult.patientId}
                      />
                    </>
                  ) : (
                    <ReactMarkdown
                      components={{
                      // Style headers as regular text - no big headlines
                      h1: ({children}) => (
                        <p style={{color: '#ececf1', fontSize: '1em', margin: '8px 0 4px 0', fontWeight: 500, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'}}><strong>{children}</strong></p>
                      ),
                      h2: ({children}) => (
                        <p style={{color: '#ececf1', fontSize: '1em', margin: '6px 0 2px 0', fontWeight: 500, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'}}><strong>{children}:</strong></p>
                      ),
                      h3: ({children}) => (
                        <p style={{color: '#d1d5db', fontSize: '1em', margin: '4px 0 2px 0', fontWeight: 500, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'}}>{children}</p>
                      ),
                      h4: ({children}) => (
                        <p style={{color: '#d1d5db', fontSize: '1em', margin: '2px 0', fontWeight: 400, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'}}>{children}</p>
                      ),
                      // Style strong/bold text - normal size
                      strong: ({children}) => (
                        <strong style={{color: '#ececf1', fontWeight: 600}}>{children}</strong>
                      ),
                      // Style lists with minimal spacing
                      ul: ({children}) => (
                        <ul style={{margin: '2px 0', paddingLeft: '20px', lineHeight: '1.4', fontSize: '1em', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'}}>{children}</ul>
                      ),
                      ol: ({children}) => (
                        <ol style={{margin: '2px 0', paddingLeft: '20px', lineHeight: '1.4', fontSize: '1em', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'}}>{children}</ol>
                      ),
                      // Style list items - minimal
                      li: ({children}) => (
                        <li style={{margin: '1px 0', color: '#d1d5db'}}>{children}</li>
                      ),
                      // Style tables for lab results - readable size
                      table: ({children}) => (
                        <div style={{overflowX: 'auto', margin: '4px 0'}}>
                          <table style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            border: '1px solid #444654',
                            fontSize: '0.95em',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                          }}>{children}</table>
                        </div>
                      ),
                      thead: ({children}) => (
                        <thead style={{background: 'rgba(68, 70, 84, 0.5)'}}>{children}</thead>
                      ),
                      th: ({children}) => (
                        <th style={{
                          padding: '6px 8px',
                          textAlign: 'left',
                          borderBottom: '1px solid #565869',
                          borderRight: '1px solid #444654',
                          color: '#ececf1',
                          fontWeight: 600,
                          fontSize: '0.95em'
                        }}>{children}</th>
                      ),
                      td: ({children}) => (
                        <td style={{
                          padding: '4px 8px',
                          borderBottom: '1px solid #444654',
                          borderRight: '1px solid #444654',
                          color: '#d1d5db',
                          fontSize: '0.95em'
                        }}>{children}</td>
                      ),
                      // Style paragraphs - normal chat text
                      p: ({children}) => (
                        <p style={{
                          margin: '3px 0',
                          lineHeight: '1.4',
                          fontSize: '1em',
                          color: '#ececf1',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                          wordWrap: 'break-word',
                          wordBreak: 'break-word',
                          hyphens: 'auto'
                        }}>{children}</p>
                      ),
                      // Minimal line breaks
                      br: () => (
                        <br style={{lineHeight: '0.3'}} />
                      ),
                      // Style code blocks - smaller
                      code: ({children, inline}) => (
                        <code style={{
                          background: inline ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.3)',
                          padding: inline ? '1px 4px' : '8px',
                          borderRadius: '3px',
                          fontSize: inline ? '0.95em' : '0.95em',
                          display: inline ? 'inline' : 'block',
                          whiteSpace: inline ? 'normal' : 'pre-wrap',
                          overflowX: 'auto',
                          margin: inline ? '0' : '2px 0',
                          color: '#94a3b8'
                        }}>{children}</code>
                      ),
                      // Style horizontal rules - minimal
                      hr: () => (
                        <hr style={{
                          border: 'none',
                          borderTop: '1px solid #444654',
                          margin: '4px 0'
                        }} />
                      ),
                      // Style blockquotes - minimal
                      blockquote: ({children}) => (
                        <blockquote style={{
                          borderLeft: '2px solid #565869',
                          paddingLeft: '10px',
                          marginLeft: '0',
                          margin: '4px 0',
                          color: '#d1d5db',
                          fontStyle: 'italic',
                          fontSize: '1em',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        }}>{children}</blockquote>
                      )
                    }}
                  >
                    {(message.content || '').replace(/\n\n\n+/g, '\n\n')}
                  </ReactMarkdown>
                  )}
                </div>
              ))}
              {isProcessing && (
                <div style={{
                  ...messageStyle(false),
                  background: '#444654',
                  border: 'none',
                  animation: 'pulse 2s infinite'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    color: '#94a3b8'
                  }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      border: '2px solid #565869',
                      borderTop: '2px solid #8b5cf6',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    <span>{t('processing') + '...'}</span>
                  </div>
                </div>
              )}
              {/* OTP Input Component */}
              {showOTP && (
                <div style={{
                  animation: 'fadeInUp 0.3s ease-out',
                  marginTop: '20px'
                }}>
                  <OTPInput
                    email={otpEmail}
                    onComplete={handleVerifyOTP}
                    onResend={handleResendOTP}
                    loading={otpLoading}
                    error={otpError}
                    expiresIn={600}
                  />
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </div>
          
          {/* Input area at bottom with higher position */}
          <div style={inputAreaStyle}>
            <form onSubmit={handleSendMessage} style={formStyle}>
              {/* Hidden decoy field to prevent autofill */}
              <input 
                type="text" 
                name="_decoy" 
                autoComplete="username" 
                aria-hidden="true" 
                tabIndex={-1} 
                style={{ 
                  position: 'absolute', 
                  top: '-9999px', 
                  left: '-9999px', 
                  width: '1px', 
                  height: '1px', 
                  opacity: 0, 
                  pointerEvents: 'none' 
                }} 
              />
              <input
                ref={inputRef}
                className="ica-input"
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={(e) => {
                  e.currentTarget.removeAttribute('readonly');
                }}
                onMouseDown={(e) => {
                  e.currentTarget.removeAttribute('readonly');
                }}
                placeholder={conversationComplete 
                  ? t('checkYourEmail')
                  : t('typeMessage')
                }
                style={inputStyle}
                disabled={conversationComplete || isProcessing}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-autocomplete="none"
                data-lpignore="true"
                data-1p-ignore
                data-bw-ignore
                readOnly
                autoFocus
              />
              
              {/* Send Button */}
              <button 
                type="submit" 
                style={sendButtonStyle}
                disabled={conversationComplete || isProcessing || !inputValue.trim()}
                onMouseEnter={(e) => {
                  if (!isProcessing && inputValue.trim()) {
                    e.target.style.backgroundColor = '#5BA0FF';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isProcessing) {
                    e.target.style.backgroundColor = inputValue.trim() ? '#3D8BFF' : '#28395C';
                  }
                }}
              >
                {isProcessing ? (currentLanguage === 'he' ? 'מעבד...' : 'Processing...') : t('send')}
              </button>
            </form>
          </div>
        </>
      )}
      
      {/* Modern Onboarding Tooltips - Smart workflow tracking */}
      <OnboardingTooltips onSendMessage={handleSendMessage} />
    </div>
  );
};

export default ChatAuthAI;