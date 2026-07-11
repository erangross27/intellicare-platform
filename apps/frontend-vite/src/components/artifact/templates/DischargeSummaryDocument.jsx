import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PDFDocumentTemplate from '../PDFDocumentTemplate';
import SearchBar from '../components/SearchBar';
import secureApiClient from '../../../services/secureApiClient';
import './DischargeSummaryDocument.css';

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc))\.\s+/)
    .map(s => s.replace(/\.$/, '').trim())
    .filter(Boolean);
};

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF/Copy All until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'discharge_summariesPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const DischargeSummaryDocument = ({ document: doc }) => {
  // Display state
  const [copiedSection, setCopiedSection] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Editing state (8 vars + ref)
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [statusOverrides, setStatusOverrides] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const textareaRef = useRef(null);
  // Tracks whether the active record uses the legacy nested (hospitalCourse[0])
  // shape, so the save handler writes to the correct DB path. Updated below
  // once the shape is detected; read inside the stable save callback.
  const isNestedRef = useRef(false);

  // --- Data unwrapping (preserve existing logic) ---
  const data = doc?.documentData || doc?.data || doc;
  const dischargeSummaries = data?.discharge_summaries || (Array.isArray(data) ? data : data ? [data] : []);
  let actualDoc = dischargeSummaries[0] || data;

  // Detect the legacy "nested" shape where the real fields live inside
  // hospitalCourse[0] (an array-of-objects) rather than at the top level.
  // This determines the DB write path: nested edits must target
  // `hospitalCourse.0.<field>` while flat edits target `<field>` directly.
  const isNested = !!(actualDoc && Array.isArray(actualDoc?.hospitalCourse) && actualDoc.hospitalCourse[0]);

  if (isNested) {
    const nested = actualDoc.hospitalCourse[0];
    actualDoc = {
      ...actualDoc,
      mrn: nested.mrn || actualDoc.mrn,
      admissionDate: nested.admissionDate || actualDoc.admissionDate,
      dischargeDate: nested.dischargeDate || actualDoc.dischargeDate,
      lengthOfStay: nested.lengthOfStay || actualDoc.lengthOfStay,
      admittingDiagnosis: nested.admittingDiagnosis || actualDoc.admittingDiagnosis,
      principalDiagnosis: nested.principalDiagnosis || actualDoc.principalDiagnosis,
      secondaryDiagnoses: nested.secondaryDiagnoses || actualDoc.secondaryDiagnoses,
      hospitalCourse: nested.hospitalCourse || actualDoc.hospitalCourse,
      proceduresPerformed: nested.proceduresPerformed || actualDoc.proceduresPerformed,
      dischargeMedications: nested.dischargeMedications || actualDoc.dischargeMedications,
      dischargeCondition: nested.dischargeCondition || actualDoc.dischargeCondition,
      dischargeDisposition: nested.dischargeDisposition || actualDoc.dischargeDisposition,
      dischargeInstructions: nested.dischargeInstructions || actualDoc.dischargeInstructions,
      attendingPhysician: nested.attendingPhysician || actualDoc.attendingPhysician,
      facility: nested.facility || actualDoc.facility,
      activityRestrictions: nested.activityRestrictions || actualDoc.activityRestrictions,
      dietRestrictions: nested.dietRestrictions || actualDoc.dietRestrictions,
      electronicSignature: nested.electronicSignature || actualDoc.electronicSignature,
      followUpAppointments: actualDoc.followUpAppointments || nested.followUpAppointments || [],
    };
  }
  // Expose the detected shape to the stable save callback (see handleSaveField).
  isNestedRef.current = isNested;

  // --- Editing handlers (unconditional hooks) ---
  // NOTE: the legacy persistToLocalStorage helper (wrote drafts into 'artifactGridData') was removed.
  // Drafts now live in a dedicated DRAFT_KEY store so they never leak into the PDF/DB source.

  const handleStartEdit = useCallback((fieldName, idx, currentValue, sentenceIdx = 0) => {
    const editKey = `${fieldName}-${idx}-s${sentenceIdx}`;
    setEditingField(editKey);
    setEditValue(currentValue || '');
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue('');
  }, []);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApprove commits).
  // The nested-vs-flat DB path decision is deferred to Approve; here we only store the raw fieldName.
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, arrayIndex, valueOverride, sentenceIdx) => {
    if (!record._id) return;
    const recordId = record._id;
    const saveValue = (valueOverride !== undefined ? valueOverride : editValue.trim());

    const fieldPart = (typeof arrayIndex === 'number') ? `${fieldName}.${arrayIndex}` : fieldName;
    const editKey = `${fieldPart}-${idx}`;
    const sKey = `${fieldName}-${idx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;

    setLocalEdits(prev => ({ ...prev, [editKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));
    // Re-edit after approval → drop the section 'approved' flag so the button returns to yellow Approve
    setApprovedSections(prev => {
      if (!prev[sectionId]) return prev;
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });

    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldPart] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this record to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF/Copy All. This is the ONLY path that writes to the database.
  const handleApprove = useCallback(async (record, idx, sectionId) => {
    if (!record._id) return;
    const recordId = record._id;
    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements).
      // Reverse handleSaveField's fieldPart: a trailing ".<n>" (purely numeric) is an arrayIndex;
      // dotted-but-non-numeric segments (none here) would stay part of the field name.
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const dotIdx = fieldPart.lastIndexOf('.');
        const tail = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const hasArrayIndex = dotIdx !== -1 && /^\d+$/.test(tail);
        const baseField = hasArrayIndex ? fieldPart.slice(0, dotIdx) : fieldPart;
        // Honor the legacy nested shape: nested edits target hospitalCourse.0.<field>
        const dbFieldName = isNestedRef.current ? `hospitalCourse.0.${baseField}` : baseField;
        const payload = { field: dbFieldName, value: localEdits[editKey] };
        if (hasArrayIndex) payload.arrayIndex = parseInt(tail, 10);
        const resp = await secureApiClient.put(`/api/edit/discharge_summaries/${recordId}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/discharge_summaries/${recordId}/approve`);

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[recordId]) { delete store[recordId]; writeDrafts(store); }

      setStatusOverrides(prev => ({ ...prev, [idx]: 'approved' }));
      setApprovedSections(prev => ({ ...prev, [sectionId]: true }));
      setEditedFields({});
      setEditedSentences({});
    } catch (err) {
      console.error('[DischargeSummary] Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // --- pdfData memo ---
  const pdfData = useMemo(() => {
    if (!actualDoc) return null;
    if (Object.keys(localEdits).length === 0) return actualDoc;
    const merged = { ...actualDoc };
    for (const [editKey, editVal] of Object.entries(localEdits)) {
      if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF/Copy All until approved
      const dashIdx = editKey.lastIndexOf('-');
      const fieldName = editKey.substring(0, dashIdx);
      const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
      if (recIdx === 0) {
        if (fieldName.includes('.')) {
          const [arrField, arrIdxStr] = fieldName.split('.');
          const arrIdx = parseInt(arrIdxStr, 10);
          if (Array.isArray(merged[arrField])) {
            merged[arrField] = [...merged[arrField]];
            merged[arrField][arrIdx] = editVal;
          }
        } else {
          merged[fieldName] = editVal;
        }
      }
    }
    // Pre-compute hospitalCourse sentences
    const hcSource = localEdits['hospitalCourse-0'] !== undefined ? localEdits['hospitalCourse-0'] : (merged.hospitalCourse || '');
    if (hcSource) {
      merged._hospitalCourseSentences = splitBySentence(hcSource);
    }
    return merged;
  }, [actualDoc, localEdits, pendingEdits]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  // This is a single-record template: the render index is always 0.
  const rehydrateId = actualDoc?._id;
  useEffect(() => {
    if (!rehydrateId) return;
    const store = readDrafts();
    const recDrafts = store && store[rehydrateId];
    if (!recDrafts || Object.keys(recDrafts).length === 0) return;
    // Reverse field → sectionId map (mirrors SECTION_FIELDS defined below for the approve buttons)
    const FIELD_SECTION = {
      attendingPhysician: 'admin', facility: 'admin', dischargeDisposition: 'admin', dischargeCondition: 'admin',
      admittingDiagnosis: 'diagnoses', principalDiagnosis: 'diagnoses', secondaryDiagnoses: 'diagnoses',
      hospitalCourse: 'hospital-course',
      dischargeInstructions: 'instructions',
      activityRestrictions: 'restrictions', dietRestrictions: 'restrictions',
      electronicSignature: 'signature',
    };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    Object.entries(recDrafts).forEach(([fieldPart, value]) => {
      const editKey = `${fieldPart}-0`;
      nLocal[editKey] = value;
      nPending[editKey] = true;
      const dotIdx = fieldPart.lastIndexOf('.');
      const tail = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
      const baseField = (dotIdx !== -1 && /^\d+$/.test(tail)) ? fieldPart.slice(0, dotIdx) : fieldPart;
      const sectionId = FIELD_SECTION[baseField];
      if (sectionId) nFields[`${sectionId}-0`] = true;
      nSentences[`${fieldPart}-0-s0`] = 'edited';
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
    setStatusOverrides(prev => ({ 0: 'amended', ...prev }));
  }, [rehydrateId]);

  // --- Early return ---
  if (!doc || !actualDoc) {
    return (
      <div className="discharge-summary-document">
        <div className="empty-state">
          <p className="empty-text">No discharge summary data available</p>
        </div>
      </div>
    );
  }

  // --- Constants ---
  const idx = 0;
  const canEdit = !!actualDoc._id;
  const docForPdf = pdfData || actualDoc;

  // Per-section field mapping for scoped approve buttons
  const SECTION_FIELDS = {
    admin: ['attendingPhysician', 'facility', 'dischargeDisposition', 'dischargeCondition'],
    diagnoses: ['admittingDiagnosis', 'principalDiagnosis', 'secondaryDiagnoses'],
    'hospital-course': ['hospitalCourse'],
    instructions: ['dischargeInstructions'],
    restrictions: ['activityRestrictions', 'dietRestrictions'],
    signature: ['electronicSignature'],
  };

  const sectionHasEdits = (sectionId) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    return Object.keys(localEdits).some(editKey => {
      // editKey format: "fieldName-idx" or "fieldName.arrayIdx-idx"
      const dashIdx = editKey.lastIndexOf('-');
      const fieldPart = editKey.substring(0, dashIdx);
      // fieldPart could be "electronicSignature" or "secondaryDiagnoses.0"
      const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
      return fields.includes(baseField);
    });
  };

  // --- Helper: getFieldValue ---
  const getFieldValue = (fieldName) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    return actualDoc[fieldName];
  };

  // --- Display helpers ---
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return dateString; }
  };

  const highlightText = (text) => {
    if (!searchTerm.trim() || !text) return text;
    const searchWords = searchTerm.trim().split(/\s+/);
    const regex = new RegExp(`(${searchWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const parts = String(text).split(regex);
    return parts.map((part, i) =>
      searchWords.some(word => part.toLowerCase() === word.toLowerCase())
        ? <mark key={i}>{part}</mark> : part
    );
  };

  const shouldShowRow = (...rowContent) => {
    if (!searchTerm.trim()) return true;
    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);
    const rowText = rowContent.filter(Boolean).map(item => String(item)).join(' ').toLowerCase();
    return searchWords.every(word => rowText.includes(word));
  };

  const shouldShowSection = (sectionTitle, sectionContent) => {
    if (!searchTerm.trim()) return true;
    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);
    const titleLower = sectionTitle.toLowerCase();
    if (searchWords.every(word => titleLower.includes(word))) return true;
    const contentText = Array.isArray(sectionContent)
      ? sectionContent.filter(Boolean).join(' ').toLowerCase()
      : (sectionContent || '').toString().toLowerCase();
    return searchWords.every(word => contentText.includes(word));
  };

  // --- Edit indicator SVG ---
  const editIndicator = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="edit-indicator">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );

  // --- renderEditableField helper ---
  const renderEditableField = (fieldName, label, sectionId, copyId) => {
    const displayValue = getFieldValue(fieldName) || '';
    if (!displayValue && !localEdits[`${fieldName}-${idx}`]) return null;
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const sKey = `${fieldName}-${idx}-s0`;
    const isEdited = editedSentences[sKey] === 'edited';

    if (!shouldShowRow(label, displayValue)) return null;

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {isEditing ? (
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <textarea
                ref={textareaRef}
                className="edit-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
              />
              <div className="edit-actions">
                <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                <button className="save-btn" onClick={() => handleSaveField(actualDoc, fieldName, idx, sectionId)} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
              <div className={`row-content${canEdit ? ' editable' : ''}`}
                onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue)}>
                <span className="content-value">{highlightText(String(displayValue))}</span>
                {canEdit && editIndicator}
              </div>
              <button
                className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`}
                onClick={() => copyToClipboard(`${label}\n${displayValue}`, copyId)}
              >
                {copiedSection === copyId ? 'Copied' : 'Copy'}
              </button>
            </div>
            {isEdited && <div className="modified-badge">Modified</div>}
          </>
        )}
      </div>
    );
  };

  // --- renderReadOnlyField helper ---
  const renderReadOnlyField = (label, value, copyId) => {
    if (!value) return null;
    if (!shouldShowRow(label, value)) return null;
    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className="numbered-row">
          <div className="row-content">
            <span className="content-value">{highlightText(String(value))}</span>
          </div>
          <button
            className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(`${label}\n${value}`, copyId)}
          >
            {copiedSection === copyId ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    );
  };

  // --- Copy helpers ---
  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSection(id);
      setTimeout(() => setCopiedSection(null), 3000);
    }).catch(err => console.error('Copy failed:', err));
  };

  const copyAll = () => {
    const d = docForPdf;
    let text = '=== DISCHARGE SUMMARY ===\n\n';

    if (d.mrn || d.admissionDate || d.dischargeDate || d.lengthOfStay || d.attendingPhysician || d.facility || d.dischargeDisposition || d.dischargeCondition) {
      text += 'ADMINISTRATIVE INFORMATION\n' + '\u2500'.repeat(50) + '\n';
      if (d.mrn) text += `MRN: ${d.mrn}\n`;
      if (d.admissionDate) text += `Admission Date: ${formatDate(d.admissionDate)}\n`;
      if (d.dischargeDate) text += `Discharge Date: ${formatDate(d.dischargeDate)}\n`;
      if (d.lengthOfStay) text += `Length of Stay: ${d.lengthOfStay}\n`;
      if (d.attendingPhysician) text += `Attending Physician: ${d.attendingPhysician}\n`;
      if (d.facility) text += `Facility: ${d.facility}\n`;
      if (d.dischargeDisposition) text += `Disposition: ${d.dischargeDisposition}\n`;
      if (d.dischargeCondition) text += `Condition: ${d.dischargeCondition}\n`;
      text += '\n';
    }

    if (d.admittingDiagnosis || d.principalDiagnosis || (d.secondaryDiagnoses && d.secondaryDiagnoses.length > 0)) {
      text += 'DIAGNOSES\n' + '\u2500'.repeat(50) + '\n';
      if (d.admittingDiagnosis) text += `Admitting Diagnosis: ${d.admittingDiagnosis}\n`;
      if (d.principalDiagnosis) text += `Principal Diagnosis: ${d.principalDiagnosis}\n`;
      if (d.secondaryDiagnoses && d.secondaryDiagnoses.length > 0) {
        text += 'Secondary Diagnoses:\n';
        d.secondaryDiagnoses.forEach((dx, i) => { text += `  ${i + 1}. ${dx}\n`; });
      }
      text += '\n';
    }

    const hcSentences = d._hospitalCourseSentences || splitBySentence(d.hospitalCourse);
    if (hcSentences && hcSentences.length > 0) {
      text += 'HOSPITAL COURSE\n' + '\u2500'.repeat(50) + '\n';
      hcSentences.forEach((s, i) => { text += `${i + 1}. ${s}\n`; });
      text += '\n';
    }

    if (d.proceduresPerformed && d.proceduresPerformed.length > 0) {
      text += 'PROCEDURES PERFORMED\n' + '\u2500'.repeat(50) + '\n';
      d.proceduresPerformed.forEach((proc, i) => {
        const isStr = typeof proc === 'string';
        text += `${i + 1}. ${isStr ? proc : proc.name}`;
        if (!isStr && proc.status) text += ` (${proc.status})`;
        text += '\n';
        if (!isStr && proc.findings) text += `   Findings: ${proc.findings}\n`;
        if (!isStr && proc.notes) text += `   Notes: ${proc.notes}\n`;
      });
      text += '\n';
    }

    if (d.dischargeMedications && d.dischargeMedications.length > 0) {
      text += 'DISCHARGE MEDICATIONS\n' + '\u2500'.repeat(50) + '\n';
      d.dischargeMedications.forEach((med, i) => {
        const isStr = typeof med === 'string';
        text += `${i + 1}. ${isStr ? med : med.name}`;
        if (!isStr && med.dosage) text += ` ${med.dosage}`;
        if (!isStr && med.frequency) text += ` ${med.frequency}`;
        if (!isStr && med.route) text += ` (${med.route})`;
        text += '\n';
      });
      text += '\n';
    }

    if (d.dischargeInstructions) {
      text += 'DISCHARGE INSTRUCTIONS\n' + '\u2500'.repeat(50) + '\n';
      text += `${d.dischargeInstructions}\n\n`;
    }

    if (d.activityRestrictions || d.dietRestrictions) {
      text += 'ACTIVITY & DIET\n' + '\u2500'.repeat(50) + '\n';
      if (d.activityRestrictions) text += `Activity Restrictions: ${d.activityRestrictions}\n`;
      if (d.dietRestrictions) text += `Diet: ${d.dietRestrictions}\n`;
      text += '\n';
    }

    if (d.followUpAppointments && d.followUpAppointments.length > 0) {
      text += 'FOLLOW-UP APPOINTMENTS\n' + '\u2500'.repeat(50) + '\n';
      d.followUpAppointments.forEach((appt, i) => {
        const isStr = typeof appt === 'string';
        text += `${i + 1}. ${isStr ? appt : appt.specialty}`;
        if (!isStr && appt.status) text += ` [${appt.status}]`;
        text += '\n';
        if (!isStr && appt.reason) text += `   Reason: ${appt.reason}\n`;
        if (!isStr && appt.appointmentDate) text += `   Date: ${formatDate(appt.appointmentDate)}\n`;
      });
      text += '\n';
    }

    if (d.electronicSignature) text += `\n${d.electronicSignature}`;

    copyToClipboard(text, 'all');
  };


  // --- RENDER ---
  return (
    <div className="discharge-summary-document">
      {/* Document Header */}
      <div className="document-header">
        <h2 className="document-title">Discharge Summary</h2>
      </div>

      {/* Header Actions */}
      <div className="header-actions">
        <button
          className={`action-btn ${copiedSection === 'all' ? 'copied' : ''}`}
          onClick={copyAll}
        >
          {copiedSection === 'all' ? 'Copied' : 'Copy All'}
        </button>
        <PDFDownloadLink
          document={
            <PDFDocumentTemplate
              category="discharge_summaries"
              categoryDisplay="Discharge Summary"
              documents={[{ ...docForPdf, category: 'discharge_summaries' }]}
              patientName={data?.patientName || actualDoc?.patientName || null}
            />
          }
          fileName={`Discharge_Summary_${new Date().toISOString().split('T')[0]}.pdf`}
          className="action-btn"
        >
          {({ loading }) => (loading ? 'Preparing PDF...' : 'Export PDF')}
        </PDFDownloadLink>
      </div>

      {/* Search Bar */}
      <SearchBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search discharge summary..."
      />

      {/* Administrative Information */}
      {(actualDoc.mrn || actualDoc.admissionDate || actualDoc.dischargeDate || actualDoc.lengthOfStay || actualDoc.attendingPhysician || actualDoc.facility || actualDoc.dischargeDisposition || actualDoc.dischargeCondition) &&
        shouldShowSection('Administrative Information', [
        actualDoc.mrn, formatDate(actualDoc.admissionDate), formatDate(actualDoc.dischargeDate),
        actualDoc.lengthOfStay, actualDoc.attendingPhysician, actualDoc.facility,
        actualDoc.dischargeDisposition, actualDoc.dischargeCondition,
      ].filter(Boolean).join(' ')) && (
        <div className="section">
          <div className="mini-cards-container">
            <div className="section-header">
              <h4 className="section-title">{highlightText('Administrative Information')}</h4>
              <div className="header-right-actions">
                <button
                  className={`copy-btn ${copiedSection === 'admin-section' ? 'copied' : ''}`}
                  onClick={() => {
                    const fields = [];
                    if (actualDoc.mrn) fields.push(`MRN: ${actualDoc.mrn}`);
                    if (actualDoc.admissionDate) fields.push(`Admission Date: ${formatDate(actualDoc.admissionDate)}`);
                    if (actualDoc.dischargeDate) fields.push(`Discharge Date: ${formatDate(actualDoc.dischargeDate)}`);
                    if (actualDoc.lengthOfStay) fields.push(`Length of Stay: ${actualDoc.lengthOfStay}`);
                    if (getFieldValue('attendingPhysician')) fields.push(`Attending Physician: ${getFieldValue('attendingPhysician')}`);
                    if (getFieldValue('facility')) fields.push(`Facility: ${getFieldValue('facility')}`);
                    if (getFieldValue('dischargeDisposition')) fields.push(`Disposition: ${getFieldValue('dischargeDisposition')}`);
                    if (getFieldValue('dischargeCondition')) fields.push(`Condition: ${getFieldValue('dischargeCondition')}`);
                    copyToClipboard(`ADMINISTRATIVE INFORMATION\n${fields.join('\n')}`, 'admin-section');
                  }}
                >
                  {copiedSection === 'admin-section' ? 'Copied' : 'Copy Section'}
                </button>
                {(sectionHasEdits('admin') || approvedSections['admin']) && (
                  <button className={`approve-btn${approvedSections['admin'] ? ' approved' : ''}`} onClick={() => handleApprove(actualDoc, idx, 'admin')} disabled={approving}>
                    {approving ? 'Approving...' : approvedSections['admin'] ? 'Approved' : 'Approve'}
                  </button>
                )}
              </div>
            </div>
            {/* Read-only fields */}
            {renderReadOnlyField('MRN', actualDoc.mrn, 'admin-mrn')}
            {renderReadOnlyField('Admission Date', actualDoc.admissionDate ? formatDate(actualDoc.admissionDate) : null, 'admin-admission')}
            {renderReadOnlyField('Discharge Date', actualDoc.dischargeDate ? formatDate(actualDoc.dischargeDate) : null, 'admin-discharge')}
            {renderReadOnlyField('Length of Stay', actualDoc.lengthOfStay, 'admin-los')}
            {/* Editable fields */}
            {renderEditableField('attendingPhysician', 'Attending Physician', 'admin', 'admin-physician')}
            {renderEditableField('facility', 'Facility', 'admin', 'admin-facility')}
            {renderEditableField('dischargeDisposition', 'Disposition', 'admin', 'admin-disposition')}
            {renderEditableField('dischargeCondition', 'Condition', 'admin', 'admin-condition')}
          </div>
        </div>
      )}

      {/* Diagnoses */}
      {(actualDoc.admittingDiagnosis || actualDoc.principalDiagnosis || (actualDoc.secondaryDiagnoses && actualDoc.secondaryDiagnoses.length > 0)) &&
        shouldShowSection('Diagnoses', [
        actualDoc.admittingDiagnosis, actualDoc.principalDiagnosis,
        actualDoc.secondaryDiagnoses ? actualDoc.secondaryDiagnoses.join(' ') : '',
      ].filter(Boolean).join(' ')) && (
        <div className="section">
          <div className="mini-cards-container">
            <div className="section-header">
              <h4 className="section-title">{highlightText('Diagnoses')}</h4>
              <div className="header-right-actions">
                <button
                  className={`copy-btn ${copiedSection === 'diagnoses-section' ? 'copied' : ''}`}
                  onClick={() => {
                    let t = 'DIAGNOSES\n';
                    const ad = getFieldValue('admittingDiagnosis');
                    const pd = getFieldValue('principalDiagnosis');
                    const sd = getFieldValue('secondaryDiagnoses');
                    if (ad) t += `Admitting Diagnosis: ${ad}\n`;
                    if (pd) t += `Principal Diagnosis: ${pd}\n`;
                    const sdArr = sd ? (Array.isArray(sd) ? sd : [sd]) : actualDoc.secondaryDiagnoses;
                    if (sdArr && sdArr.length > 0) {
                      t += 'Secondary Diagnoses:\n';
                      sdArr.forEach((dx, i) => { t += `  ${i + 1}. ${dx}\n`; });
                    }
                    copyToClipboard(t, 'diagnoses-section');
                  }}
                >
                  {copiedSection === 'diagnoses-section' ? 'Copied' : 'Copy Section'}
                </button>
                {(sectionHasEdits('diagnoses') || approvedSections['diagnoses']) && (
                  <button className={`approve-btn${approvedSections['diagnoses'] ? ' approved' : ''}`} onClick={() => handleApprove(actualDoc, idx, 'diagnoses')} disabled={approving}>
                    {approving ? 'Approving...' : approvedSections['diagnoses'] ? 'Approved' : 'Approve'}
                  </button>
                )}
              </div>
            </div>
            {renderEditableField('admittingDiagnosis', 'Admitting Diagnosis', 'diagnoses', 'dx-admitting')}
            {renderEditableField('principalDiagnosis', 'Principal Diagnosis', 'diagnoses', 'dx-principal')}
            {/* Secondary Diagnoses - array element editing */}
            {actualDoc.secondaryDiagnoses && actualDoc.secondaryDiagnoses.length > 0 && (() => {
              const diagArr = actualDoc.secondaryDiagnoses.map((dx, dxIdx) => {
                const editKey = `secondaryDiagnoses.${dxIdx}-${idx}`;
                return localEdits[editKey] !== undefined ? localEdits[editKey] : dx;
              });
              const visibleDiags = diagArr
                .map((dx, origIdx) => ({ dx, origIdx }))
                .filter(({ dx }) => shouldShowRow('Secondary Diagnosis', dx));
              if (visibleDiags.length === 0) return null;
              return (
                <div className="rec-mini-card">
                  <div className="nested-subtitle">{highlightText('Secondary Diagnoses')}</div>
                  {visibleDiags.map(({ dx, origIdx: dxIdx }) => {
                    const editKey = `secondaryDiagnoses.${dxIdx}-${idx}-s0`;
                    const isEditing = editingField === editKey;
                    const sKey = `secondaryDiagnoses.${dxIdx}-${idx}-s0`;
                    const isEdited = editedSentences[sKey] === 'edited';

                    if (isEditing) {
                      return (
                        <div key={dxIdx} className="numbered-row edit-row">
                          <div className="edit-field-container">
                            <textarea
                              ref={textareaRef}
                              className="edit-textarea"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                            />
                            <div className="edit-actions">
                              <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                              <button className="save-btn" onClick={() => {
                                handleSaveField(actualDoc, 'secondaryDiagnoses', idx, 'diagnoses', dxIdx);
                              }} disabled={saving}>
                                {saving ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <React.Fragment key={dxIdx}>
                        <div className={`numbered-row${isEdited ? ' modified' : ''}`} style={{ marginBottom: dxIdx < visibleDiags.length - 1 ? '8px' : '0' }}>
                          <div className={`row-content${canEdit ? ' editable' : ''}`}
                            onClick={() => canEdit && handleStartEdit(`secondaryDiagnoses.${dxIdx}`, idx, dx)}>
                            <span className="content-value">{highlightText(dx)}</span>
                            {canEdit && editIndicator}
                          </div>
                          <button
                            className={`copy-btn ${copiedSection === `dx-sec-${dxIdx}` ? 'copied' : ''}`}
                            onClick={() => copyToClipboard(dx, `dx-sec-${dxIdx}`)}
                          >
                            {copiedSection === `dx-sec-${dxIdx}` ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        {isEdited && <div className="modified-badge">Modified</div>}
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Hospital Course - Per-Sentence Editing */}
      {(() => {
        const fullEditKey = `hospitalCourse-${idx}`;
        const hasFullEdit = localEdits[fullEditKey] !== undefined;
        const sourceText = hasFullEdit ? localEdits[fullEditKey] : (actualDoc.hospitalCourse || '');
        const sentences = splitBySentence(sourceText);
        if (sentences.length === 0 && !actualDoc.hospitalCourse) return null;
        if (!shouldShowSection('Hospital Course', sourceText)) return null;

        const sectionTitleMatches = searchTerm && shouldShowRow('Hospital Course');

        return (
          <div className="section">
            <div className="mini-cards-container">
              <div className="section-header">
                <h4 className="section-title">{highlightText('Hospital Course')}</h4>
                <div className="header-right-actions">
                  <button
                    className={`copy-btn ${copiedSection === 'hc-section' ? 'copied' : ''}`}
                    onClick={() => {
                      const hcSentences = sentences;
                      copyToClipboard(`HOSPITAL COURSE\n${hcSentences.map((s, i) => `${i + 1}. ${s}`).join('\n')}`, 'hc-section');
                    }}
                  >
                    {copiedSection === 'hc-section' ? 'Copied' : 'Copy Section'}
                  </button>
                  {(sectionHasEdits('hospital-course') || approvedSections['hospital-course']) && (
                    <button className={`approve-btn${approvedSections['hospital-course'] ? ' approved' : ''}`} onClick={() => handleApprove(actualDoc, idx, 'hospital-course')} disabled={approving}>
                      {approving ? 'Approving...' : approvedSections['hospital-course'] ? 'Approved' : 'Approve'}
                    </button>
                  )}
                </div>
              </div>
              <div className="rec-mini-card">
                {sentences
                  .map((sentence, origIdx) => ({ sentence, origIdx }))
                  .filter(({ sentence }) => sectionTitleMatches || shouldShowRow(sentence))
                  .map(({ sentence, origIdx: sIdx }) => {
                    const editKey = `hospitalCourse-${idx}-s${sIdx}`;
                    const isEditing = editingField === editKey;
                    const sentenceState = editedSentences[editKey];
                    const isEdited = sentenceState === 'edited';
                    const isAdded = sentenceState === 'added';

                    if (isEditing) {
                      return (
                        <div key={sIdx} className="numbered-row edit-row">
                          <div className="edit-field-container">
                            <textarea
                              ref={textareaRef}
                              className="edit-textarea"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                            />
                            <div className="edit-actions">
                              <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                              <button className="save-btn" onClick={() => {
                                let editedSentence = editValue.trim();
                                if (editedSentence && !/[.!?]$/.test(editedSentence)) editedSentence += '.';

                                const allCurrent = splitBySentence(sourceText);
                                const updated = allCurrent.map((s, i) => i === sIdx ? editedSentence : s);
                                const fullText = updated.join(' ');

                                const newSentences = splitBySentence(fullText);
                                const extraCount = newSentences.length - allCurrent.length;
                                if (extraCount > 0) {
                                  const editedMap = {};
                                  editedMap[`hospitalCourse-${idx}-s${sIdx}`] = 'edited';
                                  for (let si = sIdx + 1; si <= sIdx + extraCount; si++) {
                                    editedMap[`hospitalCourse-${idx}-s${si}`] = 'added';
                                  }
                                  setEditedSentences(prev => {
                                    const cleaned = {};
                                    for (const key of Object.keys(prev)) {
                                      if (!key.startsWith(`hospitalCourse-${idx}-s`)) cleaned[key] = prev[key];
                                    }
                                    return { ...cleaned, ...editedMap };
                                  });
                                }

                                handleSaveField(actualDoc, 'hospitalCourse', idx, 'hospital-course', undefined, fullText, sIdx);
                              }} disabled={saving}>
                                {saving ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <React.Fragment key={sIdx}>
                        <div className={`numbered-row${isEdited ? ' modified' : ''}${isAdded ? ' added' : ''}`}>
                          <div className={`row-content${canEdit ? ' editable' : ''}`}
                            onClick={() => {
                              if (!canEdit) return;
                              const editText = sentence.replace(/[.!?]+$/, '').trim();
                              handleStartEdit('hospitalCourse', idx, editText, sIdx);
                            }}>
                            <span className="content-value">{highlightText(sentence)}</span>
                            {canEdit && editIndicator}
                          </div>
                          <button
                            className={`copy-btn ${copiedSection === `hc-s${sIdx}` ? 'copied' : ''}`}
                            onClick={() => copyToClipboard(sentence, `hc-s${sIdx}`)}
                          >
                            {copiedSection === `hc-s${sIdx}` ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        {isEdited && <div className="modified-badge">Modified</div>}
                        {isAdded && <div className="added-badge">Added</div>}
                      </React.Fragment>
                    );
                  })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Procedures Performed (read-only) */}
      {actualDoc.proceduresPerformed && actualDoc.proceduresPerformed.length > 0 &&
        shouldShowSection('Procedures Performed', actualDoc.proceduresPerformed.map(p => typeof p === 'string' ? p : `${p.name} ${p.status || ''}`).join(' ')) && (() => {
        const sectionTitleMatches = searchTerm && shouldShowRow('Procedures Performed');
        return (
          <div className="section">
            <div className="mini-cards-container">
              <div className="section-header">
                <h4 className="section-title">{highlightText('Procedures Performed')}</h4>
                <button
                  className={`copy-btn ${copiedSection === 'proc-section' ? 'copied' : ''}`}
                  onClick={() => {
                    const t = actualDoc.proceduresPerformed.map((p, i) => {
                      const isStr = typeof p === 'string';
                      let line = `${i + 1}. ${isStr ? p : p.name}`;
                      if (!isStr && p.status) line += ` (${p.status})`;
                      if (!isStr && p.findings) line += `\n   Findings: ${p.findings}`;
                      return line;
                    }).join('\n');
                    copyToClipboard(`PROCEDURES PERFORMED\n${t}`, 'proc-section');
                  }}
                >
                  {copiedSection === 'proc-section' ? 'Copied' : 'Copy Section'}
                </button>
              </div>
              {actualDoc.proceduresPerformed
                .filter(proc => {
                  const isStr = typeof proc === 'string';
                  const procText = isStr ? proc : `${proc.name} ${proc.status || ''} ${proc.findings || ''}`;
                  return sectionTitleMatches || shouldShowRow('Procedure', procText);
                })
                .map((proc, pIdx) => {
                  const isStr = typeof proc === 'string';
                  const procName = isStr ? proc : proc.name;
                  return (
                    <div key={pIdx} className="rec-mini-card">
                      <div className="nested-subtitle">{highlightText(procName)}</div>
                      {!isStr && proc.status && (
                        <div className="numbered-row">
                          <div className="row-content"><span className="content-value">Status: {highlightText(proc.status)}</span></div>
                        </div>
                      )}
                      {!isStr && proc.findings && (
                        <div className="numbered-row">
                          <div className="row-content"><span className="content-value">Findings: {highlightText(proc.findings)}</span></div>
                        </div>
                      )}
                      {!isStr && proc.notes && (
                        <div className="numbered-row">
                          <div className="row-content"><span className="content-value">Notes: {highlightText(proc.notes)}</span></div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        );
      })()}

      {/* Discharge Medications (read-only) */}
      {actualDoc.dischargeMedications && actualDoc.dischargeMedications.length > 0 &&
        shouldShowSection('Discharge Medications', actualDoc.dischargeMedications.map(m => typeof m === 'string' ? m : `${m.name} ${m.dosage || ''}`).join(' ')) && (() => {
        const sectionTitleMatches = searchTerm && shouldShowRow('Discharge Medications');
        return (
          <div className="section">
            <div className="mini-cards-container">
              <div className="section-header">
                <h4 className="section-title">{highlightText('Discharge Medications')}</h4>
                <button
                  className={`copy-btn ${copiedSection === 'med-section' ? 'copied' : ''}`}
                  onClick={() => {
                    const t = actualDoc.dischargeMedications.map((m, i) => {
                      const isStr = typeof m === 'string';
                      let line = `${i + 1}. ${isStr ? m : m.name}`;
                      if (!isStr && m.dosage) line += ` ${m.dosage}`;
                      if (!isStr && m.frequency) line += ` ${m.frequency}`;
                      return line;
                    }).join('\n');
                    copyToClipboard(`DISCHARGE MEDICATIONS\n${t}`, 'med-section');
                  }}
                >
                  {copiedSection === 'med-section' ? 'Copied' : 'Copy Section'}
                </button>
              </div>
              {actualDoc.dischargeMedications
                .filter(med => {
                  const isStr = typeof med === 'string';
                  const medText = isStr ? med : `${med.name} ${med.dosage || ''} ${med.frequency || ''}`;
                  return sectionTitleMatches || shouldShowRow('Medication', medText);
                })
                .map((med, mIdx) => {
                  const isStr = typeof med === 'string';
                  const medName = isStr ? med : med.name;
                  return (
                    <div key={mIdx} className="rec-mini-card">
                      <div className="nested-subtitle">{highlightText(medName)}</div>
                      {!isStr && (med.dosage || med.frequency || med.route) && (
                        <div className="numbered-row">
                          <div className="row-content">
                            <span className="content-value">
                              {[med.dosage, med.frequency, med.route ? `(${med.route})` : null].filter(Boolean).join(' ')}
                            </span>
                          </div>
                        </div>
                      )}
                      {!isStr && med.instructions && (
                        <div className="numbered-row">
                          <div className="row-content"><span className="content-value">Instructions: {highlightText(med.instructions)}</span></div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        );
      })()}

      {/* Discharge Instructions */}
      {(getFieldValue('dischargeInstructions') || actualDoc.dischargeInstructions) &&
        shouldShowSection('Discharge Instructions', getFieldValue('dischargeInstructions') || actualDoc.dischargeInstructions) && (
        <div className="section">
          <div className="mini-cards-container">
            <div className="section-header">
              <h4 className="section-title">{highlightText('Discharge Instructions')}</h4>
              <div className="header-right-actions">
                <button
                  className={`copy-btn ${copiedSection === 'instr-section' ? 'copied' : ''}`}
                  onClick={() => copyToClipboard(`DISCHARGE INSTRUCTIONS\n${getFieldValue('dischargeInstructions') || actualDoc.dischargeInstructions}`, 'instr-section')}
                >
                  {copiedSection === 'instr-section' ? 'Copied' : 'Copy Section'}
                </button>
                {(sectionHasEdits('instructions') || approvedSections['instructions']) && (
                  <button className={`approve-btn${approvedSections['instructions'] ? ' approved' : ''}`} onClick={() => handleApprove(actualDoc, idx, 'instructions')} disabled={approving}>
                    {approving ? 'Approving...' : approvedSections['instructions'] ? 'Approved' : 'Approve'}
                  </button>
                )}
              </div>
            </div>
            {renderEditableField('dischargeInstructions', 'Instructions', 'instructions', 'instr-field')}
          </div>
        </div>
      )}

      {/* Activity & Diet */}
      {(actualDoc.activityRestrictions || actualDoc.dietRestrictions || getFieldValue('activityRestrictions') || getFieldValue('dietRestrictions')) &&
        shouldShowSection('Activity & Diet', [
          getFieldValue('activityRestrictions') || actualDoc.activityRestrictions,
          getFieldValue('dietRestrictions') || actualDoc.dietRestrictions,
        ].filter(Boolean).join(' ')) && (
        <div className="section">
          <div className="mini-cards-container">
            <div className="section-header">
              <h4 className="section-title">{highlightText('Activity & Diet')}</h4>
              <div className="header-right-actions">
                <button
                  className={`copy-btn ${copiedSection === 'restrict-section' ? 'copied' : ''}`}
                  onClick={() => {
                    let t = 'ACTIVITY & DIET\n';
                    const ar = getFieldValue('activityRestrictions') || actualDoc.activityRestrictions;
                    const dr = getFieldValue('dietRestrictions') || actualDoc.dietRestrictions;
                    if (ar) t += `Activity Restrictions: ${ar}\n`;
                    if (dr) t += `Diet: ${dr}\n`;
                    copyToClipboard(t, 'restrict-section');
                  }}
                >
                  {copiedSection === 'restrict-section' ? 'Copied' : 'Copy Section'}
                </button>
                {(sectionHasEdits('restrictions') || approvedSections['restrictions']) && (
                  <button className={`approve-btn${approvedSections['restrictions'] ? ' approved' : ''}`} onClick={() => handleApprove(actualDoc, idx, 'restrictions')} disabled={approving}>
                    {approving ? 'Approving...' : approvedSections['restrictions'] ? 'Approved' : 'Approve'}
                  </button>
                )}
              </div>
            </div>
            {renderEditableField('activityRestrictions', 'Activity Restrictions', 'restrictions', 'restrict-activity')}
            {renderEditableField('dietRestrictions', 'Diet', 'restrictions', 'restrict-diet')}
          </div>
        </div>
      )}

      {/* Follow-Up Appointments (read-only) */}
      {actualDoc.followUpAppointments && actualDoc.followUpAppointments.length > 0 &&
        shouldShowSection('Follow-Up Appointments', actualDoc.followUpAppointments.map(a => typeof a === 'string' ? a : `${a.specialty} ${a.reason || ''}`).join(' ')) && (() => {
        const sectionTitleMatches = searchTerm && shouldShowRow('Follow-Up Appointments');
        return (
          <div className="section">
            <div className="mini-cards-container">
              <div className="section-header">
                <h4 className="section-title">{highlightText('Follow-Up Appointments')}</h4>
                <button
                  className={`copy-btn ${copiedSection === 'fu-section' ? 'copied' : ''}`}
                  onClick={() => {
                    const t = actualDoc.followUpAppointments.map((a, i) => {
                      const isStr = typeof a === 'string';
                      let line = `${i + 1}. ${isStr ? a : a.specialty}`;
                      if (!isStr && a.reason) line += `\n   Reason: ${a.reason}`;
                      if (!isStr && a.appointmentDate) line += `\n   Date: ${formatDate(a.appointmentDate)}`;
                      return line;
                    }).join('\n');
                    copyToClipboard(`FOLLOW-UP APPOINTMENTS\n${t}`, 'fu-section');
                  }}
                >
                  {copiedSection === 'fu-section' ? 'Copied' : 'Copy Section'}
                </button>
              </div>
              {actualDoc.followUpAppointments
                .filter(appt => {
                  const isStr = typeof appt === 'string';
                  const apptText = isStr ? appt : `${appt.specialty} ${appt.reason || ''}`;
                  return sectionTitleMatches || shouldShowRow('Appointment', apptText);
                })
                .map((appt, aIdx) => {
                  const isStr = typeof appt === 'string';
                  return (
                    <div key={aIdx} className="rec-mini-card">
                      <div className="nested-subtitle">{highlightText(isStr ? appt : appt.specialty)}</div>
                      {!isStr && appt.status && (
                        <div className="numbered-row">
                          <div className="row-content"><span className="content-value">Status: {highlightText(appt.status)}</span></div>
                        </div>
                      )}
                      {!isStr && appt.reason && (
                        <div className="numbered-row">
                          <div className="row-content"><span className="content-value">Reason: {highlightText(appt.reason)}</span></div>
                        </div>
                      )}
                      {!isStr && appt.appointmentDate && (
                        <div className="numbered-row">
                          <div className="row-content"><span className="content-value">Date: {highlightText(formatDate(appt.appointmentDate))}</span></div>
                        </div>
                      )}
                      {!isStr && appt.notes && (
                        <div className="numbered-row">
                          <div className="row-content"><span className="content-value">Notes: {highlightText(appt.notes)}</span></div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        );
      })()}

      {/* Electronic Signature */}
      {(getFieldValue('electronicSignature') || actualDoc.electronicSignature) &&
        shouldShowSection('Electronic Signature', getFieldValue('electronicSignature') || actualDoc.electronicSignature) && (
        <div className="section">
          <div className="mini-cards-container">
            <div className="section-header">
              <h4 className="section-title">{highlightText('Electronic Signature')}</h4>
              <div className="header-right-actions">
                <button
                  className={`copy-btn ${copiedSection === 'sig-section' ? 'copied' : ''}`}
                  onClick={() => copyToClipboard(getFieldValue('electronicSignature') || actualDoc.electronicSignature, 'sig-section')}
                >
                  {copiedSection === 'sig-section' ? 'Copied' : 'Copy Section'}
                </button>
                {(sectionHasEdits('signature') || approvedSections['signature']) && (
                  <button className={`approve-btn${approvedSections['signature'] ? ' approved' : ''}`} onClick={() => handleApprove(actualDoc, idx, 'signature')} disabled={approving}>
                    {approving ? 'Approving...' : approvedSections['signature'] ? 'Approved' : 'Approve'}
                  </button>
                )}
              </div>
            </div>
            {renderEditableField('electronicSignature', 'Signature', 'signature', 'sig-field')}
          </div>
        </div>
      )}
    </div>
  );
};

export default DischargeSummaryDocument;
