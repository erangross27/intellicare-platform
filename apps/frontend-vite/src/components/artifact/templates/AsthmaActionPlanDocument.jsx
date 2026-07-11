/**
 * AsthmaActionPlanDocument.jsx
 *
 * Inline editing with per-section approve (one-way: Pending → Approved).
 * Zone-based display with colored zone badges (green/yellow/red).
 * Each zone has: peakFlowRange, symptoms, medications, actions + zone-specific fields.
 * PDFDownloadLink + pdfData memo pattern.
 * 4-level search with phrase matching.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import AsthmaActionPlanDocumentPDFTemplate from '../pdf-templates/AsthmaActionPlanDocumentPDFTemplate';
import './AsthmaActionPlanDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }
   fieldPart = the field path ("findings", "greenZone.peakFlowRange") OR, for an array element,
   "<fieldPath>.<arrayIndex>" where the trailing segment is purely numeric (e.g. "greenZone.symptoms.2").
   Real field paths never end in a pure number, so the numeric-last-segment rule is unambiguous. */
const DRAFT_KEY = 'asthma_action_planPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ── Section → field mapping for grouped approve ── */
const SECTION_FIELDS = {
  planInfo: ['date', 'provider', 'facility'],
  findings: ['findings'],
  greenZone: ['greenZone.peakFlowRange', 'greenZone.symptoms', 'greenZone.medications', 'greenZone.actions'],
  yellowZone: ['yellowZone.peakFlowRange', 'yellowZone.symptoms', 'yellowZone.medications', 'yellowZone.actions', 'yellowZone.contactInstructions'],
  redZone: ['redZone.peakFlowRange', 'redZone.symptoms', 'redZone.emergencyMedications', 'redZone.emergencyContact', 'redZone.when911'],
  results: ['results'],
  assessment: ['assessment'],
  plan: ['plan'],
  recommendations: ['recommendations'],
  notes: ['notes'],
};

const SECTION_TITLES = {
  planInfo: 'Plan Information',
  findings: 'Findings',
  greenZone: 'Green Zone',
  yellowZone: 'Yellow Zone',
  redZone: 'Red Zone',
  results: 'Results',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  findings: 'Findings',
  results: 'Results',
  recommendations: 'Recommendations',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  'greenZone.peakFlowRange': 'Peak Flow Range',
  'greenZone.symptoms': 'Symptoms',
  'greenZone.medications': 'Medications',
  'greenZone.actions': 'Actions',
  'yellowZone.peakFlowRange': 'Peak Flow Range',
  'yellowZone.symptoms': 'Symptoms',
  'yellowZone.medications': 'Medications',
  'yellowZone.actions': 'Actions',
  'yellowZone.contactInstructions': 'Contact Instructions',
  'redZone.peakFlowRange': 'Peak Flow Range',
  'redZone.symptoms': 'Symptoms',
  'redZone.emergencyMedications': 'Emergency Medications',
  'redZone.emergencyContact': 'Emergency Contact',
  'redZone.when911': 'When to Call 911',
};

const SIMPLE_FIELDS = ['provider', 'facility'];
const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'notes'];
const DATE_FIELDS = ['date'];
const OBJECT_FIELDS = ['results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];

/* ── Object-rendering helpers (recursive results renderer) ── */
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
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
const setDeep = (obj, path, value) => {
  const root = Array.isArray(obj) ? [...obj] : { ...(obj || {}) };
  let cur = root;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    cur[k] = Array.isArray(cur[k]) ? [...cur[k]] : { ...(cur[k] || {}) };
    cur = cur[k];
  }
  cur[path[path.length - 1]] = value;
  return root;
};
const ARRAY_FIELDS = [
  'greenZone.symptoms', 'greenZone.medications', 'greenZone.actions',
  'yellowZone.symptoms', 'yellowZone.medications', 'yellowZone.actions',
  'redZone.symptoms', 'redZone.emergencyMedications', 'redZone.when911',
];
const ZONE_SIMPLE_FIELDS = [
  'greenZone.peakFlowRange',
  'yellowZone.peakFlowRange', 'yellowZone.contactInstructions',
  'redZone.peakFlowRange', 'redZone.emergencyContact',
];

const ZONE_CONFIG = {
  greenZone: {
    badgeClass: 'zone-green', badgeLabel: 'Doing Well',
    subFields: [
      { key: 'peakFlowRange', label: 'Peak Flow Range', type: 'simple' },
      { key: 'symptoms', label: 'Symptoms', type: 'array' },
      { key: 'medications', label: 'Medications', type: 'array' },
      { key: 'actions', label: 'Actions', type: 'array' },
    ],
  },
  yellowZone: {
    badgeClass: 'zone-yellow', badgeLabel: 'Caution',
    subFields: [
      { key: 'peakFlowRange', label: 'Peak Flow Range', type: 'simple' },
      { key: 'symptoms', label: 'Symptoms', type: 'array' },
      { key: 'medications', label: 'Medications', type: 'array' },
      { key: 'actions', label: 'Actions', type: 'array' },
      { key: 'contactInstructions', label: 'Contact Instructions', type: 'simple' },
    ],
  },
  redZone: {
    badgeClass: 'zone-red', badgeLabel: 'Medical Alert',
    subFields: [
      { key: 'peakFlowRange', label: 'Peak Flow Range', type: 'simple' },
      { key: 'symptoms', label: 'Symptoms', type: 'array' },
      { key: 'emergencyMedications', label: 'Emergency Medications', type: 'array' },
      { key: 'emergencyContact', label: 'Emergency Contact', type: 'simple' },
      { key: 'when911', label: 'When to Call 911', type: 'array' },
    ],
  },
};

const AsthmaActionPlanDocument = ({ document: docProp }) => {
  const templateData = docProp;
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});

  /* ── Helpers ── */
  const formatDate = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal.$date || dateVal);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return String(dateVal); }
  };

  const toInputDate = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal.$date || dateVal);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch { return ''; }
  };

  const splitBySentence = (text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<=[.!?])\s+|(?<=;)\s+/).map(s => s.trim()).filter(s => s.length > 0);
  };

  const copyToClipboard = useCallback((text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  // highlightText uses React mark elements (safe, no raw HTML injection)
  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || !text) return text;
    const phrase = searchTerm.trim();
    try {
      const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      const parts = String(text).split(regex);
      return parts.map((part, i) =>
        regex.test(part) ? <mark key={i}>{part}</mark> : part
      );
    } catch { return text; }
  }, [searchTerm]);

  /* ── Data unwrapping ── */
  const records = useMemo(() => {
    if (!templateData) return [];
    if (Array.isArray(templateData)) {
      return templateData.flatMap(item => {
        if (item?.asthma_action_plan && Array.isArray(item.asthma_action_plan)) return item.asthma_action_plan;
        return item;
      });
    }
    if (templateData.asthma_action_plan && Array.isArray(templateData.asthma_action_plan)) return templateData.asthma_action_plan;
    if (templateData.documentData) {
      const dd = templateData.documentData;
      if (Array.isArray(dd)) return dd;
      if (dd?.asthma_action_plan) return Array.isArray(dd.asthma_action_plan) ? dd.asthma_action_plan : [dd.asthma_action_plan];
      return [dd];
    }
    if (templateData && typeof templateData === 'object') return [templateData];
    return [];
  }, [templateData]);

  /* ── Rehydrate pending drafts from localStorage so a Save survives refresh
       (shown in JSX, NOT in DB/PDF). Maps record _id (handles _id.$oid) to render index. ── */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const recordId = record && (record._id?.$oid || record._id);
      const recDrafts = recordId ? store[recordId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        // fieldPart = "field.path" OR "field.path.<arrayIndex>" (numeric last segment).
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayItem = lastDot !== -1 && /^\d+$/.test(tail);
        const fieldName = isArrayItem ? fieldPart.slice(0, lastDot) : fieldPart;
        const editKey = isArrayItem ? `${fieldName}-${idx}-${tail}` : `${fieldName}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        if (isArrayItem) {
          nFields[editKey] = 'edited';
        } else {
          // mark both the field-level and a sentence-level marker so the badge + approve button show
          nFields[`${fieldName}-${idx}`] = 'edited';
          nSentences[`${fieldName}-${idx}-s0`] = 'edited';
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  /* ── Field value with localEdits overlay (supports dot-paths) ── */
  const getFieldValue = useCallback((record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    const parts = fieldName.split('.');
    let val = record;
    for (const part of parts) {
      if (val == null) return '';
      val = val[part];
    }
    return val || '';
  }, [localEdits]);

  /* ── Effective array with localEdits overlay ── */
  const getEffectiveArray = useCallback((record, fieldName, idx) => {
    const parts = fieldName.split('.');
    let arr = record;
    for (const part of parts) {
      if (arr == null) return [];
      arr = arr[part];
    }
    if (!Array.isArray(arr)) return [];
    return arr.map((item, itemIdx) => {
      const editKey = `${fieldName}-${idx}-${itemIdx}`;
      return localEdits[editKey] !== undefined ? localEdits[editKey] : item;
    });
  }, [localEdits]);

  /* ── Search helpers ── */
  const shouldShowRow = useCallback((record, ...vals) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    return vals.some(v => v && String(v).toLowerCase().includes(phrase));
  }, [searchTerm]);

  const shouldShowSection = useCallback((record, sectionTitle, contentToCheck) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    if (sectionTitle.toLowerCase().includes(phrase)) return true;
    return (contentToCheck || '').toLowerCase().includes(phrase);
  }, [searchTerm]);

  /* ── Filtered records with _origIdx ── */
  const sectionTitles = ['Asthma Action Plan', 'Plan Information', 'Findings', 'Green Zone', 'Yellow Zone', 'Red Zone', 'Results', 'Assessment', 'Plan', 'Recommendations', 'Notes', 'Doing Well', 'Caution', 'Medical Alert', 'Peak Flow Range', 'Symptoms', 'Medications', 'Actions', 'Emergency Medications', 'Emergency Contact', 'When to Call 911', 'Contact Instructions'];

  const filteredRecords = useMemo(() => {
    const withMeta = records.map((record, idx) => {
      const num = String(idx + 1);
      const allArrays = ARRAY_FIELDS.flatMap(f => getEffectiveArray(record, f, idx));
      const allSimple = [...SIMPLE_FIELDS, ...SENTENCE_FIELDS, ...ZONE_SIMPLE_FIELDS].map(f => getFieldValue(record, f, idx)).filter(Boolean);

      const recsText = Array.isArray(record.recommendations)
        ? record.recommendations.map(r => `${r?.recommendation || ''} ${r?.date || ''}`).join(' ')
        : '';
      const resultsText = (record.results && typeof record.results === 'object') ? flattenSearchable(record.results) : '';

      const searchable = [
        `Asthma Action Plan ${num}`, 'asthma action plan',
        ...sectionTitles.flatMap(t => [t, t.toLowerCase()]),
        formatDate(record.date), record.status,
        ...allSimple, ...allArrays, recsText, resultsText,
      ].filter(Boolean).join(' ').toLowerCase();

      return { ...record, _searchableText: searchable, _recordNumber: num, _origIdx: idx, _showAllSections: false };
    });

    if (!searchTerm.trim()) return withMeta.map(r => ({ ...r, _showAllSections: true }));

    const sl = searchTerm.toLowerCase().trim();
    return withMeta.filter(r => {
      const titleMatch = /^asthma\s+action\s+plan\s+(\d+)$/i.test(sl);
      const numMatch = sl === r._recordNumber;
      if (titleMatch || numMatch) { r._showAllSections = true; return true; }
      return r._searchableText.includes(sl);
    });
  }, [records, searchTerm, localEdits, getFieldValue, getEffectiveArray]);

  /* ── Save field (simple + sentence) = stage a DRAFT locally + write the pending-drafts
       localStorage store (survives refresh). NOT written to MongoDB and NOT shown in the PDF
       until the user clicks Approve (handleApproveSection commits). ── */
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, sentenceIdx, valueOverride, editTrackingKey) => {
    const value = valueOverride !== undefined ? valueOverride : editValue;
    const recordId = record._id?.$oid || record._id;
    const editKey = `${fieldName}-${idx}`;

    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));

    const sKey = editTrackingKey || `${fieldName}-${idx}${sentenceIdx !== undefined && sentenceIdx !== null ? `-s${sentenceIdx}` : ''}`;
    if (!editTrackingKey) setEditedFields(prev => ({ ...prev, [sKey]: 'edited' }));
    // Re-edit after approval → drop the section's approved flag so the button returns to yellow Pending Approve
    if (sectionId) setApprovedSections(prev => {
      if (!prev[`${sectionId}-${idx}`]) return prev;
      const next = { ...prev };
      delete next[`${sectionId}-${idx}`];
      return next;
    });

    if (recordId) {
      const store = readDrafts();
      if (!store[recordId]) store[recordId] = {};
      store[recordId][fieldName] = value; // fieldPart = field path (no arrayIndex)
      writeDrafts(store);
    }

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  /* ── Save array item = stage a DRAFT locally + localStorage (no DB write; Approve commits). ── */
  const handleSaveArrayItem = useCallback((record, fieldName, idx, sectionId, itemIdx) => {
    const value = editValue;
    const recordId = record._id?.$oid || record._id;
    const editKey = `${fieldName}-${idx}-${itemIdx}`;

    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    // Re-edit after approval → drop the section's approved flag so the button returns to yellow Pending Approve
    if (sectionId) setApprovedSections(prev => {
      if (!prev[`${sectionId}-${idx}`]) return prev;
      const next = { ...prev };
      delete next[`${sectionId}-${idx}`];
      return next;
    });

    if (recordId) {
      const store = readDrafts();
      if (!store[recordId]) store[recordId] = {};
      store[recordId][`${fieldName}.${itemIdx}`] = value; // fieldPart = "<field>.<arrayIndex>" (numeric tail)
      writeDrafts(store);
    }

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  /* ── Sentence helpers (plain functions) ── */
  function reconstructFullText(sentences) {
    return sentences.map(s => {
      const trimmed = s.trim();
      if (!trimmed) return '';
      if (/[.!?;]$/.test(trimmed)) return trimmed;
      return trimmed + '.';
    }).filter(s => s).join(' ');
  }

  function saveSentence(record, fieldName, idx, sectionId, sIdx, newText) {
    const currentValue = String(getFieldValue(record, fieldName, idx) || '');
    const sentences = splitBySentence(currentValue);
    const trimmedNew = newText.trim();
    if (sIdx < sentences.length) {
      if (trimmedNew === sentences[sIdx].replace(/[.;]$/, '')) {
        setEditingField(null);
        setEditValue('');
        return;
      }
      sentences[sIdx] = trimmedNew;
    } else {
      sentences.push(trimmedNew);
    }
    const fullText = reconstructFullText(sentences);
    const sKey = `${fieldName}-${idx}-s${sIdx}`;
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    handleSaveField(record, fieldName, idx, sectionId, null, fullText, `${fieldName}-${idx}`);
  }

  /* ── Section approve ── */
  const sectionHasEdits = (sectionId, idx) => {
    const fields = SECTION_FIELDS[sectionId] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  };

  // Approve = COMMIT this section's staged drafts for this record to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = async (record, sectionId, idx) => {
    const recordId = record._id?.$oid || record._id;
    const fields = SECTION_FIELDS[sectionId] || [];
    try {
      const secureApiClient = (await import('../../../services/secureApiClient')).default;

      // Collect this section's staged drafts (fieldPart → value) for this record.
      const store = readDrafts();
      const recDrafts = (recordId && store[recordId]) ? store[recordId] : {};
      const committedFieldParts = [];
      const committedEditKeys = [];
      for (const [fieldPart, value] of Object.entries(recDrafts)) {
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayItem = lastDot !== -1 && /^\d+$/.test(tail);
        const fieldName = isArrayItem ? fieldPart.slice(0, lastDot) : fieldPart;
        // Only commit fields belonging to THIS section
        if (!fields.includes(fieldName)) continue;
        const payload = { field: fieldName, value };
        if (isArrayItem) payload.arrayIndex = parseInt(tail, 10);
        const resp = await secureApiClient.put(`/api/edit/asthma_action_plan/${recordId}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        committedFieldParts.push(fieldPart);
        committedEditKeys.push(isArrayItem ? `${fieldName}-${idx}-${tail}` : `${fieldName}-${idx}`);
      }

      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/asthma_action_plan/${recordId}/approve`, {
        sectionId, approved: true,
      });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        committedEditKeys.forEach(k => delete next[k]);
        return next;
      });
      // Drop this section's drafts from localStorage (now committed)
      if (recordId && store[recordId]) {
        committedFieldParts.forEach(fp => delete store[recordId][fp]);
        if (Object.keys(store[recordId]).length === 0) delete store[recordId];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));

      setEditedFields(prev => {
        const next = { ...prev };
        for (const f of fields) Object.keys(next).forEach(k => { if (k.startsWith(`${f}-${idx}`)) delete next[k]; });
        return next;
      });
      setEditedSentences(prev => {
        const next = { ...prev };
        for (const f of fields) Object.keys(next).forEach(k => { if (k.startsWith(`${f}-${idx}`)) delete next[k]; });
        return next;
      });
    } catch (err) {
      console.error('[AsthmaActionPlan] Approve error:', err);
    }
  };

  const renderApproveButton = (record, sectionId, idx) => {
    const hasEdits = sectionHasEdits(sectionId, idx);
    const isApproved = approvedSections[`${sectionId}-${idx}`];
    // Check hasEdits BEFORE isApproved — new edits override previous approval
    if (hasEdits) {
      return (
        <button className="approve-btn pending" onClick={() => handleApproveSection(record, sectionId, idx)}>
          Pending Approve
        </button>
      );
    }
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  };

  /* ── Render editable field (simple single-value, supports dot-paths) ── */
  const renderEditableField = (record, fieldName, idx, sectionId, label) => {
    const value = String(getFieldValue(record, fieldName, idx) || '');
    if (!value.trim()) return null;
    const editKey = `${fieldName}-${idx}`;
    const isEditing = editingField === editKey;
    const isEdited = editedFields[editKey];
    const displayLabel = label || FIELD_LABELS[fieldName] || fieldName;

    if (isEditing) {
      return (
        <div className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(displayLabel)}</div>
          <div className="edit-field-container">
            <textarea
              className="edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fieldName, idx, sectionId);
                if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
              }}
              autoFocus
              rows={2}
            />
            <div className="edit-actions">
              <button className="save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId)} disabled={saving}>Save</button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(displayLabel)}</div>
        <div
          className={`numbered-row editable-row${isEdited ? ' modified' : ''}`}
          onClick={() => { setEditingField(editKey); setEditValue(value); }}
        >
          <div className="row-content">
            <span className="content-value">{highlightText(value)}</span>
            <span className="edit-indicator">✎</span>
          </div>
          <button
            className={`copy-btn ${copiedId === editKey ? 'copied' : ''}`}
            onClick={e => { e.stopPropagation(); copyToClipboard(value, editKey); }}
          >
            {copiedId === editKey ? 'Copied' : 'Copy'}
          </button>
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  /* ── Render sentence-editable field ── */
  const renderSentenceEditableField = (record, fieldName, idx, sectionId) => {
    const value = String(getFieldValue(record, fieldName, idx) || '');
    if (!value.trim()) return null;
    const sentences = splitBySentence(value);
    if (sentences.length <= 1) return renderEditableField(record, fieldName, idx, sectionId);

    return sentences.map((sentence, sIdx) => {
      const sentenceKey = `${fieldName}-${idx}-s${sIdx}`;
      const isEditing = editingField === sentenceKey;
      const isEdited = editedSentences[sentenceKey];

      if (searchTerm.trim() && !record._showAllSections) {
        const sectionTitle = SECTION_TITLES[sectionId] || '';
        const titleMatches = sectionTitle.toLowerCase().includes(searchTerm.toLowerCase().trim());
        if (!titleMatches && !shouldShowRow(record, sentence)) return null;
      }

      if (isEditing) {
        return (
          <div key={sIdx} className="rec-mini-card">
            <div className="edit-field-container">
              <textarea
                className="edit-textarea"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.ctrlKey) saveSentence(record, fieldName, idx, sectionId, sIdx, editValue);
                  if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                }}
                autoFocus
                rows={2}
              />
              <div className="edit-actions">
                <button className="save-btn" onClick={() => saveSentence(record, fieldName, idx, sectionId, sIdx, editValue)} disabled={saving}>Save</button>
                <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
              </div>
            </div>
          </div>
        );
      }

      const stripped = sentence.replace(/[.;]$/, '');
      return (
        <div key={sIdx} className="rec-mini-card">
          <div
            className={`numbered-row editable-row${isEdited ? ' modified' : ''}`}
            onClick={() => { setEditingField(sentenceKey); setEditValue(stripped); }}
          >
            <div className="row-content">
              <span className="content-value">{highlightText(sentence)}</span>
              <span className="edit-indicator">✎</span>
            </div>
            <button
              className={`copy-btn ${copiedId === sentenceKey ? 'copied' : ''}`}
              onClick={e => { e.stopPropagation(); copyToClipboard(sentence, sentenceKey); }}
            >
              {copiedId === sentenceKey ? 'Copied' : 'Copy'}
            </button>
          </div>
          {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
        </div>
      );
    });
  };

  /* ── Render editable array item ── */
  const renderEditableArrayItem = (record, fieldName, idx, sectionId, item, itemIdx) => {
    const editKey = `${fieldName}-${idx}-${itemIdx}`;
    const isEditing = editingField === editKey;
    const isEdited = editedFields[editKey];

    if (isEditing) {
      return (
        <div key={itemIdx} className="edit-field-container">
          <textarea
            className="edit-textarea"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, fieldName, idx, sectionId, itemIdx);
              if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
            }}
            autoFocus
            rows={2}
          />
          <div className="edit-actions">
            <button className="save-btn" onClick={() => handleSaveArrayItem(record, fieldName, idx, sectionId, itemIdx)} disabled={saving}>Save</button>
            <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
          </div>
        </div>
      );
    }

    return (
      <React.Fragment key={itemIdx}>
        <div
          className={`numbered-row editable-row${isEdited ? ' modified' : ''}`}
          onClick={() => { setEditingField(editKey); setEditValue(item); }}
        >
          <div className="row-content">
            <span className="content-value">{highlightText(item)}</span>
            <span className="edit-indicator">✎</span>
          </div>
          <button
            className={`copy-btn ${copiedId === editKey ? 'copied' : ''}`}
            onClick={e => { e.stopPropagation(); copyToClipboard(item, editKey); }}
          >
            {copiedId === editKey ? 'Copied' : 'Copy'}
          </button>
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </React.Fragment>
    );
  };

  /* ── Render date field (date-picker) ── */
  const renderDateField = (record, fieldName, idx, sectionId) => {
    const raw = getFieldValue(record, fieldName, idx);
    if (!raw) return null;
    const editKey = `${fieldName}-${idx}`;
    const isEditing = editingField === editKey;
    const isEdited = editedFields[editKey];
    const displayLabel = FIELD_LABELS[fieldName] || fieldName;
    const displayVal = formatDate(raw);

    if (isEditing) {
      return (
        <div className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(displayLabel)}</div>
          <div className="edit-field-container">
            <input
              type="date"
              className="edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }}
              onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
            />
            <div className="edit-actions">
              <button
                className="save-btn"
                disabled={saving}
                onClick={() => {
                  if (isNaN(new Date(editValue).getTime())) return;
                  handleSaveField(record, fieldName, idx, sectionId, null, editValue + 'T00:00:00.000Z');
                }}
              >Save</button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(displayLabel)}</div>
        <div
          className={`numbered-row editable-row${isEdited ? ' modified' : ''}`}
          onClick={() => { setEditingField(editKey); setEditValue(toInputDate(raw)); }}
        >
          <div className="row-content">
            <span className="content-value">{highlightText(displayVal)}</span>
            <span className="edit-indicator">✎</span>
          </div>
          <button
            className={`copy-btn ${copiedId === editKey ? 'copied' : ''}`}
            onClick={e => { e.stopPropagation(); copyToClipboard(displayVal, editKey); }}
          >
            {copiedId === editKey ? 'Copied' : 'Copy'}
          </button>
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  /* ── Save a leaf inside an OBJECT field (rebuild whole object, save via handleSaveField) ── */
  const saveObjectLeaf = (record, rootField, path, idx, sectionId, leafKey, newVal) => {
    const current = getFieldValue(record, rootField, idx);
    const base = (current && typeof current === 'object') ? current : {};
    const next = setDeep(base, path, newVal);
    handleSaveField(record, rootField, idx, sectionId, null, next, leafKey);
  };

  /* ── Render OBJECT leaf (editable text) ── */
  const renderObjectLeaf = (record, rootField, path, idx, sectionId, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isEdited = editedFields[leafKey];
    const leafLabel = humanizeKey(path[path.length - 1]);

    if (isEditing) {
      return (
        <div key={path[path.length - 1]} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(leafLabel)}</div>
          <div className="edit-field-container">
            <textarea
              className="edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              autoFocus
              rows={2}
              onKeyDown={e => {
                if (e.key === 'Enter' && e.ctrlKey) saveObjectLeaf(record, rootField, path, idx, sectionId, leafKey, editValue.trim());
                if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
              }}
            />
            <div className="edit-actions">
              <button className="save-btn" disabled={saving} onClick={() => saveObjectLeaf(record, rootField, path, idx, sectionId, leafKey, editValue.trim())}>Save</button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={path[path.length - 1]} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(leafLabel)}</div>
        <div
          className={`numbered-row editable-row${isEdited ? ' modified' : ''}`}
          onClick={() => { setEditingField(leafKey); setEditValue(leafValueString); }}
        >
          <div className="row-content">
            <span className="content-value">{highlightText(leafValueString)}</span>
            <span className="edit-indicator">✎</span>
          </div>
          <button
            className={`copy-btn ${copiedId === leafKey ? 'copied' : ''}`}
            onClick={e => { e.stopPropagation(); copyToClipboard(`${leafLabel}: ${leafValueString}`, leafKey); }}
          >
            {copiedId === leafKey ? 'Copied' : 'Copy'}
          </button>
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  /* ── Render OBJECT node (recursive) ── */
  const renderObjectNode = (record, rootField, idx, sectionId, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sectionId, value);
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div style={{ marginLeft: depth > 0 ? 12 : 0 }}>
          {entries.map(([k, v]) => (
            isScalar(v)
              ? renderObjectLeaf(record, rootField, [...path, k], idx, sectionId, v)
              : <div className="rec-mini-card" key={k}>{renderObjectNode(record, rootField, idx, sectionId, humanizeKey(k), v, [...path, k], depth + 1)}</div>
          ))}
        </div>
      </React.Fragment>
    );
  };

  /* ── Render OBJECT field (top-level results) ── */
  const renderObjectField = (record, fieldName, idx, sectionId) => {
    const val = getFieldValue(record, fieldName, idx);
    if (!val || isScalar(val) || isEmptyDeep(val)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment>
        {entries.map(([k, v]) => (
          isScalar(v)
            ? renderObjectLeaf(record, fieldName, [k], idx, sectionId, v)
            : <div className="rec-mini-card" key={k}>{renderObjectNode(record, fieldName, idx, sectionId, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </React.Fragment>
    );
  };

  /* ── Render recommendations (ARRAY of {recommendation, date}) ── */
  const renderRecommendationsField = (record, fieldName, idx, sectionId) => {
    const val = getFieldValue(record, fieldName, idx);
    const recs = Array.isArray(val) ? val : [];
    if (recs.length === 0) return null;
    const phrase = searchTerm.toLowerCase().trim();

    return (
      <>
        {recs.map((rec, rIdx) => {
          const recText = String(rec?.recommendation || '').trim();
          const recDate = String(rec?.date || '').trim();
          if (!recText && !recDate) return null;
          const itemKey = `${fieldName}-${idx}-r${rIdx}`;
          const isEditing = editingField === itemKey;
          const isEdited = editedFields[itemKey];

          if (searchTerm.trim() && !record._showAllSections) {
            const titleMatch = (SECTION_TITLES[sectionId] || '').toLowerCase().includes(phrase);
            if (!titleMatch && !recText.toLowerCase().includes(phrase) && !recDate.toLowerCase().includes(phrase)) return null;
          }

          const saveRec = () => {
            const currentArr = Array.isArray(getFieldValue(record, fieldName, idx)) ? getFieldValue(record, fieldName, idx) : [];
            const trimmed = editValue.trim();
            const newArr = currentArr.map((r, i) => i === rIdx ? { ...r, recommendation: trimmed } : { ...r });
            handleSaveField(record, fieldName, idx, sectionId, null, newArr, itemKey);
          };

          if (isEditing) {
            return (
              <div key={rIdx} className="rec-mini-card">
                {recDate && <div className="nested-subtitle">{highlightText(recDate)}</div>}
                <div className="edit-field-container">
                  <textarea
                    className="edit-textarea"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    autoFocus
                    rows={2}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && e.ctrlKey) saveRec();
                      if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                    }}
                  />
                  <div className="edit-actions">
                    <button className="save-btn" disabled={saving} onClick={saveRec}>Save</button>
                    <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={rIdx} className="rec-mini-card">
              {recDate && <div className="nested-subtitle">{highlightText(recDate)}</div>}
              <div
                className={`numbered-row editable-row${isEdited ? ' modified' : ''}`}
                onClick={() => { setEditingField(itemKey); setEditValue(recText); }}
              >
                <div className="row-content">
                  <span className="content-value">{highlightText(recText)}</span>
                  <span className="edit-indicator">✎</span>
                </div>
                <button
                  className={`copy-btn ${copiedId === itemKey ? 'copied' : ''}`}
                  onClick={e => { e.stopPropagation(); copyToClipboard(`${recText}${recDate ? ` (${recDate})` : ''}`, itemKey); }}
                >
                  {copiedId === itemKey ? 'Copied' : 'Copy'}
                </button>
              </div>
              {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
            </div>
          );
        })}
      </>
    );
  };

  /* ── Render OBJECT section (results) ── */
  const renderObjectSection = (record, idx, sectionId) => {
    const fieldName = SECTION_FIELDS[sectionId][0];
    const title = SECTION_TITLES[sectionId];
    const val = getFieldValue(record, fieldName, idx);
    if (!val || isScalar(val) || isEmptyDeep(val)) return null;
    if (!shouldShowSection(record, title, flattenSearchable(val))) return null;

    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h3 className="section-title">{highlightText(title)}</h3>
            <div className="header-right-actions">
              <button
                className={`copy-btn ${copiedId === `${sectionId}-${idx}` ? 'copied' : ''}`}
                onClick={() => copyToClipboard(`${title.toUpperCase()}\n${'-'.repeat(40)}\n${flattenSearchable(val)}`, `${sectionId}-${idx}`)}
              >
                {copiedId === `${sectionId}-${idx}` ? 'Copied' : 'Copy Section'}
              </button>
              {renderApproveButton(record, sectionId, idx)}
            </div>
          </div>
          {renderObjectField(record, fieldName, idx, sectionId)}
        </div>
      </div>
    );
  };

  /* ── Render recommendations section (array of objects) ── */
  const renderRecommendationsSection = (record, idx, sectionId) => {
    const fieldName = SECTION_FIELDS[sectionId][0];
    const title = SECTION_TITLES[sectionId];
    const val = getFieldValue(record, fieldName, idx);
    const recs = Array.isArray(val) ? val : [];
    if (recs.length === 0) return null;
    const content = recs.map(r => `${r?.recommendation || ''} ${r?.date || ''}`).join(' ');
    if (!shouldShowSection(record, title, content)) return null;

    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h3 className="section-title">{highlightText(title)}</h3>
            <div className="header-right-actions">
              <button
                className={`copy-btn ${copiedId === `${sectionId}-${idx}` ? 'copied' : ''}`}
                onClick={() => {
                  const lines = [title.toUpperCase(), '-'.repeat(40)];
                  recs.forEach((r, i) => lines.push(`${i + 1}. ${r?.recommendation || ''}${r?.date ? ` (${r.date})` : ''}`));
                  copyToClipboard(lines.join('\n'), `${sectionId}-${idx}`);
                }}
              >
                {copiedId === `${sectionId}-${idx}` ? 'Copied' : 'Copy Section'}
              </button>
              {renderApproveButton(record, sectionId, idx)}
            </div>
          </div>
          {renderRecommendationsField(record, fieldName, idx, sectionId)}
        </div>
      </div>
    );
  };

  /* ── pdfData useMemo ── */
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const merged = { ...record };

      [...SIMPLE_FIELDS, ...SENTENCE_FIELDS, ...DATE_FIELDS, ...OBJECT_FIELDS, ...OBJECT_ARRAY_FIELDS].forEach(fieldName => {
        const editKey = `${fieldName}-${idx}`;
        if (pendingEdits[editKey]) return; // pending drafts stay OUT of the PDF until approved
        if (localEdits[editKey] !== undefined) merged[fieldName] = localEdits[editKey];
      });

      ZONE_SIMPLE_FIELDS.forEach(fieldPath => {
        const editKey = `${fieldPath}-${idx}`;
        if (pendingEdits[editKey]) return; // pending drafts stay OUT of the PDF until approved
        if (localEdits[editKey] !== undefined) {
          const parts = fieldPath.split('.');
          if (!merged[parts[0]]) merged[parts[0]] = {};
          merged[parts[0]] = { ...merged[parts[0]], [parts[1]]: localEdits[editKey] };
        }
      });

      ARRAY_FIELDS.forEach(fieldPath => {
        // Overlay committed array-item edits only; pending drafts stay OUT of the PDF until approved.
        const parts = fieldPath.split('.');
        let arr = record;
        for (const part of parts) { if (arr == null) break; arr = arr[part]; }
        if (!Array.isArray(arr)) return;
        const effectiveArr = arr.map((item, itemIdx) => {
          const editKey = `${fieldPath}-${idx}-${itemIdx}`;
          if (pendingEdits[editKey]) return item;
          return localEdits[editKey] !== undefined ? localEdits[editKey] : item;
        });
        if (parts.length === 2) {
          if (!merged[parts[0]]) merged[parts[0]] = {};
          merged[parts[0]] = { ...(merged[parts[0]] || {}), [parts[1]]: effectiveArr };
        }
      });

      return merged;
    });
  }, [records, localEdits, pendingEdits]);

  /* ── Copy All using pdfData ── */
  const copyAllContent = useCallback(() => {
    const allText = pdfData.map((record, idx) => {
      const lines = [];
      lines.push(`ASTHMA ACTION PLAN ${idx + 1}`);
      lines.push('='.repeat(40));
      lines.push('');

      if (record.date || record.provider || record.facility) {
        lines.push('PLAN INFORMATION');
        lines.push('-'.repeat(40));
        if (record.date) lines.push('Date', `  ${formatDate(record.date)}`);
        if (record.provider) lines.push('Provider', `  ${record.provider}`);
        if (record.facility) lines.push('Facility', `  ${record.facility}`);
        if (record.status) lines.push('Status', `  ${record.status}`);
        lines.push('');
      }

      if (record.findings) {
        lines.push('FINDINGS');
        lines.push('-'.repeat(40));
        const fs = splitBySentence(record.findings);
        if (fs.length > 1) fs.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
        else lines.push(record.findings);
        lines.push('');
      }

      const copyZone = (zoneKey, title, config) => {
        const zone = record[zoneKey];
        if (!zone) return;
        const hasData = config.subFields.some(sf => {
          const val = zone[sf.key];
          return val && (Array.isArray(val) ? val.length > 0 : String(val).trim());
        });
        if (!hasData) return;

        lines.push(`${title.toUpperCase()} - ${config.badgeLabel.toUpperCase()}`);
        lines.push('-'.repeat(40));
        config.subFields.forEach(sf => {
          const val = zone[sf.key];
          if (!val || (Array.isArray(val) && val.length === 0) || (!Array.isArray(val) && !String(val).trim())) return;
          if (sf.type === 'array') {
            lines.push(sf.label);
            val.forEach((item, i) => lines.push(`  ${i + 1}. ${item}`));
          } else {
            lines.push(sf.label, `  ${val}`);
          }
        });
        lines.push('');
      };

      copyZone('greenZone', 'Green Zone', ZONE_CONFIG.greenZone);
      copyZone('yellowZone', 'Yellow Zone', ZONE_CONFIG.yellowZone);
      copyZone('redZone', 'Red Zone', ZONE_CONFIG.redZone);

      if (record.results && !isScalar(record.results) && !isEmptyDeep(record.results)) {
        lines.push('RESULTS');
        lines.push('-'.repeat(40));
        lines.push(flattenSearchable(record.results));
        lines.push('');
      }

      const copySentenceField = (field) => {
        const val = record[field];
        if (!val) return;
        lines.push(field.toUpperCase());
        lines.push('-'.repeat(40));
        const ss = splitBySentence(val);
        if (ss.length > 1) ss.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
        else lines.push(val);
        lines.push('');
      };

      copySentenceField('assessment');
      copySentenceField('plan');

      if (Array.isArray(record.recommendations) && record.recommendations.length > 0) {
        lines.push('RECOMMENDATIONS');
        lines.push('-'.repeat(40));
        record.recommendations.forEach((r, i) => {
          if (!r?.recommendation && !r?.date) return;
          lines.push(`${i + 1}. ${r?.recommendation || ''}${r?.date ? ` (${r.date})` : ''}`);
        });
        lines.push('');
      }

      copySentenceField('notes');

      return lines.join('\n');
    }).join('\n\n');

    copyToClipboard(allText, 'copy-all');
  }, [pdfData, copyToClipboard]);

  /* ── Render zone section ── */
  const renderZoneSection = (record, idx, sectionId) => {
    const config = ZONE_CONFIG[sectionId];
    const title = SECTION_TITLES[sectionId];

    const hasData = config.subFields.some(sf => {
      const fieldPath = `${sectionId}.${sf.key}`;
      if (sf.type === 'array') return getEffectiveArray(record, fieldPath, idx).length > 0;
      const val = getFieldValue(record, fieldPath, idx);
      return val && String(val).trim();
    });
    if (!hasData) return null;

    const allContent = config.subFields.map(sf => {
      const fieldPath = `${sectionId}.${sf.key}`;
      if (sf.type === 'array') return getEffectiveArray(record, fieldPath, idx).join(' ');
      return getFieldValue(record, fieldPath, idx);
    }).filter(Boolean).join(' ');

    if (!shouldShowSection(record, title, `${title} ${config.badgeLabel} ${allContent}`)) return null;

    const sectionTitleMatches = (() => {
      if (!searchTerm.trim() || record._showAllSections) return true;
      return shouldShowRow(record, title, title.toLowerCase(), config.badgeLabel, config.badgeLabel.toLowerCase());
    })();

    const copySectionText = () => {
      const lines = [`${title.toUpperCase()} - ${config.badgeLabel.toUpperCase()}`, '-'.repeat(40)];
      config.subFields.forEach(sf => {
        const fieldPath = `${sectionId}.${sf.key}`;
        if (sf.type === 'array') {
          const items = getEffectiveArray(record, fieldPath, idx);
          if (items.length > 0) {
            lines.push(sf.label);
            items.forEach((item, i) => lines.push(`  ${i + 1}. ${item}`));
          }
        } else {
          const val = getFieldValue(record, fieldPath, idx);
          if (val && String(val).trim()) lines.push(sf.label, `  ${val}`);
        }
      });
      return lines.join('\n');
    };

    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <div className="section-title-with-badge">
              <h3 className="section-title">{highlightText(title)}</h3>
              <span className={`zone-badge ${config.badgeClass}`}>{config.badgeLabel}</span>
            </div>
            <div className="header-right-actions">
              <button
                className={`copy-btn ${copiedId === `${sectionId}-${idx}` ? 'copied' : ''}`}
                onClick={() => copyToClipboard(copySectionText(), `${sectionId}-${idx}`)}
              >
                {copiedId === `${sectionId}-${idx}` ? 'Copied' : 'Copy Section'}
              </button>
              {renderApproveButton(record, sectionId, idx)}
            </div>
          </div>

          {config.subFields.map(sf => {
            const fieldPath = `${sectionId}.${sf.key}`;

            if (sf.type === 'array') {
              const items = getEffectiveArray(record, fieldPath, idx);
              if (items.length === 0) return null;

              const visibleItems = items.map((item, itemIdx) => ({ item, itemIdx })).filter(({ item }) => {
                if (!searchTerm.trim() || record._showAllSections || sectionTitleMatches) return true;
                return shouldShowRow(record, item);
              });
              if (visibleItems.length === 0) return null;

              return (
                <div key={sf.key} className="rec-mini-card">
                  <div className="nested-subtitle">{highlightText(sf.label)}</div>
                  {visibleItems.map(({ item, itemIdx }) =>
                    renderEditableArrayItem(record, fieldPath, idx, sectionId, item, itemIdx)
                  )}
                </div>
              );
            }

            const val = String(getFieldValue(record, fieldPath, idx) || '');
            if (!val.trim()) return null;
            if (!sectionTitleMatches && !shouldShowRow(record, val, sf.label)) return null;
            return <React.Fragment key={sf.key}>{renderEditableField(record, fieldPath, idx, sectionId, sf.label)}</React.Fragment>;
          })}
        </div>
      </div>
    );
  };

  /* ── Render grouped section (planInfo) ── */
  const renderGroupedSection = (record, idx, sectionId) => {
    const fields = SECTION_FIELDS[sectionId] || [];
    const title = SECTION_TITLES[sectionId];

    const hasData = fields.some(f => {
      const val = getFieldValue(record, f, idx);
      return val && String(val).trim();
    });
    if (!hasData) return null;

    const contentText = fields.map(f => `${FIELD_LABELS[f] || f} ${getFieldValue(record, f, idx)}`).join(' ');
    if (!shouldShowSection(record, title, contentText)) return null;

    const sectionTitleMatches = (() => {
      if (!searchTerm.trim() || record._showAllSections) return true;
      return shouldShowRow(record, title, title.toLowerCase());
    })();

    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h3 className="section-title">{highlightText(title)}</h3>
            <div className="header-right-actions">
              <button
                className={`copy-btn ${copiedId === `${sectionId}-${idx}` ? 'copied' : ''}`}
                onClick={() => {
                  const lines = [title.toUpperCase(), '-'.repeat(40)];
                  fields.forEach(f => {
                    const v = getFieldValue(record, f, idx);
                    if (v) lines.push(FIELD_LABELS[f] || f, `  ${DATE_FIELDS.includes(f) ? formatDate(v) : v}`);
                  });
                  copyToClipboard(lines.join('\n'), `${sectionId}-${idx}`);
                }}
              >
                {copiedId === `${sectionId}-${idx}` ? 'Copied' : 'Copy Section'}
              </button>
              {renderApproveButton(record, sectionId, idx)}
            </div>
          </div>

          {fields.map(f => {
            const val = getFieldValue(record, f, idx);
            if (!val || !String(val).trim()) return null;
            if (DATE_FIELDS.includes(f)) {
              if (!sectionTitleMatches && !shouldShowRow(record, formatDate(val), FIELD_LABELS[f])) return null;
              return <React.Fragment key={f}>{renderDateField(record, f, idx, sectionId)}</React.Fragment>;
            }
            if (!sectionTitleMatches && !shouldShowRow(record, val, FIELD_LABELS[f])) return null;
            return <React.Fragment key={f}>{renderEditableField(record, f, idx, sectionId)}</React.Fragment>;
          })}
        </div>
      </div>
    );
  };

  /* ── Render sentence section ── */
  const renderSentenceSection = (record, idx, sectionId) => {
    const fieldName = SECTION_FIELDS[sectionId][0];
    const title = SECTION_TITLES[sectionId];
    const value = String(getFieldValue(record, fieldName, idx) || '');
    if (!value.trim()) return null;

    if (!shouldShowSection(record, title, value)) return null;

    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h3 className="section-title">{highlightText(title)}</h3>
            <div className="header-right-actions">
              <button
                className={`copy-btn ${copiedId === `${sectionId}-${idx}` ? 'copied' : ''}`}
                onClick={() => {
                  const sentences = splitBySentence(value);
                  const lines = [title.toUpperCase(), '-'.repeat(40)];
                  if (sentences.length > 1) sentences.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
                  else lines.push(value);
                  copyToClipboard(lines.join('\n'), `${sectionId}-${idx}`);
                }}
              >
                {copiedId === `${sectionId}-${idx}` ? 'Copied' : 'Copy Section'}
              </button>
              {renderApproveButton(record, sectionId, idx)}
            </div>
          </div>

          {renderSentenceEditableField(record, fieldName, idx, sectionId)}
        </div>
      </div>
    );
  };

  /* ── Empty state ── */
  if (!filteredRecords || filteredRecords.length === 0) {
    return (
      <article className="asthma-action-plan-document">
        <div className="no-data">No asthma action plan data available.</div>
      </article>
    );
  }

  /* ── Main render ── */
  return (
    <article className="asthma-action-plan-document">
      <header className="document-header">
        <h1 className="document-title">Asthma Action Plans</h1>
        <div className="header-actions">
          <button
            className={`copy-btn ${copiedId === 'copy-all' ? 'copied' : ''}`}
            onClick={copyAllContent}
          >
            {copiedId === 'copy-all' ? 'Copied' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<AsthmaActionPlanDocumentPDFTemplate document={pdfData} />}
            fileName="asthma-action-plan.pdf"
          >
            {({ loading }) => (
              <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>
            )}
          </PDFDownloadLink>
        </div>
      </header>

      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search asthma action plans..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>
        )}
      </div>

      <div className="records-container">
        {filteredRecords.map((record, filteredIdx) => {
          const idx = record._origIdx;

          return (
            <div key={filteredIdx} className="asthma-action-plan-record">
              <div className="record-header">
                <div className="record-meta-row">
                  {record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}
                  {record.status && (
                    <span className={`status-badge status-${record.status.toLowerCase()}`}>
                      {record.status}
                    </span>
                  )}
                </div>
                <h2 className="record-name">{highlightText(`Asthma Action Plan ${idx + 1}`)}</h2>
              </div>

              {renderGroupedSection(record, idx, 'planInfo')}
              {renderSentenceSection(record, idx, 'findings')}
              {renderZoneSection(record, idx, 'greenZone')}
              {renderZoneSection(record, idx, 'yellowZone')}
              {renderZoneSection(record, idx, 'redZone')}
              {renderObjectSection(record, idx, 'results')}
              {renderSentenceSection(record, idx, 'assessment')}
              {renderSentenceSection(record, idx, 'plan')}
              {renderRecommendationsSection(record, idx, 'recommendations')}
              {renderSentenceSection(record, idx, 'notes')}
            </div>
          );
        })}
      </div>
    </article>
  );
};

export default AsthmaActionPlanDocument;
