import React, { useState, useEffect, useRef, useCallback } from 'react';

// Global flag to ensure CSS is only added once
let accordionStylesInjected = false;

const AccordionSection = ({
  title,
  children,
  defaultOpen = false,
  icon = null,
  badge = null,
  language = 'en',
  forceOpen = null, // Allow parent to force open state
  onToggle = null // Optional callback when toggled
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [badgePulse, setBadgePulse] = useState(false);
  const [bellRinging, setBellRinging] = useState(false);
  const prevBadgeRef = useRef(badge);
  const isRTL = language === 'he';

  // Generate notification sound using Web Audio API (no external file needed)
  const playNotificationSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      // Two-tone chime: pleasant notification sound
      const playTone = (frequency, startTime, duration) => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime + startTime);

        // Fade in and out for a gentle chime
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime + startTime);
        gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + startTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + startTime + duration);

        oscillator.start(audioCtx.currentTime + startTime);
        oscillator.stop(audioCtx.currentTime + startTime + duration);
      };

      // Two-note chime: C5 then E5
      playTone(523, 0, 0.3);    // C5
      playTone(659, 0.15, 0.4); // E5

      // Clean up audio context after sounds finish
      setTimeout(() => audioCtx.close(), 1000);
    } catch (e) {
      // Silently fail if audio isn't available
      console.log('Notification sound unavailable:', e.message);
    }
  }, []);

  // Detect badge increase and trigger animations + sound
  useEffect(() => {
    const currentBadge = badge || 0;
    const previousBadge = prevBadgeRef.current || 0;
    prevBadgeRef.current = badge;

    if (currentBadge > previousBadge) {
      setBadgePulse(true);
      setBellRinging(true);
      playNotificationSound();

      const pulseTimer = setTimeout(() => setBadgePulse(false), 2000);
      const bellTimer = setTimeout(() => setBellRinging(false), 3000);
      return () => {
        clearTimeout(pulseTimer);
        clearTimeout(bellTimer);
      };
    }
  }, [badge, playNotificationSound]);

  // React to forceOpen prop changes
  useEffect(() => {
    if (forceOpen === true) {
      setIsOpen(true);
    } else if (forceOpen === false) {
      setIsOpen(false);
    }
  }, [forceOpen]);

  // Add CSS to hide scrollbar for webkit browsers - only once globally
  useEffect(() => {
    if (accordionStylesInjected) return;

    const styleId = 'accordion-section-styles';
    // Check if style already exists (defensive check for HMR)
    if (document.getElementById(styleId)) {
      accordionStylesInjected = true;
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      .accordion-content-inner::-webkit-scrollbar {
        display: none;
      }
      .accordion-content-inner {
        -webkit-overflow-scrolling: touch;
      }
      @keyframes badge-pulse {
        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7); }
        30% { transform: scale(1.25); box-shadow: 0 0 0 6px rgba(220, 53, 69, 0); }
        60% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); }
        80% { transform: scale(1.15); box-shadow: 0 0 0 4px rgba(220, 53, 69, 0); }
        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); }
      }
      .accordion-badge-pulse {
        animation: badge-pulse 1s ease-in-out 2;
      }
      @keyframes bell-ring {
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
      .accordion-bell-ringing {
        animation: bell-ring 0.8s ease-in-out 3;
        transform-origin: top center;
      }
      .accordion-bell-ringing svg {
        stroke: #fbbf24 !important;
        filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.6));
      }
    `;
    document.head.appendChild(style);
    accordionStylesInjected = true;

    // Don't remove on unmount - this is a global style
  }, []);

  const styles = {
    container: {
      borderBottom: '1px solid #1e2129',
      backgroundColor: '#2a2d3a'
    },

    header: {
      padding: '12px 16px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#22252f',
      transition: 'background-color 0.2s',
      userSelect: 'none',
      ':hover': {
        backgroundColor: '#2a2d3a'
      }
    },

    titleWrapper: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      flex: 1
    },

    icon: {
      fontSize: '16px',
      width: '20px',
      height: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },

    title: {
      fontSize: '14px',
      fontWeight: '600',
      color: '#ffffff',
      letterSpacing: '0.3px',
      margin: 0
    },

    badge: {
      backgroundColor: '#dc3545',
      color: 'white',
      borderRadius: '10px',
      padding: '2px 6px',
      fontSize: '11px',
      fontWeight: 'bold',
      marginLeft: isRTL ? '0' : '8px',
      marginRight: isRTL ? '8px' : '0'
    },

    chevron: {
      fontSize: '12px',
      color: '#a0a0b0',
      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
      transition: 'transform 0.3s ease'
    },

    content: {
      maxHeight: isOpen ? 'calc(100vh - 200px)' : '0',
      overflow: 'hidden',
      transition: 'max-height 0.3s ease-in-out',
      backgroundColor: '#2a2d3a',
      display: isOpen ? 'flex' : 'none',
      flexDirection: 'column'
    },

    contentInner: {
      padding: isOpen ? '12px 16px' : '0 16px',
      flex: 1,
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      scrollbarWidth: 'none', // Firefox
      msOverflowStyle: 'none' // IE/Edge
    }
  };

  return (
    <div style={styles.container}>
      <div
        style={styles.header}
        onClick={() => {
          setIsOpen(!isOpen);
          if (onToggle) onToggle();
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#2a2d3a';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#22252f';
        }}
      >
        <div style={styles.titleWrapper}>
          {icon && <div className={bellRinging ? 'accordion-bell-ringing' : ''} style={styles.icon}>{icon}</div>}
          <h3 style={styles.title}>{title}</h3>
          {badge && <span className={badgePulse ? 'accordion-badge-pulse' : ''} style={styles.badge}>{badge}</span>}
        </div>
        <span style={styles.chevron}>▼</span>
      </div>

      <div style={styles.content}>
        <div className="accordion-content-inner" style={styles.contentInner}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default AccordionSection;
