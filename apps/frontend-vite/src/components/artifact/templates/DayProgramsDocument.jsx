/**
 * DayProgramsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: day_programs
 *
 * 6 Sections:
 *   1. diagnosis-codes: procedureCptCode (string), icd10DiagnosisCodes (array)
 *   2. vital-signs: admissionVitalSigns (comma-split label:value items), dischargeVitalSigns
 *   3. clinical-scores: preoperativeAsaScore (number), postoperativePainScore (number), aldreteScore (number), proceduralComplexity
 *   4. procedure-details: anesthesiaType, procedureDurationMinutes (number), estimatedBloodLossML (number),
 *      intraoperativeComplications (array), antibioticProphylaxis, surgicalSiteMarking (boolean), timeoutPerformed (boolean), implantDeviceUsed
 *   5. medications: medicationsAdministered (array), dischargeMedications (array)
 *   6. post-procedure: postoperativeInstructions (sentence with parseLabel + comma-split), pathologySpecimenCollected (boolean),
 *      pathologySpecimenType, followUpScheduled (boolean), followUpTimeframe (semicolon-split), dischargeReadiness (boolean), escortPresent (boolean)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import DayProgramsDocumentPDFTemplate from '../pdf-templates/DayProgramsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './DayProgramsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" — localEdits keys are "field-idx") */
const DRAFT_KEY = 'day_programsPendingEdits';
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
  'diagnosis-codes': 'Diagnosis Codes',
  'vital-signs': 'Vital Signs',
  'clinical-scores': 'Clinical Scores',
  'procedure-details': 'Procedure Details',
  medications: 'Medications',
  'post-procedure': 'Post-Procedure',
};

const FIELD_LABELS = {
  procedureCptCode: 'Procedure CPT Code',
  icd10DiagnosisCodes: 'ICD-10 Diagnosis Codes',
  admissionVitalSigns: 'Admission Vital Signs',
  dischargeVitalSigns: 'Discharge Vital Signs',
  preoperativeAsaScore: 'Preoperative ASA Score',
  postoperativePainScore: 'Postoperative Pain Score',
  aldreteScore: 'Aldrete Score',
  proceduralComplexity: 'Procedural Complexity',
  anesthesiaType: 'Anesthesia Type',
  procedureDurationMinutes: 'Procedure Duration (Minutes)',
  estimatedBloodLossML: 'Estimated Blood Loss (mL)',
  intraoperativeComplications: 'Intraoperative Complications',
  antibioticProphylaxis: 'Antibiotic Prophylaxis',
  surgicalSiteMarking: 'Surgical Site Marking',
  timeoutPerformed: 'Timeout Performed',
  implantDeviceUsed: 'Implant Device Used',
  medicationsAdministered: 'Medications Administered',
  dischargeMedications: 'Discharge Medications',
  postoperativeInstructions: 'Postoperative Instructions',
  pathologySpecimenCollected: 'Pathology Specimen Collected',
  pathologySpecimenType: 'Pathology Specimen Type',
  followUpScheduled: 'Follow-Up Scheduled',
  followUpTimeframe: 'Follow-Up Timeframe',
  dischargeReadiness: 'Discharge Readiness',
  escortPresent: 'Escort Present',
};

const SECTION_FIELDS = {
  'diagnosis-codes': ['procedureCptCode', 'icd10DiagnosisCodes'],
  'vital-signs': ['admissionVitalSigns', 'dischargeVitalSigns'],
  'clinical-scores': ['preoperativeAsaScore', 'postoperativePainScore', 'aldreteScore', 'proceduralComplexity'],
  'procedure-details': ['anesthesiaType', 'procedureDurationMinutes', 'estimatedBloodLossML', 'intraoperativeComplications', 'antibioticProphylaxis', 'surgicalSiteMarking', 'timeoutPerformed', 'implantDeviceUsed'],
  medications: ['medicationsAdministered', 'dischargeMedications'],
  'post-procedure': ['postoperativeInstructions', 'pathologySpecimenCollected', 'pathologySpecimenType', 'followUpScheduled', 'followUpTimeframe', 'dischargeReadiness', 'escortPresent'],
};

const BOOLEAN_FIELDS = ['pathologySpecimenCollected', 'surgicalSiteMarking', 'timeoutPerformed', 'followUpScheduled', 'dischargeReadiness', 'escortPresent'];
const NUMBER_FIELDS = ['preoperativeAsaScore', 'procedureDurationMinutes', 'estimatedBloodLossML', 'postoperativePainScore', 'aldreteScore'];
const ARRAY_FIELDS = ['icd10DiagnosisCodes', 'medicationsAdministered', 'dischargeMedications', 'intraoperativeComplications'];
const SENTENCE_FIELDS = ['postoperativeInstructions'];
const SEMICOLON_FIELDS = ['followUpTimeframe'];
/* admissionVitalSigns: comma-split where each item has Label: value → nested subtitles */
const LABEL_COMMA_FIELDS = ['admissionVitalSigns', 'dischargeVitalSigns'];

/* parseLabel: detect "Label: value" patterns — medical regex */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"%>+-]{1,80}?):\s+([\s\S]+)$/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* Fixed-choice → <select>. Standard surgical/day-program options; enumOptionsWith keeps any unlisted stored value. */
const ENUM_OPTIONS = {
  proceduralComplexity: ['routine', 'intermediate', 'complex', 'major'],
  anesthesiaType: ['General', 'Regional', 'Local', 'MAC', 'Sedation', 'None'],
};
const ENUM_FIELDS = Object.keys(ENUM_OPTIONS);
const enumOptionsWith = (fn, cur) => { const base = ENUM_OPTIONS[fn] || []; return base.includes(cur) ? base : (cur ? [cur, ...base] : base); };
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };

/* parseNumeric: split a "number + unit" string into editable numbers + fixed literals (units/separators).
   "138/82 mmHg" → {nums:['138','82'], literals:['','/',' mmHg']}. Returns null when there is no number. */
const parseNumeric = (v) => {
  const s = String(v ?? ''); const nums = []; const literals = []; const re = /-?\d+(?:\.\d+)?/g; let last = 0, m;
  while ((m = re.exec(s)) !== null) { literals.push(s.slice(last, m.index)); nums.push(m[0]); last = m.index + m[0].length; }
  if (nums.length === 0) return null;
  literals.push(s.slice(last));
  return { nums, literals };
};

const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

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

/* ═══════ COMPONENT ═══════ */
const DayProgramsDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editNums, setEditNums] = useState([]); // live numeric segments for the number+unit measurement editor
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
      if (r?.day_programs) return Array.isArray(r.day_programs) ? r.day_programs : [r.day_programs];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.day_programs) return Array.isArray(dd.day_programs) ? dd.day_programs : [dd.day_programs]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* ═══════ DRAFT REHYDRATE ═══════ */
  // Repopulate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = (() => { if (!record?._id) return null; if (typeof record._id === 'string') return record._id; if (record._id.$oid) return record._id.$oid; return String(record._id); })();
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
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  const splitBySemicolon = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/;\s*/).map(s => s.trim()).filter(Boolean);
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
    return record[fn];
  }, [localEdits]);

  const getEffectiveArray = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) { const v = localEdits[k]; return Array.isArray(v) ? v : [v]; }
    return Array.isArray(record[fn]) ? record[fn] : [];
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

  /* ═══════ SEARCH ═══════ */
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
      const rt = `Day Program ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const sFields of Object.values(SECTION_FIELDS)) {
        for (const f of sFields) {
          const val = getFieldValue(record, f, idx);
          if (val !== null && val !== undefined) {
            if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
            else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
          }
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          merged[m[1]] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Stage a DRAFT locally (NO DB write). Persists the field value into localEdits + pendingEdits,
  // marks the tracking key edited, drops any prior section-approved flag, and writes the
  // pending-drafts localStorage store (survives refresh). Approve commits it to MongoDB.
  // fieldPart is "field" (localEdits keys are "field-idx"); stored value = full field value.
  const stageDraft = useCallback((record, fn, idx, value, trackKey, idxForSection) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [trackKey || editKey]: 'edited' }));
    // Re-edit after approval → drop this record's section-approved flag so the button returns to yellow
    setApprovedSections(prev => {
      let changed = false; const next = { ...prev };
      Object.keys(next).forEach(k => { if (k.endsWith(`-${idxForSection ?? idx}`)) { delete next[k]; changed = true; } });
      return changed ? next : prev;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, _sid, _sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    let saveVal = valueOverride !== undefined ? valueOverride : editValue;

    /* Field type validation */
    if (NUMBER_FIELDS.includes(fn)) {
      const num = parseFloat(saveVal);
      if (isNaN(num)) { setSaveError('Please enter a valid number'); return; }
      saveVal = num;
    }
    if (BOOLEAN_FIELDS.includes(fn)) {
      const lower = String(saveVal).toLowerCase().trim();
      if (!['yes', 'no', 'true', 'false'].includes(lower)) { setSaveError('Please enter Yes or No'); return; }
      saveVal = (lower === 'yes' || lower === 'true');
    }

    setSaveError(null);
    stageDraft(record, fn, idx, saveVal, editTrackingKey || `${fn}-${idx}`, idx);
  }, [editValue, safeId, stageDraft]);

  const handleSaveArrayItem = useCallback((record, fn, idx, arrayIndex) => {
    const id = safeId(record); if (!id) return;
    const currentArr = [...(getEffectiveArray(record, fn, idx))];
    currentArr[arrayIndex] = editValue;
    setSaveError(null);
    stageDraft(record, fn, idx, currentArr, `${fn}-${idx}-a${arrayIndex}`, idx);
  }, [editValue, safeId, getEffectiveArray, stageDraft]);

  // Stage a per-field DRAFT for sentence/comma/semicolon edits (NO DB write). Mirrors stageDraft but
  // records edits in editedSentences (the markers these renderers read). Approve commits to MongoDB.
  function stageSentenceDraft(record, fn, idx, fullText, sentenceMarks) {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedSentences(prev => ({ ...prev, ...sentenceMarks }));
    setApprovedSections(prev => {
      let changed = false; const next = { ...prev };
      Object.keys(next).forEach(k => { if (k.endsWith(`-${idx}`)) { delete next[k]; changed = true; } });
      return changed ? next : prev;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    setSaveError(null);
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageSentenceDraft(record, fn, idx, fullText, { [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' });
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
    stageSentenceDraft(record, fn, idx, fullText, marks);
  }

  function saveCommaItem(record, fn, idx, commaIdx, newItemText) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const items = splitByComma(currentVal);
    items[commaIdx] = newItemText.trim();
    const fullText = items.join(', ');
    const commaKey = `${fn}-${idx}-c${commaIdx}`;
    setSaveError(null);
    stageSentenceDraft(record, fn, idx, fullText, { [commaKey]: 'edited' });
  }

  function saveCommaItemInSentence(record, fn, idx, sIdx, commaIdx, newItemText) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const sentence = sentences[sIdx] || '';
    const parsed = parseLabel(sentence);
    if (!parsed.isLabeled) return;
    const items = splitByComma(parsed.value);
    items[commaIdx] = newItemText.trim();
    const rebuilt = `${parsed.label}: ${items.join(', ')}.`;
    const allSentences = [...sentences];
    allSentences[sIdx] = rebuilt;
    const fullText = reconstructFullText(allSentences);
    const commaKey = `${fn}-${idx}-s${sIdx}-c${commaIdx}`;
    setSaveError(null);
    stageSentenceDraft(record, fn, idx, fullText, { [commaKey]: 'edited' });
  }

  function saveSemicolonItem(record, fn, idx, semiIdx, newItemText) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const items = splitBySemicolon(currentVal);
    items[semiIdx] = newItemText.trim();
    const fullText = items.join('; ');
    const semiKey = `${fn}-${idx}-semi${semiIdx}`;
    setSaveError(null);
    stageSentenceDraft(record, fn, idx, fullText, { [semiKey]: 'edited' });
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    const suffix = `-${idx}`;
    // This section's staged edits: localEdits keys are "field-idx"; only fields in this section.
    const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix) && fields.includes(k.slice(0, -suffix.length)));
    setSaving(true); setSaveError(null);
    try {
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" (no dotted arrayIndex in this template)
        const lastDot = fieldPart.lastIndexOf('.');
        const payload = { field: fieldPart, value: localEdits[editKey] };
        // arrayIndex ONLY when the trailing dot-segment is purely numeric
        if (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1))) {
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        }
        await secureApiClient.put(`/api/edit/day_programs/${id}/edit`, payload);
      }
      await secureApiClient.put(`/api/edit/day_programs/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) { fields.forEach(f => { delete store[id][f]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[DayPrograms] Approve error:', err); setSaveError('Approve failed. Please try again.'); }
    finally { setSaving(false); }
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
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* ═══════ FORMAT HELPERS FOR COPY ═══════ */
  const formatSentenceFieldLines = useCallback((text) => {
    const lines = []; let n = 1;
    splitBySentence(text).forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        lines.push(parsed.label);
        const parts = splitByComma(parsed.value);
        if (parts.length >= 3) parts.forEach((item, i) => { lines.push(`${i + 1}. ${item}`); });
        else lines.push(`1. ${parsed.value}`);
      } else { lines.push(`${n++}. ${s}`); }
    });
    return lines;
  }, [splitBySentence]);

  const formatLabelCommaLines = useCallback((text) => {
    const lines = []; let n = 1;
    splitByComma(String(text)).forEach(item => {
      const parsed = parseLabel(item.trim());
      if (parsed.isLabeled) { lines.push(parsed.label); lines.push(`1. ${parsed.value}`); }
      else { lines.push(`${n++}. ${item.trim()}`); }
    });
    return lines;
  }, []);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const head = `${label}\n${COPY_LINE_DASH}\n`;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;

      if (ARRAY_FIELDS.includes(f)) {
        const items = getEffectiveArray(record, f, idx).filter(Boolean);
        if (items.length === 0) return;
        text += head;
        let n = 1; let prevLabel = null;
        items.forEach(it => {
          const p = parseLabel(String(it));
          if (p.isLabeled && p.label !== prevLabel) { text += `${p.label}\n`; prevLabel = p.label; }
          if (!p.isLabeled) prevLabel = null;
          text += `${n++}. ${p.isLabeled ? p.value : String(it)}\n`;
        });
        text += '\n';
      } else if (LABEL_COMMA_FIELDS.includes(f)) {
        text += head;
        formatLabelCommaLines(fmtVal(val)).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else if (SENTENCE_FIELDS.includes(f)) {
        text += head;
        formatSentenceFieldLines(fmtVal(val)).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else if (SEMICOLON_FIELDS.includes(f)) {
        const items = splitBySemicolon(fmtVal(val));
        text += head;
        if (items.length >= 2) items.forEach((item, i) => { text += `${i + 1}. ${item}\n`; });
        else text += `1. ${fmtVal(val)}\n`;
        text += '\n';
      } else {
        text += `${head}1. ${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, getEffectiveArray, hasVal, fmtVal, formatSentenceFieldLines, formatLabelCommaLines, splitBySemicolon]);

  const copyAllText = useCallback(async () => {
    let text = '=== DAY PROGRAMS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Day Program ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const sec = buildSectionCopyText(r, idx, sid);
        if (sec.split('\n').filter(l => l.trim()).length > 2) text += sec;
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: BOOLEAN SELECT FIELD ═══════ */
  const renderBooleanField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const normalizeYesNo = (v) => {
      const lower = String(v).toLowerCase().trim();
      if (lower === 'yes' || lower === 'true') return 'yes';
      if (lower === 'no' || lower === 'false') return 'no';
      return v;
    };

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(normalizeYesNo(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
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

  /* ═══════ RENDER: NUMBER FIELD ═══════ */
  const renderNumberField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val)) return null;
    if (typeof val === 'number' && val === 0) return null;
    if (typeof val === 'string' && parseFloat(val) === 0) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const step = stepFor(val); const dec = (step.split('.')[1] || '').length;
    const bump = (d) => setEditValue(v => ((parseFloat(v || '0') || 0) + d * parseFloat(step)).toFixed(dec));

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); bump(-1); }}>&#8722;</button>
                <input type="number" step={step} className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); bump(1); }}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
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

  /* ═══════ RENDER: ENUM FIELD (fixed-choice <select>) ═══════ */
  const renderEnumField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const opts = enumOptionsWith(fn, displayVal);

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)}>
                {opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
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

  /* ═══════ RENDER: SIMPLE EDITABLE FIELD ═══════ */
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
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

  /* ═══════ RENDER: ARRAY FIELD (per-item editing) ═══════ */
  const renderArrayField = (record, fn, idx, sid, title) => {
    const items = getEffectiveArray(record, fn, idx).filter(Boolean);
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    if (searchTerm.trim() && !phraseMatch && !labelMatch && !fieldMatches(record, fn, idx)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {items.map((item, ai) => {
          const arrKey = `${fn}-${idx}-a${ai}`;
          const isEditing = editingField === arrKey;
          const badge = editedFields[arrKey];
          const itemStr = String(item);
          const itemMatches = phraseMatch || labelMatch || !searchTerm.trim() || itemStr.toLowerCase().includes(searchTerm.toLowerCase().trim());
          if (!itemMatches && searchTerm.trim()) return null;

          /* parseLabel for each array item */
          const parsed = parseLabel(itemStr);

          return (
            <div key={ai}>
              {parsed.isLabeled && <div className="nested-subtitle sub-label">{highlightText(parsed.label)}</div>}
              <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(arrKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, ai); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : itemStr)}</span><span className="edit-indicator">✎</span></div>
                    <button className={`copy-btn ${copiedItems[arrKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, arrKey); }}>{copiedItems[arrKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ NUMBER + UNIT MEASUREMENT EDITOR (−/+ stepper per numeric segment) ═══════ */
  const startNumEdit = (ek, parsed) => { setEditingField(ek); setEditNums(parsed.nums.slice()); setEditValue(''); setSaveError(null); };
  const stepNums = (i, delta) => setEditNums(prev => prev.map((x, xi) => {
    if (xi !== i) return x;
    const step = stepFor(x); const dec = (step.split('.')[1] || '').length;
    return ((parseFloat(x || '0') || 0) + delta * parseFloat(step)).toFixed(dec);
  }));
  const rebuildNumeric = (parsed) => { let out = parsed.literals[0] || ''; editNums.forEach((n, i) => { out += String(n ?? '').trim(); out += parsed.literals[i + 1] || ''; }); return out.trim(); };
  const renderNumberEditor = (parsed) => (
    <div className="number-edit-row">
      {parsed.literals[0] && <span className="number-edit-unit">{parsed.literals[0]}</span>}
      {editNums.map((n, i) => (
        <React.Fragment key={i}>
          <span className="num-seg">
            <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepNums(i, -1); }}>&#8722;</button>
            <input type="number" step={stepFor(n)} className="edit-number" value={n} autoFocus={i === 0}
              onChange={e => setEditNums(prev => prev.map((x, xi) => xi === i ? e.target.value : x))}
              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
            <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepNums(i, 1); }}>+</button>
          </span>
          {parsed.literals[i + 1] && <span className="number-edit-unit">{parsed.literals[i + 1]}</span>}
        </React.Fragment>
      ))}
    </div>
  );

  /* ═══════ RENDER: LABEL-COMMA FIELD (admissionVitalSigns) ═══════ */
  /* Each comma-item has its own Label: value → nested-subtitle per item; the value uses the number+unit stepper */
  const renderLabelCommaField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const label = FIELD_LABELS[fn] || fn;
    const items = splitByComma(val);
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    if (searchTerm.trim() && !phraseMatch && !labelMatch && !fieldMatches(record, fn, idx)) return null;

    if (items.length >= 2) {
      return (
        <div key={fn} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          {items.map((ci, ciIdx) => {
            const commaKey = `${fn}-${idx}-c${ciIdx}`;
            const ciEditing = editingField === commaKey;
            const ciBadge = editedSentences[commaKey];
            const ciMatches = phraseMatch || labelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
            if (!ciMatches && searchTerm.trim()) return null;

            const parsed = parseLabel(ci.trim());
            const rawVal = parsed.isLabeled ? parsed.value : ci;
            const nParsed = parseNumeric(rawVal); // number+unit → segmented stepper; null → plain textarea

            return (
              <div key={ciIdx}>
                {parsed.isLabeled && <div className="nested-subtitle sub-label">{highlightText(parsed.label)}</div>}
                <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { if (nParsed) startNumEdit(commaKey, nParsed); else { setEditingField(commaKey); setEditValue(rawVal); setSaveError(null); } } }}>
                  {ciEditing ? (
                    <div className="edit-field-container">
                      {nParsed
                        ? renderNumberEditor(nParsed)
                        : <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />}
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => {
                          e.stopPropagation();
                          /* Reconstruct with label if it was labeled; units/separators preserved verbatim */
                          const val = nParsed ? rebuildNumeric(nParsed) : editValue.trim();
                          const newItem = parsed.isLabeled ? `${parsed.label}: ${val}` : val;
                          saveCommaItem(record, fn, idx, ciIdx, newItem);
                        }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : ci)}</span><span className="edit-indicator">✎</span></div>
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

    /* Single value — fall back to simple editable */
    return renderEditableField(record, fn, idx, sid, title);
  };

  /* ═══════ RENDER: SEMICOLON-SPLIT FIELD ═══════ */
  const renderSemicolonField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const label = FIELD_LABELS[fn] || fn;
    const items = splitBySemicolon(val);
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    if (searchTerm.trim() && !phraseMatch && !labelMatch && !fieldMatches(record, fn, idx)) return null;

    if (items.length >= 2) {
      return (
        <div key={fn} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          {items.map((item, si) => {
            const semiKey = `${fn}-${idx}-semi${si}`;
            const siEditing = editingField === semiKey;
            const siBadge = editedSentences[semiKey];
            const siMatches = phraseMatch || labelMatch || !searchTerm.trim() || item.toLowerCase().includes(searchTerm.toLowerCase().trim());
            if (!siMatches && searchTerm.trim()) return null;

            return (
              <div key={si}>
                <div className={`numbered-row ${siBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!siEditing) { setEditingField(semiKey); setEditValue(item); setSaveError(null); } }}>
                  {siEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSemicolonItem(record, fn, idx, si, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(item)}</span><span className="edit-indicator">✎</span></div>
                      <button className={`copy-btn ${copiedItems[semiKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(item, semiKey); }}>{copiedItems[semiKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {siBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
      );
    }

    return renderEditableField(record, fn, idx, sid, title);
  };

  /* ═══════ RENDER: SENTENCE EDITABLE with parseLabel + comma-split ═══════ */
  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const sentences = splitBySentence(val); if (sentences.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

    return (
      <div key={fn}>
        <div className="rec-mini-card">
          {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
          {sentences.map((sentence, sIdx) => {
            const sentenceKey = `${fn}-${idx}-s${sIdx}`;
            const isEditing = editingField === sentenceKey;
            const badge = editedSentences[sentenceKey];
            const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!sentenceMatches && searchTerm.trim()) return null;

            /* parseLabel for Label: value patterns */
            const parsed = parseLabel(sentence);
            if (parsed.isLabeled) {
              const textToSplit = parsed.value;
              const commaItems = splitByComma(textToSplit);
              if (commaItems.length >= 3) {
                return (
                  <div key={sIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                    <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                    {commaItems.map((ci, ciIdx) => {
                      const commaKey = `${sentenceKey}-c${ciIdx}`;
                      const ciEditing = editingField === commaKey;
                      const ciBadge = editedSentences[commaKey];
                      const ciMatches = phraseMatch || labelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
                      if (!ciMatches && searchTerm.trim()) return null;
                      return (
                        <div key={ciIdx}>
                          <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                            {ciEditing ? (
                              <div className="edit-field-container">
                                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                {saveError && <div className="save-error">{saveError}</div>}
                                <div className="edit-actions">
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItemInSentence(record, fn, idx, sIdx, ciIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">✎</span></div>
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

            /* Labeled (but <3 comma items) → sub-label + value row; unlabeled → plain row (never inline "label: value") */
            const rowDisplay = parsed.isLabeled ? parsed.value : sentence;
            return (
              <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const reconstructed = `${parsed.label}: ${editValue.trim()}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setSaveError(null); stageSentenceDraft(record, fn, idx, fullText, { [sentenceKey]: 'edited' }); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(rowDisplay)}</span><span className="edit-indicator">✎</span></div>
                      <button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(rowDisplay, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button>
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
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => {
      if (ARRAY_FIELDS.includes(f)) return getEffectiveArray(record, f, idx).filter(Boolean).length > 0;
      return hasVal(getFieldValue(record, f, idx));
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
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid, title);
            if (ENUM_FIELDS.includes(f)) return renderEnumField(record, f, idx, sid, title);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid, title);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid, title);
            if (LABEL_COMMA_FIELDS.includes(f)) return renderLabelCommaField(record, f, idx, sid, title);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
            if (SEMICOLON_FIELDS.includes(f)) return renderSemicolonField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="day-programs-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Day Programs</h2></div>
        <div className="empty-state">No day program records available</div>
      </div>
    );
  }

  return (
    <div className="day-programs-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Day Programs</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<DayProgramsDocumentPDFTemplate document={pdfData} />} fileName="Day_Programs.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search day programs..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Day Program ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'diagnosis-codes')}
            {renderSection(record, idx, 'vital-signs')}
            {renderSection(record, idx, 'clinical-scores')}
            {renderSection(record, idx, 'procedure-details')}
            {renderSection(record, idx, 'medications')}
            {renderSection(record, idx, 'post-procedure')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DayProgramsDocument;
