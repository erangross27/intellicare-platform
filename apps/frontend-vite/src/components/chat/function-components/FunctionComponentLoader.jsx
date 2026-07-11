import React, { Suspense, lazy, useState, useEffect } from 'react';
import { getComponentConfig } from '../../../config/functionComponentMap';
import FunctionLoading from './base/FunctionLoading';
import ErrorBoundary from './base/ErrorBoundary';

// Helper to create stub component
const StubComponent = ({ name }) => (
  <div style={{ padding: '16px', color: 'rgba(255, 255, 255, 0.5)' }}>
    {name} - Coming Soon
  </div>
);

// Lazy load components for better performance
const componentMap = {
  // Patient Components
  PatientCard: lazy(() => import('./patient/PatientCard')),
  PatientList: lazy(() => import('./patient/PatientList')),
  PatientForm: lazy(() => import('./patient/PatientForm')),
  PatientGrid: lazy(() => import('./patient/PatientGrid')),
  
  // Lab Components
  LabResultsTable: lazy(() => import('./lab/LabResultsTable')),
  LabComparison: lazy(() => import('./lab/LabComparison')),
  LabTrendsChart: lazy(() => import('./lab/LabTrendsChart')),
  
  // Document Components
  DocumentUpload: () => <StubComponent name="DocumentUpload" />,
  DocumentViewer: () => <StubComponent name="DocumentViewer" />,
  DocumentGallery: () => <StubComponent name="DocumentGallery" />,
  DocumentAnalysis: lazy(() => import('./document/DocumentAnalysis')),
  
  // Medication Components
  MedicationList: lazy(() => import('./medication/MedicationList')),
  DrugInteractions: () => <StubComponent name="DrugInteractions" />,
  PrescriptionForm: () => <StubComponent name="PrescriptionForm" />,
  MedicationSchedule: () => <StubComponent name="MedicationSchedule" />,
  
  // Appointment Components (stubs)
  AppointmentForm: () => <StubComponent name="AppointmentForm" />,
  AppointmentCalendar: () => <StubComponent name="AppointmentCalendar" />,
  SlotPicker: () => <StubComponent name="SlotPicker" />,
  
  // Diagnosis Components (stubs)
  DiagnosisCard: () => <StubComponent name="DiagnosisCard" />,
  DifferentialList: () => <StubComponent name="DifferentialList" />,
  
  // Billing Components (stubs)
  InvoicePreview: () => <StubComponent name="InvoicePreview" />,
  PaymentHistory: () => <StubComponent name="PaymentHistory" />,
  
  // Statistics Components (stubs)
  StatsDashboard: () => <StubComponent name="StatsDashboard" />,
  ReportViewer: () => <StubComponent name="ReportViewer" />,
  
  // Default Components
  DefaultCard: lazy(() => import('./base/DefaultCard')),
  UniversalDataDisplay: lazy(() => import('./base/UniversalDataDisplay'))
};

const FunctionComponentLoader = ({ 
  functionName, 
  functionResult, 
  language = 'he',
  onAction,
  isExecuting = false
}) => {
  const [componentConfig, setComponentConfig] = useState(null);
  const [Component, setComponent] = useState(null);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    // Get component configuration
    const config = getComponentConfig(functionName);
    setComponentConfig(config);
    
    // Load the appropriate component
    let ComponentToLoad = componentMap[config.component];
    
    // If component doesn't exist, use UniversalDataDisplay for better handling
    if (!ComponentToLoad) {
      ComponentToLoad = componentMap.UniversalDataDisplay;
    }
    
    setComponent(() => ComponentToLoad);
  }, [functionName]);
  
  // Handle component actions
  const handleAction = (action, data) => {
    process.env.NODE_ENV !== 'production' && console.log(`🎯 Function component action: ${action}`, data);
    
    // Emit action to parent
    if (onAction) {
      onAction({
        functionName,
        action,
        data,
        timestamp: new Date().toISOString()
      });
    }
    
    // Handle some actions locally
    switch (action) {
      case 'print':
        window.print();
        break;
      case 'export':
        exportData(functionResult, functionName);
        break;
      case 'download':
        downloadData(functionResult, functionName);
        break;
      default:
        // Let parent handle other actions
        break;
    }
  };
  
  // Export data as JSON
  const exportData = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Download data
  const downloadData = (data, filename) => {
    // Implementation depends on data type
    if (data.downloadUrl) {
      window.open(data.downloadUrl, '_blank');
    } else {
      exportData(data, filename);
    }
  };
  
  // Show loading state while executing
  if (isExecuting) {
    return (
      <FunctionLoading 
        functionName={functionName}
        config={componentConfig}
        language={language}
      />
    );
  }
  
  // No result yet
  if (!functionResult) {
    return null;
  }
  
  // Error state
  if (error) {
    return (
      <div className="function-error" style={styles.error}>
        <span style={styles.errorIcon}>⚠️</span>
        <div style={styles.errorText}>
          <div style={styles.errorTitle}>
            {language === 'he' ? 'שגיאה בטעינת הרכיב' : 'Component Loading Error'}
          </div>
          <div style={styles.errorMessage}>{error.message}</div>
        </div>
      </div>
    );
  }
  
  // Render the component
  return (
    <ErrorBoundary language={language}>
      <Suspense fallback={
        <FunctionLoading 
          functionName={functionName}
          config={componentConfig}
          language={language}
        />
      }>
        <div className="function-component-wrapper" style={styles.wrapper}>
          {/* Component Header */}
          {componentConfig && (
            <div style={styles.header}>
              <span style={styles.icon}>{componentConfig.icon}</span>
              <span style={styles.title}>
                {componentConfig.title[language] || componentConfig.title.en}
              </span>
            </div>
          )}
          
          {/* Component Body */}
          {Component && (
            <Component
              data={functionResult}
              config={componentConfig}
              language={language}
              onAction={handleAction}
            />
          )}
        </div>
      </Suspense>
    </ErrorBoundary>
  );
};

// Styles
const styles = {
  wrapper: {
    marginTop: '12px',
    marginBottom: '12px',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    animation: 'slideInUp 0.3s ease-out'
  },
  
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)'
  },
  
  icon: {
    fontSize: '20px',
    display: 'flex',
    alignItems: 'center'
  },
  
  title: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#e3e3e8',
    flex: 1
  },
  
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    margin: '12px 0'
  },
  
  errorIcon: {
    fontSize: '24px'
  },
  
  errorText: {
    flex: 1
  },
  
  errorTitle: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#ef4444',
    marginBottom: '4px'
  },
  
  errorMessage: {
    fontSize: '13px',
    color: '#fca5a5'
  }
};

export default FunctionComponentLoader;