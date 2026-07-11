/**
 * VascularSurgeryAssessmentDocument.jsx
 * June 2026 — Inline editing, blue glow theme
 * Collection: vascular_surgery_assessment
 *
 * 14 Sections:
 *   1.  vascular-history: patientVascularHistory
 *   2.  arterial-perfusion: ankleBrachialIndex, toeBrachialIndex, transcutaneousOxygenPressure, carotidStenosisPercentage, claudicationDistance
 *   3.  pulse-examination: pulsePalpationFindings
 *   4.  duplex-ultrasound: duplexUltrasoundFindings
 *   5.  wound-healing: woundHealingStatus
 *   6.  aneurysm-assessment: aneurysmDiameter, aneurysmLocation
 *   7.  venous-assessment: venousRefluxDuration, ceapClassification, varicoseVeinDistribution
 *   8.  classification-grafts: rutherfordClassification, graftPatencyStatus
 *   9.  arterial-calcification: arterialCalcificationSeverity
 *   10. limb-salvage: limbSalvagePotential
 *   11. anticoagulation-symptoms: anticoagulationRegimen, restPainPresent
 *   12. segmental-pressures: segmentalPressures[]
 *   13. endovascular-interventions: priorEndovascularInterventions[]
 *   14. dvt-risk-factors: dvtRiskFactors[]
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import VascularSurgeryAssessmentDocumentPDFTemplate from '../pdf-templates/VascularSurgeryAssessmentDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './VascularSurgeryAssessmentDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldName]: value } }  (localEdits is keyed by `${fn}-${idx}` with the
   FULL field value — arrays store the whole array, sentence fields store the full text — so the
   committed PUT is always { field, value } with no arrayIndex.) */
const DRAFT_KEY = 'vascular_surgery_assessmentPendingEdits';
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
  'vascular-history': 'Vascular History',
  'arterial-perfusion': 'Arterial Perfusion Measurements',
  'pulse-examination': 'Pulse Examination',
  'duplex-ultrasound': 'Duplex Ultrasound Findings',
  'wound-healing': 'Wound Healing Status',
  'aneurysm-assessment': 'Aneurysm Assessment',
  'venous-assessment': 'Venous Assessment',
  'classification-grafts': 'Classification & Grafts',
  'arterial-calcification': 'Arterial Calcification',
  'limb-salvage': 'Limb Salvage Potential',
  'anticoagulation-symptoms': 'Anticoagulation & Symptoms',
  'segmental-pressures': 'Segmental Pressures',
  'endovascular-interventions': 'Prior Endovascular Interventions',
  'dvt-risk-factors': 'DVT Risk Factors',
};

const FIELD_LABELS = {
  patientVascularHistory: 'Vascular History',
  ankleBrachialIndex: 'Ankle-Brachial Index (ABI)',
  toeBrachialIndex: 'Toe-Brachial Index (TBI)',
  transcutaneousOxygenPressure: 'Transcutaneous Oxygen Pressure (TcPO2, mmHg)',
  carotidStenosisPercentage: 'Carotid Stenosis (%)',
  claudicationDistance: 'Claudication Distance (m)',
  pulsePalpationFindings: 'Pulse Palpation Findings',
  duplexUltrasoundFindings: 'Duplex Ultrasound Findings',
  woundHealingStatus: 'Wound Healing Status',
  aneurysmDiameter: 'Aneurysm Diameter (cm)',
  aneurysmLocation: 'Aneurysm Location',
  venousRefluxDuration: 'Venous Reflux Duration (s)',
  ceapClassification: 'CEAP Classification',
  varicoseVeinDistribution: 'Varicose Vein Distribution',
  rutherfordClassification: 'Rutherford Classification',
  graftPatencyStatus: 'Graft Patency Status',
  arterialCalcificationSeverity: 'Arterial Calcification Severity',
  limbSalvagePotential: 'Limb Salvage Potential',
  anticoagulationRegimen: 'Anticoagulation Regimen',
  restPainPresent: 'Rest Pain Present',
  segmentalPressures: 'Segmental Pressures',
  priorEndovascularInterventions: 'Prior Endovascular Interventions',
  dvtRiskFactors: 'DVT Risk Factors',
};

const SECTION_FIELDS = {
  'vascular-history': ['patientVascularHistory'],
  'arterial-perfusion': ['ankleBrachialIndex', 'toeBrachialIndex', 'transcutaneousOxygenPressure', 'carotidStenosisPercentage', 'claudicationDistance'],
  'pulse-examination': ['pulsePalpationFindings'],
  'duplex-ultrasound': ['duplexUltrasoundFindings'],
  'wound-healing': ['woundHealingStatus'],
  'aneurysm-assessment': ['aneurysmDiameter', 'aneurysmLocation'],
  'venous-assessment': ['venousRefluxDuration', 'ceapClassification', 'varicoseVeinDistribution'],
  'classification-grafts': ['rutherfordClassification', 'graftPatencyStatus'],
  'arterial-calcification': ['arterialCalcificationSeverity'],
  'limb-salvage': ['limbSalvagePotential'],
  'anticoagulation-symptoms': ['anticoagulationRegimen', 'restPainPresent'],
  'segmental-pressures': ['segmentalPressures'],
  'endovascular-interventions': ['priorEndovascularInterventions'],
  'dvt-risk-factors': ['dvtRiskFactors'],
};

const SENTENCE_FIELDS = ['patientVascularHistory', 'pulsePalpationFindings', 'woundHealingStatus', 'duplexUltrasoundFindings', 'limbSalvagePotential', 'arterialCalcificationSeverity', 'anticoagulationRegimen'];
const SIMPLE_FIELDS = ['aneurysmLocation', 'rutherfordClassification', 'graftPatencyStatus', 'ceapClassification', 'varicoseVeinDistribution'];
/* Numeric fields → typed number input (saves a real number, never a string). */
const NUMERIC_FIELDS = ['ankleBrachialIndex', 'toeBrachialIndex', 'transcutaneousOxygenPressure', 'carotidStenosisPercentage', 'claudicationDistance', 'aneurysmDiameter', 'venousRefluxDuration'];
const BOOLEAN_FIELDS = ['restPainPresent'];
const ARRAY_FIELDS = ['segmentalPressures', 'priorEndovascularInterventions', 'dvtRiskFactors'];
/* Numeric fields where 0 means "not assessed" — hidden when exactly 0.
   carotidStenosisPercentage 0 IS clinically meaningful (no stenosis) and ABI/TBI/TcPO2 0 indicate absent flow, so those stay visible. */
const HIDE_ZERO_FIELDS = ['claudicationDistance', 'aneurysmDiameter', 'venousRefluxDuration'];

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#:'"-]{1,80}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware comma split with date-aware guard */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).trimStart();
      if (/^\d{4}\b/.test(rest)) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

/* ═══════ COMPONENT ═══════ */
const VascularSurgeryAssessmentDocument = ({ document: docProp, data, templateData }) => {
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
  const [saveError, setSaveError] = useState(null);
  // editKeys (`${fn}-${idx}`) that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP — all formats (document / data / templateData) ═══════ */
  const records = useMemo(() => {
    const source = docProp || data || templateData;
    if (!source) return [];
    let arr = Array.isArray(source) ? source : [source];
    arr = arr.flatMap(r => {
      if (r?.vascular_surgery_assessment) return Array.isArray(r.vascular_surgery_assessment) ? r.vascular_surgery_assessment : [r.vascular_surgery_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.vascular_surgery_assessment) return Array.isArray(dd.vascular_surgery_assessment) ? dd.vascular_surgery_assessment : [dd.vascular_surgery_assessment]; return [dd]; }
      return [r];
    });
    const filtered = arr.filter(r => r && typeof r === 'object');
    filtered.forEach((r, i) => { r._originalIdx = i; });
    return filtered;
  }, [docProp, data, templateData]);

  /* safeId mirror at module-render scope for the rehydrate effect (records may carry _id.$oid). */
  const recordId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     localEdits is keyed by `${fn}-${idx}` with the full field value; pendingEdits keeps it OUT of PDF/Copy. */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record) => {
      const idx = record._originalIdx ?? 0;
      const rid = recordId(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fn, value]) => {
        const editKey = `${fn}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        if (SENTENCE_FIELDS.includes(fn)) nSentences[`${fn}-${idx}-s0`] = 'edited';
        else nFields[editKey] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records, recordId]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  /* hasFieldVal: null/undefined-safe presence check with per-field zero hiding (4-AREA RULE: used by JSX, Copy Section, Copy All and mirrored in PDF) */
  const hasFieldVal = useCallback((fn, v) => { if (HIDE_ZERO_FIELDS.includes(fn) && v === 0) return false; return hasVal(v); }, [hasVal]);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); const s = String(v || ''); return s.replace(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?/g, '$1 $2'); }, []);
  const arrItemText = useCallback((item) => { if (item === null || item === undefined) return ''; if (typeof item === 'object') return Object.values(item).filter(x => x !== null && x !== undefined && x !== '').map(String).join(' — '); return String(item); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  const splitBySemicolon = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/;\s*/).map(s => s.trim()).filter(Boolean);
  }, []);

  function reconstructFullText(sentences, isSemicolon) {
    if (!sentences || sentences.length === 0) return '';
    if (isSemicolon) return sentences.join('; ');
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

  const valueMatchesPhrase = useCallback((val, phrase) => {
    if (val === null || val === undefined) return false;
    if (Array.isArray(val)) {
      return val.some(item => arrItemText(item).toLowerCase().includes(phrase));
    }
    return fmtVal(val).toLowerCase().includes(phrase);
  }, [fmtVal, arrItemText]);

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
    return t.startsWith(p) || p.startsWith(t);
  }, [searchTerm]);

  /* ═══════ SEARCH — 4-LEVEL ═══════ */
  const shouldShowSection = useCallback((record, sid, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.startsWith(phrase) || phrase.startsWith(title)) return true;
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.startsWith(phrase) || phrase.startsWith(label)) return true;
      const val = getFieldValue(record, f, idx);
      if (!hasFieldVal(f, val)) continue;
      if (valueMatchesPhrase(val, phrase)) return true;
    }
    return false;
  }, [searchTerm, getFieldValue, valueMatchesPhrase, hasFieldVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (!hasFieldVal(fn, val)) return false;
    return valueMatchesPhrase(val, phrase);
  }, [searchTerm, getFieldValue, valueMatchesPhrase, hasFieldVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record) => {
      const oi = record._originalIdx ?? 0;
      record._showAllSections = false;
      /* Level 1: document title + record title */
      const docTitle = 'vascular surgery assessment';
      const rt = `vascular surgery assessment ${oi + 1}`;
      if (docTitle.includes(phrase) || phrase.includes(docTitle) || rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      /* Level 2: section titles */
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      /* Level 3: field labels (keyToLabel) */
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      /* Level 4: values */
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, oi);
          if (!hasFieldVal(f, val)) continue;
          if (valueMatchesPhrase(val, phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, valueMatchesPhrase, hasFieldVal]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record) => {
      const oi = record._originalIdx ?? 0;
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === oi) {
          merged[m[1]] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  /* stageDraft = the single point where a field's value is staged as a DRAFT: localEdits + pendingEdits
     + localStorage draft store (survives refresh). NO DB write here — Approve commits. */
  const stageDraft = useCallback((record, fn, idx, sid, value) => {
    const id = safeId(record); if (!id) return false;
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: value }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = value;
    writeDrafts(store);
    return true;
  }, [safeId]);

  // Save = stage a DRAFT locally (survives refresh). NOT written to MongoDB and NOT in the PDF
  // until the user clicks Approve (handleApproveSection commits). May be synchronous now.
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    if (!stageDraft(record, fn, idx, sid, saveVal)) return;
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const periodItems = splitBySentence(currentVal);
    const isSemicolon = periodItems.length < 2;
    const sentences = isSemicolon ? splitBySemicolon(currentVal) : periodItems;
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated, isSemicolon);
      setSaveError(null);
      if (!stageDraft(record, fn, idx, sid, fullText)) return;
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }
    const newPeriodItems = splitBySentence(editedVal);
    const newSentences = newPeriodItems.length >= 2 ? newPeriodItems : (isSemicolon ? splitBySemicolon(editedVal) : newPeriodItems);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated, isSemicolon);
    setSaveError(null);
    if (!stageDraft(record, fn, idx, sid, fullText)) return;
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    setEditingField(null); setEditValue('');
  }

  function saveCommaItem(record, fn, idx, sid, sIdx, ciIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const periodItems = splitBySentence(currentVal);
    const isSemicolon = periodItems.length < 2;
    const sentences = isSemicolon ? splitBySemicolon(currentVal) : periodItems;
    const s = sentences[sIdx] || '';
    const p = parseLabel(s);
    if (!p.isLabeled) return;
    const semiSub = splitBySemicolon(p.value);
    const useSemicolon = semiSub.length >= 2;
    const items = useSemicolon ? semiSub : splitByComma(p.value);
    const trimmed = editValue.trim();
    const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp);
    if (subParts.length > 1) { items.splice(ciIdx, 1, ...subParts); } else { items[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); }
    const joiner = useSemicolon ? '; ' : ', ';
    const rebuilt = `${p.label}: ${items.join(joiner)}.`;
    const allS = [...sentences]; allS[sIdx] = rebuilt;
    const fullText = reconstructFullText(allS, isSemicolon);
    setSaveError(null);
    if (!stageDraft(record, fn, idx, sid, fullText)) return;
    const sentenceKey = `${fn}-${idx}-s${sIdx}`;
    const commaKey = `${sentenceKey}-c${ciIdx}`;
    const marks = { [commaKey]: 'edited' };
    for (let ei = 1; ei < subParts.length; ei++) marks[`${sentenceKey}-c${ciIdx + ei}`] = 'added';
    setEditedSentences(prev => ({ ...prev, ...marks }));
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
  // localEdits is keyed `${fn}-${idx}` and holds the FULL field value (arrays included), so each
  // commit is { field: fn, value } — no arrayIndex needed.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true); setSaveError(null);
    try {
      // Commit only this section's pending drafts (key = `${fn}-${idx}`, fn in this section).
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        const m = k.match(/^(.+)-(\d+)$/);
        return m && parseInt(m[2], 10) === idx && fields.includes(m[1]);
      });
      for (const editKey of toCommit) {
        const m = editKey.match(/^(.+)-(\d+)$/);
        const fn = m[1];
        await secureApiClient.put(`/api/edit/vascular_surgery_assessment/${id}/edit`, { field: fn, value: localEdits[editKey] });
      }
      await secureApiClient.put(`/api/edit/vascular_surgery_assessment/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed fields from the localStorage draft store
      const store = readDrafts();
      if (store[id]) { toCommit.forEach(k => { const fn = k.match(/^(.+)-(\d+)$/)[1]; delete store[id][fn]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); setSaveError('Approve failed. Please try again.'); } finally { setSaving(false); }
  }, [safeId, localEdits, pendingEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection]);

  /* ═══════ COPY ═══════ */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySectionText = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* ═══════ FORMAT HELPERS FOR COPY ═══════ */
  const formatSentenceFieldLines = useCallback((text) => {
    const sentences = splitBySentence(text);
    const lines = []; let n = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        const semiItems = splitBySemicolon(parsed.value);
        const parts = semiItems.length >= 2 ? semiItems : splitByComma(parsed.value);
        const hasOxford = parts.some(ci => ci.trim().toLowerCase().startsWith('and '));
        if (parts.length >= 2 && !hasOxford) {
          lines.push(parsed.label + ':');
          parts.forEach(item => { lines.push(`  ${n++}. ${item}`); });
        } else { lines.push(parsed.label + ':'); lines.push(`  ${n++}. ${parsed.value}`); }
      } else { lines.push(`${n++}. ${s}`); }
    });
    return lines;
  }, [splitBySentence, splitBySemicolon]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title.toUpperCase()}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasFieldVal(f, val)) return;
      const showLabel = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
      if (ARRAY_FIELDS.includes(f)) {
        const items = (Array.isArray(val) ? val : [val]).map(arrItemText).filter(Boolean);
        if (items.length === 0) return;
        if (showLabel) text += `${label}\n`;
        text += `${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}\n\n`;
      } else if (BOOLEAN_FIELDS.includes(f)) {
        text += `${label}: ${val ? 'Yes' : 'No'}\n\n`;
      } else if (SENTENCE_FIELDS.includes(f)) {
        const strVal = fmtVal(val);
        const periodItems = splitBySentence(strVal);
        const isSemicolon = periodItems.length < 2;
        if (!isSemicolon) {
          if (showLabel) text += `${label}\n`;
          formatSentenceFieldLines(strVal).forEach(l => { text += `${l}\n`; });
          text += '\n';
        } else {
          const semiItems = splitBySemicolon(strVal);
          if (semiItems.length >= 2) {
            if (showLabel) text += `${label}\n`;
            semiItems.forEach((item, i) => { text += `${i + 1}. ${item}\n`; });
            text += '\n';
          } else {
            const commaItems = splitByComma(strVal);
            const hasOxfordCopy = commaItems.some(ci => ci.trim().toLowerCase().startsWith('and '));
            if (commaItems.length >= 2 && !hasOxfordCopy) {
              if (showLabel) text += `${label}\n`;
              commaItems.forEach((item, i) => { text += `${i + 1}. ${item}\n`; });
              text += '\n';
            } else {
              if (showLabel) text += `${label}\n`;
              text += `${strVal}\n\n`;
            }
          }
        }
      } else {
        text += `${label}: ${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, hasFieldVal, fmtVal, splitBySentence, splitBySemicolon, formatSentenceFieldLines, arrItemText]);

  const copyAllText = useCallback(async () => {
    let text = '=== VASCULAR SURGERY ASSESSMENT ===\n\n';
    pdfData.forEach((r) => {
      const oi = r._originalIdx ?? 0;
      text += `Vascular Surgery Assessment ${oi + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, oi, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: SIMPLE FIELD (no splitting — indices, classifications, locations) ═══════ */
  const renderSimpleField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasFieldVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { handleSaveField(record, fn, idx, sid, null, editValue); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, null, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: NUMERIC FIELD (typed number input — saves a real number) ═══════ */
  const renderNumericField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasFieldVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const commitNumeric = () => {
      const parsed = parseFloat(editValue);
      const saveVal = (editValue === '' || isNaN(parsed)) ? editValue.trim() : parsed;
      handleSaveField(record, fn, idx, sid, null, saveVal);
    };

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <input type="number" step="any" className="edit-input" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { commitNumeric(); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); commitNumeric(); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: BOOLEAN FIELD (Yes/No select) ═══════ */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasFieldVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
    const displayVal = val ? 'Yes' : 'No';
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(val ? 'Yes' : 'No'); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const boolVal = editValue === 'Yes'; handleSaveField(record, fn, idx, sid, null, boolVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: ARRAY FIELD (per-item editing with arrayIndex) ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(item => arrItemText(item)) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, itemIdx) => {
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemStr = arrItemText(item);

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
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); setSaveError(null); const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = editValue; if (!stageDraft(record, fn, idx, sid, currentArr)) return; setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: SENTENCE FIELD with splitBySentence / splitBySemicolon ═══════ */
  const renderSentenceField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasFieldVal(fn, val)) return null;
    const strVal = fmtVal(val);
    const periodItems = splitBySentence(strVal);
    const isSemicolon = periodItems.length < 2;
    const sentences = isSemicolon ? splitBySemicolon(strVal) : periodItems;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence: render with period-first splitting, parseLabel for subtitles */
    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn}>
          <div className="rec-mini-card">
            {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
            {sentences.map((sentence, sIdx) => {
              const sentenceKey = `${fn}-${idx}-s${sIdx}`;
              const isEditing = editingField === sentenceKey;
              const badge = editedSentences[sentenceKey];
              const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
              if (!sentenceMatches && searchTerm.trim()) return null;

              const parsed = parseLabel(sentence);
              if (parsed.isLabeled) {
                const semiItems2 = splitBySemicolon(parsed.value);
                const commaItems = semiItems2.length >= 2 ? semiItems2 : splitByComma(parsed.value);
                const hasOxfordComma = commaItems.some(ci => ci.trim().toLowerCase().startsWith('and '));
                const parsedLabelMatch = searchTerm.trim() && parsed.label.toLowerCase().includes(searchTerm.toLowerCase().trim());
                if (commaItems.length >= 2 && !hasOxfordComma) {
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
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const currentSentences = isSemicolon ? splitBySemicolon(String(getFieldValue(record, fn, idx) || '')) : splitBySentence(String(getFieldValue(record, fn, idx) || '')); currentSentences[sIdx] = reconstructed; const fullText = reconstructFullText(currentSentences, isSemicolon); setSaveError(null); if (!stageDraft(record, fn, idx, sid, fullText)) return; const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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

    /* Single-value: split comma items into separate rows (labeled or not) */
    const singleCommaItems = splitByComma(strVal);
    const hasOxfordComma = singleCommaItems.some(ci => ci.trim().toLowerCase().startsWith('and '));

    if (singleCommaItems.length >= 2 && !hasOxfordComma) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn}>
          <div className="rec-mini-card">
            {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
            {singleCommaItems.map((ci, ciIdx) => {
              const ciParsed = parseLabel(ci);
              const commaKey = `${fn}-${idx}-s0-c${ciIdx}`;
              const ciEditing = editingField === commaKey;
              const ciBadge = editedSentences[commaKey];
              const ciMatches = phraseMatch || labelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
              if (!ciMatches && searchTerm.trim()) return null;

              if (ciParsed.isLabeled) {
                return (
                  <div key={ciIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                    <div className="nested-subtitle">{highlightText(ciParsed.label)}</div>
                    <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ciParsed.value); setSaveError(null); } }}>
                      {ciEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const allItems = splitByComma(String(getFieldValue(record, fn, idx) || '')); allItems[ciIdx] = `${ciParsed.label}: ${editValue.trim()}`; const fullText = allItems.join(', '); setSaveError(null); if (!stageDraft(record, fn, idx, sid, fullText)) return; setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(ciParsed.value)}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${ciParsed.label}: ${ciParsed.value}`, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {ciBadge && <span className={`modified-badge ${ciBadge === 'added' ? 'added' : ''}`}>{ciBadge === 'added' ? 'added' : 'edited'} - click Pending Approve to save</span>}
                  </div>
                );
              }

              return (
                <div key={ciIdx}>
                  <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                    {ciEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const allItems = splitByComma(String(getFieldValue(record, fn, idx) || '')); allItems[ciIdx] = editValue.trim(); const fullText = allItems.join(', '); setSaveError(null); if (!stageDraft(record, fn, idx, sid, fullText)) return; setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                  {ciBadge && <span className={`modified-badge ${ciBadge === 'added' ? 'added' : ''}`}>{ciBadge === 'added' ? 'added' : 'edited'} - click Pending Approve to save</span>}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    /* Single-value string (no comma items): saveSentence editable */
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey] || editedSentences[`${fn}-${idx}-s0`];

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(strVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, 0); }}>{saving ? 'Saving...' : 'Save'}</button>
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
        {editedSentences[`${fn}-${idx}-s0`] && <span className={`modified-badge ${editedSentences[`${fn}-${idx}-s0`] === 'added' ? 'added' : ''}`}>{editedSentences[`${fn}-${idx}-s0`] === 'added' ? 'added' : 'edited'} - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid, idx)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => {
      const val = getFieldValue(record, f, idx);
      if (ARRAY_FIELDS.includes(f)) return Array.isArray(val) && val.some(item => arrItemText(item));
      return hasFieldVal(f, val);
    });
    if (!hasAnyVal) return null;

    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySectionText(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            if (NUMERIC_FIELDS.includes(f)) return renderNumericField(record, f, idx, sid);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceField(record, f, idx, sid);
            return renderSimpleField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="vascular-surgery-assessment-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Vascular Surgery Assessment</h2></div>
        <div className="empty-state">No vascular surgery assessment records available</div>
      </div>
    );
  }

  return (
    <div className="vascular-surgery-assessment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Vascular Surgery Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<VascularSurgeryAssessmentDocumentPDFTemplate document={pdfData} />} fileName={`vascular-surgery-assessment-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search vascular surgery assessment..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => {
          const origIdx = record._originalIdx ?? idx;
          return (
            <div key={safeId(record) || idx} className="record-card">
              <div className="record-header">
                <div className="header-top-row">
                  {hasVal(record.date) && (
                    <span className="date-badge">{highlightText(formatDate(record.date))}</span>
                  )}
                  {hasVal(record.status) && (
                    <span className="status-badge">{highlightText(fmtVal(record.status))}</span>
                  )}
                </div>
                <h3 className="record-name">{highlightText(`Vascular Surgery Assessment ${origIdx + 1}`)}</h3>
              </div>
              {renderSection(record, origIdx, 'vascular-history')}
              {renderSection(record, origIdx, 'arterial-perfusion')}
              {renderSection(record, origIdx, 'pulse-examination')}
              {renderSection(record, origIdx, 'duplex-ultrasound')}
              {renderSection(record, origIdx, 'wound-healing')}
              {renderSection(record, origIdx, 'aneurysm-assessment')}
              {renderSection(record, origIdx, 'venous-assessment')}
              {renderSection(record, origIdx, 'classification-grafts')}
              {renderSection(record, origIdx, 'arterial-calcification')}
              {renderSection(record, origIdx, 'limb-salvage')}
              {renderSection(record, origIdx, 'anticoagulation-symptoms')}
              {renderSection(record, origIdx, 'segmental-pressures')}
              {renderSection(record, origIdx, 'endovascular-interventions')}
              {renderSection(record, origIdx, 'dvt-risk-factors')}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VascularSurgeryAssessmentDocument;
