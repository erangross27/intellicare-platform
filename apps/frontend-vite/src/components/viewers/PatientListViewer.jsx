import React from 'react';

const PatientListViewer = ({ patients, language }) => {
  const isRTL = language === 'he';

  // Handle different data structures
  const patientList = Array.isArray(patients) ? patients :
                      patients?.data ? (Array.isArray(patients.data) ? patients.data : [patients.data]) :
                      patients?.patients ? patients.patients :
                      [patients].filter(Boolean);

  // Simple list styles - no cards, just text
  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      padding: '0',
      direction: isRTL ? 'rtl' : 'ltr',
      color: '#e8eaf0',
      fontSize: '15px',
      lineHeight: '1.8'
    },
    header: {
      marginBottom: '16px',
      paddingBottom: '12px',
      borderBottom: '1px solid rgba(142, 142, 160, 0.2)'
    },
    title: {
      margin: '0 0 8px 0',
      fontSize: '18px',
      fontWeight: 600,
      color: '#ffffff'
    },
    resultCount: {
      fontSize: '14px',
      color: '#8e8ea0'
    },
    list: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px'
    },
    patientLine: {
      padding: '4px 0',
      fontSize: '15px',
      color: '#e8eaf0',
      fontFamily: 'monospace',
      letterSpacing: '0.3px'
    },
    empty: {
      padding: '20px 0',
      fontSize: '15px',
      color: '#8e8ea0'
    }
  };

  if (!patientList || patientList.length === 0) {
    return (
      <div style={styles.empty}>
        {isRTL ? 'לא נמצאו מטופלים' : 'No patients found'}
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>
          {isRTL ? 'רשימת מטופלים' : 'Patient List'}
        </h3>
        <span style={styles.resultCount}>
          {patientList.length} {isRTL ? 'מטופלים' : 'patients'}
        </span>
      </div>

      <div style={styles.list}>
        {patientList.map((patient, index) => {
          // Get SSN or ID
          const ssn = patient.socialSecurityNumber || patient.nationalId || patient._id || 'N/A';
          const firstName = patient.firstName || '-';
          const lastName = patient.lastName || '-';

          return (
            <div key={patient._id || patient.patientId || index} style={styles.patientLine}>
              {`${firstName} ${lastName} - ${ssn}`}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PatientListViewer;