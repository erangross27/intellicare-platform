/**
 * AddictionMedicineConsultationsDocument.jsx
 * February 2026 — Inline Editing Enabled
 *
 * 12 sections: Provider, Substance History, Withdrawal Assessment, MAT, UDS,
 *   Relapse Prevention (3 subsections), Recovery Programs, Harm Reduction,
 *   Psychiatric Comorbidities, Social Determinants, Treatment Plan, Prognosis
 * 4-level search, mini-card blue theme, per-section approve, inline editing
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import AddictionMedicineConsultationsDocumentPDFTemplate from '../pdf-templates/AddictionMedicineConsultationsDocumentPDFTemplate';
import './AddictionMedicineConsultationsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'addiction_medicine_consultationsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

// Split a compound value into individual facts on top-level ';' and ',' (parenthesis-aware).
const splitSemiComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '[') { depth++; cur += ch; }
    else if (ch === ')' || ch === ']') { depth = Math.max(0, depth - 1); cur += ch; }
    else if ((ch === ';' || ch === ',') && depth === 0) { const t = cur.trim(); if (t) result.push(t); cur = ''; }
    else cur += ch;
  }
  const t = cur.trim(); if (t) result.push(t);
  return result.length ? result : (text.trim() ? [text.trim()] : []);
};

// Split on top-level commas only (parenthesis-aware) — for comma-separated value lists (symptoms).
const splitByCommaParen = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '[') { depth++; cur += ch; }
    else if (ch === ')' || ch === ']') { depth = Math.max(0, depth - 1); cur += ch; }
    else if (ch === ',' && depth === 0) { const t = cur.trim(); if (t) result.push(t); cur = ''; }
    else cur += ch;
  }
  const t = cur.trim(); if (t) result.push(t);
  return result.length ? result : (text.trim() ? [text.trim()] : []);
};

// Split on top-level semicolons only (parenthesis-aware) — for ';'-separated compound fields
// (e.g. an induction protocol with two doses). Commas inside a part are preserved.
const splitBySemi = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '[') { depth++; cur += ch; }
    else if (ch === ')' || ch === ']') { depth = Math.max(0, depth - 1); cur += ch; }
    else if (ch === ';' && depth === 0) { const t = cur.trim(); if (t) result.push(t); cur = ''; }
    else cur += ch;
  }
  const t = cur.trim(); if (t) result.push(t);
  return result.length ? result : (text.trim() ? [text.trim()] : []);
};

// Parse "Label: value, Label: value" into [label, value] pairs. Comma-split is parenthesis-aware, and
// a segment without its own colon (e.g. the "2026" in "February 10, 2026") merges back into the
// previous value so dates are not broken apart.
const parseLabelValuePairs = (text) => {
  const pairs = [];
  splitByCommaParen(text).forEach(seg => {
    const ci = seg.indexOf(':');
    if (ci > -1) pairs.push([seg.substring(0, ci).trim(), seg.substring(ci + 1).trim()]);
    else if (pairs.length) pairs[pairs.length - 1][1] += `, ${seg.trim()}`;
    else pairs.push(['', seg.trim()]);
  });
  return pairs;
};

const AddictionMedicineConsultationsDocument = ({ document, data }) => {
  const templateData = document || data;
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);

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

  // ============== DATA UNWRAPPING ==============
  const unwrappedData = useMemo(() => {
    if (!templateData) return [];
    const raw = templateData?.documentData || templateData?.data || templateData;
    const consultations = raw?.addiction_medicine_consultations || (Array.isArray(raw) ? raw : [raw]);
    return consultations.filter(c => c && typeof c === 'object');
  }, [templateData]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nStatus = {};
    unwrappedData.forEach((record, idx) => {
      const recDrafts = record && record._id ? store[record._id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        // Derive the section id from the field's base field via SECTION_FIELDS reverse lookup.
        const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
        const sectionId = Object.keys(SECTION_FIELDS).find(sid => SECTION_FIELDS[sid].includes(baseField));
        nLocal[editKey] = value;
        nPending[editKey] = true;
        if (sectionId) nFields[`${sectionId}-${idx}`] = true;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unwrappedData]);

  // ============== UTILITY FUNCTIONS ==============
  const formatDate = useCallback((dateVal) => {
    if (!dateVal) return 'N/A';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return String(dateVal);
    }
  }, []);

  const formatFieldLabel = useCallback((key) => {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }, []);

  // ============== COPY FUNCTIONS ==============
  const copyToClipboard = useCallback((text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  // ============== COWS SCORE HELPERS ==============
  const getCOWSColor = useCallback((score, max = 48) => {
    const percentage = (score / max) * 100;
    if (percentage <= 10) return '#22c55e';
    if (percentage <= 25) return '#3b82f6';
    if (percentage <= 50) return '#f59e0b';
    return '#ef4444';
  }, []);

  const getCOWSInterpretation = useCallback((score) => {
    if (score <= 4) return 'Mild';
    if (score <= 12) return 'Moderate';
    if (score <= 24) return 'Moderately Severe';
    return 'Severe';
  }, []);

  const getSymptomColor = useCallback((score, max = 4) => {
    const percentage = (score / max) * 100;
    if (percentage <= 25) return '#22c55e';
    if (percentage <= 50) return '#3b82f6';
    if (percentage <= 75) return '#f59e0b';
    return '#ef4444';
  }, []);

  // ============== HIGHLIGHT FUNCTION ==============
  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || !text) return text;
    const phrase = searchTerm.trim();
    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedPhrase})`, 'gi');
    const parts = String(text).split(regex);
    const phraseLower = phrase.toLowerCase();
    return parts.map((part, i) =>
      part.toLowerCase() === phraseLower ? <mark key={i}>{part}</mark> : part
    );
  }, [searchTerm]);

  // ============== EDITING HELPERS ==============

  // Resolve dot-notation field paths from record
  const resolveField = useCallback((record, fieldPath) => {
    const parts = fieldPath.split('.');
    let val = record;
    for (const part of parts) {
      if (val == null) return undefined;
      val = val[part];
    }
    return val;
  }, []);

  const getFieldValue = useCallback((record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    const val = resolveField(record, fieldName);
    if (Array.isArray(val)) return val.join(', ');
    return val;
  }, [localEdits, resolveField]);

  const getArrayFieldValue = useCallback((record, fieldName, arrayIndex, idx) => {
    const editKey = `${fieldName}.${arrayIndex}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    const arr = resolveField(record, fieldName);
    if (Array.isArray(arr) && arrayIndex < arr.length) return arr[arrayIndex];
    return undefined;
  }, [localEdits, resolveField]);

  const persistToLocalStorage = useCallback((recordId, fieldName, newValue) => {
    try {
      const key = 'artifactGridData';
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const gridData = JSON.parse(raw);
      const walk = (node) => {
        if (!node) return false;
        if (Array.isArray(node)) return node.some(walk);
        if (typeof node === 'object') {
          if (node._id === recordId) {
            // Support dot-notation for nested fields
            const parts = fieldName.split('.');
            if (parts.length === 1) {
              node[fieldName] = newValue;
            } else {
              let target = node;
              for (let i = 0; i < parts.length - 1; i++) {
                if (target[parts[i]] == null) target[parts[i]] = {};
                target = target[parts[i]];
              }
              target[parts[parts.length - 1]] = newValue;
            }
            return true;
          }
          return Object.values(node).some(walk);
        }
        return false;
      };
      if (walk(gridData)) localStorage.setItem(key, JSON.stringify(gridData));
    } catch (e) { /* ignore localStorage errors */ }
  }, []);

  // ============== EDITING HANDLERS ==============
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
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, arrayIndex, valueOverride, sentenceIdx) => {
    if (!record._id) return;
    const saveValue = (valueOverride !== undefined ? valueOverride : editValue.trim());
    const fieldPart = (typeof arrayIndex === 'number') ? `${fieldName}.${arrayIndex}` : fieldName;
    const editKey = `${fieldPart}-${idx}`;
    const sKey = `${fieldName}-${idx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;

    setLocalEdits(prev => ({ ...prev, [editKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));
    // Re-edit after approval → drop this section's 'approved' flag so the button goes back to yellow.
    setApprovedSections(prev => {
      if (!prev[sectionId]) return prev;
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });

    const store = readDrafts();
    if (!store[record._id]) store[record._id] = {};
    store[record._id][fieldPart] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this record to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApprove = useCallback(async (record, idx, sectionId) => {
    if (!record._id) return;
    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements).
      // editKey = "<fieldPart>-<idx>"; fieldPart = "<field>" or "<field>.<arrayIndex>" (field may be dotted).
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayEdit = lastDot !== -1 && tail !== '' && /^\d+$/.test(tail);
        const payload = isArrayEdit
          ? { field: fieldPart.slice(0, lastDot), value: localEdits[editKey], arrayIndex: parseInt(tail, 10) }
          : { field: fieldPart, value: localEdits[editKey] };
        const resp = await secureApiClient.put(`/api/edit/addiction_medicine_consultations/${record._id}/edit`, payload);
        if (!resp || !resp.success) throw new Error((resp && resp.error) || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/addiction_medicine_consultations/${record._id}/approve`);

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[record._id]) { delete store[record._id]; writeDrafts(store); }

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
      console.error('[AddictionMedicine] Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // ============== SECTION_FIELDS + sectionHasEdits ==============
  const SECTION_FIELDS = {
    'provider': ['consultingProvider'],
    'substance': ['substanceUseHistory'],
    'withdrawal': ['withdrawalAssessment'],
    'mat': ['medicationAssistedTreatment'],
    'uds': ['urineDrugScreening'],
    'relapse': ['relapsePrevention'],
    'recovery': ['recoveryPrograms'],
    'harm': ['harmReductionCounseling'],
    'psych': ['psychiatricComorbidities'],
    'social': ['socialDeterminants'],
    'treatment': ['treatmentPlan'],
    'prognosis': ['prognosis'],
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

  // ============== EDIT INDICATOR ==============
  const editIndicator = (
    <span className="edit-indicator" title="Click to edit">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M8.5 1.5L10.5 3.5M1 11L1.5 8.5L9.5 0.5L11.5 2.5L3.5 10.5L1 11Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  );

  // ============== RENDER EDITABLE FIELD ==============
  const renderEditableField = (record, fieldName, label, idx, sectionId) => {
    const displayValue = getFieldValue(record, fieldName, idx);
    if (!displayValue) return null;
    const canEdit = !!record._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const isFieldEdited = sectionWasEdited && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';

    if (!shouldShowRow(record, label, displayValue) && !record._showAllSections) return null;

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
        <>
          <div className={`numbered-row${isFieldEdited ? ' modified' : ''}`}>
            <div className={`row-content${canEdit ? ' editable' : ''}`}
              onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue)}
              title={canEdit ? 'Click to edit' : undefined}
            >
              <span className="content-value">{highlightText(displayValue)}</span>
              {canEdit && !isFieldEdited && editIndicator}
            </div>
            <button
              className={`copy-btn ${copiedId === `${fieldName}-${idx}` ? 'copied' : ''}`}
              onClick={() => copyToClipboard(displayValue, `${fieldName}-${idx}`)}
            >
              {copiedId === `${fieldName}-${idx}` ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {isFieldEdited && <div className="modified-badge">edited — click Pending Approve to save</div>}
        </>
      </div>
    );
  };

  // ============== RENDER EDITABLE ARRAY ITEM ==============
  const renderEditableArrayItem = (record, fieldName, item, idx, itemIdx, sectionId, label, titleMatches) => {
    if (!titleMatches && !shouldShowRow(record, item)) return null;
    const displayValue = getArrayFieldValue(record, fieldName, itemIdx, idx);
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
          <div className={`row-content${canEdit ? ' editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(`${fieldName}.${itemIdx}`, idx, displayValue)}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isItemEdited && editIndicator}
          </div>
          <button
            className={`copy-btn ${copiedId === `${fieldName}-${idx}-${itemIdx}` ? 'copied' : ''}`}
            onClick={() => copyToClipboard(displayValue, `${fieldName}-${idx}-${itemIdx}`)}
          >
            {copiedId === `${fieldName}-${idx}-${itemIdx}` ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isItemEdited && <div className="modified-badge">edited — click Pending Approve to save</div>}
      </React.Fragment>
    );
  };

  // ============== SECTION HEADER WITH APPROVE ==============
  const renderSectionHeader = (title, copyId, copyFn, idx, sectionId) => (
    <div className="section-header">
      <h3 className="section-title">{highlightText(title)}</h3>
      <div className="header-right-actions">
        <button
          className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
          onClick={copyFn}
        >
          {copiedId === copyId ? 'Copied!' : 'Copy Section'}
        </button>
        {(sectionHasEdits(sectionId) || approvedSections[sectionId]) && (
          <button
            className={`approve-btn${approvedSections[sectionId] ? ' approved' : ' pending'}`}
            onClick={() => handleApprove(unwrappedData[idx] || filteredRecords[idx], idx, sectionId)}
            disabled={approving}
          >
            {approving ? 'Approving...' : approvedSections[sectionId] ? 'Approved' : 'Pending Approve'}
          </button>
        )}
      </div>
    </div>
  );

  // ============== 4-LEVEL SEARCH ==============
  const shouldShowRow = useCallback((...valuesToCheck) => {
    if (!searchTerm.trim()) return true;
    const phrase = searchTerm.toLowerCase().trim();
    for (const val of valuesToCheck) {
      if (val && String(val).toLowerCase().includes(phrase)) {
        return true;
      }
    }
    return false;
  }, [searchTerm]);

  const sectionTitleMatches = useCallback((sectionTitle) => {
    if (!searchTerm.trim()) return true;
    const phrase = searchTerm.toLowerCase().trim();
    return sectionTitle.toLowerCase().includes(phrase);
  }, [searchTerm]);

  const shouldShowSection = useCallback((sectionTitle, ...rowValues) => {
    if (!searchTerm.trim()) return true;
    if (sectionTitleMatches(sectionTitle)) return true;
    const phrase = searchTerm.toLowerCase().trim();
    for (const val of rowValues) {
      if (val && String(val).toLowerCase().includes(phrase)) {
        return true;
      }
    }
    return false;
  }, [searchTerm, sectionTitleMatches]);

  // Level 1: Document-level filtering
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) {
      return unwrappedData.map(r => ({ ...r, _showAllSections: false }));
    }
    const phrase = searchTerm.toLowerCase().trim();

    return unwrappedData.map((record, idx) => {
      const searchableText = [
        `Addiction Medicine Consultation ${idx + 1}`,
        'addiction medicine consultation',
        'Consulting Provider', 'consulting provider',
        'Substance Use History', 'substance use history',
        'Withdrawal Assessment', 'withdrawal assessment',
        'Medication-Assisted Treatment', 'medication-assisted treatment', 'MAT',
        'Urine Drug Screening', 'urine drug screening', 'UDS',
        'Relapse Prevention', 'relapse prevention',
        'High-Risk Situations', 'high-risk situations',
        'Coping Strategies', 'coping strategies',
        'Emergency Plan', 'emergency plan',
        'Recovery Programs', 'recovery programs',
        'Harm Reduction Counseling', 'harm reduction counseling',
        'Psychiatric Comorbidities', 'psychiatric comorbidities',
        'Social Determinants', 'social determinants',
        'Treatment Plan', 'treatment plan',
        'Prognosis', 'prognosis',
        'COWS Score', 'COWS', 'cows score',
        'Individual Symptoms', 'individual symptoms',
        ...(record.withdrawalAssessment?.symptoms ? Object.entries(record.withdrawalAssessment.symptoms).flatMap(([key, value]) => [
          formatFieldLabel(key), key, String(value), `${value}/4`
        ]) : []),
        record.withdrawalAssessment?.score !== undefined ? `${record.withdrawalAssessment.score}/48` : '',
        record.consultingProvider,
        ...(record.substanceUseHistory || []),
        record.withdrawalAssessment?.scale,
        record.withdrawalAssessment?.interpretation,
        record.medicationAssistedTreatment?.medication,
        record.medicationAssistedTreatment?.priorMAT,
        ...(record.urineDrugScreening || []),
        ...(record.relapsePrevention?.highRiskSituations || []),
        ...(record.relapsePrevention?.copingStrategies || []),
        ...(record.relapsePrevention?.emergencyPlan || []),
        ...(record.relapsePrevention?.triggers || []),
        ...(record.relapsePrevention?.copingSkills || []),
        ...(record.relapsePrevention?.supportNetwork || []),
        ...(record.relapsePrevention?.environmentalModifications || []),
        ...(record.recoveryPrograms || []),
        ...(record.harmReductionCounseling?.safeUseCounseling || []),
        record.harmReductionCounseling?.naloxoneTraining,
        record.harmReductionCounseling?.fentanylEducation,
        record.harmReductionCounseling?.saferUseEducation,
        record.harmReductionCounseling?.needleExchange,
        ...(record.psychiatricComorbidities || []),
        record.socialDeterminants?.housing,
        record.socialDeterminants?.employment,
        record.socialDeterminants?.familySupport,
        record.socialDeterminants?.legalIssues,
        record.socialDeterminants?.income,
        record.socialDeterminants?.legalHistory,
        record.treatmentPlan?.phase1,
        record.treatmentPlan?.phase2,
        record.treatmentPlan?.phase3,
        record.treatmentPlan?.psychiatricTreatment,
        record.treatmentPlan?.counseling,
        record.treatmentPlan?.levelOfCare,
        record.treatmentPlan?.backupPlan,
        ...(record.treatmentPlan?.components || []),
        record.prognosis?.withMAT,
        record.prognosis?.withoutMAT,
        record.prognosis?.overall,
        ...(record.prognosis?.favorableFactors || []),
        ...(record.prognosis?.unfavorableFactors || []),
        ...(record.prognosis?.criticalInflectionPoints || []),
      ].filter(Boolean).join(' ').toLowerCase();

      const matches = searchableText.includes(phrase);
      const documentTitle = `addiction medicine consultation ${idx + 1}`;
      const documentTitleMatches = documentTitle.includes(phrase) ||
        phrase.includes('addiction medicine consultation');

      return matches ? { ...record, _showAllSections: documentTitleMatches } : null;
    }).filter(Boolean);
  }, [unwrappedData, searchTerm, formatFieldLabel]);

  // ============== pdfData MEMO ==============
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return filteredRecords;
    return filteredRecords.map((rec, idx) => {
      const merged = { ...rec };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldPart = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx === idx) {
          // Handle nested dot paths (e.g., socialDeterminants.housing, substanceUseHistory.0)
          const dotParts = fieldPart.split('.');
          if (dotParts.length === 1) {
            merged[fieldPart] = editVal;
          } else if (dotParts.length === 2) {
            const [parent, child] = dotParts;
            const childNum = parseInt(child, 10);
            if (!isNaN(childNum) && Array.isArray(merged[parent])) {
              // Array index: substanceUseHistory.0
              merged[parent] = [...merged[parent]];
              merged[parent][childNum] = editVal;
            } else {
              // Nested object: socialDeterminants.housing
              if (merged[parent] && typeof merged[parent] === 'object') {
                merged[parent] = { ...merged[parent], [child]: editVal };
              }
            }
          } else if (dotParts.length === 3) {
            const [parent, mid, leaf] = dotParts;
            const leafIdx = parseInt(leaf, 10);
            if (merged[parent] && typeof merged[parent] === 'object' && Array.isArray(merged[parent][mid]) && !isNaN(leafIdx)) {
              // Nested array element: relapsePrevention.highRiskSituations.0
              merged[parent] = { ...merged[parent] };
              merged[parent][mid] = [...merged[parent][mid]];
              merged[parent][mid][leafIdx] = editVal;
            } else if (merged[parent] && typeof merged[parent] === 'object' && merged[parent][mid] && typeof merged[parent][mid] === 'object') {
              // Nested object field: withdrawalAssessment.alcohol.symptoms / .score / .severity
              merged[parent] = { ...merged[parent] };
              merged[parent][mid] = { ...merged[parent][mid], [leaf]: editVal };
            }
          }
        }
      }
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  // ============== COPY TEXT GENERATORS (use pdfData for edit persistence) ==============
  const getProviderText = (record) => {
    return `CONSULTING PROVIDER\n${'═'.repeat(50)}\n${record.consultingProvider || 'N/A'}`;
  };

  const getSubstanceHistoryText = (record) => {
    const items = record.substanceUseHistory || [];
    const lines = ['SUBSTANCE USE HISTORY', '═'.repeat(50)];
    items.forEach((item) => {
      const ci = String(item).indexOf(':');
      const label = ci > -1 ? String(item).substring(0, ci).trim() : '';
      const valuePart = ci > -1 ? String(item).substring(ci + 1).trim() : String(item);
      const facts = splitSemiComma(valuePart);
      if (label) lines.push('', label);
      facts.forEach((f, i) => lines.push(`  ${i + 1}. ${f}`));
    });
    return lines.join('\n');
  };

  const getWithdrawalText = (record) => {
    const wa = record.withdrawalAssessment || {};
    const lines = ['WITHDRAWAL ASSESSMENT', '═'.repeat(50)];
    if (wa.scale) lines.push(`Scale: ${wa.scale}`);
    if (wa.score !== undefined) lines.push(`Score: ${wa.score}`);
    if (wa.interpretation) lines.push(`Interpretation: ${wa.interpretation}`);
    if (wa.severity) lines.push(`Severity: ${wa.severity}`);
    if (wa.symptoms && typeof wa.symptoms === 'string') {
      lines.push(`Symptoms: ${wa.symptoms}`);
    } else if (wa.symptoms && typeof wa.symptoms === 'object') {
      lines.push('', 'Symptoms:');
      Object.entries(wa.symptoms).forEach(([key, value]) => {
        lines.push(`  ${formatFieldLabel(key)}: ${value}`);
      });
    }
    // Handle nested withdrawal structure (alcohol, opioid, benzodiazepine)
    const pushSubstanceBlock = (label, sub) => {
      lines.push('', `${label} (${sub.scale || 'N/A'})`);
      if (sub.score !== undefined || sub.severity) lines.push(`  Score: ${sub.score ?? 'N/A'} — ${sub.severity || ''}`.trim());
      if (sub.symptoms) splitByCommaParen(sub.symptoms).forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
    };
    if (wa.alcohol) pushSubstanceBlock('Alcohol', wa.alcohol);
    if (wa.opioid) pushSubstanceBlock('Opioid', wa.opioid);
    if (wa.benzodiazepine) {
      const benzo = wa.benzodiazepine;
      lines.push('', 'Benzodiazepine');
      if (benzo && typeof benzo === 'object') {
        Object.entries(benzo)
          .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
          .forEach(([k, v]) => lines.push(`  ${formatFieldLabel(k)}: ${v}`));
      } else if (benzo) {
        parseLabelValuePairs(String(benzo)).forEach(([l, v]) => lines.push(`  ${l ? l + ': ' : ''}${v}`));
      }
    }
    return lines.join('\n');
  };

  const getMATText = (record) => {
    const mat = record.medicationAssistedTreatment || {};
    const lines = ['MEDICATION-ASSISTED TREATMENT', '═'.repeat(50)];
    // ';'-separated compound fields → label then numbered parts; single value → "Label: value".
    const pushField = (label, val) => {
      if (val === undefined || val === null || String(val).trim() === '') return;
      const parts = splitBySemi(String(val));
      if (parts.length > 1) {
        lines.push('', `${label}:`);
        parts.forEach((p, i) => lines.push(`  ${i + 1}. ${p}`));
      } else {
        lines.push(`${label}: ${val}`);
      }
    };
    pushField('Medication', mat.medication);
    pushField('Induction Dose', mat.inductionDose);
    pushField('Induction Date', mat.inductionDate);
    pushField('Induction Protocol', mat.inductionProtocol);
    pushField('Target Maintenance Dose', mat.targetMaintenanceDose);
    pushField('Target Dose', mat.targetDose);
    pushField('Titration Plan', mat.titrationPlan);
    pushField('Maintenance Duration', mat.maintenanceDuration);
    pushField('Prior MAT', mat.priorMAT);
    if (mat.adjunctMedications?.length) {
      lines.push('', 'Adjunct Medications:');
      mat.adjunctMedications.forEach((item, i) => lines.push(`  ${i + 1}. ${item}`));
    }
    return lines.join('\n');
  };

  const getUDSText = (record) => {
    const items = record.urineDrugScreening || [];
    const lines = ['URINE DRUG SCREENING', '═'.repeat(50)];
    items.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
    return lines.join('\n');
  };

  const getRelapsePreventionText = (record) => {
    const rp = record.relapsePrevention || {};
    const lines = ['RELAPSE PREVENTION', '═'.repeat(50)];
    // Support both field name variants
    const triggers = rp.highRiskSituations || rp.triggers || [];
    const coping = rp.copingStrategies || rp.copingSkills || [];
    const emergency = rp.emergencyPlan || [];
    const support = rp.supportNetwork || [];
    const envMods = rp.environmentalModifications || [];

    if (triggers.length) {
      lines.push('', 'High-Risk Situations / Triggers:');
      triggers.forEach((item, i) => lines.push(`  ${i + 1}. ${item}`));
    }
    if (coping.length) {
      lines.push('', 'Coping Strategies / Skills:');
      coping.forEach((item, i) => lines.push(`  ${i + 1}. ${item}`));
    }
    if (emergency.length) {
      lines.push('', 'Emergency Plan:');
      emergency.forEach((item, i) => lines.push(`  ${i + 1}. ${item}`));
    }
    if (support.length) {
      lines.push('', 'Support Network:');
      support.forEach((item, i) => lines.push(`  ${i + 1}. ${item}`));
    }
    if (envMods.length) {
      lines.push('', 'Environmental Modifications:');
      envMods.forEach((item, i) => lines.push(`  ${i + 1}. ${item}`));
    }
    return lines.join('\n');
  };

  const getRecoveryProgramsText = (record) => {
    const items = record.recoveryPrograms || [];
    const lines = ['RECOVERY PROGRAMS', '═'.repeat(50)];
    items.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
    return lines.join('\n');
  };

  const getHarmReductionText = (record) => {
    const hr = record.harmReductionCounseling || {};
    const lines = ['HARM REDUCTION COUNSELING', '═'.repeat(50)];
    if (hr.naloxoneProvided !== undefined) lines.push(`Naloxone Provided: ${hr.naloxoneProvided ? 'Yes' : 'No'}`);
    if (hr.naloxoneKits) lines.push(`Naloxone Kits: ${hr.naloxoneKits}`);
    if (hr.syringeServicesReferral !== undefined) lines.push(`Syringe Services Referral: ${hr.syringeServicesReferral ? 'Yes' : 'No'}`);
    // ';'/','-separated narrative fields → label then numbered parts; single value → "Label: value".
    const pushSplit = (label, val) => {
      if (val === undefined || val === null || String(val).trim() === '') return;
      const parts = splitSemiComma(String(val));
      if (parts.length > 1) {
        lines.push('', `${label}:`);
        parts.forEach((p, i) => lines.push(`  ${i + 1}. ${p}`));
      } else {
        lines.push(`${label}: ${val}`);
      }
    };
    pushSplit('Naloxone Training', hr.naloxoneTraining);
    pushSplit('Fentanyl Education', hr.fentanylEducation);
    pushSplit('Safer Use Education', hr.saferUseEducation);
    pushSplit('Needle Exchange', hr.needleExchange);
    if (hr.safeUseCounseling?.length) {
      lines.push('', 'Safe Use Counseling:');
      hr.safeUseCounseling.forEach((item, i) => lines.push(`  ${i + 1}. ${item}`));
    }
    return lines.join('\n');
  };

  const getPsychComorbText = (record) => {
    const items = record.psychiatricComorbidities || [];
    const lines = ['PSYCHIATRIC COMORBIDITIES', '═'.repeat(50)];
    items.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
    return lines.join('\n');
  };

  const getSocialDeterminantsText = (record) => {
    const sd = record.socialDeterminants || {};
    const lines = ['SOCIAL DETERMINANTS', '═'.repeat(50)];
    // ';'/','-separated fields → label then numbered parts; single value → "Label: value".
    const pushSplit = (label, val) => {
      if (val === undefined || val === null || String(val).trim() === '') return;
      const parts = splitSemiComma(String(val));
      if (parts.length > 1) {
        lines.push('', `${label}:`);
        parts.forEach((p, i) => lines.push(`  ${i + 1}. ${p}`));
      } else {
        lines.push(`${label}: ${val}`);
      }
    };
    pushSplit('Housing', sd.housing);
    pushSplit('Employment', sd.employment);
    pushSplit('Income', sd.income);
    pushSplit('Family Support', sd.familySupport);
    pushSplit('Legal Issues', sd.legalIssues);
    pushSplit('Legal History', sd.legalHistory);
    return lines.join('\n');
  };

  const getTreatmentPlanText = (record) => {
    const tp = record.treatmentPlan || {};
    const lines = ['TREATMENT PLAN', '═'.repeat(50)];
    if (tp.levelOfCare) lines.push(`Level of Care: ${tp.levelOfCare}`);
    if (tp.backupPlan) lines.push(`Backup Plan: ${tp.backupPlan}`);
    if (tp.phase1) lines.push(`Phase 1: ${tp.phase1}`);
    if (tp.phase2) lines.push(`Phase 2: ${tp.phase2}`);
    if (tp.phase3) lines.push(`Phase 3: ${tp.phase3}`);
    if (tp.psychiatricTreatment) lines.push(`Psychiatric Treatment: ${tp.psychiatricTreatment}`);
    if (tp.counseling) lines.push(`Counseling: ${tp.counseling}`);
    if (tp.components?.length) {
      lines.push('', 'Components:');
      tp.components.forEach((item, i) => lines.push(`  ${i + 1}. ${item}`));
    }
    return lines.join('\n');
  };

  const getPrognosisText = (record) => {
    const p = record.prognosis || {};
    const lines = ['PROGNOSIS', '═'.repeat(50)];
    if (p.overall) lines.push(`Overall: ${p.overall}`);
    if (p.withMAT) lines.push(`With MAT: ${p.withMAT}`);
    if (p.withoutMAT) lines.push(`Without MAT: ${p.withoutMAT}`);
    if (p.favorableFactors?.length) {
      lines.push('', 'Favorable Factors:');
      p.favorableFactors.forEach((item, i) => lines.push(`  ${i + 1}. ${item}`));
    }
    if (p.unfavorableFactors?.length) {
      lines.push('', 'Unfavorable Factors:');
      p.unfavorableFactors.forEach((item, i) => lines.push(`  ${i + 1}. ${item}`));
    }
    if (p.criticalInflectionPoints?.length) {
      lines.push('', 'Critical Inflection Points:');
      p.criticalInflectionPoints.forEach((item, i) => lines.push(`  ${i + 1}. ${item}`));
    }
    return lines.join('\n');
  };

  const getAllRecordText = (record, idx) => {
    const sections = [
      `ADDICTION MEDICINE CONSULTATION ${idx + 1}`,
      `Date: ${formatDate(record.date)}`,
      '═'.repeat(60),
      '',
      getProviderText(record),
      '',
      getSubstanceHistoryText(record),
      '',
      getWithdrawalText(record),
      '',
      getMATText(record),
      '',
      getUDSText(record),
      '',
      getRelapsePreventionText(record),
      '',
      getRecoveryProgramsText(record),
      '',
      getHarmReductionText(record),
      '',
      getPsychComorbText(record),
      '',
      getSocialDeterminantsText(record),
      '',
      getTreatmentPlanText(record),
      '',
      getPrognosisText(record),
    ];
    return sections.join('\n');
  };

  // ============== RENDER ==============
  if (!unwrappedData.length) {
    return (
      <div className="addiction-medicine-consultations-document">
        <div className="no-data-message">No addiction medicine consultation data available.</div>
      </div>
    );
  }

  const isSearching = searchTerm.trim().length > 0;

  return (
    <div className="addiction-medicine-consultations-document">
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">Addiction Medicine Consultations</h1>

        <div className="header-actions">
          <button
            className={`copy-btn ${copiedId === 'all-documents' ? 'copied' : ''}`}
            onClick={() => {
              const allText = pdfData.map((r, i) => getAllRecordText(r, i)).join('\n\n');
              copyToClipboard(allText, 'all-documents');
            }}
          >
            {copiedId === 'all-documents' ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<AddictionMedicineConsultationsDocumentPDFTemplate document={pdfData} />}
            fileName="addiction-medicine-consultations.pdf"
            className="pdf-btn"
          >
            {({ loading }) => (loading ? 'Preparing...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>

        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search consultations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>
          )}
        </div>
      </div>

      {/* Results Count */}
      {isSearching && (
        <div className="search-results-count">
          Found {filteredRecords.length} of {unwrappedData.length} consultation{unwrappedData.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Consultations List */}
      <div className="consultations-list">
        {filteredRecords.map((record, idx) => {
          const showAll = record._showAllSections;

          // Section visibility checks
          const showProvider = showAll || shouldShowSection('Consulting Provider', record.consultingProvider);
          const showSubstanceHistory = showAll || shouldShowSection('Substance Use History', ...(record.substanceUseHistory || []));
          const showWithdrawal = showAll || shouldShowSection('Withdrawal Assessment',
            record.withdrawalAssessment?.scale, record.withdrawalAssessment?.interpretation,
            String(record.withdrawalAssessment?.score || ''),
            'COWS Score', 'COWS', 'Individual Symptoms',
            record.withdrawalAssessment?.score !== undefined ? `${record.withdrawalAssessment.score}/48` : '',
            ...(record.withdrawalAssessment?.symptoms ? Object.entries(record.withdrawalAssessment.symptoms).flatMap(([key, value]) => [
              formatFieldLabel(key), key, String(value), `${value}/4`
            ]) : []),
            record.withdrawalAssessment?.alcohol?.scale, record.withdrawalAssessment?.alcohol?.severity, record.withdrawalAssessment?.alcohol?.symptoms,
            record.withdrawalAssessment?.opioid?.scale, record.withdrawalAssessment?.opioid?.severity, record.withdrawalAssessment?.opioid?.symptoms);
          const showMAT = showAll || shouldShowSection('Medication-Assisted Treatment',
            record.medicationAssistedTreatment?.medication, record.medicationAssistedTreatment?.priorMAT,
            record.medicationAssistedTreatment?.inductionProtocol, record.medicationAssistedTreatment?.targetDose,
            record.medicationAssistedTreatment?.titrationPlan, record.medicationAssistedTreatment?.maintenanceDuration);
          const showUDS = showAll || shouldShowSection('Urine Drug Screening', ...(record.urineDrugScreening || []));
          const showRelapse = showAll || shouldShowSection('Relapse Prevention',
            ...(record.relapsePrevention?.highRiskSituations || []),
            ...(record.relapsePrevention?.copingStrategies || []),
            ...(record.relapsePrevention?.emergencyPlan || []),
            ...(record.relapsePrevention?.triggers || []),
            ...(record.relapsePrevention?.copingSkills || []),
            ...(record.relapsePrevention?.supportNetwork || []),
            ...(record.relapsePrevention?.environmentalModifications || []));
          const showRecovery = showAll || shouldShowSection('Recovery Programs', ...(record.recoveryPrograms || []));
          const showHarmReduction = showAll || shouldShowSection('Harm Reduction Counseling',
            ...(record.harmReductionCounseling?.safeUseCounseling || []),
            record.harmReductionCounseling?.naloxoneTraining,
            record.harmReductionCounseling?.fentanylEducation,
            record.harmReductionCounseling?.saferUseEducation,
            record.harmReductionCounseling?.needleExchange);
          const showPsych = showAll || shouldShowSection('Psychiatric Comorbidities', ...(record.psychiatricComorbidities || []));
          const showSocial = showAll || shouldShowSection('Social Determinants',
            record.socialDeterminants?.housing, record.socialDeterminants?.employment,
            record.socialDeterminants?.familySupport, record.socialDeterminants?.legalIssues,
            record.socialDeterminants?.income, record.socialDeterminants?.legalHistory);
          const showTreatment = showAll || shouldShowSection('Treatment Plan',
            record.treatmentPlan?.phase1, record.treatmentPlan?.phase2, record.treatmentPlan?.phase3,
            record.treatmentPlan?.psychiatricTreatment, record.treatmentPlan?.counseling,
            record.treatmentPlan?.levelOfCare, record.treatmentPlan?.backupPlan,
            ...(record.treatmentPlan?.components || []));
          const showPrognosis = showAll || shouldShowSection('Prognosis',
            record.prognosis?.withMAT, record.prognosis?.withoutMAT, record.prognosis?.overall,
            ...(record.prognosis?.favorableFactors || []),
            ...(record.prognosis?.unfavorableFactors || []),
            ...(record.prognosis?.criticalInflectionPoints || []));

          // Section title match checks
          const providerTitleMatches = showAll || sectionTitleMatches('Consulting Provider');
          const substanceTitleMatches = showAll || sectionTitleMatches('Substance Use History');
          const withdrawalTitleMatches = showAll || sectionTitleMatches('Withdrawal Assessment');
          const matTitleMatches = showAll || sectionTitleMatches('Medication-Assisted Treatment');
          const udsTitleMatches = showAll || sectionTitleMatches('Urine Drug Screening');
          const relapseTitleMatches = showAll || sectionTitleMatches('Relapse Prevention');
          const recoveryTitleMatches = showAll || sectionTitleMatches('Recovery Programs');
          const harmTitleMatches = showAll || sectionTitleMatches('Harm Reduction Counseling');
          const psychTitleMatches = showAll || sectionTitleMatches('Psychiatric Comorbidities');
          const socialTitleMatches = showAll || sectionTitleMatches('Social Determinants');
          const treatmentTitleMatches = showAll || sectionTitleMatches('Treatment Plan');
          const prognosisTitleMatches = showAll || sectionTitleMatches('Prognosis');

          // Helper for rendering nested object fields with editing
          const renderNestedFields = (parentField, fieldKeys, sectionId, titleMatches) => {
            const parent = record[parentField];
            if (!parent || typeof parent !== 'object') return null;
            return fieldKeys.map((fieldDef) => {
              const [key, label] = Array.isArray(fieldDef) ? fieldDef : [fieldDef, formatFieldLabel(fieldDef)];
              const dotPath = `${parentField}.${key}`;
              return renderEditableField(record, dotPath, label, idx, sectionId);
            }).filter(Boolean);
          };

          // Helper for a nested string field that holds delimiter-separated parts → one editable+copyable
          // row per part. `splitter` picks the delimiter (splitBySemi = ';' only; splitSemiComma = ';' and ',').
          // Editing a row rebuilds the whole '; '-joined string and saves it. Single-part fields render as one
          // row, same as renderEditableField.
          const renderSemiSplitField = (parentField, key, label, sectionId, titleMatches, splitter = splitBySemi) => {
            const dotPath = `${parentField}.${key}`;
            const raw = getFieldValue(record, dotPath, idx);
            if (raw === undefined || raw === null || String(raw).trim() === '') return null;
            if (!record._showAllSections && !titleMatches && !shouldShowRow(label, String(raw))) return null;
            const canEdit = !!record._id;
            const parts = splitter(String(raw));

            const savePart = (pIdx) => {
              const text = editValue.trim();
              const next = [...parts];
              if (!text) next.splice(pIdx, 1); else next[pIdx] = text;
              handleSaveField(record, dotPath, idx, sectionId, undefined, next.join('; '), pIdx);
            };

            return (
              <div className="rec-mini-card" key={key}>
                <div className="nested-subtitle">{highlightText(label)}</div>
                {parts.map((part, pIdx) => {
                  const editKey = `${dotPath}-${idx}-s${pIdx}`;
                  const isEditing = editingField === editKey;
                  const copyKey = `${sectionId}-${key}-${idx}-${pIdx}`;
                  const partEdited = editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';
                  if (isEditing) {
                    return (
                      <div key={pIdx} className="numbered-row edit-row">
                        <div className="edit-field-container">
                          <textarea ref={textareaRef} className="edit-textarea" value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') handleCancelEdit();
                              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) savePart(pIdx);
                            }}
                            rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))} disabled={saving} />
                          <div className="edit-actions">
                            <button className="edit-save-btn" onClick={() => savePart(pIdx)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <React.Fragment key={pIdx}>
                      <div className={`numbered-row${partEdited ? ' modified' : ''}`}>
                        <div className={`row-content${canEdit ? ' editable' : ''}`}
                          onClick={() => canEdit && handleStartEdit(dotPath, idx, part, pIdx)}
                          title={canEdit ? 'Click to edit' : undefined}>
                          <span className="content-value">{highlightText(part)}</span>
                          {canEdit && !partEdited && editIndicator}
                        </div>
                        <button className={`copy-btn ${copiedId === copyKey ? 'copied' : ''}`}
                          onClick={() => copyToClipboard(part, copyKey)}>
                          {copiedId === copyKey ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      {partEdited && <div className="modified-badge">edited — click Pending Approve to save</div>}
                    </React.Fragment>
                  );
                })}
              </div>
            );
          };

          // Helper for rendering nested array items with editing
          const renderNestedArrayItems = (parentField, arrayKey, sectionId, titleMatches, subsectionLabel) => {
            const parent = record[parentField];
            if (!parent || typeof parent !== 'object') return null;
            const items = parent[arrayKey];
            if (!Array.isArray(items) || items.length === 0) return null;
            const dotPath = `${parentField}.${arrayKey}`;
            return (
              <div className="rec-mini-card">
                <div className="section-header subsection-header">
                  <div className="nested-subtitle">{highlightText(subsectionLabel)}</div>
                  <button
                    className={`copy-btn ${copiedId === `${arrayKey}-${idx}` ? 'copied' : ''}`}
                    onClick={() => {
                      const lines = [subsectionLabel.toUpperCase(), '═'.repeat(40)];
                      items.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
                      copyToClipboard(lines.join('\n'), `${arrayKey}-${idx}`);
                    }}
                  >
                    {copiedId === `${arrayKey}-${idx}` ? 'Copied!' : 'Copy Section'}
                  </button>
                </div>
                {items.map((item, itemIdx) =>
                  renderEditableArrayItem(record, dotPath, item, idx, itemIdx, sectionId, subsectionLabel, titleMatches || sectionTitleMatches(subsectionLabel))
                )}
              </div>
            );
          };

          // Helper for the split Withdrawal sub-blocks (Alcohol/Opioid): editable + copyable
          // "Score — Severity" line plus per-symptom rows (symptoms is a comma-separated string).
          const renderWithdrawalSub = (subKey, subLabel) => {
            const sub = record.withdrawalAssessment[subKey];
            if (!sub) return null;
            const canEdit = !!record._id;
            const scale = sub.scale || 'N/A';

            // Current (possibly draft-edited) values.
            const scoreVal = getFieldValue(record, `withdrawalAssessment.${subKey}.score`, idx);
            const severityVal = getFieldValue(record, `withdrawalAssessment.${subKey}.severity`, idx);
            const symptomsStr = getFieldValue(record, `withdrawalAssessment.${subKey}.symptoms`, idx) || '';
            const symptoms = splitByCommaParen(symptomsStr);

            const scoreLine = `Score: ${scoreVal ?? 'N/A'} — ${severityVal || ''}`.trim();
            const scoreEditKey = `withdrawalAssessment.${subKey}.scoreLine-${idx}-s0`;
            const scoreEditing = editingField === scoreEditKey;
            const scoreEdited = (localEdits[`withdrawalAssessment.${subKey}.score-${idx}`] !== undefined ||
              localEdits[`withdrawalAssessment.${subKey}.severity-${idx}`] !== undefined) && statusOverrides[idx] !== 'approved';
            const scoreCopyKey = `wa-${subKey}-${idx}`;

            // Save the combined "score — severity" line back into the two underlying sub-fields.
            const saveScoreLine = () => {
              const body = editValue.trim().replace(/^score\s*:?\s*/i, '');
              const sep = body.includes('—') ? '—' : (body.includes(' - ') ? ' - ' : null);
              const scorePart = (sep ? body.slice(0, body.indexOf(sep)) : body).trim();
              const sevPart = sep ? body.slice(body.indexOf(sep) + sep.length).trim() : '';
              const numScore = scorePart !== '' && !isNaN(Number(scorePart)) ? Number(scorePart) : scorePart;
              handleSaveField(record, `withdrawalAssessment.${subKey}.score`, idx, 'withdrawal', undefined, numScore);
              handleSaveField(record, `withdrawalAssessment.${subKey}.severity`, idx, 'withdrawal', undefined, sevPart);
            };

            // Edit one symptom, rebuild the comma-joined symptoms string, and save it.
            const saveSymptom = (sIdx) => {
              const text = editValue.trim();
              const next = [...symptoms];
              if (!text) next.splice(sIdx, 1); else next[sIdx] = text;
              handleSaveField(record, `withdrawalAssessment.${subKey}.symptoms`, idx, 'withdrawal', undefined, next.join(', '), sIdx);
            };

            return (
              <div className="rec-mini-card" key={subKey}>
                <div className="nested-subtitle">{highlightText(`${subLabel} (${scale})`)}</div>

                {/* Score — Severity (editable + copy) */}
                {scoreEditing ? (
                  <div className="numbered-row edit-row">
                    <div className="edit-field-container">
                      <textarea ref={textareaRef} className="edit-textarea" value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') handleCancelEdit();
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveScoreLine();
                        }}
                        rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))} disabled={saving} />
                      <div className="edit-actions">
                        <button className="edit-save-btn" onClick={saveScoreLine} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={`numbered-row${scoreEdited ? ' modified' : ''}`}>
                      <div className={`row-content${canEdit ? ' editable' : ''}`}
                        onClick={() => canEdit && handleStartEdit(`withdrawalAssessment.${subKey}.scoreLine`, idx, `${scoreVal ?? ''} — ${severityVal || ''}`.trim())}
                        title={canEdit ? 'Click to edit' : undefined}>
                        <span className="content-value">{highlightText(scoreLine)}</span>
                        {canEdit && !scoreEdited && editIndicator}
                      </div>
                      <button className={`copy-btn ${copiedId === scoreCopyKey ? 'copied' : ''}`}
                        onClick={() => copyToClipboard(`${subLabel} (${scale}): Score ${scoreVal ?? 'N/A'} - ${severityVal || ''}`, scoreCopyKey)}>
                        {copiedId === scoreCopyKey ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    {scoreEdited && <div className="modified-badge">edited — click Pending Approve to save</div>}
                  </>
                )}

                {/* Symptom rows (each editable + copy) */}
                {symptoms.map((sym, sIdx) => {
                  const symEditKey = `withdrawalAssessment.${subKey}.symptoms-${idx}-s${sIdx}`;
                  const symEditing = editingField === symEditKey;
                  const symCopyKey = `wa-${subKey}-sym-${idx}-${sIdx}`;
                  const symEdited = editedSentences[symEditKey] === 'edited' && statusOverrides[idx] !== 'approved';
                  if (symEditing) {
                    return (
                      <div key={sIdx} className="numbered-row edit-row">
                        <div className="edit-field-container">
                          <textarea ref={textareaRef} className="edit-textarea" value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') handleCancelEdit();
                              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveSymptom(sIdx);
                            }}
                            rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))} disabled={saving} />
                          <div className="edit-actions">
                            <button className="edit-save-btn" onClick={() => saveSymptom(sIdx)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <React.Fragment key={sIdx}>
                      <div className={`numbered-row${symEdited ? ' modified' : ''}`} style={sIdx === 0 ? { marginTop: '8px' } : undefined}>
                        <div className={`row-content${canEdit ? ' editable' : ''}`}
                          onClick={() => canEdit && handleStartEdit(`withdrawalAssessment.${subKey}.symptoms`, idx, sym, sIdx)}
                          title={canEdit ? 'Click to edit' : undefined}>
                          <span className="content-value">{highlightText(sym)}</span>
                          {canEdit && !symEdited && editIndicator}
                        </div>
                        <button className={`copy-btn ${copiedId === symCopyKey ? 'copied' : ''}`}
                          onClick={() => copyToClipboard(sym, symCopyKey)}>
                          {copiedId === symCopyKey ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      {symEdited && <div className="modified-badge">edited — click Pending Approve to save</div>}
                    </React.Fragment>
                  );
                })}
              </div>
            );
          };

          return (
            <div key={idx} className="consultation-card">
              {/* Record Header */}
              <div className="record-header">
                <h2 className="record-title">{highlightText(`Addiction Medicine Consultation ${idx + 1}`)}</h2>
                <div className="header-top-row">
                  <span className="date-badge">{formatDate(record.date)}</span>
                </div>
              </div>

              {/* 1. Consulting Provider */}
              {record.consultingProvider && showProvider && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Consulting Provider', `provider-${idx}`,
                      () => copyToClipboard(getProviderText(pdfData[idx] || record), `provider-${idx}`), idx, 'provider')}
                    {renderEditableField(record, 'consultingProvider', 'Consulting Provider', idx, 'provider')}
                  </div>
                </div>
              )}

              {/* 2. Substance Use History */}
              {record.substanceUseHistory?.length > 0 && showSubstanceHistory && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Substance Use History', `substance-${idx}`,
                      () => copyToClipboard(getSubstanceHistoryText(pdfData[idx] || record), `substance-${idx}`), idx, 'substance')}
                    {record.substanceUseHistory.map((item, itemIdx) => {
                      const fullValue = getArrayFieldValue(record, 'substanceUseHistory', itemIdx, idx) || item;
                      const colonIdx = String(fullValue).indexOf(':');
                      const displayLabel = colonIdx > -1 ? String(fullValue).substring(0, colonIdx).trim() : `Substance ${itemIdx + 1}`;
                      const valuePart = colonIdx > -1 ? String(fullValue).substring(colonIdx + 1).trim() : String(fullValue);
                      const facts = splitSemiComma(valuePart);

                      if (!substanceTitleMatches && !shouldShowRow(record, item, fullValue)) return null;
                      const canEdit = !!record._id;
                      const itemEdited = localEdits[`substanceUseHistory.${itemIdx}-${idx}`] !== undefined && statusOverrides[idx] !== 'approved';

                      // Edit/remove one fact, then rebuild the whole "Label: f1; f2; ..." item and save it.
                      const saveFact = (factIdx) => {
                        const text = editValue.trim();
                        const next = [...facts];
                        if (!text) next.splice(factIdx, 1); else next[factIdx] = text;
                        const rebuilt = (colonIdx > -1 ? `${displayLabel}: ` : '') + next.join('; ');
                        handleSaveField(record, 'substanceUseHistory', idx, 'substance', itemIdx, rebuilt, factIdx);
                      };

                      return (
                        <div key={itemIdx} className="rec-mini-card">
                          <div className="nested-subtitle">{highlightText(displayLabel)}</div>
                          {facts.map((fact, factIdx) => {
                            const editKey = `substanceUseHistory.${itemIdx}-${idx}-s${factIdx}`;
                            const isEditing = editingField === editKey;
                            const copyKey = `substance-row-${idx}-${itemIdx}-${factIdx}`;

                            if (isEditing) {
                              return (
                                <div key={factIdx} className="numbered-row edit-row">
                                  <div className="edit-field-container">
                                    <textarea
                                      ref={textareaRef}
                                      className="edit-textarea"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Escape') handleCancelEdit();
                                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveFact(factIdx);
                                      }}
                                      rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))}
                                      disabled={saving}
                                    />
                                    <div className="edit-actions">
                                      <button className="edit-save-btn" onClick={() => saveFact(factIdx)} disabled={saving}>
                                        {saving ? 'Saving...' : 'Save'}
                                      </button>
                                      <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div key={factIdx} className="numbered-row">
                                <div className={`row-content${canEdit ? ' editable' : ''}`}
                                  onClick={() => canEdit && handleStartEdit(`substanceUseHistory.${itemIdx}`, idx, fact, factIdx)}
                                  title={canEdit ? 'Click to edit' : undefined}
                                >
                                  <span className="content-value">{highlightText(fact)}</span>
                                  {canEdit && editIndicator}
                                </div>
                                <button
                                  className={`copy-btn ${copiedId === copyKey ? 'copied' : ''}`}
                                  onClick={() => copyToClipboard(fact, copyKey)}
                                >
                                  {copiedId === copyKey ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                            );
                          })}
                          {itemEdited && <div className="modified-badge">edited — click Pending Approve to save</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Withdrawal Assessment - Bar Chart (NOT editable) + Scale (editable) */}
              {record.withdrawalAssessment && showWithdrawal && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Withdrawal Assessment', `withdrawal-${idx}`,
                      () => copyToClipboard(getWithdrawalText(pdfData[idx] || record), `withdrawal-${idx}`), idx, 'withdrawal')}

                    {/* Scale - editable text */}
                    {record.withdrawalAssessment.scale && renderEditableField(record, 'withdrawalAssessment.scale', 'Scale', idx, 'withdrawal')}

                    {/* Nested withdrawal structure (alcohol, opioid, benzodiazepine) — editable + copyable */}
                    {renderWithdrawalSub('alcohol', 'Alcohol')}
                    {renderWithdrawalSub('opioid', 'Opioid')}

                    {record.withdrawalAssessment.benzodiazepine && (() => {
                      const benzo = record.withdrawalAssessment.benzodiazepine;
                      const isObj = benzo && typeof benzo === 'object';
                      // Object form (robust — never splits the date in "February 10, 2026") keeps each raw key so the
                      // value can be edited at withdrawalAssessment.benzodiazepine.<key>. String form is copy-only.
                      const pairs = isObj
                        ? Object.entries(benzo)
                            .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
                            .map(([k, v]) => [formatFieldLabel(k), String(v), k])
                        : parseLabelValuePairs(String(benzo)).map(([l, v]) => [l, v, null]);
                      if (pairs.length === 0) return null;
                      const canEdit = !!record._id;
                      return (
                        <div className="rec-mini-card">
                          <div className="nested-subtitle">{highlightText('Benzodiazepine')}</div>
                          {pairs.map(([lbl, val, key], pi) => {
                            const fieldPath = key ? `withdrawalAssessment.benzodiazepine.${key}` : null;
                            const editable = canEdit && !!fieldPath;
                            const dispVal = fieldPath ? String(getFieldValue(record, fieldPath, idx) ?? val) : val;
                            const editKey = fieldPath ? `${fieldPath}-${idx}-s0` : null;
                            const isEditing = editable && editingField === editKey;
                            const isEdited = !!fieldPath && localEdits[`${fieldPath}-${idx}`] !== undefined && statusOverrides[idx] !== 'approved';
                            const copyKey = `wa-benzo-${idx}-${pi}`;
                            return (
                              <div key={pi} className="nested-mini-card">
                                {lbl && <div className="nested-subtitle sub-label">{highlightText(lbl)}</div>}
                                {isEditing ? (
                                  <div className="numbered-row edit-row">
                                    <div className="edit-field-container">
                                      <textarea ref={textareaRef} className="edit-textarea" value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Escape') handleCancelEdit();
                                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveField(record, fieldPath, idx, 'withdrawal');
                                        }}
                                        rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))} disabled={saving} />
                                      <div className="edit-actions">
                                        <button className="edit-save-btn" onClick={() => handleSaveField(record, fieldPath, idx, 'withdrawal')} disabled={saving}>
                                          {saving ? 'Saving...' : 'Save'}
                                        </button>
                                        <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
                                      <div className={`row-content${editable ? ' editable' : ''}`}
                                        onClick={() => editable && handleStartEdit(fieldPath, idx, dispVal)}
                                        title={editable ? 'Click to edit' : undefined}>
                                        <span className="content-value">{highlightText(dispVal)}</span>
                                        {editable && !isEdited && editIndicator}
                                      </div>
                                      <button className={`copy-btn ${copiedId === copyKey ? 'copied' : ''}`}
                                        onClick={() => copyToClipboard(lbl ? `${lbl}: ${dispVal}` : dispVal, copyKey)}>
                                        {copiedId === copyKey ? 'Copied!' : 'Copy'}
                                      </button>
                                    </div>
                                    {isEdited && <div className="modified-badge">edited — click Pending Approve to save</div>}
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Bar Chart Visualization (NOT editable) */}
                    {(() => {
                      const cowsScore = record.withdrawalAssessment.score;
                      const cowsInterpretation = cowsScore !== undefined ? getCOWSInterpretation(cowsScore) : '';
                      const cowsScoreText = cowsScore !== undefined ? `${cowsScore}/48` : '';
                      const showCOWSBar = cowsScore !== undefined && cowsScore > 0 &&
                        (withdrawalTitleMatches || shouldShowRow('COWS Score', cowsScoreText, cowsInterpretation));

                      const symptomsObj = record.withdrawalAssessment.symptoms || {};
                      const symptomsTitleMatches = shouldShowRow('Individual Symptoms', 'Individual Symptoms (0-4 Scale)', '0-4 Scale');
                      const filteredSymptoms = Object.entries(symptomsObj).filter(([symptom, score]) => {
                        const label = formatFieldLabel(symptom);
                        return withdrawalTitleMatches || symptomsTitleMatches || shouldShowRow(label, symptom, String(score));
                      });
                      const hasSymptoms = filteredSymptoms.length > 0;

                      if (!showCOWSBar && !hasSymptoms) return null;

                      return (
                        <div className="chart-container">
                          <div className="chart-legend">
                            <div className="legend-item">
                              <div className="legend-color" style={{ backgroundColor: '#22c55e' }} />
                              <span className="legend-text">{highlightText('Mild (0-10%)')}</span>
                            </div>
                            <div className="legend-item">
                              <div className="legend-color" style={{ backgroundColor: '#3b82f6' }} />
                              <span className="legend-text">{highlightText('Moderate (11-25%)')}</span>
                            </div>
                            <div className="legend-item">
                              <div className="legend-color" style={{ backgroundColor: '#f59e0b' }} />
                              <span className="legend-text">{highlightText('Mod-Severe (26-50%)')}</span>
                            </div>
                            <div className="legend-item">
                              <div className="legend-color" style={{ backgroundColor: '#ef4444' }} />
                              <span className="legend-text">{highlightText('Severe (51%+)')}</span>
                            </div>
                          </div>

                          {showCOWSBar && (
                            <div className="main-score-bar">
                              <div className="main-score-header">
                                <span className="main-score-label">{highlightText('COWS Score')}</span>
                                <span className="main-score-value">{highlightText(cowsScoreText)}</span>
                              </div>
                              <div className="main-bar-container">
                                <div className="main-bar-background">
                                  <div className="main-bar-fill" style={{
                                    width: `${Math.min(100, (cowsScore / 48) * 100)}%`,
                                    backgroundColor: getCOWSColor(cowsScore)
                                  }} />
                                </div>
                              </div>
                              <div className="main-score-interpretation" style={{ color: getCOWSColor(cowsScore) }}>
                                {highlightText(cowsInterpretation)}
                              </div>
                            </div>
                          )}

                          {hasSymptoms && (
                            <>
                              <div className="symptom-bars-title">{highlightText('Individual Symptoms (0-4 Scale)')}</div>
                              <div className="symptom-bars-grid">
                                {filteredSymptoms.map(([symptom, score], sIdx) => {
                                  const label = formatFieldLabel(symptom);
                                  const numScore = typeof score === 'number' ? score : parseFloat(score) || 0;
                                  return (
                                    <div key={sIdx} className="symptom-bar-row">
                                      <span className="symptom-label">{highlightText(label)}</span>
                                      <div className="symptom-bar-container">
                                        <div className="symptom-bar-background">
                                          <div className="symptom-bar-fill" style={{
                                            width: `${(numScore / 4) * 100}%`,
                                            backgroundColor: getSymptomColor(numScore)
                                          }} />
                                        </div>
                                        <span className="symptom-score">{highlightText(`${numScore}/4`)}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* 4. Medication-Assisted Treatment */}
              {record.medicationAssistedTreatment && showMAT && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Medication-Assisted Treatment', `mat-${idx}`,
                      () => copyToClipboard(getMATText(pdfData[idx] || record), `mat-${idx}`), idx, 'mat')}

                    {[
                      ['medication', 'Medication'],
                      ['inductionDose', 'Induction Dose'],
                      ['inductionDate', 'Induction Date'],
                      ['inductionProtocol', 'Induction Protocol'],
                      ['targetMaintenanceDose', 'Target Maintenance Dose'],
                      ['targetDose', 'Target Dose'],
                      ['titrationPlan', 'Titration Plan'],
                      ['maintenanceDuration', 'Maintenance Duration'],
                      ['priorMAT', 'Prior MAT'],
                    ].map(([key, label]) => renderSemiSplitField('medicationAssistedTreatment', key, label, 'mat', matTitleMatches)).filter(Boolean)}

                    {/* Adjunct Medications array */}
                    {record.medicationAssistedTreatment.adjunctMedications?.length > 0 && (
                      <div className="rec-mini-card">
                        <div className="section-header subsection-header">
                          <div className="nested-subtitle">{highlightText('Adjunct Medications')}</div>
                          <button
                            className={`copy-btn ${copiedId === `adjunct-${idx}` ? 'copied' : ''}`}
                            onClick={() => {
                              const lines = ['ADJUNCT MEDICATIONS', '═'.repeat(40)];
                              record.medicationAssistedTreatment.adjunctMedications.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
                              copyToClipboard(lines.join('\n'), `adjunct-${idx}`);
                            }}
                          >
                            {copiedId === `adjunct-${idx}` ? 'Copied!' : 'Copy Section'}
                          </button>
                        </div>
                        {record.medicationAssistedTreatment.adjunctMedications.map((item, itemIdx) =>
                          renderEditableArrayItem(record, 'medicationAssistedTreatment.adjunctMedications', item, idx, itemIdx, 'mat', 'Adjunct Medications', matTitleMatches || sectionTitleMatches('Adjunct Medications'))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 5. Urine Drug Screening */}
              {record.urineDrugScreening?.length > 0 && showUDS && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Urine Drug Screening', `uds-${idx}`,
                      () => copyToClipboard(getUDSText(pdfData[idx] || record), `uds-${idx}`), idx, 'uds')}
                    {record.urineDrugScreening.map((item, itemIdx) => {
                      if (!udsTitleMatches && !shouldShowRow(item)) return null;
                      const displayValue = getArrayFieldValue(record, 'urineDrugScreening', itemIdx, idx) || item;
                      const colonIdx = displayValue.indexOf(':');
                      const hasLabel = colonIdx > 0 && colonIdx < 30;
                      const label = hasLabel ? displayValue.substring(0, colonIdx).trim() : null;
                      const value = hasLabel ? displayValue.substring(colonIdx + 1).trim() : displayValue;
                      const canEdit = !!record._id;
                      const editKey = `urineDrugScreening.${itemIdx}-${idx}-s0`;
                      const isEditing = editingField === editKey;
                      const sectionKey = `uds-${idx}`;
                      const sectionWasEdited = editedFields[sectionKey];
                      const isItemEdited = sectionWasEdited && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';

                      if (isEditing) {
                        return (
                          <div key={itemIdx} className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText(label || `Test ${itemIdx + 1}`)}</div>
                            <div className="numbered-row edit-row">
                              <div className="edit-field-container">
                                <textarea ref={textareaRef} className="edit-textarea" value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') handleCancelEdit();
                                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveField(record, 'urineDrugScreening', idx, 'uds', itemIdx);
                                  }}
                                  rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))}
                                  disabled={saving}
                                />
                                <div className="edit-actions">
                                  <button className="edit-save-btn" onClick={() => handleSaveField(record, 'urineDrugScreening', idx, 'uds', itemIdx)} disabled={saving}>
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
                        <div key={itemIdx} className="rec-mini-card">
                          <div className="nested-subtitle">{highlightText(label || `Test ${itemIdx + 1}`)}</div>
                          <>
                            <div className={`numbered-row${isItemEdited ? ' modified' : ''}`}>
                              <div className={`row-content${canEdit ? ' editable' : ''}`}
                                onClick={() => canEdit && handleStartEdit(`urineDrugScreening.${itemIdx}`, idx, displayValue)}
                                title={canEdit ? 'Click to edit' : undefined}
                              >
                                <span className="content-value">{highlightText(value)}</span>
                                {canEdit && !isItemEdited && editIndicator}
                              </div>
                              <button className={`copy-btn ${copiedId === `uds-row-${idx}-${itemIdx}` ? 'copied' : ''}`}
                                onClick={() => copyToClipboard(displayValue, `uds-row-${idx}-${itemIdx}`)}>
                                {copiedId === `uds-row-${idx}-${itemIdx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                            {isItemEdited && <div className="modified-badge">edited — click Pending Approve to save</div>}
                          </>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 6. Relapse Prevention */}
              {record.relapsePrevention && showRelapse && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Relapse Prevention', `relapse-${idx}`,
                      () => copyToClipboard(getRelapsePreventionText(pdfData[idx] || record), `relapse-${idx}`), idx, 'relapse')}

                    {renderNestedArrayItems('relapsePrevention', 'highRiskSituations', 'relapse', relapseTitleMatches, 'High-Risk Situations')}
                    {renderNestedArrayItems('relapsePrevention', 'triggers', 'relapse', relapseTitleMatches, 'Triggers')}
                    {renderNestedArrayItems('relapsePrevention', 'copingStrategies', 'relapse', relapseTitleMatches, 'Coping Strategies')}
                    {renderNestedArrayItems('relapsePrevention', 'copingSkills', 'relapse', relapseTitleMatches, 'Coping Skills')}
                    {renderNestedArrayItems('relapsePrevention', 'emergencyPlan', 'relapse', relapseTitleMatches, 'Emergency Plan')}
                    {renderNestedArrayItems('relapsePrevention', 'supportNetwork', 'relapse', relapseTitleMatches, 'Support Network')}
                    {renderNestedArrayItems('relapsePrevention', 'environmentalModifications', 'relapse', relapseTitleMatches, 'Environmental Modifications')}
                  </div>
                </div>
              )}

              {/* 7. Recovery Programs */}
              {record.recoveryPrograms?.length > 0 && showRecovery && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Recovery Programs', `recovery-${idx}`,
                      () => copyToClipboard(getRecoveryProgramsText(pdfData[idx] || record), `recovery-${idx}`), idx, 'recovery')}
                    {record.recoveryPrograms.map((item, itemIdx) => {
                      if (!recoveryTitleMatches && !shouldShowRow(item)) return null;
                      const displayValue = getArrayFieldValue(record, 'recoveryPrograms', itemIdx, idx) || item;
                      const colonIdx = displayValue.indexOf(':');
                      const hasLabel = colonIdx > 0 && colonIdx < 50;
                      const label = hasLabel ? displayValue.substring(0, colonIdx).trim() : null;
                      const value = hasLabel ? displayValue.substring(colonIdx + 1).trim() : displayValue;

                      return renderEditableArrayItem(record, 'recoveryPrograms', item, idx, itemIdx, 'recovery', label || `Program ${itemIdx + 1}`, recoveryTitleMatches) ? (
                        <div key={itemIdx} className="rec-mini-card">
                          <div className="nested-subtitle">{highlightText(label || `Program ${itemIdx + 1}`)}</div>
                          {renderEditableArrayItem(record, 'recoveryPrograms', item, idx, itemIdx, 'recovery', label || `Program ${itemIdx + 1}`, recoveryTitleMatches)}
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {/* 8. Harm Reduction Counseling */}
              {record.harmReductionCounseling && showHarmReduction && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Harm Reduction Counseling', `harm-${idx}`,
                      () => copyToClipboard(getHarmReductionText(pdfData[idx] || record), `harm-${idx}`), idx, 'harm')}

                    {/* Boolean/non-editable fields */}
                    {record.harmReductionCounseling.naloxoneProvided !== undefined && (harmTitleMatches || shouldShowRow('Naloxone Provided', 'naloxone', 'provided')) && (
                      <div className="rec-mini-card">
                        <div className="nested-subtitle">{highlightText('Naloxone Provided')}</div>
                        <div className="numbered-row">
                          <div className="row-content">
                            <span className="content-value">{highlightText(record.harmReductionCounseling.naloxoneProvided ? 'Yes' : 'No')}</span>
                          </div>
                          <button className={`copy-btn ${copiedId === `naloxone-provided-${idx}` ? 'copied' : ''}`}
                            onClick={() => copyToClipboard(record.harmReductionCounseling.naloxoneProvided ? 'Yes' : 'No', `naloxone-provided-${idx}`)}>
                            {copiedId === `naloxone-provided-${idx}` ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    )}

                    {record.harmReductionCounseling.naloxoneKits && (harmTitleMatches || shouldShowRow('Naloxone Kits', String(record.harmReductionCounseling.naloxoneKits))) && (
                      <div className="rec-mini-card">
                        <div className="nested-subtitle">{highlightText('Naloxone Kits')}</div>
                        <div className="numbered-row">
                          <div className="row-content">
                            <span className="content-value">{highlightText(String(record.harmReductionCounseling.naloxoneKits))}</span>
                          </div>
                          <button className={`copy-btn ${copiedId === `naloxone-kits-${idx}` ? 'copied' : ''}`}
                            onClick={() => copyToClipboard(String(record.harmReductionCounseling.naloxoneKits), `naloxone-kits-${idx}`)}>
                            {copiedId === `naloxone-kits-${idx}` ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    )}

                    {record.harmReductionCounseling.syringeServicesReferral !== undefined && (harmTitleMatches || shouldShowRow('Syringe Services Referral', 'syringe', 'referral')) && (
                      <div className="rec-mini-card">
                        <div className="nested-subtitle">{highlightText('Syringe Services Referral')}</div>
                        <div className="numbered-row">
                          <div className="row-content">
                            <span className="content-value">{highlightText(record.harmReductionCounseling.syringeServicesReferral ? 'Yes' : 'No')}</span>
                          </div>
                          <button className={`copy-btn ${copiedId === `syringe-${idx}` ? 'copied' : ''}`}
                            onClick={() => copyToClipboard(record.harmReductionCounseling.syringeServicesReferral ? 'Yes' : 'No', `syringe-${idx}`)}>
                            {copiedId === `syringe-${idx}` ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* String fields from actual data — editable */}
                    {[
                      ['naloxoneTraining', 'Naloxone Training'],
                      ['fentanylEducation', 'Fentanyl Education'],
                      ['saferUseEducation', 'Safer Use Education'],
                      ['needleExchange', 'Needle Exchange'],
                    ].map(([key, label]) => renderSemiSplitField('harmReductionCounseling', key, label, 'harm', harmTitleMatches, splitSemiComma)).filter(Boolean)}

                    {/* Safe Use Counseling array */}
                    {record.harmReductionCounseling.safeUseCounseling?.length > 0 && (
                      <div className="rec-mini-card">
                        <div className="section-header subsection-header">
                          <div className="nested-subtitle">{highlightText('Safe Use Counseling')}</div>
                          <button className={`copy-btn ${copiedId === `safeuse-${idx}` ? 'copied' : ''}`}
                            onClick={() => {
                              const lines = ['SAFE USE COUNSELING', '═'.repeat(40)];
                              record.harmReductionCounseling.safeUseCounseling.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
                              copyToClipboard(lines.join('\n'), `safeuse-${idx}`);
                            }}>
                            {copiedId === `safeuse-${idx}` ? 'Copied!' : 'Copy Section'}
                          </button>
                        </div>
                        {record.harmReductionCounseling.safeUseCounseling.map((item, itemIdx) =>
                          renderEditableArrayItem(record, 'harmReductionCounseling.safeUseCounseling', item, idx, itemIdx, 'harm', 'Safe Use Counseling', harmTitleMatches || sectionTitleMatches('Safe Use Counseling'))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 9. Psychiatric Comorbidities */}
              {record.psychiatricComorbidities?.length > 0 && showPsych && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Psychiatric Comorbidities', `psych-${idx}`,
                      () => copyToClipboard(getPsychComorbText(pdfData[idx] || record), `psych-${idx}`), idx, 'psych')}
                    {record.psychiatricComorbidities.map((item, itemIdx) =>
                      renderEditableArrayItem(record, 'psychiatricComorbidities', item, idx, itemIdx, 'psych', `Comorbidity ${itemIdx + 1}`, psychTitleMatches)
                    )}
                  </div>
                </div>
              )}

              {/* 10. Social Determinants */}
              {record.socialDeterminants && showSocial && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Social Determinants', `social-${idx}`,
                      () => copyToClipboard(getSocialDeterminantsText(pdfData[idx] || record), `social-${idx}`), idx, 'social')}

                    {[
                      ['housing', 'Housing'],
                      ['employment', 'Employment'],
                      ['income', 'Income'],
                      ['familySupport', 'Family Support'],
                      ['legalIssues', 'Legal Issues'],
                      ['legalHistory', 'Legal History'],
                    ].map(([key, label]) => renderSemiSplitField('socialDeterminants', key, label, 'social', socialTitleMatches, splitSemiComma)).filter(Boolean)}
                  </div>
                </div>
              )}

              {/* 11. Treatment Plan */}
              {record.treatmentPlan && showTreatment && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Treatment Plan', `treatment-${idx}`,
                      () => copyToClipboard(getTreatmentPlanText(pdfData[idx] || record), `treatment-${idx}`), idx, 'treatment')}

                    {renderNestedFields('treatmentPlan', [
                      ['levelOfCare', 'Level of Care'],
                      ['backupPlan', 'Backup Plan'],
                      ['phase1', 'Phase 1'],
                      ['phase2', 'Phase 2'],
                      ['phase3', 'Phase 3'],
                      ['psychiatricTreatment', 'Psychiatric Treatment'],
                      ['counseling', 'Counseling'],
                    ], 'treatment', treatmentTitleMatches)}

                    {/* Components array */}
                    {record.treatmentPlan.components?.length > 0 && (
                      <div className="rec-mini-card">
                        <div className="section-header subsection-header">
                          <div className="nested-subtitle">{highlightText('Components')}</div>
                          <button className={`copy-btn ${copiedId === `components-${idx}` ? 'copied' : ''}`}
                            onClick={() => {
                              const lines = ['COMPONENTS', '═'.repeat(40)];
                              record.treatmentPlan.components.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
                              copyToClipboard(lines.join('\n'), `components-${idx}`);
                            }}>
                            {copiedId === `components-${idx}` ? 'Copied!' : 'Copy Section'}
                          </button>
                        </div>
                        {record.treatmentPlan.components.map((item, itemIdx) =>
                          renderEditableArrayItem(record, 'treatmentPlan.components', item, idx, itemIdx, 'treatment', 'Components', treatmentTitleMatches || sectionTitleMatches('Components'))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 12. Prognosis */}
              {record.prognosis && showPrognosis && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Prognosis', `prognosis-${idx}`,
                      () => copyToClipboard(getPrognosisText(pdfData[idx] || record), `prognosis-${idx}`), idx, 'prognosis')}

                    {renderNestedFields('prognosis', [
                      ['overall', 'Overall'],
                      ['withMAT', 'With MAT'],
                      ['withoutMAT', 'Without MAT'],
                    ], 'prognosis', prognosisTitleMatches)}

                    {renderNestedArrayItems('prognosis', 'favorableFactors', 'prognosis', prognosisTitleMatches, 'Favorable Factors')}
                    {renderNestedArrayItems('prognosis', 'unfavorableFactors', 'prognosis', prognosisTitleMatches, 'Unfavorable Factors')}
                    {renderNestedArrayItems('prognosis', 'criticalInflectionPoints', 'prognosis', prognosisTitleMatches, 'Critical Inflection Points')}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AddictionMedicineConsultationsDocument;
