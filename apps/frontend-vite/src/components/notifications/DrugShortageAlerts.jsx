import React, { useState, useEffect, useCallback } from 'react';
import secureApi from '../../services/secureApiClient';

/**
 * Drug Shortage Alerts Component
 * Displays FDA drug shortage alerts for patients assigned to the current provider.
 * Alerts doctors when patient medications are in shortage so they can plan alternatives.
 */
const DrugShortageAlerts = ({
  language = 'en',
  maxItems = 10,
  onPatientClick
}) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedAlert, setExpandedAlert] = useState(null);
  const [copiedAlert, setCopiedAlert] = useState(null);
  const isRTL = language === 'he';

  // Translations
  const t = React.useMemo(() => {
    const labels = {
      en: {
        title: 'Drug Shortages',
        noAlerts: 'No drug shortage alerts for your patients',
        loading: 'Checking for shortages...',
        error: 'Failed to load shortage alerts',
        retry: 'Retry',
        patient: 'Patient',
        medication: 'Medication',
        severity: 'Severity',
        viewDetails: 'View Details',
        hideDetails: 'Hide Details',
        reason: 'Reason',
        expectedResolution: 'Expected Resolution',
        highSeverity: 'High',
        mediumSeverity: 'Medium',
        lowSeverity: 'Low',
        copy: 'Copy',
        copied: 'Copied!',
        alternatives: 'Consider alternatives',
        contactPharmacy: 'Contact pharmacy for availability'
      },
      he: {
        title: 'מחסור בתרופות',
        noAlerts: 'אין התראות מחסור למטופלים שלך',
        loading: 'בודק מחסורים...',
        error: 'טעינת התראות נכשלה',
        retry: 'נסה שוב',
        patient: 'מטופל',
        medication: 'תרופה',
        severity: 'חומרה',
        viewDetails: 'הצג פרטים',
        hideDetails: 'הסתר פרטים',
        reason: 'סיבה',
        expectedResolution: 'צפי לפתרון',
        highSeverity: 'גבוהה',
        mediumSeverity: 'בינונית',
        lowSeverity: 'נמוכה',
        copy: 'העתק',
        copied: 'הועתק!',
        alternatives: 'שקול חלופות',
        contactPharmacy: 'צור קשר עם בית מרקחת לבדיקת זמינות'
      }
    };
    return labels[language] || labels.en;
  }, [language]);

  // Fetch provider-specific shortage alerts
  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await secureApi.get('/api/external/drug-shortages/provider-alerts');

      if (response && response.success) {
        // Sort by severity (high first) and limit
        const sortedAlerts = (response.data || [])
          .sort((a, b) => {
            const severityOrder = { high: 0, medium: 1, low: 2 };
            return (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
          })
          .slice(0, maxItems);

        setAlerts(sortedAlerts);
      } else {
        setAlerts([]);
      }
    } catch (err) {
      console.error('Failed to fetch drug shortage alerts:', err);
      setError(err.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [maxItems]);

  // Load alerts on mount
  useEffect(() => {
    fetchAlerts();

    // Refresh every 30 minutes
    const interval = setInterval(fetchAlerts, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  // Get severity badge color (yellow/orange theme for warnings)
  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'high':
        return { bg: '#f59e0b', text: '#000000' }; // Amber
      case 'medium':
        return { bg: '#fbbf24', text: '#000000' }; // Yellow
      case 'low':
        return { bg: '#fde68a', text: '#000000' }; // Light yellow
      default:
        return { bg: '#6c757d', text: '#ffffff' }; // Gray
    }
  };

  // Get severity text
  const getSeverityText = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'high':
        return t.highSeverity;
      case 'medium':
        return t.mediumSeverity;
      case 'low':
        return t.lowSeverity;
      default:
        return severity || 'Unknown';
    }
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Handle patient click
  const handlePatientClick = (alert) => {
    if (onPatientClick && alert.patientId) {
      onPatientClick(alert.patientId, alert.patientName);
    }
  };

  // Toggle expanded alert
  const toggleExpanded = (alertId) => {
    setExpandedAlert(expandedAlert === alertId ? null : alertId);
  };

  // Copy alert to clipboard
  const copyAlertToClipboard = async (alert, alertId) => {
    const text = [
      `Drug Shortage Alert`,
      ``,
      `Patient: ${alert.patientName || 'Unknown'}`,
      `Medication: ${alert.medicationName || alert.genericName || 'Unknown'}`,
      `Severity: ${getSeverityText(alert.severity)}`,
      alert.reason ? `Reason: ${alert.reason}` : null,
      alert.expectedResolution ? `Expected Resolution: ${formatDate(alert.expectedResolution)}` : null,
      ``,
      t.contactPharmacy
    ].filter(Boolean).join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopiedAlert(alertId);
      setTimeout(() => setCopiedAlert(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const styles = {
    container: {
      padding: '0',
      direction: isRTL ? 'rtl' : 'ltr'
    },
    loadingContainer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      color: '#a0a0b0',
      gap: '8px'
    },
    spinner: {
      width: '16px',
      height: '16px',
      border: '2px solid #a0a0b0',
      borderTopColor: 'transparent',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    },
    errorContainer: {
      padding: '16px',
      textAlign: 'center',
      color: '#f59e0b'
    },
    retryButton: {
      marginTop: '8px',
      padding: '6px 12px',
      backgroundColor: '#363a46',
      color: '#ffffff',
      border: '1px solid #565869',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '13px'
    },
    noAlerts: {
      textAlign: 'center',
      padding: '24px 16px',
      color: '#22c55e',
      fontSize: '14px'
    },
    alertItem: {
      backgroundColor: '#363a46',
      border: '1px solid #1e2129',
      borderRadius: '8px',
      padding: '12px',
      marginBottom: '8px',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    alertItemHigh: {
      borderColor: '#f59e0b',
      borderLeftWidth: '4px'
    },
    alertItemMedium: {
      borderColor: '#fbbf24',
      borderLeftWidth: '4px'
    },
    alertHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '8px'
    },
    patientName: {
      fontSize: '14px',
      fontWeight: '600',
      color: '#ffffff',
      cursor: 'pointer'
    },
    severityBadge: {
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: '600',
      textTransform: 'uppercase'
    },
    medicationName: {
      fontSize: '13px',
      color: '#d0d0e0',
      marginBottom: '4px'
    },
    shortageStatus: {
      fontSize: '12px',
      color: '#f59e0b',
      fontStyle: 'italic'
    },
    expandedDetails: {
      marginTop: '12px',
      paddingTop: '12px',
      borderTop: '1px solid #565869'
    },
    detailRow: {
      display: 'flex',
      marginBottom: '6px',
      fontSize: '12px'
    },
    detailLabel: {
      color: '#a0a0b0',
      minWidth: '120px',
      fontWeight: '500'
    },
    detailValue: {
      color: '#d0d0e0',
      flex: 1
    },
    toggleButton: {
      marginTop: '8px',
      fontSize: '12px',
      color: '#fbbf24',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: 0,
      textDecoration: 'underline'
    },
    warningIcon: {
      marginRight: '6px'
    },
    copyButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      padding: '4px 10px',
      fontSize: '11px',
      fontWeight: '600',
      color: '#9ca3af',
      background: 'transparent',
      border: '1px solid #565869',
      borderRadius: '4px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      marginTop: '10px'
    },
    buttonsRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: '8px'
    },
    shortageIcon: {
      display: 'inline-block',
      marginRight: '6px',
      color: '#f59e0b'
    }
  };

  // Add keyframes for spinner
  const spinnerKeyframes = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;

  if (loading) {
    return (
      <div style={styles.container}>
        <style>{spinnerKeyframes}</style>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <span>{t.loading}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <div>{t.error}</div>
          <button style={styles.retryButton} onClick={fetchAlerts}>
            {t.retry}
          </button>
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.noAlerts}>
          <span style={styles.warningIcon}>&#10003;</span>
          {t.noAlerts}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {alerts.map((alert, index) => {
        const isExpanded = expandedAlert === alert._id || expandedAlert === index;
        const severityColors = getSeverityColor(alert.severity);
        const alertStyle = {
          ...styles.alertItem,
          ...(alert.severity === 'high' ? styles.alertItemHigh : {}),
          ...(alert.severity === 'medium' ? styles.alertItemMedium : {})
        };

        return (
          <div
            key={alert._id || index}
            style={alertStyle}
          >
            <div style={styles.alertHeader}>
              <span style={styles.patientName}>
                {alert.patientName || 'Unknown Patient'}
              </span>
              <span
                style={{
                  ...styles.severityBadge,
                  backgroundColor: severityColors.bg,
                  color: severityColors.text
                }}
              >
                {getSeverityText(alert.severity)}
              </span>
            </div>

            <div style={styles.medicationName}>
              <span style={styles.shortageIcon}>&#9888;</span>
              {alert.medicationName || alert.genericName || 'Unknown Medication'}
              {alert.dosage && ` (${alert.dosage})`}
            </div>

            <div style={styles.shortageStatus}>
              {t.alternatives}
            </div>

            {isExpanded && (
              <div style={styles.expandedDetails}>
                {alert.reason && (
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>{t.reason}:</span>
                    <span style={styles.detailValue}>{alert.reason}</span>
                  </div>
                )}
                {alert.expectedResolution && (
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>{t.expectedResolution}:</span>
                    <span style={styles.detailValue}>
                      {formatDate(alert.expectedResolution)}
                    </span>
                  </div>
                )}
                <div style={styles.detailRow}>
                  <span style={{ ...styles.detailValue, fontStyle: 'italic', color: '#f59e0b' }}>
                    {t.contactPharmacy}
                  </span>
                </div>
              </div>
            )}

            <div style={styles.buttonsRow}>
              <button
                style={styles.toggleButton}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpanded(alert._id || index);
                }}
              >
                {isExpanded ? t.hideDetails : t.viewDetails}
              </button>

              <button
                style={{
                  ...styles.copyButton,
                  ...(copiedAlert === (alert._id || index) ? {
                    background: severityColors.bg,
                    borderColor: severityColors.bg,
                    color: severityColors.text
                  } : {})
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  copyAlertToClipboard(alert, alert._id || index);
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                {copiedAlert === (alert._id || index) ? t.copied : t.copy}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DrugShortageAlerts;
