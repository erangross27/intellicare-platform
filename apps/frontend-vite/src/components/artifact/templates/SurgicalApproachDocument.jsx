/**
 * SurgicalApproachDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: surgical_approach
 *
 * Sections:
 *   1. procedure-info: technique, positioning, prepAndDraping, type, status
 *   2. provider-info: provider, facility, date
 *   3. pneumoperitoneum: pneumoperitoneum (OBJECT — recursive editable leaves)
 *   4. port-placement: portPlacement (array of {size, location, purpose})
 *   5. incisions: incisions (array of {type, location, length})
 *   6. findings-assessment: findings, assessment
 *   7. plan-recommendations: plan, recommendations (array)
 *   8. results: results (OBJECT — recursive editable leaves)
 *   9. notes: notes
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SurgicalApproachDocumentPDFTemplate from '../pdf-templates/SurgicalApproachDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './SurgicalApproachDocument.css';

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'procedure-info': 'Procedure Information',
  'provider-info': 'Provider & Date',
  'pneumoperitoneum': 'Pneumoperitoneum',
  'port-placement': 'Port Placement',
  'incisions': 'Incisions',
  'findings-assessment': 'Findings & Assessment',
  'plan-recommendations': 'Plan & Recommendations',
  'results': 'Results',
  'notes': 'Notes',
};

const FIELD_LABELS = {
  technique: 'Technique',
  positioning: 'Positioning',
  prepAndDraping: 'Prep & Draping',
  type: 'Type',
  status: 'Status',
  provider: 'Provider',
  facility: 'Facility',
  date: 'Date',
  pneumoperitoneum: 'Pneumoperitoneum',
  portPlacement: 'Port Placement',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  results: 'Results',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'procedure-info': ['technique', 'positioning', 'prepAndDraping', 'type', 'status'],
  'provider-info': ['provider', 'facility', 'date'],
  'pneumoperitoneum': ['pneumoperitoneum'],
  'port-placement': [],
  'incisions': [],
  'findings-assessment': ['findings', 'assessment'],
  'plan-recommendations': ['plan'],
  'results': ['results'],
  'notes': ['notes'],
};

// ─── Defer-save draft store (localStorage) ────────────────────────────────────
// Save stages a local DRAFT only; Approve is the ONLY path that writes to MongoDB.
// Shape: { [recordId]: { [dbFieldPath]: value } } — dbFieldPath is the EXACT PUT
// field each save site computes (flat "technique", dotted "pneumoperitoneum.pressure",
// array-element "incisions.0.type" / "recommendations.1.recommendation").
const DRAFT_KEY = 'surgical_approachPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch { return {}; }
};
const writeDrafts = (store) => {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(store)); } catch { /* ignore */ }
};
const stageDraft = (recId, dbField, value) => {
  if (!recId) return;
  const store = readDrafts();
  store[recId] = { ...(store[recId] || {}), [dbField]: value };
  writeDrafts(store);
};

const BOOLEAN_FIELDS = ['aiProcessed'];
const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['portPlacement'];
const OBJECT_FIELDS = ['pneumoperitoneum', 'results'];
const STRING_FIELDS = ['technique', 'positioning', 'prepAndDraping', 'type', 'status', 'provider', 'facility', 'findings', 'assessment', 'plan', 'notes'];

/* humanizeKey: snake/camel → Title Case */
const KEY_OVERRIDES = {};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* number+unit leaf splitter — returns null for plain text and "4/5" ratios */
const splitNumberUnit = (text) => {
  if (text === null || text === undefined) return null;
  const s = String(text).trim();
  if (s === '') return null;
  if (/^-?\d+(?:\.\d+)?\s*\/\s*\d/.test(s)) return null;
  const m = s.match(/^(-?[\d,]*\.?\d+)(\s*)(.*)$/);
  if (!m || !/\d/.test(m[1])) return null;
  return { num: m[1].replace(/,/g, ''), sep: m[2] || '', unit: (m[3] || '').trim() };
};

const splitRatio = (text) => {
  if (text === null || text === undefined) return null;
  const m = String(text).trim().match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return { num: m[1], denom: m[2] };
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

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware comma split */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
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
const SurgicalApproachDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [pendingEdits, setPendingEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.surgical_approach) return Array.isArray(r.surgical_approach) ? r.surgical_approach : [r.surgical_approach];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.surgical_approach) return Array.isArray(dd.surgical_approach) ? dd.surgical_approach : [dd.surgical_approach]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
        if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
        else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
    }
    /* incisions section */
    if (sid === 'incisions') {
      const incisions = record.incisions;
      if (Array.isArray(incisions) && incisions.some(inc => flattenSearchable(inc).toLowerCase().includes(phrase))) return true;
    }
    /* port-placement section */
    if (sid === 'port-placement') {
      const ports = record.portPlacement;
      if (Array.isArray(ports) && ports.some(p => flattenSearchable(p).toLowerCase().includes(phrase))) return true;
    }
    /* pneumoperitoneum / results object sections */
    if ((sid === 'pneumoperitoneum' || sid === 'results') && flattenSearchable(record[sid]).toLowerCase().includes(phrase)) return true;
    /* recommendations inside plan-recommendations */
    if (sid === 'plan-recommendations') {
      const recs = record.recommendations;
      if (Array.isArray(recs) && recs.some(r => String(r.recommendation || r).toLowerCase().includes(phrase))) return true;
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
      const rt = `Surgical Approach ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && (Array.isArray(val) ? val.some(item => String(item).toLowerCase().includes(phrase)) : fmtVal(val).toLowerCase().includes(phrase))) return true;
        }
      }
      /* incisions search */
      if (Array.isArray(record.incisions) && record.incisions.some(inc => flattenSearchable(inc).toLowerCase().includes(phrase))) return true;
      /* port placement search */
      if (Array.isArray(record.portPlacement) && record.portPlacement.some(p => flattenSearchable(p).toLowerCase().includes(phrase))) return true;
      /* pneumoperitoneum / results object search */
      if (flattenSearchable(record.pneumoperitoneum).toLowerCase().includes(phrase)) return true;
      if (flattenSearchable(record.results).toLowerCase().includes(phrase)) return true;
      /* recommendations search */
      if (Array.isArray(record.recommendations) && record.recommendations.some(r => String(r.recommendation || r).toLowerCase().includes(phrase))) return true;
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // un-approved draft stays OUT of PDF/Copy All
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          merged[m[1]] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  // DEFER-SAVE: rehydrate staged drafts on mount so a Save survives refresh
  // (shown in JSX, kept OUT of the DB/PDF until Approve). Reconstructs flat fields,
  // object leaves, and array-element edits back into localEdits; sets coarse edited
  // markers so each section's Pending Approve button reappears.
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const le = {}, pe = {}, ef = {};
    filteredRecords.forEach((rec, idx) => {
      const id = safeId(rec);
      const drafts = id && store[id];
      if (!drafts) return;
      for (const [dbField, value] of Object.entries(drafts)) {
        const parts = dbField.split('.');
        const root = parts[0];
        const rest = parts.slice(1);
        const key = `${root}-${idx}`;
        if (rest.length === 0) {
          le[key] = value;
        } else {
          const seed = rec[root] ?? (/^\d+$/.test(rest[0]) ? [] : {});
          const base = le[key] !== undefined ? le[key] : JSON.parse(JSON.stringify(seed));
          let node = base;
          for (let i = 0; i < rest.length - 1; i++) {
            if (node[rest[i]] == null) node[rest[i]] = /^\d+$/.test(rest[i + 1]) ? [] : {};
            node = node[rest[i]];
          }
          node[rest[rest.length - 1]] = value;
          le[key] = base;
        }
        pe[key] = true;
        ef[`${dbField}-${idx}`] = 'edited';
      }
    });
    if (Object.keys(le).length) {
      setLocalEdits(prev => ({ ...le, ...prev }));
      setPendingEdits(prev => ({ ...pe, ...prev }));
      setEditedFields(prev => ({ ...ef, ...prev }));
    }
  }, [filteredRecords]);

  /* ═══════ EDIT HANDLERS ═══════ */
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    // DEFER-SAVE: stage a local draft only; Approve commits to the DB.
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue('');
    stageDraft(id, fn, saveVal);
  }, [editValue, safeId]);

  /* ═══════ SAVE: OBJECT LEAF (dotted-path) ═══════ */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    const dottedField = `${rootField}.${path.join('.')}`;
    // DEFER-SAVE: stage a local draft only; Approve commits the dotted leaf to the DB.
    setLocalEdits(prev => {
      const cur = prev[`${rootField}-${idx}`] !== undefined ? prev[`${rootField}-${idx}`] : record[rootField];
      const clone = JSON.parse(JSON.stringify(cur ?? {}));
      let node = clone;
      for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
      node[path[path.length - 1]] = newVal;
      return { ...prev, [`${rootField}-${idx}`]: clone };
    });
    setPendingEdits(prev => ({ ...prev, [`${rootField}-${idx}`]: true }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue('');
    stageDraft(id, dottedField, newVal);
  }, [safeId]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    // DEFER-SAVE: stage a local draft only; Approve commits to the DB.
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
      setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
      setEditingField(null); setEditValue('');
      stageDraft(id, fn, fullText);
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue('');
    stageDraft(id, fn, fullText);
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    /* also check incision/port/recommendation edits */
    const extraKeys = sid === 'incisions' ? ['incisions'] : sid === 'port-placement' ? ['portPlacement'] : sid === 'plan-recommendations' ? ['recommendations'] : [];
    const allFields = [...fields, ...extraKeys];
    return allFields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    const extraKeys = sid === 'incisions' ? ['incisions'] : sid === 'port-placement' ? ['portPlacement'] : sid === 'plan-recommendations' ? ['recommendations'] : [];
    const allFields = [...fields, ...extraKeys];
    try {
      // DEFER-SAVE: Approve is the ONLY DB writer. Commit this section's staged
      // drafts (filtered by field root) to /edit, then /approve, then clear them.
      const store = readDrafts();
      const recordDrafts = store[id] || {};
      const toCommit = Object.entries(recordDrafts).filter(([dbField]) => allFields.includes(dbField.split('.')[0]));
      for (const [field, value] of toCommit) {
        await secureApiClient.put(`/api/edit/surgical_approach/${id}/edit`, { field, value });
      }
      await secureApiClient.put(`/api/edit/surgical_approach/${id}/approve`, { sectionId: sid, approved: true });
      // Drop the committed drafts from the store
      if (toCommit.length) {
        const remaining = { ...recordDrafts };
        toCommit.forEach(([f]) => delete remaining[f]);
        if (Object.keys(remaining).length) store[id] = remaining; else delete store[id];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setPendingEdits(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { const m = k.match(/^(.+)-(\d+)$/); if (m && parseInt(m[2]) === idx && allFields.includes(m[1])) delete n[k]; }); return n; });
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { allFields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { allFields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); }
  }, [safeId]);

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
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        text += `${label}\n${formatDate(val)}\n\n`;
      } else if (OBJECT_FIELDS.includes(f)) {
        text += `${label}\n`;
        const walk = (obj, indent) => {
          Object.entries(obj).forEach(([k, v]) => {
            if (isEmptyDeep(v)) return;
            if (isScalar(v)) { text += `${indent}${humanizeKey(k)}: ${fmtScalar(v)}\n`; }
            else { text += `${indent}${humanizeKey(k)}:\n`; walk(v, indent + '  '); }
          });
        };
        walk(val, '  ');
        text += '\n';
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
    /* port placement */
    if (sid === 'port-placement' && Array.isArray(record.portPlacement) && record.portPlacement.length > 0) {
      text += 'Port Placement\n';
      record.portPlacement.forEach((p, i) => {
        text += `${i + 1}. ${flattenSearchable(p)}\n`;
      });
      text += '\n';
    }
    /* incisions */
    if (sid === 'incisions' && Array.isArray(record.incisions) && record.incisions.length > 0) {
      record.incisions.forEach((inc, i) => {
        text += `${i + 1}. ${inc.type || ''}${inc.location ? ' - ' + inc.location : ''}\n`;
      });
      text += '\n';
    }
    /* recommendations */
    if (sid === 'plan-recommendations' && Array.isArray(record.recommendations) && record.recommendations.length > 0) {
      text += 'Recommendations\n';
      record.recommendations.forEach((rec, i) => {
        text += `${i + 1}. ${rec.recommendation || rec}\n`;
        if (rec.date) text += `   Date: ${rec.date}\n`;
      });
      text += '\n';
    }
    return text;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== SURGICAL APPROACH ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Surgical Approach ${idx + 1}\n${'='.repeat(40)}\n\n`;
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
              <input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
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

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringField = (record, fn, idx, sid, title) => {
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText2 })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); stageDraft(id2, fn, fullText2); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); stageDraft(safeId(record), fn, fullText); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: OBJECT LEAF (editable; number+unit -> number input, bool -> Yes/No, "4/5" stays text) ═══════ */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const ratio = isBool ? null : splitRatio(leafValueString);
    const nu = (isBool || ratio) ? null : splitNumberUnit(leafValueString);
    const editStartValue = isBool ? (value ? 'yes' : 'no') : ratio ? ratio.num : nu ? nu.num : leafValueString;
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(editStartValue); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : (ratio || nu) ? (
                <div className="number-edit-row">
                  <input type="number" step="any" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  {ratio ? <span className="number-edit-unit">{`/ ${ratio.denom}`}</span> : (nu.unit && <span className="number-edit-unit">{nu.unit}</span>)}
                </div>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => {
                  e.stopPropagation();
                  let newVal;
                  if (isBool) {
                    newVal = editValue === 'yes';
                  } else if (ratio) {
                    const n = parseFloat(editValue);
                    if (isNaN(n)) { setSaveError('Please enter a valid number'); return; }
                    newVal = `${n}/${ratio.denom}`;
                  } else if (nu) {
                    const n = parseFloat(editValue);
                    if (isNaN(n)) { setSaveError('Please enter a valid number'); return; }
                    newVal = nu.unit ? `${n}${nu.sep || ' '}${nu.unit}` : String(n);
                  } else {
                    newVal = editValue.trim();
                  }
                  saveLeaf(record, rootField, path, idx, sid, leafKey, newVal);
                }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[leafKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${humanizeKey(path[path.length - 1])}\n${leafValueString}`, leafKey); }}>{copiedItems[leafKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT (recursive; humanizeKey + nested-mini-card; editable leaves) ═══════ */
  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sid, value);
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && <div className={labelClass}>{highlightText(label)}</div>}
        <div className="nested-group">
          {entries.map(([k, v]) => (
            isScalar(v) ? renderObjectLeaf(record, rootField, [...path, k], idx, sid, v)
              : <div className="nested-mini-card" key={k}>{renderObjectNode(record, rootField, idx, sid, humanizeKey(k), v, [...path, k], depth + 1)}</div>
          ))}
        </div>
      </React.Fragment>
    );
  };

  const renderObjectField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || isScalar(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([k, v]) => (
          isScalar(v) ? renderObjectLeaf(record, fn, [k], idx, sid, v)
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fn, idx, sid, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    );
  };

  /* ═══════ RENDER: PORT PLACEMENT (array of {size, location, purpose}) ═══════ */
  const renderPortPlacementSection = (record, idx) => {
    const sid = 'port-placement';
    const ports = record.portPlacement;
    if (!Array.isArray(ports) || ports.length === 0) return null;
    if (!shouldShowSection(record, sid)) return null;

    const copyId = `${sid}-${idx}`;
    const phrase = searchTerm.toLowerCase().trim();
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Port Placement')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => {
                let text = `Port Placement\n${'='.repeat(40)}\n\n`;
                ports.forEach((p, i) => { text += `${i + 1}. ${flattenSearchable(p)}\n`; });
                copySection(text, copyId);
              }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {ports.map((port, portIdx) => {
            if (isEmptyDeep(port)) return null;
            if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
              if (!flattenSearchable(port).toLowerCase().includes(phrase) && !'port placement'.includes(phrase)) return null;
            }
            if (isScalar(port)) {
              return (
                <div key={portIdx} className="rec-mini-card">
                  {renderObjectLeaf(record, 'portPlacement', [portIdx], idx, sid, port)}
                </div>
              );
            }
            const entries = Object.entries(port).filter(([, v]) => !isEmptyDeep(v));
            if (entries.length === 0) return null;
            return (
              <div key={portIdx} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(`Port ${portIdx + 1}`)}</div>
                {entries.map(([k, v]) => (
                  isScalar(v) ? renderObjectLeaf(record, 'portPlacement', [portIdx, k], idx, sid, v)
                    : <div className="nested-mini-card" key={k}>{renderObjectNode(record, 'portPlacement', idx, sid, humanizeKey(k), v, [portIdx, k], 1)}</div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: INCISIONS (array of objects) ═══════ */
  const renderIncisionsSection = (record, idx) => {
    const sid = 'incisions';
    if (!Array.isArray(record.incisions) || record.incisions.length === 0) return null;
    if (!shouldShowSection(record, sid)) return null;

    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Incisions')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => {
                let text = `Incisions\n${'='.repeat(40)}\n\n`;
                (getFieldValue(record, 'incisions', idx) || []).forEach((inc, i) => { text += `${i + 1}. ${inc.type || ''}${inc.location ? ' - ' + inc.location : ''}\n`; });
                copySection(text, copyId);
              }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {(getFieldValue(record, 'incisions', idx) || []).map((inc, incIdx) => {
            const editKeyType = `incisions.${incIdx}.type-${idx}`;
            const editKeyLoc = `incisions.${incIdx}.location-${idx}`;
            const isEditingType = editingField === editKeyType;
            const isEditingLoc = editingField === editKeyLoc;
            const isModifiedType = editedFields[editKeyType];
            const isModifiedLoc = editedFields[editKeyLoc];
            const incText = `${inc.type || ''}${inc.location ? ' - ' + inc.location : ''}`;

            if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
              const phrase = searchTerm.toLowerCase().trim();
              if (!incText.toLowerCase().includes(phrase) && !'incisions'.includes(phrase)) return null;
            }

            return (
              <div key={incIdx} className="rec-mini-card">
                {inc.type && (
                  <>
                    <div className="nested-subtitle">{highlightText('Type')}</div>
                    <div className={`numbered-row ${isModifiedType ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditingType) { setEditingField(editKeyType); setEditValue(inc.type); setSaveError(null); } }}>
                      {isEditingType ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const arr = JSON.parse(JSON.stringify(getFieldValue(record, 'incisions', idx) || record.incisions || [])); arr[incIdx] = { ...arr[incIdx], type: editValue }; setLocalEdits(prev => ({ ...prev, [`incisions-${idx}`]: arr })); setPendingEdits(prev => ({ ...prev, [`incisions-${idx}`]: true })); setEditedFields(prev => ({ ...prev, [editKeyType]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); stageDraft(id, `incisions.${incIdx}.type`, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(inc.type)}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[editKeyType] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(inc.type, editKeyType); }}>{copiedItems[editKeyType] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {isModifiedType && <span className="modified-badge">edited - click Pending Approve to save</span>}
                  </>
                )}
                {inc.location && (
                  <>
                    <div className="nested-subtitle">{highlightText('Location')}</div>
                    <div className={`numbered-row ${isModifiedLoc ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditingLoc) { setEditingField(editKeyLoc); setEditValue(inc.location); setSaveError(null); } }}>
                      {isEditingLoc ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const arr = JSON.parse(JSON.stringify(getFieldValue(record, 'incisions', idx) || record.incisions || [])); arr[incIdx] = { ...arr[incIdx], location: editValue }; setLocalEdits(prev => ({ ...prev, [`incisions-${idx}`]: arr })); setPendingEdits(prev => ({ ...prev, [`incisions-${idx}`]: true })); setEditedFields(prev => ({ ...prev, [editKeyLoc]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); stageDraft(id, `incisions.${incIdx}.location`, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(inc.location)}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[editKeyLoc] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(inc.location, editKeyLoc); }}>{copiedItems[editKeyLoc] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {isModifiedLoc && <span className="modified-badge">edited - click Pending Approve to save</span>}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: RECOMMENDATIONS (array inside plan-recommendations) ═══════ */
  const renderRecommendations = (record, idx) => {
    const recs = getFieldValue(record, 'recommendations', idx) || record.recommendations;
    if (!Array.isArray(recs) || recs.length === 0) return null;

    return recs.map((rec, recIdx) => {
      const recText = rec.recommendation || (typeof rec === 'string' ? rec : '');
      if (!recText) return null;
      const editKey = `recommendations.${recIdx}-${idx}`;
      const isEditing = editingField === editKey;
      const isModified = editedFields[editKey];

      if (searchTerm.trim() && !sectionTitleMatches('plan-recommendations') && !record._showAllSections) {
        const phrase = searchTerm.toLowerCase().trim();
        if (!recText.toLowerCase().includes(phrase) && !'recommendations'.includes(phrase)) return null;
      }

      return (
        <div key={recIdx}>
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(recText); setSaveError(null); } }}>
            {isEditing ? (
              <div className="edit-field-container">
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const field = typeof rec === 'object' ? `recommendations.${recIdx}.recommendation` : `recommendations.${recIdx}`; const arr = JSON.parse(JSON.stringify(getFieldValue(record, 'recommendations', idx) || record.recommendations || [])); if (typeof rec === 'object' && rec !== null) { arr[recIdx] = { ...arr[recIdx], recommendation: editValue }; } else { arr[recIdx] = editValue; } setLocalEdits(prev => ({ ...prev, [`recommendations-${idx}`]: arr })); setPendingEdits(prev => ({ ...prev, [`recommendations-${idx}`]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`plan-recommendations-${idx}`]; return n; }); setEditingField(null); setEditValue(''); stageDraft(id, field, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="row-content"><span className="content-value">{highlightText(recText)}</span><span className="edit-indicator">&#9998;</span></div>
                <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(recText, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
              </>
            )}
          </div>
          {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      );
    });
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
    /* plan-recommendations also checks recommendations array */
    const hasRecs = sid === 'plan-recommendations' && Array.isArray(record.recommendations) && record.recommendations.length > 0;
    if (!hasAnyVal && !hasRecs) return null;

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
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid, title);
          })}
          {sid === 'plan-recommendations' && (
            <div className="rec-mini-card">
              <div className="nested-subtitle">{highlightText('Recommendations')}</div>
              {renderRecommendations(record, idx)}
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="surgical-approach-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Surgical Approach</h2></div>
        <div className="empty-state">No surgical approach records available</div>
      </div>
    );
  }

  return (
    <div className="surgical-approach-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Surgical Approach</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<SurgicalApproachDocumentPDFTemplate document={pdfData} />} fileName={`surgical-approach-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search surgical approach..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              {hasVal(record.date) && (
                <div className="record-meta-row">
                  <span className="record-date">{formatDate(record.date)}</span>
                </div>
              )}
              <h3 className="record-name">{highlightText(`Surgical Approach ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'procedure-info')}
            {renderSection(record, idx, 'provider-info')}
            {renderSection(record, idx, 'pneumoperitoneum')}
            {renderPortPlacementSection(record, idx)}
            {renderIncisionsSection(record, idx)}
            {renderSection(record, idx, 'findings-assessment')}
            {renderSection(record, idx, 'plan-recommendations')}
            {renderSection(record, idx, 'results')}
            {renderSection(record, idx, 'notes')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SurgicalApproachDocument;
