/* ReviewOfSystemsDocument.jsx - December 2025 REBUILD */
/* Blue theme | Mini-card pattern | 4-level search | PDFDownloadLink | Inline editing */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import ReviewOfSystemsDocumentPDFTemplate from '../pdf-templates/ReviewOfSystemsDocumentPDFTemplate';
import './ReviewOfSystemsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'review_of_systemsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const ReviewOfSystemsDocument = ({ document, data }) => {
  const templateData = document || data;

  // ========================= STATE =========================
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

  // ========================= DATA UNWRAPPING =========================
  const unwrappedData = useMemo(() => {
    if (!templateData) return [];
    if (Array.isArray(templateData)) {
      return templateData.flatMap(item => {
        if (item?.document) return Array.isArray(item.document) ? item.document : [item.document];
        if (item?.data) return Array.isArray(item.data) ? item.data : [item.data];
        if (item?.review_of_systems) return Array.isArray(item.review_of_systems) ? item.review_of_systems : [item.review_of_systems];
        return [item];
      });
    }
    if (templateData.review_of_systems) {
      return Array.isArray(templateData.review_of_systems) ? templateData.review_of_systems : [templateData.review_of_systems];
    }
    return [templateData];
  }, [templateData]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nStatus = {};
    unwrappedData.forEach((record, idx) => {
      const recId = record && record._id ? (record._id.$oid || record._id) : null;
      const recDrafts = recId ? store[recId] : null;
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
  }, [unwrappedData]);

  // ========================= HELPERS =========================
  // Recursive object helpers (donor: PointOfCareUltrasoundHeartRateDocument)
  const humanizeKey = (key) => {
    if (key === null || key === undefined || key === '') return '';
    const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const isScalar = (v) => v === null || typeof v !== 'object';
  const isEmptyDeep = (v) => {
    if (v === null || v === undefined) return true;
    if (typeof v === 'boolean') return false;
    if (typeof v === 'number') return !Number.isFinite(v);
    if (typeof v === 'string') return v.trim() === '';
    if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
    if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
    return false;
  };
  const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

  const formatDate = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return String(dateVal);
    }
  };

  // Split by comma, preserving parentheses content
  const splitByCommaIgnoreParentheses = (text) => {
    if (!text || typeof text !== 'string') return [];
    const items = [];
    let current = '';
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '(') depth++;
      else if (char === ')') depth--;
      else if (char === ',' && depth === 0) {
        const trimmed = current.trim();
        if (trimmed) items.push(trimmed);
        current = '';
        continue;
      }
      current += char;
    }
    const lastTrimmed = current.trim();
    if (lastTrimmed) items.push(lastTrimmed);
    return items;
  };

  // Parse notes with embedded labels like "Infectious Disease: ..."
  const parseNotesWithLabels = (text) => {
    if (!text || typeof text !== 'string') return [];

    // Check for "Label: content" pattern
    const labelPattern = /^([A-Z][A-Za-z\s]+):\s*(.+)$/;
    const match = text.match(labelPattern);

    if (match) {
      return [{ label: match[1].trim(), content: match[2].trim() }];
    }

    // Split by sentence if no label pattern
    const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
    return sentences.map(s => ({ label: null, content: s }));
  };

  // ========================= COPY FUNCTIONS =========================
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

  // ========================= SEARCH HELPERS =========================
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

  // ========================= EDIT HANDLERS =========================

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
  const handleSaveField = useCallback((record, fieldName, idx, sectionId) => {
    const recordId = record._id ? (record._id.$oid || record._id) : null;
    if (!recordId) {
      console.error('[ReviewOfSystems] Cannot save — no record _id');
      return;
    }
    const value = editValue.trim();
    const editKey = `${fieldName}-${idx}`;
    const sectionKey = `${sectionId}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [sectionKey]: true }));
    setEditedSentences(prev => ({ ...prev, [`${editKey}-s0`]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));
    setApprovedSections(prev => {
      if (!prev[sectionId]) return prev;
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });

    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldName] = value;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this record to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApprove = useCallback(async (record, idx, sectionId) => {
    const recordId = record._id ? (record._id.$oid || record._id) : null;
    if (!recordId) {
      console.error('[ReviewOfSystems] Cannot approve — no record _id');
      return;
    }

    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayIdx = /^\d+$/.test(trailing);
        const payload = { field: isArrayIdx ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArrayIdx) payload.arrayIndex = parseInt(trailing, 10);
        const resp = await secureApiClient.put(`/api/edit/review_of_systems/${recordId}/edit`, payload);
        if (!resp || !resp.success) throw new Error((resp && resp.error) || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/review_of_systems/${recordId}/approve`);

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
      console.error('[ReviewOfSystems] Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // Get effective field value (local edit overrides original)
  const getFieldValue = useCallback((record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    return record[fieldName];
  }, [localEdits]);

  // pdfData — merges localEdits into records for PDF + Copy All
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return unwrappedData;
    return unwrappedData.map((record, idx) => {
      const merged = { ...record };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldName = editKey.substring(0, dashIdx);
        const recordIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recordIdx === idx) merged[fieldName] = editVal;
      }
      return merged;
    });
  }, [unwrappedData, localEdits, pendingEdits]);

  // Section fields mapping for sectionHasEdits
  const SECTION_FIELDS = {
    recordInfo: ['provider'],
    constitutional: ['constitutional'],
    heent: ['heent'],
    eyes: ['eyes'],
    ent: ['ent'],
    cardiovascular: ['cardiovascular'],
    respiratory: ['respiratory'],
    gastrointestinal: ['gastrointestinal'],
    musculoskeletal: ['musculoskeletal'],
    neurological: ['neurological'],
    endocrine: ['endocrine'],
    hematologic: ['hematologic'],
    skin: ['skin'],
    sleepSymptoms: ['sleepSymptoms'],
    findings: ['findings'],
    assessment: ['assessment'],
    plan: ['plan'],
    notes: ['notes'],
  };

  const sectionHasEdits = useCallback((sectionId, idx) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    const recordStatus = statusOverrides[idx] || 'active';
    if (recordStatus === 'approved') return false;
    return fields.some(f => {
      const sectionKey = `${sectionId}-${idx}`;
      return editedFields[sectionKey];
    });
  }, [editedFields, statusOverrides]);

  // Split a block of text into sentences (decimal/abbreviation-safe).
  const splitBySentence = (text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/)
      .map(s => s.trim().replace(/[;.]+$/, '').trim())
      .filter(s => s && !/^[;.,!?]+$/.test(s));
  };

  // PLAIN functions (NOT useCallback — avoid stale closure on editValue/localEdits).
  // Rebuild the full field text from all sentences, replacing index sIdx with the edited
  // sentence; restore a period on EVERY sentence so the stored value stays splittable.
  const reconstructFullText = (allSentences, sIdx, editedSentence) => {
    return allSentences
      .map((s, i) => {
        const t = i === sIdx ? editedSentence : s;
        return (t && !/[.!?]$/.test(t)) ? t + '.' : t;
      })
      .join(' ');
  };

  // Save ONE sentence within a sentence-split field: reconstruct the WHOLE field, then STAGE a DRAFT
  // (no DB write). localStorage keeps it across refresh; Approve commits it.
  const saveSentence = (record, fieldName, idx, sectionId, sIdx) => {
    const recordId = record._id ? (record._id.$oid || record._id) : null;
    if (!recordId) {
      console.error('[ReviewOfSystems] Cannot save — no record _id');
      return;
    }
    const editedSentence = editValue.trim();
    const fullEditKey = `${fieldName}-${idx}`;
    const sourceText = localEdits[fullEditKey] !== undefined ? localEdits[fullEditKey] : (record[fieldName] || '');
    const allCurrent = splitBySentence(sourceText);
    const fullText = allCurrent.length > 1
      ? reconstructFullText(allCurrent, sIdx, editedSentence)
      : (editedSentence && !/[.!?]$/.test(editedSentence) ? editedSentence + '.' : editedSentence);

    setLocalEdits(prev => ({ ...prev, [fullEditKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [fullEditKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [`${fieldName}-${idx}-s${sIdx}`]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));
    setApprovedSections(prev => {
      if (!prev[sectionId]) return prev;
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });

    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldName] = fullText;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  };

  // Convert a stored date value to a yyyy-mm-dd string for <input type="date">.
  const toInputDate = (dateValue) => {
    if (!dateValue) return '';
    try {
      const d = new Date(dateValue.$date || dateValue);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch { return ''; }
  };

  // Save an edited Date field (ISO value) — STAGE a DRAFT (no DB write). Approve commits it.
  const handleSaveDateField = useCallback((record, fieldName, idx, sectionId, isoValue) => {
    const recordId = record._id ? (record._id.$oid || record._id) : null;
    if (!recordId) { console.error('[ReviewOfSystems] Cannot save — no record _id'); return; }
    const editKey = `${fieldName}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: isoValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [`${editKey}-s0`]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));
    setApprovedSections(prev => { if (!prev[sectionId]) return prev; const next = { ...prev }; delete next[sectionId]; return next; });

    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldName] = isoValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, []);

  // Helper: render an editable Date field (date-picker, ISO save)
  const renderDateField = (record, idx, fieldName, label, dateValue, sectionId, copyId) => {
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const canEdit = !!record._id;
    const recordStatus = statusOverrides[idx] || 'active';
    const isRowEdited = editedSentences[editKey] === 'edited' && recordStatus !== 'approved';
    const displayValue = formatDate(dateValue);
    if (isEditing) {
      return (
        <div className="rec-mini-card" key={fieldName}>
          {label && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <input
                type="date"
                className="edit-date"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                ref={(el) => { if (el) { el.focus(); try { el.showPicker(); } catch { /* ignore */ } } }}
                onKeyDown={(e) => { if (e.key === 'Escape') handleCancelEdit(); }}
                disabled={saving}
              />
              <div className="edit-actions">
                <button
                  className="edit-save-btn"
                  onClick={() => {
                    if (!editValue || isNaN(new Date(editValue).getTime())) return;
                    handleSaveDateField(record, fieldName, idx, sectionId, editValue + 'T00:00:00.000Z');
                  }}
                  disabled={saving}
                >
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
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isRowEdited ? 'modified' : ''}`}>
          <div
            className={`row-content ${canEdit ? 'editable' : ''}`}
            onClick={() => { if (canEdit) { setEditingField(editKey); setEditValue(toInputDate(dateValue)); } }}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && (
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
        {isRowEdited && (
          <div className="modified-badge">edited — click pending approve to save</div>
        )}
      </div>
    );
  };

  // Helper: render a single editable field (sentence-split; each sentence is its OWN editable row)
  const renderEditableField = (record, idx, fieldName, label, displayValue, sectionId, copyId) => {
    const canEdit = !!record._id;
    const recordStatus = statusOverrides[idx] || 'active';
    const _sentences = splitBySentence(displayValue);
    const _multi = _sentences.length > 1;
    const _rows = _multi ? _sentences : [displayValue];
    const anyEdited = _rows.some((_, sIdx) => editedSentences[`${fieldName}-${idx}-s${sIdx}`] === 'edited') && recordStatus !== 'approved';

    return (
      <div className="rec-mini-card" key={fieldName}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        {_rows.map((sentence, sIdx) => {
          const editKey = `${fieldName}-${idx}-s${sIdx}`;
          const isEditing = editingField === editKey;
          const isRowEdited = editedSentences[editKey] === 'edited' && recordStatus !== 'approved';
          const rowCopyId = _multi ? `${copyId}-${sIdx}` : copyId;
          const displayRow = _multi ? `${sentence}${sentence.endsWith('.') ? '' : '.'}` : sentence;
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
                  />
                  <div className="edit-actions">
                    <button
                      className="edit-save-btn"
                      onClick={() => saveSentence(record, fieldName, idx, sectionId, sIdx)}
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
            <div key={sIdx} className={`numbered-row ${isRowEdited ? 'modified' : ''}`}>
              <div
                className={`row-content ${canEdit ? 'editable' : ''}`}
                onClick={() => canEdit && handleStartEdit(fieldName, idx, sentence, sIdx)}
                title={canEdit ? 'Click to edit' : undefined}
              >
                <span className="content-value">{highlightText(displayRow)}</span>
                {canEdit && (
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
                className={`copy-btn ${copiedId === rowCopyId ? 'copied' : ''}`}
                onClick={() => copyToClipboard(displayRow, rowCopyId)}
              >
                {copiedId === rowCopyId ? 'Copied!' : 'Copy'}
              </button>
            </div>
          );
        })}
        {anyEdited && (
          <div className="modified-badge">edited — click pending approve to save</div>
        )}
        {!anyEdited && approvedSections[sectionId] && (
          <div className="modified-badge approved">approved</div>
        )}
      </div>
    );
  };

  // ========================= COPY TEXT GENERATORS =========================
  const getSystemSectionText = (title, content) => {
    const lines = [title.toUpperCase(), '═══════════════════════════════════════'];
    const items = splitBySentence(content);
    items.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
    return lines.join('\n');
  };

  const getPsychiatricText = (psych) => {
    const lines = ['PSYCHIATRIC', '═══════════════════════════════════════'];
    if (typeof psych === 'string') {
      splitBySentence(psych).forEach((item, i) => lines.push(`${i + 1}. ${item}`));
    } else {
      if (psych.symptoms) {
        lines.push('Symptoms:');
        splitBySentence(psych.symptoms).forEach((item, i) => lines.push(`  ${i + 1}. ${item}`));
      }
      if (psych.phq9Score !== undefined) lines.push(`PHQ-9 Score: ${psych.phq9Score}`);
      if (psych.gad7Score !== undefined) lines.push(`GAD-7 Score: ${psych.gad7Score}`);
    }
    return lines.join('\n');
  };

  // Recursive object → copy lines
  const objectCopyLines = (label, value, indent) => {
    const pad = '  '.repeat(indent);
    const out = [];
    if (isEmptyDeep(value)) return out;
    if (isScalar(value)) { out.push(`${pad}${label ? label + ': ' : ''}${fmtScalar(value)}`); return out; }
    if (label) out.push(`${pad}${label}:`);
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectCopyLines(humanizeKey(k), v, indent + (label ? 1 : 0))));
    return out;
  };

  const getResultsText = (results) => {
    const lines = ['RESULTS', '═══════════════════════════════════════'];
    Object.entries(results || {}).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v, 0).forEach(l => lines.push(l)));
    return lines.join('\n');
  };

  const getRecommendationsText = (recs) => {
    const lines = ['RECOMMENDATIONS', '═══════════════════════════════════════'];
    let lastDate = null;
    let n = 1;
    (Array.isArray(recs) ? recs : []).forEach((r) => {
      const rec = (typeof r === 'string' ? r : r?.recommendation || '').trim();
      const date = (typeof r === 'string' ? '' : r?.date || '').trim();
      if (!rec) return;
      if (date !== lastDate) { if (date) lines.push(date); lastDate = date; n = 1; }
      lines.push(`${n++}. ${rec}`);
    });
    return lines.join('\n');
  };

  // ========================= RECURSIVE OBJECT RENDER (read-only) =========================
  const renderObjectLeaf = (path, value, copyKeyBase) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${copyKeyBase}-${path.join('.')}`;
    return (
      <div key={path.join('.')} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className="numbered-row">
          <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span></div>
          <button
            className={`copy-btn ${copiedId === leafKey ? 'copied' : ''}`}
            onClick={() => copyToClipboard(leafValueString, leafKey)}
          >
            {copiedId === leafKey ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    );
  };

  const renderObjectNode = (label, value, path, copyKeyBase, depth) => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) return renderObjectLeaf(path, value, copyKeyBase);
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('-') || 'root'}>
        {label && <div className={depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle'}>{highlightText(label)}</div>}
        <div className="nested-group">
          {entries.map(([k, v]) => (
            isScalar(v)
              ? renderObjectLeaf([...path, k], v, copyKeyBase)
              : <div className="nested-mini-card" key={k}>{renderObjectNode(humanizeKey(k), v, [...path, k], copyKeyBase, depth + 1)}</div>
          ))}
        </div>
      </React.Fragment>
    );
  };

  const getAllRecordText = (record, idx) => {
    const lines = [`REVIEW OF SYSTEMS ${idx + 1}`, '═══════════════════════════════════════', ''];

    // Record Info
    if (record.date) lines.push(`Date: ${formatDate(record.date)}`);
    if (record.provider) lines.push(`Provider: ${record.provider}`);
    if (record.facility) lines.push(`Facility: ${record.facility}`);
    lines.push('');

    // Body Systems
    const systems = [
      { key: 'constitutional', title: 'Constitutional' },
      { key: 'heent', title: 'HEENT' },
      { key: 'eyes', title: 'Eyes' },
      { key: 'ent', title: 'ENT' },
      { key: 'cardiovascular', title: 'Cardiovascular' },
      { key: 'respiratory', title: 'Respiratory' },
      { key: 'gastrointestinal', title: 'Gastrointestinal' },
      { key: 'musculoskeletal', title: 'Musculoskeletal' },
      { key: 'neurological', title: 'Neurological' },
      { key: 'endocrine', title: 'Endocrine' },
      { key: 'hematologic', title: 'Hematologic/Lymphatic' },
      { key: 'skin', title: 'Integumentary/Skin' },
      { key: 'sleepSymptoms', title: 'Sleep Symptoms' },
    ];

    systems.forEach(({ key, title }) => {
      if (record[key]) {
        lines.push(title.toUpperCase());
        splitBySentence(record[key]).forEach((item, i) => lines.push(`${i + 1}. ${item}`));
        lines.push('');
      }
    });

    // Genitourinary
    if (record.genitourinary) {
      lines.push('GENITOURINARY');
      if (typeof record.genitourinary === 'string') {
        splitBySentence(record.genitourinary).forEach((item, i) => lines.push(`${i + 1}. ${item}`));
      } else {
        if (record.genitourinary.symptoms) {
          splitBySentence(record.genitourinary.symptoms).forEach((item, i) => lines.push(`${i + 1}. ${item}`));
        }
      }
      lines.push('');
    }

    // Psychiatric
    if (record.psychiatric) {
      lines.push('PSYCHIATRIC');
      if (typeof record.psychiatric === 'string') {
        splitBySentence(record.psychiatric).forEach((item, i) => lines.push(`${i + 1}. ${item}`));
      } else {
        if (record.psychiatric.symptoms) {
          lines.push('Symptoms:');
          splitBySentence(record.psychiatric.symptoms).forEach((item, i) => lines.push(`  ${i + 1}. ${item}`));
        }
        if (record.psychiatric.phq9Score !== undefined) lines.push(`PHQ-9 Score: ${record.psychiatric.phq9Score}`);
        if (record.psychiatric.gad7Score !== undefined) lines.push(`GAD-7 Score: ${record.psychiatric.gad7Score}`);
      }
      lines.push('');
    }

    // Findings, Assessment, Plan
    if (record.findings) {
      lines.push('FINDINGS');
      lines.push(record.findings);
      lines.push('');
    }
    if (record.assessment) {
      lines.push('ASSESSMENT');
      lines.push(record.assessment);
      lines.push('');
    }
    if (record.plan) {
      lines.push('PLAN');
      lines.push(record.plan);
      lines.push('');
    }

    // Results
    if (record.results && !isEmptyDeep(record.results)) {
      lines.push(getResultsText(record.results));
      lines.push('');
    }

    // Recommendations
    if (record.recommendations && !isEmptyDeep(record.recommendations)) {
      lines.push(getRecommendationsText(record.recommendations));
      lines.push('');
    }

    // Notes
    if (record.notes) {
      lines.push('NOTES');
      parseNotesWithLabels(record.notes).forEach((item, i) => {
        if (item.label) {
          lines.push(`${item.label}: ${item.content}`);
        } else {
          lines.push(`${i + 1}. ${item.content}`);
        }
      });
    }

    return lines.join('\n');
  };

  // ========================= FILTERED DATA =========================
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return unwrappedData.map(r => ({ ...r, _showAllSections: false }));

    const phrase = searchTerm.toLowerCase().trim();

    return unwrappedData
      .map((record, idx) => {
        // Build searchable text
        const searchableText = [
          `Review of Systems ${idx + 1}`, 'review of systems',
          // Section titles with case variations
          'Record Info', 'record info', 'RECORD INFO',
          'Constitutional', 'constitutional', 'CONSTITUTIONAL',
          'HEENT', 'heent', 'Eyes', 'eyes', 'ENT', 'ent',
          'Cardiovascular', 'cardiovascular', 'CARDIOVASCULAR',
          'Respiratory', 'respiratory', 'RESPIRATORY',
          'Gastrointestinal', 'gastrointestinal', 'GASTROINTESTINAL',
          'Genitourinary', 'genitourinary', 'GENITOURINARY',
          'Musculoskeletal', 'musculoskeletal', 'MUSCULOSKELETAL',
          'Neurological', 'neurological', 'NEUROLOGICAL',
          'Psychiatric', 'psychiatric', 'PSYCHIATRIC',
          'Endocrine', 'endocrine', 'ENDOCRINE',
          'Hematologic', 'hematologic', 'Lymphatic', 'lymphatic',
          'Integumentary', 'integumentary', 'Skin', 'skin',
          'Sleep Symptoms', 'sleep symptoms', 'SLEEP SYMPTOMS',
          'Findings', 'findings', 'FINDINGS',
          'Assessment', 'assessment', 'ASSESSMENT',
          'Plan', 'plan', 'PLAN',
          'Results', 'results', 'RESULTS',
          'Recommendations', 'recommendations', 'RECOMMENDATIONS',
          'Notes', 'notes', 'NOTES',
          // Field labels
          'Date', 'date', 'Provider', 'provider', 'Facility', 'facility',
          'PHQ-9', 'phq-9', 'PHQ-9 Score', 'GAD-7', 'gad-7', 'GAD-7 Score',
          'Symptoms', 'symptoms',
          // Values
          formatDate(record.date),
          record.provider,
          record.facility,
          record.constitutional,
          record.heent,
          record.eyes,
          record.ent,
          record.cardiovascular,
          record.respiratory,
          record.gastrointestinal,
          record.musculoskeletal,
          record.neurological,
          record.endocrine,
          record.hematologic,
          record.skin,
          record.sleepSymptoms,
          record.findings,
          record.assessment,
          record.plan,
          record.results ? objectCopyLines('', record.results, 0).join(' ') : '',
          Array.isArray(record.recommendations) ? record.recommendations.map(r => (typeof r === 'string' ? r : `${r?.recommendation || ''} ${r?.date || ''}`)).join(' ') : '',
          record.notes,
          // Object fields
          typeof record.genitourinary === 'object' ? record.genitourinary?.symptoms : record.genitourinary,
          typeof record.psychiatric === 'object' ? record.psychiatric?.symptoms : record.psychiatric,
          typeof record.psychiatric === 'object' && record.psychiatric?.phq9Score !== undefined ? String(record.psychiatric.phq9Score) : '',
          typeof record.psychiatric === 'object' && record.psychiatric?.gad7Score !== undefined ? String(record.psychiatric.gad7Score) : '',
        ].filter(Boolean).join(' ').toLowerCase();

        if (!searchableText.includes(phrase)) return null;

        // Check if searching for record title
        const recordTitlePattern = new RegExp(`^review\\s+of\\s+systems\\s*${idx + 1}?$`, 'i');
        const _showAllSections = recordTitlePattern.test(phrase) || phrase === 'review of systems';

        return { ...record, _showAllSections };
      })
      .filter(Boolean);
  }, [unwrappedData, searchTerm]);

  // ========================= PHQ-9/GAD-7 SEVERITY =========================
  const getPHQ9Severity = (score) => {
    if (score >= 20) return { label: 'Severe', color: '#ef4444' };
    if (score >= 15) return { label: 'Moderately Severe', color: '#f97316' };
    if (score >= 10) return { label: 'Moderate', color: '#eab308' };
    if (score >= 5) return { label: 'Mild', color: '#22c55e' };
    return { label: 'Minimal', color: '#3b82f6' };
  };

  const getGAD7Severity = (score) => {
    if (score >= 15) return { label: 'Severe', color: '#ef4444' };
    if (score >= 10) return { label: 'Moderate', color: '#f97316' };
    if (score >= 5) return { label: 'Mild', color: '#eab308' };
    return { label: 'Minimal', color: '#3b82f6' };
  };

  // ========================= RENDER =========================
  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <div className="review-of-systems-document">
        <div className="empty-state">No review of systems records available.</div>
      </div>
    );
  }

  return (
    <div className="review-of-systems-document">
      {/* ========================= DOCUMENT HEADER ========================= */}
      <div className="document-header">
        <h1 className="document-title">Review of Systems</h1>
        <div className="header-actions">
          <button
            className={`copy-btn ${copiedId === 'all-documents' ? 'copied' : ''}`}
            onClick={() => {
              const allText = pdfData.map((r, i) => getAllRecordText(r, i)).join('\n\n');
              copyToClipboard(allText, 'all-documents');
            }}
          >
            {copiedId === 'all-documents' ? 'Copied' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<ReviewOfSystemsDocumentPDFTemplate document={pdfData} />}
            fileName="Review_of_Systems.pdf"
            className="pdf-btn"
          >
            {({ loading }) => (loading ? 'Preparing...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search review of systems..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="search-clear" onClick={() => setSearchTerm('')}>×</button>
          )}
        </div>
      </div>

      {/* ========================= NO RESULTS ========================= */}
      {filteredRecords.length === 0 && searchTerm.trim() && (
        <div className="no-results">No results found for "{searchTerm}"</div>
      )}

      {/* ========================= RECORDS ========================= */}
      <div className="records-container">
        {filteredRecords.map((record, idx) => {
          const isSearching = searchTerm.trim() !== '';
          const canEdit = !!record._id;
          const recordStatus = statusOverrides[idx] || 'active';

          return (
            <div key={record._id || idx} className="record-card">
              {/* Record Header */}
              <div className="record-header">
                <div className="header-top-row">
                  {record.date && <span className="date-badge">{formatDate(record.date)}</span>}
                </div>
                <h2 className="record-title">{highlightText(`Review of Systems ${idx + 1}`)}</h2>
              </div>

              {/* ========================= RECORD INFO SECTION ========================= */}
              {(() => {
                const recordInfoMatches = (() => {
                  if (!isSearching || record._showAllSections) return true;
                  return shouldShowRow(record, 'Record Info', 'record info', 'RECORD INFO');
                })();

                const hasDate = record.date && (recordInfoMatches || shouldShowRow(record, 'Date', 'date', formatDate(record.date)));
                const providerVal = getFieldValue(record, 'provider', idx);
                const hasProvider = providerVal && (recordInfoMatches || shouldShowRow(record, 'Provider', 'provider', providerVal));
                const hasFacility = record.facility && (recordInfoMatches || shouldShowRow(record, 'Facility', 'facility', record.facility));

                if (!hasDate && !hasProvider && !hasFacility) return null;

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Record Info')}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`copy-btn ${copiedSectionId === `record-info-${idx}` ? 'copied' : ''}`}
                            onClick={() => {
                              const lines = ['RECORD INFO', '═══════════════════════════════════════'];
                              if (record.date) lines.push(`Date: ${formatDate(record.date)}`);
                              if (providerVal) lines.push(`Provider: ${providerVal}`);
                              if (record.facility) lines.push(`Facility: ${record.facility}`);
                              copySectionToClipboard(lines.join('\n'), `record-info-${idx}`);
                            }}
                          >
                            {copiedSectionId === `record-info-${idx}` ? 'Copied!' : 'Copy Section'}
                          </button>
                          {(sectionHasEdits('recordInfo', idx) || approvedSections['recordInfo']) && (
                            <button
                              className={`approve-btn${approvedSections['recordInfo'] ? ' approved' : ' pending'}`}
                              onClick={() => handleApprove(record, idx, 'recordInfo')}
                              disabled={approving}
                            >
                              {approving ? 'Approving...' : approvedSections['recordInfo'] ? 'Approved' : 'Pending Approve'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Date — read-only */}
                      {hasDate && renderDateField(record, idx, 'date', 'Date', (localEdits[`date-${idx}`] !== undefined ? localEdits[`date-${idx}`] : record.date), 'recordInfo', `date-${idx}`)}

                      {/* Provider — editable */}
                      {hasProvider &&
                        renderEditableField(record, idx, 'provider', 'Provider', providerVal, 'recordInfo', `provider-${idx}`)
                      }

                      {/* Facility — read-only */}
                      {hasFacility && (
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
                );
              })()}

              {/* ========================= BODY SYSTEMS SECTIONS — EDITABLE ========================= */}
              {[
                { key: 'constitutional', title: 'Constitutional', searchTerms: ['Constitutional', 'constitutional', 'CONSTITUTIONAL'] },
                { key: 'heent', title: 'HEENT', searchTerms: ['HEENT', 'heent'] },
                { key: 'eyes', title: 'Eyes', searchTerms: ['Eyes', 'eyes', 'EYES'] },
                { key: 'ent', title: 'ENT', searchTerms: ['ENT', 'ent'] },
                { key: 'cardiovascular', title: 'Cardiovascular', searchTerms: ['Cardiovascular', 'cardiovascular', 'CARDIOVASCULAR'] },
                { key: 'respiratory', title: 'Respiratory', searchTerms: ['Respiratory', 'respiratory', 'RESPIRATORY'] },
                { key: 'gastrointestinal', title: 'Gastrointestinal', searchTerms: ['Gastrointestinal', 'gastrointestinal', 'GASTROINTESTINAL'] },
                { key: 'musculoskeletal', title: 'Musculoskeletal', searchTerms: ['Musculoskeletal', 'musculoskeletal', 'MUSCULOSKELETAL'] },
                { key: 'neurological', title: 'Neurological', searchTerms: ['Neurological', 'neurological', 'NEUROLOGICAL'] },
                { key: 'endocrine', title: 'Endocrine', searchTerms: ['Endocrine', 'endocrine', 'ENDOCRINE'] },
                { key: 'hematologic', title: 'Hematologic/Lymphatic', searchTerms: ['Hematologic', 'hematologic', 'Lymphatic', 'lymphatic'] },
                { key: 'skin', title: 'Integumentary/Skin', searchTerms: ['Integumentary', 'integumentary', 'Skin', 'skin'] },
                { key: 'sleepSymptoms', title: 'Sleep Symptoms', searchTerms: ['Sleep Symptoms', 'sleep symptoms', 'SLEEP SYMPTOMS', 'Sleep', 'sleep'] },
              ].map(({ key, title, searchTerms }) => {
                const fieldVal = getFieldValue(record, key, idx);
                if (!fieldVal) return null;

                const sectionTitleMatches = (() => {
                  if (!isSearching || record._showAllSections) return true;
                  return shouldShowRow(record, ...searchTerms);
                })();

                // Check if any content matches search
                const items = splitBySentence(fieldVal);
                const visibleItems = items.filter(item =>
                  sectionTitleMatches || shouldShowRow(record, item)
                );

                if (visibleItems.length === 0) return null;

                // Determine if section has pending edits
                const hasSectionEdits = sectionHasEdits(key, idx);

                return (
                  <div key={key} className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText(title)}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`copy-btn ${copiedSectionId === `${key}-${idx}` ? 'copied' : ''}`}
                            onClick={() => copySectionToClipboard(getSystemSectionText(title, fieldVal), `${key}-${idx}`)}
                          >
                            {copiedSectionId === `${key}-${idx}` ? 'Copied!' : 'Copy Section'}
                          </button>
                          {(hasSectionEdits || approvedSections[key]) && (
                            <button
                              className={`approve-btn${approvedSections[key] ? ' approved' : ' pending'}`}
                              onClick={() => handleApprove(record, idx, key)}
                              disabled={approving}
                            >
                              {approving ? 'Approving...' : approvedSections[key] ? 'Approved' : 'Pending Approve'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Editable field — entire field as one editable block */}
                      {renderEditableField(record, idx, key, null, fieldVal, key, `${key}-${idx}-field`)}
                    </div>
                  </div>
                );
              })}

              {/* ========================= GENITOURINARY SECTION — NON-EDITABLE ========================= */}
              {record.genitourinary && (() => {
                const sectionTitleMatches = (() => {
                  if (!isSearching || record._showAllSections) return true;
                  return shouldShowRow(record, 'Genitourinary', 'genitourinary', 'GENITOURINARY');
                })();

                if (typeof record.genitourinary === 'string') {
                  const items = splitBySentence(record.genitourinary);
                  const visibleItems = items.filter(item => sectionTitleMatches || shouldShowRow(record, item));
                  if (visibleItems.length === 0) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h3 className="section-title">{highlightText('Genitourinary')}</h3>
                          <button
                            className={`copy-btn ${copiedSectionId === `gu-${idx}` ? 'copied' : ''}`}
                            onClick={() => copySectionToClipboard(getSystemSectionText('Genitourinary', record.genitourinary), `gu-${idx}`)}
                          >
                            {copiedSectionId === `gu-${idx}` ? 'Copied!' : 'Copy Section'}
                          </button>
                        </div>
                        {visibleItems.map((item, itemIdx) => (
                          <div key={itemIdx} className="numbered-row">
                            <div className="row-content">
                              <span className="content-value">{highlightText(item)}</span>
                            </div>
                            <button
                              className={`copy-btn ${copiedId === `gu-${idx}-${itemIdx}` ? 'copied' : ''}`}
                              onClick={() => copyToClipboard(item, `gu-${idx}-${itemIdx}`)}
                            >
                              {copiedId === `gu-${idx}-${itemIdx}` ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                // Object format
                const gu = record.genitourinary;
                const symptoms = gu.symptoms ? splitBySentence(gu.symptoms) : [];
                const visibleSymptoms = symptoms.filter(s => sectionTitleMatches || shouldShowRow(record, 'Symptoms', 'symptoms', s));

                if (visibleSymptoms.length === 0) return null;

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Genitourinary')}</h3>
                        <button
                          className={`copy-btn ${copiedSectionId === `gu-${idx}` ? 'copied' : ''}`}
                          onClick={() => {
                            const lines = ['GENITOURINARY', '═══════════════════════════════════════'];
                            if (gu.symptoms) {
                              lines.push('Symptoms:');
                              splitBySentence(gu.symptoms).forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
                            }
                            copySectionToClipboard(lines.join('\n'), `gu-${idx}`);
                          }}
                        >
                          {copiedSectionId === `gu-${idx}` ? 'Copied!' : 'Copy Section'}
                        </button>
                      </div>
                      <div className="rec-mini-card">
                        <div className="nested-subtitle">{highlightText('Symptoms')}</div>
                        {visibleSymptoms.map((symptom, sIdx) => (
                          <div key={sIdx} className="numbered-row">
                            <div className="row-content">
                              <span className="content-value">{highlightText(symptom)}</span>
                            </div>
                            <button
                              className={`copy-btn ${copiedId === `gu-symptom-${idx}-${sIdx}` ? 'copied' : ''}`}
                              onClick={() => copyToClipboard(symptom, `gu-symptom-${idx}-${sIdx}`)}
                            >
                              {copiedId === `gu-symptom-${idx}-${sIdx}` ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ========================= PSYCHIATRIC SECTION — NON-EDITABLE ========================= */}
              {record.psychiatric && (() => {
                const sectionTitleMatches = (() => {
                  if (!isSearching || record._showAllSections) return true;
                  return shouldShowRow(record, 'Psychiatric', 'psychiatric', 'PSYCHIATRIC');
                })();

                if (typeof record.psychiatric === 'string') {
                  const items = splitBySentence(record.psychiatric);
                  const visibleItems = items.filter(item => sectionTitleMatches || shouldShowRow(record, item));
                  if (visibleItems.length === 0) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h3 className="section-title">{highlightText('Psychiatric')}</h3>
                          <button
                            className={`copy-btn ${copiedSectionId === `psych-${idx}` ? 'copied' : ''}`}
                            onClick={() => copySectionToClipboard(getSystemSectionText('Psychiatric', record.psychiatric), `psych-${idx}`)}
                          >
                            {copiedSectionId === `psych-${idx}` ? 'Copied!' : 'Copy Section'}
                          </button>
                        </div>
                        {visibleItems.map((item, itemIdx) => (
                          <div key={itemIdx} className="numbered-row">
                            <div className="row-content">
                              <span className="content-value">{highlightText(item)}</span>
                            </div>
                            <button
                              className={`copy-btn ${copiedId === `psych-${idx}-${itemIdx}` ? 'copied' : ''}`}
                              onClick={() => copyToClipboard(item, `psych-${idx}-${itemIdx}`)}
                            >
                              {copiedId === `psych-${idx}-${itemIdx}` ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                // Object format with symptoms and scores
                const psych = record.psychiatric;
                const symptoms = psych.symptoms ? splitBySentence(psych.symptoms) : [];
                const visibleSymptoms = symptoms.filter(s => sectionTitleMatches || shouldShowRow(record, 'Symptoms', 'symptoms', s));
                const showPHQ9 = psych.phq9Score !== undefined && (sectionTitleMatches || shouldShowRow(record, 'PHQ-9', 'phq-9', 'PHQ-9 Score', String(psych.phq9Score)));
                const showGAD7 = psych.gad7Score !== undefined && (sectionTitleMatches || shouldShowRow(record, 'GAD-7', 'gad-7', 'GAD-7 Score', String(psych.gad7Score)));

                if (visibleSymptoms.length === 0 && !showPHQ9 && !showGAD7) return null;

                const phq9Severity = psych.phq9Score !== undefined ? getPHQ9Severity(psych.phq9Score) : null;
                const gad7Severity = psych.gad7Score !== undefined ? getGAD7Severity(psych.gad7Score) : null;

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Psychiatric')}</h3>
                        <button
                          className={`copy-btn ${copiedSectionId === `psych-${idx}` ? 'copied' : ''}`}
                          onClick={() => copySectionToClipboard(getPsychiatricText(psych), `psych-${idx}`)}
                        >
                          {copiedSectionId === `psych-${idx}` ? 'Copied!' : 'Copy Section'}
                        </button>
                      </div>

                      {/* Symptoms */}
                      {visibleSymptoms.length > 0 && (
                        <div className="rec-mini-card">
                          <div className="nested-subtitle">{highlightText('Symptoms')}</div>
                          {visibleSymptoms.map((symptom, sIdx) => (
                            <div key={sIdx} className="numbered-row">
                              <div className="row-content">
                                <span className="content-value">{highlightText(symptom)}</span>
                              </div>
                              <button
                                className={`copy-btn ${copiedId === `psych-symptom-${idx}-${sIdx}` ? 'copied' : ''}`}
                                onClick={() => copyToClipboard(symptom, `psych-symptom-${idx}-${sIdx}`)}
                              >
                                {copiedId === `psych-symptom-${idx}-${sIdx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* PHQ-9 Score with Bar Chart */}
                      {showPHQ9 && (
                        <div className="rec-mini-card">
                          <div className="nested-subtitle">{highlightText('PHQ-9 Score')}</div>
                          <div className="score-row">
                            <div className="score-value">{psych.phq9Score}</div>
                            <div className="score-bar-container">
                              <div
                                className="score-bar"
                                style={{
                                  width: `${Math.min((psych.phq9Score / 27) * 100, 100)}%`,
                                  backgroundColor: phq9Severity.color,
                                }}
                              />
                            </div>
                            <span className="severity-badge" style={{ backgroundColor: phq9Severity.color }}>
                              {phq9Severity.label}
                            </span>
                          </div>
                          <div className="score-scale">0 — 5 (Minimal) — 10 (Moderate) — 15 (Mod. Severe) — 20 (Severe) — 27</div>
                        </div>
                      )}

                      {/* GAD-7 Score with Bar Chart */}
                      {showGAD7 && (
                        <div className="rec-mini-card">
                          <div className="nested-subtitle">{highlightText('GAD-7 Score')}</div>
                          <div className="score-row">
                            <div className="score-value">{psych.gad7Score}</div>
                            <div className="score-bar-container">
                              <div
                                className="score-bar"
                                style={{
                                  width: `${Math.min((psych.gad7Score / 21) * 100, 100)}%`,
                                  backgroundColor: gad7Severity.color,
                                }}
                              />
                            </div>
                            <span className="severity-badge" style={{ backgroundColor: gad7Severity.color }}>
                              {gad7Severity.label}
                            </span>
                          </div>
                          <div className="score-scale">0 — 5 (Mild) — 10 (Moderate) — 15 (Severe) — 21</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ========================= FINDINGS SECTION — EDITABLE ========================= */}
              {(() => {
                const findingsVal = getFieldValue(record, 'findings', idx);
                if (!findingsVal) return null;
                const sectionTitleMatches = (() => {
                  if (!isSearching || record._showAllSections) return true;
                  return shouldShowRow(record, 'Findings', 'findings', 'FINDINGS', findingsVal);
                })();
                if (!sectionTitleMatches) return null;

                const hasSectionEdits = sectionHasEdits('findings', idx);

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Findings')}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`copy-btn ${copiedSectionId === `findings-${idx}` ? 'copied' : ''}`}
                            onClick={() => copySectionToClipboard(`FINDINGS\n${'═'.repeat(39)}\n${findingsVal}`, `findings-${idx}`)}
                          >
                            {copiedSectionId === `findings-${idx}` ? 'Copied!' : 'Copy Section'}
                          </button>
                          {(hasSectionEdits || approvedSections['findings']) && (
                            <button
                              className={`approve-btn${approvedSections['findings'] ? ' approved' : ' pending'}`}
                              onClick={() => handleApprove(record, idx, 'findings')}
                              disabled={approving}
                            >
                              {approving ? 'Approving...' : approvedSections['findings'] ? 'Approved' : 'Pending Approve'}
                            </button>
                          )}
                        </div>
                      </div>
                      {renderEditableField(record, idx, 'findings', null, findingsVal, 'findings', `findings-${idx}-field`)}
                    </div>
                  </div>
                );
              })()}

              {/* ========================= ASSESSMENT SECTION — EDITABLE ========================= */}
              {(() => {
                const assessmentVal = getFieldValue(record, 'assessment', idx);
                if (!assessmentVal) return null;
                const sectionTitleMatches = (() => {
                  if (!isSearching || record._showAllSections) return true;
                  return shouldShowRow(record, 'Assessment', 'assessment', 'ASSESSMENT', assessmentVal);
                })();
                if (!sectionTitleMatches) return null;

                const hasSectionEdits = sectionHasEdits('assessment', idx);

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Assessment')}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`copy-btn ${copiedSectionId === `assessment-${idx}` ? 'copied' : ''}`}
                            onClick={() => copySectionToClipboard(`ASSESSMENT\n${'═'.repeat(39)}\n${assessmentVal}`, `assessment-${idx}`)}
                          >
                            {copiedSectionId === `assessment-${idx}` ? 'Copied!' : 'Copy Section'}
                          </button>
                          {(hasSectionEdits || approvedSections['assessment']) && (
                            <button
                              className={`approve-btn${approvedSections['assessment'] ? ' approved' : ' pending'}`}
                              onClick={() => handleApprove(record, idx, 'assessment')}
                              disabled={approving}
                            >
                              {approving ? 'Approving...' : approvedSections['assessment'] ? 'Approved' : 'Pending Approve'}
                            </button>
                          )}
                        </div>
                      </div>
                      {renderEditableField(record, idx, 'assessment', null, assessmentVal, 'assessment', `assessment-${idx}-field`)}
                    </div>
                  </div>
                );
              })()}

              {/* ========================= PLAN SECTION — EDITABLE ========================= */}
              {(() => {
                const planVal = getFieldValue(record, 'plan', idx);
                if (!planVal) return null;
                const sectionTitleMatches = (() => {
                  if (!isSearching || record._showAllSections) return true;
                  return shouldShowRow(record, 'Plan', 'plan', 'PLAN', planVal);
                })();
                if (!sectionTitleMatches) return null;

                const hasSectionEdits = sectionHasEdits('plan', idx);

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Plan')}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`copy-btn ${copiedSectionId === `plan-${idx}` ? 'copied' : ''}`}
                            onClick={() => copySectionToClipboard(`PLAN\n${'═'.repeat(39)}\n${planVal}`, `plan-${idx}`)}
                          >
                            {copiedSectionId === `plan-${idx}` ? 'Copied!' : 'Copy Section'}
                          </button>
                          {(hasSectionEdits || approvedSections['plan']) && (
                            <button
                              className={`approve-btn${approvedSections['plan'] ? ' approved' : ' pending'}`}
                              onClick={() => handleApprove(record, idx, 'plan')}
                              disabled={approving}
                            >
                              {approving ? 'Approving...' : approvedSections['plan'] ? 'Approved' : 'Pending Approve'}
                            </button>
                          )}
                        </div>
                      </div>
                      {renderEditableField(record, idx, 'plan', null, planVal, 'plan', `plan-${idx}-field`)}
                    </div>
                  </div>
                );
              })()}

              {/* ========================= RESULTS SECTION — OBJECT (recursive, read-only) ========================= */}
              {record.results && !isEmptyDeep(record.results) && (() => {
                const sectionTitleMatches = (() => {
                  if (!isSearching || record._showAllSections) return true;
                  return shouldShowRow(record, 'Results', 'results', 'RESULTS', objectCopyLines('', record.results, 0).join(' '));
                })();
                if (!sectionTitleMatches) return null;

                const entries = Object.entries(record.results).filter(([, v]) => !isEmptyDeep(v));
                if (entries.length === 0) return null;

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Results')}</h3>
                        <button
                          className={`copy-btn ${copiedSectionId === `results-${idx}` ? 'copied' : ''}`}
                          onClick={() => copySectionToClipboard(getResultsText(record.results), `results-${idx}`)}
                        >
                          {copiedSectionId === `results-${idx}` ? 'Copied!' : 'Copy Section'}
                        </button>
                      </div>
                      <div className="rec-mini-card">
                        {entries.map(([k, v]) => (
                          isScalar(v)
                            ? renderObjectLeaf([k], v, `results-${idx}`)
                            : <div className="nested-mini-card" key={k}>{renderObjectNode(humanizeKey(k), v, [k], `results-${idx}`, 1)}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ========================= RECOMMENDATIONS SECTION — ARRAY (date-grouped, read-only) ========================= */}
              {record.recommendations && !isEmptyDeep(record.recommendations) && (() => {
                const recs = Array.isArray(record.recommendations) ? record.recommendations : [];
                const flatText = recs.map(r => (typeof r === 'string' ? r : `${r?.recommendation || ''} ${r?.date || ''}`)).join(' ');
                const sectionTitleMatches = (() => {
                  if (!isSearching || record._showAllSections) return true;
                  return shouldShowRow(record, 'Recommendations', 'recommendations', 'RECOMMENDATIONS', flatText);
                })();
                if (!sectionTitleMatches) return null;

                // Group by date (consecutive)
                const groups = [];
                recs.forEach((r) => {
                  const rec = (typeof r === 'string' ? r : r?.recommendation || '').trim();
                  const date = (typeof r === 'string' ? '' : r?.date || '').trim();
                  if (!rec) return;
                  const last = groups[groups.length - 1];
                  if (last && last.date === date) last.items.push(rec);
                  else groups.push({ date, items: [rec] });
                });
                if (groups.length === 0) return null;

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Recommendations')}</h3>
                        <button
                          className={`copy-btn ${copiedSectionId === `recommendations-${idx}` ? 'copied' : ''}`}
                          onClick={() => copySectionToClipboard(getRecommendationsText(record.recommendations), `recommendations-${idx}`)}
                        >
                          {copiedSectionId === `recommendations-${idx}` ? 'Copied!' : 'Copy Section'}
                        </button>
                      </div>
                      <div className="rec-mini-card">
                        {groups.map((group, gIdx) => (
                          <div key={gIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                            {group.date && <div className="nested-subtitle">{highlightText(group.date)}</div>}
                            {group.items.map((rec, rIdx) => {
                              const itemKey = `rec-${idx}-${gIdx}-${rIdx}`;
                              return (
                                <div key={rIdx} className="numbered-row">
                                  <div className="row-content">
                                    <span className="content-value">{highlightText(rec)}</span>
                                  </div>
                                  <button
                                    className={`copy-btn ${copiedId === itemKey ? 'copied' : ''}`}
                                    onClick={() => copyToClipboard(rec, itemKey)}
                                  >
                                    {copiedId === itemKey ? 'Copied!' : 'Copy'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ========================= NOTES SECTION — EDITABLE ========================= */}
              {(() => {
                const notesVal = getFieldValue(record, 'notes', idx);
                if (!notesVal) return null;
                const sectionTitleMatches = (() => {
                  if (!isSearching || record._showAllSections) return true;
                  return shouldShowRow(record, 'Notes', 'notes', 'NOTES', notesVal);
                })();
                if (!sectionTitleMatches) return null;

                const hasSectionEdits = sectionHasEdits('notes', idx);

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Notes')}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`copy-btn ${copiedSectionId === `notes-${idx}` ? 'copied' : ''}`}
                            onClick={() => {
                              const lines = ['NOTES', '═══════════════════════════════════════'];
                              parseNotesWithLabels(notesVal).forEach((item, i) => {
                                if (item.label) {
                                  lines.push(`${item.label}: ${item.content}`);
                                } else {
                                  lines.push(`${i + 1}. ${item.content}`);
                                }
                              });
                              copySectionToClipboard(lines.join('\n'), `notes-${idx}`);
                            }}
                          >
                            {copiedSectionId === `notes-${idx}` ? 'Copied!' : 'Copy Section'}
                          </button>
                          {(hasSectionEdits || approvedSections['notes']) && (
                            <button
                              className={`approve-btn${approvedSections['notes'] ? ' approved' : ' pending'}`}
                              onClick={() => handleApprove(record, idx, 'notes')}
                              disabled={approving}
                            >
                              {approving ? 'Approving...' : approvedSections['notes'] ? 'Approved' : 'Pending Approve'}
                            </button>
                          )}
                        </div>
                      </div>
                      {renderEditableField(record, idx, 'notes', null, notesVal, 'notes', `notes-${idx}-field`)}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReviewOfSystemsDocument;
