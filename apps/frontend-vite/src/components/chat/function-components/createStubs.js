// Script to create stub components
const fs = require('fs');
const path = require('path');

const stubComponents = [
  // Document components
  { dir: 'document', name: 'DocumentUpload' },
  { dir: 'document', name: 'DocumentViewer' },
  { dir: 'document', name: 'DocumentGallery' },
  { dir: 'document', name: 'DocumentAnalysis' },
  
  // Medication components
  { dir: 'medication', name: 'DrugInteractions' },
  { dir: 'medication', name: 'PrescriptionForm' },
  { dir: 'medication', name: 'MedicationSchedule' },
  
  // Appointment components
  { dir: 'appointment', name: 'AppointmentForm' },
  { dir: 'appointment', name: 'AppointmentCalendar' },
  { dir: 'appointment', name: 'SlotPicker' },
  
  // Diagnosis components
  { dir: 'diagnosis', name: 'DiagnosisCard' },
  { dir: 'diagnosis', name: 'DifferentialList' },
  
  // Billing components
  { dir: 'billing', name: 'InvoicePreview' },
  { dir: 'billing', name: 'PaymentHistory' },
  
  // Statistics components
  { dir: 'statistics', name: 'StatsDashboard' },
  { dir: 'statistics', name: 'ReportViewer' }
];

const createStubComponent = (dir, name) => {
  const template = `import React from 'react';

const ${name} = ({ data, config, language = 'he', onAction }) => {
  const isRTL = language === 'he';
  
  return (
    <div style={{ 
      padding: '16px',
      direction: isRTL ? 'rtl' : 'ltr',
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
      borderRadius: '8px',
      color: '#e3e3e8'
    }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>${name}</h3>
      <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)' }}>
        Component coming soon...
      </p>
    </div>
  );
};

export default ${name};`;

  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  const filePath = path.join(dirPath, `${name}.js`);
  fs.writeFileSync(filePath, template);
  process.env.NODE_ENV !== 'production' && console.log(`Created: ${dir}/${name}.js`);
};

// Create all stub components
stubComponents.forEach(({ dir, name }) => {
  createStubComponent(dir, name);
});

process.env.NODE_ENV !== 'production' && console.log('All stub components created successfully!');