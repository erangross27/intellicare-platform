/**
 * PainManagementPlanDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: pain_management_plan
 *
 * 9 Sections:
 *   1. record-info: date, provider, facility, status
 *   2. current-analgesics: currentAnalgesics
 *   3. interventional-procedures: interventionalProcedures
 *   4. consultations: consultations
 *   5. supportive-devices: supportiveDevices
 *   6. radiation-therapy: radiationTherapy
 *   7. clinical-details: findings, assessment, plan
 *   8. recommendations: recommendations
 *   9. notes: notes
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PainManagementPlanDocumentPDFTemplate from '../pdf-templates/PainManagementPlanDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './PainManagementPlanDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [editKey]: { renderKey, renderValue, marker, payload } } }
     - renderKey/renderValue  → repopulate localEdits (what the JSX renders)
     - marker { store: 'fields'|'sentences', key, value } → repopulate the edited badge
     - payload { field, value, arrayIndex? } → replayed to the DB on Approve */
const DRAFT_KEY = 'pain_management_planPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'record-info': 'Record Info',
  'current-analgesics': 'Current Analgesics',
  'interventional-procedures': 'Interventional Procedures',
  'consultations': 'Consultations',
  'supportive-devices': 'Supportive Devices / Therapies',
  'radiation-therapy': 'Radiation Therapy',
  'clinical-details': 'Clinical Details',
  'recommendations': 'Recommendations',
  'results': 'Results',
  'notes': 'Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  currentAnalgesics: 'Current Analgesics',
  interventionalProcedures: 'Interventional Procedures',
  consultations: 'Consultations',
  supportiveDevices: 'Supportive Devices',
  radiationTherapy: 'Radiation Therapy',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  results: 'Results',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'record-info': ['date', 'provider', 'facility', 'status'],
  'current-analgesics': ['currentAnalgesics'],
  'interventional-procedures': ['interventionalProcedures'],
  'consultations': ['consultations'],
  'supportive-devices': ['supportiveDevices'],
  'radiation-therapy': ['radiationTherapy'],
  'clinical-details': ['findings', 'assessment', 'plan'],
  'recommendations': ['recommendations'],
  'results': ['results'],
  'notes': ['notes'],
};

const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['currentAnalgesics', 'interventionalProcedures', 'consultations', 'supportiveDevices'];
const STRING_FIELDS = ['provider', 'facility', 'status', 'radiationTherapy', 'findings', 'assessment', 'plan', 'notes'];
const RECOMMENDATIONS_FIELD = 'recommendations';
const OBJECT_FIELDS = ['results'];

/* ═══════ DYNAMIC-KEY OBJECT HELPERS (results) ═══════ */
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
const isScalarVal = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const flattenSearchable = (v) => {
  if (isEmptyDeep(v)) return '';
  if (isScalarVal(v)) return fmtScalar(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
};
const flattenObjectLines = (v, label, indent) => {
  const pad = '  '.repeat(indent);
  if (isEmptyDeep(v)) return [];
  if (isScalarVal(v)) return [`${pad}${label ? humanizeKey(label) + ': ' : ''}${fmtScalar(v)}`];
  const lines = [];
  if (label) lines.push(`${pad}${humanizeKey(label)}:`);
  if (Array.isArray(v)) {
    v.filter(x => !isEmptyDeep(x)).forEach((it, i) => {
      if (isScalarVal(it)) lines.push(`${'  '.repeat(indent + (label ? 1 : 0))}${i + 1}. ${fmtScalar(it)}`);
      else flattenObjectLines(it, '', indent + (label ? 1 : 0)).forEach(l => lines.push(l));
    });
  } else {
    Object.entries(v).filter(([, sv]) => !isEmptyDeep(sv)).forEach(([k, sv]) => {
      flattenObjectLines(sv, k, indent + (label ? 1 : 0)).forEach(l => lines.push(l));
    });
  }
  return lines;
};

/* parseLabel: detect "Label: value" patterns (skip subordinate-clause openers) */
const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware comma split (thousands-separator guard: comma must be followed by whitespace) */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '')) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* ═══════ COMPONENT ═══════ */
const PainManagementPlanDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys staged as drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.pain_management_plan) return Array.isArray(r.pain_management_plan) ? r.pain_management_plan : [r.pain_management_plan];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.pain_management_plan) return Array.isArray(dd.pain_management_plan) ? dd.pain_management_plan : [dd.pain_management_plan]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* safeId at module-render scope reused by the rehydrate effect below */
  const recordIdOf = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  /* Remap the record-index segment of a tracking/marker key to the current render idx.
     Handles "fn-idx", "fn-idx-sN", "fn-idx-sN-cM", "fn.itemIdx-idx" (the record idx is the
     numeric segment that precedes -s / -c / end; itemIdx uses a dot so it is never matched). */
  const remapMarker = (key, idx) => key.replace(/-(\d+)(?=$|-s|-c)/, `-${idx}`);

  /* ═══════ REHYDRATE PENDING DRAFTS (survive refresh; shown in JSX, NOT in DB/PDF) ═══════ */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const rid = recordIdOf(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([editKey, draft]) => {
        if (!draft || typeof draft !== 'object') return;
        // editKey was persisted with the ORIGINAL render index baked in; remap to the current idx.
        const remappedKey = remapMarker(editKey, idx);
        const remappedRenderKey = draft.renderKey ? draft.renderKey.replace(/-(\d+)$/, `-${idx}`) : remappedKey;
        nPending[remappedKey] = { recordId: rid, payload: draft.payload, renderKey: remappedRenderKey };
        if (draft.renderKey) nLocal[remappedRenderKey] = draft.renderValue;
        if (draft.marker && draft.marker.key) {
          const mk = remapMarker(draft.marker.key, idx);
          if (draft.marker.store === 'sentences') nSentences[mk] = draft.marker.value;
          else nFields[mk] = draft.marker.value;
        }
        if (draft.extraMarkers) {
          Object.entries(draft.extraMarkers).forEach(([emKey, emVal]) => { nSentences[remapMarker(emKey, idx)] = emVal; });
        }
      });
    });
    if (Object.keys(nPending).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records, recordIdOf]);

  /* Stage one edit as a DRAFT: render-overlay + edited badge + pending flag + localStorage.
     NO DB write. Approve replays draft.payload. editKey is the tracking key (ends with -idx). */
  const stageDraft = useCallback((record, idx, editKey, renderKey, renderValue, marker, payload) => {
    const rid = recordIdOf(record); if (!rid) return;
    setLocalEdits(prev => ({ ...prev, [renderKey]: renderValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: { recordId: rid, payload, renderKey } }));
    if (marker && marker.store === 'sentences') setEditedSentences(prev => ({ ...prev, [marker.key]: marker.value }));
    else if (marker) setEditedFields(prev => ({ ...prev, [marker.key]: marker.value }));
    // Re-edit after approval → drop the section's 'approved' flag so the button returns to yellow Pending.
    setApprovedSections(prev => {
      const sid = marker && marker.sectionKey;
      if (!sid || !prev[sid]) return prev;
      const next = { ...prev }; delete next[sid]; return next;
    });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][editKey] = { renderKey, renderValue, marker: marker ? { store: marker.store, key: marker.key, value: marker.value } : null, payload };
    writeDrafts(store);
  }, [recordIdOf]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return !isEmptyDeep(v); return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return record[fn];
  }, [localEdits]);

  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || !text) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = String(text).split(regex);
    return parts.map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part);
  }, [searchTerm]);

  const sectionTitleMatches = useCallback((sid) => {
    if (!searchTerm.trim()) return false;
    const p = searchTerm.toLowerCase().trim();
    const t = (SECTION_TITLES[sid] || '').toLowerCase();
    return t.includes(p) || p.includes(t);
  }, [searchTerm]);

  /* ═══════ SEARCH — 4-LEVEL ═══════ */
  const shouldShowSection = useCallback((record, sid) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, 0);
      if (val !== null && val !== undefined) {
        if (f === RECOMMENDATIONS_FIELD && Array.isArray(val)) {
          if (val.some(item => {
            const rec = typeof item === 'object' ? (item.recommendation || '') : String(item);
            return rec.toLowerCase().includes(phrase);
          })) return true;
        } else if (OBJECT_FIELDS.includes(f) && val && typeof val === 'object' && !Array.isArray(val)) {
          if (flattenSearchable(val).toLowerCase().includes(phrase)) return true;
        } else if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
        else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) {
      if (fn === RECOMMENDATIONS_FIELD && Array.isArray(val)) {
        return val.some(item => {
          const rec = typeof item === 'object' ? (item.recommendation || '') : String(item);
          return rec.toLowerCase().includes(phrase);
        });
      }
      if (OBJECT_FIELDS.includes(fn) && val && typeof val === 'object' && !Array.isArray(val)) {
        return flattenSearchable(val).toLowerCase().includes(phrase);
      }
      if (Array.isArray(val)) return val.some(item => String(item).toLowerCase().includes(phrase));
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Pain Management Plan ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val) {
            if (f === RECOMMENDATIONS_FIELD && Array.isArray(val)) {
              if (val.some(item => {
                const rec = typeof item === 'object' ? (item.recommendation || '') : String(item);
                return rec.toLowerCase().includes(phrase);
              })) return true;
            } else if (OBJECT_FIELDS.includes(f) && typeof val === 'object' && !Array.isArray(val)) {
              if (flattenSearchable(val).toLowerCase().includes(phrase)) return true;
            } else if (Array.isArray(val)) {
              if (val.some(item => String(item).toLowerCase().includes(phrase))) return true;
            } else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
          }
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    // renderKeys still staged as pending drafts must NOT flow into the PDF/Copy All until Approve.
    const pendingRenderKeys = new Set(
      Object.values(pendingEdits).map(p => p && p.renderKey).filter(Boolean)
    );
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingRenderKeys.has(key)) return; // pending draft stays OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          merged[m[1]] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    // Stage a DRAFT only (no DB write). Approve commits { field: fn, value: saveVal }.
    stageDraft(record, idx, trackKey, `${fn}-${idx}`, saveVal,
      { store: 'fields', key: trackKey, value: 'edited', sectionKey: `${sid}-${idx}` },
      { field: fn, value: saveVal });
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  /* Save a nested OBJECT leaf by dot-path (e.g. results.foo.bar) — value stays raw text/boolean */
  const saveLeaf = useCallback((record, rootField, path, idx, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    const dottedField = `${rootField}.${path.join('.')}`;
    // Build the merged render value (clone with this leaf updated) for the localEdits overlay.
    const cur = localEdits[`${rootField}-${idx}`] !== undefined ? localEdits[`${rootField}-${idx}`] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    node[path[path.length - 1]] = newVal;
    // Dotted field with a NON-numeric trailing segment → field stays the full dotted path (NO arrayIndex).
    stageDraft(record, idx, leafKeyTrack, `${rootField}-${idx}`, clone,
      { store: 'fields', key: leafKeyTrack, value: 'edited' },
      { field: dottedField, value: newVal });
    setEditingField(null); setEditValue('');
  }, [safeId, localEdits, stageDraft]);

  // Stage extra sentence/comma badge markers (e.g. 'added' rows) into state + the same record draft entry.
  function stageExtraMarkers(record, editKey, marks) {
    const rid = recordIdOf(record); if (!rid) return;
    setEditedSentences(prev => ({ ...prev, ...marks }));
    const store = readDrafts();
    if (store[rid] && store[rid][editKey]) {
      store[rid][editKey].extraMarkers = { ...(store[rid][editKey].extraMarkers || {}), ...marks };
      writeDrafts(store);
    }
  }

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    const editKey = `${fn}-${idx}-s${sentenceIdx}`;
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setSaveError(null);
      stageDraft(record, idx, editKey, `${fn}-${idx}`, fullText,
        { store: 'sentences', key: editKey, value: 'edited' },
        { field: fn, value: fullText });
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setSaveError(null);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    stageDraft(record, idx, editKey, `${fn}-${idx}`, fullText,
      changed ? { store: 'sentences', key: editKey, value: 'edited' } : null,
      { field: fn, value: fullText });
    const extra = newSentences.length - 1;
    if (extra > 0) {
      const marks = {};
      for (let ei = 0; ei < extra; ei++) marks[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      stageExtraMarkers(record, editKey, marks);
    }
    setEditingField(null); setEditValue('');
  }

  function saveCommaItem(record, fn, idx, sid, sentenceIdx, commaIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const s = sentences[sentenceIdx] || '';
    const p = parseLabel(s);
    if (!p.isLabeled) return;
    const items = splitByComma(p.value);
    const trimmed = editValue.trim();

    // Handle ". Test" pattern — split on period+space into multiple items
    const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp);
    if (subParts.length > 1) {
      items.splice(commaIdx, 1, ...subParts);
    } else {
      items[commaIdx] = trimmed.replace(/[;.]+$/, '').trim();
    }
    const rebuilt = `${p.label}: ${items.join(', ')}.`;
    const allS = [...sentences]; allS[sentenceIdx] = rebuilt;
    const fullText = reconstructFullText(allS);
    setSaveError(null);
    const commaKey = `${fn}-${idx}-s${sentenceIdx}-c${commaIdx}`;
    stageDraft(record, idx, commaKey, `${fn}-${idx}`, fullText,
      { store: 'sentences', key: commaKey, value: 'edited' },
      { field: fn, value: fullText });
    if (subParts.length > 1) {
      const marks = {};
      for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sentenceIdx}-c${commaIdx + ei}`] = 'added';
      stageExtraMarkers(record, commaKey, marks);
    }
    setEditingField(null); setEditValue('');
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    // A pending editKey belongs to this section when its field part matches a section field.
    const belongsToSection = (editKey) => {
      const m = editKey.match(/^(.+)-(\d+)(?:-s\d+)?(?:-c\d+)?$/);
      if (!m || parseInt(m[2], 10) !== idx) return false;
      const fieldPart = m[1];                                   // "fn" or "fn.itemIdx" or "root.dotted.path"
      const baseField = fieldPart.split('.')[0];
      return fields.includes(baseField);
    };
    const toCommit = Object.keys(pendingEdits).filter(belongsToSection);
    try {
      // Persist each staged field to the DB now using its captured payload.
      for (const editKey of toCommit) {
        const payload = pendingEdits[editKey] && pendingEdits[editKey].payload;
        if (!payload) continue;
        const resp = await secureApiClient.put(`/api/edit/pain_management_plan/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/pain_management_plan/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) { toCommit.forEach(k => { delete store[id][k]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[PainManagementPlan] Approve error:', err); }
  }, [safeId, pendingEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection]);

  /* ═══════ COPY ═══════ */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* ═══════ FORMAT HELPERS FOR COPY ═══════ */
  const formatSentenceFieldLines = useCallback((text) => {
    const sentences = splitBySentence(text);
    const lines = []; let n = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        const parts = splitByComma(parsed.value);
        if (parts.length >= 2) {
          lines.push(parsed.label + ':');
          parts.forEach(item => { lines.push(`  ${n++}. ${item}`); });
        } else { lines.push(parsed.label + ':'); lines.push(`  ${n++}. ${parsed.value}`); }
      } else { lines.push(`${n++}. ${s}`); }
    });
    return lines;
  }, [splitBySentence]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    if (!fields.some(f => hasVal(getFieldValue(record, f, idx)))) return '';
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        text += `${label}\n${formatDate(val)}\n\n`;
      } else if (f === RECOMMENDATIONS_FIELD && Array.isArray(val)) {
        text += `${label}\n`;
        val.forEach((item, i) => {
          const rec = typeof item === 'object' ? (item.recommendation || '') : String(item);
          const dt = typeof item === 'object' && item.date ? ` (${formatDate(item.date)})` : '';
          text += `${i + 1}. ${rec}${dt}\n`;
        });
        text += '\n';
      } else if (OBJECT_FIELDS.includes(f) && val && typeof val === 'object' && !Array.isArray(val)) {
        const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
        if (entries.length === 0) return;
        text += `${label}\n`;
        entries.forEach(([k, v]) => { flattenObjectLines(v, k, 0).forEach(l => { text += `${l}\n`; }); });
        text += '\n';
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val : [val];
        text += `${label}\n${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}\n\n`;
      } else if (STRING_FIELDS.includes(f)) {
        const strVal = fmtVal(val);
        const sentences = splitBySentence(strVal);
        if (sentences.length > 1) {
          text += `${label}\n`;
          formatSentenceFieldLines(strVal).forEach(l => { text += `${l}\n`; });
          text += '\n';
        } else {
          text += `${label}\n${strVal}\n\n`;
        }
      } else {
        text += `${label}\n${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== PAIN MANAGEMENT PLAN ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Pain Management Plan ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: DATE FIELD ═══════ */
  const renderDateField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = formatDate(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, sid, null, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY FIELD (per-item editing with dot-path keys) ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    // Single-name gate: suppress the field-label subtitle when it duplicates the section title.
    const showFieldLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showFieldLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, itemIdx) => {
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemStr = String(item);
          // Labeled item ("Epidural PCEA: Ropivacaine…") → label becomes a nested-subtitle ABOVE the value row.
          const parsed = parseLabel(itemStr);
          const displayVal = parsed.isLabeled ? parsed.value : itemStr;

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
          }

          return (
            <div key={itemIdx}>
              {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(parsed.isLabeled ? parsed.value : itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setSaveError(null); const newItem = parsed.isLabeled ? `${parsed.label}: ${editValue}` : editValue; const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = newItem; stageDraft(record, idx, editKey, `${fn}-${idx}`, currentArr, { store: 'fields', key: editKey, value: 'edited', sectionKey: `${sid}-${idx}` }, { field: fn, value: newItem, arrayIndex: itemIdx }); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: RECOMMENDATIONS FIELD (array of objects) ═══════ */
  const renderRecommendationsField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const showFieldLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();

    return (
      <div key={fn} className="rec-mini-card">
        {showFieldLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, itemIdx) => {
          const recText = typeof item === 'object' ? (item.recommendation || '') : String(item);
          const recDate = typeof item === 'object' && item.date ? formatDate(item.date) : '';
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !recText.toLowerCase().includes(phrase)) return null;
          }

          return (
            <div key={itemIdx}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(recText); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setSaveError(null); const updatedItem = typeof item === 'object' ? { ...item, recommendation: editValue } : editValue; const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = updatedItem; stageDraft(record, idx, editKey, `${fn}-${idx}`, currentArr, { store: 'fields', key: editKey, value: 'edited', sectionKey: `${sid}-${idx}` }, { field: fn, value: updatedItem, arrayIndex: itemIdx }); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content">
                      <span className="content-value">{highlightText(recText)}</span>
                      {recDate && <span className="rec-date-tag">{highlightText(recDate)}</span>}
                      <span className="edit-indicator">&#9998;</span>
                    </div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(recText, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT LEAF (scalar — typed editable: boolean→select, number/string→textarea) ═══════ */
  const renderObjectLeaf = (record, rootField, path, idx) => {
    // read the live value from localEdits overlay (or record) following the path
    const src = localEdits[`${rootField}-${idx}`] !== undefined ? localEdits[`${rootField}-${idx}`] : record[rootField];
    let value = src;
    for (const p of path) { value = value == null ? undefined : value[p]; }
    const leafKey = `${rootField}.${path.join('.')}-${idx}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const isNum = typeof value === 'number';
    const leafLabel = humanizeKey(path[path.length - 1]);
    const leafValueString = fmtScalar(value);
    const startEdit = () => { if (!isEditing) { setEditingField(leafKey); setEditValue(isBool ? (value ? 'Yes' : 'No') : leafValueString); setSaveError(null); } };

    return (
      <div key={path.join('.')} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(leafLabel)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={startEdit}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <BlueSelect value={editValue} options={['Yes', 'No']} onChange={v => setEditValue(v)} />
              ) : isNum ? (
                <div className="num-stepper-row">
                  <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) - 1)); }}>&minus;</button>
                  <input type="text" inputMode="decimal" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) + 1)); }}>+</button>
                </div>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); let nv; if (isBool) nv = editValue === 'Yes'; else if (isNum) { const p = parseFloat(editValue); if (isNaN(p)) { setSaveError('Please enter a valid number'); return; } nv = p; } else nv = editValue; saveLeaf(record, rootField, path, idx, leafKey, nv); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[leafKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${leafLabel}: ${leafValueString}`, leafKey); }}>{copiedItems[leafKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT NODE (recursive; humanizeKey heading; hide-empty at every level) ═══════ */
  const renderObjectNode = (record, rootField, idx, label, value, path) => {
    if (isEmptyDeep(value)) return null;
    if (isScalarVal(value)) return renderObjectLeaf(record, rootField, path, idx);
    if (Array.isArray(value)) {
      const items = value.filter(x => !isEmptyDeep(x));
      if (items.length === 0) return null;
      return (
        <div className="rec-mini-card" key={path.join('.') || rootField}>
          {label && <div className="nested-subtitle">{highlightText(label)}</div>}
          {items.map((it, i) => (
            isScalarVal(it)
              ? renderObjectLeaf(record, rootField, [...path, i], idx)
              : <div className="rec-mini-card" key={i} style={{ marginTop: 8 }}>{renderObjectNode(record, rootField, idx, '', it, [...path, i])}</div>
          ))}
        </div>
      );
    }
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div className="rec-mini-card" key={path.join('.') || rootField} style={path.length > 0 ? { marginTop: 8 } : undefined}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([k, v]) => (
          isScalarVal(v)
            ? renderObjectLeaf(record, rootField, [...path, k], idx)
            : <div key={k}>{renderObjectNode(record, rootField, idx, humanizeKey(k), v, [...path, k])}</div>
        ))}
      </div>
    );
  };

  /* ═══════ RENDER: RESULTS — dynamic-key OBJECT field ═══════ */
  const renderResultsField = (record, fn, idx, sid) => {
    const src = localEdits[`${fn}-${idx}`] !== undefined ? localEdits[`${fn}-${idx}`] : record[fn];
    const val = src && typeof src === 'object' && !Array.isArray(src) ? src : null;
    if (!val || isEmptyDeep(val)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const showFieldLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();

    return (
      <div key={fn} className="rec-mini-card">
        {showFieldLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([k, v]) => (
          isScalarVal(v)
            ? renderObjectLeaf(record, fn, [k], idx)
            : <div key={k}>{renderObjectNode(record, fn, idx, humanizeKey(k), v, [k])}</div>
        ))}
      </div>
    );
  };

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence: render with splitBySentence */
    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn}>
          <div className="rec-mini-card">
            <div className="nested-subtitle">{highlightText(label)}</div>
            {sentences.map((sentence, sIdx) => {
              const sentenceKey = `${fn}-${idx}-s${sIdx}`;
              const isEditing = editingField === sentenceKey;
              const badge = editedSentences[sentenceKey];
              const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
              if (!sentenceMatches && searchTerm.trim()) return null;

              const parsed = parseLabel(sentence);
              if (parsed.isLabeled) {
                const commaItems = splitByComma(parsed.value);
                const parsedLabelMatch = searchTerm.trim() && parsed.label.toLowerCase().includes(searchTerm.toLowerCase().trim());
                if (commaItems.length >= 2) {
                  return (
                    <div key={sIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                      <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                      {commaItems.map((ci, ciIdx) => {
                        const commaKey = `${sentenceKey}-c${ciIdx}`;
                        const ciEditing = editingField === commaKey;
                        const ciBadge = editedSentences[commaKey];
                        const ciMatches = phraseMatch || labelMatch || parsedLabelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
                        if (!ciMatches && searchTerm.trim()) return null;
                        return (
                          <div key={ciIdx}>
                            <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                              {ciEditing ? (
                                <div className="edit-field-container">
                                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                  {saveError && <div className="save-error">{saveError}</div>}
                                  <div className="edit-actions">
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItem(record, fn, idx, sid, sIdx, ciIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                                    <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">&#9998;</span></div>
                                  <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(ci, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
                                </>
                              )}
                            </div>
                            {ciBadge && <span className={`modified-badge ${ciBadge === 'added' ? 'added' : ''}`}>{ciBadge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                }
              }

              /* Regular sentence row */
              return (
                <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                  {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const id = safeId(record); if (!id) return; const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setSaveError(null); stageDraft(record, idx, sentenceKey, `${fn}-${idx}`, fullText, { store: 'sentences', key: sentenceKey, value: 'edited', sectionKey: `${sid}-${idx}` }, { field: fn, value: fullText }); if (subParts.length > 1) { const marks = {}; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; stageExtraMarkers(record, sentenceKey, marks); } setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : sentence)}</span><span className="edit-indicator">&#9998;</span></div>
                        <button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    /* Single-value string: simple editable */
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(strVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(strVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${strVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => {
      const val = getFieldValue(record, f, idx);
      return hasVal(val);
    });
    if (!hasAnyVal) return null;

    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (f === RECOMMENDATIONS_FIELD) return renderRecommendationsField(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderResultsField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="pain-management-plan-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Pain Management Plans</h2></div>
        <div className="empty-state">No pain management plan records available</div>
      </div>
    );
  }

  return (
    <div className="pain-management-plan-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Pain Management Plans</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<PainManagementPlanDocumentPDFTemplate document={pdfData} />} fileName="Pain_Management_Plans.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search pain management plans..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              {hasVal(record.date) && (
                <div className="record-meta-row">
                  <span className="record-date">{highlightText(formatDate(record.date))}</span>
                </div>
              )}
              <h3 className="record-name">{highlightText(record.provider || `Pain Management Plan ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'record-info')}
            {renderSection(record, idx, 'current-analgesics')}
            {renderSection(record, idx, 'interventional-procedures')}
            {renderSection(record, idx, 'consultations')}
            {renderSection(record, idx, 'supportive-devices')}
            {renderSection(record, idx, 'radiation-therapy')}
            {renderSection(record, idx, 'clinical-details')}
            {renderSection(record, idx, 'recommendations')}
            {renderSection(record, idx, 'results')}
            {renderSection(record, idx, 'notes')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PainManagementPlanDocument;
