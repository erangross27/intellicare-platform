import React from 'react';

// Import all viewer components
import PatientViewer from './viewers/PatientViewer';
import PatientListViewer from './viewers/PatientListViewer';
import DocumentViewer from './viewers/documents/DocumentViewer';
import DocumentListViewer from './viewers/documents/DocumentListViewer';
import MedicalHistoryViewer from './viewers/MedicalHistoryViewer';
import LabResultsViewer from './viewers/medical/LabResultsViewer';
import MedicationTracker from './viewers/MedicationTracker';
import MedicationViewer from './viewers/medical/MedicationViewer';
import AllergyViewer from './viewers/medical/AllergyViewer';
import VitalSignsViewer from './viewers/medical/VitalSignsViewer';

const ContextPanel = React.memo(({ context, language }) => {
  const { type, data, mode } = context;
  const isRTL = language === 'he';
  
  // Base styles for the panel
  const styles = {
    panel: {
      height: '100%',
      background: 'linear-gradient(135deg, #0f1329 0%, #1a1f3a 100%)',
      color: '#e8eaf0',
      padding: '24px',
      overflowY: 'auto',
      direction: isRTL ? 'rtl' : 'ltr'
    },
    content: {
      maxWidth: '100%',
      margin: '0 auto'
    },
    section: {
      background: 'rgba(30, 35, 65, 0.5)',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '16px',
      border: '1px solid rgba(74, 158, 255, 0.2)'
    },
    heading: {
      margin: '0 0 16px 0',
      fontSize: '20px',
      fontWeight: 600,
      background: 'linear-gradient(135deg, #4a9eff, #667eea)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text'
    },
    pre: {
      background: 'rgba(10, 14, 39, 0.6)',
      padding: '16px',
      borderRadius: '8px',
      color: '#e8eaf0',
      fontSize: '13px',
      overflowX: 'auto',
      border: '1px solid rgba(42, 48, 80, 0.5)',
      margin: '12px 0'
    },
    successBox: {
      background: 'rgba(52, 211, 153, 0.1)',
      border: '1px solid rgba(52, 211, 153, 0.3)',
      borderRadius: '8px',
      padding: '16px',
      color: '#34d399'
    },
    errorBox: {
      background: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      borderRadius: '8px',
      padding: '16px',
      color: '#ef4444'
    },
    warningBox: {
      background: 'rgba(251, 191, 36, 0.1)',
      border: '1px solid rgba(251, 191, 36, 0.3)',
      borderRadius: '8px',
      padding: '16px',
      color: '#fbbf24'
    },
    infoBox: {
      background: 'rgba(74, 158, 255, 0.1)',
      border: '1px solid rgba(74, 158, 255, 0.3)',
      borderRadius: '8px',
      padding: '16px',
      color: '#4a9eff'
    }
  };
  
  // Generic data viewer for unimplemented components
  const GenericViewer = ({ title, data, style = {} }) => (
    <div style={{...styles.section, ...style}}>
      <h3 style={styles.heading}>{title}</h3>
      <pre style={styles.pre}>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
  
  // Route to appropriate viewer based on context type
  const renderContent = () => {
    if (!type || !data) return null;
    
    switch (type) {
      // ========== PATIENT MANAGEMENT ==========
      case 'patient-view':
      case 'patient-display':
        return <PatientViewer patient={data} language={language} mode="view" />;
      
      case 'patient-edit':
      case 'patient-update':
        return <PatientViewer patient={data} language={language} mode="edit" />;
        
      case 'patient-add':
      case 'patient-create':
        return <PatientViewer patient={data} language={language} mode="add" />;
      
      case 'patient-list':
      case 'patient-search':
        return <PatientListViewer patients={data} language={language} />;
      
      case 'patient-delete-confirm':
        return (
          <div style={styles.warningBox}>
            <h3 style={styles.heading}>
              {isRTL ? '⚠️ אישור מחיקת מטופל' : '⚠️ Confirm Patient Deletion'}
            </h3>
            <p>{isRTL ? `האם למחוק את ${data.name}?` : `Delete ${data.name}?`}</p>
            <p>{isRTL ? 'הקלד "אשר מחיקה" להמשך' : 'Type "confirm deletion" to proceed'}</p>
          </div>
        );
      
      // ========== MEDICAL HISTORY ==========
      case 'history-view':
      case 'medical-history':
        return <MedicalHistoryViewer data={data} language={language} mode="view" />;
      
      case 'history-add':
      case 'medical-history-add':
        return <MedicalHistoryViewer data={data} language={language} mode="add" />;
      
      // ========== DOCUMENTS ==========
      case 'document-view':
      case 'document-display':
        return <DocumentViewer document={data} language={language} />;
      
      case 'document-list':
      case 'documents':
        // If data is an array of documents or has documents array, use DocumentListViewer
        if (Array.isArray(data) || (data && (Array.isArray(data.data) || Array.isArray(data.documents)))) {
          const isPracticeWide = data.isPracticeWide || (data.summary && data.summary.totalDocuments);
          return <DocumentListViewer 
            documents={data} 
            patientName={data.patientName} 
            language={language}
            isPracticeWide={isPracticeWide}
          />;
        }
        // Otherwise show generic viewer
        return (
          <GenericViewer 
            title={isRTL ? 'מסמכים' : 'Documents'}
            data={data}
          />
        );
      
      case 'document-upload':
        // After upload, display the document with its AI-determined category
        if (data.aiClassification || data.analysis) {
          return <DocumentViewer document={data} language={language} />;
        }
        return (
          <div style={styles.successBox}>
            <h3 style={styles.heading}>
              {isRTL ? '✅ מסמך הועלה בהצלחה' : '✅ Document Uploaded'}
            </h3>
            <p>{data.fileName || data.name}</p>
            {data.analysis && (
              <div style={{ marginTop: '12px' }}>
                <strong>{isRTL ? 'ניתוח Gemini:' : 'Gemini Analysis:'}</strong>
                <pre style={styles.pre}>{JSON.stringify(data.analysis, null, 2)}</pre>
              </div>
            )}
          </div>
        );
      
      case 'document-analysis':
        return (
          <GenericViewer 
            title={isRTL ? 'ניתוח מסמך' : 'Document Analysis'}
            data={data}
            style={styles.infoBox}
          />
        );
      
      // ========== DIAGNOSIS ==========
      case 'diagnosis-view':
      case 'diagnosis':
        return (
          <div style={styles.section}>
            <h3 style={styles.heading}>{isRTL ? '🩺 אבחנה' : '🩺 Diagnosis'}</h3>
            {data.primaryDiagnosis && (
              <div style={{ marginBottom: '16px' }}>
                <strong>{isRTL ? 'אבחנה ראשית:' : 'Primary Diagnosis:'}</strong>
                <div style={{ fontSize: '18px', color: '#4a9eff', marginTop: '8px' }}>
                  {data.primaryDiagnosis}
                </div>
              </div>
            )}
            {data.confidence && (
              <div style={{ marginBottom: '16px' }}>
                <strong>{isRTL ? 'רמת ביטחון:' : 'Confidence:'}</strong> {data.confidence}%
              </div>
            )}
            {data.differentialDiagnosis && (
              <div>
                <strong>{isRTL ? 'אבחנה מבדלת:' : 'Differential Diagnosis:'}</strong>
                <ul style={{ marginTop: '8px' }}>
                  {data.differentialDiagnosis.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      
      // ========== TREATMENT ==========
      case 'treatment-view':
      case 'treatment':
        return (
          <div style={styles.section}>
            <h3 style={styles.heading}>{isRTL ? '💊 המלצות טיפול' : '💊 Treatment Plan'}</h3>
            {data.medications && (
              <div style={{ marginBottom: '16px' }}>
                <strong>{isRTL ? 'תרופות:' : 'Medications:'}</strong>
                <ul style={{ marginTop: '8px' }}>
                  {data.medications.map((med, i) => (
                    <li key={i}>
                      {med.name} - {med.dosage} ({med.frequency})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.instructions && (
              <div>
                <strong>{isRTL ? 'הוראות:' : 'Instructions:'}</strong>
                <p style={{ marginTop: '8px' }}>{data.instructions}</p>
              </div>
            )}
          </div>
        );
      
      // ========== LAB RESULTS ==========
      case 'lab-view':
      case 'lab-results':
        return <LabResultsViewer patientId={data?.patientId || data?._id} patientName={data?.name || `${data?.firstName} ${data?.lastName}`} language={language} />;
      
      case 'lab-add':
        return (
          <div style={styles.successBox}>
            <h3 style={styles.heading}>
              {isRTL ? '✅ תוצאות מעבדה נוספו' : '✅ Lab Results Added'}
            </h3>
            <pre style={styles.pre}>{JSON.stringify(data, null, 2)}</pre>
          </div>
        );
      
      // ========== MEDICATIONS ==========
      case 'medication-view':
      case 'medications':
        return <MedicationViewer patientId={data?.patientId || data?._id} patientName={data?.name || `${data?.firstName} ${data?.lastName}`} language={language} />;
      
      case 'medication-add':
        return (
          <div style={styles.successBox}>
            <h3 style={styles.heading}>
              {isRTL ? '✅ תרופה נוספה' : '✅ Medication Added'}
            </h3>
            <p>{data.name} - {data.dosage}</p>
          </div>
        );
      
      case 'drug-interactions':
        return (
          <div style={data.hasInteractions ? styles.warningBox : styles.infoBox}>
            <h3 style={styles.heading}>
              {isRTL ? '⚠️ בדיקת אינטראקציות' : '⚠️ Drug Interactions'}
            </h3>
            {data.interactions && data.interactions.length > 0 ? (
              <ul>
                {data.interactions.map((interaction, i) => (
                  <li key={i}>{interaction}</li>
                ))}
              </ul>
            ) : (
              <p>{isRTL ? 'לא נמצאו אינטראקציות' : 'No interactions found'}</p>
            )}
          </div>
        );
      
      // ========== VITAL SIGNS ==========
      case 'vitals-view':
      case 'vital-signs':
        return <VitalSignsViewer patientId={data?.patientId || data?._id} patientName={data?.name || `${data?.firstName} ${data?.lastName}`} language={language} />;
      
      case 'vitals-add':
        return (
          <div style={styles.successBox}>
            <h3 style={styles.heading}>
              {isRTL ? '✅ סימנים חיוניים נוספו' : '✅ Vital Signs Added'}
            </h3>
            <pre style={styles.pre}>{JSON.stringify(data, null, 2)}</pre>
          </div>
        );
      
      // ========== ALLERGIES ==========
      case 'allergy-view':
      case 'allergies':
        return <AllergyViewer patientId={data?.patientId || data?._id} patientName={data?.name || `${data?.firstName} ${data?.lastName}`} language={language} />;
      
      case 'allergy-add':
        return (
          <div style={styles.warningBox}>
            <h3 style={styles.heading}>
              {isRTL ? '⚠️ אלרגיה נוספה' : '⚠️ Allergy Added'}
            </h3>
            <p>{data.allergen} - {data.severity}</p>
          </div>
        );
      
      // ========== VACCINATIONS ==========
      case 'vaccination-view':
      case 'vaccinations':
        return (
          <GenericViewer 
            title={isRTL ? '💉 חיסונים' : '💉 Vaccinations'}
            data={data}
          />
        );
      
      case 'vaccination-add':
        return (
          <div style={styles.successBox}>
            <h3 style={styles.heading}>
              {isRTL ? '✅ חיסון נוסף' : '✅ Vaccination Added'}
            </h3>
            <p>{data.vaccine} - {data.date}</p>
          </div>
        );
      
      // ========== APPOINTMENTS ==========
      case 'appointment-view':
      case 'appointment':
        return (
          <GenericViewer 
            title={isRTL ? '📅 תור' : '📅 Appointment'}
            data={data}
          />
        );
      
      case 'appointment-schedule':
        return (
          <div style={styles.infoBox}>
            <h3 style={styles.heading}>
              {isRTL ? '📅 קביעת תור' : '📅 Schedule Appointment'}
            </h3>
            <pre style={styles.pre}>{JSON.stringify(data, null, 2)}</pre>
          </div>
        );
      
      case 'appointment-slots':
        return (
          <GenericViewer 
            title={isRTL ? '🕐 זמנים פנויים' : '🕐 Available Slots'}
            data={data}
          />
        );
      
      // ========== CHAT SESSIONS ==========
      case 'chat-session':
      case 'chat-create':
        return (
          <div style={styles.successBox}>
            <h3 style={styles.heading}>
              {isRTL ? '💬 שיחה חדשה נוצרה' : '💬 Chat Session Created'}
            </h3>
            <p>{isRTL ? 'מזהה שיחה:' : 'Session ID:'} {data.sessionId}</p>
          </div>
        );
      
      case 'chat-history':
        return (
          <GenericViewer 
            title={isRTL ? '💬 היסטוריית שיחות' : '💬 Chat History'}
            data={data}
          />
        );
      
      // ========== USER MANAGEMENT ==========
      case 'user-view':
      case 'user':
        return (
          <GenericViewer 
            title={isRTL ? '👤 משתמש' : '👤 User'}
            data={data}
          />
        );
      
      case 'user-create':
        return (
          <div style={styles.successBox}>
            <h3 style={styles.heading}>
              {isRTL ? '✅ משתמש נוצר' : '✅ User Created'}
            </h3>
            <p>{data.email} - {data.role}</p>
          </div>
        );
      
      case 'user-role-update':
        return (
          <div style={styles.infoBox}>
            <h3 style={styles.heading}>
              {isRTL ? '🔐 תפקיד עודכן' : '🔐 Role Updated'}
            </h3>
            <p>{data.email}: {data.oldRole} → {data.newRole}</p>
          </div>
        );
      
      // ========== REPORTS ==========
      case 'report-patient':
      case 'report-practice':
      case 'report-compliance':
        return (
          <GenericViewer 
            title={isRTL ? '📊 דוח' : '📊 Report'}
            data={data}
            style={styles.infoBox}
          />
        );
      
      // ========== SYSTEM ==========
      case 'system-health':
        return (
          <div style={styles.section}>
            <h3 style={styles.heading}>{isRTL ? '⚙️ מצב המערכת' : '⚙️ System Health'}</h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div>Status: {data.status || 'Healthy'}</div>
              <div>Uptime: {data.uptime || 'N/A'}</div>
              <div>Memory: {data.memory || 'N/A'}</div>
              <div>CPU: {data.cpu || 'N/A'}</div>
            </div>
          </div>
        );
      
      case 'backup-create':
        return (
          <div style={styles.successBox}>
            <h3 style={styles.heading}>
              {isRTL ? '💾 גיבוי נוצר' : '💾 Backup Created'}
            </h3>
            <p>{data.backupId}</p>
          </div>
        );
      
      case 'audit-logs':
        return (
          <GenericViewer 
            title={isRTL ? '📝 יומני ביקורת' : '📝 Audit Logs'}
            data={data}
          />
        );
      
      // ========== PRACTICE ==========
      case 'practice-info':
        return (
          <GenericViewer 
            title={isRTL ? '🏥 פרטי מרפאה' : '🏥 Practice Information'}
            data={data}
          />
        );
      
      // ========== SUCCESS/ERROR STATES ==========
      case 'success':
        return (
          <div style={styles.successBox}>
            <h3 style={styles.heading}>✅ {isRTL ? 'הצלחה' : 'Success'}</h3>
            <p>{data.message || JSON.stringify(data)}</p>
          </div>
        );
      
      case 'error':
        return (
          <div style={styles.errorBox}>
            <h3 style={styles.heading}>❌ {isRTL ? 'שגיאה' : 'Error'}</h3>
            <p>{data.message || data.error || JSON.stringify(data)}</p>
          </div>
        );
      
      case 'warning':
        return (
          <div style={styles.warningBox}>
            <h3 style={styles.heading}>⚠️ {isRTL ? 'אזהרה' : 'Warning'}</h3>
            <p>{data.message || JSON.stringify(data)}</p>
          </div>
        );
      
      // ========== DEFAULT FALLBACK ==========
      default:
        return (
          <GenericViewer 
            title={`Context: ${type}`}
            data={data}
          />
        );
    }
  };
  
  return (
    <div style={styles.panel}>
      <div style={styles.content}>
        {renderContent()}
      </div>
    </div>
  );
});

ContextPanel.displayName = 'ContextPanel';

export default ContextPanel;