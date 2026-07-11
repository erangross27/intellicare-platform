import React, { useState, useEffect, useCallback } from 'react';
import secureApi from '../../services/secureApiClient';

/**
 * FDA Recall Alerts Component
 * Displays FDA drug recall alerts for patients assigned to the current provider.
 * Only shows alerts for patients in the provider's care (via patient_provider collection).
 */
const FDARecallAlerts = ({
  language = 'en',
  maxItems = 10,
  onPatientClick
}) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedAlert, setExpandedAlert] = useState(null);
  const [copiedAlert, setCopiedAlert] = useState(null);
  const [dataSource, setDataSource] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const isRTL = language === 'he';

  // Translations
  const t = React.useMemo(() => {
    const labels = {
      en: {
        title: 'FDA Drug Recalls',
        noAlerts: 'No active recalls for your patients',
        loading: 'Checking for recalls...',
        error: 'Failed to load recalls',
        retry: 'Retry',
        patient: 'Patient',
        medication: 'Medication',
        recallClass: 'Class',
        severity: 'Severity',
        viewDetails: 'View Details',
        hideDetails: 'Hide Details',
        affectedMedications: 'Affected Medications',
        recallReason: 'Reason',
        recallDate: 'Recall Date',
        highSeverity: 'High',
        mediumSeverity: 'Medium',
        lowSeverity: 'Low',
        class1: 'Class I - Dangerous',
        class2: 'Class II - May cause illness',
        class3: 'Class III - Unlikely to cause harm',
        copy: 'Copy',
        copied: 'Copied!',
        dataSource: 'Data Source',
        lastChecked: 'Last Checked',
        refreshing: 'Refreshing from FDA...'
      },
      he: {
        title: 'התראות החזרת תרופות FDA',
        noAlerts: 'אין התראות פעילות למטופלים שלך',
        loading: 'בודק התראות...',
        error: 'טעינת התראות נכשלה',
        retry: 'נסה שוב',
        patient: 'מטופל',
        medication: 'תרופה',
        recallClass: 'דרגה',
        severity: 'חומרה',
        viewDetails: 'הצג פרטים',
        hideDetails: 'הסתר פרטים',
        affectedMedications: 'תרופות מושפעות',
        recallReason: 'סיבה',
        recallDate: 'תאריך החזרה',
        highSeverity: 'גבוהה',
        mediumSeverity: 'בינונית',
        lowSeverity: 'נמוכה',
        class1: 'דרגה I - מסוכן',
        class2: 'דרגה II - עלול לגרום למחלה',
        class3: 'דרגה III - לא סביר שיגרום נזק',
        copy: 'העתק',
        copied: 'הועתק!',
        dataSource: 'מקור נתונים',
        lastChecked: 'נבדק לאחרונה',
        refreshing: 'מרענן מ-FDA...'
      }
    };
    return labels[language] || labels.en;
  }, [language]);

  // Fetch provider-specific recall alerts (triggers fresh FDA API call)
  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await secureApi.get('/api/external/recalls/provider-alerts');

      if (response && response.success) {
        // Sort by severity (high first) and limit
        const sortedAlerts = (response.data || [])
          .sort((a, b) => {
            const severityOrder = { high: 0, medium: 1, low: 2 };
            return (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
          })
          .slice(0, maxItems);

        setAlerts(sortedAlerts);

        // Capture data source and last checked from response
        setDataSource(response.dataSource || 'unknown');
        setLastChecked(response.lastChecked || new Date().toISOString());
      } else {
        setAlerts([]);
      }
    } catch (err) {
      console.error('Failed to fetch FDA recall alerts:', err);
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

  // Get severity badge color
  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'high':
        return { bg: '#dc3545', text: '#ffffff' };
      case 'medium':
        return { bg: '#fd7e14', text: '#ffffff' };
      case 'low':
        return { bg: '#ffc107', text: '#000000' };
      default:
        return { bg: '#6c757d', text: '#ffffff' };
    }
  };

  // Get recall class description
  const getRecallClassText = (recallClass) => {
    switch (recallClass) {
      case 'Class I':
        return t.class1;
      case 'Class II':
        return t.class2;
      case 'Class III':
        return t.class3;
      default:
        return recallClass || 'Unknown';
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
      `FDA Drug Recall Alert`,
      ``,
      `Patient: ${alert.patientName || 'Unknown'}`,
      `Medication: ${alert.medicationName || alert.matchedDrugName || alert.affectedMedications?.[0]?.name || 'Unknown'}${alert.affectedMedications?.[0]?.dosage ? ` (${alert.affectedMedications[0].dosage})` : ''}`,
      `Severity: ${getSeverityText(alert.severity)}`,
      `Classification: ${getRecallClassText(alert.classification || alert.recallClass)}`,
      alert.recallReason || alert.reasonForRecall || alert.reason ? `Reason: ${alert.recallReason || alert.reasonForRecall || alert.reason}` : null,
      alert.alertDate ? `Recall Date: ${formatDate(alert.alertDate)}` : null,
      alert.productDescription ? `Product: ${alert.productDescription}` : null
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
      color: '#dc3545'
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
      borderColor: '#dc3545',
      borderLeftWidth: '4px'
    },
    alertItemMedium: {
      borderColor: '#fd7e14',
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
    patientNameLink: {
      textDecoration: 'underline',
      color: '#4dabf7'
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
    recallClass: {
      fontSize: '12px',
      color: '#a0a0b0'
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
      minWidth: '100px',
      fontWeight: '500'
    },
    detailValue: {
      color: '#d0d0e0',
      flex: 1
    },
    toggleButton: {
      marginTop: '8px',
      fontSize: '12px',
      color: '#4dabf7',
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
    dataSourceFooter: {
      textAlign: 'center',
      padding: '8px 16px',
      fontSize: '11px',
      color: '#6b7280',
      borderTop: '1px solid #363a46'
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
          <span>{t.refreshing}</span>
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

  // Format the lastChecked time
  const formatLastChecked = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString(language === 'he' ? 'he-IL' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  // Format data source for display
  const formatDataSource = (source) => {
    if (!source) return '';
    switch (source) {
      case 'FDA_IRES': return 'FDA iRES (Real-time)';
      case 'openFDA_fallback': return 'openFDA (Fallback)';
      case 'cache': return 'Cached Data';
      default: return source;
    }
  };

  if (alerts.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.noAlerts}>
          <span style={styles.warningIcon}>✓</span>
          {t.noAlerts}
        </div>
        {dataSource && (
          <div style={styles.dataSourceFooter}>
            <span>{formatDataSource(dataSource)}</span>
            {lastChecked && <span> • {formatLastChecked(lastChecked)}</span>}
          </div>
        )}
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
              {alert.medicationName || alert.matchedDrugName || alert.affectedMedications?.[0]?.name || 'Unknown Medication'}
              {(alert.medicationDosage || alert.affectedMedications?.[0]?.dosage) && ` (${alert.medicationDosage || alert.affectedMedications[0].dosage})`}
            </div>

            <div style={styles.recallClass}>
              {getRecallClassText(alert.classification || alert.recallClass)}
            </div>

            {isExpanded && (
              <div style={styles.expandedDetails}>
                {(alert.recallReason || alert.reasonForRecall || alert.reason) && (
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>{t.recallReason}:</span>
                    <span style={styles.detailValue}>{alert.recallReason || alert.reasonForRecall || alert.reason}</span>
                  </div>
                )}
                {alert.alertDate && (
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>{t.recallDate}:</span>
                    <span style={styles.detailValue}>
                      {formatDate(alert.alertDate)}
                    </span>
                  </div>
                )}
                {alert.productDescription && (
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>{t.medication}:</span>
                    <span style={styles.detailValue}>{alert.productDescription}</span>
                  </div>
                )}
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
      {dataSource && (
        <div style={styles.dataSourceFooter}>
          <span>{formatDataSource(dataSource)}</span>
          {lastChecked && <span> • {formatLastChecked(lastChecked)}</span>}
        </div>
      )}
    </div>
  );
};

export default FDARecallAlerts;
