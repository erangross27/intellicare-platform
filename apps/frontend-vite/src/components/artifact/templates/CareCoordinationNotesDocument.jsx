/**
 * CareCoordinationNotesDocument.jsx
 * June 2026 — Full-template standard, blue glow inline editing theme.
 * Collection: care_coordination_notes
 *
 * 24 editable fields:
 *   NUMBER (2): glasgowComaScale, estimatedGfr  → input[type=number], parseFloat/isNaN, hide-zero
 *   ARRAY  (9): comorbidities, currentMedications, allergiesContraindications, imagingStudies,
 *               followUpAppointments, careGoals, riskFactors, careTeamMembers, barriersToCare
 *   STRING (13): patientMrn, referringProvider, consultingSpecialty, primaryDiagnosis, vitalSigns,
 *               nyhaClassification, laboratorySummary, functionalStatus, dischargeInstructions,
 *               medicationReconciliation, socialDeterminants, transitionOfCare, advanceDirectives
 *   Per-sentence narratives (8): primaryDiagnosis, laboratorySummary, functionalStatus,
 *               dischargeInstructions, medicationReconciliation, socialDeterminants,
 *               transitionOfCare, advanceDirectives
 *   Simple strings (5): patientMrn, referringProvider, consultingSpecialty, vitalSigns, nyhaClassification
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import CareCoordinationNotesDocumentPDFTemplate from '../pdf-templates/CareCoordinationNotesDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './CareCoordinationNotesDocument.css';

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'referral': 'Referral',
  'diagnosis': 'Diagnosis',
  'comorbidities': 'Comorbidities',
  'allergies': 'Allergies & Contraindications',
  'vitals': 'Vitals & Labs',
  'medications': 'Medication Reconciliation',
  'meds': 'Current Medications',
  'imaging': 'Imaging Studies',
  'functional': 'Functional Status',
  'social': 'Social Determinants',
  'barriers': 'Barriers to Care',
  'goals': 'Care Goals',
  'risks': 'Risk Factors',
  'team': 'Care Team',
  'followUp': 'Follow-Up Appointments',
  'discharge': 'Discharge Instructions',
  'transition': 'Transition of Care',
  'advance': 'Advance Directives',
};

const FIELD_LABELS = {
  referringProvider: 'Referring Provider',
  consultingSpecialty: 'Consulting Specialty',
  patientMrn: 'Patient MRN',
  primaryDiagnosis: 'Primary Diagnosis',
  comorbidities: 'Comorbidities',
  allergiesContraindications: 'Allergies & Contraindications',
  vitalSigns: 'Vital Signs',
  glasgowComaScale: 'Glasgow Coma Scale',
  laboratorySummary: 'Laboratory Summary',
  estimatedGfr: 'eGFR',
  nyhaClassification: 'NYHA Classification',
  currentMedications: 'Current Medications',
  medicationReconciliation: 'Medication Reconciliation',
  imagingStudies: 'Imaging Studies',
  functionalStatus: 'Functional Status',
  socialDeterminants: 'Social Determinants',
  barriersToCare: 'Barriers to Care',
  careGoals: 'Care Goals',
  riskFactors: 'Risk Factors',
  careTeamMembers: 'Care Team Members',
  followUpAppointments: 'Follow-Up Appointments',
  dischargeInstructions: 'Discharge Instructions',
  transitionOfCare: 'Transition of Care',
  advanceDirectives: 'Advance Directives',
};

const SECTION_FIELDS = {
  'referral': ['referringProvider', 'consultingSpecialty', 'patientMrn'],
  'diagnosis': ['primaryDiagnosis'],
  'comorbidities': ['comorbidities'],
  'allergies': ['allergiesContraindications'],
  'vitals': ['vitalSigns', 'glasgowComaScale', 'laboratorySummary', 'estimatedGfr', 'nyhaClassification'],
  'medications': ['medicationReconciliation'],
  'meds': ['currentMedications'],
  'imaging': ['imagingStudies'],
  'functional': ['functionalStatus'],
  'social': ['socialDeterminants'],
  'barriers': ['barriersToCare'],
  'goals': ['careGoals'],
  'risks': ['riskFactors'],
  'team': ['careTeamMembers'],
  'followUp': ['followUpAppointments'],
  'discharge': ['dischargeInstructions'],
  'transition': ['transitionOfCare'],
  'advance': ['advanceDirectives'],
};

const NUMBER_FIELDS = ['glasgowComaScale', 'estimatedGfr'];
const ARRAY_FIELDS = ['comorbidities', 'currentMedications', 'allergiesContraindications', 'imagingStudies', 'followUpAppointments', 'careGoals', 'riskFactors', 'careTeamMembers', 'barriersToCare'];
const SENTENCE_FIELDS = ['primaryDiagnosis', 'laboratorySummary', 'functionalStatus', 'dischargeInstructions', 'medicationReconciliation', 'socialDeterminants', 'transitionOfCare', 'advanceDirectives'];
const STRING_FIELDS = ['patientMrn', 'referringProvider', 'consultingSpecialty', 'vitalSigns', 'nyhaClassification'];

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: split on top-level commas only — NOT inside parentheses, NOT when the word
   "and"/"or" sits right before or right after the comma (keeps "..., and X" together), and
   NOT when the comma has no following space (keeps numbers like "$18,000" intact) */
const splitByComma = (text) => {
  const s = String(text || ''); const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; continue; }
    if (ch === ',' && depth === 0) {
      if (!/\s/.test(s[i + 1] || '')) { cur += ch; continue; }
      const rest = s.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest)) { cur += ch; continue; }
      if (/\b(and|or)\s*$/i.test(cur)) { cur += ch; continue; }
      const t = cur.trim(); if (t) out.push(t); cur = ''; continue;
    }
    cur += ch;
  }
  const t = cur.trim(); if (t) out.push(t);
  return out.length ? out : (s.trim() ? [s.trim()] : []);
};

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'care_coordination_notesPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ═══════ COMPONENT ═══════ */
const CareCoordinationNotesDocument = ({ document: docProp }) => {
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
      if (r?.care_coordination_notes) return Array.isArray(r.care_coordination_notes) ? r.care_coordination_notes : [r.care_coordination_notes];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.care_coordination_notes) return Array.isArray(dd.care_coordination_notes) ? dd.care_coordination_notes : [dd.care_coordination_notes]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     Array-field drafts are stored per-item ("field.itemIdx"); we rebuild the full array off the
     original record so localEdits keeps its full-array convention for "field-idx". */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    const arrAccum = {}; // `${fn}-${idx}` -> rebuilt array
    records.forEach((record, idx) => {
      const rid = (record && record._id) ? (typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id))) : null;
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const dotIdx = fieldPart.lastIndexOf('.');
        const tail = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const isArrayItem = dotIdx !== -1 && /^\d+$/.test(tail);
        if (isArrayItem) {
          const fn = fieldPart.slice(0, dotIdx);
          const itemIdx = parseInt(tail, 10);
          const localKey = `${fn}-${idx}`;
          if (!arrAccum[localKey]) arrAccum[localKey] = [...(Array.isArray(record[fn]) ? record[fn] : [])];
          arrAccum[localKey][itemIdx] = value;
          nPending[localKey] = true;
          nFields[`${fn}.${itemIdx}-${idx}`] = 'edited';
        } else {
          const fn = fieldPart;
          const localKey = `${fn}-${idx}`;
          nLocal[localKey] = value;
          nPending[localKey] = true;
          if (SENTENCE_FIELDS.includes(fn)) nSentences[`${fn}-${idx}-s0`] = 'edited';
          else nFields[localKey] = 'edited';
        }
      });
    });
    Object.assign(nLocal, arrAccum);
    if (Object.keys(nLocal).length === 0 && Object.keys(nPending).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasNumber = useCallback((v) => { if (v === null || v === undefined || v === '') return false; const n = Number(v); return !isNaN(n) && n !== 0; }, []);
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fieldHasVal = useCallback((fn, v) => { if (NUMBER_FIELDS.includes(fn)) return hasNumber(v); return hasVal(v); }, [hasVal, hasNumber]);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);
  /* sentence fields: split by sentence FIRST, then by (paren/and-or-aware) comma.
     A labeled sentence ("Current: A, B") keeps its label on EVERY comma part so all parts
     group under one sub-label; entry.text is always a verbatim substring of the original
     (label excluded), so per-item save splices back without touching the label. */
  const buildSentenceEntries = useCallback((text) => {
    const entries = [];
    splitBySentence(text).forEach(sentence => {
      const p = parseLabel(sentence);
      if (p.isLabeled) splitByComma(p.value).forEach(part => entries.push({ text: part, label: p.label }));
      else splitByComma(sentence).forEach(part => entries.push({ text: part, label: null }));
    });
    return entries;
  }, [splitBySentence]);
  const splitItems = useCallback((text) => buildSentenceEntries(text).map(e => e.text), [buildSentenceEntries]);

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
      const rt = `Care Coordination Notes ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && (Array.isArray(val) ? val.some(item => String(item).toLowerCase().includes(phrase)) : fmtVal(val).toLowerCase().includes(phrase))) return true;
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
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          merged[m[1]] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${fn}-${idx}`;
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    if (sid) setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });

    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);

    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // Save one sentence = stage a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
  function stageSentenceDraft(record, fn, idx, sid, fullText, sentenceMarkers) {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedSentences(prev => ({ ...prev, ...sentenceMarkers }));
    if (sid) setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }

  /* Splice the edited item back into the ORIGINAL text by walking item-by-item so every
     delimiter (". " / ", " / "; ") + spacing is preserved exactly. Items come from splitItems. */
  function saveSentence(record, fn, idx, sid, itemIdx, valueOverride) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const items = splitItems(currentVal);
    const cleanNew = (valueOverride !== undefined ? valueOverride : editValue).trim();
    const cleanOld = (items[itemIdx] || '').trim();
    if (cleanNew === cleanOld || cleanNew === cleanOld.replace(/[;.]+$/, '').trim()) { setEditingField(null); setEditValue(''); return; }
    let cursor = 0, rebuilt = '', ok = true;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const pos = currentVal.indexOf(it, cursor);
      if (pos === -1) { ok = false; break; }
      rebuilt += currentVal.slice(cursor, pos) + (i === itemIdx ? cleanNew : it);
      cursor = pos + it.length;
    }
    let fullText = ok ? (rebuilt + currentVal.slice(cursor))
      : items.map((it, i) => (i === itemIdx ? cleanNew : it)).filter(Boolean).join(', ');
    // tidy delimiter artifacts left by an emptied item
    fullText = fullText.replace(/,\s*,/g, ', ').replace(/\s{2,}/g, ' ').replace(/^[\s,;.]+/, '').replace(/[\s,;]+$/, '').trim();
    const newCount = splitItems(fullText).length;
    const extra = Math.max(0, newCount - items.length);
    const markers = { [`${fn}-${idx}-s${itemIdx}`]: 'edited' };
    for (let ei = 0; ei < extra; ei++) markers[`${fn}-${idx}-s${itemIdx + 1 + ei}`] = 'added';
    stageSentenceDraft(record, fn, idx, sid, fullText, markers);
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts for this record to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true);
    try {
      // Collect this record's staged drafts for the fields owned by this section.
      const store = readDrafts();
      const recDrafts = store[id] || {};
      const clearedLocalKeys = new Set();
      for (const [fieldPart, value] of Object.entries(recDrafts)) {
        const dotIdx = fieldPart.lastIndexOf('.');
        const tail = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const isArrayItem = dotIdx !== -1 && /^\d+$/.test(tail);
        const baseField = isArrayItem ? fieldPart.slice(0, dotIdx) : fieldPart;
        if (!fields.includes(baseField)) continue; // belongs to another section
        const payload = { field: baseField, value };
        if (isArrayItem) payload.arrayIndex = parseInt(tail, 10);
        const resp = await secureApiClient.put(`/api/edit/care_coordination_notes/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        clearedLocalKeys.add(`${baseField}-${idx}`);
        delete recDrafts[fieldPart];
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/care_coordination_notes/${id}/approve`, { sectionId: sid, approved: true });

      // Persist draft removal for this record (other sections' drafts, if any, stay)
      if (Object.keys(recDrafts).length === 0) delete store[id]; else store[id] = recDrafts;
      writeDrafts(store);

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; clearedLocalKeys.forEach(k => delete n[k]); return n; });
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }, [safeId]);

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
  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    const hideLabel = fields.length === 1; // single-field section: title already names it (Rule #47)
    /* entries [{text, label}] → label on its own line (once per consecutive group), values numbered below */
    const appendGrouped = (entries) => {
      let prevGroupLabel = null, groupNum = 0, plainNum = 0;
      entries.forEach(e => {
        if (e.label) {
          if (e.label !== prevGroupLabel) { text += `${e.label}:\n`; groupNum = 0; }
          groupNum += 1;
          text += `  ${groupNum}. ${e.text}\n`;
          prevGroupLabel = e.label;
        } else {
          plainNum += 1;
          text += `${plainNum}. ${e.text}\n`;
          prevGroupLabel = null;
        }
      });
      text += '\n';
    };
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!fieldHasVal(f, val)) return;
      const labelLine = hideLabel ? '' : `${label}\n`;
      if (NUMBER_FIELDS.includes(f)) {
        text += hideLabel ? `${fmtVal(val)}\n\n` : `${label}: ${fmtVal(val)}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val.filter(Boolean) : [val];
        text += labelLine;
        appendGrouped(items.map(it => { const p = parseLabel(String(it)); return p.isLabeled ? { text: p.value, label: p.label } : { text: String(it), label: null }; }));
      } else if (SENTENCE_FIELDS.includes(f)) {
        const strVal = fmtVal(val);
        const entries = buildSentenceEntries(strVal);
        if (entries.length > 1) {
          text += labelLine;
          appendGrouped(entries.map(e => ({ text: e.text, label: e.label && e.label.toLowerCase() !== label.toLowerCase() ? e.label : null })));
        } else {
          text += `${labelLine}${strVal}\n\n`;
        }
      } else {
        text += `${labelLine}${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, fieldHasVal, fmtVal, buildSentenceEntries]);

  const copyAllText = useCallback(async () => {
    let text = '=== CARE COORDINATION NOTES ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Care Coordination Notes ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const fields = SECTION_FIELDS[sid] || [];
        if (fields.some(f => fieldHasVal(f, getFieldValue(r, f, idx)))) text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText, fieldHasVal, getFieldValue]);

  /* ═══════ RENDER: NUMBER FIELD — input[type=number], parseFloat/isNaN ═══════ */
  /* hideLabel: single-field sections skip the nested-subtitle — the section header already shows the name (Rule #47) */
  const renderNumberField = (record, fn, idx, sid, hideLabel) => {
    const val = getFieldValue(record, fn, idx); if (!hasNumber(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = String(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {!hideLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <input type="number" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); const parsed = parseFloat(editValue); if (isNaN(parsed)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, parsed); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const parsed = parseFloat(editValue); if (isNaN(parsed)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, parsed); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(hideLabel ? displayVal : `${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY FIELD (per-item editing with dot-path keys) ═══════ */
  /* "Label: value" items → nested-mini-card with a sub-label shown once per consecutive
     same-label group; edit shows the value only and save rebuilds "Label: value". */
  const renderArrayField = (record, fn, idx, sid, hideLabel) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const groups = [];
    items.forEach((item, itemIdx) => {
      const itemStr = String(item);
      const parsed = parseLabel(itemStr);
      const gLabel = parsed.isLabeled ? parsed.label : null;
      const last = groups[groups.length - 1];
      if (last && gLabel !== null && last.label === gLabel) last.entries.push({ itemIdx, itemStr, parsed });
      else groups.push({ label: gLabel, entries: [{ itemIdx, itemStr, parsed }] });
    });

    const renderItemRow = ({ itemIdx, itemStr, parsed }) => {
      const editKey = `${fn}.${itemIdx}-${idx}`;
      const isEditing = editingField === editKey;
      const isModified = editedFields[editKey];
      const displayVal = parsed.isLabeled ? parsed.value : itemStr;

      if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
        const phrase = searchTerm.toLowerCase().trim();
        const labelLower = label.toLowerCase();
        if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
      }

      return (
        <div key={itemIdx}>
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
            {isEditing ? (
              <div className="edit-field-container">
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; setSaveError(null); const newItemVal = parsed.isLabeled ? `${parsed.label}: ${editValue.trim()}` : editValue; const cur = getFieldValue(record, fn, idx); const currentArr = [...(Array.isArray(cur) ? cur : [])]; currentArr[itemIdx] = newItemVal; setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: currentArr })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); const store = readDrafts(); if (!store[id2]) store[id2] = {}; store[id2][`${fn}.${itemIdx}`] = newItemVal; writeDrafts(store); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
                <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, editKey); }}>{copiedItems[editKey] ? 'Copied' : 'Copy'}</button>
              </>
            )}
          </div>
          {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      );
    };

    return (
      <div key={fn} className="rec-mini-card">
        {!hideLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {groups.map((g, gi) => {
          const rows = g.entries.map(renderItemRow).filter(Boolean);
          if (rows.length === 0) return null;
          return (
            <div key={gi} className="nested-mini-card">
              {g.label && <div className="nested-subtitle sub-label">{highlightText(g.label)}</div>}
              {rows}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: SENTENCE FIELD — per-item editable rows (sentence split, then comma split) ═══════ */
  const renderSentenceField = (record, fn, idx, sid, hideLabel) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const entries = buildSentenceEntries(strVal);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    if (entries.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      /* group consecutive same-label entries → sub-label shown once per group */
      const groups = [];
      entries.forEach((e, i) => {
        const gLabel = e.label && e.label.toLowerCase() !== label.toLowerCase() ? e.label : null;
        const last = groups[groups.length - 1];
        if (last && gLabel !== null && last.label === gLabel) last.entries.push({ ...e, i });
        else groups.push({ label: gLabel, entries: [{ ...e, i }] });
      });

      const renderEntryRow = (e) => {
        const sentenceKey = `${fn}-${idx}-s${e.i}`;
        const isEditing = editingField === sentenceKey;
        const badge = editedSentences[sentenceKey];
        const full = e.label ? `${e.label}: ${e.text}` : e.text;
        const entryMatches = phraseMatch || labelMatch || (searchTerm.trim() && full.toLowerCase().includes(searchTerm.toLowerCase().trim()));
        if (!entryMatches && searchTerm.trim()) return null;
        return (
          <div key={e.i}>
            <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(e.text.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
              {isEditing ? (
                <div className="edit-field-container">
                  <textarea className="edit-textarea" value={editValue} onChange={ev => setEditValue(ev.target.value)} autoFocus onKeyDown={ev => { if (ev.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  {saveError && <div className="save-error">{saveError}</div>}
                  <div className="edit-actions">
                    <button className="save-btn" disabled={saving} onClick={ev => { ev.stopPropagation(); saveSentence(record, fn, idx, sid, e.i); }}>{saving ? 'Saving...' : 'Save'}</button>
                    <button className="cancel-btn" onClick={ev => { ev.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="row-content"><span className="content-value">{highlightText(e.text)}</span><span className="edit-indicator">&#9998;</span></div>
                  <button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={ev => { ev.stopPropagation(); copyItem(full, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied' : 'Copy'}</button>
                </>
              )}
            </div>
            {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
          </div>
        );
      };

      return (
        <div key={fn} className="rec-mini-card">
          {!hideLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
          {groups.map((g, gi) => {
            const rows = g.entries.map(renderEntryRow).filter(Boolean);
            if (rows.length === 0) return null;
            if (!g.label) return <React.Fragment key={gi}>{rows}</React.Fragment>;
            return (
              <div key={gi} className="nested-mini-card" style={{ marginTop: 8 }}>
                <div className="nested-subtitle sub-label">{highlightText(g.label)}</div>
                {rows}
              </div>
            );
          })}
        </div>
      );
    }

    /* Single-sentence: simple editable (saved via saveSentence to keep per-sentence keys) */
    const sentenceKey = `${fn}-${idx}-s0`;
    const isEditing = editingField === sentenceKey;
    const badge = editedSentences[sentenceKey];

    return (
      <div key={fn} className="rec-mini-card">
        {!hideLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(strVal.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
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
              <button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(hideLabel ? strVal : `${label}\n${strVal}`, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied' : 'Copy'}</button>
            </>
          )}
        </div>
        {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: SIMPLE STRING FIELD ═══════ */
  const renderStringField = (record, fn, idx, sid, hideLabel) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];

    return (
      <div key={fn} className="rec-mini-card">
        {!hideLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
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
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(hideLabel ? strVal : `${label}\n${strVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied' : 'Copy'}</button>
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

    const hasAnyVal = fields.some(f => fieldHasVal(f, getFieldValue(record, f, idx)));
    if (!hasAnyVal) return null;

    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            const hideLabel = fields.length === 1; // single-field section: header already names it (Rule #47)
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid, hideLabel);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid, hideLabel);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceField(record, f, idx, sid, hideLabel);
            return renderStringField(record, f, idx, sid, hideLabel);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <article className="care-coord-notes-document" ref={containerRef}>
        <header className="document-header"><h1 className="document-title">Care Coordination Notes</h1></header>
        <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
        <div className="empty-state">No data available.</div>
      </article>
    );
  }

  return (
    <article className="care-coord-notes-document" ref={containerRef}>
      <header className="document-header">
        <h1 className="document-title">Care Coordination Notes</h1>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<CareCoordinationNotesDocumentPDFTemplate document={pdfData} />} fileName="Care_Coordination_Notes.pdf">
            {({ loading }) => <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>}
          </PDFDownloadLink>
        </div>
      </header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Care Coordination Notes ${idx + 1}`)}</h3></div>
            </div>
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, idx, sid))}
          </div>
        ))}
      </div>
    </article>
  );
};

export default CareCoordinationNotesDocument;
