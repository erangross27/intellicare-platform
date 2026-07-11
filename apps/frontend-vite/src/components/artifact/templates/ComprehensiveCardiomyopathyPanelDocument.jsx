/**
 * ComprehensiveCardiomyopathyPanelDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: comprehensive_cardiomyopathy_panel
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ComprehensiveCardiomyopathyPanelPDFTemplate from '../pdf-templates/ComprehensiveCardiomyopathyPanelPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './ComprehensiveCardiomyopathyPanelDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldName]: value } }  (value may be a string/number/boolean or full array) */
const DRAFT_KEY = 'comprehensive_cardiomyopathy_panelPendingEdits';
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
  'cardiac-function': 'Cardiac Function',
  'valvular-biomarkers': 'Valvular & Biomarkers',
  'diagnostic-studies': 'Diagnostic Studies',
  genetics: 'Genetics',
  treatment: 'Treatment',
};

const FIELD_LABELS = {
  ejectionFractionLVEF: 'Ejection Fraction (LVEF)',
  nyhaFunctionalClass: 'NYHA Functional Class',
  cardiacOutput: 'Cardiac Output',
  cardiacIndex: 'Cardiac Index',
  leftVentricularMassIndex: 'Left Ventricular Mass Index',
  interventricularSeptalThickness: 'Interventricular Septal Thickness',
  posteriorWallThickness: 'Posterior Wall Thickness',
  leftAtrialDimension: 'Left Atrial Dimension',
  rightVentricularSystolicPressure: 'Right Ventricular Systolic Pressure',
  mitralRegurgitationSeverity: 'Mitral Regurgitation Severity',
  tricuspidRegurgitationSeverity: 'Tricuspid Regurgitation Severity',
  diastolicDysfunctionGrade: 'Diastolic Dysfunction Grade',
  bnpLevel: 'BNP Level',
  ntProBnpLevel: 'NT-proBNP Level',
  troponinILevel: 'Troponin I Level',
  electrocardiogramFindings: 'ECG Findings',
  holterMonitorFindings: 'Holter Monitor Findings',
  cardiacMriFindings: 'Cardiac MRI Findings',
  exerciseToleranceTest: 'Exercise Tolerance Test',
  sixMinuteWalkDistance: 'Six-Minute Walk Distance',
  cardiomyopathyEtiology: 'Cardiomyopathy Etiology',
  geneticTestingResults: 'Genetic Testing Results',
  heartFailureTherapyResponse: 'Heart Failure Therapy Response',
  deviceTherapyIndication: 'Device Therapy Indication',
};

const SECTION_FIELDS = {
  'cardiac-function': ['ejectionFractionLVEF', 'nyhaFunctionalClass', 'cardiacOutput', 'cardiacIndex', 'leftVentricularMassIndex', 'interventricularSeptalThickness', 'posteriorWallThickness', 'leftAtrialDimension', 'rightVentricularSystolicPressure'],
  'valvular-biomarkers': ['mitralRegurgitationSeverity', 'tricuspidRegurgitationSeverity', 'diastolicDysfunctionGrade', 'bnpLevel', 'ntProBnpLevel', 'troponinILevel'],
  'diagnostic-studies': ['electrocardiogramFindings', 'holterMonitorFindings', 'cardiacMriFindings', 'exerciseToleranceTest', 'sixMinuteWalkDistance'],
  genetics: ['cardiomyopathyEtiology', 'geneticTestingResults'],
  treatment: ['heartFailureTherapyResponse', 'deviceTherapyIndication'],
};

const SENTENCE_FIELDS = ['electrocardiogramFindings', 'holterMonitorFindings', 'cardiacMriFindings', 'exerciseToleranceTest', 'heartFailureTherapyResponse', 'deviceTherapyIndication'];
const ARRAY_FIELDS = ['geneticTestingResults'];
/* NUMBER_FIELDS: clinical measurements stored as numbers. 0 is a sentinel ("not measured"), never a
   meaningful clinical value here, so MEANINGFUL_ZERO_FIELDS is empty — 0 is hidden unless the doctor
   edited the field (numberShows). */
const NUMBER_FIELDS = ['ejectionFractionLVEF', 'cardiacOutput', 'cardiacIndex', 'leftVentricularMassIndex', 'interventricularSeptalThickness', 'posteriorWallThickness', 'leftAtrialDimension', 'rightVentricularSystolicPressure', 'bnpLevel', 'ntProBnpLevel', 'troponinILevel', 'sixMinuteWalkDistance'];
const MEANINGFUL_ZERO_FIELDS = [];
// Fixed-choice clinical fields → dropdown (keep an unmatched current value as an extra option, casing matched).
const ENUM_FIELDS = {
  nyhaFunctionalClass: ['Class I', 'Class II', 'Class III', 'Class IV'],
  diastolicDysfunctionGrade: ['Normal', 'Grade I', 'Grade II', 'Grade III'],
  mitralRegurgitationSeverity: ['none', 'trace', 'mild', 'moderate', 'severe'],
  tricuspidRegurgitationSeverity: ['none', 'trace', 'mild', 'moderate', 'severe'],
  cardiomyopathyEtiology: ['familial', 'idiopathic', 'ischemic', 'hypertensive', 'dilated', 'hypertrophic', 'restrictive', 'arrhythmogenic'],
};
const enumOptionsWith = (opts, current) => { const cur = String(current ?? '').trim(); return cur && !opts.some(o => o.toLowerCase() === cur.toLowerCase()) ? [cur, ...opts] : opts; };
// Copy dividers (4-area mirror): EQ under record + section titles, DASH under every field / group label.
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
// −/+ stepper increment: 1 for integers, else a step matching the value's decimal precision.
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
// Comma splitter for narrative lists (per sentence / per array item, >=3 gate). Paren-aware; keeps Oxford
// ", and/or X" attached; skips no-space commas ("$18,000") and date commas ("January 8, 2026").
const splitByComma = (text) => {
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
      parts.push(cur.trim()); cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
};

const parseLabel = (text) => { if (!text || typeof text !== 'string') return null; const m = text.match(/^([A-Za-z][A-Za-z\s/&(),.#>:+-]{2,}?):\s+(.*)/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };

const ComprehensiveCardiomyopathyPanelDocument = ({ document: docProp }) => {
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
  const [saveError, setSaveError] = useState('');
  const containerRef = useRef(null);

  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.comprehensive_cardiomyopathy_panel) return Array.isArray(r.comprehensive_cardiomyopathy_panel) ? r.comprehensive_cardiomyopathy_panel : [r.comprehensive_cardiomyopathy_panel];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.comprehensive_cardiomyopathy_panel) return Array.isArray(dd.comprehensive_cardiomyopathy_panel) ? dd.comprehensive_cardiomyopathy_panel : [dd.comprehensive_cardiomyopathy_panel]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = record && record._id ? (typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id))) : null;
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldName, value]) => {
        const editKey = `${fieldName}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);

  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; }, []);
  const formatDate = useCallback((d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);
  // Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 mg", "<1%".
  const splitBySentence = useCallback((text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); }, []);
  function reconstructFullText(sentences) { if (!sentences || sentences.length === 0) return ''; return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' '); }
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  // Numeric 0 is a "not measured" sentinel for these magnitude fields — hide it unless the doctor edited it.
  const numberShows = useCallback((record, fn, idx) => {
    const val = getFieldValue(record, fn, idx);
    if (val === null || val === undefined || val === '') return false;
    const num = Number(val);
    if (Number.isNaN(num)) return false;
    if (num === 0) {
      if (MEANINGFUL_ZERO_FIELDS.includes(fn)) return true;
      const editKey = `${fn}-${idx}`;
      const doctorEdited = Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(fn);
      return Boolean(editedFields[editKey]) || doctorEdited;
    }
    return true;
  }, [getFieldValue, editedFields]);
  const getEffectiveArray = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) { const v = localEdits[k]; return Array.isArray(v) ? v : [v]; } const raw = record[fn]; if (!raw) return []; return Array.isArray(raw) ? raw : [raw]; }, [localEdits]);
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
      if (val !== null && val !== undefined) {
        if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
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
      if (Array.isArray(val)) return val.some(item => String(item).toLowerCase().includes(phrase));
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const sectionTitleMatches = useCallback((sid) => { if (!searchTerm.trim()) return false; const p = searchTerm.toLowerCase().trim(); const t = (SECTION_TITLES[sid] || '').toLowerCase(); return t.includes(p) || p.includes(t); }, [searchTerm]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Comprehensive Cardiomyopathy Panel ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const f of Object.keys(FIELD_LABELS)) { const val = record[f]; if (val !== null && val !== undefined) { if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; } else if (fmtVal(val).toLowerCase().includes(phrase)) return true; } }
      return false;
    });
  }, [records, searchTerm, fmtVal]);

  const pdfData = useMemo(() => filteredRecords.map((r, idx) => {
    const m = { ...r };
    Object.keys(localEdits).forEach(k => { if (pendingEdits[k]) return; /* pending drafts stay OUT of the PDF until approved */ const mt = k.match(/^(.+)-(\d+)$/); if (mt && parseInt(mt[2]) === idx) m[mt[1]] = localEdits[k]; });
    ARRAY_FIELDS.forEach(field => { const ek = `${field}-${idx}`; if (pendingEdits[ek]) { m[field] = Array.isArray(r[field]) ? r[field] : (r[field] ? [r[field]] : []); } else { m[field] = getEffectiveArray(r, field, idx); } });
    return m;
  }), [filteredRecords, localEdits, pendingEdits, getEffectiveArray]);

  /* ── Save handlers ──
     Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
     NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits). */
  const handleSaveField = useCallback((record, fn, idx, sid, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    let saveVal = valueOverride !== undefined ? valueOverride : editValue.trim();
    const originalVal = record[fn];
    if (NUMBER_FIELDS.includes(fn) || typeof originalVal === 'number') {
      if (isNaN(Number(saveVal))) { setSaveError('Please enter a valid number'); return; }
      saveVal = Number(saveVal);
    }
    setSaveError('');
    const storedVal = typeof saveVal === 'number' ? saveVal : String(saveVal);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: storedVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editTrackingKey || editKey]: 'edited' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = storedVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  function stageFieldDraft(id, fn, idx, fullText) {
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
  }
  function dropSectionApproval(sid, idx) {
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
  }

  // Save one sentence = stage a DRAFT. Empty edit removes the sentence.
  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || ''); const sentences = splitBySentence(currentVal); const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1); const fullText = reconstructFullText(updated);
      stageFieldDraft(id, fn, idx, fullText); setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' })); dropSectionApproval(sid, idx); setEditingField(null); setEditValue(''); return;
    }
    const newSentences = splitBySentence(editedVal); const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences); const fullText = reconstructFullText(updated);
    stageFieldDraft(id, fn, idx, fullText);
    const orig = sentences[sentenceIdx] || ''; const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => { const n = { ...prev }; if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; const extra = newSentences.length - 1; for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; return n; });
    dropSectionApproval(sid, idx);
    setEditingField(null); setEditValue('');
  }

  // Save one comma-part of a sentence group (labeled OR unlabeled) = stage a DRAFT. Rebuilds that sentence
  // (preserving a "Label:" head), then the full field text; an empty edit removes the part.
  function saveCommaItem(record, fn, idx, sid, sIdx, commaIdx) {
    const id = safeId(record); if (!id) return;
    const curSentences = splitBySentence(String(getFieldValue(record, fn, idx) || ''));
    const sentence = curSentences[sIdx] || '';
    const parsed = parseLabel(sentence);
    const content = parsed ? parsed.content : sentence.replace(/[;.]+$/, '').trim();
    const items = splitByComma(content);
    const trimmed = editValue.trim();
    if (!trimmed || /^[;.,!?]+$/.test(trimmed)) items.splice(commaIdx, 1); else items[commaIdx] = trimmed;
    const kept = items.map(s => s.trim()).filter(Boolean);
    if (kept.length > 0) curSentences[sIdx] = parsed ? `${parsed.label}: ${kept.join(', ')}` : kept.join(', ');
    else curSentences.splice(sIdx, 1);
    stageFieldDraft(id, fn, idx, reconstructFullText(curSentences));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-s${sIdx}-c${commaIdx}`]: 'edited' }));
    dropSectionApproval(sid, idx);
    setEditingField(null); setEditValue('');
  }

  // Save one whole array item = stage a DRAFT.
  function saveArrayItem(record, fn, idx, sid, arrayIdx) {
    const id = safeId(record); if (!id) return;
    const arr = [...getEffectiveArray(record, fn, idx)]; arr[arrayIdx] = editValue.trim();
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: arr }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-a${arrayIdx}`]: 'edited' }));
    dropSectionApproval(sid, idx);
    const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = arr; writeDrafts(store);
    setEditingField(null); setEditValue('');
  }

  // Save one comma-part of a labeled/unlabeled array item (e.g. one gene in "Primary genes: A, B, C") = stage a DRAFT.
  function saveArrayCommaItem(record, fn, idx, sid, arrayIdx, commaIdx) {
    const id = safeId(record); if (!id) return;
    const arr = [...getEffectiveArray(record, fn, idx)];
    const item = String(arr[arrayIdx] || '');
    const parsed = parseLabel(item);
    const content = parsed ? parsed.content : item.replace(/[;.]+$/, '').trim();
    const items = splitByComma(content);
    const trimmed = editValue.trim();
    if (!trimmed || /^[;.,!?]+$/.test(trimmed)) items.splice(commaIdx, 1); else items[commaIdx] = trimmed;
    const kept = items.map(s => s.trim()).filter(Boolean);
    if (kept.length > 0) arr[arrayIdx] = parsed ? `${parsed.label}: ${kept.join(', ')}` : kept.join(', ');
    else arr.splice(arrayIdx, 1);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: arr }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-a${arrayIdx}-c${commaIdx}`]: 'edited' }));
    dropSectionApproval(sid, idx);
    const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = arr; writeDrafts(store);
    setEditingField(null); setEditValue('');
  }

  /* ── Section approve ── */
  const sectionHasEdits = useCallback((idx, sid) => { const fields = SECTION_FIELDS[sid] || []; return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))); }, [editedFields, editedSentences]);
  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && fields.some(f => k === `${f}-${idx}`));
      for (const editKey of toCommit) {
        const fn = editKey.slice(0, editKey.length - `-${idx}`.length);
        await secureApiClient.put(`/api/edit/comprehensive_cardiomyopathy_panel/${id}/edit`, { field: fn, value: localEdits[editKey] });
      }
      await secureApiClient.put(`/api/edit/comprehensive_cardiomyopathy_panel/${id}/approve`, { sectionId: sid, approved: true });
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      const store = readDrafts();
      if (store[id]) { fields.forEach(f => { delete store[id][f]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }, [safeId, localEdits, pendingEdits]);
  const renderApproveButton = useCallback((record, sid, idx) => { const hasEdits = sectionHasEdits(idx, sid); const isApproved = approvedSections[`${sid}-${idx}`]; if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>); if (isApproved) return <span className="approve-btn approved">Approved</span>; return null; }, [sectionHasEdits, approvedSections, handleApproveSection]);

  /* ── Clipboard ── */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* ── Copy helpers ──
     Shared EQ/DASH numbered section-copy builder — 4-area mirror. Copy Section passes live getFieldValue;
     Copy All passes pdfData's committed values. Sentence fields split by sentence then comma (>=3), labeled
     groups restart numbering; array items likewise; NUMBER_FIELDS hidden unless numberShows. '' when empty. */
  const buildSectionCopy = useCallback((record, idx, sid, valueOf) => {
    const title = SECTION_TITLES[sid];
    const lines = [];
    const emitSentence = (text) => {
      let n = 0;
      splitBySentence(text).forEach(s => {
        const p = parseLabel(s);
        const content = p ? p.content : s.replace(/[;.]+$/, '').trim();
        const c = splitByComma(content);
        const parts = c.length >= 3 ? c : [content];
        if (p) { lines.push(p.label, COPY_LINE_DASH); n = 0; }
        parts.forEach(part => lines.push(`${++n}. ${part.replace(/[;.]+$/, '').trim()}`));
      });
    };
    (SECTION_FIELDS[sid] || []).forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const showLabel = label.toLowerCase() !== title.toLowerCase();
      if (ARRAY_FIELDS.includes(f)) {
        const arr = getEffectiveArray(record, f, idx);
        if (arr.length === 0) return;
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        let n = 0;
        arr.forEach(item => {
          const p = parseLabel(String(item));
          const content = p ? p.content : String(item).replace(/[;.]+$/, '').trim();
          const c = splitByComma(content);
          const parts = c.length >= 3 ? c : [content];
          if (p) { lines.push(p.label, COPY_LINE_DASH); let m = 0; parts.forEach(part => lines.push(`${++m}. ${part}`)); }
          else parts.forEach(part => lines.push(`${++n}. ${part}`));
        });
        lines.push('');
      } else if (NUMBER_FIELDS.includes(f)) {
        if (!numberShows(record, f, idx)) return;
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        lines.push(`1. ${fmtVal(valueOf(f))}`, '');
      } else if (SENTENCE_FIELDS.includes(f)) {
        const val = valueOf(f); if (!hasVal(val)) return;
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        emitSentence(fmtVal(val));
        lines.push('');
      } else {
        const val = valueOf(f); if (!hasVal(val)) return;
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        lines.push(`1. ${fmtVal(val)}`, '');
      }
    });
    if (lines.length === 0) return '';
    return `${title}\n${COPY_LINE_EQ}\n\n${lines.join('\n')}\n`;
  }, [hasVal, fmtVal, splitBySentence, getEffectiveArray, numberShows]);

  const copyAllText = useCallback(async () => {
    let text = '=== COMPREHENSIVE CARDIOMYOPATHY PANEL ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Comprehensive Cardiomyopathy Panel ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const block = buildSectionCopy(r, idx, sid, f => r[f]);
        if (block) text += `${block}\n`;
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text); if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, buildSectionCopy, copyToClipboard]);

  // −/+ number stepper (native spinner arrows banned). min 0; Enter saves; stopPropagation so the row click
  // doesn't re-open/close the editor. onSave commits the field.
  const numberStepper = (onSave) => {
    const bump = (dir) => { setSaveError(''); const s = parseFloat(stepFor(editValue)) || 1; const nv = (parseFloat(editValue) || 0) + dir * s; setEditValue(String(Math.max(0, Math.round(nv * 1e6) / 1e6))); };
    return (
      <div className="num-stepper-row">
        <button type="button" className="num-step" onClick={e => { e.stopPropagation(); bump(-1); }}>−</button>
        <input type="number" step={stepFor(editValue)} min="0" className="edit-number" value={editValue} autoFocus onClick={e => e.stopPropagation()} onChange={e => { setSaveError(''); setEditValue(e.target.value); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onSave(); } else if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(''); } }} />
        <button type="button" className="num-step" onClick={e => { e.stopPropagation(); bump(1); }}>+</button>
      </div>
    );
  };

  /* ── Render: simple editable field (strings + enum dropdowns) ── */
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey; const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase(); const displayVal = fmtVal(val); const isModified = editedFields[editKey];
    const enumOpts = ENUM_FIELDS[fn] ? enumOptionsWith(ENUM_FIELDS[fn], val) : null;
    const startEdit = () => { setSaveError(''); setEditingField(editKey); if (enumOpts) { const cur = String(val ?? '').trim(); const m = enumOpts.find(o => o.toLowerCase() === cur.toLowerCase()); setEditValue(m || cur); } else setEditValue(displayVal); };
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) startEdit(); }}>
          {isEditing ? (
            <div className="edit-field-container">
              {enumOpts ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(''); } }}>{enumOpts.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}</select>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(''); } }} />
              )}
              {saveError && editingField === editKey && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ── Render: number field (−/+ stepper; 0 hidden unless doctor-edited) ── */
  const renderNumberField = (record, fn, idx, sid, title) => {
    if (!numberShows(record, fn, idx)) return null;
    const val = getFieldValue(record, fn, idx);
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = String(val); const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setSaveError(''); setEditingField(editKey); setEditValue(displayVal); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {numberStepper(() => handleSaveField(record, fn, idx, sid))}
              {saveError && editingField === editKey && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ── Render: one editable text row (shared by sentence + comma-part + array rows) ── */
  const renderTextRow = (value, editKeyId, badge, onSave) => {
    const isEditing = editingField === editKeyId;
    return (
      <div>
        <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKeyId); setEditValue(value.replace(/[;.]+$/, '').trim()); setSaveError(''); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(''); } }} />
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); onSave(); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(value)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[editKeyId] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(value, editKeyId); }}>{copiedItems[editKeyId] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
      </div>
    );
  };

  /* ── Render: sentence editable field (labeled + unlabeled >=3 comma-split) ── */
  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const sentences = splitBySentence(val); if (sentences.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    return (
      <div key={fn}>
        <div className="rec-mini-card">
          {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
          {sentences.map((sentence, sIdx) => {
            const sentenceKey = `${fn}-${idx}-s${sIdx}`; const badge = editedSentences[sentenceKey];
            const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!sentenceMatches && searchTerm.trim()) return null;
            const parsed = parseLabel(sentence);
            const rawContent = parsed ? parsed.content : sentence.replace(/[;.]+$/, '').trim();
            const commaItems = splitByComma(rawContent);
            if (commaItems.length >= 3) {
              return (
                <div key={sIdx} className={parsed ? 'rec-mini-card' : ''} style={parsed ? { marginTop: 8 } : undefined}>
                  {parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  {commaItems.map((ci, ciIdx) => {
                    const commaKey = `${sentenceKey}-c${ciIdx}`;
                    return <React.Fragment key={ciIdx}>{renderTextRow(ci, commaKey, editedFields[commaKey], () => saveCommaItem(record, fn, idx, sid, sIdx, ciIdx))}</React.Fragment>;
                  })}
                </div>
              );
            }
            return <React.Fragment key={sIdx}>{renderTextRow(sentence, sentenceKey, badge, () => saveSentence(record, fn, idx, sid, sIdx))}</React.Fragment>;
          })}
        </div>
      </div>
    );
  };

  /* ── Render: array editable field (labeled/unlabeled items; >=3 comma items split into rows) ── */
  const renderEditableArrayField = (record, fn, idx, sid, title) => {
    const arr = getEffectiveArray(record, fn, idx); if (arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    return (
      <div key={fn} className="rec-mini-card">
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        {arr.map((item, aIdx) => {
          const itemStr = String(item);
          const itemMatches = !searchTerm.trim() || record._showAllSections || sectionTitleMatches(sid) || labelMatch || itemStr.toLowerCase().includes(searchTerm.toLowerCase().trim());
          if (!itemMatches) return null;
          const parsed = parseLabel(itemStr);
          const content = parsed ? parsed.content : itemStr;
          const commaItems = splitByComma(content);
          if (commaItems.length >= 3) {
            return (
              <div key={aIdx} className={parsed ? 'rec-mini-card' : ''} style={parsed ? { marginTop: aIdx > 0 ? 8 : 0 } : undefined}>
                {parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                {commaItems.map((ci, ciIdx) => {
                  const commaKey = `${fn}-${idx}-a${aIdx}-c${ciIdx}`;
                  return <React.Fragment key={ciIdx}>{renderTextRow(ci, commaKey, editedFields[commaKey], () => saveArrayCommaItem(record, fn, idx, sid, aIdx, ciIdx))}</React.Fragment>;
                })}
              </div>
            );
          }
          const arrayKey = `${fn}-${idx}-a${aIdx}`;
          return <React.Fragment key={aIdx}>{renderTextRow(itemStr, arrayKey, editedFields[arrayKey], () => saveArrayItem(record, fn, idx, sid, aIdx))}</React.Fragment>;
        })}
      </div>
    );
  };

  /* ── Render: mixed section ── */
  const renderMixedSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid]; if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => { if (ARRAY_FIELDS.includes(f)) return getEffectiveArray(record, f, idx).length > 0; if (NUMBER_FIELDS.includes(f)) return numberShows(record, f, idx); return hasVal(getFieldValue(record, f, idx)); });
    if (!hasAnyVal) return null;
    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopy(record, idx, sid, f => getFieldValue(record, f, idx)), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (ARRAY_FIELDS.includes(f)) return renderEditableArrayField(record, f, idx, sid, title);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid, title);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ── Main render ── */
  if (!records || records.length === 0) return (<div className="comprehensive-cardiomyopathy-panel" ref={containerRef}><div className="document-header"><h2 className="document-title">Comprehensive Cardiomyopathy Panel</h2></div><div className="empty-state">No comprehensive cardiomyopathy panel records available</div></div>);

  return (
    <div className="comprehensive-cardiomyopathy-panel" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Comprehensive Cardiomyopathy Panel</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ComprehensiveCardiomyopathyPanelPDFTemplate document={pdfData} />} fileName="Comprehensive_Cardiomyopathy_Panel.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container"><input type="text" className="search-input" placeholder="Search cardiomyopathy panel..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />{searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}</div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header"><div className="record-meta-row">{(record.date || record.createdAt) && <span className="record-date">{highlightText(formatDate(record.date || record.createdAt))}</span>}</div><h3 className="record-name">{highlightText(`Comprehensive Cardiomyopathy Panel ${idx + 1}`)}</h3></div>
            {renderMixedSection(record, idx, 'cardiac-function')}
            {renderMixedSection(record, idx, 'valvular-biomarkers')}
            {renderMixedSection(record, idx, 'diagnostic-studies')}
            {renderMixedSection(record, idx, 'genetics')}
            {renderMixedSection(record, idx, 'treatment')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComprehensiveCardiomyopathyPanelDocument;
