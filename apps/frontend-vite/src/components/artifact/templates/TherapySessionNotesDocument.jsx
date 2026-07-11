/**
 * TherapySessionNotesDocument.jsx
 * February 2026 Standard Template — with inline editing
 *
 * Features:
 * - Own useState for searchTerm (not prop)
 * - PDFDownloadLink import (not onExportPDF)
 * - 4-level search with IIFE sectionTitleMatches pattern
 * - parseSubtitleItems for "Label: detail" interventions
 * - Boolean badges for riskAssessment fields
 * - Blue theme: #0d1929, #93c5fd, rgba(96, 165, 250, 0.3)
 * - Inline editing for string fields: sessionType, response, homework, planForNext, therapist
 * - Inline editing for array fields: presentingIssues, interventions (with arrayIndex)
 * - riskAssessment remains read-only
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import TherapySessionNotesDocumentPDFTemplate from '../pdf-templates/TherapySessionNotesDocumentPDFTemplate';
import './TherapySessionNotesDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'therapySessionNotesPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const TherapySessionNotesDocument = ({ document, data }) => {
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
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nStatus = {};
    unwrappedData.forEach((record, idx) => {
      const rid = record && record._id
        ? (typeof record._id === 'object' && record._id.$oid ? record._id.$oid : record._id)
        : null;
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[`${fieldPart}-${idx}`] = true;
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

  // Split by semicolon helper
  const splitBySemicolon = (text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/;\s*/).map(s => s.trim()).filter(s => s.length > 0);
  };

  // Parse "Label: detail" subtitle items (for interventions)
  const parseSubtitleItems = (items) => {
    if (!items || !Array.isArray(items)) return [];
    return items.map(item => {
      if (typeof item !== 'string') return { label: null, content: String(item) };
      const colonIdx = item.indexOf(':');
      if (colonIdx > 0 && colonIdx < 60) {
        return {
          label: item.substring(0, colonIdx).trim(),
          content: item.substring(colonIdx + 1).trim()
        };
      }
      return { label: null, content: item };
    });
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

  // Level 4: Check if search term matches any of the provided strings (phrase match)
  const shouldShowRow = useCallback((record, ...searchableStrings) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;
    const searchLower = searchTerm.toLowerCase().trim();
    return searchableStrings.some(str =>
      str && String(str).toLowerCase().includes(searchLower)
    );
  }, [searchTerm]);

  // Level 2.5: Check if section title matches search
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

  // --- Edit handlers ---

  const handleStartEdit = useCallback((fieldName, idx, currentValue, arrayIndex, semiIdx) => {
    const s = semiIdx !== undefined ? semiIdx : 0;
    const editKey = arrayIndex !== undefined
      ? `${fieldName}.${arrayIndex}-${idx}-s${s}`
      : `${fieldName}-${idx}-s${s}`;
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
    const recordId = record._id && typeof record._id === 'object' && record._id.$oid ? record._id.$oid : record._id;
    if (!recordId) {
      console.error('[TherapySessionNotes] Cannot save — no record _id');
      return;
    }

    const saveValue = valueOverride !== undefined ? valueOverride : editValue.trim();
    const fieldPart = typeof arrayIndex === 'number' ? `${fieldName}.${arrayIndex}` : fieldName;
    const editKey = `${fieldPart}-${idx}`;
    const sKey = `${fieldPart}-${idx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;
    const sectionKey = `${sectionId}-${idx}`;

    setLocalEdits(prev => ({ ...prev, [editKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [sectionKey]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));
    // Re-edit after approval → drop the section 'approved' flag so the button returns to Approve
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
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApprove = useCallback(async (record, idx, sectionId) => {
    const recordId = record._id && typeof record._id === 'object' && record._id.$oid ? record._id.$oid : record._id;
    if (!recordId) {
      console.error('[TherapySessionNotes] Cannot approve — no record _id');
      return;
    }

    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements).
      // arrayIndex applies ONLY when the segment after the LAST dot is purely numeric.
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayIdx = lastDot !== -1 && /^\d+$/.test(tail);
        const payload = {
          field: isArrayIdx ? fieldPart.slice(0, lastDot) : fieldPart,
          value: localEdits[editKey],
        };
        if (isArrayIdx) payload.arrayIndex = parseInt(tail, 10);
        const response = await secureApiClient.put(`/api/edit/therapy_session_notes/${recordId}/edit`, payload);
        if (!response || !response.success) throw new Error((response && response.error) || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/therapy_session_notes/${recordId}/approve`);

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
      console.error('[TherapySessionNotes] Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // Toggle a boolean field (e.g., riskAssessment.suicidalIdeation) — staged as a DRAFT (no DB write).
  // localStorage keeps it across refresh; Approve commits it.
  const handleToggleBool = useCallback((record, idx, boolPath, currentValue, sectionId) => {
    const recordId = record._id && typeof record._id === 'object' && record._id.$oid ? record._id.$oid : record._id;
    if (!recordId) return;
    const newValue = !currentValue;
    const editKey = `${boolPath}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: newValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [`${boolPath}-${idx}-s0`]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));
    setApprovedSections(prev => {
      if (!prev[sectionId]) return prev;
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][boolPath] = newValue;
    writeDrafts(store);
  }, []);

  // Navigate nested dot paths (e.g., 'riskAssessment.riskLevel')
  const getNestedValue = (obj, path) => {
    if (!obj || !path) return undefined;
    if (!path.includes('.')) return obj[path];
    const parts = path.split('.');
    let val = obj;
    for (const p of parts) {
      val = val?.[p];
      if (val === undefined) return undefined;
    }
    return val;
  };

  // Get effective field value (local edit overrides original)
  const getFieldValue = useCallback((record, fieldName, idx, arrayIndex) => {
    const editKey = arrayIndex !== undefined
      ? `${fieldName}.${arrayIndex}-${idx}`
      : `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    if (arrayIndex !== undefined) {
      const arr = fieldName.includes('.') ? getNestedValue(record, fieldName) : record[fieldName];
      return Array.isArray(arr) ? arr[arrayIndex] : undefined;
    }
    return fieldName.includes('.') ? getNestedValue(record, fieldName) : record[fieldName];
  }, [localEdits]);

  // pdfData — merges localEdits into records for PDF + Copy All
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return unwrappedData;
    return unwrappedData.map((record, idx) => {
      const merged = { ...record };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldPath = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx === idx) {
          // Handle dot notation paths
          if (fieldPath.includes('.')) {
            const parts = fieldPath.split('.');
            if (parts.length === 2) {
              const [parent, child] = parts;
              const childAsNum = parseInt(child, 10);
              if (!isNaN(childAsNum) && Array.isArray(merged[parent])) {
                // Array element: 'interventions.0'
                merged[parent] = [...merged[parent]];
                merged[parent][childAsNum] = editVal;
              } else {
                // Nested object field: 'riskAssessment.riskLevel'
                merged[parent] = { ...merged[parent], [child]: editVal };
              }
            } else if (parts.length === 3) {
              const [gp, parent, child] = parts;
              const childAsNum = parseInt(child, 10);
              if (!isNaN(childAsNum) && Array.isArray(merged[gp]?.[parent])) {
                // Nested array element: 'riskAssessment.protectiveFactors.0'
                merged[gp] = { ...merged[gp] };
                merged[gp][parent] = [...merged[gp][parent]];
                merged[gp][parent][childAsNum] = editVal;
              }
            }
          } else {
            merged[fieldPath] = editVal;
          }
        }
      }
      return merged;
    });
  }, [unwrappedData, localEdits, pendingEdits]);

  // Section-level edit detection for approve button
  const SECTION_FIELDS = {
    sessionInfo: ['sessionType', 'therapist'],
    presentingIssues: ['presentingIssues'],
    interventions: ['interventions'],
    response: ['response'],
    homework: ['homework'],
    planForNext: ['planForNext'],
    riskAssessment: ['riskAssessment'],
  };

  const sectionHasEdits = useCallback((sectionId, idx) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    return fields.some(f => {
      // Check direct field edits
      const sKey = `${f}-${idx}`;
      if (editedFields[sKey]) return true;
      // Check array element edits (e.g. "presentingIssues.0-0")
      return Object.keys(editedFields).some(k =>
        k.startsWith(`${f}.`) && k.endsWith(`-${idx}`)
      );
    });
  }, [editedFields]);

  // Helper: render a single editable field (for string fields)
  const renderEditableField = (record, idx, fieldName, label, displayValue, sectionId, copyId) => {
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const canEdit = !!record._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const sentenceState = sectionWasEdited ? editedSentences[`${fieldName}-${idx}-s0`] : undefined;
    const recordStatus = statusOverrides[idx] || 'active';
    const isFieldEdited = sentenceState === 'edited' && recordStatus !== 'approved';
    const isPending = sentenceState && recordStatus !== 'approved';

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
                  onClick={() => handleSaveField(record, fieldName, idx, sectionId)}
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
            {canEdit && !isPending && (
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
            onClick={() => copyToClipboard(displayValue, copyId)}
          >
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && (
          <div className="modified-badge">edited — click approve to save</div>
        )}
      </div>
    );
  };

  // Helper: render a single editable array element (for presentingIssues/interventions)
  const renderEditableArrayItem = (record, idx, fieldName, arrayIndex, label, displayValue, sectionId, copyId) => {
    const editKey = `${fieldName}.${arrayIndex}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const canEdit = !!record._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const sentenceState = sectionWasEdited ? editedSentences[`${fieldName}.${arrayIndex}-${idx}-s0`] : undefined;
    const recordStatus = statusOverrides[idx] || 'active';
    const isFieldEdited = sentenceState === 'edited' && recordStatus !== 'approved';
    const isPending = sentenceState && recordStatus !== 'approved';

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={`${fieldName}-${arrayIndex}`}>
          {label && <div className="nested-subtitle">{highlightText(label)}</div>}
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
                  onClick={() => handleSaveField(record, fieldName, idx, sectionId, arrayIndex)}
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

    // For items with labels (subtitle pattern), wrap in rec-mini-card
    if (label) {
      return (
        <div className="rec-mini-card" key={`${fieldName}-${arrayIndex}`}>
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className={`numbered-row ${isFieldEdited ? 'modified' : ''}`}>
            <div
              className={`row-content ${canEdit ? 'editable' : ''}`}
              onClick={() => canEdit && handleStartEdit(fieldName, idx, getFieldValue(record, fieldName, idx, arrayIndex), arrayIndex)}
              title={canEdit ? 'Click to edit' : undefined}
            >
              <span className="content-value">{highlightText(displayValue)}</span>
              {canEdit && !isPending && (
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
              onClick={() => copyToClipboard(label ? `${label}: ${displayValue}` : displayValue, copyId)}
            >
              {copiedId === copyId ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {isFieldEdited && (
            <div className="modified-badge">edited — click approve to save</div>
          )}
        </div>
      );
    }

    // For plain items (no label), render as numbered-row
    return (
      <div key={`${fieldName}-${arrayIndex}`}>
        <div className={`numbered-row ${isFieldEdited ? 'modified' : ''}`}>
          <div
            className={`row-content ${canEdit ? 'editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(fieldName, idx, getFieldValue(record, fieldName, idx, arrayIndex), arrayIndex)}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isPending && (
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
            onClick={() => copyToClipboard(displayValue, copyId)}
          >
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && (
          <div className="modified-badge">edited — click approve to save</div>
        )}
      </div>
    );
  };

  // Get all record text for Copy All — uses pdfData for merged edits
  const getAllRecordText = (record, idx) => {
    const lines = [];
    lines.push(`THERAPY SESSION NOTES ${idx + 1}`);
    lines.push('═══════════════════════════════════════');

    // Session Info
    if (record.sessionDate || record.sessionNumber || record.sessionType || record.therapist) {
      lines.push('\nSESSION INFORMATION');
      lines.push('───────────────────────────────────────');
      if (record.sessionDate) lines.push(`Date:\n   ${formatDate(record.sessionDate)}`);
      if (record.sessionNumber) lines.push(`Session Number:\n   ${record.sessionNumber}`);
      if (record.sessionType) lines.push(`Session Type:\n   ${record.sessionType}`);
      if (record.therapist) lines.push(`Therapist:\n   ${record.therapist}`);
    }

    // Presenting Issues
    if (record.presentingIssues?.length > 0) {
      lines.push('\nPRESENTING ISSUES');
      lines.push('───────────────────────────────────────');
      record.presentingIssues.forEach((issue, i) => lines.push(`${i + 1}. ${issue}`));
    }

    // Interventions — with semicolon numbering
    if (record.interventions?.length > 0) {
      lines.push('\nINTERVENTIONS');
      lines.push('───────────────────────────────────────');
      const parsed = parseSubtitleItems(record.interventions);
      parsed.forEach((item, i) => {
        if (item.label) {
          const semiItems = splitBySemicolon(item.content);
          lines.push(`\n${item.label}:`);
          semiItems.forEach((si, sii) => lines.push(`   ${sii + 1}. ${si}`));
        } else {
          lines.push(`${i + 1}. ${item.content}`);
        }
      });
    }

    // Response
    if (record.response) {
      lines.push('\nCLIENT RESPONSE');
      lines.push('───────────────────────────────────────');
      splitBySentence(record.response).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }

    // Homework
    if (record.homework) {
      lines.push('\nHOMEWORK');
      lines.push('───────────────────────────────────────');
      splitBySentence(record.homework).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }

    // Plan for Next Session
    if (record.planForNext) {
      lines.push('\nPLAN FOR NEXT SESSION');
      lines.push('───────────────────────────────────────');
      splitBySentence(record.planForNext).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }

    // Risk Assessment
    if (record.riskAssessment) {
      const ra = record.riskAssessment;
      lines.push('\nRISK ASSESSMENT');
      lines.push('───────────────────────────────────────');
      if (ra.suicidalIdeation !== undefined) lines.push(`Suicidal Ideation: ${ra.suicidalIdeation ? 'Yes' : 'No'}`);
      if (ra.homicidalIdeation !== undefined) lines.push(`Homicidal Ideation: ${ra.homicidalIdeation ? 'Yes' : 'No'}`);
      if (ra.selfHarmHistory !== undefined) lines.push(`Self-Harm History: ${ra.selfHarmHistory ? 'Yes' : 'No'}`);
      if (ra.suicideAttemptHistory !== undefined) lines.push(`Suicide Attempt History: ${ra.suicideAttemptHistory ? 'Yes' : 'No'}`);
      if (ra.riskLevel) {
        lines.push('\nRisk Level:');
        splitBySemicolon(ra.riskLevel).forEach((ri, rii) => lines.push(`   ${rii + 1}. ${ri}`));
      }
      if (ra.protectiveFactors?.length > 0) {
        lines.push('\nProtective Factors:');
        ra.protectiveFactors.forEach((f, i) => lines.push(`   ${i + 1}. ${f}`));
      }
    }

    return lines.join('\n');
  };

  // Empty state
  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <div className="therapy-session-notes-document">
        <div className="document-header">
          <h1 className="document-title">Therapy Session Notes</h1>
        </div>
        <div className="empty-state">No therapy session notes available</div>
      </div>
    );
  }

  // ==================== LEVEL 1: Filter records based on search ====================
  const isSearching = searchTerm.trim().length > 0;

  const filteredRecords = unwrappedData.map((record, idx) => {
    if (!isSearching) return { ...record, _show: true, _showAllSections: false };

    // Build searchable text for Level 1 (record-level gate)
    const searchableText = [
      // Record title
      `Therapy Session Notes ${idx + 1}`, `therapy session notes ${idx + 1}`,

      // Section titles (ALL must be here for Level 1 gate!)
      'Session Information', 'session information', 'SESSION INFORMATION',
      'Presenting Issues', 'presenting issues', 'PRESENTING ISSUES',
      'Interventions', 'interventions', 'INTERVENTIONS',
      'Client Response', 'client response', 'CLIENT RESPONSE',
      'Homework', 'homework', 'HOMEWORK',
      'Plan for Next Session', 'plan for next session', 'PLAN FOR NEXT SESSION',
      'Risk Assessment', 'risk assessment', 'RISK ASSESSMENT',
      'Protective Factors', 'protective factors', 'PROTECTIVE FACTORS',

      // Field labels
      'Session Number', 'session number', 'Session Type', 'session type',
      'Therapist', 'therapist', 'Date', 'date',
      'Suicidal Ideation', 'suicidal ideation', 'Homicidal Ideation', 'homicidal ideation',
      'Self-Harm History', 'self-harm history', 'Suicide Attempt History', 'suicide attempt history',
      'Risk Level', 'risk level',

      // Field values
      record.sessionDate ? formatDate(record.sessionDate) : null,
      record.sessionNumber ? String(record.sessionNumber) : null,
      record.sessionType,
      record.therapist,
      record.response,
      record.homework,
      record.planForNext,

      // Presenting issues values
      ...(record.presentingIssues || []),

      // Interventions values
      ...(record.interventions || []),

      // Risk assessment values
      record.riskAssessment?.suicidalIdeation !== undefined ? (record.riskAssessment.suicidalIdeation ? 'Yes' : 'No') : null,
      record.riskAssessment?.homicidalIdeation !== undefined ? (record.riskAssessment.homicidalIdeation ? 'Yes' : 'No') : null,
      record.riskAssessment?.selfHarmHistory !== undefined ? (record.riskAssessment.selfHarmHistory ? 'Yes' : 'No') : null,
      record.riskAssessment?.suicideAttemptHistory !== undefined ? (record.riskAssessment.suicideAttemptHistory ? 'Yes' : 'No') : null,
      record.riskAssessment?.riskLevel,

      // Protective factors values
      ...(record.riskAssessment?.protectiveFactors || []),
    ].filter(Boolean).join(' ').toLowerCase();

    const searchLower = searchTerm.toLowerCase().trim();
    const matchesLevel1 = searchableText.includes(searchLower);

    if (!matchesLevel1) return { ...record, _show: false };

    // _showAllSections = true ONLY when searching for document title
    const docTitle = `therapy session notes ${idx + 1}`;
    const _showAllSections = searchLower === docTitle ||
      /^therapy\s+session\s+notes\s*\d*$/i.test(searchTerm.trim());

    return { ...record, _show: true, _showAllSections };
  }).filter(r => r._show);

  return (
    <div className="therapy-session-notes-document">
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">Therapy Session Notes</h1>

        {/* Header Actions - Row 2 */}
        <div className="header-actions">
          <button
            className={`copy-btn ${copiedId === 'copy-all' ? 'copied' : ''}`}
            onClick={() => {
              const allText = pdfData.map((r, i) => getAllRecordText(r, i)).join('\n\n');
              copyToClipboard(allText, 'copy-all');
            }}
          >
            {copiedId === 'copy-all' ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<TherapySessionNotesDocumentPDFTemplate document={pdfData} />}
            fileName="therapy-session-notes.pdf"
            className="pdf-btn"
          >
            {({ loading }) => (loading ? 'Preparing PDF...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>

        {/* Search Container - Row 3 */}
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search therapy session notes..."
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
          const canEdit = !!record._id;
          const recordStatus = statusOverrides[idx] || 'active';

          // ==================== LEVEL 2: Section visibility IIFE pattern ====================

          // Session Information
          const sessionInfoSection = (() => {
            if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
            const sectionTitleMatch = sectionTitleMatchesSearch('Session Information', 'session info', 'session details');
            if (sectionTitleMatch) return { show: true, bypassL4: true };
            const hasMatchingContent = shouldShowRow(recordWithFlag,
              'Session Number', 'session number', 'Session Type', 'session type',
              'Therapist', 'therapist', 'Date', 'date',
              record.sessionNumber ? String(record.sessionNumber) : null,
              record.sessionType, record.therapist,
              record.sessionDate ? formatDate(record.sessionDate) : null
            );
            return { show: hasMatchingContent, bypassL4: false };
          })();

          // Presenting Issues
          const presentingIssuesSection = (() => {
            if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
            const sectionTitleMatch = sectionTitleMatchesSearch('Presenting Issues', 'presenting concerns', 'chief complaint');
            if (sectionTitleMatch) return { show: true, bypassL4: true };
            const parsed = parseSubtitleItems(record.presentingIssues || []);
            const hasMatchingContent = parsed.some(item =>
              shouldShowRow(recordWithFlag, item.label, item.content)
            );
            return { show: hasMatchingContent, bypassL4: false };
          })();

          // Interventions
          const interventionsSection = (() => {
            if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
            const sectionTitleMatch = sectionTitleMatchesSearch('Interventions', 'treatment interventions', 'therapeutic interventions');
            if (sectionTitleMatch) return { show: true, bypassL4: true };
            const parsed = parseSubtitleItems(record.interventions || []);
            const hasMatchingContent = parsed.some(item =>
              shouldShowRow(recordWithFlag, item.label, item.content)
            );
            return { show: hasMatchingContent, bypassL4: false };
          })();

          // Client Response
          const responseSection = (() => {
            if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
            const sectionTitleMatch = sectionTitleMatchesSearch('Client Response', 'response', 'patient response');
            if (sectionTitleMatch) return { show: true, bypassL4: true };
            const hasMatchingContent = shouldShowRow(recordWithFlag, record.response);
            return { show: hasMatchingContent, bypassL4: false };
          })();

          // Homework
          const homeworkSection = (() => {
            if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
            const sectionTitleMatch = sectionTitleMatchesSearch('Homework', 'assignments', 'homework assignments');
            if (sectionTitleMatch) return { show: true, bypassL4: true };
            const hasMatchingContent = shouldShowRow(recordWithFlag, record.homework);
            return { show: hasMatchingContent, bypassL4: false };
          })();

          // Plan for Next Session
          const planForNextSection = (() => {
            if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
            const sectionTitleMatch = sectionTitleMatchesSearch('Plan for Next Session', 'next session', 'plan');
            if (sectionTitleMatch) return { show: true, bypassL4: true };
            const hasMatchingContent = shouldShowRow(recordWithFlag, record.planForNext);
            return { show: hasMatchingContent, bypassL4: false };
          })();

          // Risk Assessment
          const riskAssessmentSection = (() => {
            if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
            const sectionTitleMatch = sectionTitleMatchesSearch('Risk Assessment', 'risk', 'safety assessment', 'suicidal', 'homicidal');
            if (sectionTitleMatch) return { show: true, bypassL4: true };
            const ra = record.riskAssessment || {};
            const hasMatchingContent = shouldShowRow(recordWithFlag,
              'Suicidal Ideation', 'suicidal ideation', 'Homicidal Ideation', 'homicidal ideation',
              'Self-Harm History', 'self-harm history', 'Suicide Attempt History', 'suicide attempt history',
              'Risk Level', 'risk level', 'Protective Factors', 'protective factors',
              ra.suicidalIdeation !== undefined ? (ra.suicidalIdeation ? 'Yes' : 'No') : null,
              ra.homicidalIdeation !== undefined ? (ra.homicidalIdeation ? 'Yes' : 'No') : null,
              ra.selfHarmHistory !== undefined ? (ra.selfHarmHistory ? 'Yes' : 'No') : null,
              ra.suicideAttemptHistory !== undefined ? (ra.suicideAttemptHistory ? 'Yes' : 'No') : null,
              ra.riskLevel,
              ...(ra.protectiveFactors || [])
            );
            return { show: hasMatchingContent, bypassL4: false };
          })();

          return (
            <div key={idx} className="record-card">
              {/* Record Header */}
              <div className="record-header">
                <div className="header-top-row">
                  {record.sessionDate && (
                    <span className="date-badge">{formatDate(record.sessionDate)}</span>
                  )}
                </div>
                <h2 className="record-title">
                  {highlightText(`Therapy Session Notes ${idx + 1}`)}
                </h2>
              </div>

              {/* ========== Session Information Section ========== */}
              {sessionInfoSection.show && (record.sessionDate || record.sessionNumber || record.sessionType || record.therapist) && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h3 className="section-title">{highlightText('Session Information')}</h3>
                      <div className="header-right-actions">
                        <button
                          className={`copy-btn ${copiedSectionId === `session-info-${idx}` ? 'copied' : ''}`}
                          onClick={() => {
                            const lines = ['SESSION INFORMATION', '═══════════════════════════════════════'];
                            if (record.sessionDate) lines.push(`Date:\n   ${formatDate(record.sessionDate)}`);
                            if (record.sessionNumber) lines.push(`Session Number:\n   ${record.sessionNumber}`);
                            const stVal = getFieldValue(record, 'sessionType', idx);
                            if (stVal) lines.push(`Session Type:\n   ${stVal}`);
                            const thVal = getFieldValue(record, 'therapist', idx);
                            if (thVal) lines.push(`Therapist:\n   ${thVal}`);
                            copySectionToClipboard(lines.join('\n'), `session-info-${idx}`);
                          }}
                        >
                          {copiedSectionId === `session-info-${idx}` ? 'Copied!' : 'Copy Section'}
                        </button>
                        {(sectionHasEdits('sessionInfo', idx) || approvedSections['sessionInfo']) && (
                          <button
                            className={`approve-btn${approvedSections['sessionInfo'] ? ' approved' : ''}`}
                            onClick={() => handleApprove(record, idx, 'sessionInfo')}
                            disabled={approving}
                          >
                            {approving ? 'Approving...' : approvedSections['sessionInfo'] ? 'Approved' : 'Approve'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Session Number — read-only (not in editable fields) */}
                    {record.sessionNumber && (sessionInfoSection.bypassL4 || shouldShowRow(recordWithFlag, 'Session Number', 'session number', String(record.sessionNumber))) && (
                      <div className="rec-mini-card">
                        <div className="nested-subtitle">{highlightText('Session Number')}</div>
                        <div className="numbered-row">
                          <div className="row-content">
                            <span className="content-value">{highlightText(String(record.sessionNumber))}</span>
                          </div>
                          <button
                            className={`copy-btn ${copiedId === `session-num-${idx}` ? 'copied' : ''}`}
                            onClick={() => copyToClipboard(`Session Number: ${record.sessionNumber}`, `session-num-${idx}`)}
                          >
                            {copiedId === `session-num-${idx}` ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Session Type — editable */}
                    {(() => {
                      const val = getFieldValue(record, 'sessionType', idx);
                      if (!val) return null;
                      if (!sessionInfoSection.bypassL4 && !shouldShowRow(recordWithFlag, 'Session Type', 'session type', val)) return null;
                      return renderEditableField(record, idx, 'sessionType', 'Session Type', val, 'sessionInfo', `session-type-${idx}`);
                    })()}

                    {/* Therapist — editable */}
                    {(() => {
                      const val = getFieldValue(record, 'therapist', idx);
                      if (!val) return null;
                      if (!sessionInfoSection.bypassL4 && !shouldShowRow(recordWithFlag, 'Therapist', 'therapist', val)) return null;
                      return renderEditableField(record, idx, 'therapist', 'Therapist', val, 'sessionInfo', `therapist-${idx}`);
                    })()}
                  </div>
                </div>
              )}

              {/* ========== Presenting Issues Section — editable per array element ========== */}
              {presentingIssuesSection.show && record.presentingIssues?.length > 0 && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h3 className="section-title">{highlightText('Presenting Issues')}</h3>
                      <div className="header-right-actions">
                        <button
                          className={`copy-btn ${copiedSectionId === `issues-${idx}` ? 'copied' : ''}`}
                          onClick={() => {
                            const lines = ['PRESENTING ISSUES', '═══════════════════════════════════════'];
                            const issues = record.presentingIssues.map((issue, aIdx) => getFieldValue(record, 'presentingIssues', idx, aIdx));
                            const parsed = parseSubtitleItems(issues);
                            parsed.forEach((item, i) => {
                              if (item.label) {
                                lines.push(`\n${item.label}:`);
                                lines.push(`   ${item.content}`);
                              } else {
                                lines.push(`${i + 1}. ${item.content}`);
                              }
                            });
                            copySectionToClipboard(lines.join('\n'), `issues-${idx}`);
                          }}
                        >
                          {copiedSectionId === `issues-${idx}` ? 'Copied!' : 'Copy Section'}
                        </button>
                        {(sectionHasEdits('presentingIssues', idx) || approvedSections['presentingIssues']) && (
                          <button
                            className={`approve-btn${approvedSections['presentingIssues'] ? ' approved' : ''}`}
                            onClick={() => handleApprove(record, idx, 'presentingIssues')}
                            disabled={approving}
                          >
                            {approving ? 'Approving...' : approvedSections['presentingIssues'] ? 'Approved' : 'Approve'}
                          </button>
                        )}
                      </div>
                    </div>

                    {(() => {
                      return record.presentingIssues.map((originalItem, iIdx) => {
                        const itemVal = getFieldValue(record, 'presentingIssues', idx, iIdx);
                        const parsed = parseSubtitleItems([itemVal]);
                        const item = parsed[0];
                        if (!presentingIssuesSection.bypassL4 && !shouldShowRow(recordWithFlag, item.label, item.content)) return null;

                        return renderEditableArrayItem(
                          record, idx, 'presentingIssues', iIdx,
                          item.label, item.label ? item.content : itemVal,
                          'presentingIssues', `issue-${idx}-${iIdx}`
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* ========== Interventions Section — semicolon split per-row editing ========== */}
              {interventionsSection.show && record.interventions?.length > 0 && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h3 className="section-title">{highlightText('Interventions')}</h3>
                      <div className="header-right-actions">
                        <button
                          className={`copy-btn ${copiedSectionId === `interventions-${idx}` ? 'copied' : ''}`}
                          onClick={() => {
                            const lines = ['INTERVENTIONS', '═══════════════════════════════════════'];
                            record.interventions.forEach((origItem, aIdx) => {
                              const itemVal = getFieldValue(record, 'interventions', idx, aIdx);
                              const parsed = parseSubtitleItems([itemVal]);
                              const item = parsed[0];
                              if (item.label) {
                                lines.push(`\n${item.label}:`);
                                const semiItems = splitBySemicolon(item.content);
                                semiItems.forEach((si, sii) => lines.push(`   ${sii + 1}. ${si}`));
                              } else {
                                lines.push(`${aIdx + 1}. ${item.content}`);
                              }
                            });
                            copySectionToClipboard(lines.join('\n'), `interventions-${idx}`);
                          }}
                        >
                          {copiedSectionId === `interventions-${idx}` ? 'Copied!' : 'Copy Section'}
                        </button>
                        {(sectionHasEdits('interventions', idx) || approvedSections['interventions']) && (
                          <button
                            className={`approve-btn${approvedSections['interventions'] ? ' approved' : ''}`}
                            onClick={() => handleApprove(record, idx, 'interventions')}
                            disabled={approving}
                          >
                            {approving ? 'Approving...' : approvedSections['interventions'] ? 'Approved' : 'Approve'}
                          </button>
                        )}
                      </div>
                    </div>

                    {(() => {
                      return record.interventions.map((originalItem, iIdx) => {
                        const itemVal = getFieldValue(record, 'interventions', idx, iIdx);
                        const parsed = parseSubtitleItems([itemVal]);
                        const item = parsed[0];
                        if (!interventionsSection.bypassL4 && !shouldShowRow(recordWithFlag, item.label, item.content)) return null;

                        const contentText = item.label ? item.content : itemVal;
                        const semiItems = splitBySemicolon(contentText);

                        // If no semicolons, render as single editable row
                        if (semiItems.length <= 1) {
                          return renderEditableArrayItem(
                            record, idx, 'interventions', iIdx,
                            item.label, contentText,
                            'interventions', `intervention-${idx}-${iIdx}`
                          );
                        }

                        // Multiple semicolon items — render per-row
                        return (
                          <div className="rec-mini-card" key={`intervention-${iIdx}`}>
                            {item.label && <div className="nested-subtitle">{highlightText(item.label)}</div>}
                            {semiItems.map((semiItem, sIdx) => {
                              if (!interventionsSection.bypassL4 && !shouldShowRow(recordWithFlag, item.label, semiItem)) return null;

                              const editKey = `interventions.${iIdx}-${idx}-s${sIdx}`;
                              const isEditing = editingField === editKey;
                              const sentenceState = editedSentences[editKey];
                              const isFieldEdited = sentenceState === 'edited' && (statusOverrides[idx] || 'active') !== 'approved';

                              if (isEditing) {
                                return (
                                  <div key={sIdx} className="numbered-row edit-row">
                                    <div className="edit-field-container">
                                      <textarea
                                        ref={textareaRef}
                                        className="edit-textarea"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        rows={Math.max(2, editValue.split('\n').length)}
                                        disabled={saving}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && e.ctrlKey) {
                                            e.preventDefault();
                                            // Reconstruct full array element: label + ': ' + items joined by '; '
                                            const currentFull = getFieldValue(record, 'interventions', idx, iIdx);
                                            const parsedFull = parseSubtitleItems([currentFull]);
                                            const fullItem = parsedFull[0];
                                            const allSemi = splitBySemicolon(fullItem.label ? fullItem.content : currentFull);
                                            allSemi[sIdx] = editValue.trim();
                                            const newContent = allSemi.join('; ');
                                            const fullVal = fullItem.label ? `${fullItem.label}: ${newContent}` : newContent;
                                            handleSaveField(record, 'interventions', idx, 'interventions', iIdx, fullVal, sIdx);
                                          }
                                        }}
                                      />
                                      <div className="edit-actions">
                                        <button
                                          className="edit-save-btn"
                                          onClick={() => {
                                            const currentFull = getFieldValue(record, 'interventions', idx, iIdx);
                                            const parsedFull = parseSubtitleItems([currentFull]);
                                            const fullItem = parsedFull[0];
                                            const allSemi = splitBySemicolon(fullItem.label ? fullItem.content : currentFull);
                                            allSemi[sIdx] = editValue.trim();
                                            const newContent = allSemi.join('; ');
                                            const fullVal = fullItem.label ? `${fullItem.label}: ${newContent}` : newContent;
                                            handleSaveField(record, 'interventions', idx, 'interventions', iIdx, fullVal, sIdx);
                                          }}
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
                                );
                              }

                              return (
                                <React.Fragment key={sIdx}>
                                  <div className={`numbered-row${isFieldEdited ? ' modified' : ''}`}>
                                    <div
                                      className={`row-content${canEdit ? ' editable' : ''}`}
                                      onClick={() => canEdit && handleStartEdit('interventions', idx, semiItem, iIdx, sIdx)}
                                      title={canEdit ? 'Click to edit' : undefined}
                                    >
                                      <span className="content-value">{highlightText(semiItem)}</span>
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
                                      className={`copy-btn ${copiedId === `intervention-${idx}-${iIdx}-s${sIdx}` ? 'copied' : ''}`}
                                      onClick={() => copyToClipboard(semiItem, `intervention-${idx}-${iIdx}-s${sIdx}`)}
                                    >
                                      {copiedId === `intervention-${idx}-${iIdx}-s${sIdx}` ? 'Copied!' : 'Copy'}
                                    </button>
                                  </div>
                                  {isFieldEdited && <div className="modified-badge">Modified</div>}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* ========== Client Response — per-sentence editing (no double header) ========== */}
              {responseSection.show && record.response && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h3 className="section-title">{highlightText('Client Response')}</h3>
                      <div className="header-right-actions">
                        <button
                          className={`copy-btn ${copiedSectionId === `response-${idx}` ? 'copied' : ''}`}
                          onClick={() => {
                            const val = getFieldValue(record, 'response', idx);
                            const lines = ['CLIENT RESPONSE', '═══════════════════════════════════════'];
                            splitBySentence(val).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
                            copySectionToClipboard(lines.join('\n'), `response-${idx}`);
                          }}
                        >
                          {copiedSectionId === `response-${idx}` ? 'Copied!' : 'Copy Section'}
                        </button>
                        {(sectionHasEdits('response', idx) || approvedSections['response']) && (
                          <button
                            className={`approve-btn${approvedSections['response'] ? ' approved' : ''}`}
                            onClick={() => handleApprove(record, idx, 'response')}
                            disabled={approving}
                          >
                            {approving ? 'Approving...' : approvedSections['response'] ? 'Approved' : 'Approve'}
                          </button>
                        )}
                      </div>
                    </div>

                    {(() => {
                      const fullEditKey = `response-${idx}`;
                      const hasFullEdit = localEdits[fullEditKey] !== undefined;
                      const sourceText = hasFullEdit ? localEdits[fullEditKey] : (record.response || '');
                      const sentences = splitBySentence(sourceText);
                      if (sentences.length === 0) return null;

                      return sentences.map((sentence, sIdx) => {
                        if (!responseSection.bypassL4 && !shouldShowRow(recordWithFlag, sentence)) return null;
                        const editKey = `response-${idx}-s${sIdx}`;
                        const isEditing = editingField === editKey;
                        const sentenceState = editedSentences[editKey];
                        const isFieldEdited = sentenceState === 'edited' && (statusOverrides[idx] || 'active') !== 'approved';

                        if (isEditing) {
                          return (
                            <div key={sIdx} className="numbered-row edit-row">
                              <div className="edit-field-container">
                                <textarea
                                  ref={textareaRef}
                                  className="edit-textarea"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  rows={Math.max(2, editValue.split('\n').length)}
                                  disabled={saving}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.ctrlKey) {
                                      e.preventDefault();
                                      let edited = editValue.trim();
                                      if (edited && !/[.!?]$/.test(edited)) edited += '.';
                                      const allCurrent = splitBySentence(sourceText);
                                      const updated = allCurrent.map((s, i) => {
                                        const t = i === sIdx ? edited : s;
                                        return (t && !/[.!?]$/.test(t)) ? t + '.' : t;
                                      });
                                      const fullText = updated.join(' ');
                                      handleSaveField(record, 'response', idx, 'response', undefined, fullText, sIdx);
                                    }
                                  }}
                                />
                                <div className="edit-actions">
                                  <button
                                    className="edit-save-btn"
                                    onClick={() => {
                                      let edited = editValue.trim();
                                      if (edited && !/[.!?]$/.test(edited)) edited += '.';
                                      const allCurrent = splitBySentence(sourceText);
                                      const updated = allCurrent.map((s, i) => {
                                        const t = i === sIdx ? edited : s;
                                        return (t && !/[.!?]$/.test(t)) ? t + '.' : t;
                                      });
                                      const fullText = updated.join(' ');
                                      handleSaveField(record, 'response', idx, 'response', undefined, fullText, sIdx);
                                    }}
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
                          );
                        }

                        return (
                          <React.Fragment key={sIdx}>
                            <div className={`numbered-row${isFieldEdited ? ' modified' : ''}`}>
                              <div
                                className={`row-content${canEdit ? ' editable' : ''}`}
                                onClick={() => canEdit && handleStartEdit('response', idx, sentence.replace(/[.!?]+$/, '').trim(), undefined, sIdx)}
                                title={canEdit ? 'Click to edit' : undefined}
                              >
                                <span className="content-value">{highlightText(sentence)}</span>
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
                                className={`copy-btn ${copiedId === `response-${idx}-s${sIdx}` ? 'copied' : ''}`}
                                onClick={() => copyToClipboard(sentence, `response-${idx}-s${sIdx}`)}
                              >
                                {copiedId === `response-${idx}-s${sIdx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                            {isFieldEdited && <div className="modified-badge">Modified</div>}
                          </React.Fragment>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* ========== Homework — per-sentence editing (no double header) ========== */}
              {homeworkSection.show && record.homework && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h3 className="section-title">{highlightText('Homework')}</h3>
                      <div className="header-right-actions">
                        <button
                          className={`copy-btn ${copiedSectionId === `homework-${idx}` ? 'copied' : ''}`}
                          onClick={() => {
                            const val = getFieldValue(record, 'homework', idx);
                            const lines = ['HOMEWORK', '═══════════════════════════════════════'];
                            splitBySentence(val).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
                            copySectionToClipboard(lines.join('\n'), `homework-${idx}`);
                          }}
                        >
                          {copiedSectionId === `homework-${idx}` ? 'Copied!' : 'Copy Section'}
                        </button>
                        {(sectionHasEdits('homework', idx) || approvedSections['homework']) && (
                          <button
                            className={`approve-btn${approvedSections['homework'] ? ' approved' : ''}`}
                            onClick={() => handleApprove(record, idx, 'homework')}
                            disabled={approving}
                          >
                            {approving ? 'Approving...' : approvedSections['homework'] ? 'Approved' : 'Approve'}
                          </button>
                        )}
                      </div>
                    </div>

                    {(() => {
                      const fullEditKey = `homework-${idx}`;
                      const hasFullEdit = localEdits[fullEditKey] !== undefined;
                      const sourceText = hasFullEdit ? localEdits[fullEditKey] : (record.homework || '');
                      const sentences = splitBySentence(sourceText);
                      if (sentences.length === 0) return null;

                      return sentences.map((sentence, sIdx) => {
                        if (!homeworkSection.bypassL4 && !shouldShowRow(recordWithFlag, sentence)) return null;
                        const editKey = `homework-${idx}-s${sIdx}`;
                        const isEditing = editingField === editKey;
                        const sentenceState = editedSentences[editKey];
                        const isFieldEdited = sentenceState === 'edited' && (statusOverrides[idx] || 'active') !== 'approved';

                        if (isEditing) {
                          return (
                            <div key={sIdx} className="numbered-row edit-row">
                              <div className="edit-field-container">
                                <textarea
                                  ref={textareaRef}
                                  className="edit-textarea"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  rows={Math.max(2, editValue.split('\n').length)}
                                  disabled={saving}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.ctrlKey) {
                                      e.preventDefault();
                                      let edited = editValue.trim();
                                      if (edited && !/[.!?]$/.test(edited)) edited += '.';
                                      const allCurrent = splitBySentence(sourceText);
                                      const updated = allCurrent.map((s, i) => {
                                        const t = i === sIdx ? edited : s;
                                        return (t && !/[.!?]$/.test(t)) ? t + '.' : t;
                                      });
                                      const fullText = updated.join(' ');
                                      handleSaveField(record, 'homework', idx, 'homework', undefined, fullText, sIdx);
                                    }
                                  }}
                                />
                                <div className="edit-actions">
                                  <button
                                    className="edit-save-btn"
                                    onClick={() => {
                                      let edited = editValue.trim();
                                      if (edited && !/[.!?]$/.test(edited)) edited += '.';
                                      const allCurrent = splitBySentence(sourceText);
                                      const updated = allCurrent.map((s, i) => {
                                        const t = i === sIdx ? edited : s;
                                        return (t && !/[.!?]$/.test(t)) ? t + '.' : t;
                                      });
                                      const fullText = updated.join(' ');
                                      handleSaveField(record, 'homework', idx, 'homework', undefined, fullText, sIdx);
                                    }}
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
                          );
                        }

                        return (
                          <React.Fragment key={sIdx}>
                            <div className={`numbered-row${isFieldEdited ? ' modified' : ''}`}>
                              <div
                                className={`row-content${canEdit ? ' editable' : ''}`}
                                onClick={() => canEdit && handleStartEdit('homework', idx, sentence.replace(/[.!?]+$/, '').trim(), undefined, sIdx)}
                                title={canEdit ? 'Click to edit' : undefined}
                              >
                                <span className="content-value">{highlightText(sentence)}</span>
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
                                className={`copy-btn ${copiedId === `homework-${idx}-s${sIdx}` ? 'copied' : ''}`}
                                onClick={() => copyToClipboard(sentence, `homework-${idx}-s${sIdx}`)}
                              >
                                {copiedId === `homework-${idx}-s${sIdx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                            {isFieldEdited && <div className="modified-badge">Modified</div>}
                          </React.Fragment>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* ========== Plan for Next Session — per-sentence editing (no double header) ========== */}
              {planForNextSection.show && record.planForNext && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h3 className="section-title">{highlightText('Plan for Next Session')}</h3>
                      <div className="header-right-actions">
                        <button
                          className={`copy-btn ${copiedSectionId === `plan-next-${idx}` ? 'copied' : ''}`}
                          onClick={() => {
                            const val = getFieldValue(record, 'planForNext', idx);
                            const lines = ['PLAN FOR NEXT SESSION', '═══════════════════════════════════════'];
                            splitBySentence(val).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
                            copySectionToClipboard(lines.join('\n'), `plan-next-${idx}`);
                          }}
                        >
                          {copiedSectionId === `plan-next-${idx}` ? 'Copied!' : 'Copy Section'}
                        </button>
                        {(sectionHasEdits('planForNext', idx) || approvedSections['planForNext']) && (
                          <button
                            className={`approve-btn${approvedSections['planForNext'] ? ' approved' : ''}`}
                            onClick={() => handleApprove(record, idx, 'planForNext')}
                            disabled={approving}
                          >
                            {approving ? 'Approving...' : approvedSections['planForNext'] ? 'Approved' : 'Approve'}
                          </button>
                        )}
                      </div>
                    </div>

                    {(() => {
                      const fullEditKey = `planForNext-${idx}`;
                      const hasFullEdit = localEdits[fullEditKey] !== undefined;
                      const sourceText = hasFullEdit ? localEdits[fullEditKey] : (record.planForNext || '');
                      const sentences = splitBySentence(sourceText);
                      if (sentences.length === 0) return null;

                      return sentences.map((sentence, sIdx) => {
                        if (!planForNextSection.bypassL4 && !shouldShowRow(recordWithFlag, sentence)) return null;
                        const editKey = `planForNext-${idx}-s${sIdx}`;
                        const isEditing = editingField === editKey;
                        const sentenceState = editedSentences[editKey];
                        const isFieldEdited = sentenceState === 'edited' && (statusOverrides[idx] || 'active') !== 'approved';

                        if (isEditing) {
                          return (
                            <div key={sIdx} className="numbered-row edit-row">
                              <div className="edit-field-container">
                                <textarea
                                  ref={textareaRef}
                                  className="edit-textarea"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  rows={Math.max(2, editValue.split('\n').length)}
                                  disabled={saving}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.ctrlKey) {
                                      e.preventDefault();
                                      let edited = editValue.trim();
                                      if (edited && !/[.!?]$/.test(edited)) edited += '.';
                                      const allCurrent = splitBySentence(sourceText);
                                      const updated = allCurrent.map((s, i) => {
                                        const t = i === sIdx ? edited : s;
                                        return (t && !/[.!?]$/.test(t)) ? t + '.' : t;
                                      });
                                      const fullText = updated.join(' ');
                                      handleSaveField(record, 'planForNext', idx, 'planForNext', undefined, fullText, sIdx);
                                    }
                                  }}
                                />
                                <div className="edit-actions">
                                  <button
                                    className="edit-save-btn"
                                    onClick={() => {
                                      let edited = editValue.trim();
                                      if (edited && !/[.!?]$/.test(edited)) edited += '.';
                                      const allCurrent = splitBySentence(sourceText);
                                      const updated = allCurrent.map((s, i) => {
                                        const t = i === sIdx ? edited : s;
                                        return (t && !/[.!?]$/.test(t)) ? t + '.' : t;
                                      });
                                      const fullText = updated.join(' ');
                                      handleSaveField(record, 'planForNext', idx, 'planForNext', undefined, fullText, sIdx);
                                    }}
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
                          );
                        }

                        return (
                          <React.Fragment key={sIdx}>
                            <div className={`numbered-row${isFieldEdited ? ' modified' : ''}`}>
                              <div
                                className={`row-content${canEdit ? ' editable' : ''}`}
                                onClick={() => canEdit && handleStartEdit('planForNext', idx, sentence.replace(/[.!?]+$/, '').trim(), undefined, sIdx)}
                                title={canEdit ? 'Click to edit' : undefined}
                              >
                                <span className="content-value">{highlightText(sentence)}</span>
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
                                className={`copy-btn ${copiedId === `plan-next-${idx}-s${sIdx}` ? 'copied' : ''}`}
                                onClick={() => copyToClipboard(sentence, `plan-next-${idx}-s${sIdx}`)}
                              >
                                {copiedId === `plan-next-${idx}-s${sIdx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                            {isFieldEdited && <div className="modified-badge">Modified</div>}
                          </React.Fragment>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* ========== Risk Assessment Section — EDITABLE ========== */}
              {riskAssessmentSection.show && record.riskAssessment && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h3 className="section-title">{highlightText('Risk Assessment')}</h3>
                      <div className="header-right-actions">
                        <button
                          className={`copy-btn ${copiedSectionId === `risk-${idx}` ? 'copied' : ''}`}
                          onClick={() => {
                            const ra = record.riskAssessment;
                            const lines = ['RISK ASSESSMENT', '═══════════════════════════════════════'];
                            const boolCopyFields = [
                              { key: 'suicidalIdeation', label: 'Suicidal Ideation' },
                              { key: 'homicidalIdeation', label: 'Homicidal Ideation' },
                              { key: 'selfHarmHistory', label: 'Self-Harm History' },
                              { key: 'suicideAttemptHistory', label: 'Suicide Attempt History' },
                            ];
                            boolCopyFields.forEach(bf => {
                              const boolPath = `riskAssessment.${bf.key}`;
                              const val = localEdits[`${boolPath}-${idx}`] !== undefined ? localEdits[`${boolPath}-${idx}`] : ra[bf.key];
                              if (val !== undefined) lines.push(`${bf.label}: ${val ? 'Yes' : 'No'}`);
                            });
                            const rlVal = getFieldValue(record, 'riskAssessment.riskLevel', idx) || ra.riskLevel;
                            if (rlVal) {
                              lines.push('\nRisk Level:');
                              splitBySemicolon(rlVal).forEach((ri, rii) => lines.push(`   ${rii + 1}. ${ri}`));
                            }
                            if (ra.protectiveFactors?.length > 0) {
                              lines.push('\nProtective Factors:');
                              ra.protectiveFactors.forEach((f, fi) => {
                                const pfVal = getFieldValue(record, 'riskAssessment.protectiveFactors', idx, fi) || f;
                                lines.push(`   ${fi + 1}. ${pfVal}`);
                              });
                            }
                            copySectionToClipboard(lines.join('\n'), `risk-${idx}`);
                          }}
                        >
                          {copiedSectionId === `risk-${idx}` ? 'Copied!' : 'Copy Section'}
                        </button>
                        {(sectionHasEdits('riskAssessment', idx) || approvedSections['riskAssessment']) && (
                          <button
                            className={`approve-btn${approvedSections['riskAssessment'] ? ' approved' : ''}`}
                            onClick={() => handleApprove(record, idx, 'riskAssessment')}
                            disabled={approving}
                          >
                            {approving ? 'Approving...' : approvedSections['riskAssessment'] ? 'Approved' : 'Approve'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Boolean risk fields — clickable to toggle */}
                    {(() => {
                      const ra = record.riskAssessment;
                      const boolFields = [
                        { key: 'suicidalIdeation', label: 'Suicidal Ideation' },
                        { key: 'homicidalIdeation', label: 'Homicidal Ideation' },
                        { key: 'selfHarmHistory', label: 'Self-Harm History' },
                        { key: 'suicideAttemptHistory', label: 'Suicide Attempt History' },
                      ];

                      return boolFields.map((field) => {
                        if (ra[field.key] === undefined) return null;
                        const boolPath = `riskAssessment.${field.key}`;
                        const currentVal = localEdits[`${boolPath}-${idx}`] !== undefined ? localEdits[`${boolPath}-${idx}`] : ra[field.key];
                        if (!riskAssessmentSection.bypassL4 && !shouldShowRow(recordWithFlag, field.label, currentVal ? 'Yes' : 'No')) return null;
                        const sentenceState = editedSentences[`${boolPath}-${idx}-s0`];
                        const isFieldEdited = sentenceState === 'edited' && (statusOverrides[idx] || 'active') !== 'approved';

                        return (
                          <React.Fragment key={field.key}>
                            <div className={`numbered-row${isFieldEdited ? ' modified' : ''}`}>
                              <div
                                className={`row-content${canEdit ? ' editable' : ''}`}
                                onClick={() => canEdit && handleToggleBool(record, idx, boolPath, currentVal, 'riskAssessment')}
                                title={canEdit ? 'Click to toggle Yes/No' : undefined}
                              >
                                <span className="content-value">{highlightText(field.label)}</span>
                                {canEdit && !isFieldEdited && (
                                  <span className="edit-indicator">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                      <path d="m15 5 4 4" />
                                    </svg>
                                    <span className="edit-tag">toggle</span>
                                  </span>
                                )}
                              </div>
                              <span className={`status-badge ${currentVal ? 'status-yes' : 'status-no'}`}>
                                {currentVal ? 'Yes' : 'No'}
                              </span>
                              <button
                                className={`copy-btn ${copiedId === `risk-${field.key}-${idx}` ? 'copied' : ''}`}
                                onClick={() => copyToClipboard(`${field.label}: ${currentVal ? 'Yes' : 'No'}`, `risk-${field.key}-${idx}`)}
                              >
                                {copiedId === `risk-${field.key}-${idx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                            {isFieldEdited && <div className="modified-badge">Modified</div>}
                          </React.Fragment>
                        );
                      });
                    })()}

                    {/* Risk Level — semicolon split with per-row editing */}
                    {record.riskAssessment.riskLevel && (riskAssessmentSection.bypassL4 || shouldShowRow(recordWithFlag, 'Risk Level', 'risk level', record.riskAssessment.riskLevel)) && (() => {
                      const riskLevelSource = getFieldValue(record, 'riskAssessment.riskLevel', idx) || record.riskAssessment.riskLevel;
                      const riskItems = splitBySemicolon(riskLevelSource);
                      return (
                        <div className="rec-mini-card">
                          <div className="nested-subtitle">{highlightText('Risk Level')}</div>
                          {riskItems.map((item, riIdx) => {
                            if (!riskAssessmentSection.bypassL4 && !shouldShowRow(recordWithFlag, 'Risk Level', item)) return null;
                            const editKey = `riskAssessment.riskLevel-${idx}-s${riIdx}`;
                            const isEditing = editingField === editKey;
                            const sentenceState = editedSentences[editKey];
                            const isFieldEdited = sentenceState === 'edited' && (statusOverrides[idx] || 'active') !== 'approved';

                            if (isEditing) {
                              return (
                                <div key={riIdx} className="numbered-row edit-row">
                                  <div className="edit-field-container">
                                    <textarea
                                      ref={textareaRef}
                                      className="edit-textarea"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      rows={Math.max(2, editValue.split('\n').length)}
                                      disabled={saving}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && e.ctrlKey) {
                                          e.preventDefault();
                                          const allSemi = splitBySemicolon(riskLevelSource);
                                          allSemi[riIdx] = editValue.trim();
                                          const fullVal = allSemi.join('; ');
                                          handleSaveField(record, 'riskAssessment.riskLevel', idx, 'riskAssessment', undefined, fullVal, riIdx);
                                        }
                                      }}
                                    />
                                    <div className="edit-actions">
                                      <button
                                        className="edit-save-btn"
                                        onClick={() => {
                                          const allSemi = splitBySemicolon(riskLevelSource);
                                          allSemi[riIdx] = editValue.trim();
                                          const fullVal = allSemi.join('; ');
                                          handleSaveField(record, 'riskAssessment.riskLevel', idx, 'riskAssessment', undefined, fullVal, riIdx);
                                        }}
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
                              );
                            }

                            return (
                              <React.Fragment key={riIdx}>
                                <div className={`numbered-row${isFieldEdited ? ' modified' : ''}`}>
                                  <div
                                    className={`row-content${canEdit ? ' editable' : ''}`}
                                    onClick={() => canEdit && handleStartEdit('riskAssessment.riskLevel', idx, item, undefined, riIdx)}
                                    title={canEdit ? 'Click to edit' : undefined}
                                  >
                                    <span className="content-value">{highlightText(item)}</span>
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
                                    className={`copy-btn ${copiedId === `risk-level-${idx}-${riIdx}` ? 'copied' : ''}`}
                                    onClick={() => copyToClipboard(item, `risk-level-${idx}-${riIdx}`)}
                                  >
                                    {copiedId === `risk-level-${idx}-${riIdx}` ? 'Copied!' : 'Copy'}
                                  </button>
                                </div>
                                {isFieldEdited && <div className="modified-badge">Modified</div>}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Protective Factors — editable per item */}
                    {record.riskAssessment.protectiveFactors?.length > 0 && (riskAssessmentSection.bypassL4 || shouldShowRow(recordWithFlag, 'Protective Factors', 'protective factors', ...(record.riskAssessment.protectiveFactors || []))) && (
                      <div className="rec-mini-card">
                        <div className="subsection-header">
                          <div className="nested-subtitle">{highlightText('Protective Factors')}</div>
                          <button
                            className={`copy-btn ${copiedSectionId === `protective-${idx}` ? 'copied' : ''}`}
                            onClick={() => {
                              const lines = ['PROTECTIVE FACTORS', '═══════════════════════════════════════'];
                              record.riskAssessment.protectiveFactors.forEach((f, fi) => {
                                const pfVal = getFieldValue(record, 'riskAssessment.protectiveFactors', idx, fi) || f;
                                lines.push(`${fi + 1}. ${pfVal}`);
                              });
                              copySectionToClipboard(lines.join('\n'), `protective-${idx}`);
                            }}
                          >
                            {copiedSectionId === `protective-${idx}` ? 'Copied!' : 'Copy Section'}
                          </button>
                        </div>

                        {record.riskAssessment.protectiveFactors.map((factor, fIdx) => {
                          const pfVal = getFieldValue(record, 'riskAssessment.protectiveFactors', idx, fIdx) || factor;
                          if (!riskAssessmentSection.bypassL4 && !shouldShowRow(recordWithFlag, pfVal)) return null;

                          const editKey = `riskAssessment.protectiveFactors.${fIdx}-${idx}-s0`;
                          const isEditing = editingField === editKey;
                          const sentenceState = editedSentences[editKey];
                          const isFieldEdited = sentenceState === 'edited' && (statusOverrides[idx] || 'active') !== 'approved';

                          if (isEditing) {
                            return (
                              <div key={fIdx} className="numbered-row edit-row">
                                <div className="edit-field-container">
                                  <textarea
                                    ref={textareaRef}
                                    className="edit-textarea"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    rows={Math.max(2, editValue.split('\n').length)}
                                    disabled={saving}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && e.ctrlKey) {
                                        e.preventDefault();
                                        handleSaveField(record, 'riskAssessment.protectiveFactors', idx, 'riskAssessment', fIdx);
                                      }
                                    }}
                                  />
                                  <div className="edit-actions">
                                    <button
                                      className="edit-save-btn"
                                      onClick={() => handleSaveField(record, 'riskAssessment.protectiveFactors', idx, 'riskAssessment', fIdx)}
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
                            );
                          }

                          return (
                            <React.Fragment key={fIdx}>
                              <div className={`numbered-row${isFieldEdited ? ' modified' : ''}`}>
                                <div
                                  className={`row-content${canEdit ? ' editable' : ''}`}
                                  onClick={() => canEdit && handleStartEdit('riskAssessment.protectiveFactors', idx, pfVal, fIdx)}
                                  title={canEdit ? 'Click to edit' : undefined}
                                >
                                  <span className="content-value">{highlightText(pfVal)}</span>
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
                                  className={`copy-btn ${copiedId === `protective-${idx}-${fIdx}` ? 'copied' : ''}`}
                                  onClick={() => copyToClipboard(pfVal, `protective-${idx}-${fIdx}`)}
                                >
                                  {copiedId === `protective-${idx}-${fIdx}` ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                              {isFieldEdited && <div className="modified-badge">Modified</div>}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}
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

export default TherapySessionNotesDocument;
