import React from 'react';

const PatientGrid = ({ data, config, language = 'he', onAction }) => {
  const isRTL = language === 'he';
  
  return (
    <div style={{ direction: isRTL ? 'rtl' : 'ltr', padding: '16px' }}>
      <h3>Patient Grid - Coming Soon</h3>
      <p>This component will display patients in a grid layout.</p>
    </div>
  );
};

export default PatientGrid;