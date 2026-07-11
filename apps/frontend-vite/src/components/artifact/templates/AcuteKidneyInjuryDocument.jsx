import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import AcuteKidneyInjuryDocumentPDFTemplate from '../pdf-templates/AcuteKidneyInjuryDocumentPDFTemplate';
import './AcuteKidneyInjuryDocument.css';

/**
 * Acute Kidney Injury Document Template
 * With per-sentence editing, per-section approve, PDF export
 */

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { values: { [fieldName]: value }, payloads: [ {field,value,...} ] } }
   - values  → repopulate localEdits + render the staged edit
   - payloads → the EXACT PUT bodies the old save handlers would have sent; replayed on Approve. */
const DRAFT_KEY = 'acute_kidney_injuryPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const SECTION_FIELDS = {
  aki_parameters: ['stage', 'baselineCreatinine', 'peakCreatinine', 'urineOutput'],
  etiology: ['etiology'],
  precipitants: ['precipitants'],
  labs_indices: ['fenA', 'feUrea', 'urinaryIndices'],
  recovery: ['recovery', 'dialysisRequired'],
  provider_details: ['date', 'provider', 'facility'],
  findings: ['findings'],
  results: ['results'],
  assessment: ['assessment'],
  plan: ['plan'],
  notes: ['notes'],
  recommendations: ['recommendations'],
  status: ['status'],
};

const FIELD_LABELS = {
  stage: 'Stage',
  baselineCreatinine: 'Baseline Creatinine',
  peakCreatinine: 'Peak Creatinine',
  urineOutput: 'Urine Output',
  etiology: 'Etiology',
  precipitants: 'Precipitants',
  fenA: 'FENa',
  feUrea: 'FEUrea',
  urinaryIndices: 'Urinary Indices',
  recovery: 'Recovery',
  dialysisRequired: 'Dialysis Required',
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  findings: 'Findings',
  results: 'Results',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  recommendations: 'Recommendations',
  status: 'Status',
};

const SECTION_TITLES = {
  aki_parameters: 'AKI Parameters',
  etiology: 'Etiology',
  precipitants: 'Precipitants',
  labs_indices: 'Labs & Indices',
  recovery: 'Recovery & Dialysis',
  provider_details: 'Provider Details',
  findings: 'Findings',
  results: 'Results',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  recommendations: 'Recommendations',
  status: 'Status',
};

const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'notes', 'etiology', 'urineOutput', 'recovery'];
const OBJECT_FIELDS = ['urinaryIndices', 'results'];

const KEY_OVERRIDES = {
  fenA: 'FENa',
  feUrea: 'FEUrea',
  bun: 'BUN',
  egfr: 'eGFR',
  uOsm: 'Urine Osmolality',
  sOsm: 'Serum Osmolality',
};

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

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
const isScalar = (v) => v === null || typeof v !== 'object';
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};
const objectCopyLines = (value, indent = 0, label = '') => {
  const out = [];
  const pad = '  '.repeat(indent);
  if (isEmptyDeep(value)) return out;
  if (isScalar(value)) { out.push(`${pad}${label ? label + ': ' : ''}${fmtScalar(value)}`); return out; }
  if (label) out.push(`${pad}${label}`);
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
    out.push(...objectCopyLines(v, indent + (label ? 1 : 0), humanizeKey(k)));
  });
  return out;
};

const AcuteKidneyInjuryDocument = ({ document: templateData, data }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
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

  // Data unwrapping
  const unwrappedData = useMemo(() => {
    if (Array.isArray(templateData)) return templateData;
    if (templateData?.acute_kidney_injury) return templateData.acute_kidney_injury;
    if (templateData?.documentData) {
      const docData = templateData.documentData;
      if (Array.isArray(docData)) return docData;
      if (docData?.acute_kidney_injury) return docData.acute_kidney_injury;
      return [docData];
    }
    if (data) {
      if (Array.isArray(data)) return data;
      if (data?.acute_kidney_injury) return data.acute_kidney_injury;
      return [data];
    }
    if (templateData && typeof templateData === 'object') return [templateData];
    return [];
  }, [templateData, data]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    unwrappedData.forEach((record, idx) => {
      const recId = record && (record._id?.$oid || record._id);
      const recDraft = recId ? store[recId] : null;
      const values = recDraft && recDraft.values ? recDraft.values : null;
      if (!values) return;
      Object.entries(values).forEach(([fieldName, value]) => {
        const editKey = `${fieldName}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = true;
        // mark the first sentence/leaf row as edited so the modified badge + Pending Approve show
        nSentences[`${fieldName}-${idx}-s0`] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [unwrappedData]);

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch { return dateString; }
  };

  // Split by sentence
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

  // Split by comma respecting parens
  const splitByComma = (text) => {
    if (!text || typeof text !== 'string') return [];
    const items = [];
    let current = '';
    let parenDepth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') parenDepth++;
      else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
      if (ch === ',' && parenDepth === 0) {
        if (current.trim()) items.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) items.push(current.trim());
    return items;
  };

  // Parse label
  const parseLabel = (text) => {
    if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
    const colonIdx = text.indexOf(':');
    if (colonIdx > 0 && colonIdx < 50 && !text.substring(0, colonIdx).includes('(')) {
      const potentialLabel = text.substring(0, colonIdx).trim();
      if (/^[A-Z]/.test(potentialLabel) && potentialLabel.split(' ').length <= 5) {
        return { isLabeled: true, label: potentialLabel, value: text.substring(colonIdx + 1).trim() };
      }
    }
    return { isLabeled: false, label: '', value: text };
  };

  // Highlight text
  const highlightText = (text) => {
    if (!searchTerm || !searchTerm.trim() || !text) return text;
    const textStr = String(text);
    const phrase = searchTerm.trim();
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!escaped) return text;
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = textStr.split(regex);
    const phraseLower = phrase.toLowerCase();
    return parts.map((part, i) =>
      part.toLowerCase() === phraseLower ? <mark key={i}>{part}</mark> : part
    );
  };

  // Get field value with localEdits overlay
  const getFieldValue = (record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    return localEdits[editKey] !== undefined ? localEdits[editKey] : record[fieldName];
  };

  const formatValue = (val) => {
    if (val === null || val === undefined || val === '') return null;
    return String(val);
  };

  // Copy
  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Edit handlers
  const handleStartEdit = useCallback((fieldName, idx, currentValue, sentenceIdx = 0) => {
    const editKey = `${fieldName}-${idx}-s${sentenceIdx}`;
    setEditingField(editKey);
    const cleanValue = (currentValue || '').replace(/[.;]+$/, '').trim();
    setEditValue(cleanValue);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  // Stage a DRAFT for one field of a record: keep the value (for render) + the EXACT PUT body
  // (for replay on Approve) in the localStorage draft store. NO DB write here. `field`/`value`/
  // `sentenceIdx` in `payload` mirror exactly what the old handler PUT to /api/edit/.../edit.
  const stageDraft = useCallback((recordId, fieldName, idx, value, payload) => {
    const fullEditKey = `${fieldName}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [fullEditKey]: value }));
    setPendingEdits(prev => ({ ...prev, [fullEditKey]: true }));
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = { values: {}, payloads: [] };
    if (!store[recordId].values) store[recordId].values = {};
    if (!Array.isArray(store[recordId].payloads)) store[recordId].payloads = [];
    store[recordId].values[fieldName] = value;
    // collapse repeated edits to the same dotted field/array into the latest payload
    store[recordId].payloads = store[recordId].payloads.filter(p => p.field !== payload.field);
    store[recordId].payloads.push(payload);
    writeDrafts(store);
  }, []);

  const handleSaveField = useCallback((record, fieldName, idx, sectionId, sentenceIdx, valueOverride, editTrackingKey) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) { console.error('Cannot save — no record _id'); return; }
    let saveValue = valueOverride !== undefined ? valueOverride : editValue.trim();
    // Boolean conversion for dialysisRequired
    if (fieldName === 'dialysisRequired' && typeof saveValue === 'string') {
      saveValue = saveValue.toLowerCase() === 'yes' || saveValue.toLowerCase() === 'true';
    }
    const sKey = editTrackingKey || `${fieldName}-${idx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;
    // Stage locally only (survives refresh). DB write is deferred to Approve (handleApproveSection).
    stageDraft(recordId, fieldName, idx, saveValue, {
      field: fieldName, value: saveValue,
      sentenceIdx: sentenceIdx !== undefined ? sentenceIdx : 0,
    });
    const fullEditKey = `${fieldName}-${idx}`;
    setEditedFields(prev => ({ ...prev, [fullEditKey]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    // Re-edit after approval → drop the section 'approved' flag so the button returns to yellow Pending
    setApprovedSections(prev => { const u = { ...prev }; delete u[`${sectionId}-${idx}`]; return u; });
    setEditingField(null);
    setEditValue('');
  }, [editValue, stageDraft]);

  // Reconstruct full text — PLAIN FUNCTION
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

  // Save sentence — PLAIN FUNCTION
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

  // Approve section
  // Approve = COMMIT this section's staged drafts to MongoDB (replaying the EXACT payloads the old
  // save handlers would have sent), then flag the section approved. This is the ONLY DB writer.
  const handleApproveSection = useCallback(async (record, idx, sectionId) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) return;
    const approveKey = `${sectionId}-${idx}`;
    const isCurrentlyApproved = approvedSections[approveKey];
    const fields = SECTION_FIELDS[sectionId] || [];
    setApproving(true);
    try {
      if (!isCurrentlyApproved) {
        // Replay every staged payload whose root field belongs to this section.
        const store = readDrafts();
        const recDraft = store[recordId];
        const payloads = (recDraft && Array.isArray(recDraft.payloads)) ? recDraft.payloads : [];
        const isSectionField = (f) => {
          const root = String(f).split('.')[0];
          return fields.includes(root);
        };
        const committedKeys = [];
        for (const payload of payloads) {
          if (!isSectionField(payload.field)) continue;
          const resp = await secureApiClient.put(`/api/edit/acute_kidney_injury/${recordId}/edit`, payload);
          if (!resp || resp.success === false) throw new Error((resp && resp.error) || 'save failed');
          committedKeys.push(payload.field);
        }
        // Audit-flag the section approved (same endpoint/shape as before).
        await secureApiClient.put(`/api/edit/acute_kidney_injury/${recordId}/approve`, {
          sectionId, approved: true,
        });
        // Clear pending markers for this section's fields → committed values now flow into pdfData/PDF.
        setPendingEdits(prev => {
          const next = { ...prev };
          fields.forEach(f => delete next[`${f}-${idx}`]);
          return next;
        });
        // Drop this section's committed entries from the localStorage draft store.
        if (recDraft) {
          recDraft.payloads = payloads.filter(p => !committedKeys.includes(p.field));
          if (recDraft.values) fields.forEach(f => { delete recDraft.values[f]; });
          const noValues = !recDraft.values || Object.keys(recDraft.values).length === 0;
          const noPayloads = !recDraft.payloads || recDraft.payloads.length === 0;
          if (noValues && noPayloads) delete store[recordId];
          writeDrafts(store);
        }
      } else {
        // Un-approving an already-approved section: just flip the audit flag, no edits to commit.
        await secureApiClient.put(`/api/edit/acute_kidney_injury/${recordId}/approve`, {
          sectionId, approved: false,
        });
      }
      setApprovedSections(prev => ({ ...prev, [approveKey]: !isCurrentlyApproved }));
      if (!isCurrentlyApproved) {
        setEditedSentences(prev => {
          const next = { ...prev };
          for (const key of Object.keys(next)) {
            if (fields.some(f => key.startsWith(`${f}-${idx}-s`) || key.startsWith(`${f}-${idx}-item`))) {
              delete next[key];
            }
          }
          return next;
        });
        setEditedFields(prev => {
          const next = { ...prev };
          for (const key of Object.keys(next)) {
            if (fields.some(f => key.startsWith(`${f}-${idx}`))) {
              delete next[key];
            }
          }
          return next;
        });
      }
    } catch (error) {
      console.error('Approve failed:', error);
    } finally {
      setApproving(false);
    }
  }, [approvedSections]);

  // Section has edits
  const sectionHasEdits = useCallback((sectionId, idx) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    if (approvedSections[`${sectionId}-${idx}`]) return false;
    return fields.some(f => {
      const hasSentenceEdits = Object.keys(editedSentences).some(key => {
        if (!key.startsWith(`${f}-${idx}-s`) && !key.startsWith(`${f}-${idx}-item`)) return false;
        return editedSentences[key] === 'edited' || editedSentences[key] === 'added';
      });
      const hasObjectEdits = Object.keys(editedFields).some(key => key.startsWith(`${f}-${idx}`));
      return hasSentenceEdits || hasObjectEdits;
    });
  }, [editedSentences, editedFields, approvedSections]);

  // Should show row
  const shouldShowRow = (record, ...args) => {
    if (!searchTerm || !searchTerm.trim()) return true;
    if (record._showAllSections) return true;
    const rowText = args.filter(Boolean).map(item => String(item)).join(' ').toLowerCase();
    const searchLower = searchTerm.toLowerCase().trim();
    return rowText.includes(searchLower);
  };

  // Filtered records
  const filteredRecords = useMemo(() => {
    const withMeta = unwrappedData.map((record, idx) => ({
      ...record,
      _documentTitle: `AKI Assessment ${idx + 1}`,
      _originalIdx: idx,
      _showAllSections: false,
    }));
    if (!searchTerm || !searchTerm.trim()) return withMeta;
    const searchLower = searchTerm.toLowerCase().trim();

    return withMeta.filter((record, idx) => {
      record._showAllSections = false;
      const recordTitle = `AKI Assessment ${idx + 1}`;
      const searchableText = [
        'Acute Kidney Injury', recordTitle,
        ...Object.values(SECTION_TITLES),
        ...Object.values(FIELD_LABELS),
        formatDate(record.date), record.stage,
        record.baselineCreatinine, record.peakCreatinine, record.urineOutput,
        record.etiology, record.fenA, record.feUrea,
        record.recovery, record.provider, record.facility,
        record.findings, record.assessment, record.plan, record.notes, record.status,
        flattenSearchable(record.urinaryIndices), flattenSearchable(record.results),
        ...(record.precipitants || []),
        ...(record.recommendations || []).map(r => typeof r === 'string' ? r : r.recommendation || ''),
      ].filter(Boolean).join(' ').toLowerCase();

      const matches = searchableText.includes(searchLower);
      if (matches) {
        const titleLower = recordTitle.toLowerCase();
        if (titleLower.startsWith(searchLower) || searchLower.startsWith(titleLower) ||
            'acute kidney injury'.startsWith(searchLower) || searchLower.startsWith('acute kidney injury')) {
          record._showAllSections = true;
        }
      }
      return matches;
    });
  }, [unwrappedData, searchTerm]);

  // pdfData memo
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

  // Render approve button
  const renderApproveBtn = (record, idx, sectionId) => {
    const approveKey = `${sectionId}-${idx}`;
    const hasEdits = sectionHasEdits(sectionId, idx);
    const isApproved = approvedSections[approveKey];
    if (!hasEdits && !isApproved) return null;
    return (
      <button
        className={`approve-btn ${isApproved ? 'approved' : 'pending'}`}
        onClick={() => handleApproveSection(record, idx, sectionId)}
        disabled={approving}
      >
        {approving ? 'Approving...' : isApproved ? 'Approved' : 'Pending Approve'}
      </button>
    );
  };

  // Render editable field (simple fields)
  const renderEditableField = (record, fieldName, idx, sectionId, label, copyId) => {
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const isEdited = editedSentences[editKey] === 'edited';
    const val = getFieldValue(record, fieldName, idx);
    const displayVal = fieldName === 'dialysisRequired'
      ? (val === true || val === 'true' || val === 'Yes' ? 'Yes' : 'No')
      : formatValue(val);
    if (displayVal === null && !isEditing) return null;

    return (
      <React.Fragment key={copyId}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
          {isEditing ? (
            <div className="edit-field-container">
              {fieldName === 'dialysisRequired' ? (
                <select
                  className="edit-select"
                  value={editValue}
                  autoFocus
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              ) : (
                <textarea
                  ref={textareaRef}
                  className="edit-textarea"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      handleSaveField(record, fieldName, idx, sectionId, 0);
                    } else if (e.key === 'Escape') {
                      setEditingField(null);
                      setEditValue('');
                    }
                  }}
                  disabled={saving}
                />
              )}
              <div className="edit-actions">
                <button className="save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId, 0)} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div
                className={`row-content${canEdit ? ' editable' : ''}`}
                onClick={() => canEdit && handleStartEdit(fieldName, idx, displayVal, 0)}
              >
                <span className="content-value">{highlightText(displayVal)}</span>
                {canEdit && !isEdited && <span className="edit-indicator">✏️</span>}
              </div>
              <button
                className={`copy-btn${copiedId === copyId ? ' copied' : ''}`}
                onClick={() => copyToClipboard(label ? `${label}: ${displayVal}` : displayVal, copyId)}
              >
                {copiedId === copyId ? 'Copied' : 'Copy'}
              </button>
            </>
          )}
        </div>
        {isEdited && <div className="modified-badge">edited — click Pending Approve to save</div>}
      </React.Fragment>
    );
  };

  // Save an object leaf via dotted path
  const saveObjectLeaf = useCallback((record, rootField, path, idx, sectionId, leafKeyTrack, newVal) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) { console.error('Cannot save — no record _id'); return; }
    const dottedField = `${rootField}.${path.join('.')}`;
    const fullEditKey = `${rootField}-${idx}`;
    // Build the merged object for render (overlay the leaf onto the latest local/original value).
    const cur = localEdits[fullEditKey] !== undefined ? localEdits[fullEditKey] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) {
      if (typeof node[path[i]] !== 'object' || node[path[i]] === null) node[path[i]] = {};
      node = node[path[i]];
    }
    node[path[path.length - 1]] = newVal;
    // Stage locally only — DB write deferred to Approve. The payload uses the dotted leaf field
    // (e.g. "urinaryIndices.fenA") exactly as the old DB call did; the localEdits/render value is
    // the merged root object. Keyed by dotted field so multiple leaf edits each replay correctly.
    stageDraft(recordId, rootField, idx, clone, { field: dottedField, value: newVal, sentenceIdx: 0 });
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: true }));
    setEditedSentences(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const u = { ...prev }; delete u[`${sectionId}-${idx}`]; return u; });
    setEditingField(null);
    setEditValue('');
  }, [localEdits, stageDraft]);

  // Render object leaf (editable; boolean -> Yes/No select, else text)
  const renderObjectLeaf = (record, rootField, path, idx, sectionId, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedSentences[leafKey] === 'edited';
    const isBool = typeof value === 'boolean';
    const editStartValue = isBool ? (value ? 'Yes' : 'No') : leafValueString;
    const leafLabel = humanizeKey(path[path.length - 1]);
    const copyLeafId = `${rootField}-${idx}-leaf-${path.join('.')}`;

    return (
      <div key={path.join('.')} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(leafLabel)}</div>
        <div className={`numbered-row${isModified ? ' modified' : ''}`}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <select
                  className="edit-select"
                  value={editValue}
                  autoFocus
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              ) : (
                <textarea
                  ref={textareaRef}
                  className="edit-textarea"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      saveObjectLeaf(record, rootField, path, idx, sectionId, leafKey, editValue.trim());
                    } else if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                  }}
                  disabled={saving}
                />
              )}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={() => {
                  const newVal = isBool ? (editValue === 'Yes') : editValue.trim();
                  saveObjectLeaf(record, rootField, path, idx, sectionId, leafKey, newVal);
                }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div
                className={`row-content${canEdit ? ' editable' : ''}`}
                onClick={() => { if (canEdit) { setEditingField(leafKey); setEditValue(editStartValue); setTimeout(() => textareaRef.current?.focus(), 50); } }}
              >
                <span className="content-value">{highlightText(leafValueString)}</span>
                {canEdit && !isModified && <span className="edit-indicator">✏️</span>}
              </div>
              <button
                className={`copy-btn${copiedId === copyLeafId ? ' copied' : ''}`}
                onClick={() => copyToClipboard(`${leafLabel}: ${leafValueString}`, copyLeafId)}
              >
                {copiedId === copyLeafId ? 'Copied' : 'Copy'}
              </button>
            </>
          )}
        </div>
        {isModified && <div className="modified-badge">edited — click Pending Approve to save</div>}
      </div>
    );
  };

  // Render object node (recursive)
  const renderObjectNode = (record, rootField, idx, sectionId, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sectionId, value);
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && <div className={labelClass}>{highlightText(label)}</div>}
        <div className="nested-group">
          {entries.map(([k, v]) => (
            isScalar(v)
              ? renderObjectLeaf(record, rootField, [...path, k], idx, sectionId, v)
              : <div className="nested-mini-card" key={k}>{renderObjectNode(record, rootField, idx, sectionId, humanizeKey(k), v, [...path, k], depth + 1)}</div>
          ))}
        </div>
      </React.Fragment>
    );
  };

  // Render an OBJECT root field
  const renderObjectField = (record, fieldName, idx, sectionId, showLabel) => {
    const val = getFieldValue(record, fieldName, idx);
    if (!val || isScalar(val) || isEmptyDeep(val)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    const label = showLabel ? (FIELD_LABELS[fieldName] || fieldName) : null;
    return (
      <div key={fieldName} className="rec-mini-card">
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([k, v]) => (
          isScalar(v)
            ? renderObjectLeaf(record, fieldName, [k], idx, sectionId, v)
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fieldName, idx, sectionId, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    );
  };

  // Render date field with native date picker
  const renderDateField = (record, fieldName, idx, sectionId, label, copyId) => {
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const isEdited = editedSentences[editKey] === 'edited';
    const rawVal = getFieldValue(record, fieldName, idx);
    if ((rawVal === null || rawVal === undefined || rawVal === '') && !isEditing) return null;
    const displayVal = formatDate(rawVal);
    const toInputDate = (v) => {
      if (!v) return '';
      const d = new Date(v);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().slice(0, 10);
    };

    return (
      <React.Fragment key={copyId}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
          {isEditing ? (
            <div className="edit-field-container">
              <input
                type="date"
                className="edit-input"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { handleSaveField(record, fieldName, idx, sectionId, 0); }
                  else if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                }}
                disabled={saving}
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
              <div
                className={`row-content${canEdit ? ' editable' : ''}`}
                onClick={() => { if (canEdit) { setEditingField(editKey); setEditValue(toInputDate(rawVal)); } }}
              >
                <span className="content-value">{highlightText(displayVal)}</span>
                {canEdit && !isEdited && <span className="edit-indicator">✏️</span>}
              </div>
              <button
                className={`copy-btn${copiedId === copyId ? ' copied' : ''}`}
                onClick={() => copyToClipboard(label ? `${label}: ${displayVal}` : displayVal, copyId)}
              >
                {copiedId === copyId ? 'Copied' : 'Copy'}
              </button>
            </>
          )}
        </div>
        {isEdited && <div className="modified-badge">edited — click Pending Approve to save</div>}
      </React.Fragment>
    );
  };

  // Render sentence editable field
  const renderSentenceEditableField = (record, fieldName, idx, sectionId, label, copyId) => {
    const val = getFieldValue(record, fieldName, idx);
    const strVal = formatValue(val);
    if (!strVal) return renderEditableField(record, fieldName, idx, sectionId, label, copyId);

    const sentences = splitBySentence(strVal);
    if (sentences.length <= 1 && splitByComma(strVal).length < 2) {
      return renderEditableField(record, fieldName, idx, sectionId, label, copyId);
    }

    // Level 4: Determine if we need to filter individual sentences
    const shouldFilterSentences = (() => {
      if (!searchTerm.trim() || record._showAllSections) return false;
      const p = searchTerm.toLowerCase().trim();
      const sTitle = SECTION_TITLES[sectionId] || '';
      const st = sTitle.toLowerCase();
      if (st.startsWith(p) || p.startsWith(st)) return false;
      if (label) {
        const lt = label.toLowerCase();
        if (lt.startsWith(p) || p.startsWith(lt)) return false;
      }
      return true;
    })();
    const firstVisibleSIdx = shouldFilterSentences
      ? sentences.findIndex(s => shouldShowRow(record, s))
      : 0;

    return sentences.map((sentence, sIdx) => {
      // Level 4: Filter non-matching sentences
      if (shouldFilterSentences && !shouldShowRow(record, sentence)) return null;

      const parsed = parseLabel(sentence);
      const isLabeled = parsed.isLabeled;
      const itemLabel = isLabeled ? parsed.label : null;
      const itemValue = isLabeled ? parsed.value : sentence;
      const commaItems = splitByComma(itemValue);
      const displayParts = commaItems.length >= 2 ? commaItems : [itemValue];

      return displayParts.map((part, pi) => {
        const partEditKey = displayParts.length > 1
          ? `${fieldName}-${idx}-s${sIdx}-p${pi}`
          : `${fieldName}-${idx}-s${sIdx}`;
        const isPartEditing = editingField === partEditKey;
        const isPartEdited = editedSentences[partEditKey] === 'edited' || editedSentences[partEditKey] === 'added';
        const partCopyId = `${copyId}-s${sIdx}-p${pi}`;
        const showLabel = label && sIdx === firstVisibleSIdx && pi === 0;
        const showSubLabel = isLabeled && pi === 0;

        return (
          <React.Fragment key={partCopyId}>
            {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
            {showSubLabel && <div className="nested-subtitle">{highlightText(itemLabel)}</div>}
            <div className={`numbered-row${isPartEdited ? ' modified' : ''}`}>
              {isPartEditing ? (
                <div className="edit-field-container">
                  <textarea
                    ref={textareaRef}
                    className="edit-textarea"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        if (displayParts.length > 1) {
                          const newParts = [...displayParts];
                          newParts[pi] = editValue.trim();
                          const fullSentence = isLabeled
                            ? `${itemLabel}: ${newParts.join(', ')}`
                            : newParts.join(', ');
                          const sourceText = getFieldValue(record, fieldName, idx) || record[fieldName] || '';
                          const allSentences = splitBySentence(sourceText);
                          allSentences[sIdx] = fullSentence;
                          const newFullText = allSentences.map(s => (s && !/[.!?]$/.test(s)) ? s + '.' : s).join(' ');
                          handleSaveField(record, fieldName, idx, sectionId, 0, newFullText, partEditKey);
                        } else {
                          saveSentence(record, fieldName, idx, sectionId, sIdx);
                        }
                      } else if (e.key === 'Escape') {
                        setEditingField(null);
                        setEditValue('');
                      }
                    }}
                    disabled={saving}
                  />
                  <div className="edit-actions">
                    <button className="save-btn" onClick={() => {
                      if (displayParts.length > 1) {
                        const newParts = [...displayParts];
                        newParts[pi] = editValue.trim();
                        const fullSentence = isLabeled
                          ? `${itemLabel}: ${newParts.join(', ')}`
                          : newParts.join(', ');
                        const sourceText = getFieldValue(record, fieldName, idx) || record[fieldName] || '';
                        const allSentences = splitBySentence(sourceText);
                        allSentences[sIdx] = fullSentence;
                        const newFullText = allSentences.map(s => (s && !/[.!?]$/.test(s)) ? s + '.' : s).join(' ');
                        handleSaveField(record, fieldName, idx, sectionId, 0, newFullText, partEditKey);
                      } else {
                        saveSentence(record, fieldName, idx, sectionId, sIdx);
                      }
                    }} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className={`row-content${canEdit ? ' editable' : ''}`}
                    onClick={() => canEdit && handleStartEdit(fieldName, idx, part, displayParts.length > 1 ? undefined : sIdx)}
                  >
                    <span className="content-value">{highlightText(part)}</span>
                    {canEdit && !isPartEdited && <span className="edit-indicator">✏️</span>}
                  </div>
                  <button
                    className={`copy-btn${copiedId === partCopyId ? ' copied' : ''}`}
                    onClick={() => copyToClipboard(part, partCopyId)}
                  >
                    {copiedId === partCopyId ? 'Copied' : 'Copy'}
                  </button>
                </>
              )}
            </div>
            {isPartEdited && <div className="modified-badge">edited — click Pending Approve to save</div>}
          </React.Fragment>
        );
      });
    });
  };

  // Get section copy text
  const getSectionCopyText = (record, idx, sectionId) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return '';
    const lines = [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (f === 'precipitants') {
        const arr = val || record.precipitants;
        if (arr?.length > 0) {
          lines.push(`${label.toUpperCase()}`);
          arr.forEach((item, i) => lines.push(`  ${i + 1}. ${item}`));
        }
      } else if (f === 'recommendations') {
        const arr = val || record.recommendations;
        if (arr?.length > 0) {
          lines.push(`${label.toUpperCase()}`);
          arr.forEach((r, i) => {
            const t = typeof r === 'string' ? r : r.recommendation || '';
            lines.push(`  ${i + 1}. ${t}`);
          });
        }
      } else if (OBJECT_FIELDS.includes(f)) {
        if (!isEmptyDeep(val)) {
          lines.push(`${label.toUpperCase()}`);
          objectCopyLines(val, 1).forEach(l => lines.push(l));
        }
      } else if (f === 'dialysisRequired') {
        const boolVal = val === true || val === 'true' || val === 'Yes' ? 'Yes' : 'No';
        lines.push(`${label}: ${boolVal}`);
      } else if (f === 'date') {
        const text = formatDate(val);
        if (text) lines.push(`${label}: ${text}`);
      } else if (SENTENCE_FIELDS.includes(f)) {
        const text = formatValue(val);
        if (text) {
          const sentences = splitBySentence(text);
          if (sentences.length > 1) {
            lines.push(`${label.toUpperCase()}`);
            sentences.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
          } else {
            lines.push(`${label}: ${text}`);
          }
        }
      } else {
        const text = formatValue(val);
        if (text) lines.push(`${label}: ${text}`);
      }
    });
    return lines.join('\n');
  };

  // Get all record text
  const getAllRecordText = (record, idx) => {
    const lines = [`AKI Assessment ${idx + 1}`];
    if (record.date) lines.push(`Date: ${formatDate(record.date)}`);
    lines.push('');
    Object.keys(SECTION_FIELDS).forEach(sectionId => {
      const sectionText = getSectionCopyText(record, idx, sectionId);
      if (sectionText) lines.push(sectionText, '');
    });
    return lines.join('\n');
  };

  // Empty state
  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <div className="acute-kidney-injury-document">
        <div className="empty-state">
          <div className="empty-icon">🩺</div>
          <div className="empty-text">No acute kidney injury records available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="acute-kidney-injury-document">
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">Acute Kidney Injury</h1>
        <div className="header-actions">
          <button
            className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`}
            onClick={() => {
              const allText = filteredRecords.map(r => getAllRecordText(r, r._originalIdx)).join('\n\n---\n\n');
              copyToClipboard(allText, 'copy-all');
            }}
          >
            {copiedId === 'copy-all' ? 'Copied' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<AcuteKidneyInjuryDocumentPDFTemplate document={pdfData} />}
            fileName="Acute_Kidney_Injury.pdf"
          >
            {({ loading }) => (
              <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>
            )}
          </PDFDownloadLink>
        </div>
      </div>

      {/* Search */}
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search AKI records..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>
        )}
      </div>

      {/* No Results */}
      {filteredRecords.length === 0 && (
        <div className="no-results">
          <p>No results found for &quot;{searchTerm}&quot;</p>
        </div>
      )}

      {/* Records */}
      <div className="records-list">
        {filteredRecords.map((record, idx) => {
          const origIdx = record._originalIdx;

          // Variadic stm for this record
          const stm = (...titles) => {
            if (!searchTerm.trim() || record._showAllSections) return true;
            const p = searchTerm.toLowerCase().trim();
            return titles.some(title => {
              const t = (title || '').toLowerCase();
              return t.startsWith(p) || p.startsWith(t);
            });
          };

          // Should show section
          const shouldShowSection = (sectionId, title) => {
            if (!searchTerm.trim() || record._showAllSections) return true;
            if (stm(title)) return true;
            const fields = SECTION_FIELDS[sectionId] || [];
            return fields.some(f => {
              const label = FIELD_LABELS[f] || '';
              if (stm(label)) return true;
              const val = getFieldValue(record, f, origIdx);
              if (f === 'precipitants') {
                return (val || []).some(item => shouldShowRow(record, item));
              }
              if (f === 'recommendations') {
                return (val || []).some(r => {
                  const t = typeof r === 'string' ? r : r.recommendation || '';
                  return shouldShowRow(record, t);
                });
              }
              if (OBJECT_FIELDS.includes(f)) {
                return !isEmptyDeep(val) && shouldShowRow(record, label, flattenSearchable(val));
              }
              if (f === 'dialysisRequired') {
                const boolVal = val === true || val === 'true' || val === 'Yes' ? 'Yes' : 'No';
                return shouldShowRow(record, boolVal);
              }
              if (f === 'date') {
                return val && shouldShowRow(record, label, formatDate(val));
              }
              return formatValue(val) !== null && shouldShowRow(record, label, val);
            });
          };

          // Render a section
          const renderSection = (sectionId) => {
            const title = SECTION_TITLES[sectionId];
            if (!shouldShowSection(sectionId, title)) return null;

            const fields = SECTION_FIELDS[sectionId];
            const copySectionId = `${sectionId}-section-${origIdx}`;

            // Check if section has any data
            const hasData = fields.some(f => {
              if (f === 'precipitants') return (getFieldValue(record, f, origIdx) || record.precipitants || []).length > 0;
              if (f === 'recommendations') return (getFieldValue(record, f, origIdx) || record.recommendations || []).length > 0;
              if (OBJECT_FIELDS.includes(f)) return !isEmptyDeep(getFieldValue(record, f, origIdx));
              if (f === 'dialysisRequired') return record.dialysisRequired !== undefined;
              return formatValue(getFieldValue(record, f, origIdx)) !== null;
            });
            if (!hasData) return null;

            // Level 2+3: If section title matches, show all fields; otherwise filter per-field
            const sectionTitleMatches = stm(title);

            return (
              <div key={sectionId} className="section">
                <div className="mini-cards-container">
                  <div className="section-header">
                    <h3 className="section-title">{highlightText(title)}</h3>
                    <div className="header-right-actions">
                      <button
                        className={`section-copy-btn${copiedId === copySectionId ? ' copied' : ''}`}
                        onClick={() => copyToClipboard(getSectionCopyText(record, origIdx, sectionId), copySectionId)}
                      >
                        {copiedId === copySectionId ? 'Copied' : 'Copy Section'}
                      </button>
                      {renderApproveBtn(record, origIdx, sectionId)}
                    </div>
                  </div>

                  <div className="rec-mini-card">
                  {/* Render fields — skip label for single-field sections (section header already shows it) */}
                  {fields.map(fieldName => {
                    // Level 3: Per-field filtering when section title doesn't match
                    if (!sectionTitleMatches && fieldName !== 'precipitants' && fieldName !== 'recommendations' && !OBJECT_FIELDS.includes(fieldName)) {
                      const fieldLabel = FIELD_LABELS[fieldName] || '';
                      if (!stm(fieldLabel)) {
                        const val = getFieldValue(record, fieldName, origIdx);
                        const strVal = fieldName === 'dialysisRequired'
                          ? (val === true || val === 'true' || val === 'Yes' ? 'Yes' : 'No')
                          : fieldName === 'date'
                          ? formatDate(val)
                          : formatValue(val);
                        if (!shouldShowRow(record, fieldLabel, strVal)) return null;
                      }
                    }
                    const showLabel = fields.length > 1;
                    const label = showLabel ? FIELD_LABELS[fieldName] : null;
                    if (fieldName === 'precipitants') {
                      return renderPrecipitants(record, origIdx, sectionId);
                    }
                    if (fieldName === 'recommendations') {
                      return renderRecommendations(record, origIdx, sectionId);
                    }
                    if (OBJECT_FIELDS.includes(fieldName)) {
                      return renderObjectField(record, fieldName, origIdx, sectionId, showLabel);
                    }
                    if (fieldName === 'date') {
                      return renderDateField(record, 'date', origIdx, sectionId, showLabel ? 'Date' : null, `date-${origIdx}`);
                    }
                    if (fieldName === 'dialysisRequired') {
                      return renderEditableField(record, 'dialysisRequired', origIdx, sectionId, showLabel ? 'Dialysis Required' : null, `dialysis-${origIdx}`);
                    }
                    if (SENTENCE_FIELDS.includes(fieldName)) {
                      return renderSentenceEditableField(record, fieldName, origIdx, sectionId, label, `${fieldName}-${origIdx}`);
                    }
                    return renderEditableField(record, fieldName, origIdx, sectionId, label, `${fieldName}-${origIdx}`);
                  })}
                  </div>
                </div>
              </div>
            );
          };

          // Render precipitants array
          const renderPrecipitants = (record, idx, sectionId) => {
            const allPrec = getFieldValue(record, 'precipitants', idx) || record.precipitants || [];
            if (allPrec.length === 0) return null;

            return allPrec.map((item, pIdx) => {
              const editKey = `precipitants-${idx}-item-${pIdx}`;
              const isEditing = editingField === editKey;
              const isEdited = editedSentences[editKey] === 'edited';
              const copyItemId = `precipitant-${idx}-${pIdx}`;

              if (!record._showAllSections && searchTerm.trim() && !stm('Precipitants') && !shouldShowRow(record, item)) {
                return null;
              }

              return (
                <React.Fragment key={copyItemId}>
                  <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea
                          ref={textareaRef}
                          className="edit-textarea"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                              const updated = [...allPrec];
                              updated[pIdx] = editValue.trim();
                              handleSaveField(record, 'precipitants', idx, sectionId, 0, updated, editKey);
                            } else if (e.key === 'Escape') {
                              setEditingField(null);
                              setEditValue('');
                            }
                          }}
                          disabled={saving}
                        />
                        <div className="edit-actions">
                          <button className="save-btn" onClick={() => {
                            const updated = [...allPrec];
                            updated[pIdx] = editValue.trim();
                            handleSaveField(record, 'precipitants', idx, sectionId, 0, updated, editKey);
                          }} disabled={saving}>
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                          <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          className={`row-content${canEdit ? ' editable' : ''}`}
                          onClick={() => {
                            if (!canEdit) return;
                            setEditingField(editKey);
                            setEditValue(item);
                            setTimeout(() => textareaRef.current?.focus(), 50);
                          }}
                        >
                          {/* Label omitted — section header already shows "Precipitants" */}
                          <span className="content-value">{highlightText(item)}</span>
                          {canEdit && !isEdited && <span className="edit-indicator">✏️</span>}
                        </div>
                        <button
                          className={`copy-btn${copiedId === copyItemId ? ' copied' : ''}`}
                          onClick={() => copyToClipboard(item, copyItemId)}
                        >
                          {copiedId === copyItemId ? 'Copied' : 'Copy'}
                        </button>
                      </>
                    )}
                  </div>
                  {isEdited && <div className="modified-badge">edited — click Pending Approve to save</div>}
                </React.Fragment>
              );
            });
          };

          // Render recommendations array
          const renderRecommendations = (record, idx, sectionId) => {
            const allRecs = getFieldValue(record, 'recommendations', idx) || record.recommendations || [];
            if (allRecs.length === 0) return null;

            return allRecs.map((rec, rIdx) => {
              const recText = typeof rec === 'string' ? rec : rec.recommendation || '';
              const editKey = `recommendations-${idx}-item-${rIdx}`;
              const isEditing = editingField === editKey;
              const isEdited = editedSentences[editKey] === 'edited';
              const copyItemId = `recommendation-${idx}-${rIdx}`;

              if (!record._showAllSections && searchTerm.trim() && !stm('Recommendations') && !shouldShowRow(record, recText)) {
                return null;
              }

              return (
                <React.Fragment key={copyItemId}>
                  <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea
                          ref={textareaRef}
                          className="edit-textarea"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                              const updated = [...allRecs];
                              updated[rIdx] = typeof rec === 'string'
                                ? editValue.trim()
                                : { ...rec, recommendation: editValue.trim() };
                              handleSaveField(record, 'recommendations', idx, sectionId, 0, updated, editKey);
                            } else if (e.key === 'Escape') {
                              setEditingField(null);
                              setEditValue('');
                            }
                          }}
                          disabled={saving}
                        />
                        <div className="edit-actions">
                          <button className="save-btn" onClick={() => {
                            const updated = [...allRecs];
                            updated[rIdx] = typeof rec === 'string'
                              ? editValue.trim()
                              : { ...rec, recommendation: editValue.trim() };
                            handleSaveField(record, 'recommendations', idx, sectionId, 0, updated, editKey);
                          }} disabled={saving}>
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                          <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          className={`row-content${canEdit ? ' editable' : ''}`}
                          onClick={() => {
                            if (!canEdit) return;
                            setEditingField(editKey);
                            setEditValue(recText);
                            setTimeout(() => textareaRef.current?.focus(), 50);
                          }}
                        >
                          {/* Label omitted — section header already shows "Recommendations" */}
                          <span className="content-value">{highlightText(recText)}</span>
                          {canEdit && !isEdited && <span className="edit-indicator">✏️</span>}
                        </div>
                        <button
                          className={`copy-btn${copiedId === copyItemId ? ' copied' : ''}`}
                          onClick={() => copyToClipboard(recText, copyItemId)}
                        >
                          {copiedId === copyItemId ? 'Copied' : 'Copy'}
                        </button>
                      </>
                    )}
                  </div>
                  {isEdited && <div className="modified-badge">edited — click Pending Approve to save</div>}
                </React.Fragment>
              );
            });
          };

          return (
            <div key={origIdx} className="record-card">
              {/* Record Header */}
              <div className="card-header">
                <div className="header-top-row">
                  {record.date && <span className="date-badge">{highlightText(formatDate(record.date))}</span>}
                  {record.stage && <span className="stage-badge">{highlightText(getFieldValue(record, 'stage', origIdx) || record.stage)}</span>}
                </div>
                <h2 className="card-title">{highlightText(record._documentTitle)}</h2>
              </div>

              <div className="card-content">
                {renderSection('aki_parameters')}
                {renderSection('etiology')}
                {renderSection('precipitants')}
                {renderSection('labs_indices')}
                {renderSection('recovery')}
                {renderSection('provider_details')}
                {renderSection('findings')}
                {renderSection('results')}
                {renderSection('assessment')}
                {renderSection('plan')}
                {renderSection('notes')}
                {renderSection('recommendations')}
                {renderSection('status')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AcuteKidneyInjuryDocument;
