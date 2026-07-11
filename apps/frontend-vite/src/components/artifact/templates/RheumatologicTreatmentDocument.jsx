/**
 * RheumatologicTreatmentDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: rheumatologic_treatment
 *
 * 12 Sections:
 *   1. treatment-info: date, type, provider, facility, status
 *   2. dmards: dmards[] {medication, dose, frequency, startDate, response, sideEffects}
 *   3. biologics: biologics[] {medication, mechanism, dose, frequency, route, response}
 *   4. corticosteroids: corticosteroids.current, corticosteroids.cumulative, corticosteroids.complications
 *   5. nsaids: nsaids[]
 *   6. adjunct-therapies: adjunctTherapies[]
 *   7. findings: findings
 *   8. assessment: assessment
 *   9. plan: plan
 *  10. recommendations: recommendations[]
 *  11. results: results (object)
 *  12. notes: notes
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import RheumatologicTreatmentDocumentPDFTemplate from '../pdf-templates/RheumatologicTreatmentDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './RheumatologicTreatmentDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the localEdits key minus its "-idx" suffix) */
const DRAFT_KEY = 'rheumatologic_treatmentPendingEdits';
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
  'treatment-info': 'Treatment Information',
  'dmards': 'DMARDs (Disease Modifying Antirheumatic Drugs)',
  'biologics': 'Biologics',
  'corticosteroids': 'Corticosteroids',
  'nsaids': 'NSAIDs (Non-Steroidal Anti-Inflammatory Drugs)',
  'adjunct-therapies': 'Adjunct Therapies',
  'findings': 'Findings',
  'assessment': 'Assessment',
  'plan': 'Plan',
  'recommendations': 'Recommendations',
  'results': 'Results',
  'notes': 'Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  'corticosteroids.current': 'Current',
  'corticosteroids.cumulative': 'Cumulative',
  'corticosteroids.complications': 'Complications',
};

const SECTION_FIELDS = {
  'treatment-info': ['date', 'type', 'provider', 'facility', 'status'],
  'dmards': ['dmards'],
  'biologics': ['biologics'],
  'corticosteroids': ['corticosteroids.current', 'corticosteroids.cumulative', 'corticosteroids.complications'],
  'nsaids': ['nsaids'],
  'adjunct-therapies': ['adjunctTherapies'],
  'findings': ['findings'],
  'assessment': ['assessment'],
  'plan': ['plan'],
  'recommendations': ['recommendations'],
  'results': ['results'],
  'notes': ['notes'],
};

const DATE_FIELDS = ['date'];
const STRING_FIELDS = ['type', 'provider', 'facility', 'status', 'findings', 'assessment', 'plan', 'notes', 'corticosteroids.current', 'corticosteroids.cumulative'];

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

/* Flatten results object */
const flattenResults = (obj, prefix = '') => {
  if (!obj || typeof obj !== 'object') return [];
  if (Array.isArray(obj)) {
    return obj.filter(Boolean).map((item, i) => ({
      label: prefix ? `${prefix} ${i + 1}` : `Item ${i + 1}`,
      value: typeof item === 'object' ? JSON.stringify(item) : String(item)
    }));
  }
  const flattened = [];
  Object.entries(obj).forEach(([key, value]) => {
    const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
    const label = prefix ? `${prefix} - ${formattedKey}` : formattedKey;
    if (value === null || value === undefined) return;
    if (typeof value === 'object' && !Array.isArray(value)) {
      flattened.push(...flattenResults(value, label));
    } else if (Array.isArray(value)) {
      value.filter(Boolean).forEach((item, i) => {
        if (typeof item === 'object') {
          flattened.push(...flattenResults(item, `${label} ${i + 1}`));
        } else {
          flattened.push({ label: `${label} ${i + 1}`, value: String(item) });
        }
      });
    } else {
      flattened.push({ label, value: String(value) });
    }
  });
  return flattened;
};

/* ═══════ COMPONENT ═══════ */
const RheumatologicTreatmentDocument = ({ document: docProp }) => {
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
  // localEdits keys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.rheumatologic_treatment) return Array.isArray(r.rheumatologic_treatment) ? r.rheumatologic_treatment : [r.rheumatologic_treatment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.rheumatologic_treatment) return Array.isArray(dd.rheumatologic_treatment) ? dd.rheumatologic_treatment : [dd.rheumatologic_treatment]; return [dd]; }
      if (r?.records) return Array.isArray(r.records) ? r.records : [r.records];
      if (r?._records) return Array.isArray(r._records) ? r._records : [r._records];
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const recId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = recId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // Mark the field/sentence edited so the row shows the "edited" badge + the section's Pending Approve button.
        if (Array.isArray(value)) {
          value.forEach((_, itemIdx) => { nFields[`${fieldPart}.${itemIdx}-${idx}`] = 'edited'; });
        } else if (typeof value === 'string' && value.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).length > 1) {
          nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
        } else {
          nFields[editKey] = 'edited';
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
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

  /* Get a field value (supports dot-path for corticosteroids.current etc.) */
  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
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
        if (Array.isArray(val)) { if (val.some(item => String(typeof item === 'object' ? JSON.stringify(item) : item).toLowerCase().includes(phrase))) return true; }
        else if (typeof val === 'object') { if (JSON.stringify(val).toLowerCase().includes(phrase)) return true; }
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
      const rt = `Rheumatologic Treatment ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && (Array.isArray(val) ? val.some(item => String(typeof item === 'object' ? JSON.stringify(item) : item).toLowerCase().includes(phrase)) : typeof val === 'object' ? JSON.stringify(val).toLowerCase().includes(phrase) : fmtVal(val).toLowerCase().includes(phrase))) return true;
        }
      }
      // Check dmards/biologics/nsaids/adjunctTherapies/recommendations nested values
      if (record.dmards) { const s = JSON.stringify(record.dmards).toLowerCase(); if (s.includes(phrase)) return true; }
      if (record.biologics) { const s = JSON.stringify(record.biologics).toLowerCase(); if (s.includes(phrase)) return true; }
      if (record.nsaids) { const s = record.nsaids.join(' ').toLowerCase(); if (s.includes(phrase)) return true; }
      if (record.adjunctTherapies) { const s = record.adjunctTherapies.join(' ').toLowerCase(); if (s.includes(phrase)) return true; }
      if (record.recommendations) { const s = JSON.stringify(record.recommendations).toLowerCase(); if (s.includes(phrase)) return true; }
      if (record.results) { const s = JSON.stringify(record.results).toLowerCase(); if (s.includes(phrase)) return true; }
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
          const fieldName = m[1];
          if (fieldName.includes('.')) {
            const parts = fieldName.split('.');
            if (parts.length === 2) {
              // object subfield, e.g. corticosteroids.current / corticosteroids.complications
              merged[parts[0]] = { ...(merged[parts[0]] || {}), [parts[1]]: localEdits[key] };
            } else if (parts.length === 3 && /^\d+$/.test(parts[1])) {
              // array-of-objects subfield, e.g. dmards.0.dose / biologics.1.response
              const [arrField, arrIdxStr, subField] = parts;
              const arrIdx = parseInt(arrIdxStr, 10);
              const arr = Array.isArray(merged[arrField]) ? merged[arrField].map(it => ({ ...it })) : [];
              if (arr[arrIdx]) { arr[arrIdx] = { ...arr[arrIdx], [subField]: localEdits[key] }; merged[arrField] = arr; }
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
  /* stageDraft: stage an edit LOCALLY only (NO DB write). Writes the pending-drafts localStorage store
     (survives refresh) and clears the section's approved flag so re-edits return to "Pending Approve".
     localKey = the localEdits key (`${fieldPart}-${idx}`); fieldPart = localKey minus the "-idx" suffix.
     Approve (handleApproveSection) is the ONLY path that writes to MongoDB. */
  const stageDraft = useCallback((record, idx, sid, localKey, value) => {
    const id = safeId(record); if (!id) return;
    const fieldPart = localKey.slice(0, -(`-${idx}`).length);
    setLocalEdits(prev => ({ ...prev, [localKey]: value }));
    setPendingEdits(prev => ({ ...prev, [localKey]: true }));
    if (sid) {
      setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    }
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = value;
    writeDrafts(store);
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    stageDraft(record, idx, sid, `${fn}-${idx}`, saveVal);
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setSaveError(null);
      stageDraft(record, idx, sid, `${fn}-${idx}`, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setSaveError(null);
    stageDraft(record, idx, sid, `${fn}-${idx}`, fullText);
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

  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    const suffix = `-${idx}`;
    // Collect this record's staged drafts that belong to THIS section's fields.
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fieldPart = k.slice(0, -suffix.length); // "field", "a.b", "dmards.0.dose", "recommendations", ...
      return fields.some(f => fieldPart === f || fieldPart.startsWith(`${f}.`));
    });
    try {
      // Commit each staged edit to MongoDB. arrayIndex ONLY when the trailing dot-segment is purely numeric.
      for (const key of toCommit) {
        const fieldPart = key.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { field: fieldPart, value: localEdits[key] };
        if (tail !== '' && /^\d+$/.test(tail)) { payload.field = fieldPart.slice(0, lastDot); payload.arrayIndex = parseInt(tail, 10); }
        const resp = await secureApiClient.put(`/api/edit/rheumatologic_treatment/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/rheumatologic_treatment/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF.
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts for the committed fieldParts from localStorage.
      const store = readDrafts();
      if (store[id]) { toCommit.forEach(k => { delete store[id][k.slice(0, -suffix.length)]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }
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
    if (sid === 'treatment-info') {
      const fields = SECTION_FIELDS[sid];
      fields.forEach(f => {
        const val = getFieldValue(record, f, idx);
        if (!hasVal(val)) return;
        const label = FIELD_LABELS[f] || f;
        if (DATE_FIELDS.includes(f)) { text += `${label}: ${formatDate(val)}\n`; }
        else { text += `${label}: ${fmtVal(val)}\n`; }
      });
      text += '\n';
    } else if (sid === 'dmards') {
      const dmards = getFieldValue(record, 'dmards', idx) || [];
      dmards.forEach((d, i) => {
        text += `DMARD ${i + 1}: ${d?.medication || 'Unknown'}\n`;
        if (d?.dose) text += `  Dose: ${d.dose}\n`;
        if (d?.frequency) text += `  Frequency: ${d.frequency}\n`;
        if (d?.startDate) text += `  Start Date: ${formatDate(d.startDate)}\n`;
        if (d?.response) text += `  Response: ${d.response}\n`;
        if (d?.sideEffects?.length) text += `  Side Effects: ${d.sideEffects.join(', ')}\n`;
        text += '\n';
      });
    } else if (sid === 'biologics') {
      const biologics = getFieldValue(record, 'biologics', idx) || [];
      biologics.forEach((b, i) => {
        text += `Biologic ${i + 1}: ${b?.medication || 'Unknown'}\n`;
        if (b?.mechanism) text += `  Mechanism: ${b.mechanism}\n`;
        if (b?.dose) text += `  Dose: ${b.dose}\n`;
        if (b?.frequency) text += `  Frequency: ${b.frequency}\n`;
        if (b?.route) text += `  Route: ${b.route}\n`;
        if (b?.response) text += `  Response: ${b.response}\n`;
        text += '\n';
      });
    } else if (sid === 'corticosteroids') {
      const fields = SECTION_FIELDS[sid];
      fields.forEach(f => {
        const val = getFieldValue(record, f, idx);
        if (!hasVal(val)) return;
        const label = FIELD_LABELS[f] || f;
        if (Array.isArray(val)) { text += `${label}: ${val.join(', ')}\n`; }
        else { text += `${label}: ${fmtVal(val)}\n`; }
      });
      text += '\n';
    } else if (sid === 'nsaids') {
      const nsaids = getFieldValue(record, 'nsaids', idx) || [];
      nsaids.forEach((n, i) => { text += `${i + 1}. ${n}\n`; });
      text += '\n';
    } else if (sid === 'adjunct-therapies') {
      const therapies = getFieldValue(record, 'adjunctTherapies', idx) || [];
      therapies.forEach((t, i) => { text += `${i + 1}. ${t}\n`; });
      text += '\n';
    } else if (sid === 'recommendations') {
      const recs = getFieldValue(record, 'recommendations', idx) || [];
      recs.forEach((rec, i) => {
        const recText = typeof rec === 'string' ? rec : (rec?.recommendation || '');
        const recDate = typeof rec === 'object' && rec?.date ? ` (${formatDate(rec.date)})` : '';
        text += `${i + 1}. ${recText}${recDate}\n`;
      });
      text += '\n';
    } else if (sid === 'results') {
      const results = getFieldValue(record, 'results', idx);
      if (results) {
        const flat = flattenResults(results);
        flat.forEach((item, i) => { text += `${i + 1}. ${item.label}: ${item.value}\n`; });
      }
      text += '\n';
    } else {
      // String fields: findings, assessment, plan, notes
      const fields = SECTION_FIELDS[sid];
      fields.forEach(f => {
        const val = getFieldValue(record, f, idx);
        if (!hasVal(val)) return;
        const strVal = fmtVal(val);
        const sentences = splitBySentence(strVal);
        if (sentences.length > 1) {
          formatSentenceFieldLines(strVal).forEach(l => { text += `${l}\n`; });
        } else {
          text += `${strVal}\n`;
        }
        text += '\n';
      });
    }
    return text;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== RHEUMATOLOGIC TREATMENT ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Rheumatologic Treatment ${idx + 1}\n${'='.repeat(40)}\n\n`;
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

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setSaveError(null); stageDraft(record, idx, sid, `${fn}-${idx}`, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const id3 = safeId(record); if (!id3) return; const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setSaveError(null); stageDraft(record, idx, sid, `${fn}-${idx}`, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: ARRAY FIELD (per-item editing with dot-path keys) ═══════ */
  const renderArrayField = (record, fn, idx, sid, label) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return null;
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
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setSaveError(null); const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = editValue; stageDraft(record, idx, sid, `${fn}-${idx}`, currentArr); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: DMARD/BIOLOGIC NESTED OBJECT ═══════ */
  const renderNestedMedField = (record, idx, sid, parentField, itemIdx, fieldName, label, item) => {
    const editKey = `${parentField}.${itemIdx}.${fieldName}-${idx}`;
    // Prefer an in-session edit so the displayed value stays in sync after save
    const val = localEdits[editKey] !== undefined ? localEdits[editKey] : item?.[fieldName];
    if (!hasVal(val)) return null;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    const displayVal = fieldName === 'startDate' ? formatDate(val) : (Array.isArray(val) ? val.join(', ') : fmtVal(val));

    if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
      const phrase = searchTerm.toLowerCase().trim();
      if (!label.toLowerCase().includes(phrase) && !displayVal.toLowerCase().includes(phrase)) return null;
    }

    return (
      <div key={fieldName}>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(fieldName === 'startDate' ? toInputDate(val) : (Array.isArray(val) ? val.join(', ') : fmtVal(val))); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {fieldName === 'startDate' ? (
                <input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (fieldName === 'startDate') { if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, `${parentField}.${itemIdx}.${fieldName}`, idx, sid, null, editValue + 'T00:00:00.000Z', editKey); } else if (fieldName === 'sideEffects') { const arrVal = editValue.split(',').map(s => s.trim()).filter(Boolean); handleSaveField(record, `${parentField}.${itemIdx}.${fieldName}`, idx, sid, null, arrVal, editKey); } else { handleSaveField(record, `${parentField}.${itemIdx}.${fieldName}`, idx, sid, null, editValue, editKey); } }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content">
                <span className="content-subtitle">{highlightText(label)}</span>
                <span className="content-value">{highlightText(displayVal)}</span>
                <span className="edit-indicator">&#9998;</span>
              </div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: DMARDS SECTION ═══════ */
  const renderDmardsSection = (record, idx) => {
    const sid = 'dmards';
    const dmards = getFieldValue(record, 'dmards', idx);
    if (!Array.isArray(dmards) || dmards.length === 0) return null;
    if (!shouldShowSection(record, sid)) return null;

    const phrase = searchTerm.toLowerCase().trim();
    const filteredDmards = dmards.filter((d, dIdx) => {
      if (!searchTerm.trim() || record._showAllSections || sectionTitleMatches(sid)) return true;
      const cardText = `DMARD ${dIdx + 1} ${d?.medication || ''} ${d?.dose || ''} ${d?.frequency || ''} ${d?.response || ''} ${formatDate(d?.startDate)} ${(d?.sideEffects || []).join(' ')}`.toLowerCase();
      return cardText.includes(phrase);
    });
    if (filteredDmards.length === 0) return null;

    const copyId = `dmards-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {filteredDmards.map((d, dIdx) => (
            <div key={dIdx} className="rec-mini-card">
              <div className="nested-subtitle">{highlightText(`DMARD ${dIdx + 1}: ${d?.medication || 'Unknown'}`)}</div>
              {renderNestedMedField(record, idx, sid, 'dmards', dIdx, 'medication', 'Medication', d)}
              {renderNestedMedField(record, idx, sid, 'dmards', dIdx, 'dose', 'Dose', d)}
              {renderNestedMedField(record, idx, sid, 'dmards', dIdx, 'frequency', 'Frequency', d)}
              {renderNestedMedField(record, idx, sid, 'dmards', dIdx, 'startDate', 'Start Date', d)}
              {renderNestedMedField(record, idx, sid, 'dmards', dIdx, 'response', 'Response', d)}
              {renderNestedMedField(record, idx, sid, 'dmards', dIdx, 'sideEffects', 'Side Effects', d)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: BIOLOGICS SECTION ═══════ */
  const renderBiologicsSection = (record, idx) => {
    const sid = 'biologics';
    const biologics = getFieldValue(record, 'biologics', idx);
    if (!Array.isArray(biologics) || biologics.length === 0) return null;
    if (!shouldShowSection(record, sid)) return null;

    const phrase = searchTerm.toLowerCase().trim();
    const filteredBiologics = biologics.filter((b, bIdx) => {
      if (!searchTerm.trim() || record._showAllSections || sectionTitleMatches(sid)) return true;
      const cardText = `Biologic ${bIdx + 1} ${b?.medication || ''} ${b?.mechanism || ''} ${b?.dose || ''} ${b?.frequency || ''} ${b?.route || ''} ${b?.response || ''}`.toLowerCase();
      return cardText.includes(phrase);
    });
    if (filteredBiologics.length === 0) return null;

    const copyId = `biologics-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {filteredBiologics.map((b, bIdx) => (
            <div key={bIdx} className="rec-mini-card">
              <div className="nested-subtitle">{highlightText(`Biologic ${bIdx + 1}: ${b?.medication || 'Unknown'}`)}</div>
              {renderNestedMedField(record, idx, sid, 'biologics', bIdx, 'medication', 'Medication', b)}
              {renderNestedMedField(record, idx, sid, 'biologics', bIdx, 'mechanism', 'Mechanism', b)}
              {renderNestedMedField(record, idx, sid, 'biologics', bIdx, 'dose', 'Dose', b)}
              {renderNestedMedField(record, idx, sid, 'biologics', bIdx, 'frequency', 'Frequency', b)}
              {renderNestedMedField(record, idx, sid, 'biologics', bIdx, 'route', 'Route', b)}
              {renderNestedMedField(record, idx, sid, 'biologics', bIdx, 'response', 'Response', b)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: CORTICOSTEROIDS SECTION ═══════ */
  const renderCorticosteroidsSection = (record, idx) => {
    const sid = 'corticosteroids';
    const cort = record.corticosteroids;
    if (!cort || (!cort.current && !cort.cumulative && (!cort.complications || cort.complications.length === 0))) return null;
    if (!shouldShowSection(record, sid)) return null;

    const copyId = `corticosteroids-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {hasVal(cort.current) && (() => {
            const fn = 'corticosteroids.current';
            return renderStringField(record, fn, idx, sid);
          })()}
          {hasVal(cort.cumulative) && (() => {
            const fn = 'corticosteroids.cumulative';
            return renderStringField(record, fn, idx, sid);
          })()}
          {cort.complications && cort.complications.length > 0 && (
            renderArrayField(record, 'corticosteroids.complications', idx, sid, 'Complications')
          )}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: NSAIDS SECTION ═══════ */
  const renderNsaidsSection = (record, idx) => {
    const sid = 'nsaids';
    const nsaids = getFieldValue(record, 'nsaids', idx);
    if (!Array.isArray(nsaids) || nsaids.length === 0) return null;
    if (!shouldShowSection(record, sid)) return null;

    const copyId = `nsaids-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {renderArrayField(record, 'nsaids', idx, sid, 'NSAIDs')}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: ADJUNCT THERAPIES SECTION ═══════ */
  const renderAdjunctTherapiesSection = (record, idx) => {
    const sid = 'adjunct-therapies';
    const therapies = getFieldValue(record, 'adjunctTherapies', idx);
    if (!Array.isArray(therapies) || therapies.length === 0) return null;
    if (!shouldShowSection(record, sid)) return null;

    const copyId = `adjunct-therapies-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {renderArrayField(record, 'adjunctTherapies', idx, sid, 'Adjunct Therapies')}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: RECOMMENDATIONS SECTION ═══════ */
  const renderRecommendationsSection = (record, idx) => {
    const sid = 'recommendations';
    const recs = getFieldValue(record, 'recommendations', idx);
    if (!Array.isArray(recs) || recs.length === 0) return null;
    if (!shouldShowSection(record, sid)) return null;

    const phrase = searchTerm.toLowerCase().trim();
    const filteredRecs = recs.filter((rec) => {
      if (!searchTerm.trim() || record._showAllSections || sectionTitleMatches(sid)) return true;
      const recText = typeof rec === 'string' ? rec : (rec?.recommendation || '');
      const recDate = typeof rec === 'object' && rec?.date ? formatDate(rec.date) : '';
      return `${recText} ${recDate}`.toLowerCase().includes(phrase);
    });
    if (filteredRecs.length === 0) return null;

    const copyId = `recommendations-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {filteredRecs.map((rec, rIdx) => {
            const recText = typeof rec === 'string' ? rec : (rec?.recommendation || '');
            const recDate = typeof rec === 'object' && rec?.date ? formatDate(rec.date) : '';
            const editKey = `recommendations.${rIdx}-${idx}`;
            const isEditing = editingField === editKey;
            const isModified = editedFields[editKey];

            return (
              <div key={rIdx}>
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(recText); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const saveVal = typeof rec === 'string' ? editValue : { ...rec, recommendation: editValue }; setSaveError(null); const currentArr = [...(Array.isArray(getFieldValue(record, 'recommendations', idx)) ? getFieldValue(record, 'recommendations', idx) : [])]; currentArr[rIdx] = saveVal; stageDraft(record, idx, sid, `recommendations-${idx}`, currentArr); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content">
                        <span className="content-value">{highlightText(recText)}</span>
                        {recDate && <span className="rec-date">{highlightText(recDate)}</span>}
                        <span className="edit-indicator">&#9998;</span>
                      </div>
                      <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${recText}${recDate ? ` (${recDate})` : ''}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: RESULTS SECTION ═══════ */
  const renderResultsSection = (record, idx) => {
    const sid = 'results';
    const results = getFieldValue(record, 'results', idx);
    if (!results || typeof results !== 'object' || Object.keys(results).length === 0) return null;
    if (!shouldShowSection(record, sid)) return null;

    const flat = flattenResults(results);
    if (flat.length === 0) return null;

    const phrase = searchTerm.toLowerCase().trim();
    const filteredFlat = flat.filter(item => {
      if (!searchTerm.trim() || record._showAllSections || sectionTitleMatches(sid)) return true;
      return `${item.label} ${item.value}`.toLowerCase().includes(phrase);
    });
    if (filteredFlat.length === 0) return null;

    const copyId = `results-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {filteredFlat.map((item, rIdx) => (
            <div key={rIdx} className="numbered-row">
              <div className="row-content">
                <span className="content-subtitle">{highlightText(item.label)}</span>
                <span className="content-value">{highlightText(item.value)}</span>
              </div>
              <button className={`copy-btn ${copiedItems[`result-${idx}-${rIdx}`] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${item.label}: ${item.value}`, `result-${idx}-${rIdx}`); }}>{copiedItems[`result-${idx}-${rIdx}`] ? 'Copied!' : 'Copy'}</button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC STRING SECTION ═══════ */
  const renderGenericSection = (record, idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    if (!shouldShowSection(record, sid)) return null;
    const hasAnyVal = fields.some(f => hasVal(getFieldValue(record, f, idx)));
    if (!hasAnyVal) return null;

    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="rheumatologic-treatment-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Rheumatologic Treatment</h2></div>
        <div className="empty-state">No rheumatologic treatment records available</div>
      </div>
    );
  }

  return (
    <div className="rheumatologic-treatment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Rheumatologic Treatment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<RheumatologicTreatmentDocumentPDFTemplate document={pdfData} />} fileName={`rheumatologic-treatment-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search rheumatologic treatment..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">
                {record.status && <span className="record-status">{record.status}</span>}
                {record.date && <span className="record-date">{formatDate(record.date)}</span>}
              </div>
              <h3 className="record-name">{highlightText(`Rheumatologic Treatment ${idx + 1}`)}</h3>
            </div>
            {renderGenericSection(record, idx, 'treatment-info')}
            {renderDmardsSection(record, idx)}
            {renderBiologicsSection(record, idx)}
            {renderCorticosteroidsSection(record, idx)}
            {renderNsaidsSection(record, idx)}
            {renderAdjunctTherapiesSection(record, idx)}
            {renderGenericSection(record, idx, 'findings')}
            {renderGenericSection(record, idx, 'assessment')}
            {renderGenericSection(record, idx, 'plan')}
            {renderRecommendationsSection(record, idx)}
            {renderResultsSection(record, idx)}
            {renderGenericSection(record, idx, 'notes')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RheumatologicTreatmentDocument;
