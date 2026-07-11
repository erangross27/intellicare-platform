import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import AdvanceDirectivesDocumentPDFTemplate from '../pdf-templates/AdvanceDirectivesDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './AdvanceDirectivesDocument.css';

/**
 * AdvanceDirectivesDocument Component — with inline editing
 *
 * Sections:
 * 1. Document Information: documentType, dateCompleted (editable via date picker), facility, reviewDate (editable via date picker)
 * 2. Treatment Preferences: cprPreference, intubationPreference, dialysisPreference, artificialNutrition, comfortMeasures
 * 3. Healthcare Proxy: healthcareProxy, alternateProxy
 * 4. Specific Instructions: specificInstructions (sentence field)
 * 5. Additional Notes: notes (sentence field)
 *
 * March 2026 — Per-sentence editing, per-section approve, pdfData memo
 */

const SECTION_FIELDS = {
  'docinfo': ['documentType', 'dateCompleted', 'facility', 'reviewDate', 'documentLocation', 'witnessSignatures'],
  'treatment': ['cprPreference', 'intubationPreference', 'dialysisPreference', 'artificialNutrition', 'comfortMeasures', 'organDonation'],
  'proxy': ['healthcareProxy', 'alternateProxy'],
  'specific': ['specificInstructions'],
  'notes': ['notes'],
};

const SENTENCE_FIELDS = ['specificInstructions', 'notes', 'comfortMeasures'];

const DATE_FIELDS = ['dateCompleted', 'reviewDate'];

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = plain field name for this template) */
const DRAFT_KEY = 'advance_directivesPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const FIELD_LABELS = {
  documentType: 'Document Type',
  dateCompleted: 'Date Completed',
  reviewDate: 'Review Date',
  facility: 'Facility',
  cprPreference: 'CPR Preference',
  intubationPreference: 'Intubation Preference',
  dialysisPreference: 'Dialysis Preference',
  artificialNutrition: 'Artificial Nutrition',
  comfortMeasures: 'Comfort Measures',
  organDonation: 'Organ Donation',
  healthcareProxy: 'Healthcare Proxy',
  alternateProxy: 'Alternate Proxy',
  specificInstructions: 'Specific Instructions',
  witnessSignatures: 'Witness Signatures',
  documentLocation: 'Document Location',
  notes: 'Additional Notes',
};

const AdvanceDirectivesDocument = ({ document, data }) => {
  const templateData = document || data;

  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Editing state
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

  const canEdit = true;

  // ── Utility functions ──

  const formatDate = (dateValue) => {
    if (!dateValue) return '';
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return String(dateValue);
      return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
    } catch { return String(dateValue); }
  };

  // yyyy-mm-dd for the <input type="date"> value (timezone-safe)
  const formatDateISO = (dateValue) => {
    if (!dateValue) return '';
    try {
      const d = new Date(dateValue.$date || dateValue);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch { return ''; }
  };

  const hasValue = (val) => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string') return val.trim().length > 0;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'object') return Object.keys(val).length > 0;
    if (typeof val === 'boolean' || typeof val === 'number') return true;
    return true;
  };

  const highlightText = (text) => {
    if (!searchTerm || !text) return text;
    const textStr = String(text);
    const searchPhrase = searchTerm.toLowerCase().trim();
    const textLower = textStr.toLowerCase();
    if (!textLower.includes(searchPhrase)) return textStr;
    const parts = [];
    let lastIndex = 0;
    let index = textLower.indexOf(searchPhrase);
    while (index !== -1) {
      if (index > lastIndex) parts.push(textStr.substring(lastIndex, index));
      parts.push(<mark key={`${index}-${searchPhrase}`}>{textStr.substring(index, index + searchPhrase.length)}</mark>);
      lastIndex = index + searchPhrase.length;
      index = textLower.indexOf(searchPhrase, lastIndex);
    }
    if (lastIndex < textStr.length) parts.push(textStr.substring(lastIndex));
    return parts;
  };

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) { console.error('Copy failed:', err); }
  };

  // ── splitBySentence — proper version with paren awareness ──

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

  const splitByComma = (text) => {
    if (!text || typeof text !== 'string') return [];
    const result = [];
    let current = '';
    let parenDepth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') parenDepth++;
      else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
      if (ch === ',' && parenDepth === 0) {
        const trimmed = current.trim();
        if (trimmed) result.push(trimmed);
        current = '';
      } else {
        current += ch;
      }
    }
    const trimmed = current.trim();
    if (trimmed) result.push(trimmed);
    return result;
  };

  const parseLabel = (text) => {
    if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
    const match = text.match(/^([^:]{2,40}):\s*(.+)/);
    if (match) return { isLabeled: true, label: match[1].trim(), value: match[2].trim() };
    return { isLabeled: false, label: '', value: text };
  };

  // ── Data unwrapping ──

  const unwrappedData = useMemo(() => {
    if (!templateData) return [];
    let recordsArray = Array.isArray(templateData) ? templateData : [templateData];
    recordsArray = recordsArray.flatMap(record => {
      if (record?._records && Array.isArray(record._records)) return record._records;
      if (record?.records && Array.isArray(record.records) && !record.documentType && !record.dateCompleted) return record.records;
      if (record?.advance_directives && Array.isArray(record.advance_directives)) return record.advance_directives;
      return record;
    });
    return recordsArray.filter(record =>
      record && (record.documentType || record.dateCompleted || record.healthcareProxy || record.cprPreference)
    );
  }, [templateData]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    unwrappedData.forEach((record, idx) => {
      const recId = record && (record._id?.$oid || record._id);
      const recDrafts = recId ? store[recId] : null;
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
  }, [unwrappedData]);

  // ── pdfData memo — merges localEdits for PDF export ──

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

  // ── Get effective field value (localEdits first, then record) ──

  const getFieldValue = (record, fieldName, idx) => {
    const fullEditKey = `${fieldName}-${idx}`;
    if (localEdits[fullEditKey] !== undefined) return localEdits[fullEditKey];
    return record[fieldName];
  };

  // ── Editing handlers ──

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
    if (!recordId) { console.error('Cannot save — no _id'); return; }
    const saveValue = valueOverride !== undefined ? valueOverride : editValue.trim();
    const sKey = editTrackingKey || `${fieldName}-${idx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;
    const fullEditKey = `${fieldName}-${idx}`;

    setLocalEdits(prev => ({ ...prev, [fullEditKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [fullEditKey]: true }));
    setEditedFields(prev => ({ ...prev, [fullEditKey]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow Pending
    setApprovedSections(prev => { const u = { ...prev }; delete u[`${sectionId}-${idx}`]; return u; });

    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldName] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // ── reconstructFullText — PLAIN FUNCTION ──

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

  // ── saveSentence — PLAIN FUNCTION ──

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

  // ── sectionHasEdits — checks BOTH editedSentences AND editedFields ──

  const sectionHasEdits = useCallback((sectionId, idx) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    if (approvedSections[`${sectionId}-${idx}`]) return false;
    return fields.some(f => {
      const hasSentenceEdits = Object.keys(editedSentences).some(key => {
        if (!key.startsWith(`${f}-${idx}-s`)) return false;
        return editedSentences[key] === 'edited' || editedSentences[key] === 'added';
      });
      const hasObjectEdits = Object.keys(editedFields).some(key =>
        key.startsWith(`${f}-${idx}`)
      );
      return hasSentenceEdits || hasObjectEdits;
    });
  }, [editedSentences, editedFields, approvedSections]);

  // ── handleApproveSection — per-section only, NO statusOverrides ──

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sectionId) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) return;
    const approveKey = `${sectionId}-${idx}`;
    const isCurrentlyApproved = approvedSections[approveKey];
    const fields = SECTION_FIELDS[sectionId] || [];
    setApproving(true);
    try {
      // Persist each staged field in this section to the DB now (only on the approve direction).
      let committed = [];
      if (!isCurrentlyApproved) {
        const suffix = `-${idx}`;
        committed = Object.keys(localEdits).filter(k => {
          if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
          const fieldPart = k.slice(0, -suffix.length); // "field" or "field.arrayIndex"
          const baseField = fieldPart.includes('.') ? fieldPart.slice(0, fieldPart.indexOf('.')) : fieldPart;
          return fields.includes(baseField);
        });
        for (const editKey of committed) {
          const fieldPart = editKey.slice(0, -suffix.length);
          const lastDot = fieldPart.lastIndexOf('.');
          // arrayIndex ONLY when the segment after the LAST dot is purely numeric
          const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
          const isArr = lastDot !== -1 && /^\d+$/.test(trailing);
          const payload = { field: isArr ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
          if (isArr) payload.arrayIndex = parseInt(trailing, 10);
          await secureApiClient.put(`/api/edit/advance_directives/${recordId}/edit`, payload);
        }
      }
      await secureApiClient.put(`/api/edit/advance_directives/${recordId}/approve`, {
        sectionId,
        approved: !isCurrentlyApproved,
      });
      setApprovedSections(prev => ({ ...prev, [approveKey]: !isCurrentlyApproved }));
      if (!isCurrentlyApproved) {
        // Clear pending → committed edits now flow into pdfData/PDF
        setPendingEdits(prev => {
          const next = { ...prev };
          committed.forEach(k => delete next[k]);
          return next;
        });
        // Drop this section's drafts from localStorage (now committed)
        const store = readDrafts();
        if (store[recordId]) {
          committed.forEach(k => {
            const fieldPart = k.slice(0, -(`-${idx}`).length);
            delete store[recordId][fieldPart];
          });
          if (Object.keys(store[recordId]).length === 0) delete store[recordId];
          writeDrafts(store);
        }
        setEditedSentences(prev => {
          const cleaned = { ...prev };
          for (const key of Object.keys(cleaned)) {
            if (fields.some(f => key.startsWith(`${f}-${idx}-s`))) delete cleaned[key];
          }
          return cleaned;
        });
        setEditedFields(prev => {
          const cleaned = { ...prev };
          for (const key of Object.keys(cleaned)) {
            if (fields.some(f => key.startsWith(`${f}-${idx}`))) delete cleaned[key];
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

  // ── Approve button renderer ──

  const renderApproveBtn = (record, idx, sectionId) => {
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

  // ── renderEditableField — for simple fields ──

  const renderEditableField = (record, fieldName, idx, label, sectionId, copyId) => {
    const val = getFieldValue(record, fieldName, idx);
    if (!hasValue(val)) return null;
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const isEdited = editedSentences[editKey] === 'edited';

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {isEditing ? (
          <div className="edit-field-container">
            <textarea
              ref={textareaRef}
              className="edit-textarea"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleSaveField(record, fieldName, idx, sectionId, 0);
                }
                if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
              }}
              rows={2}
            />
            <div className="edit-actions">
              <button className="save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId, 0)} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
              <div className={`row-content${canEdit ? ' editable' : ''}`} onClick={() => canEdit && handleStartEdit(fieldName, idx, String(val || ''), 0)}>
                <span className="content-value">{highlightText(String(val))}</span>
                {canEdit && !isEdited && <span className="edit-indicator">✎</span>}
              </div>
              <button
                className={`copy-btn${copiedId === copyId ? ' copied' : ''}`}
                onClick={() => copyToClipboard(`${label}: ${val}`, copyId)}
              >
                {copiedId === copyId ? 'Copied' : 'Copy'}
              </button>
            </div>
            {isEdited && <div className="modified-badge">edited — click pending approve to save</div>}
          </>
        )}
      </div>
    );
  };

  // ── renderDateField — editable date via native date picker ──

  const renderDateField = (record, fieldName, idx, label, sectionId, copyId) => {
    const val = getFieldValue(record, fieldName, idx);
    if (!hasValue(val)) return null;
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const isEdited = editedSentences[editKey] === 'edited';

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {isEditing ? (
          <div className="edit-field-container">
            <input
              type="date"
              className="edit-date-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onFocus={(e) => e.target.showPicker && e.target.showPicker()}
              onKeyDown={(e) => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
              disabled={saving}
              autoFocus
            />
            <div className="edit-actions">
              <button
                className="save-btn"
                onClick={() => handleSaveField(record, fieldName, idx, sectionId, 0, editValue ? new Date(`${editValue}T12:00:00`).toISOString() : '')}
                disabled={saving || !editValue}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
              <div
                className={`row-content${canEdit ? ' editable' : ''}`}
                onClick={() => { if (canEdit) { setEditingField(editKey); setEditValue(formatDateISO(val)); } }}
              >
                <span className="content-value">{highlightText(formatDate(val))}</span>
                {canEdit && !isEdited && <span className="edit-indicator">✎</span>}
              </div>
              <button
                className={`copy-btn${copiedId === copyId ? ' copied' : ''}`}
                onClick={() => copyToClipboard(`${label}: ${formatDate(val)}`, copyId)}
              >
                {copiedId === copyId ? 'Copied' : 'Copy'}
              </button>
            </div>
            {isEdited && <div className="modified-badge">edited — click pending approve to save</div>}
          </>
        )}
      </div>
    );
  };

  // ── formatSentenceFieldLines — for Copy Section / Copy All ──

  const formatSentenceFieldLines = (text) => {
    const sentences = splitBySentence(text);
    const lines = [];
    let n = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        const parts = splitByComma(parsed.value);
        if (parts.length >= 2) {
          lines.push(parsed.label);
          parts.forEach(item => { lines.push(`  ${n++}. ${item}`); });
        } else {
          lines.push(`${n++}. ${s}`);
        }
      } else {
        const parts = splitByComma(s);
        if (parts.length >= 2) {
          parts.forEach(item => { lines.push(`${n++}. ${item}`); });
        } else {
          lines.push(`${n++}. ${s}`);
        }
      }
    });
    return lines;
  };

  // ── renderSentenceEditableField — for sentence fields ──

  const renderSentenceEditableField = (record, fieldName, idx, label, sectionId, copyIdPrefix) => {
    const val = getFieldValue(record, fieldName, idx);
    if (!hasValue(val)) return null;
    const textVal = String(val);
    const sentences = splitBySentence(textVal);

    // Single sentence with <2 comma items → simple editable
    if (sentences.length <= 1 && splitByComma(textVal).length < 2) {
      return renderEditableField(record, fieldName, idx, label, sectionId, `${copyIdPrefix}-${idx}`);
    }

    // Multi-sentence or comma-split rendering
    return sentences.map((sentence, sIdx) => {
      const parsed = parseLabel(sentence);
      const isLabeled = parsed.isLabeled;
      const itemLabel = isLabeled ? parsed.label : null;
      const itemValue = isLabeled ? parsed.value : sentence;
      const fullSentence = sentence;

      // Comma split
      const rawComma = splitByComma(itemValue);
      const displayParts = rawComma.length >= 2 ? rawComma : [itemValue];
      const origIdx = sIdx;

      // Multi-part (comma-split ≥2)
      if (displayParts.length >= 2) {
        return (
          <div key={sIdx} className="rec-mini-card">
            {(sIdx === 0 || isLabeled) && (
              <div className="nested-subtitle">{highlightText(sIdx === 0 ? label : itemLabel)}</div>
            )}
            {displayParts.map((part, pi) => {
              const partEditKey = `${fieldName}-${idx}-s${origIdx}-p${pi}`;
              const isPartEditing = editingField === partEditKey;
              const isPartEdited = editedSentences[partEditKey] === 'edited';
              const partCopyId = `${copyIdPrefix}-${idx}-s${sIdx}-p${pi}`;

              if (isPartEditing) {
                return (
                  <div key={partCopyId} className="edit-field-container">
                    <textarea
                      ref={textareaRef}
                      className="edit-textarea"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          const newParts = [...displayParts];
                          newParts[pi] = editValue.trim();
                          const filteredParts = newParts.filter(p => p.trim().length > 0);
                          const sourceText = String(getFieldValue(record, fieldName, idx) || '');
                          let replacement = '';
                          if (filteredParts.length > 0) {
                            replacement = isLabeled ? `${itemLabel}: ${filteredParts.join(', ')}` : filteredParts.join(', ');
                          }
                          const newFullText = replacement
                            ? sourceText.replace(fullSentence, replacement)
                            : sourceText.replace(fullSentence, '').replace(/\.\s*\./g, '.').replace(/\s{2,}/g, ' ').trim();
                          handleSaveField(record, fieldName, idx, sectionId, 0, newFullText, partEditKey);
                        }
                        if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                      }}
                      rows={2}
                    />
                    <div className="edit-actions">
                      <button className="save-btn" onClick={() => {
                        const newParts = [...displayParts];
                        newParts[pi] = editValue.trim();
                        const filteredParts = newParts.filter(p => p.trim().length > 0);
                        const sourceText = String(getFieldValue(record, fieldName, idx) || '');
                        let replacement = '';
                        if (filteredParts.length > 0) {
                          replacement = isLabeled ? `${itemLabel}: ${filteredParts.join(', ')}` : filteredParts.join(', ');
                        }
                        const newFullText = replacement
                          ? sourceText.replace(fullSentence, replacement)
                          : sourceText.replace(fullSentence, '').replace(/\.\s*\./g, '.').replace(/\s{2,}/g, ' ').trim();
                        handleSaveField(record, fieldName, idx, sectionId, 0, newFullText, partEditKey);
                      }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                    </div>
                  </div>
                );
              }

              return (
                <React.Fragment key={partCopyId}>
                  <div className={`numbered-row${isPartEdited ? ' modified' : ''}`}>
                    <div className={`row-content${canEdit ? ' editable' : ''}`} onClick={() => {
                      setEditingField(partEditKey);
                      setEditValue(part.replace(/[.;]+$/, '').trim());
                      setTimeout(() => textareaRef.current?.focus(), 50);
                    }}>
                      <span className="content-value">{highlightText(part)}</span>
                      {canEdit && !isPartEdited && <span className="edit-indicator">✎</span>}
                    </div>
                    <button
                      className={`copy-btn${copiedId === partCopyId ? ' copied' : ''}`}
                      onClick={() => copyToClipboard(part, partCopyId)}
                    >
                      {copiedId === partCopyId ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  {isPartEdited && <div className="modified-badge">edited — click pending approve to save</div>}
                </React.Fragment>
              );
            })}
          </div>
        );
      }

      // Single-item (no comma split)
      const sentenceEditKey = `${fieldName}-${idx}-s${sIdx}`;
      const isSentenceEditing = editingField === sentenceEditKey;
      const isSentenceEdited = editedSentences[sentenceEditKey] === 'edited' || editedSentences[sentenceEditKey] === 'added';
      const sentenceCopyId = `${copyIdPrefix}-${idx}-s${sIdx}`;

      if (isSentenceEditing) {
        return (
          <div key={sIdx} className="edit-field-container">
            <textarea
              ref={textareaRef}
              className="edit-textarea"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  saveSentence(record, fieldName, idx, sectionId, sIdx);
                }
                if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
              }}
              rows={3}
            />
            <div className="edit-actions">
              <button className="save-btn" onClick={() => saveSentence(record, fieldName, idx, sectionId, sIdx)} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        );
      }

      const singleContent = (
        <>
          {(sIdx === 0 || isLabeled) && (
            <div className="nested-subtitle">{highlightText(sIdx === 0 ? label : itemLabel)}</div>
          )}
          <div className={`numbered-row${isSentenceEdited ? ' modified' : ''}`}>
            <div className={`row-content${canEdit ? ' editable' : ''}`} onClick={() => canEdit && handleStartEdit(fieldName, idx, isLabeled ? parsed.value : sentence, sIdx)}>
              <span className="content-value">{highlightText(isLabeled ? parsed.value : sentence)}</span>
              {canEdit && !isSentenceEdited && <span className="edit-indicator">✎</span>}
            </div>
            <button
              className={`copy-btn${copiedId === sentenceCopyId ? ' copied' : ''}`}
              onClick={() => copyToClipboard(sentence, sentenceCopyId)}
            >
              {copiedId === sentenceCopyId ? 'Copied' : 'Copy'}
            </button>
          </div>
          {isSentenceEdited && <div className="modified-badge">{editedSentences[sentenceEditKey] === 'added' ? 'added' : 'edited'} — click pending approve to save</div>}
        </>
      );

      return isLabeled
        ? <div key={sIdx} className="rec-mini-card">{singleContent}</div>
        : <React.Fragment key={sIdx}>{singleContent}</React.Fragment>;
    });
  };

  // ── 4-Level Search ──

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) {
      return unwrappedData.map((record, i) => ({ ...record, _showAllSections: false, _originalIdx: i }));
    }
    const searchPhrase = searchTerm.toLowerCase().trim();

    return unwrappedData.map((record, recordIndex) => {
      const recordTitle = `Advance Directive ${recordIndex + 1}`;

      const searchableText = [
        'Advance Directives', recordTitle,
        ...Object.values(FIELD_LABELS),
        'Document Information', 'Treatment Preferences', 'Healthcare Proxy', 'Specific Instructions', 'Additional Notes',
        'DNR', 'DNI', 'Do Not Resuscitate', 'Do Not Intubate', 'Living Will', 'POLST', 'Code Status',
        getFieldValue(record, 'documentType', recordIndex),
        formatDate(record.dateCompleted),
        formatDate(record.reviewDate),
        getFieldValue(record, 'facility', recordIndex),
        getFieldValue(record, 'cprPreference', recordIndex),
        getFieldValue(record, 'intubationPreference', recordIndex),
        getFieldValue(record, 'dialysisPreference', recordIndex),
        getFieldValue(record, 'artificialNutrition', recordIndex),
        getFieldValue(record, 'comfortMeasures', recordIndex),
        getFieldValue(record, 'organDonation', recordIndex),
        getFieldValue(record, 'healthcareProxy', recordIndex),
        getFieldValue(record, 'alternateProxy', recordIndex),
        getFieldValue(record, 'specificInstructions', recordIndex),
        getFieldValue(record, 'witnessSignatures', recordIndex),
        getFieldValue(record, 'documentLocation', recordIndex),
        getFieldValue(record, 'notes', recordIndex),
      ].filter(Boolean).join(' ').toLowerCase();

      const matchesSearch = searchableText.includes(searchPhrase);
      const isDocumentTitleSearch = /^advance\s+directive(s)?(\s+\d+)?$/i.test(searchPhrase) || /^\d+$/.test(searchPhrase);

      return {
        ...record,
        _matchesSearch: matchesSearch,
        _showAllSections: isDocumentTitleSearch && matchesSearch,
        _originalIdx: recordIndex,
      };
    }).filter(record => record._matchesSearch);
  }, [unwrappedData, searchTerm, localEdits]);

  // ── Section/Row visibility ──

  const stm = (...titles) => {
    if (!searchTerm.trim()) return true;
    const p = searchTerm.toLowerCase().trim();
    return titles.some(title => {
      if (!title) return false;
      const t = title.toLowerCase();
      return t.startsWith(p) || p.startsWith(t);
    });
  };

  const shouldShowRow = (record, ...args) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const searchPhrase = searchTerm.toLowerCase().trim();
    return args.some(arg => arg && String(arg).toLowerCase().includes(searchPhrase));
  };

  const shouldShowSection = (record, sectionId, title) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    if (stm(title)) return true;
    const fields = SECTION_FIELDS[sectionId] || [];
    return fields.some(f => {
      const label = FIELD_LABELS[f] || '';
      if (stm(label)) return true;
      const val = getFieldValue(record, f, record._originalIdx !== undefined ? record._originalIdx : 0);
      if (val && String(val).toLowerCase().includes(searchTerm.toLowerCase().trim())) return true;
      return false;
    });
  };

  // ── Copy Section helper ──

  const generateSectionCopyText = (record, idx, sectionId) => {
    const fields = SECTION_FIELDS[sectionId] || [];
    const sectionTitles = {
      'docinfo': 'DOCUMENT INFORMATION',
      'treatment': 'TREATMENT PREFERENCES',
      'proxy': 'HEALTHCARE PROXY',
      'specific': 'SPECIFIC INSTRUCTIONS',
      'notes': 'ADDITIONAL NOTES',
    };
    const lines = [sectionTitles[sectionId] || sectionId.toUpperCase()];

    fields.forEach(f => {
      const val = getFieldValue(record, f, idx);
      if (!hasValue(val)) return;
      const label = FIELD_LABELS[f] || f;
      if (DATE_FIELDS.includes(f)) { lines.push(`${label}: ${formatDate(val)}`); return; }
      const text = String(val);
      const isSentence = SENTENCE_FIELDS.includes(f);
      const needsFormat = isSentence && (splitBySentence(text).length > 1 || splitByComma(text).length >= 2);
      if (needsFormat) {
        lines.push(`${label}:`);
        formatSentenceFieldLines(text).forEach(l => lines.push(`  ${l}`));
      } else {
        lines.push(`${label}: ${val}`);
      }
    });
    return lines.join('\n');
  };

  // ── Copy All ──

  const generateAllCopyText = () => {
    return filteredRecords.map((record, rIdx) => {
      const idx = record._originalIdx !== undefined ? record._originalIdx : rIdx;
      const lines = [`Advance Directive ${idx + 1}`, ''];
      Object.keys(SECTION_FIELDS).forEach(sectionId => {
        const sectionText = generateSectionCopyText(record, idx, sectionId);
        if (sectionText.split('\n').length > 1) {
          lines.push(sectionText);
          lines.push('');
        }
      });
      return lines.join('\n');
    }).join('\n---\n\n');
  };

  // ── Empty state ──

  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <div className="advance-directives-document">
        <div className="document-header">
          <h1 className="document-title">Advance Directives</h1>
        </div>
        <div className="empty-state">No advance directives available.</div>
      </div>
    );
  }

  return (
    <div className="advance-directives-document">
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">Advance Directives</h1>
        <div className="header-actions">
          <button
            className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`}
            onClick={() => copyToClipboard(generateAllCopyText(), 'copy-all')}
          >
            {copiedId === 'copy-all' ? 'Copied' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<AdvanceDirectivesDocumentPDFTemplate document={pdfData} />}
            fileName={`advance-directives-${new Date().toISOString().split('T')[0]}.pdf`}
          >
            {({ loading }) => (
              <button className={`copy-btn pdf-btn${copiedId === 'pdf-export' ? ' copied' : ''}`}>
                {loading ? 'Preparing...' : 'Export PDF'}
              </button>
            )}
          </PDFDownloadLink>
        </div>
      </div>

      {/* Search */}
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search advance directives..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>
        )}
      </div>

      {filteredRecords.length === 0 && searchTerm && (
        <div className="no-results">No records match your search.</div>
      )}

      {/* Records */}
      <div className="records-container">
        {filteredRecords.map((record, rIdx) => {
          const idx = record._originalIdx !== undefined ? record._originalIdx : rIdx;
          const isSearching = searchTerm.trim().length > 0;

          // Section title matches
          const docInfoStm = stm('Document Information', ...['documentType', 'facility', 'documentLocation', 'witnessSignatures'].map(f => FIELD_LABELS[f]));
          const treatmentStm = stm('Treatment Preferences', ...['cprPreference', 'intubationPreference', 'dialysisPreference', 'artificialNutrition', 'comfortMeasures', 'organDonation'].map(f => FIELD_LABELS[f]));
          const proxyStm = stm('Healthcare Proxy', ...['healthcareProxy', 'alternateProxy'].map(f => FIELD_LABELS[f]));
          const specificStm = stm('Specific Instructions');
          const notesStm = stm('Additional Notes');

          // Section visibility
          const showDocInfo = shouldShowSection(record, 'docinfo', 'Document Information') &&
            (hasValue(getFieldValue(record, 'documentType', idx)) || hasValue(record.dateCompleted) || hasValue(getFieldValue(record, 'facility', idx)) || hasValue(record.reviewDate) || hasValue(getFieldValue(record, 'documentLocation', idx)) || hasValue(getFieldValue(record, 'witnessSignatures', idx)));
          const showTreatment = shouldShowSection(record, 'treatment', 'Treatment Preferences') &&
            ['cprPreference', 'intubationPreference', 'dialysisPreference', 'artificialNutrition', 'comfortMeasures', 'organDonation'].some(f => hasValue(getFieldValue(record, f, idx)));
          const showProxy = shouldShowSection(record, 'proxy', 'Healthcare Proxy') &&
            ['healthcareProxy', 'alternateProxy'].some(f => hasValue(getFieldValue(record, f, idx)));
          const showSpecific = shouldShowSection(record, 'specific', 'Specific Instructions') && hasValue(getFieldValue(record, 'specificInstructions', idx));
          const showNotes = shouldShowSection(record, 'notes', 'Additional Notes') && hasValue(getFieldValue(record, 'notes', idx));

          return (
            <div key={record._id || rIdx} className="record-card">
              {/* Record Header */}
              <div className="record-header">
                <div className="header-top-row">
                  {record.dateCompleted && (
                    <span className="date-badge">{highlightText(formatDate(record.dateCompleted))}</span>
                  )}
                </div>
                <h2 className="record-title">{highlightText(`Advance Directive ${idx + 1}`)}</h2>
                {record.documentType && (
                  <div className="record-subtitle">{highlightText(getFieldValue(record, 'documentType', idx) || record.documentType)}</div>
                )}
              </div>

              {/* DOCUMENT INFORMATION */}
              {showDocInfo && (() => {
                const showDocType = !isSearching || docInfoStm || record._showAllSections ||
                  shouldShowRow(record, 'Document Type', getFieldValue(record, 'documentType', idx));
                const showDateCompleted = !isSearching || docInfoStm || record._showAllSections ||
                  shouldShowRow(record, 'Date Completed', formatDate(record.dateCompleted));
                const showFacility = !isSearching || docInfoStm || record._showAllSections ||
                  shouldShowRow(record, 'Facility', getFieldValue(record, 'facility', idx));
                const showReviewDate = !isSearching || docInfoStm || record._showAllSections ||
                  shouldShowRow(record, 'Review Date', formatDate(record.reviewDate));
                const showDocLocation = !isSearching || docInfoStm || record._showAllSections ||
                  shouldShowRow(record, 'Document Location', getFieldValue(record, 'documentLocation', idx));
                const showWitness = !isSearching || docInfoStm || record._showAllSections ||
                  shouldShowRow(record, 'Witness Signatures', getFieldValue(record, 'witnessSignatures', idx));

                const hasVisibleFields = (hasValue(getFieldValue(record, 'documentType', idx)) && showDocType) ||
                  (hasValue(record.dateCompleted) && showDateCompleted) ||
                  (hasValue(getFieldValue(record, 'facility', idx)) && showFacility) ||
                  (hasValue(record.reviewDate) && showReviewDate) ||
                  (hasValue(getFieldValue(record, 'documentLocation', idx)) && showDocLocation) ||
                  (hasValue(getFieldValue(record, 'witnessSignatures', idx)) && showWitness);

                if (!hasVisibleFields) return null;

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h4 className="section-title">{highlightText('Document Information')}</h4>
                        <div className="header-right-actions">
                          <button
                            className={`copy-btn${copiedId === `docinfo-${idx}` ? ' copied' : ''}`}
                            onClick={() => copyToClipboard(generateSectionCopyText(record, idx, 'docinfo'), `docinfo-${idx}`)}
                          >
                            {copiedId === `docinfo-${idx}` ? 'Copied' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, idx, 'docinfo')}
                        </div>
                      </div>
                      {hasValue(getFieldValue(record, 'documentType', idx)) && showDocType &&
                        renderEditableField(record, 'documentType', idx, 'Document Type', 'docinfo', `doctype-${idx}`)}
                      {hasValue(record.dateCompleted) && showDateCompleted &&
                        renderDateField(record, 'dateCompleted', idx, 'Date Completed', 'docinfo', `datecompleted-${idx}`)}
                      {hasValue(getFieldValue(record, 'facility', idx)) && showFacility &&
                        renderEditableField(record, 'facility', idx, 'Facility', 'docinfo', `facility-${idx}`)}
                      {hasValue(record.reviewDate) && showReviewDate &&
                        renderDateField(record, 'reviewDate', idx, 'Review Date', 'docinfo', `reviewdate-${idx}`)}
                      {hasValue(getFieldValue(record, 'documentLocation', idx)) && showDocLocation &&
                        renderEditableField(record, 'documentLocation', idx, 'Document Location', 'docinfo', `doclocation-${idx}`)}
                      {hasValue(getFieldValue(record, 'witnessSignatures', idx)) && showWitness &&
                        renderEditableField(record, 'witnessSignatures', idx, 'Witness Signatures', 'docinfo', `witness-${idx}`)}
                    </div>
                  </div>
                );
              })()}

              {/* TREATMENT PREFERENCES */}
              {showTreatment && (() => {
                const treatFields = [
                  { field: 'cprPreference', label: 'CPR Preference', extra: ['DNR', 'Do Not Resuscitate'] },
                  { field: 'intubationPreference', label: 'Intubation Preference', extra: ['DNI', 'Do Not Intubate'] },
                  { field: 'dialysisPreference', label: 'Dialysis Preference', extra: [] },
                  { field: 'artificialNutrition', label: 'Artificial Nutrition', extra: ['Feeding Tube'] },
                  { field: 'comfortMeasures', label: 'Comfort Measures', extra: [] },
                  { field: 'organDonation', label: 'Organ Donation', extra: ['Organ Donor', 'Tissue Donation'] },
                ];

                const visibleFields = treatFields.filter(({ field, label, extra }) => {
                  const val = getFieldValue(record, field, idx);
                  if (!hasValue(val)) return false;
                  if (!isSearching || treatmentStm || record._showAllSections) return true;
                  return shouldShowRow(record, label, String(val), ...extra);
                });

                if (visibleFields.length === 0) return null;

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h4 className="section-title">{highlightText('Treatment Preferences')}</h4>
                        <div className="header-right-actions">
                          <button
                            className={`copy-btn${copiedId === `treatment-${idx}` ? ' copied' : ''}`}
                            onClick={() => copyToClipboard(generateSectionCopyText(record, idx, 'treatment'), `treatment-${idx}`)}
                          >
                            {copiedId === `treatment-${idx}` ? 'Copied' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, idx, 'treatment')}
                        </div>
                      </div>
                      {visibleFields.map(({ field, label }) => {
                        if (SENTENCE_FIELDS.includes(field)) {
                          return <React.Fragment key={field}>{renderSentenceEditableField(record, field, idx, label, 'treatment', `${field}`)}</React.Fragment>;
                        }
                        return <React.Fragment key={field}>{renderEditableField(record, field, idx, label, 'treatment', `${field}-${idx}`)}</React.Fragment>;
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* HEALTHCARE PROXY */}
              {showProxy && (() => {
                const proxyFields = [
                  { field: 'healthcareProxy', label: 'Healthcare Proxy' },
                  { field: 'alternateProxy', label: 'Alternate Proxy' },
                ];

                const visibleFields = proxyFields.filter(({ field, label }) => {
                  const val = getFieldValue(record, field, idx);
                  if (!hasValue(val)) return false;
                  if (!isSearching || proxyStm || record._showAllSections) return true;
                  return shouldShowRow(record, label, String(val));
                });

                if (visibleFields.length === 0) return null;

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h4 className="section-title">{highlightText('Healthcare Proxy')}</h4>
                        <div className="header-right-actions">
                          <button
                            className={`copy-btn${copiedId === `proxy-${idx}` ? ' copied' : ''}`}
                            onClick={() => copyToClipboard(generateSectionCopyText(record, idx, 'proxy'), `proxy-${idx}`)}
                          >
                            {copiedId === `proxy-${idx}` ? 'Copied' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, idx, 'proxy')}
                        </div>
                      </div>
                      {visibleFields.map(({ field, label }) => (
                        <React.Fragment key={field}>{renderEditableField(record, field, idx, label, 'proxy', `${field}-${idx}`)}</React.Fragment>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* SPECIFIC INSTRUCTIONS */}
              {showSpecific && (() => {
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h4 className="section-title">{highlightText('Specific Instructions')}</h4>
                        <div className="header-right-actions">
                          <button
                            className={`copy-btn${copiedId === `specific-${idx}` ? ' copied' : ''}`}
                            onClick={() => copyToClipboard(generateSectionCopyText(record, idx, 'specific'), `specific-${idx}`)}
                          >
                            {copiedId === `specific-${idx}` ? 'Copied' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, idx, 'specific')}
                        </div>
                      </div>
                      {renderSentenceEditableField(record, 'specificInstructions', idx, 'Specific Instructions', 'specific', 'specific')}
                    </div>
                  </div>
                );
              })()}

              {/* ADDITIONAL NOTES */}
              {showNotes && (() => {
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h4 className="section-title">{highlightText('Additional Notes')}</h4>
                        <div className="header-right-actions">
                          <button
                            className={`copy-btn${copiedId === `notes-${idx}` ? ' copied' : ''}`}
                            onClick={() => copyToClipboard(generateSectionCopyText(record, idx, 'notes'), `notes-${idx}`)}
                          >
                            {copiedId === `notes-${idx}` ? 'Copied' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, idx, 'notes')}
                        </div>
                      </div>
                      {renderSentenceEditableField(record, 'notes', idx, 'Notes', 'notes', 'notes')}
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

export default AdvanceDirectivesDocument;
