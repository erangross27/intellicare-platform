import React from 'react';

const UniversalDataDisplay = ({ data, config, language = 'he', onAction }) => {
  const isRTL = language === 'he';
  
  const labels = {
    he: {
      noData: 'אין נתונים להצגה'
    },
    en: {
      noData: 'No data to display'
    }
  };
  
  const t = labels[language] || labels.en;
  
  // Enhanced data extraction - handle medical data comprehensively
  const extractData = (rawData) => {
    // If it's already an array, use it
    if (Array.isArray(rawData)) {
      return rawData;
    }
    
    // Check common data field names
    const possibleFields = [
      'data', 'results', 'items', 'records', 'rows', 
      'patients', 'labs', 'labResults', 'medications',
      'documents', 'appointments', 'diagnoses', 'prescriptions',
      'medicalHistory', 'history', 'procedures', 'tests',
      'list', 'entries', 'collection', 'values'
    ];
    
    for (const field of possibleFields) {
      if (Array.isArray(rawData?.[field])) {
        return rawData[field];
      }
    }
    
    // If it's an object with data inside, try to extract meaningful data
    if (typeof rawData === 'object' && rawData !== null) {
      // Look for any array property
      const arrayProps = Object.keys(rawData).filter(key => 
        Array.isArray(rawData[key])
      );
      
      if (arrayProps.length > 0) {
        // Prioritize medical data arrays
        const medicalArrays = arrayProps.filter(key => 
          key.toLowerCase().includes('history') || 
          key.toLowerCase().includes('procedure') ||
          key.toLowerCase().includes('medication') ||
          key.toLowerCase().includes('test') ||
          key.toLowerCase().includes('lab')
        );
        
        if (medicalArrays.length > 0) {
          // Combine patient data with medical history
          const baseData = { ...rawData };
          delete baseData[medicalArrays[0]]; // Remove the array to avoid duplication
          
          return [{
            ...baseData,
            medicalHistory: rawData[medicalArrays[0]]
          }];
        }
        
        // Use the first array found
        return rawData[arrayProps[0]];
      }
      
      // If no arrays, but has properties, show as single item
      if (Object.keys(rawData).length > 0) {
        return [rawData];
      }
    }
    
    return [];
  };
  
  const items = extractData(data);
  
  // If no data, show message
  if (!items || items.length === 0) {
    return (
      <div style={{ ...styles.container, direction: isRTL ? 'rtl' : 'ltr' }}>
        <div style={styles.noData}>
          {t.noData}
        </div>
      </div>
    );
  }
  
  // Simple flat card renderer
  const renderSimpleCard = (item) => {
    if (typeof item !== 'object' || item === null) {
      return (
        <div style={styles.simpleValue}>
          {String(item)}
        </div>
      );
    }

    // Organize fields into logical sections
    const sections = organizeFields(item);

    return (
      <div style={styles.cardContent}>
        {/* Flat sections - no expandable/collapsible functionality */}
        {sections.map((section, index) => (
          <div key={index} style={styles.section}>
            {/* Section Header - static, no interaction */}
            <div style={styles.sectionTitle}>
              <span style={styles.sectionIcon}>{section.icon}</span>
              <span>{section.title}</span>
            </div>
            
            {/* Section Fields - always visible */}
            <div style={styles.sectionContent}>
              {section.fields.map(([key, value]) => {
                const formattedValue = formatValue(value, language);
                const fieldName = formatFieldName(key);
                
                return (
                  <div key={key} style={styles.fieldRow}>
                    <span style={styles.fieldName}>
                      {fieldName}:
                    </span>
                    <span style={styles.fieldData}>
                      {formattedValue}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Organize fields into logical sections
  const organizeFields = (item) => {
    const sections = [];
    
    // Personal Information
    const personalFields = [
      ['name', 'firstName', 'lastName', 'nationalId', 'birthDate', 'age', 'gender'],
      (key, value) => ['name', 'firstName', 'lastName', 'nationalId', 'birthDate', 'age', 'gender'].includes(key)
    ];
    
    // Contact Information
    const contactFields = [
      ['phone', 'email', 'address', 'street', 'city', 'zipCode', 'country'],
      (key, value) => ['phone', 'email', 'address', 'street', 'city', 'zipCode', 'country'].includes(key) ||
                     key.toLowerCase().includes('phone') || key.toLowerCase().includes('email') ||
                     key.toLowerCase().includes('address') || key.toLowerCase().includes('street') ||
                     key.toLowerCase().includes('city') || key.toLowerCase().includes('zip')
    ];
    
    // Medical Information
    const medicalFields = [
      ['healthFund', 'medicalHistory', 'medications', 'allergies', 'bloodType', 'procedures', 'tests', 'labResults'],
      (key, value) => ['healthFund', 'medicalHistory', 'medications', 'allergies', 'bloodType', 'procedures', 'tests', 'labResults'].includes(key) || 
                     key.toLowerCase().includes('medical') || key.toLowerCase().includes('health') ||
                     key.toLowerCase().includes('fund') || key.toLowerCase().includes('procedure') ||
                     key.toLowerCase().includes('test') || key.toLowerCase().includes('lab') ||
                     key.toLowerCase().includes('medication') || key.toLowerCase().includes('drug')
    ];
    
    // System Information (less important - shown last)
    const systemFields = [
      ['status', 'createdAt', 'updatedAt', 'documents', 'documentCount'],
      (key, value) => ['status', 'createdAt', 'updatedAt', 'documents', 'documentCount'].includes(key) ||
                     key.toLowerCase().includes('batch') || key.toLowerCase().includes('analyses') ||
                     key.toLowerCase().includes('document') || key.toLowerCase().includes('created') ||
                     key.toLowerCase().includes('updated') || key.toLowerCase().includes('status')
    ];

    const fieldCategories = [
      { 
        title: language === 'he' ? 'מידע אישי' : 'Personal Information', 
        icon: '👤',
        matcher: personalFields[1],
        priority: 1
      },
      { 
        title: language === 'he' ? 'פרטי קשר' : 'Contact Information', 
        icon: '📞',
        matcher: contactFields[1],
        priority: 2
      },
      { 
        title: language === 'he' ? 'מידע רפואי' : 'Medical Information', 
        icon: '🏥',
        matcher: medicalFields[1],
        priority: 3
      },
      { 
        title: language === 'he' ? 'מידע מערכת' : 'System Information', 
        icon: '⚙️',
        matcher: systemFields[1],
        priority: 4
      }
    ];

    // Categorize fields
    fieldCategories.forEach(category => {
      const categoryFields = Object.entries(item).filter(([key, value]) => {
        return value !== null && value !== undefined && 
               !key.startsWith('_') && 
               category.matcher(key, value) &&
               !isEmptyValue(value);
      });

      if (categoryFields.length > 0) {
        sections.push({
          title: category.title,
          icon: category.icon,
          fields: categoryFields,
          priority: category.priority
        });
      }
    });

    return sections.sort((a, b) => a.priority - b.priority);
  };

  // Check if value is effectively empty
  const isEmptyValue = (value) => {
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    if (typeof value === 'string') return value.trim() === '';
    return false;
  };
  
  // Format field names to be more readable
  const formatFieldName = (fieldName) => {
    // Common field name translations
    const translations = {
      he: {
        name: 'שם',
        firstName: 'שם פרטי',
        lastName: 'שם משפחה',
        id: 'מזהה',
        nationalId: 'ת.ז.',
        patientId: 'מזהה מטופל',
        date: 'תאריך',
        time: 'שעה',
        status: 'סטטוס',
        type: 'סוג',
        value: 'ערך',
        result: 'תוצאה',
        description: 'תיאור',
        notes: 'הערות',
        phone: 'טלפון',
        email: 'אימייל',
        address: 'כתובת',
        street: 'רחוב',
        city: 'עיר',
        zipCode: 'מיקוד',
        country: 'מדינה',
        birthDate: 'תאריך לידה',
        age: 'גיל',
        gender: 'מין',
        healthFund: 'קופת חולים',
        medicalHistory: 'היסטוריה רפואית',
        documentCount: 'מספר מסמכים',
        createdAt: 'נוצר בתאריך',
        updatedAt: 'עודכן בתאריך',
        procedures: 'בדיקות ופרוצדורות',
        medications: 'תרופות נוכחיות',
        prescriptions: 'מרשמים',
        labResults: 'תוצאות בדיקות',
        tests: 'בדיקות',
        findings: 'ממצאים',
        diagnosis: 'אבחנה',
        treatment: 'טיפול',
        doctor: 'רופא מטפל',
        facility: 'מוסד רפואי',
        recommendations: 'המלצות',
        allergies: 'אלרגיות',
        bloodType: 'סוג דם'
      },
      en: {
        nationalId: 'ID',
        patientId: 'Patient ID',
        firstName: 'First Name',
        lastName: 'Last Name',
        birthDate: 'Birth Date',
        street: 'Street',
        city: 'City',
        zipCode: 'Zip Code',
        country: 'Country',
        healthFund: 'Health Fund',
        medicalHistory: 'Medical History',
        documentCount: 'Document Count',
        createdAt: 'Created At',
        updatedAt: 'Updated At'
      }
    };
    
    const dict = translations[language] || translations.en;
    if (dict[fieldName]) {
      return dict[fieldName];
    }
    
    // Convert camelCase to readable format
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };
  
  // Enhanced value formatting for comprehensive medical data
  const formatValue = (value, language) => {
    if (value === null || value === undefined) {
      return '-';
    }
    
    if (value === true) return '✓';
    if (value === false) return '✗';
    
    // Handle arrays intelligently - especially medical history
    if (Array.isArray(value)) {
      if (value.length === 0) return language === 'he' ? 'אין' : 'None';
      
      // If array contains medical history objects
      if (value.length > 0 && typeof value[0] === 'object') {
        // Format each medical record
        return value.map((record, index) => {
          const parts = [];
          
          // Add procedure/test type
          if (record.type || record.procedure) {
            parts.push(`${index + 1}. ${record.type || record.procedure}`);
          }
          
          // Add date
          if (record.date) {
            parts.push(`(${formatDate(record.date, language)})`);
          }
          
          // Add findings/results
          if (record.findings || record.results || record.diagnosis) {
            parts.push(`- ${record.findings || record.results || record.diagnosis}`);
          }
          
          // Add medications given
          if (record.medications) {
            if (Array.isArray(record.medications)) {
              parts.push(`- תרופות: ${record.medications.join(', ')}`);
            } else {
              parts.push(`- תרופות: ${record.medications}`);
            }
          }
          
          // Add doctor/facility
          if (record.doctor || record.facility) {
            const doctorInfo = [record.doctor, record.facility].filter(Boolean).join(', ');
            parts.push(`- רופא: ${doctorInfo}`);
          }
          
          // Add recommendations
          if (record.recommendations) {
            parts.push(`- המלצות: ${record.recommendations}`);
          }
          
          return parts.join('\n');
        }).join('\n\n');
      }
      
      // Simple array - join items
      if (value.length <= 3) {
        return value.join(', ');
      } else {
        return `${value.slice(0, 2).join(', ')} + ${value.length - 2} עוד`;
      }
    }
    
    // Handle objects intelligently
    if (typeof value === 'object') {
      // Medical record object
      if (value.date || value.diagnosis || value.treatment || value.procedure) {
        const parts = [];
        if (value.procedure || value.type) parts.push(value.procedure || value.type);
        if (value.date) parts.push(`(${formatDate(value.date, language)})`);
        if (value.findings || value.diagnosis) parts.push(value.findings || value.diagnosis);
        if (value.treatment) parts.push(`טיפול: ${value.treatment}`);
        if (value.doctor) parts.push(`רופא: ${value.doctor}`);
        return parts.join(' - ');
      }
      
      // Medication object
      if (value.name && value.dosage) {
        return `${value.name} ${value.dosage}${value.frequency ? ` - ${value.frequency}` : ''}`;
      }
      
      // Count properties as fallback
      const propCount = Object.keys(value).length;
      return language === 'he' ? 
        `${propCount} פרטים` : 
        `${propCount} items`;
    }
    
    // Format dates
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return formatDate(value, language);
    }
    
    // Clean up field names that became values
    if (typeof value === 'string') {
      // Remove common system prefixes
      const cleaned = value.replace(/^(pending|batch|analysis|document)_?/i, '');
      return cleaned;
    }
    
    return String(value);
  };

  // Smart date formatting
  const formatDate = (dateStr, language) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    return date.toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit'
    });
  };
  
  // If we have multiple items, combine them into one card
  const combinedItem = items.length > 1 ? 
    items.reduce((acc, item) => ({ ...acc, ...item }), {}) : 
    items[0];

  return (
    <div 
      style={{ 
        ...styles.container, 
        direction: isRTL ? 'rtl' : 'ltr'
      }}
    >
      <div style={styles.singleCard}>
        {renderSimpleCard(combinedItem || {})}
      </div>
    </div>
  );
};

// Simple styles for flat card design

const styles = {
  container: {
    padding: '0',
    backgroundColor: 'transparent',
    minHeight: '100%',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  
  singleCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
  },
  
  cardContent: {
    padding: '20px'
  },
  
  section: {
    marginBottom: '24px'
  },
  
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '16px',
    fontWeight: '600',
    color: '#E9EFFA',
    marginBottom: '16px',
    padding: '8px 0',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
  },
  
  sectionIcon: {
    fontSize: '18px'
  },
  
  sectionContent: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '12px'
  },
  
  fieldRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    padding: '8px 0',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
  },
  
  fieldName: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '14px',
    fontWeight: '500',
    minWidth: '120px',
    flexShrink: 0
  },
  
  fieldData: {
    color: '#E9EFFA',
    fontSize: '14px',
    fontWeight: '400',
    textAlign: 'right',
    wordBreak: 'break-word',
    flex: 1,
    whiteSpace: 'pre-line',
    lineHeight: '1.6',
    maxHeight: '200px',
    overflowY: 'auto'
  },
  
  simpleValue: {
    padding: '24px',
    fontSize: '16px',
    color: '#E9EFFA',
    lineHeight: '1.5'
  },
  
  noData: {
    textAlign: 'center',
    padding: '40px 24px',
    fontSize: '16px',
    color: 'rgba(255, 255, 255, 0.5)'
  }
};

export default UniversalDataDisplay;