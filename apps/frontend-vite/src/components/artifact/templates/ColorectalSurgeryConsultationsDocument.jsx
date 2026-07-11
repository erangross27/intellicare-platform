/**
 * ColorectalSurgeryConsultationsDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: colorectal_surgery_consultations
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ColorectalSurgeryConsultationsDocumentPDFTemplate from '../pdf-templates/ColorectalSurgeryConsultationsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueDatePicker from '../components/BlueDatePicker';
import './ColorectalSurgeryConsultationsDocument.css';

const SECTION_TITLES = {
  'consultation-info': 'Consultation Information',
  diagnosis: 'Diagnosis',
  'diagnostic-findings': 'Diagnostic Findings',
  'surgical-plan': 'Surgical Plan',
  'patient-factors': 'Patient Factors',
  'counseling-review': 'Counseling & Review',
};

const FIELD_LABELS = {
  consultationDate: 'Consultation Date', provider: 'Provider', facility: 'Facility', referralReason: 'Referral Reason', urgency: 'Urgency',
  chiefComplaint: 'Chief Complaint', primaryDiagnosis: 'Primary Diagnosis', diagnosisCode: 'Diagnosis Codes',
  colonoscopyFindings: 'Colonoscopy Findings', imagingFindings: 'Imaging Findings', biopsyResults: 'Biopsy Results', tumorLocation: 'Tumor/Dysplasia Location', tumorSize: 'Tumor Size', clinicalStaging: 'Clinical Staging', ceaLevel: 'CEA Level',
  recommendedProcedure: 'Recommended Procedure', surgicalApproach: 'Surgical Approach', ostomyPlanned: 'Ostomy Planned', neoadjuvantTherapy: 'Neoadjuvant Therapy', bowelPreparation: 'Bowel Preparation',
  comorbidities: 'Comorbidities', asaClassification: 'ASA Classification', anticoagulationStatus: 'Anticoagulation Status',
  patientCounseling: 'Patient Counseling', multidisciplinaryReview: 'Multidisciplinary Review',
};

const SECTION_FIELDS = {
  'consultation-info': ['consultationDate', 'provider', 'facility', 'referralReason', 'urgency'],
  diagnosis: ['chiefComplaint', 'primaryDiagnosis', 'diagnosisCode'],
  'diagnostic-findings': ['colonoscopyFindings', 'imagingFindings', 'biopsyResults', 'tumorLocation', 'tumorSize', 'clinicalStaging', 'ceaLevel'],
  'surgical-plan': ['recommendedProcedure', 'surgicalApproach', 'ostomyPlanned', 'neoadjuvantTherapy', 'bowelPreparation'],
  'patient-factors': ['comorbidities', 'asaClassification', 'anticoagulationStatus'],
  'counseling-review': ['patientCounseling', 'multidisciplinaryReview'],
};

const SENTENCE_FIELDS = ['colonoscopyFindings', 'imagingFindings', 'biopsyResults', 'chiefComplaint', 'patientCounseling', 'multidisciplinaryReview', 'surgicalApproach'];
const ARRAY_FIELDS = ['comorbidities', 'diagnosisCode'];
const NUMBER_FIELDS = ['ceaLevel'];
const DATE_FIELDS = ['consultationDate'];
// Fixed-choice fields → dropdown (keep an unmatched current value as an extra option so nothing is lost).
const ENUM_FIELDS = { ostomyPlanned: ['none', 'temporary', 'permanent'], urgency: ['elective', 'urgent', 'emergent'] };
const enumOptionsWith = (opts, current) => { const cur = String(current ?? '').trim(); return cur && !opts.some(o => o.toLowerCase() === cur.toLowerCase()) ? [cur, ...opts] : opts; };
// ceaLevel 0 = tumor-marker extraction default (not a real value for a non-cancer consult) → hide it.
const HIDE_ZERO_FIELDS = ['ceaLevel'];
// Copy dividers (4-area mirror): EQ under record + section titles, DASH under every field / group label.
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
// −/+ stepper increment: 1 for integers, else a step matching the value's decimal precision.
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
// Comma splitter for narrative lists (per sentence, >=3 gate). Paren-aware; keeps Oxford ", and/or X"
// attached; skips no-space commas ("$18,000") and date commas ("January 8, 2026").
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

const toInputDate = (dateValue) => { if (!dateValue) return ''; try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; } };

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the editKey with its trailing "-<idx>" removed) */
const DRAFT_KEY = 'colorectal_surgery_consultationsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const ColorectalSurgeryConsultationsDocument = ({ document: docProp }) => {
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
  // editKeys staged as drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const containerRef = useRef(null);

  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.colorectal_surgery_consultations) return Array.isArray(r.colorectal_surgery_consultations) ? r.colorectal_surgery_consultations : [r.colorectal_surgery_consultations];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.colorectal_surgery_consultations) return Array.isArray(dd.colorectal_surgery_consultations) ? dd.colorectal_surgery_consultations : [dd.colorectal_surgery_consultations]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  const safeIdOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = safeIdOf(record);
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

  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; return true; }, []);
  // Field-aware presence: ceaLevel 0 is a "not documented" tumor-marker sentinel → hide.
  const fieldHasVal = useCallback((fn, v) => { if (HIDE_ZERO_FIELDS.includes(fn) && (v === 0 || v === '0')) return false; return hasVal(v); }, [hasVal]);
  const formatDate = useCallback((d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);
  // Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 mg".
  const splitBySentence = useCallback((text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); }, []);
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
      if (ARRAY_FIELDS.includes(f)) { const arr = getEffectiveArray(record, f, 0); for (const item of arr) { if (String(item).toLowerCase().includes(phrase)) return true; } }
      else { const val = getFieldValue(record, f, 0); if (val !== null && val !== undefined && fmtVal(val).toLowerCase().includes(phrase)) return true; }
    }
    return false;
  }, [searchTerm, getFieldValue, getEffectiveArray, fmtVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    if (ARRAY_FIELDS.includes(fn)) { const arr = getEffectiveArray(record, fn, idx); for (const item of arr) { if (String(item).toLowerCase().includes(phrase)) return true; } return false; }
    const val = getFieldValue(record, fn, idx);
    return val !== null && val !== undefined && fmtVal(val).toLowerCase().includes(phrase);
  }, [searchTerm, getFieldValue, getEffectiveArray, fmtVal]);

  const sectionTitleMatches = useCallback((sid) => { if (!searchTerm.trim()) return false; const p = searchTerm.toLowerCase().trim(); const t = (SECTION_TITLES[sid] || '').toLowerCase(); return t.includes(p) || p.includes(t); }, [searchTerm]);

  // Parse "Label: value" pattern from a sentence
  const parseLabel = (sentence) => {
    const match = sentence.match(/^([A-Za-z][A-Za-z0-9 /()-]{1,40}):\s*(.+)$/s);
    if (match) return { isLabeled: true, label: match[1].trim(), value: match[2].trim() };
    return { isLabeled: false, label: null, value: sentence };
  };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Colorectal Surgery Consultation ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const f of Object.keys(FIELD_LABELS)) {
        if (ARRAY_FIELDS.includes(f)) { const arr = Array.isArray(record[f]) ? record[f] : []; for (const item of arr) { if (String(item).toLowerCase().includes(phrase)) return true; } }
        else { const val = record[f]; if (val && fmtVal(val).toLowerCase().includes(phrase)) return true; }
      }
      return false;
    });
  }, [records, searchTerm, fmtVal]);

  const pdfData = useMemo(() => filteredRecords.map((r, idx) => { const m = { ...r }; Object.keys(localEdits).forEach(k => { if (pendingEdits[k]) return; const mt = k.match(/^(.+)-(\d+)$/); if (mt && parseInt(mt[2]) === idx) m[mt[1]] = localEdits[k]; }); return m; }), [filteredRecords, localEdits, pendingEdits]);

  const handleSaveField = useCallback(async (record, fn, idx, sid) => {
    const id = safeId(record); if (!id) return;
    const trimmed = editValue.trim();
    const originalVal = record[fn];
    let saveVal = trimmed;

    // Number: validate numeric
    if (typeof originalVal === 'number' && !ARRAY_FIELDS.includes(fn)) {
      if (isNaN(Number(trimmed))) { setSaveError('Please enter a valid number'); return; }
      saveVal = Number(trimmed);
    }
    // Boolean: validate yes/no
    if (typeof originalVal === 'boolean') {
      const lower = trimmed.toLowerCase();
      if (!['true', 'false', 'yes', 'no', '1', '0'].includes(lower)) { setSaveError('Please enter Yes or No'); return; }
      saveVal = ['true', 'yes', '1'].includes(lower);
    }
    // Date: validate parseable + normalize to ISO timestamp
    if (DATE_FIELDS.includes(fn)) {
      const iso = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00.000Z` : trimmed;
      const testDate = new Date(iso);
      if (isNaN(testDate.getTime())) { setSaveError('Please enter a valid date'); return; }
      saveVal = iso;
    }
    setSaveError('');
    // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
    // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
    const isArray = ARRAY_FIELDS.includes(fn);
    const editKey = editingField;
    const localKey = `${fn}-${idx}`;
    let draftValue;
    if (isArray) {
      const arrMatch = editKey?.match(/-ai(\d+)$/);
      const arrayIndex = arrMatch ? parseInt(arrMatch[1]) : null;
      if (arrayIndex === null) { setEditingField(null); setEditValue(''); return; }
      const arr = [...(getEffectiveArray(record, fn, idx))]; arr[arrayIndex] = editValue;
      draftValue = arr;
      setLocalEdits(prev => ({ ...prev, [localKey]: arr }));
      setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-ai${arrayIndex}`]: 'edited' }));
    } else {
      draftValue = saveVal;
      setLocalEdits(prev => ({ ...prev, [localKey]: saveVal }));
      setEditedFields(prev => ({ ...prev, [localKey]: 'edited' }));
    }
    setPendingEdits(prev => ({ ...prev, [localKey]: true }));
    setEditingField(null); setEditValue('');
    // Re-edit after approval → drop this record's approved flags so the button goes back to yellow Pending Approve
    setApprovedSections(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.endsWith(`-${idx}`)) delete n[k]; }); return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = draftValue;
    writeDrafts(store);
  }, [editingField, editValue, safeId, getEffectiveArray]);

  // Stage a DRAFT (no DB write). localStorage keeps it across refresh; Pending Approve commits it.
  function stageDraft(id, fn, idx, fullText) {
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    setApprovedSections(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.endsWith(`-${idx}`)) delete n[k]; }); return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
  }

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || ''); const sentences = splitBySentence(currentVal); const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) { const updated = [...sentences]; updated.splice(sentenceIdx, 1); const fullText = reconstructFullText(updated);
      stageDraft(id, fn, idx, fullText); setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' })); setEditingField(null); setEditValue(''); return; }
    const newSentences = splitBySentence(editedVal); const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences); const fullText = reconstructFullText(updated);
    stageDraft(id, fn, idx, fullText);
    const orig = sentences[sentenceIdx] || ''; const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => { const n = { ...prev }; if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; const extra = newSentences.length - 1; for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; return n; });
    setEditingField(null); setEditValue('');
  }

  // Per-comma-item save: reconstructs "Label: item1, item2, item3" from edited single item
  function saveCommaItem(record, fn, idx, sid, sIdx, commaIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const sentence = sentences[sIdx] || '';
    const parsed = parseLabel(sentence.replace(/[;.]+$/, '').trim());
    const rawValue = parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim();
    const items = splitByComma(rawValue);
    const trimmed = editValue.trim();

    if (!trimmed) {
      // Delete: remove comma item
      items.splice(commaIdx, 1);
    } else {
      // Check for ". NewItem" pattern — user adding new comma items via period
      const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s);
      if (subParts.length > 1) {
        items.splice(commaIdx, 1, ...subParts);
      } else {
        items[commaIdx] = trimmed.replace(/[;.]+$/, '').trim();
      }
    }

    const rebuilt = items.length > 0 ? (parsed.isLabeled ? `${parsed.label}: ${items.join(', ')}` : items.join(', ')) : '';
    const updated = [...sentences];
    if (rebuilt) { updated[sIdx] = rebuilt; } else { updated.splice(sIdx, 1); }
    const fullText = reconstructFullText(updated);
    // Stage as a DRAFT (no DB write). Pending Approve commits it.
    stageDraft(id, fn, idx, fullText);
    // Track edit markers
    const trimmedParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s);
    const originalItem = splitByComma(parsed.value)[commaIdx] || '';
    const originalChanged = trimmedParts[0] !== originalItem;
    setEditedSentences(prev => {
      const n = { ...prev };
      if (originalChanged) n[`${fn}-${idx}-s${sIdx}-c${commaIdx}`] = 'edited';
      // Mark new items as 'added'
      for (let ei = 1; ei < trimmedParts.length; ei++) {
        n[`${fn}-${idx}-s${sIdx}-c${commaIdx + ei}`] = 'added';
      }
      return n;
    });
    setEditingField(null); setEditValue('');
  }

  const sectionHasEdits = useCallback((idx, sid) => { const fields = SECTION_FIELDS[sid] || []; return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))); }, [editedFields, editedSentences]);
  // Approve = COMMIT all staged drafts for this record's section to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    try {
      // editKey convention is "<field>-<idx>"; commit only this section's pending edits.
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix) && fields.includes(k.slice(0, -suffix.length)));
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "<field>" (no dot suffix in this template)
        const lastDot = fieldPart.lastIndexOf('.');
        const payload = { field: fieldPart, value: localEdits[editKey] };
        // arrayIndex only when the trailing dot-segment is purely numeric (none in this template)
        if (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1))) {
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        }
        const resp = await secureApiClient.put(`/api/edit/colorectal_surgery_consultations/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/colorectal_surgery_consultations/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) { fields.forEach(f => { delete store[id][f]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); }
  }, [safeId, localEdits, pendingEdits]);
  const renderApproveButton = useCallback((record, sid, idx) => { const hasEdits = sectionHasEdits(idx, sid); const isApproved = approvedSections[`${sid}-${idx}`]; if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>); if (isApproved) return <span className="approve-btn approved">Approved</span>; return null; }, [sectionHasEdits, approvedSections, handleApproveSection]);

  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  // Shared EQ/DASH numbered section-copy builder — 4-area mirror. Copy Section passes live getFieldValue;
  // Copy All passes pdfData's committed values. Sentence fields use labeled groups (a "Label: value" head →
  // label + DASH + comma-split value rows when >=3; numbering restarts at each labeled group, unlabeled
  // continues). Returns '' when the section has no present fields.
  const buildSectionCopy = useCallback((record, idx, sid, valueOf) => {
    const title = SECTION_TITLES[sid];
    const lines = [];
    (SECTION_FIELDS[sid] || []).forEach(f => {
      const val = valueOf(f);
      if (!fieldHasVal(f, val)) return;
      const label = FIELD_LABELS[f] || f;
      const showLabel = label.toLowerCase() !== title.toLowerCase();
      if (ARRAY_FIELDS.includes(f)) {
        const arr = Array.isArray(val) ? val : [];
        if (arr.length === 0) return;
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        arr.forEach((item, i) => lines.push(`${i + 1}. ${String(item)}`));
        lines.push('');
      } else if (SENTENCE_FIELDS.includes(f)) {
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        let n = 0;
        splitBySentence(fmtVal(val)).forEach(s => {
          const p = parseLabel(s.replace(/[;.]+$/, '').trim());
          const rawVal = p.value || '';
          const c = splitByComma(rawVal);
          const parts = c.length >= 3 ? c : [rawVal];
          if (p.isLabeled) { lines.push(p.label, COPY_LINE_DASH); n = 0; }
          parts.forEach(part => lines.push(`${++n}. ${part.replace(/[;.]+$/, '').trim()}`));
        });
        lines.push('');
      } else if (DATE_FIELDS.includes(f)) {
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        lines.push(`1. ${formatDate(val)}`, '');
      } else {
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        lines.push(`1. ${fmtVal(val)}`, '');
      }
    });
    if (lines.length === 0) return '';
    return `${title}\n${COPY_LINE_EQ}\n\n${lines.join('\n')}\n`;
  }, [fieldHasVal, fmtVal, formatDate, splitBySentence]);

  const copyAllText = useCallback(async () => {
    let text = '=== COLORECTAL SURGERY CONSULTATIONS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Colorectal Surgery Consultation ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const block = buildSectionCopy(r, idx, sid, f => r[f]);
        if (block) text += `${block}\n`;
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text); if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, buildSectionCopy, copyToClipboard]);

  // −/+ number stepper (native spinner banned). min 0; Enter saves; stopPropagation so the row click
  // doesn't re-open/close the editor. onSave commits the field.
  const numberStepper = (onSave) => {
    const bump = (dir) => { setSaveError(''); const s = parseFloat(stepFor(editValue)) || 1; const nv = (parseFloat(editValue) || 0) + dir * s; setEditValue(String(Math.max(0, Math.round(nv * 1e6) / 1e6))); };
    return (
      <div className="num-stepper-row">
        <button type="button" className="num-step" onClick={e => { e.stopPropagation(); bump(-1); }}>−</button>
        <input type="number" step={stepFor(editValue)} min="0" className="edit-number" value={editValue} autoFocus onClick={e => e.stopPropagation()} onChange={e => { setSaveError(''); setEditValue(e.target.value); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onSave(); } else if (e.key === 'Escape') { setSaveError(''); setEditingField(null); setEditValue(''); } }} />
        <button type="button" className="num-step" onClick={e => { e.stopPropagation(); bump(1); }}>+</button>
      </div>
    );
  };

  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!fieldHasVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey; const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const isDate = DATE_FIELDS.includes(fn); const isNumber = NUMBER_FIELDS.includes(fn);
    const enumOpts = ENUM_FIELDS[fn] ? enumOptionsWith(ENUM_FIELDS[fn], val) : null;
    const displayVal = isDate ? formatDate(val) : fmtVal(val);
    const startEdit = () => { setSaveError(''); setEditingField(editKey); if (enumOpts) { const cur = String(val ?? '').trim(); const m = enumOpts.find(o => o.toLowerCase() === cur.toLowerCase()); setEditValue(m || cur); } else setEditValue(isDate ? toInputDate(val) : fmtVal(val)); };
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (<div key={fn} className={sl ? 'rec-mini-card' : ''}>{sl && <div className="nested-subtitle">{highlightText(label)}</div>}<div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) startEdit(); }}>{isEditing ? (<div className="edit-field-container">{enumOpts ? (
      <select className="edit-select" value={editValue} autoFocus onChange={e => { setSaveError(''); setEditValue(e.target.value); }} onKeyDown={e => { if (e.key === 'Escape') { setSaveError(''); setEditingField(null); setEditValue(''); } }}>{enumOpts.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}</select>
    ) : isDate ? (
      <BlueDatePicker value={editValue} onSelect={(iso) => { setSaveError(''); setEditValue(iso); }} />
    ) : isNumber ? (
      numberStepper(() => handleSaveField(record, fn, idx, sid))
    ) : (
      <textarea className="edit-textarea" value={editValue} onChange={e => { setSaveError(''); setEditValue(e.target.value); }} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setSaveError(''); setEditingField(null); setEditValue(''); } }} />
    )}{saveError && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setSaveError(''); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}</div>{isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}</div>);
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
      const parsed = parseLabel(sentence.replace(/[;.]+$/, '').trim());
      // Guarded comma-split (paren/Oxford/no-space/date aware); rows only for a genuine list (>=3, Rule #73)
      const rawValue = parsed.value;
      const commaItems = splitByComma(rawValue);
      const showCommaRows = commaItems.length >= 3;

      return (<div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''}>
        {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
        {showCommaRows ? (
          commaItems.map((item, ci) => {
            const commaKey = `${fn}-${idx}-s${sIdx}-c${ci}`;
            const isCommaEditing = editingField === commaKey;
            const isCommaEdited = editedSentences[commaKey];
            if (isCommaEditing) {
              return (<div key={ci} className="numbered-row"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => { setEditValue(e.target.value); setSaveError(''); }} autoFocus onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveCommaItem(record, fn, idx, sid, sIdx, ci); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(''); } }} />{saveError && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItem(record, fn, idx, sid, sIdx, ci); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(''); }}>Cancel</button></div></div></div>);
            }
            return (<React.Fragment key={ci}>
              <div className={`numbered-row ${isCommaEdited ? 'modified' : ''} editable-row`} onClick={() => { setEditingField(commaKey); setEditValue(item.trim()); setSaveError(''); }}>
                <div className="row-content"><span className="content-value">{highlightText(item.trim())}</span><span className="edit-indicator">✎</span></div>
                <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(item.trim(), commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
              </div>
              {isCommaEdited && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </React.Fragment>);
          })
        ) : isEditing ? (
          <div className="numbered-row"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => { setEditValue(e.target.value); setSaveError(''); }} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(''); } }} />{saveError && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(''); }}>Cancel</button></div></div></div>
        ) : (
          <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { setEditingField(sentenceKey); setEditValue(sentence.replace(/[;.]+$/, '').trim()); setSaveError(''); }}>
            <div className="row-content"><span className="content-value">{highlightText(parsed.value)}</span><span className="edit-indicator">✎</span></div>
            <button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button>
          </div>
        )}
        {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}</div>);
    })}</div></div>);
  };

  const renderEditableArrayItem = (record, fn, idx, sid, title) => {
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
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(item)); } }}>
                  {isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
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
    const fields = SECTION_FIELDS[sid] || []; const hasAnyVal = fields.some(f => { if (ARRAY_FIELDS.includes(f)) return getEffectiveArray(record, f, idx).length > 0; return hasVal(getFieldValue(record, f, idx)); }); if (!hasAnyVal) return null;
    const copyId = `${sid}-${idx}`;
    return (<div key={sid} className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopy(record, idx, sid, f => getFieldValue(record, f, idx)), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>{renderApproveButton(record, sid, idx)}</div></div>{fields.map(f => { if (ARRAY_FIELDS.includes(f)) return renderEditableArrayItem(record, f, idx, sid, title); if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title); return renderEditableField(record, f, idx, sid, title); })}</div></div>);
  };

  if (!records || records.length === 0) return (<div className="colorectal-surgery-consultations" ref={containerRef}><div className="document-header"><h2 className="document-title">Colorectal Surgery Consultations</h2></div><div className="empty-state">No colorectal surgery consultation records available</div></div>);

  return (
    <div className="colorectal-surgery-consultations" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Colorectal Surgery Consultations</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ColorectalSurgeryConsultationsDocumentPDFTemplate document={pdfData} />} fileName="Colorectal_Surgery_Consultations.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container"><input type="text" className="search-input" placeholder="Search colorectal surgery consultations..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />{searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}</div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header"><div className="record-meta-row">{record.consultationDate && <span className="record-date">{highlightText(formatDate(record.consultationDate))}</span>}</div><h3 className="record-name">{highlightText(`Colorectal Surgery Consultation ${idx + 1}`)}</h3></div>
            {renderMixedSection(record, idx, 'consultation-info')}
            {renderMixedSection(record, idx, 'diagnosis')}
            {renderMixedSection(record, idx, 'diagnostic-findings')}
            {renderMixedSection(record, idx, 'surgical-plan')}
            {renderMixedSection(record, idx, 'patient-factors')}
            {renderMixedSection(record, idx, 'counseling-review')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ColorectalSurgeryConsultationsDocument;
