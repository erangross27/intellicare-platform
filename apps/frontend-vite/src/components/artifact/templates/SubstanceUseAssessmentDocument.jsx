/**
 * SubstanceUseAssessmentDocument.jsx
 * December 2025 Standard Template
 *
 * Features:
 * - Own useState for searchTerm (not prop)
 * - PDFDownloadLink import (not onExportPDF)
 * - 4-level search with IIFE sectionTitleMatches pattern
 * - 3-level nesting for currentUse, pastUse, treatmentHistory arrays
 * - parsePlanWithLabels for PHASE 1/2/3 patterns
 * - Blue theme: #0d1929, #93c5fd, rgba(96, 165, 250, 0.3)
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import SubstanceUseAssessmentDocumentPDFTemplate from '../pdf-templates/SubstanceUseAssessmentDocumentPDFTemplate';
import './SubstanceUseAssessmentDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'substance_use_assessmentPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

// Humanize a dynamic object key (e.g. "auditScore" -> "Audit Score")
const humanizeKey = (k) => k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();

// Flatten a dynamic-key object (results) one level deep -> { key, label, value } leaves. No [object Object].
const flattenObject = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const items = [];
  Object.entries(obj).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    const label = humanizeKey(key);
    if (typeof value === 'boolean') {
      items.push({ key, label, value: value ? 'Yes' : 'No' });
    } else if (Array.isArray(value)) {
      items.push({ key, label, value: value.map(v => (v && typeof v === 'object') ? Object.values(v).join(' ') : String(v)).join(', ') });
    } else if (typeof value === 'object') {
      Object.entries(value).forEach(([subKey, subValue]) => {
        if (subValue !== null && subValue !== undefined && subValue !== '') {
          items.push({ key: `${key}.${subKey}`, label: `${label} - ${humanizeKey(subKey)}`, value: (subValue && typeof subValue === 'object') ? Object.values(subValue).join(' ') : String(subValue) });
        }
      });
    } else {
      items.push({ key, label, value: String(value) });
    }
  });
  return items;
};

// recommendations object-array subfield order ({recommendation, date})
const RECOMMENDATION_SUBFIELDS = [
  { key: 'recommendation', label: 'Recommendation' },
  { key: 'date', label: 'Date' },
];

const SubstanceUseAssessmentDocument = ({ document, data }) => {
  const templateData = document || data;
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [copiedSectionId, setCopiedSectionId] = useState(null);

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

  // Unwrap data to handle nested document structures
  const unwrapData = (input) => {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input.flatMap(item => {
        if (item?.document) return Array.isArray(item.document) ? item.document : [item.document];
        if (item?.data) return Array.isArray(item.data) ? item.data : [item.data];
        return [item];
      });
    }
    if (input.document) return Array.isArray(input.document) ? input.document : [input.document];
    if (input.data) return Array.isArray(input.data) ? input.data : [input.data];
    return [input];
  };

  const unwrappedData = unwrapData(templateData);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  // Keyed off templateData so it runs once per data load (unwrapData runs each render).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const records = unwrapData(templateData);
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nStatus = {};
    records.forEach((record, idx) => {
      let recId = record && record._id;
      if (recId && typeof recId === 'object' && recId.$oid) recId = recId.$oid;
      const recDrafts = recId ? store[recId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // map the base field to its section so the Approve button reappears (yellow Pending)
        const sectionId = Object.keys(SECTION_FIELDS).find(sid => SECTION_FIELDS[sid].includes(baseField));
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
  }, [templateData]);

  // Format date helper
  const formatDate = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return dateVal;
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateVal;
    }
  };

  // Split by sentence helper
  const splitBySentence = (text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
  };

  // Parse plan with PHASE labels
  const parsePlanWithLabels = (text) => {
    if (!text || typeof text !== 'string') return [];
    const result = [];
    // Match PHASE patterns: PHASE 1:, PHASE 2:, etc.
    const phaseRegex = /(PHASE\s*\d+:?)/gi;
    const parts = text.split(phaseRegex).filter(p => p.trim());

    let currentLabel = null;
    for (const part of parts) {
      if (/PHASE\s*\d+:?/i.test(part)) {
        currentLabel = part.replace(/:$/, '').trim();
      } else if (currentLabel) {
        result.push({
          label: currentLabel,
          content: part.trim()
        });
        currentLabel = null;
      } else {
        // No label, add as standalone
        const sentences = splitBySentence(part);
        sentences.forEach(s => result.push({ label: null, content: s }));
      }
    }
    return result;
  };

  // Highlight search term helper
  const highlightText = useCallback((text) => {
    if (!text || !searchTerm.trim()) return text;
    const textStr = String(text);
    const phrase = searchTerm.trim();
    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedPhrase})`, 'gi');
    const parts = textStr.split(regex);
    const phraseLower = phrase.toLowerCase();

    return parts.map((part, i) =>
      part.toLowerCase() === phraseLower ? <mark key={i}>{part}</mark> : part
    );
  }, [searchTerm]);

  // Check if search term matches any of the provided strings
  const shouldShowRow = useCallback((record, ...searchableStrings) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;
    const searchLower = searchTerm.toLowerCase().trim();
    return searchableStrings.some(str =>
      str && String(str).toLowerCase().includes(searchLower)
    );
  }, [searchTerm]);

  // Check if section title matches search
  const sectionTitleMatchesSearch = useCallback((title, ...aliases) => {
    if (!searchTerm.trim()) return false;
    const searchLower = searchTerm.toLowerCase().trim();
    const allTitles = [title, ...aliases].filter(Boolean);
    return allTitles.some(t => t.toLowerCase().includes(searchLower));
  }, [searchTerm]);

  // Copy to clipboard helper
  const copyToClipboard = useCallback((text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  // Copy section to clipboard helper
  const copySectionToClipboard = useCallback((text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSectionId(id);
      setTimeout(() => setCopiedSectionId(null), 2000);
    });
  }, []);

  // ============== EDITING HELPERS ==============

  const getFieldValue = useCallback((record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    return record[fieldName];
  }, [localEdits]);

  const getArrayFieldValue = useCallback((record, fieldName, arrayIndex, idx) => {
    const editKey = `${fieldName}.${arrayIndex}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    const arr = record[fieldName];
    if (Array.isArray(arr) && arrayIndex < arr.length) return arr[arrayIndex];
    return undefined;
  }, [localEdits]);

  // NOTE: drafts are staged via the module-scope readDrafts/writeDrafts store (DRAFT_KEY), NOT
  // 'artifactGridData' — so a pending Save never leaks into the PDF/DB source before Approve.

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
  // `fieldName` may be a dot-path (e.g. "recommendations.0.recommendation", "results.someKey"); `arrayIndex`
  // (numeric) is supplied for plain array-element edits and appended as a trailing ".N" segment.
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, arrayIndex) => {
    let recId = record && record._id;
    if (!recId) return;
    if (typeof recId === 'object' && recId.$oid) recId = recId.$oid;
    const saveValue = editValue.trim();
    const fieldPart = (typeof arrayIndex === 'number') ? `${fieldName}.${arrayIndex}` : fieldName;
    const editKey = `${fieldPart}-${idx}`;
    const sKey = `${fieldName}-${idx}-s0`;

    setLocalEdits(prev => ({ ...prev, [editKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button returns to yellow Pending
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

  // Approve = COMMIT all staged drafts for this record to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApprove = useCallback(async (record, idx, sectionId) => {
    let recId = record && record._id;
    if (!recId) return;
    if (typeof recId === 'object' && recId.$oid) recId = recId.$oid;
    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now. Reverse handleSaveField's fieldPart:
      // a trailing ".N" (purely numeric last segment) is an arrayIndex; otherwise the dot-path is the field.
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or dot-path or "field.N"
        const lastDot = fieldPart.lastIndexOf('.');
        const lastSeg = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayIdx = lastDot !== -1 && /^\d+$/.test(lastSeg);
        const payload = { field: isArrayIdx ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArrayIdx) payload.arrayIndex = parseInt(lastSeg, 10);
        const response = await secureApiClient.put(`/api/edit/substance_use_assessment/${recId}/edit`, payload);
        if (!response || !response.success) throw new Error((response && response.error) || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/substance_use_assessment/${recId}/approve`);

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
      console.error('[SubstanceUseAssessment] Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // ============== SECTION_FIELDS + sectionHasEdits ==============
  const SECTION_FIELDS = {
    'record-info': ['provider'],
    'current-use': ['currentUse'],
    'past-use': ['pastUse'],
    'withdrawal': ['withdrawalSymptoms'],
    'treatment': ['treatmentHistory'],
    'findings': ['findings'],
    'assessment': ['assessment'],
    'plan': ['plan'],
    'notes': ['notes'],
    'recommendations': ['recommendations'],
    'results': ['results'],
    'status': ['status'],
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
    if (Object.keys(localEdits).length === 0) return unwrappedData;
    return unwrappedData.map((record, idx) => {
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
          } else if (dotParts.length === 2) {
            const [parent, child] = dotParts;
            const childNum = parseInt(child, 10);
            if (!isNaN(childNum) && Array.isArray(merged[parent])) {
              // array element (e.g. withdrawalSymptoms.0)
              merged[parent] = [...merged[parent]];
              merged[parent][childNum] = editVal;
            } else if (merged[parent] && typeof merged[parent] === 'object' && !Array.isArray(merged[parent])) {
              // dynamic-key object leaf (e.g. results.someKey)
              merged[parent] = { ...merged[parent], [child]: editVal };
            }
          } else if (dotParts.length === 3) {
            // object-array subfield (e.g. recommendations.0.recommendation)
            const [parent, idxStr, subKey] = dotParts;
            const arrIdx = parseInt(idxStr, 10);
            if (!isNaN(arrIdx) && Array.isArray(merged[parent]) && merged[parent][arrIdx] && typeof merged[parent][arrIdx] === 'object') {
              merged[parent] = [...merged[parent]];
              merged[parent][arrIdx] = { ...merged[parent][arrIdx], [subKey]: editVal };
            }
          }
        }
      }
      return merged;
    });
  }, [unwrappedData, localEdits, pendingEdits]);

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
        <div className={`numbered-row${isFieldEdited ? ' modified' : ''}`}>
          <div
            className={`row-content${canEdit ? ' editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue)}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isFieldEdited && editIndicator}
          </div>
          <button
            className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(displayValue, copyId)}
          >
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && <div className="modified-badge">edited -- click approve to save</div>}
      </div>
    );
  };

  // ============== RENDER EDITABLE ARRAY ITEM ==============
  const renderEditableArrayItem = (record, fieldName, item, idx, itemIdx, sectionId, copyId) => {
    const displayValue = getArrayFieldValue(record, fieldName, itemIdx, idx) || item;
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
            className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(displayValue, copyId)}
          >
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isItemEdited && <div className="modified-badge">edited -- click approve to save</div>}
      </React.Fragment>
    );
  };

  // ============== RENDER OBJECT-ARRAY FIELD (recommendations) ==============
  // Per-subfield editable rows. Each subfield saves via dot-path field.arrayIndex.subKey so the
  // {…} object slot is never overwritten by a flat string. Plain-string items get a slot-preserving row.
  const renderObjectArrayField = (record, fieldName, idx, sectionId) => {
    const liveArr = getFieldValue(record, fieldName, idx);
    const items = Array.isArray(liveArr) ? liveArr.filter(it => it !== null && it !== undefined && it !== '') : [];
    if (items.length === 0) return null;
    const knownKeys = RECOMMENDATION_SUBFIELDS.map(sf => sf.key);

    return (
      <div className="rec-mini-card" key={fieldName}>
        {items.map((item, itemIdx) => {
          // Plain-string item -> single editable row preserving the array slot (save via arrayIndex)
          if (typeof item !== 'object' || item === null) {
            return renderEditableArrayItem(record, fieldName, String(item), idx, itemIdx, sectionId, `rec-${idx}-${itemIdx}`);
          }
          // Object item -> per-subfield editable rows (unknown keys included so nothing is dropped)
          const extraDefs = Object.keys(item).filter(k => !knownKeys.includes(k)).map(k => ({ key: k, label: humanizeKey(k) }));
          const allDefs = [...RECOMMENDATION_SUBFIELDS, ...extraDefs];
          const visibleSubs = allDefs.filter(sf => {
            const dotKey = `${fieldName}.${itemIdx}.${sf.key}`;
            const editVal = localEdits[`${dotKey}-${idx}`];
            const sv = editVal !== undefined ? editVal : item[sf.key];
            return sv !== null && sv !== undefined && sv !== '';
          });
          if (visibleSubs.length === 0) return null;

          return (
            <div key={itemIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
              <div className="nested-subtitle">{highlightText(`Recommendation ${itemIdx + 1}`)}</div>
              {visibleSubs.map(sf => {
                const dotKey = `${fieldName}.${itemIdx}.${sf.key}`;
                const editVal = localEdits[`${dotKey}-${idx}`];
                const rawVal = editVal !== undefined ? editVal : item[sf.key];
                const sfDisplay = sf.key === 'date' ? formatDate(rawVal) : String(rawVal);
                const editKey = `${dotKey}-${idx}-s0`;
                const isEditing = editingField === editKey;
                const copyId = `rec-${idx}-${itemIdx}-${sf.key}`;
                if (isEditing) {
                  return (
                    <div key={sf.key} className="rec-mini-card" style={{ marginTop: 8 }}>
                      <div className="nested-subtitle">{highlightText(sf.label)}</div>
                      <div className="numbered-row edit-row">
                        <div className="edit-field-container">
                          <textarea
                            ref={textareaRef}
                            className="edit-textarea"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') handleCancelEdit();
                              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveField(record, dotKey, idx, sectionId);
                            }}
                            rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))}
                            disabled={saving}
                          />
                          <div className="edit-actions">
                            <button className="edit-save-btn" onClick={() => handleSaveField(record, dotKey, idx, sectionId)} disabled={saving}>
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
                  <div key={sf.key} className="rec-mini-card" style={{ marginTop: 8 }}>
                    <div className="nested-subtitle">{highlightText(sf.label)}</div>
                    <div className="numbered-row">
                      <div
                        className={`row-content${record._id ? ' editable' : ''}`}
                        onClick={() => record._id && handleStartEdit(dotKey, idx, sf.key === 'date' ? String(rawVal) : sfDisplay)}
                        title={record._id ? 'Click to edit' : undefined}
                      >
                        <span className="content-value">{highlightText(sfDisplay)}</span>
                        {record._id && editIndicator}
                      </div>
                      <button
                        className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
                        onClick={() => copyToClipboard(`${sf.label}: ${sfDisplay}`, copyId)}
                      >
                        {copiedId === copyId ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // ============== RENDER DYNAMIC-KEY OBJECT FIELD (results) ==============
  // Humanized keys + typed leaves; each leaf saves via dot-path field.subKey (object shape preserved).
  const renderDynamicObjectField = (record, fieldName, idx, sectionId) => {
    const val = getFieldValue(record, fieldName, idx);
    if (!val || typeof val !== 'object' || Array.isArray(val)) return null;
    const flatItems = flattenObject(val);
    if (flatItems.length === 0) return null;

    return (
      <div className="rec-mini-card" key={fieldName}>
        {flatItems.map((item) => {
          const dotKey = `${fieldName}.${item.key}`;
          const editKey = `${dotKey}-${idx}-s0`;
          const isEditing = editingField === editKey;
          const copyId = `results-${idx}-${item.key}`;
          if (isEditing) {
            return (
              <div key={item.key} className="rec-mini-card" style={{ marginTop: 8 }}>
                <div className="nested-subtitle">{highlightText(item.label)}</div>
                <div className="numbered-row edit-row">
                  <div className="edit-field-container">
                    <textarea
                      ref={textareaRef}
                      className="edit-textarea"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') handleCancelEdit();
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveField(record, dotKey, idx, sectionId);
                      }}
                      rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))}
                      disabled={saving}
                    />
                    <div className="edit-actions">
                      <button className="edit-save-btn" onClick={() => handleSaveField(record, dotKey, idx, sectionId)} disabled={saving}>
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
            <div key={item.key} className="rec-mini-card" style={{ marginTop: 8 }}>
              <div className="nested-subtitle">{highlightText(item.label)}</div>
              <div className="numbered-row">
                <div
                  className={`row-content${record._id ? ' editable' : ''}`}
                  onClick={() => record._id && handleStartEdit(dotKey, idx, item.value)}
                  title={record._id ? 'Click to edit' : undefined}
                >
                  <span className="content-value">{highlightText(item.value)}</span>
                  {record._id && editIndicator}
                </div>
                <button
                  className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
                  onClick={() => copyToClipboard(`${item.label}: ${item.value}`, copyId)}
                >
                  {copiedId === copyId ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ============== SECTION HEADER WITH APPROVE ==============
  const renderSectionHeader = (title, copyId, copyFn, idx, sectionId) => (
    <div className="section-header">
      <h3 className="section-title">{highlightText(title)}</h3>
      <div className="header-right-actions">
        <button
          className={`copy-btn ${copiedSectionId === copyId ? 'copied' : ''}`}
          onClick={copyFn}
        >
          {copiedSectionId === copyId ? 'Copied!' : 'Copy Section'}
        </button>
        {(sectionHasEdits(sectionId) || approvedSections[sectionId]) && (
          <button
            className={`approve-btn${approvedSections[sectionId] ? ' approved' : ''}`}
            onClick={() => handleApprove(unwrappedData[idx], idx, sectionId)}
            disabled={approving}
          >
            {approving ? 'Approving...' : approvedSections[sectionId] ? 'Approved' : 'Approve'}
          </button>
        )}
      </div>
    </div>
  );

  // Get all record text for Copy All
  const getAllRecordText = (record, idx) => {
    const lines = [];
    lines.push(`SUBSTANCE USE ASSESSMENT ${idx + 1}`);
    lines.push('═══════════════════════════════════════');

    // Record Info
    if (record.date || record.provider || record.facility) {
      lines.push('\nRECORD INFORMATION');
      lines.push('───────────────────────────────────────');
      if (record.date) lines.push(`Date: ${formatDate(record.date)}`);
      if (record.provider) lines.push(`Provider: ${record.provider}`);
      if (record.facility) lines.push(`Facility: ${record.facility}`);
    }

    // Current Use
    if (record.currentUse?.length > 0) {
      lines.push('\nCURRENT SUBSTANCE USE');
      lines.push('───────────────────────────────────────');
      record.currentUse.forEach((item, i) => {
        lines.push(`\n${i + 1}. ${item.substance || 'Unknown Substance'}`);
        if (item.frequency) lines.push(`   Frequency: ${item.frequency}`);
        if (item.amount) lines.push(`   Amount: ${item.amount}`);
        if (item.lastUse) lines.push(`   Last Use: ${item.lastUse}`);
        if (item.route) lines.push(`   Route: ${item.route}`);
      });
    }

    // Past Use
    if (record.pastUse?.length > 0) {
      lines.push('\nPAST SUBSTANCE USE');
      lines.push('───────────────────────────────────────');
      record.pastUse.forEach((item, i) => {
        lines.push(`\n${i + 1}. ${item.substance || 'Unknown Substance'}`);
        if (item.ageStarted) lines.push(`   Age Started: ${item.ageStarted}`);
        if (item.duration) lines.push(`   Duration: ${item.duration}`);
      });
    }

    // Withdrawal Symptoms
    if (record.withdrawalSymptoms?.length > 0) {
      lines.push('\nWITHDRAWAL SYMPTOMS');
      lines.push('───────────────────────────────────────');
      record.withdrawalSymptoms.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }

    // Treatment History
    if (record.treatmentHistory?.length > 0) {
      lines.push('\nTREATMENT HISTORY');
      lines.push('───────────────────────────────────────');
      record.treatmentHistory.forEach((item, i) => {
        lines.push(`\n${i + 1}. ${item.type || 'Treatment'}`);
        if (item.facility) lines.push(`   Facility: ${item.facility}`);
        if (item.dates) lines.push(`   Dates: ${item.dates}`);
        if (item.outcome) lines.push(`   Outcome: ${item.outcome}`);
      });
    }

    // Screening
    if (record.duidHistory !== undefined || record.cageScore !== undefined) {
      lines.push('\nSCREENING');
      lines.push('───────────────────────────────────────');
      if (record.duidHistory !== undefined) lines.push(`DUID History: ${record.duidHistory ? 'Yes' : 'No'}`);
      if (record.cageScore !== undefined) lines.push(`CAGE Score: ${record.cageScore}`);
    }

    // Findings
    if (record.findings) {
      lines.push('\nFINDINGS');
      lines.push('───────────────────────────────────────');
      splitBySentence(record.findings).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }

    // Assessment
    if (record.assessment) {
      lines.push('\nASSESSMENT');
      lines.push('───────────────────────────────────────');
      splitBySentence(record.assessment).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }

    // Plan
    if (record.plan) {
      lines.push('\nPLAN');
      lines.push('───────────────────────────────────────');
      const planItems = parsePlanWithLabels(record.plan);
      planItems.forEach((item, i) => {
        if (item.label) {
          lines.push(`\n${item.label}:`);
          lines.push(`   ${item.content}`);
        } else {
          lines.push(`${i + 1}. ${item.content}`);
        }
      });
    }

    // Notes
    if (record.notes) {
      lines.push('\nNOTES');
      lines.push('───────────────────────────────────────');
      splitBySentence(record.notes).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }

    // Recommendations
    if (Array.isArray(record.recommendations) && record.recommendations.length > 0) {
      lines.push('\nRECOMMENDATIONS');
      lines.push('───────────────────────────────────────');
      record.recommendations.forEach((item, i) => {
        if (item && typeof item === 'object') {
          const parts = [];
          if (item.recommendation) parts.push(item.recommendation);
          if (item.date) parts.push(`(${formatDate(item.date)})`);
          Object.keys(item).filter(k => k !== 'recommendation' && k !== 'date').forEach(k => { if (item[k]) parts.push(`${humanizeKey(k)}: ${item[k]}`); });
          lines.push(`${i + 1}. ${parts.join(' ')}`);
        } else {
          lines.push(`${i + 1}. ${item}`);
        }
      });
    }

    // Results
    if (record.results && typeof record.results === 'object' && !Array.isArray(record.results) && Object.keys(record.results).length > 0) {
      lines.push('\nRESULTS');
      lines.push('───────────────────────────────────────');
      flattenObject(record.results).forEach(it => lines.push(`${it.label}: ${it.value}`));
    }

    // Status
    if (record.status) {
      lines.push('\nSTATUS');
      lines.push('───────────────────────────────────────');
      lines.push(String(record.status));
    }

    return lines.join('\n');
  };

  // Filter records based on search
  const isSearching = searchTerm.trim().length > 0;

  const filteredRecords = unwrappedData.map((record, idx) => {
    if (!isSearching) return { ...record, _show: true, _showAllSections: false };

    // Build searchable text for Level 1 (record-level gate)
    const searchableText = [
      // Record title
      `Substance Use Assessment ${idx + 1}`, `substance use assessment ${idx + 1}`,

      // Section titles (ALL must be here for Level 1 gate!)
      'Record Information', 'record information', 'RECORD INFORMATION',
      'Current Substance Use', 'current substance use', 'CURRENT SUBSTANCE USE',
      'Current Use', 'current use', 'CURRENT USE',
      'Past Substance Use', 'past substance use', 'PAST SUBSTANCE USE',
      'Past Use', 'past use', 'PAST USE',
      'Withdrawal Symptoms', 'withdrawal symptoms', 'WITHDRAWAL SYMPTOMS',
      'Treatment History', 'treatment history', 'TREATMENT HISTORY',
      'Screening', 'screening', 'SCREENING',
      'Findings', 'findings', 'FINDINGS',
      'Assessment', 'assessment', 'ASSESSMENT',
      'Plan', 'plan', 'PLAN',
      'Notes', 'notes', 'NOTES',
      'Recommendations', 'recommendations', 'RECOMMENDATIONS',
      'Results', 'results', 'RESULTS',
      'Status', 'status', 'STATUS',

      // Field labels
      'Date', 'date', 'Provider', 'provider', 'Facility', 'facility',
      'Substance', 'substance', 'Frequency', 'frequency', 'Amount', 'amount',
      'Last Use', 'last use', 'Route', 'route',
      'Age Started', 'age started', 'Duration', 'duration',
      'Type', 'type', 'Dates', 'dates', 'Outcome', 'outcome',
      'DUID History', 'duid history', 'CAGE Score', 'cage score',
      'PHASE 1', 'PHASE 2', 'PHASE 3', 'phase 1', 'phase 2', 'phase 3',

      // Field values
      record.date, record.provider, record.facility,
      record.findings, record.assessment, record.plan, record.notes, record.status,
      record.duidHistory !== undefined ? (record.duidHistory ? 'Yes' : 'No') : null,
      record.cageScore !== undefined ? String(record.cageScore) : null,

      // Recommendations values (object-array {recommendation, date} or strings)
      ...(record.recommendations || []).flatMap(item =>
        (item && typeof item === 'object') ? Object.values(item).map(String) : [String(item)]
      ),

      // Results values (dynamic-key object)
      ...flattenObject(record.results).flatMap(it => [it.label, it.value]),

      // Current use values
      ...(record.currentUse || []).flatMap(item => [
        item.substance, item.frequency, item.amount, item.lastUse, item.route
      ]),

      // Past use values
      ...(record.pastUse || []).flatMap(item => [
        item.substance, item.ageStarted, item.duration
      ]),

      // Withdrawal symptoms
      ...(record.withdrawalSymptoms || []),

      // Treatment history values
      ...(record.treatmentHistory || []).flatMap(item => [
        item.type, item.facility, item.dates, item.outcome
      ])
    ].filter(Boolean).join(' ').toLowerCase();

    const searchLower = searchTerm.toLowerCase().trim();
    const matchesLevel1 = searchableText.includes(searchLower);

    if (!matchesLevel1) return { ...record, _show: false };

    // _showAllSections = true ONLY when searching for document title
    // e.g., "Substance Use Assessment 1" or "substance use assessment"
    const docTitle = `substance use assessment ${idx + 1}`;
    const _showAllSections = searchLower === docTitle ||
      /^substance\s+use\s+assessment\s*\d*$/i.test(searchTerm.trim());

    return { ...record, _show: true, _showAllSections };
  }).filter(r => r._show);

  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <div className="substance-use-assessment-document">
        <div className="document-header">
          <h1 className="document-title">Substance Use Assessment</h1>
        </div>
        <div className="empty-state">No substance use assessment records available</div>
      </div>
    );
  }

  return (
    <div className="substance-use-assessment-document">
      {/* Header Row 1: Title */}
      <div className="document-header">
        <h1 className="document-title">Substance Use Assessment</h1>

        {/* Header Row 2: Actions */}
        <div className="header-actions">
          <button
            className={`copy-btn ${copiedId === 'all-documents' ? 'copied' : ''}`}
            onClick={() => {
              const allText = pdfData.map((record, idx) => getAllRecordText(record, idx)).join('\n\n');
              copyToClipboard(allText, 'all-documents');
            }}
          >
            {copiedId === 'all-documents' ? 'Copied' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<SubstanceUseAssessmentDocumentPDFTemplate document={pdfData} />}
            fileName="substance-use-assessment.pdf"
            className="pdf-btn"
          >
            {({ loading }) => (loading ? 'Preparing...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>

        {/* Header Row 3: Search */}
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search substance use assessments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>
          )}
        </div>
      </div>

      {/* Records */}
      {filteredRecords.length === 0 ? (
        <div className="no-results">No results found for "{searchTerm}"</div>
      ) : (
        filteredRecords.map((recordWithFlag, idx) => {
          const record = recordWithFlag;

          // Section visibility using IIFE pattern
          const recordInfoSection = (() => {
            if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
            const sectionTitleMatch = sectionTitleMatchesSearch('Record Information', 'record info');
            if (sectionTitleMatch) return { show: true, bypassL4: true };
            const hasMatchingContent = shouldShowRow(recordWithFlag,
              'Date', 'date', 'Provider', 'provider', 'Facility', 'facility',
              record.date, record.provider, record.facility
            );
            return { show: hasMatchingContent, bypassL4: false };
          })();

          const currentUseSection = (() => {
            if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
            const sectionTitleMatch = sectionTitleMatchesSearch('Current Substance Use', 'current use');
            if (sectionTitleMatch) return { show: true, bypassL4: true };
            const hasMatchingContent = (record.currentUse || []).some(item =>
              shouldShowRow(recordWithFlag,
                'Substance', 'substance', 'Frequency', 'frequency', 'Amount', 'amount',
                'Last Use', 'last use', 'Route', 'route',
                item.substance, item.frequency, item.amount, item.lastUse, item.route
              )
            );
            return { show: hasMatchingContent, bypassL4: false };
          })();

          const pastUseSection = (() => {
            if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
            const sectionTitleMatch = sectionTitleMatchesSearch('Past Substance Use', 'past use');
            if (sectionTitleMatch) return { show: true, bypassL4: true };
            const hasMatchingContent = (record.pastUse || []).some(item =>
              shouldShowRow(recordWithFlag,
                'Substance', 'substance', 'Age Started', 'age started', 'Duration', 'duration',
                item.substance, item.ageStarted, item.duration
              )
            );
            return { show: hasMatchingContent, bypassL4: false };
          })();

          const withdrawalSection = (() => {
            if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
            const sectionTitleMatch = sectionTitleMatchesSearch('Withdrawal Symptoms', 'withdrawal');
            if (sectionTitleMatch) return { show: true, bypassL4: true };
            const hasMatchingContent = (record.withdrawalSymptoms || []).some(s =>
              shouldShowRow(recordWithFlag, s)
            );
            return { show: hasMatchingContent, bypassL4: false };
          })();

          const treatmentHistorySection = (() => {
            if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
            const sectionTitleMatch = sectionTitleMatchesSearch('Treatment History', 'treatment');
            if (sectionTitleMatch) return { show: true, bypassL4: true };
            const hasMatchingContent = (record.treatmentHistory || []).some(item =>
              shouldShowRow(recordWithFlag,
                'Type', 'type', 'Facility', 'facility', 'Dates', 'dates', 'Outcome', 'outcome',
                item.type, item.facility, item.dates, item.outcome
              )
            );
            return { show: hasMatchingContent, bypassL4: false };
          })();

          const screeningSection = (() => {
            if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
            const sectionTitleMatch = sectionTitleMatchesSearch('Screening', 'screen');
            if (sectionTitleMatch) return { show: true, bypassL4: true };
            const hasMatchingContent = shouldShowRow(recordWithFlag,
              'DUID History', 'duid history', 'DUID', 'duid',
              'CAGE Score', 'cage score', 'CAGE', 'cage',
              record.duidHistory !== undefined ? (record.duidHistory ? 'Yes' : 'No') : null,
              record.cageScore !== undefined ? String(record.cageScore) : null
            );
            return { show: hasMatchingContent, bypassL4: false };
          })();

          const findingsSection = (() => {
            if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
            const sectionTitleMatch = sectionTitleMatchesSearch('Findings', 'finding');
            if (sectionTitleMatch) return { show: true, bypassL4: true };
            const hasMatchingContent = shouldShowRow(recordWithFlag, record.findings);
            return { show: hasMatchingContent, bypassL4: false };
          })();

          const assessmentSection = (() => {
            if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
            const sectionTitleMatch = sectionTitleMatchesSearch('Assessment', 'assess');
            if (sectionTitleMatch) return { show: true, bypassL4: true };
            const hasMatchingContent = shouldShowRow(recordWithFlag, record.assessment);
            return { show: hasMatchingContent, bypassL4: false };
          })();

          const planSection = (() => {
            if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
            const sectionTitleMatch = sectionTitleMatchesSearch('Plan');
            if (sectionTitleMatch) return { show: true, bypassL4: true };
            const hasMatchingContent = shouldShowRow(recordWithFlag,
              'PHASE 1', 'PHASE 2', 'PHASE 3', 'phase 1', 'phase 2', 'phase 3',
              record.plan
            );
            return { show: hasMatchingContent, bypassL4: false };
          })();

          const notesSection = (() => {
            if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
            const sectionTitleMatch = sectionTitleMatchesSearch('Notes', 'note');
            if (sectionTitleMatch) return { show: true, bypassL4: true };
            const hasMatchingContent = shouldShowRow(recordWithFlag, record.notes);
            return { show: hasMatchingContent, bypassL4: false };
          })();

          const recommendationsSection = (() => {
            if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
            const sectionTitleMatch = sectionTitleMatchesSearch('Recommendations', 'recommendation');
            if (sectionTitleMatch) return { show: true, bypassL4: true };
            const recStrings = (record.recommendations || []).flatMap(item =>
              (item && typeof item === 'object') ? Object.values(item).map(String) : [String(item)]
            );
            const hasMatchingContent = shouldShowRow(recordWithFlag, ...recStrings);
            return { show: hasMatchingContent, bypassL4: false };
          })();

          const resultsSection = (() => {
            if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
            const sectionTitleMatch = sectionTitleMatchesSearch('Results', 'result');
            if (sectionTitleMatch) return { show: true, bypassL4: true };
            const resStrings = flattenObject(record.results).flatMap(it => [it.label, it.value]);
            const hasMatchingContent = shouldShowRow(recordWithFlag, ...resStrings);
            return { show: hasMatchingContent, bypassL4: false };
          })();

          const statusSection = (() => {
            if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
            const sectionTitleMatch = sectionTitleMatchesSearch('Status');
            if (sectionTitleMatch) return { show: true, bypassL4: true };
            const hasMatchingContent = shouldShowRow(recordWithFlag, record.status);
            return { show: hasMatchingContent, bypassL4: false };
          })();

          return (
            <div key={idx} className="record-card">
              {/* Record Header */}
              <div className="record-header">
                <div className="header-top-row">
                  {record.date && (
                    <span className="date-badge">{formatDate(record.date)}</span>
                  )}
                </div>
                <h2 className="record-title">{highlightText(`Substance Use Assessment ${idx + 1}`)}</h2>
              </div>

              {/* Record Information Section */}
              {recordInfoSection.show && (record.date || record.provider || record.facility) && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Record Information', `record-info-${idx}`, () => {
                      const lines = ['RECORD INFORMATION', '═══════════════════════════════════════'];
                      const r = pdfData[idx] || record;
                      if (r.date) lines.push(`Date: ${formatDate(r.date)}`);
                      if (r.provider) lines.push(`Provider: ${r.provider}`);
                      if (r.facility) lines.push(`Facility: ${r.facility}`);
                      copySectionToClipboard(lines.join('\n'), `record-info-${idx}`);
                    }, idx, 'record-info')}

                    {record.date && (recordInfoSection.bypassL4 || shouldShowRow(recordWithFlag, 'Date', 'date', record.date)) && (
                      <div className="rec-mini-card">
                        <div className="nested-subtitle">{highlightText('Date')}</div>
                        <div className="numbered-row">
                          <div className="row-content">
                            <span className="content-value">{highlightText(formatDate(record.date))}</span>
                          </div>
                          <button
                            className={`copy-btn ${copiedId === `date-${idx}` ? 'copied' : ''}`}
                            onClick={() => copyToClipboard(formatDate(record.date), `date-${idx}`)}
                          >
                            {copiedId === `date-${idx}` ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Provider — editable */}
                    {(recordInfoSection.bypassL4 || shouldShowRow(recordWithFlag, 'Provider', 'provider', record.provider)) &&
                      renderEditableField(record, 'provider', 'Provider', idx, 'record-info', `provider-${idx}`)
                    }

                    {record.facility && (recordInfoSection.bypassL4 || shouldShowRow(recordWithFlag, 'Facility', 'facility', record.facility)) && (
                      <div className="rec-mini-card">
                        <div className="nested-subtitle">{highlightText('Facility')}</div>
                        <div className="numbered-row">
                          <div className="row-content">
                            <span className="content-value">{highlightText(record.facility)}</span>
                          </div>
                          <button
                            className={`copy-btn ${copiedId === `facility-${idx}` ? 'copied' : ''}`}
                            onClick={() => copyToClipboard(record.facility, `facility-${idx}`)}
                          >
                            {copiedId === `facility-${idx}` ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Current Substance Use Section - 3-level nesting, editable */}
              {currentUseSection.show && record.currentUse?.length > 0 && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Current Substance Use', `current-use-${idx}`, () => {
                      const lines = ['CURRENT SUBSTANCE USE', '═══════════════════════════════════════'];
                      const r = pdfData[idx] || record;
                      (r.currentUse || []).forEach((item, i) => {
                        lines.push(`\n${i + 1}. ${item.substance || 'Unknown Substance'}`);
                        if (item.frequency) lines.push(`   Frequency: ${item.frequency}`);
                        if (item.amount) lines.push(`   Amount: ${item.amount}`);
                        if (item.lastUse) lines.push(`   Last Use: ${item.lastUse}`);
                        if (item.route) lines.push(`   Route: ${item.route}`);
                      });
                      copySectionToClipboard(lines.join('\n'), `current-use-${idx}`);
                    }, idx, 'current-use')}

                    {record.currentUse.map((item, itemIdx) => {
                      // Check if this specific item should show
                      const itemMatches = currentUseSection.bypassL4 || shouldShowRow(recordWithFlag,
                        'Substance', 'substance', 'Frequency', 'frequency', 'Amount', 'amount',
                        'Last Use', 'last use', 'Route', 'route',
                        item.substance, item.frequency, item.amount, item.lastUse, item.route
                      );

                      if (!itemMatches) return null;

                      // If substance name matches, show all sub-fields
                      const substanceMatches = shouldShowRow(recordWithFlag, item.substance);
                      const showAllSubFields = currentUseSection.bypassL4 || substanceMatches;

                      return (
                        <div key={itemIdx} className="rec-mini-card">
                          <div className="subsection-header">
                            <div className="nested-subtitle">{highlightText(item.substance || `Substance ${itemIdx + 1}`)}</div>
                            <button
                              className={`copy-btn ${copiedSectionId === `current-${idx}-${itemIdx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const lines = [item.substance || `Substance ${itemIdx + 1}`];
                                if (item.frequency) lines.push(`Frequency: ${item.frequency}`);
                                if (item.amount) lines.push(`Amount: ${item.amount}`);
                                if (item.lastUse) lines.push(`Last Use: ${item.lastUse}`);
                                if (item.route) lines.push(`Route: ${item.route}`);
                                copySectionToClipboard(lines.join('\n'), `current-${idx}-${itemIdx}`);
                              }}
                            >
                              {copiedSectionId === `current-${idx}-${itemIdx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                          </div>

                          {item.frequency && (showAllSubFields || shouldShowRow(recordWithFlag, 'Frequency', 'frequency', item.frequency)) && (
                            <div className="nested-field-card">
                              <div className="field-label">{highlightText('Frequency')}</div>
                              <div className="numbered-row">
                                <div className="row-content">
                                  <span className="content-value">{highlightText(item.frequency)}</span>
                                </div>
                                <button
                                  className={`copy-btn ${copiedId === `freq-${idx}-${itemIdx}` ? 'copied' : ''}`}
                                  onClick={() => copyToClipboard(item.frequency, `freq-${idx}-${itemIdx}`)}
                                >
                                  {copiedId === `freq-${idx}-${itemIdx}` ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                            </div>
                          )}

                          {item.amount && (showAllSubFields || shouldShowRow(recordWithFlag, 'Amount', 'amount', item.amount)) && (
                            <div className="nested-field-card">
                              <div className="field-label">{highlightText('Amount')}</div>
                              <div className="numbered-row">
                                <div className="row-content">
                                  <span className="content-value">{highlightText(item.amount)}</span>
                                </div>
                                <button
                                  className={`copy-btn ${copiedId === `amount-${idx}-${itemIdx}` ? 'copied' : ''}`}
                                  onClick={() => copyToClipboard(item.amount, `amount-${idx}-${itemIdx}`)}
                                >
                                  {copiedId === `amount-${idx}-${itemIdx}` ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                            </div>
                          )}

                          {item.lastUse && (showAllSubFields || shouldShowRow(recordWithFlag, 'Last Use', 'last use', item.lastUse)) && (
                            <div className="nested-field-card">
                              <div className="field-label">{highlightText('Last Use')}</div>
                              <div className="numbered-row">
                                <div className="row-content">
                                  <span className="content-value">{highlightText(item.lastUse)}</span>
                                </div>
                                <button
                                  className={`copy-btn ${copiedId === `lastuse-${idx}-${itemIdx}` ? 'copied' : ''}`}
                                  onClick={() => copyToClipboard(item.lastUse, `lastuse-${idx}-${itemIdx}`)}
                                >
                                  {copiedId === `lastuse-${idx}-${itemIdx}` ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                            </div>
                          )}

                          {item.route && (showAllSubFields || shouldShowRow(recordWithFlag, 'Route', 'route', item.route)) && (
                            <div className="nested-field-card">
                              <div className="field-label">{highlightText('Route')}</div>
                              <div className="numbered-row">
                                <div className="row-content">
                                  <span className="content-value">{highlightText(item.route)}</span>
                                </div>
                                <button
                                  className={`copy-btn ${copiedId === `route-${idx}-${itemIdx}` ? 'copied' : ''}`}
                                  onClick={() => copyToClipboard(item.route, `route-${idx}-${itemIdx}`)}
                                >
                                  {copiedId === `route-${idx}-${itemIdx}` ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Past Substance Use Section - 3-level nesting, editable */}
              {pastUseSection.show && record.pastUse?.length > 0 && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Past Substance Use', `past-use-${idx}`, () => {
                      const lines = ['PAST SUBSTANCE USE', '═══════════════════════════════════════'];
                      const r = pdfData[idx] || record;
                      (r.pastUse || []).forEach((item, i) => {
                        lines.push(`\n${i + 1}. ${item.substance || 'Unknown Substance'}`);
                        if (item.ageStarted) lines.push(`   Age Started: ${item.ageStarted}`);
                        if (item.duration) lines.push(`   Duration: ${item.duration}`);
                      });
                      copySectionToClipboard(lines.join('\n'), `past-use-${idx}`);
                    }, idx, 'past-use')}

                    {record.pastUse.map((item, itemIdx) => {
                      const itemMatches = pastUseSection.bypassL4 || shouldShowRow(recordWithFlag,
                        'Substance', 'substance', 'Age Started', 'age started', 'Duration', 'duration',
                        item.substance, item.ageStarted, item.duration
                      );

                      if (!itemMatches) return null;

                      const substanceMatches = shouldShowRow(recordWithFlag, item.substance);
                      const showAllSubFields = pastUseSection.bypassL4 || substanceMatches;

                      return (
                        <div key={itemIdx} className="rec-mini-card">
                          <div className="subsection-header">
                            <div className="nested-subtitle">{highlightText(item.substance || `Substance ${itemIdx + 1}`)}</div>
                            <button
                              className={`copy-btn ${copiedSectionId === `past-${idx}-${itemIdx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const lines = [item.substance || `Substance ${itemIdx + 1}`];
                                if (item.ageStarted) lines.push(`Age Started: ${item.ageStarted}`);
                                if (item.duration) lines.push(`Duration: ${item.duration}`);
                                copySectionToClipboard(lines.join('\n'), `past-${idx}-${itemIdx}`);
                              }}
                            >
                              {copiedSectionId === `past-${idx}-${itemIdx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                          </div>

                          {item.ageStarted && (showAllSubFields || shouldShowRow(recordWithFlag, 'Age Started', 'age started', item.ageStarted)) && (
                            <div className="nested-field-card">
                              <div className="field-label">{highlightText('Age Started')}</div>
                              <div className="numbered-row">
                                <div className="row-content">
                                  <span className="content-value">{highlightText(item.ageStarted)}</span>
                                </div>
                                <button
                                  className={`copy-btn ${copiedId === `age-${idx}-${itemIdx}` ? 'copied' : ''}`}
                                  onClick={() => copyToClipboard(item.ageStarted, `age-${idx}-${itemIdx}`)}
                                >
                                  {copiedId === `age-${idx}-${itemIdx}` ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                            </div>
                          )}

                          {item.duration && (showAllSubFields || shouldShowRow(recordWithFlag, 'Duration', 'duration', item.duration)) && (
                            <div className="nested-field-card">
                              <div className="field-label">{highlightText('Duration')}</div>
                              <div className="numbered-row">
                                <div className="row-content">
                                  <span className="content-value">{highlightText(item.duration)}</span>
                                </div>
                                <button
                                  className={`copy-btn ${copiedId === `duration-${idx}-${itemIdx}` ? 'copied' : ''}`}
                                  onClick={() => copyToClipboard(item.duration, `duration-${idx}-${itemIdx}`)}
                                >
                                  {copiedId === `duration-${idx}-${itemIdx}` ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Withdrawal Symptoms Section — editable array */}
              {withdrawalSection.show && record.withdrawalSymptoms?.length > 0 && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Withdrawal Symptoms', `withdrawal-${idx}`, () => {
                      const lines = ['WITHDRAWAL SYMPTOMS', '═══════════════════════════════════════'];
                      const r = pdfData[idx] || record;
                      (r.withdrawalSymptoms || []).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
                      copySectionToClipboard(lines.join('\n'), `withdrawal-${idx}`);
                    }, idx, 'withdrawal')}

                    {record.withdrawalSymptoms.map((symptom, sIdx) => {
                      if (!withdrawalSection.bypassL4 && !shouldShowRow(recordWithFlag, symptom)) return null;
                      return renderEditableArrayItem(record, 'withdrawalSymptoms', symptom, idx, sIdx, 'withdrawal', `symptom-${idx}-${sIdx}`);
                    })}
                  </div>
                </div>
              )}

              {/* Treatment History Section - 3-level nesting, editable */}
              {treatmentHistorySection.show && record.treatmentHistory?.length > 0 && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Treatment History', `treatment-${idx}`, () => {
                      const lines = ['TREATMENT HISTORY', '═══════════════════════════════════════'];
                      const r = pdfData[idx] || record;
                      (r.treatmentHistory || []).forEach((item, i) => {
                        lines.push(`\n${i + 1}. ${item.type || 'Treatment'}`);
                        if (item.facility) lines.push(`   Facility: ${item.facility}`);
                        if (item.dates) lines.push(`   Dates: ${item.dates}`);
                        if (item.outcome) lines.push(`   Outcome: ${item.outcome}`);
                      });
                      copySectionToClipboard(lines.join('\n'), `treatment-${idx}`);
                    }, idx, 'treatment')}

                    {record.treatmentHistory.map((item, itemIdx) => {
                      const itemMatches = treatmentHistorySection.bypassL4 || shouldShowRow(recordWithFlag,
                        'Type', 'type', 'Facility', 'facility', 'Dates', 'dates', 'Outcome', 'outcome',
                        item.type, item.facility, item.dates, item.outcome
                      );

                      if (!itemMatches) return null;

                      const typeMatches = shouldShowRow(recordWithFlag, item.type);
                      const showAllSubFields = treatmentHistorySection.bypassL4 || typeMatches;

                      return (
                        <div key={itemIdx} className="rec-mini-card">
                          <div className="subsection-header">
                            <div className="nested-subtitle">{highlightText(item.type || `Treatment ${itemIdx + 1}`)}</div>
                            <button
                              className={`copy-btn ${copiedSectionId === `tx-${idx}-${itemIdx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const lines = [item.type || `Treatment ${itemIdx + 1}`];
                                if (item.facility) lines.push(`Facility: ${item.facility}`);
                                if (item.dates) lines.push(`Dates: ${item.dates}`);
                                if (item.outcome) lines.push(`Outcome: ${item.outcome}`);
                                copySectionToClipboard(lines.join('\n'), `tx-${idx}-${itemIdx}`);
                              }}
                            >
                              {copiedSectionId === `tx-${idx}-${itemIdx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                          </div>

                          {item.facility && (showAllSubFields || shouldShowRow(recordWithFlag, 'Facility', 'facility', item.facility)) && (
                            <div className="nested-field-card">
                              <div className="field-label">{highlightText('Facility')}</div>
                              <div className="numbered-row">
                                <div className="row-content">
                                  <span className="content-value">{highlightText(item.facility)}</span>
                                </div>
                                <button
                                  className={`copy-btn ${copiedId === `txfac-${idx}-${itemIdx}` ? 'copied' : ''}`}
                                  onClick={() => copyToClipboard(item.facility, `txfac-${idx}-${itemIdx}`)}
                                >
                                  {copiedId === `txfac-${idx}-${itemIdx}` ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                            </div>
                          )}

                          {item.dates && (showAllSubFields || shouldShowRow(recordWithFlag, 'Dates', 'dates', item.dates)) && (
                            <div className="nested-field-card">
                              <div className="field-label">{highlightText('Dates')}</div>
                              <div className="numbered-row">
                                <div className="row-content">
                                  <span className="content-value">{highlightText(item.dates)}</span>
                                </div>
                                <button
                                  className={`copy-btn ${copiedId === `txdates-${idx}-${itemIdx}` ? 'copied' : ''}`}
                                  onClick={() => copyToClipboard(item.dates, `txdates-${idx}-${itemIdx}`)}
                                >
                                  {copiedId === `txdates-${idx}-${itemIdx}` ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                            </div>
                          )}

                          {item.outcome && (showAllSubFields || shouldShowRow(recordWithFlag, 'Outcome', 'outcome', item.outcome)) && (
                            <div className="nested-field-card">
                              <div className="field-label">{highlightText('Outcome')}</div>
                              <div className="numbered-row">
                                <div className="row-content">
                                  <span className="content-value">{highlightText(item.outcome)}</span>
                                </div>
                                <button
                                  className={`copy-btn ${copiedId === `txout-${idx}-${itemIdx}` ? 'copied' : ''}`}
                                  onClick={() => copyToClipboard(item.outcome, `txout-${idx}-${itemIdx}`)}
                                >
                                  {copiedId === `txout-${idx}-${itemIdx}` ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Screening Section */}
              {screeningSection.show && (record.duidHistory !== undefined || record.cageScore !== undefined) && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h3 className="section-title">{highlightText('Screening')}</h3>
                      <button
                        className={`copy-btn ${copiedSectionId === `screening-${idx}` ? 'copied' : ''}`}
                        onClick={() => {
                          const lines = ['SCREENING', '═══════════════════════════════════════'];
                          if (record.duidHistory !== undefined) lines.push(`DUID History: ${record.duidHistory ? 'Yes' : 'No'}`);
                          if (record.cageScore !== undefined) lines.push(`CAGE Score: ${record.cageScore}`);
                          copySectionToClipboard(lines.join('\n'), `screening-${idx}`);
                        }}
                      >
                        {copiedSectionId === `screening-${idx}` ? 'Copied!' : 'Copy Section'}
                      </button>
                    </div>

                    {record.duidHistory !== undefined && (screeningSection.bypassL4 || shouldShowRow(recordWithFlag, 'DUID History', 'duid history', 'DUID', 'duid', record.duidHistory ? 'Yes' : 'No')) && (
                      <div className="rec-mini-card">
                        <div className="nested-subtitle">{highlightText('DUID History')}</div>
                        <div className="numbered-row">
                          <div className="row-content">
                            <span className={`status-badge ${record.duidHistory ? 'status-yes' : 'status-no'}`}>
                              {highlightText(record.duidHistory ? 'Yes' : 'No')}
                            </span>
                          </div>
                          <button
                            className={`copy-btn ${copiedId === `duid-${idx}` ? 'copied' : ''}`}
                            onClick={() => copyToClipboard(record.duidHistory ? 'Yes' : 'No', `duid-${idx}`)}
                          >
                            {copiedId === `duid-${idx}` ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    )}

                    {record.cageScore !== undefined && (screeningSection.bypassL4 || shouldShowRow(recordWithFlag, 'CAGE Score', 'cage score', 'CAGE', 'cage', String(record.cageScore))) && (
                      <div className="rec-mini-card">
                        <div className="nested-subtitle">{highlightText('CAGE Score')}</div>
                        <div className="numbered-row">
                          <div className="row-content">
                            <span className={`score-badge ${record.cageScore >= 2 ? 'score-high' : 'score-low'}`}>
                              {highlightText(String(record.cageScore))}
                            </span>
                          </div>
                          <button
                            className={`copy-btn ${copiedId === `cage-${idx}` ? 'copied' : ''}`}
                            onClick={() => copyToClipboard(String(record.cageScore), `cage-${idx}`)}
                          >
                            {copiedId === `cage-${idx}` ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Findings Section — editable */}
              {findingsSection.show && (record.findings || getFieldValue(record, 'findings', idx)) && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Findings', `findings-${idx}`, () => {
                      const lines = ['FINDINGS', '═══════════════════════════════════════'];
                      const r = pdfData[idx] || record;
                      splitBySentence(r.findings).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
                      copySectionToClipboard(lines.join('\n'), `findings-${idx}`);
                    }, idx, 'findings')}

                    {renderEditableField(record, 'findings', 'Findings', idx, 'findings', `finding-${idx}`)}
                  </div>
                </div>
              )}

              {/* Assessment Section — editable */}
              {assessmentSection.show && (record.assessment || getFieldValue(record, 'assessment', idx)) && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Assessment', `assessment-${idx}`, () => {
                      const lines = ['ASSESSMENT', '═══════════════════════════════════════'];
                      const r = pdfData[idx] || record;
                      splitBySentence(r.assessment).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
                      copySectionToClipboard(lines.join('\n'), `assessment-${idx}`);
                    }, idx, 'assessment')}

                    {renderEditableField(record, 'assessment', 'Assessment', idx, 'assessment', `assess-${idx}`)}
                  </div>
                </div>
              )}

              {/* Plan Section — editable */}
              {planSection.show && (record.plan || getFieldValue(record, 'plan', idx)) && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Plan', `plan-${idx}`, () => {
                      const lines = ['PLAN', '═══════════════════════════════════════'];
                      const r = pdfData[idx] || record;
                      const planItems = parsePlanWithLabels(r.plan);
                      planItems.forEach((item, i) => {
                        if (item.label) {
                          lines.push(`\n${item.label}:`);
                          lines.push(`   ${item.content}`);
                        } else {
                          lines.push(`${i + 1}. ${item.content}`);
                        }
                      });
                      copySectionToClipboard(lines.join('\n'), `plan-${idx}`);
                    }, idx, 'plan')}

                    {renderEditableField(record, 'plan', 'Plan', idx, 'plan', `plan-${idx}`)}
                  </div>
                </div>
              )}

              {/* Notes Section — editable */}
              {notesSection.show && (record.notes || getFieldValue(record, 'notes', idx)) && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Notes', `notes-${idx}`, () => {
                      const lines = ['NOTES', '═══════════════════════════════════════'];
                      const r = pdfData[idx] || record;
                      splitBySentence(r.notes).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
                      copySectionToClipboard(lines.join('\n'), `notes-${idx}`);
                    }, idx, 'notes')}

                    {renderEditableField(record, 'notes', 'Notes', idx, 'notes', `note-${idx}`)}
                  </div>
                </div>
              )}

              {/* Recommendations Section — object-array, per-subfield editable */}
              {recommendationsSection.show && Array.isArray(record.recommendations) && record.recommendations.length > 0 && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Recommendations', `recommendations-${idx}`, () => {
                      const lines = ['RECOMMENDATIONS', '═══════════════════════════════════════'];
                      const r = pdfData[idx] || record;
                      (r.recommendations || []).forEach((item, i) => {
                        if (item && typeof item === 'object') {
                          const parts = [];
                          if (item.recommendation) parts.push(item.recommendation);
                          if (item.date) parts.push(`(${formatDate(item.date)})`);
                          Object.keys(item).filter(k => k !== 'recommendation' && k !== 'date').forEach(k => { if (item[k]) parts.push(`${humanizeKey(k)}: ${item[k]}`); });
                          lines.push(`${i + 1}. ${parts.join(' ')}`);
                        } else {
                          lines.push(`${i + 1}. ${item}`);
                        }
                      });
                      copySectionToClipboard(lines.join('\n'), `recommendations-${idx}`);
                    }, idx, 'recommendations')}

                    {renderObjectArrayField(record, 'recommendations', idx, 'recommendations')}
                  </div>
                </div>
              )}

              {/* Results Section — dynamic-key object, editable leaves */}
              {resultsSection.show && record.results && typeof record.results === 'object' && !Array.isArray(record.results) && Object.keys(record.results).length > 0 && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Results', `results-${idx}`, () => {
                      const lines = ['RESULTS', '═══════════════════════════════════════'];
                      const r = pdfData[idx] || record;
                      flattenObject(r.results).forEach(it => lines.push(`${it.label}: ${it.value}`));
                      copySectionToClipboard(lines.join('\n'), `results-${idx}`);
                    }, idx, 'results')}

                    {renderDynamicObjectField(record, 'results', idx, 'results')}
                  </div>
                </div>
              )}

              {/* Status Section — editable string */}
              {statusSection.show && (record.status || getFieldValue(record, 'status', idx)) && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Status', `status-${idx}`, () => {
                      const r = pdfData[idx] || record;
                      copySectionToClipboard(`STATUS\n═══════════════════════════════════════\n${r.status || ''}`, `status-${idx}`);
                    }, idx, 'status')}

                    {renderEditableField(record, 'status', 'Status', idx, 'status', `status-val-${idx}`)}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default SubstanceUseAssessmentDocument;
