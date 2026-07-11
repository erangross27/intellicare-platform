/**
 * RespiratoryTherapyAssessmentDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: respiratory_therapy_assessment
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import RespiratoryTherapyAssessmentDocumentPDFTemplate from '../pdf-templates/RespiratoryTherapyAssessmentDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './RespiratoryTherapyAssessmentDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = field name; here field names have no dots) */
const DRAFT_KEY = 'respiratory_therapy_assessmentPendingEdits';
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
  diagnosis: 'Diagnosis & Scoring',
  vitals: 'Respiratory Vitals',
  mechanics: 'Ventilator Mechanics',
  gasExchange: 'Gas Exchange & Oxygenation',
  abg: 'Arterial Blood Gas Values',
  ventilator: 'Ventilator Settings',
  airway: 'Airway & Secretions',
  weaningReadiness: 'Weaning Readiness',
};

const FIELD_LABELS = {
  primaryDiagnosis: 'Primary Diagnosis',
  apacheIIScore: 'APACHE II Score',
  murrayLungInjuryScore: 'Murray Lung Injury Score',
  respiratoryRate: 'Respiratory Rate',
  tidalVolume: 'Tidal Volume',
  minuteVentilation: 'Minute Ventilation',
  peakInspiratoryPressure: 'Peak Inspiratory Pressure',
  plateauPressure: 'Plateau Pressure',
  positiveEndExpiratoryPressure: 'PEEP',
  staticCompliance: 'Static Compliance',
  dynamicCompliance: 'Dynamic Compliance',
  airwayResistance: 'Airway Resistance',
  paoToFio2Ratio: 'PaO2/FiO2 Ratio',
  oxygenationIndex: 'Oxygenation Index',
  spO2: 'SpO2',
  endTidalCO2: 'End-Tidal CO2',
  ventilatorMode: 'Ventilator Mode',
  fractionOfInspiredOxygen: 'FiO2',
  drivingPressure: 'Driving Pressure',
  rapidShallowBreathingIndex: 'Rapid Shallow Breathing Index',
  maximalInspiratoryPressure: 'Maximal Inspiratory Pressure',
  coughStrengthAssessment: 'Cough Strength Assessment',
  secretionCharacteristics: 'Secretion Characteristics',
  breathSoundsAuscultation: 'Breath Sounds Auscultation',
  borgDyspneaScale: 'Borg Dyspnea Scale',
  bronchodilatorResponse: 'Bronchodilator Response',
  spontaneousBreathingTrialResult: 'Spontaneous Breathing Trial Result',
  assessmentDateTime: 'Assessment Date/Time',
};

const SECTION_FIELDS = {
  diagnosis: ['primaryDiagnosis', 'apacheIIScore', 'murrayLungInjuryScore'],
  vitals: ['respiratoryRate', 'tidalVolume', 'minuteVentilation'],
  mechanics: ['peakInspiratoryPressure', 'plateauPressure', 'positiveEndExpiratoryPressure', 'staticCompliance', 'dynamicCompliance', 'airwayResistance', 'drivingPressure'],
  gasExchange: ['paoToFio2Ratio', 'oxygenationIndex', 'spO2', 'endTidalCO2'],
  ventilator: ['ventilatorMode', 'fractionOfInspiredOxygen'],
  airway: ['coughStrengthAssessment', 'secretionCharacteristics', 'breathSoundsAuscultation', 'borgDyspneaScale', 'bronchodilatorResponse'],
  weaningReadiness: ['rapidShallowBreathingIndex', 'maximalInspiratoryPressure', 'spontaneousBreathingTrialResult'],
};

const ARRAY_FIELDS = [];
const SENTENCE_FIELDS = ['primaryDiagnosis', 'secretionCharacteristics', 'breathSoundsAuscultation', 'spontaneousBreathingTrialResult'];
const NUMBER_FIELDS = ['apacheIIScore', 'murrayLungInjuryScore', 'respiratoryRate', 'tidalVolume', 'minuteVentilation', 'peakInspiratoryPressure', 'plateauPressure', 'positiveEndExpiratoryPressure', 'staticCompliance', 'dynamicCompliance', 'airwayResistance', 'paoToFio2Ratio', 'oxygenationIndex', 'spO2', 'endTidalCO2', 'fractionOfInspiredOxygen', 'drivingPressure', 'rapidShallowBreathingIndex', 'maximalInspiratoryPressure', 'borgDyspneaScale'];
const BOOLEAN_FIELDS = ['bronchodilatorResponse'];
const DATE_FIELDS = ['assessmentDateTime'];
// For these respiratory/ventilator/ABG metrics a stored 0 is a "not measured / not assessed"
// sentinel (PEEP=0, tidalVolume=0, pH never 0, compliance=0 etc. are physiologically meaningless
// as real assessment values), so 0 is hidden rather than rendered as a clinical reading.
const HIDE_ZERO_FIELDS = ['apacheIIScore', 'murrayLungInjuryScore', 'respiratoryRate', 'tidalVolume', 'minuteVentilation', 'peakInspiratoryPressure', 'plateauPressure', 'positiveEndExpiratoryPressure', 'staticCompliance', 'dynamicCompliance', 'airwayResistance', 'paoToFio2Ratio', 'oxygenationIndex', 'spO2', 'endTidalCO2', 'fractionOfInspiredOxygen', 'drivingPressure', 'rapidShallowBreathingIndex', 'maximalInspiratoryPressure', 'borgDyspneaScale'];
const parseLabel = (text) => { if (!text || typeof text !== 'string') return null; const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#-]{2,}?):\s+(.*)/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };

// ============== ABG BAR CHART HELPERS ==============
const ABG_RANGES = {
  pH: { low: 7.35, high: 7.45, scale: [7.0, 7.8] },
  PaO2: { low: 80, high: 100, scale: [0, 150] },
  PaCO2: { low: 35, high: 45, scale: [0, 80] },
  HCO3: { low: 22, high: 26, scale: [0, 40] },
  baseExcess: { low: -2, high: 2, scale: [-10, 10] },
};

const ABG_INTERPRETATIONS = {
  pH: { low: 'Acidosis', normal: 'Normal', high: 'Alkalosis' },
  PaO2: { low: 'Hypoxemia', normal: 'Normal', high: 'Hyperoxia' },
  PaCO2: { low: 'Resp Alkalosis', normal: 'Normal', high: 'Resp Acidosis' },
  HCO3: { low: 'Met Acidosis', normal: 'Normal', high: 'Met Alkalosis' },
  baseExcess: { low: 'Met Acidosis', normal: 'Normal', high: 'Met Alkalosis' },
};

const ABG_LABELS = { pH: 'pH', PaO2: 'PaO2', PaCO2: 'PaCO2', HCO3: 'HCO3', baseExcess: 'Base Excess' };

const getAbgBarColor = (value, key) => {
  const range = ABG_RANGES[key];
  if (!range || value === null || value === undefined) return '#9ca3af';
  if (value < range.low) return '#3b82f6';
  if (value > range.high) return '#ef4444';
  return '#22c55e';
};

const getAbgInterpretation = (value, key) => {
  const range = ABG_RANGES[key];
  const interp = ABG_INTERPRETATIONS[key];
  if (!range || !interp || value === null || value === undefined) return '';
  if (value < range.low) return interp.low;
  if (value > range.high) return interp.high;
  return interp.normal;
};

const abgToPercentage = (value, key) => {
  const range = ABG_RANGES[key];
  if (!range || value === null || value === undefined) return 0;
  const [min, max] = range.scale;
  return Math.min(100, Math.max(5, ((value - min) / (max - min)) * 100));
};

const AbgBarChart = ({ label, percentage, rawValue, color, interpretation, highlightFn }) => (
  <div className="abg-bar-row">
    <div className="abg-bar-label">{highlightFn ? highlightFn(label) : label}</div>
    <div className="abg-bar-container">
      <div className="abg-bar-background"><div className="abg-bar-fill" style={{ width: `${percentage}%`, backgroundColor: color }} /></div>
      <div className="abg-bar-value">{highlightFn ? highlightFn(String(rawValue)) : String(rawValue)}</div>
    </div>
    {interpretation && <div className="abg-bar-interpretation" style={{ color }}>{highlightFn ? highlightFn(interpretation) : interpretation}</div>}
  </div>
);

const AbgChartLegend = () => (
  <div className="abg-chart-legend">
    <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#22c55e' }} /><span>Normal</span></div>
    <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#3b82f6' }} /><span>Low</span></div>
    <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#ef4444' }} /><span>High</span></div>
  </div>
);

const RespiratoryTherapyAssessmentDocument = ({ document: docProp }) => {
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

  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.respiratory_therapy_assessment) return Array.isArray(r.respiratory_therapy_assessment) ? r.respiratory_therapy_assessment : [r.respiratory_therapy_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.respiratory_therapy_assessment) return Array.isArray(dd.respiratory_therapy_assessment) ? dd.respiratory_therapy_assessment : [dd.respiratory_therapy_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const rid = (!record?._id) ? null : (typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id)));
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = 'edited';
        nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  /* hasVal: 0 is valid for medical numeric fields */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; }, []);
  /* hasFieldVal: per-field presence with 0-sentinel hiding (used by JSX render, search, Copy Section, Copy All; mirrored in PDF) */
  const hasFieldVal = useCallback((fn, v) => { if (HIDE_ZERO_FIELDS.includes(fn) && v === 0) return false; return hasVal(v); }, [hasVal]);
  const formatDate = useCallback((d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);
  const splitBySentence = useCallback((text) => { if (!text || typeof text !== 'string') return []; const safe = text.replace(/\bvs\.\s/gi, 'vs\u200B ').replace(/\bRV\/TLC\b/g, 'RV\u200BTLC'); return safe.split(/\s+-\s+|[;.]\s+/).map(s => s.replace(/vs\u200B/g, 'vs.').replace(/RV\u200BTLC/g, 'RV/TLC').trim()).filter(s => s && !/^[;.,!?-]+$/.test(s)); }, []);
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
      else if (hasFieldVal(f, val)) { if (fmtVal(val).toLowerCase().includes(phrase)) return true; }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, hasFieldVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (ARRAY_FIELDS.includes(fn)) { const arr = Array.isArray(val) ? val : []; return arr.some(item => String(item).toLowerCase().includes(phrase)); }
    return hasFieldVal(fn, val) && fmtVal(val).toLowerCase().includes(phrase);
  }, [searchTerm, getFieldValue, fmtVal, hasFieldVal]);

  const sectionTitleMatches = useCallback((sid) => { if (!searchTerm.trim()) return false; const p = searchTerm.toLowerCase().trim(); const t = (SECTION_TITLES[sid] || '').toLowerCase(); return t.includes(p) || p.includes(t); }, [searchTerm]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Respiratory Therapy Assessment ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const f of Object.keys(FIELD_LABELS)) {
        const val = record[f];
        if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
        else if (hasFieldVal(f, val)) { if (fmtVal(val).toLowerCase().includes(phrase)) return true; }
      }
      // Search ABG interpretation terms (Acidosis, Hypoxemia, etc.)
      const abg = record.arterialBloodGasValues;
      if (Array.isArray(abg) && abg.length > 0) {
        const abgKeys = ['pH', 'PaO2', 'PaCO2', 'HCO3', 'baseExcess'];
        for (const entry of abg) {
          for (const k of abgKeys) {
            if (entry[k] !== undefined) {
              const interp = getAbgInterpretation(entry[k], k);
              if (interp && interp.toLowerCase().includes(phrase)) return true;
            }
          }
          if (entry.condition && String(entry.condition).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, fmtVal]);

  const pdfData = useMemo(() => filteredRecords.map((r, idx) => { const m = { ...r }; Object.keys(localEdits).forEach(k => { if (pendingEdits[k]) return; const mt = k.match(/^(.+)-(\d+)$/); if (mt && parseInt(mt[2]) === idx) m[mt[1]] = localEdits[k]; }); return m; }), [filteredRecords, localEdits, pendingEdits]);

  /* ========== EDIT ==========
     Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
     NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits). */
  const stageDraft = useCallback((id, fieldPart, value) => {
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = value;
    writeDrafts(store);
  }, []);
  // Re-edit after approval → drop this section's 'approved' flag so the button goes back to yellow Pending Approve.
  const clearApprovedForField = useCallback((idx, fn) => {
    setApprovedSections(prev => {
      let next = prev; let changed = false;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        if ((SECTION_FIELDS[sid] || []).includes(fn) && prev[`${sid}-${idx}`]) {
          if (!changed) { next = { ...prev }; changed = true; }
          delete next[`${sid}-${idx}`];
        }
      });
      return next;
    });
  }, []);

  const handleSaveField = useCallback((record, fn, idx) => {
    const id = safeId(record); if (!id) return;
    const trimmed = editValue.trim();
    let saveVal = trimmed;
    if (NUMBER_FIELDS.includes(fn)) {
      const numVal = parseFloat(trimmed);
      if (isNaN(numVal)) { setSaveError('Please enter a valid number'); return; }
      saveVal = numVal;
    } else if (BOOLEAN_FIELDS.includes(fn)) {
      saveVal = trimmed === 'yes';
    } else if (DATE_FIELDS.includes(fn)) {
      if (isNaN(new Date(trimmed).getTime())) { setSaveError('Please enter a valid date'); return; }
      saveVal = trimmed;
    }
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' }));
    clearApprovedForField(idx, fn);
    stageDraft(id, fn, saveVal);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft, clearApprovedForField]);

  const handleSaveArrayItem = useCallback((record, fn, idx, arrayIndex) => {
    const id = safeId(record); if (!id) return; setSaveError(null);
    const arr = [...(getEffectiveArray(record, fn, idx))]; arr[arrayIndex] = editValue;
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: arr }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-ai${arrayIndex}`]: 'edited' }));
    clearApprovedForField(idx, fn);
    stageDraft(id, fn, arr);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getEffectiveArray, stageDraft, clearApprovedForField]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || ''); const sentences = splitBySentence(currentVal); const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?-]+$/.test(editedVal)) { const updated = [...sentences]; updated.splice(sentenceIdx, 1); const fullText = reconstructFullText(updated); setSaveError(null);
      // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
      setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' })); clearApprovedForField(idx, fn); stageDraft(id, fn, fullText); setEditingField(null); setEditValue(''); return; }
    const newSentences = splitBySentence(editedVal); const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences); const fullText = reconstructFullText(updated); setSaveError(null);
    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    const orig = sentences[sentenceIdx] || ''; const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => { const n = { ...prev }; if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; const extra = newSentences.length - 1; for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; return n; });
    clearApprovedForField(idx, fn); stageDraft(id, fn, fullText); setEditingField(null); setEditValue('');
  }

  function saveCommaItem(record, fn, idx, sIdx, commaIdx, newItemText) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const parsed = parseLabel(sentences[sIdx]);
    if (!parsed) return;
    const items = parsed.content.split(/,\s*/).map(s => s.trim()).filter(Boolean);
    items[commaIdx] = newItemText.trim();
    const rebuilt = `${parsed.label}: ${items.join(', ')}.`;
    const allSentences = [...sentences]; allSentences[sIdx] = rebuilt;
    const fullText = reconstructFullText(allSentences);
    const commaKey = `${fn}-${idx}-s${sIdx}-c${commaIdx}`;
    setSaveError(null);
    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' })); clearApprovedForField(idx, fn); stageDraft(id, fn, fullText); setEditingField(null); setEditValue('');
  }

  const sectionHasEdits = useCallback((idx, sid) => { const fields = SECTION_FIELDS[sid] || []; return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))); }, [editedFields, editedSentences]);
  // Approve = COMMIT all staged drafts for this section's fields to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    try {
      // editKey convention here is `${fieldPart}-${idx}` (fieldPart = field name; no dotted arrayIndex used).
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix) && fields.includes(k.slice(0, -suffix.length)));
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        // Treat a trailing dot-segment as arrayIndex ONLY when it is purely numeric.
        const dotIdx = fieldPart.lastIndexOf('.');
        const tail = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const payload = { field: (dotIdx !== -1 && /^\d+$/.test(tail)) ? fieldPart.slice(0, dotIdx) : fieldPart, value: localEdits[editKey] };
        if (dotIdx !== -1 && /^\d+$/.test(tail)) payload.arrayIndex = parseInt(tail, 10);
        const resp = await secureApiClient.put(`/api/edit/respiratory_therapy_assessment/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/respiratory_therapy_assessment/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts for these fields from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) { fields.forEach(f => { delete store[id][f]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); }
  }, [safeId, localEdits, pendingEdits]);
  const renderApproveButton = useCallback((record, sid, idx) => { const hasEdits = sectionHasEdits(idx, sid); const isApproved = approvedSections[`${sid}-${idx}`]; if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>); if (isApproved) return <span className="approve-btn approved">Approved</span>; return null; }, [sectionHasEdits, approvedSections, handleApproveSection]);

  /* ========== COPY ========== */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid]; let text = `${title}\n${'='.repeat(40)}\n\n`;
    (SECTION_FIELDS[sid] || []).forEach(f => { const label = FIELD_LABELS[f] || f; const val = getFieldValue(record, f, idx); if (!hasFieldVal(f, val)) return;
      if (ARRAY_FIELDS.includes(f)) { text += `${label}\n`; (Array.isArray(val) ? val : []).forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); text += '\n'; }
      else if (SENTENCE_FIELDS.includes(f)) { text += `${label}\n`; splitBySentence(fmtVal(val)).forEach((s, i) => { const p = parseLabel(s); if (p) { const ci = p.content.split(/,\s*/).filter(Boolean); text += `${p.label}:\n`; ci.forEach((c, j) => { text += `  ${j + 1}. ${c.trim()}\n`; }); } else { text += `${i + 1}. ${s}\n`; } }); text += '\n'; }
      else { text += `${label}\n${fmtVal(val)}\n\n`; }
    }); return text;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence]);

  const buildAbgCopyText = useCallback((record, idx) => {
    const abg = record.arterialBloodGasValues;
    if (!Array.isArray(abg) || abg.length === 0) return '';
    let text = `Arterial Blood Gas Values\n${'='.repeat(40)}\n\n`;
    abg.forEach((entry, i) => {
      text += `ABG ${i + 1}`;
      if (entry.condition) text += ` (${entry.condition})`;
      text += '\n';
      if (entry.pH !== undefined) text += `  pH: ${entry.pH}\n`;
      if (entry.PaO2 !== undefined) text += `  PaO2: ${entry.PaO2}\n`;
      if (entry.PaCO2 !== undefined) text += `  PaCO2: ${entry.PaCO2}\n`;
      if (entry.HCO3 !== undefined) text += `  HCO3: ${entry.HCO3}\n`;
      if (entry.baseExcess !== undefined) text += `  Base Excess: ${entry.baseExcess}\n`;
      text += '\n';
    });
    return text;
  }, []);

  const copyAllText = useCallback(async () => {
    let text = '=== RESPIRATORY THERAPY ASSESSMENTS ===\n\n';
    pdfData.forEach((r, idx) => { text += `Respiratory Therapy Assessment ${idx + 1}\n${'='.repeat(40)}\n\n`;
      if (r.assessmentDateTime) text += `Assessment Date\n${formatDate(r.assessmentDateTime)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => { const fields = SECTION_FIELDS[sid]; const hasAny = fields.some(f => { if (ARRAY_FIELDS.includes(f)) return (Array.isArray(r[f]) ? r[f] : []).length > 0; return hasFieldVal(f, r[f]); }); if (!hasAny) return;
        text += `${SECTION_TITLES[sid]}\n${'-'.repeat(30)}\n`;
        fields.forEach(f => { const label = FIELD_LABELS[f] || f; const val = r[f]; if (!hasFieldVal(f, val)) return;
          if (ARRAY_FIELDS.includes(f)) { text += `${label}\n`; (Array.isArray(val) ? val : []).forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); text += '\n'; }
          else if (SENTENCE_FIELDS.includes(f)) { text += `${label}\n`; splitBySentence(fmtVal(val)).forEach((s, i) => { const p = parseLabel(s); if (p) { const ci = p.content.split(/,\s*/).filter(Boolean); text += `${p.label}:\n`; ci.forEach((c, j) => { text += `  ${j + 1}. ${c.trim()}\n`; }); } else { text += `${i + 1}. ${s}\n`; } }); text += '\n'; }
          else { text += `${label}\n${fmtVal(val)}\n\n`; }
        });
      });
      text += buildAbgCopyText(r, idx);
      text += '\n';
    });
    const ok = await copyToClipboard(text); if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, hasFieldVal, fmtVal, formatDate, splitBySentence, buildAbgCopyText]);

  /* ========== RENDER HELPERS ========== */
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasFieldVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey; const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase(); const displayVal = fmtVal(val); const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const startEdit = () => { if (!isEditing) { setEditingField(editKey); if (BOOLEAN_FIELDS.includes(fn)) { setEditValue(val ? 'yes' : 'no'); } else if (DATE_FIELDS.includes(fn)) { try { setEditValue(new Date(val.$date || val).toISOString().split('T')[0]); } catch { setEditValue(displayVal); } } else { setEditValue(displayVal); } setSaveError(null); } };
    const escHandler = e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } };
    const renderEditInput = () => { if (NUMBER_FIELDS.includes(fn)) return <input type="number" step="any" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={escHandler} />; if (BOOLEAN_FIELDS.includes(fn)) return <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={escHandler}><option value="yes">Yes</option><option value="no">No</option></select>; if (DATE_FIELDS.includes(fn)) return <input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={escHandler} />; return <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={escHandler} />; };
    return (<div key={fn} className={sl ? 'rec-mini-card' : ''}>{sl && <div className="nested-subtitle">{highlightText(label)}</div>}<div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={startEdit}>{isEditing ? (<div className="edit-field-container">{renderEditInput()}{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div>) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}</div>{isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}</div>);
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
        const commaItems = parsed.content.split(/,\s*/).map(s => s.trim()).filter(Boolean);
        if (commaItems.length > 1) {
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
        } else {
          /* Single-value labeled item: render label as nested-subtitle, edit only the value part */
          const saveLabeledSentence = () => {
            const id = safeId(record); if (!id) return;
            const currentVal = String(getFieldValue(record, fn, idx) || ''); const allSentences = splitBySentence(currentVal);
            const reconstructed = `${parsed.label}: ${editValue.trim()}`;
            const updated = [...allSentences]; updated[sIdx] = reconstructed; const fullText = reconstructFullText(updated);
            setSaveError(null);
            // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
            setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); setEditedSentences(prev => ({ ...prev, [sentenceKey]: 'edited' })); clearApprovedForField(idx, fn); stageDraft(id, fn, fullText); setEditingField(null); setEditValue('');
          };
          return (<div key={sIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
            <div className="nested-subtitle">{highlightText(parsed.label)}</div>
            <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.content); setSaveError(null); } }}>
              {isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveLabeledSentence(); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div>
              ) : (<><div className="row-content"><span className="content-value">{highlightText(parsed.content)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button></>)}
            </div>
            {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
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

  /* ========== ABG SECTION (array of objects) ========== */
  const renderAbgSection = (record, idx) => {
    const abg = record.arterialBloodGasValues;
    if (!Array.isArray(abg) || abg.length === 0) return null;
    const sid = 'abg';
    // Build searchable text including interpretation terms
    const abgSearchText = abg.flatMap(entry => {
      const keys = ['pH', 'PaO2', 'PaCO2', 'HCO3', 'baseExcess'];
      return keys.filter(k => entry[k] !== undefined).flatMap(k => [
        ABG_LABELS[k], String(entry[k]), getAbgInterpretation(entry[k], k),
      ]).concat(entry.condition ? [entry.condition] : []);
    }).join(' ');
    if (!shouldShowSection(record, sid)) {
      // manual check for ABG search including interpretation terms
      if (searchTerm.trim()) {
        const phrase = searchTerm.toLowerCase().trim();
        const title = SECTION_TITLES[sid].toLowerCase();
        if (!title.includes(phrase) && !phrase.includes(title)) {
          const anyMatch = abgSearchText.toLowerCase().includes(phrase) ||
            abg.some(entry => Object.values(entry).some(v => String(v).toLowerCase().includes(phrase)));
          if (!anyMatch) return null;
        }
      } else { return null; }
    }
    // Check if any ABG entry has numeric values for charting
    const hasChartData = abg.some(entry =>
      ['pH', 'PaO2', 'PaCO2', 'HCO3', 'baseExcess'].some(k => typeof entry[k] === 'number')
    );
    const copyId = `abg-${idx}`;
    return (
      <div key="abg" className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Arterial Blood Gas Values')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildAbgCopyText(record, idx), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
            </div>
          </div>
          {hasChartData ? (
            abg.map((entry, ai) => {
              const abgKeys = ['pH', 'PaO2', 'PaCO2', 'HCO3', 'baseExcess'];
              const chartEntries = abgKeys.filter(k => typeof entry[k] === 'number');
              if (chartEntries.length === 0) return null;
              return (
                <div key={ai} className="abg-chart-container">
                  <div className="abg-chart-subtitle">{highlightText(entry.condition || `ABG ${ai + 1}`)}</div>
                  <AbgChartLegend />
                  {chartEntries.map(k => (
                    <AbgBarChart
                      key={k}
                      label={ABG_LABELS[k]}
                      percentage={abgToPercentage(entry[k], k)}
                      rawValue={entry[k]}
                      color={getAbgBarColor(entry[k], k)}
                      interpretation={getAbgInterpretation(entry[k], k)}
                      highlightFn={highlightText}
                    />
                  ))}
                </div>
              );
            })
          ) : (
            /* Fallback: plain text rendering when no numeric data for charting */
            abg.map((entry, ai) => (
              <div key={ai} className="abg-card">
                <div className="abg-title">{highlightText(`ABG ${ai + 1}${entry.condition ? ` (${entry.condition})` : ''}`)}</div>
                <div className="abg-row">
                  {entry.pH !== undefined && <span className="abg-field"><span className="abg-label">{highlightText('pH')}:</span> {highlightText(String(entry.pH))}</span>}
                  {entry.PaO2 !== undefined && <span className="abg-field"><span className="abg-label">{highlightText('PaO2')}:</span> {highlightText(String(entry.PaO2))}</span>}
                  {entry.PaCO2 !== undefined && <span className="abg-field"><span className="abg-label">{highlightText('PaCO2')}:</span> {highlightText(String(entry.PaCO2))}</span>}
                  {entry.HCO3 !== undefined && <span className="abg-field"><span className="abg-label">{highlightText('HCO3')}:</span> {highlightText(String(entry.HCO3))}</span>}
                  {entry.baseExcess !== undefined && <span className="abg-field"><span className="abg-label">{highlightText('Base Excess')}:</span> {highlightText(String(entry.baseExcess))}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderMixedSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid]; if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => { if (ARRAY_FIELDS.includes(f)) return getEffectiveArray(record, f, idx).length > 0; return hasFieldVal(f, getFieldValue(record, f, idx)); });
    if (!hasAnyVal) return null;
    const copyId = `${sid}-${idx}`;
    return (<div key={sid} className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>{renderApproveButton(record, sid, idx)}</div></div>{fields.map(f => { if (ARRAY_FIELDS.includes(f)) return renderArraySection(record, f, idx, sid, title); if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title); return renderEditableField(record, f, idx, sid, title); })}</div></div>);
  };

  if (!records || records.length === 0) return (<div className="respiratory-therapy-assessment-document" ref={containerRef}><div className="document-header"><h2 className="document-title">Respiratory Therapy Assessments</h2></div><div className="empty-state">No respiratory therapy assessment records available</div></div>);

  return (
    <div className="respiratory-therapy-assessment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Respiratory Therapy Assessments</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<RespiratoryTherapyAssessmentDocumentPDFTemplate document={pdfData} />} fileName={`respiratory-therapy-assessment-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container"><input type="text" className="search-input" placeholder="Search respiratory therapy assessments..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />{searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}</div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header"><div className="record-meta-row">{record.assessmentDateTime && <span className="record-date">{highlightText(formatDate(record.assessmentDateTime))}</span>}</div><h3 className="record-name">{highlightText(`Respiratory Therapy Assessment ${idx + 1}`)}</h3></div>
            {renderMixedSection(record, idx, 'diagnosis')}
            {renderMixedSection(record, idx, 'vitals')}
            {renderMixedSection(record, idx, 'mechanics')}
            {renderMixedSection(record, idx, 'gasExchange')}
            {renderAbgSection(record, idx)}
            {renderMixedSection(record, idx, 'ventilator')}
            {renderMixedSection(record, idx, 'airway')}
            {renderMixedSection(record, idx, 'weaningReadiness')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RespiratoryTherapyAssessmentDocument;
