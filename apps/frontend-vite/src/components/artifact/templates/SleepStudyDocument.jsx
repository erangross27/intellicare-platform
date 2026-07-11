/**
 * SleepStudyDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: sleep_study
 *
 * 5 Sections:
 *   1. studyInfo: studyType, indicationForStudy
 *   2. sleepTiming: totalRecordingTime, totalSleepTime, sleepEfficiency, sleepLatency, remLatency
 *   3. respiratoryIndices: apneaHypopneaIndex, oxygenDesaturationIndex, supineAHI, centralApneaIndex, obstructiveApneaIndex, snoringPercentage, arousalIndex, periodicLimbMovementIndex
 *   4. oxygenation: lowestOxygenSaturation, meanOxygenSaturation, timeBelow90Percent
 *   5. cpapAndPositional: optimalCpapPressure, cpapSettingsTrialed, sleepStagePercentages, bodyPositionData
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SleepStudyDocumentPDFTemplate from '../pdf-templates/SleepStudyDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './SleepStudyDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'sleep_studyPendingEdits';
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
  studyInfo: 'Study Information',
  sleepTiming: 'Sleep Timing & Architecture',
  respiratoryIndices: 'Respiratory & Movement Indices',
  oxygenation: 'Oxygenation',
  cpapAndPositional: 'CPAP & Positional Data',
};

const FIELD_LABELS = {
  studyType: 'Study Type',
  indicationForStudy: 'Indication for Study',
  totalRecordingTime: 'Total Recording Time (min)',
  totalSleepTime: 'Total Sleep Time (min)',
  sleepEfficiency: 'Sleep Efficiency (%)',
  sleepLatency: 'Sleep Latency (min)',
  remLatency: 'REM Latency (min)',
  apneaHypopneaIndex: 'Apnea-Hypopnea Index (AHI)',
  oxygenDesaturationIndex: 'Oxygen Desaturation Index (ODI)',
  supineAHI: 'Supine AHI',
  centralApneaIndex: 'Central Apnea Index',
  obstructiveApneaIndex: 'Obstructive Apnea Index',
  snoringPercentage: 'Snoring Percentage (%)',
  arousalIndex: 'Arousal Index',
  periodicLimbMovementIndex: 'Periodic Limb Movement Index (PLMI)',
  lowestOxygenSaturation: 'Lowest Oxygen Saturation (%)',
  meanOxygenSaturation: 'Mean Oxygen Saturation (%)',
  timeBelow90Percent: 'Time Below 90% SpO2 (%)',
  optimalCpapPressure: 'Optimal CPAP Pressure (cmH2O)',
  cpapSettingsTrialed: 'CPAP Settings Trialed',
  sleepStagePercentages: 'Sleep Stage Percentages',
  bodyPositionData: 'Body Position Data',
};

const SECTION_FIELDS = {
  studyInfo: ['studyType', 'indicationForStudy'],
  sleepTiming: ['totalRecordingTime', 'totalSleepTime', 'sleepEfficiency', 'sleepLatency', 'remLatency'],
  respiratoryIndices: ['apneaHypopneaIndex', 'oxygenDesaturationIndex', 'supineAHI', 'centralApneaIndex', 'obstructiveApneaIndex', 'snoringPercentage', 'arousalIndex', 'periodicLimbMovementIndex'],
  oxygenation: ['lowestOxygenSaturation', 'meanOxygenSaturation', 'timeBelow90Percent'],
  cpapAndPositional: ['optimalCpapPressure', 'cpapSettingsTrialed', 'sleepStagePercentages', 'bodyPositionData'],
};

const ARRAY_FIELDS = [];
const SENTENCE_FIELDS = ['studyType', 'indicationForStudy'];
const OBJECT_FIELDS = ['cpapSettingsTrialed', 'sleepStagePercentages', 'bodyPositionData'];
const NUMBER_FIELDS = ['totalRecordingTime', 'totalSleepTime', 'sleepEfficiency', 'sleepLatency', 'remLatency', 'apneaHypopneaIndex', 'oxygenDesaturationIndex', 'lowestOxygenSaturation', 'meanOxygenSaturation', 'timeBelow90Percent', 'arousalIndex', 'periodicLimbMovementIndex', 'supineAHI', 'centralApneaIndex', 'obstructiveApneaIndex', 'snoringPercentage', 'optimalCpapPressure'];
const BOOLEAN_FIELDS = [];
const DATE_FIELDS = ['date'];
const parseLabel = (text) => { if (!text || typeof text !== 'string') return null; const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'-]{2,}?):\s+(.*)/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };

const SleepStudyDocument = ({ document: docProp }) => {
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
      if (r?.sleep_study) return Array.isArray(r.sleep_study) ? r.sleep_study : [r.sleep_study];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.sleep_study) return Array.isArray(dd.sleep_study) ? dd.sleep_study : [dd.sleep_study]; return [dd]; }
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
      const id = idOf(record);
      const recDrafts = id ? store[id] : null;
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

  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const formatDate = useCallback((d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);
  const splitBySentence = useCallback((text) => { if (!text || typeof text !== 'string') return []; const safe = text.replace(/\bvs\.\s/gi, 'vs\u200B '); return safe.split(/\s+-\s+|[;.]\s+/).map(s => s.replace(/vs\u200B/g, 'vs.').trim()).filter(s => s && !/^[;.,!?-]+$/.test(s)); }, []);
  function reconstructFullText(sentences) { if (!sentences || sentences.length === 0) return ''; return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' '); }
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
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
      if (OBJECT_FIELDS.includes(f)) { if (val && typeof val === 'object') { const objStr = Object.entries(val).map(([k2, v2]) => `${k2} ${v2}`).join(' ').toLowerCase(); if (objStr.includes(phrase)) return true; } }
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
    if (OBJECT_FIELDS.includes(fn)) { if (val && typeof val === 'object') { const objStr = Object.entries(val).map(([k2, v2]) => `${k2} ${v2}`).join(' ').toLowerCase(); return objStr.includes(phrase); } return false; }
    return val !== null && val !== undefined && fmtVal(val).toLowerCase().includes(phrase);
  }, [searchTerm, getFieldValue, fmtVal]);

  const sectionTitleMatches = useCallback((sid) => { if (!searchTerm.trim()) return false; const p = searchTerm.toLowerCase().trim(); const t = (SECTION_TITLES[sid] || '').toLowerCase(); return t.includes(p) || p.includes(t); }, [searchTerm]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Sleep Study ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const f of Object.keys(FIELD_LABELS)) {
        const val = record[f];
        if (OBJECT_FIELDS.includes(f)) { if (val && typeof val === 'object') { const objStr = Object.entries(val).map(([k2, v2]) => `${k2} ${v2}`).join(' ').toLowerCase(); if (objStr.includes(phrase)) return true; } }
        else if (val !== null && val !== undefined) { if (fmtVal(val).toLowerCase().includes(phrase)) return true; }
      }
      return false;
    });
  }, [records, searchTerm, fmtVal]);

  const pdfData = useMemo(() => filteredRecords.map((r, idx) => { const m = { ...r }; Object.keys(localEdits).forEach(k => { if (pendingEdits[k]) return; const mt = k.match(/^(.+)-(\d+)$/); if (mt && parseInt(mt[2]) === idx) m[mt[1]] = localEdits[k]; }); return m; }), [filteredRecords, localEdits, pendingEdits]);

  /* ========== EDIT ========== */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx) => {
    const id = safeId(record); if (!id) return;
    let saveVal = editValue.trim();
    if (NUMBER_FIELDS.includes(fn)) { saveVal = parseFloat(saveVal); if (isNaN(saveVal)) { setSaveError('Please enter a valid number'); return; } }
    if (BOOLEAN_FIELDS.includes(fn)) { saveVal = saveVal === 'yes' || saveVal === true; }
    setSaveError(null);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow
    setApprovedSections(prev => {
      const next = { ...prev };
      Object.keys(SECTION_FIELDS).forEach(sid => { if ((SECTION_FIELDS[sid] || []).includes(fn)) delete next[`${sid}-${idx}`]; });
      return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // Save = stage a DRAFT locally + write to localStorage (survives refresh). NOT a DB write; Approve commits.
  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || ''); const sentences = splitBySentence(currentVal); const editedVal = editValue.trim();
    const editKey = `${fn}-${idx}`;
    const stageDraft = (fullText) => {
      setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
      setPendingEdits(prev => ({ ...prev, [editKey]: true }));
      setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
      const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = fullText; writeDrafts(store);
    };
    if (!editedVal || /^[;.,!?-]+$/.test(editedVal)) { const updated = [...sentences]; updated.splice(sentenceIdx, 1); const fullText = reconstructFullText(updated); setSaveError(null);
      stageDraft(fullText); setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' })); setEditingField(null); setEditValue(''); return; }
    const newSentences = splitBySentence(editedVal); const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences); const fullText = reconstructFullText(updated); setSaveError(null);
    stageDraft(fullText);
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
    const editKey = `${fn}-${idx}`;
    setSaveError(null);
    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' }));
    Object.keys(SECTION_FIELDS).forEach(sid => { if ((SECTION_FIELDS[sid] || []).includes(fn)) setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); });
    const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = fullText; writeDrafts(store);
    setEditingField(null); setEditValue('');
  }

  const sectionHasEdits = useCallback((idx, sid) => { const fields = SECTION_FIELDS[sid] || []; return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))); }, [editedFields, editedSentences]);
  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    try {
      // Staged drafts for this section's fields (editKey === "<field>-<idx>")
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        const mt = k.match(/^(.+)-(\d+)$/);
        return mt && parseInt(mt[2], 10) === idx && fields.includes(mt[1]);
      });
      for (const editKey of toCommit) {
        const fieldPart = editKey.replace(/-\d+$/, ''); // plain field name (no dotted/array fields here)
        const dotIdx = fieldPart.lastIndexOf('.');
        const payload = { field: fieldPart, value: localEdits[editKey] };
        // arrayIndex ONLY when the trailing dot-segment is purely numeric
        if (dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1))) { payload.field = fieldPart.slice(0, dotIdx); payload.arrayIndex = parseInt(fieldPart.slice(dotIdx + 1), 10); }
        const resp = await secureApiClient.put(`/api/edit/sleep_study/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/sleep_study/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) { toCommit.forEach(k => { const fp = k.replace(/-\d+$/, ''); delete store[id][fp]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }
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

  const formatObjectValue = useCallback((val) => {
    if (!val || typeof val !== 'object' || Object.keys(val).length === 0) return '';
    return Object.entries(val).map(([k, v]) => `${k}: ${v}`).join(', ');
  }, []);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid]; let text = `${title}\n${'='.repeat(40)}\n\n`;
    (SECTION_FIELDS[sid] || []).forEach(f => { const label = FIELD_LABELS[f] || f; const val = getFieldValue(record, f, idx); if (!hasVal(val)) return;
      if (OBJECT_FIELDS.includes(f)) { text += `${label}\n${formatObjectValue(val)}\n\n`; }
      else if (SENTENCE_FIELDS.includes(f)) { text += `${label}\n`; splitBySentence(fmtVal(val)).forEach((s, i) => { const p = parseLabel(s); if (p) { const ci = p.content.split(/,\s*/).filter(Boolean); text += `${p.label}:\n`; ci.forEach((c, j) => { text += `  ${j + 1}. ${c.trim()}\n`; }); } else { text += `${i + 1}. ${s}\n`; } }); text += '\n'; }
      else { text += `${label}\n${fmtVal(val)}\n\n`; }
    }); return text;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, formatObjectValue]);

  const copyAllText = useCallback(async () => {
    let text = '=== SLEEP STUDY ===\n\n';
    pdfData.forEach((r, idx) => { text += `Sleep Study ${idx + 1}\n${'='.repeat(40)}\n\n`;
      if (r.date) text += `Date\n${formatDate(r.date)}\n\n`;
      if (r.provider) text += `Provider\n${r.provider}\n\n`;
      if (r.facility) text += `Facility\n${r.facility}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => { const fields = SECTION_FIELDS[sid]; const hasAny = fields.some(f => hasVal(r[f])); if (!hasAny) return;
        text += `${SECTION_TITLES[sid]}\n${'-'.repeat(30)}\n`;
        fields.forEach(f => { const label = FIELD_LABELS[f] || f; const val = r[f]; if (!hasVal(val)) return;
          if (OBJECT_FIELDS.includes(f)) { text += `${label}\n${formatObjectValue(val)}\n\n`; }
          else if (SENTENCE_FIELDS.includes(f)) { text += `${label}\n`; splitBySentence(fmtVal(val)).forEach((s, i) => { const p = parseLabel(s); if (p) { const ci = p.content.split(/,\s*/).filter(Boolean); text += `${p.label}:\n`; ci.forEach((c, j) => { text += `  ${j + 1}. ${c.trim()}\n`; }); } else { text += `${i + 1}. ${s}\n`; } }); text += '\n'; }
          else { text += `${label}\n${fmtVal(val)}\n\n`; }
        });
      }); text += '\n';
    });
    const ok = await copyToClipboard(text); if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, hasVal, fmtVal, formatDate, splitBySentence, formatObjectValue]);

  /* ========== RENDER HELPERS ========== */
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey; const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase(); const displayVal = fmtVal(val); const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const isNumber = NUMBER_FIELDS.includes(fn);
    const isBoolean = BOOLEAN_FIELDS.includes(fn);
    const isDate = DATE_FIELDS.includes(fn);
    const startEdit = () => { if (!isEditing) { setEditingField(editKey); if (isBoolean) { const raw = val; setEditValue(raw === true || raw === 'Yes' || raw === 'yes' || raw === 'true' ? 'yes' : 'no'); } else if (isDate) { try { const d = new Date(val.$date || val); setEditValue(d.toISOString().split('T')[0]); } catch { setEditValue(displayVal); } } else { setEditValue(displayVal); } setSaveError(null); } };
    let editInput;
    if (isEditing) {
      if (isNumber) { editInput = <input type="number" step="any" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); handleSaveField(record, fn, idx); } }} />; }
      else if (isBoolean) { editInput = <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}><option value="yes">Yes</option><option value="no">No</option></select>; }
      else if (isDate) { editInput = <input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />; }
      else { editInput = <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />; }
    }
    return (<div key={fn} className={sl ? 'rec-mini-card' : ''}>{sl && <div className="nested-subtitle">{highlightText(label)}</div>}<div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={startEdit}>{isEditing ? (<div className="edit-field-container">{editInput}{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div>) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}</div>{isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}</div>);
  };

  const renderObjectField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || typeof val !== 'object') return null;
    const label = FIELD_LABELS[fn] || fn;
    const entries = Object.entries(val).filter(([, v]) => v !== null && v !== undefined && v !== '');
    if (entries.length === 0) return null;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className="rec-mini-card">
          {entries.map(([k, v], ei) => {
            const itemKey = `${fn}-${idx}-obj-${k}`;
            return (
              <div key={ei} className="numbered-row">
                <div className="row-content">
                  <span className="content-value">{highlightText(`${k}: ${v}`)}</span>
                </div>
                <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${k}: ${v}`, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
              </div>
            );
          })}
        </div>
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

  const renderMixedSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid]; if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => hasVal(getFieldValue(record, f, idx)));
    if (!hasAnyVal) return null;
    const copyId = `${sid}-${idx}`;
    return (<div key={sid} className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>{renderApproveButton(record, sid, idx)}</div></div>{fields.map(f => { if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid, title); if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title); return renderEditableField(record, f, idx, sid, title); })}</div></div>);
  };

  if (!records || records.length === 0) return (<div className="sleep-study-document" ref={containerRef}><div className="document-header"><h2 className="document-title">Sleep Study</h2></div><div className="empty-state">No sleep study records available</div></div>);

  return (
    <div className="sleep-study-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Sleep Study</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<SleepStudyDocumentPDFTemplate document={pdfData} />} fileName={`sleep-study-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container"><input type="text" className="search-input" placeholder="Search sleep study..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />{searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}</div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header"><div className="record-meta-row">{record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}{record.provider && record.provider !== 'Not specified' && <span className="record-date">{highlightText(record.provider)}</span>}{record.facility && record.facility !== 'Not specified' && <span className="record-date">{highlightText(record.facility)}</span>}</div><h3 className="record-name">{highlightText(`Sleep Study ${idx + 1}`)}</h3></div>
            {renderMixedSection(record, idx, 'studyInfo')}
            {renderMixedSection(record, idx, 'sleepTiming')}
            {renderMixedSection(record, idx, 'respiratoryIndices')}
            {renderMixedSection(record, idx, 'oxygenation')}
            {renderMixedSection(record, idx, 'cpapAndPositional')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SleepStudyDocument;
