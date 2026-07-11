import React from 'react';

const SingleCategoryCard = ({ category, language = 'en' }) => {
  if (!category) return null;

  const getCategoryIcon = (categoryName) => {
    const icons = {
      cardiology: '❤️',
      lab_results: '🧪',
      medications: '💊',
      procedures: '🔬',
      radiology: '📸',
      vital_signs: '📊'
    };
    return icons[categoryName] || '📋';
  };

  const getCategoryTitle = (categoryName) => {
    const titles = {
      he: {
        cardiology: 'ייעוצים קרדיולוגיים',
        lab_results: 'תוצאות מעבדה',
        medications: 'תרופות',
        procedures: 'פרוצדורות',
        radiology: 'הדמיות',
        vital_signs: 'סימנים חיוניים'
      },
      en: {
        cardiology: 'Cardiology Consultations',
        lab_results: 'Laboratory Results',
        medications: 'Medications',
        procedures: 'Procedures',
        radiology: 'Radiology',
        vital_signs: 'Vital Signs'
      }
    };
    return titles[language][categoryName] || categoryName;
  };

  return (
    <div style={styles.categoryCard}>
      {/* Header */}
      <div style={styles.cardHeader}>
        <div style={styles.cardIcon}>
          {getCategoryIcon(category.name)}
        </div>
        <div style={styles.cardTitle}>
          <h3 style={styles.cardTitleText}>
            {getCategoryTitle(category.name)}
          </h3>
          <div style={styles.cardSubtitle}>
            {category.subtitle || (language === 'he' ? 'טיפול מומחה' : 'Specialist care')}
          </div>
        </div>
        <div style={styles.cardBadge}>
          {category.itemCount || 0} {language === 'he' ? 'פריטים' : 'Items'}
        </div>
      </div>

      {/* Quick Stats */}
      {category.stats && category.stats.length > 0 && (
        <div style={styles.statsGrid}>
          {category.stats.map((stat, idx) => (
            <div key={idx} style={styles.statBox}>
              <div style={styles.statLabel}>{stat.label}</div>
              <div style={styles.statValue}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Data Table */}
      {category.data && category.data.length > 0 && (
        <div style={styles.dataTableContainer}>
          <table style={styles.dataTable}>
            <thead>
              <tr>
                {category.columns && category.columns.map((col, idx) => (
                  <th key={idx} style={styles.tableHeader}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {category.data.map((row, rowIdx) => (
                <tr key={rowIdx} style={styles.tableRow}>
                  {category.columns && category.columns.map((col, colIdx) => (
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

      {/* Footer Hint */}
      <div style={styles.footerHint}>
        💡 {language === 'he'
          ? 'שאל על קטגוריות אחרות כמו "הראה לי תוצאות מעבדה" או "הראה לי תרופות"'
          : 'Ask for other categories like "Show me lab results" or "Show me medications"'}
      </div>
    </div>
  );
};

const styles = {
  categoryCard: {
    background: '#444654',
    border: '1px solid #565869',
    borderRadius: '16px',
    padding: '28px',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    marginTop: '16px'
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
    color: '#ececf1'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '14px',
    marginBottom: '20px'
  },
  statBox: {
    background: '#363a46',
    border: '1px solid #565869',
    borderRadius: '10px',
    padding: '14px'
  },
  statLabel: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    opacity: 0.7,
    marginBottom: '6px',
    color: '#c5c5d2'
  },
  statValue: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#ececf1'
  },
  dataTableContainer: {
    background: '#363a46',
    border: '1px solid #565869',
    borderRadius: '10px',
    overflow: 'hidden'
  },
  dataTable: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  tableHeader: {
    background: '#2a2d3a',
    padding: '12px 14px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '1px solid #565869',
    color: '#ececf1'
  },
  tableRow: {
    transition: 'background 0.2s',
    ':hover': {
      background: '#40414f'
    }
  },
  tableCell: {
    padding: '12px 14px',
    fontSize: '14px',
    borderBottom: '1px solid #4a4d58',
    color: '#c5c5d2'
  },
  footerHint: {
    marginTop: '20px',
    paddingTop: '20px',
    borderTop: '1px solid #565869',
    fontSize: '13px',
    opacity: 0.7,
    textAlign: 'center',
    color: '#c5c5d2'
  }
};

export default SingleCategoryCard;
