/**
 * ObstetricHistoryDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: obstetric_history
 *
 * 8 Sections:
 *   1. record-info: date (date picker), provider (string), facility (string), status (string)
 *   2. obstetric-summary: gravida (string), para (string), gpNotation (string), livingChildren (string)
 *   3. previous-pregnancies: previousPregnancies (array of objects: year, outcome, gestationalAge, deliveryMode, complications[])
 *   4. pregnancy-losses: pregnancyLosses (array of objects: year, type, gestationalAge)
 *   5. findings: findings (string)
 *   6. assessment: assessment (string)
 *   7. plan: plan (string)
 *   8. tail: recommendations (array), notes (string)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ObstetricHistoryDocumentPDFTemplate from '../pdf-templates/ObstetricHistoryDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './ObstetricHistoryDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the top-level field name) */
const DRAFT_KEY = 'obstetricHistoryPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ======= CONSTANTS ======= */
const SECTION_TITLES = {
  'record-info': 'Record Information',
  'obstetric-summary': 'Obstetric Summary',
  'previous-pregnancies': 'Previous Pregnancies',
  'pregnancy-losses': 'Pregnancy Losses',
  'findings': 'Findings',
  'assessment': 'Assessment',
  'plan': 'Plan',
  'results': 'Results',
  'tail': 'Additional Information',
};

/* humanize a dynamic object key into a readable label (e.g. preeclampsiaLabs -> Preeclampsia Labs) */
const humanizeKey = (key) => {
  if (!key) return '';
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, c => c.toUpperCase());
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  gravida: 'Gravida',
  para: 'Para',
  gpNotation: 'G/P Notation',
  livingChildren: 'Living Children',
  previousPregnancies: 'Previous Pregnancies',
  pregnancyLosses: 'Pregnancy Losses',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  results: 'Results',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'record-info': ['date', 'provider', 'facility', 'status'],
  'obstetric-summary': ['gravida', 'para', 'gpNotation', 'livingChildren'],
  'previous-pregnancies': ['previousPregnancies'],
  'pregnancy-losses': ['pregnancyLosses'],
  'findings': ['findings'],
  'assessment': ['assessment'],
  'plan': ['plan'],
  'results': ['results'],
  'tail': ['recommendations', 'notes'],
};

/* gravida/para/livingChildren are counts (stored as strings) → num-stepper widget, hide-zero does NOT apply */
const NUMBER_FIELDS = ['gravida', 'para', 'livingChildren'];
const BOOLEAN_FIELDS = [];
const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['previousPregnancies', 'pregnancyLosses', 'recommendations'];
const OBJECT_FIELDS = ['results'];

const STRING_FIELDS = [
  'provider', 'facility', 'status',
  'gpNotation',
  'findings', 'assessment', 'plan', 'notes',
];

/* parseLabel: detect "Label: value" patterns (skip subordinate-clause openers) */
const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware comma split (thousands-guarded: comma must be followed by whitespace) */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '')) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* ======= COMPONENT ======= */
const ObstetricHistoryDocument = ({ document: docProp, data }) => {
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
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const containerRef = useRef(null);

  /* ======= DATA UNWRAP ======= */
  const records = useMemo(() => {
    const templateData = docProp || data;
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.obstetric_history) return Array.isArray(r.obstetric_history) ? r.obstetric_history : [r.obstetric_history];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.obstetric_history) return Array.isArray(dd.obstetric_history) ? dd.obstetric_history : [dd.obstetric_history]; return [dd]; }
      if (r?.records) return Array.isArray(r.records) ? r.records : [r.records];
      if (r?._records) return Array.isArray(r._records) ? r._records : [r._records];
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp, data]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const recId = idOf(record);
      const recDrafts = recId ? store[recId] : null;
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

  /* ======= UTILS ======= */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  /* deep search over a dynamic-key object (keys + leaf values, recursive) */
  const objectMatchesPhrase = useCallback((obj, phrase) => {
    if (!obj || typeof obj !== 'object') return false;
    for (const [k, v] of Object.entries(obj)) {
      if (String(k).toLowerCase().includes(phrase) || humanizeKey(k).toLowerCase().includes(phrase)) return true;
      if (v && typeof v === 'object') { if (objectMatchesPhrase(v, phrase)) return true; }
      else if (v !== null && v !== undefined && String(v).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
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
    if (localEdits[k] !== undefined) return localEdits[k];
    const val = record[fn];
    return Array.isArray(val) ? val : [];
  }, [localEdits]);

  const getEffectiveObject = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    const val = record[fn];
    return (val && typeof val === 'object' && !Array.isArray(val)) ? val : {};
  }, [localEdits]);

  /* immutably set a value at a dot-path within a cloned object */
  const setAtPath = useCallback((obj, path, value) => {
    const keys = path.split('.');
    const root = Array.isArray(obj) ? [...obj] : { ...(obj || {}) };
    let cur = root;
    for (let i = 0; i < keys.length - 1; i++) {
      const kk = keys[i];
      const next = cur[kk];
      cur[kk] = (next && typeof next === 'object' && !Array.isArray(next)) ? { ...next } : (Array.isArray(next) ? [...next] : {});
      cur = cur[kk];
    }
    cur[keys[keys.length - 1]] = value;
    return root;
  }, []);

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

  /* ======= SEARCH — 4-LEVEL ======= */
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
        if (Array.isArray(val)) {
          if (val.some(item => {
            if (typeof item === 'string') return item.toLowerCase().includes(phrase);
            if (typeof item === 'object' && item) return Object.values(item).some(v => v && String(v).toLowerCase().includes(phrase));
            return false;
          })) return true;
        } else if (typeof val === 'object') {
          if (objectMatchesPhrase(val, phrase)) return true;
        } else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, objectMatchesPhrase]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) {
      if (Array.isArray(val)) {
        return val.some(item => {
          if (typeof item === 'string') return item.toLowerCase().includes(phrase);
          if (typeof item === 'object' && item) return Object.values(item).some(v => v && String(v).toLowerCase().includes(phrase));
          return false;
        });
      }
      if (typeof val === 'object') return objectMatchesPhrase(val, phrase);
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, objectMatchesPhrase]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Obstetric History ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && Array.isArray(val)) {
            if (val.some(item => {
              if (typeof item === 'string') return item.toLowerCase().includes(phrase);
              if (typeof item === 'object' && item) return Object.values(item).some(v => v && String(v).toLowerCase().includes(phrase));
              return false;
            })) return true;
          } else if (val && typeof val === 'object') {
            if (objectMatchesPhrase(val, phrase)) return true;
          } else if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal, objectMatchesPhrase]);

  /* ======= PDF DATA ======= */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const field = m[1];
          /* OBJECT_FIELDS use the whole-object localEdit value (keyed `results-idx`) */
          merged[field] = localEdits[key];
        }
      });
      ARRAY_FIELDS.forEach(f => {
        const k = `${f}-${idx}`;
        if (localEdits[k] !== undefined && !pendingEdits[k]) merged[f] = localEdits[k];
        else merged[f] = Array.isArray(record[f]) ? record[f] : [];
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ======= EDIT HANDLERS =======
     Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
     NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
     The localEdits key is always `${topField}-${idx}` (whole field value), so the draft fieldPart = topField. */
  const stageDraft = useCallback((record, topField, idx, wholeValue) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${topField}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: wholeValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][topField] = wholeValue;
    writeDrafts(store);
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    stageDraft(record, fn, idx, saveVal);
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
      stageDraft(record, fn, idx, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setSaveError(null);
    stageDraft(record, fn, idx, fullText);
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

  /* ======= APPROVE ======= */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true); setSaveError(null);
    try {
      // localEdits keys are `${topField}-${idx}` holding the whole field value; commit each pending one.
      const toCommit = fields
        .map(f => `${f}-${idx}`)
        .filter(editKey => pendingEdits[editKey] && localEdits[editKey] !== undefined);
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -(`-${idx}`).length); // top-level field name (no trailing index)
        const lastDot = fieldPart.lastIndexOf('.');
        const payload = { field: fieldPart, value: localEdits[editKey] };
        // arrayIndex ONLY when the segment after the LAST dot is purely numeric
        if (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1))) {
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        }
        const resp = await secureApiClient.put(`/api/edit/obstetric_history/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/obstetric_history/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) { fields.forEach(f => { delete store[id][f]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); setSaveError('Approve failed. Please try again.'); }
    finally { setSaving(false); }
  }, [safeId, pendingEdits, localEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection]);

  /* ======= COPY ======= */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* ======= FORMAT HELPERS FOR COPY ======= */
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

  const buildPregText = useCallback((record, idx) => {
    const items = getEffectiveArray(record, 'previousPregnancies', idx);
    if (items.length === 0) return '';
    let text = 'Previous Pregnancies\n' + '='.repeat(40) + '\n\n';
    items.forEach((preg, i) => {
      text += `Pregnancy ${i + 1}${preg.year ? ` (${preg.year})` : ''}\n`;
      if (preg.year) text += `  Year: ${preg.year}\n`;
      if (preg.outcome) text += `  Outcome: ${preg.outcome}\n`;
      if (preg.gestationalAge) text += `  Gestational Age: ${preg.gestationalAge}\n`;
      if (preg.deliveryMode) text += `  Delivery Mode: ${preg.deliveryMode}\n`;
      if (preg.complications?.length > 0) text += `  Complications: ${preg.complications.join(', ')}\n`;
      text += '\n';
    });
    return text;
  }, [getEffectiveArray]);

  const buildLossesText = useCallback((record, idx) => {
    const items = getEffectiveArray(record, 'pregnancyLosses', idx);
    if (items.length === 0) return '';
    let text = 'Pregnancy Losses\n' + '='.repeat(40) + '\n\n';
    items.forEach((loss, i) => {
      if (typeof loss === 'string') { text += `${i + 1}. ${loss}\n`; }
      else { text += `${i + 1}. ${loss.type || ''} - ${loss.year || ''} (${loss.gestationalAge || ''})\n`; }
    });
    return text + '\n';
  }, [getEffectiveArray]);

  const buildResultsText = useCallback((record, idx) => {
    const obj = getEffectiveObject(record, 'results', idx);
    if (!obj || Object.keys(obj).length === 0) return '';
    const lines = [];
    const walk = (o, depth) => {
      Object.entries(o).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        const pad = '  '.repeat(depth);
        const label = humanizeKey(key);
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          if (Object.keys(value).length === 0) return;
          lines.push(`${pad}${label}:`);
          walk(value, depth + 1);
        } else if (Array.isArray(value)) {
          if (value.length === 0) return;
          lines.push(`${pad}${label}: ${value.map(v => (v && typeof v === 'object') ? JSON.stringify(v) : String(v)).join(', ')}`);
        } else {
          lines.push(`${pad}${label}: ${fmtVal(value)}`);
        }
      });
    };
    walk(obj, 0);
    if (lines.length === 0) return '';
    return `Results\n${'='.repeat(40)}\n\n${lines.join('\n')}\n\n`;
  }, [getEffectiveObject, fmtVal]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];

    if (sid === 'previous-pregnancies') return buildPregText(record, idx);
    if (sid === 'pregnancy-losses') return buildLossesText(record, idx);
    if (sid === 'results') return buildResultsText(record, idx);

    const fields = SECTION_FIELDS[sid] || [];
    let body = '';
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        body += `${label}\n${formatDate(val)}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val.filter(Boolean) : [];
        if (items.length > 0) {
          body += `${label}\n`;
          items.forEach((item, i) => {
            const itemText = typeof item === 'string' ? item : (item?.recommendation || String(item));
            body += `${i + 1}. ${itemText}\n`;
          });
          body += '\n';
        }
      } else {
        const strVal = fmtVal(val);
        const sentences = splitBySentence(strVal);
        if (sentences.length > 1) {
          body += `${label}\n`;
          formatSentenceFieldLines(strVal).forEach(l => { body += `${l}\n`; });
          body += '\n';
        } else {
          body += `${label}\n${strVal}\n\n`;
        }
      }
    });
    /* Skip the section entirely when it produced no content — otherwise an empty section's title
       (Findings / Assessment / Plan) leaks into Copy All and false-fails JSX/PDF field parity. */
    if (!body) return '';
    return `${title}\n${'='.repeat(40)}\n\n` + body;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, formatSentenceFieldLines, buildPregText, buildLossesText, buildResultsText, getEffectiveArray]);

  const copyAllText = useCallback(async () => {
    let text = '=== OBSTETRIC HISTORY ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Obstetric History ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ======= RENDER: DATE FIELD ======= */
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
              <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} />
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
        {isModified && <span className="modified-badge">edited — click Pending Approve to save</span>}
      </div>
    );
  };

  /* ======= RENDER: SIMPLE ARRAY FIELD (recommendations) ======= */
  const renderSimpleArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {items.map((item, itemIdx) => {
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemStr = typeof item === 'string' ? item : (item?.recommendation || String(item));

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
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; setSaveError(null); const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = editValue; stageDraft(record, fn, idx, currentArr); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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
              {isModified && <span className="modified-badge">edited — click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /* ======= RENDER: NUMBER FIELD — num-stepper (never native type=number) ======= */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) - 1)); }}>&minus;</button>
                <input type="text" inputMode="decimal" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); } }} />
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) + 1)); }}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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
        {isModified && <span className="modified-badge">edited — click Pending Approve to save</span>}
      </div>
    );
  };

  /* ======= RENDER: PREVIOUS PREGNANCIES (array of objects) ======= */
  const renderPreviousPregnancies = (record, idx, sid) => {
    const items = getEffectiveArray(record, 'previousPregnancies', idx);
    if (items.length === 0) return null;
    if (searchTerm.trim() && !fieldMatches(record, 'previousPregnancies', idx) && !sectionTitleMatches(sid)) return null;

    const pregSubFields = [
      { key: 'year', label: 'Year' },
      { key: 'outcome', label: 'Outcome' },
      { key: 'gestationalAge', label: 'Gestational Age' },
      { key: 'deliveryMode', label: 'Delivery Mode' },
    ];

    return items.map((preg, pIdx) => {
      const phrase = searchTerm.toLowerCase().trim();
      if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
        const pregText = Object.values(preg || {}).flat().filter(Boolean).join(' ').toLowerCase();
        if (!pregText.includes(phrase) && !'previous pregnancies'.includes(phrase) && !phrase.includes('previous pregnancies') && !`pregnancy ${pIdx + 1}`.includes(phrase)) return null;
      }

      return (
        <div key={pIdx} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(`Pregnancy ${pIdx + 1}${preg.year ? ` (${preg.year})` : ''}`)}</div>
          {pregSubFields.map(sf => {
            if (!preg[sf.key]) return null;
            const editKey = `previousPregnancies.${pIdx}.${sf.key}-${idx}`;
            const isEditing = editingField === editKey;
            const isModified = editedFields[editKey];

            return (
              <div key={sf.key}>
                <div className="nested-subtitle">{highlightText(sf.label)}</div>
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(preg[sf.key]); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; setSaveError(null); const currentArr = [...getEffectiveArray(record, 'previousPregnancies', idx)]; const updatedPreg = { ...currentArr[pIdx], [sf.key]: editValue }; currentArr[pIdx] = updatedPreg; stageDraft(record, 'previousPregnancies', idx, currentArr); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content">
                        <span className="content-value">{highlightText(preg[sf.key])}</span>
                        <span className="edit-indicator">&#9998;</span>
                      </div>
                      <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${sf.label}: ${preg[sf.key]}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {isModified && <span className="modified-badge">edited — click Pending Approve to save</span>}
              </div>
            );
          })}
          {/* Complications sub-array — rendered as a list (nested-subtitle above one editable row per item) */}
          {Array.isArray(preg.complications) && preg.complications.filter(Boolean).length > 0 && (
            <div>
              <div className="nested-subtitle">{highlightText('Complications')}</div>
              {preg.complications.filter(Boolean).map((comp, cIdx) => {
                const compEditKey = `previousPregnancies.${pIdx}.complications.${cIdx}-${idx}`;
                const compIsEditing = editingField === compEditKey;
                const compIsModified = editedFields[compEditKey];
                return (
                  <div key={cIdx}>
                    <div className={`numbered-row ${compIsModified ? 'modified' : ''} editable-row`} onClick={() => { if (!compIsEditing) { setEditingField(compEditKey); setEditValue(comp); setSaveError(null); } }}>
                      {compIsEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; setSaveError(null); const currentArr = [...getEffectiveArray(record, 'previousPregnancies', idx)]; const comps = Array.isArray(currentArr[pIdx].complications) ? [...currentArr[pIdx].complications] : []; comps[cIdx] = editValue; currentArr[pIdx] = { ...currentArr[pIdx], complications: comps }; stageDraft(record, 'previousPregnancies', idx, currentArr); setEditedFields(prev => ({ ...prev, [compEditKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(comp)}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[compEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(comp, compEditKey); }}>{copiedItems[compEditKey] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {compIsModified && <span className="modified-badge">edited — click Pending Approve to save</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    });
  };

  /* ======= RENDER: PREGNANCY LOSSES (array of objects) ======= */
  const renderPregnancyLosses = (record, idx, sid) => {
    const items = getEffectiveArray(record, 'pregnancyLosses', idx);
    if (items.length === 0) return null;
    if (searchTerm.trim() && !fieldMatches(record, 'pregnancyLosses', idx) && !sectionTitleMatches(sid)) return null;

    const lossSubFields = [
      { key: 'type', label: 'Type' },
      { key: 'year', label: 'Year' },
      { key: 'gestationalAge', label: 'Gestational Age' },
    ];

    return items.map((loss, lIdx) => {
      const phrase = searchTerm.toLowerCase().trim();
      if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
        const lossText = typeof loss === 'string' ? loss : Object.values(loss || {}).filter(Boolean).join(' ');
        if (!lossText.toLowerCase().includes(phrase) && !'pregnancy losses'.includes(phrase) && !phrase.includes('pregnancy losses')) return null;
      }

      if (typeof loss === 'string') {
        const editKey = `pregnancyLosses.${lIdx}-${idx}`;
        const isEditing = editingField === editKey;
        const isModified = editedFields[editKey];
        return (
          <div key={lIdx} className="rec-mini-card">
            <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(loss); setSaveError(null); } }}>
              {isEditing ? (
                <div className="edit-field-container">
                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  {saveError && <div className="save-error">{saveError}</div>}
                  <div className="edit-actions">
                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; setSaveError(null); const arr = [...getEffectiveArray(record, 'pregnancyLosses', idx)]; arr[lIdx] = editValue; stageDraft(record, 'pregnancyLosses', idx, arr); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                    <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="row-content"><span className="content-value">{highlightText(loss)}</span><span className="edit-indicator">&#9998;</span></div>
                  <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(loss, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                </>
              )}
            </div>
            {isModified && <span className="modified-badge">edited — click Pending Approve to save</span>}
          </div>
        );
      }

      return (
        <div key={lIdx} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(`Loss ${lIdx + 1}${loss.type ? ` - ${loss.type}` : ''}`)}</div>
          {lossSubFields.map(sf => {
            if (!loss[sf.key]) return null;
            const editKey = `pregnancyLosses.${lIdx}.${sf.key}-${idx}`;
            const isEditing = editingField === editKey;
            const isModified = editedFields[editKey];

            return (
              <div key={sf.key}>
                <div className="nested-subtitle">{highlightText(sf.label)}</div>
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(loss[sf.key]); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; setSaveError(null); const currentArr = [...getEffectiveArray(record, 'pregnancyLosses', idx)]; const updatedLoss = { ...currentArr[lIdx], [sf.key]: editValue }; currentArr[lIdx] = updatedLoss; stageDraft(record, 'pregnancyLosses', idx, currentArr); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content">
                        <span className="content-value">{highlightText(loss[sf.key])}</span>
                        <span className="edit-indicator">&#9998;</span>
                      </div>
                      <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${sf.label}: ${loss[sf.key]}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {isModified && <span className="modified-badge">edited — click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
      );
    });
  };

  /* ======= RENDER: STRING FIELD with splitBySentence ======= */
  const renderStringField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label !== title;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence: render with splitBySentence */
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setSaveError(null); stageDraft(record, fn, idx, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                            {ciBadge && <span className={`modified-badge ${ciBadge === 'added' ? 'added' : ''}`}>{ciBadge === 'added' ? 'added — click Pending Approve to save' : 'edited — click Pending Approve to save'}</span>}
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
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setSaveError(null); stageDraft(record, fn, idx, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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
                  {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added — click Pending Approve to save' : 'edited — click Pending Approve to save'}</span>}
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
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
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
        {isModified && <span className="modified-badge">edited — click Pending Approve to save</span>}
      </div>
    );
  };

  /* ======= RENDER: RESULTS (dynamic-key object, recursive) ======= */
  const renderResultsObject = (record, idx, sid, obj, pathPrefix) => {
    if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) return null;
    const phrase = searchTerm.toLowerCase().trim();
    const rows = Object.entries(obj).map(([key, value]) => {
      if (value === null || value === undefined || value === '') return null;
      const fullPath = pathPrefix ? `${pathPrefix}.${key}` : `results.${key}`;
      const label = humanizeKey(key);

      /* Nested object → recurse inside a sub-card */
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (Object.keys(value).length === 0) return null;
        const inner = renderResultsObject(record, idx, sid, value, fullPath);
        if (!inner) return null;
        return (
          <div key={fullPath} className="rec-mini-card">
            <div className="nested-subtitle">{highlightText(label)}</div>
            {inner}
          </div>
        );
      }

      /* Array leaf → join readable */
      const displayVal = Array.isArray(value) ? value.map(v => (v && typeof v === 'object') ? JSON.stringify(v) : String(v)).join(', ') : fmtVal(value);
      if (displayVal === '') return null;

      /* per-leaf search filter */
      if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
        if (!label.toLowerCase().includes(phrase) && !phrase.includes(label.toLowerCase()) && !displayVal.toLowerCase().includes(phrase)) return null;
      }

      const editKey = `${fullPath}-${idx}`;
      const isEditing = editingField === editKey;
      const isModified = editedFields[editKey];

      return (
        <div key={fullPath}>
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
            {isEditing ? (
              <div className="edit-field-container">
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const saveVal = Array.isArray(value) ? editValue.split(',').map(c => c.trim()).filter(Boolean) : editValue; setSaveError(null); const baseObj = getEffectiveObject(record, 'results', idx); const relPath = fullPath.replace(/^results\./, ''); const updatedResults = setAtPath(baseObj, relPath, saveVal); stageDraft(record, 'results', idx, updatedResults); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="row-content">
                  <span className="content-value">{highlightText(displayVal)}</span>
                  <span className="edit-indicator">&#9998;</span>
                </div>
                <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
              </>
            )}
          </div>
          {isModified && <span className="modified-badge">edited — click Pending Approve to save</span>}
        </div>
      );
    }).filter(Boolean);
    return rows.length > 0 ? rows : null;
  };

  const renderResults = (record, idx, sid) => {
    const obj = getEffectiveObject(record, 'results', idx);
    if (!obj || Object.keys(obj).length === 0) return null;
    if (searchTerm.trim() && !fieldMatches(record, 'results', idx) && !sectionTitleMatches(sid)) return null;
    const rendered = renderResultsObject(record, idx, sid, obj, 'results');
    if (!rendered) return null;
    return <div className="rec-mini-card">{rendered}</div>;
  };

  /* ======= RENDER: GENERIC SECTION ======= */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    /* For array-of-objects sections, check arrays directly */
    if (sid === 'previous-pregnancies') {
      const items = getEffectiveArray(record, 'previousPregnancies', idx);
      if (items.length === 0) return null;
    } else if (sid === 'pregnancy-losses') {
      const items = getEffectiveArray(record, 'pregnancyLosses', idx);
      if (items.length === 0) return null;
    } else if (sid === 'results') {
      const obj = getEffectiveObject(record, 'results', idx);
      if (!obj || Object.keys(obj).length === 0) return null;
    } else {
      const hasAnyVal = fields.some(f => {
        const val = getFieldValue(record, f, idx);
        return hasVal(val);
      });
      if (!hasAnyVal) return null;
    }

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
          {sid === 'previous-pregnancies' ? (
            renderPreviousPregnancies(record, idx, sid)
          ) : sid === 'pregnancy-losses' ? (
            renderPregnancyLosses(record, idx, sid)
          ) : sid === 'results' ? (
            renderResults(record, idx, sid)
          ) : (
            fields.map(f => {
              if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
              if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
              if (f === 'recommendations') return renderSimpleArrayField(record, f, idx, sid);
              if (f === 'previousPregnancies' || f === 'pregnancyLosses') return null;
              return renderStringField(record, f, idx, sid, title);
            })
          )}
        </div>
      </div>
    );
  };

  /* ======= MAIN RENDER ======= */
  if (!records || records.length === 0) {
    return (
      <div className="obstetric-history-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Obstetric History</h2></div>
        <div className="empty-state">No obstetric history records available</div>
      </div>
    );
  }

  return (
    <div className="obstetric-history-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Obstetric History</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ObstetricHistoryDocumentPDFTemplate document={pdfData} />} fileName="Obstetric_History.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search obstetric history..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              {hasVal(record.date) && (
                <div className="record-meta-row">
                  <span className="record-date">{formatDate(record.date)}</span>
                  {record.gpNotation && <span className="record-status">{record.gpNotation}</span>}
                </div>
              )}
              <h3 className="record-name">{highlightText(`Obstetric History ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'record-info')}
            {renderSection(record, idx, 'obstetric-summary')}
            {renderSection(record, idx, 'previous-pregnancies')}
            {renderSection(record, idx, 'pregnancy-losses')}
            {renderSection(record, idx, 'findings')}
            {renderSection(record, idx, 'assessment')}
            {renderSection(record, idx, 'plan')}
            {renderSection(record, idx, 'results')}
            {renderSection(record, idx, 'tail')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ObstetricHistoryDocument;
