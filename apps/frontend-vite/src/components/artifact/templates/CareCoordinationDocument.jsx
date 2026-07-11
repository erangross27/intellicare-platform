/**
 * CareCoordinationDocument.jsx
 * March 2026 blue glow theme with inline editing.
 * FULL TEMPLATE STANDARD — collection: care_coordination
 *  - NUMBER:  readmissionRiskScore (number input, parseFloat, hide-zero)
 *  - OBJECT:  homeHealthServices, caregiverInformation, advanceDirectives, socialDeterminants
 *             (recursive renderObjectField / renderObjectNode / renderObjectLeaf, humanizeKey, hide-empty)
 *  - ARRAY:   primaryDiagnoses, activeMedications, dischargeMedications, followUpAppointments,
 *             pendingTests, medicalEquipmentNeeds, patientEducationProvided
 *  - DATE:    referralDate (header date-picker, renderDateField)
 *  - SENTENCE: referralReason, functionalStatus, cognitiveStatus, culturalConsiderations
 *             (splitBySentence + SENTENCE_FIELDS + renderSentenceEditableField + reconstructFullText + saveSentence)
 *  - SHORT STRING: referralSource, referralDestination, transitionType, careCoordinator,
 *             mobilityLevel, fallRiskAssessment, insuranceAuthorization, languageBarriers
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import CareCoordinationPDFTemplate from '../pdf-templates/CareCoordinationTemplate';
import './CareCoordinationDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } } where fieldPart is the editKey WITHOUT its
   trailing "-<idx>" record-index suffix (i.e. "field", "field.arrayIndex", or "field.dotted.path"). */
const DRAFT_KEY = 'care_coordinationPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ═══════ FIELD TYPING ═══════ */
const NUMBER_FIELDS = ['readmissionRiskScore'];
const DATE_FIELDS = ['referralDate'];
const OBJECT_FIELDS = ['homeHealthServices', 'caregiverInformation', 'advanceDirectives', 'socialDeterminants'];
const ARRAY_FIELDS = ['primaryDiagnoses', 'activeMedications', 'dischargeMedications', 'followUpAppointments', 'pendingTests', 'medicalEquipmentNeeds', 'patientEducationProvided'];
const SENTENCE_FIELDS = ['referralReason', 'functionalStatus', 'cognitiveStatus', 'culturalConsiderations'];
// Comma-list string fields → split by comma (parenthesis-aware) into one editable row per item.
const COMMA_SPLIT_FIELDS = new Set(['referralDestination']);

const SECTION_FIELDS = {
  referral: ['referralDate', 'referralSource', 'referralDestination', 'referralReason', 'transitionType', 'careCoordinator'],
  diagnoses: ['primaryDiagnoses'],
  medications: ['activeMedications', 'dischargeMedications'],
  functional: ['functionalStatus', 'cognitiveStatus', 'mobilityLevel', 'fallRiskAssessment'],
  followUp: ['followUpAppointments'],
  pending: ['pendingTests'],
  equipment: ['medicalEquipmentNeeds'],
  education: ['patientEducationProvided'],
  homeHealth: ['homeHealthServices'],
  caregiver: ['caregiverInformation'],
  directives: ['advanceDirectives'],
  social: ['socialDeterminants'],
  admin: ['insuranceAuthorization', 'readmissionRiskScore', 'languageBarriers', 'culturalConsiderations'],
};

const SECTION_TITLES = {
  referral: 'REFERRAL INFORMATION', diagnoses: 'PRIMARY DIAGNOSES', medications: 'MEDICATIONS',
  functional: 'FUNCTIONAL STATUS', followUp: 'FOLLOW-UP APPOINTMENTS', pending: 'PENDING TESTS',
  equipment: 'MEDICAL EQUIPMENT', education: 'PATIENT EDUCATION', homeHealth: 'HOME HEALTH SERVICES',
  caregiver: 'CAREGIVER INFORMATION', directives: 'ADVANCE DIRECTIVES', social: 'SOCIAL DETERMINANTS',
  admin: 'ADMINISTRATIVE',
};

const FIELD_LABELS = {
  referralSource: 'Referral Source', referralDestination: 'Referral Destination',
  referralReason: 'Referral Reason', transitionType: 'Transition Type', careCoordinator: 'Care Coordinator',
  primaryDiagnoses: 'Primary Diagnoses', activeMedications: 'Active Medications', dischargeMedications: 'Discharge Medications',
  followUpAppointments: 'Follow-Up Appointments', pendingTests: 'Pending Tests',
  medicalEquipmentNeeds: 'Medical Equipment Needs', patientEducationProvided: 'Patient Education Provided',
  functionalStatus: 'Functional Status', cognitiveStatus: 'Cognitive Status',
  mobilityLevel: 'Mobility Level', fallRiskAssessment: 'Fall Risk Assessment',
  homeHealthServices: 'Home Health Services', caregiverInformation: 'Caregiver Information',
  advanceDirectives: 'Advance Directives', socialDeterminants: 'Social Determinants',
  insuranceAuthorization: 'Insurance Authorization', readmissionRiskScore: 'Readmission Risk Score',
  languageBarriers: 'Language Barriers', culturalConsiderations: 'Cultural Considerations',
  referralDate: 'Referral Date',
};

/* ═══════ VALUE HELPERS ═══════ */
const isScalar = (v) => v === null || typeof v !== 'object';
const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0;
  if (typeof v === 'object') return Object.values(v).some(hasVal);
  return true;
};
const isEmptyDeep = (v) => !hasVal(v);
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const fmtScalar = fmtVal;
const humanizeKey = (key) => {
  if (!key) return '';
  if (key === key.toUpperCase() && key.length <= 6) return key; // acronyms: POA, POLST, MOLST
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
};
const splitBySentence = (text) => { if (!text) return []; return String(text).split(/(?<=[.;])\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };
/* split on top-level commas; NOT inside parentheses and NOT a comma immediately followed by "and" */
const splitByComma = (text) => {
  const s = String(text || ''); const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; continue; }
    if (ch === ',' && depth === 0) {
      const rest = s.slice(i + 1).replace(/^\s+/, '');
      if (/^and\b/i.test(rest)) { cur += ch; continue; } // keep "..., and X" together
      const t = cur.trim(); if (t) out.push(t); cur = ''; continue;
    }
    cur += ch;
  }
  const t = cur.trim(); if (t) out.push(t);
  return out.length ? out : (s.trim() ? [s.trim()] : []);
};
/* narrative fields → split by sentence, then by (paren/and-aware) comma */
const splitItems = (text) => splitBySentence(text).flatMap(s => splitByComma(s));
function reconstructFullText(sentences) { return sentences.map((s, i) => { const t = s.trim().replace(/[.;]+$/, ''); return i < sentences.length - 1 ? t + '.' : t; }).join(' '); }
const parseLabel = (text) => { const m = String(text || '').match(/^([A-Z][A-Za-z0-9\s/&(),-]+?):\s*(.*)/); return m ? { label: m[1], content: m[2] } : null; };
/* Copy-text divider lines: '=' under section titles, '-' under nested subtitles (field labels / object keys). */
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

const CareCoordinationDocument = ({ document: rawDoc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});

  const records = useMemo(() => {
    if (!rawDoc) return [];
    let arr = Array.isArray(rawDoc) ? rawDoc : [rawDoc];
    arr = arr.flatMap(r => {
      if (r?.care_coordination) return Array.isArray(r.care_coordination) ? r.care_coordination : [r.care_coordination];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.care_coordination) return Array.isArray(dd.care_coordination) ? dd.care_coordination : [dd.care_coordination]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  // Draft store is keyed by record _id; each index-free entry { fieldPart, kind, value, markerState }
  // is rebuilt against the current render idx, matching exactly what the save handlers set.
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idForRecord = (r) => { const id = r && r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = idForRecord(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.values(recDrafts).forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const { fieldPart, kind, value, markerState, leafPath } = entry;
        if (!fieldPart) return;
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // marker key mirrors each save handler's editedFields write
        if (kind === 'sentence') nFields[`${fieldPart}-${idx}-s0`] = markerState || 'edited';
        else if (kind === 'object' && leafPath) nFields[`${fieldPart}-${idx}-${leafPath}`] = markerState || 'edited';
        else nFields[editKey] = markerState || 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  const toInputDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return ''; return dt.toISOString().slice(0, 10); } catch { return ''; } };
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };
  const getEffectiveArray = useCallback((record, fieldName, idx) => { const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : []; original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined) original[ai] = localEdits[ek]; }); return original; }, [localEdits]);

  /* ═══════ SAVE: simple field — STAGE a local draft only (NO DB write). Approve commits. ═══════ */
  const handleSaveField = useCallback((record, fn, idx, sid, valueOverride) => {
    setSaveError(null);
    const rid = getRecordId(record); if (!rid) { setSaveError('No record ID'); return; }
    const val = valueOverride !== undefined ? valueOverride : editValue;
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: val }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.endsWith(`-${idx}`)) delete n[k]; }); return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = { fieldPart: fn, kind: 'field', value: val, markerState: 'edited', db: { field: fn, value: val } };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  /* ═══════ SAVE: array item — STAGE a local draft only (NO DB write). Approve commits. ═══════ */
  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    setSaveError(null);
    const rid = getRecordId(record); if (!rid) { setSaveError('No record ID'); return; }
    // editKey keeps the file's `${fn}-${idx}-${arrayIndex}` form → fieldPart = `${fn}-${arrayIndex}`
    const fieldPart = `${fn}-${arrayIndex}`;
    const ek = `${fn}-${idx}-${arrayIndex}`;
    setLocalEdits(prev => ({ ...prev, [ek]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.endsWith(`-${idx}`)) delete n[k]; }); return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][`${fn}.${arrayIndex}`] = { fieldPart, kind: 'array', value: editValue, markerState: 'edited', db: { field: fn, value: editValue, arrayIndex } };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  /* ═══════ SAVE: object leaf (dotted path) — STAGE a local draft only (NO DB write). Approve commits. ═══════ */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    setSaveError(null);
    const rid = getRecordId(record); if (!rid) { setSaveError('No record ID'); return; }
    const dottedField = `${rootField}.${path.join('.')}`;
    const leafPath = path.join('.');
    const ek = `${rootField}-${idx}`;
    // Build the cumulative clone from the latest staged value (or original record) — same as before.
    const cur = localEdits[ek] !== undefined ? localEdits[ek] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    node[path[path.length - 1]] = newVal;
    setLocalEdits(prev => ({ ...prev, [ek]: clone }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    // One draft entry per leaf (so every leaf marker rehydrates); each carries the cumulative clone
    // as `value` (rebuilds localEdits[ek]) and its OWN dotted DB payload for Approve.
    store[rid][dottedField] = { fieldPart: rootField, kind: 'object', value: clone, markerState: 'edited', leafPath, db: { field: dottedField, value: newVal } };
    // refresh the clone snapshot on any sibling-leaf entries so they all rebuild the latest clone
    Object.keys(store[rid]).forEach(k => { if (store[rid][k] && store[rid][k].kind === 'object' && store[rid][k].fieldPart === rootField) store[rid][k].value = clone; });
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [localEdits]);

  /* ═══════ SAVE: sentence — STAGE a local draft only (NO DB write). Approve commits. ═══════ */
  const saveSentence = useCallback((record, fn, idx, sid, sentenceIdx, valueOverride) => {
    setSaveError(null);
    const rid = getRecordId(record); if (!rid) { setSaveError('No record ID'); return; }
    const currentVal = fmtVal(getFieldValue(record, fn, idx));
    const items = splitItems(currentVal);
    const cleanNew = (valueOverride !== undefined ? valueOverride : editValue).trim();
    const cleanOld = (items[sentenceIdx] || '').trim();
    if (cleanNew === cleanOld) { setEditingField(null); setEditValue(''); return; }
    // Splice the edited item back into the ORIGINAL text by walking item-by-item so every
    // delimiter (". " / ", " / "; ") + spacing is preserved exactly.
    let cursor = 0, rebuilt = '', ok = true;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const pos = currentVal.indexOf(it, cursor);
      if (pos === -1) { ok = false; break; }
      rebuilt += currentVal.slice(cursor, pos) + (i === sentenceIdx ? cleanNew : it);
      cursor = pos + it.length;
    }
    let fullText = ok ? (rebuilt + currentVal.slice(cursor))
      : items.map((it, i) => (i === sentenceIdx ? cleanNew : it)).filter(Boolean).join(', ');
    // tidy delimiter artifacts left by an emptied item
    fullText = fullText.replace(/,\s*,/g, ', ').replace(/\s{2,}/g, ' ').replace(/^[\s,;.]+/, '').replace(/[\s,;]+$/, '').trim();
    const newItemCount = splitItems(fullText).length;
    const extraCount = Math.max(0, newItemCount - items.length);
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: fullText }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => { const n = { ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }; for (let ei = 0; ei < extraCount; ei++) { n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; } return n; });
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = { fieldPart: fn, kind: 'sentence', value: fullText, markerState: 'edited', db: { field: fn, value: fullText } };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, getFieldValue]);

  /* ═══════ APPROVE — the ONLY DB writer. Commits this section's staged drafts, then /approve. ═══════ */
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    setSaveError(null);
    try {
      const rid = getRecordId(record); if (!rid) return;
      const sc = (await import('../../../services/secureApiClient')).default;
      const sf = SECTION_FIELDS[sid] || [];
      // Collect this record's staged drafts whose field belongs to THIS section.
      const store = readDrafts();
      const recDrafts = store[rid] || {};
      const toCommit = Object.values(recDrafts).filter(e => {
        if (!e || !e.db) return false;
        const baseField = String(e.db.field).split('.')[0]; // dotted object field → root
        return sf.includes(baseField);
      });
      // Persist each staged edit to the DB now (field + value; arrayIndex only when present).
      for (const e of toCommit) {
        const payload = { field: e.db.field, value: e.db.value };
        if (typeof e.db.arrayIndex === 'number') payload.arrayIndex = e.db.arrayIndex;
        const resp = await sc.put(`/api/edit/care_coordination/${rid}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the section approved (audit trail) — existing endpoint.
      await sc.put(`/api/edit/care_coordination/${rid}/approve`, { sectionId: sid, approved: true });

      // Clear pending for the committed editKeys so the values now flow into pdfData/PDF.
      const committedEditKeys = toCommit.map(e => {
        if (e.kind === 'array') return `${e.fieldPart}-${idx}`;       // `${fn}-${arrayIndex}` + `-${idx}` form
        return `${e.fieldPart}-${idx}`;                                // field / sentence / object root
      });
      setPendingEdits(prev => { const n = { ...prev }; committedEditKeys.forEach(k => delete n[k]); return n; });
      // Drop this section's committed drafts from localStorage (keep other sections' drafts intact).
      if (store[rid]) {
        Object.keys(store[rid]).forEach(dk => { const base = String(store[rid][dk]?.db?.field || '').split('.')[0]; if (sf.includes(base)) delete store[rid][dk]; });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[CareCoord] Approve failed:', err); setSaveError('Approve failed.'); }
  }, []);

  /* ═══════ SEARCH ═══════ */
  const highlightText = (text) => { if (!text && text !== 0) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const flattenSearchable = (v) => { if (isEmptyDeep(v)) return ''; if (isScalar(v)) return fmtVal(v); if (Array.isArray(v)) return v.map(flattenSearchable).join(' '); return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' '); };
  const sectionTitleMatches = (t) => { if (!searchTerm.trim()) return false; const sl = searchTerm.toLowerCase().trim(); const tl = (t || '').toLowerCase(); return tl.startsWith(sl) || sl.startsWith(tl); };
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(flattenSearchable(getFieldValue(record, fn, idx)), searchTerm); };
  const shouldShowSection = (record, title, fieldNames, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const sl = searchTerm.toLowerCase().trim(); const tl = (title || '').toLowerCase(); if (tl.startsWith(sl) || sl.startsWith(tl)) return true; const combined = (fieldNames || []).map(f => `${FIELD_LABELS[f] || f} ${flattenSearchable(getFieldValue(record, f, idx))}`).join(' '); return phraseMatch(combined, searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const sl = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      const title = `Care Coordination ${idx + 1}`;
      const allText = [
        title, formatDate(record.referralDate),
        ...Object.keys(FIELD_LABELS).map(f => flattenSearchable(record[f])),
        ...Object.values(FIELD_LABELS), ...Object.values(SECTION_TITLES),
      ].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  /* ═══════ APPROVE BUTTON ═══════ */
  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  /* ═══════ RENDER: simple string field ═══════ */
  const renderEditableField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(SECTION_TITLES[sid]) && !record._showAllSections) return null;
    const dv = fmtVal(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); setSaveError(null); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">&#9998;</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  /* ═══════ RENDER: comma-list field (parenthesis-aware) → editable row per item ═══════ */
  const renderCommaField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const stm = sectionTitleMatches(SECTION_TITLES[sid]);
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    const showAll = !searchTerm.trim() || record._showAllSections || stm || labelMatch;
    const parts = splitByComma(fmtVal(raw)); if (parts.length === 0) return null;
    const ek = `${fn}-${idx}`; const fieldEdited = editedFields[ek];
    const rendered = parts.map((part, pi) => {
      if (!showAll && !phraseMatch(part, searchTerm)) return null;
      const pk = `${ek}-p${pi}`; const ie = editingField === pk; const cid = `cs-${fn}-${idx}-${pi}`;
      const savePart = () => { const v = editValue.trim(); const arr = parts.map((x, xi) => xi === pi ? v : x).filter(x => x && x.trim()); handleSaveField(record, fn, idx, sid, arr.join(', ')); };
      if (ie) return (<div key={pi}><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) savePart(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} autoFocus rows={2} disabled={saving} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={savePart} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div></div>);
      return (<div key={pi}><div className={`numbered-row editable-row${fieldEdited ? ' modified' : ''}`} onClick={() => { setEditingField(pk); setEditValue(part); setSaveError(null); }}><div className="row-content"><span className="content-value">{highlightText(part)}</span>{!fieldEdited && <span className="edit-indicator">&#9998;</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(part, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div></div>);
    }).filter(Boolean);
    if (rendered.length === 0) return null;
    return <div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div>{rendered}{fieldEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>;
  };

  /* ═══════ RENDER: number field (parseFloat, hide-zero) ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx);
    if (raw === null || raw === undefined || raw === '' || Number(raw) === 0) return null; // hide-zero
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(SECTION_TITLES[sid]) && !record._showAllSections) return null;
    const dv = fmtVal(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `num-${fn}-${idx}`;
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container"><input type="number" step="any" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={() => { const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, n); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); setSaveError(null); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">&#9998;</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  /* ═══════ RENDER: date field (date-picker) ═══════ */
  const renderDateField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `date-${fn}-${idx}`; const dv = formatDate(raw);
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container"><input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={() => { if (!editValue || isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, sid, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(toInputDate(raw)); setSaveError(null); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">&#9998;</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  /* ═══════ RENDER: object leaf (editable; number→number input, bool→select, text→textarea) ═══════ */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const ie = editingField === leafKey; const ed = editedFields[leafKey];
    const isBool = typeof value === 'boolean'; const isNum = typeof value === 'number';
    const startVal = isBool ? (value ? 'yes' : 'no') : leafValueString;
    const cid = `leaf-${leafKey}`;
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        {ie ? (
          <div className="edit-field-container">
            {isBool ? (
              <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}><option value="yes">Yes</option><option value="no">No</option></select>
            ) : isNum ? (
              <input type="number" step="any" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
            ) : (
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
            )}
            {saveError && <div className="save-error">{saveError}</div>}
            <div className="edit-actions">
              <button className="save-btn" disabled={saving} onClick={() => { let nv; if (isBool) nv = editValue === 'yes'; else if (isNum) { const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } nv = n; } else nv = editValue.trim(); saveLeaf(record, rootField, path, idx, sid, leafKey, nv); }}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(leafKey); setEditValue(startVal); setSaveError(null); }}>
            <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span>{!ed && <span className="edit-indicator">&#9998;</span>}</div>
            <button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(`${humanizeKey(path[path.length - 1])}: ${leafValueString}`, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button>
          </div>
        )}
        {ed && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  /* ═══════ RENDER: object node (recursive) ═══════ */
  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sid, value);
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && <div className="nested-subtitle sub-label">{highlightText(label)}</div>}
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
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(SECTION_TITLES[sid]) && !record._showAllSections) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {entries.map(([k, v]) => (
          isScalar(v) ? renderObjectLeaf(record, fn, [k], idx, sid, v)
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fn, idx, sid, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    );
  };

  /* ═══════ RENDER: array item ═══════ */
  const renderEditableArrayItem = (record, fn, idx, sid, item, ai) => {
    const ek = `${fn}-${idx}-${ai}`; const val = localEdits[ek] !== undefined ? localEdits[ek] : String(item || '');
    const ie = editingField === ek; const ed = editedFields[ek]; const cid = `arr-${fn}-${idx}-${ai}`;
    if (ie) return (<div key={ai} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, fn, idx, sid, ai); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} autoFocus rows={1} disabled={saving} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={() => handleSaveArrayItem(record, fn, idx, sid, ai)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div></div>);
    return (<div key={ai} className="rec-mini-card"><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(val); setSaveError(null); }}><div className="row-content"><span className="content-value">{highlightText(val)}</span>{!ed && <span className="edit-indicator">&#9998;</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(val, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  /* ═══════ RENDER: per-sentence field ═══════ */
  const renderSentenceEditableField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const sentences = splitItems(fmtVal(raw)); if (sentences.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const stm = sectionTitleMatches(SECTION_TITLES[sid]);
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    const showAll = !searchTerm.trim() || record._showAllSections || stm || labelMatch;
    const rendered = sentences.map((sent, si) => {
      if (!showAll && !phraseMatch(sent, searchTerm)) return null;
      const sentKey = `${fn}-${idx}-s${si}`; const ie = editingField === sentKey; const ed = editedFields[sentKey]; const cid = `sent-${fn}-${idx}-${si}`;
      const parsed = parseLabel(sent);
      const showLabel = parsed && parsed.label.toLowerCase() !== label.toLowerCase();
      const saveLbl = (lbl) => { saveSentence(record, fn, idx, sid, si, lbl ? `${lbl}: ${editValue}` : editValue); };
      if (ie) return (<div key={si}>{showLabel && <div className="nested-subtitle sub-label">{highlightText(parsed.label)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveLbl(parsed?.label); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} autoFocus rows={2} disabled={saving} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={() => saveLbl(parsed?.label)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div></div>);
      const displayText = parsed ? parsed.content : sent;
      return (<div key={si}>{showLabel && <div className="nested-subtitle sub-label">{highlightText(parsed.label)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(sentKey); setEditValue(parsed ? parsed.content : sent); setSaveError(null); }}><div className="row-content"><span className="content-value">{highlightText(displayText)}</span>{!ed && <span className="edit-indicator">&#9998;</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(sent, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed === 'edited' && <div className="modified-badge">edited - click Pending Approve to save</div>}{ed === 'added' && <div className="modified-badge added">added - click Pending Approve to save</div>}</div>);
    }).filter(Boolean);
    if (rendered.length === 0) return null;
    return <div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div>{rendered}</div>;
  };

  /* ═══════ PDF DATA (apply COMMITTED local edits; pending drafts stay OUT until Approve) ═══════ */
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const m = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        // object-root edits stored under `${field}-${idx}` with full clone
        OBJECT_FIELDS.forEach(of => { if (key === `${of}-${idx}`) m[of] = localEdits[key]; });
        // simple scalar / sentence edits stored under `${field}-${idx}`
        const ld = key.lastIndexOf('-'); if (ld === -1) return;
        const fn = key.substring(0, ld); const tail = key.substring(ld + 1);
        if (/^\d+$/.test(tail) && parseInt(tail, 10) === idx && fn in record && !OBJECT_FIELDS.includes(fn)) m[fn] = localEdits[key];
      });
      // array elements: apply only COMMITTED edits (skip pending drafts)
      ARRAY_FIELDS.forEach(field => {
        const original = Array.isArray(record[field]) ? [...record[field]] : [];
        original.forEach((_, ai) => { const ek = `${field}-${idx}-${ai}`; if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek]; });
        m[field] = original;
      });
      return m;
    });
  }, [records, localEdits, pendingEdits]);

  /* ═══════ COPY: recursive object lines — mirror the on-screen nested mini-cards:
     label on its OWN line, value (or numbered list items) indented below. NEVER "Label: value". ═══════ */
  const objectCopyLines = (label, value, indent) => {
    const pad = '  '.repeat(indent); const sub = '  '.repeat(indent + 1); const out = [];
    if (isEmptyDeep(value)) return out;
    const pushLabel = (l) => { out.push(`${pad}${l}:`); out.push(`${pad}${COPY_LINE_DASH}`); };
    if (Array.isArray(value)) {
      if (label) pushLabel(label);
      const allScalar = value.every(isScalar);
      if (allScalar) { value.filter(hasVal).forEach((v, i) => out.push(`${sub}${i + 1}. ${fmtScalar(v)}`)); }
      else { value.forEach((item, i) => { if (item && typeof item === 'object') out.push(...objectCopyLines(`${label || 'Item'} ${i + 1}`, item, indent + 1)); else if (hasVal(item)) out.push(`${sub}${i + 1}. ${fmtScalar(item)}`); }); }
      return out;
    }
    if (isScalar(value)) { if (label) pushLabel(label); out.push(`${sub}1. ${fmtScalar(value)}`); return out; }
    if (label) pushLabel(label);
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectCopyLines(humanizeKey(k), v, indent + (label ? 1 : 0))));
    return out;
  };

  const buildSectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record;
    let text = `${SECTION_TITLES[sid] || sid.toUpperCase()}\n${COPY_LINE_EQ}\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(fn => {
      const val = pr[fn];
      if (!hasVal(val)) return;
      if (ARRAY_FIELDS.includes(fn)) { (Array.isArray(pr[fn]) ? pr[fn] : []).forEach((it, i) => { if (hasVal(it)) text += `  ${i + 1}. ${fmtVal(it)}\n`; }); }
      else if (OBJECT_FIELDS.includes(fn)) { Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v, 0).forEach(l => { text += `${l}\n`; })); }
      else if (NUMBER_FIELDS.includes(fn)) { if (Number(val) !== 0) text += `${FIELD_LABELS[fn] || fn}:\n${COPY_LINE_DASH}\n  1. ${fmtVal(val)}\n`; }
      else if (SENTENCE_FIELDS.includes(fn)) { const its = splitItems(fmtVal(val)); text += `${FIELD_LABELS[fn] || fn}:\n${COPY_LINE_DASH}\n`; its.forEach((it, i) => { text += `  ${i + 1}. ${it}\n`; }); }
      else if (DATE_FIELDS.includes(fn)) { text += `${FIELD_LABELS[fn] || fn}:\n${COPY_LINE_DASH}\n  1. ${formatDate(val)}\n`; }
      else if (COMMA_SPLIT_FIELDS.has(fn)) { text += `${FIELD_LABELS[fn] || fn}:\n${COPY_LINE_DASH}\n`; splitByComma(fmtVal(val)).forEach((p, i) => { text += `  ${i + 1}. ${p}\n`; }); }
      else { text += `${FIELD_LABELS[fn] || fn}:\n${COPY_LINE_DASH}\n  1. ${fmtVal(val)}\n`; }
    });
    return text;
  };

  const copySectionText = (record, idx, sid) => { copyToClipboard(buildSectionText(record, idx, sid).trim(), `section-${sid}-${idx}`); };

  const copyAllContent = () => {
    let text = '=== CARE COORDINATION ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Care Coordination ${idx + 1}\n${'='.repeat(40)}\n`;
      text += '\n';
      Object.keys(SECTION_TITLES).forEach(sid => { const st = buildSectionText(r, idx, sid); if (st.split('\n').filter(Boolean).length > 2) text += st + '\n'; }); // >2: title + '=' divider = 2 lines when section is empty
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  /* ═══════ SECTION WRAPPER ═══════ */
  const renderSection = (record, idx, sid, children) => {
    if (!children || (Array.isArray(children) && children.filter(Boolean).length === 0)) return null;
    const title = SECTION_TITLES[sid];
    return (
      <div className="section"><div className="mini-cards-container">
        <div className="section-header">
          <h4 className="section-title">{highlightText(title)}</h4>
          <div className="header-right-actions">
            <button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>
            {renderApproveButton(idx, sid)}
          </div>
        </div>
        {children}
      </div></div>
    );
  };

  const renderMultiFieldSection = (record, idx, sid) => {
    const fields = SECTION_FIELDS[sid];
    if (!shouldShowSection(record, SECTION_TITLES[sid], fields, idx)) return null;
    const children = fields.map(f => {
      if (DATE_FIELDS.includes(f)) return <React.Fragment key={f}>{renderDateField(record, f, idx, sid)}</React.Fragment>;
      if (NUMBER_FIELDS.includes(f)) return <React.Fragment key={f}>{renderNumberField(record, f, idx, sid)}</React.Fragment>;
      if (COMMA_SPLIT_FIELDS.has(f)) return <React.Fragment key={f}>{renderCommaField(record, f, idx, sid)}</React.Fragment>;
      if (SENTENCE_FIELDS.includes(f)) return <React.Fragment key={f}>{renderSentenceEditableField(record, f, idx, sid)}</React.Fragment>;
      return <React.Fragment key={f}>{renderEditableField(record, f, idx, sid)}</React.Fragment>;
    });
    if (children.every(c => !c.props.children)) return null;
    return renderSection(record, idx, sid, children);
  };

  const renderArraySection = (record, idx, sid, fieldName) => {
    const arr = Array.isArray(record[fieldName]) ? record[fieldName].filter(x => x !== null && x !== undefined && String(x).trim() !== '') : [];
    if (arr.length === 0) return null;
    if (!shouldShowSection(record, SECTION_TITLES[sid], [fieldName], idx)) return null;
    const stm = sectionTitleMatches(SECTION_TITLES[sid]); const sa = !searchTerm.trim() || record._showAllSections || stm;
    const children = (Array.isArray(record[fieldName]) ? record[fieldName] : []).map((item, ai) => {
      if (item === null || item === undefined || String(item).trim() === '') return null;
      const val = localEdits[`${fieldName}-${idx}-${ai}`] !== undefined ? localEdits[`${fieldName}-${idx}-${ai}`] : item;
      if (!sa && !phraseMatch(val, searchTerm)) return null;
      return renderEditableArrayItem(record, fieldName, idx, sid, item, ai);
    }).filter(Boolean);
    return renderSection(record, idx, sid, children);
  };

  const renderObjectSection = (record, idx, sid, fieldName) => {
    if (!shouldShowSection(record, SECTION_TITLES[sid], [fieldName], idx)) return null;
    const child = renderObjectField(record, fieldName, idx, sid);
    return renderSection(record, idx, sid, child);
  };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="care-coord-document"><header className="document-header"><h1 className="document-title">Care Coordination</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="care-coord-document">
      <header className="document-header">
        <h1 className="document-title">Care Coordination</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<CareCoordinationPDFTemplate document={pdfData} />} fileName="Care_Coordination.pdf">
            {({ loading }) => <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>}
          </PDFDownloadLink>
        </div>
      </header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Care Coordination ${idx + 1}`)}</h3></div>
            </div>
            {renderMultiFieldSection(record, idx, 'referral')}
            {renderArraySection(record, idx, 'diagnoses', 'primaryDiagnoses')}
            {renderArraySection(record, idx, 'medications', 'activeMedications')}
            {renderArraySection(record, idx, 'medications', 'dischargeMedications')}
            {renderMultiFieldSection(record, idx, 'functional')}
            {renderArraySection(record, idx, 'followUp', 'followUpAppointments')}
            {renderArraySection(record, idx, 'pending', 'pendingTests')}
            {renderArraySection(record, idx, 'equipment', 'medicalEquipmentNeeds')}
            {renderArraySection(record, idx, 'education', 'patientEducationProvided')}
            {renderObjectSection(record, idx, 'homeHealth', 'homeHealthServices')}
            {renderObjectSection(record, idx, 'caregiver', 'caregiverInformation')}
            {renderObjectSection(record, idx, 'directives', 'advanceDirectives')}
            {renderObjectSection(record, idx, 'social', 'socialDeterminants')}
            {renderMultiFieldSection(record, idx, 'admin')}
          </div>
        ))}
      </div>
    </article>
  );
};

export default CareCoordinationDocument;
