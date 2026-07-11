/**
 * AirwayClearanceTherapyDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: airway_clearance_therapy
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import AirwayClearanceTherapyDocumentPDFTemplate from '../pdf-templates/AirwayClearanceTherapyDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './AirwayClearanceTherapyDocument.css';

const SECTION_TITLES = {
  diagnosis: 'Diagnosis & Oxygenation',
  cpt: 'Chest Physiotherapy',
  hfcwo: 'High-Frequency Chest Wall Oscillation',
  pep: 'Positive Expiratory Pressure',
  ipvMie: 'IPV & Mechanical Insufflation-Exsufflation',
  sputum: 'Sputum & Cough Flow',
  auscultation: 'Auscultation Findings',
  tolerance: 'Therapy Duration & Tolerance',
};

const FIELD_LABELS = {
  primaryDiagnosis: 'Primary Diagnosis',
  baselineSpO2: 'Baseline SpO2',
  postTherapySpO2: 'Post-Therapy SpO2',
  supplementalOxygenFlowRate: 'Supplemental O2 Flow Rate',
  chestPhysiotherapyTechnique: 'Chest Physiotherapy Technique',
  highFrequencyChestWallOscillation: 'HFCWO Used',
  hfcwoFrequencySetting: 'HFCWO Frequency Setting',
  hfcwoPressureSetting: 'HFCWO Pressure Setting',
  positivExpiratoryPressureDevice: 'PEP Device',
  pepResistanceSetting: 'PEP Resistance Setting',
  intrapulmonaryPercussiveVentilation: 'IPV Used',
  ipvOperatingPressure: 'IPV Operating Pressure',
  mechanicalInsufflationExsufflation: 'MI-E Used',
  mieInsufflationPressure: 'MI-E Insufflation Pressure',
  mieExsufflationPressure: 'MI-E Exsufflation Pressure',
  sputumProductionVolume: 'Sputum Volume (mL)',
  sputumCharacteristics: 'Sputum Characteristics',
  preTherapyPeakCoughFlow: 'Pre-Therapy Peak Cough Flow',
  postTherapyPeakCoughFlow: 'Post-Therapy Peak Cough Flow',
  auscultationFindingsPreTherapy: 'Pre-Therapy Auscultation',
  auscultationFindingsPostTherapy: 'Post-Therapy Auscultation',
  therapyDurationMinutes: 'Therapy Duration (min)',
  posturalDrainagePositions: 'Postural Drainage Positions',
  patientToleranceBorgScale: 'Borg Scale (Tolerance)',
  adverseEventsObserved: 'Adverse Events',
};

const SECTION_FIELDS = {
  diagnosis: ['primaryDiagnosis', 'baselineSpO2', 'postTherapySpO2', 'supplementalOxygenFlowRate'],
  cpt: ['chestPhysiotherapyTechnique'],
  hfcwo: ['highFrequencyChestWallOscillation', 'hfcwoFrequencySetting', 'hfcwoPressureSetting'],
  pep: ['positivExpiratoryPressureDevice', 'pepResistanceSetting'],
  ipvMie: ['intrapulmonaryPercussiveVentilation', 'ipvOperatingPressure', 'mechanicalInsufflationExsufflation', 'mieInsufflationPressure', 'mieExsufflationPressure'],
  sputum: ['sputumProductionVolume', 'sputumCharacteristics', 'preTherapyPeakCoughFlow', 'postTherapyPeakCoughFlow'],
  auscultation: ['auscultationFindingsPreTherapy', 'auscultationFindingsPostTherapy'],
  tolerance: ['therapyDurationMinutes', 'posturalDrainagePositions', 'patientToleranceBorgScale', 'adverseEventsObserved'],
};

const ARRAY_FIELDS = ['posturalDrainagePositions', 'adverseEventsObserved'];
const SENTENCE_FIELDS = ['primaryDiagnosis', 'chestPhysiotherapyTechnique', 'sputumCharacteristics', 'auscultationFindingsPreTherapy', 'auscultationFindingsPostTherapy'];
const NUMBER_FIELDS = ['baselineSpO2', 'postTherapySpO2', 'supplementalOxygenFlowRate', 'hfcwoFrequencySetting', 'hfcwoPressureSetting', 'pepResistanceSetting', 'ipvOperatingPressure', 'mieInsufflationPressure', 'mieExsufflationPressure', 'sputumProductionVolume', 'preTherapyPeakCoughFlow', 'postTherapyPeakCoughFlow', 'therapyDurationMinutes', 'patientToleranceBorgScale'];
const BOOLEAN_FIELDS = ['highFrequencyChestWallOscillation', 'intrapulmonaryPercussiveVentilation', 'mechanicalInsufflationExsufflation'];
const DATE_FIELDS = [];
const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};
const parseLabel = (text) => { if (!text || typeof text !== 'string') return null; const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#-]{2,}?):\s+(.*)/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = editKey without the "-<idx>" suffix) */
const DRAFT_KEY = 'airway_clearance_therapyPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const AirwayClearanceTherapyDocument = ({ document: docProp }) => {
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
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.airway_clearance_therapy) return Array.isArray(r.airway_clearance_therapy) ? r.airway_clearance_therapy : [r.airway_clearance_therapy];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.airway_clearance_therapy) return Array.isArray(dd.airway_clearance_therapy) ? dd.airway_clearance_therapy : [dd.airway_clearance_therapy]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* recordKey: stable id for the draft store (handles _id.$oid). Defined early for the rehydrate effect. */
  const recordKey = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = recordKey(record);
      const recDrafts = id ? store[id] : null;
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
      const rt = `Airway Clearance Therapy ${idx + 1}`.toLowerCase();
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
  /* Find the sectionId that owns a field — used to reset that section's approve button on re-edit. */
  const sectionIdForField = useCallback((fn) => Object.keys(SECTION_FIELDS).find(sid => (SECTION_FIELDS[sid] || []).includes(fn)) || null, []);
  /* Stage a single field's value as a DRAFT (localStorage + state). No DB write — Approve commits it. */
  const stageDraft = useCallback((record, idx, fieldPart, value, sid) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fieldPart}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const resolvedSid = sid || sectionIdForField(fieldPart);
    // Re-edit after approval → drop this section's 'approved' flag so the button returns to yellow Pending.
    if (resolvedSid) setApprovedSections(prev => { const k = `${resolvedSid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = value;
    writeDrafts(store);
  }, [safeId, sectionIdForField]);

  // Save = stage a DRAFT locally (survives refresh). NOT written to MongoDB and NOT shown in the PDF
  // until the user clicks Approve (handleApproveSection commits). May run synchronously now.
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    stageDraft(record, idx, fn, saveVal, sid);
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  const handleSaveArrayItem = useCallback((record, fn, idx, arrayIndex) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    const arr = [...(getEffectiveArray(record, fn, idx))]; arr[arrayIndex] = editValue;
    stageDraft(record, idx, fn, arr);
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-ai${arrayIndex}`]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getEffectiveArray, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || ''); const sentences = splitBySentence(currentVal); const editedVal = editValue.trim();
    setSaveError(null);
    if (!editedVal || /^[;.,!?-]+$/.test(editedVal)) { const updated = [...sentences]; updated.splice(sentenceIdx, 1); const fullText = reconstructFullText(updated);
      stageDraft(record, idx, fn, fullText, sid); setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' })); setEditingField(null); setEditValue(''); return; }
    const newSentences = splitBySentence(editedVal); const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences); const fullText = reconstructFullText(updated);
    stageDraft(record, idx, fn, fullText, sid);
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
    const items = parsed.content.split(/,\s*/).map(s => s.trim()).filter(Boolean);
    items[commaIdx] = newItemText.trim();
    const rebuilt = `${parsed.label}: ${items.join(', ')}.`;
    const allSentences = [...sentences]; allSentences[sIdx] = rebuilt;
    const fullText = reconstructFullText(allSentences);
    const commaKey = `${fn}-${idx}-s${sIdx}-c${commaIdx}`;
    setSaveError(null);
    stageDraft(record, idx, fn, fullText);
    setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' })); setEditingField(null); setEditValue('');
  }

  const sectionHasEdits = useCallback((idx, sid) => { const fields = SECTION_FIELDS[sid] || []; return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))); }, [editedFields, editedSentences]);
  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    try {
      // Each staged field for this section is stored under "<field>-<idx>" (whole-field value).
      const toCommit = fields.map(f => `${f}-${idx}`).filter(k => pendingEdits[k] && localEdits[k] !== undefined);
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -(`-${idx}`.length)); // bare field name (no dot suffix in this template)
        const payload = { field: fieldPart, value: localEdits[editKey] };
        const dotIdx = fieldPart.lastIndexOf('.');
        if (dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1))) { payload.field = fieldPart.slice(0, dotIdx); payload.arrayIndex = parseInt(fieldPart.slice(dotIdx + 1), 10); }
        await secureApiClient.put(`/api/edit/airway_clearance_therapy/${id}/edit`, payload);
      }
      await secureApiClient.put(`/api/edit/airway_clearance_therapy/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this section's committed fields from the localStorage draft store
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
      else if (SENTENCE_FIELDS.includes(f)) { text += `${label}\n`; splitBySentence(fmtVal(val)).forEach((s, i) => { const p = parseLabel(s); if (p) { const ci = p.content.split(/,\s*/).filter(Boolean); text += `${p.label}:\n`; ci.forEach((c, j) => { text += `  ${j + 1}. ${c.trim()}\n`; }); } else { text += `${i + 1}. ${s}\n`; } }); text += '\n'; }
      else { text += `${label}\n${fmtVal(val)}\n\n`; }
    }); return text;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence]);

  const copyAllText = useCallback(async () => {
    let text = '=== AIRWAY CLEARANCE THERAPY ===\n\n';
    pdfData.forEach((r, idx) => { text += `Airway Clearance Therapy ${idx + 1}\n${'='.repeat(40)}\n\n`;
      if (r.date) text += `Date\n${formatDate(r.date)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => { const fields = SECTION_FIELDS[sid]; const hasAny = fields.some(f => { if (ARRAY_FIELDS.includes(f)) return (Array.isArray(r[f]) ? r[f] : []).length > 0; return hasVal(r[f]); }); if (!hasAny) return;
        text += `${SECTION_TITLES[sid]}\n${'-'.repeat(30)}\n`;
        fields.forEach(f => { const label = FIELD_LABELS[f] || f; const val = r[f]; if (!hasVal(val)) return;
          if (ARRAY_FIELDS.includes(f)) { text += `${label}\n`; (Array.isArray(val) ? val : []).forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); text += '\n'; }
          else if (SENTENCE_FIELDS.includes(f)) { text += `${label}\n`; splitBySentence(fmtVal(val)).forEach((s, i) => { const p = parseLabel(s); if (p) { const ci = p.content.split(/,\s*/).filter(Boolean); text += `${p.label}:\n`; ci.forEach((c, j) => { text += `  ${j + 1}. ${c.trim()}\n`; }); } else { text += `${i + 1}. ${s}\n`; } }); text += '\n'; }
          else { text += `${label}\n${fmtVal(val)}\n\n`; }
        });
      }); text += '\n';
    });
    const ok = await copyToClipboard(text); if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, hasVal, fmtVal, formatDate, splitBySentence]);

  /* ========== RENDER HELPERS ========== */
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey; const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase(); const displayVal = fmtVal(val); const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (<div key={fn} className={sl ? 'rec-mini-card' : ''}>{sl && <div className="nested-subtitle">{highlightText(label)}</div>}<div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>{isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div>) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}</div>{isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}</div>);
  };

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

  /* ═══════ RENDER: NUMBER FIELD ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = String(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <input type="number" step="any" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } const numVal = parseFloat(editValue); if (isNaN(numVal)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: BOOLEAN FIELD ═══════ */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = val ? 'Yes' : 'No';
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
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
    return (<div key={sid} className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>{renderApproveButton(record, sid, idx)}</div></div>{fields.map(f => { if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid); if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid); if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid); if (ARRAY_FIELDS.includes(f)) return renderArraySection(record, f, idx, sid, title); if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title); return renderEditableField(record, f, idx, sid, title); })}</div></div>);
  };

  if (!records || records.length === 0) return (<div className="airway-clearance-therapy-document" ref={containerRef}><div className="document-header"><h2 className="document-title">Airway Clearance Therapy</h2></div><div className="empty-state">No airway clearance therapy records available</div></div>);

  return (
    <div className="airway-clearance-therapy-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Airway Clearance Therapy</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<AirwayClearanceTherapyDocumentPDFTemplate document={pdfData} />} fileName={`airway-clearance-therapy-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container"><input type="text" className="search-input" placeholder="Search airway clearance therapy..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />{searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}</div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header"><div className="record-meta-row">{record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}</div><h3 className="record-name">{highlightText(`Airway Clearance Therapy ${idx + 1}`)}</h3></div>
            {renderMixedSection(record, idx, 'diagnosis')}
            {renderMixedSection(record, idx, 'cpt')}
            {renderMixedSection(record, idx, 'hfcwo')}
            {renderMixedSection(record, idx, 'pep')}
            {renderMixedSection(record, idx, 'ipvMie')}
            {renderMixedSection(record, idx, 'sputum')}
            {renderMixedSection(record, idx, 'auscultation')}
            {renderMixedSection(record, idx, 'tolerance')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AirwayClearanceTherapyDocument;
