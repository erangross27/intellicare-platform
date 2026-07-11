/**
 * CpapBipapManagementDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: cpap_bipap_management
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import CpapBipapManagementDocumentPDFTemplate from '../pdf-templates/CpapBipapManagementDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueDatePicker from '../components/BlueDatePicker';
import './CpapBipapManagementDocument.css';

const SECTION_TITLES = {
  deviceSettings: 'Device & Settings',
  sleepIndices: 'Sleep Indices & Oxygenation',
  maskCompliance: 'Mask & Compliance',
  ventilation: 'Ventilation & Advanced Settings',
  assessmentScores: 'Assessment Scores & Follow-up',
};

const FIELD_LABELS = {
  deviceType: 'Device Type',
  prescribedPressureCmH2O: 'Prescribed Pressure (cmH2O)',
  ipapSettingCmH2O: 'IPAP Setting (cmH2O)',
  epapSettingCmH2O: 'EPAP Setting (cmH2O)',
  pressureSupportDelta: 'Pressure Support Delta',
  rampTimeSetting: 'Ramp Time Setting (min)',
  humidifierSetting: 'Humidifier Setting',
  apneaHypopneaIndex: 'Apnea-Hypopnea Index (AHI)',
  baselineAhiPreTreatment: 'Baseline AHI (Pre-Treatment)',
  residualAhiOnTherapy: 'Residual AHI on Therapy',
  centralApneaIndex: 'Central Apnea Index',
  oxygenDesaturationIndex: 'Oxygen Desaturation Index',
  supplementalOxygenFlowRate: 'Supplemental O2 Flow Rate (L/min)',
  maskType: 'Mask Type',
  maskFitIssues: 'Mask Fit Issues',
  averageDailyUsageHours: 'Average Daily Usage (hrs)',
  compliancePercentage: 'Compliance Percentage',
  leakRateLitersPerMinute: 'Leak Rate (L/min)',
  tidalVolumeTargetMl: 'Tidal Volume Target (mL)',
  backupRespiratoryRate: 'Backup Respiratory Rate',
  cheyneStokesCycleLength: 'Cheyne-Stokes Cycle Length',
  aerophagiaSymptoms: 'Aerophagia Symptoms',
  epworthSleepinessScore: 'Epworth Sleepiness Score',
  stopBangScore: 'STOP-BANG Score',
  lastTitrationStudyDate: 'Last Titration Study Date',
};

const SECTION_FIELDS = {
  deviceSettings: ['deviceType', 'prescribedPressureCmH2O', 'ipapSettingCmH2O', 'epapSettingCmH2O', 'pressureSupportDelta', 'rampTimeSetting', 'humidifierSetting'],
  sleepIndices: ['apneaHypopneaIndex', 'baselineAhiPreTreatment', 'residualAhiOnTherapy', 'centralApneaIndex', 'oxygenDesaturationIndex', 'supplementalOxygenFlowRate'],
  maskCompliance: ['maskType', 'maskFitIssues', 'averageDailyUsageHours', 'compliancePercentage', 'leakRateLitersPerMinute'],
  ventilation: ['tidalVolumeTargetMl', 'backupRespiratoryRate', 'cheyneStokesCycleLength', 'aerophagiaSymptoms'],
  assessmentScores: ['epworthSleepinessScore', 'stopBangScore', 'lastTitrationStudyDate'],
};

const NUMBER_FIELDS = ['prescribedPressureCmH2O', 'ipapSettingCmH2O', 'epapSettingCmH2O', 'pressureSupportDelta', 'apneaHypopneaIndex', 'baselineAhiPreTreatment', 'residualAhiOnTherapy', 'averageDailyUsageHours', 'compliancePercentage', 'leakRateLitersPerMinute', 'centralApneaIndex', 'oxygenDesaturationIndex', 'supplementalOxygenFlowRate', 'rampTimeSetting', 'humidifierSetting', 'epworthSleepinessScore', 'stopBangScore', 'tidalVolumeTargetMl', 'backupRespiratoryRate', 'cheyneStokesCycleLength'];
/* MEANINGFUL_ZERO: numeric fields where 0 is a real clinical measurement (no events / perfect seal), not a "not set" sentinel.
   All other NUMBER_FIELDS (pressure settings, scores, usage, ventilation targets) use 0 as a sentinel -> hidden. */
const MEANINGFUL_ZERO_FIELDS = new Set(['apneaHypopneaIndex', 'baselineAhiPreTreatment', 'residualAhiOnTherapy', 'centralApneaIndex', 'oxygenDesaturationIndex', 'leakRateLitersPerMinute']);
const BOOLEAN_FIELDS = ['aerophagiaSymptoms'];
const ARRAY_FIELDS = ['maskFitIssues'];
const SENTENCE_FIELDS = [];
const DATE_FIELDS = ['lastTitrationStudyDate'];
/* Fixed-choice fields → dropdown. deviceType is the PAP modality; maskType is the interface type. */
const ENUM_FIELDS = {
  deviceType: ['CPAP', 'BiPAP', 'APAP', 'ASV'],
  maskType: ['nasal mask', 'nasal pillows', 'full face mask', 'oral mask', 'hybrid mask', 'total face mask'],
};
const enumOptionsWith = (opts, current) => { const cur = String(current ?? '').trim(); return cur && !opts.some(o => o.toLowerCase() === cur.toLowerCase()) ? [cur, ...opts] : opts; };
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
/* Step size matching the value's decimal precision (2.8 -> 0.1, 12 -> 1). */
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
const parseLabel = (text) => { if (!text || typeof text !== 'string') return null; const m = text.match(/^([A-Za-z][A-Za-z\s/&(),.#≥≤><%0-9-]{2,}?):\s+(.*)/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF/Copy All until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the localEdits field name, e.g. "maskType") */
const DRAFT_KEY = 'cpap_bipap_managementPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const CpapBipapManagementDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys (`${fn}-${idx}`) that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.cpap_bipap_management) return Array.isArray(r.cpap_bipap_management) ? r.cpap_bipap_management : [r.cpap_bipap_management];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cpap_bipap_management) return Array.isArray(dd.cpap_bipap_management) ? dd.cpap_bipap_management : [dd.cpap_bipap_management]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* recIdOf: stable record id, handling _id.$oid (module scope has no safeId yet) */
  const recIdOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const recId = recIdOf(record);
      const recDrafts = recId ? store[recId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fn, value]) => {
        const editKey = `${fn}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        if (SENTENCE_FIELDS.includes(fn)) {
          nSentences[`${fn}-${idx}-s0`] = 'edited';
        } else {
          nFields[editKey] = 'edited';
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  /* hasVal: generic presence check (0 counts as present); use fieldHasVal for per-field sentinel-zero handling */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; }, []);
  /* fieldHasVal: for NUMBER_FIELDS not in MEANINGFUL_ZERO_FIELDS, a value of 0 is a "not set" sentinel and is hidden. */
  const fieldHasVal = useCallback((fn, v) => {
    if (NUMBER_FIELDS.includes(fn) && !MEANINGFUL_ZERO_FIELDS.has(fn)) {
      if (v === null || v === undefined || v === '') return false;
      const n = parseFloat(v); if (isNaN(n)) return false; return n !== 0;
    }
    return hasVal(v);
  }, [hasVal]);
  const formatDate = useCallback((d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } }, []);
  const toDateInputValue = useCallback((d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return ''; return dt.toISOString().split('T')[0]; } catch { return ''; } }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);
  /* Canonical: splits on '.' AND ';' with the abbreviation+decimal guard ("12 cmH2O" and "2.8" never break). */
  const splitBySentence = useCallback((text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); }, []);
  /* paren-aware; keep Oxford ", and/or X"; skip no-space commas ("$18,000") and date commas ("January 8, 2026"). */
  const splitByComma = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    const parts = []; let cur = ''; let depth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      if (ch === ',' && depth === 0) {
        const rest = text.slice(i + 1);
        if (!/^\s/.test(rest)) { cur += ch; continue; }
        if (/^\s+(?:and|or)\b/i.test(rest)) { cur += ch; continue; }
        if (/\d\s*$/.test(cur) && /^\s*\d{4}\b/.test(rest)) { cur += ch; continue; }
        const t = cur.trim(); if (t) parts.push(t); cur = '';
      } else cur += ch;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts.filter(Boolean);
  }, []);
  function reconstructFullText(sentences) { if (!sentences || sentences.length === 0) return ''; return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' '); }
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getEffectiveArray = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) { const v = localEdits[k]; return Array.isArray(v) ? v : [v]; } return Array.isArray(record[fn]) ? record[fn] : []; }, [localEdits]);
  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);
  const highlightText = useCallback((text) => { if (!searchTerm.trim() || !text) return text; const phrase = searchTerm.trim(); const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'); const parts = String(text).split(regex); return parts.map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part); }, [searchTerm]);

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
      if (ARRAY_FIELDS.includes(f)) { const arr = Array.isArray(val) ? val : []; if (arr.some(item => String(item).toLowerCase().includes(phrase))) return true; }
      else if (val !== null && val !== undefined) { if (fmtVal(val).toLowerCase().includes(phrase)) return true; }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (ARRAY_FIELDS.includes(fn)) { const arr = Array.isArray(val) ? val : []; return arr.some(item => String(item).toLowerCase().includes(phrase)); }
    return val !== null && val !== undefined && fmtVal(val).toLowerCase().includes(phrase);
  }, [searchTerm, getFieldValue, fmtVal]);

  const sectionTitleMatches = useCallback((sid) => { if (!searchTerm.trim()) return false; const p = searchTerm.toLowerCase().trim(); const t = (SECTION_TITLES[sid] || '').toLowerCase(); return t.includes(p) || p.includes(t); }, [searchTerm]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `CPAP/BiPAP Management ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const f of Object.keys(FIELD_LABELS)) {
        const val = record[f];
        if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
        else if (val !== null && val !== undefined) { if (fmtVal(val).toLowerCase().includes(phrase)) return true; }
      }
      return false;
    });
  }, [records, searchTerm, fmtVal]);

  const pdfData = useMemo(() => filteredRecords.map((r, idx) => { const m = { ...r }; Object.keys(localEdits).forEach(k => { if (pendingEdits[k]) return; const mt = k.match(/^(.+)-(\d+)$/); if (mt && parseInt(mt[2]) === idx) m[mt[1]] = localEdits[k]; }); return m; }), [filteredRecords, localEdits, pendingEdits]);

  /* ========== EDIT ========== */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx) => {
    const id = safeId(record); if (!id) return;
    const trimmed = editValue.trim();
    let saveVal = trimmed;

    if (NUMBER_FIELDS.includes(fn)) {
      const num = parseFloat(trimmed);
      if (isNaN(num)) { setSaveError('Please enter a valid number'); return; }
      saveVal = num;
    } else if (BOOLEAN_FIELDS.includes(fn)) {
      saveVal = editValue === 'yes';
    } else if (DATE_FIELDS.includes(fn)) {
      if (isNaN(new Date(trimmed).getTime())) { setSaveError('Please enter a valid date'); return; }
      saveVal = trimmed;
    }
    setSaveError(null);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    // Re-edit after approval → drop the section's approved flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => {
      const sid = Object.keys(SECTION_FIELDS).find(s => SECTION_FIELDS[s].includes(fn));
      const aKey = sid ? `${sid}-${idx}` : null;
      if (!aKey || !prev[aKey]) return prev;
      const next = { ...prev }; delete next[aKey]; return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // Save = stage a DRAFT of the full array locally + localStorage. NOT written to DB/PDF until Approve.
  const handleSaveArrayItem = useCallback((record, fn, idx, arrayIndex) => {
    const id = safeId(record); if (!id) return; setSaveError(null);
    const arr = [...(getEffectiveArray(record, fn, idx))]; arr[arrayIndex] = editValue;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: arr }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-ai${arrayIndex}`]: 'edited' }));
    setApprovedSections(prev => {
      const sid = Object.keys(SECTION_FIELDS).find(s => SECTION_FIELDS[s].includes(fn));
      const aKey = sid ? `${sid}-${idx}` : null;
      if (!aKey || !prev[aKey]) return prev;
      const next = { ...prev }; delete next[aKey]; return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = arr;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getEffectiveArray]);

  /* Stage a sentence-field DRAFT locally + localStorage (no DB write). Approve commits it. */
  const stageDraft = (id, fn, idx, fullText) => {
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setApprovedSections(prev => {
      const sid = Object.keys(SECTION_FIELDS).find(s => SECTION_FIELDS[s].includes(fn));
      const aKey = sid ? `${sid}-${idx}` : null;
      if (!aKey || !prev[aKey]) return prev;
      const next = { ...prev }; delete next[aKey]; return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
  };

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || ''); const sentences = splitBySentence(currentVal); const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?-]+$/.test(editedVal)) { const updated = [...sentences]; updated.splice(sentenceIdx, 1); const fullText = reconstructFullText(updated); setSaveError(null);
      stageDraft(id, fn, idx, fullText); setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' })); setEditingField(null); setEditValue(''); return; }
    const newSentences = splitBySentence(editedVal); const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences); const fullText = reconstructFullText(updated); setSaveError(null);
    stageDraft(id, fn, idx, fullText);
    const orig = sentences[sentenceIdx] || ''; const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => { const n = { ...prev }; if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; const extra = newSentences.length - 1; for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; return n; });
    setEditingField(null); setEditValue('');
  }

  function saveCommaItem(record, fn, idx, sIdx, commaIdx, newItemText) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const parsed = parseLabel(sentences[sIdx]);
    if (!parsed) return;
    const items = splitByComma(parsed.content);
    items[commaIdx] = newItemText.trim();
    const rebuilt = `${parsed.label}: ${items.join(', ')}`;
    const allSentences = [...sentences]; allSentences[sIdx] = rebuilt;
    const fullText = reconstructFullText(allSentences);
    const commaKey = `${fn}-${idx}-s${sIdx}-c${commaIdx}`;
    setSaveError(null);
    stageDraft(id, fn, idx, fullText);
    setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }

  const sectionHasEdits = useCallback((idx, sid) => { const fields = SECTION_FIELDS[sid] || []; return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))); }, [editedFields, editedSentences]);
  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF/Copy All. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setApproving(true);
    try {
      // Persist each staged field for THIS section/record to the DB now. localEdits values are the
      // full final field value (scalar/sentence text, or the full array for ARRAY_FIELDS) — no arrayIndex needed.
      const toCommit = fields
        .map(f => `${f}-${idx}`)
        .filter(editKey => pendingEdits[editKey] && localEdits[editKey] !== undefined);
      for (const editKey of toCommit) {
        const fn = editKey.slice(0, editKey.length - `-${idx}`.length);
        const resp = await secureApiClient.put(`/api/edit/cpap_bipap_management/${id}/edit`, { field: fn, value: localEdits[editKey] });
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the record/section approved (audit trail)
      await secureApiClient.put(`/api/edit/cpap_bipap_management/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) { fields.forEach(f => { delete store[id][f]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); }
    finally { setApproving(false); }
  }, [safeId, pendingEdits, localEdits]);
  const renderApproveButton = useCallback((record, sid, idx) => { const hasEdits = sectionHasEdits(idx, sid); const isApproved = approvedSections[`${sid}-${idx}`]; if (hasEdits) return (<button className="approve-btn pending" disabled={approving} onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>{approving ? 'Approving...' : 'Pending Approve'}</button>); if (isApproved) return <span className="approve-btn approved">Approved</span>; return null; }, [sectionHasEdits, approvedSections, handleApproveSection, approving]);

  /* ========== COPY ========== */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* EQ/DASH numbered lines for one field — the exact mirror of the PDF fieldLines.
     `useDraft`=true reads staged edits (Copy Section); false reads committed record only (Copy All over pdfData). */
  const buildFieldLines = useCallback((record, f, idx, useDraft) => {
    const label = FIELD_LABELS[f] || f;
    const val = useDraft ? getFieldValue(record, f, idx) : record[f];
    const lines = [];
    if (ARRAY_FIELDS.includes(f)) {
      const arr = Array.isArray(val) ? val.filter(v => v !== null && v !== undefined && String(v).trim() !== '') : [];
      if (arr.length === 0) return lines;
      lines.push(label, COPY_LINE_DASH);
      arr.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
      lines.push('');
    } else if (SENTENCE_FIELDS.includes(f)) {
      if (!fieldHasVal(f, val)) return lines;
      lines.push(label, COPY_LINE_DASH);
      let n = 0;
      splitBySentence(fmtVal(val)).forEach(s => {
        const p = parseLabel(s);
        if (p) { const ci = splitByComma(p.content); lines.push(p.label, COPY_LINE_DASH); n = 0; if (ci.length >= 3) ci.forEach(c => lines.push(`${++n}. ${c}`)); else lines.push(`${++n}. ${p.content}`); }
        else { const ci = splitByComma(s); if (ci.length >= 3) ci.forEach(c => lines.push(`${++n}. ${c}`)); else lines.push(`${++n}. ${s}`); }
      });
      lines.push('');
    } else if (DATE_FIELDS.includes(f)) {
      if (!fieldHasVal(f, val)) return lines;
      lines.push(label, COPY_LINE_DASH, `1. ${formatDate(val)}`, '');
    } else {
      if (!fieldHasVal(f, val)) return lines;
      lines.push(label, COPY_LINE_DASH, `1. ${fmtVal(val)}`, '');
    }
    return lines;
  }, [getFieldValue, fieldHasVal, fmtVal, formatDate, splitBySentence, splitByComma]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    const lines = (SECTION_FIELDS[sid] || []).flatMap(f => buildFieldLines(record, f, idx, true));
    if (lines.length === 0) return '';
    return `${title}\n${COPY_LINE_EQ}\n\n${lines.join('\n')}\n`;
  }, [buildFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== CPAP/BiPAP MANAGEMENT ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `CPAP/BiPAP Management ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const lines = (SECTION_FIELDS[sid] || []).flatMap(f => buildFieldLines(r, f, idx, false));
        if (lines.length === 0) return;
        text += `${SECTION_TITLES[sid]}\n${COPY_LINE_EQ}\n\n${lines.join('\n')}\n\n`;
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text); if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildFieldLines]);

  /* ========== RENDER HELPERS ========== */
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!fieldHasVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey; const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = DATE_FIELDS.includes(fn) ? formatDate(val) : fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const isNumber = NUMBER_FIELDS.includes(fn);
    const isBoolean = BOOLEAN_FIELDS.includes(fn);
    const isDate = DATE_FIELDS.includes(fn);
    const enumOpts = ENUM_FIELDS[fn];
    const startEdit = () => { if (!isEditing) { setEditingField(editKey); if (isBoolean) { const raw = val; setEditValue(raw === true || raw === 'Yes' || raw === 'yes' || raw === 'true' ? 'yes' : 'no'); } else if (isDate) { setEditValue(toDateInputValue(val)); } else if (enumOpts) { const canon = enumOpts.find(o => o.toLowerCase() === displayVal.trim().toLowerCase()); setEditValue(canon || displayVal); } else { setEditValue(displayVal); } setSaveError(null); } };
    const bump = (delta) => { const st = parseFloat(stepFor(editValue)); const cur = parseFloat(editValue); setEditValue(String(parseFloat(((isNaN(cur) ? 0 : cur) + delta * st).toFixed(6)))); };
    let editInput;
    if (isEditing) {
      if (enumOpts) { editInput = <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>{enumOptionsWith(enumOpts, editValue).map(o => <option key={o} value={o}>{o}</option>)}</select>; }
      else if (isNumber) { editInput = (<div className="num-stepper-row"><button type="button" className="num-step" onClick={e => { e.stopPropagation(); bump(-1); }}>&minus;</button><input type="number" step={stepFor(editValue)} className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); handleSaveField(record, fn, idx); } }} /><button type="button" className="num-step" onClick={e => { e.stopPropagation(); bump(1); }}>+</button></div>); }
      else if (isBoolean) { editInput = <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}><option value="yes">Yes</option><option value="no">No</option></select>; }
      else if (isDate) { editInput = <BlueDatePicker value={editValue} onSelect={(iso) => setEditValue(iso)} />; }
      else { editInput = <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />; }
    }
    return (<div key={fn} className={sl ? 'rec-mini-card' : ''}>{sl && <div className="nested-subtitle">{highlightText(label)}</div>}<div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={startEdit}>{isEditing ? (<div className="edit-field-container">{editInput}{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div>) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}</div>{isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}</div>);
  };

  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const sentences = splitBySentence(val); if (sentences.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    return (<div key={fn}><div className="rec-mini-card">{sl && <div className="nested-subtitle">{highlightText(label)}</div>}{sentences.map((sentence, sIdx) => {
      const sentenceKey = `${fn}-${idx}-s${sIdx}`; const isEditing = editingField === sentenceKey; const badge = editedSentences[sentenceKey];
      const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
      if (!sentenceMatches && searchTerm.trim()) return null;
      const parsed = parseLabel(sentence);
      if (parsed) {
        const commaItems = splitByComma(parsed.content);
        if (commaItems.length >= 3) {
          return (<div key={sIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
            <div className="nested-subtitle">{highlightText(parsed.label)}</div>
            {commaItems.map((ci, ciIdx) => {
              const commaKey = `${fn}-${idx}-s${sIdx}-c${ciIdx}`;
              const ciEditing = editingField === commaKey;
              const ciBadge = editedSentences[commaKey];
              const ciMatches = phraseMatch || labelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
              if (!ciMatches && searchTerm.trim()) return null;
              return (<div key={ciIdx}>
                <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                  {ciEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItem(record, fn, idx, sIdx, ciIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div>
                  ) : (<><div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(ci, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button></>)}
                </div>
                {ciBadge && <span className={`modified-badge ${ciBadge === 'added' ? 'added' : ''}`}>{ciBadge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
              </div>);
            })}
          </div>);
        }
      }
      return (<div key={sIdx}><div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>{isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div>) : (<><div className="row-content"><span className="content-value">{highlightText(sentence)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button></>)}</div>{badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}</div>);
    })}</div></div>);
  };

  const renderArraySection = (record, fn, idx, sid, title) => {
    const arr = getEffectiveArray(record, fn, idx); if (arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== title.toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    return (
      <div key={fn}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="rec-mini-card">
          {arr.map((item, ai) => {
            const editKey = `${fn}-${idx}-ai${ai}`; const isEditing = editingField === editKey; const badge = editedFields[editKey];
            const itemMatches = phraseMatch || (searchTerm.trim() && String(item).toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!itemMatches && searchTerm.trim()) return null;
            return (
              <div key={ai}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(item)); setSaveError(null); } }}>
                  {isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, ai); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div>
                  ) : (<><div className="row-content"><span className="content-value">{highlightText(String(item))}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(item), editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
                </div>
                {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMixedSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid]; if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => { if (ARRAY_FIELDS.includes(f)) return getEffectiveArray(record, f, idx).length > 0; return fieldHasVal(f, getFieldValue(record, f, idx)); });
    if (!hasAnyVal) return null;
    const copyId = `${sid}-${idx}`;
    return (<div key={sid} className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>{renderApproveButton(record, sid, idx)}</div></div>{fields.map(f => { if (ARRAY_FIELDS.includes(f)) return renderArraySection(record, f, idx, sid, title); if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title); return renderEditableField(record, f, idx, sid, title); })}</div></div>);
  };

  if (!records || records.length === 0) return (<div className="cpap-bipap-management-document" ref={containerRef}><div className="document-header"><h2 className="document-title">CPAP/BiPAP Management</h2></div><div className="empty-state">No CPAP/BiPAP management records available</div></div>);

  return (
    <div className="cpap-bipap-management-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">CPAP/BiPAP Management</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<CpapBipapManagementDocumentPDFTemplate document={pdfData} />} fileName="CPAP_BiPAP_Management.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container"><input type="text" className="search-input" placeholder="Search CPAP/BiPAP management..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />{searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}</div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header"><h3 className="record-name">{highlightText(`CPAP/BiPAP Management ${idx + 1}`)}</h3></div>
            {renderMixedSection(record, idx, 'deviceSettings')}
            {renderMixedSection(record, idx, 'sleepIndices')}
            {renderMixedSection(record, idx, 'maskCompliance')}
            {renderMixedSection(record, idx, 'ventilation')}
            {renderMixedSection(record, idx, 'assessmentScores')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CpapBipapManagementDocument;
