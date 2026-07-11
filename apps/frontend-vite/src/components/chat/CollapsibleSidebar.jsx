import React, { useState, useEffect, useCallback, useRef } from 'react';
import MinimalSidebar from './MinimalSidebar';
import secureApi from '../../services/secureApiClient';
import CloseIcon from '../icons/CloseIcon';
import PulseMark from '../PulseMark';

const CollapsibleSidebar = ({
  children,
  position = 'left',
  isOpen,
  onToggle,
  width = '320px',
  language = 'en',
  type = 'chat', // 'chat' or 'medical'
  userEmail = null,
  onNewChat = null,
  onSearch = null,
  onIconClick = null,
  onProfileClick = null,
  hoverEnabled = true, // Enable hover-to-open/close behavior
  notificationCount = 0, // Unread notification count for bell icon badge
  staffChatCount = 0 // Unread staff chat message count
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const isRTL = language === 'he';

  // Hover close delay timer ref
  const hoverCloseTimerRef = useRef(null);
  const HOVER_CLOSE_DELAY = 250; // ms delay before closing on mouse leave
  
  // Adjust position based on RTL
  const actualPosition = isRTL ? (position === 'left' ? 'right' : 'left') : position;
  
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    } else {
      setTimeout(() => setIsAnimating(false), 500);
    }
  }, [isOpen]);
  
  // Keyboard shortcut for new chat
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'O') {
        e.preventDefault();
        if (onNewChat) onNewChat();
      }
    };
    
    if (type === 'chat') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [type, onNewChat]);

  // Debounced search function
  const performSearch = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const response = await secureApi.get(`/api/chat/search?q=${encodeURIComponent(query)}&limit=20`);

      if (response.success && response.data) {
        setSearchResults(response.data);
      } else {
        setSearchResults({ sessions: [], messages: [], totalResults: 0 });
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchError(language === 'he' ? 'שגיאה בחיפוש' : 'Search error');
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  }, [language]);

  // Debounce search input
  useEffect(() => {
    const delayTimer = setTimeout(() => {
      if (showSearchOverlay && searchValue) {
        performSearch(searchValue);
      }
    }, 300); // 300ms delay

    return () => clearTimeout(delayTimer);
  }, [searchValue, showSearchOverlay, performSearch]);

  // Clear search when overlay closes
  useEffect(() => {
    if (!showSearchOverlay) {
      setSearchValue('');
      setSearchResults(null);
      setSearchError(null);
    }
  }, [showSearchOverlay]);

  // Cleanup hover timer on unmount
  useEffect(() => {
    return () => {
      if (hoverCloseTimerRef.current) {
        clearTimeout(hoverCloseTimerRef.current);
      }
    };
  }, []);

  // Handle hover to open sidebar (called from MinimalSidebar)
  const handleHoverOpen = useCallback(() => {
    if (hoverEnabled && !isOpen) {
      // Clear any pending close timer
      if (hoverCloseTimerRef.current) {
        clearTimeout(hoverCloseTimerRef.current);
        hoverCloseTimerRef.current = null;
      }
      onToggle();
    }
  }, [hoverEnabled, isOpen, onToggle]);

  // Handle mouse enter on expanded sidebar - cancel any pending close
  const handleMouseEnter = useCallback(() => {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  }, []);

  // Handle mouse leave on expanded sidebar - start close timer
  const handleMouseLeave = useCallback(() => {
    if (hoverEnabled && isOpen) {
      // Clear any existing timer
      if (hoverCloseTimerRef.current) {
        clearTimeout(hoverCloseTimerRef.current);
      }
      // Start new close timer
      hoverCloseTimerRef.current = setTimeout(() => {
        onToggle();
        hoverCloseTimerRef.current = null;
      }, HOVER_CLOSE_DELAY);
    }
  }, [hoverEnabled, isOpen, onToggle]);

  const styles = {
    container: {
      position: 'fixed',
      top: 0,
      bottom: 0,
      [actualPosition]: 0,
      width: width,
      background: '#0A1020',
      transform: isOpen
        ? 'translateX(0)'
        : `translateX(${actualPosition === 'left' ? '-100%' : '100%'})`,
      transition: 'transform 0.5s ease-in-out',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      direction: isRTL ? 'rtl' : 'ltr',
      borderLeft: actualPosition === 'right' ? '1px solid #28395C' : 'none',
      borderRight: actualPosition === 'left' ? '1px solid #28395C' : 'none'
    },

    toggleButton: {
      position: 'absolute',
      top: '50%',
      [actualPosition === 'left' ? 'right' : 'left']: '-40px',
      transform: 'translateY(-50%)',
      width: '40px',
      height: '80px',
      background: '#0E1626',
      border: '1px solid #28395C',
      borderRadius: actualPosition === 'left' ? '0 8px 8px 0' : '8px 0 0 8px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1001,
      ':hover': {
        background: '#121E33'
      }
    },

    toggleIcon: {
      fontSize: '20px',
      color: '#E9EFFA',
      transform: isOpen
        ? (actualPosition === 'left' ? 'rotate(180deg)' : 'rotate(0deg)')
        : (actualPosition === 'left' ? 'rotate(0deg)' : 'rotate(180deg)'),
      transition: 'transform 0.5s'
    },

    header: {
      padding: '16px',
      borderBottom: '1px solid #28395C',
      background: '#0A1020',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    },

    content: {
      flex: 1,
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: '0',
      background: 'transparent'
    }
  };
  
  // Render minimal sidebar when collapsed
  if (!isOpen && !isAnimating) {
    return (
      <>
        <MinimalSidebar
          position={position}
          isOpen={isOpen}
          onToggle={onToggle}
          onHoverOpen={handleHoverOpen}
          language={language}
          type={type}
          userEmail={userEmail}
          onNewChat={onNewChat}
          onSearch={() => setShowSearchOverlay(true)}
          onIconClick={onIconClick}
          onProfileClick={onProfileClick}
          notificationCount={notificationCount}
          staffChatCount={staffChatCount}
        />
        {/* Search Overlay - ChatGPT style */}
        {showSearchOverlay && type === 'chat' && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: '#0a0e27',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '10vh'
          }}
          onClick={() => setShowSearchOverlay(false)}
          >
            <div
              style={{
                width: '600px',
                maxWidth: '90%',
                background: '#060A14',
                borderRadius: '16px',
                border: '1px solid #28395C',
                overflow: 'hidden'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Search Input */}
              <div style={{
                padding: '16px',
                borderBottom: '1px solid #28395C',
                position: 'relative'
              }}>
                <input
                  type="text"
                  placeholder={language === 'he' ? 'חיפוש בצ\'אטים...' : 'Search chats...'}
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px 40px 12px 16px',
                    backgroundColor: '#2a2d3a',
                    border: '1px solid #28395C',
                    borderRadius: '8px',
                    color: '#E9EFFA',
                    fontSize: '16px',
                    outline: 'none'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowSearchOverlay(false);
                      setSearchValue('');
                    }
                  }}
                />
                <button
                  onClick={() => {
                    setShowSearchOverlay(false);
                    setSearchValue('');
                  }}
                  style={{
                    position: 'absolute',
                    right: '24px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#93A2BE',
                    cursor: 'pointer',
                    padding: '4px',
                    fontSize: '20px'
                  }}
                >
                  <CloseIcon size={20} />
                </button>
              </div>

              {/* Search Results */}
              <div style={{
                maxHeight: '400px',
                overflowY: 'auto',
                padding: '8px'
              }}>
                {/* Loading state */}
                {isSearching && (
                  <div style={{
                    padding: '20px',
                    color: '#B7C2D8',
                    textAlign: 'center',
                    fontSize: '14px'
                  }}>
                    {language === 'he' ? 'מחפש...' : 'Searching...'}
                  </div>
                )}

                {/* Error state */}
                {searchError && (
                  <div style={{
                    padding: '20px',
                    color: '#ff6b6b',
                    textAlign: 'center',
                    fontSize: '14px'
                  }}>
                    {searchError}
                  </div>
                )}

                {/* Results */}
                {!isSearching && !searchError && searchResults && (
                  <>
                    {/* Sessions results */}
                    {searchResults.sessions && searchResults.sessions.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{
                          padding: '8px 12px',
                          color: '#93A2BE',
                          fontSize: '12px',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {language === 'he' ? 'שיחות' : 'Conversations'}
                        </div>
                        {searchResults.sessions.map(session => (
                          <div
                            key={session.sessionId || session._id}
                            style={{
                              padding: '10px 12px',
                              cursor: 'pointer',
                              borderRadius: '6px',
                              marginBottom: '4px'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#0E1626';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            onClick={() => {
                              if (onSearch) {
                                onSearch(session.sessionId || session._id);
                              }
                              setShowSearchOverlay(false);
                              setSearchValue('');
                            }}
                          >
                            <div style={{
                              color: '#E9EFFA',
                              fontSize: '14px',
                              fontWeight: '500',
                              marginBottom: '4px'
                            }}>
                              {session.title || (language === 'he' ? 'שיחה חדשה' : 'New Chat')}
                            </div>
                            <div style={{
                              color: '#93A2BE',
                              fontSize: '12px'
                            }}>
                              {new Date(session.createdAt || session.timestamp).toLocaleDateString(
                                language === 'he' ? 'he-IL' : 'en-US'
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Messages results */}
                    {searchResults.messages && searchResults.messages.length > 0 && (
                      <div>
                        <div style={{
                          padding: '8px 12px',
                          color: '#93A2BE',
                          fontSize: '12px',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {language === 'he' ? 'הודעות' : 'Messages'}
                        </div>
                        {searchResults.messages.map(message => (
                          <div
                            key={message.messageId || message._id}
                            style={{
                              padding: '10px 12px',
                              cursor: 'pointer',
                              borderRadius: '6px',
                              marginBottom: '4px'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#0E1626';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            onClick={() => {
                              if (onSearch) {
                                onSearch(message.sessionId);
                              }
                              setShowSearchOverlay(false);
                              setSearchValue('');
                            }}
                          >
                            <div style={{
                              color: '#B7C2D8',
                              fontSize: '13px',
                              lineHeight: '1.4',
                              maxHeight: '40px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {message.content?.substring(0, 100)}...
                            </div>
                            <div style={{
                              color: '#93A2BE',
                              fontSize: '11px',
                              marginTop: '4px'
                            }}>
                              {new Date(message.timestamp).toLocaleDateString(
                                language === 'he' ? 'he-IL' : 'en-US'
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* No results */}
                    {searchResults.totalResults === 0 && (
                      <div style={{
                        padding: '20px',
                        color: '#93A2BE',
                        textAlign: 'center',
                        fontSize: '14px'
                      }}>
                        {language === 'he' ?
                          `לא נמצאו תוצאות עבור "${searchValue}"` :
                          `No results found for "${searchValue}"`}
                      </div>
                    )}
                  </>
                )}

                {/* Empty state */}
                {!isSearching && !searchError && !searchResults && !searchValue && (
                  <div style={{
                    padding: '20px',
                    color: '#93A2BE',
                    textAlign: 'center',
                    fontSize: '14px'
                  }}>
                    {language === 'he' ?
                      'התחל להקליד כדי לחפש בצ\'אטים שלך' :
                      'Start typing to search your chats'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
  
  return (
    <div
      style={styles.container}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header with logo and toggle */}
      <div style={{
        padding: '12px',
        borderBottom: '1px solid #28395C',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {/* Logo and New Chat row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            onClick={onToggle}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'transform 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <PulseMark size={32} />
          </div>
          
          {/* New Chat button - only for chat type */}
          {type === 'chat' && (
            <button 
              onClick={onNewChat}
              style={{
                flex: 1,
                padding: '10px 14px',
                backgroundColor: 'transparent',
                border: '1px solid #28395C',
                borderRadius: '6px',
                color: '#E9EFFA',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#0E1626';
                e.currentTarget.style.borderColor = '#93A2BE';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = '#28395C';
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-flex', color: '#93A2BE' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </span>
                {language === 'he' ? 'צ׳אט חדש' : 'New chat'}
              </span>
              <span style={{ fontSize: '11px', opacity: 0.5 }}>
                Ctrl+Shift+O
              </span>
            </button>
          )}
        </div>
        
        {/* Removed search bar - now handled by icon in MinimalSidebar */}
      </div>
      
      {/* Main content area */}
      <div style={{
        ...styles.content,
        paddingBottom: type === 'chat' ? '60px' : '16px' // Only add padding for chat sidebar with profile
      }}>
        {children}
      </div>
      
      {/* Profile section at bottom - only for chat sidebar */}
      {type === 'chat' && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px',
          borderTop: '1px solid #28395C',
          backgroundColor: '#0A1020'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
          onClick={() => onProfileClick && onProfileClick()}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#13203A'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(61,139,255,0.10)',
              border: '1px solid #173a78',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#3D8BFF'
            }}>
              {userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}
            </div>
            <div style={{
              flex: 1,
              fontSize: '14px',
              color: '#E9EFFA',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {userEmail || (language === 'he' ? 'משתמש' : 'User')}
            </div>
          </div>
        </div>
      )}
      
      {/* Search Overlay - ChatGPT style */}
      {showSearchOverlay && type === 'chat' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#0a0e27',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: '10vh'
        }}
        onClick={() => setShowSearchOverlay(false)}
        >
          <div
            style={{
              width: '600px',
              maxWidth: '90%',
              backgroundColor: '#2d2f31',
              borderRadius: '12px',
              border: '1px solid #28395C',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input */}
            <div style={{
              padding: '16px',
              borderBottom: '1px solid #28395C',
              position: 'relative'
            }}>
              <input
                type="text"
                placeholder={language === 'he' ? 'חיפוש בצ\'אטים...' : 'Search chats...'}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px 40px 12px 16px',
                  backgroundColor: '#2a2d3a',
                  border: '1px solid #28395C',
                  borderRadius: '8px',
                  color: '#E9EFFA',
                  fontSize: '16px',
                  outline: 'none'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowSearchOverlay(false);
                    setSearchValue('');
                  }
                }}
              />
              <button
                onClick={() => {
                  setShowSearchOverlay(false);
                  setSearchValue('');
                }}
                style={{
                  position: 'absolute',
                  right: '24px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#93A2BE',
                  cursor: 'pointer',
                  padding: '4px',
                  fontSize: '20px'
                }}
              >
                ×
              </button>
            </div>
            
            {/* Search Results */}
            <div style={{
              maxHeight: '400px',
              overflowY: 'auto',
              padding: '8px'
            }}>
              {/* Loading state */}
              {isSearching && (
                <div style={{
                  padding: '20px',
                  color: '#B7C2D8',
                  textAlign: 'center',
                  fontSize: '14px'
                }}>
                  {language === 'he' ? 'מחפש...' : 'Searching...'}
                </div>
              )}

              {/* Error state */}
              {searchError && (
                <div style={{
                  padding: '20px',
                  color: '#ff6b6b',
                  textAlign: 'center',
                  fontSize: '14px'
                }}>
                  {searchError}
                </div>
              )}

              {/* Results */}
              {!isSearching && !searchError && searchResults && (
                <>
                  {/* Sessions results */}
                  {searchResults.sessions && searchResults.sessions.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{
                        padding: '8px 12px',
                        color: '#93A2BE',
                        fontSize: '12px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {language === 'he' ? 'שיחות' : 'Conversations'}
                      </div>
                      {searchResults.sessions.map(session => (
                        <div
                          key={session.sessionId || session._id}
                          style={{
                            padding: '10px 12px',
                            cursor: 'pointer',
                            borderRadius: '6px',
                            marginBottom: '4px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#0E1626';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          onClick={() => {
                            // Load this session
                            if (onSearch) {
                              onSearch(session.sessionId || session._id);
                            }
                            setShowSearchOverlay(false);
                          }}
                        >
                          <div style={{
                            color: '#E9EFFA',
                            fontSize: '14px',
                            fontWeight: '500',
                            marginBottom: '4px'
                          }}>
                            {session.title || (language === 'he' ? 'שיחה חדשה' : 'New Chat')}
                          </div>
                          <div style={{
                            color: '#93A2BE',
                            fontSize: '12px'
                          }}>
                            {new Date(session.createdAt || session.timestamp).toLocaleDateString(
                              language === 'he' ? 'he-IL' : 'en-US'
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Messages results */}
                  {searchResults.messages && searchResults.messages.length > 0 && (
                    <div>
                      <div style={{
                        padding: '8px 12px',
                        color: '#93A2BE',
                        fontSize: '12px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {language === 'he' ? 'הודעות' : 'Messages'}
                      </div>
                      {searchResults.messages.map(message => (
                        <div
                          key={message.messageId || message._id}
                          style={{
                            padding: '10px 12px',
                            cursor: 'pointer',
                            borderRadius: '6px',
                            marginBottom: '4px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#0E1626';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          onClick={() => {
                            // Load the session containing this message
                            if (onSearch) {
                              onSearch(message.sessionId);
                            }
                            setShowSearchOverlay(false);
                          }}
                        >
                          <div style={{
                            color: '#B7C2D8',
                            fontSize: '13px',
                            lineHeight: '1.4',
                            maxHeight: '40px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {message.content.substring(0, 100)}...
                          </div>
                          <div style={{
                            color: '#93A2BE',
                            fontSize: '11px',
                            marginTop: '4px'
                          }}>
                            {new Date(message.timestamp).toLocaleDateString(
                              language === 'he' ? 'he-IL' : 'en-US'
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* No results */}
                  {searchResults.totalResults === 0 && (
                    <div style={{
                      padding: '20px',
                      color: '#93A2BE',
                      textAlign: 'center',
                      fontSize: '14px'
                    }}>
                      {language === 'he' ?
                        `לא נמצאו תוצאות עבור "${searchValue}"` :
                        `No results found for "${searchValue}"`}
                    </div>
                  )}
                </>
              )}

              {/* Empty state */}
              {!isSearching && !searchError && !searchResults && !searchValue && (
                <div style={{
                  padding: '20px',
                  color: '#93A2BE',
                  textAlign: 'center',
                  fontSize: '14px'
                }}>
                  {language === 'he' ?
                    'התחל להקליד כדי לחפש בצ\'אטים שלך' :
                    'Start typing to search your chats'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollapsibleSidebar;