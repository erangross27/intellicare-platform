/**
 * PatientCarePlanDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: patient_care_plan
 *
 * Sections:
 *   1. patient-info:    patientName, dateOfBirth, age, gender
 *   2. interventions:   tailoredInterventions (array of objects)
 *   3. lifestyle:       lifestyleModifications (array of objects)
 *   4. comorbidity:     comorbidityManagement (object with conditions[], interactions, prioritization)
 *   5. metrics:         outcomeMetrics (array of objects)
 *   6. meta:            source, aiProcessed, documentDate
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PatientCarePlanDocumentPDFTemplate from '../pdf-templates/PatientCarePlanDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './PatientCarePlanDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the localEdits key minus the "-idx" suffix) */
const DRAFT_KEY = 'patient_care_planPendingEdits';
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
  'patient-info': 'Patient Information',
  'interventions': 'Tailored Interventions',
  'lifestyle': 'Lifestyle Modifications',
  'comorbidity': 'Comorbidity Management',
  'metrics': 'Outcome Metrics',
  'meta': 'Document Details',
};

const FIELD_LABELS = {
  patientName: 'Patient Name',
  dateOfBirth: 'Date of Birth',
  age: 'Age',
  gender: 'Gender',
  tailoredInterventions: 'Tailored Interventions',
  lifestyleModifications: 'Lifestyle Modifications',
  comorbidityManagement: 'Comorbidity Management',
  outcomeMetrics: 'Outcome Metrics',
  source: 'Source',
  aiProcessed: 'AI Processed',
  documentDate: 'Document Date',
  intervention: 'Intervention',
  rationale: 'Rationale',
  expectedOutcome: 'Expected Outcome',
  timeframe: 'Timeframe',
  category: 'Category',
  recommendation: 'Recommendation',
  benefits: 'Benefits',
  barriers: 'Potential Barriers',
  support: 'Support',
  condition: 'Condition',
  management: 'Management',
  goals: 'Goals',
  interactions: 'Condition Interactions',
  prioritization: 'Treatment Prioritization',
  metric: 'Metric',
  target: 'Target',
  frequency: 'Measurement Frequency',
};

const SECTION_FIELDS = {
  'patient-info': ['patientName', 'dateOfBirth', 'age', 'gender'],
  'interventions': ['tailoredInterventions'],
  'lifestyle': ['lifestyleModifications'],
  'comorbidity': ['comorbidityManagement'],
  'metrics': ['outcomeMetrics'],
  'meta': ['documentDate', 'source', 'aiProcessed'],
};

const BOOLEAN_FIELDS = ['aiProcessed'];
const DATE_FIELDS = ['dateOfBirth', 'documentDate'];
const ARRAY_FIELDS = ['tailoredInterventions', 'lifestyleModifications', 'outcomeMetrics'];
const NUMBER_FIELDS = ['age'];
const STRING_FIELDS = ['patientName', 'gender', 'source'];

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

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* ═══════ COMPONENT ═══════ */
const PatientCarePlanDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys (same "${fn}-${idx}" shape as localEdits) staged as drafts — saved locally + to
  // localStorage, NOT committed to DB/PDF until Approve. Cleared on Approve.
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
      if (r?.patient_care_plan) return Array.isArray(r.patient_care_plan) ? r.patient_care_plan : [r.patient_care_plan];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.patient_care_plan) return Array.isArray(dd.patient_care_plan) ? dd.patient_care_plan : [dd.patient_care_plan]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     Store shape: { [recordId]: { [fieldPart]: value } }. fieldPart == localEdits key minus "-idx". */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = record && record._id ? (typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id))) : null;
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

  /* Helper: flatten an array-of-objects field into a searchable string */
  const flattenArrayField = useCallback((arr) => {
    if (!Array.isArray(arr)) return '';
    return arr.map(item => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) return Object.values(item).filter(Boolean).join(' ');
      return '';
    }).join(' ');
  }, []);

  /* Helper: flatten comorbidityManagement object */
  const flattenComorbidity = useCallback((obj) => {
    if (!obj || typeof obj !== 'object') return '';
    const parts = [];
    if (Array.isArray(obj.conditions)) parts.push(flattenArrayField(obj.conditions));
    if (obj.interactions) parts.push(String(obj.interactions));
    if (obj.prioritization) parts.push(String(obj.prioritization));
    return parts.join(' ');
  }, [flattenArrayField]);

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
        let searchStr = '';
        if (Array.isArray(val)) searchStr = flattenArrayField(val);
        else if (f === 'comorbidityManagement') searchStr = flattenComorbidity(val);
        else if (typeof val === 'object') searchStr = Object.values(val).filter(Boolean).join(' ');
        else searchStr = fmtVal(val);
        if (searchStr.toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, flattenArrayField, flattenComorbidity]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) {
      let searchStr = '';
      if (Array.isArray(val)) searchStr = flattenArrayField(val);
      else if (fn === 'comorbidityManagement') searchStr = flattenComorbidity(val);
      else if (typeof val === 'object') searchStr = Object.values(val).filter(Boolean).join(' ');
      else searchStr = fmtVal(val);
      return searchStr.toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, flattenArrayField, flattenComorbidity]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Care Plan ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const [sid, fields] of Object.entries(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (!val) continue;
          let searchStr = '';
          if (Array.isArray(val)) searchStr = flattenArrayField(val);
          else if (f === 'comorbidityManagement') searchStr = flattenComorbidity(val);
          else if (typeof val === 'object') searchStr = Object.values(val).filter(Boolean).join(' ');
          else searchStr = fmtVal(val);
          if (searchStr.toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal, flattenArrayField, flattenComorbidity]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) merged[m[1]] = localEdits[key];
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  /* stageDraft: persist a field's full value LOCALLY only (state + localStorage). No DB write.
     localEdits + pendingEdits are keyed by "${fn}-${idx}" (the whole field value lives there);
     the localStorage draft is keyed by recordId -> fn. Approve is the only path that hits the DB. */
  const stageDraft = useCallback((record, fn, idx, sid, value) => {
    const id = safeId(record);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    // Re-edit after approval → drop the section's approved flag so the button returns to yellow Pending
    setApprovedSections(prev => {
      if (!prev[`${sid}-${idx}`]) return prev;
      const next = { ...prev }; delete next[`${sid}-${idx}`]; return next;
    });
    if (id) {
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][fn] = value;
      writeDrafts(store);
    }
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    // Stage a DRAFT locally (survives refresh); NOT written to the DB/PDF until Approve.
    stageDraft(record, fn, idx, sid, saveVal);
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    setSaveError(null);
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      // Stage a DRAFT locally (no DB write); Approve commits it.
      stageDraft(record, fn, idx, sid, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    // Stage a DRAFT locally (no DB write); Approve commits it.
    stageDraft(record, fn, idx, sid, fullText);
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

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB (the ONLY path that writes to the DB),
  // then clear pending so the committed values now flow into pdfData/PDF/Copy All.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    // This section's pending localEdits keys. localEdits keys are "${fn}-${idx}" (never dotted here);
    // arrayIndex is added ONLY when the trailing dot-segment is purely numeric (parity w/ reference).
    const suffix = `-${idx}`;
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fieldPart = k.slice(0, -suffix.length);
      const base = fieldPart.includes('.') ? fieldPart.slice(0, fieldPart.indexOf('.')) : fieldPart;
      return fields.includes(base);
    });
    try {
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const dotIdx = fieldPart.lastIndexOf('.');
        const tail = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const payload = { field: fieldPart, value: localEdits[editKey] };
        if (dotIdx !== -1 && /^\d+$/.test(tail)) { payload.field = fieldPart.slice(0, dotIdx); payload.arrayIndex = parseInt(tail, 10); }
        const resp = await secureApiClient.put(`/api/edit/patient_care_plan/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/patient_care_plan/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); if (store[id]) delete store[id][fp]; });
        if (store[id] && Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); }
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
      } else if (f === 'tailoredInterventions' && Array.isArray(val)) {
        text += `${label}\n`;
        val.forEach((item, i) => {
          text += `  ${i + 1}. ${item.intervention || ''}\n`;
          if (item.rationale) text += `     Rationale: ${item.rationale}\n`;
          if (item.expectedOutcome) text += `     Expected Outcome: ${item.expectedOutcome}\n`;
          if (item.timeframe) text += `     Timeframe: ${item.timeframe}\n`;
        });
        text += '\n';
      } else if (f === 'lifestyleModifications' && Array.isArray(val)) {
        text += `${label}\n`;
        val.forEach((item, i) => {
          text += `  ${i + 1}. ${item.category || ''}: ${item.recommendation || ''}\n`;
          if (item.benefits) text += `     Benefits: ${item.benefits}\n`;
          if (item.barriers) text += `     Barriers: ${item.barriers}\n`;
          if (item.support) text += `     Support: ${item.support}\n`;
        });
        text += '\n';
      } else if (f === 'comorbidityManagement' && typeof val === 'object') {
        text += `${label}\n`;
        if (Array.isArray(val.conditions)) {
          val.conditions.forEach((c, i) => {
            text += `  ${i + 1}. ${c.condition || ''}\n`;
            if (c.management) text += `     Management: ${c.management}\n`;
            if (c.goals) text += `     Goals: ${c.goals}\n`;
          });
        }
        if (val.interactions) text += `  Interactions: ${val.interactions}\n`;
        if (val.prioritization) text += `  Prioritization: ${val.prioritization}\n`;
        text += '\n';
      } else if (f === 'outcomeMetrics' && Array.isArray(val)) {
        text += `${label}\n`;
        val.forEach((item, i) => {
          text += `  ${i + 1}. ${item.metric || ''}\n`;
          if (item.target) text += `     Target: ${item.target}\n`;
          if (item.frequency) text += `     Frequency: ${item.frequency}\n`;
        });
        text += '\n';
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

  const copyAllText = useCallback(async () => {
    let text = '=== PATIENT CARE PLAN ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Care Plan ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

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
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <input type="number" className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} style={{ minHeight: 'auto', padding: '10px' }} />
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

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setSaveError(null); stageDraft(record, fn, idx, sid, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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

              return (
                <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                  {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setSaveError(null); stageDraft(record, fn, idx, sid, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: TAILORED INTERVENTIONS ═══════ */
  const renderInterventionsField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(item => item && typeof item === 'object') : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const subFields = [
      { key: 'intervention', label: 'Intervention' },
      { key: 'rationale', label: 'Rationale' },
      { key: 'expectedOutcome', label: 'Expected Outcome' },
      { key: 'timeframe', label: 'Timeframe' },
    ];

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {items.map((item, itemIdx) => {
          const phrase = searchTerm.toLowerCase().trim();
          const itemStr = Object.values(item).filter(Boolean).join(' ').toLowerCase();
          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.includes(phrase)) return null;
          }
          return (
            <div key={itemIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
              <div className="nested-subtitle">{highlightText(`Intervention ${itemIdx + 1}`)}</div>
              {subFields.map(({ key, label: subLabel }) => {
                if (!item[key]) return null;
                const editKey = `${fn}.${itemIdx}.${key}-${idx}`;
                const isEditing = editingField === editKey;
                const isModified = editedFields[editKey];
                const subPhrase = searchTerm.toLowerCase().trim();
                if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
                  const subLabelLower = subLabel.toLowerCase();
                  const subValLower = String(item[key]).toLowerCase();
                  if (!subLabelLower.includes(subPhrase) && !subValLower.includes(subPhrase) && !itemStr.includes(subPhrase)) return null;
                }
                return (
                  <div key={key}>
                    <div className="content-subtitle-label">{highlightText(subLabel)}</div>
                    <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(item[key])); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => {
                              e.stopPropagation(); const id2 = safeId(record); if (!id2) return;
                              setSaveError(null);
                              const currentArr = Array.isArray(getFieldValue(record, fn, idx)) ? [...getFieldValue(record, fn, idx)] : [...items];
                              const updatedItem = { ...currentArr[itemIdx], [key]: editValue };
                              currentArr[itemIdx] = updatedItem;
                              // Stage a DRAFT locally (no DB write); Approve commits the whole array field.
                              stageDraft(record, fn, idx, sid, currentArr);
                              setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
                              setEditingField(null); setEditValue('');
                            }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(String(item[key]))}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${subLabel}: ${item[key]}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: LIFESTYLE MODIFICATIONS ═══════ */
  const renderLifestyleField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(item => item && typeof item === 'object') : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const subFields = [
      { key: 'category', label: 'Category' },
      { key: 'recommendation', label: 'Recommendation' },
      { key: 'benefits', label: 'Benefits' },
      { key: 'barriers', label: 'Potential Barriers' },
      { key: 'support', label: 'Support' },
    ];

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {items.map((item, itemIdx) => {
          const phrase = searchTerm.toLowerCase().trim();
          const itemStr = Object.values(item).filter(Boolean).join(' ').toLowerCase();
          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.includes(phrase)) return null;
          }
          return (
            <div key={itemIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
              <div className="nested-subtitle">{highlightText(item.category || `Modification ${itemIdx + 1}`)}</div>
              {subFields.map(({ key, label: subLabel }) => {
                if (!item[key]) return null;
                const editKey = `${fn}.${itemIdx}.${key}-${idx}`;
                const isEditing = editingField === editKey;
                const isModified = editedFields[editKey];
                const subPhrase = searchTerm.toLowerCase().trim();
                if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
                  const subLabelLower = subLabel.toLowerCase();
                  const subValLower = String(item[key]).toLowerCase();
                  if (!subLabelLower.includes(subPhrase) && !subValLower.includes(subPhrase) && !itemStr.includes(subPhrase)) return null;
                }
                return (
                  <div key={key}>
                    <div className="content-subtitle-label">{highlightText(subLabel)}</div>
                    <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(item[key])); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => {
                              e.stopPropagation(); const id2 = safeId(record); if (!id2) return;
                              setSaveError(null);
                              const currentArr = Array.isArray(getFieldValue(record, fn, idx)) ? [...getFieldValue(record, fn, idx)] : [...items];
                              const updatedItem = { ...currentArr[itemIdx], [key]: editValue };
                              currentArr[itemIdx] = updatedItem;
                              // Stage a DRAFT locally (no DB write); Approve commits the whole array field.
                              stageDraft(record, fn, idx, sid, currentArr);
                              setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
                              setEditingField(null); setEditValue('');
                            }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(String(item[key]))}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${subLabel}: ${item[key]}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: COMORBIDITY MANAGEMENT ═══════ */
  const renderComorbidityField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val) || typeof val !== 'object') return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const conditions = Array.isArray(val.conditions) ? val.conditions : [];
    const condSubFields = [
      { key: 'condition', label: 'Condition' },
      { key: 'management', label: 'Management' },
      { key: 'goals', label: 'Goals' },
    ];
    const topSubFields = [
      { key: 'interactions', label: 'Condition Interactions' },
      { key: 'prioritization', label: 'Treatment Prioritization' },
    ];

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>

        {conditions.length > 0 && conditions.map((cond, condIdx) => {
          const condStr = Object.values(cond).filter(Boolean).join(' ').toLowerCase();
          const phrase = searchTerm.toLowerCase().trim();
          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            if (!condStr.includes(phrase) && !label.toLowerCase().includes(phrase)) return null;
          }
          return (
            <div key={condIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
              <div className="nested-subtitle">{highlightText(cond.condition || `Condition ${condIdx + 1}`)}</div>
              {condSubFields.map(({ key, label: subLabel }) => {
                if (!cond[key]) return null;
                const editKey = `${fn}.conditions.${condIdx}.${key}-${idx}`;
                const isEditing = editingField === editKey;
                const isModified = editedFields[editKey];
                return (
                  <div key={key}>
                    <div className="content-subtitle-label">{highlightText(subLabel)}</div>
                    <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(cond[key])); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => {
                              e.stopPropagation(); const id2 = safeId(record); if (!id2) return;
                              setSaveError(null);
                              const currentVal2 = getFieldValue(record, fn, idx);
                              const newConditions = Array.isArray(currentVal2?.conditions) ? [...currentVal2.conditions] : [...conditions];
                              newConditions[condIdx] = { ...newConditions[condIdx], [key]: editValue };
                              const newObj = { ...currentVal2, conditions: newConditions };
                              // Stage a DRAFT locally (no DB write); Approve commits the whole object field.
                              stageDraft(record, fn, idx, sid, newObj);
                              setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
                              setEditingField(null); setEditValue('');
                            }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(String(cond[key]))}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${subLabel}: ${cond[key]}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                  </div>
                );
              })}
            </div>
          );
        })}

        {topSubFields.map(({ key, label: subLabel }) => {
          if (!val[key]) return null;
          const editKey = `${fn}.${key}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const phrase = searchTerm.toLowerCase().trim();
          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            if (!subLabel.toLowerCase().includes(phrase) && !String(val[key]).toLowerCase().includes(phrase) && !label.toLowerCase().includes(phrase)) return null;
          }
          return (
            <div key={key} style={{ marginTop: 8 }}>
              <div className="content-subtitle-label">{highlightText(subLabel)}</div>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(val[key])); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => {
                        e.stopPropagation(); const id2 = safeId(record); if (!id2) return;
                        setSaveError(null);
                        const currentVal2 = getFieldValue(record, fn, idx);
                        const newObj = { ...currentVal2, [key]: editValue };
                        // Stage a DRAFT locally (no DB write); Approve commits the whole object field.
                        stageDraft(record, fn, idx, sid, newObj);
                        setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
                        setEditingField(null); setEditValue('');
                      }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(String(val[key]))}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${subLabel}: ${val[key]}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: OUTCOME METRICS ═══════ */
  const renderMetricsField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(item => item && typeof item === 'object') : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const subFields = [
      { key: 'metric', label: 'Metric' },
      { key: 'target', label: 'Target' },
      { key: 'frequency', label: 'Measurement Frequency' },
    ];

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {items.map((item, itemIdx) => {
          const phrase = searchTerm.toLowerCase().trim();
          const itemStr = Object.values(item).filter(Boolean).join(' ').toLowerCase();
          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.includes(phrase)) return null;
          }
          return (
            <div key={itemIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
              <div className="nested-subtitle">{highlightText(item.metric || `Metric ${itemIdx + 1}`)}</div>
              {subFields.map(({ key, label: subLabel }) => {
                if (!item[key]) return null;
                const editKey = `${fn}.${itemIdx}.${key}-${idx}`;
                const isEditing = editingField === editKey;
                const isModified = editedFields[editKey];
                const subPhrase = searchTerm.toLowerCase().trim();
                if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
                  const subLabelLower = subLabel.toLowerCase();
                  const subValLower = String(item[key]).toLowerCase();
                  if (!subLabelLower.includes(subPhrase) && !subValLower.includes(subPhrase) && !itemStr.includes(subPhrase)) return null;
                }
                return (
                  <div key={key}>
                    <div className="content-subtitle-label">{highlightText(subLabel)}</div>
                    <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(item[key])); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => {
                              e.stopPropagation(); const id2 = safeId(record); if (!id2) return;
                              setSaveError(null);
                              const currentArr = Array.isArray(getFieldValue(record, fn, idx)) ? [...getFieldValue(record, fn, idx)] : [...items];
                              const updatedItem = { ...currentArr[itemIdx], [key]: editValue };
                              currentArr[itemIdx] = updatedItem;
                              // Stage a DRAFT locally (no DB write); Approve commits the whole array field.
                              stageDraft(record, fn, idx, sid, currentArr);
                              setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
                              setEditingField(null); setEditValue('');
                            }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(String(item[key]))}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${subLabel}: ${item[key]}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
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
      return hasVal(val);
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
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            if (f === 'tailoredInterventions') return renderInterventionsField(record, f, idx, sid);
            if (f === 'lifestyleModifications') return renderLifestyleField(record, f, idx, sid);
            if (f === 'comorbidityManagement') return renderComorbidityField(record, f, idx, sid);
            if (f === 'outcomeMetrics') return renderMetricsField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="patient-care-plan-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Patient Care Plan</h2></div>
        <div className="empty-state">No patient care plan records available</div>
      </div>
    );
  }

  return (
    <div className="patient-care-plan-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Patient Care Plan</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<PatientCarePlanDocumentPDFTemplate document={pdfData} />} fileName={`patient-care-plan-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search patient care plan..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              {hasVal(record.documentDate) && (
                <div className="record-meta-row">
                  <span className="record-date">{formatDate(record.documentDate)}</span>
                </div>
              )}
              <h3 className="record-name">{highlightText(record.patientName || `Care Plan ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'patient-info')}
            {renderSection(record, idx, 'interventions')}
            {renderSection(record, idx, 'lifestyle')}
            {renderSection(record, idx, 'comorbidity')}
            {renderSection(record, idx, 'metrics')}
            {renderSection(record, idx, 'meta')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PatientCarePlanDocument;
