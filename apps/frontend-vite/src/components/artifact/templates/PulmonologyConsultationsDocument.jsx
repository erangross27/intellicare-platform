/**
 * PulmonologyConsultationsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: pulmonology_consultations
 *
 * 10 Sections:
 *   1. visit-info: type, provider, facility, status
 *   2. diagnosis: primaryDiagnosis, severity, exacerbationRisk
 *   3. secondary-diagnoses: secondaryDiagnoses (array)
 *   4. pulmonary-function: pulmonaryFunctionTests.fev1, pulmonaryFunctionTests.fvc, pulmonaryFunctionTests.fev1FvcRatio, pulmonaryFunctionTests.interpretation, peakFlow
 *   5. respiratory-vitals: respiratoryRate, oxygenSaturation
 *   6. symptoms: breathingSounds, chestPain
 *   7. medications: respiratoryMedications (array)
 *   8. smoking: smokingStatus, packYears
 *   9. imaging: chestXrayFindings, ctScanFindings
 *   10. assessment-plan: assessment, plan, findings, notes
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PulmonologyConsultationsDocumentPDFTemplate from '../pdf-templates/PulmonologyConsultationsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './PulmonologyConsultationsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF/Copy until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart is the localEdits key minus the "-<idx>" suffix) */
const DRAFT_KEY = 'pulmonology_consultationsPendingEdits';
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
  'visit-info': 'Visit Information',
  'diagnosis': 'Diagnosis',
  'secondary-diagnoses': 'Secondary Diagnoses',
  'pulmonary-function': 'Pulmonary Function Tests',
  'respiratory-vitals': 'Respiratory Vitals',
  'symptoms': 'Symptoms',
  'medications': 'Respiratory Medications',
  'smoking': 'Smoking History',
  'imaging': 'Imaging',
  'assessment-plan': 'Assessment & Plan',
};

const FIELD_LABELS = {
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  primaryDiagnosis: 'Primary Diagnosis',
  severity: 'Severity',
  exacerbationRisk: 'Exacerbation Risk',
  secondaryDiagnoses: 'Secondary Diagnoses',
  'pulmonaryFunctionTests.fev1': 'FEV1',
  'pulmonaryFunctionTests.fvc': 'FVC',
  'pulmonaryFunctionTests.fev1FvcRatio': 'FEV1/FVC Ratio',
  'pulmonaryFunctionTests.interpretation': 'Interpretation',
  peakFlow: 'Peak Flow',
  respiratoryRate: 'Respiratory Rate',
  oxygenSaturation: 'Oxygen Saturation (SpO2)',
  breathingSounds: 'Breathing Sounds',
  chestPain: 'Chest Pain',
  respiratoryMedications: 'Respiratory Medications',
  smokingStatus: 'Smoking Status',
  packYears: 'Pack Years',
  quitDate: 'Quit Date',
  chestXrayFindings: 'Chest X-ray Findings',
  ctScanFindings: 'CT Scan Findings',
  imagingDate: 'Imaging Date',
  assessment: 'Assessment',
  plan: 'Plan',
  findings: 'Findings',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'visit-info': ['type', 'provider', 'facility', 'status'],
  'diagnosis': ['primaryDiagnosis', 'severity', 'exacerbationRisk'],
  'secondary-diagnoses': ['secondaryDiagnoses'],
  'pulmonary-function': ['pulmonaryFunctionTests.fev1', 'pulmonaryFunctionTests.fvc', 'pulmonaryFunctionTests.fev1FvcRatio', 'pulmonaryFunctionTests.interpretation', 'peakFlow'],
  'respiratory-vitals': ['respiratoryRate', 'oxygenSaturation'],
  'symptoms': ['breathingSounds', 'chestPain'],
  'medications': ['respiratoryMedications'],
  'smoking': ['smokingStatus', 'packYears'],
  'imaging': ['chestXrayFindings', 'ctScanFindings'],
  'assessment-plan': ['assessment', 'plan', 'findings', 'notes'],
};

const NUMBER_FIELDS = ['respiratoryRate', 'oxygenSaturation', 'packYears'];
const BOOLEAN_FIELDS = [];
const DATE_FIELDS = [];
const ARRAY_FIELDS = ['secondaryDiagnoses', 'respiratoryMedications'];
const STRING_FIELDS = ['type', 'provider', 'facility', 'status', 'primaryDiagnosis', 'severity', 'exacerbationRisk', 'pulmonaryFunctionTests.fev1', 'pulmonaryFunctionTests.fvc', 'pulmonaryFunctionTests.fev1FvcRatio', 'pulmonaryFunctionTests.interpretation', 'peakFlow', 'breathingSounds', 'chestPain', 'smokingStatus', 'chestXrayFindings', 'ctScanFindings', 'assessment', 'plan', 'findings', 'notes'];

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

/* humanizeKey: camelCase sub-key -> "Title Case" label (for smokingCessation object) */
const humanizeKey = (key) => String(key || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* ═══════ COMPONENT ═══════ */
const PulmonologyConsultationsDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
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
      if (r?.pulmonology_consultations) return Array.isArray(r.pulmonology_consultations) ? r.pulmonology_consultations : [r.pulmonology_consultations];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.pulmonology_consultations) return Array.isArray(dd.pulmonology_consultations) ? dd.pulmonology_consultations : [dd.pulmonology_consultations]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = idOf(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
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
    // Support dot-path fields like pulmonaryFunctionTests.fev1
    if (fn.includes('.')) {
      const parts = fn.split('.');
      let val = record;
      for (const p of parts) { val = val?.[p]; }
      return val;
    }
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
      const rt = `Pulmonology Consultation ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && (Array.isArray(val) ? val.some(item => String(item).toLowerCase().includes(phrase)) : fmtVal(val).toLowerCase().includes(phrase))) return true;
        }
      }
      // Object/date fields rendered outside SECTION_FIELDS (ABG, oxygen therapy, cough, dyspnea, dates)
      const abg = record.arterialBloodGas;
      if (abg && typeof abg === 'object' && [abg.pH, abg.paCO2, abg.paO2, abg.hco3, abg.interpretation].some(v => v && String(v).toLowerCase().includes(phrase))) return true;
      const ox = record.oxygenTherapy;
      if (ox && typeof ox === 'object' && [ox.deliveryMethod, ox.flowRate, ox.duration, ox.prescribed ? 'yes' : ''].some(v => v && String(v).toLowerCase().includes(phrase))) return true;
      const cgh = record.cough;
      if (cgh && typeof cgh === 'object' && [cgh.type, cgh.sputum].some(v => v && String(v).toLowerCase().includes(phrase))) return true;
      const dys = record.dyspnea;
      if (dys && typeof dys === 'object' && [dys.severity, dys.triggers, (dys.mMRCScale || dys.mMRCScale === 0) ? `mmrc ${dys.mMRCScale}` : ''].some(v => v && String(v).toLowerCase().includes(phrase))) return true;
      if (record.quitDate && formatDate(record.quitDate).toLowerCase().includes(phrase)) return true;
      if (record.imagingDate && formatDate(record.imagingDate).toLowerCase().includes(phrase)) return true;
      // results dynamic-key object (recursive deep scan)
      const scanResults = (obj) => {
        if (!obj || typeof obj !== 'object') return false;
        if (Array.isArray(obj)) return obj.some(v => scanResults(v) || String(v).toLowerCase().includes(phrase));
        return Object.entries(obj).some(([k, v]) => {
          if (k === '_id' || k === '$oid') return false;
          if (humanizeKey(k).toLowerCase().includes(phrase)) return true;
          if (v && typeof v === 'object') return scanResults(v);
          return v !== null && v !== undefined && String(v).toLowerCase().includes(phrase);
        });
      };
      if (record.results && typeof record.results === 'object' && scanResults(record.results)) return true;
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fieldName = m[1];
          if (fieldName.includes('.')) {
            const parts = fieldName.split('.');
            if (parts.length === 2) {
              if (!merged[parts[0]]) merged[parts[0]] = {};
              merged[parts[0]] = { ...merged[parts[0]], [parts[1]]: localEdits[key] };
            }
          } else {
            merged[fieldName] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId]);

  // Stage a sentence edit as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
  function stageSentenceDraft(record, fn, idx, sid, fullText, sentenceMarks) {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedSentences(prev => ({ ...prev, ...sentenceMarks }));
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageSentenceDraft(record, fn, idx, sid, fullText, { [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' });
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    const marks = {};
    if (changed) marks[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
    const extra = newSentences.length - 1;
    for (let ei = 0; ei < extra; ei++) marks[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
    stageSentenceDraft(record, fn, idx, sid, fullText, marks);
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    if (sid === 'results') {
      return Object.keys(editedFields).some(k => k.startsWith('results.') && k.endsWith(`-${idx}`));
    }
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    // Collect the localEdits keys staged for this section (pending drafts only).
    const committedKeys = [];
    try {
      if (sid === 'results') {
        // Results stores a merged object under "results-<idx>"; persist each edited leaf via dot-path.
        const resKey = `results-${idx}`;
        const merged = localEdits[resKey];
        if (pendingEdits[resKey] && merged && typeof merged === 'object') {
          const leafKeys = Object.keys(editedFields).filter(k => k.startsWith('results.') && k.endsWith(`-${idx}`));
          for (const ek of leafKeys) {
            const fieldPart = ek.slice(0, -(`-${idx}`).length); // "results.<key>"
            const leaf = fieldPart.slice('results.'.length);
            await secureApiClient.put(`/api/edit/pulmonology_consultations/${id}/edit`, { field: fieldPart, value: merged[leaf] });
          }
          committedKeys.push(resKey);
        }
      } else {
        for (const f of fields) {
          const editKey = `${f}-${idx}`;
          if (!pendingEdits[editKey]) continue;
          const value = localEdits[editKey];
          // Treat a dot-suffix as arrayIndex ONLY when the segment after the LAST dot is purely numeric.
          const lastDot = f.lastIndexOf('.');
          const payload = { field: f, value };
          if (lastDot !== -1 && /^\d+$/.test(f.slice(lastDot + 1))) {
            payload.field = f.slice(0, lastDot);
            payload.arrayIndex = parseInt(f.slice(lastDot + 1), 10);
          }
          await secureApiClient.put(`/api/edit/pulmonology_consultations/${id}/edit`, payload);
          committedKeys.push(editKey);
        }
      }
      await secureApiClient.put(`/api/edit/pulmonology_consultations/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; committedKeys.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) {
        committedKeys.forEach(k => {
          if (k === `results-${idx}`) { delete store[id]['results']; }
          else { const fp = k.slice(0, -(`-${idx}`).length); delete store[id][fp]; }
        });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      if (sid === 'results') { setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.startsWith('results.') && k.endsWith(`-${idx}`)) delete n[k]; }); return n; }); }
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); }
  }, [safeId, localEdits, pendingEdits, editedFields]);

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
      } else if (BOOLEAN_FIELDS.includes(f)) {
        text += `${label}: ${val ? 'Yes' : 'No'}\n\n`;
      } else if (NUMBER_FIELDS.includes(f)) {
        text += `${label}: ${val}\n\n`;
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

  /* ═══════ COPY TEXT: OBJECT/DATE FIELDS (ABG, oxygen therapy, cough, dyspnea, dates) ═══════ */
  const buildAbgCopyText = useCallback((record) => {
    const abg = record.arterialBloodGas;
    if (!abg || typeof abg !== 'object') return '';
    const rows = [];
    if (hasVal(abg.pH)) rows.push(`pH: ${abg.pH}`);
    if (hasVal(abg.paCO2)) rows.push(`paCO2: ${abg.paCO2}`);
    if (hasVal(abg.paO2)) rows.push(`paO2: ${abg.paO2}`);
    if (hasVal(abg.hco3)) rows.push(`HCO3: ${abg.hco3}`);
    if (hasVal(abg.interpretation)) rows.push(`Interpretation: ${abg.interpretation}`);
    if (rows.length === 0) return '';
    return `Arterial Blood Gas\n${'='.repeat(40)}\n\n${rows.join('\n')}\n\n`;
  }, [hasVal]);

  const buildOxygenTherapyCopyText = useCallback((record) => {
    const ox = record.oxygenTherapy;
    if (!ox || typeof ox !== 'object') return '';
    const rows = [];
    if (ox.prescribed === true) rows.push('Prescribed: Yes');
    if (hasVal(ox.deliveryMethod)) rows.push(`Delivery Method: ${ox.deliveryMethod}`);
    if (hasVal(ox.flowRate)) rows.push(`Flow Rate: ${ox.flowRate}`);
    if (hasVal(ox.duration)) rows.push(`Duration: ${ox.duration}`);
    if (rows.length === 0) return '';
    return `Oxygen Therapy\n${'='.repeat(40)}\n\n${rows.join('\n')}\n\n`;
  }, [hasVal]);

  const buildSymptomObjectsCopyText = useCallback((record) => {
    let text = '';
    const cgh = record.cough;
    if (cgh && typeof cgh === 'object') {
      const rows = [];
      if (hasVal(cgh.type)) rows.push(`Type: ${cgh.type}`);
      if (hasVal(cgh.sputum)) rows.push(`Sputum: ${cgh.sputum}`);
      if (rows.length > 0) text += `Cough\n${rows.join('\n')}\n\n`;
    }
    const dys = record.dyspnea;
    if (dys && typeof dys === 'object') {
      const rows = [];
      if (hasVal(dys.severity)) rows.push(`Severity: ${dys.severity}`);
      if (hasVal(dys.triggers)) rows.push(`Triggers: ${dys.triggers}`);
      if (typeof dys.mMRCScale === 'number') rows.push(`mMRC ${dys.mMRCScale}`);
      if (rows.length > 0) text += `Dyspnea\n${rows.join('\n')}\n\n`;
    }
    return text;
  }, [hasVal]);

  const buildSmokingCessationCopyText = useCallback((record) => {
    const sc = record.smokingCessation;
    if (!sc || typeof sc !== 'object' || Array.isArray(sc)) return '';
    const rows = Object.entries(sc).filter(([k]) => k !== '_id').filter(([, v]) => hasVal(v));
    if (rows.length === 0) return '';
    return `Smoking Cessation\n${'='.repeat(40)}\n\n${rows.map(([k, v]) => `${humanizeKey(k)}: ${fmtVal(v)}`).join('\n')}\n\n`;
  }, [hasVal, fmtVal]);

  /* flatten a dynamic-key object (recursively) into "Label: value" / nested lines for Copy */
  const flattenResultsRows = useCallback((obj, prefix = '') => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
    const rows = [];
    Object.entries(obj).filter(([k]) => k !== '_id' && k !== '$oid').forEach(([k, v]) => {
      if (!hasVal(v)) return;
      const label = `${prefix}${humanizeKey(k)}`;
      if (v && typeof v === 'object' && !Array.isArray(v) && !v.$date) {
        rows.push(...flattenResultsRows(v, `${label} - `));
      } else if (Array.isArray(v)) {
        v.filter(item => hasVal(item)).forEach((item, i) => rows.push(`${label} ${i + 1}: ${fmtVal(item)}`));
      } else {
        rows.push(`${label}: ${fmtVal(v)}`);
      }
    });
    return rows;
  }, [hasVal, fmtVal]);

  const buildResultsCopyText = useCallback((record) => {
    const rows = flattenResultsRows(record.results);
    if (rows.length === 0) return '';
    return `Results\n${'='.repeat(40)}\n\n${rows.join('\n')}\n\n`;
  }, [flattenResultsRows]);

  const copyAllText = useCallback(async () => {
    let text = '=== PULMONOLOGY CONSULTATIONS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Pulmonology Consultation ${idx + 1}\n${'='.repeat(40)}\n`;
      if (r.date) text += `Date: ${formatDate(r.date)}\n`;
      text += '\n';
      Object.keys(SECTION_FIELDS).forEach(sid => {
        let sectionText = buildSectionCopyText(r, idx, sid);
        // Append object/date fields to their owning sections so order matches the on-screen render
        if (sid === 'smoking' && hasVal(r.quitDate)) {
          if (!sectionText) sectionText = `${SECTION_TITLES.smoking}\n${'='.repeat(40)}\n\n`;
          sectionText += `Quit Date\n${formatDate(r.quitDate)}\n\n`;
        }
        if (sid === 'imaging' && hasVal(r.imagingDate)) {
          if (!sectionText) sectionText = `${SECTION_TITLES.imaging}\n${'='.repeat(40)}\n\n`;
          sectionText += `Imaging Date\n${formatDate(r.imagingDate)}\n\n`;
        }
        if (sid === 'symptoms') {
          const symptomObjs = buildSymptomObjectsCopyText(r);
          if (symptomObjs) {
            if (!sectionText) sectionText = `${SECTION_TITLES.symptoms}\n${'='.repeat(40)}\n\n`;
            sectionText += symptomObjs;
          }
        }
        text += sectionText;
        // New standalone object sections, placed to mirror on-screen ordering
        if (sid === 'pulmonary-function') text += buildAbgCopyText(r);
        if (sid === 'respiratory-vitals') text += buildOxygenTherapyCopyText(r);
        if (sid === 'smoking') text += buildSmokingCessationCopyText(r);
      });
      // Add bronchodilators, corticosteroids, recommendations
      if (r.bronchodilators?.length) {
        text += `Bronchodilators\n${'='.repeat(40)}\n\n`;
        r.bronchodilators.forEach((med, i) => { text += `${i + 1}. ${med.medication} (${med.type})\n   Dose: ${med.dose}\n`; if (med.device) text += `   Device: ${med.device}\n`; text += '\n'; });
      }
      if (r.corticosteroids?.length) {
        text += `Corticosteroids\n${'='.repeat(40)}\n\n`;
        r.corticosteroids.forEach((med, i) => { text += `${i + 1}. ${med.medication}\n   Route: ${med.route}, Dose: ${med.dose}\n\n`; });
      }
      if (r.recommendations?.length) {
        text += `Recommendations\n${'='.repeat(40)}\n\n`;
        r.recommendations.forEach((rec, i) => { text += `${i + 1}. ${rec.recommendation}\n`; if (rec.date) text += `   Date: ${rec.date}\n`; text += '\n'; });
      }
      text += buildResultsCopyText(r);
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText, hasVal, buildAbgCopyText, buildOxygenTherapyCopyText, buildSymptomObjectsCopyText, buildSmokingCessationCopyText, buildResultsCopyText]);

  /* ═══════ RENDER: NUMBER FIELD ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || val === 0) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = String(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <input type="number" className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} style={{ minHeight: 'auto', height: '40px' }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = Number(editValue); if (isNaN(numVal)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {items.map((item, itemIdx) => {
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemStr = String(item);

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
          }

          return (
            <div key={itemIdx}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = editValue; const localKey = `${fn}-${idx}`; setLocalEdits(prev => ({ ...prev, [localKey]: currentArr })); setPendingEdits(prev => ({ ...prev, [localKey]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; }); const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = currentArr; writeDrafts(store); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">&#9998;</span></div>
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; stageSentenceDraft(record, fn, idx, sid, fullText2, marks); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                            {ciBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
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
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; stageSentenceDraft(record, fn, idx, sid, fullText, marks); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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
      return hasVal(val) && (typeof val !== 'number' || val !== 0);
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
            if (DATE_FIELDS.includes(f)) return null;
            if (BOOLEAN_FIELDS.includes(f)) return null;
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: BRONCHODILATORS SECTION ═══════ */
  const renderBronchodilators = (record, idx) => {
    if (!record.bronchodilators?.length) return null;
    const sid = 'bronchodilators';
    if (searchTerm.trim() && !record._showAllSections) {
      const phrase = searchTerm.toLowerCase().trim();
      const titleMatch = 'bronchodilators'.includes(phrase) || phrase.includes('bronchodilators');
      const contentMatch = record.bronchodilators.some(b => `${b.medication} ${b.type} ${b.dose} ${b.device || ''}`.toLowerCase().includes(phrase));
      if (!titleMatch && !contentMatch) return null;
    }
    const copyId = `bronchodilators-${idx}`;
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Bronchodilators')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => { const lines = ['BRONCHODILATORS']; record.bronchodilators.forEach((med, i) => { lines.push(`${i + 1}. ${med.medication} (${med.type})`); lines.push(`   Dose: ${med.dose}`); if (med.device) lines.push(`   Device: ${med.device}`); }); copySection(lines.join('\n'), copyId); }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
            </div>
          </div>
          {record.bronchodilators.map((med, medIdx) => {
            if (searchTerm.trim() && !record._showAllSections) {
              const phrase = searchTerm.toLowerCase().trim();
              const titleMatch = 'bronchodilators'.includes(phrase) || phrase.includes('bronchodilators');
              if (!titleMatch && !`${med.medication} ${med.type} ${med.dose} ${med.device || ''}`.toLowerCase().includes(phrase)) return null;
            }
            return (
              <div key={medIdx} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(`${med.medication} (${med.type})`)}</div>
                <div className="nested-field-card">
                  <div className="field-label">{highlightText('Dose')}</div>
                  <div className="numbered-row">
                    <div className="row-content"><span className="content-value">{highlightText(med.dose)}</span></div>
                    <button className={`copy-btn ${copiedItems[`broncho-${idx}-${medIdx}`] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${med.medication} (${med.type}): ${med.dose}`, `broncho-${idx}-${medIdx}`); }}>{copiedItems[`broncho-${idx}-${medIdx}`] ? 'Copied!' : 'Copy'}</button>
                  </div>
                </div>
                {med.device && (
                  <div className="nested-field-card">
                    <div className="field-label">{highlightText('Device')}</div>
                    <div className="numbered-row">
                      <div className="row-content"><span className="content-value">{highlightText(med.device)}</span></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: CORTICOSTEROIDS SECTION ═══════ */
  const renderCorticosteroids = (record, idx) => {
    if (!record.corticosteroids?.length) return null;
    if (searchTerm.trim() && !record._showAllSections) {
      const phrase = searchTerm.toLowerCase().trim();
      const titleMatch = 'corticosteroids'.includes(phrase) || phrase.includes('corticosteroids');
      const contentMatch = record.corticosteroids.some(c => `${c.medication} ${c.route} ${c.dose}`.toLowerCase().includes(phrase));
      if (!titleMatch && !contentMatch) return null;
    }
    const copyId = `corticosteroids-${idx}`;
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Corticosteroids')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => { const lines = ['CORTICOSTEROIDS']; record.corticosteroids.forEach((med, i) => { lines.push(`${i + 1}. ${med.medication}`); lines.push(`   Route: ${med.route}, Dose: ${med.dose}`); }); copySection(lines.join('\n'), copyId); }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
            </div>
          </div>
          {record.corticosteroids.map((med, medIdx) => {
            if (searchTerm.trim() && !record._showAllSections) {
              const phrase = searchTerm.toLowerCase().trim();
              const titleMatch = 'corticosteroids'.includes(phrase) || phrase.includes('corticosteroids');
              if (!titleMatch && !`${med.medication} ${med.route} ${med.dose}`.toLowerCase().includes(phrase)) return null;
            }
            return (
              <div key={medIdx} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(med.medication)}</div>
                <div className="nested-field-card">
                  <div className="field-label">{highlightText('Route')}</div>
                  <div className="numbered-row">
                    <div className="row-content"><span className="content-value">{highlightText(med.route)}</span></div>
                  </div>
                </div>
                <div className="nested-field-card">
                  <div className="field-label">{highlightText('Dose')}</div>
                  <div className="numbered-row">
                    <div className="row-content"><span className="content-value">{highlightText(med.dose)}</span></div>
                    <button className={`copy-btn ${copiedItems[`cortico-${idx}-${medIdx}`] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${med.medication}\nRoute: ${med.route}\nDose: ${med.dose}`, `cortico-${idx}-${medIdx}`); }}>{copiedItems[`cortico-${idx}-${medIdx}`] ? 'Copied!' : 'Copy'}</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: RECOMMENDATIONS SECTION ═══════ */
  const renderRecommendations = (record, idx) => {
    if (!record.recommendations?.length) return null;
    if (searchTerm.trim() && !record._showAllSections) {
      const phrase = searchTerm.toLowerCase().trim();
      const titleMatch = 'recommendations'.includes(phrase) || phrase.includes('recommendations');
      const contentMatch = record.recommendations.some(r => `${r.recommendation} ${r.date || ''}`.toLowerCase().includes(phrase));
      if (!titleMatch && !contentMatch) return null;
    }
    const copyId = `recommendations-${idx}`;
    // Group recommendations by date
    const groupedByDate = record.recommendations.reduce((acc, rec, rIdx) => {
      const dateKey = rec.date || 'No Date';
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push({ ...rec, originalIdx: rIdx });
      return acc;
    }, {});

    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Recommendations')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => { const lines = ['RECOMMENDATIONS']; record.recommendations.forEach((rec, i) => { lines.push(`${i + 1}. ${rec.recommendation}`); if (rec.date) lines.push(`   Date: ${rec.date}`); }); copySection(lines.join('\n'), copyId); }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
            </div>
          </div>
          {Object.entries(groupedByDate).map(([date, recs]) => (
            <div key={date} className="rec-mini-card">
              <div className="nested-subtitle">{highlightText(date)}</div>
              {recs.map((rec) => {
                if (searchTerm.trim() && !record._showAllSections) {
                  const phrase = searchTerm.toLowerCase().trim();
                  const titleMatch = 'recommendations'.includes(phrase) || phrase.includes('recommendations');
                  if (!titleMatch && !`${rec.recommendation} ${rec.date || ''}`.toLowerCase().includes(phrase)) return null;
                }
                return (
                  <div key={rec.originalIdx} className="numbered-row">
                    <div className="row-content"><span className="content-value">{highlightText(rec.recommendation)}</span></div>
                    <button className={`copy-btn ${copiedItems[`rec-${idx}-${rec.originalIdx}`] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${rec.recommendation}${rec.date ? `\nDate: ${rec.date}` : ''}`, `rec-${idx}-${rec.originalIdx}`); }}>{copiedItems[`rec-${idx}-${rec.originalIdx}`] ? 'Copied!' : 'Copy'}</button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: ARTERIAL BLOOD GAS SECTION (object block) ═══════ */
  const renderArterialBloodGas = (record, idx) => {
    const abg = record.arterialBloodGas;
    if (!abg || typeof abg !== 'object') return null;
    const rows = [
      ['pH', abg.pH], ['paCO2', abg.paCO2], ['paO2', abg.paO2], ['HCO3', abg.hco3], ['Interpretation', abg.interpretation],
    ].filter(([, v]) => hasVal(v));
    if (rows.length === 0) return null;
    if (searchTerm.trim() && !record._showAllSections) {
      const phrase = searchTerm.toLowerCase().trim();
      const titleMatch = 'arterial blood gas'.includes(phrase) || phrase.includes('arterial blood gas') || 'abg'.includes(phrase);
      const contentMatch = rows.some(([, v]) => String(v).toLowerCase().includes(phrase));
      if (!titleMatch && !contentMatch) return null;
    }
    const copyId = `arterialBloodGas-${idx}`;
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Arterial Blood Gas')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => { const lines = ['ARTERIAL BLOOD GAS']; rows.forEach(([l, v]) => lines.push(`${l}: ${v}`)); copySection(lines.join('\n'), copyId); }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
            </div>
          </div>
          {rows.map(([label, val], rIdx) => {
            const itemKey = `abg-${idx}-${rIdx}`;
            return (
              <div key={itemKey} className="nested-field-card">
                <div className="field-label">{highlightText(label)}</div>
                <div className="numbered-row">
                  <div className="row-content"><span className="content-value">{highlightText(String(val))}</span></div>
                  <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${val}`, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: OXYGEN THERAPY SECTION (object block) ═══════ */
  const renderOxygenTherapy = (record, idx) => {
    const ox = record.oxygenTherapy;
    if (!ox || typeof ox !== 'object') return null;
    const rows = [];
    if (ox.prescribed === true) rows.push(['Prescribed', 'Yes']);
    if (hasVal(ox.deliveryMethod)) rows.push(['Delivery Method', ox.deliveryMethod]);
    if (hasVal(ox.flowRate)) rows.push(['Flow Rate', ox.flowRate]);
    if (hasVal(ox.duration)) rows.push(['Duration', ox.duration]);
    if (rows.length === 0) return null;
    if (searchTerm.trim() && !record._showAllSections) {
      const phrase = searchTerm.toLowerCase().trim();
      const titleMatch = 'oxygen therapy'.includes(phrase) || phrase.includes('oxygen therapy');
      const contentMatch = rows.some(([, v]) => String(v).toLowerCase().includes(phrase));
      if (!titleMatch && !contentMatch) return null;
    }
    const copyId = `oxygenTherapy-${idx}`;
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Oxygen Therapy')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => { const lines = ['OXYGEN THERAPY']; rows.forEach(([l, v]) => lines.push(`${l}: ${v}`)); copySection(lines.join('\n'), copyId); }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
            </div>
          </div>
          {rows.map(([label, val], rIdx) => {
            const itemKey = `oxy-${idx}-${rIdx}`;
            return (
              <div key={itemKey} className="nested-field-card">
                <div className="field-label">{highlightText(label)}</div>
                <div className="numbered-row">
                  <div className="row-content"><span className="content-value">{highlightText(String(val))}</span></div>
                  <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${val}`, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: SYMPTOM OBJECTS (cough + dyspnea) inside the Symptoms area ═══════ */
  const renderSymptomObjects = (record, idx) => {
    const cgh = record.cough;
    const dys = record.dyspnea;
    const coughRows = (cgh && typeof cgh === 'object')
      ? [['Type', cgh.type], ['Sputum', cgh.sputum]].filter(([, v]) => hasVal(v)) : [];
    const dyspneaRows = [];
    if (dys && typeof dys === 'object') {
      if (hasVal(dys.severity)) dyspneaRows.push(['Severity', dys.severity]);
      if (hasVal(dys.triggers)) dyspneaRows.push(['Triggers', dys.triggers]);
      if (typeof dys.mMRCScale === 'number') dyspneaRows.push(['mMRC', String(dys.mMRCScale)]);
    }
    if (coughRows.length === 0 && dyspneaRows.length === 0) return null;
    if (searchTerm.trim() && !record._showAllSections) {
      const phrase = searchTerm.toLowerCase().trim();
      const labelMatch = 'symptoms'.includes(phrase) || 'cough'.includes(phrase) || 'dyspnea'.includes(phrase) || 'mmrc'.includes(phrase);
      const contentMatch = [...coughRows, ...dyspneaRows].some(([, v]) => String(v).toLowerCase().includes(phrase));
      if (!labelMatch && !contentMatch) return null;
    }
    const renderObjCard = (title, objRows, keyPrefix) => {
      if (objRows.length === 0) return null;
      return (
        <div className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(title)}</div>
          {objRows.map(([label, val], rIdx) => {
            const itemKey = `${keyPrefix}-${idx}-${rIdx}`;
            const display = label === 'mMRC' ? `mMRC ${val}` : String(val);
            return (
              <div key={itemKey} className="nested-field-card">
                <div className="field-label">{highlightText(label)}</div>
                <div className="numbered-row">
                  <div className="row-content"><span className="content-value">{highlightText(display)}</span></div>
                  <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${title} ${label}: ${val}`, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
                </div>
              </div>
            );
          })}
        </div>
      );
    };
    return (
      <>
        {renderObjCard('Cough', coughRows, 'cough')}
        {renderObjCard('Dyspnea', dyspneaRows, 'dyspnea')}
      </>
    );
  };

  /* ═══════ RENDER: SYMPTOMS SECTION (strings + cough/dyspnea objects) ═══════ */
  const renderSymptomsSection = (record, idx) => {
    const sid = 'symptoms';
    const fields = SECTION_FIELDS[sid] || [];
    const hasStringVal = fields.some(f => hasVal(getFieldValue(record, f, idx)));
    const cgh = record.cough; const dys = record.dyspnea;
    const coughHas = cgh && typeof cgh === 'object' && (hasVal(cgh.type) || hasVal(cgh.sputum));
    const dyspneaHas = dys && typeof dys === 'object' && (hasVal(dys.severity) || hasVal(dys.triggers) || typeof dys.mMRCScale === 'number');
    if (!hasStringVal && !coughHas && !dyspneaHas) return null;
    if (!shouldShowSection(record, sid)) {
      // section title / string fields didn't match; still show if a symptom object matches
      if (searchTerm.trim() && !record._showAllSections) {
        const phrase = searchTerm.toLowerCase().trim();
        const objContent = [cgh?.type, cgh?.sputum, dys?.severity, dys?.triggers, (typeof dys?.mMRCScale === 'number') ? `mmrc ${dys.mMRCScale}` : '']
          .some(v => v && String(v).toLowerCase().includes(phrase));
        const objLabel = 'cough'.includes(phrase) || 'dyspnea'.includes(phrase) || 'mmrc'.includes(phrase);
        if (!objContent && !objLabel) return null;
      } else if (!record._showAllSections) {
        return null;
      }
    }
    const title = SECTION_TITLES[sid];
    const copyId = `${sid}-${idx}`;
    const buildCopy = () => {
      let t = buildSectionCopyText(record, idx, sid);
      const objs = buildSymptomObjectsCopyText(record);
      if (objs) { if (!t) t = `${title}\n${'='.repeat(40)}\n\n`; t += objs; }
      return t;
    };
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildCopy(), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => renderStringField(record, f, idx, sid, title))}
          {renderSymptomObjects(record, idx)}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: SMOKING QUIT DATE (date row inside Smoking area) ═══════ */
  const renderDateRow = (record, idx, fieldName, label, keyPrefix) => {
    const val = record[fieldName];
    if (!hasVal(val)) return null;
    const formatted = formatDate(val);
    if (!formatted) return null;
    if (searchTerm.trim() && !record._showAllSections) {
      const phrase = searchTerm.toLowerCase().trim();
      if (!label.toLowerCase().includes(phrase) && !phrase.includes(label.toLowerCase()) && !formatted.toLowerCase().includes(phrase)) return null;
    }
    const itemKey = `${keyPrefix}-${idx}`;
    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className="numbered-row">
          <div className="row-content"><span className="content-value">{highlightText(formatted)}</span></div>
          <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${formatted}`, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: SMOKING SECTION (strings + quitDate) ═══════ */
  const renderSmokingSection = (record, idx) => {
    const sid = 'smoking';
    const fields = SECTION_FIELDS[sid] || [];
    const hasStringVal = fields.some(f => { const v = getFieldValue(record, f, idx); return hasVal(v) && (typeof v !== 'number' || v !== 0); });
    const dateHas = hasVal(record.quitDate) && !!formatDate(record.quitDate);
    if (!hasStringVal && !dateHas) return null;
    if (!shouldShowSection(record, sid)) {
      if (searchTerm.trim() && !record._showAllSections) {
        const phrase = searchTerm.toLowerCase().trim();
        const dateMatch = dateHas && (formatDate(record.quitDate).toLowerCase().includes(phrase) || 'quit date'.includes(phrase));
        if (!dateMatch) return null;
      } else if (!record._showAllSections) {
        return null;
      }
    }
    const title = SECTION_TITLES[sid];
    const copyId = `${sid}-${idx}`;
    const buildCopy = () => {
      let t = buildSectionCopyText(record, idx, sid);
      if (dateHas) { if (!t) t = `${title}\n${'='.repeat(40)}\n\n`; t += `Quit Date\n${formatDate(record.quitDate)}\n\n`; }
      return t;
    };
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildCopy(), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid, title);
          })}
          {renderDateRow(record, idx, 'quitDate', 'Quit Date', 'quitDate')}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: SMOKING CESSATION SECTION (object block — varying sub-keys) ═══════ */
  const renderSmokingCessation = (record, idx) => {
    const sc = record.smokingCessation;
    if (!sc || typeof sc !== 'object' || Array.isArray(sc)) return null;
    const rows = Object.entries(sc)
      .filter(([k]) => k !== '_id')
      .map(([k, v]) => [humanizeKey(k), v])
      .filter(([, v]) => hasVal(v));
    if (rows.length === 0) return null;
    if (searchTerm.trim() && !record._showAllSections) {
      const phrase = searchTerm.toLowerCase().trim();
      const titleMatch = 'smoking cessation'.includes(phrase) || phrase.includes('smoking cessation');
      const contentMatch = rows.some(([l, v]) => l.toLowerCase().includes(phrase) || fmtVal(v).toLowerCase().includes(phrase));
      if (!titleMatch && !contentMatch) return null;
    }
    const copyId = `smokingCessation-${idx}`;
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Smoking Cessation')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => { const lines = ['SMOKING CESSATION']; rows.forEach(([l, v]) => lines.push(`${l}: ${fmtVal(v)}`)); copySection(lines.join('\n'), copyId); }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
            </div>
          </div>
          {rows.map(([label, val], rIdx) => {
            const itemKey = `smkcess-${idx}-${rIdx}`;
            return (
              <div key={itemKey} className="nested-field-card">
                <div className="field-label">{highlightText(label)}</div>
                <div className="numbered-row">
                  <div className="row-content"><span className="content-value">{highlightText(fmtVal(val))}</span></div>
                  <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${fmtVal(val)}`, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: IMAGING SECTION (strings + imagingDate) ═══════ */
  const renderImagingSection = (record, idx) => {
    const sid = 'imaging';
    const fields = SECTION_FIELDS[sid] || [];
    const hasStringVal = fields.some(f => hasVal(getFieldValue(record, f, idx)));
    const dateHas = hasVal(record.imagingDate) && !!formatDate(record.imagingDate);
    if (!hasStringVal && !dateHas) return null;
    if (!shouldShowSection(record, sid)) {
      if (searchTerm.trim() && !record._showAllSections) {
        const phrase = searchTerm.toLowerCase().trim();
        const dateMatch = dateHas && (formatDate(record.imagingDate).toLowerCase().includes(phrase) || 'imaging date'.includes(phrase));
        if (!dateMatch) return null;
      } else if (!record._showAllSections) {
        return null;
      }
    }
    const title = SECTION_TITLES[sid];
    const copyId = `${sid}-${idx}`;
    const buildCopy = () => {
      let t = buildSectionCopyText(record, idx, sid);
      if (dateHas) { if (!t) t = `${title}\n${'='.repeat(40)}\n\n`; t += `Imaging Date\n${formatDate(record.imagingDate)}\n\n`; }
      return t;
    };
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildCopy(), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => renderStringField(record, f, idx, sid, title))}
          {renderDateRow(record, idx, 'imagingDate', 'Imaging Date', 'imagingDate')}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: RESULTS SECTION (dynamic-key object — typed editable leaves + nested) ═══════ */
  const renderResults = (record, idx) => {
    const res = record.results;
    if (!res || typeof res !== 'object' || Array.isArray(res)) return null;
    const entries = Object.entries(res).filter(([k, v]) => k !== '_id' && k !== '$oid' && hasVal(v));
    if (entries.length === 0) return null;
    if (searchTerm.trim() && !record._showAllSections) {
      const phrase = searchTerm.toLowerCase().trim();
      const titleMatch = 'results'.includes(phrase) || phrase.includes('results');
      const contentMatch = flattenResultsRows(res).some(r => r.toLowerCase().includes(phrase));
      if (!titleMatch && !contentMatch) return null;
    }
    const copyId = `results-${idx}`;

    /* one editable leaf row that saves via dot-path results.<key> */
    const renderLeafRow = (key, val) => {
      const fn = `results.${key}`;
      const editKey = `${fn}-${idx}`;
      const isEditing = editingField === editKey;
      const isModified = editedFields[editKey];
      const isNum = typeof val === 'number';
      const displayVal = fmtVal(val);
      return (
        <div key={key} className="nested-field-card">
          <div className="field-label">{highlightText(humanizeKey(key))}</div>
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
            {isEditing ? (
              <div className="edit-field-container">
                {isNum
                  ? <input type="number" className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} style={{ minHeight: 'auto', height: '40px' }} />
                  : <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />}
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={e => {
                    e.stopPropagation();
                    let saveVal = editValue;
                    if (isNum) { const n = Number(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } saveVal = n; }
                    const id = safeId(record); if (!id) return;
                    const cur = { ...(record.results || {}) };
                    const merged = localEdits[`results-${idx}`] !== undefined ? { ...localEdits[`results-${idx}`] } : cur;
                    merged[key] = saveVal;
                    const resKey = `results-${idx}`;
                    setLocalEdits(prev => ({ ...prev, [resKey]: merged }));
                    setPendingEdits(prev => ({ ...prev, [resKey]: true }));
                    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
                    setApprovedSections(prev => { const k = `results-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
                    const store = readDrafts();
                    if (!store[id]) store[id] = {};
                    store[id]['results'] = merged;
                    writeDrafts(store);
                    setEditingField(null); setEditValue(''); setSaveError(null);
                  }}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
                <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${humanizeKey(key)}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
              </>
            )}
          </div>
          {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      );
    };

    /* read-only flattened rows for nested objects / arrays */
    const renderNestedCard = (key, val) => {
      const rows = flattenResultsRows(Array.isArray(val) ? { [key]: val } : val, Array.isArray(val) ? '' : '');
      if (rows.length === 0) return null;
      return (
        <div key={key} className="rec-mini-card">
          {!Array.isArray(val) && <div className="nested-subtitle">{highlightText(humanizeKey(key))}</div>}
          {rows.map((r, ri) => (
            <div key={ri} className="nested-field-card">
              <div className="numbered-row">
                <div className="row-content"><span className="content-value">{highlightText(r)}</span></div>
                <button className={`copy-btn ${copiedItems[`resnest-${idx}-${key}-${ri}`] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(r, `resnest-${idx}-${key}-${ri}`); }}>{copiedItems[`resnest-${idx}-${key}-${ri}`] ? 'Copied!' : 'Copy'}</button>
              </div>
            </div>
          ))}
        </div>
      );
    };

    // re-read entries from possibly-edited local copy
    const liveRes = localEdits[`results-${idx}`] !== undefined ? localEdits[`results-${idx}`] : res;
    const liveEntries = Object.entries(liveRes).filter(([k, v]) => k !== '_id' && k !== '$oid' && hasVal(v));

    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Results')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => { const lines = ['RESULTS', ...flattenResultsRows(liveRes)]; copySection(lines.join('\n'), copyId); }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, 'results', idx)}
            </div>
          </div>
          {liveEntries.map(([key, val]) =>
            (val && typeof val === 'object')
              ? renderNestedCard(key, val)
              : renderLeafRow(key, val)
          )}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="pulmonology-consultations-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Pulmonology Consultations</h2></div>
        <div className="empty-state">No pulmonology consultation records available</div>
      </div>
    );
  }

  return (
    <div className="pulmonology-consultations-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Pulmonology Consultations</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<PulmonologyConsultationsDocumentPDFTemplate document={pdfData} />} fileName={`pulmonology-consultations-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search pulmonology consultations..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
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
              <h3 className="record-name">{highlightText(record.type || `Pulmonology Consultation ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'visit-info')}
            {renderSection(record, idx, 'diagnosis')}
            {renderSection(record, idx, 'secondary-diagnoses')}
            {renderSection(record, idx, 'pulmonary-function')}
            {renderArterialBloodGas(record, idx)}
            {renderSection(record, idx, 'respiratory-vitals')}
            {renderOxygenTherapy(record, idx)}
            {renderSymptomsSection(record, idx)}
            {renderSection(record, idx, 'medications')}
            {renderBronchodilators(record, idx)}
            {renderCorticosteroids(record, idx)}
            {renderSmokingSection(record, idx)}
            {renderSmokingCessation(record, idx)}
            {renderImagingSection(record, idx)}
            {renderSection(record, idx, 'assessment-plan')}
            {renderResults(record, idx)}
            {renderRecommendations(record, idx)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PulmonologyConsultationsDocument;
