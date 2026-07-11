/**
 * ClinicalTrialsDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: clinical_trials
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ClinicalTrialsDocumentPDFTemplate from '../pdf-templates/ClinicalTrialsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './ClinicalTrialsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the exact DB field path to PUT) */
const DRAFT_KEY = 'clinical_trialsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const SECTION_TITLES = {
  eligibility: 'Eligibility & Enrollment',
  providerInfo: 'Provider Information',
  trialsOffered: 'Trials Offered',
  clinical: 'Clinical',
  results: 'Results',
  assessment: 'Assessment',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const FIELD_LABELS = {
  eligible: 'Eligible', enrolled: 'Enrolled', enrolledTrial: 'Enrolled Trial', screeningStatus: 'Screening Status',
  provider: 'Provider', facility: 'Facility', assessment: 'Assessment', plan: 'Plan', notes: 'Notes', findings: 'Findings', status: 'Status', results: 'Results',
};

const SECTION_FIELDS = {
  eligibility: ['eligible', 'enrolled', 'enrolledTrial', 'screeningStatus'],
  providerInfo: ['provider', 'facility'],
  clinical: ['findings', 'plan'],
  results: ['results'],
  assessment: ['assessment'],
  notes: ['notes', 'status'],
};

// narrative fields rendered per-sentence; `status` is a scalar
const SENTENCE_FIELDS = ['assessment', 'notes', 'findings', 'plan'];
// dynamic-key object fields rendered with the recursive object renderer
const OBJECT_FIELDS = ['results'];
// Fixed-choice status fields → dropdown (unmatched current value kept as an extra option).
const ENUM_FIELDS = {
  status: ['enrolled', 'screening', 'completed', 'withdrawn', 'not enrolled'],
  screeningStatus: ['Pending', 'In Progress', 'Passed', 'Failed'],
};
const enumOptionsWith = (opts, current) => { const cur = String(current ?? '').trim(); return cur && !opts.some(o => o.toLowerCase() === cur.toLowerCase()) ? [cur, ...opts] : opts; };
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

const KEY_OVERRIDES = { ews: 'EWS', icu: 'ICU', ed: 'ED', los: 'LOS', dnr: 'DNR', poc: 'POC', orr: 'ORR', pfs: 'PFS', os: 'OS' };
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
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
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
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};

const ClinicalTrialsDocument = ({ document: docProp }) => {
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
  const [saving, setSaving] = useState(false);
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const containerRef = useRef(null);

  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.clinical_trials) return Array.isArray(r.clinical_trials) ? r.clinical_trials : [r.clinical_trials];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.clinical_trials) return Array.isArray(dd.clinical_trials) ? dd.clinical_trials : [dd.clinical_trials]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const recId = idOf(record);
      const drafts = recId ? store[recId] : null;
      if (!drafts) return;
      Object.entries(drafts).forEach(([fieldPart, value]) => {
        const dotIdx = fieldPart.indexOf('.');
        const rootField = dotIdx === -1 ? fieldPart : fieldPart.slice(0, dotIdx);
        if (OBJECT_FIELDS.includes(rootField) && dotIdx !== -1) {
          // nested object leaf (e.g. results.orr) — merge into the object clone under `${rootField}-${idx}`
          const localKey = `${rootField}-${idx}`;
          const path = fieldPart.slice(dotIdx + 1).split('.');
          const base = nLocal[localKey] !== undefined ? nLocal[localKey] : record[rootField];
          const clone = JSON.parse(JSON.stringify(base ?? {}));
          let node = clone;
          for (let i = 0; i < path.length - 1; i++) { if (node[path[i]] === undefined || node[path[i]] === null) node[path[i]] = {}; node = node[path[i]]; }
          node[path[path.length - 1]] = value;
          nLocal[localKey] = clone;
          nPending[localKey] = true;
          nFields[`${rootField}-${idx}-${path.join('.')}`] = 'edited';
        } else if (SENTENCE_FIELDS.includes(rootField) && dotIdx === -1) {
          // narrative field saved as full text — display key `${fn}-${idx}`, sentence marker s0
          const localKey = `${fieldPart}-${idx}`;
          nLocal[localKey] = value;
          nPending[localKey] = true;
          nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
        } else {
          // plain scalar field or dot-path (e.g. trialsOffered.0.trialName) — key is the field path itself
          const localKey = `${fieldPart}-${idx}`;
          nLocal[localKey] = value;
          nPending[localKey] = true;
          nFields[localKey] = 'edited';
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  const hasVal = useCallback((v) => !isEmptyDeep(v), []);
  const formatDate = useCallback((d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);
  // Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 months"
  const splitBySentence = useCallback((text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); }, []);
  function reconstructFullText(sentences) { if (!sentences || sentences.length === 0) return ''; return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' '); }
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);
  const highlightText = useCallback((text) => { if (!searchTerm.trim() || !text) return text; const phrase = searchTerm.trim(); const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'); const parts = String(text).split(regex); return parts.map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part); }, [searchTerm]);
  const contentMatches = useCallback((text) => { if (!searchTerm.trim()) return true; return String(text || '').toLowerCase().includes(searchTerm.toLowerCase().trim()); }, [searchTerm]);
  const sectionTitleMatches = useCallback((sid) => { if (!searchTerm.trim()) return false; const p = searchTerm.toLowerCase().trim(); const t = (SECTION_TITLES[sid] || '').toLowerCase(); return t.includes(p) || p.includes(t); }, [searchTerm]);

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
        const sv = (typeof val === 'object') ? flattenSearchable(val) : fmtVal(val);
        if (sv.toLowerCase().includes(phrase)) return true;
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
    if (val === null || val === undefined) return false;
    const sv = (typeof val === 'object') ? flattenSearchable(val) : fmtVal(val);
    return sv.toLowerCase().includes(phrase);
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Clinical Trials ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      if (contentMatches(record.assessment) || contentMatches(record.notes) || contentMatches(record.provider) || contentMatches(record.findings) || contentMatches(record.plan) || contentMatches(record.status)) return true;
      if (record.results && typeof record.results === 'object' && contentMatches(flattenSearchable(record.results))) return true;
      if ('eligibility criteria'.includes(phrase) || 'trial name'.includes(phrase)) return true;
      if (record.trialsOffered?.some(t => contentMatches(t.trialName) || contentMatches(t.phase) || t.eligibilityCriteria?.some(c => contentMatches(c)))) return true;
      if (record.recommendations?.some(r => contentMatches(r.recommendation) || (r.date && formatDate(r.date).toLowerCase().includes(phrase)))) return true;
      return false;
    });
  }, [records, searchTerm, contentMatches]);

  const pdfData = useMemo(() => filteredRecords.map((r, idx) => { const m = { ...r }; Object.keys(localEdits).forEach(k => { if (pendingEdits[k]) return; const mt = k.match(/^(.+)-(\d+)$/); if (mt && parseInt(mt[2]) === idx) m[mt[1]] = localEdits[k]; }); return m; }), [filteredRecords, localEdits, pendingEdits]);

  // ========== EDIT ==========
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  const stageDraft = useCallback((record, fieldPart, value) => {
    const id = safeId(record); if (!id) return;
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = value;
    writeDrafts(store);
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: editValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    stageDraft(record, fn, editValue);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  const handleSaveDotPath = useCallback((record, dotPath, idx, valueOverride) => {
    const id = safeId(record); if (!id) return;
    const value = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${dotPath}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    stageDraft(record, dotPath, value);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  // save a nested OBJECT leaf by dot-path (e.g. results.orr) — value stays the typed primitive
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    const dottedField = `${rootField}.${path.join('.')}`;
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
    // Re-edit after approval → drop this section's 'approved' flag so the button goes back to yellow Pending
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    stageDraft(record, dottedField, newVal);
    setEditingField(null); setEditValue('');
  }, [safeId, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || ''); const sentences = splitBySentence(currentVal); const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) { const updated = [...sentences]; updated.splice(sentenceIdx, 1); const fullText = reconstructFullText(updated);
      setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' })); stageDraft(record, fn, fullText); setEditingField(null); setEditValue(''); return; }
    const newSentences = splitBySentence(editedVal); const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences); const fullText = reconstructFullText(updated);
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); const orig = sentences[sentenceIdx] || ''; const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => { const n = { ...prev }; if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; const extra = newSentences.length - 1; for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; return n; });
    stageDraft(record, fn, fullText);
    setEditingField(null); setEditValue('');
  }

  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    // object-leaf edit keys are `${rootField}-${idx}-${path}` — match prefix `${f}-${idx}`
    if (fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`)))) return true;
    if (sid === 'trialsOffered') return Object.keys(editedFields).some(k => k.startsWith('trialsOffered.') && k.endsWith(`-${idx}`));
    return false;
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true);
    const fields = SECTION_FIELDS[sid] || [];
    // Which draft fieldParts belong to this section?
    const belongsToSection = (fieldPart) => {
      const dotIdx = fieldPart.indexOf('.');
      const rootField = dotIdx === -1 ? fieldPart : fieldPart.slice(0, dotIdx);
      if (fields.includes(rootField)) return true;
      if (sid === 'trialsOffered' && fieldPart.startsWith('trialsOffered.')) return true;
      return false;
    };
    // localEdits key used by the save handlers for a given draft fieldPart
    const localKeyFor = (fieldPart) => {
      const dotIdx = fieldPart.indexOf('.');
      const rootField = dotIdx === -1 ? fieldPart : fieldPart.slice(0, dotIdx);
      if (OBJECT_FIELDS.includes(rootField) && dotIdx !== -1) return `${rootField}-${idx}`; // object leaf merges into root object
      return `${fieldPart}-${idx}`;
    };
    try {
      const store = readDrafts();
      const recDrafts = store[id] || {};
      const committed = Object.keys(recDrafts).filter(belongsToSection);
      // Persist each staged field to the DB now. arrayIndex ONLY when trailing dot-segment is purely numeric.
      for (const fieldPart of committed) {
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { value: recDrafts[fieldPart] };
        if (lastDot !== -1 && /^\d+$/.test(trailing)) { payload.field = fieldPart.slice(0, lastDot); payload.arrayIndex = parseInt(trailing, 10); }
        else { payload.field = fieldPart; }
        const resp = await secureApiClient.put(`/api/edit/clinical_trials/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/clinical_trials/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; committed.forEach(fp => delete n[localKeyFor(fp)]); return n; });
      // Drop this section's drafts from localStorage (now committed)
      if (store[id]) { committed.forEach(fp => delete store[id][fp]); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); if (sid === 'trialsOffered' && k.startsWith('trialsOffered.') && k.endsWith(`-${idx}`)) delete n[k]; }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[ClinicalTrials] Approve error:', err); }
    finally { setSaving(false); }
  }, [safeId]);
  const renderApproveButton = useCallback((record, sid, idx) => { const hasEdits = sectionHasEdits(idx, sid); const isApproved = approvedSections[`${sid}-${idx}`]; if (hasEdits) return (<button className="approve-btn pending" disabled={saving} onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>{saving ? 'Approving...' : 'Pending Approve'}</button>); if (isApproved) return <span className="approve-btn approved">Approved</span>; return null; }, [sectionHasEdits, approvedSections, handleApproveSection, saving]);

  // ========== COPY ==========
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  // Object → per-leaf "Label\n----\n1. value" lines (never side-by-side "label: value").
  // Defined BEFORE copyAllText/renderMixedSection — const helpers referenced from a useCallback
  // dependency array are evaluated at render time (TDZ crash if declared later).
  const objectCopyLines = (label, value) => {
    const out = [];
    if (isScalar(value)) { out.push(label, COPY_LINE_DASH, `1. ${fmtScalar(value)}`, ''); return out; }
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectCopyLines(label ? `${label} — ${humanizeKey(k)}` : humanizeKey(k), v)));
    return out;
  };

  // Trials Offered mirror: trial name as the group header + DASH; Phase (when present) and
  // Eligibility Criteria as labeled numbered rows. Never "(undefined)" phase suffixes.
  const emitTrialsCopy = useCallback((trials) => {
    let t = '';
    (trials || []).forEach(tr => {
      t += `${tr.trialName || 'Trial'}\n${COPY_LINE_DASH}\n`;
      if (hasVal(tr.phase)) t += `Phase\n${COPY_LINE_DASH}\n1. ${tr.phase}\n`;
      if (tr.eligibilityCriteria?.length) {
        t += `Eligibility Criteria\n${COPY_LINE_DASH}\n`;
        tr.eligibilityCriteria.forEach((c, i) => { t += `${i + 1}. ${c}\n`; });
      }
      t += '\n';
    });
    return t;
  }, [hasVal]);

  const copyAllText = useCallback(async () => {
    let text = `CLINICAL TRIALS\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Clinical Trials ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      if (r.date) text += `Date\n${COPY_LINE_DASH}\n1. ${formatDate(r.date)}\n\n`;
      if (hasVal(r.eligible) || hasVal(r.enrolled) || hasVal(r.enrolledTrial) || hasVal(r.screeningStatus)) {
        text += `Eligibility & Enrollment\n${COPY_LINE_EQ}\n\n`;
        if (hasVal(r.eligible)) text += `Eligible\n${COPY_LINE_DASH}\n1. ${fmtVal(r.eligible)}\n\n`;
        if (hasVal(r.enrolled)) text += `Enrolled\n${COPY_LINE_DASH}\n1. ${fmtVal(r.enrolled)}\n\n`;
        if (hasVal(r.enrolledTrial)) text += `Enrolled Trial\n${COPY_LINE_DASH}\n1. ${r.enrolledTrial}\n\n`;
        if (hasVal(r.screeningStatus)) text += `Screening Status\n${COPY_LINE_DASH}\n1. ${r.screeningStatus}\n\n`;
      }
      if (hasVal(r.provider) || hasVal(r.facility)) {
        text += `Provider Information\n${COPY_LINE_EQ}\n\n`;
        if (hasVal(r.provider)) text += `Provider\n${COPY_LINE_DASH}\n1. ${r.provider}\n\n`;
        if (hasVal(r.facility)) text += `Facility\n${COPY_LINE_DASH}\n1. ${r.facility}\n\n`;
      }
      if (r.trialsOffered?.length) { text += `Trials Offered\n${COPY_LINE_EQ}\n\n${emitTrialsCopy(r.trialsOffered)}`; }
      if (hasVal(r.findings) || hasVal(r.plan)) {
        text += `Clinical\n${COPY_LINE_EQ}\n\n`;
        if (hasVal(r.findings)) { text += `Findings\n${COPY_LINE_DASH}\n`; splitBySentence(fmtVal(r.findings)).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); text += '\n'; }
        if (hasVal(r.plan)) { text += `Plan\n${COPY_LINE_DASH}\n`; splitBySentence(fmtVal(r.plan)).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); text += '\n'; }
      }
      if (hasVal(r.results)) { text += `Results\n${COPY_LINE_EQ}\n\n`; Object.entries(r.results).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v).forEach(line => { text += `${line}\n`; })); }
      if (hasVal(r.assessment)) { text += `Assessment\n${COPY_LINE_EQ}\n\n`; splitBySentence(fmtVal(r.assessment)).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); text += '\n'; }
      if (r.recommendations?.length) {
        text += `Recommendations\n${COPY_LINE_EQ}\n\n`;
        const grouped = {};
        r.recommendations.filter(rec => rec?.recommendation).forEach(rec => { const d = rec.date ? formatDate(rec.date) : 'No Date'; if (!grouped[d]) grouped[d] = []; grouped[d].push(rec.recommendation); });
        Object.entries(grouped).forEach(([d, items]) => { text += `${d}\n${COPY_LINE_DASH}\n`; items.forEach((x, i) => { text += `${i + 1}. ${x}\n`; }); text += '\n'; });
      }
      if (hasVal(r.notes) || hasVal(r.status)) {
        text += `Notes\n${COPY_LINE_EQ}\n\n`;
        if (hasVal(r.notes)) { splitBySentence(fmtVal(r.notes)).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); text += '\n'; }
        if (hasVal(r.status)) text += `Status\n${COPY_LINE_DASH}\n1. ${fmtVal(r.status)}\n\n`;
      }
      text += '\n';
    });
    const ok = await copyToClipboard(text.trim()); if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, hasVal, fmtVal, formatDate, splitBySentence, emitTrialsCopy]);

  // ========== RENDER ==========
  const renderEditableProperty = (record, dotPath, idx, sid, label, value, title) => {
    const editKey = `${dotPath}-${idx}`; const localVal = localEdits[editKey];
    const effVal = localVal !== undefined ? localVal : value;
    const displayVal = fmtVal(effVal);
    const isEditing = editingField === editKey; const badge = editedFields[editKey];
    if (!hasVal(value) && localVal === undefined) return null;
    if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(sid) && !contentMatches(displayVal) && !contentMatches(label)) return null;
    // Single-name rule: field label == section title → the header already names it.
    const sl = !title || label.toLowerCase() !== title.toLowerCase();
    // Booleans (eligible/enrolled) → Yes/No select saving REAL booleans (never the "Yes" string);
    // fixed-choice status fields → enum dropdown.
    const isBool = typeof effVal === 'boolean';
    const enumOpts = !isBool && ENUM_FIELDS[dotPath] ? enumOptionsWith(ENUM_FIELDS[dotPath], displayVal) : null;
    const startVal = isBool ? (effVal ? 'Yes' : 'No') : enumOpts ? (enumOpts.find(o => o.toLowerCase() === displayVal.toLowerCase()) || displayVal) : displayVal;
    return (<div key={dotPath}>{sl && <div className="nested-subtitle">{highlightText(label)}</div>}<div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(startVal); } }}>{isEditing ? (<div className="edit-field-container">{isBool ? (<select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving}><option value="Yes">Yes</option><option value="No">No</option></select>) : enumOpts ? (<select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving}>{enumOpts.map(o => <option key={o} value={o}>{o}</option>)}</select>) : (<textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />)}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isBool) handleSaveDotPath(record, dotPath, idx, editValue === 'Yes'); else handleSaveDotPath(record, dotPath, idx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}</div>{badge && <span className="modified-badge">edited - click Pending Approve to save</span>}</div>);
  };

  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const sentences = splitBySentence(val); if (sentences.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    return (<div key={fn}>{sl && <div className="nested-subtitle">{highlightText(label)}</div>}<div className="rec-mini-card">{sentences.map((sentence, sIdx) => { const sentenceKey = `${fn}-${idx}-s${sIdx}`; const isEditing = editingField === sentenceKey; const badge = editedSentences[sentenceKey]; const sentenceMatches = phraseMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim())); if (!sentenceMatches && searchTerm.trim()) return null; return (<div key={sIdx}><div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(sentence.replace(/[;.]+$/, '').trim()); } }}>{isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>) : (<><div className="row-content"><span className="content-value">{highlightText(sentence)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button></>)}</div>{badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}</div>); })}</div></div>);
  };

  // ===== OBJECT (dynamic-key, recursive) rendering for `results` =====
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
      <div key={path[path.length - 1]} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(editStartValue); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : (ratio || nu) ? (
                <div className="number-edit-row">
                  <input type="number" step="any" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />
                  {ratio ? <span className="number-edit-unit">{`/ ${ratio.denom}`}</span> : (nu.unit && <span className="number-edit-unit">{nu.unit}</span>)}
                </div>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />
              )}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => {
                  e.stopPropagation();
                  let newVal;
                  if (isBool) { newVal = editValue === 'yes'; }
                  else if (ratio) { const n = parseFloat(editValue); if (isNaN(n)) return; newVal = `${n}/${ratio.denom}`; }
                  else if (nu) { const n = parseFloat(editValue); if (isNaN(n)) return; newVal = nu.unit ? `${n}${nu.sep || ' '}${nu.unit}` : String(n); }
                  else { newVal = editValue.trim(); }
                  saveLeaf(record, rootField, path, idx, sid, leafKey, newVal);
                }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button>
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

  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sid, value);
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([k, v]) => (
          isScalar(v) ? renderObjectLeaf(record, rootField, [...path, k], idx, sid, v)
            : <div className="rec-mini-card" key={k}>{renderObjectNode(record, rootField, idx, sid, humanizeKey(k), v, [...path, k], depth + 1)}</div>
        ))}
      </React.Fragment>
    );
  };

  const renderObjectField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || isScalar(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !record._showAllSections && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([k, v]) => (
          isScalar(v) ? renderObjectLeaf(record, fn, [k], idx, sid, v)
            : <div className="rec-mini-card" key={k}>{renderObjectNode(record, fn, idx, sid, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    );
  };


  const renderMixedSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid]; if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || []; const hasAnyVal = fields.some(f => hasVal(getFieldValue(record, f, idx))); if (!hasAnyVal) return null;
    const copyId = `${sid}-${idx}`;
    return (<div key={sid} className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => { let t = `${title}\n${COPY_LINE_EQ}\n\n`; fields.forEach(f => { const v = getFieldValue(record, f, idx); if (!hasVal(v)) return; const l = FIELD_LABELS[f] || f; const sl = l.toLowerCase() !== title.toLowerCase(); if (OBJECT_FIELDS.includes(f)) { objectCopyLines(sl ? l : '', v).forEach(line => { t += `${line}\n`; }); } else if (SENTENCE_FIELDS.includes(f)) { if (sl) t += `${l}\n${COPY_LINE_DASH}\n`; splitBySentence(fmtVal(v)).forEach((s, i) => { t += `${i + 1}. ${s}\n`; }); t += '\n'; } else { if (sl) t += `${l}\n${COPY_LINE_DASH}\n`; t += `1. ${fmtVal(v)}\n\n`; } }); copySection(t, copyId); }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>{renderApproveButton(record, sid, idx)}</div></div>{fields.map(f => { if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid); if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title); return renderEditableProperty(record, f, idx, sid, FIELD_LABELS[f] || f, getFieldValue(record, f, idx), title); })}</div></div>);
  };

  const renderTrialsOffered = (record, idx) => {
    const trials = record.trialsOffered;
    if (!trials || trials.length === 0) return null;
    const title = 'Trials Offered';
    const stm = sectionTitleMatches('trialsOffered');
    const isSearching = searchTerm.trim().length > 0;
    if (isSearching && !record._showAllSections && !stm) {
      const phrase = searchTerm.toLowerCase().trim();
      const labelMatch = 'eligibility criteria'.includes(phrase) || 'trial name'.includes(phrase) || 'phase'.includes(phrase) || phrase.includes('eligibility') || phrase.includes('criteria');
      if (!labelMatch && !trials.some(t => contentMatches(t.trialName) || contentMatches(t.phase) || t.eligibilityCriteria?.some(c => contentMatches(c)))) return null;
    }
    const copyId = `trialsOffered-${idx}`;
    return (
      <div className="section"><div className="mini-cards-container">
        <div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(`${title}\n${COPY_LINE_EQ}\n\n` + emitTrialsCopy(trials), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>{renderApproveButton(record, 'trialsOffered', idx)}</div></div>
        {trials.map((trial, ai) => {
          const phrase2 = isSearching ? searchTerm.toLowerCase().trim() : '';
          const ecLabelMatch = isSearching && ('eligibility criteria'.includes(phrase2) || phrase2.includes('eligibility') || phrase2.includes('criteria'));
          const tnLabelMatch = isSearching && ('trial name'.includes(phrase2) || 'phase'.includes(phrase2));
          const trialContentMatch = contentMatches(trial.trialName) || contentMatches(trial.phase);
          const ecContentMatch = trial.eligibilityCriteria?.some(c => contentMatches(c));
          if (isSearching && !record._showAllSections && !stm && !ecLabelMatch && !tnLabelMatch && !trialContentMatch && !ecContentMatch) return null;

          const showTrialFields = !isSearching || record._showAllSections || stm || tnLabelMatch || trialContentMatch;
          const showEcSection = !isSearching || record._showAllSections || stm || ecLabelMatch || ecContentMatch;

          {/* Primary field (trialName) renders ONCE as the subtitle — never also as a labeled row (6a4746da). */}
          return (<div key={ai} className="rec-mini-card">
            <div className="nested-subtitle">{highlightText(trial.trialName || `Trial ${ai + 1}`)}</div>
            {showTrialFields && renderEditableProperty(record, `trialsOffered.${ai}.phase`, idx, 'trialsOffered', 'Phase', trial.phase)}
            {showEcSection && trial.eligibilityCriteria?.length > 0 && (<div>
              <div className="nested-subtitle">{highlightText('Eligibility Criteria')}</div>
              {trial.eligibilityCriteria.map((c, ci) => {
                if (isSearching && !record._showAllSections && !stm && !ecLabelMatch && !contentMatches(c)) return null;
                return (<div key={ci} className="numbered-row"><div className="row-content"><span className="content-value">{highlightText(c)}</span></div>
                  <button className={`copy-btn ${copiedItems[`ec-${ai}-${ci}-${idx}`] ? 'copied' : ''}`} onClick={() => copyItem(c, `ec-${ai}-${ci}-${idx}`)}>{copiedItems[`ec-${ai}-${ci}-${idx}`] ? 'Copied!' : 'Copy'}</button>
                </div>);
              })}
            </div>)}
          </div>);
        })}
      </div></div>
    );
  };

  const renderRecommendations = (record, idx) => {
    const recs = Array.isArray(record.recommendations) ? record.recommendations.filter(r => r?.recommendation) : [];
    if (recs.length === 0) return null;
    const title = 'Recommendations';
    const stm = sectionTitleMatches('recommendations');
    const isSearching = searchTerm.trim().length > 0;
    if (isSearching && !record._showAllSections && !stm && !recs.some(r => contentMatches(r.recommendation) || (r.date && contentMatches(formatDate(r.date))))) return null;
    const copyId = `recommendations-${idx}`;

    const grouped = {};
    recs.forEach((rec, ri) => {
      const dateKey = rec.date ? formatDate(rec.date) : 'No Date';
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push({ ...rec, originalIdx: ri });
    });
    const sortedDates = Object.keys(grouped).sort((a, b) => {
      if (a === 'No Date') return 1; if (b === 'No Date') return -1;
      return new Date(b) - new Date(a);
    });

    return (
      <div className="section"><div className="mini-cards-container">
        <div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => { let t = `${title}\n${'='.repeat(40)}\n\n`; sortedDates.forEach(d => { t += `${d}\n`; grouped[d].forEach((r, i) => { t += `${i + 1}. ${r.recommendation}\n`; }); t += '\n'; }); copySection(t, copyId); }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button></div></div>
        {sortedDates.map(dateStr => {
          const items = grouped[dateStr];
          const dateMatches = contentMatches(dateStr);
          const visibleItems = isSearching && !record._showAllSections && !stm && !dateMatches ? items.filter(r => contentMatches(r.recommendation)) : items;
          if (visibleItems.length === 0) return null;
          return (<div key={dateStr} className="rec-mini-card">
            <div className="nested-subtitle">{highlightText(dateStr)}</div>
            {visibleItems.map((rec) => {
              const ri = rec.originalIdx;
              return (<div key={ri} className="numbered-row"><div className="row-content"><span className="content-value">{highlightText(rec.recommendation)}</span></div><button className={`copy-btn ${copiedItems[`rec-${idx}-${ri}`] ? 'copied' : ''}`} onClick={() => copyItem(rec.recommendation, `rec-${idx}-${ri}`)}>{copiedItems[`rec-${idx}-${ri}`] ? 'Copied!' : 'Copy'}</button></div>);
            })}
          </div>);
        })}
      </div></div>
    );
  };

  if (!records || records.length === 0) return (<div className="clinical-trials-document" ref={containerRef}><div className="document-header"><h2 className="document-title">Clinical Trials</h2></div><div className="empty-state">No clinical trials records available</div></div>);

  return (
    <div className="clinical-trials-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Clinical Trials</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ClinicalTrialsDocumentPDFTemplate document={pdfData} />} fileName="Clinical_Trials.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container"><input type="text" className="search-input" placeholder="Search clinical trials..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />{searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}</div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header"><div className="record-meta-row">{record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}</div><h3 className="record-name">{highlightText(`Clinical Trials ${idx + 1}`)}</h3></div>
            {renderMixedSection(record, idx, 'eligibility')}
            {renderMixedSection(record, idx, 'providerInfo')}
            {renderTrialsOffered(record, idx)}
            {renderMixedSection(record, idx, 'clinical')}
            {renderMixedSection(record, idx, 'results')}
            {renderMixedSection(record, idx, 'assessment')}
            {renderRecommendations(record, idx)}
            {renderMixedSection(record, idx, 'notes')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClinicalTrialsDocument;
