import React, { useState } from 'react';

const MedicalDataGrid = ({ data, language = 'en' }) => {
  const [expandedSections, setExpandedSections] = useState({
    demographics: true,
    chiefComplaint: true,
    diagnoses: true,
    medications: true,
    labResults: true,
    procedures: true,
    imaging: true,
    physicalExam: true,
    assessment: true,
    followUp: true
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const isRTL = language === 'he';

  const containerStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '20px',
    padding: '20px',
    direction: isRTL ? 'rtl' : 'ltr',
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderRadius: '12px',
    marginTop: '20px',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  };

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderRadius: '8px',
    padding: '16px',
    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
    border: '1px solid rgba(255, 255, 255, 0.2)'
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '6px',
    background: 'rgba(167, 139, 250, 0.15)',
    transition: 'background-color 0.2s'
  };

  const titleStyle = {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const contentStyle = {
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#ffffff'
  };

  const listStyle = {
    margin: '8px 0',
    paddingLeft: isRTL ? '0' : '20px',
    paddingRight: isRTL ? '20px' : '0'
  };

  const listItemStyle = {
    marginBottom: '8px',
    padding: '8px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '4px',
    borderLeft: !isRTL ? '3px solid #4CAF50' : 'none',
    borderRight: isRTL ? '3px solid #4CAF50' : 'none'
  };

  const labResultStyle = {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 2fr',
    gap: '8px',
    padding: '8px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '4px',
    marginBottom: '6px',
    fontSize: '13px'
  };

  const normalRangeStyle = (value, range) => {
    // Simple check if value is within range
    const numValue = parseFloat(value);
    if (range && range.includes('-')) {
      const [min, max] = range.split('-').map(v => parseFloat(v));
      if (numValue < min || numValue > max) {
        return { color: '#d32f2f', fontWeight: 'bold' };
      }
    }
    return { color: '#388e3c' };
  };

  // Parse the data from the message
  const parseData = () => {
    if (!data) return null;

    // Check if data is already an object (from database)
    if (typeof data === 'object' && !Array.isArray(data)) {
      // Handle structured data object
      const sections = {
        demographics: {},
        chiefComplaint: data.chiefComplaint || '',
        historyOfPresentIllness: data.historyOfPresentIllness || '',
        diagnoses: [],
        medications: [],
        labResults: [],
        procedures: [],
        imaging: [],
        physicalExam: {},
        vitalSigns: {},
        medicalHistory: {},
        assessment: data.assessmentAndPlan || data.assessment || '',
        recommendations: data.recommendations || '',
        followUp: []
      };

      // Process demographics
      if (data.patientName || data.demographics?.name) {
        sections.demographics.name = data.patientName || data.demographics.name;
      }
      if (data.dateOfBirth || data.demographics?.dob) {
        sections.demographics.dob = data.dateOfBirth || data.demographics.dob;
      }
      if (data.patientId || data.demographics?.id) {
        sections.demographics.id = data.patientId || data.demographics.id;
      }
      if (data.date || data.demographics?.dischargeDate) {
        sections.demographics.dischargeDate = data.date || data.demographics.dischargeDate;
      }

      // Process diagnoses
      if (data.diagnoses && Array.isArray(data.diagnoses)) {
        sections.diagnoses = data.diagnoses;
      }

      // Process medications
      if (data.medications && Array.isArray(data.medications)) {
        sections.medications = data.medications.map(med => {
          if (typeof med === 'object') {
            return `${med.name} - ${med.dosage} ${med.frequency} (${med.route})`;
          }
          return med;
        });
      }

      // Process lab results
      if (data.tests && Array.isArray(data.tests)) {
        sections.labResults = data.tests.map(test => {
          return `${test.name}: ${test.result} ${test.unit} (Ref: ${test.referenceRange})`;
        });
      } else if (data.labResults && Array.isArray(data.labResults)) {
        sections.labResults = data.labResults.map(result => {
          if (typeof result === 'object') {
            return `${result.name}: ${result.result} ${result.unit} (Ref: ${result.referenceRange})`;
          }
          return result;
        });
      }

      // Process procedures
      if (data.procedures && Array.isArray(data.procedures)) {
        sections.procedures = data.procedures.map(proc => {
          if (typeof proc === 'object') {
            return `${proc.name}${proc.date ? ` (${proc.date})` : ''}${proc.notes ? ` - ${proc.notes}` : ''}`;
          }
          return proc;
        });
      }

      // Process imaging
      if (data.imaging && Array.isArray(data.imaging)) {
        sections.imaging = data.imaging.map(img => {
          if (typeof img === 'object') {
            return `${img.type}${img.date ? ` (${img.date})` : ''}: ${img.findings}`;
          }
          return img;
        });
      }

      // Process physical examination
      if (data.physicalExamination && typeof data.physicalExamination === 'object') {
        sections.physicalExam = data.physicalExamination;
      }

      // Process vital signs
      if (data.vitalSigns && typeof data.vitalSigns === 'object') {
        sections.vitalSigns = data.vitalSigns;
      }

      // Process medical history
      if (data.medicalHistory && typeof data.medicalHistory === 'object') {
        sections.medicalHistory = data.medicalHistory;
      }

      // Process follow-up appointments
      if (data.followUpAppointments && Array.isArray(data.followUpAppointments)) {
        sections.followUp = data.followUpAppointments.map(apt => {
          if (typeof apt === 'object') {
            return `${apt.provider} - ${apt.timing}: ${apt.reason}`;
          }
          return apt;
        });
      }

      return sections;
    }

    // Handle text data (original parsing logic)
    const sections = {
      demographics: {},
      chiefComplaint: '',
      historyOfPresentIllness: '',
      diagnoses: [],
      medications: [],
      labResults: [],
      procedures: [],
      imaging: [],
      physicalExam: {},
      vitalSigns: {},
      medicalHistory: {},
      assessment: '',
      recommendations: '',
      followUp: []
    };

    // Parse the text content
    const lines = data.split('\n');
    let currentSection = '';

    lines.forEach(line => {
      const trimmedLine = line.trim();

      // Demographics
      if (trimmedLine.includes('Name:')) {
        sections.demographics.name = trimmedLine.split('Name:')[1]?.trim();
      } else if (trimmedLine.includes('Date of Birth:')) {
        sections.demographics.dob = trimmedLine.split('Date of Birth:')[1]?.trim();
      } else if (trimmedLine.includes('Patient ID:')) {
        sections.demographics.id = trimmedLine.split('Patient ID:')[1]?.trim();
      } else if (trimmedLine.includes('Discharge Date:')) {
        sections.demographics.dischargeDate = trimmedLine.split('Discharge Date:')[1]?.trim();
      }

      // Chief Complaint
      else if (trimmedLine.includes('CHIEF COMPLAINT:')) {
        currentSection = 'chiefComplaint';
      } else if (currentSection === 'chiefComplaint' && trimmedLine && !trimmedLine.includes(':')) {
        sections.chiefComplaint = trimmedLine;
        currentSection = '';
      }

      // History of Present Illness
      else if (trimmedLine.includes('HISTORY OF PRESENT ILLNESS:')) {
        currentSection = 'history';
      } else if (currentSection === 'history' && trimmedLine && !trimmedLine.includes(':')) {
        sections.historyOfPresentIllness = trimmedLine;
        currentSection = '';
      }

      // Diagnoses
      else if (trimmedLine.includes('DIAGNOSES:')) {
        currentSection = 'diagnoses';
      } else if (currentSection === 'diagnoses' && trimmedLine && !trimmedLine.includes(':')) {
        sections.diagnoses.push(trimmedLine);
      }

      // Medications
      else if (trimmedLine.includes('MEDICATIONS')) {
        currentSection = 'medications';
      } else if (currentSection === 'medications' && trimmedLine.match(/^\d+\./)) {
        sections.medications.push(trimmedLine);
      }

      // Lab Results
      else if (trimmedLine.includes('LAB RESULTS')) {
        currentSection = 'labs';
      } else if (currentSection === 'labs' && trimmedLine && trimmedLine.includes(':')) {
        sections.labResults.push(trimmedLine);
      }

      // Procedures
      else if (trimmedLine.includes('PROCEDURES:')) {
        currentSection = 'procedures';
      } else if (currentSection === 'procedures' && trimmedLine && !trimmedLine.includes('IMAGING:')) {
        sections.procedures.push(trimmedLine);
      }

      // Imaging
      else if (trimmedLine.includes('IMAGING:')) {
        currentSection = 'imaging';
      } else if (currentSection === 'imaging' && trimmedLine.includes('Chest X-ray')) {
        sections.imaging.push(trimmedLine);
      }

      // Physical Examination
      else if (trimmedLine.includes('PHYSICAL EXAMINATION:')) {
        currentSection = 'physical';
      } else if (currentSection === 'physical' && trimmedLine.includes(':')) {
        const [key, value] = trimmedLine.split(':');
        if (key && value) {
          sections.physicalExam[key.trim()] = value.trim();
        }
      }

      // Assessment and Plan
      else if (trimmedLine.includes('ASSESSMENT AND PLAN:')) {
        currentSection = 'assessment';
      } else if (currentSection === 'assessment' && trimmedLine && !trimmedLine.includes('RECOMMENDATIONS:')) {
        sections.assessment = trimmedLine;
        currentSection = '';
      }

      // Recommendations
      else if (trimmedLine.includes('RECOMMENDATIONS:')) {
        currentSection = 'recommendations';
      } else if (currentSection === 'recommendations' && trimmedLine && !trimmedLine.includes('FOLLOW-UP')) {
        sections.recommendations = trimmedLine;
        currentSection = '';
      }

      // Follow-up
      else if (trimmedLine.includes('FOLLOW-UP APPOINTMENTS:')) {
        currentSection = 'followup';
      } else if (currentSection === 'followup' && trimmedLine.match(/^\d+\./)) {
        sections.followUp.push(trimmedLine);
      }
    });

    return sections;
  };

  const parsedData = parseData();
  if (!parsedData) return null;

  return (
    <div style={containerStyle}>
      {/* Patient Demographics Card */}
      {parsedData.demographics.name && (
        <div style={cardStyle}>
          <div style={headerStyle} onClick={() => toggleSection('demographics')}>
            <div style={titleStyle}>
              <span>👤</span>
              <span>{language === 'he' ? 'פרטי המטופל' : 'Patient Demographics'}</span>
            </div>
            <span>{expandedSections.demographics ? '▼' : '▶'}</span>
          </div>
          {expandedSections.demographics && (
            <div style={contentStyle}>
              <div><strong>Name:</strong> {parsedData.demographics.name}</div>
              <div><strong>DOB:</strong> {parsedData.demographics.dob}</div>
              <div><strong>ID:</strong> {parsedData.demographics.id}</div>
              <div><strong>Discharge:</strong> {parsedData.demographics.dischargeDate}</div>
            </div>
          )}
        </div>
      )}

      {/* Chief Complaint Card */}
      {parsedData.chiefComplaint && (
        <div style={cardStyle}>
          <div style={headerStyle} onClick={() => toggleSection('chiefComplaint')}>
            <div style={titleStyle}>
              <span>🏥</span>
              <span>{language === 'he' ? 'תלונה עיקרית' : 'Chief Complaint'}</span>
            </div>
            <span>{expandedSections.chiefComplaint ? '▼' : '▶'}</span>
          </div>
          {expandedSections.chiefComplaint && (
            <div style={{...contentStyle, padding: '12px', background: 'rgba(255, 152, 0, 0.1)', borderRadius: '4px'}}>
              {parsedData.chiefComplaint}
            </div>
          )}
        </div>
      )}

      {/* Diagnoses Card */}
      {parsedData.diagnoses.length > 0 && (
        <div style={cardStyle}>
          <div style={headerStyle} onClick={() => toggleSection('diagnoses')}>
            <div style={titleStyle}>
              <span>📋</span>
              <span>{language === 'he' ? 'אבחנות' : 'Diagnoses'}</span>
            </div>
            <span>{expandedSections.diagnoses ? '▼' : '▶'}</span>
          </div>
          {expandedSections.diagnoses && (
            <ul style={listStyle}>
              {parsedData.diagnoses.map((diagnosis, idx) => (
                <li key={idx} style={listItemStyle}>
                  {diagnosis}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Medications Card */}
      {parsedData.medications.length > 0 && (
        <div style={cardStyle}>
          <div style={headerStyle} onClick={() => toggleSection('medications')}>
            <div style={titleStyle}>
              <span>💊</span>
              <span>{language === 'he' ? 'תרופות' : 'Medications'}</span>
            </div>
            <span>{expandedSections.medications ? '▼' : '▶'}</span>
          </div>
          {expandedSections.medications && (
            <div style={contentStyle}>
              {parsedData.medications.map((med, idx) => (
                <div key={idx} style={{...listItemStyle, borderLeft: !isRTL ? '3px solid #2196F3' : 'none', borderRight: isRTL ? '3px solid #2196F3' : 'none'}}>
                  {med}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lab Results Card */}
      {parsedData.labResults.length > 0 && (
        <div style={cardStyle}>
          <div style={headerStyle} onClick={() => toggleSection('labResults')}>
            <div style={titleStyle}>
              <span>🧪</span>
              <span>{language === 'he' ? 'תוצאות בדיקות' : 'Lab Results'}</span>
            </div>
            <span>{expandedSections.labResults ? '▼' : '▶'}</span>
          </div>
          {expandedSections.labResults && (
            <div style={contentStyle}>
              {parsedData.labResults.map((result, idx) => {
                const parts = result.split(/[:(]/);
                const name = parts[0]?.trim();
                const value = parts[1]?.split(' ')[0]?.trim();
                const unit = parts[1]?.match(/[a-zA-Z/%]+/)?.[0];
                const range = result.match(/\((.*?)\)/)?.[1]?.replace('Ref:', '').trim();

                return (
                  <div key={idx} style={labResultStyle}>
                    <strong>{name}</strong>
                    <span style={normalRangeStyle(value, range)}>{value}</span>
                    <span>{unit}</span>
                    <span style={{color: '#888', fontSize: '12px'}}>{range}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Procedures Card */}
      {parsedData.procedures.length > 0 && (
        <div style={cardStyle}>
          <div style={headerStyle} onClick={() => toggleSection('procedures')}>
            <div style={titleStyle}>
              <span>🔬</span>
              <span>{language === 'he' ? 'פרוצדורות' : 'Procedures'}</span>
            </div>
            <span>{expandedSections.procedures ? '▼' : '▶'}</span>
          </div>
          {expandedSections.procedures && (
            <ul style={listStyle}>
              {parsedData.procedures.map((procedure, idx) => (
                <li key={idx} style={{...listItemStyle, borderLeft: !isRTL ? '3px solid #9C27B0' : 'none', borderRight: isRTL ? '3px solid #9C27B0' : 'none'}}>
                  {procedure}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Imaging Card */}
      {parsedData.imaging.length > 0 && (
        <div style={cardStyle}>
          <div style={headerStyle} onClick={() => toggleSection('imaging')}>
            <div style={titleStyle}>
              <span>🔍</span>
              <span>{language === 'he' ? 'הדמיה' : 'Imaging'}</span>
            </div>
            <span>{expandedSections.imaging ? '▼' : '▶'}</span>
          </div>
          {expandedSections.imaging && (
            <div style={contentStyle}>
              {parsedData.imaging.map((img, idx) => (
                <div key={idx} style={{...listItemStyle, borderLeft: !isRTL ? '3px solid #FF9800' : 'none', borderRight: isRTL ? '3px solid #FF9800' : 'none'}}>
                  {img}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Physical Examination Card */}
      {Object.keys(parsedData.physicalExam).length > 0 && (
        <div style={cardStyle}>
          <div style={headerStyle} onClick={() => toggleSection('physicalExam')}>
            <div style={titleStyle}>
              <span>🩺</span>
              <span>{language === 'he' ? 'בדיקה גופנית' : 'Physical Examination'}</span>
            </div>
            <span>{expandedSections.physicalExam ? '▼' : '▶'}</span>
          </div>
          {expandedSections.physicalExam && (
            <div style={contentStyle}>
              {Object.entries(parsedData.physicalExam).map(([key, value], idx) => (
                <div key={idx} style={{marginBottom: '8px'}}>
                  <strong>{key}:</strong> {value}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assessment and Plan Card */}
      {parsedData.assessment && (
        <div style={{...cardStyle, gridColumn: 'span 2'}}>
          <div style={headerStyle} onClick={() => toggleSection('assessment')}>
            <div style={titleStyle}>
              <span>📝</span>
              <span>{language === 'he' ? 'הערכה ותוכנית' : 'Assessment and Plan'}</span>
            </div>
            <span>{expandedSections.assessment ? '▼' : '▶'}</span>
          </div>
          {expandedSections.assessment && (
            <div style={{...contentStyle, padding: '12px', background: 'rgba(76, 175, 80, 0.1)', borderRadius: '4px'}}>
              {parsedData.assessment}
              {parsedData.recommendations && (
                <div style={{marginTop: '12px'}}>
                  <strong>Recommendations:</strong> {parsedData.recommendations}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Follow-up Appointments Card */}
      {parsedData.followUp.length > 0 && (
        <div style={cardStyle}>
          <div style={headerStyle} onClick={() => toggleSection('followUp')}>
            <div style={titleStyle}>
              <span>📅</span>
              <span>{language === 'he' ? 'תורים למעקב' : 'Follow-up Appointments'}</span>
            </div>
            <span>{expandedSections.followUp ? '▼' : '▶'}</span>
          </div>
          {expandedSections.followUp && (
            <div style={contentStyle}>
              {parsedData.followUp.map((appointment, idx) => (
                <div key={idx} style={{...listItemStyle, borderLeft: !isRTL ? '3px solid #00BCD4' : 'none', borderRight: isRTL ? '3px solid #00BCD4' : 'none'}}>
                  {appointment}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MedicalDataGrid;