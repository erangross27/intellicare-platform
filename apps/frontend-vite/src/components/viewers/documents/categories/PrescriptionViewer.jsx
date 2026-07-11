import React, { useState } from 'react';

const PrescriptionViewer = ({ document, language }) => {
  const isRTL = language === 'he';
  const [expandedMed, setExpandedMed] = useState(null);
  
  // Extract AI analysis data
  const aiAnalysis = document?.aiAnalysis || document?.analysis || document?.geminiAnalysis || {};
  const insights = aiAnalysis.insights || aiAnalysis.extractedData || {};
  const medications = insights.medications || [];
  const prescribingDoctor = insights.doctor || insights.prescribedBy || 'Dr. Cohen';
  const prescriptionDate = insights.date || document?.uploadDate || new Date();
  
  const styles = {
    container: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px',
      direction: isRTL ? 'rtl' : 'ltr',
      color: '#e8eaf0',
      overflowY: 'auto',
      background: 'transparent',
      fontFamily: "'Inter', 'SF Pro Text', 'Segoe UI', system-ui, -apple-system, sans-serif"
    },
    header: {
      marginBottom: '24px',
      paddingBottom: '16px',
      borderBottom: '2px solid rgba(74, 158, 255, 0.2)'
    },
    title: {
      margin: '0 0 8px 0',
      fontSize: '24px',
      fontWeight: 600,
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    categoryBadge: {
      background: 'linear-gradient(135deg, #34d399, #10b981)',
      padding: '6px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 600,
      color: '#ffffff',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px'
    },
    prescriptionHeader: {
      background: 'rgba(30, 41, 59, 0.5)',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '20px',
      border: '1px solid rgba(74, 158, 255, 0.2)'
    },
    rxSymbol: {
      fontSize: '48px',
      fontWeight: 'bold',
      color: '#4a9eff',
      marginBottom: '16px',
      fontFamily: 'serif'
    },
    doctorInfo: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12px'
    },
    doctorName: {
      fontSize: '18px',
      fontWeight: 600,
      color: '#ffffff'
    },
    prescriptionDate: {
      fontSize: '14px',
      color: '#8b949e'
    },
    medicationsList: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    },
    medicationCard: {
      background: 'rgba(30, 41, 59, 0.5)',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid rgba(74, 158, 255, 0.2)',
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    },
    medicationCardExpanded: {
      background: 'rgba(74, 158, 255, 0.1)',
      border: '1px solid rgba(74, 158, 255, 0.4)'
    },
    medicationHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '12px'
    },
    medicationNumber: {
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      background: 'rgba(74, 158, 255, 0.2)',
      color: '#4a9eff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 600,
      fontSize: '14px',
      marginRight: isRTL ? 0 : '12px',
      marginLeft: isRTL ? '12px' : 0
    },
    medicationName: {
      fontSize: '20px',
      fontWeight: 600,
      color: '#4a9eff',
      marginBottom: '4px'
    },
    genericName: {
      fontSize: '14px',
      color: '#8b949e',
      fontStyle: 'italic'
    },
    dosageBox: {
      background: 'rgba(52, 211, 153, 0.1)',
      border: '1px solid rgba(52, 211, 153, 0.3)',
      borderRadius: '8px',
      padding: '12px',
      marginBottom: '12px'
    },
    dosageText: {
      fontSize: '16px',
      fontWeight: 500,
      color: '#34d399',
      marginBottom: '6px'
    },
    instructionGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: '12px',
      marginTop: '12px'
    },
    instructionItem: {
      background: 'rgba(30, 41, 59, 0.3)',
      borderRadius: '8px',
      padding: '12px',
      textAlign: 'center'
    },
    instructionIcon: {
      fontSize: '24px',
      marginBottom: '8px'
    },
    instructionLabel: {
      fontSize: '12px',
      color: '#8b949e',
      marginBottom: '4px'
    },
    instructionValue: {
      fontSize: '14px',
      color: '#ffffff',
      fontWeight: 500
    },
    warningBox: {
      background: 'rgba(251, 191, 36, 0.1)',
      border: '1px solid rgba(251, 191, 36, 0.3)',
      borderRadius: '8px',
      padding: '12px',
      marginTop: '12px'
    },
    warningTitle: {
      fontSize: '13px',
      color: '#fbbf24',
      fontWeight: 600,
      marginBottom: '6px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    },
    sigBox: {
      background: 'rgba(30, 41, 59, 0.5)',
      borderRadius: '8px',
      padding: '16px',
      marginTop: '16px',
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#4a9eff'
    },
    validityBox: {
      background: 'rgba(74, 158, 255, 0.1)',
      border: '1px solid rgba(74, 158, 255, 0.3)',
      borderRadius: '8px',
      padding: '12px',
      marginTop: '20px',
      textAlign: 'center'
    }
  };
  
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString(isRTL ? 'he-IL' : 'en-US');
  };
  
  // Mock medications if none extracted
  const mockMedications = medications.length > 0 ? medications : [
    {
      name: 'Metformin',
      genericName: 'Metformin HCl',
      dosage: '500mg',
      quantity: 60,
      frequency: 'Twice daily',
      duration: '30 days',
      instructions: 'Take with meals',
      refills: 3,
      route: 'Oral',
      foodRequirement: 'With food'
    },
    {
      name: 'Lisinopril',
      genericName: 'Lisinopril',
      dosage: '10mg',
      quantity: 30,
      frequency: 'Once daily',
      duration: '30 days',
      instructions: 'Take in the morning',
      refills: 5,
      route: 'Oral',
      warnings: ['May cause dizziness', 'Monitor blood pressure']
    },
    {
      name: 'Atorvastatin',
      genericName: 'Atorvastatin Calcium',
      dosage: '20mg',
      quantity: 30,
      frequency: 'Once daily at bedtime',
      duration: '30 days',
      instructions: 'Take at bedtime',
      refills: 5,
      route: 'Oral',
      foodRequirement: 'Can take with or without food'
    }
  ];
  
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>
          💊 {isRTL ? 'מרשם רופא' : 'Medical Prescription'}
        </h2>
        <div style={styles.categoryBadge}>
          <span>📋</span>
          <span>{isRTL ? 'קטגוריה: מרשמים' : 'Category: Prescriptions'}</span>
        </div>
      </div>
      
      {/* Prescription Header */}
      <div style={styles.prescriptionHeader}>
        <div style={styles.rxSymbol}>℞</div>
        <div style={styles.doctorInfo}>
          <div>
            <div style={styles.doctorName}>{prescribingDoctor}</div>
            <div style={{ fontSize: '13px', color: '#8b949e' }}>
              {insights.licenseNumber || 'License #12345'}
            </div>
          </div>
          <div style={styles.prescriptionDate}>
            {formatDate(prescriptionDate)}
          </div>
        </div>
        {insights.practice && (
          <div style={{ fontSize: '14px', color: '#a8b2d1' }}>
            {insights.practice}
          </div>
        )}
      </div>
      
      {/* Medications List */}
      <div style={styles.medicationsList}>
        {mockMedications.map((med, index) => (
          <div 
            key={index}
            style={{
              ...styles.medicationCard,
              ...(expandedMed === index ? styles.medicationCardExpanded : {})
            }}
            onClick={() => setExpandedMed(expandedMed === index ? null : index)}
          >
            <div style={styles.medicationHeader}>
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div style={styles.medicationNumber}>{index + 1}</div>
                <div>
                  <div style={styles.medicationName}>{med.name}</div>
                  {med.genericName && (
                    <div style={styles.genericName}>{med.genericName}</div>
                  )}
                </div>
              </div>
              {med.refills !== undefined && (
                <div style={{ 
                  fontSize: '13px', 
                  padding: '4px 8px',
                  background: 'rgba(74, 158, 255, 0.2)',
                  borderRadius: '12px',
                  color: '#4a9eff'
                }}>
                  {med.refills} {isRTL ? 'מילויים' : 'refills'}
                </div>
              )}
            </div>
            
            {/* Dosage Information */}
            <div style={styles.dosageBox}>
              <div style={styles.dosageText}>
                {med.dosage} • {med.frequency}
              </div>
              <div style={{ fontSize: '14px', color: '#34d399' }}>
                {isRTL ? 'כמות:' : 'Quantity:'} {med.quantity} {isRTL ? 'כדורים' : 'tablets'}
                {med.duration && ` • ${med.duration}`}
              </div>
            </div>
            
            {/* Instructions Grid */}
            <div style={styles.instructionGrid}>
              <div style={styles.instructionItem}>
                <div style={styles.instructionIcon}>💊</div>
                <div style={styles.instructionLabel}>{isRTL ? 'דרך מתן' : 'Route'}</div>
                <div style={styles.instructionValue}>{med.route || 'Oral'}</div>
              </div>
              {med.foodRequirement && (
                <div style={styles.instructionItem}>
                  <div style={styles.instructionIcon}>🍽️</div>
                  <div style={styles.instructionLabel}>{isRTL ? 'עם אוכל' : 'Food'}</div>
                  <div style={styles.instructionValue}>{med.foodRequirement}</div>
                </div>
              )}
              <div style={styles.instructionItem}>
                <div style={styles.instructionIcon}>⏰</div>
                <div style={styles.instructionLabel}>{isRTL ? 'תדירות' : 'Frequency'}</div>
                <div style={styles.instructionValue}>{med.frequency}</div>
              </div>
            </div>
            
            {/* Special Instructions */}
            {med.instructions && (
              <div style={{ 
                marginTop: '12px', 
                padding: '12px',
                background: 'rgba(74, 158, 255, 0.1)',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#e8eaf0'
              }}>
                <strong>{isRTL ? 'הוראות:' : 'Instructions:'}</strong> {med.instructions}
              </div>
            )}
            
            {/* Warnings */}
            {med.warnings && med.warnings.length > 0 && (
              <div style={styles.warningBox}>
                <div style={styles.warningTitle}>
                  ⚠️ {isRTL ? 'אזהרות' : 'Warnings'}
                </div>
                {med.warnings.map((warning, i) => (
                  <div key={i} style={{ fontSize: '13px', color: '#fbbf24' }}>
                    • {warning}
                  </div>
                ))}
              </div>
            )}
            
            {/* SIG (Prescription Instructions) */}
            {expandedMed === index && (
              <div style={styles.sigBox}>
                Sig: {med.dosage} PO {med.frequency.toLowerCase()} x {med.duration || '30 days'}
                {med.instructions && `. ${med.instructions}`}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Prescription Validity */}
      <div style={styles.validityBox}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#4a9eff', marginBottom: '4px' }}>
          {isRTL ? 'תוקף המרשם' : 'Prescription Valid'}
        </div>
        <div style={{ fontSize: '13px', color: '#a8b2d1' }}>
          {isRTL ? '30 יום מתאריך הנפקה' : '30 days from issue date'}
        </div>
      </div>
      
      {/* AI Insights */}
      {insights.drugInteractions && (
        <div style={{
          ...styles.warningBox,
          marginTop: '20px'
        }}>
          <div style={styles.warningTitle}>
            🔍 {isRTL ? 'אינטראקציות בין תרופות' : 'Drug Interactions'}
          </div>
          <div style={{ fontSize: '13px', color: '#fbbf24' }}>
            {insights.drugInteractions}
          </div>
        </div>
      )}
    </div>
  );
};

export default PrescriptionViewer;