import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import DiagnosesDocumentPDFTemplate from '../pdf-templates/DiagnosesDocumentPDFTemplate';
import './DiagnosesDocument.css';
import SearchBar from '../components/SearchBar';
import BlueDatePicker from '../components/BlueDatePicker';

/**
 * DiagnosesDocument - December 2025
 *
 * Displays patient diagnoses grouped by status (Active, Chronic, Resolved, Ruled Out).
 * Uses mini-card pattern with 4-level search and blue theme.
 *
 * Fields from MongoDB:
 * - diagnosis (string) - Main diagnosis name
 * - icdCode (string) - ICD-10 code
 * - type (string) - primary/secondary
 * - status (string) - active/chronic/resolved/ruled_out
 * - severity (string) - Severity description
 * - date ($date) - Diagnosis date
 * - provider (string) - Diagnosing provider
 * - facility (string) - Healthcare facility
 * - notes (string) - Clinical notes
 * - stage, laterality, prognosis, clinicalSignificance, targetIOp, riskFactors
 */

// ========== TEXT SPLITTING HELPERS (parenthesis-aware) ==========
// Split narrative text into sentences on `.`/`;` at paren depth 0 (abbr-safe).
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

// Detect a leading "Label: value" (label = up to 5 words, letters/space/-/()/ only).
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { label: '', value: text || '', isLabeled: false };
  const colonIdx = text.indexOf(':');
  if (colonIdx > 0 && colonIdx <= 40) {
    const beforeColon = text.substring(0, colonIdx).trim();
    if (/^[A-Za-z][A-Za-z\s\-/()]*$/.test(beforeColon) && beforeColon.split(/\s+/).length <= 5) {
      const afterColon = text.substring(colonIdx + 1).trim();
      if (afterColon.length > 0) {
        return { label: beforeColon, value: afterColon, isLabeled: true };
      }
    }
  }
  return { label: '', value: text, isLabeled: false };
};

// Split a value by commas that are NOT inside parentheses.
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text];
  const parts = [];
  let current = '';
  let parenDepth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (ch === ',' && parenDepth === 0) {
      const trimmed = current.trim();
      if (trimmed) parts.push(trimmed);
      current = '';
    } else {
      current += ch;
    }
  }
  const trimmed = current.trim();
  if (trimmed) parts.push(trimmed);
  return parts.length > 1 ? parts : [text];
};

// Canonical copy dividers (one-pass item 2): '=' under record/section titles,
// '-' under every field sub-label. Every value row is numbered (item 3).
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [diagId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'diagnosesPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const DiagnosesDocument = ({ document, data }) => {
  const templateData = document || data;

  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [copiedSectionId, setCopiedSectionId] = useState(null);

  // Editing state — per-template isolation (NO shared hooks)
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [statusOverrides, setStatusOverrides] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const textareaRef = useRef(null);

  // ========== DATA UNWRAPPING ==========
  const unwrappedData = useMemo(() => {
    if (!templateData) return [];
    if (Array.isArray(templateData)) {
      // Handle wrapped format: [{diagnoses: [...]}] or direct array
      if (templateData.length > 0 && templateData[0]?.diagnoses) {
        return templateData.flatMap(item => item.diagnoses || []);
      }
      return templateData;
    }
    if (templateData.diagnoses) {
      return templateData.diagnoses;
    }
    return [templateData];
  }, [templateData]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nStatus = {};
    unwrappedData.forEach((dx, idx) => {
      const recId = dx && dx._id ? (dx._id.$oid || dx._id) : null;
      const recDrafts = recId ? store[recId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[`details-${idx}`] = true;
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
  }, [unwrappedData]);

  // ========== pdfData — merges localEdits into records for PDF + Copy All ==========
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return unwrappedData;
    return unwrappedData.map((dx, idx) => {
      const merged = { ...dx };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldName = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx === idx) merged[fieldName] = editVal;
      }
      return merged;
    });
  }, [unwrappedData, localEdits, pendingEdits]);

  // ========== DATE FORMATTING ==========
  const formatDate = useCallback((dateValue) => {
    if (!dateValue) return '';
    try {
      const date = new Date(dateValue.$date || dateValue);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return String(dateValue);
    }
  }, []);

  // ========== HELPER: Check if value exists ==========
  const hasValue = useCallback((val) => {
    if (val === null || val === undefined || val === '') return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'string') return val.trim().length > 0;
    return true;
  }, []);

  // ========== HELPER: Valid clinical onset date? ==========
  // dateIdentified is the clinical onset/identification date. Treat null/empty
  // and the epoch sentinel 1970-01-01 as "unknown".
  const hasIdentifiedDate = useCallback((val) => {
    if (!hasValue(val)) return false;
    const d = new Date(val.$date || val);
    if (isNaN(d.getTime())) return false;
    return !(d.getUTCFullYear() === 1970 && d.getUTCMonth() === 0 && d.getUTCDate() === 1);
  }, [hasValue]);

  // ========== HELPER: Badge date — ONSET only (record `date` is the AI-processing
  // timestamp, not a clinical date; never surface it). Hidden when onset unknown so the
  // header badge mirrors the "Date Identified" field exactly. ==========
  const getBadgeDate = useCallback((dx) =>
    hasIdentifiedDate(dx.dateIdentified) ? dx.dateIdentified : null,
  [hasIdentifiedDate]);

  // ========== EDITING HANDLERS ==========

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
  const handleSaveField = useCallback((diagnosis, fieldName, idx, sectionId, arrayIndex) => {
    const diagId = diagnosis._id ? (diagnosis._id.$oid || diagnosis._id) : null;
    if (!diagId) {
      console.error('[Diagnoses] Cannot save — no diagnosis _id');
      return;
    }
    const value = editValue.trim();
    const fieldPart = typeof arrayIndex === 'number' ? `${fieldName}.${arrayIndex}` : fieldName;
    const editKey = `${fieldPart}-${idx}`;
    const sectionKey = `${sectionId}-${idx}`;

    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [sectionKey]: true }));
    setEditedSentences(prev => ({ ...prev, [`${fieldPart}-${idx}-s0`]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));

    const store = readDrafts();
    if (!store[diagId]) store[diagId] = {};
    store[diagId][fieldPart] = value;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this diagnosis to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApprove = useCallback(async (diagnosis, idx) => {
    const diagId = diagnosis._id ? (diagnosis._id.$oid || diagnosis._id) : null;
    if (!diagId) {
      console.error('[Diagnoses] Cannot approve — no diagnosis _id');
      return;
    }

    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const dotIdx = fieldPart.lastIndexOf('.');
        const isArrayIdx = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
        const payload = { field: isArrayIdx ? fieldPart.slice(0, dotIdx) : fieldPart, value: localEdits[editKey] };
        if (isArrayIdx) payload.arrayIndex = parseInt(fieldPart.slice(dotIdx + 1), 10);
        const resp = await secureApiClient.put(`/api/edit/diagnoses/${diagId}/edit`, payload);
        if (!resp || !resp.success) throw new Error((resp && resp.error) || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/diagnoses/${diagId}/approve`);

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this diagnosis's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[diagId]) { delete store[diagId]; writeDrafts(store); }

      setStatusOverrides(prev => ({ ...prev, [idx]: 'approved' }));
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
      console.error('[Diagnoses] Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  const getFieldValue = useCallback((diagnosis, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    const val = diagnosis[fieldName];
    if (Array.isArray(val)) return val.join(', ');
    return val;
  }, [localEdits]);

  // ========== RENDER EDITABLE FIELD ==========
  // Enum field editor — a <select> dropdown (e.g. Type: primary/secondary) instead of free text.
  const renderEnumField = (diagnosis, fieldName, label, idx, sectionId, baseOptions) => {
    const displayValue = getFieldValue(diagnosis, fieldName, idx);
    if (!hasValue(displayValue)) return null;

    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const canEdit = !!diagnosis._id;
    const copyId = `${fieldName}-${idx}`;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const sentenceState = sectionWasEdited ? editedSentences[`${fieldName}-${idx}-s0`] : undefined;
    const diagStatus = statusOverrides[idx] || 'active';
    const isFieldEdited = sentenceState === 'edited' && diagStatus !== 'approved';
    // Always keep the current value selectable (in case data has a value outside the base list).
    const options = Array.from(new Set([...baseOptions, String(displayValue || '').toLowerCase()].filter(Boolean)));

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={fieldName}>
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <select
                className="edit-select"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                disabled={saving}
                autoFocus
              >
                {options.map(opt => (
                  <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                ))}
              </select>
              <div className="edit-actions">
                <button
                  className="edit-save-btn"
                  onClick={() => handleSaveField(diagnosis, fieldName, idx, sectionId)}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rec-mini-card" key={fieldName}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isFieldEdited ? 'modified' : ''}`}>
          <div
            className={`row-content ${canEdit ? 'editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(fieldName, idx, String(displayValue).toLowerCase())}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isFieldEdited && (
              <span className="edit-indicator">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
                <span className="edit-tag">edit</span>
              </span>
            )}
          </div>
          <button
            className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(String(displayValue), copyId)}
          >
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && (
          <div className="modified-badge">edited — click Pending Approve to save</div>
        )}
      </div>
    );
  };

  // Date editor — themed BlueDatePicker (never a native <input type="date">). Displays the
  // formatted date; edits/saves the raw ISO string. Value round-trips through formatDate in copy/PDF.
  const renderDateField = (diagnosis, fieldName, label, idx, sectionId) => {
    const rawValue = getFieldValue(diagnosis, fieldName, idx);
    if (!hasIdentifiedDate(rawValue)) return null;

    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const canEdit = !!diagnosis._id;
    const copyId = `${fieldName}-${idx}`;
    const sectionKey = `${sectionId}-${idx}`;
    const sentenceState = editedFields[sectionKey] ? editedSentences[`${fieldName}-${idx}-s0`] : undefined;
    const diagStatus = statusOverrides[idx] || 'active';
    const isFieldEdited = sentenceState === 'edited' && diagStatus !== 'approved';
    const shown = formatDate(rawValue);

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={fieldName}>
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={(iso) => setEditValue(iso)} />
              <div className="edit-actions">
                <button className="edit-save-btn" onClick={() => handleSaveField(diagnosis, fieldName, idx, sectionId)} disabled={saving}>
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
        <div className={`numbered-row ${isFieldEdited ? 'modified' : ''}`}>
          <div
            className={`row-content ${canEdit ? 'editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(fieldName, idx, rawValue)}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span className="content-value">{highlightText(shown)}</span>
            {canEdit && !isFieldEdited && (
              <span className="edit-indicator">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
                <span className="edit-tag">edit</span>
              </span>
            )}
          </div>
          <button className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`} onClick={() => copyToClipboard(shown, copyId)}>
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && (<div className="modified-badge">edited — click Pending Approve to save</div>)}
      </div>
    );
  };

  const renderEditableField = (diagnosis, fieldName, label, idx, sectionId) => {
    const displayValue = getFieldValue(diagnosis, fieldName, idx);
    if (!hasValue(displayValue)) return null;

    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const canEdit = !!diagnosis._id;
    const copyId = `${fieldName}-${idx}`;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const sentenceState = sectionWasEdited ? editedSentences[`${fieldName}-${idx}-s0`] : undefined;
    const diagStatus = statusOverrides[idx] || 'active';
    const isFieldEdited = sentenceState === 'edited' && diagStatus !== 'approved';

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
                rows={Math.max(2, editValue.split('\n').length)}
                disabled={saving}
              />
              <div className="edit-actions">
                <button
                  className="edit-save-btn"
                  onClick={() => handleSaveField(diagnosis, fieldName, idx, sectionId)}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rec-mini-card" key={fieldName}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isFieldEdited ? 'modified' : ''}`}>
          <div
            className={`row-content ${canEdit ? 'editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue)}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isFieldEdited && (
              <span className="edit-indicator">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
                <span className="edit-tag">edit</span>
              </span>
            )}
          </div>
          <button
            className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(String(displayValue), copyId)}
          >
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && (
          <div className="modified-badge">edited — click Pending Approve to save</div>
        )}
      </div>
    );
  };

  // ========== RENDER NOTES FIELD (sentence + labeled-comma split) ==========
  // Narrative notes are split by sentence. A labeled sentence whose value has
  // >=3 parenthesis-aware comma items renders as a nested-mini-card: the label
  // as a sub-label, each comma item as its own row. Generic sentences render as
  // a bare row (orphan-prevention). Editing is whole-field, same UX as others.
  const renderNotesField = (diagnosis, idx, sectionId) => {
    const fieldName = 'notes';
    const displayValue = getFieldValue(diagnosis, fieldName, idx);
    if (!hasValue(displayValue)) return null;

    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const canEdit = !!diagnosis._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const sentenceState = sectionWasEdited ? editedSentences[`${fieldName}-${idx}-s0`] : undefined;
    const diagStatus = statusOverrides[idx] || 'active';
    const isFieldEdited = sentenceState === 'edited' && diagStatus !== 'approved';

    // Edit mode — edit the whole Notes value (same textarea UX as other fields)
    if (isEditing) {
      return (
        <div className="rec-mini-card" key={fieldName}>
          <div className="nested-subtitle">{highlightText('Notes')}</div>
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <textarea
                ref={textareaRef}
                className="edit-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={Math.max(3, editValue.split('\n').length)}
                disabled={saving}
              />
              <div className="edit-actions">
                <button
                  className="edit-save-btn"
                  onClick={() => handleSaveField(diagnosis, fieldName, idx, sectionId)}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // View mode — split + render
    const sentences = splitBySentence(String(displayValue));
    const startEdit = () => canEdit && handleStartEdit(fieldName, idx, displayValue);
    let pencilShown = false;

    const renderRow = (text, rowKey, copyKey) => {
      const showPencil = canEdit && !isFieldEdited && !pencilShown;
      if (showPencil) pencilShown = true;
      return (
        <div className="numbered-row" key={rowKey}>
          <div
            className={`row-content ${canEdit ? 'editable' : ''}`}
            onClick={startEdit}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span className="content-value">{highlightText(text)}</span>
            {showPencil && (
              <span className="edit-indicator">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
                <span className="edit-tag">edit</span>
              </span>
            )}
          </div>
          <button
            className={`copy-btn ${copiedId === copyKey ? 'copied' : ''}`}
            onClick={() => copyToClipboard(text, copyKey)}
          >
            {copiedId === copyKey ? 'Copied!' : 'Copy'}
          </button>
        </div>
      );
    };

    return (
      <div className="rec-mini-card" key={fieldName}>
        <div className="nested-subtitle">{highlightText('Notes')}</div>
        {sentences.map((sentence, sIdx) => {
          const parsed = parseLabel(sentence);
          const commaItems = parsed.isLabeled ? splitByComma(parsed.value) : [];
          if (parsed.isLabeled && commaItems.length >= 3) {
            return (
              <div className="nested-mini-card" key={`g-${sIdx}`}>
                <div className="nested-subtitle sub-label">{highlightText(parsed.label)}</div>
                {commaItems.map((item, cIdx) =>
                  renderRow(item, `n-${idx}-${sIdx}-${cIdx}`, `notes-${idx}-${sIdx}-${cIdx}`)
                )}
              </div>
            );
          }
          return renderRow(sentence, `n-${idx}-${sIdx}`, `notes-${idx}-${sIdx}`);
        })}
        {isFieldEdited && (
          <div className="modified-badge">edited — click Pending Approve to save</div>
        )}
      </div>
    );
  };

  // ========== RENDER SPLIT FIELD (split value into rows; whole-field edit) ==========
  // `splitter` = splitByComma (list fields like Diagnosis) or splitBySentence
  // (narrative fields like Stage). Each piece is its own row; editing acts on the
  // whole field (same textarea UX as the other fields).
  const renderSplitField = (diagnosis, fieldName, label, idx, sectionId, splitter) => {
    const displayValue = getFieldValue(diagnosis, fieldName, idx);
    if (!hasValue(displayValue)) return null;

    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const canEdit = !!diagnosis._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const sentenceState = sectionWasEdited ? editedSentences[`${fieldName}-${idx}-s0`] : undefined;
    const diagStatus = statusOverrides[idx] || 'active';
    const isFieldEdited = sentenceState === 'edited' && diagStatus !== 'approved';

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
                rows={Math.max(2, editValue.split('\n').length)}
                disabled={saving}
              />
              <div className="edit-actions">
                <button
                  className="edit-save-btn"
                  onClick={() => handleSaveField(diagnosis, fieldName, idx, sectionId)}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const items = splitter(String(displayValue));
    const startEdit = () => canEdit && handleStartEdit(fieldName, idx, displayValue);

    return (
      <div className="rec-mini-card" key={fieldName}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        {items.map((item, i) => (
          <div className={`numbered-row ${isFieldEdited ? 'modified' : ''}`} key={i}>
            <div
              className={`row-content ${canEdit ? 'editable' : ''}`}
              onClick={startEdit}
              title={canEdit ? 'Click to edit' : undefined}
            >
              <span className="content-value">{highlightText(item)}</span>
              {canEdit && !isFieldEdited && i === 0 && (
                <span className="edit-indicator">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                  </svg>
                  <span className="edit-tag">edit</span>
                </span>
              )}
            </div>
            <button
              className={`copy-btn ${copiedId === `${fieldName}-${idx}-${i}` ? 'copied' : ''}`}
              onClick={() => copyToClipboard(item, `${fieldName}-${idx}-${i}`)}
            >
              {copiedId === `${fieldName}-${idx}-${i}` ? 'Copied!' : 'Copy'}
            </button>
          </div>
        ))}
        {isFieldEdited && (
          <div className="modified-badge">edited — click Pending Approve to save</div>
        )}
      </div>
    );
  };

  // ========== LEVEL 4: shouldShowRow ==========
  const shouldShowRow = useCallback((record, ...valuesToCheck) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();

    for (const val of valuesToCheck) {
      if (val && String(val).toLowerCase().includes(phrase)) {
        return true;
      }
    }
    return false;
  }, [searchTerm]);

  // ========== LEVEL 2: shouldShowSection ==========
  const shouldShowSection = useCallback((record, sectionTitle, contentToCheck, additionalKeywords = []) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();

    // Check section title
    const titleLower = sectionTitle.toLowerCase();
    if (titleLower.includes(phrase) || phrase.includes(titleLower)) return true;

    // Check additional keywords
    for (const kw of additionalKeywords) {
      if (kw && kw.toLowerCase().includes(phrase)) return true;
    }

    // Check content
    const content = (contentToCheck || '').toLowerCase();
    return content.includes(phrase);
  }, [searchTerm]);

  // ========== HIGHLIGHT TEXT ==========
  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || !text) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = String(text).split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i}>{part}</mark> : part
    );
  }, [searchTerm]);

  // ========== COPY TO CLIPBOARD ==========
  const copyToClipboard = useCallback(async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, []);

  const copySectionToClipboard = useCallback(async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSectionId(id);
      setTimeout(() => setCopiedSectionId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, []);

  // ========== FORMAT NOTES (sentence + labeled-comma split) ==========
  // Mirrors the on-screen rendering: each sentence on its own line; a labeled
  // sentence whose value has >=3 parenthesis-aware comma items becomes a
  // "Label:" header followed by one bullet per item.
  const formatNotesForCopy = useCallback((notes) => {
    if (!notes) return '';
    const sentences = splitBySentence(String(notes));
    if (sentences.length === 0) return String(notes);
    const lines = [];
    let n = 1;
    sentences.forEach((sentence) => {
      const parsed = parseLabel(sentence);
      const commaItems = parsed.isLabeled ? splitByComma(parsed.value) : [];
      if (parsed.isLabeled && commaItems.length >= 3) {
        lines.push(`${parsed.label}:`);
        commaItems.forEach((item) => lines.push(`  ${n++}. ${item}`));
      } else {
        lines.push(`${n++}. ${sentence}`);
      }
    });
    return lines.join('\n');
  }, []);

  // ========== GET STATUS TEXT ==========
  const getStatusText = useCallback((status) => {
    switch (status) {
      case 'active': return 'Active';
      case 'chronic': return 'Chronic';
      case 'resolved': return 'Resolved';
      case 'ruled_out': return 'Ruled Out';
      default: return 'Active';
    }
  }, []);

  // ========== COPY DIAGNOSIS TEXT (canonical — mirrors JSX rows + PDF) ==========
  // Record title 'Diagnoses N' + '='; every field = sub-label + '-' + numbered
  // value row(s). NEVER side-by-side "Label: value" (one-pass items 1-3).
  const getDiagnosisText = useCallback((dx, displayNum) => {
    const lines = [];
    lines.push(`Diagnoses ${displayNum}`);
    lines.push(COPY_LINE_EQ);

    const pushField = (label, values) => {
      if (!values || values.length === 0) return;
      lines.push(label);
      lines.push(COPY_LINE_DASH);
      values.forEach((v, i) => lines.push(`${i + 1}. ${v}`));
    };

    pushField('Status', [getStatusText(dx.status)]);
    if (hasValue(dx.diagnosis)) pushField('Diagnosis', splitByComma(String(dx.diagnosis)));
    if (hasValue(dx.icdCode)) pushField('ICD Code', [String(dx.icdCode)]);
    if (hasValue(dx.type)) pushField('Type', [String(dx.type)]);
    if (hasValue(dx.severity)) pushField('Severity', splitBySentence(String(dx.severity)));
    if (hasValue(dx.stage)) pushField('Stage', splitBySentence(String(dx.stage)));
    if (hasValue(dx.laterality)) pushField('Laterality', [String(dx.laterality)]);
    if (hasIdentifiedDate(dx.dateIdentified)) pushField('Date Identified', [formatDate(dx.dateIdentified)]);
    if (hasValue(dx.provider)) pushField('Provider', [String(dx.provider)]);
    if (hasValue(dx.facility)) pushField('Facility', [String(dx.facility)]);
    if (hasValue(dx.prognosis)) {
      const prog = Array.isArray(dx.prognosis) ? dx.prognosis.join(', ') : String(dx.prognosis);
      pushField('Prognosis', splitBySentence(prog));
    }
    if (hasValue(dx.clinicalSignificance)) {
      const cs = Array.isArray(dx.clinicalSignificance) ? dx.clinicalSignificance.join(', ') : String(dx.clinicalSignificance);
      pushField('Clinical Significance', [cs]);
    }
    if (hasValue(dx.targetIOp)) pushField('Target IOP', [String(dx.targetIOp)]);
    if (hasValue(dx.notes)) {
      lines.push('Notes');
      lines.push(COPY_LINE_DASH);
      formatNotesForCopy(dx.notes).split('\n').forEach((l) => lines.push(l));
    }
    // Risk Factors last — mirrors the on-screen (JSX) field order.
    if (hasValue(dx.riskFactors)) {
      const rfItems = Array.isArray(dx.riskFactors)
        ? dx.riskFactors.flatMap(it => splitByComma(String(it)))
        : splitByComma(String(dx.riskFactors));
      pushField('Risk Factors', rfItems);
    }
    return lines.join('\n');
  }, [formatDate, getStatusText, hasValue, hasIdentifiedDate, formatNotesForCopy]);

  // ========== LEVEL 1: FILTERING ==========
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) {
      return unwrappedData.map((dx, idx) => ({ ...dx, _documentTitle: `Diagnoses ${idx + 1}`, _showAllSections: true }));
    }

    const phrase = searchTerm.toLowerCase().trim();

    return unwrappedData.filter((dx, idx) => {
      dx._documentTitle = `Diagnoses ${idx + 1}`;
      // Build searchable text
      const searchableText = [
        // Document level
        'diagnoses', 'diagnosis',
        `diagnosis ${idx + 1}`,

        // Section titles (status groups)
        'Active Diagnoses', 'active diagnoses', 'ACTIVE DIAGNOSES',
        'Chronic Conditions', 'chronic conditions', 'CHRONIC CONDITIONS',
        'Resolved Diagnoses', 'resolved diagnoses', 'RESOLVED DIAGNOSES',
        'Ruled Out', 'ruled out', 'RULED OUT',

        // Field labels with case variations
        'ICD Code', 'icd code', 'ICD CODE',
        'Type', 'type', 'TYPE',
        'Status', 'status', 'STATUS',
        'Severity', 'severity', 'SEVERITY',
        'Stage', 'stage', 'STAGE',
        'Laterality', 'laterality', 'LATERALITY',
        'Date Identified', 'date identified', 'DATE IDENTIFIED', 'Onset', 'onset', 'ONSET',
        'Date', 'date', 'DATE',
        'Provider', 'provider', 'PROVIDER',
        'Facility', 'facility', 'FACILITY',
        'Prognosis', 'prognosis', 'PROGNOSIS',
        'Clinical Significance', 'clinical significance', 'CLINICAL SIGNIFICANCE',
        'Risk Factors', 'risk factors', 'RISK FACTORS',
        'Target IOP', 'target iop', 'TARGET IOP',
        'Notes', 'notes', 'NOTES',

        // Field values
        dx.diagnosis,
        dx.icdCode,
        dx.type,
        dx.status,
        getStatusText(dx.status),
        dx.severity,
        dx.stage,
        dx.laterality,
        dx.provider,
        dx.facility,
        dx.notes,
        dx.targetIOp,
        hasIdentifiedDate(dx.dateIdentified) ? formatDate(dx.dateIdentified) : '',
        Array.isArray(dx.prognosis) ? dx.prognosis.join(' ') : dx.prognosis,
        Array.isArray(dx.clinicalSignificance) ? dx.clinicalSignificance.join(' ') : dx.clinicalSignificance,
        Array.isArray(dx.riskFactors) ? dx.riskFactors.join(' ') : dx.riskFactors,
      ].filter(Boolean).join(' ').toLowerCase();

      // Check if document title or diagnosis name matches
      const docTitle = `diagnosis ${idx + 1}`;
      const diagnosisMatch = dx.diagnosis && dx.diagnosis.toLowerCase().includes(phrase);

      if (docTitle.includes(phrase) || phrase.includes('diagnos') || diagnosisMatch) {
        dx._showAllSections = true;
        return true;
      }

      // For other searches, check if searchable text includes phrase
      dx._showAllSections = false;
      return searchableText.includes(phrase);
    });
  }, [unwrappedData, searchTerm, getStatusText, hasIdentifiedDate, formatDate]);

  // ========== GROUP BY STATUS ==========
  const activeDiagnoses = useMemo(() =>
    filteredData.filter(dx => dx.status === 'active' || !dx.status), [filteredData]);
  const chronicDiagnoses = useMemo(() =>
    filteredData.filter(dx => dx.status === 'chronic'), [filteredData]);
  const resolvedDiagnoses = useMemo(() =>
    filteredData.filter(dx => dx.status === 'resolved'), [filteredData]);
  const ruledOutDiagnoses = useMemo(() =>
    filteredData.filter(dx => dx.status === 'ruled_out'), [filteredData]);

  // ========== COPY ALL TEXT (canonical — status sections, global numbering) ==========
  const getAllText = useCallback(() => {
    const lines = ['DIAGNOSES', COPY_LINE_EQ, ''];
    const src = pdfData;
    const groups = [
      ['Active Diagnoses', src.filter(dx => dx.status === 'active' || !dx.status)],
      ['Chronic Conditions', src.filter(dx => dx.status === 'chronic')],
      ['Resolved Diagnoses', src.filter(dx => dx.status === 'resolved')],
      ['Ruled Out', src.filter(dx => dx.status === 'ruled_out')],
    ];

    let displayNum = 1; // global record number, sequential across status groups
    groups.forEach(([title, diagnoses]) => {
      if (diagnoses.length === 0) return;
      lines.push(title.toUpperCase());
      lines.push(COPY_LINE_EQ);
      lines.push('');
      diagnoses.forEach((dx) => {
        lines.push(getDiagnosisText(dx, displayNum));
        lines.push('');
        displayNum += 1;
      });
    });

    return lines.join('\n');
  }, [pdfData, getDiagnosisText]);

  // ========== RENDER DIAGNOSIS CARD ==========
  const renderDiagnosis = (dx, idx, globalIdx) => {
    const recordWithFlag = { ...dx };
    const canEdit = !!dx._id;
    const diagStatus = statusOverrides[globalIdx] || 'active';
    const canApprove = canEdit && diagStatus !== 'approved' &&
      Object.keys(editedFields).some(k => k.endsWith(`-${globalIdx}`));

    // Level 3: sectionTitleMatches for each field section
    const detailsMatches = (() => {
      if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
      return shouldShowRow(recordWithFlag,
        'Diagnosis', 'diagnosis', 'DIAGNOSIS',
        'ICD Code', 'icd code', 'ICD CODE',
        'Type', 'type', 'TYPE',
        'Severity', 'severity', 'SEVERITY',
        'Stage', 'stage', 'STAGE',
        'Laterality', 'laterality', 'LATERALITY',
        'Date Identified', 'date identified', 'DATE IDENTIFIED', 'Onset', 'onset', 'ONSET',
        'Date', 'date', 'DATE',
        'Provider', 'provider', 'PROVIDER',
        'Facility', 'facility', 'FACILITY',
        'Prognosis', 'prognosis', 'PROGNOSIS',
        'Clinical Significance', 'clinical significance', 'CLINICAL SIGNIFICANCE',
        'Risk Factors', 'risk factors', 'RISK FACTORS',
        'Target IOP', 'target iop', 'TARGET IOP',
        'Notes', 'notes', 'NOTES',
        dx.icdCode, dx.type, dx.severity, dx.stage, dx.laterality,
        hasIdentifiedDate(dx.dateIdentified) ? formatDate(dx.dateIdentified) : '',
        dx.provider, dx.facility, dx.notes, dx.targetIOp,
        Array.isArray(dx.prognosis) ? dx.prognosis.join(' ') : dx.prognosis,
        Array.isArray(dx.clinicalSignificance) ? dx.clinicalSignificance.join(' ') : dx.clinicalSignificance,
        Array.isArray(dx.riskFactors) ? dx.riskFactors.join(' ') : dx.riskFactors
      );
    })();

    return (
      <div key={dx._id || globalIdx} className="diagnosis-record">
        {/* Record Header */}
        <div className="record-header">
          <div className="header-top-row">
            <span className={`status-badge ${dx.status || 'active'}`}>
              {highlightText(getStatusText(dx.status))}
            </span>
            {hasValue(getBadgeDate(dx)) && (
              <span className="date-badge">{highlightText(formatDate(getBadgeDate(dx)))}</span>
            )}
            {/* Copy Diagnosis Button */}
            <button
              className={`copy-diagnosis-btn ${copiedId === `dx-${globalIdx}` ? 'copied' : ''}`}
              onClick={() => copyToClipboard(getDiagnosisText(dx, globalIdx + 1), `dx-${globalIdx}`)}
            >
              {copiedId === `dx-${globalIdx}` ? 'Copied!' : 'Copy Diagnosis'}
            </button>
          </div>
          <h3 className="record-title">{highlightText(`Diagnoses ${globalIdx + 1}`)}</h3>
        </div>

        {/* Diagnosis Details Section */}
        {detailsMatches && (
          <div className="section">
            <div className="mini-cards-container">
              <div className="section-header">
                <h4 className="section-title">{highlightText('Diagnosis Details')}</h4>
                <div className="header-right-actions">
                  <button
                    className={`copy-btn ${copiedSectionId === `details-${globalIdx}` ? 'copied' : ''}`}
                    onClick={() => copySectionToClipboard(getDiagnosisText(dx, globalIdx + 1), `details-${globalIdx}`)}
                  >
                    {copiedSectionId === `details-${globalIdx}` ? 'Copied!' : 'Copy Section'}
                  </button>
                  {canApprove && (
                    <button
                      className={`approve-btn pending ${approving ? 'approving' : ''}`}
                      onClick={() => handleApprove(dx, globalIdx)}
                      disabled={approving}
                    >
                      {approving ? 'Approving...' : 'Pending Approve'}
                    </button>
                  )}
                </div>
              </div>

              {/* Editable Fields */}
              {shouldShowRow(recordWithFlag, 'Diagnosis', 'diagnosis', dx.diagnosis) &&
                renderSplitField(dx, 'diagnosis', 'Diagnosis', globalIdx, 'details', splitByComma)}
              {shouldShowRow(recordWithFlag, 'ICD Code', 'icd code', dx.icdCode) &&
                renderEditableField(dx, 'icdCode', 'ICD Code', globalIdx, 'details')}
              {shouldShowRow(recordWithFlag, 'Type', 'type', dx.type) &&
                renderEnumField(dx, 'type', 'Type', globalIdx, 'details', ['primary', 'secondary'])}
              {shouldShowRow(recordWithFlag, 'Severity', 'severity', dx.severity) &&
                renderSplitField(dx, 'severity', 'Severity', globalIdx, 'details', splitBySentence)}
              {shouldShowRow(recordWithFlag, 'Stage', 'stage', dx.stage) &&
                renderSplitField(dx, 'stage', 'Stage', globalIdx, 'details', splitBySentence)}
              {shouldShowRow(recordWithFlag, 'Laterality', 'laterality', dx.laterality) &&
                renderEditableField(dx, 'laterality', 'Laterality', globalIdx, 'details')}

              {/* Date Identified (onset) — editable BlueDatePicker; hidden when null/empty or 1970 sentinel */}
              {hasIdentifiedDate(dx.dateIdentified) && shouldShowRow(recordWithFlag,
                'Date Identified', 'date identified', formatDate(dx.dateIdentified)) &&
                renderDateField(dx, 'dateIdentified', 'Date Identified', globalIdx, 'details')}

              {shouldShowRow(recordWithFlag, 'Provider', 'provider', dx.provider) &&
                renderEditableField(dx, 'provider', 'Provider', globalIdx, 'details')}
              {shouldShowRow(recordWithFlag, 'Facility', 'facility', dx.facility) &&
                renderEditableField(dx, 'facility', 'Facility', globalIdx, 'details')}
              {shouldShowRow(recordWithFlag, 'Prognosis', 'prognosis',
                Array.isArray(dx.prognosis) ? dx.prognosis.join(' ') : dx.prognosis) &&
                renderSplitField(dx, 'prognosis', 'Prognosis', globalIdx, 'details', splitBySentence)}
              {shouldShowRow(recordWithFlag, 'Clinical Significance', 'clinical significance',
                Array.isArray(dx.clinicalSignificance) ? dx.clinicalSignificance.join(' ') : dx.clinicalSignificance) &&
                renderEditableField(dx, 'clinicalSignificance', 'Clinical Significance', globalIdx, 'details')}
              {shouldShowRow(recordWithFlag, 'Target IOP', 'target iop', dx.targetIOp) &&
                renderEditableField(dx, 'targetIOp', 'Target IOP', globalIdx, 'details')}
              {shouldShowRow(recordWithFlag, 'Notes', 'notes', dx.notes) &&
                renderNotesField(dx, globalIdx, 'details')}

              {/* Risk Factors — read-only, split by paren-aware comma into one row each */}
              {hasValue(dx.riskFactors) && shouldShowRow(recordWithFlag, 'Risk Factors', 'risk factors',
                Array.isArray(dx.riskFactors) ? dx.riskFactors.join(' ') : dx.riskFactors) && (
                <div className="rec-mini-card">
                  <div className="nested-subtitle">{highlightText('Risk Factors')}</div>
                  {(Array.isArray(dx.riskFactors)
                    ? dx.riskFactors.flatMap(it => splitByComma(String(it)))
                    : splitByComma(String(dx.riskFactors))
                  ).map((item, i) => (
                    <div className="numbered-row" key={i}>
                      <div className="row-content">
                        <span className="content-value">{highlightText(item)}</span>
                      </div>
                      <button
                        className={`copy-btn ${copiedId === `rf-${globalIdx}-${i}` ? 'copied' : ''}`}
                        onClick={() => copyToClipboard(item, `rf-${globalIdx}-${i}`)}
                      >
                        {copiedId === `rf-${globalIdx}-${i}` ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ========== RENDER STATUS GROUP ==========
  const renderStatusGroup = (title, diagnoses, statusClass) => {
    if (diagnoses.length === 0) return null;

    const groupId = statusClass;
    // Global 1-based start number for this group's first record (mirrors the
    // globalIdx math in the record map below, so Copy Section numbers == JSX).
    const startNum = statusClass === 'chronic' ? activeDiagnoses.length
      : statusClass === 'resolved' ? activeDiagnoses.length + chronicDiagnoses.length
      : statusClass === 'ruled-out' ? activeDiagnoses.length + chronicDiagnoses.length + resolvedDiagnoses.length
      : 0;
    const groupText = diagnoses.map((dx, i) => getDiagnosisText(dx, startNum + i + 1)).join('\n\n');

    return (
      <div className={`status-group ${statusClass}`}>
        <div className="group-header">
          <div className="group-header-content">
            <h2 className="group-title">{highlightText(title)}</h2>
          </div>
          <button
            className={`copy-btn ${copiedSectionId === groupId ? 'copied' : ''}`}
            onClick={() => copySectionToClipboard(groupText, groupId)}
          >
            {copiedSectionId === groupId ? 'Copied!' : 'Copy Section'}
          </button>
        </div>
        <div className="diagnoses-container">
          {diagnoses.map((dx, idx) => {
            // Calculate global index for unique IDs
            let globalIdx = idx;
            if (statusClass === 'chronic') globalIdx += activeDiagnoses.length;
            if (statusClass === 'resolved') globalIdx += activeDiagnoses.length + chronicDiagnoses.length;
            if (statusClass === 'ruled-out') globalIdx += activeDiagnoses.length + chronicDiagnoses.length + resolvedDiagnoses.length;
            return renderDiagnosis(dx, idx, globalIdx);
          })}
        </div>
      </div>
    );
  };

  // ========== EMPTY STATE ==========
  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <div className="diagnoses-document">
        <div className="document-header">
          <h1 className="document-title">Diagnoses</h1>
        </div>
        <div className="no-data">No diagnoses available.</div>
      </div>
    );
  }

  return (
    <div className="diagnoses-document">
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">Diagnoses</h1>

        {/* Header Actions */}
        <div className="header-actions">
          <button
            className={`copy-btn ${copiedId === 'all-documents' ? 'copied' : ''}`}
            onClick={() => copyToClipboard(getAllText(), 'all-documents')}
          >
            {copiedId === 'all-documents' ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<DiagnosesDocumentPDFTemplate document={pdfData} />}
            fileName="Diagnoses.pdf"
            className="pdf-btn"
          >
            {({ loading }) => (loading ? 'Preparing...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>

        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          placeholder="Search diagnoses..."
        />
        {searchTerm && (
          <div className="search-results-count">
            Showing {filteredData.length} of {unwrappedData.length} diagnoses
          </div>
        )}
      </div>

      {/* Records Container */}
      <div className="records-container">
        {renderStatusGroup('Active Diagnoses', activeDiagnoses, 'active')}
        {renderStatusGroup('Chronic Conditions', chronicDiagnoses, 'chronic')}
        {renderStatusGroup('Resolved Diagnoses', resolvedDiagnoses, 'resolved')}
        {renderStatusGroup('Ruled Out', ruledOutDiagnoses, 'ruled-out')}
      </div>

      {/* No Results */}
      {filteredData.length === 0 && searchTerm && (
        <div className="no-data">No diagnoses found matching "{searchTerm}"</div>
      )}
    </div>
  );
};

export default DiagnosesDocument;
