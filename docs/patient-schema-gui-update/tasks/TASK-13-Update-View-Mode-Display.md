# Task 13: Update View Mode Display

## 📋 Task Overview
**Priority**: High  
**Type**: Development  
**Estimated Time**: 6 hours  
**Sprint**: 4  

## 🎯 Objective
Update the PatientDetail component's view mode to display all patient information including separate firstName/lastName and country-specific fields in a well-organized layout.

## 📝 Description
As a user, I want to see all patient information displayed in a clear, well-organized view that includes all the new fields, so that I can review complete patient details at a glance.

## ✅ Acceptance Criteria
- [ ] View mode displays firstName and lastName separately
- [ ] All universal fields are shown in logical sections
- [ ] Country-specific fields are displayed when relevant
- [ ] Address information is properly formatted
- [ ] Patient status is visually indicated
- [ ] Missing/optional fields are handled gracefully
- [ ] Proper formatting for dates, addresses, etc.
- [ ] RTL layout works correctly for Hebrew
- [ ] Responsive design maintained
- [ ] Visual hierarchy is clear and professional

## 🔧 Technical Requirements

### View Mode Structure
```javascript
// New view mode organization
<div className="patient-view-container">
  {/* Basic Information Section */}
  <div className="info-section">
    <h4>{t('basicInformation')}</h4>
    <div className="info-grid">
      {/* firstName, lastName, dateOfBirth, age, gender */}
    </div>
  </div>
  
  {/* Contact Information Section */}
  <div className="info-section">
    <h4>{t('contactInformation')}</h4>
    <div className="info-grid">
      {/* email, phone, full address */}
    </div>
  </div>
  
  {/* Identification Section */}
  <div className="info-section">
    <h4>{t('identification')}</h4>
    <div className="info-grid">
      {/* country, country-specific ID fields */}
    </div>
  </div>
  
  {/* Healthcare Information Section */}
  <div className="info-section">
    <h4>{t('healthcareInformation')}</h4>
    <div className="info-grid">
      {/* status, country-specific healthcare fields */}
    </div>
  </div>
  
  {/* Doctor's Summary */}
  {patient?.doctorSummary && (
    <div className="summary-section">
      <h4>{t('doctorsSummary')}</h4>
      <div className="summary-content">
        {patient.doctorSummary}
      </div>
    </div>
  )}
</div>
```

### Display Data Processing
```javascript
const getDisplayData = () => {
  if (!patient) return [];
  
  const basicInfo = [
    { 
      label: t('firstName'), 
      value: patient.firstName || t('notProvided'), 
      icon: '👤',
      section: 'basic'
    },
    { 
      label: t('lastName'), 
      value: patient.lastName || t('notProvided'), 
      icon: '👤',
      section: 'basic'
    },
    { 
      label: t('dateOfBirth'), 
      value: patient.dateOfBirth ? formatDate(patient.dateOfBirth) : t('notProvided'), 
      icon: '📅',
      section: 'basic'
    },
    { 
      label: t('age'), 
      value: patient.age ? `${patient.age} ${t('years')}` : (patient.dateOfBirth ? calculateAge(patient.dateOfBirth) + ` ${t('years')}` : t('notProvided')), 
      icon: '🎂',
      section: 'basic'
    },
    { 
      label: t('gender'), 
      value: patient.gender ? getGenderDisplay(patient.gender) : t('notProvided'), 
      icon: getGenderIcon(patient.gender),
      section: 'basic'
    }
  ];
  
  const contactInfo = [
    { 
      label: t('email'), 
      value: patient.email || t('notProvided'), 
      icon: '📧',
      section: 'contact',
      type: 'email'
    },
    { 
      label: t('phone'), 
      value: patient.phone || t('notProvided'), 
      icon: '📱',
      section: 'contact',
      type: 'phone'
    },
    { 
      label: t('address'), 
      value: formatAddress(patient), 
      icon: '🏠',
      section: 'contact',
      type: 'address'
    }
  ];
  
  const identificationInfo = [
    { 
      label: t('country'), 
      value: patient.country || t('notProvided'), 
      icon: '🌍',
      section: 'identification'
    },
    ...getCountrySpecificDisplayFields(patient)
  ];
  
  const healthcareInfo = [
    { 
      label: t('status'), 
      value: patient.status || 'active', 
      icon: '📊',
      section: 'healthcare',
      type: 'status'
    },
    ...getCountrySpecificHealthcareFields(patient)
  ];
  
  return {
    basic: basicInfo,
    contact: contactInfo,
    identification: identificationInfo,
    healthcare: healthcareInfo
  };
};
```

## 📁 Files to Modify
- `frontend-vite/src/components/PatientDetail.js`
- `frontend-vite/src/components/PatientDetail.css`

## 🔗 Dependencies
- **Blocked by**: Task 12 (Update API Integration)
- **Blocks**: Task 14 (CSS Styling and Responsive Design)

## 🧪 Testing Requirements
- [ ] All fields display correctly
- [ ] firstName/lastName show separately
- [ ] Country-specific fields appear
- [ ] Address formatting works
- [ ] Status indicator functions
- [ ] Missing fields handled gracefully
- [ ] Responsive design works
- [ ] RTL layout for Hebrew

## 📚 Implementation Details

### Address Formatting
```javascript
const formatAddress = (patient) => {
  const addressParts = [
    patient.street,
    patient.city,
    patient.zipCode
  ].filter(part => part && part.trim() !== '');
  
  if (addressParts.length === 0) {
    return t('notProvided');
  }
  
  return addressParts.join(', ');
};
```

### Date Formatting
```javascript
const formatDate = (dateString) => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return t('invalidDate');
  
  return date.toLocaleDateString(currentLanguage === 'he' ? 'he-IL' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const calculateAge = (dateOfBirth) => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};
```

### Country-Specific Field Display
```javascript
const getCountrySpecificDisplayFields = (patient) => {
  if (!patient.country) return [];
  
  const countryConfig = getCountryConfig(patient.country);
  if (!countryConfig) return [];
  
  const fields = [];
  
  Object.keys(countryConfig.fields).forEach(fieldName => {
    const fieldConfig = countryConfig.fields[fieldName];
    const value = patient[fieldName];
    
    if (value) {
      const currentLanguage = getCurrentLanguage();
      const label = currentLanguage === 'he' ? fieldConfig.labelHe : fieldConfig.label;
      
      fields.push({
        label: label || t(fieldName),
        value: value,
        icon: getFieldIcon(fieldName),
        section: 'identification',
        fieldName: fieldName
      });
    }
  });
  
  return fields;
};

const getFieldIcon = (fieldName) => {
  const iconMap = {
    nationalId: '🆔',
    socialSecurityNumber: '🆔',
    healthCardNumber: '💳',
    nhsNumber: '🏥',
    healthInsuranceNumber: '💳',
    vitaleCardNumber: '💳',
    cpfNumber: '🆔',
    susNumber: '💳',
    nationalIdNumber: '🆔',
    residentRegistrationNumber: '🆔',
    medicareNumber: '💳',
    nationalHealthIndexNumber: '💳',
    healthFund: '🏥',
    insuranceProvider: '🏥',
    province: '🗺️',
    state: '🗺️',
    autonomousCommunity: '🗺️',
    prefecture: '🗺️',
    insuranceType: '💼',
    healthInsuranceProvider: '🏥',
    nationalHealthInsuranceNumber: '💳',
    indigenousStatus: '🏛️',
    ethnicity: '🏛️'
  };
  
  return iconMap[fieldName] || '📋';
};
```

### Status Display Component
```javascript
const StatusIndicator = ({ status }) => {
  const getStatusDisplay = (status) => {
    const statusMap = {
      active: { label: t('active'), class: 'status-active', icon: '✅' },
      inactive: { label: t('inactive'), class: 'status-inactive', icon: '⏸️' },
      archived: { label: t('archived'), class: 'status-archived', icon: '📦' }
    };
    
    return statusMap[status] || statusMap.active;
  };
  
  const statusInfo = getStatusDisplay(status);
  
  return (
    <div className={`status-indicator ${statusInfo.class}`}>
      <span className="status-icon">{statusInfo.icon}</span>
      <span className="status-label">{statusInfo.label}</span>
    </div>
  );
};
```

### Info Item Component
```javascript
const InfoItem = ({ item }) => {
  const renderValue = () => {
    switch (item.type) {
      case 'email':
        return item.value !== t('notProvided') ? (
          <a href={`mailto:${item.value}`} className="email-link">
            {item.value}
          </a>
        ) : item.value;
        
      case 'phone':
        return item.value !== t('notProvided') ? (
          <a href={`tel:${item.value}`} className="phone-link">
            {item.value}
          </a>
        ) : item.value;
        
      case 'status':
        return <StatusIndicator status={item.value} />;
        
      case 'address':
        return item.value !== t('notProvided') ? (
          <div className="address-display">
            {item.value}
          </div>
        ) : item.value;
        
      default:
        return item.value;
    }
  };
  
  return (
    <div className="info-item">
      <div className="info-item-header">
        <span className="info-icon">{item.icon}</span>
        <span className="info-label">{item.label}</span>
      </div>
      <div className="info-value">
        {renderValue()}
      </div>
    </div>
  );
};
```

### Section Rendering
```javascript
const renderInfoSection = (title, items, sectionKey) => {
  if (!items || items.length === 0) return null;
  
  return (
    <div className="info-section" key={sectionKey}>
      <h4 className="section-title">
        <span className="section-icon">{getSectionIcon(sectionKey)}</span>
        {title}
      </h4>
      <div className="info-grid">
        {items.map((item, index) => (
          <InfoItem key={`${sectionKey}-${index}`} item={item} />
        ))}
      </div>
    </div>
  );
};

const getSectionIcon = (sectionKey) => {
  const iconMap = {
    basic: '👤',
    contact: '📞',
    identification: '🆔',
    healthcare: '🏥'
  };
  return iconMap[sectionKey] || '📋';
};
```

## 🎨 Styling Requirements
```css
.patient-view-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  max-width: 1000px;
  margin: 0 auto;
}

.info-section {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 4px 16px rgba(0,0,0,0.06);
  border: 1px solid #e3e8f0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0 0 1.5rem 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #374151;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-item-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  color: #6b7280;
  font-size: 0.875rem;
}

.info-value {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  line-height: 1.4;
}

.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.status-active {
  background: #d4edda;
  color: #155724;
}

.status-inactive {
  background: #f8d7da;
  color: #721c24;
}

.status-archived {
  background: #e2e3e5;
  color: #6c757d;
}

.email-link, .phone-link {
  color: #3b82f6;
  text-decoration: none;
}

.email-link:hover, .phone-link:hover {
  text-decoration: underline;
}

.address-display {
  line-height: 1.5;
}

.summary-section {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.05) 100%);
  padding: 2rem;
  border-radius: 16px;
  border: 2px solid rgba(102, 126, 234, 0.15);
}

.summary-content {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  line-height: 1.6;
  font-size: 1rem;
  color: #374151;
}
```

## ✔️ Definition of Done
- [ ] View mode displays all fields correctly
- [ ] firstName/lastName shown separately
- [ ] Country-specific fields appear
- [ ] Address formatting works
- [ ] Status indicators function
- [ ] Missing fields handled gracefully
- [ ] Responsive design maintained
- [ ] RTL layout works for Hebrew
- [ ] Code review approved

## 📋 Checklist
- [ ] Update view mode JSX
- [ ] Implement display data processing
- [ ] Add address formatting
- [ ] Create status indicator
- [ ] Add country-specific field display
- [ ] Implement info item component
- [ ] Update section rendering
- [ ] Add styling for new layout
- [ ] Test responsive design
- [ ] Verify RTL layout
