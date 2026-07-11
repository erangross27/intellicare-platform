import React, { useState, useEffect, useCallback } from 'react';
import secureApi from '../../../services/secureApiClient';

import secureStorage from '../../../utils/secureStorage';
const SessionManager = ({ 
  currentSessionId, 
  onSessionChange, 
  onNewSession,
  language,
  refreshTrigger 
}) => {
  const [sessions, setSessions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const isRTL = language === 'he';
  
  // Helper to get user-specific storage key
  const getUserStorageKey = useCallback((key) => {
    // Get auth token to create user-specific keys
    const authToken = secureStorage.getItem('token') || secureStorage.getItem('authToken');
    const userIdentifier = authToken ? btoa(authToken).substring(0, 8) : 'anon';
    return `${userIdentifier}_${key}`;
  }, []);

  // Track if we're currently deleting to avoid reload
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Load sessions from database and localStorage
  useEffect(() => {
    // Skip loading if we're in the middle of a delete operation
    if (isDeleting) {
      return;
    }
    
    let errorCount = 0;
    let interval = null;
    let currentDelay = 30000; // Start with 30 seconds
    
    const loadSessions = async () => {
      try {
        // Check if user is authenticated (using cookie-based auth now, not localStorage tokens)
        // Try to load from database first - the backend will check httpOnly cookies
        // Get the actual practice subdomain from localStorage or URL
        const practiceData = JSON.parse(secureStorage.getItem('practice') || '{}');
        const practice = practiceData.subdomain || secureStorage.getItem('practiceSubdomain') || '';
        
        // Always try to load from database - backend will validate session via httpOnly cookies
        try {
          // Only log in development
          process.env.NODE_ENV !== 'production' && console.log('📋 Loading chat sessions from database...');
          // Fetch more sessions to avoid pagination issues (100 instead of default 20)
          const response = await secureApi.get('/api/chat/sessions?limit=100');
          
          // Reduce logging
          process.env.NODE_ENV !== 'production' && console.log(`📋 Loaded ${response.data ? response.data.length : 0} sessions`);
          
          if (!response.error && response.success && response.data) {
            // Reset error count on success
            errorCount = 0;
            currentDelay = 30000; // Reset to normal polling interval
            
            // Map database sessions to frontend format
            // Handle both sessionId and _id formats from MongoDB
            const dbSessions = response.data.map(s => {
              // Extract title properly - handle both string and object formats
              let title = s.title;
              
              // Robust title sanitization to prevent [object Object] display
              if (title && typeof title === 'object') {
                // If title is an object with language keys, extract the right one
                title = title[language] || title.en || title.he || 
                        (language === 'he' ? 'שיחה חדשה' : 'New Chat');
              } else if (!title || title === 'undefined' || title === 'null') {
                title = s.summary || (language === 'he' ? 'שיחה חדשה' : 'New Chat');
              }
              
              // Ensure title is always a string and not empty
              title = String(title).trim();
              if (!title || title === '[object Object]' || title === 'undefined') {
                title = language === 'he' ? 'שיחה חדשה' : 'New Chat';
              }
              
              // Clean up session ID - remove any duplicate prefixes
              let sessionId = s.sessionId || s._id?.toString() || s._id;
              // Remove duplicate 'stanford_' prefixes if they exist
              if (sessionId && sessionId.includes('stanford_stanford')) {
                sessionId = sessionId.replace(/stanford_stanford/, 'stanford');
              }
              
              return {
                id: sessionId,
                title: title,
                timestamp: s.createdAt || s.timestamp,
                lastActive: s.lastMessageAt || s.updatedAt || s.createdAt || s.lastActive
              };
            });
            
            // Deduplicate sessions by ID to prevent duplicates
            const sessionMap = new Map();
            dbSessions.forEach(session => {
              const id = session.id;
              // Keep the most recent version of duplicate sessions
              if (!sessionMap.has(id) || 
                  new Date(session.lastActive || session.updatedAt) > 
                  new Date(sessionMap.get(id).lastActive || sessionMap.get(id).updatedAt)) {
                sessionMap.set(id, session);
              }
            });
            const dedupedSessions = Array.from(sessionMap.values());
            
            // Sort by last activity time (most recently used at top)
            const sorted = dedupedSessions.sort((a, b) => {
              const dateA = new Date(a.lastActive || a.timestamp || a.createdAt);
              const dateB = new Date(b.lastActive || b.timestamp || b.createdAt);
              return dateB - dateA; // Most recent activity first (at top)
            });
            
            setSessions(sorted);

            // Also update localStorage for offline access
            secureStorage.setItem(getUserStorageKey('chat_sessions'), JSON.stringify(sorted));

            // Clean up any stale sessions from localStorage that don't exist in DB
            const storedSessions = secureStorage.getItem(getUserStorageKey('chat_sessions'));
            if (storedSessions) {
              try {
                const parsedStored = JSON.parse(storedSessions);
                const dbSessionIds = sorted.map(s => s.id);
                const staleSessions = parsedStored.filter(s => !dbSessionIds.includes(s.id));

                if (staleSessions.length > 0) {
                  console.log(`🧹 Cleaning ${staleSessions.length} stale sessions from localStorage`);
                  // Remove messages and cost info for stale sessions
                  staleSessions.forEach(staleSession => {
                    secureStorage.removeItem(getUserStorageKey(`messages_${staleSession.id}`));
                    secureStorage.removeItem(getUserStorageKey(`cost_${staleSession.id}`));
                  });
                }
              } catch (e) {
                console.error('Error cleaning stale sessions:', e);
              }
            }

            // If we got sessions from DB, we're done
            if (dbSessions.length > 0) {
              return;
            }
          }
        } catch (error) {
          console.error('Failed to load sessions from database:', error);
          errorCount++;
          
          // Log error but don't retry automatically
          if (errorCount >= 3) {
            console.warn('📋 Multiple errors loading sessions, please refresh if needed');
          }
        }
        
        // Fallback to localStorage if database load fails or returns empty
        const stored = secureStorage.getItem(getUserStorageKey('chat_sessions'));
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            console.log(`📋 Loading ${parsed.length} sessions from localStorage`);
            
            // Deduplicate sessions by ID to prevent duplicates
            const deduped = parsed.reduce((acc, session) => {
              if (!acc.find(s => s.id === session.id)) {
                // Robust title sanitization to prevent [object Object] display
                let title = session.title;
                if (title && typeof title === 'object') {
                  title = title[language] || title.en || title.he || 
                          (language === 'he' ? 'שיחה חדשה' : 'New Chat');
                }
                
                // Ensure title is always a string and not empty
                title = String(title || '').trim();
                if (!title || title === '[object Object]' || title === 'undefined') {
                  title = language === 'he' ? 'שיחה חדשה' : 'New Chat';
                }
                
                session.title = title;
                acc.push(session);
              }
              return acc;
            }, []);
            
            // Sort by last activity (most recently used at top)
            const sorted = deduped.sort((a, b) => 
              new Date(b.lastActive || b.timestamp || b.createdAt) - 
              new Date(a.lastActive || a.timestamp || a.createdAt)
            );
            setSessions(sorted);
            
            // Update localStorage with deduplicated sessions
            if (deduped.length !== parsed.length) {
              secureStorage.setItem(getUserStorageKey('chat_sessions'), JSON.stringify(sorted));
              console.log(`📋 Removed ${parsed.length - deduped.length} duplicate sessions`);
            }
          } catch (parseError) {
            console.error('Failed to parse stored sessions:', parseError);
            setSessions([]);
          }
        } else {
          console.log('📋 No stored sessions found');
          setSessions([]);
        }
      } catch (err) {
        console.error('Failed to load sessions:', err);
        setSessions([]);
      }
    };
    
    loadSessions();
    
    // NO POLLING - only load on demand
    // Remove interval polling completely for better performance
    
    // Listen for storage events for cross-tab updates only
    const handleStorageChange = (e) => {
      if (e.key === getUserStorageKey('chat_sessions')) {
        loadSessions();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Listen for custom event when sessions are updated in same window
    const handleSessionsUpdate = (e) => {
      console.log('📋 Sessions updated event:', e.detail);
      // Reload sessions from database to get the updated title
      loadSessions();
    };
    window.addEventListener('chatSessionsUpdated', handleSessionsUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('chatSessionsUpdated', handleSessionsUpdate);
    };
  }, [getUserStorageKey, language, refreshTrigger, currentSessionId, isDeleting]); // Add refreshTrigger, currentSessionId and isDeleting to dependencies
  
  
  // Save current session info with real-time title updates
  const saveCurrentSession = useCallback((sessionId, title) => {
    try {
      // Clean session ID first
      let cleanSessionId = sessionId;
      if (cleanSessionId && cleanSessionId.includes('stanford_stanford')) {
        cleanSessionId = cleanSessionId.replace(/stanford_stanford/, 'stanford');
      }
      if (cleanSessionId && cleanSessionId.includes('session_session')) {
        cleanSessionId = cleanSessionId.replace(/session_session/, 'session');
      }
      
      const sessions = JSON.parse(secureStorage.getItem(getUserStorageKey('chat_sessions')) || '[]');
      
      // Find existing session index for better duplicate detection
      const existingIndex = sessions.findIndex(s => s.id === cleanSessionId);
      
      if (existingIndex === -1) {
        // Only add if it truly doesn't exist
        const newSession = {
          id: cleanSessionId,
          title: title || (isRTL ? 'שיחה חדשה' : 'New Chat'),
          timestamp: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          lastActive: new Date().toISOString()
        };
        
        // Add new session at the beginning (top of the list)
        sessions.unshift(newSession);
        
        // Remove any accidental duplicates by ID
        const deduped = sessions.reduce((acc, session) => {
          if (!acc.find(s => s.id === session.id)) {
            acc.push(session);
          }
          return acc;
        }, []);
        
        // Re-sort to ensure newest at top
        deduped.sort((a, b) => 
          new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt)
        );
        
        // Keep only last 20 sessions
        const limited = deduped.slice(0, 20);
        secureStorage.setItem(getUserStorageKey('chat_sessions'), JSON.stringify(limited));
        setSessions(limited);
      } else {
        // Update existing session - ALWAYS update for real-time changes
        sessions[existingIndex].lastActive = new Date().toISOString();
        
        // Always check and update title if provided
        if (title) {
          // Robust title sanitization to prevent [object Object] display
          let sanitizedTitle = title;
          if (typeof title === 'object') {
            sanitizedTitle = title[language] || title.en || title.he || 
                           (language === 'he' ? 'שיחה חדשה' : 'New Chat');
          }
          
          // Ensure title is always a string and not empty
          sanitizedTitle = String(sanitizedTitle || '').trim();
          if (!sanitizedTitle || sanitizedTitle === '[object Object]' || sanitizedTitle === 'undefined') {
            sanitizedTitle = language === 'he' ? 'שיחה חדשה' : 'New Chat';
          }
          
          // Update title even if it's the same to ensure UI consistency
          sessions[existingIndex].title = sanitizedTitle;
        }
        
        // Move updated session to the top if it's not already there
        if (existingIndex !== 0) {
          const updatedSession = sessions.splice(existingIndex, 1)[0];
          sessions.unshift(updatedSession);
        }
        
        // Re-sort to ensure proper order (newest activity at top)
        sessions.sort((a, b) => 
          new Date(b.lastActive || b.timestamp || b.createdAt) - 
          new Date(a.lastActive || a.timestamp || a.createdAt)
        );
        
        // Keep only last 20 sessions
        const limited = sessions.slice(0, 20);
        secureStorage.setItem(getUserStorageKey('chat_sessions'), JSON.stringify(limited));
        // Force immediate UI update for real-time experience
        setSessions([...limited]);
      }
    } catch (err) {
      process.env.NODE_ENV !== 'production' && console.error('Failed to save session:', err);
    }
  }, [isRTL, getUserStorageKey, language]);
  
  // Container styles
  const containerStyle = {
    position: 'relative'
  };
  
  const titleStyle = {
    fontSize: '18px',
    fontFamily: 'Comfortaa, Geneva, Tahoma, sans-serif',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: '8px',
    marginTop: '16px',
    textAlign: 'left',
    direction: isRTL ? 'rtl' : 'ltr',
    fontWeight: '600',
    paddingLeft: isRTL ? 0 : '12px',
    paddingRight: isRTL ? '12px' : 0
  };
  
  const listStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    maxHeight: 'calc(100vh - 200px)',
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '0 8px',
    marginTop: '0',
    direction: isRTL ? 'rtl' : 'ltr'
  };
  
  const sessionItemStyle = {
    padding: '12px',
    margin: '2px 0',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    direction: isRTL ? 'rtl' : 'ltr',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#E9EFFA',
    display: 'flex',
    alignItems: 'center',
    minHeight: '40px',
    flexShrink: 0,
    border: 'none',
    background: 'transparent',
    position: 'relative',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  };
  
  const sessionTitleStyle = {
    fontSize: '18px',
    fontFamily: 'Comfortaa, Geneva, Tahoma, sans-serif',
    fontWeight: '400',
    color: 'inherit',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: 1
  };
  
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return ''; // Fix NaN issue
    
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (minutes < 1) {
      return isRTL ? 'עכשיו' : 'just now';
    } else if (minutes < 60) {
      return isRTL ? `לפני ${minutes} דקות` : `${minutes}m ago`;
    } else if (hours < 24) {
      return isRTL ? `לפני ${hours} שעות` : `${hours}h ago`;
    } else {
      const days = Math.floor(hours / 24);
      return isRTL ? `לפני ${days} ימים` : `${days}d ago`;
    }
  };
  
  const handleSessionClick = async (session) => {
    // Clean session ID to prevent duplication issues
    let cleanSessionId = session.id;
    // Remove any duplicate practice prefixes
    if (cleanSessionId && cleanSessionId.includes('stanford_stanford')) {
      cleanSessionId = cleanSessionId.replace(/stanford_stanford/, 'stanford');
    }
    // Remove any duplicate session prefixes
    if (cleanSessionId && cleanSessionId.includes('session_session')) {
      cleanSessionId = cleanSessionId.replace(/session_session/, 'session');
    }

    // Check if session still exists before switching
    try {
      const response = await secureApi.get(`/api/chat/sessions/${cleanSessionId}/messages`);
      if (response.error && response.status === 404) {
        console.log(`🧹 Session ${cleanSessionId} no longer exists, removing from list`);

        // Remove stale session from list
        const updatedSessions = sessions.filter(s => s.id !== session.id);
        setSessions(updatedSessions);
        secureStorage.setItem(getUserStorageKey('chat_sessions'), JSON.stringify(updatedSessions));

        // Clean up localStorage for this session
        secureStorage.removeItem(getUserStorageKey(`messages_${cleanSessionId}`));
        secureStorage.removeItem(getUserStorageKey(`cost_${cleanSessionId}`));

        // Create new session instead
        onNewSession();
        setIsOpen(false);
        return;
      }
    } catch (error) {
      // If we can't verify, proceed with session change anyway
      console.warn('Could not verify session existence:', error);
    }

    onSessionChange(cleanSessionId);
    setIsOpen(false);
  };
  
  const handleNewSession = () => {
    onNewSession();
    setIsOpen(false);
  };
  
  const handleContextMenu = (e, session) => {
    e.preventDefault();
    
    // Calculate position to prevent menu from going off-screen
    const menuWidth = 140; // Approximate menu width
    const menuHeight = 80; // Approximate menu height
    
    let x = e.clientX;
    let y = e.clientY;
    
    // Get the position of the sidebar element
    const sidebarRect = e.currentTarget.closest('[style*="width: 260px"]')?.getBoundingClientRect();
    const isInRightSidebar = sidebarRect && sidebarRect.left > window.innerWidth / 2;
    
    // If clicking in right sidebar, show menu to the left of cursor
    if (isInRightSidebar) {
      x = x - menuWidth - 10; // Show menu to the left
    }
    
    // Final boundary checks
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    if (x < 10) {
      x = 10;
    }
    
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }
    if (y < 10) {
      y = 10;
    }
    
    setContextMenu({
      x,
      y,
      sessionId: session.id
    });
  };
  
  const handleRename = (session) => {
    setEditingSession(session.id);
    setEditTitle(session.title);
    setContextMenu(null);
  };
  
  const handleDelete = (sessionId) => {
    // Show custom confirmation modal instead of browser confirm
    const session = sessions.find(s => s.id === sessionId);
    setDeleteConfirm({
      sessionId,
      sessionTitle: session?.title || (isRTL ? 'שיחה חדשה' : 'New Chat')
    });
    setContextMenu(null);
  };
  
  const confirmDelete = async () => {
    const sessionId = deleteConfirm.sessionId;
    
    // Set deleting flag to prevent reload
    setIsDeleting(true);
    
    // Optimistic UI update - remove immediately
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(updatedSessions);
    secureStorage.setItem(getUserStorageKey('chat_sessions'), JSON.stringify(updatedSessions));
    
    // Also remove messages from localStorage
    secureStorage.removeItem(getUserStorageKey(`messages_${sessionId}`));

    // Also remove cost info from localStorage
    secureStorage.removeItem(getUserStorageKey(`cost_${sessionId}`));

    // If deleting current session, switch to another session or clear
    if (sessionId === currentSessionId) {
      // Switch to the first available session, or clear if none
      if (updatedSessions.length > 0) {
        onSessionChange(updatedSessions[0].id);
      } else {
        // No sessions left - create a new one
        onNewSession();
      }
    }
    
    // Delete from backend
    try {
      console.log(`🗑️ Deleting session from backend: ${sessionId}`);
      const response = await secureApi.delete(`/api/chat/sessions/${sessionId}`);
      
      if (response.error) {
        console.error('❌ Failed to delete session from server:', {
          sessionId,
          error: response.error,
          message: response.message,
          status: response.status
        });
        // Don't restore - keep optimistic update
      } else if (response.success) {
        console.log(`✅ Session deleted successfully from backend: ${sessionId}`);
      } else {
        console.warn('⚠️ Unexpected delete response:', response);
      }
    } catch (error) {
      console.error('❌ Failed to delete session:', {
        sessionId,
        error: error.message || error,
        stack: error.stack
      });
      // Don't restore - keep optimistic update
    }
    
    setDeleteConfirm(null);
    
    // Clear deleting flag after a short delay to avoid immediate reload
    setTimeout(() => {
      setIsDeleting(false);
    }, 500);
  };
  
  const saveRename = async (sessionId) => {
    const newTitle = editTitle.trim();
    if (!newTitle) {
      setEditingSession(null);
      setEditTitle('');
      return;
    }
    
    // Optimistic UI update
    const updatedSessions = sessions.map(s => 
      s.id === sessionId ? { ...s, title: newTitle } : s
    );
    setSessions(updatedSessions);
    secureStorage.setItem(getUserStorageKey('chat_sessions'), JSON.stringify(updatedSessions));
    setEditingSession(null);
    setEditTitle('');
    
    // Update on backend
    try {
      const response = await secureApi.put(`/api/chat/sessions/${sessionId}/title`, {
        title: newTitle
      });
      
      if (response.error) {
        console.error('Failed to rename session on server:', response.error);
        // Keep the optimistic update even if backend fails
      }
    } catch (error) {
      console.error('Failed to rename session:', error);
      // Keep the optimistic update even if backend fails
    }
  };
  
  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);
  
  return (
    <div style={containerStyle}>
      <div style={titleStyle}>
        {isRTL ? 'שיחות' : 'Chats'}
      </div>
      
      <style>{`
        .session-list {
          direction: ${isRTL ? 'rtl' : 'ltr'};
        }
        .session-list::-webkit-scrollbar {
          width: 8px;
        }
        .session-list::-webkit-scrollbar-track {
          background: transparent;
        }
        .session-list::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          border: 2px solid transparent;
          background-clip: content-box;
        }
        .session-list::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
      
      <div className="session-list" style={listStyle}>
        {sessions.map(session => (
          <div
            key={session.id}
            style={{
              ...sessionItemStyle,
              backgroundColor: session.id === currentSessionId
                ? 'rgba(167, 139, 250, 0.15)'
                : 'transparent'
            }}
            onClick={() => handleSessionClick(session)}
            onContextMenu={(e) => handleContextMenu(e, session)}
            onMouseEnter={(e) => {
              if (session.id !== currentSessionId) {
                e.currentTarget.style.backgroundColor = '#1B2C4A';
              }
            }}
            onMouseLeave={(e) => {
              if (session.id !== currentSessionId) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            {editingSession === session.id ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={() => saveRename(session.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveRename(session.id);
                  } else if (e.key === 'Escape') {
                    setEditingSession(null);
                    setEditTitle('');
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  padding: '4px 8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '4px',
                  color: '#E9EFFA',
                  fontSize: '13px',
                  outline: 'none',
                  direction: isRTL ? 'rtl' : 'ltr'
                }}
                autoFocus
              />
            ) : (
              <div style={sessionTitleStyle}>
                {session.title}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '6px',
            padding: '4px',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            minWidth: '120px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            onClick={() => {
              const session = sessions.find(s => s.id === contextMenu.sessionId);
              if (session) handleRename(session);
            }}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              borderRadius: '4px',
              fontSize: '13px',
              color: '#E9EFFA',
              transition: 'background-color 0.2s',
              direction: isRTL ? 'rtl' : 'ltr'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span>{isRTL ? 'שנה שם' : 'Rename'}</span>
            </div>
          </div>
          <div
            onClick={() => handleDelete(contextMenu.sessionId)}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              borderRadius: '4px',
              fontSize: '13px',
              color: '#ff6b6b',
              transition: 'background-color 0.2s',
              direction: isRTL ? 'rtl' : 'ltr'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 107, 107, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
              <span>{isRTL ? 'מחק' : 'Delete'}</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              width: '90%',
              direction: isRTL ? 'rtl' : 'ltr'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <h3 style={{
                margin: 0,
                fontSize: '18px',
                color: '#E9EFFA',
                fontWeight: '500'
              }}>
                {isRTL ? 'מחיקת שיחה' : 'Delete Conversation'}
              </h3>
            </div>
            
            <p style={{
              margin: '0 0 20px 0',
              color: '#B7C2D8',
              fontSize: '14px',
              lineHeight: '1.5'
            }}>
              {isRTL ? 
                `האם אתה בטוח שברצונך למחוק את "${deleteConfirm.sessionTitle}"? פעולה זו אינה ניתנת לביטול.` :
                `Are you sure you want to delete "${deleteConfirm.sessionTitle}"? This action cannot be undone.`
              }
            </p>
            
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  backgroundColor: 'transparent',
                  color: '#E9EFFA',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {isRTL ? 'ביטול' : 'Cancel'}
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#ff6b6b',
                  color: 'white',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#ff5252';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ff6b6b';
                }}
              >
                {isRTL ? 'מחק' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionManager;