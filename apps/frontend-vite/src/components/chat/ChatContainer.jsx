import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense, memo } from 'react';
import { isAdmin, isClinicalRole } from '../../config/roleConfig';
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
import AccordionSection from '../ui/AccordionSection';
import { useAppointmentNotifications } from '../../hooks/useAppointmentNotifications';
import { useStaffChat } from '../../hooks/useStaffChat';
import { useVoiceMode } from '../../hooks/useVoiceMode';
import { useAuth } from '../../context/AuthContext';
import { extractSessionTitle } from '../../utils/sessionTitleExtractor';

const LiveTranscriptCard = lazy(() => import('./LiveTranscriptCard.jsx'));

// Lazy load heavy components for better performance
const UpcomingAppointments = lazy(() => import('../appointments/UpcomingAppointments'));
const NotificationCenter = lazy(() => import('../notifications/NotificationCenter'));
// FDARecallAlerts removed - low value to doctors (pharmacy handles lot-specific recalls)
// All FDA functions are now available as agent tools - doctors can ask the agent directly
const DeviceRecallAlerts = lazy(() => import('../notifications/DeviceRecallAlerts'));
const DrugShortageAlerts = lazy(() => import('../notifications/DrugShortageAlerts'));
const FDARecallAlerts = lazy(() => import('../notifications/FDARecallAlerts'));
const WorkflowSuggestions = lazy(() => import('../sidebar/WorkflowSuggestions'));
const ArtifactPanel = lazy(() => import('../artifact/ArtifactPanel'));
const MemoryPanel = lazy(() => import('./MemoryPanel'));
const StaffChatPanel = lazy(() => import('../staffchat/StaffChatPanel'));
const UserSettings = lazy(() => import('../UserSettings'));

// Loading fallback component
const LoadingFallback = () => (
  <div style={{ padding: '20px', textAlign: 'center', color: '#a0a0b0' }}>
    Loading...
  </div>
);

// Extract styles outside component to prevent recreation
const STYLES = {
  container: {
    height: '100vh',
    background: '#060A14', /* Unified deep blue-black backdrop, matches artifact panel (experiment: darker than the #0A1426 navy) */
    position: 'relative',
    overflow: 'hidden'
  },
  mainLayout: {
    display: 'flex',
    height: '100%',
    width: '100%'
  },
  mainChatArea: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden'
  },
  sidebarPadding: {
    padding: '0 12px'
  },
  dashboardHeader: {
    padding: '14px 0',
    borderBottom: '1px solid #28395C',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  dashboardTitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: '0.3px'
  }
};

const ChatContainer = memo(({
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
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Force refresh sidebar
  const [socket, setSocket] = useState(null); // Socket.IO connection

  // AbortController for stopping AI generation
  const abortControllerRef = useRef(null);
  const stopRecordingRef = useRef(null); // Exposed by VoiceRecordingButton via MessageInput

  // CRITICAL: Track the last category we received onDataFetched for to prevent infinite loops
  // When CollectionDocumentView calls onDataFetched, it updates artifactGridData state,
  // which triggers a re-render. Without this guard, we could get stuck in an infinite loop.
  const lastDataFetchedCategoryRef = useRef(null);

  // Sidebar states - Start collapsed for cleaner interface
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null); // Track which section to expand
  const [staffChatOpen, setStaffChatOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('profile');
  const { user, setUser } = useAuth();

  // Ref for user ID — keeps socket listeners current even when user loads after socket setup
  // Note: session-check returns "id" (not "_id"), so check both
  const userIdRef = useRef(user?._id ? String(user._id) : user?.id ? String(user.id) : null);
  useEffect(() => {
    userIdRef.current = user?._id ? String(user._id) : user?.id ? String(user.id) : null;
  }, [user]);

  // Track mount time to detect re-fired message events on page refresh
  // Message.js re-fires openArtifactPanel events with stale data on refresh;
  // within 2s of mount, if panel is already open, these are re-fires to ignore
  const mountTimeRef = useRef(Date.now());

  // Becomes true on the first real user interaction (pointer/keyboard) after mount.
  // Historical <Message> components re-fire openArtifactPanel on mount during a cold
  // restore; those all happen BEFORE any user interaction. Used as a robust re-fire
  // guard that does not depend on the cold load finishing within a fixed time window
  // (a slow re-login restore can push past the old 2s window and thrash the panel).
  const hasUserInteractedRef = useRef(false);
  useEffect(() => {
    const markInteracted = () => { hasUserInteractedRef.current = true; };
    window.addEventListener('pointerdown', markInteracted, { once: true, capture: true });
    window.addEventListener('keydown', markInteracted, { once: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', markInteracted, { capture: true });
      window.removeEventListener('keydown', markInteracted, { capture: true });
    };
  }, []);

  // Artifact panel state - with localStorage persistence
  const [artifactPanelOpen, setArtifactPanelOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('artifactPanelOpen');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [artifactPatientId, setArtifactPatientId] = useState(() => {
    try {
      return localStorage.getItem('artifactPatientId') || null;
    } catch {
      return null;
    }
  });
  // Persist category and level so refresh keeps you in the same view
  const [artifactCategory, setArtifactCategory] = useState(() => {
    try {
      return localStorage.getItem('artifactCategory') || null;
    } catch {
      return null;
    }
  });
  const [artifactDocumentId, setArtifactDocumentId] = useState(() => {
    try {
      return localStorage.getItem('artifactDocumentId') || null;
    } catch {
      return null;
    }
  });
  const [artifactLevel, setArtifactLevel] = useState(() => {
    try {
      return localStorage.getItem('artifactLevel') || 'categories';
    } catch {
      return 'categories';
    }
  });
  const [artifactGridData, setArtifactGridData] = useState(() => {
    try {
      const saved = localStorage.getItem('artifactGridData');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [artifactPatientName, setArtifactPatientName] = useState(() => {
    try {
      return localStorage.getItem('artifactPatientName') || null;
    } catch {
      return null;
    }
  });

  // Gate for the DB write-through effect below: stays false until restoreArtifactState
  // has run for the active session, so startup/session-switch defaults never overwrite
  // the artifact state already saved in the database.
  const artifactStateHydratedRef = useRef(false);

  // Patient-memory drawer (Phase 6) — persisted like the artifact panel.
  const [memoryPanelOpen, setMemoryPanelOpen] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('memoryPanelOpen') || 'false');
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('memoryPanelOpen', JSON.stringify(memoryPanelOpen));
    } catch (error) {
      console.error('Failed to save memoryPanelOpen to localStorage:', error);
    }
  }, [memoryPanelOpen]);

  // Persist artifact panel state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('artifactPanelOpen', JSON.stringify(artifactPanelOpen));
    } catch (error) {
      console.error('Failed to save artifactPanelOpen to localStorage:', error);
    }
  }, [artifactPanelOpen]);

  useEffect(() => {
    try {
      if (artifactPatientId) {
        localStorage.setItem('artifactPatientId', artifactPatientId);
      } else {
        localStorage.removeItem('artifactPatientId');
      }
    } catch (error) {
      console.error('Failed to save artifactPatientId to localStorage:', error);
    }
  }, [artifactPatientId]);

  // Persist category, documentId, and level - keep user in same view on refresh
  useEffect(() => {
    try {
      if (artifactCategory) {
        localStorage.setItem('artifactCategory', artifactCategory);
      } else {
        localStorage.removeItem('artifactCategory');
      }
    } catch (error) {
      console.error('Failed to save artifactCategory to localStorage:', error);
    }
  }, [artifactCategory]);

  useEffect(() => {
    try {
      if (artifactDocumentId) {
        localStorage.setItem('artifactDocumentId', artifactDocumentId);
      } else {
        localStorage.removeItem('artifactDocumentId');
      }
    } catch (error) {
      console.error('Failed to save artifactDocumentId to localStorage:', error);
    }
  }, [artifactDocumentId]);

  useEffect(() => {
    try {
      localStorage.setItem('artifactLevel', artifactLevel);
    } catch (error) {
      console.error('Failed to save artifactLevel to localStorage:', error);
    }
  }, [artifactLevel]);

  // Save artifact panel state to database immediately - NO DEBOUNCE
  // This works exactly like saving messages - save once when state changes
  const saveArtifactStateToDatabase = useCallback(async (targetSessionId, state) => {
    try {
      await secureApi.put(`/api/chat/sessions/${targetSessionId}/artifact-state`, {
        artifactState: state
      });

      console.log('💾 Saved artifact state to database for session:', targetSessionId);
    } catch (error) {
      console.error('Failed to save artifact state to database:', error);
    }
  }, [secureApi]);

  // Restore artifact panel state - called on cold start (initSession) and in handleSessionChange.
  // keepCurrentOnMissing: on cold start, a session saved before the DB write-through existed has
  // no artifactState — keep whatever the localStorage initializers loaded instead of force-closing.
  // On a session switch the close is intentional (that session genuinely had no artifacts).
  const restoreArtifactState = useCallback(async (targetSessionId, { keepCurrentOnMissing = false } = {}) => {
    artifactStateHydratedRef.current = false;
    try {
      console.log('🔍 [RESTORE] Fetching session data for:', targetSessionId);
      const response = await secureApi.get(`/api/chat/sessions/${targetSessionId}`);

      console.log('🔍 [RESTORE] response:', response);
      console.log('🔍 [RESTORE] response.data:', response.data);
      console.log('🔍 [RESTORE] response.data.artifactState:', response.data?.artifactState);

      // secureApiClient returns the raw backend response, so response.data.artifactState (not response.data.data.artifactState)
      if (response?.success && response.data?.artifactState) {
        const state = response.data.artifactState;

        console.log('📥 Restoring artifact state from database for session:', targetSessionId);
        console.log('📥 State to restore:', state);

        // Restore all artifact panel state
        if (state.artifactPanelOpen !== undefined) setArtifactPanelOpen(state.artifactPanelOpen);
        if (state.artifactPatientId !== undefined) setArtifactPatientId(state.artifactPatientId);
        if (state.artifactCategory !== undefined) setArtifactCategory(state.artifactCategory);
        if (state.artifactDocumentId !== undefined) setArtifactDocumentId(state.artifactDocumentId);
        if (state.artifactLevel !== undefined) setArtifactLevel(state.artifactLevel);
        if (state.artifactGridData !== undefined) setArtifactGridData(state.artifactGridData);
        if (state.artifactPatientName !== undefined) setArtifactPatientName(state.artifactPatientName);
      } else {
        // No saved state - close the artifact panel for this session
        console.log('📭 No artifact state found for session:', targetSessionId, keepCurrentOnMissing ? '- keeping locally restored state' : '- closing artifact panel');
        console.log('📭 Response structure:', {
          hasSuccess: !!response?.success,
          hasData: !!response?.data,
          hasArtifactState: !!response?.data?.artifactState,
          artifactStateValue: response?.data?.artifactState
        });
        if (!keepCurrentOnMissing) {
          setArtifactPanelOpen(false);
        }
      }
    } catch (error) {
      console.error('Failed to restore artifact state from database:', error);
    } finally {
      // Allow the write-through effect to persist state changes from here on
      artifactStateHydratedRef.current = true;
    }
  }, [secureApi]);

  // Write-through: persist the artifact panel state to the session document on every
  // change, exactly like messages are saved. localStorage alone is not enough — the
  // browser can clear it between visits, which left the restored chat without its
  // artifact. Gated on hydration so startup/session-switch defaults never overwrite
  // the state already saved in the database before restoreArtifactState resolves.
  useEffect(() => {
    if (!sessionId || !artifactStateHydratedRef.current) return;
    saveArtifactStateToDatabase(sessionId, {
      artifactPanelOpen,
      artifactPatientId,
      artifactCategory,
      artifactDocumentId,
      artifactLevel,
      artifactGridData,
      artifactPatientName
    });
  }, [sessionId, artifactPanelOpen, artifactPatientId, artifactCategory, artifactDocumentId, artifactLevel, artifactGridData, artifactPatientName, saveArtifactStateToDatabase]);

  // Use appointment notifications hook
  const {
    socket: notificationSocket,
    notifications,
    unreadCount: hookUnreadCount,
    requestNotificationPermission
  } = useAppointmentNotifications();

  // NotificationCenter's own unread count (from DB + socket events)
  const [notifCenterUnreadCount, setNotifCenterUnreadCount] = useState(0);

  // Fetch initial unread notification count on mount (before sidebar is opened)
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await secureApi.get('/api/notifications', {
          params: { limit: 50, sort: '-createdAt' }
        });
        const notifications = response?.notifications || [];
        const unread = notifications.filter(n => n.status !== 'read').length;
        if (unread > 0) {
          setNotifCenterUnreadCount(unread);
        }
      } catch (e) {
        // Silently fail - count will update when sidebar opens
      }
    };
    fetchUnreadCount();
  }, []);

  // Combined unread count: max of hook's count and NotificationCenter's count
  const unreadCount = Math.max(hookUnreadCount, notifCenterUnreadCount);

  // Staff Chat hook
  const staffChat = useStaffChat(socket || notificationSocket, user?._id || user?.id);

  // Voice visit recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState(null); // 'visit' or 'voiceChat'

  // TTS — on-demand per-message playback (speaker button next to copy)
  const { isSpeaking, ttsEnabled, speakingMessageId, speakResponse, stopSpeaking } = useVoiceMode();

  const [activeVisitId, setActiveVisitId] = useState(null);
  const [liveTranscript, setLiveTranscript] = useState([]);
  const [partialText, setPartialText] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Workflow state from Zustand store
  const { isHelperVisible, activeWorkflow } = useWorkflowStore();

  // Check if user is staff with provider-level access (admin or clinical doctor/nurse).
  // Basic 'user' role is excluded (matches the legacy behaviour where plain staff were excluded).
  const isProvider = useMemo(() => {
    return !!user?.roles && (isAdmin(user.roles) || user.roles.some(isClinicalRole));
  }, [user]);

  // Debug logging - only in development
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 ChatContainer - User Debug:', {
        user: user,
        roles: user?.roles,
        isProvider: isProvider,
        providerId: user?.providerInfo?.providerId,
        email: user?.email
      });
    }
  }, [user, isProvider]);

  // Request notification permission on mount for providers
  // DISABLED: Don't auto-request notifications - let users opt-in manually
  // useEffect(() => {
  //   if (isProvider) {
  //     requestNotificationPermission();
  //   }
  // }, [isProvider, requestNotificationPermission]);

  // Generate user-specific session ID - memoized
  const generateSessionId = useCallback(() => {
    const userIdentifier = practice || 'default';
    return `session_${userIdentifier}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, [practice]);

  // Get user-specific storage key to isolate data between users - memoized
  const getUserStorageKey = useCallback((key) => {
    const userIdentifier = practice || 'default';
    return `${userIdentifier}_${key}`;
  }, [practice]);

  // Update session title in database
  const updateSessionTitleInDatabase = useCallback(async (sessionId, title) => {
    try {
      const response = await secureApi.put(`/api/chat/sessions/${sessionId}/title`, { title });

      if (!response || response.error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Failed to update session title in database');
        }
      } else if (process.env.NODE_ENV !== 'production') {
        console.log('✅ Updated session title in database:', title);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error updating session title:', error);
      }
    }
  }, []);

  // Intelligently update session title based on conversation content
  const updateSessionTitle = useCallback(async (userMsg, agentResponse, sessionId, isFirstMessage = false) => {
    try {
      // Prevent duplicate title updates
      const updateKey = `updating_title_${sessionId}`;
      if (window[updateKey]) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('📝 Skipping duplicate title update for:', sessionId);
        }
        return;
      }
      window[updateKey] = true;

        if (process.env.NODE_ENV !== 'production') {
          console.log('📝 Updating session title for:', sessionId, 'User msg:', userMsg.substring(0, 50));
        }

        const sessions = JSON.parse(secureStorage.getItem(getUserStorageKey('chat_sessions')) || '[]');
        let session = sessions.find(s => s.id === sessionId);

        // If session doesn't exist in localStorage, add it now
        if (!session) {
          session = {
            id: sessionId,
            title: actualLanguage === 'he' ? 'שיחה חדשה' : 'New Chat',
            timestamp: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            lastActive: new Date().toISOString()
          };
          sessions.unshift(session);
        }

        // Extract title - handle both string and object response formats
        let title;

        console.log('📝 [TITLE DEBUG] agentResponse:', agentResponse);
        console.log('📝 [TITLE DEBUG] Type:', typeof agentResponse);

        if (agentResponse && typeof agentResponse === 'object' && agentResponse.actionTaken) {
          console.log('📝 [TITLE DEBUG] Action taken:', agentResponse.actionTaken);

          // Generate title from function name dynamically
          const functionName = agentResponse.actionTaken;

          // Convert camelCase/PascalCase to readable title
          // e.g., listAllPatients -> List All Patients
          // e.g., getPatientsNeedingFollowUp -> Get Patients Needing Follow Up
          title = functionName
            .replace(/([A-Z])/g, ' $1') // Add space before capital letters
            .replace(/([a-z])([A-Z])/g, '$1 $2') // Ensure space between lower and upper
            .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
            .trim();

          console.log(`📝 [TITLE DEBUG] Generated title for ${agentResponse.actionTaken}: ${title}`);
        } else {
          console.log('📝 [TITLE DEBUG] No actionTaken found, using fallback');
        }

        if (!title) {
          // Fallback to content-based extraction
          const responseContent = agentResponse?.content || agentResponse;
          title = extractSessionTitle(userMsg, responseContent, sessionId, actualLanguage, isFirstMessage);
        }

        // Update title if we have a valid one
        if (title && typeof title === 'string' && title.length > 5) {
          // Check if we should update (always update if current title is generic)
          const shouldUpdate = !session.title ||
              session.title === 'שיחה חדשה' ||
              session.title === 'New Chat' ||
              session.title.startsWith('New Chat') ||
              session.title === '[object Object]' ||
              session.title === 'undefined';

          if (shouldUpdate) {
            if (process.env.NODE_ENV !== 'production') {
              console.log('📝 Updating session title from:', session.title, 'to:', title);
            }

            // Update the session object in the array
            const sessionIndex = sessions.findIndex(s => s.id === sessionId);
            if (sessionIndex !== -1) {
              sessions[sessionIndex].title = title;
              sessions[sessionIndex].lastActive = new Date().toISOString();
            }

            setSessionTitle(title);
            // Update title in database
            await updateSessionTitleInDatabase(sessionId, title);
          }
        }

        // Always update lastActive
        const sessionIndex = sessions.findIndex(s => s.id === sessionId);
        if (sessionIndex !== -1) {
          sessions[sessionIndex].lastActive = new Date().toISOString();
        }

        // Always save the updated sessions array to ensure changes persist
        const limited = sessions.slice(0, 20);
        secureStorage.setItem(getUserStorageKey('chat_sessions'), JSON.stringify(limited));

        // Trigger refresh when we update a title
        if (session && title) {
          console.log(`📝 [TITLE UPDATE] Updating title for ${sessionId} to: "${title}"`);
          console.log(`📝 [TITLE UPDATE] Session found:`, session);

          setRefreshTrigger(prev => prev + 1);

          // Dispatch custom event to force SessionManager reload
          const event = new CustomEvent('chatSessionsUpdated', {
            detail: { sessionId, title, action: 'titleUpdate' }
          });
          console.log('📝 [TITLE UPDATE] Dispatching chatSessionsUpdated event');
          window.dispatchEvent(event);
        } else {
          console.log(`📝 [TITLE UPDATE] No update - session: ${!!session}, title: "${title}"`);
        }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to update session title:', err);
      }
    } finally {
      // Clear the update flag after a delay
      const updateKey = `updating_title_${sessionId}`;
      setTimeout(() => {
        delete window[updateKey];
      }, 1000);
    }
  }, [actualLanguage, getUserStorageKey, updateSessionTitleInDatabase]);

  // Initialize session on mount. Runs exactly once.
  //  - Same browser session (sessionStorage still has chat_initialized) → restore the
  //    in-memory current_session_id and its messages (existing behavior).
  //  - New login / browser restart (sessionStorage was wiped) → restore the user's most
  //    recent NON-EMPTY conversation from the database so the chat thread reappears
  //    instead of a blank "Welcome" screen. Falls back to a fresh session when there is
  //    no prior chat. The artifact panel restores the same way (restoreArtifactState from
  //    the session's DB artifactState) — localStorage alone is not reliable because the
  //    browser can clear it between visits.
  const sessionInitializedRef = useRef(false);
  useEffect(() => {
    if (sessionInitializedRef.current) return;
    sessionInitializedRef.current = true;

    const startFreshSession = () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('🔄 Starting fresh chat session');
      }
      const newId = generateSessionId();
      setSessionId(newId);
      secureStorage.setItem(getUserStorageKey('current_session_id'), newId);
      setMessages([]);
      // Nothing to restore for a brand-new session - open the write-through gate directly
      artifactStateHydratedRef.current = true;
      if (onSessionChange) onSessionChange(newId);
    };

    const initSession = async () => {
      const isNewLogin = !secureStorage.getItem('chat_initialized');
      // Mark chat as initialized for this browser session up front.
      secureStorage.setItem('chat_initialized', 'true');

      // Same browser session → restore the id we kept in sessionStorage.
      if (!isNewLogin) {
        const storedSessionId = secureStorage.getItem(getUserStorageKey('current_session_id'));
        if (storedSessionId) {
          setSessionId(storedSessionId);
          loadMessages(storedSessionId);
          restoreArtifactState(storedSessionId, { keepCurrentOnMissing: true });
          if (onSessionChange) onSessionChange(storedSessionId);
          return;
        }
      }

      // New login (browser restart) → restore the most recent non-empty conversation from DB.
      try {
        const response = await secureApi.get(
          '/api/chat/sessions?limit=1&sortBy=lastMessageAt&sortOrder=desc&messageCountMin=1'
        );
        if (response?.success && Array.isArray(response.data) && response.data.length > 0) {
          const latest = response.data[0];
          const latestId = latest.sessionId || latest._id?.toString() || latest._id;
          if (latestId) {
            if (process.env.NODE_ENV !== 'production') {
              console.log('🔄 New login - restoring most recent conversation:', latestId);
            }
            setSessionId(latestId);
            secureStorage.setItem(getUserStorageKey('current_session_id'), latestId);
            loadMessages(latestId);
            restoreArtifactState(latestId, { keepCurrentOnMissing: true });
            if (onSessionChange) onSessionChange(latestId);
            return;
          }
        }
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Failed to restore last conversation on login:', err);
        }
      }

      // No prior conversation (or the lookup failed) → start fresh.
      startFreshSession();
    };

    initSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize Socket.IO connection with memoized handlers
  const handleBatchSummary = useCallback(async (summary) => {
    console.log('📊 Received batch summary:', summary);

    if (summary.sessionId === sessionId) {
      const summaryMessage = {
        id: `summary_${summary.batchId}`,
        sender: 'system',
        type: 'batch_summary',
        content: summary,
        timestamp: new Date(summary.timestamp)
      };

      setMessages(prev => [...prev, summaryMessage]);

      // Save batch summary message to database for persistence across sessions
      try {
        await secureApi.post(`/api/chat/sessions/${sessionId}/messages`, {
          type: 'agent',
          content: JSON.stringify(summary), // Convert to string for storage
          language: language,
          metadata: {
            type: 'batch_summary',
            batchId: summary.batchId,
            fileCount: summary.fileCount,
            successCount: summary.successCount
          },
          timestamp: summaryMessage.timestamp.toISOString()
        });
        console.log('💾 Saved batch summary message to database');
      } catch (error) {
        console.error('❌ Failed to save batch summary to database:', error);
      }
    } else {
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
  }, [sessionId, language]);

  // Load messages for a session - memoized
  const loadMessages = useCallback(async (sessionId) => {
    try {
      // Try to load from database first
      try {
        if (process.env.NODE_ENV !== 'production') {
          console.log('🔍 Loading messages with:', {
            url: `${apiUrl}/chat/sessions/${sessionId}/messages`,
            usingCookieAuth: true,
            practice: practice
          });
        }

        const response = await secureApi.get(`/api/chat/sessions/${sessionId}/messages`);

        if (response.error) {
          if (response.status === 404) {
            if (process.env.NODE_ENV !== 'production') {
              console.log('📝 Session not found in database yet - will be created when sending first message');
            }
            // Session doesn't exist yet - that's fine, will be created when sending first message
            setMessages([]);
            setSessionTitle(actualLanguage === 'he' ? 'שיחה חדשה' : 'New Chat');
            return;
          }

          if (process.env.NODE_ENV !== 'production') {
            console.error('❌ Failed to load messages:', {
              status: response.status,
              statusText: response.statusText,
              url: response.url
            });
          }
        }

        if (!response.error) {
          const data = response;
          if (data.success && data.data) {
            let messages = data.data.messages.map(msg => {
              // CRITICAL: Handle array case for actionResult (multiple tool calls)
              let categoriesData = null;
              if (Array.isArray(msg.actionResult)) {
                categoriesData = msg.actionResult.find(result => result?.categories && result?.exportable);
              } else if (msg.actionResult?.categories) {
                categoriesData = msg.actionResult;
              }

              return {
                id: msg.messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: msg.type,
                content: typeof msg.content === 'object' && msg.content !== null && ('he' in msg.content || 'en' in msg.content)
                  ? (msg.content[actualLanguage] || msg.content[language] || msg.content.en || msg.content.he || 'No content')
                  : msg.content,
                timestamp: msg.timestamp || msg.createdAt,
                functionCall: msg.actionTaken ? { name: msg.actionTaken } : null,
                functionResult: msg.actionResult,
                // CRITICAL: Include display data for medical grid
                displayData: msg.displayData || null,
                displayType: msg.displayType || null,
                // CRITICAL: Include artifactPanel for artifact panel trigger
                artifactPanel: msg.artifactPanel || null,
                // Parse categoryGrids if it's a JSON string
                categoryGrids: msg.categoryGrids ?
                  (typeof msg.categoryGrids === 'string' ? JSON.parse(msg.categoryGrids) : msg.categoryGrids) :
                  null,
                // Include gridFormat and cellRenderers for pinned grids
                gridFormat: msg.gridFormat || msg.metadata?.isPinnedGrid || false,
                cellRenderers: msg.cellRenderers || msg.displayData?.cellRenderers || null,
                metadata: msg.metadata || null,
                // CRITICAL: Restore thinking messages from database
                // Check BOTH isThinking flag AND metadata.chainOfThoughts
                isThinking: msg.isThinking || !!(msg.metadata?.chainOfThoughts && Array.isArray(msg.metadata.chainOfThoughts)),
                isServiceMessage: msg.isServiceMessage,
                isError: msg.isError,
                requiresAction: msg.requiresAction,
                usedFallback: msg.usedFallback,
                fallbackProvider: msg.fallbackProvider,
                // Include attachments for displaying file names
                attachments: msg.attachments || null,
                // Extract categories list export data from functionResult (handle array case for loaded messages)
                patientId: msg.patientId || categoriesData?.patientId || msg.actionResult?.patientId || null,
                patientName: msg.patientName || categoriesData?.patientName || msg.actionResult?.patientName || null,
                categories: msg.categories || categoriesData?.categories || msg.actionResult?.categories || null,
                exportable: msg.exportable || categoriesData?.exportable || msg.actionResult?.exportable || null,
                // CRITICAL: Restore sequence number for proper interleaved ordering
                sequenceNumber: msg.metadata?.sequenceNumber
              };
            });

            // CRITICAL: Sort messages by timestamp first, then by sequenceNumber for interleaved messages
            // This ensures interleaved fragments (same timestamp) appear in correct order
            const finalReorderedMessages = messages.sort((a, b) => {
              const timeA = new Date(a.timestamp).getTime();
              const timeB = new Date(b.timestamp).getTime();
              const seqA = a.sequenceNumber;
              const seqB = b.sequenceNumber;

              // CRITICAL FIX: If both messages have sequenceNumbers AND are within 60 seconds,
              // prioritize sequenceNumber over timestamp. This ensures thinking messages (seq: 1)
              // appear before streaming messages (seq: 2) even if saved at slightly different times.
              const timeDiff = Math.abs(timeA - timeB);
              const bothHaveSeqNumbers = seqA !== undefined && seqA !== null && seqB !== undefined && seqB !== null;

              if (bothHaveSeqNumbers && timeDiff < 60000) {
                // Within 60 seconds and both have sequence numbers - use sequence number
                return seqA - seqB;
              }

              // If timestamps differ significantly, sort by timestamp
              if (timeA !== timeB) {
                return timeA - timeB;
              }

              // If timestamps are exactly the same, sort by sequenceNumber (interleaved messages)
              const seqAFinal = seqA ?? Infinity;
              const seqBFinal = seqB ?? Infinity;
              return seqAFinal - seqBFinal;
            });

            // DEBUG: Log all thinking messages from database
            const thinkingFromDB = messages.filter(m => m.isThinking);
            console.log(`🧠 [FRONTEND] Loaded ${thinkingFromDB.length} thinking messages from DB:`, thinkingFromDB.map(m => ({
              id: m.id,
              isThinking: m.isThinking,
              hasChainOfThoughts: !!m.metadata?.chainOfThoughts,
              content: m.content?.substring(0, 40) || ''
            })));

            console.log('✅ [SESSION LOAD] Messages loaded from DB in correct order:', {
              totalCount: finalReorderedMessages.length,
              userCount: finalReorderedMessages.filter(m => m.type === 'user').length,
              thinkingCount: finalReorderedMessages.filter(m => m.isThinking).length,
              responseCount: finalReorderedMessages.filter(m => m.type === 'agent' && !m.isThinking).length,
              order: finalReorderedMessages.map(m => `${m.type}${m.isThinking ? '(T)' : ''}`).join(' → ')
            });

            setMessages(finalReorderedMessages);
            // Ensure sessionTitle is always a string
            let title = data.data.sessionTitle;

            console.log('📝 [SESSION LOAD] Raw sessionTitle from DB:', title, 'Type:', typeof title);

            // Handle if title was saved as an object
            if (title && typeof title === 'object') {
              console.log('⚠️ [SESSION LOAD] Title is an object, extracting...', title);
              // Try to extract actionTaken or use default
              if (title.actionTaken) {
                // Convert camelCase to readable title
                title = title.actionTaken
                  .replace(/([A-Z])/g, ' $1')
                  .replace(/([a-z])([A-Z])/g, '$1 $2')
                  .replace(/^./, str => str.toUpperCase())
                  .trim();
              } else {
                title = actualLanguage === 'he' ? 'שיחה חדשה' : 'New Chat';
              }
            }

            // Final validation
            if (typeof title !== 'string' || title === '[object Object]' || title === 'undefined') {
              console.log('⚠️ [SESSION LOAD] Invalid title, using default');
              title = actualLanguage === 'he' ? 'שיחה חדשה' : 'New Chat';
            }

            console.log('📝 [SESSION LOAD] Final title:', title);
            setSessionTitle(title);

            // Save to localStorage for offline access
            secureStorage.setItem(getUserStorageKey(`messages_${sessionId}`), JSON.stringify(messages));
            return;
          }
        }
      } catch (error) {
        if (error.status === 404 || error.message?.includes('404') || error.message?.includes('session not found') || error.message?.includes('Chat session not found')) {
          if (process.env.NODE_ENV !== 'production') {
            console.log('📝 Session not found, skipping invalid session:', sessionId);
          }
          // Don't create a new session automatically - just clear messages
          // This prevents phantom "New Chat" sessions
          setMessages([]);
          // Remove the invalid session from storage
          secureStorage.removeItem(getUserStorageKey(`messages_${sessionId}`));
          return;
        } else {
          if (process.env.NODE_ENV !== 'production') {
            console.error('Failed to load messages from database:', error);
          }
        }
      }

      // DISABLED localStorage fallback - causes duplicate messages
      // Messages should ONLY load from database, not from localStorage
      // localStorage is used as write-through cache during streaming but should NOT be used for loading
      console.log('ℹ️ [MESSAGE LOAD] Skipping localStorage fallback - database is the single source of truth');
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to load messages:', err);
      }
    }
  }, [apiUrl, practice, getUserStorageKey, generateSessionId, actualLanguage]);

  // Handle batch completion - reload messages to show completion message
  const handleBatchComplete = useCallback((data) => {
    // Only process if targeted at the current user
    const myUid = user?._id ? String(user._id) : null;
    if (data?.targetUserIds && myUid && !data.targetUserIds.includes(myUid)) {
      return; // Not for this user
    }

    console.log('📢 ChatContainer received batch_complete event:', data);

    // Reload messages to show the batch completion message
    if (sessionId) {
      console.log('🔄 Reloading messages after batch completion...');
      loadMessages(sessionId);
    }

    // Increment notification count for bell badge
    setNotifCenterUnreadCount(prev => prev + 1);

    // Open the right sidebar and expand notifications section
    setRightSidebarOpen(true);
    setExpandedSection('notifications');

    console.log('✅ Right sidebar opened with notifications section');
  }, [sessionId, loadMessages, user]);

  // Handle Phase 1 completion - show Claude's reasoning for collection selection
  const handlePhase1Complete = useCallback(async (data) => {
    console.log('📝 ChatContainer received phase1_complete event:', data);
    console.log('🧠 Claude reasoning:', data.reasoning);
    console.log('📋 Selected collections:', data.selectedCollections);

    // Add reasoning message to chat
    const reasoningMessage = {
      id: `phase1_${data.batchId}_${Date.now()}`,
      type: 'agent',  // FIXED: Changed from 'role' to 'type' - Message.js checks message.type
      content: `📝 **Phase 1 Complete: Document Analysis**\n\nClaude analyzed the document and selected ${data.selectedCollections.length} relevant medical collections.\n\n**Claude's Reasoning:**\n${data.reasoning}\n\n⏳ Now processing detailed data extraction (Phase 2)...`,
      timestamp: new Date(data.timestamp).toISOString(),
      sessionId: sessionId,
      metadata: {
        type: 'phase1_complete',
        batchId: data.batchId,
        phase2BatchId: data.phase2BatchId,
        selectedCollections: data.selectedCollections,
        patientName: data.patientName
      }
    };

    setMessages(prev => [...prev, reasoningMessage]);
    console.log('✅ Added Phase 1 reasoning message to chat');

    // Save reasoning message to database for persistence across sessions
    try {
      await secureApi.post(`/api/chat/sessions/${sessionId}/messages`, {
        type: 'agent',
        content: reasoningMessage.content,
        language: language,
        metadata: reasoningMessage.metadata,
        timestamp: reasoningMessage.timestamp
      });
      console.log('💾 Saved Phase 1 reasoning message to database');
    } catch (error) {
      console.error('❌ Failed to save reasoning message to database:', error);
      // Message is still in React state, so chat will work during this session
    }
  }, [sessionId, language]);

  // Handle credit balance too low - show warning in chat
  const handleCreditBalanceLow = useCallback((data) => {
    console.log('💳 Credit balance low event:', data);
    const creditMessage = {
      id: `credit_${Date.now()}`,
      type: 'agent',
      content: data.message,
      timestamp: new Date(data.timestamp).toISOString(),
      sessionId: sessionId,
      metadata: { type: data.type }
    };
    setMessages(prev => [...prev, creditMessage]);
  }, [sessionId]);

  // Handle Phase 2 completion - show final analysis complete message
  const handlePhase2Complete = useCallback(async (data) => {
    console.log('✅ ChatContainer received phase2_complete event:', data);
    console.log('📋 Selected collections:', data.selectedCollections);
    console.log('👤 Patient:', data.patientName);

    // Build list of extracted collections
    const collectionsList = (data.selectedCollections || [])
      .map(c => `• ${c}`)
      .join('\n');

    // Add completion message to chat
    const completionMessage = {
      id: `phase2_${data.batchId}_${Date.now()}`,
      type: 'agent',
      content: `✅ **Document Analysis Complete**\n\nPatient: ${data.patientName}\nCollections extracted: ${(data.selectedCollections || []).length}\n\nThe following medical data categories were extracted and saved:\n${collectionsList}\n\nYou can now view the extracted data in the patient's medical records.`,
      timestamp: new Date(data.timestamp).toISOString(),
      sessionId: sessionId,
      metadata: {
        type: 'phase2_complete',
        batchId: data.batchId,
        phase1BatchId: data.phase1BatchId,
        selectedCollections: data.selectedCollections,
        patientId: data.patientId,
        patientName: data.patientName
      }
    };

    setMessages(prev => [...prev, completionMessage]);
    console.log('✅ Added Phase 2 completion message to chat');

    // Save completion message to database for persistence across sessions
    try {
      await secureApi.post(`/api/chat/sessions/${sessionId}/messages`, {
        type: 'agent',
        content: completionMessage.content,
        language: language,
        metadata: completionMessage.metadata,
        timestamp: completionMessage.timestamp
      });
      console.log('💾 Saved Phase 2 completion message to database');
    } catch (error) {
      console.error('❌ Failed to save completion message to database:', error);
      // Message is still in React state, so chat will work during this session
    }
  }, [sessionId, language]);

  // Handle batch processing start - show immediate notification in chat
  const handleBatchStarted = useCallback(async (data) => {
    console.log('🚀 ChatContainer received batch_started event:', data);

    const startMessage = {
      id: `batch_started_${data.batchId}_${Date.now()}`,
      type: 'agent',
      content: `📤 **Started Processing ${data.documentCount} Document(s)**\n\nYour documents are being analyzed. You'll see Claude's reasoning when Phase 1 completes.`,
      timestamp: new Date().toISOString(),
      sessionId: sessionId,
      metadata: {
        type: 'batch_started',
        batchId: data.batchId
      }
    };

    setMessages(prev => [...prev, startMessage]);
    console.log('✅ Added batch started message to chat');

    // Save batch started message to database for persistence across sessions
    try {
      await secureApi.post(`/api/chat/sessions/${sessionId}/messages`, {
        type: 'agent',
        content: startMessage.content,
        language: language,
        metadata: startMessage.metadata,
        timestamp: startMessage.timestamp
      });
      console.log('💾 Saved batch started message to database');
    } catch (error) {
      console.error('❌ Failed to save batch started message to database:', error);
    }
  }, [sessionId, language]);

  // Handle document analysis streaming progress from Skills API
  const progressMessageRef = useRef(null);
  const handleDocumentAnalysisProgress = useCallback((data) => {
    console.log('📡 ChatContainer received document_analysis_progress event:', {
      status: data.status,
      sessionId: data.sessionId,
      currentSessionId: sessionId,
      messageLength: data.message?.length,
      accumulatedLength: data.accumulatedText?.length,
      contentType: data.contentType
    });

    // Only show progress for matching session
    if (sessionId !== data.sessionId) {
      console.log('⏭️ Skipping progress - session mismatch');
      return;
    }

    // Update or create progress message
    setMessages(prev => {
      // Find existing progress message
      const progressIdx = prev.findIndex(m => m.id === 'analysis_progress');

      if (data.status === 'started') {
        // Create new progress message
        const progressMsg = {
          id: 'analysis_progress',
          sender: 'assistant',
          type: 'agent',
          content: data.message,
          timestamp: new Date(data.timestamp),
          isStreaming: true
        };
        progressMessageRef.current = progressMsg;
        return [...prev, progressMsg];
      } else if (data.status === 'thinking' || data.status === 'streaming') {
        // Update existing progress message with accumulated text
        // Thinking = Claude's reasoning process, Streaming = final text output
        const contentPrefix = data.status === 'thinking' ? '💭 ' : '📝 ';

        if (progressIdx >= 0) {
          const updated = [...prev];
          updated[progressIdx] = {
            ...updated[progressIdx],
            content: contentPrefix + (data.accumulatedText || data.message),
            timestamp: new Date(data.timestamp)
          };
          return updated;
        } else if (progressMessageRef.current) {
          // Add if not found but we have a ref
          progressMessageRef.current.content = contentPrefix + (data.accumulatedText || data.message);
          return [...prev, progressMessageRef.current];
        }
      }
      return prev;
    });
  }, [sessionId]);

  // Handle document analysis completion from Skills API
  const handleDocumentAnalysisComplete = useCallback(async (data) => {
    console.log('📢 ChatContainer received document_analysis_complete event:', data);
    console.log('📊 Event details:', {
      fileName: data.filename,
      patientName: data.patientName,
      documentSpecialty: data.documentSpecialty,
      hasSummary: !!data.extractionSummary,
      summaryLength: data.extractionSummary?.length || 0,
      cost: data.cost,
      elapsedTime: data.elapsedTime,
      timestamp: data.timestamp,
      sessionId: data.sessionId
    });

    // Remove progress message
    progressMessageRef.current = null;
    setMessages(prev => prev.filter(m => m.id !== 'analysis_progress'));

    // Create a message with the extraction summary
    if (data.extractionSummary && sessionId === data.sessionId) {
      const summaryMessage = {
        id: `analysis_${Date.now()}`,
        sender: 'assistant',
        type: 'agent',
        content: data.extractionSummary,
        timestamp: new Date(data.timestamp || Date.now())
      };

      console.log('📝 Adding extraction summary to messages:', {
        messageId: summaryMessage.id,
        contentLength: summaryMessage.content.length,
        contentPreview: summaryMessage.content.substring(0, 200)
      });

      setMessages(prev => [...prev, summaryMessage]);

      // Save extraction summary message to database for persistence across sessions
      try {
        await secureApi.post(`/api/chat/sessions/${sessionId}/messages`, {
          type: 'agent',
          content: summaryMessage.content,
          language: language,
          metadata: {
            type: 'document_analysis_complete',
            filename: data.filename,
            patientName: data.patientName,
            documentSpecialty: data.documentSpecialty,
            cost: data.cost,
            elapsedTime: data.elapsedTime
          },
          timestamp: summaryMessage.timestamp.toISOString()
        });
        console.log('💾 Saved extraction summary message to database');
      } catch (error) {
        console.error('❌ Failed to save extraction summary to database:', error);
      }
    } else {
      console.warn('⚠️ No summary to display or session mismatch:', {
        hasSummary: !!data.extractionSummary,
        sessionMatch: sessionId === data.sessionId,
        currentSession: sessionId,
        eventSession: data.sessionId
      });
    }
  }, [sessionId, language]);

  // Voice recording handler functions
  const handleTranscriptUpdate = useCallback((text, isPartial, speaker) => {
    if (isPartial) {
      setPartialText(text);
    } else {
      setPartialText('');
      setLiveTranscript(prev => [...prev, { text, speaker, timestamp: Date.now() }]);
    }
  }, []);

  const handleVisitStarted = useCallback((visitId, mode) => {
    setActiveVisitId(visitId);
    setRecordingMode(mode || 'visit');
    setLiveTranscript([]);
    setPartialText('');
  }, []);

  // Voice-based patient lookup: when doctor speaks a patient name and it's found
  const handlePatientFound = useCallback((patient) => {
    if (patient?.id && patient?.name) {
      console.log('[Voice Lookup] Patient found — setting context:', patient.name, patient.id);
      setArtifactPatientId(patient.id);
      setArtifactPatientName(patient.name);
      localStorage.setItem('artifactPatientId', patient.id);
      localStorage.setItem('artifactPatientName', patient.name);
    }
  }, []);

  const handleVisitEnded = useCallback((data) => {
    const visitId = data?.visitId || activeVisitId;
    const patientId = data?.patientId || artifactPatientId;
    console.log('[Visit] handleVisitEnded called:', { visitId, patientId, dataPatientId: data?.patientId, dataVisitId: data?.visitId, activeVisitId, artifactPatientId });
    setIsRecording(false);
    setRecordingMode(null);
    setActiveVisitId(null);
    setLiveTranscript([]);
    setPartialText('');

    // Open artifact panel with the visit SOAP note if we have a visitId
    if (visitId && patientId) {
      console.log('[Visit] Opening artifact panel for visit:', visitId, 'patient:', patientId);
      setTimeout(() => {
        setArtifactPatientId(patientId);
        setArtifactCategory('patient_visits');
        setArtifactDocumentId(visitId);
        setArtifactLevel('detail');
        setArtifactPanelOpen(true);
      }, 500);
    } else {
      console.warn('[Visit] Cannot open artifact panel — missing:', !visitId ? 'visitId' : '', !patientId ? 'patientId' : '');
    }
  }, [activeVisitId, artifactPatientId]);

  // Recording duration timer
  useEffect(() => {
    let timer;
    if (isRecording) {
      timer = setInterval(() => setRecordingDuration(d => d + 1), 1000);
    } else {
      setRecordingDuration(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  // Setup WebSocket connection for batch events
  useEffect(() => {
    if (!sessionId) return;

    // Use proxy - Vite dev server proxies to backend, NGINX handles in production
    // Start with polling to avoid WebSocket upgrade issues with Vite proxy
    const newSocket = io(window.location.origin, {
      withCredentials: true,
      transports: ['polling', 'websocket'], // Try polling first, then upgrade to WebSocket
      path: '/socket.io'
    });

    newSocket.on('connect', () => {
      console.log('🔌 Connected to WebSocket');
      newSocket.emit('join_session', sessionId);

      // Also subscribe to practice room for practice-wide events (permission requests, etc.)
      let practiceId = practice; // practice prop is a string like 'yale'
      if (!practiceId) practiceId = localStorage.getItem('practiceSubdomain');
      if (!practiceId) {
        const parts = window.location.hostname.split('.');
        if (parts.length >= 2 && parts[0] !== 'www' && parts[0] !== 'api') {
          practiceId = parts[0];
        }
      }
      if (practiceId) {
        newSocket.emit('subscribe_practice', practiceId);
        console.log(`🏥 ChatContainer socket subscribed to practice: ${practiceId}`);
      }
    });

    newSocket.on('batch_summary', handleBatchSummary);
    newSocket.on('batch_complete', handleBatchComplete);
    newSocket.on('phase1_complete', handlePhase1Complete);
    newSocket.on('phase2_complete', handlePhase2Complete);  // NEW: Phase 2 completion with results
    newSocket.on('credit_balance_low', handleCreditBalanceLow);  // Credit balance retry notification
    newSocket.on('batch_started', handleBatchStarted);  // Immediate batch start notification
    newSocket.on('document_analysis_progress', handleDocumentAnalysisProgress);

    // Listen for permission and other practice-wide events to update bell badge
    // Only increment if this notification targets the current user
    // Use userIdRef (not closure variable) so the check always uses the latest user ID
    newSocket.on('permission_request', (data) => {
      const myId = userIdRef.current;
      console.log('🔔 ChatContainer: permission_request EVENT RECEIVED', { myId, targetUserIds: data?.targetUserIds, hasData: !!data });
      if (data?.targetUserIds && myId && !data.targetUserIds.includes(myId)) {
        console.log('🔔 ChatContainer: FILTERED OUT - not targeted at this user');
        return; // Not targeted at this user
      }
      if (!myId) {
        console.log('🔔 ChatContainer: FILTERED OUT - myId is null');
        return; // User not loaded yet — skip
      }
      console.log('🔔 ChatContainer: PASSED filter, incrementing notification count');
      setNotifCenterUnreadCount(prev => prev + 1);
    });
    newSocket.on('permission_approved', (data) => {
      const myId = userIdRef.current;
      if (data?.targetUserIds && myId && !data.targetUserIds.includes(myId)) {
        return; // Not targeted at this user
      }
      if (!myId) return; // User not loaded yet — skip
      setNotifCenterUnreadCount(prev => prev + 1);
    });
    newSocket.on('document_analysis_complete', handleDocumentAnalysisComplete);

    // Agent-triggered visit recording events
    newSocket.on('visit_recording_start', (data) => {
      setActiveVisitId(data.visitId);
    });
    newSocket.on('visit_recording_end', () => {
      setIsRecording(false);
    });

    newSocket.on('visit_summary_ready', (data) => {
      // Open artifact panel to show the visit summary for review
      if (data.visitId && artifactPatientId) {
        openArtifactPanel(artifactPatientId, 'patient_visits', data.visitId);
      }
    });

    console.log('🎯 ChatContainer: Registered listeners for batch_summary, batch_complete, phase1_complete, phase2_complete, batch_started, document_analysis_progress, and document_analysis_complete events');

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [sessionId, handleBatchSummary, handleBatchComplete, handlePhase1Complete, handlePhase2Complete, handleBatchStarted, handleDocumentAnalysisProgress, handleDocumentAnalysisComplete]);

  // Save messages to localStorage - memoized
  const saveMessages = useCallback((messages, sessionId) => {
    try {
      secureStorage.setItem(getUserStorageKey(`messages_${sessionId}`), JSON.stringify(messages));
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to save messages:', err);
      }
    }
  }, [getUserStorageKey]);

  // Listen for grid unpin events to intelligently remove from conversation
  useEffect(() => {
    const handleGridUnpinned = (event) => {
      const { title, patientName } = event.detail;

      // Find the pinned grid message in the conversation
      const gridMessageIndex = messages.findIndex(msg =>
        msg.metadata?.isPinnedGrid &&
        msg.metadata?.gridTitle === title &&
        msg.metadata?.patientName === patientName
      );

      if (gridMessageIndex === -1) return; // Grid not in conversation

      // Check if there are any user messages AFTER this grid
      const messagesAfterGrid = messages.slice(gridMessageIndex + 1);
      const hasUserMessagesAfter = messagesAfterGrid.some(msg => msg.type === 'user');

      if (!hasUserMessagesAfter) {
        // No discussion happened - remove grid from conversation
        const updatedMessages = messages.filter((_, idx) => idx !== gridMessageIndex);
        setMessages(updatedMessages);
        saveMessages(updatedMessages, sessionId);

        // Also delete from database - find by metadata since client ID may not match database ID
        const gridMessage = messages[gridMessageIndex];
        const messageId = gridMessage._id || gridMessage.id;

        // Try to delete by ID first (if it's a database ID)
        if (messageId && !messageId.startsWith('msg_')) {
          secureApi.delete(`/api/chat/sessions/${sessionId}/messages/${messageId}`)
            .catch(() => {}); // Silently ignore
        } else {
          // For client-generated IDs, delete by finding the matching message in database
          secureApi.post(`/api/chat/sessions/${sessionId}/messages/delete-by-metadata`, {
            metadata: {
              isPinnedGrid: true,
              gridTitle: title,
              patientName: patientName
            }
          }).catch(() => {}); // Silently ignore
        }
      } else {
        // Discussion happened - keep grid but mark as unpinned
        const updatedMessages = [...messages];
        updatedMessages[gridMessageIndex].metadata.isPinnedGrid = false;
        setMessages(updatedMessages);
        saveMessages(updatedMessages, sessionId);
      }
    };

    window.addEventListener('gridUnpinned', handleGridUnpinned);
    return () => window.removeEventListener('gridUnpinned', handleGridUnpinned);
  }, [messages, sessionId, saveMessages, secureApi]);

  // Get last agent message for password detection - memoized
  const lastAgentMessage = useMemo(() => {
    const agentMessages = messages.filter(m => m.type === 'agent');
    return agentMessages.length > 0 ?
      agentMessages[agentMessages.length - 1].content : null;
  }, [messages]);

  // Create or ensure session exists in database - memoized
  const ensureSessionInDatabase = useCallback(async (sessionId, title = null) => {
    try {
      const createKey = `creating_session_${sessionId}`;
      if (window[createKey]) {
        console.log('📝 Skipping duplicate session creation for:', sessionId);
        return;
      }
      window[createKey] = true;

      console.log('📝 Ensuring session exists in database:', sessionId);
      console.log('📝 [SESSION CREATE] Input title:', title, 'Type:', typeof title);

      let sanitizedTitle = title;
      if (title && typeof title === 'object') {
        console.log('⚠️ [SESSION CREATE] Title is an object, sanitizing:', title);
        sanitizedTitle = title[actualLanguage] || title.en || title.he ||
                        (actualLanguage === 'he' ? 'שיחה חדשה' : 'New Chat');
      }
      sanitizedTitle = String(sanitizedTitle || (actualLanguage === 'he' ? 'שיחה חדשה' : 'New Chat')).trim();
      if (!sanitizedTitle || sanitizedTitle === '[object Object]' || sanitizedTitle === 'undefined') {
        console.log('⚠️ [SESSION CREATE] Invalid sanitized title:', sanitizedTitle, '- using default');
        sanitizedTitle = actualLanguage === 'he' ? 'שיחה חדשה' : 'New Chat';
      }
      console.log('📝 [SESSION CREATE] Final sanitized title:', sanitizedTitle);

      const createResponse = await secureApi.post('/api/chat/sessions', {
          sessionId: sessionId,
          title: sanitizedTitle,
          language: actualLanguage
      });

      if (createResponse.error) {
        console.error('❌ Failed to create session in database:', {
          sessionId,
          error: createResponse.error,
          status: createResponse.status,
          message: createResponse.message
        });
        return;
      } else if (createResponse.success) {
        console.log('✅ Session actually created/confirmed in database:', sessionId, 'Created:', createResponse.data?.created);

        if (createResponse.data?.created === true) {
          setRefreshTrigger(prev => prev + 1);
          console.log('📝 New session created in database, triggered sidebar refresh');
        } else {
          console.log('📝 Session already existed in database');
        }
      }
    } catch (error) {
      if (error.status !== 409) {
        console.error('Error ensuring session in database:', error);
      }
    } finally {
      const createKey = `creating_session_${sessionId}`;
      setTimeout(() => {
        delete window[createKey];
      }, 1000);
    }
  }, [actualLanguage]);

  // Function to stop AI generation
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      console.log('🛑 Stopping AI generation...');
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  // Handle streaming response from chat endpoint via secureApi
  const handleStreamingResponse = useCallback(async (endpoint, requestData, newMessages) => {
    return new Promise((resolve, reject) => {
      try {
        let streamedContent = '';
        let thinkingContent = ''; // Track thinking separately
        let finalResponse = null;
        let lastMessageId = null; // Track message ID to avoid duplicates
        let currentMessages = [...newMessages]; // Track messages locally to preserve thinking

        // Use secureApi.streamingPost to handle SSE streaming with proper security
        secureApi.streamingPost(
          endpoint,
          requestData,
          (chunk) => {
            // Process each chunk from the stream
            try {
              if (chunk.type === 'start') {
                console.log('✅ [Streaming] Stream started, sessionId:', chunk.sessionId);
              } else if (chunk.type === 'compaction_start') {
                // Auto-compaction started — show a live progress card until 'compacted' arrives.
                console.log('🗜️ [Streaming] Compaction started:', chunk.foldingCount, 'messages');
                currentMessages = currentMessages.filter(m => m.type !== 'compaction_progress');
                currentMessages.push({
                  id: 'compaction_progress_active',
                  type: 'compaction_progress',
                  foldingCount: chunk.foldingCount,
                  at: new Date().toISOString(),
                });
                setMessages([...currentMessages]);
              } else if (chunk.type === 'compacted') {
                // Compaction finished — replace the progress card with the summary divider (Phase 3).
                console.log('🗜️ [Streaming] Conversation compacted:', chunk.foldedCount, 'summarized');
                currentMessages = currentMessages.filter(m => m.type !== 'compaction_progress');
                currentMessages.push({
                  id: `compaction_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                  type: 'compaction_marker',
                  foldedCount: chunk.foldedCount,
                  keptCount: chunk.keptCount,
                  summaryPreview: chunk.summaryPreview,
                  at: chunk.at || new Date().toISOString(),
                });
                setMessages([...currentMessages]);
              } else if (chunk.type === 'thinking') {
                console.log('🤔 [Streaming] Thinking:', chunk.content);

                // Accumulate all thinking into ONE consolidated message
                const thinkingMessageId = `msg_thinking`;
                let thinkingMessage = currentMessages.find(m => m.id === thinkingMessageId);

                if (thinkingMessage) {
                  // Append to existing thinking message with newline
                  thinkingMessage.content += '\n' + chunk.content;
                  if (thinkingMessage.metadata?.chainOfThoughts) {
                    thinkingMessage.metadata.chainOfThoughts.push(chunk.content);
                  }
                } else {
                  // Create new consolidated thinking message
                  thinkingMessage = {
                    id: thinkingMessageId,
                    type: 'agent',
                    content: chunk.content,
                    isThinking: true,
                    timestamp: new Date().toISOString(),
                    metadata: {
                      chainOfThoughts: [chunk.content]
                    }
                  };
                  currentMessages.push(thinkingMessage);
                }

                console.log('📝 [STREAMING - LIVE] Updated thinking message');

                // Update UI with consolidated thinking
                setMessages([...currentMessages]);

                // INTERLEAVING FIX: Don't save thinking messages to DB yet
                // They will be saved as interleaved fragments in the 'done' handler
                // This prevents duplication on refresh

                // Scroll to bottom
                setTimeout(() => {
                  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                }, 0);
              } else if (chunk.type === 'chunk' || chunk.type === 'text') {
                // Accumulate content silently - NO typewriter effect
                streamedContent += chunk.content;

                if (process.env.NODE_ENV !== 'production') {
                  console.log('📨 [Streaming] Chunk received (' + chunk.type + '):', chunk.content.substring(0, 50) + '...');
                }
              } else if (chunk.type === 'complete') {
                // Final message received
                // CRITICAL: Don't overwrite streamedContent - keep accumulated chunks
                // Backend's result.message may be empty, so use what we accumulated
                // FIXED: Check both chunk.content AND chunk.data (batch processing uses chunk.data)
                if (chunk.content && chunk.content.length > 0) {
                  streamedContent = chunk.content;
                } else if (chunk.data && typeof chunk.data === 'string' && chunk.data.length > 0) {
                  streamedContent = chunk.data;
                }
                // If chunk.content is empty, keep the accumulated streamedContent
                finalResponse = chunk;

                console.log(`✅ [Streaming] Complete message received, final content length: ${streamedContent.length}`);

                // Update the streaming message with final content
                const messageId = `msg_streaming`;
                const finalMessage = {
                  id: messageId,
                  type: 'agent',
                  content: streamedContent,
                  timestamp: new Date().toISOString(),
                  isStreaming: false,
                  // CRITICAL FIX: Include displayType and artifactPanel from chunk for artifact panel triggering
                  displayType: chunk.displayType || chunk.data?.displayType || null,
                  artifactPanel: chunk.artifactPanel || chunk.data?.artifactPanel || null,
                  // MULTI-COLLECTION SUPPORT: Include artifactPanels (plural) for multiple collections
                  artifactPanels: chunk.artifactPanels || chunk.data?.artifactPanels || null
                };

                if (process.env.NODE_ENV !== 'production') {
                  console.log('🔍 [Streaming Complete] finalMessage created:', {
                    hasDisplayType: !!finalMessage.displayType,
                    displayType: finalMessage.displayType,
                    hasArtifactPanel: !!finalMessage.artifactPanel,
                    hasArtifactPanels: !!finalMessage.artifactPanels,
                    artifactPanelsCount: finalMessage.artifactPanels?.length || 0
                  });
                }

                // Update or add final message while preserving thinking
                const existingStreamingIndex = currentMessages.findIndex(m => m.id === messageId);
                if (existingStreamingIndex >= 0) {
                  currentMessages[existingStreamingIndex] = finalMessage;
                } else {
                  currentMessages.push(finalMessage);
                }
                setMessages([...currentMessages]);
                saveMessages([...currentMessages], sessionId);

                // DISABLED INTERLEAVING - It was fragmenting text mid-sentence and causing duplication
                // Instead, save the complete streaming message as-is
                console.log('💾 [Message Save] Saving complete streaming message to database');

                const streamingMsg = finalMessage;

                // Save the complete streaming message (NOT fragmented)
                // CRITICAL: Include sequenceNumber: 2 so it sorts AFTER thinking message (sequenceNumber: 1)
                secureApi.post(`/api/chat/sessions/${sessionId}/messages`, {
                  type: 'agent',
                  content: streamingMsg.content,
                  language: language,
                  metadata: {
                    isThinking: false,
                    displayType: streamingMsg.displayType,
                    artifactPanel: streamingMsg.artifactPanel,
                    sequenceNumber: 2  // After thinking message (1)
                  }
                }).catch(err => console.warn('⚠️ Failed to save streaming message:', err));

                if (process.env.NODE_ENV !== 'production') {
                  console.log('🔍 [Streaming] Complete response:', {
                    contentLength: streamedContent.length,
                    hasFunctionCall: !!chunk.functionCalled,
                    hasResult: !!chunk.functionResult
                  });
                }
              } else if (chunk.type === 'done') {
                console.log('🏁 [Streaming] Done event received');

                // DEBUG: Verify that interleaving already happened in 'complete' handler
                const hasInterleavedMessages = currentMessages.some(m => m.isFragment === true);
                const hasStreamingMessage = currentMessages.some(m => m.id === 'msg_streaming');

                console.log('🏁 [Streaming] Final currentMessages state:', {
                  totalMessages: currentMessages.length,
                  hasInterleavedMessages: hasInterleavedMessages,
                  hasStreamingMessage: hasStreamingMessage,
                  ids: currentMessages.map(m => m.id)
                });

                if (hasInterleavedMessages) {
                  console.log('✅ [Interleaving] Interleaving was successful in complete handler');
                } else if (hasStreamingMessage) {
                  console.log('ℹ️ [Interleaving] No interleaving (no thinking messages or condition not met)');
                } else {
                  console.warn('⚠️ [Interleaving] Neither interleaved messages nor streaming message found - unexpected state');
                }

                // Resolve with the final response
                // CRITICAL: Pass currentMessages to preserve thinking message!
                if (chunk.data) {
                  // chunk.data contains the complete result
                  console.log('✅ [Streaming] Resolving with chunk.data + currentMessages');
                  resolve({ ...chunk.data, _currentMessages: currentMessages });
                } else if (finalResponse) {
                  console.log('✅ [Streaming] Resolving with finalResponse + currentMessages');
                  resolve({
                    data: {
                      message: streamedContent || finalResponse.content,
                      actionTaken: finalResponse.functionCalled,
                      actionResult: finalResponse.functionResult,
                      metadata: finalResponse.metadata
                    },
                    _currentMessages: currentMessages
                  });
                } else {
                  console.log('✅ [Streaming] Resolving with streamedContent + currentMessages');
                  resolve({
                    data: {
                      message: streamedContent
                    },
                    _currentMessages: currentMessages
                  });
                }
              } else if (chunk.type === 'error') {
                console.error('❌ [Streaming] Error received:', chunk.error);
                reject(new Error(chunk.error?.message || 'Streaming error'));
              }
            } catch (chunkError) {
              console.error('❌ [Streaming] Error processing chunk:', chunkError);
            }
          },
          { signal: abortControllerRef.current?.signal }
        ).catch(reject);

        // Handle abort signal
        if (abortControllerRef.current) {
          abortControllerRef.current.signal.addEventListener('abort', () => {
            console.log('🛑 [Streaming] Aborted by user');
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }
      } catch (error) {
        console.error('❌ [Streaming] Setup error:', error);
        reject(error);
      }
    });
  }, [sessionId, saveMessages]);

  // INTERLEAVING FIX: Fragment text by thinking boundaries
  const fragmentTextByThinkingBoundaries = useCallback((fullText, thinkingMessages) => {
    if (!thinkingMessages || thinkingMessages.length === 0) {
      return [{ content: fullText }];
    }

    // Split text into N+1 fragments where N = number of thinking messages
    const fragmentCount = thinkingMessages.length + 1;
    const avgFragmentLength = Math.floor(fullText.length / fragmentCount);

    const fragments = [];
    let offset = 0;

    for (let i = 0; i < fragmentCount; i++) {
      const isLast = (i === fragmentCount - 1);
      const length = isLast ? (fullText.length - offset) : avgFragmentLength;

      fragments.push({
        content: fullText.substring(offset, offset + length).trim(),
        fragmentIndex: i
      });

      offset += length;
    }

    return fragments.filter(f => f.content.length > 0);
  }, []);

  // INTERLEAVING FIX: Interleave text fragments with thinking messages
  const interleaveMessagesWithFragments = useCallback((thinkingMsg, streamingMsg, userMsg) => {
    const thinkingArray = thinkingMsg.metadata?.chainOfThoughts || [];
    const textFragments = fragmentTextByThinkingBoundaries(streamingMsg.content, thinkingArray);

    const interleaved = [];
    // Use SAME timestamp for all messages so they group together
    const baseTimestamp = new Date(streamingMsg.timestamp).toISOString();

    // CRITICAL: Use sequence number to preserve order when loading from database
    let sequenceNumber = 0;

    // Start with user message
    if (userMsg) {
      interleaved.push({
        ...userMsg,
        sequenceNumber: sequenceNumber++  // Ensure user message is first
      });
    }

    // Interleave: [text fragment] [thinking] [text fragment] [thinking] [final text fragment]
    for (let i = 0; i < textFragments.length; i++) {
      if (textFragments[i].content) {
        interleaved.push({
          id: `msg_text_${Date.now()}_${i}`,
          type: 'agent',
          content: textFragments[i].content,
          timestamp: baseTimestamp,  // SAME timestamp for grouping
          isFragment: true,
          fragmentIndex: i,
          sequenceNumber: sequenceNumber++  // Preserve order
        });
      }

      if (i < thinkingArray.length) {
        interleaved.push({
          id: `msg_thinking_${Date.now()}_${i}`,
          type: 'agent',
          content: thinkingArray[i],
          isThinking: true,
          timestamp: baseTimestamp,  // SAME timestamp for grouping
          metadata: { isIndividualThinking: true },
          sequenceNumber: sequenceNumber++  // Preserve order
        });
      }
    }

    console.log('✅ [Interleaving] Created interleaved array with sequence numbers:', {
      totalMessages: interleaved.length,
      sequences: interleaved.map(m => `${m.sequenceNumber}:${m.isThinking ? 'T' : m.type === 'user' ? 'U' : 'A'}`)
    });

    return interleaved;
  }, [fragmentTextByThinkingBoundaries]);

  // Send message to backend with files - main function with optimizations
  const sendMessage = useCallback(async (actualMessage, displayMessage = actualMessage, isPassword, files = []) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('📥 ChatContainer received:', {
        message: actualMessage,
        hasFiles: files && files.length > 0,
        filesCount: files ? files.length : 0,
        fileNames: files ? files.map(f => f.name) : []
      });
    }

    if (!actualMessage.trim() || isLoading) return;

    // Barge-in: stop any TTS playback immediately when user sends a new message
    stopSpeaking();

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    if (isLogoutCommand(actualMessage)) {
      handleLogout();
      return;
    }

    const userMessage = {
      id: `msg_${Date.now()}`,
      type: 'user',
      content: displayMessage,
      originalContent: isPassword ? actualMessage : undefined,
      timestamp: new Date().toISOString(),
      isMasked: isPassword,
      hasFiles: files && files.length > 0,
      fileCount: files ? files.length : 0
    };

    // CRITICAL: Remove old streaming/thinking messages before adding new user message
    // This prevents old thinking messages from persisting across multiple questions
    let newMessages = messages.filter(m => m.id !== 'msg_streaming' && m.id !== 'msg_thinking');
    newMessages.push(userMessage);

    console.log('🔍 [SEND MESSAGE] Cleaned messages:', {
      before: messages.length,
      after: newMessages.length,
      removedStreaming: messages.some(m => m.id === 'msg_streaming'),
      removedThinking: messages.some(m => m.id === 'msg_thinking')
    });

    setMessages(newMessages);
    saveMessages(newMessages, sessionId);

    setIsLoading(true);

    // CRITICAL FIX: Ensure session exists in database BEFORE saving user message
    // Otherwise, the user message save fails with 404 if this is a new session
    console.log('🔍 [SEND MESSAGE] Ensuring session exists with title:', sessionTitle, 'Type:', typeof sessionTitle);
    await ensureSessionInDatabase(sessionId, sessionTitle || null);

    // CRITICAL: Save user message to database immediately so agent can load conversation history
    // This is essential for multi-turn conversations
    // Now safe to save because session is guaranteed to exist
    try {
      await secureApi.post(`/api/chat/sessions/${sessionId}/messages`, {
        type: 'user',
        sender: 'user',
        content: actualMessage,
        language: language,
        metadata: {
          userMessage: true,
          timestamp: new Date().toISOString()
        }
      });
      console.log('✅ [ChatContainer] User message saved to database for session:', sessionId);
    } catch (err) {
      console.error('⚠️ [ChatContainer] Failed to save user message to database:', err);
      // Continue anyway - non-blocking
    }

    // Check if session exists in localStorage
    const sessions = JSON.parse(secureStorage.getItem(getUserStorageKey('chat_sessions')) || '[]');
    const sessionExists = sessions.find(s => s.id === sessionId);

    if (!sessionExists) {
      // Use the actual session title if available, not a default "New Chat"
      const actualTitle = sessionTitle || (actualLanguage === 'he' ? 'שיחה חדשה' : 'New Chat');
      const newSession = {
        id: sessionId,
        title: actualTitle, // Use the actual title, not always "New Chat"
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      };
      sessions.unshift(newSession);
      secureStorage.setItem(getUserStorageKey('chat_sessions'), JSON.stringify(sessions.slice(0, 20)));
      console.log('📝 Added new session to localStorage with title:', actualTitle);
    } else {
      // Update existing session's lastActive time and title if changed
      const updatedSessions = sessions.map(s => {
        if (s.id === sessionId) {
          return {
            ...s,
            lastActive: new Date().toISOString(),
            // Update title if it has changed from default
            title: sessionTitle && sessionTitle !== 'New Chat' && sessionTitle !== 'שיחה חדשה'
                   ? sessionTitle
                   : s.title
          };
        }
        return s;
      });
      secureStorage.setItem(getUserStorageKey('chat_sessions'), JSON.stringify(updatedSessions.slice(0, 20)));
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 Sending chat request:', {
        url: `/api/agent/agent-sdk/chat`,
        usingCookieAuth: true,
        usingAgentSDK: true,
        practice: practice
      });
    }

    try {
      let response;

      if (files && files.length > 0) {
        const formData = new FormData();

        files.forEach((file, index) => {
          formData.append('files', file);
        });

        formData.append('message', actualMessage);
        formData.append('sessionId', sessionId);
        formData.append('language', language);
        formData.append('practice', practice);

        const uploadEndpoint = `/api/agent/upload-document`;

        const uploadResponse = await secureApi.post(uploadEndpoint, formData, { signal: abortControllerRef.current.signal });

        if (uploadResponse.error) {
          throw new Error(`Upload failed: ${uploadResponse.error.message || 'Unknown error'}`);
        }

        const uploadResult = uploadResponse;
        if (process.env.NODE_ENV !== 'production') {
          console.log('📎 Files uploaded:', uploadResult);
        }

        let enhancedMessage = actualMessage;

        if (uploadResult.uploadContext?.processed && uploadResult.uploadContext?.results) {
          const docIds = uploadResult.uploadContext.results
            .filter(r => r.success && r.documentId)
            .map(r => r.documentId);

          if (docIds.length > 0) {
            enhancedMessage = actualMessage + `\n[DOCUMENT_IDS: ${docIds.join(', ')}]`;
          }
        }

        // Collect pinned items from current conversation for context
        if (process.env.NODE_ENV !== 'production') {
          console.log('🔍 All messages in conversation (file upload):', messages.length);
          console.log('🔍 Messages with metadata:', messages.filter(m => m.metadata).map(m => ({
            type: m.type,
            isPinnedGrid: m.metadata?.isPinnedGrid,
            gridTitle: m.metadata?.gridTitle
          })));
        }

        const pinnedItems = messages
          .filter(msg => msg.metadata?.isPinnedGrid || msg.metadata?.isPinnedAnswer)
          .map(msg => ({
            type: msg.metadata?.isPinnedGrid ? 'grid' : 'answer',
            title: msg.metadata?.gridTitle || msg.metadata?.answerTitle,
            content: msg.content,
            data: msg.displayData || msg.functionResult,
            timestamp: msg.timestamp
          }));

        if (process.env.NODE_ENV !== 'production') {
          console.log('📌 Filtered pinned items (file upload):', pinnedItems.length);
          if (pinnedItems.length > 0) {
            console.log('📌 Pinned items details:', pinnedItems);
          }
        }

        // Include artifact panel context if open
        const artifactContext = artifactPanelOpen ? {
          patientId: artifactPatientId || null,  // Can be null for direct-grid (patient lists)
          // CRITICAL: When viewing categories list, category should be null (not stale previous category)
          category: artifactLevel === 'categories' ? null : artifactCategory,
          documentId: artifactDocumentId,
          level: artifactLevel,
          // CRITICAL: For direct-grid (ephemeral function results), include the grid data
          // Backend will fetch from MongoDB for other levels (grid, document-collection, detail)
          ...(artifactLevel === 'direct-grid' && artifactGridData ? { gridData: artifactGridData } : {})
        } : undefined;

        // Use streaming for file upload chat requests too (same as regular messages)
        // CRITICAL FIX: secureApi.post() doesn't handle SSE streams properly, causing
        // intermittent truncated/partial output. handleStreamingResponse() parses SSE correctly.
        try {
          response = await handleStreamingResponse(
            '/api/agent/agent-sdk/chat',
            {
              message: enhancedMessage,
              sessionId: sessionId,
              language: language,
              practice: practice,
              uploadInfo: {
                uploadId: uploadResult.uploadId,
                fileCount: uploadResult.fileCount,
                processed: uploadResult.uploadContext?.processed || false,
                fileNames: uploadResult.uploadContext?.fileNames || files.map(f => f.name),
                ...(files.length === 1 && files[0]?.name ? { fileName: files[0].name } : {}),
                ...(files.length === 1 && files[0]?.type ? { mimeType: files[0].type } : {}),
                csvType: uploadResult.uploadContext?.csvType || null
              },
              pinnedContext: pinnedItems.length > 0 ? pinnedItems : undefined,
              artifactContext: artifactContext
            },
            newMessages
          );
        } catch (streamError) {
          // If streaming fails, retry with regular response mode
          console.warn('⚠️ [ChatContainer] File upload streaming failed, retrying as regular request:', streamError);
          response = await secureApi.post('/api/agent/agent-sdk/chat', {
              message: enhancedMessage,
              sessionId: sessionId,
              language: language,
              practice: practice,
              uploadInfo: {
                uploadId: uploadResult.uploadId,
                fileCount: uploadResult.fileCount,
                processed: uploadResult.uploadContext?.processed || false,
                fileNames: uploadResult.uploadContext?.fileNames || files.map(f => f.name),
                ...(files.length === 1 && files[0]?.name ? { fileName: files[0].name } : {}),
                ...(files.length === 1 && files[0]?.type ? { mimeType: files[0].type } : {}),
                csvType: uploadResult.uploadContext?.csvType || null
              },
              pinnedContext: pinnedItems.length > 0 ? pinnedItems : undefined,
              artifactContext: artifactContext
          }, { signal: abortControllerRef.current.signal });
        }
      } else {
        // Regular message without files

        // Collect pinned items from current conversation for context
        if (process.env.NODE_ENV !== 'production') {
          console.log('🔍 All messages in conversation (regular message):', messages.length);
          console.log('🔍 Messages with metadata:', messages.filter(m => m.metadata).map(m => ({
            type: m.type,
            isPinnedGrid: m.metadata?.isPinnedGrid,
            gridTitle: m.metadata?.gridTitle,
            hasDisplayData: !!m.displayData,
            hasFunctionResult: !!m.functionResult
          })));
        }

        const pinnedItems = messages
          .filter(msg => msg.metadata?.isPinnedGrid || msg.metadata?.isPinnedAnswer)
          .map(msg => ({
            type: msg.metadata?.isPinnedGrid ? 'grid' : 'answer',
            title: msg.metadata?.gridTitle || msg.metadata?.answerTitle,
            content: msg.content,
            data: msg.displayData || msg.functionResult,
            timestamp: msg.timestamp
          }));

        if (process.env.NODE_ENV !== 'production') {
          console.log('📌 Pinned items being sent to Claude:', pinnedItems.length);
          pinnedItems.forEach((item, idx) => {
            console.log(`  ${idx + 1}. ${item.type}: ${item.title}`);
            console.log(`     Has data: ${!!item.data}, Data records: ${item.data?.data?.length || 0}`);
          });
        }

        // Include artifact panel context if open
        const artifactContext = artifactPanelOpen ? {
          patientId: artifactPatientId || null,  // Can be null for direct-grid (patient lists)
          // CRITICAL: When viewing categories list, category should be null (not stale previous category)
          category: artifactLevel === 'categories' ? null : artifactCategory,
          documentId: artifactDocumentId,
          level: artifactLevel,
          // CRITICAL: For direct-grid (ephemeral function results), include the grid data
          // Backend will fetch from MongoDB for other levels (grid, document-collection, detail)
          ...(artifactLevel === 'direct-grid' && artifactGridData ? { gridData: artifactGridData } : {})
        } : undefined;

        console.log('🎨 [ChatContainer] Artifact context being sent:', {
          artifactPanelOpen,
          artifactPatientId,
          artifactCategory,
          artifactContext
        });

        // Use POST streaming endpoint for real-time message display
        // The POST /api/agent/agent-sdk/chat endpoint supports both streaming and agentic tool execution
        try {
          response = await handleStreamingResponse(
            '/api/agent/agent-sdk/chat',
            {
              message: actualMessage,
              sessionId: sessionId,
              language: language,
              practice: practice,
              pinnedContext: pinnedItems.length > 0 ? pinnedItems : undefined,
              artifactContext: artifactContext
            },
            newMessages
          );
        } catch (streamError) {
          // If streaming fails, retry with regular response mode
          console.warn('⚠️ [ChatContainer] Streaming failed, retrying as regular request:', streamError);
          response = await secureApi.post('/api/agent/agent-sdk/chat', {
              message: actualMessage,
              sessionId: sessionId,
              language: language,
              practice: practice,
              pinnedContext: pinnedItems.length > 0 ? pinnedItems : undefined,
              artifactContext: artifactContext
          }, { signal: abortControllerRef.current.signal });
        }
      }

      if (response.error) {
        throw new Error(`Server error: ${response.error.message || 'Unknown error'}`);
      }

      const data = response;

      // CRITICAL DEBUG: Log FULL response structure to diagnose artifact panel issue
      console.log('🔍 [ChatContainer] Full response structure:', {
        topLevel: Object.keys(data),
        dataKeys: data.data ? Object.keys(data.data) : null,
        displayType_topLevel: data.displayType,
        displayType_nested: data.data?.displayType,
        artifactPanel_topLevel: data.artifactPanel,
        artifactPanel_nested: data.data?.artifactPanel,
        displayData_nested: data.data?.displayData,
        data_nested: data.data?.data,
        skipClaudeFormatting_topLevel: data.skipClaudeFormatting,
        skipClaudeFormatting_nested: data.data?.skipClaudeFormatting,
        directReturn_topLevel: data.directReturn,
        directReturn_nested: data.data?.directReturn,
        fullData: data
      });

      if (process.env.NODE_ENV !== 'production') {
        console.log('🔍 Agent response received:', data);
      }

      const extractMessage = (msg) => {
        if (typeof msg === 'object' && msg !== null && ('he' in msg || 'en' in msg)) {
          return msg[language] || msg.en || msg.he || 'No response';
        }
        return msg;
      };

      // CRITICAL FIX: Check if data.data is a string first (batch processing messages)
      // Before looking for nested message fields
      console.log('🔍 [RESPONSE CONTENT] Extracting message from:', {
        hasDataData: !!data.data,
        dataDataType: typeof data.data,
        dataDataValue: typeof data.data === 'string' ? data.data.substring(0, 100) : data.data,
        hasDataMessage: !!data.message,
        dataMessage: data.message?.substring ? data.message.substring(0, 100) : data.message,
        hasResponse: !!data.response,
        hasText: !!data.text
      });

      // Extract message from response - check multiple possible locations
      // For SSE streaming responses, the data might be at different levels
      let responseContent = 'No response';

      // CRITICAL: Check if data is a raw SSE stream string first
      if (typeof data === 'string' && data.includes('data: {')) {
        // Parse SSE stream to get the complete event's data field
        const completeMatch = data.match(/data: \{"type":"complete"[^}]*"data":"([^"]+)"/);
        if (completeMatch) {
          // Unescape the message string
          responseContent = completeMatch[1].replace(/\\n/g, '\n');
        } else {
          // Try to find any message in the stream
          const lines = data.split('\n').filter(line => line.startsWith('data: {'));
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line.substring(6)); // Remove 'data: ' prefix
              if (parsed.data && typeof parsed.data === 'string') {
                responseContent = parsed.data;
                break;
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      } else if (typeof data === 'string' && !data.includes('data: {')) {
        // Raw string response (but not SSE stream)
        responseContent = data;
      } else if (typeof data.data === 'string' && !data.data.includes('data: {')) {
        // data.data is the message string (but not SSE stream)
        responseContent = data.data;
      } else {
        // Try to extract from nested objects
        responseContent = extractMessage(data.data?.message) ||
                         extractMessage(data.message) ||
                         extractMessage(data.data?.data) ||
                         extractMessage(data.response) ||
                         extractMessage(data.text) ||
                         'No response';
      }

      // Override message for batch processing
      if (files && files.length > 0 && responseContent.includes('identify the patient')) {
        responseContent = `🔬 **Medical Document Analysis In Progress**

Your ${files.length} document${files.length > 1 ? 's are' : ' is'} being analyzed in the background by our advanced AI system.

**Currently Processing:**
- 👤 Patient identification and demographics
- 🧬 Lab results and diagnostic tests
- 💊 Medications and prescriptions
- 🩺 Vital signs and clinical measurements
- 📋 Diagnoses and medical conditions
- 🏥 Procedures and treatments
- ⚕️ Consultation notes and assessments

**You'll be notified when complete!**

Check the **notifications panel** on the right sidebar (🔔 bell icon) for real-time progress updates.

⏱️ **Estimated completion:** 2-5 minutes

The analysis results will appear automatically when ready - no need to refresh!`;
      }

      console.log('🔍 [RESPONSE CONTENT] Final extracted content:', responseContent.substring(0, 100));

      let functionCall = null;
      let functionResult = null;

      // CRITICAL: In streaming mode, response structure might be flat (data) or nested (data.data)
      const responseData = data.data || data;

      if (responseData?.actionTaken) {
        functionCall = {
          name: responseData.actionTaken,
          args: responseData.actionArgs || responseData.metadata?.functionArgs
        };
        // CRITICAL: actionResult might be an array (multiple tool calls) or single object
        // If it's an array, use it as-is since we'll search it for categories later
        functionResult = responseData.actionResult || responseData.metadata?.functionResult;
      } else if (responseData?.functionCall) {
        functionCall = responseData.functionCall;
        functionResult = responseData.functionResult;
      } else if (responseData?.metadata?.functionName) {
        functionCall = {
          name: responseData.metadata.functionName,
          args: responseData.metadata.functionArgs
        };
        functionResult = responseData.metadata.functionResult;
      }

      if (!functionCall && responseContent.includes('[FUNCTION:')) {
        const functionMatch = responseContent.match(/\[FUNCTION:(\w+)\]/);
        if (functionMatch) {
          functionCall = { name: functionMatch[1] };
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

      // Debug log for displayData
      if (data.data?.displayData || data.data?.displayType || data.displayType) {
        console.log('🎯 [ChatContainer] Received display data:', {
          displayType: data.data?.displayType || data.displayType,
          patientCount: data.data?.displayData?.patients?.length || 0,
          artifactPanelNested: data.data?.artifactPanel,
          artifactPanelTopLevel: data.artifactPanel
        });
      }

      // Debug log functionResult structure
      console.log('🔍 [ChatContainer] functionResult structure:', {
        functionResult: functionResult,
        isArray: Array.isArray(functionResult),
        hasCategories: !!functionResult?.categories,
        hasExportable: !!functionResult?.exportable,
        functionResultKeys: functionResult ? Object.keys(functionResult) : []
      });

      // CRITICAL: If functionResult is an array (multiple tool calls), find the one with categories
      // ALSO check data/responseData at top level (for displayType='categoriesList')
      let categoriesData = null;
      console.log('🔍 [ChatContainer] Checking functionResult for categories:', {
        isArray: Array.isArray(functionResult),
        functionResultType: typeof functionResult,
        functionResultKeys: functionResult ? Object.keys(functionResult) : null,
        hasCategories: !!functionResult?.categories,
        hasExportable: !!functionResult?.exportable,
        categoriesCount: Array.isArray(functionResult?.categories) ? functionResult.categories.length : 'N/A'
      });

      if (Array.isArray(functionResult)) {
        // Find the result that has categories (from getCollectionsWithData)
        categoriesData = functionResult.find(result => result?.categories && result?.exportable);
        console.log('🔍 [ChatContainer] Found categories in array:', {
          found: !!categoriesData,
          patientName: categoriesData?.patientName,
          categoriesCount: categoriesData?.categories?.length,
          displayType: categoriesData?.displayType
        });
      } else if (functionResult?.categories) {
        // Single result with categories
        categoriesData = functionResult;
        console.log('✅ [ChatContainer] Categories found in single result:', {
          patientName: categoriesData.patientName,
          categoriesCount: categoriesData.categories.length,
          displayType: categoriesData.displayType
        });
      } else if (data.categories) {
        // CRITICAL FIX: Categories might be at top level (displayType='categoriesList')
        categoriesData = data;
        console.log('✅ [ChatContainer] Categories found at top level of response:', {
          patientName: data.patientName,
          categoriesCount: data.categories?.length,
          displayType: data.displayType
        });
      } else {
        console.log('⚠️ [ChatContainer] No categories found in functionResult or top level');
      }

      // CRITICAL FIX: Update existing streaming message instead of creating new one
      // This preserves thinking messages that were displayed earlier
      // IMPORTANT: Use current messages state, not captured newMessages (which may be stale from streaming)
      const streamingMessageId = 'msg_streaming';
      const existingStreamingIndex = messages.findIndex(m => m.id === streamingMessageId);

      // CRITICAL FIX: Detect if this is a background processing message
      // These messages need to persist in database to survive page refresh
      // Check the backend flag (data.data.backgroundProcessing) instead of text content
      const isBackgroundProcessingMessage = data?.data?.backgroundProcessing === true ||
        (files && files.length > 0 && (responseContent.includes('identify the patient') || responseContent.includes('עיבוד') || responseContent.includes('batch')));

      const agentMessage = {
        id: existingStreamingIndex >= 0 ? streamingMessageId : `msg_${Date.now()}_agent`,
        type: 'agent',
        content: responseContent,
        timestamp: new Date().toISOString(),
        functionCall,
        functionResult,
        metadata: data.data?.metadata || null,
        // Add displayData and displayType for structured rendering
        // If displayType is 'grid', the grid data is directly in data.data (not nested in displayData)
        displayData: data.data?.displayData || (data.data?.displayType === 'grid' ? data.data : null),
        // CRITICAL FIX: Check top-level displayType first (for categoriesList responses)
        displayType: data.displayType || data.data?.displayType || functionResult?.displayType || null,
        // Parse categoryGrids if it's a JSON string
        categoryGrids: data.data?.categoryGrids ?
          (typeof data.data.categoryGrids === 'string' ? JSON.parse(data.data.categoryGrids) : data.data.categoryGrids) :
          null,
        // Include patientId and patientName for medical categories
        patientId: data.data?.patientId || categoriesData?.patientId || functionResult?.patientId || null,
        patientName: data.data?.patientName || categoriesData?.patientName || functionResult?.patientName || null,
        // Extract categories list export data from functionResult (handle array case)
        categories: categoriesData?.categories || functionResult?.categories || null,
        exportable: categoriesData?.exportable || functionResult?.exportable || null,
        // Include artifactPanel for artifact panel trigger
        // FIXED: Check both data.data.artifactPanel and top-level data.artifactPanel
        // Backend returns it at top level when using directReturn
        artifactPanel: data.data?.artifactPanel || data.artifactPanel || (data.data?.displayType === 'openArtifactPanel' ? data.data?.displayData : null),
        // MULTI-COLLECTION SUPPORT: Include artifactPanels (plural) for multiple collections in same turn
        artifactPanels: data.data?.artifactPanels || data.artifactPanels || null,
        isServiceMessage: data.data?.isServiceMessage,
        isError: data.data?.isError,
        requiresAction: data.data?.requiresAction,
        usedFallback: data.data?.usedFallback,
        fallbackProvider: data.data?.fallbackProvider,
        // CRITICAL: Flag for background processing messages to persist in database
        backgroundProcessing: isBackgroundProcessingMessage || false,
        batchId: isBackgroundProcessingMessage ? data.data?.batchId || `batch_${Date.now()}` : null
      };


      // Update existing streaming message OR add new message
      // CRITICAL: Use _currentMessages from streaming if available (has thinking messages!)
      // Fall back to current messages state if not available
      let messagesForUpdate = data._currentMessages || messages;

      console.log('🔍 [RESPONSE HANDLER] Initial messagesForUpdate:', {
        count: messagesForUpdate.length,
        hasThinking: messagesForUpdate.some(m => m.id === 'msg_thinking'),
        hasStreaming: messagesForUpdate.some(m => m.id === 'msg_streaming'),
        ids: messagesForUpdate.map(m => m.id)
      });

      // CRITICAL: Ensure correct message order: [User] [Thinking] [Streaming/Response]
      // Check for 'msg_thinking' (in-memory) OR isThinking flag (from database)
      const thinkingMsg = messagesForUpdate.find(m => m.id === 'msg_thinking' || (m.type === 'agent' && m.isThinking && m.metadata?.chainOfThoughts));
      const streamingIdx = messagesForUpdate.findIndex(m => m.id === 'msg_streaming');
      const thinkingIdx = messagesForUpdate.findIndex(m => m.id === 'msg_thinking' || (m.type === 'agent' && m.isThinking && m.metadata?.chainOfThoughts));

      console.log('🔍 [RESPONSE HANDLER] Initial order check:', {
        hasThinkingMsg: !!thinkingMsg,
        streamingIdx,
        thinkingIdx,
        order: messagesForUpdate.map(m => m.id).slice(-3)
      });

      // ALWAYS reorder to ensure: thinking comes BEFORE streaming
      if (thinkingMsg && streamingIdx >= 0) {
        // Only reorder if thinking is not already before streaming
        if (thinkingIdx === -1 || thinkingIdx > streamingIdx) {
          // Thinking either doesn't exist or is AFTER streaming - move it to before streaming
          messagesForUpdate = messagesForUpdate.filter(m => m.id !== 'msg_thinking' && !(m.type === 'agent' && m.isThinking && m.metadata?.chainOfThoughts));

          // Re-find streaming index after filtering
          const newStreamingIdx = messagesForUpdate.findIndex(m => m.id === 'msg_streaming');
          if (newStreamingIdx >= 0) {
            // Insert thinking right before streaming
            messagesForUpdate.splice(newStreamingIdx, 0, thinkingMsg);
            console.log('✅ [RESPONSE HANDLER] Reordered: thinking now BEFORE streaming');
          }
        } else {
          console.log('✅ [RESPONSE HANDLER] Order already correct: thinking BEFORE streaming');
        }
      }

      let updatedMessages;
      const newStreamingIdx = messagesForUpdate.findIndex(m => m.id === 'msg_streaming');

      console.log('🔍 [RESPONSE HANDLER] Before replacement:', {
        newStreamingIdx,
        totalMessages: messagesForUpdate.length,
        hasThinking: messagesForUpdate.some(m => m.id === 'msg_thinking')
      });

      if (newStreamingIdx >= 0) {
        // Replace the streaming message with enhanced data
        updatedMessages = [...messagesForUpdate];
        updatedMessages[newStreamingIdx] = agentMessage;
      } else {
        // No streaming message exists, add new one
        updatedMessages = [...messagesForUpdate, agentMessage];
      }

      console.log('🔍 [RESPONSE HANDLER] After replacement:', {
        totalMessages: updatedMessages.length,
        hasThinking: updatedMessages.some(m => m.id === 'msg_thinking'),
        hasStreaming: updatedMessages.some(m => m.id === 'msg_streaming'),
        ids: updatedMessages.map(m => m.id)
      });

      // FINAL: Ensure correct order [User] [Thinking] [Response]
      // Find last user message
      let lastUserIdx = -1;
      for (let i = updatedMessages.length - 1; i >= 0; i--) {
        if (updatedMessages[i].type === 'user') {
          lastUserIdx = i;
          break;
        }
      }

      // Find last thinking message
      let lastThinkingIdx = -1;
      for (let i = updatedMessages.length - 1; i >= 0; i--) {
        if (updatedMessages[i].isThinking || updatedMessages[i].id === 'msg_thinking' || (updatedMessages[i].type === 'agent' && updatedMessages[i].metadata?.chainOfThoughts)) {
          lastThinkingIdx = i;
          break;
        }
      }

      // If thinking exists and is NOT right after user, move it
      if (lastThinkingIdx >= 0 && lastUserIdx >= 0 && lastThinkingIdx !== lastUserIdx + 1) {
        console.log('🔄 [RESPONSE HANDLER] Reordering - thinking at', lastThinkingIdx, 'should be at', lastUserIdx + 1);
        const thinkingMsg = updatedMessages[lastThinkingIdx];

        // Remove thinking from current position
        updatedMessages = updatedMessages.filter((_, idx) => idx !== lastThinkingIdx);

        // Re-find user index after removal (it may have shifted)
        lastUserIdx = -1;
        for (let i = updatedMessages.length - 1; i >= 0; i--) {
          if (updatedMessages[i].type === 'user') {
            lastUserIdx = i;
            break;
          }
        }

        // Insert thinking right after user
        if (lastUserIdx >= 0) {
          updatedMessages.splice(lastUserIdx + 1, 0, thinkingMsg);
          console.log('✅ [RESPONSE HANDLER] Thinking now positioned right after user message');
        }
      }

      console.log('🔍 [RESPONSE HANDLER] Final order:', {
        order: updatedMessages.slice(-4).map(m => `${m.type}${m.isThinking ? '(T)' : ''}`)
      });

      setMessages(updatedMessages);
      saveMessages(updatedMessages, sessionId);

      // CRITICAL: Save thinking message to database (chain of thoughts persistence)
      // Check for both 'msg_thinking' (in-memory) and isThinking flag (from database)
      let thinkingMessage = updatedMessages.find(m => m.id === 'msg_thinking');

      // Also check for agent messages with isThinking flag (these are from database reloads)
      if (!thinkingMessage) {
        thinkingMessage = updatedMessages.find(m => m.type === 'agent' && m.isThinking && m.metadata?.chainOfThoughts);
      }

      console.log('🔍 [THINKING SAVE] Looking for thinking message:', {
        found: !!thinkingMessage,
        id: thinkingMessage?.id,
        hasMetadata: !!thinkingMessage?.metadata,
        hasChainOfThoughts: !!thinkingMessage?.metadata?.chainOfThoughts,
        contentLength: thinkingMessage?.content?.length,
        content: thinkingMessage?.content?.substring(0, 100),
        isThinking: thinkingMessage?.isThinking,
        allThinkingMessages: updatedMessages.filter(m => m.isThinking || m.id === 'msg_thinking').map(m => m.id)
      });

      if (thinkingMessage && thinkingMessage.metadata?.chainOfThoughts) {
        try {
          const response = await secureApi.post(`/api/chat/sessions/${sessionId}/messages`, {
            type: 'agent',
            content: thinkingMessage.content,
            language: language,
            metadata: {
              chainOfThoughts: thinkingMessage.metadata.chainOfThoughts,
              sequenceNumber: 1  // CRITICAL: Same as user message, so thinking appears BEFORE agent response
            },
            isThinking: true
          });
          console.log('✅ Thinking messages saved to database:', response?.data?._id);
        } catch (err) {
          console.error('⚠️ Failed to save thinking messages to database:', err);
        }
      } else {
        console.log('⚠️ [THINKING SAVE] Skipping - no thinking message or chainOfThoughts found');
      }

      // CRITICAL: Save background processing messages to database for persistence
      // These generic messages (e.g. "analysis in progress") must survive page refresh
      if (isBackgroundProcessingMessage) {
        try {
          console.log('💾 [BACKGROUND MESSAGE] Saving to database for persistence:', {
            batchId: agentMessage.batchId,
            contentLength: agentMessage.content.length,
            hasFiles: !!files?.length
          });

          const response = await secureApi.post(`/api/chat/sessions/${sessionId}/messages`, {
            type: 'agent',
            content: agentMessage.content,
            language: language,
            metadata: {
              backgroundProcessing: true,
              batchId: agentMessage.batchId,
              fileCount: files?.length || 0,
              sequenceNumber: 2  // After thinking message (1) but before final response (3)
            },
            backgroundProcessing: true,
            batchId: agentMessage.batchId
          });
          console.log('✅ Background processing message saved to database:', response?.data?._id);
        } catch (err) {
          console.error('⚠️ Failed to save background processing message to database:', err);
          // Message is still in React state, so chat will work during this session
        }
      }

      // Backend saves all the message data including displayData and displayType
      // No need to save from frontend
      // Note: Session already ensured at the start of sendMessage, no need to await again

      // Always update title when we get a response
      // Pass the response content string, not an object
      updateSessionTitle(actualMessage, responseContent, sessionId, false);

    } catch (error) {
      // Handle abort - user clicked stop button
      if (error.name === 'AbortError') {
        console.log('✅ AI generation stopped by user');
        const stopMessage = {
          id: `msg_${Date.now()}_stopped`,
          type: 'agent',
          content: language === 'he' ? 'הפסקת על ידי המשתמש' : 'Stopped by user',
          timestamp: new Date().toISOString(),
          isServiceMessage: true
        };
        const updatedMessages = [...newMessages, stopMessage];
        setMessages(updatedMessages);
        saveMessages(updatedMessages, sessionId);
        return;
      }

      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to send message:', error);
      }

      let errorContent = '';
      if (error.response?.data?.error) {
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
      abortControllerRef.current = null;
    }
  }, [messages, sessionId, isLoading, sessionTitle, actualLanguage, language, practice, getUserStorageKey, saveMessages, updateSessionTitle, secureApi, stopSpeaking]);

  // Handle session change - memoized
  const handleSessionChange = useCallback(async (newSessionId) => {
    // Stop any TTS playback from the previous conversation
    stopSpeaking();

    // FIRST: Save current session's artifact state BEFORE switching
    if (sessionId && sessionId !== newSessionId) {
      const currentArtifactState = {
        artifactPanelOpen,
        artifactPatientId,
        artifactCategory,
        artifactDocumentId,
        artifactLevel,
        artifactGridData,
        artifactPatientName
      };

      console.log('💾 [SESSION CHANGE] Saving current artifact state before switching from:', sessionId);
      await saveArtifactStateToDatabase(sessionId, currentArtifactState);
    }

    setSessionId(newSessionId);
    secureStorage.setItem(getUserStorageKey('current_session_id'), newSessionId);
    loadMessages(newSessionId);
    restoreArtifactState(newSessionId);

    if (onSessionChange) {
      onSessionChange(newSessionId);
    }
  }, [sessionId, getUserStorageKey, loadMessages, restoreArtifactState, onSessionChange, artifactPanelOpen, artifactPatientId, artifactCategory, artifactDocumentId, artifactLevel, artifactGridData, artifactPatientName, saveArtifactStateToDatabase, stopSpeaking]);

  // Handle function component actions - memoized
  const handleFunctionAction = useCallback((actionData) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('🎯 Function action triggered:', actionData);
    }

    switch (actionData.action) {
      case 'select':
        if (process.env.NODE_ENV !== 'production') {
          console.log('Patient selected:', actionData.data);
        }
        break;
      case 'view':
        if (process.env.NODE_ENV !== 'production') {
          console.log('View action:', actionData.data);
        }
        break;
      case 'edit':
        if (process.env.NODE_ENV !== 'production') {
          console.log('Edit action:', actionData.data);
        }
        break;
      case 'refill':
        if (process.env.NODE_ENV !== 'production') {
          console.log('Refill medication:', actionData.data);
        }
        break;
      default:
        if (process.env.NODE_ENV !== 'production') {
          console.log('Unhandled action:', actionData);
        }
    }
  }, []);

  // Handle new session - memoized
  const handleNewSession = useCallback(async () => {
    // FIRST: Save current artifact state to database BEFORE switching sessions
    if (sessionId) {
      const currentArtifactState = {
        artifactPanelOpen,
        artifactPatientId,
        artifactCategory,
        artifactDocumentId,
        artifactLevel,
        artifactGridData,
        artifactPatientName
      };

      console.log('💾 [NEW CHAT] Saving current artifact state before switching:', sessionId);
      await saveArtifactStateToDatabase(sessionId, currentArtifactState);
    }

    const newId = generateSessionId();
    const defaultTitle = actualLanguage === 'he' ? 'שיחה חדשה' : 'New Chat';

    setSessionId(newId);
    secureStorage.setItem(getUserStorageKey('current_session_id'), newId);
    setMessages([]);
    setSessionTitle(defaultTitle);

    // ALWAYS close artifact panel and clear ALL artifact state when starting new chat
    // This ensures the AI chooses the regular 3-API-call path, not the direct path
    console.log('🔄 [NEW CHAT] Closing artifact panel and clearing all artifact state');
    setArtifactPanelOpen(false);
    setArtifactPatientId(null);
    setMemoryPanelOpen(false); // also close the memory drawer so its floating controls don't stay shifted
    setArtifactCategory(null);
    setArtifactDocumentId(null);
    setArtifactLevel('categories');

    // Directly clear localStorage to prevent any race conditions with useEffect
    try {
      localStorage.removeItem('artifactPanelOpen');
      localStorage.removeItem('artifactPatientId');
      localStorage.removeItem('artifactCategory');
      localStorage.removeItem('artifactDocumentId');
      localStorage.removeItem('artifactLevel');
      console.log('✅ [NEW CHAT] Cleared all artifact localStorage');
    } catch (error) {
      console.error('Failed to clear artifact localStorage:', error);
    }

    if (onSessionChange) {
      onSessionChange(newId);
    }

    try {
      await ensureSessionInDatabase(newId, defaultTitle);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to create session in database:', err);
      }
    }

    setRefreshTrigger(prev => prev + 1);
    console.log('🆕 Created new session and triggered sidebar refresh:', newId);
  }, [sessionId, generateSessionId, actualLanguage, getUserStorageKey, onSessionChange, artifactPanelOpen, artifactPatientId, artifactCategory, artifactDocumentId, artifactLevel, artifactGridData, artifactPatientName, saveArtifactStateToDatabase]);

  // Inject animations - only once
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
        background: #28395C;
        border-radius: 3px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #93A2BE;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Handle workflow command clicks - memoized
  const handleWorkflowCommand = useCallback((command) => {
    sendMessage(command);
  }, [sendMessage]);

  // Artifact panel handlers
  const openArtifactPanel = useCallback((patientId, category = null, documentId = null) => {
    console.log('🚀 [openArtifactPanel] Called with:', { patientId, category, documentId });

    setArtifactPatientId(patientId);
    setArtifactCategory(category);
    setArtifactDocumentId(documentId);

    // Determine initial level
    let level;
    if (documentId && category) {
      level = 'detail';
    } else if (category) {
      level = 'documents';
    } else {
      level = 'categories';
    }

    console.log('🎯 [openArtifactPanel] Setting level to:', level);
    setArtifactLevel(level);
    setArtifactPanelOpen(true);

    console.log('✅ [openArtifactPanel] Artifact panel state updated - panel should open');

    // Collapse right sidebar when artifact opens
    setRightSidebarOpen(false);
  }, []);

  const closeArtifactPanel = useCallback(() => {
    // Only close the panel, keep the patient data so it can be reopened
    setArtifactPanelOpen(false);
    // Don't clear patientId, category, documentId, or level
    // This allows the sidebar button to reopen with the same data
  }, []);

  // Listen for artifact panel requests from chat messages
  useEffect(() => {
    const handleOpenArtifact = (event) => {
      console.log(`🎯 [ARTIFACT PANEL EVENT] Received openArtifactPanel event`);
      console.log('  Detail:', event.detail);
      console.log(`  Current panel state: ${artifactPanelOpen ? 'OPEN' : 'CLOSED'}`);
      console.log(`  Current category: ${artifactCategory || 'none'}`);
      console.log(`  New category: ${event.detail?.category || event.detail?.type || 'none'}`);

      // Guard: On a refresh/cold restore, every historical <Message> re-fires its
      // openArtifactPanel event on mount with stale data. If the panel is already open
      // (restored from localStorage or the DB), skip these so they don't thrash/close the
      // restored panel. A slow re-login restore can render messages well past a fixed time
      // window, so the primary signal is "no real user interaction has happened yet" — a
      // genuine open always follows a click or keystroke. The 2s window stays as a backstop.
      const msSinceMount = Date.now() - mountTimeRef.current;
      if ((!hasUserInteractedRef.current || msSinceMount < 2000) && artifactPanelOpen) {
        console.log(`⏭️ [ARTIFACT] Skipping re-fired event (interacted=${hasUserInteractedRef.current}, ${msSinceMount}ms after mount) — panel already open`);
        return;
      }

      const { patientId, category, documentId, type, gridData, columns, headers, title, categories, artifactPanels } = event.detail || {};

      // MULTI-COLLECTION SUPPORT: Handle multiple collections returned in same agent turn
      if (type === 'multipleCollections' && artifactPanels && artifactPanels.length > 0) {
        console.log('✅ [ChatContainer] MULTI-COLLECTION: Opening artifact panel with collection selector');
        console.log('   Collections:', artifactPanels.map(p => p.category).join(', '));
        const patientNameFromEvent = event.detail.patientName;
        setArtifactPatientId(patientId);
        setArtifactPatientName(patientNameFromEvent);
        setArtifactCategory(null); // No specific category - show selector
        setArtifactDocumentId(null);
        setArtifactLevel('collection-selector'); // New level for multi-collection selector
        setArtifactPanelOpen(true);
        setArtifactGridData({ artifactPanels }); // Pass all artifact panels

        // Save to localStorage for persistence
        localStorage.setItem('artifactPanelOpen', 'true');
        localStorage.setItem('artifactPatientId', patientId);
        localStorage.setItem('artifactPatientName', patientNameFromEvent || '');
        localStorage.removeItem('artifactCategory');
        localStorage.removeItem('artifactDocumentId');
        localStorage.setItem('artifactLevel', 'collection-selector');
        localStorage.setItem('artifactGridData', JSON.stringify({ artifactPanels }));
      }
      // If type is 'categoriesList', handle categories list display
      else if (type === 'categoriesList' && categories) {
        console.log('✅ [ChatContainer] Opening artifact panel with categories list');
        const patientNameFromEvent = event.detail.patientName;
        setArtifactPatientId(patientId);
        setArtifactPatientName(patientNameFromEvent);
        setArtifactCategory(null); // No specific category selected
        setArtifactDocumentId(null);
        setArtifactLevel('categories');
        setArtifactPanelOpen(true);
        setArtifactGridData({ categories }); // Pass categories data

        // Save to localStorage for persistence
        localStorage.setItem('artifactPanelOpen', 'true');
        localStorage.setItem('artifactPatientId', patientId);
        localStorage.setItem('artifactPatientName', patientNameFromEvent || '');
        localStorage.removeItem('artifactCategory');
        localStorage.removeItem('artifactDocumentId');
        localStorage.setItem('artifactLevel', 'categories');
        localStorage.setItem('artifactGridData', JSON.stringify({ categories }));
      } else if (type === 'grid' && gridData) {
        console.log('✅ [ChatContainer] Opening artifact panel with direct grid data');

        // Extract patient name from event detail
        const patientNameFromEvent = event.detail.patientName;

        setArtifactPatientId(patientId);
        setArtifactPatientName(patientNameFromEvent);
        setArtifactCategory(category);
        setArtifactDocumentId(null);
        setArtifactLevel('direct-grid');
        setArtifactPanelOpen(true);
        setArtifactGridData({ data: gridData, columns, headers, title });

        // Save to localStorage for persistence
        localStorage.setItem('artifactPanelOpen', 'true');
        localStorage.setItem('artifactPatientId', patientId);
        localStorage.setItem('artifactPatientName', patientNameFromEvent || '');
        localStorage.setItem('artifactCategory', category);
        localStorage.setItem('artifactLevel', 'direct-grid');
        localStorage.setItem('artifactGridData', JSON.stringify({ data: gridData, columns, headers, title }));
      } else if (type === 'documents' && gridData) {
        // Documents type with direct data array (like discharge summaries list)
        console.log('✅ [ChatContainer] Opening artifact panel with documents list');

        // Extract patient name from event detail or gridData
        const patientNameFromEvent = event.detail.patientName ||
          (gridData && gridData[0] && gridData[0].patientName);

        // Check if we currently have a categories list open
        const hadCategoriesList = artifactLevel === 'categories' && artifactGridData?.categories;

        setArtifactPatientId(patientId);
        setArtifactPatientName(patientNameFromEvent);
        setArtifactCategory(category);
        setArtifactDocumentId(null); // No specific document selected yet
        setArtifactLevel('documents');
        setArtifactPanelOpen(true);

        // Store documents data for direct rendering (array format)
        // CRITICAL: Preserve categories data if we had it
        const documentsData = hadCategoriesList
          ? { data: gridData, category, patientId, categories: artifactGridData.categories }
          : { data: gridData, category, patientId };
        setArtifactGridData(documentsData);

        // Save to localStorage for persistence
        localStorage.setItem('artifactPanelOpen', 'true');
        localStorage.setItem('artifactPatientId', patientId);
        localStorage.setItem('artifactPatientName', patientNameFromEvent || '');
        localStorage.setItem('artifactCategory', category);
        localStorage.removeItem('artifactDocumentId'); // No specific document
        localStorage.setItem('artifactLevel', 'documents');
        localStorage.setItem('artifactGridData', JSON.stringify(documentsData));

        // IMMEDIATELY save to database (like saving a message!)
        saveArtifactStateToDatabase(sessionId, {
          artifactPanelOpen: true,
          artifactPatientId: patientId,
          artifactPatientName: patientNameFromEvent,
          artifactCategory: category,
          artifactDocumentId: null,
          artifactLevel: 'documents',
          artifactGridData: documentsData
        });
      } else if (type === 'document' && gridData) {
        // Document type with direct data (like patient details)
        console.log('✅ [ChatContainer] Opening artifact panel with document data');

        // Extract patient name from event detail
        const patientNameFromEvent = event.detail.patientName;

        setArtifactPatientId(patientId);
        setArtifactPatientName(patientNameFromEvent);
        setArtifactCategory(category);
        setArtifactDocumentId(documentId);
        setArtifactLevel('detail');
        setArtifactPanelOpen(true);

        // Store document data for direct rendering
        const documentData = { document: gridData, category, patientId };
        setArtifactGridData(documentData);

        // Save to localStorage for persistence
        localStorage.setItem('artifactPanelOpen', 'true');
        localStorage.setItem('artifactPatientId', patientId);
        localStorage.setItem('artifactPatientName', patientNameFromEvent || '');
        localStorage.setItem('artifactCategory', category);
        localStorage.setItem('artifactDocumentId', documentId);
        localStorage.setItem('artifactLevel', 'detail');
        localStorage.setItem('artifactGridData', JSON.stringify(documentData));
      } else if (patientId) {
        console.log('✅ [ChatContainer] Opening artifact panel with:', { patientId, category, documentId });

        // CRITICAL FIX: If category is null (getMedicalHistory called) AND panel is already open,
        // force close and reopen to switch views properly
        if (!category && artifactPanelOpen) {
          console.log('🔄 [ChatContainer] Switching artifact view - closing and reopening panel');

          // Close the panel first
          setArtifactPanelOpen(false);

          // Clear state
          setArtifactCategory(null);
          setArtifactDocumentId(null);
          setArtifactLevel('categories');
          setArtifactGridData(null);

          // Clear from localStorage immediately
          try {
            localStorage.removeItem('artifactCategory');
            localStorage.removeItem('artifactDocumentId');
            localStorage.removeItem('artifactGridData');
            localStorage.setItem('artifactLevel', 'categories');
          } catch (error) {
            console.error('Failed to clear artifact state from localStorage:', error);
          }

          // Reopen after a brief delay to allow React to process the close
          setTimeout(() => {
            console.log('✅ [ChatContainer] Reopening artifact panel with categories view');
            openArtifactPanel(patientId, null, null);
          }, 100);
        } else if (!category) {
          // Panel is closed, just reset state
          console.log('🔄 [ChatContainer] No category specified - resetting to categories view');
          setArtifactCategory(null);
          setArtifactDocumentId(null);
          setArtifactLevel('categories');
          try {
            localStorage.removeItem('artifactCategory');
            localStorage.removeItem('artifactDocumentId');
            localStorage.setItem('artifactLevel', 'categories');
          } catch (error) {
            console.error('Failed to clear artifact state from localStorage:', error);
          }
          openArtifactPanel(patientId, category, documentId);
        } else {
          // Normal case with category specified
          openArtifactPanel(patientId, category, documentId);
        }
      } else {
        console.warn('⚠️ [ChatContainer] No patientId in event detail');
      }
    };

    console.log('🎧 [ChatContainer] Setting up openArtifactPanel event listener');
    window.addEventListener('openArtifactPanel', handleOpenArtifact);
    return () => window.removeEventListener('openArtifactPanel', handleOpenArtifact);
  }, [openArtifactPanel, artifactPanelOpen, sessionId, saveArtifactStateToDatabase, artifactCategory, artifactLevel, artifactGridData]);

  // Determine sidebar positions based on language
  const isRTL = actualLanguage === 'he';

  return (
    <div style={STYLES.container}>
      {/* Background removed - clean solid theme */}

      <div style={{
        ...STYLES.mainLayout,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        position: 'relative',
        zIndex: 1
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
            handleSessionChange(sessionId);
          }}
          staffChatCount={staffChat.totalUnreadCount}
          onIconClick={(action) => {
            if (action === 'staff-chat') {
              console.log('💬 [Left Sidebar] Staff chat toggled');
              setStaffChatOpen(prev => !prev);
            }
          }}
          onProfileClick={() => {
            setSettingsTab('profile');
            setShowSettings(true);
          }}
        >
          <div style={STYLES.sidebarPadding}>
            <Sidebar
              currentSessionId={sessionId}
              onSessionChange={handleSessionChange}
              onNewSession={handleNewSession}
              language={actualLanguage}
              refreshTrigger={refreshTrigger}
            />
          </div>
        </CollapsibleSidebar>

        {/* Main Chat Area */}
        <div style={{
          ...STYLES.mainChatArea,
          width: artifactPanelOpen ? '50%' : '100%',
          transition: 'width 0.3s ease'
        }}>
          <ChatArea
            sessionTitle={sessionTitle}
            onNewChat={handleNewSession}
            messages={messages}
            onSendMessage={sendMessage}
            onStopGeneration={stopGeneration}
            isLoading={isLoading}
            language={actualLanguage}
            lastAgentMessage={lastAgentMessage}
            onFunctionAction={handleFunctionAction}
            leftSidebarOpen={leftSidebarOpen}
            rightSidebarOpen={rightSidebarOpen}
            isProvider={isProvider}
            artifactPanelOpen={artifactPanelOpen}
            onTranscriptUpdate={handleTranscriptUpdate}
            onVoiceChatText={null}
            onVisitStarted={handleVisitStarted}
            onVisitEnded={handleVisitEnded}
            isRecording={isRecording}
            setIsRecording={setIsRecording}
            activeVisitId={activeVisitId}
            patientContext={artifactPatientId ? { id: artifactPatientId, name: artifactPatientName } : null}
            onPatientFound={handlePatientFound}
            isSpeaking={isSpeaking}
            ttsEnabled={ttsEnabled}
            onStopSpeaking={stopSpeaking}
            speakingMessageId={speakingMessageId}
            stopRecordingRef={stopRecordingRef}
            onSpeakMessage={speakResponse}
          />

          {/* Live Transcript Card — shown during active visit recording only (not voice chat) */}
          {isRecording && recordingMode === 'visit' && (
            <div style={{
              position: 'fixed',
              bottom: '100px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: artifactPanelOpen
                ? 'calc(50% - 32px - 64px - 40px)'
                : 'calc(100% - 64px - 20px)',
              maxWidth: '768px',
              zIndex: 20,
              padding: '0 20px',
            }}>
              <Suspense fallback={null}>
                <LiveTranscriptCard
                  transcript={liveTranscript}
                  partialText={partialText}
                  duration={recordingDuration}
                  patientName={artifactPatientName || 'Patient'}
                  onEndVisit={() => {
                    // Use the exposed stopRecording function to properly end the WebSocket,
                    // stop audio pipeline, and trigger SOAP generation
                    if (stopRecordingRef.current) {
                      stopRecordingRef.current();
                    } else {
                      // Fallback: at least update UI state
                      setIsRecording(false);
                      setActiveVisitId(null);
                    }
                  }}
                />
              </Suspense>
            </div>
          )}
        </div>

        {/* Patient-memory toggle (compaction runs automatically — no manual control for clinicians) */}
        {artifactPatientId && (
          <div style={{
            position: 'fixed',
            top: '76px',
            // Keep the controls clear of the 380px memory drawer when it's open, else clear of the artifact panel.
            // The 64px right icon-rail (MinimalSidebar, provider-only, LTR-only) must be cleared so
            // neither the button nor the drawer is painted under it.
            [actualLanguage === 'he' ? 'left' : 'right']: memoryPanelOpen
              ? `calc(${isProvider && actualLanguage !== 'he' ? 64 : 0}px + 380px + 16px)`
              : (artifactPanelOpen ? 'calc(50% + 16px)' : `calc(${isProvider && actualLanguage !== 'he' ? 64 : 0}px + 16px)`),
            zIndex: 900,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            {artifactPatientId && (
              <button
                onClick={() => setMemoryPanelOpen(o => !o)}
                title={actualLanguage === 'he' ? 'זיכרון מטופל' : 'Patient memory'}
                style={{
                  width: '38px', height: '38px', borderRadius: '10px',
                  border: `1px solid ${memoryPanelOpen ? '#2563eb' : 'rgba(96,165,250,0.30)'}`,
                  background: memoryPanelOpen ? '#2563eb' : 'rgba(15,27,51,0.92)',
                  color: memoryPanelOpen ? '#ffffff' : '#93c5fd',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.35)', cursor: 'pointer', fontSize: '18px', lineHeight: 1,
                  backdropFilter: 'blur(4px)', transition: 'background 0.15s, border-color 0.15s',
                }}
              >🧠</button>
            )}
          </div>
        )}

        {/* Patient memory drawer (fixed overlay — does not affect the flex layout) */}
        {memoryPanelOpen && artifactPatientId && (
          <Suspense fallback={null}>
            <MemoryPanel
              key={artifactPatientId}
              patientId={artifactPatientId}
              patientName={artifactPatientName}
              isOpen={memoryPanelOpen}
              onClose={() => setMemoryPanelOpen(false)}
              language={actualLanguage}
              sideOffset={isProvider && actualLanguage !== 'he' ? 64 : 0}
            />
          </Suspense>
        )}

        {/* Artifact Panel - Split Screen (like Claude.ai) */}
        {artifactPanelOpen && (
          <div style={{
            width: '50%',
            height: '100%',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <Suspense fallback={<LoadingFallback />}>
              <ArtifactPanel
                key={`artifact-${artifactPatientId}-${artifactCategory}-${artifactDocumentId}-${artifactGridData?.document?._id || ''}`}
                isOpen={artifactPanelOpen}
                onClose={closeArtifactPanel}
                patientId={artifactPatientId}
                patientName={artifactPatientName}
                initialLevel={artifactLevel}
                initialCategory={artifactCategory}
                initialDocumentId={artifactDocumentId}
                directGridData={artifactGridData}
                initialCategories={artifactGridData?.categories}
                onSendMessage={sendMessage}
                onNavigate={(category, level, documentId) => {
                  // Update ChatContainer state when user navigates in artifact panel
                  console.log('🎨 [ChatContainer] Artifact navigation:', { category, level, documentId });
                  setArtifactCategory(category);
                  setArtifactLevel(level);
                  setArtifactDocumentId(documentId);

                  // CRITICAL FIX: Immediately sync to localStorage to prevent stale data on page refresh
                  // This eliminates race condition where user refreshes before useEffect writes
                  try {
                    if (category) {
                      localStorage.setItem('artifactCategory', category);
                    } else {
                      localStorage.removeItem('artifactCategory');
                    }
                    localStorage.setItem('artifactLevel', level);
                    if (documentId) {
                      localStorage.setItem('artifactDocumentId', documentId);
                    } else {
                      localStorage.removeItem('artifactDocumentId');
                    }
                    console.log('✅ [SYNC] Immediately synced artifact state to localStorage:', { category, level, documentId });
                  } catch (error) {
                    console.error('❌ Failed to immediately sync artifact state to localStorage:', error);
                  }
                }}
                onDataFetched={(documents, category) => {
                  // CRITICAL: Skip if we already received data for this category to prevent infinite loops
                  // The loop: onDataFetched → setArtifactGridData → re-render → onDataFetched again
                  if (lastDataFetchedCategoryRef.current === category) {
                    console.log('[ChatContainer] SKIPPING onDataFetched - already received data for category:', category);
                    return;
                  }

                  // When CollectionDocumentView fetches unified documents, store them in artifactGridData
                  console.log('[ChatContainer] Received', documents.length, 'documents for', category);
                  lastDataFetchedCategoryRef.current = category;  // Track this category
                  const gridDataFormat = { data: documents };
                  setArtifactGridData(gridDataFormat);

                  // Also save to localStorage for persistence
                  try {
                    localStorage.setItem('artifactGridData', JSON.stringify(gridDataFormat));
                    console.log('✅ [ChatContainer] Saved', documents.length, 'unified documents to artifactGridData');
                  } catch (error) {
                    console.error('❌ Failed to save artifactGridData to localStorage:', error);
                  }
                }}
              />
            </Suspense>
          </div>
        )}
      </div>

      {/* Notifications & Appointments Sidebar - Positioned absolutely outside mainLayout */}
      {isProvider && (
      <CollapsibleSidebar
        position={isRTL ? 'left' : 'right'}
        isOpen={rightSidebarOpen}
        onToggle={() => setRightSidebarOpen(!rightSidebarOpen)}
        language={actualLanguage}
        width="300px"
        type="medical"
        userEmail={user?.email}
        notificationCount={unreadCount}
        staffChatCount={staffChat.totalUnreadCount}
        onIconClick={(action) => {
          console.log('🔘 [Sidebar] Icon clicked:', action);
          if (action === 'artifact') {
            console.log('🎨 [Sidebar] Artifact icon clicked, patientId:', artifactPatientId);
            console.log('🎨 [Sidebar] Panel currently open:', artifactPanelOpen);

            // Toggle artifact panel - open if closed, close if open
            if (artifactPanelOpen) {
              // Panel is open, close it
              console.log('📴 [Sidebar] Closing artifact panel');
              setArtifactPanelOpen(false);
            } else if (artifactPatientId) {
              // Panel is closed and we have saved state, reopen it
              console.log('✅ [Sidebar] Reopening artifact panel');
              setArtifactPanelOpen(true);
              setRightSidebarOpen(false); // Close right sidebar when artifact opens
            } else {
              // No previous state - silently do nothing (user needs to request medical data via chat)
              console.log('ℹ️ [Sidebar] No artifact state - user needs to request medical data first');
            }
          } else if (action === 'staff-chat') {
            // Staff chat is a floating panel - toggle directly without opening sidebar
            console.log('💬 [Sidebar] Staff chat toggled');
            setStaffChatOpen(prev => !prev);
          } else {
            setRightSidebarOpen(true);
            setExpandedSection(null);
            setTimeout(() => {
              if (action === 'appointments') setExpandedSection('appointments');
              else if (action === 'notifications') setExpandedSection('notifications');
              else if (action === 'fda-recalls') setExpandedSection('fda-recalls');
              else if (action === 'device-recalls') setExpandedSection('device-recalls');
              else if (action === 'drug-shortages') setExpandedSection('drug-shortages');
              else if (action === 'workflow') setExpandedSection('workflow');
            }, 100);
          }
        }}
      >
        <div style={STYLES.sidebarPadding}>
          <div style={STYLES.dashboardHeader}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#93A2BE" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <h3 style={STYLES.dashboardTitle}>
              {actualLanguage === 'he' ? 'לוח בקרה רפואי' : 'Medical Dashboard'}
            </h3>
          </div>
        </div>

        {/* Lazy loaded components with Suspense */}
        <Suspense fallback={<LoadingFallback />}>
          {/* Appointments Accordion */}
          <AccordionSection
            title={actualLanguage === 'he' ? 'תורים קרובים' : 'Appointments'}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#93A2BE" strokeWidth="2">
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
              providerId={user?._id || user?.id || user?.email}
              language={actualLanguage}
              socket={notificationSocket}
              maxItems={10}
            />
          </AccordionSection>

          {/* Notifications Accordion */}
          <AccordionSection
            title={actualLanguage === 'he' ? 'התראות' : 'Notifications'}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#93A2BE" strokeWidth="2">
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
              userId={user?._id || user?.id}
              language={actualLanguage}
              socket={socket || notificationSocket}
              maxItems={20}
              onSendMessage={sendMessage}
              onUnreadCountChange={setNotifCenterUnreadCount}
            />
          </AccordionSection>

          {/* FDA Drug Recall Alerts */}
          <AccordionSection
            title={actualLanguage === 'he' ? 'החזרות תרופות FDA' : 'FDA Drug Recalls'}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc3545" strokeWidth="2">
                <path d="M10.5 20.5L3.5 13.5C2.5 12.5 2.5 11 3.5 10L10 3.5C11 2.5 12.5 2.5 13.5 3.5L20.5 10.5C21.5 11.5 21.5 13 20.5 14L14 20.5C13 21.5 11.5 21.5 10.5 20.5Z"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            }
            defaultOpen={false}
            forceOpen={expandedSection === 'fda-recalls'}
            language={actualLanguage}
            onToggle={() => expandedSection === 'fda-recalls' && setExpandedSection(null)}
          >
            <FDARecallAlerts
              language={actualLanguage}
              maxItems={10}
              onPatientClick={(patientId, patientName) => {
                // Open artifact panel with patient context
                setArtifactPatientId(patientId);
                setArtifactPatientName(patientName);
                setArtifactPanelOpen(true);
              }}
            />
          </AccordionSection>

          {/* Medical Device Recall Alerts */}
          <AccordionSection
            title={actualLanguage === 'he' ? 'החזרות מכשור רפואי' : 'Device Recalls'}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fd7e14" strokeWidth="2">
                <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
                <path d="M9 9h6v6H9z"/>
                <line x1="9" y1="1" x2="9" y2="4"/>
                <line x1="15" y1="1" x2="15" y2="4"/>
                <line x1="9" y1="20" x2="9" y2="23"/>
                <line x1="15" y1="20" x2="15" y2="23"/>
              </svg>
            }
            defaultOpen={false}
            forceOpen={expandedSection === 'device-recalls'}
            language={actualLanguage}
            onToggle={() => expandedSection === 'device-recalls' && setExpandedSection(null)}
          >
            <DeviceRecallAlerts
              language={actualLanguage}
              maxItems={10}
              onPatientClick={(patientId, patientName) => {
                // Open artifact panel with patient context
                setArtifactPatientId(patientId);
                setArtifactPatientName(patientName);
                setArtifactPanelOpen(true);
              }}
            />
          </AccordionSection>

          {/* Drug Shortage Alerts */}
          <AccordionSection
            title={actualLanguage === 'he' ? 'מחסור בתרופות' : 'Drug Shortages'}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                <path d="M10.5 20.5L3.5 13.5C2.5 12.5 2.5 11 3.5 10L10 3.5C11 2.5 12.5 2.5 13.5 3.5L20.5 10.5C21.5 11.5 21.5 13 20.5 14L14 20.5C13 21.5 11.5 21.5 10.5 20.5Z"/>
                <line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/>
              </svg>
            }
            defaultOpen={false}
            forceOpen={expandedSection === 'drug-shortages'}
            language={actualLanguage}
            onToggle={() => expandedSection === 'drug-shortages' && setExpandedSection(null)}
          >
            <DrugShortageAlerts
              language={actualLanguage}
              maxItems={10}
              onPatientClick={(patientId, patientName) => {
                // Open artifact panel with patient context
                setArtifactPatientId(patientId);
                setArtifactPatientName(patientName);
                setArtifactPanelOpen(true);
              }}
            />
          </AccordionSection>

          {/* Workflow Suggestions */}
          <AccordionSection
            title={actualLanguage === 'he' ? 'הצעות לזרימת עבודה' : 'Workflow Suggestions'}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#93A2BE" strokeWidth="2">
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

        </Suspense>
      </CollapsibleSidebar>
    )}

    {/* Workflow Helper Panel */}
    {isHelperVisible && activeWorkflow && (
      <WorkflowHelper
        onCommandClick={handleWorkflowCommand}
      />
    )}

    {/* Staff Chat Floating Panel - no backdrop, user can keep working */}
    {staffChatOpen && (
      <Suspense fallback={null}>
        <StaffChatPanel
          userId={user?._id || user?.id}
          userName={user?.profile ? `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim() : user?.email}
          userRole={user?.roles?.[0]}
          language={actualLanguage}
          socket={socket || notificationSocket}
          onClose={() => setStaffChatOpen(false)}
          {...staffChat}
        />
      </Suspense>
    )}

    {/* User Settings Modal */}
    {showSettings && (
      <Suspense fallback={null}>
        <UserSettings
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          userInfo={user}
          onUpdateUser={(updatedUser) => {
            if (updatedUser && setUser) {
              setUser(prev => ({ ...prev, ...updatedUser }));
            }
          }}
          language={actualLanguage}
          initialTab={settingsTab}
        />
      </Suspense>
    )}
    </div>
  );
});

ChatContainer.displayName = 'ChatContainer';

export default ChatContainer;