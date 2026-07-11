import React, { useState } from 'react';

const LabResultsTable = ({ data, config, language = 'he', onAction }) => {
  const [expandedTests, setExpandedTests] = useState(new Set());
  const [showOnlyAbnormal, setShowOnlyAbnormal] = useState(false);
  
  // Handle various data formats from the agent
  let results = [];
  if (Array.isArray(data)) {
    results = data;
  } else if (Array.isArray(data?.results)) {
    results = data.results;
  } else if (Array.isArray(data?.labs)) {
    results = data.labs;
  } else if (Array.isArray(data?.data)) {
    results = data.data;
  } else if (Array.isArray(data?.labResults)) {
    results = data.labResults;
  }
  
  const isRTL = language === 'he';
  
  const labels = {
    he: {
      title: 'תוצאות מעבדה',
      test: 'בדיקה',
      value: 'ערך',
      range: 'טווח תקין',
      status: 'סטטוס',
      date: 'תאריך',
      trend: 'מגמה',
      unit: 'יחידה',
      normal: 'תקין',
      high: 'גבוה',
      low: 'נמוך',
      critical: 'קריטי',
      showAbnormal: 'הצג רק חריגים',
      showAll: 'הצג הכל',
      previousValue: 'ערך קודם',
      change: 'שינוי',
      interpretation: 'פרשנות',
      print: 'הדפסה',
      export: 'ייצוא',
      compare: 'השוואה',
      noResults: 'אין תוצאות מעבדה'
    },
    en: {
      title: 'Lab Results',
      test: 'Test',
      value: 'Value',
      range: 'Normal Range',
      status: 'Status',
      date: 'Date',
      trend: 'Trend',
      unit: 'Unit',
      normal: 'Normal',
      high: 'High',
      low: 'Low',
      critical: 'Critical',
      showAbnormal: 'Show Abnormal Only',
      showAll: 'Show All',
      previousValue: 'Previous Value',
      change: 'Change',
      interpretation: 'Interpretation',
      print: 'Print',
      export: 'Export',
      compare: 'Compare',
      noResults: 'No lab results'
    }
  };
  
  const t = labels[language] || labels.en;
  
  // Determine status and styling
  const getStatus = (value, min, max, critical) => {
    if (critical) return { text: t.critical, color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)' };
    if (value < min) return { text: t.low, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' };
    if (value > max) return { text: t.high, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
    return { text: t.normal, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
  };
  
  // Calculate trend
  const getTrend = (current, previous) => {
    if (!previous) return null;
    const diff = ((current - previous) / previous) * 100;
    if (Math.abs(diff) < 5) return { icon: '→', color: '#6b7280' };
    if (diff > 0) return { icon: '↑', color: '#ef4444', value: `+${diff.toFixed(1)}%` };
    return { icon: '↓', color: '#3b82f6', value: `${diff.toFixed(1)}%` };
  };
  
  // Format date
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US');
  };
  
  // Filter results
  const filteredResults = showOnlyAbnormal 
    ? results.filter(r => r.value < r.normalRange?.min || r.value > r.normalRange?.max || r.critical)
    : results;
  
  // Group by category if available
  const groupedResults = filteredResults.reduce((acc, result) => {
    const category = result.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(result);
    return acc;
  }, {});
  
  if (results.length === 0) {
    return (
      <div style={{ ...styles.container, direction: isRTL ? 'rtl' : 'ltr' }}>
        <div style={styles.noResults}>
          <span style={styles.noResultsIcon}>🧪</span>
          <p>{t.noResults}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div style={{ ...styles.container, direction: isRTL ? 'rtl' : 'ltr' }}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>{t.title}</h3>
        <div style={styles.controls}>
          <button
            style={{
              ...styles.filterBtn,
              ...(showOnlyAbnormal && styles.filterBtnActive)
            }}
            onClick={() => setShowOnlyAbnormal(!showOnlyAbnormal)}
          >
            {showOnlyAbnormal ? t.showAll : t.showAbnormal}
          </button>
          <button style={styles.actionBtn} onClick={() => onAction('print', data)}>
            🖨️ {t.print}
          </button>
          <button style={styles.actionBtn} onClick={() => onAction('export', data)}>
            📊 {t.export}
          </button>
        </div>
      </div>
      
      {/* Results by Category */}
      {Object.entries(groupedResults).map(([category, categoryResults]) => (
        <div key={category} style={styles.categorySection}>
          <h4 style={styles.categoryTitle}>{category}</h4>
          
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.headerRow}>
                  <th style={styles.th}>{t.test}</th>
                  <th style={styles.th}>{t.value}</th>
                  <th style={styles.th}>{t.range}</th>
                  <th style={styles.th}>{t.status}</th>
                  <th style={styles.th}>{t.trend}</th>
                  <th style={styles.th}>{t.date}</th>
                </tr>
              </thead>
              <tbody>
                {categoryResults.map((result, index) => {
                  const status = getStatus(
                    result.value,
                    result.normalRange?.min,
                    result.normalRange?.max,
                    result.critical
                  );
                  const trend = getTrend(result.value, result.previousValue);
                  const isExpanded = expandedTests.has(`${category}-${index}`);
                  
                  return (
                    <React.Fragment key={index}>
                      <tr 
                        style={{
                          ...styles.row,
                          ...(result.critical && styles.criticalRow)
                        }}
                        onClick={() => {
                          const key = `${category}-${index}`;
                          const newExpanded = new Set(expandedTests);
                          if (newExpanded.has(key)) {
                            newExpanded.delete(key);
                          } else {
                            newExpanded.add(key);
                          }
                          setExpandedTests(newExpanded);
                        }}
                      >
                        <td style={styles.td}>
                          <div style={styles.testName}>
                            <span>{result.name || result.testName}</span>
                            {result.description && (
                              <span style={styles.testDescription}>{result.description}</span>
                            )}
                          </div>
                        </td>
                        <td style={{ ...styles.td, fontWeight: 'bold' }}>
                          {result.value} {result.unit}
                        </td>
                        <td style={styles.td}>
                          {result.normalRange ? 
                            `${result.normalRange.min}-${result.normalRange.max} ${result.unit}` : 
                            '-'
                          }
                        </td>
                        <td style={styles.td}>
                          <span style={{
                            ...styles.statusBadge,
                            backgroundColor: status.bg,
                            color: status.color
                          }}>
                            {status.text}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {trend && (
                            <div style={styles.trend}>
                              <span style={{ color: trend.color, fontSize: '16px' }}>
                                {trend.icon}
                              </span>
                              {trend.value && (
                                <span style={{ fontSize: '11px', color: trend.color }}>
                                  {trend.value}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={styles.td}>{formatDate(result.date)}</td>
                      </tr>
                      
                      {/* Expanded Details */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="6" style={styles.expandedCell}>
                            <div style={styles.expandedContent}>
                              {result.previousValue && (
                                <div style={styles.detailItem}>
                                  <span style={styles.detailLabel}>{t.previousValue}:</span>
                                  <span>{result.previousValue} {result.unit}</span>
                                </div>
                              )}
                              {result.interpretation && (
                                <div style={styles.detailItem}>
                                  <span style={styles.detailLabel}>{t.interpretation}:</span>
                                  <span>{result.interpretation}</span>
                                </div>
                              )}
                              {result.notes && (
                                <div style={styles.detailItem}>
                                  <span style={styles.detailLabel}>Notes:</span>
                                  <span>{result.notes}</span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      
      {/* Summary if available */}
      {data.summary && (
        <div style={styles.summary}>
          <h4 style={styles.summaryTitle}>{t.interpretation}</h4>
          <p style={styles.summaryText}>{data.summary}</p>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '16px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '8px',
    color: '#e3e3e8'
  },
  
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '12px'
  },
  
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: '#e3e3e8'
  },
  
  controls: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  
  filterBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    color: '#e3e3e8',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  
  filterBtnActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    color: '#f59e0b'
  },
  
  actionBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    color: '#e3e3e8',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  
  categorySection: {
    marginBottom: '24px'
  },
  
  categoryTitle: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#10b981'
  },
  
  tableContainer: {
    overflowX: 'auto',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  },
  
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  
  headerRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)'
  },
  
  th: {
    padding: '10px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: '600',
    color: '#10b981',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
  },
  
  row: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  
  criticalRow: {
    backgroundColor: 'rgba(220, 38, 38, 0.05)'
  },
  
  td: {
    padding: '10px',
    fontSize: '13px',
    color: '#e3e3e8'
  },
  
  testName: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  
  testDescription: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.5)'
  },
  
  statusBadge: {
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '500',
    display: 'inline-block'
  },
  
  trend: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  
  expandedCell: {
    padding: '0',
    backgroundColor: 'rgba(255, 255, 255, 0.02)'
  },
  
  expandedContent: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  
  detailItem: {
    display: 'flex',
    gap: '8px',
    fontSize: '12px'
  },
  
  detailLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    minWidth: '100px'
  },
  
  summary: {
    marginTop: '20px',
    padding: '16px',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderRadius: '6px',
    border: '1px solid rgba(16, 185, 129, 0.2)'
  },
  
  summaryTitle: {
    margin: '0 0 8px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#10b981'
  },
  
  summaryText: {
    margin: 0,
    fontSize: '13px',
    lineHeight: '1.6',
    color: '#e3e3e8'
  },
  
  noResults: {
    textAlign: 'center',
    padding: '40px',
    color: 'rgba(255, 255, 255, 0.5)'
  },
  
  noResultsIcon: {
    fontSize: '48px',
    opacity: 0.3,
    display: 'block',
    marginBottom: '16px'
  }
};

export default LabResultsTable;