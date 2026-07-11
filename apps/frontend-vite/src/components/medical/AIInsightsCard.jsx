import React, { useState } from 'react';

const AIInsightsCard = ({ language = 'en', categoryGrids = [] }) => {
  const [expandedInsight, setExpandedInsight] = useState(null);

  // Debug: Log what we received
  console.log('🎯 [AIInsightsCard] Received categoryGrids:', categoryGrids);
  console.log('🎯 [AIInsightsCard] categoryGrids length:', categoryGrids.length);
  if (categoryGrids.length > 0) {
    console.log('🎯 [AIInsightsCard] First grid sample:', JSON.stringify(categoryGrids[0], null, 2));
  }

  // Map AI collection names to display metadata
  const insightMetadata = {
    'clinical_decision_support': {
      icon: '🎯',
      title: language === 'he' ? 'תמיכה בהחלטות קליניות' : 'Clinical Decision Support',
    },
    'intelligent_recommendations': {
      icon: '💡',
      title: language === 'he' ? 'המלצות חכמות' : 'Intelligent Recommendations',
    },
    'trending_analysis': {
      icon: '📈',
      title: language === 'he' ? 'ניתוח מגמות' : 'Trending Analysis',
    },
    'patient_specific_care_plan': {
      icon: '👤',
      title: language === 'he' ? 'תכנית טיפול מותאמת' : 'Patient-Specific Care Plan',
    },
    'medication_optimization': {
      icon: '💊',
      title: language === 'he' ? 'אופטימיזציה תרופתית' : 'Medication Optimization',
    },
    'follow_up_intelligence': {
      icon: '📅',
      title: language === 'he' ? 'מעקב חכם' : 'Follow-up Intelligence',
    },
    'patient_education_context': {
      icon: '📚',
      title: language === 'he' ? 'חינוך המטופל' : 'Patient Education',
    },
    'quality_metrics': {
      icon: '📊',
      title: language === 'he' ? 'מדדי איכות' : 'Quality Metrics',
    }
  };

  // Transform categoryGrids data into insights format
  const insights = categoryGrids.map((grid) => {
    const metadata = insightMetadata[grid.category] || {
      icon: '📋',
      title: grid.title || grid.category
    };

    return {
      id: grid.category,
      icon: metadata.icon,
      title: grid.title || metadata.title,
      value: `${grid.data?.length || 0} ${language === 'he' ? 'רשומות' : 'records'}`,
      gridData: grid // Store the full grid data for expansion
    };
  });

  // If no data from backend, show empty state
  if (insights.length === 0) {
    return (
      <div style={styles.aiInsightsCard}>
        <div style={styles.cardHeader}>
          <div style={styles.cardIcon}>{cardIcon}</div>
          <div style={styles.cardTitle}>
            <h3 style={styles.cardTitleText}>
              {mainCardTitle}
            </h3>
            <div style={styles.cardSubtitle}>
              {language === 'he' ? 'לא נמצאו תובנות' : 'No insights available'}
            </div>
          </div>
        </div>
        <div style={{padding: '20px', textAlign: 'center', opacity: 0.7}}>
          {language === 'he'
            ? 'אין נתוני תובנות AI זמינים למטופל זה'
            : 'No AI insights data available for this patient'}
        </div>
      </div>
    );
  }

  const handleInsightClick = (insightId) => {
    console.log('🔍 [AIInsightsCard] Clicked insight:', insightId);
    const insight = insights.find(i => i.id === insightId);
    console.log('🔍 [AIInsightsCard] Found insight:', insight);
    if (insight && insight.gridData) {
      console.log('🔍 [AIInsightsCard] Grid data structure:', {
        hasGridFormat: insight.gridData.gridFormat,
        hasData: !!insight.gridData.data,
        dataLength: insight.gridData.data?.length,
        hasColumns: !!insight.gridData.columns,
        columnsLength: insight.gridData.columns?.length,
        sample: insight.gridData.data?.[0]
      });
    }
    setExpandedInsight(expandedInsight === insightId ? null : insightId);
  };

  const handleCloseDetail = () => {
    setExpandedInsight(null);
  };

  const expandedGrid = insights.find(i => i.id === expandedInsight);

  return (
    <div style={styles.aiInsightsCard}>
      {/* Header */}
      <div style={styles.cardHeader}>
        <div style={styles.cardIcon}>🎯</div>
        <div style={styles.cardTitle}>
          <h3 style={styles.cardTitleText}>
            {language === 'he' ? 'תובנות קליניות AI' : 'AI Clinical Insights'}
          </h3>
          <div style={styles.cardSubtitle}>
            {language === 'he' ? 'מופעל על ידי Claude AI • ניתוח בזמן אמת • לחץ להרחבה' : 'Powered by Claude AI • Real-time analysis • Click to expand'}
          </div>
        </div>
        <div style={styles.cardBadge}>
          {language === 'he' ? `${insights.length} תובנות` : `${insights.length} Insights`}
        </div>
      </div>

      {/* Insights Grid */}
      <div style={styles.insightsGrid}>
        {insights.map((insight) => (
          <div
            key={insight.id}
            style={styles.insightItem}
            onClick={() => handleInsightClick(insight.id)}
          >
            <div style={styles.insightIcon}>{insight.icon}</div>
            <div style={styles.insightTitle}>{insight.title}</div>
            <div style={styles.insightValue}>{insight.value}</div>
          </div>
        ))}
      </div>

      {/* Expanded Detail Card with Grid */}
      {expandedInsight && expandedGrid && (
        <div style={styles.detailCard}>
          <div style={styles.detailHeader}>
            <div style={styles.detailTitle}>
              <span style={{fontSize: '24px', marginRight: '8px'}}>{expandedGrid.icon}</span>
              <h4 style={styles.detailHeaderTitle}>
                {expandedGrid.title} - {language === 'he' ? 'נתונים מפורטים' : 'Detailed Data'}
              </h4>
            </div>
            <button onClick={handleCloseDetail} style={styles.closeButton}>
              {language === 'he' ? 'סגור ✕' : 'Close ✕'}
            </button>
          </div>
          {/* Render the actual grid data - use headers for display, columns for data access */}
          {expandedGrid.gridData?.data && expandedGrid.gridData.data.length > 0 && (
            <div style={styles.dataTableContainer}>
              <table style={styles.dataTable}>
                <thead>
                  <tr>
                    {(expandedGrid.gridData.headers || expandedGrid.gridData.columns).map((header, idx) => (
                      <th key={idx} style={styles.tableHeader}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expandedGrid.gridData.data.map((row, rowIdx) => (
                    <tr key={rowIdx} style={styles.tableRow}>
                      {expandedGrid.gridData.columns && expandedGrid.gridData.columns.map((col, colIdx) => (
                        <td key={colIdx} style={styles.tableCell}>
                          {row[col] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Footer Hint */}
      <div style={styles.footerHint}>
        💡 {language === 'he'
          ? 'לחץ על כל כרטיס כדי לראות את הנתונים המלאים'
          : 'Click any card above to see complete data'}
      </div>
    </div>
  );
};

const styles = {
  aiInsightsCard: {
    background: '#444654',
    border: '1px solid #565869',
    borderRadius: '16px',
    padding: '28px',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    marginTop: '16px',
    width: '100%'  // Full width from sidebar to sidebar
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid #565869'
  },
  cardIcon: {
    width: '56px',
    height: '56px',
    background: '#363a46',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px'
  },
  cardTitle: {
    flex: 1
  },
  cardTitleText: {
    fontSize: '22px',
    fontWeight: '700',
    marginBottom: '4px',
    color: '#ececf1',
    margin: 0
  },
  cardSubtitle: {
    fontSize: '13px',
    opacity: 0.7,
    color: '#c5c5d2'
  },
  cardBadge: {
    background: '#363a46',
    padding: '6px 14px',
    borderRadius: '16px',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: '#ececf1'
  },
  insightsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
    width: '100%'
  },
  insightItem: {
    background: '#363a46',
    border: '1px solid #565869',
    borderRadius: '12px',
    padding: '18px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    ':hover': {
      background: '#40414f',
      borderColor: '#8e8ea0',
      transform: 'translateY(-2px)'
    }
  },
  insightIcon: {
    fontSize: '26px',
    marginBottom: '10px'
  },
  insightTitle: {
    fontSize: '15px',
    fontWeight: '600',
    marginBottom: '6px',
    color: '#ececf1'
  },
  insightValue: {
    fontSize: '13px',
    opacity: 0.8,
    color: '#c5c5d2'
  },
  detailCard: {
    background: '#444654',  // Same as main card
    border: '1px solid #565869',
    borderRadius: '16px',  // Match main card
    padding: '28px',  // Match main card
    marginTop: '16px',
    animation: 'slideInUp 0.3s ease-out',
    width: '100%',  // Full width
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #565869'
  },
  detailTitle: {
    display: 'flex',
    alignItems: 'center'
  },
  detailHeaderTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ececf1',
    margin: 0
  },
  closeButton: {
    background: '#444654',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    color: '#ececf1',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    ':hover': {
      background: '#565869'
    }
  },
  footerHint: {
    marginTop: '20px',
    paddingTop: '20px',
    borderTop: '1px solid #565869',
    fontSize: '13px',
    opacity: 0.7,
    textAlign: 'center',
    color: '#c5c5d2'
  },
  dataTableContainer: {
    background: 'transparent',
    border: 'none',
    borderRadius: '0',
    overflow: 'auto',
    marginTop: '0',
    width: '100%',
    maxHeight: '70vh'  // Limit height for scrolling
  },
  dataTable: {
    width: '100%',
    minWidth: '100%',  // Use full width
    borderCollapse: 'collapse',
    tableLayout: 'auto'  // Let columns size naturally
  },
  tableHeader: {
    background: '#363a46',
    padding: '16px 18px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    borderBottom: '2px solid #565869',
    color: '#ececf1',
    position: 'sticky',
    top: 0,
    zIndex: 10,
    whiteSpace: 'nowrap'
  },
  tableRow: {
    transition: 'background 0.2s',
    borderBottom: '1px solid #4a4d58'
  },
  tableCell: {
    padding: '16px 18px',
    fontSize: '14px',
    color: '#c5c5d2',
    verticalAlign: 'top',
    lineHeight: '1.6',
    maxWidth: '300px',
    wordBreak: 'break-word'
  }
};

export default AIInsightsCard;
