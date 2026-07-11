import React from 'react';

const PatientForm = ({ data, config, language = 'he', onAction }) => {
  const isRTL = language === 'he';
  
  return (
    <div style={{ direction: isRTL ? 'rtl' : 'ltr', padding: '16px' }}>
      <h3>Patient Form - Coming Soon</h3>
      <p>This component will handle patient creation and editing.</p>
    </div>
  );
};

export default PatientForm;