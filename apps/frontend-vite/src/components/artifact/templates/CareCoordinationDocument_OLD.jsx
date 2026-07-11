import React, { useState, useMemo } from 'react';
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import CareCoordinationPDFTemplate from '../pdf-templates/CareCoordinationTemplate';
import SearchBar from '../components/SearchBar';
import './CareCoordinationDocument.css';

const CareCoordinationDocument = ({ document: templateData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSectionId, setCopiedSectionId] = useState(null);
  const [exportStatus, setExportStatus] = useState(null);

  // Data unwrapping - handle wrapped structure from backend
  const data = templateData?.documentData || templateData?.data || templateData;
  const careCoordination = data?.care_coordination || (Array.isArray(data) ? data : [data]);
  const coordinationArray = Array.isArray(careCoordination) ? careCoordination : [careCoordination];

  console.log('[CareCoordinationDocument] Received data:', { templateData, data, careCoordination, coordinationArray });

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Multi-word search with document-level filtering
  const filteredCoordination = useMemo(() => {
    if (!searchTerm.trim()) return coordinationArray;

    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);

    return coordinationArray.filter(coord => {
      const searchableText = [
        // Document-level identifiers
        formatDate(coord.referralDate),
        coord.referralDate,
        coord.transitionType,
        // Field labels for search (care_coordination-specific)
        'referral date', 'referral source', 'referral destination', 'referral reason',
        'transition type', 'care coordinator',
        'primary diagnoses', 'active medications', 'discharge medications',
        'follow-up appointments', 'pending tests',
        'functional status', 'mobility level', 'fall risk assessment', 'cognitive status',
        'medical equipment needs', 'home health services', 'caregiver information',
        'advance directives', 'insurance authorization',
        'social determinants', 'language barriers', 'cultural considerations',
        'patient education provided', 'readmission risk score',
        // Field values
        coord.referralSource,
        coord.referralDestination,
        coord.referralReason,
        coord.transitionType,
        coord.careCoordinator,
        coord.functionalStatus,
        coord.mobilityLevel,
        coord.fallRiskAssessment,
        coord.cognitiveStatus,
        coord.medicalEquipmentNeeds,
        coord.homeHealthServices,
        coord.caregiverInformation,
        coord.advanceDirectives,
        coord.insuranceAuthorization,
        coord.socialDeterminants,
        coord.languageBarriers,
        coord.culturalConsiderations,
        coord.readmissionRiskScore,
        // Arrays
        ...(coord.primaryDiagnoses || []),
        ...(coord.activeMedications || []),
        ...(coord.dischargeMedications || []),
        ...(coord.followUpAppointments || []).map(appt => typeof appt === 'string' ? appt : `${appt.specialty} ${appt.reason || ''} ${appt.timing || ''}`),
        ...(coord.pendingTests || []),
        ...(coord.patientEducationProvided || [])
      ].filter(Boolean).join(' ').toLowerCase();

      return searchWords.every(word => searchableText.includes(word));
    });
  }, [coordinationArray, searchTerm]);

  // Smart section filtering with document-level intelligence
  const shouldShowSection = (coord, sectionTitle, sectionContent) => {
    if (!searchTerm.trim()) return true;

    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);

    // Check document-level match (referralDate/transitionType)
    const documentLevelText = [
      formatDate(coord.referralDate),
      coord.referralDate,
      coord.transitionType
    ].filter(Boolean).join(' ').toLowerCase();

    const documentMatches = searchWords.every(word => documentLevelText.includes(word));

    // If search matches document date/type, show ALL sections
    if (documentMatches) return true;

    // Otherwise, filter at section level
    const titleLower = (sectionTitle || '').toLowerCase();
    const contentText = Array.isArray(sectionContent)
      ? sectionContent.filter(Boolean).join(' ').toLowerCase()
      : (sectionContent || '').toString().toLowerCase();

    const combinedText = `${titleLower} ${contentText}`;

    return searchWords.every(word => combinedText.includes(word));
  };

  // Highlight matching text (multi-word support - December 2025)
  const highlightText = (text) => {
    if (!text || !searchTerm.trim()) return text;

    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);
    let result = String(text);
    let parts = [result];

    // Highlight each search word
    searchWords.forEach((word) => {
      const newParts = [];
      parts.forEach((part) => {
        if (typeof part === 'string') {
          const lowerPart = part.toLowerCase();
          let lastIndex = 0;
          let index = lowerPart.indexOf(word);

          while (index !== -1) {
            if (index > lastIndex) {
              newParts.push(part.substring(lastIndex, index));
            }
            newParts.push(
              <mark key={`${word}-${index}-${Math.random()}`} style={{
                backgroundColor: '#fef08a',
                color: '#000',
                padding: '2px 4px',
                borderRadius: '3px',
                fontWeight: '600'
              }}>
                {part.substring(index, index + word.length)}
              </mark>
            );
            lastIndex = index + word.length;
            index = lowerPart.indexOf(word, lastIndex);
          }

          if (lastIndex < part.length) {
            newParts.push(part.substring(lastIndex));
          }
        } else {
          newParts.push(part);
        }
      });
      parts = newParts;
    });

    return parts;
  };

  // Copy to clipboard with modern API (December 2025)
  const copySection = async (text, sectionId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSectionId(sectionId);
      setTimeout(() => setCopiedSectionId(null), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.select();

      try {
        document.execCommand('copy');
        setCopiedSectionId(sectionId);
        setTimeout(() => setCopiedSectionId(null), 2000);
      } catch (fallbackErr) {
        console.error('Copy failed:', fallbackErr);
      }

      document.body.removeChild(textarea);
    }
  };

  // Copy all records
  const copyAll = () => {
    let text = '=== CARE COORDINATION ===\n\n';

    filteredCoordination.forEach((coord, idx) => {
      text += `Care Coordination ${idx + 1}\n`;
      text += '─'.repeat(50) + '\n\n';

      // Referral Information
      if (coord.referralDate || coord.referralSource || coord.referralDestination || coord.referralReason) {
        text += 'REFERRAL INFORMATION\n';
        if (coord.referralDate) text += `  Referral Date: ${formatDate(coord.referralDate)}\n`;
        if (coord.referralSource) text += `  Referral Source: ${coord.referralSource}\n`;
        if (coord.referralDestination) text += `  Referral Destination: ${coord.referralDestination}\n`;
        if (coord.referralReason) text += `  Referral Reason: ${coord.referralReason}\n`;
        text += '\n';
      }

      // Transition Information
      if (coord.transitionType || coord.careCoordinator) {
        text += 'TRANSITION INFORMATION\n';
        if (coord.transitionType) text += `  Transition Type: ${coord.transitionType}\n`;
        if (coord.careCoordinator) text += `  Care Coordinator: ${coord.careCoordinator}\n`;
        text += '\n';
      }

      // Clinical Information
      if (coord.primaryDiagnoses && coord.primaryDiagnoses.length > 0) {
        text += 'PRIMARY DIAGNOSES\n';
        coord.primaryDiagnoses.forEach((dx, i) => {
          text += `  ${i + 1}. ${dx}\n`;
        });
        text += '\n';
      }

      if (coord.activeMedications && coord.activeMedications.length > 0) {
        text += 'ACTIVE MEDICATIONS\n';
        coord.activeMedications.forEach((med, i) => {
          text += `  ${i + 1}. ${med}\n`;
        });
        text += '\n';
      }

      if (coord.dischargeMedications && coord.dischargeMedications.length > 0) {
        text += 'DISCHARGE MEDICATIONS\n';
        coord.dischargeMedications.forEach((med, i) => {
          text += `  ${i + 1}. ${med}\n`;
        });
        text += '\n';
      }

      // Follow-Up & Pending Tests
      if (coord.followUpAppointments && coord.followUpAppointments.length > 0) {
        text += 'FOLLOW-UP APPOINTMENTS\n';
        coord.followUpAppointments.forEach((appt, i) => {
          if (typeof appt === 'string') {
            text += `  ${i + 1}. ${appt}\n`;
          } else {
            text += `  ${i + 1}. ${appt.specialty || 'Appointment'}`;
            if (appt.reason) text += ` - ${appt.reason}`;
            if (appt.timing) text += ` (${appt.timing})`;
            text += '\n';
          }
        });
        text += '\n';
      }

      if (coord.pendingTests && coord.pendingTests.length > 0) {
        text += 'PENDING TESTS\n';
        coord.pendingTests.forEach((test, i) => {
          text += `  ${i + 1}. ${test}\n`;
        });
        text += '\n';
      }

      // Functional Status & Care Needs
      if (coord.functionalStatus || coord.mobilityLevel || coord.fallRiskAssessment || coord.cognitiveStatus) {
        text += 'FUNCTIONAL STATUS & ASSESSMENT\n';
        if (coord.functionalStatus) text += `  Functional Status: ${coord.functionalStatus}\n`;
        if (coord.mobilityLevel) text += `  Mobility Level: ${coord.mobilityLevel}\n`;
        if (coord.fallRiskAssessment) text += `  Fall Risk Assessment: ${coord.fallRiskAssessment}\n`;
        if (coord.cognitiveStatus) text += `  Cognitive Status: ${coord.cognitiveStatus}\n`;
        text += '\n';
      }

      // Care Planning & Resources
      if (coord.medicalEquipmentNeeds || coord.homeHealthServices || coord.caregiverInformation) {
        text += 'CARE PLANNING & RESOURCES\n';
        if (coord.medicalEquipmentNeeds) text += `  Medical Equipment Needs: ${coord.medicalEquipmentNeeds}\n`;
        if (coord.homeHealthServices) text += `  Home Health Services: ${coord.homeHealthServices}\n`;
        if (coord.caregiverInformation) text += `  Caregiver Information: ${coord.caregiverInformation}\n`;
        text += '\n';
      }

      // Advanced Care Planning & Administrative
      if (coord.advanceDirectives || coord.insuranceAuthorization) {
        text += 'ADVANCED CARE PLANNING & ADMINISTRATIVE\n';
        if (coord.advanceDirectives) text += `  Advance Directives: ${coord.advanceDirectives}\n`;
        if (coord.insuranceAuthorization) text += `  Insurance Authorization: ${coord.insuranceAuthorization}\n`;
        text += '\n';
      }

      // Social & Cultural Considerations
      if (coord.socialDeterminants || coord.languageBarriers || coord.culturalConsiderations) {
        text += 'SOCIAL & CULTURAL CONSIDERATIONS\n';
        if (coord.socialDeterminants) text += `  Social Determinants: ${coord.socialDeterminants}\n`;
        if (coord.languageBarriers) text += `  Language Barriers: ${coord.languageBarriers}\n`;
        if (coord.culturalConsiderations) text += `  Cultural Considerations: ${coord.culturalConsiderations}\n`;
        text += '\n';
      }

      // Education & Risk Assessment
      if (coord.patientEducationProvided && coord.patientEducationProvided.length > 0) {
        text += 'PATIENT EDUCATION PROVIDED\n';
        coord.patientEducationProvided.forEach((ed, i) => {
          text += `  ${i + 1}. ${ed}\n`;
        });
        text += '\n';
      }

      if (coord.readmissionRiskScore) {
        text += 'READMISSION RISK SCORE\n';
        text += `  ${coord.readmissionRiskScore}\n\n`;
      }

      text += '='.repeat(80) + '\n\n';
    });

    copySection(text, 'all');
  };

  // Export to PDF
  const exportToPDF = async () => {
    try {
      setExportStatus('generating');
      const blob = await pdf(<CareCoordinationPDFTemplate document={filteredCoordination} />).toBlob();
      saveAs(blob, `care-coordination-${new Date().toISOString().split('T')[0]}.pdf`);
      setExportStatus('success');
      setTimeout(() => setExportStatus(null), 3000);
    } catch (error) {
      console.error('PDF generation error:', error);
      setExportStatus('error');
      setTimeout(() => setExportStatus(null), 3000);
    }
  };

  // Early return check uses ORIGINAL data array (NOT filtered)
  if (!coordinationArray || coordinationArray.length === 0) {
    return (
      <div className="care-coordination-document">
        <div className="empty-state">No care coordination records found.</div>
      </div>
    );
  }

  return (
    <div className="care-coordination-document">
      {/* Header with title, search, and action buttons */}
      <div className="document-header">
        <h2 className="document-title">{highlightText('Care Coordination')}</h2>
        <div className="header-actions">
          <button
            className={`copy-all-btn ${copiedSectionId === 'all' ? 'copied' : ''}`}
            onClick={copyAll}
          >
            {copiedSectionId === 'all' ? 'Copied!' : 'Copy All'}
          </button>
          <button
            className={`export-pdf-btn ${exportStatus === 'success' ? 'success' : ''}`}
            onClick={exportToPDF}
            disabled={exportStatus === 'generating'}
          >
            {exportStatus === 'generating' ? 'Generating...' : exportStatus === 'success' ? 'Exported!' : 'Export to PDF'}
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="search-container">
        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          placeholder="Search care coordination records..."
          totalCount={coordinationArray.length}
          filteredCount={filteredCoordination.length}
        />
      </div>

      {/* Main content */}
      <div className="records-container">
        {filteredCoordination.length === 0 ? (
          <div className="no-data-message">
            {searchTerm ? 'No records match your search.' : 'No records available.'}
          </div>
        ) : (
          filteredCoordination.map((coord, coordIdx) => {
            const coordId = `coord-${coordIdx}`;

            return (
              <div key={coordId} className="coordination-card">
                {/* Card header with date and type */}
                <div className="card-header">
                  <div className="card-title-row">
                    <span className="card-number">{highlightText(`Care Coordination ${coordIdx + 1}`)}</span>
                    {coord.date && (
                      <span className="card-date">{highlightText(formatDate(coord.date))}</span>
                    )}
                  </div>
                  {coord.type && (
                    <div className="card-type">{highlightText(coord.type)}</div>
                  )}
                </div>

                {/* General Information Section */}
                {(coord.provider || coord.facility) && shouldShowSection(coord, 'Care Team', `${coord.provider} ${coord.facility}`) && (
                  <div className="field-container">
                    <div className="field-header">
                      <span className="field-title">{highlightText('Care Team')}</span>
                    </div>
                    <div className="numbered-rows-wrapper">
                      {coord.provider && (
                        <div className="numbered-row">
                          <div className="numbered-row-content">
                            <span className="field-label">{highlightText('Provider:')}</span> {highlightText(coord.provider)}
                          </div>
                          <button className={`copy-btn ${copiedSectionId === `${coordId}-provider` ? 'copied' : ''}`}
                                  onClick={() => copySection(`Provider: ${coord.provider}`, `${coordId}-provider`)}>
                            {copiedSectionId === `${coordId}-provider` ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      )}
                      {coord.facility && (
                        <div className="numbered-row">
                          <div className="numbered-row-content">
                            <span className="field-label">{highlightText('Facility:')}</span> {highlightText(coord.facility)}
                          </div>
                          <button className={`copy-btn ${copiedSectionId === `${coordId}-facility` ? 'copied' : ''}`}
                                  onClick={() => copySection(`Facility: ${coord.facility}`, `${coordId}-facility`)}>
                            {copiedSectionId === `${coordId}-facility` ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Findings Section */}
                {coord.findings && shouldShowSection(coord, 'Findings', coord.findings) && (
                  <div className="field-container">
                    <div className="field-header">
                      <span className="field-title">{highlightText('Findings')}</span>
                      <button className={`copy-btn ${copiedSectionId === `${coordId}-findings` ? 'copied' : ''}`}
                              onClick={() => copySection(coord.findings, `${coordId}-findings`)}>
                        {copiedSectionId === `${coordId}-findings` ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="field-content">{highlightText(coord.findings)}</div>
                  </div>
                )}

                {/* Assessment Section */}
                {coord.assessment && shouldShowSection(coord, 'Assessment', coord.assessment) && (
                  <div className="field-container">
                    <div className="field-header">
                      <span className="field-title">{highlightText('Assessment')}</span>
                      <button className={`copy-btn ${copiedSectionId === `${coordId}-assessment` ? 'copied' : ''}`}
                              onClick={() => copySection(coord.assessment, `${coordId}-assessment`)}>
                        {copiedSectionId === `${coordId}-assessment` ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="field-content">{highlightText(coord.assessment)}</div>
                  </div>
                )}

                {/* Plan Section */}
                {coord.plan && shouldShowSection(coord, 'Plan', coord.plan) && (
                  <div className="field-container">
                    <div className="field-header">
                      <span className="field-title">{highlightText('Plan')}</span>
                      <button className={`copy-btn ${copiedSectionId === `${coordId}-plan` ? 'copied' : ''}`}
                              onClick={() => copySection(coord.plan, `${coordId}-plan`)}>
                        {copiedSectionId === `${coordId}-plan` ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="field-content">{highlightText(coord.plan)}</div>
                  </div>
                )}

                {/* Recommendations Section */}
                {coord.recommendations && coord.recommendations.length > 0 && shouldShowSection(coord, 'Recommendations', coord.recommendations.join(' ')) && (
                  <div className="field-container">
                    <div className="field-header">
                      <span className="field-title">{highlightText('Recommendations')}</span>
                    </div>
                    <div className="numbered-rows-wrapper">
                      {coord.recommendations.map((rec, recIdx) => (
                        <div key={recIdx} className="numbered-row">
                          <div className="numbered-row-content">
                            {highlightText(rec)}
                          </div>
                          <button className={`copy-btn ${copiedSectionId === `${coordId}-rec-${recIdx}` ? 'copied' : ''}`}
                                  onClick={() => copySection(rec, `${coordId}-rec-${recIdx}`)}>
                            {copiedSectionId === `${coordId}-rec-${recIdx}` ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Results Section */}
                {coord.results && shouldShowSection(coord, 'Results', coord.results) && (
                  <div className="field-container">
                    <div className="field-header">
                      <span className="field-title">{highlightText('Results')}</span>
                      <button className={`copy-btn ${copiedSectionId === `${coordId}-results` ? 'copied' : ''}`}
                              onClick={() => copySection(coord.results, `${coordId}-results`)}>
                        {copiedSectionId === `${coordId}-results` ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="field-content">{highlightText(coord.results)}</div>
                  </div>
                )}

                {/* Status Section */}
                {coord.status && shouldShowSection(coord, 'Status', coord.status) && (
                  <div className="field-container">
                    <div className="field-header">
                      <span className="field-title">{highlightText('Status')}</span>
                      <button className={`copy-btn ${copiedSectionId === `${coordId}-status` ? 'copied' : ''}`}
                              onClick={() => copySection(coord.status, `${coordId}-status`)}>
                        {copiedSectionId === `${coordId}-status` ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="field-content">{highlightText(coord.status)}</div>
                  </div>
                )}

                {/* Notes Section */}
                {coord.notes && shouldShowSection(coord, 'Notes', coord.notes) && (
                  <div className="field-container">
                    <div className="field-header">
                      <span className="field-title">{highlightText('Notes')}</span>
                      <button className={`copy-btn ${copiedSectionId === `${coordId}-notes` ? 'copied' : ''}`}
                              onClick={() => copySection(coord.notes, `${coordId}-notes`)}>
                        {copiedSectionId === `${coordId}-notes` ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="field-content">{highlightText(coord.notes)}</div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CareCoordinationDocument;
