/**
 * BronchialHygieneTherapyDocument.jsx
 * March 2026 -- Blue glow editing theme
 * Collection: bronchial_hygiene_therapy
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BronchialHygieneTherapyDocumentPDFTemplate from '../pdf-templates/BronchialHygieneTherapyDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './BronchialHygieneTherapyDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the localEdits field key, e.g. "sputumVolumeML") */
const DRAFT_KEY = 'bronchial_hygiene_therapyPendingEdits';
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
  sessionInfo: 'Session Information',
  chestPhysiotherapy: 'Chest Physiotherapy',
  hfcwo: 'High-Frequency Chest Wall Oscillation',
  pepBreathing: 'PEP & Breathing Techniques',
  mie: 'Mechanical Insufflation-Exsufflation',
  sputumFindings: 'Sputum & Cough Findings',
  auscultation: 'Auscultation',
  adjunctTherapy: 'Adjunct Therapy & Tolerance',
};

const FIELD_LABELS = {
  therapyDate: 'Therapy Date', primaryIndication: 'Primary Indication',
  baselineSpO2: 'Baseline SpO2', postTherapySpO2: 'Post-Therapy SpO2',
  chestPhysiotherapyTechnique: 'Chest Physiotherapy Technique',
  posturalDrainagePositions: 'Postural Drainage Positions',
  percussionDurationMinutes: 'Percussion Duration (minutes)',
  highFrequencyChestWallOscillation: 'HFCWO Performed',
  hfcwoFrequencyHz: 'HFCWO Frequency (Hz)', hfcwoPressureLevel: 'HFCWO Pressure Level',
  positiveExpiratoryPressureDevice: 'PEP Device',
  pepPressureRangeCmH2O: 'PEP Pressure Range (cmH2O)',
  activeBreathingCycleCompleted: 'Active Breathing Cycle Completed',
  autogenicDrainagePhase: 'Autogenic Drainage Phase',
  mechanicalInsufflationExsufflation: 'MI-E Performed',
  mieInsufflationPressureCmH2O: 'MI-E Insufflation Pressure (cmH2O)',
  mieExsufflationPressureCmH2O: 'MI-E Exsufflation Pressure (cmH2O)',
  sputumCharacteristics: 'Sputum Characteristics',
  sputumVolumeML: 'Sputum Volume (mL)',
  preTherapyPeakCoughFlowLPM: 'Pre-Therapy Peak Cough Flow (LPM)',
  postTherapyPeakCoughFlowLPM: 'Post-Therapy Peak Cough Flow (LPM)',
  auscultationFindingsPreTherapy: 'Auscultation Findings Pre-Therapy',
  auscultationFindingsPostTherapy: 'Auscultation Findings Post-Therapy',
  nebulizedMucolyticAgent: 'Nebulized Mucolytic Agent',
  bronchodilatorPretreatment: 'Bronchodilator Pretreatment',
  therapyToleranceScore: 'Therapy Tolerance Score',
};

const SECTION_FIELDS = {
  sessionInfo: ['therapyDate', 'primaryIndication', 'baselineSpO2', 'postTherapySpO2'],
  chestPhysiotherapy: ['chestPhysiotherapyTechnique', 'posturalDrainagePositions', 'percussionDurationMinutes'],
  hfcwo: ['highFrequencyChestWallOscillation', 'hfcwoFrequencyHz', 'hfcwoPressureLevel'],
  pepBreathing: ['positiveExpiratoryPressureDevice', 'pepPressureRangeCmH2O', 'activeBreathingCycleCompleted', 'autogenicDrainagePhase'],
  mie: ['mechanicalInsufflationExsufflation', 'mieInsufflationPressureCmH2O', 'mieExsufflationPressureCmH2O'],
  sputumFindings: ['sputumCharacteristics', 'sputumVolumeML', 'preTherapyPeakCoughFlowLPM', 'postTherapyPeakCoughFlowLPM'],
  auscultation: ['auscultationFindingsPreTherapy', 'auscultationFindingsPostTherapy'],
  adjunctTherapy: ['nebulizedMucolyticAgent', 'bronchodilatorPretreatment', 'therapyToleranceScore'],
};

const ARRAY_FIELDS = ['posturalDrainagePositions'];
const SENTENCE_FIELDS = ['primaryIndication', 'chestPhysiotherapyTechnique', 'sputumCharacteristics', 'auscultationFindingsPreTherapy', 'auscultationFindingsPostTherapy', 'nebulizedMucolyticAgent', 'bronchodilatorPretreatment'];
const NUMBER_FIELDS = ['baselineSpO2', 'postTherapySpO2', 'percussionDurationMinutes', 'hfcwoFrequencyHz', 'hfcwoPressureLevel', 'mieInsufflationPressureCmH2O', 'mieExsufflationPressureCmH2O', 'sputumVolumeML', 'preTherapyPeakCoughFlowLPM', 'postTherapyPeakCoughFlowLPM', 'therapyToleranceScore'];
const BOOLEAN_FIELDS = ['highFrequencyChestWallOscillation', 'activeBreathingCycleCompleted', 'mechanicalInsufflationExsufflation'];
const DATE_FIELDS = ['therapyDate'];
const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};
const parseLabel = (text) => { if (!text || typeof text !== 'string') return null; const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{2,}?):\s+(.*)/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '"' || ch === "'") { depth++; current += ch; }
    else if (ch === ')' || (depth > 0 && (ch === '"' || ch === "'"))) { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const BronchialHygieneTherapyDocument = ({ document: docProp }) => {
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
      if (r?.bronchial_hygiene_therapy) return Array.isArray(r.bronchial_hygiene_therapy) ? r.bronchial_hygiene_therapy : [r.bronchial_hygiene_therapy];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.bronchial_hygiene_therapy) return Array.isArray(dd.bronchial_hygiene_therapy) ? dd.bronchial_hygiene_therapy : [dd.bronchial_hygiene_therapy]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idFor = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = idFor(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldKey, value]) => {
        const editKey = `${fieldKey}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        if (SENTENCE_FIELDS.includes(fieldKey)) nSentences[`${fieldKey}-${idx}-s0`] = 'edited';
        else if (ARRAY_FIELDS.includes(fieldKey)) nFields[`${fieldKey}-${idx}-ai0`] = 'edited';
        else nFields[editKey] = 'edited';
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
      const rt = `Bronchial Hygiene Therapy ${idx + 1}`.toLowerCase();
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
  /* Find the section that owns a field (so a re-edit can drop that section's green 'approved' flag). */
  const sidForField = useCallback((fn) => Object.keys(SECTION_FIELDS).find(sid => (SECTION_FIELDS[sid] || []).includes(fn)) || null, []);
  /* Stage a DRAFT for this record's field into the localStorage draft store (survives refresh). */
  const stageDraft = useCallback((record, fieldKey, value) => {
    const id = safeId(record); if (!id) return;
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldKey] = value;
    writeDrafts(store);
  }, [safeId]);
  /* On (re-)edit, drop the owning section's green 'approved' flag so the button returns to yellow Pending Approve. */
  const clearApprovedForField = useCallback((fn, idx) => {
    const sid = sidForField(fn); if (!sid) return;
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
  }, [sidForField]);

  // Save = stage a DRAFT locally + localStorage. NOT written to MongoDB / NOT shown in PDF until Approve.
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
    clearApprovedForField(fn, idx);
    stageDraft(record, fn, saveVal);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft, clearApprovedForField]);

  const handleSaveArrayItem = useCallback((record, fn, idx, arrayIndex) => {
    const id = safeId(record); if (!id) return; setSaveError(null);
    const arr = [...(getEffectiveArray(record, fn, idx))]; arr[arrayIndex] = editValue;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: arr }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-ai${arrayIndex}`]: 'edited' }));
    clearApprovedForField(fn, idx);
    stageDraft(record, fn, arr);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getEffectiveArray, stageDraft, clearApprovedForField]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || ''); const sentences = splitBySentence(currentVal); const editedVal = editValue.trim();
    const editKey = `${fn}-${idx}`;
    if (!editedVal || /^[;.,!?-]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1); const fullText = reconstructFullText(updated); setSaveError(null);
      setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
      setPendingEdits(prev => ({ ...prev, [editKey]: true }));
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      clearApprovedForField(fn, idx);
      stageDraft(record, fn, fullText);
      setEditingField(null); setEditValue(''); return;
    }
    const newSentences = splitBySentence(editedVal); const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences); const fullText = reconstructFullText(updated); setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const orig = sentences[sentenceIdx] || ''; const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => { const n = { ...prev }; if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; const extra = newSentences.length - 1; for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; return n; });
    clearApprovedForField(fn, idx);
    stageDraft(record, fn, fullText);
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
    const rebuilt = `${parsed.label}: ${items.join(', ')}.`;
    const allSentences = [...sentences]; allSentences[sIdx] = rebuilt;
    const fullText = reconstructFullText(allSentences);
    const commaKey = `${fn}-${idx}-s${sIdx}-c${commaIdx}`;
    const editKey = `${fn}-${idx}`;
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' }));
    clearApprovedForField(fn, idx);
    stageDraft(record, fn, fullText);
    setEditingField(null); setEditValue('');
  }

  const sectionHasEdits = useCallback((idx, sid) => { const fields = SECTION_FIELDS[sid] || []; return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))); }, [editedFields, editedSentences]);
  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    // Collect this record's pending edits for this section's fields (editKey = "field-idx").
    const toCommit = fields.map(f => `${f}-${idx}`).filter(k => pendingEdits[k] && localEdits[k] !== undefined);
    try {
      for (const editKey of toCommit) {
        const f = editKey.slice(0, -`-${idx}`.length);
        await secureApiClient.put(`/api/edit/bronchial_hygiene_therapy/${id}/edit`, { field: f, value: localEdits[editKey] });
      }
      await secureApiClient.put(`/api/edit/bronchial_hygiene_therapy/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts (now committed) for the approved fields
      const store = readDrafts();
      if (store[id]) { fields.forEach(f => { delete store[id][f]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); }
  }, [safeId, pendingEdits, localEdits]);
  const renderApproveButton = useCallback((record, sid, idx) => { const hasEdits = sectionHasEdits(idx, sid); const isApproved = approvedSections[`${sid}-${idx}`]; if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>); if (isApproved) return <span className="approve-btn approved">Approved</span>; return null; }, [sectionHasEdits, approvedSections, handleApproveSection]);

  /* ========== COPY ========== */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid]; let text = `${title}\n${'='.repeat(40)}\n\n`;
    (SECTION_FIELDS[sid] || []).forEach(f => { const label = FIELD_LABELS[f] || f; const val = getFieldValue(record, f, idx); if (!hasVal(val)) return;
      if (ARRAY_FIELDS.includes(f)) { text += `${label}\n`; (Array.isArray(val) ? val : []).forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); text += '\n'; }
      else if (SENTENCE_FIELDS.includes(f)) { text += `${label}\n`; splitBySentence(fmtVal(val)).forEach((s, i) => { const p = parseLabel(s); if (p) { const ci = splitByComma(p.content); text += `${p.label}:\n`; ci.forEach((c, j) => { text += `  ${j + 1}. ${c.trim()}\n`; }); } else { text += `${i + 1}. ${s}\n`; } }); text += '\n'; }
      else { text += `${label}\n${fmtVal(val)}\n\n`; }
    }); return text;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence]);

  const copyAllText = useCallback(async () => {
    let text = '=== BRONCHIAL HYGIENE THERAPY ===\n\n';
    pdfData.forEach((r, idx) => { text += `Bronchial Hygiene Therapy ${idx + 1}\n${'='.repeat(40)}\n\n`;
      if (r.therapyDate) text += `Therapy Date\n${formatDate(r.therapyDate)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => { const fields = SECTION_FIELDS[sid]; const hasAny = fields.some(f => { if (ARRAY_FIELDS.includes(f)) return (Array.isArray(r[f]) ? r[f] : []).length > 0; return hasVal(r[f]); }); if (!hasAny) return;
        text += `${SECTION_TITLES[sid]}\n${'-'.repeat(30)}\n`;
        fields.forEach(f => { const label = FIELD_LABELS[f] || f; const val = r[f]; if (!hasVal(val)) return;
          if (ARRAY_FIELDS.includes(f)) { text += `${label}\n`; (Array.isArray(val) ? val : []).forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); text += '\n'; }
          else if (SENTENCE_FIELDS.includes(f)) { text += `${label}\n`; splitBySentence(fmtVal(val)).forEach((s, i) => { const p = parseLabel(s); if (p) { const ci = splitByComma(p.content); text += `${p.label}:\n`; ci.forEach((c, j) => { text += `  ${j + 1}. ${c.trim()}\n`; }); } else { text += `${i + 1}. ${s}\n`; } }); text += '\n'; }
          else { text += `${label}\n${fmtVal(val)}\n\n`; }
        });
      }); text += '\n';
    });
    const ok = await copyToClipboard(text); if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, hasVal, fmtVal, formatDate, splitBySentence]);

  /* ========== RENDER HELPERS ========== */
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey; const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase(); const displayVal = DATE_FIELDS.includes(fn) ? formatDate(val) : fmtVal(val); const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const isNumber = NUMBER_FIELDS.includes(fn);
    const isBoolean = BOOLEAN_FIELDS.includes(fn);
    const isDate = DATE_FIELDS.includes(fn);
    const startEdit = () => { if (!isEditing) { setEditingField(editKey); if (isBoolean) { const raw = val; setEditValue(raw === true || raw === 'Yes' || raw === 'yes' || raw === 'true' ? 'yes' : 'no'); } else if (isDate) { setEditValue(toInputDate(val)); } else { setEditValue(displayVal); } setSaveError(null); } };
    let editInput;
    if (isEditing) {
      if (isNumber) { editInput = <input type="number" step="any" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); handleSaveField(record, fn, idx); } }} />; }
      else if (isBoolean) { editInput = <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}><option value="yes">Yes</option><option value="no">No</option></select>; }
      else if (isDate) { editInput = <input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />; }
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
    const hasAnyVal = fields.some(f => { if (ARRAY_FIELDS.includes(f)) return getEffectiveArray(record, f, idx).length > 0; return hasVal(getFieldValue(record, f, idx)); });
    if (!hasAnyVal) return null;
    const copyId = `${sid}-${idx}`;
    return (<div key={sid} className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>{renderApproveButton(record, sid, idx)}</div></div>{fields.map(f => { if (ARRAY_FIELDS.includes(f)) return renderArraySection(record, f, idx, sid, title); if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title); return renderEditableField(record, f, idx, sid, title); })}</div></div>);
  };

  if (!records || records.length === 0) return (<div className="bronchial-hygiene-therapy-document" ref={containerRef}><div className="document-header"><h2 className="document-title">Bronchial Hygiene Therapy</h2></div><div className="empty-state">No bronchial hygiene therapy records available</div></div>);

  return (
    <div className="bronchial-hygiene-therapy-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Bronchial Hygiene Therapy</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<BronchialHygieneTherapyDocumentPDFTemplate document={pdfData} />} fileName={`bronchial-hygiene-therapy-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container"><input type="text" className="search-input" placeholder="Search bronchial hygiene therapy..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />{searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}</div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header"><div className="record-meta-row">{record.therapyDate && <span className="record-date">{highlightText(formatDate(record.therapyDate))}</span>}</div><h3 className="record-name">{highlightText(`Bronchial Hygiene Therapy ${idx + 1}`)}</h3></div>
            {renderMixedSection(record, idx, 'sessionInfo')}
            {renderMixedSection(record, idx, 'chestPhysiotherapy')}
            {renderMixedSection(record, idx, 'hfcwo')}
            {renderMixedSection(record, idx, 'pepBreathing')}
            {renderMixedSection(record, idx, 'mie')}
            {renderMixedSection(record, idx, 'sputumFindings')}
            {renderMixedSection(record, idx, 'auscultation')}
            {renderMixedSection(record, idx, 'adjunctTherapy')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BronchialHygieneTherapyDocument;
