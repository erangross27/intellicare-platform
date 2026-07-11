import React, { useState, useRef, useCallback, useEffect } from 'react';
import PulseMark from '../PulseMark';

// Global flag to ensure CSS is only added once
let minimalSidebarStylesInjected = false;

const MinimalSidebar = ({
  position = 'left',
  isOpen,
  onToggle,
  onHoverOpen = null, // New prop for hover-to-open behavior
  language = 'en',
  type = 'chat', // 'chat' or 'medical'
  userEmail = null,
  onNewChat = null,
  onSearch = null,
  onIconClick = null,
  onProfileClick = null,
  notificationCount = 0, // Unread notification count for bell icon
  staffChatCount = 0 // Unread staff chat message count
}) => {
  const isRTL = language === 'he';
  const actualPosition = isRTL ? (position === 'left' ? 'right' : 'left') : position;

  // Individual states for each button to avoid re-render issues
  const [toggleHover, setToggleHover] = useState(false);
  const [button0Hover, setButton0Hover] = useState(false);
  const [button1Hover, setButton1Hover] = useState(false);
  const [button2Hover, setButton2Hover] = useState(false);
  const [profileHover, setProfileHover] = useState(false);

  // Bell animation state
  const [bellRinging, setBellRinging] = useState(false);
  const prevCountRef = useRef(0); // Always start at 0 so first count triggers animation

  // Inject bell animation CSS once
  useEffect(() => {
    if (minimalSidebarStylesInjected) return;
    const styleId = 'minimal-sidebar-bell-styles';
    if (document.getElementById(styleId)) {
      minimalSidebarStylesInjected = true;
      return;
    }
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      @keyframes ms-bell-ring {
        0% { transform: rotate(0deg); }
        5% { transform: rotate(14deg); }
        10% { transform: rotate(-12deg); }
        15% { transform: rotate(10deg); }
        20% { transform: rotate(-8deg); }
        25% { transform: rotate(6deg); }
        30% { transform: rotate(-4deg); }
        35% { transform: rotate(2deg); }
        40% { transform: rotate(0deg); }
        100% { transform: rotate(0deg); }
      }
      @keyframes ms-badge-pulse {
        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
        50% { transform: scale(1.3); box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
      }
      .ms-bell-ringing {
        animation: ms-bell-ring 0.8s ease-in-out 3;
        transform-origin: top center;
      }
      .ms-bell-ringing svg {
        stroke: #fbbf24 !important;
        filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.8));
      }
      .ms-badge-pulse {
        animation: ms-badge-pulse 1s ease-in-out 3;
      }
    `;
    document.head.appendChild(style);
    minimalSidebarStylesInjected = true;
  }, []);

  // Detect notification count increase → trigger bell animation + sound
  useEffect(() => {
    const current = notificationCount || 0;
    const previous = prevCountRef.current || 0;
    prevCountRef.current = notificationCount;

    if (current > previous) {
      setBellRinging(true);
      // Play notification chime
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const playTone = (frequency, startTime, duration) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(frequency, audioCtx.currentTime + startTime);
          gain.gain.setValueAtTime(0, audioCtx.currentTime + startTime);
          gain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + startTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + startTime + duration);
          osc.start(audioCtx.currentTime + startTime);
          osc.stop(audioCtx.currentTime + startTime + duration);
        };
        playTone(523, 0, 0.3);    // C5
        playTone(659, 0.15, 0.4); // E5
        setTimeout(() => audioCtx.close(), 1000);
      } catch (e) {
        // Silently fail
      }

      const timer = setTimeout(() => setBellRinging(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [notificationCount]);

  // Professional SVG icons as React components
  const ChatIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
  
  const SearchIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
  
  const HistoryIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v5h5M21 12a9 9 0 0 0-9-9 9 9 0 0 0-9 9 9 9 0 0 0 9 9 9 9 0 0 0 9-9z" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
  
  const DashboardIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
  
  const CalendarIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );

  const BellIcon = () => (
    <div style={{ position: 'relative', display: 'inline-flex' }} className={bellRinging ? 'ms-bell-ringing' : ''}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={notificationCount > 0 ? '#fbbf24' : 'currentColor'}
        strokeWidth="2"
        style={notificationCount > 0 ? { filter: 'drop-shadow(0 0 4px rgba(251, 191, 36, 0.6))' } : {}}
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {notificationCount > 0 && (
        <span className={bellRinging ? 'ms-badge-pulse' : ''} style={{
          position: 'absolute',
          top: '-2px',
          right: '-2px',
          backgroundColor: '#ef4444',
          color: '#fff',
          borderRadius: '50%',
          width: '8px',
          height: '8px',
          border: '1.5px solid #0A1020'
        }} />
      )}
    </div>
  );

  const StaffChatIcon = () => (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={staffChatCount > 0 ? '#4dabf7' : 'currentColor'}
        strokeWidth="2"
        style={staffChatCount > 0 ? { filter: 'drop-shadow(0 0 4px rgba(77, 171, 247, 0.6))' } : {}}
      >
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
      {staffChatCount > 0 && (
        <span style={{
          position: 'absolute',
          top: '-2px',
          right: '-2px',
          backgroundColor: '#ef4444',
          color: '#fff',
          borderRadius: '50%',
          width: '8px',
          height: '8px',
          border: '1.5px solid #0A1020'
        }} />
      )}
    </div>
  );

  const WorkflowIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7Z" />
      <path d="M8.5 19h7" />
      <path d="M9 21h6" />
    </svg>
  );

  const ArtifactIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <line x1="9" y1="3" x2="9" y2="21"/>
      <line x1="3" y1="9" x2="9" y2="9"/>
      <line x1="3" y1="15" x2="9" y2="15"/>
    </svg>
  );

  const DeviceRecallIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
      <path d="M9 9h6v6H9z"/>
      <line x1="9" y1="1" x2="9" y2="4"/>
      <line x1="15" y1="1" x2="15" y2="4"/>
      <line x1="9" y1="20" x2="9" y2="23"/>
      <line x1="15" y1="20" x2="15" y2="23"/>
      <line x1="20" y1="9" x2="23" y2="9"/>
      <line x1="20" y1="14" x2="23" y2="14"/>
      <line x1="1" y1="9" x2="4" y2="9"/>
      <line x1="1" y1="14" x2="4" y2="14"/>
    </svg>
  );

  const DrugShortageIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.5 20.5L3.5 13.5C2.5 12.5 2.5 11 3.5 10L10 3.5C11 2.5 12.5 2.5 13.5 3.5L20.5 10.5C21.5 11.5 21.5 13 20.5 14L14 20.5C13 21.5 11.5 21.5 10.5 20.5Z"/>
      <line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/>
      <line x1="12" y1="2" x2="12" y2="5"/>
      <line x1="12" y1="19" x2="12" y2="22"/>
    </svg>
  );

  const FDARecallIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.5 20.5L3.5 13.5C2.5 12.5 2.5 11 3.5 10L10 3.5C11 2.5 12.5 2.5 13.5 3.5L20.5 10.5C21.5 11.5 21.5 13 20.5 14L14 20.5C13 21.5 11.5 21.5 10.5 20.5Z"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );

  const icons = type === 'chat' ? [
    {
      icon: <ChatIcon />,
      title: language === 'he' ? 'צ׳אט חדש' : 'New chat',
      description: language === 'he' ? 'התחל שיחה חדשה עם העוזר הרפואי' : 'Start a new conversation with the medical assistant',
      action: 'new-chat',
      shortcut: 'Ctrl+Shift+O'
    },
    {
      icon: <SearchIcon />,
      title: language === 'he' ? 'חיפוש' : 'Search',
      description: language === 'he' ? 'חפש בהיסטוריית השיחות שלך' : 'Search through your chat history',
      action: 'search'
    },
    {
      icon: <HistoryIcon />,
      title: language === 'he' ? 'היסטוריה' : 'History',
      description: language === 'he' ? 'צפה בשיחות קודמות' : 'View previous conversations',
      action: 'history'
    },
    {
      icon: <StaffChatIcon />,
      title: language === 'he' ? "צ'אט צוות" : 'Staff Chat',
      description: language === 'he' ? 'שלח הודעות מוצפנות לצוות' : 'Send encrypted messages to staff',
      action: 'staff-chat'
    }
  ] : [
    {
      icon: <CalendarIcon />,
      title: language === 'he' ? 'תורים' : 'Appointments',
      description: language === 'he' ? 'ניהול תורים ופגישות קרובות' : 'Manage upcoming appointments and meetings',
      action: 'appointments'
    },
    {
      icon: <BellIcon />,
      title: language === 'he' ? 'התראות' : 'Notifications',
      description: language === 'he' ? 'צפה בהתראות ועדכונים חשובים' : 'View important notifications and updates',
      action: 'notifications'
    },
    {
      icon: <FDARecallIcon />,
      title: language === 'he' ? 'החזרות תרופות FDA' : 'FDA Drug Recalls',
      description: language === 'he' ? 'התראות החזרת תרופות מ-FDA למטופלים שלך' : 'FDA drug recall alerts for your patients',
      action: 'fda-recalls'
    },
    {
      icon: <DeviceRecallIcon />,
      title: language === 'he' ? 'החזרות מכשור' : 'Device Recalls',
      description: language === 'he' ? 'התראות החזרת מכשור רפואי למטופלים שלך' : 'Medical device recall alerts for your patients',
      action: 'device-recalls'
    },
    {
      icon: <DrugShortageIcon />,
      title: language === 'he' ? 'מחסור בתרופות' : 'Drug Shortages',
      description: language === 'he' ? 'התראות מחסור בתרופות למטופלים שלך' : 'Drug shortage alerts for your patients',
      action: 'drug-shortages'
    },
    {
      icon: <WorkflowIcon />,
      title: language === 'he' ? 'הצעות זרימה' : 'Workflow Suggestions',
      description: language === 'he' ? 'הצעות לזרימת עבודה חכמה' : 'Smart workflow suggestions',
      action: 'workflow'
    },
    {
      icon: <ArtifactIcon />,
      title: language === 'he' ? 'נתונים רפואיים' : 'Medical Data',
      description: language === 'he' ? 'פתח פאנל נתונים רפואיים' : 'Open medical data artifact panel',
      action: 'artifact'
    },
    {
      icon: <StaffChatIcon />,
      title: language === 'he' ? "צ'אט צוות" : 'Staff Chat',
      description: language === 'he' ? 'שלח הודעות מוצפנות לצוות' : 'Send encrypted messages to staff',
      action: 'staff-chat'
    }
  ];
  
  const styles = {
    container: {
      position: 'fixed',
      top: 0,
      bottom: 0,
      [actualPosition]: 0,
      width: '64px',
      background: '#0A1020',
      borderRight: actualPosition === 'left' ? '1px solid #28395C' : 'none',
      borderLeft: actualPosition === 'right' ? '1px solid #28395C' : 'none',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 999
    },

    toggleButton: {
      height: '56px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      borderBottom: '1px solid #28395C',
      userSelect: 'none',
      padding: '8px',
      background: toggleHover ? '#0E1626' : 'transparent'
    },
    
    logo: {
      width: '32px',
      height: '32px',
      borderRadius: '8px',
      background: 'transparent',
      border: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#E9EFFA'
    },
    
    iconList: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: '8px',
      gap: '4px',
      overflowY: 'auto'
    },
    
    iconItem: {
      height: '40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '20px',
      position: 'relative',
      color: '#93A2BE',
      transition: 'background-color 0.2s ease, color 0.2s ease'
    },
    
    tooltip: {
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
      background: '#060A14',
      color: '#E9EFFA',
      padding: '8px 12px',
      borderRadius: '8px',
      fontSize: '14px',
      fontFamily: 'Comfortaa, Geneva, Tahoma, sans-serif',
      fontWeight: '500',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      transition: 'opacity 0.2s ease-in-out, visibility 0.2s ease-in-out',
      zIndex: 10000,
      boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
      border: '1px solid rgba(255,255,255,0.3)'
    },
    
    profileSection: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: '8px',
      borderTop: '1px solid #28395C'
    },

    profileButton: {
      width: '48px',
      height: '48px',
      borderRadius: '8px',
      background: profileHover ? 'rgba(61,139,255,0.20)' : 'rgba(61,139,255,0.10)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      border: '1px solid #173a78',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s',
      fontSize: '16px',
      fontWeight: 'bold',
      color: '#3D8BFF',
      boxShadow: 'none'
    }
  };
  
  // Note: Sidebar opens on CLICK only (not hover)
  // onHoverOpen is no longer used for opening, but kept for potential future use

  return (
    <div style={styles.container}>
      <div
        style={{
          ...styles.toggleButton,
          position: 'relative'
        }}
        onClick={onToggle}
        onMouseEnter={() => {
          setToggleHover(true);
          // Sidebar opens on CLICK only, not hover
        }}
        onMouseLeave={() => setToggleHover(false)}
      >
        <div className="logo" style={styles.logo}>
          <PulseMark size={32} />
        </div>
        <div style={{
          ...styles.tooltip,
          [actualPosition === 'left' ? 'left' : 'right']: '70px',
          opacity: toggleHover ? 1 : 0,
          visibility: toggleHover ? 'visible' : 'hidden'
        }}>
          {language === 'he' ? 'פתח/סגור תפריט' : 'Open/Close Menu'}
        </div>
      </div>
      
      <div style={styles.iconList}>
        {icons.map((item, index) => (
          <div
            key={index}
            style={{
              ...styles.iconItem,
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(61,139,255,0.14)';
              e.currentTarget.style.color = '#74AEFF';
              // Icons only show tooltip on hover - no expand action
              // Click triggers the actual action
              const tooltip = e.currentTarget.querySelector('[data-tooltip]');
              if (tooltip) {
                // Replace entire style attribute to force visibility
                // Move tooltip further away to avoid triggering mouse leave
                const position = actualPosition === 'left' ? 'left: 80px;' : 'right: 80px;';
                tooltip.setAttribute('style', `
                  position: fixed !important;
                  top: ${e.currentTarget.getBoundingClientRect().top + 20}px !important;
                  background-color: #000000 !important;
                  color: #ffffff !important;
                  padding: 8px 12px !important;
                  border-radius: 6px !important;
                  font-size: 13px !important;
                  font-weight: 500 !important;
                  white-space: nowrap !important;
                  pointer-events: none !important;
                  z-index: 999999 !important;
                  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5) !important;
                  border: none !important;
                  ${position}
                  opacity: 1 !important;
                  visibility: visible !important;
                  display: block !important;
                `);

                // Also set styles on child elements
                const children = tooltip.querySelectorAll('*');
                children.forEach(child => {
                  child.style.color = '#ffffff';
                  child.style.opacity = '1';
                });

              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#93A2BE';
              const tooltip = e.currentTarget.querySelector('[data-tooltip]');
              if (tooltip) {
                tooltip.style.opacity = '0';
                tooltip.style.visibility = 'hidden';
              }
            }}
            onClick={() => {
              console.log('🖱️ [MinimalSidebar] Icon clicked:', item.action);
              if (item.action === 'new-chat') {
                if (onNewChat) onNewChat();
              } else if (item.action === 'search') {
                // Open search overlay directly without expanding sidebar
                if (onSearch) onSearch();
              } else if (item.action === 'history') {
                onToggle(); // Open sidebar to show history
              } else if (item.action === 'artifact') {
                // For artifact icon, notify parent without opening sidebar
                console.log('🎨 [MinimalSidebar] Artifact icon clicked, calling onIconClick');
                if (onIconClick) {
                  onIconClick(item.action);
                }
              } else if (item.action === 'staff-chat') {
                // Staff chat opens floating panel - don't open sidebar
                if (onIconClick) {
                  onIconClick(item.action);
                }
              } else if (item.action === 'appointments' || item.action === 'notifications' || item.action === 'fda-recalls' || item.action === 'device-recalls' || item.action === 'drug-shortages' || item.action === 'workflow') {
                // For medical icons, notify parent component which was clicked
                if (onIconClick) {
                  onIconClick(item.action);
                }
                // Also open the sidebar
                onToggle();
              }
            }}
          >
            {item.icon}
            <div data-tooltip="true" style={{
              ...styles.tooltip,
              [actualPosition === 'left' ? 'left' : 'right']: '70px',
              opacity: 0,
              visibility: 'hidden'
            }}>
              <div style={{ fontWeight: '600' }}>{item.title}</div>
              {item.description && (
                <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '4px', lineHeight: '1.3' }}>
                  {item.description}
                </div>
              )}
              {item.shortcut && (
                <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '4px' }}>
                  {item.shortcut}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* Profile section at bottom - only for chat sidebar */}
      {type === 'chat' && (
        <div style={styles.profileSection}>
          <div
            style={{
              ...styles.profileButton,
              position: 'relative',
              backgroundColor: profileHover ? 'rgba(61,139,255,0.20)' : 'rgba(61,139,255,0.10)'
            }}
            onClick={() => onProfileClick && onProfileClick()}
            onMouseEnter={() => {
              setProfileHover(true);
            }}
            onMouseLeave={() => setProfileHover(false)}
          >
            {userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}
            <div style={{
              ...styles.tooltip,
              [actualPosition === 'left' ? 'left' : 'right']: '70px',
              bottom: '50%',
              top: 'auto',
              transform: 'translateY(50%)',
              opacity: profileHover ? 1 : 0,
              visibility: profileHover ? 'visible' : 'hidden'
            }}>
              {userEmail || (language === 'he' ? 'פרופיל' : 'Profile')}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default MinimalSidebar;