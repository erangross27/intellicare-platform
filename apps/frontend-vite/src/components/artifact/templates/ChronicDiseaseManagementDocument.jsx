/**
 * ChronicDiseaseManagementDocument.jsx
 * March 2026 blue glow theme with inline editing.
 * Nested disease objects (display) + flat fields + arrays + sentence-split. Collection: chronic_disease_management
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import ChronicDiseaseManagementDocumentPDFTemplate from '../pdf-templates/ChronicDiseaseManagementDocumentPDFTemplate';
import './ChronicDiseaseManagementDocument.css';

const SECTION_FIELDS = {
  provider: ['provider', 'facility', 'managedBy', 'status'],
  diseases: [],
  heartDisease: ['heartDisease.condition', 'heartDisease.type', 'heartDisease.rhythm', 'heartDisease.strokeRisk', 'heartDisease.bleedingRisk'],
  qualityMetrics: ['qualityMetrics.strokeRiskReduction', 'qualityMetrics.majorBleedingRisk', 'qualityMetrics.intracranialHemorrhageRisk', 'qualityMetrics.netClinicalBenefit'],
  management: ['managementPlans'],
  recommendations: ['recommendations'],
  results: ['results'],
  findings: ['findings'],
  assessment: ['assessment'],
  plan: ['plan'],
  notes: ['notes'],
};
const FIELD_LABELS = {
  provider: 'Provider', facility: 'Facility', managedBy: 'Managed By', status: 'Status',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan', notes: 'Notes', results: 'Results',
  'heartDisease.condition': 'Condition', 'heartDisease.type': 'Type', 'heartDisease.rhythm': 'Rhythm', 'heartDisease.strokeRisk': 'Stroke Risk', 'heartDisease.bleedingRisk': 'Bleeding Risk',
  'qualityMetrics.strokeRiskReduction': 'Stroke Risk Reduction', 'qualityMetrics.majorBleedingRisk': 'Major Bleeding Risk', 'qualityMetrics.intracranialHemorrhageRisk': 'ICH Risk', 'qualityMetrics.netClinicalBenefit': 'Net Clinical Benefit',
};
const ARRAY_FIELDS = ['managementPlans', 'recommendations'];
// Fixed-choice fields → dropdown editor. status = Active / Not Active (an unmatched current value,
// e.g. "Active management with PAP enrollment", is kept as an extra option so it's never lost).
const ENUM_FIELDS = { status: ['Active', 'Not Active'] };
const enumOptionsWith = (opts, current) => { const cur = String(current ?? '').trim(); return cur && !opts.some(o => o.toLowerCase() === cur.toLowerCase()) ? [cur, ...opts] : opts; };

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF/Copy All until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [editKey]: { v: renderValue, p: putPayload, m: { markerKey: state } } } }
   where putPayload is the exact { field, value, arrayIndex? } the Approve handler PUTs to the DB. */
const DRAFT_KEY = 'chronic_disease_managementPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};
const SENTENCE_SPLIT_FIELDS = new Set(['assessment', 'plan', 'findings', 'notes']);
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
const DISEASE_FIELDS = ['diabetes', 'hypertension', 'hyperlipidemia', 'asthma', 'copd', 'arthritis'];
const SECTION_TITLES = { provider: 'PROVIDER', diseases: 'CHRONIC CONDITIONS', heartDisease: 'HEART DISEASE', qualityMetrics: 'QUALITY METRICS', management: 'MANAGEMENT PLANS', recommendations: 'RECOMMENDATIONS', findings: 'FINDINGS', results: 'RESULTS', assessment: 'ASSESSMENT', plan: 'PLAN', notes: 'NOTES' };

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).some(k => hasVal(v[k])); return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const splitNumberUnit = (text) => { if (text === null || text === undefined) return null; const s = String(text).trim(); if (s === '') return null; if (/^-?\d+(?:\.\d+)?\s*\/\s*\d/.test(s)) return null; const m = s.match(/^(-?[\d,]*\.?\d+)(\s*)(.*)$/); if (!m || !/\d/.test(m[1])) return null; return { num: m[1].replace(/,/g, ''), sep: m[2] || '', unit: (m[3] || '').trim() }; };
const splitRatio = (text) => { if (text === null || text === undefined) return null; const m = String(text).trim().match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/); if (!m) return null; return { num: m[1], denom: m[2] }; };
// Sentence split with abbreviation+decimal guard (never breaks "vs."/"Dr."/"3.5"/"i.e.").
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const reconstructFullText = (sentences) => { if (!sentences || sentences.length === 0) return ''; return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' '); };
// Guarded comma split: never inside parentheses; ", and …"/", or …" stays connected; no-space commas kept.
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      if (!/\s/.test(text[i + 1] || '')) { current += ch; continue; }
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest)) { current += ch; continue; }
      if (/\b(and|or)\s*$/i.test(current)) { current += ch; continue; }
      const t = current.trim(); if (t) result.push(t); current = '';
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};
// Sentences → groups: a labeled sentence ("Expected outcomes: a, b, c") becomes its own group (label +
// comma rows); consecutive unlabeled sentences collect into one group, also comma-split. (si, ci) keys.
const parseLabeledSentences = (text) => {
  const groups = []; let nullGroup = null;
  splitBySentence(String(text || '')).forEach((sentence, si) => {
    const colonIdx = sentence.indexOf(':');
    const label = colonIdx > 0 && colonIdx < 60 && !sentence.substring(0, colonIdx).includes('.') ? sentence.substring(0, colonIdx).trim() : null;
    if (label) {
      const parts = splitByComma(sentence.substring(colonIdx + 1).trim());
      groups.push({ label, items: parts.map((p, pi) => ({ text: p.replace(/[.;]+$/, '').trim(), si, ci: pi })) });
      nullGroup = null;
    } else {
      if (!nullGroup) { nullGroup = { label: null, items: [] }; groups.push(nullGroup); }
      splitByComma(sentence).forEach((p, pi) => nullGroup.items.push({ text: p.replace(/[.;]+$/, '').trim(), si, ci: pi }));
    }
  });
  return groups;
};

const ChronicDiseaseManagementDocument = ({ document: rawDoc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Value = the exact
  // PUT payload to send on Approve. Cleared once the record's edits are committed.
  const [pendingEdits, setPendingEdits] = useState({});

  const records = useMemo(() => {
    if (!rawDoc) return [];
    let arr = Array.isArray(rawDoc) ? rawDoc : [rawDoc];
    arr = arr.flatMap(r => {
      if (r?.chronic_disease_management) return Array.isArray(r.chronic_disease_management) ? r.chronic_disease_management : [r.chronic_disease_management];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.chronic_disease_management) return Array.isArray(dd.chronic_disease_management) ? dd.chronic_disease_management : [dd.chronic_disease_management]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = (() => { const id = record && record._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); })();
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([editKey, entry]) => {
        if (!entry) return;
        if (entry.v !== undefined) nLocal[editKey] = entry.v;
        if (entry.p !== undefined) nPending[editKey] = entry.p;
        if (entry.m && typeof entry.m === 'object') {
          Object.entries(entry.m).forEach(([mk, mv]) => { nFields[mk] = mv; });
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; if (fn.includes('.')) { const parts = fn.split('.'); let v = record; for (const p of parts) { v = v?.[p]; } return v; } return record[fn]; }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };
  const getEffectiveArray = useCallback((record, fieldName, idx) => { const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : []; original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined) original[ai] = localEdits[ek]; }); return original; }, [localEdits]);
  const getEffectiveSentences = useCallback((record, fn, idx) => { const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return []; return splitBySentence(String(raw)).map((s, si) => { const sk = `${fn}-${idx}-s${si}`; return localEdits[sk] !== undefined ? localEdits[sk] : s; }); }, [localEdits, getFieldValue]);

  // Stage a DRAFT locally (localEdits + pendingEdits + edited markers) and persist it to the
  // pending-drafts localStorage store keyed by record id. NO DB write — Approve commits later.
  // markers = { [editedFieldsKey]: state } so the yellow "edited" badge survives a refresh.
  const stageDraft = useCallback((record, editKey, renderValue, putPayload, markers, sid, idx) => {
    setLocalEdits(prev => ({ ...prev, [editKey]: renderValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: putPayload }));
    setEditedFields(prev => ({ ...prev, ...markers }));
    // Re-edit after approval → drop the approved flag so the button returns to yellow Pending Approve.
    if (sid !== undefined && idx !== undefined) {
      setApprovedSections(prev => { const sk = `${sid}-${idx}`; if (!prev[sk]) return prev; const n = { ...prev }; delete n[sk]; return n; });
    }
    const rid = getRecordId(record);
    if (rid) {
      const store = readDrafts();
      if (!store[rid]) store[rid] = {};
      store[rid][editKey] = { v: renderValue, p: putPayload, m: markers };
      writeDrafts(store);
    }
    setEditingField(null); setEditValue('');
  }, []);

  const handleSaveField = useCallback((record, fn, idx, sid) => {
    const rid = getRecordId(record); if (!rid) { console.error('[ChronicDiseaseManagement] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}`;
    stageDraft(record, ek, editValue, { field: fn, value: editValue }, { [ek]: 'edited' }, sid, idx);
  }, [editValue, stageDraft]);

  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    const rid = getRecordId(record); if (!rid) { console.error('[ChronicDiseaseManagement] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}-${arrayIndex}`;
    stageDraft(record, ek, editValue, { field: fn, value: editValue, arrayIndex }, { [ek]: 'edited' }, sid, idx);
  }, [editValue, stageDraft]);

  // Save one sentence → splice it into the full field text, then STAGE the whole field as a DRAFT.
  // Computes the same edited/added markers the committing UI relied on; no DB write until Approve.
  const saveSentence = useCallback((record, fn, idx, sid, sentenceIdx) => {
    const rid = getRecordId(record); if (!rid) { console.error('[ChronicDiseaseManagement] Cannot save — no record ID'); return; }
    const raw = getFieldValue(record, fn, idx); const sentences = splitBySentence(String(raw || '')); const originalSentence = sentences[sentenceIdx]; const editedVal = editValue.trim();
    const markers = {};
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) { sentences.splice(sentenceIdx, 1); markers[`${fn}-${idx}`] = 'edited'; }
    else { const newSentences = splitBySentence(editedVal); sentences.splice(sentenceIdx, 1, ...newSentences); if (newSentences.length > 1) { const extraCount = newSentences.length - 1; const originalChanged = newSentences[0].replace(/[;.]+$/, '').trim() !== (originalSentence || '').replace(/[;.]+$/, '').trim(); if (originalChanged) markers[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; for (let ei = 0; ei < extraCount; ei++) { markers[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; } } else { markers[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; } }
    const newValue = reconstructFullText(sentences);
    stageDraft(record, `${fn}-${idx}`, newValue, { field: fn, value: newValue }, markers, sid, idx);
  }, [editValue, getFieldValue, stageDraft]);

  // Save a nested object leaf → STAGE a draft. localEdits holds the merged clone under
  // `${rootField}-${idx}` (for rendering), while pendingEdits is keyed by the LEAF (dotted field)
  // so every distinct leaf of the same root produces its own DB PUT on Approve. No DB write here.
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const rid = getRecordId(record); if (!rid) { console.error('[ChronicDiseaseManagement] Cannot save — no record ID'); return; }
    const dottedField = `${rootField}.${path.join('.')}`;
    const rootKey = `${rootField}-${idx}`;
    // Build the merged clone from the latest staged value (or the original record root).
    const cur = localEdits[rootKey] !== undefined ? localEdits[rootKey] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    node[path[path.length - 1]] = newVal;

    setLocalEdits(prev => ({ ...prev, [rootKey]: clone }));
    setPendingEdits(prev => ({ ...prev, [leafKeyTrack]: { field: dottedField, value: newVal } }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const sk = `${sid}-${idx}`; if (!prev[sk]) return prev; const n = { ...prev }; delete n[sk]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    // Persist BOTH: the render clone (under rootKey) and the leaf PUT (under leafKeyTrack).
    store[rid][rootKey] = { v: clone, p: undefined, m: {} };
    store[rid][leafKeyTrack] = { v: undefined, p: { field: dottedField, value: newVal }, m: { [leafKeyTrack]: 'edited' } };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, localEdits]);

  // Approve = COMMIT all staged drafts for THIS section/record to MongoDB (the ONLY DB-write path),
  // then call /approve, clear pending, drop the committed drafts from localStorage, and mark approved.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    setApproving(true);
    try {
      const rid = getRecordId(record); if (!rid) return;
      const sf = SECTION_FIELDS[sid] || [];
      // pendingEdits keys that belong to this section + record (mirrors the marker-clear scope below).
      const toCommit = Object.keys(pendingEdits).filter(k => sf.some(f => k.startsWith(`${f}-${idx}`)));
      const sc = (await import('../../../services/secureApiClient')).default;
      for (const editKey of toCommit) {
        const payload = pendingEdits[editKey];
        if (!payload || !payload.field) continue;
        await sc.put(`/api/edit/chronic_disease_management/${rid}/edit`, payload);
      }
      await sc.put(`/api/edit/chronic_disease_management/${rid}/approve`, { sectionId: sid, approved: true });

      // Clear committed pending → committed values now flow into pdfData/PDF/Copy All.
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage.
      const store = readDrafts();
      if (store[rid]) { toCommit.forEach(k => delete store[rid][k]); if (Object.keys(store[rid]).length === 0) delete store[rid]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    }
    catch (err) { console.error('[ChronicDiseaseManagement] Approve failed:', err); }
    finally { setApproving(false); }
  }, [pendingEdits]);

  const normalizeForSearch = (text) => { if (!text) return ''; const subMap = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9'}; return String(text).toLowerCase().split('').map(c => subMap[c] || c).join('').replace(/[()[\]<>]/g, ''); };
  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return normalizeForSearch(text).includes(normalizeForSearch(term)); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const sl = normalizeForSearch(searchTerm); const tl = normalizeForSearch(title); if (tl.startsWith(sl) || sl.startsWith(tl)) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return normalizeForSearch(combined).includes(sl); };
  const sectionTitleMatches = (t) => { if (!searchTerm.trim()) return false; const sl = normalizeForSearch(searchTerm); const tl = normalizeForSearch(t); return tl.startsWith(sl) || sl.startsWith(tl); };
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(fmtVal(getFieldValue(record, fn, idx)), searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const sl = normalizeForSearch(searchTerm);
    return records.filter((record, idx) => {
      const title = `Chronic Disease Management ${idx + 1}`;
      const hd = record.heartDisease || {};
      const allText = [title, formatDate(record.date || record.assessmentDate), record.provider, record.facility, record.assessment, record.plan, record.notes, hd.condition, hd.type, hd.rhythm, hd.strokeRisk, hd.bleedingRisk, ...(record.managementPlans || []), ...Object.values(FIELD_LABELS), ...Object.values(SECTION_TITLES), 'Provider Information', 'Heart Disease', 'Chronic Conditions', 'Diabetes', 'Hypertension', 'Quality Metrics', 'Management Plans', 'Assessment', 'Plan', 'Notes', 'Status', 'Control', 'CHA₂DS₂-VASc Contributor', 'CHA2DS2-VASc', 'contributesToCHA2DS2VASc', 'Stroke Risk Reduction', 'Major Bleeding Risk', 'ICH Risk', 'Net Clinical Benefit', 'Condition', 'Type', 'Rhythm', 'Stroke Risk', 'Bleeding Risk', 'Prior MI', 'CHF', 'Medications'].filter(Boolean).join(' ');
      const match = normalizeForSearch(allText).includes(sl);
      record._showAllSections = match && normalizeForSearch(title).startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`))); };
  const renderApproveButton = (record, idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" disabled={approving} onClick={(e) => { e.stopPropagation(); handleApproveSection(record, idx, sid); }}>{approving ? 'Approving...' : 'Pending Approve'}</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  // Fixed-choice field → <select> in edit mode (stored value stays a string → Copy/PDF/backend unchanged).
  const renderEnumField = (record, fn, idx, sid, showLabel = true) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = fmtVal(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    const opts = enumOptionsWith(ENUM_FIELDS[fn], dv);
    const seed = opts.find(o => o.toLowerCase() === dv.toLowerCase()) || dv;
    if (ie) return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving}>{opts.map(o => <option key={o} value={o}>{o}</option>)}</select><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(seed); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderEditableField = (record, fn, idx, sid, showLabel = true, label) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = fmtVal(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`; const displayLabel = label || FIELD_LABELS[fn] || fn;
    if (ie) return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(displayLabel)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(displayLabel)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  // Save one comma-part of one sentence: splice the edited part back (label preserved for labeled
  // sentences), rejoin ', ', rebuild + stage the whole field as a DRAFT (Approve commits it).
  const savePart = useCallback((record, fn, idx, sid, si, ci) => {
    const rid = getRecordId(record); if (!rid) { console.error('[ChronicDiseaseManagement] Cannot save part — no record ID'); return; }
    const sentences = splitBySentence(String(getFieldValue(record, fn, idx) || ''));
    const sentence = sentences[si] || '';
    const colonIdx = sentence.indexOf(':');
    const label = colonIdx > 0 && colonIdx < 60 && !sentence.substring(0, colonIdx).includes('.') ? sentence.substring(0, colonIdx).trim() : null;
    const content = label ? sentence.substring(colonIdx + 1).trim() : sentence;
    const parts = splitByComma(content);
    const trimmed = editValue.trim();
    if (!trimmed || /^[;.,!?]+$/.test(trimmed)) parts.splice(ci, 1); else parts[ci] = trimmed.replace(/[;.]+$/, '');
    if (parts.length) sentences[si] = label ? `${label}: ${parts.join(', ')}` : parts.join(', '); else sentences.splice(si, 1);
    const newValue = reconstructFullText(sentences);
    stageDraft(record, `${fn}-${idx}`, newValue, { field: fn, value: newValue }, { [`${fn}-${idx}-s${si}-c${ci}`]: 'edited' }, sid, idx);
  }, [editValue, getFieldValue, stageDraft]);

  // Long narrative field → sentence split, then guarded comma split. A labeled sentence ("Expected
  // outcomes: a, b, c") renders as a nested-subtitle sub-label GROUP with comma rows (converts the
  // hidden Label:Value into a mini-card); unlabeled sentences collect into comma rows. Each row edits.
  const renderSplitField = (record, fn, idx, sid, showLabel = true) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const groups = parseLabeledSentences(String(raw));
    if (groups.length === 0) return null;
    return (
      <div className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}
        {groups.map((group, gi) => (
          <React.Fragment key={gi}>
            {group.label && <div className="nested-subtitle sub-label">{highlightText(group.label)}</div>}
            {group.items.map(({ text: part, si, ci }) => {
              const sk = `${fn}-${idx}-s${si}-c${ci}`; const ie = editingField === sk; const ed = editedFields[sk]; const cid = `sent-${fn}-${idx}-${si}-${ci}`;
              if (ie) return (<div key={sk} className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) savePart(record, fn, idx, sid, si, ci); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => savePart(record, fn, idx, sid, si, ci)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>);
              return (<React.Fragment key={sk}><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(sk); setEditValue(part); }}><div className="row-content"><span className="content-value">{highlightText(part)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(part, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>);
            })}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const renderEditableArrayItem = (record, fn, idx, sid, item, ai) => {
    const ek = `${fn}-${idx}-${ai}`; const val = localEdits[ek] !== undefined ? localEdits[ek] : String(item || '');
    const ie = editingField === ek; const ed = editedFields[ek]; const cid = `arr-${fn}-${idx}-${ai}`;
    if (ie) return (<React.Fragment key={ai}><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, fn, idx, sid, ai); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveArrayItem(record, fn, idx, sid, ai)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></React.Fragment>);
    return (<React.Fragment key={ai}><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(val); }}><div className="row-content"><span className="content-value">{highlightText(val)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(val, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>);
  };

  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const ie = editingField === leafKey;
    const ed = editedFields[leafKey];
    const cid = `leaf-${leafKey}`;
    const isBool = typeof value === 'boolean';
    const ratio = isBool ? null : splitRatio(leafValueString);
    const nu = (isBool || ratio) ? null : splitNumberUnit(leafValueString);
    const editStartValue = isBool ? (value ? 'yes' : 'no') : ratio ? ratio.num : nu ? nu.num : leafValueString;
    const leafLabel = humanizeKey(path[path.length - 1]);
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(leafLabel)}</div>
        <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { if (!ie) { setEditingField(leafKey); setEditValue(editStartValue); } }}>
          {ie ? (
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
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus rows={1} disabled={saving} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />
              )}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => {
                  e.stopPropagation();
                  let newVal;
                  if (isBool) newVal = editValue === 'yes';
                  else if (ratio) { const n = parseFloat(editValue); if (isNaN(n)) return; newVal = `${n}/${ratio.denom}`; }
                  else if (nu) { const n = parseFloat(editValue); if (isNaN(n)) return; newVal = nu.unit ? `${n}${nu.sep || ' '}${nu.unit}` : String(n); }
                  else newVal = editValue.trim();
                  saveLeaf(record, rootField, path, idx, sid, leafKey, newVal);
                }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span>{!ed && <span className="edit-indicator">✎</span>}</div>
              <button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={e => { e.stopPropagation(); copyToClipboard(`${leafLabel}\n${leafValueString}`, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button>
            </>
          )}
        </div>
        {ed && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

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

  const renderResultsSection = (record, idx) => {
    const fn = 'results';
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val)) return null;
    // MIXED: scalar -> simple editable; object -> recursive tree
    if (isScalar(val)) {
      if (!shouldShowSection(record, 'Results', [fmtVal(val)], [fn])) return null;
      return renderSection(record, idx, 'results', 'Results', renderEditableField(record, 'results', idx, 'results', false));
    }
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    const flatContent = entries.flatMap(([k, v]) => [humanizeKey(k), fmtVal(isScalar(v) ? v : JSON.stringify(v))]);
    if (!shouldShowSection(record, 'Results', flatContent, [fn])) return null;
    return renderSection(record, idx, 'results', 'Results', (
      <div className="rec-mini-card">
        {entries.map(([k, v]) => (
          isScalar(v) ? renderObjectLeaf(record, fn, [k], idx, 'results', v)
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fn, idx, 'results', humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    ));
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    // A localEdits key is "pending" if it (or, for object-leaf clones, any leaf draft under it) has
    // not yet been approved. Pending drafts must stay OUT of the PDF/Copy All until Approve commits.
    const isKeyPending = (key) => pendingEdits[key] !== undefined || Object.keys(pendingEdits).some(pk => pk.startsWith(`${key}-`));
    return records.map((record, idx) => {
      const m = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (isKeyPending(key)) return; // pending draft → not committed, skip
        const ld = key.lastIndexOf('-'); if (ld === -1) return;
        const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10);
        if (ri === idx) { if (fn.includes('.')) { const [obj, prop] = fn.split('.'); m[obj] = { ...m[obj], [prop]: localEdits[key] }; } else if (fn in record) { m[fn] = localEdits[key]; } }
      });
      // Array fields: include only committed (non-pending) element edits.
      ARRAY_FIELDS.forEach(field => {
        const original = Array.isArray(record[field]) ? [...record[field]] : [];
        original.forEach((_, ai) => { const ek = `${field}-${idx}-${ai}`; if (localEdits[ek] !== undefined && pendingEdits[ek] === undefined) original[ai] = localEdits[ek]; });
        m[field] = original;
      });
      return m;
    });
  }, [records, localEdits, pendingEdits]);

  // SECTION_TITLES moved to module scope

  // Narrative field → grouped lines: labeled group = label + DASH (numbering restarts); unlabeled group
  // continues the running count. Field sub-label emitted first (unless == section title).
  const emitBlock = (fn, rawValue, sectionTitle) => {
    const groups = parseLabeledSentences(String(rawValue ?? ''));
    if (groups.length === 0) return '';
    let out = '';
    if ((FIELD_LABELS[fn] || fn).toLowerCase() !== String(sectionTitle).toLowerCase()) out += `${FIELD_LABELS[fn] || fn}\n${COPY_LINE_DASH}\n`;
    let n = 0;
    groups.forEach(g => { if (g.label) { n = 0; out += `${g.label}\n${COPY_LINE_DASH}\n`; } g.items.forEach(it => { if (it.text) out += `${++n}. ${it.text}\n`; }); });
    return out + '\n';
  };
  // Array → numbered rows (each item whole — these are narrative instruction items).
  const emitArr = (items) => { let out = ''; let n = 0; (items || []).forEach(it => { const t = String(it).replace(/[.;]+$/, '').trim(); if (t) out += `${++n}. ${t}\n`; }); return out; };
  // One disease object → disease name + DASH, then each prop (sub-label + DASH + numbered value/rows).
  const emitDisease = (name, obj) => {
    let out = `${name}\n${COPY_LINE_DASH}\n`;
    const DISEASE_PROP_LABELS = { status: 'Status', control: 'Control', contributesToCHA2DS2VASc: 'CHA2DS2-VASc Contributor' };
    Object.entries(obj || {}).forEach(([k, v]) => {
      if (!hasVal(v)) return;
      const lbl = DISEASE_PROP_LABELS[k] || humanizeKey(k);
      out += `${lbl}\n${COPY_LINE_DASH}\n`;
      if (Array.isArray(v)) out += emitArr(v); else out += `1. ${fmtVal(v)}\n`;
      out += '\n';
    });
    return out;
  };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record;
    const title = SECTION_TITLES[sid] || sid.toUpperCase();
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    const showLbl = (fn) => (FIELD_LABELS[fn] || fn).toLowerCase() !== title.toLowerCase();
    const addF = (fn) => { const v = fn.includes('.') ? fn.split('.').reduce((o, p) => o?.[p], pr) : pr[fn]; if (!hasVal(v)) return; if (showLbl(fn)) text += `${FIELD_LABELS[fn] || fn}\n${COPY_LINE_DASH}\n`; text += `1. ${fmtVal(v)}\n\n`; };
    if (sid === 'management') { text += emitArr(getEffectiveArray(pr, 'managementPlans', idx)); }
    else if (sid === 'recommendations') { text += emitArr(getEffectiveArray(pr, 'recommendations', idx)); }
    else if (sid === 'diseases') { DISEASE_FIELDS.forEach(d => { if (pr[d] && hasVal(pr[d])) text += emitDisease(d.charAt(0).toUpperCase() + d.slice(1), pr[d]); }); }
    else if (sid === 'heartDisease') { ['heartDisease.condition', 'heartDisease.type', 'heartDisease.rhythm', 'heartDisease.strokeRisk', 'heartDisease.bleedingRisk'].forEach(addF); const meds = pr.heartDisease?.medications; if (Array.isArray(meds) && meds.length) { text += `Medications\n${COPY_LINE_DASH}\n${emitArr(meds)}\n`; } }
    else if (sid === 'qualityMetrics') { SECTION_FIELDS.qualityMetrics.forEach(addF); }
    else { (SECTION_FIELDS[sid] || []).forEach(fn => { if (SENTENCE_SPLIT_FIELDS.has(fn)) { if (hasVal(pr[fn])) text += emitBlock(fn, pr[fn], title); } else addF(fn); }); }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = `CHRONIC DISEASE MANAGEMENT\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Chronic Disease Management ${idx + 1}\n${COPY_LINE_EQ}\n`;
      if (r.date || r.assessmentDate) text += `${formatDate(r.date || r.assessmentDate)}\n`;
      const emitSimple = (title, fields) => { const vis = fields.filter(f => { const v = f.includes('.') ? f.split('.').reduce((o, p) => o?.[p], r) : r[f]; return hasVal(v); }); if (!vis.length) return; text += `\n${title}\n${COPY_LINE_EQ}\n`; vis.forEach(fn => { if (SENTENCE_SPLIT_FIELDS.has(fn)) { text += emitBlock(fn, r[fn], title); } else { const v = fn.includes('.') ? fn.split('.').reduce((o, p) => o?.[p], r) : r[fn]; const showLbl = (FIELD_LABELS[fn] || fn).toLowerCase() !== title.toLowerCase(); if (showLbl) text += `${FIELD_LABELS[fn] || fn}\n${COPY_LINE_DASH}\n`; text += `1. ${fmtVal(v)}\n\n`; } }); };
      const addArr = (title, fn) => { const items = Array.isArray(r[fn]) ? r[fn] : []; if (items.length) { text += `\n${title}\n${COPY_LINE_EQ}\n`; text += emitArr(items); } };
      emitSimple('PROVIDER', ['provider', 'facility', 'managedBy', 'status']);
      if (DISEASE_FIELDS.some(d => r[d] && hasVal(r[d]))) { text += `\nCHRONIC CONDITIONS\n${COPY_LINE_EQ}\n`; DISEASE_FIELDS.forEach(d => { if (r[d] && hasVal(r[d])) text += emitDisease(d.charAt(0).toUpperCase() + d.slice(1), r[d]); }); }
      if (r.heartDisease && hasVal(r.heartDisease)) { text += `\nHEART DISEASE\n${COPY_LINE_EQ}\n`; ['condition', 'type', 'rhythm', 'strokeRisk', 'bleedingRisk'].forEach(k => { if (hasVal(r.heartDisease[k])) text += `${FIELD_LABELS['heartDisease.' + k] || k}\n${COPY_LINE_DASH}\n1. ${fmtVal(r.heartDisease[k])}\n\n`; }); if (Array.isArray(r.heartDisease.medications) && r.heartDisease.medications.length) { text += `Medications\n${COPY_LINE_DASH}\n${emitArr(r.heartDisease.medications)}\n`; } }
      if (r.qualityMetrics && hasVal(r.qualityMetrics)) { text += `\nQUALITY METRICS\n${COPY_LINE_EQ}\n`; Object.entries(r.qualityMetrics).forEach(([k, v]) => { if (hasVal(v)) text += `${FIELD_LABELS['qualityMetrics.' + k] || humanizeKey(k)}\n${COPY_LINE_DASH}\n1. ${fmtVal(v)}\n\n`; }); }
      addArr('MANAGEMENT PLANS', 'managementPlans');
      addArr('RECOMMENDATIONS', 'recommendations');
      emitSimple('FINDINGS', ['findings']);
      emitSimple('ASSESSMENT', ['assessment']);
      emitSimple('PLAN', ['plan']);
      emitSimple('NOTES', ['notes']);
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(record, idx, sid)}</div></div>{children}</div></div>); };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => hasVal(getFieldValue(record, f, idx)));
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => fmtVal(getFieldValue(record, f, idx))), visibleFields)) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{visibleFields.map(f => { if (!sa && !fieldMatches(record, f, idx)) return null; const sl = (FIELD_LABELS[f] || f).toLowerCase() !== title.toLowerCase(); if (ENUM_FIELDS[f]) return <React.Fragment key={f}>{renderEnumField(record, f, idx, sid, sl)}</React.Fragment>; if (SENTENCE_SPLIT_FIELDS.has(f)) return <React.Fragment key={f}>{renderSplitField(record, f, idx, sid, sl)}</React.Fragment>; return <React.Fragment key={f}>{renderEditableField(record, f, idx, sid, sl)}</React.Fragment>; })}</>; })());
  };

  const renderArraySection = (record, idx, sid, title, fieldName) => {
    const items = Array.isArray(record[fieldName]) ? record[fieldName].filter(Boolean) : [];
    if (items.length === 0) return null;
    if (!shouldShowSection(record, title, items, [fieldName])) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; const visibleItems = items.map((item, ai) => { const val = localEdits[`${fieldName}-${idx}-${ai}`] !== undefined ? localEdits[`${fieldName}-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, fieldName, idx, sid, item, ai); }).filter(Boolean); return visibleItems.length > 0 ? <div className="rec-mini-card">{visibleItems}</div> : null; })());
  };

  const renderDiseaseSection = (record, idx) => {
    const activeDiseases = DISEASE_FIELDS.filter(d => record[d] && hasVal(record[d]));
    if (activeDiseases.length === 0) return null;
    const DISEASE_PROP_LABELS = { status: 'Status', control: 'Control', contributesToCHA2DS2VASc: 'CHA₂DS₂-VASc Contributor' };
    const diseaseContent = activeDiseases.flatMap(d => [d, ...Object.entries(record[d]).filter(([, v]) => hasVal(v)).flatMap(([k, v]) => [DISEASE_PROP_LABELS[k] || k, fmtVal(v)])]);
    if (!shouldShowSection(record, 'Chronic Conditions', diseaseContent, [])) return null;
    const stm = sectionTitleMatches('Chronic Conditions');
    const sa = !searchTerm.trim() || record._showAllSections || stm;
    return renderSection(record, idx, 'diseases', 'Chronic Conditions', (<>
      {activeDiseases.map(d => {
        const disease = record[d];
        const entries = Object.entries(disease).filter(([, v]) => hasVal(v));
        if (entries.length === 0) return null;
        const diseaseLabel = d.charAt(0).toUpperCase() + d.slice(1);
        const diseaseMatchesSearch = sa || phraseMatch(diseaseLabel, searchTerm) || entries.some(([k, v]) => phraseMatch(DISEASE_PROP_LABELS[k] || k, searchTerm) || phraseMatch(fmtVal(v), searchTerm));
        if (!diseaseMatchesSearch) return null;
        return (<div key={d} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(diseaseLabel)}</div>
          {entries.map(([k, v]) => {
            const propLabel = DISEASE_PROP_LABELS[k] || humanizeKey(k);
            const propMatches = sa || phraseMatch(diseaseLabel, searchTerm) || phraseMatch(propLabel, searchTerm) || phraseMatch(fmtVal(v), searchTerm) || (Array.isArray(v) && v.some(it => phraseMatch(String(it), searchTerm)));
            if (!propMatches) return null;
            // Array prop (e.g. medications) → sub-label + one numbered row per item (never a comma blob).
            if (Array.isArray(v)) {
              return (
                <div className="nested-mini-card" key={k}>
                  <div className="nested-subtitle sub-label">{highlightText(propLabel)}</div>
                  {v.filter(Boolean).map((it, ii) => (
                    <div key={ii} className="numbered-row"><div className="row-content"><span className="content-value">{highlightText(String(it))}</span></div><button className={`copy-btn${copiedId === `dis-${d}-${k}-${ii}-${idx}` ? ' copied' : ''}`} onClick={() => copyToClipboard(String(it), `dis-${d}-${k}-${ii}-${idx}`)}>{copiedId === `dis-${d}-${k}-${ii}-${idx}` ? 'Copied' : 'Copy'}</button></div>
                  ))}
                </div>
              );
            }
            return (
              <div className="nested-mini-card" key={k}>
                <div className="nested-subtitle sub-label">{highlightText(propLabel)}</div>
                <div className="numbered-row"><div className="row-content"><span className="content-value">{highlightText(fmtVal(v))}</span></div><button className={`copy-btn${copiedId === `dis-${d}-${k}-${idx}` ? ' copied' : ''}`} onClick={() => copyToClipboard(fmtVal(v), `dis-${d}-${k}-${idx}`)}>{copiedId === `dis-${d}-${k}-${idx}` ? 'Copied' : 'Copy'}</button></div>
              </div>
            );
          })}
        </div>);
      })}
    </>));
  };

  const renderHeartDiseaseSection = (record, idx) => {
    const hd = record.heartDisease;
    if (!hd || !hasVal(hd)) return null;
    if (!shouldShowSection(record, 'Heart Disease', [hd.condition, hd.type, hd.rhythm, hd.strokeRisk, hd.bleedingRisk, ...(hd.medications || [])].filter(Boolean), SECTION_FIELDS.heartDisease)) return null;
    return renderSection(record, idx, 'heartDisease', 'Heart Disease', (<>
      {renderEditableField(record, 'heartDisease.condition', idx, 'heartDisease', true, 'Condition')}
      {renderEditableField(record, 'heartDisease.type', idx, 'heartDisease', true, 'Type')}
      {renderEditableField(record, 'heartDisease.rhythm', idx, 'heartDisease', true, 'Rhythm')}
      {renderEditableField(record, 'heartDisease.strokeRisk', idx, 'heartDisease', true, 'Stroke Risk')}
      {renderEditableField(record, 'heartDisease.bleedingRisk', idx, 'heartDisease', true, 'Bleeding Risk')}
      {Array.isArray(hd.medications) && hd.medications.length > 0 && (
        <div className="rec-mini-card">
          <div className="nested-subtitle">{highlightText('Medications')}</div>
          {hd.medications.map((med, mi) => (
            <div key={mi} className="numbered-row"><div className="row-content"><span className="content-value">{highlightText(med)}</span></div><button className={`copy-btn${copiedId === `hd-med-${idx}-${mi}` ? ' copied' : ''}`} onClick={() => copyToClipboard(med, `hd-med-${idx}-${mi}`)}>{copiedId === `hd-med-${idx}-${mi}` ? 'Copied' : 'Copy'}</button></div>
          ))}
        </div>
      )}
      {hasVal(hd.priorMI) && <div className="rec-mini-card"><div className="nested-subtitle">{highlightText('Prior MI')}</div><div className="numbered-row"><div className="row-content"><span className="content-value">{highlightText(fmtVal(hd.priorMI))}</span></div></div></div>}
      {hasVal(hd.CHF) && <div className="rec-mini-card"><div className="nested-subtitle">{highlightText('CHF')}</div><div className="numbered-row"><div className="row-content"><span className="content-value">{highlightText(fmtVal(hd.CHF))}</span></div></div></div>}
    </>));
  };

  const renderQualityMetricsSection = (record, idx) => {
    const qm = record.qualityMetrics;
    if (!qm || !hasVal(qm)) return null;
    if (!shouldShowSection(record, 'Quality Metrics', Object.values(qm).filter(Boolean).map(fmtVal), SECTION_FIELDS.qualityMetrics)) return null;
    return renderSection(record, idx, 'qualityMetrics', 'Quality Metrics', (<>
      {renderEditableField(record, 'qualityMetrics.strokeRiskReduction', idx, 'qualityMetrics', true, 'Stroke Risk Reduction')}
      {renderEditableField(record, 'qualityMetrics.majorBleedingRisk', idx, 'qualityMetrics', true, 'Major Bleeding Risk')}
      {renderEditableField(record, 'qualityMetrics.intracranialHemorrhageRisk', idx, 'qualityMetrics', true, 'ICH Risk')}
      {renderEditableField(record, 'qualityMetrics.netClinicalBenefit', idx, 'qualityMetrics', true, 'Net Clinical Benefit')}
    </>));
  };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="chronic-disease-management-document"><header className="document-header"><h1 className="document-title">Chronic Disease Management</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="chronic-disease-management-document">
      <header className="document-header">
        <h1 className="document-title">Chronic Disease Management</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<ChronicDiseaseManagementDocumentPDFTemplate document={pdfData} />} fileName="Chronic_Disease_Management.pdf">
            {({ loading }) => <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>}
          </PDFDownloadLink>
        </div>
      </header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">
                {(record.date || record.assessmentDate) && <span className="record-date">{highlightText(formatDate(record.date || record.assessmentDate))}</span>}
              </div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Chronic Disease Management ${idx + 1}`)}</h3></div>
            </div>
            {renderMultiFieldSection(record, idx, 'provider', 'Provider Information', SECTION_FIELDS.provider)}
            {renderDiseaseSection(record, idx)}
            {renderHeartDiseaseSection(record, idx)}
            {renderQualityMetricsSection(record, idx)}
            {renderArraySection(record, idx, 'management', 'Management Plans', 'managementPlans')}
            {renderArraySection(record, idx, 'recommendations', 'Recommendations', 'recommendations')}
            {renderResultsSection(record, idx)}
            {renderMultiFieldSection(record, idx, 'findings', 'Findings', ['findings'])}
            {renderMultiFieldSection(record, idx, 'assessment', 'Assessment', ['assessment'])}
            {renderMultiFieldSection(record, idx, 'plan', 'Plan', ['plan'])}
            {renderMultiFieldSection(record, idx, 'notes', 'Notes', ['notes'])}
          </div>
        ))}
      </div>
    </article>
  );
};

export default ChronicDiseaseManagementDocument;
