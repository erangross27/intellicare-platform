import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ChatArea from './components/ChatArea';
import Sidebar from './components/Sidebar';
// Split screen removed - using inline cards instead
import { isLogoutCommand, handleLogout } from './utils/logoutHandler';
import { shouldShowInSplitScreen } from '../../config/functionComponentMap';
import theme from './styles/theme';
import secureApi from '../../services/secureApiClient';
import { useLanguage } from '../../config/languagesStatic';
import secureStorage from '../../utils/secureStorage';
import WorkflowHelper from '../workflow/WorkflowHelper';
import useWorkflowStore from '../../stores/workflowStore';
import workflowSocketService from '../../services/workflowSocketService';
import io from 'socket.io-client';
import SummaryCard from '../SummaryCard';
import CollapsibleSidebar from './CollapsibleSidebar';
import UpcomingAppointments from '../appointments/UpcomingAppointments';
import NotificationCenter from '../notifications/NotificationCenter';
import AccordionSection from '../ui/AccordionSection';
import WorkflowSuggestions from '../sidebar/WorkflowSuggestions';
import { useAppointmentNotifications } from '../../hooks/useAppointmentNotifications';
import { useAuth } from '../../context/AuthContext';
const ChatContainer = ({ 
  apiUrl = '/api',
  practice,  // No default - must be provided by parent
  authToken, // Deprecated - using httpOnly cookies
  language = 'he',
  onSessionChange // Callback when session changes
}) => {
  // Get language from hook for accurate RTL/LTR detection
  const { currentLanguage } = useLanguage();
  const actualLanguage = currentLanguage || language;
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [costInfo, setCostInfo] = useState(null);
  const [totalCosts, setTotalCosts] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Force refresh sidebar
  const [socket, setSocket] = useState(null); // Socket.IO connection
  // Removed split screen states - using inline cards instead
  
  // Sidebar states - Start collapsed for cleaner interface
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null); // Track which section to expand
  const { user } = useAuth();
  
  // Use appointment notifications hook
  const { 
    socket: notificationSocket, 
    notifications, 
    unreadCount,
    requestNotificationPermission 
  } = useAppointmentNotifications();
  
  // Workflow state from Zustand store
  const { isHelperVisible, activeWorkflow } = useWorkflowStore();
  
  // Check if user is a provider/doctor/admin
  const isProvider = user?.roles && (
    user.roles.includes('doctor') ||
    user.roles.includes('doctor_specialist') ||
    user.roles.includes('provider') ||
    user.roles.includes('nurse_rn') ||
    user.roles.includes('nurse_lpn') ||
    user.roles.includes('admin') ||
    user.roles.includes('administrator')
  );
  
  // Debug logging
  useEffect(() => {
    console.log('🔍 ChatContainer - User Debug:', {
      user: user,
      roles: user?.roles,
      isProvider: isProvider,
      providerId: user?.providerInfo?.providerId,
      email: user?.email
    });
  }, [user]);
  
  // Request notification permission on mount for providers
  useEffect(() => {
    if (isProvider) {
      requestNotificationPermission();
    }
  }, [isProvider]);
  
  // Generate user-specific session ID
  const generateSessionId = useCallback(() => {
    // Use practice subdomain for user isolation since we're using cookie auth
    const userIdentifier = practice || 'default';
    return `session_${userIdentifier}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, [practice]);
  
  // Fetch total costs from backend
  const fetchTotalCosts = useCallback(async () => {
    try {
      const response = await secureApi.get('/agent/total-costs');
      if (response && response.data) {
        setTotalCosts(response.data);
      }
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Error fetching total costs:', error);
    }
  }, []);
  
  // Get user-specific storage key to isolate data between users
  const getUserStorageKey = useCallback((key) => {
    // Use practice for isolation since we're using cookie auth
    const userIdentifier = practice || 'default';
    return `${userIdentifier}_${key}`;
  }, [practice]);
  
  // Update session title in database
  const updateSessionTitleInDatabase = async (sessionId, title) => {
    try {
      const response = await secureApi.put(`/api/chat/sessions/${sessionId}/title`, { title });
      
      if (!response || response.error) {
        process.env.NODE_ENV !== 'production' && console.error('Failed to update session title in database');
      } else {
        process.env.NODE_ENV !== 'production' && console.log('✅ Updated session title in database:', title);
      }
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Error updating session title:', error);
    }
  };
  
  // Intelligently update session title based on conversation content with real-time updates
  const updateSessionTitle = useCallback(async (userMsg, agentResponse, sessionId, isFirstMessage = false) => {
    try {
      // Prevent duplicate title updates - check if we're already updating
      const updateKey = `updating_title_${sessionId}`;
      if (window[updateKey]) {
        process.env.NODE_ENV !== 'production' && console.log('📝 Skipping duplicate title update for:', sessionId);
        return;
      }
      window[updateKey] = true;
      
      process.env.NODE_ENV !== 'production' && console.log('📝 Updating session title for:', sessionId, 'User msg:', userMsg.substring(0, 50));
      const sessions = JSON.parse(secureStorage.getItem(getUserStorageKey('chat_sessions')) || '[]');
      let session = sessions.find(s => s.id === sessionId);
      process.env.NODE_ENV !== 'production' && console.log('📝 Found session:', !!session, 'Total sessions:', sessions.length);
      
      // Skip pure greetings that are too short
      const greetings = [
        /^(שלום|בוקר טוב|ערב טוב|היי|הי|hello|hi|hey|good morning|good evening)[\.!\?\s]*$/i
      ];

      const userMsgLower = userMsg.toLowerCase().trim();
      const isGreeting = greetings.some(pattern => pattern.test(userMsgLower)) && userMsgLower.length < 15;

      // Simplified title extraction - focus on user's first meaningful message
      let title = '';
      const isHebrew = actualLanguage === 'he';

      // SIMPLIFIED: Extract title from user message, not AI response
      if (userMsg && userMsg.length > 10 && !isGreeting) {
        // Remove common prefixes
        let cleanMsg = userMsg
          .replace(/^(אני רוצה|I want|I need|Please|בבקשה|תוכל|can you|could you|help me|עזור לי)/gi, '')
          .replace(/^(to|ל|את|the|a|an)/gi, '')
          .trim();

        // Look for key action words and create focused titles
        const actionPatterns = [
          { pattern: /(?:add|create|new|הוסף|צור|חדש).*?(?:patient|מטופל)/i, prefix: isHebrew ? 'מטופל חדש' : 'New Patient' },
          { pattern: /(?:schedule|book|קבע|הזמן).*?(?:appointment|meeting|תור|פגישה)/i, prefix: isHebrew ? 'קביעת תור' : 'Schedule Appointment' },
          { pattern: /(?:search|find|look|חפש|מצא).*?(?:patient|record|מטופל|רשומה)/i, prefix: isHebrew ? 'חיפוש' : 'Search' },
          { pattern: /(?:update|edit|modify|עדכן|ערוך|שנה)/i, prefix: isHebrew ? 'עדכון' : 'Update' },
          { pattern: /(?:prescription|medication|drug|מרשם|תרופה)/i, prefix: isHebrew ? 'מרשם' : 'Prescription' },
          { pattern: /(?:diagnos|symptom|אבחנה|סימפטום|תסמין)/i, prefix: isHebrew ? 'אבחנה' : 'Diagnosis' },
          { pattern: /(?:document|file|image|מסמך|קובץ|תמונה)/i, prefix: isHebrew ? 'מסמך' : 'Document' },
          { pattern: /(?:practice|practice|מרפאה)/i, prefix: isHebrew ? 'מרפאה' : 'Practice' },
          { pattern: /(?:test|lab|בדיקה|מעבדה)/i, prefix: isHebrew ? 'בדיקות' : 'Tests' },
          { pattern: /(?:report|summary|דוח|סיכום)/i, prefix: isHebrew ? 'דוח' : 'Report' }
        ];

        // Check each pattern
        for (const { pattern, prefix } of actionPatterns) {
          if (pattern.test(userMsg)) {
            const match = userMsg.match(pattern);
            if (match) {
              const afterMatch = userMsg.substring(match.index + match[0].length).trim();
              // Get the next 2-4 meaningful words after the action
              const nextWords = afterMatch
                .split(/\s+/)
                .filter(word => word.length > 2)
                .slice(0, 3)
                .join(' ');

              if (nextWords.length > 3) {
                title = `${prefix}: ${nextWords.substring(0, 30)}`;
              } else {
                title = prefix;
              }
              break;
            }
          }
        }

        // If no pattern matched, use the cleaned message intelligently
        if (!title) {
          // Remove question marks and clean up
          cleanMsg = cleanMsg.replace(/[?؟]/g, '').trim();

          // Take first 40 characters or until first punctuation
          const firstPart = cleanMsg.match(/^[^.!,;]+/);
          if (firstPart && firstPart[0].length > 10) {
            title = firstPart[0].substring(0, 40).trim();
          } else if (cleanMsg.length > 10) {
            title = cleanMsg.substring(0, 40).trim();
          }
        }
      }

      // If we still don't have a title and it's the first message, use a smart default
      if (!title && isFirstMessage && !isGreeting) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString(isHebrew ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit' });
        title = isHebrew ? `שיחה ${timeStr}` : `Chat ${timeStr}`;
      }

      // Skip complex AI response analysis - we already have title from user message
      // Only use AI response if we completely failed to get title from user message
      if (!title && !isGreeting && agentResponse && agentResponse.length > 30) {
        const lines = agentResponse.split('\n').filter(line => line.trim());
        
        // Enhanced patterns for Claude's medical responses
        const extractPatterns = {
          // Patient information - Enhanced patterns
          patientAdded: /(?:הוספתי|Added|Created|רשמתי|I've added|Successfully added).*?(?:מטופל|patient).*?(?:בשם|named?|called)\s+([^\n,\.]+)/i,
          patientName: /(?:שם.*?מטופל|Patient\s+Name|המטופל|Patient|Treating):\s*([^\n,]+)/i,
          patientUpdate: /(?:עדכנתי|Updated|Modified|I've updated).*?(?:את|the)\s+(?:פרטי|details|information).*?([^\n]+)/i,
          patientConsult: /(?:Consultation with|Meeting with|Examining)\s+([^\n,]+)/i,
          
          // Medical conditions - Enhanced for Claude responses
          diagnosis: /(?:אבחנה|Diagnosis|diagnosed with|Assessment|Clinical finding):\s*([^\n]+)/i,
          symptoms: /(?:תסמינים|Symptoms?|complaining of|presenting with|reports):\s*([^\n]+)/i,
          treatment: /(?:טיפול|Treatment|prescribed|Recommendation|Plan):\s*([^\n]+)/i,
          chiefComplaint: /(?:Chief complaint|Main concern|Primary issue):\s*([^\n]+)/i,
          
          // Medical procedures and tests
          procedure: /(?:Procedure|Surgery|Operation|performed):\s*([^\n]+)/i,
          bloodTest: /(?:Blood test|Lab work|CBC|Blood panel).*?(?:for|results|ordered)\s*([^\n]+)?/i,
          imaging: /(?:X-ray|MRI|CT scan|Ultrasound|Imaging).*?(?:for|of|shows)\s*([^\n]+)?/i,
          
          // Actions - Enhanced patterns
          appointment: /(?:קבעתי|Scheduled|Set|Booked|I've scheduled).*?(?:תור|appointment|visit).*?(?:ל|for|with)\s*([^\n]+)/i,
          prescription: /(?:רשמתי|Prescribed|מרשם|Medication|I've prescribed).*?(?:עבור|for|to)\s*([^\n]+)/i,
          labResults: /(?:תוצאות|Results?|Lab results|Test results).*?(?:בדיקה|lab|test).*?(?:של|for|show)\s*([^\n]+)/i,
          referral: /(?:Referral|Referred|Referring).*?(?:to|for)\s*([^\n]+)/i,
          
          // Search/Query - Enhanced
          searchResult: /(?:מצאתי|Found|Located|Retrieved)\s+(\d+)\s+(?:מטופלים|patients?|records?)/i,
          patientInfo: /(?:פרטי|Information|Details|Records?).*?(?:מטופל|patient|about):\s*([^\n]+)/i,
          
          // IntelliCare specific patterns
          documentAnalysis: /(?:Document analysis|Analyzing document|Processing).*?(?:for|about)\s*([^\n]+)/i,
          practiceRegistration: /(?:Practice registration|New practice|Registering).*?(?:for|named)\s*([^\n]+)/i
        };
        
        // Try each pattern
        for (const [key, pattern] of Object.entries(extractPatterns)) {
          const match = agentResponse.match(pattern);
          if (match) {
            const extracted = match[1].trim();
            
            // Format based on type - bilingual support
            const isHebrew = actualLanguage === 'he';
            switch(key) {
              case 'patientAdded':
                title = isHebrew ? `מטופל חדש: ${extracted.substring(0, 30)}` : `New Patient: ${extracted.substring(0, 30)}`;
                break;
              case 'patientName':
              case 'patientConsult':
                // Look for additional context
                const symptomMatch = agentResponse.match(/(?:תלונה|complaint|symptom|presenting):\s*([^\n]+)/i);
                if (symptomMatch) {
                  title = `${extracted.substring(0, 25)} - ${symptomMatch[1].substring(0, 20)}`;
                } else {
                  title = isHebrew ? `מטופל: ${extracted}` : `Patient: ${extracted}`;
                }
                break;
              case 'diagnosis':
                const patientForDiagnosis = agentResponse.match(/(?:עבור|for|Patient:)\s+([^\n,]+)/i);
                if (patientForDiagnosis) {
                  title = isHebrew ? 
                    `אבחנה: ${patientForDiagnosis[1].substring(0, 20)} - ${extracted.substring(0, 20)}` :
                    `Diagnosis: ${patientForDiagnosis[1].substring(0, 20)} - ${extracted.substring(0, 20)}`;
                } else {
                  title = isHebrew ? `אבחנה: ${extracted.substring(0, 40)}` : `Diagnosis: ${extracted.substring(0, 40)}`;
                }
                break;
              case 'chiefComplaint':
                title = isHebrew ? `תלונה: ${extracted.substring(0, 40)}` : `Complaint: ${extracted.substring(0, 40)}`;
                break;
              case 'appointment':
                title = isHebrew ? `תור: ${extracted.substring(0, 40)}` : `Appointment: ${extracted.substring(0, 35)}`;
                break;
              case 'prescription':
                title = isHebrew ? `מרשם: ${extracted.substring(0, 40)}` : `Prescription: ${extracted.substring(0, 35)}`;
                break;
              case 'procedure':
                title = isHebrew ? `פרוצדורה: ${extracted.substring(0, 35)}` : `Procedure: ${extracted.substring(0, 35)}`;
                break;
              case 'bloodTest':
                title = isHebrew ? `בדיקת דם${extracted ? ': ' + extracted.substring(0, 30) : ''}` : `Blood Test${extracted ? ': ' + extracted.substring(0, 30) : ''}`;
                break;
              case 'imaging':
                title = isHebrew ? `הדמיה${extracted ? ': ' + extracted.substring(0, 35) : ''}` : `Imaging${extracted ? ': ' + extracted.substring(0, 35) : ''}`;
                break;
              case 'searchResult':
                title = isHebrew ? `חיפוש: ${match[0].substring(0, 40)}` : `Search: ${match[0].substring(0, 40)}`;
                break;
              case 'labResults':
                title = isHebrew ? `תוצאות בדיקה: ${extracted.substring(0, 30)}` : `Lab Results: ${extracted.substring(0, 30)}`;
                break;
              case 'referral':
                title = isHebrew ? `הפניה: ${extracted.substring(0, 35)}` : `Referral: ${extracted.substring(0, 35)}`;
                break;
              case 'documentAnalysis':
                title = isHebrew ? `ניתוח מסמך: ${extracted.substring(0, 30)}` : `Document: ${extracted.substring(0, 35)}`;
                break;
              case 'practiceRegistration':
                title = isHebrew ? `רישום מרפאה: ${extracted.substring(0, 30)}` : `Practice: ${extracted.substring(0, 35)}`;
                break;
              default:
                title = extracted.substring(0, 50);
            }
            
            if (title) break;
          }
        }
        
        // If no pattern matched, try to extract the main action or subject
        if (!title) {
          // Look for action verbs at the beginning of sentences
          const actionLine = lines.find(line => {
            const trimmed = line.trim();
            return trimmed.length > 15 && 
              (trimmed.match(/^(הוספתי|עדכנתי|מצאתי|קבעתי|רשמתי|יצרתי|Added|Updated|Found|Created|Scheduled)/i) ||
               trimmed.match(/^(Patient|מטופל|Appointment|תור|Prescription|מרשם|Diagnosis|אבחנה)/i));
          });
          
          if (actionLine) {
            // Clean and format
            title = actionLine
              .replace(/^[-•*▪]\s*/, '')
              .replace(/\*\*/g, '')
              .replace(/^\d+\.\s*/, '')
              .trim()
              .substring(0, 50);
          }
        }
      }
      
      // Fallback: Smart extraction from user message
      if (!title && userMsg.length > 20) {
        // Remove common prefixes
        let cleanMsg = userMsg
          .replace(/^(אני רוצה|I want|I need|Please|בבקשה|תוכל|can you|could you)/i, '')
          .trim();
        
        // Look for key actions
        const actionWords = {
          'add patient': 'New Patient',
          'הוסף מטופל': 'מטופל חדש',
          'update': 'Update',
          'עדכן': 'עדכון',
          'search': 'Search',
          'חפש': 'חיפוש',
          'appointment': 'Appointment',
          'תור': 'תור',
          'prescription': 'Prescription',
          'מרשם': 'מרשם'
        };
        
        for (const [key, value] of Object.entries(actionWords)) {
          if (userMsgLower.includes(key)) {
            // Extract the object of the action
            const afterAction = cleanMsg.substring(cleanMsg.toLowerCase().indexOf(key) + key.length).trim();
            if (afterAction.length > 5) {
              title = `${value}: ${afterAction.substring(0, 30)}`;
            } else {
              title = value;
            }
            break;
          }
        }
        
        // If still no title, use cleaned message
        if (!title && cleanMsg.length > 10) {
          title = cleanMsg.substring(0, 40);
        }
      }
      
      // Log extracted title
      if (title) {
        process.env.NODE_ENV !== 'production' && console.log('📝 Extracted title:', title);
      } else if (!isGreeting) {
        process.env.NODE_ENV !== 'production' && console.log('📝 No title extracted from response');
      }
      
      // Only update if session exists - don't create new sessions here
      if (session && title && title.length > 5) {
        // Sanitize title to ensure it's always a string
        let sanitizedTitle = String(title).replace(/[*_]/g, '').trim();
        if (sanitizedTitle.length > 50) {
          sanitizedTitle = sanitizedTitle.substring(0, 47) + '...';
        }

        // Final validation - ensure no objects slip through
        if (sanitizedTitle === '[object Object]' || sanitizedTitle === 'undefined' || !sanitizedTitle) {
          sanitizedTitle = actualLanguage === 'he' ? 'שיחה חדשה' : 'New Chat';
        }

        // Only update if new title is better
        if (!session.title ||
            session.title === 'שיחה חדשה' ||
            session.title === 'New Chat' ||
            session.title.startsWith('New Chat') ||
            session.title === '[object Object]' ||
            (sanitizedTitle.length > 10 && session.title.length < 15)) {
          process.env.NODE_ENV !== 'production' && console.log('📝 Updating session title from:', session.title, 'to:', sanitizedTitle);

          // Update the session object in the array
          const sessionIndex = sessions.findIndex(s => s.id === sessionId);
          if (sessionIndex !== -1) {
            sessions[sessionIndex].title = sanitizedTitle;
            sessions[sessionIndex].lastActive = new Date().toISOString();
          }

          setSessionTitle(sanitizedTitle);
          // Update title in database
          await updateSessionTitleInDatabase(sessionId, sanitizedTitle);
        } else {
          process.env.NODE_ENV !== 'production' && console.log('📝 Keeping existing title:', session.title);
          // Still update lastActive
          const sessionIndex = sessions.findIndex(s => s.id === sessionId);
          if (sessionIndex !== -1) {
            sessions[sessionIndex].lastActive = new Date().toISOString();
          }
        }
      }

      // Always save the updated sessions array to ensure changes persist
      const limited = sessions.slice(0, 20);
      secureStorage.setItem(getUserStorageKey('chat_sessions'), JSON.stringify(limited));
      
      // ALWAYS trigger refresh when we update a title to ensure real-time updates
      // This is critical for the sidebar to update without requiring a page refresh
      if (session && title) {
        process.env.NODE_ENV !== 'production' && console.log('📝 Triggering sidebar refresh for title update');
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (err) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to update session title:', err);
    } finally {
      // Clear the update flag after a delay
      const updateKey = `updating_title_${sessionId}`;
      setTimeout(() => {
        delete window[updateKey];
      }, 1000);
    }
  }, [actualLanguage, getUserStorageKey, updateSessionTitleInDatabase]);
  
  // Initialize session - ALWAYS start fresh on new login
  useEffect(() => {
    // Check if this is a fresh login
    const isNewLogin = !secureStorage.getItem('chat_initialized');
    
    if (isNewLogin) {
      // Fresh login - start completely new session, no restoration
      process.env.NODE_ENV !== 'production' && console.log('🔄 New login detected - starting fresh chat session');
      const newId = generateSessionId();
      setSessionId(newId);
      secureStorage.setItem(getUserStorageKey('current_session_id'), newId);
      setMessages([]);
      setCostInfo(null);
      
      // Notify parent component of initial session
      if (onSessionChange) {
        onSessionChange(newId);
      }
      
      // Fetch initial total costs
      fetchTotalCosts();
      
      // Mark that chat has been initialized for this browser session
      secureStorage.setItem('chat_initialized', 'true');
      
      // Clean up old sessions from other users
      const keysToRemove = [];
      // Note: SecureStorage handles user-specific storage internally, 
      // so we don't need to iterate through localStorage directly
      // This cleanup is now handled by secureStorage service
      keysToRemove.forEach(key => secureStorage.removeItem(key));
    } else {
      // Same browser session - can restore previous conversation
      const storedSessionId = secureStorage.getItem(getUserStorageKey('current_session_id'));
      if (storedSessionId) {
        setSessionId(storedSessionId);
        loadMessages(storedSessionId);
        
        // Notify parent component of restored session
        if (onSessionChange) {
          onSessionChange(storedSessionId);
        }
        
        // Restore cost info for this session
        const storedCost = secureStorage.getItem(getUserStorageKey(`cost_${storedSessionId}`));
        if (storedCost) {
          try {
            setCostInfo(JSON.parse(storedCost));
          } catch (e) {
            process.env.NODE_ENV !== 'production' && console.error('Failed to restore cost info:', e);
          }
        }
      } else {
        const newId = generateSessionId();
        setSessionId(newId);
        secureStorage.setItem(getUserStorageKey('current_session_id'), newId);
        
        // Notify parent component of new session
        if (onSessionChange) {
          onSessionChange(newId);
        }
      }
      
      // Always fetch total costs on initialization
      fetchTotalCosts();
    }
  }, [generateSessionId, getUserStorageKey, fetchTotalCosts]);
  
  // Initialize Socket.IO connection for real-time notifications
  useEffect(() => {
    if (!sessionId) return;
    
    // Connect to Socket.IO server
    const newSocket = io(window.location.origin, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
    
    // Join session-specific room
    newSocket.on('connect', () => {
      console.log('🔌 Connected to WebSocket');
      newSocket.emit('join_session', sessionId);
    });
    
    // Listen for batch completion summaries
    newSocket.on('batch_summary', (summary) => {
      console.log('📊 Received batch summary:', summary);
      
      // Check if it's for this session
      if (summary.sessionId === sessionId) {
        // Add summary card to messages for current session
        const summaryMessage = {
          id: `summary_${summary.batchId}`,
          sender: 'system',
          type: 'batch_summary',
          content: summary,
          timestamp: new Date(summary.timestamp)
        };
        
        setMessages(prev => [...prev, summaryMessage]);
      } else {
        // Show toast notification for other sessions
        const toastEvent = new CustomEvent('batch_complete_notification', {
          detail: {
            type: 'success',
            title: 'Document Analysis Complete',
            message: `${summary.successCount} of ${summary.fileCount} documents processed`,
            fileCount: summary.fileCount,
            successCount: summary.successCount,
            sessionId: summary.sessionId,
            batchId: summary.batchId
          }
        });
        window.dispatchEvent(toastEvent);
      }
    });
    
    // Listen for general batch completions (for notification center)
    newSocket.on('batch_complete', (data) => {
      console.log('📢 Batch complete notification:', data);
      // Open right sidebar to show notification
      setRightSidebarOpen(true);
      // Expand notifications section
      setExpandedSection('notifications');
      // This will be handled by the notification center component
    });
    
    setSocket(newSocket);
    
    // Cleanup on unmount or session change
    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [sessionId]);
  
  // Load messages for a session
  const loadMessages = async (sessionId) => {
    try {
      // Try to load from database first
      try {
        process.env.NODE_ENV !== 'production' && console.log('🔍 Loading messages with:', {
          url: `${apiUrl}/chat/sessions/${sessionId}/messages`,
          usingCookieAuth: true,
          practice: practice
        });
        
        const response = await secureApi.get(`/api/chat/sessions/${sessionId}/messages`);
        
        if (response.error) {
          // Handle 404 specifically - session doesn't exist yet
          if (response.status === 404) {
            process.env.NODE_ENV !== 'production' && console.log('📝 Session not found, will be created on first message');
            // Don't treat as error, just use empty messages
            setMessages([]);
            return;
          }
          
          process.env.NODE_ENV !== 'production' && console.error('❌ Failed to load messages:', {
            status: response.status,
            statusText: response.statusText,
            url: response.url
          });
        }
        
        if (!response.error) {
          const data = response; // secureApi returns parsed data
          if (data.success && data.data) {
            const messages = data.data.messages.map(msg => ({
              id: msg.messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              type: msg.type,
              content: msg.content,
              timestamp: msg.createdAt,
              functionCall: msg.actionTaken ? { name: msg.actionTaken } : null,
              functionResult: msg.actionResult
            }));
            
            setMessages(messages);
            setSessionTitle(data.data.sessionTitle);
            
            // Save to localStorage for offline access
            secureStorage.setItem(getUserStorageKey(`messages_${sessionId}`), JSON.stringify(messages));
            return;
          }
        }
      } catch (error) {
        // Completely silent for 404 errors - this is expected for new sessions
        if (!error.message?.includes('404') && error.status !== 404 && !error.message?.includes('session not found')) {
          process.env.NODE_ENV !== 'production' && console.error('Failed to load messages from database:', error);
        }
      }
      
      // Fallback to localStorage
      const storedMessages = secureStorage.getItem(getUserStorageKey(`messages_${sessionId}`));
      if (storedMessages) {
        const parsed = JSON.parse(storedMessages);
        setMessages(parsed);
        
        // Set title from first message if available
        if (parsed.length > 0) {
          const firstUserMsg = parsed.find(m => m.type === 'user');
          if (firstUserMsg) {
            setSessionTitle(firstUserMsg.content.substring(0, 50));
          }
        }
      }
    } catch (err) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to load messages:', err);
    }
  };
  
  // Save messages to localStorage
  const saveMessages = useCallback((messages, sessionId) => {
    try {
      secureStorage.setItem(getUserStorageKey(`messages_${sessionId}`), JSON.stringify(messages));
    } catch (err) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to save messages:', err);
    }
  }, []);
  
  // Get last agent message for password detection
  const lastAgentMessage = useMemo(() => {
    const agentMessages = messages.filter(m => m.type === 'agent');
    return agentMessages.length > 0 ? 
      agentMessages[agentMessages.length - 1].content : null;
  }, [messages]);
  
  // Create or ensure session exists in database
  const ensureSessionInDatabase = async (sessionId, title = null) => {
    try {
      // Prevent duplicate session creation - check if we're already creating
      const createKey = `creating_session_${sessionId}`;
      if (window[createKey]) {
        console.log('📝 Skipping duplicate session creation for:', sessionId);
        return;
      }
      window[createKey] = true;
      
      console.log('📝 Ensuring session exists in database:', sessionId);
      
      // Sanitize title to prevent object titles
      let sanitizedTitle = title;
      if (title && typeof title === 'object') {
        sanitizedTitle = title[actualLanguage] || title.en || title.he || 
                        (actualLanguage === 'he' ? 'שיחה חדשה' : 'New Chat');
      }
      sanitizedTitle = String(sanitizedTitle || (actualLanguage === 'he' ? 'שיחה חדשה' : 'New Chat')).trim();
      if (!sanitizedTitle || sanitizedTitle === '[object Object]' || sanitizedTitle === 'undefined') {
        sanitizedTitle = actualLanguage === 'he' ? 'שיחה חדשה' : 'New Chat';
      }
      
      // Try to create the session - the backend will handle if it already exists
      const createResponse = await secureApi.post('/api/chat/sessions', {
          sessionId: sessionId,
          title: sanitizedTitle,
          language: actualLanguage
      });
      
      if (createResponse.error) {
        // Log ALL errors to understand what's happening
        console.error('❌ Failed to create session in database:', {
          sessionId,
          error: createResponse.error,
          status: createResponse.status,
          message: createResponse.message
        });
        // Don't pretend it succeeded - return early
        return;
      } else if (createResponse.success) {
        console.log('✅ Session actually created/confirmed in database:', sessionId, 'Created:', createResponse.data?.created);
        
        // Only trigger refresh if this is a truly new session (backend returned created=true)
        // Let SessionManager handle all localStorage management to prevent duplicates
        if (createResponse.data?.created === true) {
          // Just trigger sidebar refresh - SessionManager will handle localStorage
          setRefreshTrigger(prev => prev + 1);
          console.log('📝 New session created in database, triggered sidebar refresh');
        } else {
          console.log('📝 Session already existed in database');
        }
      }
    } catch (error) {
      // Check if it's a 409 conflict (session already exists) - that's ok
      if (error.status !== 409) {
        console.error('Error ensuring session in database:', error);
      }
    } finally {
      // Clear the creation flag after a delay
      const createKey = `creating_session_${sessionId}`;
      setTimeout(() => {
        delete window[createKey];
      }, 1000);
    }
  };
  
  // Send message to backend with optional files
  const sendMessage = async (actualMessage, displayMessage, isPassword, files = []) => {
    process.env.NODE_ENV !== 'production' && console.log('📥 ChatContainer received:', {
      message: actualMessage,
      hasFiles: files && files.length > 0,
      filesCount: files ? files.length : 0,
      fileNames: files ? files.map(f => f.name) : []
    });
    
    if (!actualMessage.trim() || isLoading) return;
    
    // Check for logout command
    if (isLogoutCommand(actualMessage)) {
      handleLogout();
      return;
    }
    
    // Add user message to display IMMEDIATELY - use the display message that includes file info
    const userMessage = {
      id: `msg_${Date.now()}`,
      type: 'user',
      content: displayMessage, // This includes the file attachment info
      originalContent: isPassword ? actualMessage : undefined,
      timestamp: new Date().toISOString(),
      isMasked: isPassword,
      hasFiles: files && files.length > 0,
      fileCount: files ? files.length : 0
    };
    
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    saveMessages(newMessages, sessionId);
    
    // Show loading state immediately
    setIsLoading(true);
    
    // Do session creation and title update in parallel with message sending
    const sessionPromise = ensureSessionInDatabase(sessionId, sessionTitle || null);
    
    // For first message, ensure session is in the list and update title
    const isFirstMessage = messages.filter(m => m.type === 'user').length === 0;
    if (isFirstMessage) {
      // Prevent duplicate session creation by checking session creation lock
      const createKey = `creating_session_${sessionId}`;
      if (!window[createKey]) {
        // First ensure the session exists in the list
        const sessions = JSON.parse(secureStorage.getItem(getUserStorageKey('chat_sessions')) || '[]');
        const sessionExists = sessions.find(s => s.id === sessionId);
        
        if (!sessionExists) {
          // Check one more time if we already added it (prevent race condition)
          const existingIndex = sessions.findIndex(s => s.id === sessionId);
          if (existingIndex === -1) {
            // Add new session to the list first - ONLY add to localStorage here, let database handle itself
            const newSession = {
              id: sessionId,
              title: actualLanguage === 'he' ? 'שיחה חדשה' : 'New Chat',
              timestamp: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              lastActive: new Date().toISOString()
            };
            sessions.unshift(newSession);
            secureStorage.setItem(getUserStorageKey('chat_sessions'), JSON.stringify(sessions.slice(0, 20)));
            // Don't trigger refresh here - let database creation handle it
            console.log('📝 Added new session to localStorage for immediate display');
          }
        }
      }
      
      // Then update title from user message (with delay to prevent race condition)
      setTimeout(() => {
        updateSessionTitle(actualMessage, '', sessionId, true);
      }, 100);
    }
    
    // Debug authentication
    process.env.NODE_ENV !== 'production' && console.log('🔍 Sending chat request:', {
      url: `/api/agent/chat`,
      usingCookieAuth: true,
      practice: practice
    });
    
    try {
      let response;
      
      // If we have files, upload them first
      if (files && files.length > 0) {
        const formData = new FormData();
        
        // Add files to form data - backend expects 'files' field name
        files.forEach((file, index) => {
          formData.append('files', file);
        });
        
        // Add message and session info
        formData.append('message', actualMessage);
        formData.append('sessionId', sessionId);
        formData.append('language', language);
        formData.append('practice', practice);
        
        // Always use single upload endpoint with multipart for actual files
        // The batch endpoint expects base64 encoded JSON, not multipart
        const uploadEndpoint = `/api/agent/upload-document`;
        
        // Upload documents first
        // IMPORTANT: Don't set Content-Type header - browser will set it with boundary
        const uploadResponse = await secureApi.post(uploadEndpoint, formData);
        
        if (uploadResponse.error) {
          throw new Error(`Upload failed: ${uploadResponse.error.message || 'Unknown error'}`);
        }
        
        const uploadResult = uploadResponse; // secureApi returns parsed data
        process.env.NODE_ENV !== 'production' && console.log('📎 Files uploaded:', uploadResult);
        
        // Check if documents were auto-assigned to a patient
        let enhancedMessage = actualMessage;
        
        // If documents were successfully uploaded and assigned
        if (uploadResult.uploadContext?.processed && uploadResult.uploadContext?.results) {
          const docIds = uploadResult.uploadContext.results
            .filter(r => r.success && r.documentId)
            .map(r => r.documentId);
          
          if (docIds.length > 0) {
            // Add document IDs to the message for the agent to process
            enhancedMessage = actualMessage + `\n[DOCUMENT_IDS: ${docIds.join(', ')}]`;
          }
        }
        
        // Skip the upload notification - let the agent handle the response
        // This prevents duplicate messages about the upload
        // if (uploadResult.chatMessage) {
        //   // Commented out to prevent duplicate messages
        // }
        
        // Send the user's message to the agent
        response = await secureApi.post('/api/agent/chat', {
            message: enhancedMessage,
            sessionId: sessionId,
            language: language,
            practice: practice,
            uploadInfo: {
              uploadId: uploadResult.uploadId,
              fileCount: uploadResult.fileCount,
              processed: uploadResult.uploadContext?.processed || false
            }
        });
      } else {
        // No files - try streaming first, fall back to regular POST
        const supportsStreaming = typeof EventSource !== 'undefined';

        if (supportsStreaming) {
          // Use Server-Sent Events for streaming response
          response = await new Promise((resolve, reject) => {
            // Build URL with query parameters for GET request
            const params = new URLSearchParams({
              message: actualMessage,
              sessionId: sessionId,
              language: language,
              practice: practice
            });

            const eventSource = new EventSource(`/api/agent/chat-stream?${params}`);
            let responseData = {};
            let currentMessage = '';
            let streamMessageId = `msg_${Date.now()}_stream`;
            let firstChunkReceived = false;

            eventSource.onmessage = (event) => {
              if (event.data === '[DONE]') {
                eventSource.close();
                resolve(responseData);
                return;
              }

              try {
                const chunk = JSON.parse(event.data);

                if (chunk.type === 'start') {
                  console.log('🔄 Stream started');
                } else if (chunk.type === 'chunk') {
                  // First chunk - add agent message immediately
                  if (!firstChunkReceived) {
                    firstChunkReceived = true;
                    setIsLoading(false); // Stop loading state

                    // Add initial agent message with first chunk
                    setMessages(prev => [...prev, {
                      id: streamMessageId,
                      sender: 'agent',
                      content: chunk.content,
                      timestamp: new Date().toISOString()
                    }]);
                  } else {
                    // Update existing message with new content
                    currentMessage = chunk.content;
                    setMessages(prev => prev.map(msg =>
                      msg.id === streamMessageId
                        ? { ...msg, content: currentMessage }
                        : msg
                    ));
                  }
                } else if (chunk.type === 'complete') {
                  // Final update with complete data
                  responseData = {
                    data: {
                      message: chunk.content,
                      actionTaken: chunk.actionTaken,
                      actionResult: chunk.actionResult,
                      selectedFunctions: chunk.selectedFunctions,
                      costInfo: chunk.costInfo
                    },
                    success: chunk.success
                  };

                  // Update final message
                  setMessages(prev => prev.map(msg =>
                    msg.id === streamMessageId
                      ? { ...msg, content: chunk.content }
                      : msg
                  ));
                } else if (chunk.type === 'error') {
                  throw new Error(chunk.message);
                }
              } catch (error) {
                console.error('Error parsing SSE chunk:', error);
              }
            };

            eventSource.onerror = (error) => {
              eventSource.close();
              console.warn('SSE connection error, falling back to regular POST');

              // Fall back to regular POST request
              secureApi.post('/api/agent/chat', {
                message: actualMessage,
                sessionId: sessionId,
                language: language,
                practice: practice
              }).then(resolve).catch(reject);
            };
          });
        } else {
          // Fallback to regular POST if EventSource not supported
          response = await secureApi.post('/api/agent/chat', {
              message: actualMessage,
              sessionId: sessionId,
              language: language,
              practice: practice
          });
        }
      }
      
      if (response.error) {
        throw new Error(`Server error: ${response.error.message || 'Unknown error'}`);
      }
      
      const data = response; // secureApi returns parsed data
      
      // Debug the response
      process.env.NODE_ENV !== 'production' && console.log('🔍 Agent response received:', data);
      
      // Extract the message from the nested data structure
      // Handle translation objects from backend
      const extractMessage = (msg) => {
        if (typeof msg === 'object' && msg !== null && ('he' in msg || 'en' in msg)) {
          // It's a translation object, select based on current language
          return msg[language] || msg.en || msg.he || 'No response';
        }
        return msg;
      };
      
      const responseContent = extractMessage(data.data?.message) || 
                             extractMessage(data.message) || 
                             extractMessage(data.response) || 
                             extractMessage(data.text) || 
                             'No response';
      
      // Detect function calls in the response
      let functionCall = null;
      let functionResult = null;
      
      // Check for function call information in response
      if (data.data?.actionTaken) {
        functionCall = {
          name: data.data.actionTaken,
          args: data.data.actionArgs || data.data.metadata?.functionArgs
        };
        functionResult = data.data.actionResult || data.data.metadata?.functionResult;
      } else if (data.data?.functionCall) {
        functionCall = data.data.functionCall;
        functionResult = data.data.functionResult;
      } else if (data.data?.metadata?.functionName) {
        functionCall = {
          name: data.data.metadata.functionName,
          args: data.data.metadata.functionArgs
        };
        functionResult = data.data.metadata.functionResult;
      }
      
      // Store function data directly in the message for inline display
      // No more split screen - cards will appear inline in chat
      
      // Parse function information from message content if present
      if (!functionCall && responseContent.includes('[FUNCTION:')) {
        const functionMatch = responseContent.match(/\[FUNCTION:(\w+)\]/);;
        if (functionMatch) {
          functionCall = { name: functionMatch[1] };
          // Try to extract result from message
          const resultMatch = responseContent.match(/\[RESULT:(.+?)\]/s);
          if (resultMatch) {
            try {
              functionResult = JSON.parse(resultMatch[1]);
            } catch (e) {
              functionResult = resultMatch[1];
            }
          }
        }
      }
      
      // Extract and save cost information
      if (data.data?.costInfo) {
        setCostInfo(data.data.costInfo);
        // Save cost info to localStorage for this session
        secureStorage.setItem(getUserStorageKey(`cost_${sessionId}`), JSON.stringify(data.data.costInfo));
        process.env.NODE_ENV !== 'production' && console.log('💰 Cost info updated:', data.data.costInfo);
        
        // Update total costs after new message
        fetchTotalCosts();
      }
      
      // Check if response wants to show something in split screen
      if (data.data?.showInSplitScreen && data.data?.splitScreenType) {
        // Open the split screen with document list
        if (data.data.splitScreenType === 'document-list' && data.data.data) {
          setShowContextPanel(true);
          setContextPanelType('documents');
          setContextPanelData({
            documents: data.data.data,
            isPracticeWide: data.data.isPracticeWide || false,
            patientName: data.data.patientName || null
          });
          process.env.NODE_ENV !== 'production' && console.log('📂 Opening document list in split screen');
        }
      }
      
      // Check if message was already added via streaming
      const lastMessage = messages[messages.length - 1];
      const wasStreamed = lastMessage && lastMessage.id && lastMessage.id.includes('_stream');

      let updatedMessages;

      if (wasStreamed) {
        // Message was already added via streaming, just update it with metadata
        setMessages(prev => prev.map(msg =>
          msg.id === lastMessage.id
            ? {
                ...msg,
                functionCall,
                functionResult,
                metadata: data.data?.metadata || null,
                isServiceMessage: data.data?.isServiceMessage,
                isError: data.data?.isError,
                requiresAction: data.data?.requiresAction,
                usedFallback: data.data?.usedFallback,
                fallbackProvider: data.data?.fallbackProvider
              }
            : msg
        ));
        updatedMessages = messages;
      } else {
        // Add agent response with function information (non-streaming case)
        const agentMessage = {
          id: `msg_${Date.now()}_agent`,
          type: 'agent',
          content: responseContent,
          timestamp: new Date().toISOString(),
          functionCall,
          functionResult,
          metadata: data.data?.metadata || null,
          isServiceMessage: data.data?.isServiceMessage,
          isError: data.data?.isError,
          requiresAction: data.data?.requiresAction,
          usedFallback: data.data?.usedFallback,
          fallbackProvider: data.data?.fallbackProvider
        };

        updatedMessages = [...newMessages, agentMessage];
        setMessages(updatedMessages);
      }

      saveMessages(updatedMessages, sessionId);
      
      // Save messages to database (both user and agent messages)
      try {
        // Ensure session exists before saving messages
        await sessionPromise;
        
        // Save user message
        await secureApi.post(`/api/chat/sessions/${sessionId}/messages`, {
            type: 'user',
            content: actualMessage,
            language: language
        });
        
        // Save agent response
        await secureApi.post(`/api/chat/sessions/${sessionId}/messages`, {
            type: 'agent',
            content: responseContent,
            language: language,
            actionTaken: functionCall?.name,
            actionResult: functionResult,
            processingTime: Date.now() - userMessage.timestamp
        });
      } catch (error) {
        process.env.NODE_ENV !== 'production' && console.error('Failed to save messages to database:', error);
      }
      
      // Update session title intelligently based on conversation content
      // Check if this is the first message in the session
      const isFirstMessage = newMessages.filter(m => m.type === 'user').length === 1;
      // Update title immediately for real-time sidebar updates
      // Only use a small delay for the very first message to ensure session is created
      if (isFirstMessage) {
        setTimeout(async () => {
          await updateSessionTitle(actualMessage, responseContent, sessionId, isFirstMessage);
        }, 100);
      } else {
        // For subsequent messages, update immediately for real-time experience
        await updateSessionTitle(actualMessage, responseContent, sessionId, isFirstMessage);
      }
      
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to send message:', error);
      
      // Extract error message from the error object
      let errorContent = '';
      if (error.response?.data?.error) {
        // API error response
        const apiError = error.response.data.error;
        if (typeof apiError === 'object' && (apiError.he || apiError.en)) {
          errorContent = apiError[language] || apiError.en || apiError.he;
        } else {
          errorContent = apiError.toString();
        }
      } else if (error.message) {
        errorContent = error.message;
      } else {
        errorContent = language === 'he' ? 
          'מצטער, אירעה שגיאה. נסה שוב.' : 
          'Sorry, an error occurred. Please try again.';
      }
      
      // Add error message with actual error content
      const errorMessage = {
        id: `msg_${Date.now()}_error`,
        type: 'agent',
        content: errorContent,
        timestamp: new Date().toISOString(),
        isError: true
      };
      
      const updatedMessages = [...newMessages, errorMessage];
      setMessages(updatedMessages);
      saveMessages(updatedMessages, sessionId);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle session change
  const handleSessionChange = (newSessionId) => {
    setSessionId(newSessionId);
    secureStorage.setItem(getUserStorageKey('current_session_id'), newSessionId);
    loadMessages(newSessionId);
    
    // Notify parent component of session change
    if (onSessionChange) {
      onSessionChange(newSessionId);
    }
    
    // Load cost info for the selected session
    const storedCost = secureStorage.getItem(getUserStorageKey(`cost_${newSessionId}`));
    if (storedCost) {
      try {
        setCostInfo(JSON.parse(storedCost));
      } catch (e) {
        process.env.NODE_ENV !== 'production' && console.error('Failed to restore cost info:', e);
      }
    } else {
      setCostInfo(null);
    }
    
    // Don't update lastActive when just switching sessions
    // Only update when actually sending messages
  };
  
  // Handle function component actions
  const handleFunctionAction = useCallback((actionData) => {
    process.env.NODE_ENV !== 'production' && console.log('🎯 Function action triggered:', actionData);
    
    // Handle different action types
    switch (actionData.action) {
      case 'select':
        // Patient selected - could trigger another function
        process.env.NODE_ENV !== 'production' && console.log('Patient selected:', actionData.data);
        // Could auto-send a message to get more details
        break;
        
      case 'view':
        process.env.NODE_ENV !== 'production' && console.log('View action:', actionData.data);
        // Could open a modal or side panel
        break;
        
      case 'edit':
        process.env.NODE_ENV !== 'production' && console.log('Edit action:', actionData.data);
        // Could switch to edit mode
        break;
        
      case 'refill':
        process.env.NODE_ENV !== 'production' && console.log('Refill medication:', actionData.data);
        // Could send a refill request
        break;
        
      default:
        process.env.NODE_ENV !== 'production' && console.log('Unhandled action:', actionData);
    }
  }, []);
  
  // Handle new session
  const handleNewSession = async () => {
    const newId = generateSessionId();
    const defaultTitle = actualLanguage === 'he' ? 'שיחה חדשה' : 'New Chat';
    
    // Update state first
    setSessionId(newId);
    secureStorage.setItem(getUserStorageKey('current_session_id'), newId);
    setMessages([]);
    setSessionTitle(defaultTitle);
    setCostInfo(null); // Reset cost for new session
    
    // Notify parent component of session change
    if (onSessionChange) {
      onSessionChange(newId);
    }
    
    // Create session in database - this will trigger sidebar refresh
    try {
      await ensureSessionInDatabase(newId, defaultTitle);
    } catch (err) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to create session in database:', err);
    }
    
    // Force sidebar refresh to show new session at the top
    // The SessionManager will handle adding it to localStorage properly
    setRefreshTrigger(prev => prev + 1);
    console.log('🆕 Created new session and triggered sidebar refresh:', newId);
  };
  
  // Container styles - clean professional layout
  const containerStyle = {
    height: '100vh',
    backgroundColor: theme.colors.primary,
    position: 'relative',
    overflow: 'hidden'
  };
  
  // Inject animations
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes float {
        0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.5; }
        33% { transform: translateY(-100px) rotate(120deg); opacity: 0.8; }
        66% { transform: translateY(100px) rotate(240deg); opacity: 0.3; }
      }
      @keyframes slideInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }
      ::-webkit-scrollbar {
        width: 6px;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      ::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.2);
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);
  
  // Handle workflow command clicks
  const handleWorkflowCommand = useCallback((command) => {
    // Send the command directly to the chat
    sendMessage(command);
  }, [sendMessage]);

  // Determine sidebar positions based on language
  const isRTL = actualLanguage === 'he';
  
  return (
    <div style={containerStyle}>
      {/* Main layout container with flex */}
      <div style={{
        display: 'flex',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        height: '100%',
        width: '100%'
      }}>
        {/* Chat History Sidebar - Collapsible */}
        <CollapsibleSidebar
          position={isRTL ? 'right' : 'left'}
          isOpen={leftSidebarOpen}
          onToggle={() => setLeftSidebarOpen(!leftSidebarOpen)}
          language={actualLanguage}
          width="260px"
          type="chat"
          userEmail={user?.email}
          onNewChat={handleNewSession}
          onSearch={(sessionId) => {
            // Load the selected session from search
            handleSessionChange(sessionId);
          }}
        >
          <div style={{ padding: '0 12px' }}>
            <Sidebar
              currentSessionId={sessionId}
              onSessionChange={handleSessionChange}
              onNewSession={handleNewSession}
              language={actualLanguage}
              totalCosts={totalCosts}
              refreshTrigger={refreshTrigger}
            />
          </div>
        </CollapsibleSidebar>
        
        {/* Main Chat Area - Flex grow to fill space */}
        <div style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden'
        }}>
          <ChatArea
            sessionTitle={sessionTitle}
            onNewChat={handleNewSession}
            messages={messages}
            onSendMessage={sendMessage}
            isLoading={isLoading}
            language={actualLanguage}
            lastAgentMessage={lastAgentMessage}
            costInfo={costInfo}
            onFunctionAction={handleFunctionAction}
            leftSidebarOpen={leftSidebarOpen}
            rightSidebarOpen={rightSidebarOpen}
            isProvider={isProvider}
          />
        </div>
      </div>
      
      {/* Notifications & Appointments Sidebar - Right for English, Left for Hebrew */}
      {isProvider && (
        <CollapsibleSidebar
          position={isRTL ? 'left' : 'right'}
          isOpen={rightSidebarOpen}
          onToggle={() => setRightSidebarOpen(!rightSidebarOpen)}
          language={actualLanguage}
          width="300px"
          type="medical"
          userEmail={user?.email}
          onIconClick={(action) => {
            // Handle icon clicks from minimal sidebar
            setRightSidebarOpen(true);
            // Set which section to expand based on icon clicked
            // First clear any existing expanded section
            setExpandedSection(null);
            setTimeout(() => {
              if (action === 'appointments') setExpandedSection('appointments');
              else if (action === 'notifications') setExpandedSection('notifications');
              else if (action === 'workflow') setExpandedSection('workflow');
            }, 100); // Small delay to ensure sidebar is open first
          }}
        >
          <div style={{ padding: '0 12px' }}>
            <div style={{ 
              padding: '14px 0', 
              borderBottom: '1px solid rgba(255,255,255,0.1)', 
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              <h3 style={{ 
                margin: 0, 
                fontSize: '15px',
                fontWeight: '600',
                color: '#ffffff',
                letterSpacing: '0.3px'
              }}>
                {actualLanguage === 'he' ? 'לוח בקרה רפואי' : 'Medical Dashboard'}
              </h3>
            </div>
          </div>
          
          {/* Cost Summary Accordion */}
          {costInfo && (
            <AccordionSection
              title={actualLanguage === 'he' ? 'סיכום עלויות' : 'Cost Summary'}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 2v20M17 7s-1.5-2-5-2-5 2-5 2m10 6s-1.5 2-5 2-5-2-5-2"/>
                </svg>
              }
              defaultOpen={false}
              forceOpen={expandedSection === 'cost'}
              language={actualLanguage}
              onToggle={() => expandedSection === 'cost' && setExpandedSection(null)}
            >
              <div style={{
                backgroundColor: '#363a46',
                border: '1px solid #1e2129',
                borderRadius: '6px',
                padding: '10px'
              }}>
                {costInfo.sessionTotals && (
                  <>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '6px',
                      color: '#ffffff',
                      fontSize: '13px'
                    }}>
                      <span>{actualLanguage === 'he' ? 'שיחה:' : 'Session:'}</span>
                      <span style={{ fontWeight: '600' }}>
                        {costInfo.sessionTotals.currencySymbol || '$'}
                        {costInfo.sessionTotals.formattedCost || costInfo.sessionTotals.totalCost || '0.00'}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      color: '#a0a0b0',
                      fontSize: '11px'
                    }}>
                      <span>{actualLanguage === 'he' ? 'טוקנים:' : 'Tokens:'}</span>
                      <span>{costInfo.sessionTotals.totalTokens?.toLocaleString() || 0}</span>
                    </div>
                  </>
                )}
                {costInfo.costDisplay && (
                  <div style={{ 
                    marginTop: '8px', 
                    paddingTop: '8px', 
                    borderTop: '1px solid #1e2129',
                    fontSize: '11px',
                    color: '#d0d0e0',
                    whiteSpace: 'pre-line'
                  }}>
                    {costInfo.costDisplay}
                  </div>
                )}
              </div>
            </AccordionSection>
          )}
          
          {/* Appointments Accordion */}
          <AccordionSection
            title={actualLanguage === 'he' ? 'תורים קרובים' : 'Appointments'}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            }
            defaultOpen={false}
            forceOpen={expandedSection === 'appointments'}
            language={actualLanguage}
            onToggle={() => expandedSection === 'appointments' && setExpandedSection(null)}
          >
            <UpcomingAppointments
              providerId={(() => {
                // Use user._id as the provider ID (backend expects this)
                const id = user?._id || user?.id || user?.email;
                console.log('🏥 Provider ID for appointments:', id);
                console.log('🏥 User object:', { _id: user?._id, id: user?.id, email: user?.email });
                return id;
              })()}
              language={actualLanguage}
              socket={notificationSocket}
              maxItems={10}
            />
          </AccordionSection>
          
          {/* Notifications Accordion */}
          <AccordionSection
            title={actualLanguage === 'he' ? 'התראות' : 'Notifications'}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            }
            badge={unreadCount > 0 ? unreadCount : null}
            defaultOpen={false}
            forceOpen={expandedSection === 'notifications'}
            language={actualLanguage}
            onToggle={() => expandedSection === 'notifications' && setExpandedSection(null)}
          >
            <NotificationCenter
              userId={user?._id}
              language={actualLanguage}
              socket={notificationSocket}
              maxItems={20}
            />
          </AccordionSection>
          
          {/* Workflow Suggestions - Collapsed by default */}
          <AccordionSection
            title={actualLanguage === 'he' ? 'הצעות לזרימת עבודה' : 'Workflow Suggestions'}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            }
            defaultOpen={false}
            forceOpen={expandedSection === 'workflow'}
            language={actualLanguage}
            onToggle={() => expandedSection === 'workflow' && setExpandedSection(null)}
          >
            <WorkflowSuggestions
              language={actualLanguage}
              chatState={messages}
              userProfile={user}
              onSendMessage={sendMessage}
            />
          </AccordionSection>
        </CollapsibleSidebar>
      )}
      
      {/* Workflow Helper Panel */}
      {isHelperVisible && activeWorkflow && (
        <WorkflowHelper
          onCommandClick={handleWorkflowCommand}
        />
      )}
    </div>
  );
};

export default ChatContainer;