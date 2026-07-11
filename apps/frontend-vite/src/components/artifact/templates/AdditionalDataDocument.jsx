import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import SearchBar from '../components/SearchBar';
import AdditionalDataPDFTemplate from '../pdf-templates/AdditionalDataPDFTemplate';
import './AdditionalDataDocument.css';

/* ── helpers ─────────────────────────────────────────────── */

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

const formatDate = (dateString) => {
  if (!dateString) return null;
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return null;
  }
};

const isSystemField = (key) =>
  key.startsWith('_') || ['createdAt', 'updatedAt', 'patientId', 'practiceId', 'approvedSections', 'approvalTimestamp', 'approvedBy', 'updatedBy'].includes(key);

const capitalize = (str) =>
  str.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = field name, possibly dotted) */
const DRAFT_KEY = 'additional_dataPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/**
 * Additional Data Document — Flexible overflow/specialized data display
 * with inline editing, per-sentence editing, and per-record approve
 */
const AdditionalDataDocument = ({ document: doc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  /* ── editing state ──────────────────────────────────────── */
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const textareaRef = useRef(null);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  // Kept unconditional (before the early return) so it never violates the rules of hooks; it recomputes
  // the unwrapped records from `doc` exactly like the body below.
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    if (!doc) return;
    const d = doc.documentData || doc.data || doc;
    let records = [];
    if (Array.isArray(doc)) records = doc;
    else if (d.additional_data) records = Array.isArray(d.additional_data) ? d.additional_data : [d.additional_data];
    else if (d.data?.additional_data) records = Array.isArray(d.data.additional_data) ? d.data.additional_data : [d.data.additional_data];
    else if (Array.isArray(d)) records = d;
    else records = [d];
    if (!Array.isArray(records)) records = [];

    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const recordId = record && (record._id?.$oid || record._id);
      const recDrafts = recordId ? store[recordId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = true;
        nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [doc]);

  /* ── data unwrap ────────────────────────────────────────── */
  if (!doc) {
    return (
      <div className="additional-data-document">
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <p className="empty-text">No additional data available</p>
        </div>
      </div>
    );
  }

  const data = doc.documentData || doc.data || doc;
  let unwrappedData = [];
  if (Array.isArray(doc)) {
    unwrappedData = doc;
  } else if (data.additional_data) {
    unwrappedData = Array.isArray(data.additional_data) ? data.additional_data : [data.additional_data];
  } else if (data.data?.additional_data) {
    unwrappedData = Array.isArray(data.data.additional_data) ? data.data.additional_data : [data.data.additional_data];
  } else if (Array.isArray(data)) {
    unwrappedData = data;
  } else {
    unwrappedData = [data];
  }
  if (!Array.isArray(unwrappedData)) unwrappedData = [];

  /* ── getFieldValue (reads localEdits first) ─────────────── */
  const getFieldValue = useCallback((record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    return record[fieldName];
  }, [localEdits]);

  /* ── editing handlers ───────────────────────────────────── */
  const handleStartEdit = useCallback((fieldName, idx, currentValue, sentenceIdx = 0) => {
    const editKey = `${fieldName}-${idx}-s${sentenceIdx}`;
    setEditingField(editKey);
    const cleanValue = (currentValue || '').replace(/[.;]+$/, '').trim();
    setEditValue(cleanValue);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, sentenceIdx, valueOverride, editTrackingKey) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) { console.error('Cannot save — no record _id'); return; }
    const saveValue = valueOverride !== undefined ? valueOverride : editValue.trim();
    const sKey = editTrackingKey || `${fieldName}-${idx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;
    const fullEditKey = `${fieldName}-${idx}`;

    setLocalEdits(prev => ({ ...prev, [fullEditKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [fullEditKey]: true }));
    setEditedFields(prev => ({ ...prev, [fullEditKey]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    // Re-edit after approval → drop this record's approved flag so the button returns to yellow Pending Approve
    setApprovedSections(prev => { const u = { ...prev }; delete u[`record-${idx}`]; return u; });

    // Stage the draft in localStorage (key = field name, possibly dotted). NO DB write here.
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldName] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  /* ── reconstructFullText — PLAIN FUNCTION ───────────────── */
  const reconstructFullText = (allSentences, sIdx, editedSentence, fieldName, idx, hasFullEdit) => {
    const updated = allSentences.map((s, i) => {
      let t;
      if (i === sIdx) {
        t = editedSentence;
      } else if (!hasFullEdit) {
        const pKey = `${fieldName}.s${i}-${idx}`;
        t = localEdits[pKey] !== undefined ? localEdits[pKey] : s;
      } else {
        t = s;
      }
      return (t && !/[.!?]$/.test(t)) ? t + '.' : t;
    });
    return updated.join(' ');
  };

  /* ── saveSentence — PLAIN FUNCTION ──────────────────────── */
  const saveSentence = (record, fieldName, idx, sectionId, sIdx) => {
    let editedSentence = editValue.trim();
    if (editedSentence && !/[.!?]$/.test(editedSentence)) editedSentence += '.';
    const fullEditKey = `${fieldName}-${idx}`;
    const hasFullEdit = localEdits[fullEditKey] !== undefined;
    const sourceText = hasFullEdit ? localEdits[fullEditKey] : (record[fieldName] || '');
    const allCurrent = splitBySentence(sourceText);
    const fullText = reconstructFullText(allCurrent, sIdx, editedSentence, fieldName, idx, hasFullEdit);
    const newSentences = splitBySentence(fullText);
    const extraCount = newSentences.length - allCurrent.length;
    if (extraCount > 0) {
      const editedMap = {};
      editedMap[`${fieldName}-${idx}-s${sIdx}`] = 'edited';
      for (let si = sIdx + 1; si <= sIdx + extraCount; si++) {
        editedMap[`${fieldName}-${idx}-s${si}`] = 'added';
      }
      setEditedSentences(prev => {
        const cleaned = {};
        for (const key of Object.keys(prev)) {
          if (!key.startsWith(`${fieldName}-${idx}-s`)) cleaned[key] = prev[key];
        }
        return { ...cleaned, ...editedMap };
      });
    }
    handleSaveField(record, fieldName, idx, sectionId, sIdx, fullText);
  };

  /* ── approve ────────────────────────────────────────────── */
  const sectionHasEdits = useCallback((sectionId, idx) => {
    if (approvedSections[`${sectionId}-${idx}`]) return false;
    const prefix = `-${idx}-s`;
    const hasS = Object.keys(editedSentences).some(k => k.includes(prefix) && (editedSentences[k] === 'edited' || editedSentences[k] === 'added'));
    const hasF = Object.keys(editedFields).some(k => k.endsWith(`-${idx}`));
    return hasS || hasF;
  }, [editedSentences, editedFields, approvedSections]);

  // Approve = COMMIT all staged drafts for this record to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sectionId) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) return;
    const approveKey = `${sectionId}-${idx}`;
    const isCurrentlyApproved = approvedSections[approveKey];
    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now. fieldPart is the field name (possibly dotted, e.g.
      // "socialDeterminants.housing"); treat a trailing ".N" as arrayIndex ONLY when N is purely numeric.
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayIdx = lastDot !== -1 && /^\d+$/.test(tail);
        const payload = { field: isArrayIdx ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArrayIdx) payload.arrayIndex = parseInt(tail, 10);
        const resp = await secureApiClient.put(`/api/edit/additional_data/${recordId}/edit`, payload);
        if (!resp || !resp.success) throw new Error((resp && resp.error) || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/additional_data/${recordId}/approve`, {
        sectionId, approved: !isCurrentlyApproved,
      });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[recordId]) { delete store[recordId]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [approveKey]: !isCurrentlyApproved }));
      if (!isCurrentlyApproved) {
        setEditedSentences(prev => {
          const cleaned = {};
          for (const key of Object.keys(prev)) {
            if (!key.includes(`-${idx}-s`)) cleaned[key] = prev[key];
          }
          return cleaned;
        });
        setEditedFields(prev => {
          const cleaned = {};
          for (const key of Object.keys(prev)) {
            if (!key.endsWith(`-${idx}`)) cleaned[key] = prev[key];
          }
          return cleaned;
        });
      }
    } catch (error) {
      console.error('Approve failed:', error);
    } finally {
      setApproving(false);
    }
  }, [approvedSections, localEdits, pendingEdits]);

  /* ── copy helpers ───────────────────────────────────────── */
  const copyToClipboard = useCallback((text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {});
  }, []);

  const getRecordText = useCallback((record, idx) => {
    const category = getFieldValue(record, 'category', idx) || record.category || 'Uncategorized';
    const lines = [`${category}`];
    const displayFields = Object.entries(record).filter(([key]) => !isSystemField(key) && key !== 'category');
    displayFields.forEach(([key, val]) => {
      const effectiveVal = getFieldValue(record, key, idx);
      const display = effectiveVal !== null && effectiveVal !== undefined ? String(effectiveVal) : '';
      if (display) lines.push(`${capitalize(key)}: ${display}`);
    });
    return lines.join('\n');
  }, [getFieldValue]);

  /* ── search / filter ────────────────────────────────────── */
  const extractAllText = (obj) => {
    if (!obj || typeof obj !== 'object') return '';
    const values = [];
    for (const key in obj) {
      values.push(key);
      const value = obj[key];
      if (Array.isArray(value)) {
        value.forEach(item => {
          if (typeof item === 'object' && item !== null) values.push(extractAllText(item));
          else values.push(String(item ?? ''));
        });
      } else if (typeof value === 'object' && value !== null) {
        values.push(extractAllText(value));
      } else {
        values.push(String(value ?? ''));
      }
    }
    return values.join(' ');
  };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) {
      return unwrappedData.map((r, i) => ({ ...r, _originalIdx: i }));
    }
    const searchLower = searchTerm.toLowerCase().trim();
    return unwrappedData.map((record, idx) => {
      const recordTitle = `Additional Data Record ${idx + 1}`;
      const category = getFieldValue(record, 'category', idx) || record.category || '';
      const allFieldText = Object.entries(record)
        .filter(([k]) => !isSystemField(k))
        .map(([k, v]) => {
          const effective = getFieldValue(record, k, idx);
          return `${capitalize(k)} ${typeof effective === 'object' ? extractAllText(effective) : String(effective ?? '')}`;
        })
        .join(' ');
      const searchableText = ['Additional Data', recordTitle, category, allFieldText]
        .filter(Boolean).join(' ').toLowerCase();

      const matches = searchableText.includes(searchLower);
      if (!matches) return null;

      const titleLower = recordTitle.toLowerCase();
      const catLower = category.toLowerCase();
      const showAll = titleLower.startsWith(searchLower) || searchLower.startsWith(titleLower) ||
        catLower.startsWith(searchLower) || searchLower.startsWith(catLower) ||
        'additional data'.startsWith(searchLower) || searchLower.startsWith('additional data');

      return { ...record, _originalIdx: idx, _showAllSections: showAll };
    }).filter(Boolean);
  }, [unwrappedData, searchTerm, getFieldValue]);

  /* ── highlight ──────────────────────────────────────────── */
  const highlightText = (text) => {
    if (!text || !searchTerm.trim()) return text;
    const textStr = String(text);
    const searchLower = searchTerm.toLowerCase();
    const textLower = textStr.toLowerCase();
    if (!textLower.includes(searchLower)) return textStr;

    const parts = [];
    let lastIndex = 0;
    let index = textLower.indexOf(searchLower);
    while (index !== -1) {
      if (index > lastIndex) parts.push(textStr.substring(lastIndex, index));
      parts.push(<mark key={index}>{textStr.substring(index, index + searchTerm.length)}</mark>);
      lastIndex = index + searchTerm.length;
      index = textLower.indexOf(searchLower, lastIndex);
    }
    if (lastIndex < textStr.length) parts.push(textStr.substring(lastIndex));
    return parts;
  };

  /* ── shouldShowField (Level 3 search filtering) ─────────── */
  const shouldShowField = (record, fieldKey, fieldValue) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const p = searchTerm.toLowerCase().trim();
    const label = capitalize(fieldKey).toLowerCase();
    if (label.startsWith(p) || p.startsWith(label)) return true;
    const valStr = typeof fieldValue === 'object'
      ? extractAllText(fieldValue) : String(fieldValue ?? '');
    return valStr.toLowerCase().includes(p);
  };

  /* ── pdfData memo ───────────────────────────────────────── */
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return unwrappedData;
    return unwrappedData.map((rec, idx) => {
      const merged = { ...rec };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldName = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx === idx) {
          merged[fieldName] = editVal;
        }
      }
      return merged;
    });
  }, [unwrappedData, localEdits, pendingEdits]);

  /* ── render: editable simple field ──────────────────────── */
  const renderEditableField = (record, fieldKey, idx, value, label) => {
    const editKey = `${fieldKey}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const isEdited = editedSentences[editKey] === 'edited';
    const displayVal = value !== null && value !== undefined ? String(value) : '';
    const copyId = `field-${fieldKey}-${idx}`;

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={copyId}>
          {label && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className="edit-field-container">
            <textarea
              ref={textareaRef}
              className="edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleSaveField(record, fieldKey, idx, `record-${idx}`, 0);
                }
                if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
              }}
              rows={2}
            />
            <div className="edit-actions">
              <button className="save-btn" onClick={() => handleSaveField(record, fieldKey, idx, `record-${idx}`, 0)} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <React.Fragment key={copyId}>
        <div className="rec-mini-card">
          {label && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
            <div
              className="row-content editable"
              onClick={() => handleStartEdit(fieldKey, idx, displayVal, 0)}
            >
              <span className="content-value">{highlightText(displayVal)}</span>
              {!isEdited && <span className="edit-indicator">✎</span>}
            </div>
            <button
              className={`copy-btn${copiedId === copyId ? ' copied' : ''}`}
              onClick={() => copyToClipboard(displayVal, copyId)}
            >
              {copiedId === copyId ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
        {isEdited && <div className="modified-badge">edited — click pending approve to save</div>}
      </React.Fragment>
    );
  };

  /* ── render: editable sentence field ────────────────────── */
  const renderSentenceEditableField = (record, fieldKey, idx, value, label) => {
    const effectiveVal = getFieldValue(record, fieldKey, idx);
    const val = effectiveVal !== undefined ? effectiveVal : value;
    const sentences = splitBySentence(String(val || ''));
    if (sentences.length <= 1) {
      return renderEditableField(record, fieldKey, idx, val, label);
    }

    return (
      <div className="rec-mini-card" key={`sent-${fieldKey}-${idx}`}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        {sentences.map((sentence, sIdx) => {
          const editKey = `${fieldKey}-${idx}-s${sIdx}`;
          const isEditing = editingField === editKey;
          const editState = editedSentences[editKey];
          const isEdited = editState === 'edited' || editState === 'added';
          const copyId = `sent-${fieldKey}-${idx}-${sIdx}`;

          // Level 4: per-sentence filtering
          if (searchTerm.trim() && !record._showAllSections) {
            const p = searchTerm.toLowerCase().trim();
            const lt = (label || '').toLowerCase();
            const titleMatch = lt.startsWith(p) || p.startsWith(lt);
            if (!titleMatch && !sentence.toLowerCase().includes(p)) return null;
          }

          if (isEditing) {
            return (
              <div key={copyId} className="edit-field-container">
                <textarea
                  ref={textareaRef}
                  className="edit-textarea"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      saveSentence(record, fieldKey, idx, `record-${idx}`, sIdx);
                    }
                    if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                  }}
                  rows={2}
                />
                <div className="edit-actions">
                  <button className="save-btn" onClick={() => saveSentence(record, fieldKey, idx, `record-${idx}`, sIdx)} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                </div>
              </div>
            );
          }

          return (
            <React.Fragment key={copyId}>
              <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
                <div
                  className="row-content editable"
                  onClick={() => handleStartEdit(fieldKey, idx, sentence, sIdx)}
                >
                  <span className="content-value">{highlightText(sentence)}</span>
                  {!isEdited && <span className="edit-indicator">✎</span>}
                </div>
                <button
                  className={`copy-btn${copiedId === copyId ? ' copied' : ''}`}
                  onClick={() => copyToClipboard(sentence, copyId)}
                >
                  {copiedId === copyId ? 'Copied' : 'Copy'}
                </button>
              </div>
              {isEdited && <div className="modified-badge">{editState === 'added' ? 'added' : 'edited'} — click pending approve to save</div>}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  /* ── render: array value ────────────────────────────────── */
  const renderArrayValue = (record, fieldKey, idx, items, label) => {
    if (!items || !Array.isArray(items) || items.length === 0) return null;

    return (
      <div className="rec-mini-card" key={`arr-${fieldKey}-${idx}`}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, aIdx) => {
          const itemStr = typeof item === 'object' ? JSON.stringify(item) : String(item ?? '');
          const editKey = `${fieldKey}[${aIdx}]-${idx}-s0`;
          const isEditing = editingField === editKey;
          const isEdited = editedSentences[editKey] === 'edited';
          const copyId = `arr-${fieldKey}-${idx}-${aIdx}`;

          if (searchTerm.trim() && !record._showAllSections) {
            const p = searchTerm.toLowerCase().trim();
            const lt = (label || '').toLowerCase();
            if (!(lt.startsWith(p) || p.startsWith(lt)) && !itemStr.toLowerCase().includes(p)) return null;
          }

          if (isEditing) {
            return (
              <div key={copyId} className="edit-field-container">
                <textarea
                  ref={textareaRef}
                  className="edit-textarea"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      // Save array item: reconstruct array and save entire field
                      const newArr = [...items];
                      newArr[aIdx] = editValue.trim();
                      handleSaveField(record, fieldKey, idx, `record-${idx}`, 0, newArr, editKey);
                    }
                    if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                  }}
                  rows={2}
                />
                <div className="edit-actions">
                  <button className="save-btn" onClick={() => {
                    const newArr = [...items];
                    newArr[aIdx] = editValue.trim();
                    handleSaveField(record, fieldKey, idx, `record-${idx}`, 0, newArr, editKey);
                  }} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                </div>
              </div>
            );
          }

          return (
            <React.Fragment key={copyId}>
              <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
                <div
                  className="row-content editable"
                  onClick={() => {
                    setEditingField(editKey);
                    setEditValue(itemStr);
                    setTimeout(() => textareaRef.current?.focus(), 50);
                  }}
                >
                  <span className="content-value">{highlightText(itemStr)}</span>
                  {!isEdited && <span className="edit-indicator">✎</span>}
                </div>
                <button
                  className={`copy-btn${copiedId === copyId ? ' copied' : ''}`}
                  onClick={() => copyToClipboard(itemStr, copyId)}
                >
                  {copiedId === copyId ? 'Copied' : 'Copy'}
                </button>
              </div>
              {isEdited && <div className="modified-badge">edited — click pending approve to save</div>}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  /* ── render: object value ───────────────────────────────── */
  const renderObjectValue = (record, fieldKey, idx, obj, label) => {
    if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) return null;
    const entries = Object.entries(obj);

    return (
      <div className="rec-mini-card" key={`obj-${fieldKey}-${idx}`}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([subKey, subVal], eIdx) => {
          const subFieldKey = `${fieldKey}.${subKey}`;
          const displayVal = subVal !== null && subVal !== undefined ? String(subVal) : '';
          const editKey = `${subFieldKey}-${idx}-s0`;
          const isEditing = editingField === editKey;
          const isEdited = editedSentences[editKey] === 'edited';
          const copyId = `obj-${fieldKey}-${subKey}-${idx}`;
          const subLabel = capitalize(subKey);

          if (searchTerm.trim() && !record._showAllSections) {
            const p = searchTerm.toLowerCase().trim();
            const lt = (label || '').toLowerCase();
            const slt = subLabel.toLowerCase();
            if (!(lt.startsWith(p) || p.startsWith(lt)) && !(slt.startsWith(p) || p.startsWith(slt)) && !displayVal.toLowerCase().includes(p)) return null;
          }

          if (typeof subVal === 'object' && subVal !== null) {
            // Nested object/array — display as read-only for now
            return (
              <div key={copyId} className="numbered-row">
                <div className="row-content">
                  <span className="content-subtitle">{highlightText(subLabel)}</span>
                  <span className="content-value">{highlightText(JSON.stringify(subVal))}</span>
                </div>
                <button
                  className={`copy-btn${copiedId === copyId ? ' copied' : ''}`}
                  onClick={() => copyToClipboard(JSON.stringify(subVal, null, 2), copyId)}
                >
                  {copiedId === copyId ? 'Copied' : 'Copy'}
                </button>
              </div>
            );
          }

          if (isEditing) {
            return (
              <div key={copyId} className="edit-field-container">
                <div className="nested-subtitle" style={{ fontSize: '15px' }}>{highlightText(subLabel)}</div>
                <textarea
                  ref={textareaRef}
                  className="edit-textarea"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      // Save object sub-field: reconstruct object and save entire field
                      const newObj = { ...obj };
                      newObj[subKey] = editValue.trim();
                      handleSaveField(record, fieldKey, idx, `record-${idx}`, 0, newObj, editKey);
                    }
                    if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                  }}
                  rows={2}
                />
                <div className="edit-actions">
                  <button className="save-btn" onClick={() => {
                    const newObj = { ...obj };
                    newObj[subKey] = editValue.trim();
                    handleSaveField(record, fieldKey, idx, `record-${idx}`, 0, newObj, editKey);
                  }} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                </div>
              </div>
            );
          }

          return (
            <React.Fragment key={copyId}>
              <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
                <div
                  className="row-content editable"
                  onClick={() => {
                    setEditingField(editKey);
                    setEditValue(displayVal);
                    setTimeout(() => textareaRef.current?.focus(), 50);
                  }}
                >
                  <span className="content-subtitle">{highlightText(subLabel)}</span>
                  <span className="content-value">{highlightText(displayVal)}</span>
                  {!isEdited && <span className="edit-indicator">✎</span>}
                </div>
                <button
                  className={`copy-btn${copiedId === copyId ? ' copied' : ''}`}
                  onClick={() => copyToClipboard(`${subLabel}: ${displayVal}`, copyId)}
                >
                  {copiedId === copyId ? 'Copied' : 'Copy'}
                </button>
              </div>
              {isEdited && <div className="modified-badge">edited — click pending approve to save</div>}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  /* ── render: dynamic field (dispatches by type) ─────────── */
  const renderDynamicField = (record, fieldKey, idx) => {
    const effectiveVal = getFieldValue(record, fieldKey, idx);
    const label = capitalize(fieldKey);

    if (Array.isArray(effectiveVal)) {
      // Array of strings → per-item editing
      if (effectiveVal.length > 0 && effectiveVal.every(i => typeof i === 'string' || typeof i === 'number' || typeof i === 'boolean')) {
        return renderArrayValue(record, fieldKey, idx, effectiveVal, label);
      }
      // Array of objects → read-only display for now
      return renderArrayValue(record, fieldKey, idx, effectiveVal, label);
    }

    if (typeof effectiveVal === 'object' && effectiveVal !== null) {
      return renderObjectValue(record, fieldKey, idx, effectiveVal, label);
    }

    // String — check if sentence splitting needed
    if (typeof effectiveVal === 'string' && splitBySentence(effectiveVal).length > 1) {
      return renderSentenceEditableField(record, fieldKey, idx, effectiveVal, label);
    }

    // Simple value (string, number, boolean)
    return renderEditableField(record, fieldKey, idx, effectiveVal, label);
  };

  /* ── render: approve button ─────────────────────────────── */
  const renderApproveBtn = (record, idx) => {
    const sectionId = 'record';
    const approveKey = `${sectionId}-${idx}`;
    const hasEdits = sectionHasEdits(sectionId, idx);
    const isApproved = approvedSections[approveKey];
    if (!hasEdits && !isApproved) return null;

    return (
      <button
        className={`approve-btn${isApproved ? ' approved' : ' pending'}`}
        onClick={() => handleApproveSection(record, idx, sectionId)}
        disabled={approving}
      >
        {approving ? 'Approving...' : isApproved ? 'Approved' : 'Pending Approve'}
      </button>
    );
  };

  /* ── render: record card ────────────────────────────────── */
  const renderDataRecord = (record, filteredIdx) => {
    const idx = record._originalIdx !== undefined ? record._originalIdx : filteredIdx;
    const category = getFieldValue(record, 'category', idx) || record.category || 'Uncategorized';
    const displayFields = Object.keys(record).filter(key => !isSystemField(key) && key !== 'category' && key !== '_originalIdx' && key !== '_showAllSections');
    const recordDate = record.createdAt ? formatDate(record.createdAt) : null;

    return (
      <div key={record._id || idx} className="record-card">
        {/* Record Header */}
        <div className="card-header">
          <div className="header-top-row">
            {recordDate && <span className="date-badge">{recordDate}</span>}
          </div>
          <div className="card-title-row">
            <h3 className="card-title">{highlightText(category)}</h3>
            <div className="header-right-actions">
              <button
                className={`copy-btn${copiedId === `record-${idx}` ? ' copied' : ''}`}
                onClick={() => copyToClipboard(getRecordText(record, idx), `record-${idx}`)}
              >
                {copiedId === `record-${idx}` ? 'Copied' : 'Copy Record'}
              </button>
              {renderApproveBtn(record, idx)}
            </div>
          </div>
        </div>

        {/* Category field — editable */}
        <div className="card-content">
          {renderEditableField(record, 'category', idx, category, 'Category')}

          {/* Dynamic fields */}
          {displayFields.length > 0 ? (
            displayFields.map(fieldKey => {
              const effectiveVal = getFieldValue(record, fieldKey, idx);
              if (!shouldShowField(record, fieldKey, effectiveVal)) return null;
              return <React.Fragment key={fieldKey}>{renderDynamicField(record, fieldKey, idx)}</React.Fragment>;
            })
          ) : (
            <div className="no-data-message">No data fields available</div>
          )}
        </div>
      </div>
    );
  };

  /* ── main render ────────────────────────────────────────── */
  return (
    <div className="additional-data-document">
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">Additional Data</h1>
        <div className="header-actions">
          <button
            className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`}
            onClick={() => {
              const allText = filteredRecords.map(r => getRecordText(r, r._originalIdx)).join('\n\n---\n\n');
              copyToClipboard(allText, 'copy-all');
            }}
          >
            {copiedId === 'copy-all' ? 'Copied' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<AdditionalDataPDFTemplate data={pdfData} />}
            fileName={`Additional_Data_${new Date().toISOString().split('T')[0]}.pdf`}
          >
            {({ loading }) => (
              <button className={`copy-btn pdf-btn${copiedId === 'pdf' ? ' copied' : ''}`}>
                {loading ? 'Preparing...' : 'Export PDF'}
              </button>
            )}
          </PDFDownloadLink>
        </div>
      </div>

      {/* Search Bar */}
      <SearchBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search additional data (category, fields, values...)"
        totalCount={unwrappedData.length}
        filteredCount={filteredRecords.length}
      />

      {/* Empty States */}
      {filteredRecords.length === 0 && searchTerm && (
        <div className="no-results">
          <p>No data records found for "{searchTerm}"</p>
        </div>
      )}

      {filteredRecords.length === 0 && !searchTerm && (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <p className="empty-text">No additional data available</p>
        </div>
      )}

      {/* Records List */}
      <div className="records-list">
        {filteredRecords.map((record, filteredIdx) => renderDataRecord(record, filteredIdx))}
      </div>
    </div>
  );
};

export default AdditionalDataDocument;
