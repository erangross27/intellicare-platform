import React, { useState, useEffect } from 'react';

const PatientViewer = ({ patient, language, mode = 'view' }) => {
  const isRTL = language === 'he';
  const isAddMode = mode === 'patient-add' || mode === 'add';
  const isEditMode = mode === 'patient-edit' || mode === 'edit';
  const isViewMode = mode === 'view' || mode === 'patient-view';
  
  // Handle various patient data structures
  const initialData = patient?.patient || patient?.data || patient || {};
  
  // State for editing
  const [formData, setFormData] = useState({
    firstName: initialData.firstName || '',
    lastName: initialData.lastName || '',
    nationalId: initialData.nationalId || initialData.socialSecurityNumber || '',
    dateOfBirth: initialData.dateOfBirth || '',
    gender: initialData.gender || '',
    phone: initialData.phone || '',
    email: initialData.email || '',
    street: initialData.street || '',
    city: initialData.city || '',
    state: initialData.state || '',
    zipCode: initialData.zipCode || initialData.postalCode || '',
    healthFund: initialData.healthFund || initialData.insuranceProvider || '',
    insuranceNumber: initialData.insuranceNumber || ''
  });
  
  // Track which fields are being edited
  const [editingFields, setEditingFields] = useState({});
  
  // Expose functions for chat commands
  useEffect(() => {
    window.updatePatientField = (field, value) => {
      setFormData(prev => ({ ...prev, [field]: value }));
      setEditingFields(prev => ({ ...prev, [field]: true }));
    };
    
    window.getFormData = () => formData;
    
    return () => {
      delete window.updatePatientField;
      delete window.getFormData;
    };
  }, [formData]);
  
  // Handle field changes
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setEditingFields(prev => ({ ...prev, [field]: true }));
  };
  
  // Helper functions
  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return '';
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };
  
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString(isRTL ? 'he-IL' : 'en-US');
  };
  
  const formatPhone = (phone) => {
    if (!phone) return '-';
    if (phone.length === 10 && phone.startsWith('0')) {
      return `${phone.slice(0,3)}-${phone.slice(3,6)}-${phone.slice(6)}`;
    }
    if (phone.length === 10) {
      return `(${phone.slice(0,3)}) ${phone.slice(3,6)}-${phone.slice(6)}`;
    }
    return phone;
  };
  
  // Unified styles for all modes
  const styles = {
    container: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '32px',
      direction: isRTL ? 'rtl' : 'ltr',
      color: '#e8eaf0',
      overflowY: 'auto',
      background: 'transparent',
      fontFamily: "'Inter', 'SF Pro Text', 'Segoe UI', system-ui, -apple-system, sans-serif"
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: '24px',
      marginBottom: '32px',
      paddingBottom: '24px',
      borderBottom: '2px solid rgba(74, 158, 255, 0.2)'
    },
    avatar: {
      width: '80px',
      height: '80px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #4a9eff, #667eea)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '32px',
      fontWeight: 600,
      color: 'white',
      boxShadow: '0 4px 16px rgba(74, 158, 255, 0.3)',
      flexShrink: 0
    },
    nameSection: {
      flex: 1
    },
    title: {
      margin: '0 0 8px 0',
      fontSize: '28px',
      fontWeight: 600,
      color: '#ffffff'
    },
    subtitle: {
      fontSize: '14px',
      color: '#a8b2d1',
      marginBottom: '8px'
    },
    patientId: {
      fontSize: '16px',
      color: '#4a9eff',
      fontWeight: 500
    },
    section: {
      marginBottom: '28px'
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: 600,
      color: '#ffffff',
      marginBottom: '16px',
      paddingBottom: '8px',
      borderBottom: '1px solid rgba(74, 158, 255, 0.1)'
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '20px'
    },
    field: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px'
    },
    label: {
      fontSize: '13px',
      color: '#8b949e',
      fontWeight: 500,
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    value: {
      fontSize: '16px',
      color: '#e8eaf0',
      padding: '10px 14px',
      background: 'rgba(30, 41, 59, 0.5)',
      borderRadius: '8px',
      border: '1px solid transparent',
      minHeight: '42px',
      display: 'flex',
      alignItems: 'center'
    },
    input: {
      fontSize: '16px',
      color: '#e8eaf0',
      padding: '10px 14px',
      background: 'rgba(30, 41, 59, 0.7)',
      borderRadius: '8px',
      border: '1px solid rgba(74, 158, 255, 0.3)',
      minHeight: '42px',
      outline: 'none',
      fontFamily: 'inherit',
      width: '100%',
      transition: 'all 0.2s ease'
    },
    inputEdited: {
      border: '1px solid rgba(74, 158, 255, 0.6)',
      background: 'rgba(74, 158, 255, 0.1)'
    }
  };
  
  // Render field based on mode
  const renderField = (label, field, value, type = 'text') => {
    const isEditable = isEditMode || isAddMode;
    
    return (
      <div style={styles.field}>
        <label style={styles.label}>{label}</label>
        {isEditable ? (
          <input
            type={type}
            value={formData[field]}
            onChange={(e) => handleChange(field, e.target.value)}
            style={{
              ...styles.input,
              ...(editingFields[field] ? styles.inputEdited : {})
            }}
            placeholder={isAddMode ? `${isRTL ? 'הקלד' : 'Enter'} ${label.toLowerCase()}` : ''}
          />
        ) : (
          <div style={styles.value}>
            {value || '-'}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.avatar}>
          {isAddMode ? (
            <span>+</span>
          ) : (
            <>
              {(formData.firstName?.[0] || '').toUpperCase()}
              {(formData.lastName?.[0] || '').toUpperCase()}
            </>
          )}
        </div>
        <div style={styles.nameSection}>
          <h2 style={styles.title}>
            {isAddMode 
              ? (isRTL ? 'הוספת מטופל חדש' : 'Add New Patient')
              : isEditMode
              ? (isRTL ? 'עריכת פרטי מטופל' : 'Edit Patient')
              : `${formData.firstName} ${formData.lastName}`
            }
          </h2>
          {(isEditMode || isAddMode) && (
            <div style={styles.subtitle}>
              {isRTL 
                ? 'השתמש בצ׳אט לעדכון: "שנה שם פרטי לדוד"'
                : 'Use chat to update: "change first name to David"'}
            </div>
          )}
          {!isAddMode && (
            <span style={styles.patientId}>
              {isRTL ? 'ת.ז:' : 'ID:'} {formData.nationalId || '-'}
            </span>
          )}
        </div>
      </div>
      
      {/* Basic Information */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>
          {isRTL ? 'מידע בסיסי' : 'Basic Information'}
        </h3>
        <div style={styles.grid}>
          {renderField(isRTL ? 'שם פרטי' : 'First Name', 'firstName', formData.firstName)}
          {renderField(isRTL ? 'שם משפחה' : 'Last Name', 'lastName', formData.lastName)}
          {renderField(isRTL ? 'תעודת זהות' : 'National ID', 'nationalId', formData.nationalId)}
          {renderField(isRTL ? 'תאריך לידה' : 'Date of Birth', 'dateOfBirth', 
            isViewMode ? formatDate(formData.dateOfBirth) : formData.dateOfBirth, 'date')}
          {isViewMode && (
            <div style={styles.field}>
              <label style={styles.label}>{isRTL ? 'גיל' : 'Age'}</label>
              <div style={styles.value}>
                {calculateAge(formData.dateOfBirth)} {isRTL ? 'שנים' : 'years'}
              </div>
            </div>
          )}
          {renderField(isRTL ? 'מין' : 'Gender', 'gender', formData.gender)}
        </div>
      </div>
      
      {/* Contact Information */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>
          {isRTL ? 'פרטי קשר' : 'Contact Information'}
        </h3>
        <div style={styles.grid}>
          {renderField(isRTL ? 'טלפון' : 'Phone', 'phone', 
            isViewMode ? formatPhone(formData.phone) : formData.phone, 'tel')}
          {renderField(isRTL ? 'אימייל' : 'Email', 'email', formData.email, 'email')}
        </div>
      </div>
      
      {/* Address */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>
          {isRTL ? 'כתובת' : 'Address'}
        </h3>
        <div style={styles.grid}>
          {renderField(isRTL ? 'רחוב' : 'Street', 'street', formData.street)}
          {renderField(isRTL ? 'עיר' : 'City', 'city', formData.city)}
          {renderField(isRTL ? 'מיקוד' : 'Zip Code', 'zipCode', formData.zipCode)}
        </div>
      </div>
      
      {/* Insurance */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>
          {isRTL ? 'ביטוח רפואי' : 'Medical Insurance'}
        </h3>
        <div style={styles.grid}>
          {renderField(isRTL ? 'קופת חולים' : 'Health Fund', 'healthFund', formData.healthFund)}
          {renderField(isRTL ? 'מספר ביטוח' : 'Insurance Number', 'insuranceNumber', formData.insuranceNumber)}
        </div>
      </div>
    </div>
  );
};

export default PatientViewer;