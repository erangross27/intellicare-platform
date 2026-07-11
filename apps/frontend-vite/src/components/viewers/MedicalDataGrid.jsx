import React, { useState } from 'react';

const MedicalDataGrid = ({ data, language }) => {
  console.log('📊 MedicalDataGrid received data:', data); // DEBUG LOG
  const isRTL = language === 'he';
  const [expandedCategories, setExpandedCategories] = useState({});

  // Category display names
  const categoryNames = {
    diagnoses: isRTL ? 'אבחנות' : 'Diagnoses',
    medications: isRTL ? 'תרופות' : 'Medications',
    lab_results: isRTL ? 'תוצאות מעבדה' : 'Lab Results',
    vital_signs: isRTL ? 'סימנים חיוניים' : 'Vital Signs',
    allergies: isRTL ? 'אלרגיות' : 'Allergies',
    risk_factors: isRTL ? 'גורמי סיכון' : 'Risk Factors',
    recommendations: isRTL ? 'המלצות' : 'Recommendations',
    medical_history: isRTL ? 'היסטוריה רפואית' : 'Medical History',
    chief_complaints: isRTL ? 'תלונות עיקריות' : 'Chief Complaints',
    follow_up_appointments: isRTL ? 'תורים למעקב' : 'Follow-up Appointments',
    assessment_plans: isRTL ? 'תוכניות הערכה' : 'Assessment Plans',
    physical_examinations: isRTL ? 'בדיקות פיזיות' : 'Physical Examinations',
    history_present_illness: isRTL ? 'היסטוריית מחלה נוכחית' : 'Present Illness History',
    procedures: isRTL ? 'פרוצדורות' : 'Procedures',
    immunizations: isRTL ? 'חיסונים' : 'Immunizations',
    family_history: isRTL ? 'היסטוריה משפחתית' : 'Family History',
    social_history: isRTL ? 'היסטוריה חברתית' : 'Social History',
    surgical_history: isRTL ? 'היסטוריה כירורגית' : 'Surgical History',
    hospitalizations: isRTL ? 'אשפוזים' : 'Hospitalizations',
    radiology_results: isRTL ? 'תוצאות רדיולוגיה' : 'Radiology Results',
    consultation_notes: isRTL ? 'הערות ייעוץ' : 'Consultation Notes'
  };

  // Styles
  const styles = {
    container: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '16px',
      padding: '16px 0',
      direction: isRTL ? 'rtl' : 'ltr',
      width: '100%',
      maxWidth: '100%'
    },
    categoryCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      padding: '12px',
      minHeight: '120px'
    },
    categoryHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12px',
      paddingBottom: '8px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
    },
    categoryTitle: {
      fontSize: '14px',
      fontWeight: '600',
      color: '#ffffff',
      margin: 0
    },
    recordCount: {
      fontSize: '12px',
      color: '#8e8ea0',
      backgroundColor: 'rgba(96, 165, 250, 0.1)',
      padding: '2px 8px',
      borderRadius: '12px'
    },
    dataList: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px'
    },
    dataItem: {
      fontSize: '13px',
      color: '#e8eaf0',
      lineHeight: '1.5',
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      padding: '4px 0',
      borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
    },
    dataItemMain: {
      fontWeight: '500',
      color: '#ffffff'
    },
    dataItemSub: {
      fontSize: '12px',
      color: '#8e8ea0',
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap'
    },
    emptyState: {
      fontSize: '12px',
      color: '#8e8ea0',
      fontStyle: 'italic'
    },
    noDataMessage: {
      gridColumn: '1 / -1',
      textAlign: 'center',
      padding: '40px 20px',
      fontSize: '15px',
      color: '#8e8ea0'
    }
  };

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString(isRTL ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Toggle expand/collapse for a category
  const toggleExpanded = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Extract key information from each record type
  const formatRecordData = (category, records) => {
    if (!Array.isArray(records) || records.length === 0) return null;

    // Show all records if expanded, otherwise first 3
    const isExpanded = expandedCategories[category];
    const displayRecords = isExpanded ? records : records.slice(0, 3);

    switch (category) {
      case 'diagnoses':
        return displayRecords.map((r, idx) => {
          // Try to find any text field for the main display
          const mainText = r.diagnosis || r.condition || r.name || r.description ||
                          r.text || r.title || Object.values(r).find(v => typeof v === 'string' && v !== 'N/A') ||
                          'No data';
          return (
            <div key={idx} style={styles.dataItem}>
              <span style={styles.dataItemMain}>
                {mainText}
              </span>
              <span style={styles.dataItemSub}>
                {r.icdCode && <span>ICD: {r.icdCode}</span>}
                {r.date && r.date !== 'N/A' && <span>{r.date}</span>}
                {r.status && <span>{r.status}</span>}
                {r.provider && <span>{r.provider}</span>}
              </span>
            </div>
          );
        });

      case 'medications':
        return displayRecords.map((r, idx) => (
          <div key={idx} style={styles.dataItem}>
            <span style={styles.dataItemMain}>
              {r.name || r.medication || r.medicationName || 'Unknown'}
            </span>
            <span style={styles.dataItemSub}>
              {r.dosage && <span>{r.dosage}</span>}
              {r.frequency && <span>{r.frequency}</span>}
              {r.route && <span>{r.route}</span>}
              {r.active !== undefined && <span>{r.active ? 'Active' : 'Inactive'}</span>}
              {(r.startDate || r.date) && <span>{r.startDate || r.date}</span>}
            </span>
          </div>
        ));

      case 'lab_results':
        return displayRecords.map((r, idx) => (
          <div key={idx} style={styles.dataItem}>
            <span style={styles.dataItemMain}>
              {r.testName || r.test || r.name || 'Lab Test'}
            </span>
            <span style={styles.dataItemSub}>
              {r.value && <span>{r.value} {r.unit || ''}</span>}
              {r.result && r.result !== 'Pending' && <span>{r.result} {r.unit || ''}</span>}
              {r.referenceRange && <span>Ref: {r.referenceRange}</span>}
              {r.range && <span>Ref: {r.range}</span>}
              {r.date && r.date !== 'N/A' && <span>{r.date}</span>}
              {r.status && <span>{r.status}</span>}
            </span>
          </div>
        ));

      case 'vital_signs':
        return displayRecords.map((r, idx) => {
          console.log('🔍 VITAL SIGNS RECORD:', r); // DEBUG LOG
          // Collect all vital sign data
          const vitals = [];

          // Blood Pressure
          const bp = r.bloodPressure ?? r.bp ?? r.blood_pressure;
          if (bp && bp !== '' && bp !== 'N/A') {
            vitals.push(`BP: ${bp}`);
          }

          // Heart Rate / Pulse
          const hr = r.heartRate ?? r.hr ?? r.heart_rate ?? r.pulse;
          if (hr && hr !== '' && hr !== 'N/A') {
            vitals.push(`HR: ${hr}`);
          }

          // Temperature
          const temp = r.temperature ?? r.temp;
          if (temp && temp !== '' && temp !== 'N/A') {
            // Handle both string and non-string values
            let tempValue = typeof temp === 'string' && temp.trim ? temp.trim() : temp;
            // Clean up any double degree symbols and fix encoding issues
            if (typeof tempValue === 'string') {
              // Remove any duplicate degree symbols
              tempValue = tempValue.replace(/°+/g, '°');
              // Fix any encoding issues that might cause double symbols
              tempValue = tempValue.replace(/°F°/g, '°F');
              tempValue = tempValue.replace(/°C°/g, '°C');
            }
            if (tempValue) vitals.push(`Temp: ${tempValue}`);
          }

          // Oxygen Saturation
          const o2 = r.oxygenSaturation ?? r.o2 ?? r.oxygen_saturation ?? r.spo2;
          if (o2 && o2 !== '' && o2 !== 'N/A') {
            let o2Text = typeof o2 === 'string' && o2.trim ? o2.trim() : o2;
            // Clean up any double percentage symbols
            if (typeof o2Text === 'string') {
              o2Text = o2Text.replace(/%+/g, '%');
            }
            if (o2Text) vitals.push(`O2: ${o2Text}`);
          }

          // Respiratory Rate
          const rr = r.respiratoryRate ?? r.rr ?? r.respiratory_rate;
          if (rr && rr !== '' && rr !== 'N/A') {
            vitals.push(`RR: ${rr}`);
          }

          // Weight
          if (r.weight && r.weight !== 'N/A') {
            vitals.push(`Weight: ${r.weight}`);
          }

          // Height
          if (r.height && r.height !== 'N/A') {
            vitals.push(`Height: ${r.height}`);
          }

          // BMI
          if (r.bmi && r.bmi !== 'N/A') {
            vitals.push(`BMI: ${r.bmi}`);
          }

          // If no specific vitals found, look for general description
          if (vitals.length === 0) {
            if (r.description) vitals.push(r.description);
            else if (r.text) vitals.push(r.text);
            else if (r.notes) vitals.push(r.notes);
            else vitals.push('Vital signs recorded');
          }

          return (
            <div key={idx} style={styles.dataItem}>
              <span style={styles.dataItemMain}>
                {vitals.join(' | ')}
              </span>
              <span style={styles.dataItemSub}>
                {r.date && r.date !== 'N/A' && <span>{formatDate(r.date)}</span>}
                {r.provider && <span>{r.provider}</span>}
              </span>
            </div>
          );
        });

      case 'allergies':
        return displayRecords.map((r, idx) => {
          const mainText = r.allergen || r.name || r.allergy || r.substance ||
                          r.description || Object.values(r).find(v => typeof v === 'string' && v !== 'N/A') ||
                          'No data';
          return (
            <div key={idx} style={styles.dataItem}>
              <span style={styles.dataItemMain}>
                {mainText}
              </span>
              <span style={styles.dataItemSub}>
                {r.reaction && <span>{r.reaction}</span>}
                {r.severity && <span>{r.severity}</span>}
                {r.type && <span>{r.type}</span>}
              </span>
            </div>
          );
        });

      case 'risk_factors':
        return displayRecords.map((r, idx) => {
          // Handle both single factors and arrays of factors
          let factorText = '';
          if (r.factors && Array.isArray(r.factors)) {
            factorText = r.factors.map(f =>
              typeof f === 'object' ? (f.factor || f.name || 'Risk Factor') : f
            ).join(', ');
          } else if (r.factor) {
            factorText = r.factor;
          } else {
            factorText = r.name || r.description || r.assessment || 'Risk Factor';
          }

          return (
            <div key={idx} style={styles.dataItem}>
              <span style={styles.dataItemMain}>
                {factorText}
              </span>
              <span style={styles.dataItemSub}>
                {r.severity && <span>{r.severity}</span>}
                {r.assessment && <span>{r.assessment}</span>}
                {r.date && <span>{formatDate(r.date)}</span>}
              </span>
            </div>
          );
        });

      case 'recommendations':
        return displayRecords.map((r, idx) => {
          // Handle both single recommendations and arrays
          let recommendationText = '';
          if (r.items && Array.isArray(r.items)) {
            recommendationText = r.items.join(', ');
          } else if (r.recommendations && Array.isArray(r.recommendations)) {
            recommendationText = r.recommendations.join(', ');
          } else if (r.recommendation) {
            recommendationText = r.recommendation;
          } else {
            recommendationText = r.description || r.text || r.notes || 'Recommendation';
          }

          return (
            <div key={idx} style={styles.dataItem}>
              <span style={styles.dataItemMain}>
                {recommendationText}
              </span>
              <span style={styles.dataItemSub}>
                {r.priority && <span>Priority: {r.priority}</span>}
                {r.date && <span>{formatDate(r.date)}</span>}
              </span>
            </div>
          );
        });

      case 'follow_up_appointments':
        return displayRecords.map((r, idx) => (
          <div key={idx} style={styles.dataItem}>
            <span style={styles.dataItemMain}>
              {r.reason || r.type || 'Follow-up'}
            </span>
            <span style={styles.dataItemSub}>
              {r.date && <span>{formatDate(r.date)}</span>}
              {r.provider && <span>{r.provider}</span>}
              {r.department && <span>{r.department}</span>}
            </span>
          </div>
        ));

      case 'chief_complaints':
        return displayRecords.map((r, idx) => (
          <div key={idx} style={styles.dataItem}>
            <span style={styles.dataItemMain}>
              {r.complaint || r.description || r.text || 'Complaint'}
            </span>
            <span style={styles.dataItemSub}>
              {r.duration && <span>{r.duration}</span>}
              {r.date && <span>{formatDate(r.date)}</span>}
            </span>
          </div>
        ));

      case 'medical_history':
        return displayRecords.map((r, idx) => {
          console.log('🔍 MEDICAL HISTORY RECORD:', r); // DEBUG LOG
          let historyText = '';

          // First check if the data is a JSON string that needs parsing
          let parsedData = r;
          if (typeof r.conditions === 'string' && r.conditions.startsWith('{')) {
            try {
              parsedData = { ...r, ...JSON.parse(r.conditions) };
            } catch (e) {
              // If parsing fails, use original
            }
          } else if (typeof r.history === 'string' && r.history.startsWith('{')) {
            try {
              parsedData = { ...r, ...JSON.parse(r.history) };
            } catch (e) {
              // If parsing fails, use original
            }
          } else if (typeof r.text === 'string' && r.text.startsWith('{')) {
            try {
              parsedData = { ...r, ...JSON.parse(r.text) };
            } catch (e) {
              // If parsing fails, use original
            }
          } else if (typeof r.description === 'string' && r.description.startsWith('{')) {
            try {
              parsedData = { ...r, ...JSON.parse(r.description) };
            } catch (e) {
              // If parsing fails, use original
            }
          }

          // Check if it's a structured medical history object
          // Backend sends both 'condition' (string) and 'conditions' (array)
          if (parsedData.condition || parsedData.conditions || parsedData.surgicalHistory || parsedData.familyHistory || parsedData.socialHistory) {
            const historyParts = [];

            // Conditions - check both 'condition' (string) and 'conditions' (array)
            if (parsedData.condition && typeof parsedData.condition === 'string') {
              historyParts.push(parsedData.condition);
            } else if (parsedData.conditions && Array.isArray(parsedData.conditions) && parsedData.conditions.length > 0) {
              historyParts.push(`Conditions: ${parsedData.conditions.join(', ')}`);
            }

            // Surgical History
            if (parsedData.surgicalHistory && Array.isArray(parsedData.surgicalHistory) && parsedData.surgicalHistory.length > 0) {
              historyParts.push(`Surgical: ${parsedData.surgicalHistory.join(', ')}`);
            }

            // Family History
            if (parsedData.familyHistory && Array.isArray(parsedData.familyHistory) && parsedData.familyHistory.length > 0) {
              historyParts.push(`Family: ${parsedData.familyHistory.join(', ')}`);
            }

            // Social History
            if (parsedData.socialHistory && typeof parsedData.socialHistory === 'object') {
              const socialParts = [];
              if (parsedData.socialHistory.tobacco) socialParts.push(parsedData.socialHistory.tobacco);
              if (parsedData.socialHistory.alcohol) socialParts.push(`Alcohol: ${parsedData.socialHistory.alcohol}`);
              if (parsedData.socialHistory.diet) socialParts.push(parsedData.socialHistory.diet);
              if (parsedData.socialHistory.exercise) socialParts.push(parsedData.socialHistory.exercise);
              if (socialParts.length > 0) {
                historyParts.push(`Social: ${socialParts.filter(p => p && p.trim()).join(', ')}`);
              }
            }

            historyText = historyParts.join(' | ');
          }

          // Also check for the 'history' field from backend
          if (!historyText && parsedData.history) {
            historyText = parsedData.history;
          }

          // Fallback to other fields if not structured
          if (!historyText) {
            // Check if any field contains JSON string
            const fields = [r.condition, r.history, r.description, r.text, r.notes, r.details];
            for (let field of fields) {
              if (field && typeof field === 'string') {
                if (field.startsWith('{') || field.startsWith('[')) {
                  // Don't show raw JSON
                  continue;
                }
                historyText = field;
                break;
              }
            }
            if (!historyText) {
              historyText = 'Medical History Entry';
            }
          }

          return (
            <div key={idx} style={styles.dataItem}>
              <span style={styles.dataItemMain}>{historyText}</span>
              <span style={styles.dataItemSub}>
                {r.treatment && <span>Treatment: {r.treatment}</span>}
                {r.status && <span>Status: {r.status}</span>}
                {r.date && <span>{formatDate(r.date)}</span>}
                {r.provider && <span>{r.provider}</span>}
              </span>
            </div>
          );
        });

      case 'assessment_plans':
        return displayRecords.map((r, idx) => {
          let assessmentText = '';
          if (r.assessment && r.plan) {
            assessmentText = `Assessment: ${r.assessment} | Plan: ${r.plan}`;
          } else if (r.assessment) {
            assessmentText = r.assessment;
          } else if (r.plan) {
            assessmentText = r.plan;
          } else {
            assessmentText = r.description || r.text || r.notes || 'Assessment/Plan';
          }

          // Truncate if too long but show more than before
          const displayText = assessmentText.length > 200 ?
            assessmentText.substring(0, 200) + '...' : assessmentText;

          return (
            <div key={idx} style={styles.dataItem}>
              <span style={styles.dataItemMain}>{displayText}</span>
              <span style={styles.dataItemSub}>
                {r.diagnosis && <span>{r.diagnosis}</span>}
                {r.date && <span>{formatDate(r.date)}</span>}
                {r.provider && <span>{r.provider}</span>}
              </span>
            </div>
          );
        });

      case 'physical_examinations':
        return displayRecords.map((r, idx) => {
          let examText = '';

          // Try to parse if it's a JSON string
          let parsedData = r;
          if (typeof r.findings === 'string' && r.findings.startsWith('{')) {
            try {
              parsedData = { ...r, ...JSON.parse(r.findings) };
            } catch (e) {
              // If parsing fails, use original
            }
          }

          // Collect all examination findings
          const examParts = [];

          // Check for specific findings
          if (parsedData.findings && typeof parsedData.findings === 'string' && !parsedData.findings.startsWith('{')) {
            examParts.push(parsedData.findings);
          }

          // System-specific findings
          if (parsedData.general) examParts.push(`General: ${parsedData.general}`);
          if (parsedData.heent) examParts.push(`HEENT: ${parsedData.heent}`);
          if (parsedData.respiratory || parsedData.lungs) examParts.push(`Respiratory: ${parsedData.respiratory || parsedData.lungs}`);
          if (parsedData.cardiovascular || parsedData.cardiac) examParts.push(`Cardiovascular: ${parsedData.cardiovascular || parsedData.cardiac}`);
          if (parsedData.abdomen || parsedData.abdominal) examParts.push(`Abdomen: ${parsedData.abdomen || parsedData.abdominal}`);
          if (parsedData.extremities) examParts.push(`Extremities: ${parsedData.extremities}`);
          if (parsedData.neurological || parsedData.neuro) examParts.push(`Neurological: ${parsedData.neurological || parsedData.neuro}`);
          if (parsedData.skin) examParts.push(`Skin: ${parsedData.skin}`);
          if (parsedData.musculoskeletal) examParts.push(`Musculoskeletal: ${parsedData.musculoskeletal}`);

          if (examParts.length > 0) {
            examText = examParts.join(' | ');
          } else {
            // Fallback to other fields
            examText = parsedData.description || parsedData.text || parsedData.notes || parsedData.exam || '';

            // Don't show raw JSON or generic text
            if (examText.startsWith('{') || examText.startsWith('[') || examText === 'Physical Examination') {
              examText = 'Complete physical examination performed';
            }
          }

          const displayText = examText.length > 300 ?
            examText.substring(0, 300) + '...' : examText;

          return (
            <div key={idx} style={styles.dataItem}>
              <span style={styles.dataItemMain}>{displayText}</span>
              <span style={styles.dataItemSub}>
                {r.date && <span>{formatDate(r.date)}</span>}
                {r.provider && <span>{r.provider}</span>}
              </span>
            </div>
          );
        });

      case 'history_present_illness':
        return displayRecords.map((r, idx) => {
          const historyText = r.history || r.description || r.text ||
                             r.notes || 'Present Illness History';
          const displayText = historyText.length > 200 ?
            historyText.substring(0, 200) + '...' : historyText;

          return (
            <div key={idx} style={styles.dataItem}>
              <span style={styles.dataItemMain}>{displayText}</span>
              <span style={styles.dataItemSub}>
                {r.date && <span>{formatDate(r.date)}</span>}
                {r.provider && <span>{r.provider}</span>}
              </span>
            </div>
          );
        });

      default:
        // Generic format for other categories
        return displayRecords.map((r, idx) => {
          const mainField = r.name || r.description || r.text || r.notes ||
                           Object.values(r).find(v => typeof v === 'string') || 'Record';
          return (
            <div key={idx} style={styles.dataItem}>
              <span style={styles.dataItemMain}>{mainField}</span>
              <span style={styles.dataItemSub}>
                {r.date && <span>{formatDate(r.date)}</span>}
              </span>
            </div>
          );
        });
    }
  };

  // Check if we have any data
  if (!data || typeof data !== 'object') {
    return (
      <div style={styles.noDataMessage}>
        {isRTL ? 'אין נתונים רפואיים להצגה' : 'No medical data to display'}
      </div>
    );
  }

  // Get all categories with data
  const categoriesWithData = Object.entries(data)
    .filter(([key, value]) => Array.isArray(value) && value.length > 0)
    .sort(([a], [b]) => {
      // Priority order for categories
      const priority = ['diagnoses', 'medications', 'allergies', 'vital_signs', 'lab_results'];
      const aIndex = priority.indexOf(a);
      const bIndex = priority.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return 0;
    });

  if (categoriesWithData.length === 0) {
    return (
      <div style={styles.noDataMessage}>
        {isRTL ? 'לא נמצאו רשומות רפואיות' : 'No medical records found'}
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {categoriesWithData.map(([category, records]) => (
        <div key={category} style={styles.categoryCard}>
          <div style={styles.categoryHeader}>
            <h3 style={styles.categoryTitle}>
              {categoryNames[category] || category.replace(/_/g, ' ')}
            </h3>
            <span style={styles.recordCount}>
              {records.length}
            </span>
          </div>
          <div style={styles.dataList}>
            {formatRecordData(category, records) || (
              <span style={styles.emptyState}>
                {isRTL ? 'אין נתונים זמינים' : 'No data available'}
              </span>
            )}
            {records.length > 3 && (
              <div
                style={{
                  ...styles.dataItemSub,
                  marginTop: '4px',
                  cursor: 'pointer',
                  color: '#60a5fa',
                  textDecoration: 'underline'
                }}
                onClick={() => toggleExpanded(category)}
              >
                {expandedCategories[category]
                  ? (isRTL ? 'הצג פחות ▲' : 'Show less ▲')
                  : (isRTL
                    ? `...ו-${records.length - 3} נוספים ▼`
                    : `...and ${records.length - 3} more ▼`)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MedicalDataGrid;