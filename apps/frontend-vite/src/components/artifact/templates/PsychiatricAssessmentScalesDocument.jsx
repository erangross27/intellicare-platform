import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import PsychiatricAssessmentScalesDocumentPDFTemplate from '../pdf-templates/PsychiatricAssessmentScalesDocumentPDFTemplate';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import './PsychiatricAssessmentScalesDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field", "field.arrayIndex", or "root.path") */
const DRAFT_KEY = 'psychiatric_assessment_scalesPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

// Scale label mapping
const SCALE_LABELS = {
  phq9: 'PHQ-9 (Patient Health Questionnaire-9)',
  gad7: 'GAD-7 (Generalized Anxiety Disorder-7)',
  phq15: 'PHQ-15 (Patient Health Questionnaire-15)',
  mdq: 'MDQ (Mood Disorder Questionnaire)',
  pcl5: 'PCL-5 (PTSD Checklist for DSM-5)',
  audit: 'AUDIT (Alcohol Use Disorders Identification Test)',
  mmse: 'MMSE (Mini-Mental State Examination)',
  moca: 'MoCA (Montreal Cognitive Assessment)',
};
const SCALE_KEYS = ['phq9', 'gad7', 'phq15', 'mdq', 'pcl5', 'audit', 'mmse', 'moca'];

const PsychiatricAssessmentScalesDocument = ({ document: data }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSectionId, setCopiedSectionId] = useState(null);
  const documentRef = useRef(null);

  // ============== EDITING STATE ==============
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

  // Data unwrapping
  const records = useMemo(() => {
    const unwrapData = (inputData) => {
      if (!inputData) return [];
      if (Array.isArray(inputData)) {
        if (inputData.length === 1 && inputData[0]?.psychiatric_assessment_scales) {
          return inputData[0].psychiatric_assessment_scales;
        }
        return inputData;
      }
      if (inputData.psychiatric_assessment_scales) {
        return inputData.psychiatric_assessment_scales;
      }
      return [inputData];
    };
    return unwrapData(data);
  }, [data]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const recId = (rec) => {
      const id = rec && rec._id;
      if (!id) return null;
      return (typeof id === 'object' && id.$oid) ? id.$oid : id;
    };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nStatus = {};
    records.forEach((record, idx) => {
      const rid = recId(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // baseField → the section id used by SECTION_FIELDS / approve button
        const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
        nFields[`${baseField}-${idx}`] = true;
        nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
        nStatus[idx] = 'amended';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
    setStatusOverrides(prev => ({ ...nStatus, ...prev }));
  }, [records]);

  // Helper: format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Helper: format date ISO for search
  const formatDateISO = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  };

  // Helper: camelCase/snake_case to readable label
  const keyToLabel = (key) => {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  // Helper: safe array
  const safeArray = (val) => Array.isArray(val) ? val.filter(Boolean) : [];

  // Helper: check if value is displayable (handles numeric 0)
  const hasValue = (val) => {
    if (val === null || val === undefined || val === '') return false;
    return true;
  };

  // Helper: format value
  const formatValue = (val) => {
    if (val === true) return 'Yes';
    if (val === false) return 'No';
    if (val === null || val === undefined || val === '') return '';
    if (typeof val === 'object' && val.$date) return formatDate(val.$date);
    return String(val);
  };

  // Helper: split text into items
  const splitIntoItems = (text) => {
    if (!text) return [];
    const str = String(text).trim();
    if (!str) return [];
    const numbered = str.split(/\s+(?=\d+\.\s)/).filter(s => s.trim()).map(s => s.trim());
    if (numbered.length > 1) return numbered;
    const bySemicolon = str.split(/;\s*/).filter(s => s.trim()).map(s => s.trim());
    if (bySemicolon.length > 1) return bySemicolon;
    return [str];
  };

  // Helper: strip number prefix
  const stripNumber = (text) => String(text).replace(/^\d+\.\s*/, '');

  // Helper: parse text with embedded subtitle labels (e.g., "PHQ-9 notable items: ...", "Columbia Suicide Severity Rating Scale: ...")
  const parseSubtitleItems = (text) => {
    if (!text) return [];
    const str = String(text).trim();
    if (!str) return [];
    // Match multi-word labels ending with ":" (at least 2 words, first capitalized or uppercase abbreviation)
    const regex = /([A-Z][A-Za-z0-9\-]+(?:\s+[a-zA-Z\-]+){1,})\s*:\s*/g;
    const matches = [];
    let m;
    while ((m = regex.exec(str)) !== null) {
      matches.push({ label: m[1], start: m.index, contentStart: m.index + m[0].length });
    }
    if (matches.length === 0) return [{ label: '', value: str }];
    const result = [];
    if (matches[0].start > 0) {
      const prefix = str.substring(0, matches[0].start).trim().replace(/\.\s*$/, '');
      if (prefix) result.push({ label: '', value: prefix });
    }
    for (let i = 0; i < matches.length; i++) {
      const contentEnd = i + 1 < matches.length ? matches[i + 1].start : str.length;
      const value = str.substring(matches[i].contentStart, contentEnd).trim().replace(/\.\s*$/, '');
      if (value) result.push({ label: matches[i].label, value });
    }
    return result;
  };

  // Check if a scale has displayable data
  const scaleHasData = (scale) => {
    if (!scale || typeof scale !== 'object') return false;
    return Object.entries(scale).filter(([k]) => k !== '_id').some(([, v]) => hasValue(v));
  };

  // ============== EDITING HELPERS ==============

  const getFieldValue = useCallback((record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    return record[fieldName];
  }, [localEdits]);

  // ============== EDITING HANDLERS ==============

  const handleStartEdit = useCallback((fieldName, idx, currentValue) => {
    const editKey = `${fieldName}-${idx}-s0`;
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
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, arrayIndex) => {
    const recId = record && record._id ? ((typeof record._id === 'object' && record._id.$oid) ? record._id.$oid : record._id) : null;
    if (!recId) return;
    const saveValue = editValue.trim();
    const fieldPart = (typeof arrayIndex === 'number') ? `${fieldName}.${arrayIndex}` : fieldName;
    const editKey = `${fieldPart}-${idx}`;
    const sKey = `${fieldPart}-${idx}-s0`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));
    setApprovedSections(prev => {
      if (!prev[sectionId]) return prev;
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
    const store = readDrafts();
    if (!store[recId]) store[recId] = {};
    store[recId][fieldPart] = saveValue;
    writeDrafts(store);
    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Save a nested OBJECT leaf by dot-path (e.g. results.severity) — value stays a STRING.
  // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
  const handleSaveLeaf = useCallback((record, rootField, path, idx, sectionId, newVal) => {
    const recId = record && record._id ? ((typeof record._id === 'object' && record._id.$oid) ? record._id.$oid : record._id) : null;
    if (!recId) return;
    const fieldPart = `${rootField}.${path.join('.')}`;
    const editKey = `${fieldPart}-${idx}`;
    const sKey = `${editKey}-s0`;
    setLocalEdits(prev => ({ ...prev, [editKey]: newVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));
    setApprovedSections(prev => {
      if (!prev[sectionId]) return prev;
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
    const store = readDrafts();
    if (!store[recId]) store[recId] = {};
    store[recId][fieldPart] = newVal;
    writeDrafts(store);
    setEditingField(null);
    setEditValue('');
  }, []);

  // Approve = COMMIT all staged drafts for this record to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApprove = useCallback(async (record, idx, sectionId) => {
    const recId = record && record._id ? ((typeof record._id === 'object' && record._id.$oid) ? record._id.$oid : record._id) : null;
    if (!recId) return;
    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now. A dotted field is an ARRAY element only when the
      // segment after the LAST dot is purely numeric (mirrors handleSaveField's `${field}.${arrayIndex}`);
      // otherwise it is a nested object leaf path (e.g. results.severity) sent as a dotted field.
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field", "field.arrayIndex", or "root.path"
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { value: localEdits[editKey] };
        if (lastDot !== -1 && /^\d+$/.test(trailing)) {
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(trailing, 10);
        } else {
          payload.field = fieldPart;
        }
        const resp = await secureApiClient.put(`/api/edit/psychiatric_assessment_scales/${recId}/edit`, payload);
        if (!resp || !resp.success) throw new Error((resp && resp.error) || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/psychiatric_assessment_scales/${recId}/approve`);

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[recId]) { delete store[recId]; writeDrafts(store); }

      setStatusOverrides(prev => ({ ...prev, [idx]: 'approved' }));
      setApprovedSections(prev => ({ ...prev, [sectionId]: true }));
      setEditedSentences(prev => {
        const updated = {};
        for (const key of Object.keys(prev)) {
          if (!key.includes(`-${idx}-`)) updated[key] = prev[key];
        }
        return updated;
      });
      setEditedFields(prev => {
        const updated = {};
        for (const key of Object.keys(prev)) {
          if (!key.endsWith(`-${idx}`)) updated[key] = prev[key];
        }
        return updated;
      });
    } catch (err) {
      console.error('[PsychiatricAssessmentScales] Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // ============== SECTION_FIELDS + sectionHasEdits ==============
  const SECTION_FIELDS = {
    'findings': ['findings'],
    'assessment': ['assessment'],
    'plan': ['plan'],
    'notes': ['notes'],
    'provider': ['provider', 'facility'],
    'recommendations': ['recommendations'],
    'results': ['results'],
  };

  const sectionHasEdits = (sectionId) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    return Object.keys(localEdits).some(editKey => {
      const dashIdx = editKey.lastIndexOf('-');
      const fieldPart = editKey.substring(0, dashIdx);
      const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
      return fields.includes(baseField);
    });
  };

  // ============== pdfData MEMO ==============
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const merged = { ...record };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldPart = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx === idx) {
          const dotParts = fieldPart.split('.');
          if (dotParts.length === 1) {
            merged[fieldPart] = editVal;
          } else if (dotParts.length === 2 && !isNaN(parseInt(dotParts[1], 10)) && Array.isArray(merged[dotParts[0]])) {
            const [parent, child] = dotParts;
            const childNum = parseInt(child, 10);
            merged[parent] = [...merged[parent]];
            merged[parent][childNum] = editVal;
          } else {
            // Nested OBJECT leaf (e.g. results.severity, results.overall.score)
            const [parent, ...rest] = dotParts;
            const clone = JSON.parse(JSON.stringify(merged[parent] ?? {}));
            let node = clone;
            for (let i = 0; i < rest.length - 1; i++) {
              if (typeof node[rest[i]] !== 'object' || node[rest[i]] === null) node[rest[i]] = {};
              node = node[rest[i]];
            }
            node[rest[rest.length - 1]] = editVal;
            merged[parent] = clone;
          }
        }
      }
      return merged;
    });
  }, [records, localEdits, pendingEdits]);

  // ============== EDIT INDICATOR ==============
  const editIndicator = (
    <span className="edit-indicator" title="Click to edit">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="m15 5 4 4" />
      </svg>
      <span className="edit-tag">edit</span>
    </span>
  );

  // ============== RENDER EDITABLE FIELD (string fields) ==============
  const renderEditableField = (record, fieldName, label, idx, sectionId, copyId) => {
    const displayValue = getFieldValue(record, fieldName, idx);
    if (!displayValue) return null;
    const canEdit = !!record._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const isFieldEdited = sectionWasEdited && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={fieldName}>
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <textarea
                ref={textareaRef}
                className="edit-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') handleCancelEdit();
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveField(record, fieldName, idx, sectionId);
                }}
                rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))}
                disabled={saving}
              />
              <div className="edit-actions">
                <button className="edit-save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId)} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rec-mini-card" key={fieldName}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div
          className={`numbered-row${canEdit ? ' editable-row' : ''}${isFieldEdited ? ' modified' : ''}`}
          onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue)}
          title={canEdit ? 'Click to edit' : undefined}
        >
          <div className={`row-content${canEdit ? ' editable' : ''}`}>
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isFieldEdited && editIndicator}
          </div>
          <button
            className={`copy-btn ${copiedSectionId === copyId ? 'copied' : ''}`}
            onClick={(e) => { e.stopPropagation(); copyToClipboard(displayValue, copyId); }}
          >
            {copiedSectionId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && <div className="modified-badge">edited -- click Pending Approve to save</div>}
      </div>
    );
  };

  // ============== RENDER EDITABLE ARRAY ITEM ==============
  const renderEditableArrayItem = (record, fieldName, item, idx, itemIdx, sectionId, copyId) => {
    const editArrayKey = `${fieldName}.${itemIdx}-${idx}`;
    const rawValue = (localEdits[editArrayKey] !== undefined) ? localEdits[editArrayKey] : item;
    const displayValue = (rawValue && typeof rawValue === 'object') ? (rawValue.recommendation || rawValue.text || JSON.stringify(rawValue)) : rawValue;
    if (!displayValue) return null;
    const canEdit = !!record._id;
    const editKey = `${fieldName}.${itemIdx}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const isItemEdited = sectionWasEdited && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';

    if (isEditing) {
      return (
        <div key={itemIdx} className="numbered-row edit-row">
          <div className="edit-field-container">
            <textarea
              ref={textareaRef}
              className="edit-textarea"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleCancelEdit();
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveField(record, fieldName, idx, sectionId, itemIdx);
              }}
              rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))}
              disabled={saving}
            />
            <div className="edit-actions">
              <button className="edit-save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId, itemIdx)} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <React.Fragment key={itemIdx}>
        <div className={`numbered-row${isItemEdited ? ' modified' : ''}`}>
          <div
            className={`row-content${canEdit ? ' editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(`${fieldName}.${itemIdx}`, idx, displayValue)}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isItemEdited && editIndicator}
          </div>
          <button
            className={`copy-btn ${copiedSectionId === copyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(displayValue, copyId)}
          >
            {copiedSectionId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isItemEdited && <div className="modified-badge">edited -- click Pending Approve to save</div>}
      </React.Fragment>
    );
  };

  // ============== SECTION HEADER WITH APPROVE ==============
  const renderSectionHeader = (title, copyId, copyFn, idx, sectionId) => (
    <div className="field-header">
      <span className="field-title">{highlightText(title)}</span>
      <div className="header-right-actions">
        <button
          className={`section-copy-btn ${copiedSectionId === copyId ? 'copied' : ''}`}
          onClick={copyFn}
        >
          {copiedSectionId === copyId ? 'Copied!' : 'Copy Section'}
        </button>
        {(sectionHasEdits(sectionId) || approvedSections[sectionId]) && (
          <button
            className={`approve-btn${approvedSections[sectionId] ? ' approved' : ' pending'}`}
            onClick={() => handleApprove(records[idx], idx, sectionId)}
            disabled={approving}
          >
            {approving ? 'Approving...' : approvedSections[sectionId] ? 'Approved' : 'Pending Approve'}
          </button>
        )}
      </div>
    </div>
  );

  // Copy to clipboard
  const copyToClipboard = async (text, sectionId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSectionId(sectionId);
      setTimeout(() => setCopiedSectionId(null), 2000);
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedSectionId(sectionId);
      setTimeout(() => setCopiedSectionId(null), 2000);
    }
  };

  // Generate copy all text (uses pdfData for edit persistence)
  const generateCopyAllText = () => {
    let text = 'PSYCHIATRIC ASSESSMENT SCALES\n\n';
    pdfData.forEach((record, idx) => {
      text += `Psychiatric Assessment Scales ${idx + 1}\n${'='.repeat(40)}\n\n`;
      if (record.date) text += `Date\n1. ${formatDate(record.date)}\n\n`;
      if (record.provider) text += `Provider\n1. ${record.provider}\n\n`;
      if (record.facility) text += `Facility\n1. ${record.facility}\n\n`;

      // Assessment Scales
      const activeScales = SCALE_KEYS.filter(key => scaleHasData(record[key]));
      if (activeScales.length > 0) {
        text += 'ASSESSMENT SCALES\n';
        activeScales.forEach(key => {
          const label = SCALE_LABELS[key] || keyToLabel(key);
          const scale = record[key];
          text += `${label}\n`;
          Object.entries(scale).filter(([k]) => k !== '_id' && hasValue(scale[k])).forEach(([k, v]) => {
            text += `  ${keyToLabel(k)}: ${formatValue(v)}\n`;
          });
        });
        text += '\n';
      }

      // Results
      if (record.results && typeof record.results === 'object' && !objectIsEmpty(record.results)) {
        const lines = buildResultsCopyLines('', record.results, 0);
        if (lines.length > 0) {
          text += 'RESULTS\n';
          lines.forEach(line => { text += `${line}\n`; });
          text += '\n';
        }
      }

      // Custom Scales
      const customItems = safeArray(record.customScales);
      if (customItems.length > 0) {
        text += 'CUSTOM SCALES\n';
        customItems.forEach((item, i) => {
          const t = typeof item === 'string' ? item : [item.name, (item.score !== undefined && item.score !== null && item.score !== '') ? `Score: ${item.score}` : null, item.interpretation ? `Interpretation: ${item.interpretation}` : null].filter(Boolean).join(' -- ');
          text += `${i + 1}. ${t}\n`;
        });
        text += '\n';
      }

      // Findings (with subtitles)
      if (record.findings && String(record.findings).trim()) {
        const parsed = parseSubtitleItems(record.findings);
        text += 'FINDINGS\n';
        parsed.forEach((item, i) => {
          if (item.label) text += `${item.label}: ${item.value}\n`;
          else text += `${i + 1}. ${item.value}\n`;
        });
        text += '\n';
      }

      // Assessment
      if (record.assessment && String(record.assessment).trim()) {
        const items = splitIntoItems(record.assessment);
        text += 'ASSESSMENT\n';
        items.forEach((item, i) => { text += `${i + 1}. ${stripNumber(item)}\n`; });
        text += '\n';
      }

      // Plan
      if (record.plan && String(record.plan).trim()) {
        const items = splitIntoItems(record.plan);
        text += 'PLAN\n';
        items.forEach((item, i) => { text += `${i + 1}. ${stripNumber(item)}\n`; });
        text += '\n';
      }

      // Recommendations
      const recs = safeArray(record.recommendations);
      if (recs.length > 0) {
        text += 'RECOMMENDATIONS\n';
        recs.forEach((item, i) => { const t = typeof item === 'string' ? item : (item.recommendation || item.text || JSON.stringify(item)); text += `${i + 1}. ${t}\n`; });
        text += '\n';
      }

      // Notes (with subtitles)
      if (record.notes && String(record.notes).trim()) {
        const parsed = parseSubtitleItems(record.notes);
        text += 'NOTES\n';
        parsed.forEach((item, i) => {
          if (item.label) text += `${item.label}: ${item.value}\n`;
          else text += `${i + 1}. ${item.value}\n`;
        });
        text += '\n';
      }

      text += '\n';
    });
    return text;
  };

  // Highlight search term - PHRASE MATCHING
  const highlightText = (text) => {
    if (!text || !searchTerm) return text;
    const textStr = String(text);
    const searchLower = searchTerm.toLowerCase().trim();
    if (!searchLower) return textStr;
    const regex = new RegExp(`(${searchLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const result = textStr.replace(regex, '<mark>$1</mark>');
    return <span dangerouslySetInnerHTML={{ __html: result }} />;
  };

  // Level 2: Section filtering (phrase matching)
  const shouldShowSection = (record, sectionTitle, ...sectionContent) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;
    const searchLower = searchTerm.toLowerCase().trim();
    if (sectionTitle && sectionTitle.toLowerCase().includes(searchLower)) return true;
    const sectionText = sectionContent.filter(Boolean).join(' ').toLowerCase();
    return sectionText.includes(searchLower);
  };

  // Level 4: Row filtering (phrase matching)
  const shouldShowRow = (record, ...values) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;
    const searchLower = searchTerm.toLowerCase().trim();
    const combinedText = values.filter(Boolean).join(' ').toLowerCase();
    return combinedText.includes(searchLower);
  };

  // Flatten object values for search (includes keyToLabel for labels)
  const flattenValues = (obj) => {
    if (!obj || typeof obj !== 'object') return [];
    const values = [];
    Object.entries(obj).forEach(([k, v]) => {
      if (k === '_id') return;
      values.push(keyToLabel(k));
      if (Array.isArray(v)) {
        v.forEach(item => {
          if (item !== null && item !== undefined && item !== '') values.push(String(item));
        });
      } else if (v !== null && v !== undefined && v !== '') {
        values.push(String(v));
      }
    });
    return values;
  };

  // Level 1: Filtered records
  const filteredRecords = useMemo(() => {
    if (!searchTerm) return records.map(r => ({ ...r, _showAllSections: true }));

    const searchLower = searchTerm.toLowerCase().trim();

    const recordsWithTitle = records.map((record, idx) => ({
      ...record,
      _documentTitle: `Psychiatric Assessment Scales ${idx + 1}`,
      _showAllSections: false
    }));

    return recordsWithTitle.filter((record) => {
      record._showAllSections = false;

      const searchableText = [
        record._documentTitle,
        'psychiatric assessment scales', 'Psychiatric Assessment Scales',
        // Section titles
        'Assessment Scales', 'assessment scales',
        'Custom Scales', 'custom scales',
        'Findings', 'findings',
        'Assessment', 'assessment',
        'Plan', 'plan',
        'Recommendations', 'recommendations',
        'Results', 'results',
        'Notes', 'notes',
        'Provider Information', 'provider information',
        // Compound labels with dashes (full scale names)
        ...SCALE_KEYS.map(key => SCALE_LABELS[key]),
        // Short scale names with dashes
        'PHQ-9', 'GAD-7', 'PHQ-15', 'PCL-5',
        // Provider (labels + values)
        'Provider', 'Facility',
        record.provider, record.facility,
        // Dates
        formatDate(record.date),
        formatDateISO(record.date),
        record.date,
        // Scale data (flattened with labels)
        ...SCALE_KEYS.flatMap(key => flattenValues(record[key])),
        // Custom scales
        ...safeArray(record.customScales),
        // Results (flattened with labels)
        ...flattenValues(record.results),
        // Text fields
        record.findings,
        record.assessment,
        record.plan,
        record.notes,
        // Recommendations
        ...safeArray(record.recommendations),
        // Subtitle labels from findings/notes
        ...parseSubtitleItems(record.findings).map(item => item.label).filter(Boolean),
        ...parseSubtitleItems(record.notes).map(item => item.label).filter(Boolean),
      ].filter(Boolean).join(' ').toLowerCase();

      const matchesDocument = searchableText.includes(searchLower);

      // _showAllSections only for full template name prefix
      if (matchesDocument && searchLower.startsWith('psychiatric assessment')) {
        record._showAllSections = true;
        return true;
      }

      return matchesDocument;
    });
  }, [records, searchTerm]);

  if (!records || records.length === 0) {
    return (
      <div className="psychiatric-assessment-scales-document">
        <div className="no-data-message">No psychiatric assessment scales data available.</div>
      </div>
    );
  }

  // Render scales section
  const renderScalesSection = (record, idx) => {
    const activeScales = SCALE_KEYS.filter(key => scaleHasData(record[key]));
    if (activeScales.length === 0) return null;

    const sectionTitleMatches = (() => {
      if (!searchTerm) return false;
      return 'assessment scales'.startsWith(searchTerm.toLowerCase().trim());
    })();

    const contentArgs = activeScales.flatMap(key => {
      const label = SCALE_LABELS[key] || keyToLabel(key);
      const scale = record[key];
      const entries = Object.entries(scale).filter(([k]) => k !== '_id' && hasValue(scale[k]));
      return [label, ...entries.flatMap(([k, v]) => [keyToLabel(k), formatValue(v)])];
    });

    if (!shouldShowSection(record, 'Assessment Scales', ...contentArgs)) return null;

    const visibleScales = activeScales.filter(key => {
      if (!searchTerm || record._showAllSections || sectionTitleMatches) return true;
      const label = SCALE_LABELS[key] || keyToLabel(key);
      const scale = record[key];
      const entries = Object.entries(scale).filter(([k]) => k !== '_id' && hasValue(scale[k]));
      return shouldShowRow(record, label, ...entries.flatMap(([k, v]) => [keyToLabel(k), formatValue(v)]));
    });

    if (visibleScales.length === 0) return null;

    const getScalesSectionText = () => {
      let text = 'ASSESSMENT SCALES\n';
      activeScales.forEach(key => {
        const label = SCALE_LABELS[key] || keyToLabel(key);
        const scale = record[key];
        text += `${label}\n`;
        Object.entries(scale).filter(([k]) => k !== '_id' && hasValue(scale[k])).forEach(([k, v]) => {
          text += `  ${keyToLabel(k)}: ${formatValue(v)}\n`;
        });
      });
      return text;
    };

    return (
      <div className="field-container" key="scales">
        <div className="field-header">
          <span className="field-title">{highlightText('Assessment Scales')}</span>
          <button
            className={`section-copy-btn ${copiedSectionId === `scales-section-${idx}` ? 'copied' : ''}`}
            onClick={() => copyToClipboard(getScalesSectionText(), `scales-section-${idx}`)}
          >
            {copiedSectionId === `scales-section-${idx}` ? 'Copied!' : 'Copy Section'}
          </button>
        </div>
        <div className="mini-cards-container">
          {visibleScales.map((key, scaleIdx) => {
            const label = SCALE_LABELS[key] || keyToLabel(key);
            const scale = record[key];
            const entries = Object.entries(scale).filter(([k]) => k !== '_id' && hasValue(scale[k]));

            // Level 2.5: Per-scale label match
            const scaleLabelMatches = (() => {
              if (!searchTerm) return false;
              const sl = searchTerm.toLowerCase().trim();
              return label.toLowerCase().startsWith(sl);
            })();

            const visibleEntries = entries.filter(([k, v]) => {
              if (!searchTerm || record._showAllSections || sectionTitleMatches || scaleLabelMatches) return true;
              return shouldShowRow(record, keyToLabel(k), formatValue(v));
            });

            if (visibleEntries.length === 0) return null;

            // Combine the scale's entries (score, severity/riskLevel) into ONE value — the label rides as the
            // nested-subtitle above, NEVER "Score: 16" inline (canonical: no side-by-side Label:value row).
            const combined = visibleEntries.map(([, v]) => formatValue(v)).join(' — ');
            return (
              <div key={scaleIdx} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(label)}</div>
                <div className="numbered-row">
                  <div className="row-content">
                    <span className="content-value">{highlightText(combined)}</span>
                  </div>
                  <button
                    className={`copy-btn ${copiedSectionId === `scales-${idx}-${scaleIdx}` ? 'copied' : ''}`}
                    onClick={() => copyToClipboard(combined, `scales-${idx}-${scaleIdx}`)}
                  >
                    {copiedSectionId === `scales-${idx}-${scaleIdx}` ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ============== RESULTS OBJECT (recursive editable leaves) ==============
  const isScalarVal = (v) => v === null || v === undefined || typeof v !== 'object' || (v && v.$date);

  const objectIsEmpty = (v) => {
    if (v === null || v === undefined || v === '') return true;
    if (Array.isArray(v)) return v.filter(x => !objectIsEmpty(x)).length === 0;
    if (typeof v === 'object' && !v.$date) {
      return Object.entries(v).filter(([k]) => k !== '_id').every(([, val]) => objectIsEmpty(val));
    }
    return false;
  };

  // Get a nested leaf value honoring localEdits dot-path overrides
  const getLeafValue = (record, rootField, path, idx, fallback) => {
    const editKey = `${rootField}.${path.join('.')}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    return fallback;
  };

  const renderResultsLeaf = (record, rootField, path, idx, sectionId, value) => {
    const leafKeyState = `${rootField}.${path.join('.')}-${idx}-s0`;
    const editKeyEditing = `${rootField}.${path.join('.')}-${idx}-s0`;
    const displayValue = formatValue(getLeafValue(record, rootField, path, idx, value));
    const label = keyToLabel(path[path.length - 1]);
    const canEdit = !!record._id;
    const isEditing = editingField === editKeyEditing;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const isFieldEdited = sectionWasEdited && editedSentences[leafKeyState] === 'edited' && statusOverrides[idx] !== 'approved';
    const copyId = `${rootField}-${idx}-${path.join('.')}`;

    if (isEditing) {
      return (
        <div key={path.join('.')} className="nested-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <textarea
                ref={textareaRef}
                className="edit-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') handleCancelEdit();
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveLeaf(record, rootField, path, idx, sectionId, editValue.trim());
                }}
                rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))}
                disabled={saving}
              />
              <div className="edit-actions">
                <button className="edit-save-btn" onClick={() => handleSaveLeaf(record, rootField, path, idx, sectionId, editValue.trim())} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={path.join('.')} className="nested-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row${isFieldEdited ? ' modified' : ''}`}>
          <div
            className={`row-content${canEdit ? ' editable' : ''}`}
            onClick={() => { if (canEdit) { setEditingField(editKeyEditing); setEditValue(displayValue || ''); } }}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isFieldEdited && editIndicator}
          </div>
          <button
            className={`copy-btn ${copiedSectionId === copyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(`${label}: ${displayValue}`, copyId)}
          >
            {copiedSectionId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && <div className="modified-badge">edited -- click Pending Approve to save</div>}
      </div>
    );
  };

  const renderResultsNode = (record, rootField, idx, sectionId, label, value, path, depth) => {
    if (objectIsEmpty(value)) return null;
    if (isScalarVal(value)) return renderResultsLeaf(record, rootField, path, idx, sectionId, value);
    const entries = Object.entries(value).filter(([k, v]) => k !== '_id' && !objectIsEmpty(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('.') || rootField}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="nested-group">
          {entries.map(([k, v]) => (
            isScalarVal(v)
              ? renderResultsLeaf(record, rootField, [...path, k], idx, sectionId, v)
              : <div className="nested-mini-card" key={k}>{renderResultsNode(record, rootField, idx, sectionId, keyToLabel(k), v, [...path, k], depth + 1)}</div>
          ))}
        </div>
      </React.Fragment>
    );
  };

  const buildResultsCopyLines = (label, value, indent) => {
    const pad = '  '.repeat(indent);
    const out = [];
    if (objectIsEmpty(value)) return out;
    // Scalar leaf: label rides on its OWN line with the value indented below — never "Label: value" inline
    // (canonical: no side-by-side Label:value row in the Copy-All output).
    if (isScalarVal(value)) {
      if (label) { out.push(`${pad}${label}`); out.push(`${pad}  ${formatValue(value)}`); }
      else out.push(`${pad}${formatValue(value)}`);
      return out;
    }
    if (label) out.push(`${pad}${label}:`);
    Object.entries(value).filter(([k, v]) => k !== '_id' && !objectIsEmpty(v)).forEach(([k, v]) => {
      out.push(...buildResultsCopyLines(keyToLabel(k), v, indent + (label ? 1 : 0)));
    });
    return out;
  };

  const renderResultsSection = (record, idx) => {
    const resultsVal = (localEdits[`results-${idx}`] !== undefined) ? localEdits[`results-${idx}`] : record.results;
    if (!resultsVal || typeof resultsVal !== 'object' || objectIsEmpty(resultsVal)) return null;
    const entries = Object.entries(resultsVal).filter(([k, v]) => k !== '_id' && !objectIsEmpty(v));
    if (entries.length === 0) return null;

    const sectionTitleMatches = (() => {
      if (!searchTerm) return false;
      return 'results'.startsWith(searchTerm.toLowerCase().trim());
    })();

    const contentArgs = flattenValues(resultsVal);
    if (!shouldShowSection(record, 'Results', ...contentArgs)) return null;

    const copyText = `RESULTS\n${buildResultsCopyLines('', resultsVal, 0).join('\n')}`;

    return (
      <div className="field-container" key="results">
        {renderSectionHeader('Results', `results-section-${idx}`, () => copyToClipboard(copyText, `results-section-${idx}`), idx, 'results')}
        <div className="mini-cards-container">
          <div className="rec-mini-card">
            {entries.map(([k, v]) => (
              isScalarVal(v)
                ? renderResultsLeaf(record, 'results', [k], idx, 'results', v)
                : <div className="nested-mini-card" key={k}>{renderResultsNode(record, 'results', idx, 'results', keyToLabel(k), v, [k], 1)}</div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Render editable text section (assessment, plan - whole field editing)
  const renderTextSection = (record, idx, fieldName, title, text) => {
    const displayValue = getFieldValue(record, fieldName, idx);
    const displayText = displayValue || text;
    if (!displayText || !String(displayText).trim()) return null;
    const items = splitIntoItems(displayText);
    if (items.length === 0) return null;

    const canEdit = !!record._id;
    const sectionKey = `${fieldName}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const isFieldEdited = sectionWasEdited && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';

    const sectionTitleMatches = (() => {
      if (!searchTerm) return false;
      return title.toLowerCase().startsWith(searchTerm.toLowerCase().trim());
    })();

    if (!shouldShowSection(record, title, ...items)) return null;

    const visibleItems = items.filter(item => {
      if (!searchTerm || record._showAllSections || sectionTitleMatches) return true;
      return shouldShowRow(record, stripNumber(item));
    });

    if (visibleItems.length === 0) return null;

    return (
      <div className="field-container" key={fieldName}>
        {renderSectionHeader(title, `${fieldName}-section-${idx}`, () => copyToClipboard(
          `${title.toUpperCase()}\n${items.map((item, i) => `${i + 1}. ${stripNumber(item)}`).join('\n')}`,
          `${fieldName}-section-${idx}`
        ), idx, fieldName)}
        <div className="mini-cards-container">
          {isEditing ? (
            <div className="rec-mini-card">
              <div className="numbered-row edit-row">
                <div className="edit-field-container">
                  <textarea
                    ref={textareaRef}
                    className="edit-textarea"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') handleCancelEdit();
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveField(record, fieldName, idx, fieldName);
                    }}
                    rows={Math.max(3, Math.ceil((editValue?.length || 0) / 60))}
                    disabled={saving}
                  />
                  <div className="edit-actions">
                    <button className="edit-save-btn" onClick={() => handleSaveField(record, fieldName, idx, fieldName)} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            visibleItems.map((item, itemIdx) => (
              <div key={itemIdx} className={`rec-mini-card${isFieldEdited ? '' : ''}`}>
                <div className={`numbered-row${isFieldEdited ? ' modified' : ''}`}>
                  <div
                    className={`row-content${canEdit ? ' editable' : ''}`}
                    onClick={() => canEdit && handleStartEdit(fieldName, idx, String(displayText))}
                    title={canEdit ? 'Click to edit' : undefined}
                  >
                    <span className="content-value">{highlightText(stripNumber(item))}</span>
                    {canEdit && !isFieldEdited && itemIdx === 0 && editIndicator}
                  </div>
                  <button
                    className={`copy-btn ${copiedSectionId === `${fieldName}-${idx}-${itemIdx}` ? 'copied' : ''}`}
                    onClick={() => copyToClipboard(stripNumber(item), `${fieldName}-${idx}-${itemIdx}`)}
                  >
                    {copiedSectionId === `${fieldName}-${idx}-${itemIdx}` ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                {isFieldEdited && itemIdx === visibleItems.length - 1 && <div className="modified-badge">edited -- click Pending Approve to save</div>}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  // Render editable subtitle text section (findings, notes with embedded labels like "PHQ-9 notable items:")
  const renderSubtitleTextSection = (record, idx, fieldName, title, text) => {
    const displayValue = getFieldValue(record, fieldName, idx);
    const displayText = displayValue || text;
    if (!displayText || !String(displayText).trim()) return null;

    const parsed = parseSubtitleItems(displayText);
    const hasSubtitles = parsed.some(item => item.label);

    // If no subtitles found, fall back to regular text section
    if (!hasSubtitles) return renderTextSection(record, idx, fieldName, title, displayText);

    const canEdit = !!record._id;
    const sectionKey = `${fieldName}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const isFieldEdited = sectionWasEdited && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';

    const sectionTitleMatches = (() => {
      if (!searchTerm) return false;
      return title.toLowerCase().startsWith(searchTerm.toLowerCase().trim());
    })();

    const contentArgs = parsed.flatMap(item => [item.label, item.value].filter(Boolean));
    if (!shouldShowSection(record, title, ...contentArgs)) return null;

    const visibleItems = parsed.filter(item => {
      if (!searchTerm || record._showAllSections || sectionTitleMatches) return true;
      return shouldShowRow(record, item.label, item.value);
    });

    if (visibleItems.length === 0) return null;

    const getSectionText = () => {
      let copyText = `${title.toUpperCase()}\n`;
      parsed.forEach((item, i) => {
        if (item.label) copyText += `${item.label}: ${item.value}\n`;
        else copyText += `${i + 1}. ${item.value}\n`;
      });
      return copyText;
    };

    return (
      <div className="field-container" key={fieldName}>
        {renderSectionHeader(title, `${fieldName}-section-${idx}`, () => copyToClipboard(getSectionText(), `${fieldName}-section-${idx}`), idx, fieldName)}
        <div className="mini-cards-container">
          {isEditing ? (
            <div className="rec-mini-card">
              <div className="numbered-row edit-row">
                <div className="edit-field-container">
                  <textarea
                    ref={textareaRef}
                    className="edit-textarea"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') handleCancelEdit();
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveField(record, fieldName, idx, fieldName);
                    }}
                    rows={Math.max(3, Math.ceil((editValue?.length || 0) / 60))}
                    disabled={saving}
                  />
                  <div className="edit-actions">
                    <button className="edit-save-btn" onClick={() => handleSaveField(record, fieldName, idx, fieldName)} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            visibleItems.map((item, itemIdx) => {
              if (item.label) {
                return (
                  <div key={itemIdx} className="rec-mini-card">
                    <div className="nested-subtitle">{highlightText(item.label)}</div>
                    <div className={`numbered-row${isFieldEdited ? ' modified' : ''}`}>
                      <div
                        className={`row-content${canEdit ? ' editable' : ''}`}
                        onClick={() => canEdit && handleStartEdit(fieldName, idx, String(displayText))}
                        title={canEdit ? 'Click to edit' : undefined}
                      >
                        <span className="content-value">{highlightText(item.value)}</span>
                        {canEdit && !isFieldEdited && itemIdx === 0 && editIndicator}
                      </div>
                      <button
                        className={`copy-btn ${copiedSectionId === `${fieldName}-${idx}-${itemIdx}` ? 'copied' : ''}`}
                        onClick={() => copyToClipboard(`${item.label}: ${item.value}`, `${fieldName}-${idx}-${itemIdx}`)}
                      >
                        {copiedSectionId === `${fieldName}-${idx}-${itemIdx}` ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    {isFieldEdited && itemIdx === visibleItems.length - 1 && <div className="modified-badge">edited -- click Pending Approve to save</div>}
                  </div>
                );
              }
              return (
                <div key={itemIdx} className="rec-mini-card">
                  <div className={`numbered-row${isFieldEdited ? ' modified' : ''}`}>
                    <div
                      className={`row-content${canEdit ? ' editable' : ''}`}
                      onClick={() => canEdit && handleStartEdit(fieldName, idx, String(displayText))}
                      title={canEdit ? 'Click to edit' : undefined}
                    >
                      <span className="content-value">{highlightText(item.value)}</span>
                      {canEdit && !isFieldEdited && itemIdx === 0 && editIndicator}
                    </div>
                    <button
                      className={`copy-btn ${copiedSectionId === `${fieldName}-${idx}-${itemIdx}` ? 'copied' : ''}`}
                      onClick={() => copyToClipboard(item.value, `${fieldName}-${idx}-${itemIdx}`)}
                    >
                      {copiedSectionId === `${fieldName}-${idx}-${itemIdx}` ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  {isFieldEdited && itemIdx === visibleItems.length - 1 && <div className="modified-badge">edited -- click Pending Approve to save</div>}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // Render array section (customScales = read-only, recommendations = editable)
  const EDITABLE_FIELDS = ['findings', 'assessment', 'plan', 'notes', 'provider', 'facility', 'recommendations'];
  const renderArraySection = (record, idx, fieldName, title, items) => {
    const safeItems = safeArray(items);
    if (safeItems.length === 0) return null;
    const isEditable = EDITABLE_FIELDS.includes(fieldName);

    const sectionTitleMatches = (() => {
      if (!searchTerm) return false;
      return title.toLowerCase().startsWith(searchTerm.toLowerCase().trim());
    })();

    if (!shouldShowSection(record, title, ...safeItems)) return null;

    const visibleItems = safeItems.filter(item => {
      if (!searchTerm || record._showAllSections || sectionTitleMatches) return true;
      return shouldShowRow(record, item);
    });

    if (visibleItems.length === 0) return null;

    return (
      <div className="field-container" key={fieldName}>
        {isEditable ? (
          renderSectionHeader(title, `${fieldName}-section-${idx}`, () => copyToClipboard(
            `${title.toUpperCase()}\n${safeItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}`,
            `${fieldName}-section-${idx}`
          ), idx, fieldName)
        ) : (
          <div className="field-header">
            <span className="field-title">{highlightText(title)}</span>
            <button
              className={`section-copy-btn ${copiedSectionId === `${fieldName}-section-${idx}` ? 'copied' : ''}`}
              onClick={() => copyToClipboard(
                `${title.toUpperCase()}\n${safeItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}`,
                `${fieldName}-section-${idx}`
              )}
            >
              {copiedSectionId === `${fieldName}-section-${idx}` ? 'Copied!' : 'Copy Section'}
            </button>
          </div>
        )}
        <div className="mini-cards-container">
          {visibleItems.map((item, itemIdx) => {
            if (isEditable) {
              return (
                <div key={itemIdx} className="rec-mini-card">
                  {renderEditableArrayItem(record, fieldName, item, idx, itemIdx, fieldName, `${fieldName}-${idx}-${itemIdx}`)}
                </div>
              );
            }
            return (
              <div key={itemIdx} className="rec-mini-card">
                <div className="numbered-row">
                  <div className="row-content">
                    <span className="content-value">{highlightText(item)}</span>
                  </div>
                  <button
                    className={`copy-btn ${copiedSectionId === `${fieldName}-${idx}-${itemIdx}` ? 'copied' : ''}`}
                    onClick={() => copyToClipboard(item, `${fieldName}-${idx}-${itemIdx}`)}
                  >
                    {copiedSectionId === `${fieldName}-${idx}-${itemIdx}` ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render custom scales (array of {name, score, interpretation} objects, or plain strings)
  const renderCustomScalesSection = (record, idx) => {
    const items = safeArray(record.customScales);
    if (items.length === 0) return null;
    const asText = (it) => typeof it === 'string' ? it : [it.name, (it.score !== undefined && it.score !== null && it.score !== '') ? `Score: ${it.score}` : null, it.interpretation ? `Interpretation: ${it.interpretation}` : null].filter(Boolean).join(' -- ');

    const sectionTitleMatches = (() => {
      if (!searchTerm) return false;
      return 'custom scales'.startsWith(searchTerm.toLowerCase().trim());
    })();

    if (!shouldShowSection(record, 'Custom Scales', ...items.map(asText))) return null;

    const visibleItems = items.filter(it => {
      if (!searchTerm || record._showAllSections || sectionTitleMatches) return true;
      return shouldShowRow(record, asText(it));
    });
    if (visibleItems.length === 0) return null;

    const copyText = `CUSTOM SCALES\n${items.map((it, i) => `${i + 1}. ${asText(it)}`).join('\n')}`;

    return (
      <div className="field-container" key="customScales">
        <div className="field-header">
          <span className="field-title">{highlightText('Custom Scales')}</span>
          <button
            className={`section-copy-btn ${copiedSectionId === `customScales-section-${idx}` ? 'copied' : ''}`}
            onClick={() => copyToClipboard(copyText, `customScales-section-${idx}`)}
          >
            {copiedSectionId === `customScales-section-${idx}` ? 'Copied!' : 'Copy Section'}
          </button>
        </div>
        <div className="mini-cards-container">
          {visibleItems.map((it, itemIdx) => {
            if (typeof it === 'string') {
              return (
                <div key={itemIdx} className="rec-mini-card">
                  <div className="numbered-row">
                    <div className="row-content"><span className="content-value">{highlightText(it)}</span></div>
                    <button className={`copy-btn ${copiedSectionId === `cs-${idx}-${itemIdx}` ? 'copied' : ''}`} onClick={() => copyToClipboard(it, `cs-${idx}-${itemIdx}`)}>{copiedSectionId === `cs-${idx}-${itemIdx}` ? 'Copied!' : 'Copy'}</button>
                  </div>
                </div>
              );
            }
            // Scale name rides as the nested-subtitle; score + interpretation combine into ONE value below it —
            // never "Score: 12" inline (canonical: no side-by-side Label:value row).
            const parts = [];
            if (it.score !== undefined && it.score !== null && it.score !== '') parts.push(String(it.score));
            if (it.interpretation) parts.push(String(it.interpretation));
            const combined = parts.join(' — ');
            return (
              <div key={itemIdx} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(it.name || `Scale ${itemIdx + 1}`)}</div>
                {combined && (
                  <div className="numbered-row">
                    <div className="row-content"><span className="content-value">{highlightText(combined)}</span></div>
                    <button className={`copy-btn ${copiedSectionId === `cs-${idx}-${itemIdx}` ? 'copied' : ''}`} onClick={() => copyToClipboard(combined, `cs-${idx}-${itemIdx}`)}>{copiedSectionId === `cs-${idx}-${itemIdx}` ? 'Copied!' : 'Copy'}</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render editable provider info section
  const renderProviderSection = (record, idx) => {
    const providerVal = getFieldValue(record, 'provider', idx) || record.provider;
    const facilityVal = getFieldValue(record, 'facility', idx) || record.facility;
    const providerObj = {};
    if (providerVal) providerObj.provider = providerVal;
    if (facilityVal) providerObj.facility = facilityVal;
    const entries = Object.entries(providerObj);
    if (entries.length === 0) return null;

    const sectionTitleMatches = (() => {
      if (!searchTerm) return false;
      return 'provider information'.startsWith(searchTerm.toLowerCase().trim());
    })();

    const contentArgs = entries.flatMap(([k, v]) => [keyToLabel(k), v]);
    if (!shouldShowSection(record, 'Provider Information', ...contentArgs)) return null;

    return (
      <div className="field-container" key="provider">
        {renderSectionHeader('Provider Information', `provider-section-${idx}`, () => copyToClipboard(
          `PROVIDER INFORMATION\n${entries.map(([k, v], i) => `${i + 1}. ${keyToLabel(k)}: ${v}`).join('\n')}`,
          `provider-section-${idx}`
        ), idx, 'provider')}
        <div className="mini-cards-container">
          {entries.map(([key, value]) => (
            renderEditableField(record, key, keyToLabel(key), idx, 'provider', `provider-${key}-${idx}`)
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="psychiatric-assessment-scales-document" ref={documentRef}>
      {/* Header */}
      <div className="document-header">
        <div className="header-title">
          <h2>Psychiatric Assessment Scales</h2>
          <span className="record-count">({filteredRecords.length} report{filteredRecords.length !== 1 ? 's' : ''})</span>
        </div>
        <div className="header-actions">
          <button
            className={`copy-all-btn ${copiedSectionId === 'copy-all' ? 'copied' : ''}`}
            onClick={() => copyToClipboard(generateCopyAllText(), 'copy-all')}
          >
            {copiedSectionId === 'copy-all' ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<PsychiatricAssessmentScalesDocumentPDFTemplate document={pdfData} />}
            fileName="Psychiatric_Assessment_Scales.pdf"
            className="export-pdf-btn"
          >
            {({ loading }) => (loading ? 'Preparing PDF...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>
      </div>

      {/* Search Bar */}
      <div className="search-container">
        <input
          type="text"
          className="search-bar"
          placeholder="Search psychiatric assessment scales..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button className="clear-search" onClick={() => setSearchTerm('')}>
            Clear
          </button>
        )}
      </div>

      {/* Records */}
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={record._id || idx} className="record-card">
            {/* Record Header */}
            <div className="record-header">
              <h3>{highlightText(`Psychiatric Assessment Scales ${idx + 1}`)}</h3>
            </div>

            {/* Date */}
            {record.date && (
              <div className="field-container">
                <div className="mini-cards-container">
                  <div className="rec-mini-card">
                    <div className="nested-subtitle">{highlightText('Date')}</div>
                    <div className="numbered-row">
                      <div className="row-content"><span className="content-value">{highlightText(formatDate(record.date))}</span></div>
                      <button className={`copy-btn ${copiedSectionId === `date-${idx}` ? 'copied' : ''}`} onClick={() => copyToClipboard(formatDate(record.date), `date-${idx}`)}>{copiedSectionId === `date-${idx}` ? 'Copied!' : 'Copy'}</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Provider Information */}
            {renderProviderSection(record, idx)}

            {/* Assessment Scales */}
            {renderScalesSection(record, idx)}

            {/* Results */}
            {renderResultsSection(record, idx)}

            {/* Custom Scales */}
            {renderCustomScalesSection(record, idx)}

            {/* Findings */}
            {renderSubtitleTextSection(record, idx, 'findings', 'Findings', record.findings)}

            {/* Assessment */}
            {renderTextSection(record, idx, 'assessment', 'Assessment', record.assessment)}

            {/* Plan */}
            {renderTextSection(record, idx, 'plan', 'Plan', record.plan)}

            {/* Recommendations */}
            {renderArraySection(record, idx, 'recommendations', 'Recommendations', record.recommendations)}

            {/* Notes */}
            {renderSubtitleTextSection(record, idx, 'notes', 'Notes', record.notes)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PsychiatricAssessmentScalesDocument;
