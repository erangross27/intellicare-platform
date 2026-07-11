import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../config/languagesStatic';

const PatientTimeline = ({ patient, analyses = [] }) => {
  const { t, isRTL } = useLanguage();
  const [isMobile, setIsMobile] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Toggle accordion section
  const toggleSection = (sectionKey) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // Group events by month/year
  const groupEventsByMonth = useCallback((events) => {
    const grouped = {};

    events.forEach(event => {
      const date = new Date(event.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString(isRTL ? 'he-IL' : 'en-US', {
        year: 'numeric',
        month: 'long'
      });

      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          label: monthLabel,
          events: [],
          count: 0
        };
      }

      grouped[monthKey].events.push(event);
      grouped[monthKey].count++;
    });

    return grouped;
  }, [isRTL]);

  // Create timeline events from patient data
  const timelineEvents = useMemo(() => {
    const events = [];

    // Patient registration
    if (patient?.date) {
      events.push({
        id: 'registration',
        date: new Date(patient.date),
        type: 'registration',
        title: t('patientRegistered'),
        description: t('patientRegisteredDescription'),
        icon: '👤',
        color: '#667eea'
      });
    }

    // Medical history entries
    if (patient?.medicalHistory && Array.isArray(patient.medicalHistory)) {
      patient.medicalHistory.forEach((entry, index) => {
        if (entry.date) {
          events.push({
            id: `history-${index}`,
            date: new Date(entry.date),
            type: 'medical_record',
            title: entry.diagnosis || t('medicalRecord'),
            description: entry.symptoms || entry.notes || t('medicalRecordAdded'),
            icon: '🏥',
            color: '#48bb78'
          });
        }
      });
    }

    // Document uploads (from analyses)
    analyses.forEach((analysis, index) => {
      if (analysis.createdAt) {
        events.push({
          id: `document-${index}`,
          date: new Date(analysis.createdAt),
          type: 'document_upload',
          title: t('documentUploaded'),
          description: analysis.fileName || t('documentProcessed'),
          icon: '📄',
          color: '#ed8936'
        });

        // Analysis completion
        if (analysis.completedAt) {
          events.push({
            id: `analysis-${index}`,
            date: new Date(analysis.completedAt),
            type: 'analysis_complete',
            title: t('analysisCompleted'),
            description: t('aiAnalysisFinished'),
            icon: '🔬',
            color: '#9f7aea'
          });
        }
      }
    });

    // Sort events by date (newest first)
    return events.sort((a, b) => b.date - a.date);
  }, [patient, analyses, t]);

  // Group timeline events by month
  const groupedEvents = useMemo(() => {
    return groupEventsByMonth(timelineEvents);
  }, [timelineEvents, groupEventsByMonth]);

  const styles = useMemo(() => ({
    timelineContainer: {
      background: '#ffffff',
      borderRadius: isMobile ? '12px' : '16px',
      padding: isMobile ? '20px' : '30px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
      position: 'relative'
    },
    timelineHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '30px',
      paddingBottom: '20px',
      borderBottom: '1px solid #e2e8f0'
    },
    timelineIcon: {
      display: 'none'
    },
    timelineTitle: {
      fontSize: '1.3rem',
      fontWeight: '600',
      color: '#2d3748',
      margin: 0,
      fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif'
    },
    timeline: {
      position: 'relative',
      paddingLeft: isRTL ? '0' : (isMobile ? '30px' : '40px'),
      paddingRight: isRTL ? (isMobile ? '30px' : '40px') : '0'
    },
    timelineLine: {
      position: 'absolute',
      [isRTL ? 'right' : 'left']: '20px',
      top: '0',
      bottom: '0',
      width: '2px',
      background: '#cbd5e0',
      borderRadius: '1px'
    },
    timelineItem: {
      position: 'relative',
      marginBottom: isMobile ? '24px' : '32px',
      background: '#ffffff',
      padding: isMobile ? '20px' : '28px',
      borderRadius: isMobile ? '12px' : '16px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
      border: '1px solid #e2e8f0',
      transition: 'all 0.2s ease',
      cursor: 'default',
      overflow: 'hidden'
    },
    timelineDot: () => ({
      position: 'absolute',
      [isRTL ? 'right' : 'left']: '-28px',
      top: '28px',
      width: '12px',
      height: '12px',
      background: '#718096',
      borderRadius: '50%',
      border: '3px solid white',
      boxShadow: '0 0 0 2px #e2e8f0',
      zIndex: 3
    }),
    eventHeader: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '16px',
      marginBottom: '16px',
      position: 'relative'
    },
    eventIcon: {
      fontSize: isMobile ? '1.2rem' : '1.4rem',
      width: isMobile ? '40px' : '48px',
      height: isMobile ? '40px' : '48px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: isMobile ? '8px' : '12px',
      background: '#f7fafc',
      border: '1px solid #e2e8f0',
      flexShrink: 0
    },
    eventContent: {
      flex: 1
    },
    eventTitle: {
      fontSize: isMobile ? '0.8rem' : '0.875rem',
      fontWeight: '500',
      color: '#2d3748',
      margin: '0 0 2px 0',
      textAlign: isRTL ? 'right' : 'left',
      lineHeight: '1.3',
      letterSpacing: '-0.02em'
    },
    eventDate: {
      fontSize: isMobile ? '0.85rem' : '0.9rem',
      color: '#718096',
      fontWeight: '500',
      marginBottom: '12px',
      background: '#f7fafc',
      padding: '4px 12px',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      display: 'inline-block'
    },
    eventDescription: {
      fontSize: isMobile ? '0.9rem' : '1rem',
      color: '#2d3748',
      lineHeight: '1.6',
      textAlign: isRTL ? 'right' : 'left',
      background: '#f9fafb',
      padding: '12px 16px',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      margin: 0
    },
    emptyTimeline: {
      textAlign: 'center',
      padding: '40px',
      color: '#a0aec0'
    },
    emptyIcon: {
      fontSize: '3rem',
      marginBottom: '16px',
      opacity: 0.5
    },
    emptyText: {
      fontSize: '1.1rem',
      fontWeight: '500'
    },
    // Accordion styles
    accordionSection: {
      marginBottom: isMobile ? '16px' : '20px',
      background: '#ffffff',
      borderRadius: isMobile ? '8px' : '12px',
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
    },
    accordionHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: isMobile ? '16px 20px' : '20px 24px',
      cursor: 'pointer',
      background: '#f8f9fa',
      borderBottom: '1px solid #e2e8f0',
      transition: 'all 0.2s ease'
    },
    accordionHeaderExpanded: {
      background: '#f1f3f4'
    },
    accordionTitle: {
      fontSize: isMobile ? '1rem' : '1.1rem',
      fontWeight: '600',
      color: '#2d3748',
      margin: 0,
      fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif'
    },
    accordionMeta: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    accordionCount: {
      background: '#718096',
      color: 'white',
      padding: '4px 10px',
      borderRadius: '12px',
      fontSize: '0.8rem',
      fontWeight: '500'
    },
    accordionArrow: {
      fontSize: '1.1rem',
      color: '#718096',
      transition: 'transform 0.2s ease'
    },
    accordionArrowExpanded: {
      transform: 'rotate(180deg)'
    },
    accordionContent: {
      padding: 0,
      maxHeight: 0,
      overflow: 'hidden',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
    },
    accordionContentExpanded: {
      maxHeight: '2000px',
      padding: isMobile ? '16px' : '20px'
    }
  }), [isRTL, isMobile]);

  const formatEventDate = (date) => {
    // Check if this is a date-only value (stored as date string without time)
    // by checking if hours are 0, 3, or other timezone offset values that suggest date-only storage
    const hours = date.getHours();
    const minutes = date.getMinutes();

    // Consider it date-only if:
    // 1. Exactly midnight (00:00)
    // 2. Exactly 3:00 (common timezone offset for date-only values)
    // 3. Any hour with 0 minutes that's likely a timezone offset (0-12)
    const isDateOnly = (hours === 0 && minutes === 0) ||
                       (hours === 3 && minutes === 0) ||
                       (hours <= 12 && minutes === 0);

    if (!isDateOnly) {
      // Show date with time - this has meaningful time information
      return date.toLocaleDateString(isRTL ? 'he-IL' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      // Show date only (no time) - this is a date-only value
      return date.toLocaleDateString(isRTL ? 'he-IL' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  };

  if (timelineEvents.length === 0) {
    return (
      <div style={styles.timelineContainer}>
        <div style={styles.timelineHeader}>
          <div style={styles.timelineIcon}>📅</div>
          <h3 style={styles.timelineTitle}>{t('patientTimeline')}</h3>
        </div>
        <div style={styles.emptyTimeline}>
          <div style={styles.emptyIcon}>📅</div>
          <p style={styles.emptyText}>{t('noTimelineEvents')}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.timelineContainer}>
      <div style={styles.timelineHeader}>
        <div style={styles.timelineIcon}>📅</div>
        <h3 style={styles.timelineTitle}>{t('patientTimeline')}</h3>
      </div>

      <div style={styles.timeline}>
        {Object.entries(groupedEvents).map(([monthKey, monthData]) => {
          const isExpanded = expandedSections[monthKey];

          return (
            <div key={monthKey} style={styles.accordionSection}>
              {/* Accordion Header */}
              <div
                style={{
                  ...styles.accordionHeader,
                  ...(isExpanded ? styles.accordionHeaderExpanded : {})
                }}
                onClick={() => toggleSection(monthKey)}
                onMouseEnter={(e) => {
                  if (!isExpanded) {
                    e.currentTarget.style.background = '#f3f4f6';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isExpanded) {
                    e.currentTarget.style.background = '#f8f9fa';
                  }
                }}
              >
                <h3 style={styles.accordionTitle}>{monthData.label}</h3>
                <div style={styles.accordionMeta}>
                  <span
                    style={{
                      ...styles.accordionArrow,
                      ...(isExpanded ? styles.accordionArrowExpanded : {})
                    }}
                  >
                    ▼
                  </span>
                </div>
              </div>

              {/* Accordion Content */}
              <div
                style={{
                  ...styles.accordionContent,
                  ...(isExpanded ? styles.accordionContentExpanded : {})
                }}
              >
                <div style={styles.timelineLine}></div>
                {monthData.events.map((event) => (
          <div
            key={event.id}
            style={styles.timelineItem}
          >
            <div style={styles.timelineDot(event.color)}></div>

            <div style={styles.eventHeader}>
              <div style={{
                ...styles.eventContent,
                position: 'relative'
              }}>
                <p style={{
                  ...styles.eventDate,
                  position: 'absolute',
                  top: 0,
                  right: isRTL ? 0 : 'auto',
                  left: isRTL ? 'auto' : 0,
                  margin: 0
                }}>{formatEventDate(event.date)}</p>
                <h4 style={{
                  ...styles.eventTitle,
                  margin: 0,
                  paddingTop: '40px',
                  paddingLeft: isRTL ? '0' : '12px',
                  paddingRight: isRTL ? '12px' : '0'
                }}>{event.title}</h4>
              </div>
            </div>
          </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(PatientTimeline);
