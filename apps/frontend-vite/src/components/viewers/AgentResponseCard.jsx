import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import './AgentResponseCard.css';

const AgentResponseCard = ({ response, actionTaken, actionResult, patient, language }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const isRTL = language === 'he';
  
  // Parse the response to detect structured content
  const parseResponse = (text) => {
    if (!text) return { sections: [] };
    
    const sections = [];
    const lines = text.split('\n');
    let currentSection = null;
    let currentContent = [];
    
    lines.forEach((line) => {
      // Check for bold headers (markdown style)
      if (line.startsWith('**') && line.endsWith('**')) {
        if (currentSection) {
          sections.push({
            title: currentSection,
            content: currentContent.join('\n').trim()
          });
        }
        currentSection = line.replace(/\*\*/g, '');
        currentContent = [];
      } else if (line.startsWith('## ') || line.startsWith('# ')) {
        if (currentSection) {
          sections.push({
            title: currentSection,
            content: currentContent.join('\n').trim()
          });
        }
        currentSection = line.replace(/^#+ /, '');
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    });
    
    // Add the last section
    if (currentSection || currentContent.length > 0) {
      sections.push({
        title: currentSection || (isRTL ? 'תשובה' : 'Response'),
        content: currentContent.join('\n').trim()
      });
    }
    
    return { sections };
  };
  
  const { sections } = parseResponse(response);
  
  // Get action icon based on the action taken
  const getActionIcon = () => {
    switch (actionTaken) {
      case 'searchPatients':
      case 'countPatients':
        return '👥';
      case 'getMedicalHistory':
        return '📋';
      case 'addPatient':
        return '➕';
      case 'updatePatient':
        return '✏️';
      case 'scheduleAppointment':
        return '📅';
      case 'getDocuments':
        return '📄';
      case 'addMedication':
        return '💊';
      case 'getLabResults':
        return '🔬';
      default:
        return '🤖';
    }
  };
  
  // Format content with proper styling
  const formatContent = (content) => {
    if (!content) return '';
    
    // Convert markdown-style formatting to HTML
    let formatted = content
      // Bold text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Bullet points
      .replace(/^- /gm, '• ')
      // Line breaks
      .replace(/\n/g, '<br/>');
    
    return formatted;
  };
  
  // Extract cost information if present
  const extractCost = (text) => {
    const costMatch = text.match(/💰.*?₪([\d.]+).*?(\d+)\s*טוקנים/);
    if (costMatch) {
      return {
        amount: costMatch[1],
        tokens: costMatch[2]
      };
    }
    return null;
  };
  
  const cost = extractCost(response);
  
  return (
    <div className={`agent-response-card ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <div className="agent-card-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="header-left">
          <span className="action-icon">{getActionIcon()}</span>
          <h3>{isRTL ? 'תשובת הסוכן' : 'Agent Response'}</h3>
          {actionTaken && (
            <span className="action-badge">{actionTaken}</span>
          )}
        </div>
        <div className="header-right">
          {cost && (
            <span className="cost-badge">
              ₪{cost.amount} ({cost.tokens} tokens)
            </span>
          )}
          <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
            ▼
          </span>
        </div>
      </div>
      
      {/* Content */}
      {isExpanded && (
        <div className="agent-card-content">
          {sections.length > 0 ? (
            sections.map((section, index) => (
              <div key={index} className="response-section">
                {section.title && (
                  <h4 className="section-title">{section.title}</h4>
                )}
                <div 
                  className="section-content"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatContent(section.content)) }}
                />
              </div>
            ))
          ) : (
            <div 
              className="simple-response"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatContent(response)) }}
            />
          )}
          
          {/* Action Result if available */}
          {actionResult && typeof actionResult === 'string' && (
            <div className="action-result">
              <h4>{isRTL ? 'תוצאה' : 'Result'}</h4>
              <div className="result-content">{actionResult}</div>
            </div>
          )}
          
          {/* Patient info if available */}
          {patient && (
            <div className="related-patient">
              <span className="patient-label">
                {isRTL ? 'מטופל:' : 'Patient:'}
              </span>
              <span className="patient-name">
                {patient.firstName} {patient.lastName}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentResponseCard;