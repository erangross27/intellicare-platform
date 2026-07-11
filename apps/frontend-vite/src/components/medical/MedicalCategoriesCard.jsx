import React, { useState } from 'react';
import MedicalGridRenderer from '../grids/MedicalGridRenderer';
import secureApi from '../../services/secureApiClient';
import categoryToEndpoint from '../../config/medicalEndpoints';

const MedicalCategoriesCard = ({
  language = 'en',
  categoryGrids = [],
  message = null
}) => {
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [expandedGridData, setExpandedGridData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Debug: Log what we received
  console.log('🏥 [MedicalCategoriesCard] Received categoryGrids:', categoryGrids);
  console.log('🏥 [MedicalCategoriesCard] categoryGrids length:', categoryGrids.length);
  if (categoryGrids.length > 0) {
    console.log('🏥 [MedicalCategoriesCard] First grid sample:', JSON.stringify(categoryGrids[0], null, 2));
  }

  // Extract patient info from message and categoryGrids
  const extractPatientInfo = () => {
    let patientName = null;
    let patientId = null;

    // Debug: log message structure
    console.log('🔍 [extractPatientInfo] message object:', JSON.stringify(message, null, 2));

    // Try to get from message first
    if (message) {
      patientName = message.patientName;
      patientId = message.patientId;

      // Try to extract patient name from message text
      // "Available medical data categories for Amanda White"
      if (!patientName && message.text) {
        const match = message.text.match(/for\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
        if (match) {
          patientName = match[1];
        }
      }
      if (!patientName && message.content) {
        const match = message.content.match(/for\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
        if (match) {
          patientName = match[1];
        }
      }
    }

    // If still no patientId, try to get from categoryGrids metadata
    if (!patientId && categoryGrids && categoryGrids.length > 0) {
      const firstGrid = categoryGrids[0];
      if (firstGrid.patientId) {
        patientId = firstGrid.patientId;
      }
      if (!patientName && firstGrid.patientName) {
        patientName = firstGrid.patientName;
      }
    }

    console.log('🔍 [extractPatientInfo] Extracted:', { patientName, patientId });

    return {
      patientName: patientName || 'Unknown',
      patientId: patientId
    };
  };

  // Map AI collection names to display metadata
  const categoryMetadata = {
    'administrative_data': { icon: '📄', title: language === 'he' ? 'נתונים מנהליים' : 'Administrative Data' },
    'allergies': { icon: '⚠️', title: language === 'he' ? 'אלרגיות' : 'Allergies' },
    'diagnoses': { icon: '📋', title: language === 'he' ? 'אבחנות' : 'Diagnoses' },
    'medications': { icon: '💊', title: language === 'he' ? 'תרופות' : 'Medications' },
    'lab_results': { icon: '🔬', title: language === 'he' ? 'תוצאות מעבדה' : 'Lab Results' },
    'vital_signs': { icon: '❤️', title: language === 'he' ? 'סימנים חיוניים' : 'Vital Signs' },
    'chief_complaints': { icon: '🗣️', title: language === 'he' ? 'תלונות עיקריות' : 'Chief Complaints' },
    'physical_examinations': { icon: '🏥', title: language === 'he' ? 'בדיקות גופניות' : 'Physical Examinations' },
    'social_history': { icon: '👥', title: language === 'he' ? 'היסטוריה חברתית' : 'Social History' },
    'clinical_decision_support': { icon: '🎯', title: language === 'he' ? 'תמיכה בהחלטות קליניות' : 'Clinical Decision Support' },
    'intelligent_recommendations': { icon: '💡', title: language === 'he' ? 'המלצות חכמות' : 'Intelligent Recommendations' },
    'trending_analysis': { icon: '📈', title: language === 'he' ? 'ניתוח מגמות' : 'Trending Analysis' },
    'patient_specific_care_plan': { icon: '👤', title: language === 'he' ? 'תכנית טיפול מותאמת' : 'Patient-Specific Care Plan' },
    'medication_optimization': { icon: '💊', title: language === 'he' ? 'אופטימיזציה תרופתית' : 'Medication Optimization' },
    'follow_up_intelligence': { icon: '📅', title: language === 'he' ? 'מעקב חכם' : 'Follow-up Intelligence' },
    'patient_education_context': { icon: '📚', title: language === 'he' ? 'חינוך המטופל' : 'Patient Education' },
    'quality_metrics': { icon: '📊', title: language === 'he' ? 'מדדי איכות' : 'Quality Metrics' }
  };

  // Transform categoryGrids data into categories format
  const categories = categoryGrids.map((grid) => {
    const metadata = categoryMetadata[grid.category] || {
      icon: '📋',
      title: grid.title || grid.category
    };

    return {
      id: grid.category,
      icon: grid.icon || metadata.icon,
      title: grid.title || metadata.title,
      value: `${grid.count || 0} ${language === 'he' ? 'רשומות' : 'records'}`,
      gridData: grid // Store the full grid data for expansion
    };
  });

  // If no data from backend, show empty state
  if (categories.length === 0) {
    return (
      <div style={styles.medicalCategoriesCard}>
        <div style={styles.cardHeader}>
          <div style={styles.cardIcon}>🏥</div>
          <div style={styles.cardTitle}>
            <h3 style={styles.cardTitleText}>
              {language === 'he' ? 'קטגוריות נתונים רפואיים' : 'Available Medical Categories'}
            </h3>
            <div style={styles.cardSubtitle}>
              {language === 'he' ? 'לא נמצאו קטגוריות' : 'No categories available'}
            </div>
          </div>
        </div>
        <div style={{padding: '20px', textAlign: 'center', opacity: 0.7}}>
          {language === 'he'
            ? 'אין קטגוריות נתונים רפואיים זמינות למטופל זה'
            : 'No medical data categories available for this patient'}
        </div>
      </div>
    );
  }

  // Category endpoints imported from auto-generated config file

  const handleCategoryClick = async (categoryId) => {
    console.log('🔍 [MedicalCategoriesCard] Clicked category:', categoryId);
    const category = categories.find(c => c.id === categoryId);
    console.log('🔍 [MedicalCategoriesCard] Found category:', category);

    // Toggle off if clicking same category
    if (expandedCategory === categoryId) {
      setExpandedCategory(null);
      setExpandedGridData(null);
      return;
    }

    // Set loading state
    setLoading(true);
    setExpandedCategory(categoryId);
    setExpandedGridData(null);

    try {
      // Extract patient info
      const { patientName, patientId } = extractPatientInfo();
      console.log('🔍 [MedicalCategoriesCard] Fetching data for:', { categoryId, patientName, patientId });

      // Get specific endpoint for this category
      const endpoint = categoryToEndpoint[categoryId];
      if (!endpoint) {
        throw new Error(`No endpoint configured for category: ${categoryId}`);
      }

      // Fetch data from specific secure endpoint
      const gridData = await secureApi.get(`${endpoint}/${patientId}`);
      console.log('✅ [MedicalCategoriesCard] Received grid data:', gridData);
      console.log('✅ [MedicalCategoriesCard] Grid data success:', gridData.success);
      console.log('✅ [MedicalCategoriesCard] Grid data.data:', gridData.data);
      console.log('✅ [MedicalCategoriesCard] Grid data.data length:', gridData.data?.length);
      console.log('✅ [MedicalCategoriesCard] Grid columns:', gridData.columns);
      console.log('✅ [MedicalCategoriesCard] Grid headers:', gridData.headers);
      console.log('✅ [MedicalCategoriesCard] Grid displayTitle:', gridData.displayTitle);
      console.log('✅ [MedicalCategoriesCard] Full gridData keys:', Object.keys(gridData));

      // Add patient name to grid data for display
      if (gridData.success && gridData.data) {
        gridData.patientName = patientName;
      }

      setExpandedGridData(gridData);
    } catch (error) {
      console.error('❌ [MedicalCategoriesCard] Failed to load category data:', error);
      setExpandedGridData({
        success: false,
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setExpandedCategory(null);
  };

  const expandedGrid = categories.find(c => c.id === expandedCategory);

  return (
    <div style={styles.medicalCategoriesCard}>
      {/* Header */}
      <div style={styles.cardHeader}>
        <div style={styles.cardIcon}>🏥</div>
        <div style={styles.cardTitle}>
          <h3 style={styles.cardTitleText}>
            {language === 'he' ? 'קטגוריות נתונים רפואיים' : 'Available Medical Categories'}
          </h3>
          <div style={styles.cardSubtitle}>
            {language === 'he' ? 'מערכת ניהול רפואי • נתונים בזמן אמת • לחץ לצפייה' : 'Medical Management System • Real-time data • Click to view'}
          </div>
        </div>
        <div style={styles.cardBadge}>
          {language === 'he' ? `${categories.length} קטגוריות` : `${categories.length} Categories`}
        </div>
      </div>

      {/* Categories Grid */}
      <div style={styles.categoriesGrid}>
        {categories.map((category) => (
          <div
            key={category.id}
            style={{
              ...styles.categoryItem,
              borderColor: expandedCategory === category.id ? '#8e8ea0' : '#565869',
              background: expandedCategory === category.id ? '#40414f' : '#363a46'
            }}
            onClick={() => handleCategoryClick(category.id)}
          >
            <div style={styles.categoryIcon}>{category.icon}</div>
            <div style={styles.categoryTitle}>{category.title}</div>
            <div style={styles.categoryValue}>{category.value}</div>
          </div>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner}></div>
          <div style={styles.loadingText}>
            {language === 'he' ? 'טוען נתונים...' : 'Loading data...'}
          </div>
        </div>
      )}

      {/* Expanded Grid - Inline Display */}
      {expandedCategory && expandedGridData && expandedGridData.success && (
        <div style={styles.expandedGridContainer}>
          <MedicalGridRenderer
            data={expandedGridData}
            language={language}
          />
        </div>
      )}

      {/* Error State */}
      {expandedCategory && expandedGridData && !expandedGridData.success && (
        <div style={styles.errorContainer}>
          <div style={styles.errorIcon}>⚠️</div>
          <div style={styles.errorText}>
            {expandedGridData.error || (language === 'he' ? 'שגיאה בטעינת הנתונים' : 'Error loading data')}
          </div>
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
  medicalCategoriesCard: {
    background: '#444654',
    border: '1px solid #565869',
    borderRadius: '16px',
    padding: '28px',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    marginTop: '16px',
    width: '100%'
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
  categoriesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
    width: '100%'
  },
  categoryItem: {
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
  categoryIcon: {
    fontSize: '26px',
    marginBottom: '10px'
  },
  categoryTitle: {
    fontSize: '15px',
    fontWeight: '600',
    marginBottom: '6px',
    color: '#ececf1'
  },
  categoryValue: {
    fontSize: '13px',
    opacity: 0.8,
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
  },
  expandedGridContainer: {
    marginTop: '24px',
    width: '100%'
  },
  loadingContainer: {
    marginTop: '24px',
    padding: '40px',
    textAlign: 'center',
    background: '#363a46',
    borderRadius: '12px',
    border: '1px solid #565869'
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    margin: '0 auto 16px',
    border: '4px solid #565869',
    borderTop: '4px solid #ececf1',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  loadingText: {
    fontSize: '14px',
    color: '#c5c5d2'
  },
  errorContainer: {
    marginTop: '24px',
    padding: '24px',
    textAlign: 'center',
    background: '#4a3030',
    borderRadius: '12px',
    border: '1px solid #8e4040'
  },
  errorIcon: {
    fontSize: '32px',
    marginBottom: '12px'
  },
  errorText: {
    fontSize: '14px',
    color: '#ececf1'
  }
};

export default MedicalCategoriesCard;
