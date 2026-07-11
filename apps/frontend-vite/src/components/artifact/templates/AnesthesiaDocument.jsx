import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import { useDocumentSearch } from '../hooks/useDocumentSearch';
import secureApiClient from '../../../services/secureApiClient';
import './AnesthesiaDocument.css';
import AnesthesiaDocumentPDFTemplate from '../pdf-templates/AnesthesiaDocumentPDFTemplate';

// Section fields for per-section approve
const SECTION_FIELDS = {
  chiefComplaint: ['chiefComplaint'],
  hpi: ['historyOfPresentIllness'],
  allergies: ['allergies'],
  medications: ['medications'],
  diagnoses: ['diagnoses'],
  medicalHistory: ['medicalHistory'],
  reviewOfSystems: ['reviewOfSystems'],
  vitalSigns: ['vitalSigns'],
  physicalExamination: ['physicalExamination'],
  anesthesiologyAssessment: ['anesthesiologyAssessment'],
  labResults: ['labResults'],
  imaging: ['imaging'],
  clinicalScores: ['clinicalScores'],
  pulmonaryFunctionTests: ['pulmonaryFunctionTests'],
  sleepStudy: ['sleepStudy'],
  riskStratification: ['riskStratification'],
  operativeDetails: ['operativeDetails'],
  preoperativePreparation: ['preoperativePreparation'],
  dvtProphylaxis: ['dvtProphylaxis'],
  postoperativeOrders: ['postoperativeOrders'],
  referrals: ['referrals'],
  followUpAppointments: ['followUpAppointments'],
  patientEducation: ['patientEducation'],
  clinicalDecisionSupport: ['clinicalDecisionSupport'],
  giRiskAssessment: ['giRiskAssessment'],
  assessmentAndPlan: ['assessmentAndPlan'],
  additionalNotes: ['additionalNotes'],
  respiratoryDevices: ['respiratoryDevices'],
  functionalStatus: ['functionalStatus'],
  neurologicalExam: ['neurologicalExam'],
  peripheralNeuropathy: ['peripheralNeuropathy'],
  administrativeData: ['administrativeData'],
  consultationDetails: ['consultationDetails'],
};

// Split text into sentences (PLAIN FUNCTION, not useCallback)
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = [];
  let current = '';
  let parenDepth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    if ((ch === '.' || ch === ';') && parenDepth === 0 && i + 1 < text.length && /\s/.test(text[i + 1])) {
      if (ch === '.' && /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc)$/.test(current)) {
        current += ch;
        continue;
      }
      const trimmed = current.trim();
      if (trimmed) result.push(trimmed);
      current = '';
      while (i + 1 < text.length && /\s/.test(text[i + 1])) i++;
    } else {
      current += ch;
    }
  }
  const trimmed = current.replace(/[.;]+$/, '').trim();
  if (trimmed) result.push(trimmed);
  return result;
};

// Parse label from sentence (PLAIN FUNCTION)
const parseLabel = (sentence) => {
  const match = sentence.match(/^([A-Z][A-Za-z0-9 &/()>=<+%.#-]+):\s*(.+)$/);
  if (match) return { label: match[1], value: match[2] };
  return null;
};

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the editKey field part, e.g. a dot-path) */
const DRAFT_KEY = 'anesthesiaPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const AnesthesiaDocument = ({ document: rawDoc }) => {
  const [copiedItemIndex, setCopiedItemIndex] = useState(null);
  const containerRef = useRef(null);

  // Editing state
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const textareaRef = useRef(null);

  const canEdit = true;

  // Data unwrapping - handle wrapped collection structure
  const unwrappedData = rawDoc?.documentData || rawDoc;
  let recordsArray = [];
  if (unwrappedData?.anesthesia_records && Array.isArray(unwrappedData.anesthesia_records)) {
    recordsArray = unwrappedData.anesthesia_records;
  } else if (Array.isArray(unwrappedData)) {
    recordsArray = unwrappedData;
  } else if (unwrappedData && typeof unwrappedData === 'object') {
    recordsArray = [unwrappedData];
  }
  const doc = recordsArray.length > 0 ? recordsArray[0] : {};
  const record = doc;
  const idx = 0;

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  const recordId = record && (record._id?.$oid || record._id);
  useEffect(() => {
    if (!recordId) return;
    const store = readDrafts();
    const recDrafts = store[recordId];
    if (!recDrafts || Object.keys(recDrafts).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    Object.entries(recDrafts).forEach(([fieldName, value]) => {
      const editKey = `${fieldName}-${idx}`;
      nLocal[editKey] = value;
      nPending[editKey] = true;
      // Mark both the field-level and first-sentence markers as edited so the badge + approve button show.
      nFields[editKey] = true;
      nSentences[`${fieldName}-${idx}-s0`] = true;
    });
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [recordId]);

  // Format date helper
  const formatDate = (dateValue) => {
    if (!dateValue) return 'Not specified';
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return 'Not specified';
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return 'Not specified'; }
  };

  // ─── Editing helpers ──────────────────────────────────────────────────

  const getEffectiveDot = (record, dotPath, idx) => {
    const editKey = `${dotPath}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    const parts = dotPath.split('.');
    let current = record;
    for (const p of parts) { current = current?.[p]; }
    return current;
  };

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = (record, fieldName, idx, sectionId, sentenceIdx, newValue, editTrackingKey) => {
    const recordId = record._id?.$oid || record._id;
    const editKey = `${fieldName}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: newValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    if (editTrackingKey) {
      if (sentenceIdx !== undefined && sentenceIdx !== null) {
        setEditedSentences(prev => ({ ...prev, [editTrackingKey]: true }));
      } else {
        setEditedFields(prev => ({ ...prev, [editTrackingKey]: true }));
      }
    }
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => { const u = { ...prev }; delete u[`${sectionId}-${idx}`]; return u; });
    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    if (recordId) {
      const store = readDrafts();
      if (!store[recordId]) store[recordId] = {};
      store[recordId][fieldName] = newValue;
      writeDrafts(store);
    }
    setEditingField(null);
    setEditValue('');
  };

  // sectionHasEdits
  const sectionHasEdits = useCallback((sectionId, idx) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    if (approvedSections[`${sectionId}-${idx}`]) return false;
    return fields.some(f => {
      const hasSentenceEdits = Object.keys(editedSentences).some(key => key.startsWith(`${f}-${idx}`));
      const hasFieldEdits = Object.keys(editedFields).some(key => key.startsWith(`${f}-${idx}`));
      return hasSentenceEdits || hasFieldEdits;
    });
  }, [editedSentences, editedFields, approvedSections]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sectionId) => {
    const approveKey = `${sectionId}-${idx}`;
    if (approvedSections[approveKey]) return; // Already approved, do nothing
    const recordId = record._id?.$oid || record._id;
    const fields = SECTION_FIELDS[sectionId] || [];
    const suffix = `-${idx}`;

    // Collect this section's staged (pending) edits. editKey = `${fieldName}-${idx}`; the field part
    // belongs to this section when its base field (first dot-segment) is in SECTION_FIELDS[sectionId].
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fieldPart = k.slice(0, -suffix.length);
      const baseField = fieldPart.split('.')[0];
      return fields.includes(baseField);
    });

    if (recordId) {
      try {
        // Persist each staged field to the DB now (field, or field+arrayIndex for array elements).
        for (const editKey of toCommit) {
          const fieldPart = editKey.slice(0, -suffix.length); // e.g. "allergies.0.allergen"
          const lastDot = fieldPart.lastIndexOf('.');
          const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
          const payload = { value: localEdits[editKey] };
          if (lastDot !== -1 && /^\d+$/.test(trailing)) {
            // Only treat a trailing PURELY-NUMERIC dot-segment as an arrayIndex.
            payload.field = fieldPart.slice(0, lastDot);
            payload.arrayIndex = parseInt(trailing, 10);
          } else {
            payload.field = fieldPart;
          }
          await secureApiClient.put(`/api/edit/anesthesia/${recordId}/edit`, payload);
        }
        // Flag the section approved (audit trail)
        await secureApiClient.put(`/api/edit/anesthesia/${recordId}/approve`, { sectionId, approved: true });
      } catch (error) {
        console.error('Approve failed:', error);
        return;
      }
    }

    // Clear pending → committed edits now flow into pdfData/PDF
    setPendingEdits(prev => {
      const next = { ...prev };
      toCommit.forEach(k => delete next[k]);
      return next;
    });
    // Drop this record's committed drafts from localStorage
    if (recordId) {
      const store = readDrafts();
      if (store[recordId]) {
        toCommit.forEach(editKey => {
          const fieldPart = editKey.slice(0, -suffix.length);
          delete store[recordId][fieldPart];
        });
        if (Object.keys(store[recordId]).length === 0) delete store[recordId];
        writeDrafts(store);
      }
    }

    setApprovedSections(prev => ({ ...prev, [approveKey]: true }));
    setEditedSentences(prev => {
      const cleaned = { ...prev };
      fields.forEach(f => {
        Object.keys(cleaned).forEach(key => {
          if (key.startsWith(`${f}-${idx}`)) delete cleaned[key];
        });
      });
      return cleaned;
    });
    setEditedFields(prev => {
      const cleaned = { ...prev };
      fields.forEach(f => {
        Object.keys(cleaned).forEach(key => {
          if (key.startsWith(`${f}-${idx}`)) delete cleaned[key];
        });
      });
      return cleaned;
    });
  }, [approvedSections, localEdits, pendingEdits]);

  // pdfData memo
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return doc;
    const merged = { ...doc };
    for (const [editKey, editVal] of Object.entries(localEdits)) {
      if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
      const dashIdx = editKey.lastIndexOf('-');
      const fieldName = editKey.substring(0, dashIdx);
      // Handle dot-path fields
      if (fieldName.includes('.')) {
        const parts = fieldName.split('.');
        let obj = merged;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!obj[parts[i]]) obj[parts[i]] = {};
          obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = editVal;
      } else {
        merged[fieldName] = editVal;
      }
    }
    return merged;
  }, [doc, localEdits, pendingEdits]);


  // ─── Render helpers ───────────────────────────────────────────────

  const renderApproveBtn = (record, sectionId, idx) => {
    const approveKey = `${sectionId}-${idx}`;
    const hasEdits = sectionHasEdits(sectionId, idx);
    const isApproved = approvedSections[approveKey];
    if (!hasEdits && !isApproved) return null;
    return (
      <button
        className={`approve-btn${isApproved ? ' approved' : ''}`}
        onClick={() => handleApproveSection(record, idx, sectionId)}
        disabled={isApproved}
      >
        {isApproved ? 'Approved' : 'Pending Approve'}
      </button>
    );
  };

  // renderEditableField — for simple dot-path or direct fields
  const renderEditableField = (record, dotPath, idx, sectionId, label, copyId) => {
    const editKey = `${dotPath}-${idx}`;
    const isEditing = editingField === editKey;
    const val = getEffectiveDot(record, dotPath, idx);
    const displayValue = String(val || '');
    const isEdited = editedFields[editKey];

    if (isEditing) {
      return (
        <div className="numbered-row" key={copyId}>
          <div className="edit-field-container">
            {label && <span className="content-subtitle">{label}</span>}
            <textarea
              ref={textareaRef}
              className="edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, dotPath, idx, sectionId, null, editValue.trim(), editKey); }}
            />
            <div className="edit-actions">
              <button className="save-btn" onClick={() => handleSaveField(record, dotPath, idx, sectionId, null, editValue.trim(), editKey)} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <React.Fragment key={editKey}>
        <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
          <div className={`row-content${canEdit ? ' editable' : ''}`} onClick={() => { setEditingField(editKey); setEditValue(displayValue); setTimeout(() => textareaRef.current?.focus(), 50); }}>
            <span className="content-value"><strong>{highlightText(label)}:</strong> {highlightText(displayValue)}</span>
            {canEdit && !isEdited && <span className="edit-indicator">✎</span>}
          </div>
          <button className={`copy-btn${copiedItemIndex === copyId ? ' copied' : ''}`} onClick={() => copySection(`${label}: ${displayValue}`, copyId)}>
            {copiedItemIndex === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isEdited && <div className="modified-badge">edited — click pending approve to save</div>}
      </React.Fragment>
    );
  };

  // renderSentenceEditableField — for long text fields split by sentence
  const renderSentenceEditableField = (record, fieldName, idx, sectionId, showLabel, copyId) => {
    const editKeyBase = `${fieldName}-${idx}`;
    const val = getEffectiveDot(record, fieldName, idx);
    if (!val) return null;
    const sentences = splitBySentence(String(val));
    if (sentences.length === 0) return null;

    // If only 1 sentence, render as simple editable
    if (sentences.length <= 1) {
      const editKey = `${fieldName}-${idx}-s0`;
      const isEditing = editingField === editKey;
      const isEdited = editedSentences[editKey];
      const displayValue = sentences[0] || String(val);

      if (isEditing) {
        return (
          <div className="numbered-row" key={copyId}>
            <div className="edit-field-container">
              <textarea ref={textareaRef} className="edit-textarea" value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { handleSaveField(record, fieldName, idx, sectionId, 0, editValue.trim(), editKey); }}}
              />
              <div className="edit-actions">
                <button className="save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId, 0, editValue.trim(), editKey)} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <React.Fragment key={editKey}>
          <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
            <div className={`row-content${canEdit ? ' editable' : ''}`} onClick={() => { setEditingField(editKey); setEditValue(displayValue); setTimeout(() => textareaRef.current?.focus(), 50); }}>
              <span className="content-value">{highlightText(displayValue)}</span>
              {canEdit && !isEdited && <span className="edit-indicator">✎</span>}
            </div>
            <button className={`copy-btn${copiedItemIndex === copyId ? ' copied' : ''}`} onClick={() => copySection(displayValue, copyId)}>
              {copiedItemIndex === copyId ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {isEdited && <div className="modified-badge">edited — click pending approve to save</div>}
        </React.Fragment>
      );
    }

    // Multiple sentences
    return sentences.map((sentence, sIdx) => {
      const editKey = `${fieldName}-${idx}-s${sIdx}`;
      const isEditing = editingField === editKey;
      const isEdited = editedSentences[editKey];
      const itemCopyId = `${copyId}-s${sIdx}`;
      const parsed = showLabel !== false ? parseLabel(sentence) : null;

      if (isEditing) {
        return (
          <div className="rec-mini-card" key={editKey}>
            <div className="edit-field-container">
              <textarea ref={textareaRef} className="edit-textarea" value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    let newVal = editValue.trim();
                    if (newVal && !/[.!?]$/.test(newVal)) newVal += '.';
                    const allCurrent = splitBySentence(String(getEffectiveDot(record, fieldName, idx) || ''));
                    const updated = allCurrent.map((s, i) => i === sIdx ? newVal : ((s && !/[.!?]$/.test(s)) ? s + '.' : s));
                    const fullText = updated.join(' ');
                    handleSaveField(record, fieldName, idx, sectionId, sIdx, fullText, editKey);
                  }
                }}
              />
              <div className="edit-actions">
                <button className="save-btn" onClick={() => {
                  let newVal = editValue.trim();
                  if (newVal && !/[.!?]$/.test(newVal)) newVal += '.';
                  const allCurrent = splitBySentence(String(getEffectiveDot(record, fieldName, idx) || ''));
                  const updated = allCurrent.map((s, i) => i === sIdx ? newVal : ((s && !/[.!?]$/.test(s)) ? s + '.' : s));
                  const fullText = updated.join(' ');
                  handleSaveField(record, fieldName, idx, sectionId, sIdx, fullText, editKey);
                }} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
              </div>
            </div>
          </div>
        );
      }

      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        if (!sentence.toLowerCase().includes(searchLower)) return null;
      }

      return (
        <React.Fragment key={editKey}>
          <div className={`rec-mini-card${isEdited ? ' modified' : ''}`}>
            {parsed ? (
              <div className={`row-content${canEdit ? ' editable' : ''}`} onClick={() => { setEditingField(editKey); setEditValue(sentence); setTimeout(() => textareaRef.current?.focus(), 50); }}>
                <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                <span className="content-value">{highlightText(parsed.value)}</span>
                {canEdit && !isEdited && <span className="edit-indicator">✎</span>}
              </div>
            ) : (
              <div className={`row-content${canEdit ? ' editable' : ''}`} onClick={() => { setEditingField(editKey); setEditValue(sentence); setTimeout(() => textareaRef.current?.focus(), 50); }}>
                <span className="content-value">{highlightText(sentence)}</span>
                {canEdit && !isEdited && <span className="edit-indicator">✎</span>}
              </div>
            )}
            <button className={`copy-btn${copiedItemIndex === itemCopyId ? ' copied' : ''}`} onClick={() => copySection(sentence, itemCopyId)}>
              {copiedItemIndex === itemCopyId ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {isEdited && <div className="modified-badge">edited — click pending approve to save</div>}
        </React.Fragment>
      );
    });
  };

  // renderDynamicObjectField — for Object.entries iteration with dot-path editing
  const renderDynamicObjectField = (record, parentPath, idx, sectionId) => {
    const parentVal = getEffectiveDot(record, parentPath, idx);
    if (!parentVal || typeof parentVal !== 'object') return null;

    return Object.entries(parentVal).map(([key, value]) => {
      const dotPath = `${parentPath}.${key}`;
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
      const displayValue = typeof value === 'object' && value !== null
        ? (Array.isArray(value) ? value.join(', ') : JSON.stringify(value))
        : String(value ?? '');

      return renderEditableField(record, dotPath, idx, sectionId, label, `${dotPath}-${idx}`);
    });
  };


  // Build searchable items
  const searchableItems = [];

  if (doc.chiefComplaint?.complaint) {
    searchableItems.push({ _type: 'chief-complaint', _searchText: `chief complaint ${doc.chiefComplaint.complaint} ${doc.chiefComplaint.duration || ''}`.toLowerCase() });
  }
  if (doc.historyOfPresentIllness) {
    searchableItems.push({ _type: 'hpi', _searchText: `history present illness hpi ${doc.historyOfPresentIllness}`.toLowerCase() });
  }
  if (doc.allergies && doc.allergies.length > 0) {
    doc.allergies.forEach((allergy, idx) => {
      searchableItems.push({ _type: 'allergy', _index: idx, _searchText: `allergies allergy ${allergy.allergen} ${allergy.reaction} ${allergy.severity || ''}`.toLowerCase() });
    });
  }
  if (doc.medications && doc.medications.length > 0) {
    doc.medications.forEach((med, idx) => {
      searchableItems.push({ _type: 'medication', _index: idx, _searchText: `medications medication ${med.name} ${med.dosage || ''} ${med.frequency || ''} ${med.indication || ''}`.toLowerCase() });
    });
  }
  if (doc.diagnoses && doc.diagnoses.length > 0) {
    doc.diagnoses.forEach((dx, idx) => {
      searchableItems.push({ _type: 'diagnosis', _index: idx, _searchText: `diagnoses diagnosis ${dx.diagnosis} ${dx.status || ''} ${dx.type || ''}`.toLowerCase() });
    });
  }
  if (doc.medicalHistory) {
    searchableItems.push({ _type: 'medical-history', _searchText: `medical history past surgical family social ${JSON.stringify(doc.medicalHistory)}`.toLowerCase() });
  }
  if (doc.reviewOfSystems) {
    searchableItems.push({ _type: 'ros', _searchText: `review of systems ros ${JSON.stringify(doc.reviewOfSystems)}`.toLowerCase() });
  }
  if (doc.vitalSigns) {
    searchableItems.push({ _type: 'vitals', _searchText: `vital signs vitals blood pressure heart rate temperature bmi ${JSON.stringify(doc.vitalSigns)}`.toLowerCase() });
  }
  if (doc.physicalExamination) {
    searchableItems.push({ _type: 'physical-exam', _searchText: `physical examination exam ${JSON.stringify(doc.physicalExamination)}`.toLowerCase() });
  }
  if (doc.anesthesiologyAssessment) {
    searchableItems.push({ _type: 'anesthesia-assessment', _searchText: `anesthesiology assessment asa airway pain management plan ${JSON.stringify(doc.anesthesiologyAssessment)}`.toLowerCase() });
  }
  if (doc.labResults && doc.labResults.length > 0) {
    doc.labResults.forEach((lab, idx) => {
      searchableItems.push({ _type: 'lab', _index: idx, _searchText: `lab results laboratory ${lab.testName} ${lab.value || ''} ${lab.interpretation || ''}`.toLowerCase() });
    });
  }
  if (doc.imaging && doc.imaging.length > 0) {
    doc.imaging.forEach((img, idx) => {
      searchableItems.push({ _type: 'imaging', _index: idx, _searchText: `imaging radiology ${img.modality} ${img.bodyPart || ''} ${img.findings || ''} ${img.impression || ''}`.toLowerCase() });
    });
  }
  if (doc.clinicalScores) {
    searchableItems.push({ _type: 'clinical-scores', _searchText: `clinical scores risk stratification asa rcri stopbang apfel nsqip ${JSON.stringify(doc.clinicalScores)}`.toLowerCase() });
  }

  // Search hook
  const { searchTerm, setSearchTerm, filteredItems } = useDocumentSearch(searchableItems, ['_searchText']);

  // Show variables for conditional rendering
  const showChiefComplaint = !searchTerm || filteredItems.some(item => item._type === 'chief-complaint');
  const showHPI = !searchTerm || filteredItems.some(item => item._type === 'hpi');
  const showAllergies = !searchTerm || filteredItems.some(item => item._type === 'allergy');
  const showMedications = !searchTerm || filteredItems.some(item => item._type === 'medication');
  const showDiagnoses = !searchTerm || filteredItems.some(item => item._type === 'diagnosis');
  const showMedicalHistory = !searchTerm || filteredItems.some(item => item._type === 'medical-history');
  const showROS = !searchTerm || filteredItems.some(item => item._type === 'ros');
  const showVitals = !searchTerm || filteredItems.some(item => item._type === 'vitals');
  const showPhysicalExam = !searchTerm || filteredItems.some(item => item._type === 'physical-exam');
  const showAnesthesiaAssessment = !searchTerm || filteredItems.some(item => item._type === 'anesthesia-assessment');
  const showLabs = !searchTerm || filteredItems.some(item => item._type === 'lab');
  const showImaging = !searchTerm || filteredItems.some(item => item._type === 'imaging');
  const showClinicalScores = !searchTerm || filteredItems.some(item => item._type === 'clinical-scores');

  // Highlight text function
  const highlightText = (text) => {
    if (!searchTerm || !text) return text;
    const parts = String(text).split(new RegExp(`(${searchTerm})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === searchTerm.toLowerCase() ? (
        <mark key={i} style={{ backgroundColor: '#fef08a', color: '#000', padding: '0', margin: '0', fontWeight: 'inherit', borderRadius: '0' }}>{part}</mark>
      ) : part
    );
  };

  // Copy to clipboard function
  const copyToClipboard = async (text) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        const container = containerRef.current || document.body;
        container.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        container.removeChild(textarea);
      }
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const copySection = async (text, index) => {
    await copyToClipboard(text);
    setCopiedItemIndex(index);
    setTimeout(() => setCopiedItemIndex(null), 2000);
  };

  const copySubsection = copySection;

  // Helper function to format objects as human-readable text
  const formatObjectToText = (obj, indent = '') => {
    if (!obj || typeof obj !== 'object') return String(obj);
    let result = '';
    Object.entries(obj).forEach(([key, value]) => {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result += `${indent}${label}:\n`;
        result += formatObjectToText(value, indent + '  ');
      } else if (Array.isArray(value)) {
        result += `${indent}${label}:\n`;
        value.forEach(item => {
          if (typeof item === 'string') { result += `${indent}  - ${item}\n`; }
          else { result += `${indent}  - ${JSON.stringify(item)}\n`; }
        });
      } else {
        result += `${indent}${label}: ${value}\n`;
      }
    });
    return result;
  };

  // SVG copy icon helper
  const CopyIcon = ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  );


  // Copy All function - Comprehensive
  const copyAll = async () => {
    let text = '=== ANESTHESIA PREOPERATIVE CONSULTATION ===\n\n';
    if (doc.patientName) text += `Patient: ${doc.patientName}\n`;
    if (doc.age) text += `Age: ${doc.age}\n`;
    if (doc.gender) text += `Gender: ${doc.gender}\n`;
    if (doc.mrn) text += `MRN: ${doc.mrn}\n`;
    if (doc.dateOfBirth) text += `Date of Birth: ${formatDate(doc.dateOfBirth)}\n`;
    if (doc.date) text += `Consultation Date: ${formatDate(doc.date)}\n`;
    text += '\n';
    if (doc.chiefComplaint?.complaint) {
      text += `CHIEF COMPLAINT:\n${doc.chiefComplaint.complaint}\n`;
      if (doc.chiefComplaint.duration) text += `Duration: ${doc.chiefComplaint.duration}\n`;
      text += '\n';
    }
    if (doc.historyOfPresentIllness) { text += `HISTORY OF PRESENT ILLNESS:\n${doc.historyOfPresentIllness}\n\n`; }
    if (doc.allergies && doc.allergies.length > 0) {
      text += `ALLERGIES:\n`;
      doc.allergies.forEach(a => { text += `- ${a.allergen}: ${a.reaction}`; if (a.severity) text += ` (${a.severity})`; text += '\n'; });
      text += '\n';
    }
    if (doc.medications && doc.medications.length > 0) {
      text += `CURRENT MEDICATIONS:\n`;
      doc.medications.forEach(m => { text += `- ${m.name}`; if (m.dosage) text += ` ${m.dosage}`; if (m.frequency) text += ` ${m.frequency}`; if (m.indication) text += ` - ${m.indication}`; if (m.status) text += ` (${typeof m.status === 'string' ? m.status : JSON.stringify(m.status)})`; text += '\n'; });
      text += '\n';
    }
    if (doc.diagnoses && doc.diagnoses.length > 0) {
      text += `DIAGNOSES:\n`;
      doc.diagnoses.forEach(d => { text += `- ${typeof d.diagnosis === 'string' ? d.diagnosis : JSON.stringify(d.diagnosis)}`; if (d.status) text += ` (${typeof d.status === 'string' ? d.status : JSON.stringify(d.status)})`; if (d.type) text += ` [${d.type}]`; text += '\n'; });
      text += '\n';
    }
    if (doc.anesthesiologyAssessment?.asaClassification) { text += `ASA CLASSIFICATION: ${doc.anesthesiologyAssessment.asaClassification}\n\n`; }
    if (doc.medicalHistory) {
      text += `MEDICAL HISTORY:\n`;
      if (doc.medicalHistory.pastMedicalHistory && doc.medicalHistory.pastMedicalHistory.length > 0) {
        text += `\nPast Medical History:\n`;
        doc.medicalHistory.pastMedicalHistory.forEach(item => { text += `- ${typeof item.condition === 'string' ? item.condition : JSON.stringify(item.condition)}`; if (item.diagnosedDate) text += ` (diagnosed ${item.diagnosedDate})`; if (item.status) text += ` - ${typeof item.status === 'string' ? item.status : JSON.stringify(item.status)}`; text += '\n'; });
      }
      if (doc.medicalHistory.surgicalHistory && doc.medicalHistory.surgicalHistory.length > 0) {
        text += `\nSurgical History:\n`;
        doc.medicalHistory.surgicalHistory.forEach(surgery => { text += `- ${surgery.procedure}`; if (surgery.date) text += ` (${surgery.date})`; if (surgery.complications) text += ` - Complications: ${surgery.complications}`; text += '\n'; });
      }
      if (doc.medicalHistory.familyHistory && doc.medicalHistory.familyHistory.length > 0) {
        text += `\nFamily History:\n`;
        doc.medicalHistory.familyHistory.forEach(item => { text += `- ${item.condition}`; if (item.relationship) text += ` (${item.relationship})`; text += '\n'; });
      }
      if (doc.medicalHistory.socialHistory) {
        text += `\nSocial History:\n`;
        if (doc.medicalHistory.socialHistory.tobacco) {
          const tobacco = typeof doc.medicalHistory.socialHistory.tobacco === 'string' ? doc.medicalHistory.socialHistory.tobacco : (doc.medicalHistory.socialHistory.tobacco.status || JSON.stringify(doc.medicalHistory.socialHistory.tobacco));
          text += `Tobacco: ${tobacco}\n`;
        }
        if (doc.medicalHistory.socialHistory.alcohol) {
          const alcohol = typeof doc.medicalHistory.socialHistory.alcohol === 'string' ? doc.medicalHistory.socialHistory.alcohol : (doc.medicalHistory.socialHistory.alcohol.status || JSON.stringify(doc.medicalHistory.socialHistory.alcohol));
          text += `Alcohol: ${alcohol}\n`;
        }
        if (doc.medicalHistory.socialHistory.drugs) { text += `Substance Use: ${JSON.stringify(doc.medicalHistory.socialHistory.drugs)}\n`; }
        if (doc.medicalHistory.socialHistory.occupation) { text += `Occupation: ${doc.medicalHistory.socialHistory.occupation}\n`; }
      }
      text += '\n';
    }
    if (doc.reviewOfSystems) { text += `REVIEW OF SYSTEMS:\n${formatObjectToText(doc.reviewOfSystems)}\n`; }
    if (doc.vitalSigns) {
      text += `VITAL SIGNS:\n`;
      if (doc.vitalSigns.bloodPressure) text += `Blood Pressure: ${doc.vitalSigns.bloodPressure}\n`;
      if (doc.vitalSigns.heartRate) text += `Heart Rate: ${doc.vitalSigns.heartRate}\n`;
      if (doc.vitalSigns.respiratoryRate) text += `Respiratory Rate: ${doc.vitalSigns.respiratoryRate}\n`;
      if (doc.vitalSigns.oxygenSaturation) text += `O2 Saturation: ${doc.vitalSigns.oxygenSaturation}\n`;
      if (doc.vitalSigns.temperature) text += `Temperature: ${doc.vitalSigns.temperature}\n`;
      if (doc.vitalSigns.bmi) text += `BMI: ${doc.vitalSigns.bmi}\n`;
      if (doc.vitalSigns.height) { const height = typeof doc.vitalSigns.height === 'string' ? doc.vitalSigns.height : (doc.vitalSigns.height.raw || `${doc.vitalSigns.height.cm} cm`); text += `Height: ${height}\n`; }
      if (doc.vitalSigns.weight) { const weight = typeof doc.vitalSigns.weight === 'string' ? doc.vitalSigns.weight : (doc.vitalSigns.weight.raw || JSON.stringify(doc.vitalSigns.weight)); text += `Weight: ${weight}\n`; }
      text += '\n';
    }
    if (doc.physicalExamination && typeof doc.physicalExamination === 'object') {
      text += `PHYSICAL EXAMINATION:\n`;
      Object.entries(doc.physicalExamination).forEach(([system, findings]) => { text += `${system}: ${typeof findings === 'object' ? JSON.stringify(findings) : findings}\n`; });
      text += '\n';
    }
    if (doc.anesthesiologyAssessment?.anesthesiaPlan) {
      text += `ANESTHESIA PLAN:\n`;
      if (doc.anesthesiologyAssessment.anesthesiaPlan.technique) text += `Technique: ${doc.anesthesiologyAssessment.anesthesiaPlan.technique}\n`;
      if (doc.anesthesiologyAssessment.anesthesiaPlan.rationale) text += `Rationale: ${doc.anesthesiologyAssessment.anesthesiaPlan.rationale}\n`;
      if (doc.anesthesiologyAssessment.anesthesiaPlan.riskAssessment) text += `Risk Assessment: ${doc.anesthesiologyAssessment.anesthesiaPlan.riskAssessment}\n`;
      if (doc.anesthesiologyAssessment.anesthesiaPlan.backupPlan) text += `Backup Plan: ${doc.anesthesiologyAssessment.anesthesiaPlan.backupPlan}\n`;
      if (doc.anesthesiologyAssessment.anesthesiaPlan.specialConsiderations) text += `Special Considerations: ${doc.anesthesiologyAssessment.anesthesiaPlan.specialConsiderations}\n`;
      text += '\n';
    }
    if (doc.anesthesiologyAssessment?.airwayAssessment) { text += `AIRWAY ASSESSMENT:\n${formatObjectToText(doc.anesthesiologyAssessment.airwayAssessment)}\n`; }
    if (doc.anesthesiologyAssessment?.painManagement) { text += `PAIN MANAGEMENT:\n${formatObjectToText(doc.anesthesiologyAssessment.painManagement)}\n`; }
    if (doc.labResults && doc.labResults.length > 0) {
      text += `LABORATORY RESULTS:\n`;
      doc.labResults.forEach(lab => { text += `${lab.testName}: ${lab.value}`; if (lab.unit) text += ` ${lab.unit}`; if (lab.interpretation) text += ` - ${lab.interpretation}`; text += '\n'; });
      text += '\n';
    }
    if (doc.imaging && doc.imaging.length > 0) {
      text += `IMAGING STUDIES:\n`;
      doc.imaging.forEach(img => { text += `${img.modality} (${img.bodyPart}): ${img.impression || img.findings}\n`; });
      text += '\n';
    }
    if (doc.clinicalScores) { text += `CLINICAL SCORES:\n${formatObjectToText(doc.clinicalScores)}\n`; }
    if (doc.pulmonaryFunctionTests) { text += `PULMONARY FUNCTION TESTS:\n${formatObjectToText(doc.pulmonaryFunctionTests)}\n`; }
    if (doc.sleepStudy) { text += `SLEEP STUDY:\n${formatObjectToText(doc.sleepStudy)}\n`; }
    if (doc.operativeDetails) { text += `OPERATIVE DETAILS:\n${formatObjectToText(doc.operativeDetails)}\n`; }
    if (doc.preoperativePreparation) { text += `PREOPERATIVE PREPARATION:\n${formatObjectToText(doc.preoperativePreparation)}\n`; }
    if (doc.dvtProphylaxis) { text += `DVT PROPHYLAXIS:\n${formatObjectToText(doc.dvtProphylaxis)}\n`; }
    if (doc.postoperativeOrders) { text += `POSTOPERATIVE ORDERS:\n${formatObjectToText(doc.postoperativeOrders)}\n`; }
    if (doc.referrals && doc.referrals.length > 0) {
      text += `REFERRALS:\n`;
      doc.referrals.forEach(ref => { text += `- ${ref.specialty}: ${ref.reason}`; if (ref.urgency) text += ` (${ref.urgency})`; text += '\n'; });
      text += '\n';
    }
    if (doc.followUpAppointments && doc.followUpAppointments.length > 0) {
      text += `FOLLOW-UP APPOINTMENTS:\n`;
      doc.followUpAppointments.forEach(appt => { text += `- ${appt.specialty}: ${appt.reason}`; if (appt.timing) text += ` (${appt.timing})`; if (appt.provider) text += ` with ${appt.provider}`; if (appt.scheduledDate) text += ` on ${appt.scheduledDate}`; if (appt.status) text += ` - ${appt.status}`; text += '\n'; });
      text += '\n';
    }
    if (doc.patientEducation) { text += `PATIENT EDUCATION:\n${formatObjectToText(doc.patientEducation)}\n`; }
    if (doc.clinicalDecisionSupport) { text += `CLINICAL DECISION SUPPORT:\n${formatObjectToText(doc.clinicalDecisionSupport)}\n`; }
    if (doc.giRiskAssessment) { text += `GI RISK ASSESSMENT:\n${formatObjectToText(doc.giRiskAssessment)}\n`; }
    if (doc.respiratoryDevices) { text += `RESPIRATORY DEVICES:\n${formatObjectToText(doc.respiratoryDevices)}\n`; }
    if (doc.functionalStatus) { text += `FUNCTIONAL STATUS:\n${formatObjectToText(doc.functionalStatus)}\n`; }
    if (doc.neurologicalExam) { text += `NEUROLOGICAL EXAM:\n${formatObjectToText(doc.neurologicalExam)}\n`; }
    if (doc.peripheralNeuropathy) { text += `PERIPHERAL NEUROPATHY:\n${formatObjectToText(doc.peripheralNeuropathy)}\n`; }
    if (doc.assessmentAndPlan) { text += `ASSESSMENT AND PLAN:\n${doc.assessmentAndPlan}\n\n`; }
    if (doc.additionalNotes) { text += `ADDITIONAL NOTES:\n${doc.additionalNotes}\n\n`; }
    if (doc.administrativeData) { text += `ADMINISTRATIVE DATA:\n${formatObjectToText(doc.administrativeData)}\n`; }
    if (doc.consultationDetails) {
      text += `CONSULTATION DETAILS:\n`;
      if (doc.consultationDetails.consultingPhysician) text += `Physician: ${doc.consultationDetails.consultingPhysician}\n`;
      if (doc.consultationDetails.consultingSpecialty) text += `Specialty: ${doc.consultationDetails.consultingSpecialty}\n`;
      if (doc.consultationDetails.consultationDate) text += `Date: ${formatDate(doc.consultationDetails.consultationDate)}\n`;
      if (doc.consultationDetails.consultationReason) text += `Reason: ${doc.consultationDetails.consultationReason}\n`;
    }
    await copyToClipboard(text);
    setCopiedItemIndex('all');
    setTimeout(() => setCopiedItemIndex(null), 2000);
  };


  if (!doc || (!doc.chiefComplaint && !doc.historyOfPresentIllness && !doc.anesthesiologyAssessment)) {
    return (
      <div ref={containerRef} className="anesthesia-document">
        <div className="empty-state">
          <div className="empty-icon">🏥</div>
          <p className="empty-text">No anesthesia preoperative consultation recorded</p>
        </div>
      </div>
    );
  }


  return (
    <div ref={containerRef} className="anesthesia-document">
      {/* Header */}
      <div className="document-header">
        <h1 className="document-title">Anesthesia Preoperative Consultation</h1>
        {!searchTerm && doc.date && (
          <p className="document-date">{formatDate(doc.date)}</p>
        )}
        <div className="action-buttons-row">
          <button onClick={copyAll} className="action-btn">
            {copiedItemIndex === 'all' ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<AnesthesiaDocumentPDFTemplate document={pdfData} />}
            fileName={`anesthesia-preop-consultation-${Date.now()}.pdf`}
            className="action-btn"
          >
            {({ loading }) => (loading ? 'Preparing PDF...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '24px' }}>
        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          placeholder="Search consultation..."
          totalCount={searchableItems.length}
          filteredCount={filteredItems.length}
        />
      </div>

      {/* Patient Demographics - NON-EDITABLE */}
      {!searchTerm && (doc.patientName || doc.age || doc.gender || doc.mrn) && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">👤</span>
              Patient Information
            </h2>
            <button
              onClick={() => {
                let text = 'Patient Information:\n';
                if (doc.patientName) text += `Name: ${doc.patientName}\n`;
                if (doc.age) text += `Age: ${doc.age}\n`;
                if (doc.gender) text += `Gender: ${doc.gender}\n`;
                if (doc.mrn) text += `MRN: ${doc.mrn}\n`;
                if (doc.dateOfBirth) text += `Date of Birth: ${formatDate(doc.dateOfBirth)}\n`;
                copySection(text, 'patient-info');
              }}
              className="section-copy-btn"
            >
              <CopyIcon />
              {copiedItemIndex === 'patient-info' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="info-card">
            {doc.patientName && <p className="info-field"><strong>Name:</strong> {doc.patientName}</p>}
            {doc.age && <p className="info-field"><strong>Age:</strong> {doc.age}</p>}
            {doc.gender && <p className="info-field"><strong>Gender:</strong> {doc.gender}</p>}
            {doc.mrn && <p className="info-field"><strong>MRN:</strong> {doc.mrn}</p>}
            {doc.dateOfBirth && <p className="info-field"><strong>Date of Birth:</strong> {formatDate(doc.dateOfBirth)}</p>}
          </div>
        </section>
      )}

      {/* Chief Complaint - EDITABLE */}
      {showChiefComplaint && doc.chiefComplaint && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">📋</span>
              {highlightText('Chief Complaint')}
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Chief Complaint:\n${doc.chiefComplaint.complaint}\n${doc.chiefComplaint.duration ? `Duration: ${doc.chiefComplaint.duration}` : ''}`, 'chief-complaint')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'chief-complaint' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'chiefComplaint', idx)}
            </div>
          </div>
          <div className="content-card">
            {renderEditableField(record, 'chiefComplaint.complaint', idx, 'chiefComplaint', 'Complaint', 'cc-complaint')}
            {doc.chiefComplaint.duration && renderEditableField(record, 'chiefComplaint.duration', idx, 'chiefComplaint', 'Duration', 'cc-duration')}
          </div>
        </section>
      )}

      {/* History of Present Illness - EDITABLE sentence field */}
      {showHPI && doc.historyOfPresentIllness && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">📝</span>
              {highlightText('History of Present Illness')}
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`History of Present Illness:\n${doc.historyOfPresentIllness}`, 'hpi')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'hpi' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'hpi', idx)}
            </div>
          </div>
          <div className="content-card">
            {renderSentenceEditableField(record, 'historyOfPresentIllness', idx, 'hpi', false, 'hpi-field')}
          </div>
        </section>
      )}

      {/* Allergies - EDITABLE per-item */}
      {showAllergies && doc.allergies && doc.allergies.length > 0 && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title alert-title">
              <span className="section-icon">⚠️</span>
              {highlightText('Allergies')}
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Allergies:\n${doc.allergies.map(a => `- ${a.allergen}: ${a.reaction} (${a.severity})`).join('\n')}`, 'allergies')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'allergies' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'allergies', idx)}
            </div>
          </div>
          <div className="cards-grid">
            {[...doc.allergies]
              .sort((a, b) => {
                const severityOrder = { 'severe': 0, 'critical': 0, 'moderate': 1, 'mild': 2, 'low': 3 };
                const severityA = severityOrder[a.severity?.toLowerCase()] ?? 4;
                const severityB = severityOrder[b.severity?.toLowerCase()] ?? 4;
                if (severityA !== severityB) return severityA - severityB;
                return (a.allergen || '').localeCompare(b.allergen || '');
              })
              .map((allergy, aIdx) => (
              <div key={aIdx} className="allergy-card-full">
                <div className="allergy-top-right">
                  <h3 className="allergy-title">{highlightText(allergy.allergen)}</h3>
                  <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                    <span className={`severity-badge severity-${allergy.severity?.toLowerCase()}`}>
                      {highlightText(allergy.severity?.toUpperCase() || 'UNKNOWN')}
                    </span>
                    <button onClick={() => copySection(`${allergy.allergen}\nReaction: ${allergy.reaction}\nSeverity: ${allergy.severity}`, `allergy-${aIdx}`)} className="allergy-copy-btn">
                      <CopyIcon size={10} />
                      {copiedItemIndex === `allergy-${aIdx}` ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div className="allergy-content">
                  {renderEditableField(record, `allergies.${aIdx}.allergen`, idx, 'allergies', 'Allergen', `allergy-allergen-${aIdx}`)}
                  {renderEditableField(record, `allergies.${aIdx}.reaction`, idx, 'allergies', 'Reaction', `allergy-reaction-${aIdx}`)}
                  {renderEditableField(record, `allergies.${aIdx}.severity`, idx, 'allergies', 'Severity', `allergy-severity-${aIdx}`)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}


      {/* Medications - EDITABLE per-item */}
      {showMedications && doc.medications && doc.medications.length > 0 && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">💊</span>
              {highlightText('Current Medications')}
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Current Medications:\n${doc.medications.map(m => `- ${m.name} ${m.dosage} ${m.frequency} - ${m.indication || ''} (${m.status})`).join('\n')}`, 'medications')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'medications' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'medications', idx)}
            </div>
          </div>
          <div className="medications-list">
            {doc.medications.map((med, mIdx) => (
              <div key={mIdx} className="medication-card">
                <div className="medication-top-row">
                  <span className="medication-name">{highlightText(med.name)}</span>
                  <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                    <span className={`status-badge status-${typeof med.status === 'string' ? med.status.toLowerCase() : 'unknown'}`}>
                      {highlightText(typeof med.status === 'string' ? med.status : (typeof med.status === 'object' && med.status !== null ? JSON.stringify(med.status) : 'unknown'))}
                    </span>
                    <button onClick={() => {
                      let text = `${med.name}\n`;
                      Object.entries(med).forEach(([key, value]) => {
                        if (key !== 'name' && value) {
                          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
                          text += `${label}: ${typeof value === 'object' ? JSON.stringify(value) : value}\n`;
                        }
                      });
                      copySubsection(text, `med-${mIdx}`);
                    }} className="medication-copy-btn">
                      <CopyIcon size={10} />
                      {copiedItemIndex === `med-${mIdx}` ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div className="medication-content">
                  <div className="medication-details">
                    {renderEditableField(record, `medications.${mIdx}.name`, idx, 'medications', 'Name', `med-name-${mIdx}`)}
                    {renderEditableField(record, `medications.${mIdx}.dosage`, idx, 'medications', 'Dosage', `med-dosage-${mIdx}`)}
                    {renderEditableField(record, `medications.${mIdx}.frequency`, idx, 'medications', 'Frequency', `med-frequency-${mIdx}`)}
                    {med.route && renderEditableField(record, `medications.${mIdx}.route`, idx, 'medications', 'Route', `med-route-${mIdx}`)}
                    {med.indication && renderEditableField(record, `medications.${mIdx}.indication`, idx, 'medications', 'Indication', `med-indication-${mIdx}`)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Diagnoses - EDITABLE per-item */}
      {showDiagnoses && doc.diagnoses && doc.diagnoses.length > 0 && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">🩺</span>
              {highlightText('Diagnoses')}
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Diagnoses:\n${doc.diagnoses.map(d => `- ${d.diagnosis} (${d.status}, ${d.type})`).join('\n')}`, 'diagnoses')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'diagnoses' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'diagnoses', idx)}
            </div>
          </div>
          <div className="diagnoses-list">
            {doc.diagnoses.map((dx, dIdx) => (
              <div key={dIdx} className="diagnosis-card">
                <div className="diagnosis-top-row">
                  <span className="diagnosis-name">{highlightText(dx.diagnosis)}</span>
                  <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                    <span className={`status-badge status-${typeof dx.status === 'string' ? dx.status.toLowerCase() : 'unknown'}`}>
                      {highlightText(typeof dx.status === 'string' ? dx.status : (typeof dx.status === 'object' && dx.status !== null ? JSON.stringify(dx.status) : 'unknown'))}
                    </span>
                    <button onClick={() => {
                      let text = `${dx.diagnosis}\n`;
                      Object.entries(dx).forEach(([key, value]) => {
                        if (key !== 'diagnosis' && value) {
                          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
                          text += `${label}: ${typeof value === 'object' ? JSON.stringify(value) : value}\n`;
                        }
                      });
                      copySubsection(text, `dx-${dIdx}`);
                    }} className="diagnosis-copy-btn">
                      <CopyIcon size={10} />
                      {copiedItemIndex === `dx-${dIdx}` ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div className="diagnosis-content">
                  <div className="diagnosis-details">
                    {renderEditableField(record, `diagnoses.${dIdx}.diagnosis`, idx, 'diagnoses', 'Diagnosis', `dx-diag-${dIdx}`)}
                    {dx.icd10 && renderEditableField(record, `diagnoses.${dIdx}.icd10`, idx, 'diagnoses', 'ICD-10', `dx-icd10-${dIdx}`)}
                    {dx.status && renderEditableField(record, `diagnoses.${dIdx}.status`, idx, 'diagnoses', 'Status', `dx-status-${dIdx}`)}
                    {dx.type && renderEditableField(record, `diagnoses.${dIdx}.type`, idx, 'diagnoses', 'Type', `dx-type-${dIdx}`)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ASA Classification - EDITABLE */}
      {showAnesthesiaAssessment && doc.anesthesiologyAssessment?.asaClassification && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title alert-title">
              <span className="section-icon">🏥</span>
              {highlightText('ASA Physical Status Classification')}
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`ASA Classification: ${doc.anesthesiologyAssessment.asaClassification}`, 'asa')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'asa' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'anesthesiologyAssessment', idx)}
            </div>
          </div>
          <div className="content-card asa-card">
            {renderEditableField(record, 'anesthesiologyAssessment.asaClassification', idx, 'anesthesiologyAssessment', 'ASA Classification', 'asa-class')}
          </div>
        </section>
      )}


      {/* Medical History - EDITABLE */}
      {showMedicalHistory && doc.medicalHistory && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">📚</span>
              {highlightText('Medical History')}
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Medical History:\n${JSON.stringify(doc.medicalHistory, null, 2)}`, 'medical-history')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'medical-history' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'medicalHistory', idx)}
            </div>
          </div>

          {/* Past Medical History */}
          {doc.medicalHistory.pastMedicalHistory && doc.medicalHistory.pastMedicalHistory.length > 0 && (
            <div className="subsection">
              <h3 className="subsection-title">{highlightText('Past Medical History')}</h3>
              <div className="pmh-list">
                {doc.medicalHistory.pastMedicalHistory.map((item, pIdx) => (
                  <div key={pIdx} className="pmh-card">
                    <div className="pmh-top-row">
                      <span className="pmh-condition">{highlightText(item.condition)}</span>
                      <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                        <span className={`status-badge status-${typeof item.status === 'string' ? item.status.toLowerCase() : 'unknown'}`}>
                          {highlightText(typeof item.status === 'string' ? item.status : (typeof item.status === 'object' && item.status !== null ? JSON.stringify(item.status) : 'unknown'))}
                        </span>
                        <button onClick={() => copySubsection(`${item.condition}\nStatus: ${item.status || 'N/A'}${item.bmiValue ? `\nBMI: ${item.bmiValue}` : ''}`, `pmh-${pIdx}`)} className="pmh-copy-btn">
                          <CopyIcon size={10} />
                          {copiedItemIndex === `pmh-${pIdx}` ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    <div className="pmh-content">
                      {renderEditableField(record, `medicalHistory.pastMedicalHistory.${pIdx}.condition`, idx, 'medicalHistory', 'Condition', `pmh-cond-${pIdx}`)}
                      {renderEditableField(record, `medicalHistory.pastMedicalHistory.${pIdx}.status`, idx, 'medicalHistory', 'Status', `pmh-status-${pIdx}`)}
                      {item.diagnosedDate && renderEditableField(record, `medicalHistory.pastMedicalHistory.${pIdx}.diagnosedDate`, idx, 'medicalHistory', 'Diagnosed Date', `pmh-date-${pIdx}`)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Surgical History */}
          {doc.medicalHistory.surgicalHistory && doc.medicalHistory.surgicalHistory.length > 0 && (
            <div className="subsection">
              <h3 className="subsection-title">{highlightText('Surgical History')}</h3>
              <div className="cards-grid">
                {doc.medicalHistory.surgicalHistory.map((surgery, sIdx) => (
                  <div key={sIdx} className="content-card">
                    <button onClick={() => {
                      let text = `Surgery: ${surgery.procedure}\n`;
                      Object.entries(surgery).forEach(([key, value]) => {
                        if (key !== 'procedure' && value) {
                          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
                          text += `${label}: ${typeof value === 'object' ? JSON.stringify(value) : value}\n`;
                        }
                      });
                      copySection(text, `surgery-${sIdx}`);
                    }} className="card-copy-btn">
                      <CopyIcon size={10} />
                      {copiedItemIndex === `surgery-${sIdx}` ? 'Copied!' : 'Copy'}
                    </button>
                    <div className="card-content">
                      {renderEditableField(record, `medicalHistory.surgicalHistory.${sIdx}.procedure`, idx, 'medicalHistory', 'Procedure', `surg-proc-${sIdx}`)}
                      {surgery.date && renderEditableField(record, `medicalHistory.surgicalHistory.${sIdx}.date`, idx, 'medicalHistory', 'Date', `surg-date-${sIdx}`)}
                      {surgery.complications && renderEditableField(record, `medicalHistory.surgicalHistory.${sIdx}.complications`, idx, 'medicalHistory', 'Complications', `surg-comp-${sIdx}`)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Family History */}
          {doc.medicalHistory.familyHistory?.conditions && doc.medicalHistory.familyHistory.conditions.length > 0 && (
            <div className="subsection">
              <h3 className="subsection-title">{highlightText('Family History')}</h3>
              <div className="cards-grid">
                {doc.medicalHistory.familyHistory.conditions.map((fam, fIdx) => (
                  <div key={fIdx} className="content-card">
                    <button onClick={() => copySection(`Family History:\nRelationship: ${fam.relationship}\nCondition: ${fam.condition}`, `family-${fIdx}`)} className="card-copy-btn">
                      <CopyIcon size={10} />
                      {copiedItemIndex === `family-${fIdx}` ? 'Copied!' : 'Copy'}
                    </button>
                    <div className="card-content">
                      {renderEditableField(record, `medicalHistory.familyHistory.conditions.${fIdx}.relationship`, idx, 'medicalHistory', 'Relationship', `fam-rel-${fIdx}`)}
                      {renderEditableField(record, `medicalHistory.familyHistory.conditions.${fIdx}.condition`, idx, 'medicalHistory', 'Condition', `fam-cond-${fIdx}`)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Social History */}
          {doc.medicalHistory.socialHistory && (
            <div className="subsection">
              <h3 className="subsection-title">{highlightText('Social History')}</h3>
              <div className="info-card">
                {doc.medicalHistory.socialHistory.tobacco && (
                  <div className="info-field-with-copy">
                    {renderEditableField(record, 'medicalHistory.socialHistory.tobacco.status', idx, 'medicalHistory', 'Tobacco', 'social-tobacco')}
                  </div>
                )}
                {doc.medicalHistory.socialHistory.alcohol && (
                  <div className="info-field-with-copy">
                    {renderEditableField(record, 'medicalHistory.socialHistory.alcohol.status', idx, 'medicalHistory', 'Alcohol', 'social-alcohol')}
                  </div>
                )}
                {doc.medicalHistory.socialHistory.drugs && (
                  <div className="info-field-with-copy">
                    <p className="info-field"><strong>{highlightText('Substance Use:')}</strong> {highlightText(JSON.stringify(doc.medicalHistory.socialHistory.drugs))}</p>
                    <button onClick={() => copySection(`Substance Use: ${JSON.stringify(doc.medicalHistory.socialHistory.drugs)}`, 'social-drugs')} className="field-copy-btn">
                      <CopyIcon size={10} />
                      {copiedItemIndex === 'social-drugs' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                )}
                {doc.medicalHistory.socialHistory.occupation && (
                  <div className="info-field-with-copy">
                    {renderEditableField(record, 'medicalHistory.socialHistory.occupation', idx, 'medicalHistory', 'Occupation', 'social-occupation')}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Review of Systems - EDITABLE dynamic object */}
      {showROS && doc.reviewOfSystems && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">🔬</span>
              {highlightText('Review of Systems')}
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Review of Systems:\n${JSON.stringify(doc.reviewOfSystems, null, 2)}`, 'ros')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'ros' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'reviewOfSystems', idx)}
            </div>
          </div>
          <div className="info-card">
            {renderDynamicObjectField(record, 'reviewOfSystems', idx, 'reviewOfSystems')}
          </div>
        </section>
      )}


      {/* Vital Signs - EDITABLE */}
      {showVitals && doc.vitalSigns && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">❤️</span>
              {highlightText('Vital Signs')}
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Vital Signs:\n${JSON.stringify(doc.vitalSigns, null, 2)}`, 'vitals')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'vitals' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'vitalSigns', idx)}
            </div>
          </div>
          <div className="vitals-container">
            {doc.vitalSigns.bloodPressure && renderEditableField(record, 'vitalSigns.bloodPressure', idx, 'vitalSigns', 'Blood Pressure', 'vital-bp')}
            {doc.vitalSigns.heartRate && renderEditableField(record, 'vitalSigns.heartRate', idx, 'vitalSigns', 'Heart Rate', 'vital-hr')}
            {doc.vitalSigns.respiratoryRate && renderEditableField(record, 'vitalSigns.respiratoryRate', idx, 'vitalSigns', 'Respiratory Rate', 'vital-rr')}
            {doc.vitalSigns.oxygenSaturation && renderEditableField(record, 'vitalSigns.oxygenSaturation', idx, 'vitalSigns', 'O2 Saturation', 'vital-o2')}
            {doc.vitalSigns.temperature && renderEditableField(record, 'vitalSigns.temperature', idx, 'vitalSigns', 'Temperature', 'vital-temp')}
            {doc.vitalSigns.bmi && renderEditableField(record, 'vitalSigns.bmi', idx, 'vitalSigns', 'BMI', 'vital-bmi')}
            {doc.vitalSigns.height && renderEditableField(record, 'vitalSigns.height', idx, 'vitalSigns', 'Height', 'vital-height')}
            {doc.vitalSigns.weight && renderEditableField(record, 'vitalSigns.weight', idx, 'vitalSigns', 'Weight', 'vital-weight')}
          </div>
        </section>
      )}

      {/* Physical Examination - EDITABLE dynamic */}
      {showPhysicalExam && doc.physicalExamination && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">🩺</span>
              {highlightText('Physical Examination')}
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Physical Examination:\n${JSON.stringify(doc.physicalExamination, null, 2)}`, 'physical-exam')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'physical-exam' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'physicalExamination', idx)}
            </div>
          </div>
          <div className="info-card">
            {typeof doc.physicalExamination === 'object' && !Array.isArray(doc.physicalExamination) ? (
              Object.entries(doc.physicalExamination).map(([system, findings]) => {
                if (typeof findings === 'object' && findings !== null && !Array.isArray(findings)) {
                  return (
                    <div key={system} className="exam-system-with-copy">
                      <div className="exam-system">
                        <div className="exam-system-header">
                          <h4 className="exam-system-title">{highlightText(system.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()))}</h4>
                        </div>
                        {Object.entries(findings).map(([key, value]) => (
                          renderEditableField(record, `physicalExamination.${system}.${key}`, idx, 'physicalExamination', key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), `exam-${system}-${key}`)
                        ))}
                      </div>
                    </div>
                  );
                }
                return renderEditableField(record, `physicalExamination.${system}`, idx, 'physicalExamination', system.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), `exam-${system}`);
              })
            ) : (
              renderDynamicObjectField(record, 'physicalExamination', idx, 'physicalExamination')
            )}
          </div>
        </section>
      )}

      {/* Anesthesia Plan - EDITABLE */}
      {showAnesthesiaAssessment && doc.anesthesiologyAssessment?.anesthesiaPlan && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">💉</span>
              {highlightText('Anesthesia Plan')}
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Anesthesia Plan:\n${JSON.stringify(doc.anesthesiologyAssessment.anesthesiaPlan, null, 2)}`, 'anesthesia-plan')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'anesthesia-plan' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'anesthesiologyAssessment', idx)}
            </div>
          </div>
          <div className="content-card">
            {renderEditableField(record, 'anesthesiologyAssessment.anesthesiaPlan.technique', idx, 'anesthesiologyAssessment', 'Technique', 'ap-technique')}
            {doc.anesthesiologyAssessment.anesthesiaPlan.rationale && renderEditableField(record, 'anesthesiologyAssessment.anesthesiaPlan.rationale', idx, 'anesthesiologyAssessment', 'Rationale', 'ap-rationale')}
          </div>
          {doc.anesthesiologyAssessment.anesthesiaPlan.riskAssessment && (
            <div className="content-card alert-critical">
              <h3 className="card-title">{highlightText('⚠️ Risk Assessment')}</h3>
              {renderEditableField(record, 'anesthesiologyAssessment.anesthesiaPlan.riskAssessment', idx, 'anesthesiologyAssessment', 'Risk Assessment', 'ap-risk')}
            </div>
          )}
          {doc.anesthesiologyAssessment.anesthesiaPlan.backupPlan && (
            <div className="content-card recommendation-card">
              <h3 className="card-title">{highlightText('Backup Plan')}</h3>
              {renderEditableField(record, 'anesthesiologyAssessment.anesthesiaPlan.backupPlan', idx, 'anesthesiologyAssessment', 'Backup Plan', 'ap-backup')}
            </div>
          )}
          {doc.anesthesiologyAssessment.anesthesiaPlan.specialConsiderations && (
            <div className="content-card info-card-blue">
              <h3 className="card-title">{highlightText('Special Considerations')}</h3>
              {renderEditableField(record, 'anesthesiologyAssessment.anesthesiaPlan.specialConsiderations', idx, 'anesthesiologyAssessment', 'Special Considerations', 'ap-special')}
            </div>
          )}
        </section>
      )}

      {/* Airway Assessment - EDITABLE */}
      {showAnesthesiaAssessment && doc.anesthesiologyAssessment?.airwayAssessment && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title alert-title">
              <span className="section-icon">🫁</span>
              {highlightText('Airway Assessment')}
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Airway Assessment:\n${JSON.stringify(doc.anesthesiologyAssessment.airwayAssessment, null, 2)}`, 'airway')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'airway' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'anesthesiologyAssessment', idx)}
            </div>
          </div>
          <div className="info-card">
            {Object.entries(doc.anesthesiologyAssessment.airwayAssessment).map(([key, value]) => (
              renderEditableField(record, `anesthesiologyAssessment.airwayAssessment.${key}`, idx, 'anesthesiologyAssessment', key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), `airway-${key}`)
            ))}
          </div>
        </section>
      )}

      {/* Pain Management - EDITABLE */}
      {showAnesthesiaAssessment && doc.anesthesiologyAssessment?.painManagement && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">💊</span>
              {highlightText('Pain Management Assessment')}
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Pain Management:\n${JSON.stringify(doc.anesthesiologyAssessment.painManagement, null, 2)}`, 'pain-mgmt')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'pain-mgmt' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'anesthesiologyAssessment', idx)}
            </div>
          </div>
          <div className="info-card">
            {doc.anesthesiologyAssessment.painManagement.currentPainScore !== undefined && renderEditableField(record, 'anesthesiologyAssessment.painManagement.currentPainScore', idx, 'anesthesiologyAssessment', 'Current Pain Score', 'pain-score')}
            {doc.anesthesiologyAssessment.painManagement.chronicPain !== undefined && renderEditableField(record, 'anesthesiologyAssessment.painManagement.chronicPain', idx, 'anesthesiologyAssessment', 'Chronic Pain', 'pain-chronic')}
            {doc.anesthesiologyAssessment.painManagement.opioidTolerance !== undefined && renderEditableField(record, 'anesthesiologyAssessment.painManagement.opioidTolerance', idx, 'anesthesiologyAssessment', 'Opioid Tolerance', 'pain-opioid')}
            {doc.anesthesiologyAssessment.painManagement.plan && renderEditableField(record, 'anesthesiologyAssessment.painManagement.plan', idx, 'anesthesiologyAssessment', 'Plan', 'pain-plan')}
            {doc.anesthesiologyAssessment.painManagement.currentAnalgesics && (
              <div className="subsection">
                <h4 className="subsection-title">{highlightText('Current Analgesics')}</h4>
                {doc.anesthesiologyAssessment.painManagement.currentAnalgesics.map((med, aIdx) => (
                  <p key={aIdx} className="info-field">{highlightText(med.medication || JSON.stringify(med))}</p>
                ))}
              </div>
            )}
          </div>
        </section>
      )}


      {/* Lab Results - EDITABLE per-item */}
      {showLabs && doc.labResults && doc.labResults.length > 0 && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">🧪</span>
              {highlightText('Laboratory Results')}
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Laboratory Results:\n${doc.labResults.map(l => `${l.testName}: ${l.value} ${l.unit || ''} - ${l.interpretation || ''}`).join('\n')}`, 'labs')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'labs' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'labResults', idx)}
            </div>
          </div>
          <div className="lab-results-list">
            {doc.labResults
              .slice()
              .sort((a, b) => {
                const aHasFlag = a.flag ? 1 : 0;
                const bHasFlag = b.flag ? 1 : 0;
                if (bHasFlag !== aHasFlag) return bHasFlag - aHasFlag;
                return (a.testName || '').localeCompare(b.testName || '');
              })
              .map((lab, lIdx) => (
              <div key={lIdx} className="lab-result-card">
                <div className="lab-top-row">
                  {lab.flag && <span className="flag-badge flag-abnormal">{highlightText(lab.flag.toUpperCase())}</span>}
                  <button onClick={() => copySubsection(`${lab.testName}\nValue: ${lab.value} ${lab.unit || ''}\n${lab.flag ? `Flag: ${lab.flag}\n` : ''}${lab.interpretation ? `Interpretation: ${lab.interpretation}` : ''}`, `lab-${lIdx}`)} className="lab-copy-btn">
                    <CopyIcon size={10} />
                    {copiedItemIndex === `lab-${lIdx}` ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="lab-content">
                  {renderEditableField(record, `labResults.${lIdx}.testName`, idx, 'labResults', 'Test Name', `lab-name-${lIdx}`)}
                  {renderEditableField(record, `labResults.${lIdx}.value`, idx, 'labResults', 'Value', `lab-val-${lIdx}`)}
                  {lab.unit && renderEditableField(record, `labResults.${lIdx}.unit`, idx, 'labResults', 'Unit', `lab-unit-${lIdx}`)}
                  {lab.interpretation && renderEditableField(record, `labResults.${lIdx}.interpretation`, idx, 'labResults', 'Interpretation', `lab-interp-${lIdx}`)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Imaging - EDITABLE per-item */}
      {showImaging && doc.imaging && doc.imaging.length > 0 && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">🩻</span>
              {highlightText('Imaging Studies')}
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Imaging Studies:\n${doc.imaging.map(i => `${i.modality} (${i.bodyPart}): ${i.impression || i.findings}`).join('\n\n')}`, 'imaging')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'imaging' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'imaging', idx)}
            </div>
          </div>
          <div className="cards-grid">
            {doc.imaging.map((img, iIdx) => (
              <div key={iIdx} className="content-card">
                <div className="imaging-top-row">
                  <button onClick={() => copySubsection(`${img.modality} - ${img.bodyPart}\n${img.findings ? `Findings: ${img.findings}\n` : ''}${img.impression ? `Impression: ${img.impression}` : ''}`, `imaging-${iIdx}`)} className="imaging-copy-btn">
                    <CopyIcon size={10} />
                    {copiedItemIndex === `imaging-${iIdx}` ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="card-content">
                  {renderEditableField(record, `imaging.${iIdx}.modality`, idx, 'imaging', 'Modality', `img-mod-${iIdx}`)}
                  {renderEditableField(record, `imaging.${iIdx}.bodyPart`, idx, 'imaging', 'Body Part', `img-body-${iIdx}`)}
                  {img.findings && renderEditableField(record, `imaging.${iIdx}.findings`, idx, 'imaging', 'Findings', `img-find-${iIdx}`)}
                  {img.impression && renderEditableField(record, `imaging.${iIdx}.impression`, idx, 'imaging', 'Impression', `img-imp-${iIdx}`)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Clinical Scores - EDITABLE dynamic */}
      {showClinicalScores && doc.clinicalScores && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">📊</span>
              {highlightText('Clinical Scores & Risk Stratification')}
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Clinical Scores:\n${JSON.stringify(doc.clinicalScores, null, 2)}`, 'scores')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'scores' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'clinicalScores', idx)}
            </div>
          </div>
          <div className="scores-grid">
            {Object.entries(doc.clinicalScores).map(([scoreName, scoreData], sIdx) => {
              let scoreText = `${scoreName.toUpperCase()}\n`;
              if (typeof scoreData === 'object' && scoreData !== null) {
                scoreText += Object.entries(scoreData).map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1')}: ${value}`).join('\n');
              } else { scoreText += String(scoreData); }
              return (
                <div key={scoreName} className="score-card">
                  <div className="score-top-row">
                    <h3 className="score-name">{highlightText(scoreName.toUpperCase())}</h3>
                    <button onClick={() => copySubsection(scoreText, `score-${sIdx}`)} className="score-copy-btn">
                      <CopyIcon size={10} />
                      {copiedItemIndex === `score-${sIdx}` ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="score-content">
                    {typeof scoreData === 'object' && scoreData !== null ? (
                      Object.entries(scoreData).map(([key]) => (
                        renderEditableField(record, `clinicalScores.${scoreName}.${key}`, idx, 'clinicalScores', key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), `score-${scoreName}-${key}`)
                      ))
                    ) : (
                      renderEditableField(record, `clinicalScores.${scoreName}`, idx, 'clinicalScores', scoreName.toUpperCase(), `score-${scoreName}`)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}


      {/* Additional Notes - EDITABLE sentence field */}
      {!searchTerm && doc.additionalNotes && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">📝</span>
              Additional Notes
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Additional Notes:\n${doc.additionalNotes}`, 'notes')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'notes' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'additionalNotes', idx)}
            </div>
          </div>
          <div className="content-card">
            {renderSentenceEditableField(record, 'additionalNotes', idx, 'additionalNotes', false, 'notes-field')}
          </div>
        </section>
      )}

      {/* Assessment and Plan - EDITABLE sentence field */}
      {!searchTerm && doc.assessmentAndPlan && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title recommendation-title">
              <span className="section-icon">🎯</span>
              Assessment and Plan
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Assessment and Plan:\n${doc.assessmentAndPlan}`, 'assessment-plan')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'assessment-plan' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'assessmentAndPlan', idx)}
            </div>
          </div>
          <div className="content-card">
            {renderSentenceEditableField(record, 'assessmentAndPlan', idx, 'assessmentAndPlan', false, 'ap-field')}
          </div>
        </section>
      )}

      {/* Pulmonary Function Tests - EDITABLE dynamic */}
      {!searchTerm && doc.pulmonaryFunctionTests && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">🫁</span>
              Pulmonary Function Tests
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Pulmonary Function Tests:\n${formatObjectToText(doc.pulmonaryFunctionTests)}`, 'pft')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'pft' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'pulmonaryFunctionTests', idx)}
            </div>
          </div>
          <div className="content-card">
            {renderDynamicObjectField(record, 'pulmonaryFunctionTests', idx, 'pulmonaryFunctionTests')}
          </div>
        </section>
      )}

      {/* Sleep Study - EDITABLE */}
      {!searchTerm && doc.sleepStudy && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">😴</span>
              Sleep Study
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Sleep Study:\n${formatObjectToText(doc.sleepStudy)}`, 'sleep-study')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'sleep-study' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'sleepStudy', idx)}
            </div>
          </div>
          <div className="content-card">
            {doc.sleepStudy.ahi !== undefined && renderEditableField(record, 'sleepStudy.ahi', idx, 'sleepStudy', 'AHI', 'sleep-ahi')}
            {doc.sleepStudy.diagnosis && renderEditableField(record, 'sleepStudy.diagnosis', idx, 'sleepStudy', 'Diagnosis', 'sleep-diag')}
            {doc.sleepStudy.cpapUsage && renderEditableField(record, 'sleepStudy.cpapUsage', idx, 'sleepStudy', 'CPAP Usage', 'sleep-cpap')}
            {/* Remaining dynamic fields */}
            {Object.entries(doc.sleepStudy).filter(([key]) => !['ahi', 'diagnosis', 'cpapUsage'].includes(key)).map(([key]) => (
              renderEditableField(record, `sleepStudy.${key}`, idx, 'sleepStudy', key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), `sleep-${key}`)
            ))}
          </div>
        </section>
      )}

      {/* Operative Details - EDITABLE dynamic */}
      {!searchTerm && doc.operativeDetails && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">🏥</span>
              Operative Details
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Operative Details:\n${formatObjectToText(doc.operativeDetails)}`, 'operative')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'operative' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'operativeDetails', idx)}
            </div>
          </div>
          <div className="content-card">
            {renderDynamicObjectField(record, 'operativeDetails', idx, 'operativeDetails')}
          </div>
        </section>
      )}

      {/* Preoperative Preparation - EDITABLE dynamic */}
      {!searchTerm && doc.preoperativePreparation && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">📋</span>
              Preoperative Preparation
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Preoperative Preparation:\n${formatObjectToText(doc.preoperativePreparation)}`, 'preop-prep')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'preop-prep' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'preoperativePreparation', idx)}
            </div>
          </div>
          <div className="content-card">
            {renderDynamicObjectField(record, 'preoperativePreparation', idx, 'preoperativePreparation')}
          </div>
        </section>
      )}

      {/* DVT Prophylaxis - EDITABLE dynamic */}
      {!searchTerm && doc.dvtProphylaxis && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">💉</span>
              DVT Prophylaxis
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`DVT Prophylaxis:\n${formatObjectToText(doc.dvtProphylaxis)}`, 'dvt')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'dvt' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'dvtProphylaxis', idx)}
            </div>
          </div>
          <div className="content-card">
            {renderDynamicObjectField(record, 'dvtProphylaxis', idx, 'dvtProphylaxis')}
          </div>
        </section>
      )}

      {/* Postoperative Orders - EDITABLE dynamic */}
      {!searchTerm && doc.postoperativeOrders && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">📝</span>
              Postoperative Orders
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Postoperative Orders:\n${formatObjectToText(doc.postoperativeOrders)}`, 'postop')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'postop' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'postoperativeOrders', idx)}
            </div>
          </div>
          <div className="content-card">
            {renderDynamicObjectField(record, 'postoperativeOrders', idx, 'postoperativeOrders')}
          </div>
        </section>
      )}


      {/* Referrals - EDITABLE per-item */}
      {!searchTerm && doc.referrals && doc.referrals.length > 0 && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">👨‍⚕️</span>
              Referrals
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Referrals:\n${doc.referrals.map(r => `${r.specialty}: ${r.reason}`).join('\n')}`, 'referrals')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'referrals' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'referrals', idx)}
            </div>
          </div>
          <div className="cards-grid">
            {doc.referrals.map((referral, rIdx) => (
              <div key={rIdx} className="content-card">
                <button onClick={() => copySection(`Specialty: ${referral.specialty}\nReason: ${referral.reason}${referral.urgency ? `\nUrgency: ${referral.urgency}` : ''}`, `referral-${rIdx}`)} className="card-copy-btn">
                  <CopyIcon size={10} />
                  {copiedItemIndex === `referral-${rIdx}` ? 'Copied!' : 'Copy'}
                </button>
                <div className="card-content">
                  {renderEditableField(record, `referrals.${rIdx}.specialty`, idx, 'referrals', 'Specialty', `ref-spec-${rIdx}`)}
                  {renderEditableField(record, `referrals.${rIdx}.reason`, idx, 'referrals', 'Reason', `ref-reason-${rIdx}`)}
                  {referral.urgency && renderEditableField(record, `referrals.${rIdx}.urgency`, idx, 'referrals', 'Urgency', `ref-urg-${rIdx}`)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Follow-Up Appointments - EDITABLE per-item */}
      {!searchTerm && doc.followUpAppointments && doc.followUpAppointments.length > 0 && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">📅</span>
              Follow-Up Appointments
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Follow-Up Appointments:\n${doc.followUpAppointments.map(a => `${a.specialty}: ${a.reason} (${a.timing || ''})`).join('\n')}`, 'followup')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'followup' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'followUpAppointments', idx)}
            </div>
          </div>
          <div className="cards-grid">
            {doc.followUpAppointments.map((appt, fIdx) => (
              <div key={fIdx} className="content-card" style={{position: 'relative', paddingTop: '40px'}}>
                <button onClick={() => {
                  let text = 'Follow-Up Appointment:\n';
                  if (appt.specialty) text += `Specialty: ${appt.specialty}\n`;
                  if (appt.reason) text += `Reason: ${appt.reason}\n`;
                  if (appt.timing) text += `Timing: ${appt.timing}\n`;
                  if (appt.provider) text += `Provider: ${appt.provider}\n`;
                  copySubsection(text, `followup-${fIdx}`);
                }} className="card-copy-btn">
                  <CopyIcon size={10} />
                  {copiedItemIndex === `followup-${fIdx}` ? 'Copied!' : 'Copy'}
                </button>
                <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                  {appt.specialty && renderEditableField(record, `followUpAppointments.${fIdx}.specialty`, idx, 'followUpAppointments', 'Specialty', `fu-spec-${fIdx}`)}
                  {appt.reason && renderEditableField(record, `followUpAppointments.${fIdx}.reason`, idx, 'followUpAppointments', 'Reason', `fu-reason-${fIdx}`)}
                  {appt.timing && renderEditableField(record, `followUpAppointments.${fIdx}.timing`, idx, 'followUpAppointments', 'Timing', `fu-timing-${fIdx}`)}
                  {appt.provider && renderEditableField(record, `followUpAppointments.${fIdx}.provider`, idx, 'followUpAppointments', 'Provider', `fu-provider-${fIdx}`)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Patient Education - EDITABLE dynamic */}
      {!searchTerm && doc.patientEducation && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">📚</span>
              Patient Education
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Patient Education:\n${formatObjectToText(doc.patientEducation)}`, 'education')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'education' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'patientEducation', idx)}
            </div>
          </div>
          <div className="content-card">
            {renderDynamicObjectField(record, 'patientEducation', idx, 'patientEducation')}
          </div>
        </section>
      )}


      {/* Clinical Decision Support - DISPLAY ONLY with copy buttons */}
      {!searchTerm && doc.clinicalDecisionSupport && (() => {
        const formatCDS = (cds) => {
          let text = 'Clinical Decision Support:\n\n';
          if (cds.riskAssessment) {
            text += 'Risk Assessment:\n';
            Object.entries(cds.riskAssessment).forEach(([key, value]) => {
              const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
              text += `  ${label}: ${value}\n`;
            });
            text += '\n';
          }
          if (cds.redFlags && cds.redFlags.length > 0) {
            text += 'Red Flags:\n';
            cds.redFlags.forEach((flag, idx) => {
              if (typeof flag === 'string') { text += `  ${idx + 1}. ${flag}\n`; }
              else {
                text += `  ${idx + 1}.\n`;
                if (flag.finding) text += `    Finding: ${flag.finding}\n`;
                if (flag.urgency) text += `    Urgency: ${flag.urgency}\n`;
                if (flag.action) text += `    Action: ${flag.action}\n`;
                if (flag.timeframe) text += `    Timeframe: ${flag.timeframe}\n`;
              }
            });
            text += '\n';
          }
          if (cds.drugInteractions && cds.drugInteractions.length > 0) {
            text += 'Drug Interactions:\n';
            cds.drugInteractions.forEach((interaction, idx) => {
              text += `  ${idx + 1}.\n`;
              if (interaction.drugs) text += `    Drugs: ${interaction.drugs}\n`;
              if (interaction.severity) text += `    Severity: ${interaction.severity}\n`;
              if (interaction.description) text += `    Description: ${interaction.description}\n`;
            });
            text += '\n';
          }
          if (cds.contraindications && cds.contraindications.length > 0) {
            text += 'Contraindications:\n';
            cds.contraindications.forEach((contra, idx) => {
              const contraText = typeof contra === 'string' ? contra : contra.contraindication || '';
              if (contraText) text += `  ${idx + 1}. ${contraText}\n`;
            });
            text += '\n';
          }
          if (cds.intelligentRecommendations && cds.intelligentRecommendations.length > 0) {
            text += 'Intelligent Recommendations:\n';
            cds.intelligentRecommendations.forEach((rec, idx) => {
              const recText = typeof rec === 'string' ? rec : rec.recommendation || '';
              if (recText) text += `  ${idx + 1}. ${recText}\n`;
            });
            text += '\n';
          }
          if (cds.trendingAnalysis) {
            text += 'Trending Analysis:\n';
            Object.entries(cds.trendingAnalysis).forEach(([key, value]) => { text += `  ${key.replace(/([A-Z])/g, ' $1').trim()}: ${value}\n`; });
            text += '\n';
          }
          if (cds.patientSpecificCarePlan) {
            text += 'Patient-Specific Care Plan:\n';
            Object.entries(cds.patientSpecificCarePlan).forEach(([key, value]) => { text += `  ${key.replace(/([A-Z])/g, ' $1').trim()}: ${value}\n`; });
          }
          return text;
        };
        const copyText = formatCDS(doc.clinicalDecisionSupport);

        return (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title recommendation-title">
              <span className="section-icon">🤖</span>
              Clinical Decision Support
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(copyText, 'cds')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'cds' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Risk Assessment */}
          {doc.clinicalDecisionSupport.riskAssessment && (() => {
            const overallRisk = doc.clinicalDecisionSupport.riskAssessment.overallRisk?.toLowerCase() || '';
            const isHighRisk = overallRisk.includes('high') || overallRisk.includes('severe');
            const cardClass = isHighRisk ? 'content-card alert-card' : 'content-card recommendation-card';
            return (
            <div className="cds-subsection">
              <h3 className={`subsection-title ${isHighRisk ? 'alert-critical' : ''}`}>🎯 Risk Assessment</h3>
              <div className={cardClass} style={{width: '100%', maxWidth: '100%', flex: '0 0 100%', boxSizing: 'border-box'}}>
                <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                  {Object.entries(doc.clinicalDecisionSupport.riskAssessment).map(([key, value]) => (
                    <div key={key} style={{display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start', gap: '4px'}}>
                      <span style={{color: '#667eea', fontWeight: 'bold', whiteSpace: 'nowrap'}}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</span>
                      <span style={{color: '#ececf1', whiteSpace: 'normal'}}>{highlightText(String(value))}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            );
          })()}

          {/* Red Flags */}
          {doc.clinicalDecisionSupport.redFlags && doc.clinicalDecisionSupport.redFlags.length > 0 && (
            <div className="cds-subsection">
              <h3 className="subsection-title alert-critical">⚠️ Red Flags</h3>
              <div className="cards-grid">
                {doc.clinicalDecisionSupport.redFlags.map((flag, fIdx) => (
                  <div key={fIdx} className="content-card alert-card">
                    {typeof flag === 'string' ? (
                      <p className="card-content">{highlightText(flag)}</p>
                    ) : (
                      <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                        {flag.finding && <div style={{display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start', gap: '4px'}}><span style={{color: '#667eea', fontWeight: 'bold', whiteSpace: 'nowrap'}}>Finding:</span><span style={{color: '#ececf1', whiteSpace: 'normal'}}>{highlightText(flag.finding)}</span></div>}
                        {flag.urgency && <div style={{display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start', gap: '4px'}}><span style={{color: '#667eea', fontWeight: 'bold', whiteSpace: 'nowrap'}}>Urgency:</span><span style={{color: '#ececf1', whiteSpace: 'normal'}}>{highlightText(flag.urgency)}</span></div>}
                        {flag.action && <div style={{display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start', gap: '4px'}}><span style={{color: '#667eea', fontWeight: 'bold', whiteSpace: 'nowrap'}}>Action:</span><span style={{color: '#ececf1', whiteSpace: 'normal'}}>{highlightText(flag.action)}</span></div>}
                        {flag.timeframe && <div style={{display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start', gap: '4px'}}><span style={{color: '#667eea', fontWeight: 'bold', whiteSpace: 'nowrap'}}>Timeframe:</span><span style={{color: '#ececf1', whiteSpace: 'normal'}}>{highlightText(flag.timeframe)}</span></div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Drug Interactions */}
          {doc.clinicalDecisionSupport.drugInteractions && doc.clinicalDecisionSupport.drugInteractions.length > 0 && (
            <div className="cds-subsection">
              <h3 className="subsection-title">💊 Drug Interactions</h3>
              <div className="cards-grid">
                {doc.clinicalDecisionSupport.drugInteractions.map((interaction, diIdx) => (
                  <div key={diIdx} className="content-card">
                    <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                      {Object.entries(interaction).map(([key, value]) => {
                        if (!value) return null;
                        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
                        if (typeof value === 'object' && !Array.isArray(value)) {
                          return (
                            <div key={key} style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                              <span style={{color: '#667eea', fontWeight: 'bold'}}>{label}:</span>
                              {Object.entries(value).map(([subKey, subValue]) => (
                                <div key={subKey} style={{display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start', gap: '4px', marginLeft: '16px'}}>
                                  <span style={{color: '#667eea', fontWeight: 'normal', whiteSpace: 'nowrap'}}>{subKey}:</span>
                                  <span style={{color: '#ececf1', whiteSpace: 'normal'}}>{String(subValue)}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return (
                          <div key={key} style={{display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start', gap: '4px'}}>
                            <span style={{color: '#667eea', fontWeight: 'bold', whiteSpace: 'nowrap'}}>{label}:</span>
                            <span style={{color: '#ececf1', whiteSpace: 'normal'}}>{highlightText(Array.isArray(value) ? value.join(', ') : String(value))}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contraindications */}
          {doc.clinicalDecisionSupport.contraindications && doc.clinicalDecisionSupport.contraindications.length > 0 && (
            <div className="cds-subsection">
              <h3 className="subsection-title alert-critical">🚫 Contraindications</h3>
              <div className="cards-grid">
                {doc.clinicalDecisionSupport.contraindications.map((contra, cIdx) => (
                  <div key={cIdx} className="content-card alert-card">
                    {typeof contra === 'string' ? (
                      <p className="card-content">{highlightText(contra)}</p>
                    ) : (
                      <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                        {contra.medication && <div style={{display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start', gap: '4px'}}><span style={{color: '#667eea', fontWeight: 'bold', whiteSpace: 'nowrap'}}>Medication:</span><span style={{color: '#ececf1', whiteSpace: 'normal'}}>{highlightText(contra.medication)}</span></div>}
                        {contra.condition && <div style={{display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start', gap: '4px'}}><span style={{color: '#667eea', fontWeight: 'bold', whiteSpace: 'nowrap'}}>Condition:</span><span style={{color: '#ececf1', whiteSpace: 'normal'}}>{highlightText(contra.condition)}</span></div>}
                        {contra.severity && <div style={{display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start', gap: '4px'}}><span style={{color: '#667eea', fontWeight: 'bold', whiteSpace: 'nowrap'}}>Severity:</span><span style={{color: '#ececf1', whiteSpace: 'normal'}}>{highlightText(contra.severity)}</span></div>}
                        {contra.alternative && <div style={{display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start', gap: '4px'}}><span style={{color: '#667eea', fontWeight: 'bold', whiteSpace: 'nowrap'}}>Alternative:</span><span style={{color: '#ececf1', whiteSpace: 'normal'}}>{highlightText(contra.alternative)}</span></div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Intelligent Recommendations */}
          {doc.clinicalDecisionSupport.intelligentRecommendations && doc.clinicalDecisionSupport.intelligentRecommendations.length > 0 && (
            <div className="cds-subsection">
              <h3 className="subsection-title">💡 Intelligent Recommendations</h3>
              <div className="cards-grid">
                {doc.clinicalDecisionSupport.intelligentRecommendations.map((rec, irIdx) => (
                  <div key={irIdx} className="content-card recommendation-card">
                    <p className="card-content">{highlightText(typeof rec === 'string' ? rec : rec.recommendation || JSON.stringify(rec))}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trending Analysis */}
          {doc.clinicalDecisionSupport.trendingAnalysis && (
            <div className="cds-subsection">
              <h3 className="subsection-title">📊 Trending Analysis</h3>
              <div className="content-card">
                {Object.entries(doc.clinicalDecisionSupport.trendingAnalysis).map(([key, value]) => (
                  <p key={key} className="card-content">
                    <strong>{key.replace(/([A-Z])/g, ' $1').trim()}:</strong> {highlightText(String(value))}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Patient-Specific Care Plan */}
          {doc.clinicalDecisionSupport.patientSpecificCarePlan && (
            <div className="cds-subsection">
              <h3 className="subsection-title">🎯 Patient-Specific Care Plan</h3>
              <div className="content-card recommendation-card">
                {Object.entries(doc.clinicalDecisionSupport.patientSpecificCarePlan).map(([key, value]) => (
                  <p key={key} className="card-content">
                    <strong>{key.replace(/([A-Z])/g, ' $1').trim()}:</strong> {highlightText(String(value))}
                  </p>
                ))}
              </div>
            </div>
          )}
        </section>
        );
      })()}


      {/* GI Risk Assessment - DISPLAY ONLY with copy buttons */}
      {!searchTerm && doc.giRiskAssessment && (() => {
        const getRiskBadgeStyle = (riskLevel) => {
          const level = (riskLevel || '').toLowerCase();
          if (level.includes('high') || level.includes('critical')) return { background: '#dc2626', color: '#fff', order: 1 };
          if (level.includes('moderate') || level.includes('medium')) return { background: '#ea580c', color: '#fff', order: 2 };
          if (level.includes('low') || level.includes('minor')) return { background: '#10b981', color: '#fff', order: 3 };
          return { background: '#9ca3af', color: '#fff', order: 4 };
        };
        const sortedRiskCategories = Object.entries(doc.giRiskAssessment)
          .filter(([_, riskData]) => {
            if (!riskData || typeof riskData !== 'object') return false;
            const hasRiskFactors = riskData.riskFactors && riskData.riskFactors.length > 0;
            const hasRecommendations = riskData.recommendations && riskData.recommendations.length > 0;
            const hasProtectiveFactors = riskData.protectiveFactors && riskData.protectiveFactors.length > 0;
            const hasComorbidities = riskData.comorbidities && riskData.comorbidities.length > 0;
            return hasRiskFactors || hasRecommendations || hasProtectiveFactors || hasComorbidities;
          })
          .sort((a, b) => getRiskBadgeStyle(a[1].riskLevel).order - getRiskBadgeStyle(b[1].riskLevel).order);

        const formatGIRisk = () => {
          let text = 'GI Risk Assessment:\n\n';
          sortedRiskCategories.forEach(([riskType, riskData]) => {
            const riskTitle = riskType.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
            text += `${riskTitle}:\n`;
            if (riskData.riskLevel) text += `  Risk Level: ${riskData.riskLevel}\n`;
            if (riskData.riskFactors && riskData.riskFactors.length > 0) {
              text += `  Risk Factors:\n`;
              riskData.riskFactors.forEach((factor, idx) => { text += `    ${idx + 1}. ${factor}\n`; });
            }
            if (riskData.recommendations && riskData.recommendations.length > 0) {
              text += `  Recommendations:\n`;
              riskData.recommendations.forEach((rec, idx) => { text += `    ${idx + 1}. ${rec}\n`; });
            }
            text += '\n';
          });
          return text;
        };
        const copyText = formatGIRisk();

        return (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">🫃</span>
              GI Risk Assessment
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(copyText, 'gi-risk')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'gi-risk' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <div className="cards-grid">
            {sortedRiskCategories.map(([riskType, riskData]) => {
              const riskIcons = { bleedingRisk: '🩸', aspirationRisk: '🫁', hepaticRisk: '🫀', cDiffRisk: '🦠', malabsorptionRisk: '🫄' };
              const icon = riskIcons[riskType] || '⚠️';
              const riskTitle = riskType.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
              return (
                <div key={riskType} className="content-card" style={{ position: 'relative', paddingTop: '48px' }}>
                  {riskData.riskLevel && (
                    <span style={{ position: 'absolute', top: '8px', right: '8px', display: 'inline-block', background: getRiskBadgeStyle(riskData.riskLevel).background, color: '#fff', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', zIndex: 1 }}>
                      {riskData.riskLevel}
                    </span>
                  )}
                  <h3 className="subsection-title">{icon} {riskTitle}</h3>
                  {riskData.riskFactors && riskData.riskFactors.length > 0 && (
                    <div><p className="card-content"><strong>Risk Factors:</strong></p>
                      <ul className="list-items">{riskData.riskFactors.map((factor, fIdx) => (<li key={fIdx}>{highlightText(factor)}</li>))}</ul>
                    </div>
                  )}
                  {riskData.protectiveFactors && riskData.protectiveFactors.length > 0 && (
                    <div><p className="card-content"><strong>Protective Factors:</strong></p>
                      <ul className="list-items">{riskData.protectiveFactors.map((factor, pfIdx) => (<li key={pfIdx}>{highlightText(factor)}</li>))}</ul>
                    </div>
                  )}
                  {riskData.comorbidities && riskData.comorbidities.length > 0 && (
                    <div><p className="card-content"><strong>Comorbidities:</strong></p>
                      <ul className="list-items">{riskData.comorbidities.map((comorbidity, cIdx) => (<li key={cIdx}>{highlightText(comorbidity)}</li>))}</ul>
                    </div>
                  )}
                  {riskData.recommendations && riskData.recommendations.length > 0 && (
                    <div><p className="card-content"><strong>Recommendations:</strong></p>
                      <ul className="list-items">{riskData.recommendations.map((rec, rIdx) => (<li key={rIdx}>{highlightText(rec)}</li>))}</ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        );
      })()}

      {/* Respiratory Devices - EDITABLE dynamic */}
      {!searchTerm && doc.respiratoryDevices && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">🫁</span>
              Respiratory Devices
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Respiratory Devices:\n${formatObjectToText(doc.respiratoryDevices)}`, 'respiratory-devices')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'respiratory-devices' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'respiratoryDevices', idx)}
            </div>
          </div>
          <div className="content-card">
            {renderDynamicObjectField(record, 'respiratoryDevices', idx, 'respiratoryDevices')}
          </div>
        </section>
      )}

      {/* Functional Status - EDITABLE dynamic */}
      {!searchTerm && doc.functionalStatus && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">🚶</span>
              Functional Status
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Functional Status:\n${formatObjectToText(doc.functionalStatus)}`, 'functional')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'functional' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'functionalStatus', idx)}
            </div>
          </div>
          <div className="content-card">
            {renderDynamicObjectField(record, 'functionalStatus', idx, 'functionalStatus')}
          </div>
        </section>
      )}

      {/* Neurological Exam - EDITABLE dynamic */}
      {!searchTerm && doc.neurologicalExam && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">🧠</span>
              Neurological Exam
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Neurological Exam:\n${formatObjectToText(doc.neurologicalExam)}`, 'neuro')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'neuro' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'neurologicalExam', idx)}
            </div>
          </div>
          <div className="content-card">
            {renderDynamicObjectField(record, 'neurologicalExam', idx, 'neurologicalExam')}
          </div>
        </section>
      )}

      {/* Peripheral Neuropathy - EDITABLE */}
      {!searchTerm && doc.peripheralNeuropathy && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">🦵</span>
              Peripheral Neuropathy
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Peripheral Neuropathy:\n${formatObjectToText(doc.peripheralNeuropathy)}`, 'neuropathy')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'neuropathy' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'peripheralNeuropathy', idx)}
            </div>
          </div>
          <div className="content-card">
            {doc.peripheralNeuropathy.present !== undefined && renderEditableField(record, 'peripheralNeuropathy.present', idx, 'peripheralNeuropathy', 'Present', 'pn-present')}
            {doc.peripheralNeuropathy.type && renderEditableField(record, 'peripheralNeuropathy.type', idx, 'peripheralNeuropathy', 'Type', 'pn-type')}
            {doc.peripheralNeuropathy.severity && renderEditableField(record, 'peripheralNeuropathy.severity', idx, 'peripheralNeuropathy', 'Severity', 'pn-severity')}
            {doc.peripheralNeuropathy.distribution && renderEditableField(record, 'peripheralNeuropathy.distribution', idx, 'peripheralNeuropathy', 'Distribution', 'pn-distribution')}
          </div>
        </section>
      )}

      {/* Administrative Data - EDITABLE dynamic */}
      {!searchTerm && doc.administrativeData && (
        <section className="anesthesia-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">📊</span>
              Administrative Data
            </h2>
            <div className="header-right-actions">
              <button onClick={() => copySection(`Administrative Data:\n${formatObjectToText(doc.administrativeData)}`, 'admin')} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'admin' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'administrativeData', idx)}
            </div>
          </div>
          <div className="content-card">
            {renderDynamicObjectField(record, 'administrativeData', idx, 'administrativeData')}
          </div>
        </section>
      )}

      {/* Consultation Details - EDITABLE (NOT dates) */}
      {!searchTerm && doc.consultationDetails && (
        <section className="anesthesia-section consultation-footer">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">📄</span>
              Consultation Details
            </h2>
            <div className="header-right-actions">
              <button onClick={() => {
                let text = 'Consultation Details:\n\n';
                if (doc.consultationDetails.consultingPhysician) text += `Consulting Physician: ${doc.consultationDetails.consultingPhysician}\n`;
                if (doc.consultationDetails.consultingSpecialty) text += `Specialty: ${doc.consultationDetails.consultingSpecialty}\n`;
                if (doc.consultationDetails.consultDate) text += `Consult Date: ${formatDate(doc.consultationDetails.consultDate)}\n`;
                if (doc.consultationDetails.signatureTime) text += `Signed: ${formatDate(doc.consultationDetails.signatureTime)}\n`;
                copySection(text, 'consultation-details');
              }} className="section-copy-btn">
                <CopyIcon />
                {copiedItemIndex === 'consultation-details' ? 'Copied!' : 'Copy'}
              </button>
              {renderApproveBtn(record, 'consultationDetails', idx)}
            </div>
          </div>
          <div className="info-card">
            {doc.consultationDetails.consultingPhysician && renderEditableField(record, 'consultationDetails.consultingPhysician', idx, 'consultationDetails', 'Consulting Physician', 'cd-physician')}
            {doc.consultationDetails.consultingSpecialty && renderEditableField(record, 'consultationDetails.consultingSpecialty', idx, 'consultationDetails', 'Specialty', 'cd-specialty')}
            {doc.consultationDetails.consultDate && (
              <p className="info-field"><strong>Consult Date:</strong> {formatDate(doc.consultationDetails.consultDate)}</p>
            )}
            {doc.consultationDetails.signatureTime && (
              <p className="info-field"><strong>Signed:</strong> {formatDate(doc.consultationDetails.signatureTime)}</p>
            )}
          </div>
        </section>
      )}

      {/* Empty state if no search results */}
      {searchTerm && filteredItems.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <p className="empty-text">No results found for "{searchTerm}"</p>
        </div>
      )}
    </div>
  );
};

export default AnesthesiaDocument;
