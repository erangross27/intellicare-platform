/**
 * PsychiatricHistoryDocument.jsx
 * March 2026 -- Complete rewrite with inline editing, blue glow theme
 * Collection: psychiatric_history
 *
 * 12 Sections:
 *   1. record-info: date, type, provider, facility
 *   2. previous-episodes: previousEpisodes (array of {diagnosis, date, treatment, outcome})
 *   3. hospitalizations: hospitalizations (array)
 *   4. suicide-attempts: suicideAttempts (array of {date, method, hospitalization})
 *   5. substance-abuse: substanceAbuse.history, substanceAbuse.status, substanceAbuse.substances, substanceAbuse.sobrietyDate, substanceAbuse.treatment, substanceAbuse.withdrawalSymptoms
 *   6. previous-psychotherapy: previousPsychotherapy (array of {type, duration, date, outcome})
 *   7. family-history: familyPsychHistory (array of {relative, condition, treatment})
 *   8. findings: findings
 *   9. assessment: assessment
 *  10. plan: plan
 *  11. recommendations: recommendations (array)
 *  12. notes: notes
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PsychiatricHistoryDocumentPDFTemplate from '../pdf-templates/PsychiatricHistoryDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './PsychiatricHistoryDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [editKey]: value } }  (editKey = localEdits key = "<fieldPart>-<idx>") */
const DRAFT_KEY = 'psychiatric_historyPendingEdits';
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
  'previous-episodes': 'Previous Psychiatric Episodes',
  'hospitalizations': 'Hospitalizations',
  'suicide-attempts': 'Suicide Attempts',
  'substance-abuse': 'Substance Abuse History',
  'previous-psychotherapy': 'Previous Psychotherapy',
  'family-history': 'Family Psychiatric History',
  'findings': 'Findings',
  'assessment': 'Assessment',
  'plan': 'Plan',
  'recommendations': 'Recommendations',
  'notes': 'Notes',
  'results': 'Results',
};

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  'previousEpisodes': 'Previous Psychiatric Episodes',
  'hospitalizations': 'Hospitalizations',
  'suicideAttempts': 'Suicide Attempts',
  'substanceAbuse.history': 'Substance Abuse History',
  'substanceAbuse.status': 'Status',
  'substanceAbuse.substances': 'Substances',
  'substanceAbuse.sobrietyDate': 'Sobriety Date',
  'substanceAbuse.treatment': 'Treatment History',
  'substanceAbuse.withdrawalSymptoms': 'Withdrawal Symptoms',
  'previousPsychotherapy': 'Previous Psychotherapy',
  'familyPsychHistory': 'Family Psychiatric History',
  'recommendations': 'Recommendations',
  'results': 'Results',
};

const SECTION_FIELDS = {
  'record-info': ['date', 'type', 'provider', 'facility'],
  'previous-episodes': ['previousEpisodes'],
  'hospitalizations': ['hospitalizations'],
  'suicide-attempts': ['suicideAttempts'],
  'substance-abuse': ['substanceAbuse.history', 'substanceAbuse.status', 'substanceAbuse.substances', 'substanceAbuse.sobrietyDate', 'substanceAbuse.treatment', 'substanceAbuse.withdrawalSymptoms'],
  'previous-psychotherapy': ['previousPsychotherapy'],
  'family-history': ['familyPsychHistory'],
  'findings': ['findings'],
  'assessment': ['assessment'],
  'plan': ['plan'],
  'recommendations': ['recommendations'],
  'notes': ['notes'],
  'results': ['results'],
};

const BOOLEAN_FIELDS = ['substanceAbuse.history'];
const DATE_FIELDS = ['date'];
const STRING_FIELDS = ['type', 'provider', 'facility', 'findings', 'assessment', 'plan', 'notes', 'substanceAbuse.status', 'substanceAbuse.sobrietyDate', 'substanceAbuse.withdrawalSymptoms'];

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

/* humanizeKey: convert a dynamic object key (snake_case / camelCase) into a Title-Case label */
const humanizeKey = (key) => {
  if (key === null || key === undefined) return '';
  return String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
};

/* flattenObjectLeaves: recursively flatten a dynamic-key object into [{ path, label, value }]
   leaves (typed scalars). Arrays become joined readable strings. No "[object Object]". */
const flattenObjectLeaves = (obj, parentPath = '', parentLabel = '') => {
  const leaves = [];
  if (obj === null || obj === undefined || typeof obj !== 'object') return leaves;
  Object.keys(obj).forEach(k => {
    const v = obj[k];
    const path = parentPath ? `${parentPath}.${k}` : k;
    const label = parentLabel ? `${parentLabel} - ${humanizeKey(k)}` : humanizeKey(k);
    if (v === null || v === undefined || v === '') return;
    if (Array.isArray(v)) {
      const joined = v.map(x => (x !== null && typeof x === 'object') ? JSON.stringify(x) : String(x)).filter(s => s !== '').join(', ');
      if (joined) leaves.push({ path, label, value: joined });
    } else if (typeof v === 'object') {
      leaves.push(...flattenObjectLeaves(v, path, label));
    } else if (typeof v === 'boolean') {
      leaves.push({ path, label, value: v ? 'Yes' : 'No' });
    } else {
      leaves.push({ path, label, value: String(v) });
    }
  });
  return leaves;
};

/* ======= COMPONENT ======= */
const PsychiatricHistoryDocument = ({ document: docProp }) => {
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

  /* ======= DATA UNWRAP ======= */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.psychiatric_history) return Array.isArray(r.psychiatric_history) ? r.psychiatric_history : [r.psychiatric_history];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.psychiatric_history) return Array.isArray(dd.psychiatric_history) ? dd.psychiatric_history : [dd.psychiatric_history]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     Maps each record's _id ($oid-aware) to its render index. Repopulates localEdits + pendingEdits and
     the edited markers so the row shows "edited" and the section button returns to yellow Pending Approve. */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = idOf(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([editKey, value]) => {
        // Draft keys are stored as the live editKey ("<fieldPart>-<draftIdx>"); re-map to THIS render idx.
        const dash = editKey.lastIndexOf('-');
        const fieldPart = dash === -1 ? editKey : editKey.slice(0, dash);
        const liveKey = `${fieldPart}-${idx}`;
        nLocal[liveKey] = value;
        nPending[liveKey] = true;
        // Trailing numeric dot-segment => array element edit; mark the per-element editedFields key.
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        if (lastDot !== -1 && /^\d+$/.test(tail)) nFields[`${fieldPart}-${idx}`] = 'edited';
        else nFields[liveKey] = 'edited';
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
    // Handle dot-path fields like substanceAbuse.status
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

  /* ======= SEARCH -- 4-LEVEL ======= */
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
            if (typeof item === 'object') return JSON.stringify(item).toLowerCase().includes(phrase);
            return String(item).toLowerCase().includes(phrase);
          })) return true;
        } else if (typeof val === 'object') {
          if (JSON.stringify(val).toLowerCase().includes(phrase)) return true;
        } else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
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
      if (Array.isArray(val)) return val.some(item => {
        if (typeof item === 'object') return JSON.stringify(item).toLowerCase().includes(phrase);
        return String(item).toLowerCase().includes(phrase);
      });
      if (typeof val === 'object') return JSON.stringify(val).toLowerCase().includes(phrase);
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  // shouldShowRow helper - Level 4
  const shouldShowRow = useCallback((record, ...valuesToCheck) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    for (const val of valuesToCheck) {
      if (val && String(val).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm]);

  // Section title matches search helper - Level 3 bypass
  const sectionTitleMatchesSearch = useCallback((...sectionTitles) => {
    if (!searchTerm.trim()) return false;
    const phrase = searchTerm.toLowerCase().trim();
    for (const title of sectionTitles) {
      if (!title) continue;
      const titleLower = String(title).toLowerCase();
      if (titleLower.includes(phrase) || phrase.includes(titleLower)) return true;
    }
    return false;
  }, [searchTerm]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Psychiatric History ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      // Check field values
      const allFields = Object.values(SECTION_FIELDS).flat();
      for (const f of allFields) {
        const val = getFieldValue(record, f, idx);
        if (val && (Array.isArray(val)
          ? val.some(item => typeof item === 'object' ? JSON.stringify(item).toLowerCase().includes(phrase) : String(item).toLowerCase().includes(phrase))
          : typeof val === 'object' ? JSON.stringify(val).toLowerCase().includes(phrase) : fmtVal(val).toLowerCase().includes(phrase)
        )) return true;
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal]);

  /* ======= PDF DATA ======= */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fn = m[1];
          if (fn.includes('.')) {
            const parts = fn.split('.');
            if (parts.length === 2) {
              if (!merged[parts[0]]) merged[parts[0]] = {};
              merged[parts[0]] = { ...merged[parts[0]], [parts[1]]: localEdits[key] };
            }
          } else {
            merged[fn] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ======= EDIT HANDLERS ======= */
  /* stageEdit = the single place that stages a DRAFT (NO DB write): set localEdits + mark pending,
     drop this record's approved flags so the section button returns to yellow Pending Approve, and
     persist the draft to localStorage (survives refresh; still NOT in DB/PDF until Approve commits).
     `value` may be a scalar OR a whole array (array-of-strings fields store the full array). */
  const stageEdit = useCallback((record, editKey, value, idx) => {
    const id = safeId(record); if (!id) return;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    // Re-edit after approval → drop this record's section 'approved' flags (button back to Pending)
    setApprovedSections(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.endsWith(`-${idx}`)) delete n[k]; }); return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][editKey] = value;
    writeDrafts(store);
  }, [safeId]);
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    // Stage a DRAFT only (no DB write). Approve (handleApproveSection) commits to MongoDB.
    stageEdit(record, `${fn}-${idx}`, saveVal, idx);
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageEdit]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setSaveError(null);
      // Stage a DRAFT only (no DB write). Approve commits.
      stageEdit(record, `${fn}-${idx}`, fullText, idx);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setSaveError(null);
    // Stage a DRAFT only (no DB write). Approve commits.
    stageEdit(record, `${fn}-${idx}`, fullText, idx);
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

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    try {
      const fields = SECTION_FIELDS[sid] || [];
      // localEdits keys for this section/record are "<fieldPart>-<idx>" where fieldPart starts with a
      // section field (e.g. "findings", "substanceAbuse.status", "recommendations", "results.x.y").
      const toCommit = Object.keys(localEdits).filter(k =>
        pendingEdits[k] && k.endsWith(`-${idx}`) &&
        fields.some(f => { const fp = k.slice(0, -`-${idx}`.length); return fp === f || fp.startsWith(`${f}.`); })
      );
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -`-${idx}`.length); // "field" | "field.arrayIndex" | "field.path"
        const value = localEdits[editKey];
        if (Array.isArray(value)) {
          // Array-of-strings field (e.g. recommendations, substanceAbuse.substances): PUT each element.
          for (let ai = 0; ai < value.length; ai++) {
            const resp = await secureApiClient.put(`/api/edit/psychiatric_history/${id}/edit`, { field: fieldPart, value: value[ai], arrayIndex: ai });
            if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
          }
        } else {
          // arrayIndex ONLY when the segment after the LAST dot is purely numeric (parity w/ reference).
          const lastDot = fieldPart.lastIndexOf('.');
          const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
          const payload = (lastDot !== -1 && /^\d+$/.test(tail))
            ? { field: fieldPart.slice(0, lastDot), value, arrayIndex: parseInt(tail, 10) }
            : { field: fieldPart, value };
          const resp = await secureApiClient.put(`/api/edit/psychiatric_history/${id}/edit`, payload);
          if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        }
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/psychiatric_history/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) { toCommit.forEach(k => delete store[id][k]); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[PsychiatricHistory] Approve error:', err); }
  }, [safeId, localEdits, pendingEdits]);

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

  const buildRecordCopyText = useCallback((record, idx) => {
    const lines = [];
    lines.push(`PSYCHIATRIC HISTORY ${idx + 1}`);
    lines.push('='.repeat(40));
    if (record.date) lines.push(`Date: ${formatDate(record.date)}`);
    if (record.type) lines.push(`Type: ${record.type}`);
    if (record.provider) lines.push(`Provider: ${record.provider}`);
    if (record.facility) lines.push(`Facility: ${record.facility}`);
    lines.push('');
    if (record.previousEpisodes?.length > 0) {
      lines.push('PREVIOUS PSYCHIATRIC EPISODES');
      lines.push('-'.repeat(40));
      record.previousEpisodes.forEach((ep, i) => {
        lines.push(`${i + 1}. ${ep.diagnosis || 'Unknown Diagnosis'}`);
        if (ep.date) lines.push(`   Date: ${ep.date}`);
        if (ep.treatment) lines.push(`   Treatment: ${ep.treatment}`);
        if (ep.outcome) lines.push(`   Outcome: ${ep.outcome}`);
      });
      lines.push('');
    }
    if (record.hospitalizations?.length > 0) {
      lines.push('HOSPITALIZATIONS');
      lines.push('-'.repeat(40));
      record.hospitalizations.forEach((h, i) => lines.push(`${i + 1}. ${typeof h === 'string' ? h : JSON.stringify(h)}`));
      lines.push('');
    }
    if (record.suicideAttempts?.length > 0) {
      lines.push('SUICIDE ATTEMPTS');
      lines.push('-'.repeat(40));
      record.suicideAttempts.forEach((a, i) => {
        lines.push(`${i + 1}. Date: ${a.date || 'Unknown'}`);
        if (a.method) lines.push(`   Method: ${a.method}`);
        lines.push(`   Hospitalization: ${a.hospitalization ? 'Yes' : 'No'}`);
      });
      lines.push('');
    }
    if (record.substanceAbuse) {
      lines.push('SUBSTANCE ABUSE HISTORY');
      lines.push('-'.repeat(40));
      const sa = record.substanceAbuse;
      if (sa.history != null) lines.push(`History: ${sa.history ? 'Yes' : 'No'}`);
      if (sa.status) lines.push(`Status: ${sa.status}`);
      if (sa.substances?.length > 0) { lines.push('Substances:'); sa.substances.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`)); }
      if (sa.sobrietyDate) lines.push(`Sobriety Date: ${sa.sobrietyDate}`);
      if (sa.treatment?.length > 0) { lines.push('Treatment History:'); sa.treatment.forEach((t, i) => lines.push(`  ${i + 1}. ${t}`)); }
      if (sa.withdrawalSymptoms) lines.push(`Withdrawal Symptoms: ${sa.withdrawalSymptoms}`);
      lines.push('');
    }
    if (record.previousPsychotherapy?.length > 0) {
      lines.push('PREVIOUS PSYCHOTHERAPY');
      lines.push('-'.repeat(40));
      record.previousPsychotherapy.forEach((p, i) => {
        if (typeof p === 'string') { lines.push(`${i + 1}. ${p}`); }
        else { lines.push(`${i + 1}. ${p.type || 'Therapy'}`); if (p.date) lines.push(`   Date: ${p.date}`); if (p.duration) lines.push(`   Duration: ${p.duration}`); if (p.outcome) lines.push(`   Outcome: ${p.outcome}`); }
      });
      lines.push('');
    }
    if (record.familyPsychHistory?.length > 0) {
      lines.push('FAMILY PSYCHIATRIC HISTORY');
      lines.push('-'.repeat(40));
      record.familyPsychHistory.forEach((fh, i) => {
        lines.push(`${i + 1}. ${fh.relative || 'Unknown Relative'}`);
        if (fh.condition) lines.push(`   Condition: ${fh.condition}`);
        if (fh.treatment) lines.push(`   Treatment: ${fh.treatment}`);
      });
      lines.push('');
    }
    ['findings', 'assessment', 'plan'].forEach(field => {
      if (record[field]) {
        lines.push(field.toUpperCase());
        lines.push('-'.repeat(40));
        formatSentenceFieldLines(record[field]).forEach(l => lines.push(l));
        lines.push('');
      }
    });
    if (record.recommendations?.length > 0) {
      lines.push('RECOMMENDATIONS');
      lines.push('-'.repeat(40));
      record.recommendations.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
      lines.push('');
    }
    if (record.notes) { lines.push('NOTES'); lines.push('-'.repeat(40)); lines.push(record.notes); }
    if (record.results && typeof record.results === 'object' && !Array.isArray(record.results)) {
      const leaves = flattenObjectLeaves(record.results);
      if (leaves.length > 0) {
        lines.push('');
        lines.push('RESULTS');
        lines.push('-'.repeat(40));
        leaves.forEach(l => lines.push(`${l.label}: ${l.value}`));
      }
    }
    return lines.join('\n');
  }, [formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== PSYCHIATRIC HISTORY ===\n\n';
    pdfData.forEach((r, idx) => { text += buildRecordCopyText(r, idx) + '\n\n'; });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildRecordCopyText]);

  /* ======= RENDER: EDITABLE STRING with splitBySentence ======= */
  const renderEditableString = (record, fn, idx, sid) => {
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setSaveError(null); stageEdit(record, `${fn}-${idx}`, fullText2, idx); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setSaveError(null); stageEdit(record, `${fn}-${idx}`, fullText, idx); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ======= RENDER: BOOLEAN FIELD ======= */
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

  /* ======= RENDER: EDITABLE NESTED FIELD (for array-of-objects sub-fields) ======= */
  const renderNestedEditableField = (record, parentField, arrayIndex, subField, recordIdx, sid, label) => {
    const fullFieldPath = `${parentField}.${arrayIndex}.${subField}`;
    const editKey = `${fullFieldPath}-${recordIdx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    const parentArr = getFieldValue(record, parentField, recordIdx);
    const item = parentArr?.[arrayIndex];
    const rawVal = localEdits[editKey] !== undefined ? localEdits[editKey] : item?.[subField];
    if (!hasVal(rawVal)) return null;
    const displayVal = typeof rawVal === 'boolean' ? (rawVal ? 'Yes' : 'No') : String(rawVal);

    return (
      <div className="nested-field-card" key={subField}>
        <div className="field-label">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(typeof rawVal === 'boolean' ? (rawVal ? 'Yes' : 'No') : displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {typeof rawVal === 'boolean' ? (
                <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const saveVal = typeof rawVal === 'boolean' ? (editValue === 'Yes') : editValue; setSaveError(null); stageEdit(record, editKey, saveVal, recordIdx); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content">
                <span className="content-value">{highlightText(displayVal)}</span>
                {typeof rawVal === 'boolean' && <span className={`status-badge ${rawVal ? 'hospitalized-yes' : 'hospitalized-no'}`}>{rawVal ? 'Yes' : 'No'}</span>}
                <span className="edit-indicator">&#9998;</span>
              </div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(displayVal, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ======= RENDER: DYNAMIC-KEY OBJECT (results) ======= */
  /* Renders an object of arbitrary {key: value} (incl. nested) as humanized-label rows
     with typed leaves. Each leaf editable via dot-path results.<path>. No "[object Object]". */
  const renderDynamicObject = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!val || typeof val !== 'object' || Array.isArray(val)) return null;
    const leaves = flattenObjectLeaves(val);
    if (leaves.length === 0) return null; // content-gated: empty object renders nothing
    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || humanizeKey(fn))}</div>
        {leaves.map((leaf) => {
          const fullFieldPath = `${fn}.${leaf.path}`;
          const editKey = `${fullFieldPath}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const displayVal = leaf.value;
          if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(sid)
            && !leaf.label.toLowerCase().includes(searchTerm.toLowerCase().trim())
            && !displayVal.toLowerCase().includes(searchTerm.toLowerCase().trim())) return null;
          return (
            <div className="nested-field-card" key={leaf.path}>
              <div className="field-label">{highlightText(leaf.label)}</div>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setSaveError(null); stageEdit(record, editKey, editValue, idx); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${leaf.label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ======= MAIN RENDER ======= */
  if (!records || records.length === 0) {
    return (
      <div className="psychiatric-history-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Psychiatric History</h2></div>
        <div className="empty-state">No psychiatric history records available</div>
      </div>
    );
  }

  return (
    <div className="psychiatric-history-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Psychiatric History</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<PsychiatricHistoryDocumentPDFTemplate document={pdfData} />} fileName={`psychiatric-history-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search psychiatric history..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => {
          const isSearching = searchTerm.trim();

          return (
            <div key={idx} className="record-card">
              <div className="record-header">
                {hasVal(record.date) && (
                  <div className="record-meta-row">
                    <span className="record-date">{formatDate(record.date)}</span>
                  </div>
                )}
                <h3 className="record-name">{highlightText(`Psychiatric History ${idx + 1}`)}</h3>
              </div>

              {/* Section 1: Record Information */}
              {(() => {
                const sid = 'record-info';
                if (!shouldShowSection(record, sid)) return null;
                const hasAny = hasVal(record.provider) || hasVal(record.facility) || hasVal(record.type) || hasVal(record.date);
                if (!hasAny) return null;
                const copyId = `${sid}-${idx}`;
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
                        <div className="header-right-actions">
                          <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => { const lines = ['RECORD INFORMATION', '='.repeat(40)]; if (record.date) lines.push(`Date: ${formatDate(record.date)}`); if (record.type) lines.push(`Type: ${record.type}`); if (record.provider) lines.push(`Provider: ${record.provider}`); if (record.facility) lines.push(`Facility: ${record.facility}`); copySection(lines.join('\n'), copyId); }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
                          {renderApproveButton(record, sid, idx)}
                        </div>
                      </div>
                      {DATE_FIELDS.includes('date') && renderDateField(record, 'date', idx, sid)}
                      {renderEditableString(record, 'type', idx, sid)}
                      {renderEditableString(record, 'provider', idx, sid)}
                      {renderEditableString(record, 'facility', idx, sid)}
                    </div>
                  </div>
                );
              })()}

              {/* Section 2: Previous Psychiatric Episodes */}
              {(() => {
                const sid = 'previous-episodes';
                if (!shouldShowSection(record, sid)) return null;
                const eps = record.previousEpisodes;
                if (!eps?.length) return null;
                const copyId = `${sid}-${idx}`;
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
                        <div className="header-right-actions">
                          <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => { const lines = ['PREVIOUS PSYCHIATRIC EPISODES', '='.repeat(40)]; eps.forEach((ep, i) => { lines.push(`${i + 1}. ${ep.diagnosis || 'Unknown'}`); if (ep.date) lines.push(`   Date: ${ep.date}`); if (ep.treatment) lines.push(`   Treatment: ${ep.treatment}`); if (ep.outcome) lines.push(`   Outcome: ${ep.outcome}`); }); copySection(lines.join('\n'), copyId); }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
                          {renderApproveButton(record, sid, idx)}
                        </div>
                      </div>
                      {eps.map((episode, epIdx) => {
                        const epTitle = episode.diagnosis || `Episode ${epIdx + 1}`;
                        if (isSearching && !record._showAllSections && !sectionTitleMatchesSearch(SECTION_TITLES[sid], 'Episodes', epTitle, `Episode ${epIdx + 1}`)) {
                          const epMatch = shouldShowRow(record, episode.diagnosis, episode.date, episode.treatment, episode.outcome);
                          if (!epMatch) return null;
                        }
                        return (
                          <div key={epIdx} className="rec-mini-card">
                            <div className="subsection-header">
                              <div className="nested-subtitle">{highlightText(epTitle)}</div>
                              <button className={`copy-btn ${copiedItems[`ep-${idx}-${epIdx}`] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); const lines = [epTitle]; if (episode.date) lines.push(`Date: ${episode.date}`); if (episode.treatment) lines.push(`Treatment: ${episode.treatment}`); if (episode.outcome) lines.push(`Outcome: ${episode.outcome}`); copyItem(lines.join('\n'), `ep-${idx}-${epIdx}`); }}>{copiedItems[`ep-${idx}-${epIdx}`] ? 'Copied!' : 'Copy Section'}</button>
                            </div>
                            {renderNestedEditableField(record, 'previousEpisodes', epIdx, 'date', idx, sid, 'Date')}
                            {renderNestedEditableField(record, 'previousEpisodes', epIdx, 'treatment', idx, sid, 'Treatment')}
                            {renderNestedEditableField(record, 'previousEpisodes', epIdx, 'outcome', idx, sid, 'Outcome')}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Section 3: Hospitalizations */}
              {(() => {
                const sid = 'hospitalizations';
                if (!shouldShowSection(record, sid)) return null;
                const hosps = record.hospitalizations;
                if (!hosps?.length) return null;
                const copyId = `${sid}-${idx}`;
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
                        <div className="header-right-actions">
                          <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => { const lines = ['HOSPITALIZATIONS', '='.repeat(40)]; hosps.forEach((h, i) => lines.push(`${i + 1}. ${typeof h === 'string' ? h : JSON.stringify(h)}`)); copySection(lines.join('\n'), copyId); }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
                          {renderApproveButton(record, sid, idx)}
                        </div>
                      </div>
                      {hosps.map((hosp, hIdx) => {
                        if (typeof hosp === 'string') {
                          const editKey = `hospitalizations.${hIdx}-${idx}`;
                          const isEditing = editingField === editKey;
                          const isModified = editedFields[editKey];
                          if (isSearching && !record._showAllSections && !sectionTitleMatchesSearch('Hospitalizations') && !shouldShowRow(record, hosp)) return null;
                          return (
                            <div key={hIdx}>
                              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(hosp); setSaveError(null); } }}>
                                {isEditing ? (
                                  <div className="edit-field-container">
                                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                    {saveError && <div className="save-error">{saveError}</div>}
                                    <div className="edit-actions">
                                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setSaveError(null); const arr = [...((localEdits[`hospitalizations-${idx}`] !== undefined ? localEdits[`hospitalizations-${idx}`] : hosps) || [])]; arr[hIdx] = editValue; stageEdit(record, `hospitalizations-${idx}`, arr, idx); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="row-content"><span className="content-value">{highlightText(hosp)}</span><span className="edit-indicator">&#9998;</span></div>
                                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(hosp, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                                  </>
                                )}
                              </div>
                              {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                            </div>
                          );
                        }
                        // Object hospitalizations
                        const hospTitle = hosp.facility || `Hospitalization ${hIdx + 1}`;
                        return (
                          <div key={hIdx} className="rec-mini-card">
                            <div className="subsection-header">
                              <div className="nested-subtitle">{highlightText(hospTitle)}</div>
                              <button className={`copy-btn ${copiedItems[`hosp-${idx}-${hIdx}`] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); const lines = [hospTitle]; if (hosp.date) lines.push(`Date: ${hosp.date}`); if (hosp.reason) lines.push(`Reason: ${hosp.reason}`); if (hosp.duration) lines.push(`Duration: ${hosp.duration}`); copyItem(lines.join('\n'), `hosp-${idx}-${hIdx}`); }}>{copiedItems[`hosp-${idx}-${hIdx}`] ? 'Copied!' : 'Copy Section'}</button>
                            </div>
                            {renderNestedEditableField(record, 'hospitalizations', hIdx, 'date', idx, sid, 'Date')}
                            {renderNestedEditableField(record, 'hospitalizations', hIdx, 'reason', idx, sid, 'Reason')}
                            {renderNestedEditableField(record, 'hospitalizations', hIdx, 'duration', idx, sid, 'Duration')}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Section 4: Suicide Attempts */}
              {(() => {
                const sid = 'suicide-attempts';
                if (!shouldShowSection(record, sid)) return null;
                const attempts = record.suicideAttempts;
                if (!attempts?.length) return null;
                const copyId = `${sid}-${idx}`;
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
                        <div className="header-right-actions">
                          <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => { const lines = ['SUICIDE ATTEMPTS', '='.repeat(40)]; attempts.forEach((a, i) => { lines.push(`${i + 1}. Date: ${a.date || 'Unknown'}`); if (a.method) lines.push(`   Method: ${a.method}`); lines.push(`   Hospitalization: ${a.hospitalization ? 'Yes' : 'No'}`); }); copySection(lines.join('\n'), copyId); }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
                          {renderApproveButton(record, sid, idx)}
                        </div>
                      </div>
                      {attempts.map((attempt, aIdx) => {
                        const attTitle = `Attempt ${aIdx + 1}`;
                        if (isSearching && !record._showAllSections && !sectionTitleMatchesSearch(SECTION_TITLES[sid], 'Suicide', 'Attempts', attTitle)) {
                          const attMatch = shouldShowRow(record, attempt.date, attempt.method);
                          if (!attMatch) return null;
                        }
                        return (
                          <div key={aIdx} className="rec-mini-card">
                            <div className="subsection-header">
                              <div className="nested-subtitle">{highlightText(attTitle)}</div>
                              <button className={`copy-btn ${copiedItems[`att-${idx}-${aIdx}`] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); const lines = [attTitle]; if (attempt.date) lines.push(`Date: ${attempt.date}`); if (attempt.method) lines.push(`Method: ${attempt.method}`); lines.push(`Hospitalization: ${attempt.hospitalization ? 'Yes' : 'No'}`); copyItem(lines.join('\n'), `att-${idx}-${aIdx}`); }}>{copiedItems[`att-${idx}-${aIdx}`] ? 'Copied!' : 'Copy Section'}</button>
                            </div>
                            {renderNestedEditableField(record, 'suicideAttempts', aIdx, 'date', idx, sid, 'Date')}
                            {renderNestedEditableField(record, 'suicideAttempts', aIdx, 'method', idx, sid, 'Method')}
                            {renderNestedEditableField(record, 'suicideAttempts', aIdx, 'hospitalization', idx, sid, 'Hospitalization')}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Section 5: Substance Abuse History */}
              {(() => {
                const sid = 'substance-abuse';
                if (!shouldShowSection(record, sid)) return null;
                const sa = record.substanceAbuse;
                if (!sa) return null;
                const copyId = `${sid}-${idx}`;
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
                        <div className="header-right-actions">
                          <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => { const lines = ['SUBSTANCE ABUSE HISTORY', '='.repeat(40)]; if (sa.history != null) lines.push(`History: ${sa.history ? 'Yes' : 'No'}`); if (sa.status) lines.push(`Status: ${sa.status}`); if (sa.substances?.length) { lines.push('Substances:'); sa.substances.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`)); } if (sa.sobrietyDate) lines.push(`Sobriety Date: ${sa.sobrietyDate}`); if (sa.treatment?.length) { lines.push('Treatment:'); sa.treatment.forEach((t, i) => lines.push(`  ${i + 1}. ${t}`)); } if (sa.withdrawalSymptoms) lines.push(`Withdrawal: ${sa.withdrawalSymptoms}`); copySection(lines.join('\n'), copyId); }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
                          {renderApproveButton(record, sid, idx)}
                        </div>
                      </div>
                      {renderBooleanField(record, 'substanceAbuse.history', idx, sid)}
                      {renderEditableString(record, 'substanceAbuse.status', idx, sid)}
                      {/* Substances array */}
                      {sa.substances?.length > 0 && (() => {
                        const label = 'Substances';
                        return (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText(label)}</div>
                            {sa.substances.map((substance, sIdx) => {
                              const editKey = `substanceAbuse.substances.${sIdx}-${idx}`;
                              const isEditing = editingField === editKey;
                              const isModified = editedFields[editKey];
                              return (
                                <div key={sIdx}>
                                  <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(substance); setSaveError(null); } }}>
                                    {isEditing ? (
                                      <div className="edit-field-container">
                                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                        {saveError && <div className="save-error">{saveError}</div>}
                                        <div className="edit-actions">
                                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setSaveError(null); const arr = [...((localEdits[`substanceAbuse.substances-${idx}`] !== undefined ? localEdits[`substanceAbuse.substances-${idx}`] : sa.substances) || [])]; arr[sIdx] = editValue; stageEdit(record, `substanceAbuse.substances-${idx}`, arr, idx); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="row-content"><span className="content-value">{highlightText(substance)}</span><span className="edit-indicator">&#9998;</span></div>
                                        <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(substance, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                                      </>
                                    )}
                                  </div>
                                  {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                      {renderEditableString(record, 'substanceAbuse.sobrietyDate', idx, sid)}
                      {/* Treatment array */}
                      {sa.treatment?.length > 0 && (() => {
                        const label = 'Treatment History';
                        return (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText(label)}</div>
                            {sa.treatment.map((tx, tIdx) => {
                              const editKey = `substanceAbuse.treatment.${tIdx}-${idx}`;
                              const isEditing = editingField === editKey;
                              const isModified = editedFields[editKey];
                              return (
                                <div key={tIdx}>
                                  <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(tx); setSaveError(null); } }}>
                                    {isEditing ? (
                                      <div className="edit-field-container">
                                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                        {saveError && <div className="save-error">{saveError}</div>}
                                        <div className="edit-actions">
                                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setSaveError(null); const arr = [...((localEdits[`substanceAbuse.treatment-${idx}`] !== undefined ? localEdits[`substanceAbuse.treatment-${idx}`] : sa.treatment) || [])]; arr[tIdx] = editValue; stageEdit(record, `substanceAbuse.treatment-${idx}`, arr, idx); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="row-content"><span className="content-value">{highlightText(tx)}</span><span className="edit-indicator">&#9998;</span></div>
                                        <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(tx, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                                      </>
                                    )}
                                  </div>
                                  {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                      {renderEditableString(record, 'substanceAbuse.withdrawalSymptoms', idx, sid)}
                    </div>
                  </div>
                );
              })()}

              {/* Section 6: Previous Psychotherapy */}
              {(() => {
                const sid = 'previous-psychotherapy';
                if (!shouldShowSection(record, sid)) return null;
                const therapies = record.previousPsychotherapy;
                if (!therapies?.length) return null;
                const copyId = `${sid}-${idx}`;
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
                        <div className="header-right-actions">
                          <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => { const lines = ['PREVIOUS PSYCHOTHERAPY', '='.repeat(40)]; therapies.forEach((p, i) => { if (typeof p === 'string') { lines.push(`${i + 1}. ${p}`); } else { lines.push(`${i + 1}. ${p.type || 'Therapy'}`); if (p.date) lines.push(`   Date: ${p.date}`); if (p.duration) lines.push(`   Duration: ${p.duration}`); if (p.outcome) lines.push(`   Outcome: ${p.outcome}`); } }); copySection(lines.join('\n'), copyId); }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
                          {renderApproveButton(record, sid, idx)}
                        </div>
                      </div>
                      {therapies.map((therapy, pIdx) => {
                        if (typeof therapy === 'string') {
                          const editKey = `previousPsychotherapy.${pIdx}-${idx}`;
                          const isEditing = editingField === editKey;
                          const isModified = editedFields[editKey];
                          return (
                            <div key={pIdx}>
                              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(therapy); setSaveError(null); } }}>
                                {isEditing ? (
                                  <div className="edit-field-container">
                                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                    {saveError && <div className="save-error">{saveError}</div>}
                                    <div className="edit-actions">
                                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setSaveError(null); const arr = [...((localEdits[`previousPsychotherapy-${idx}`] !== undefined ? localEdits[`previousPsychotherapy-${idx}`] : therapies) || [])]; arr[pIdx] = editValue; stageEdit(record, `previousPsychotherapy-${idx}`, arr, idx); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="row-content"><span className="content-value">{highlightText(therapy)}</span><span className="edit-indicator">&#9998;</span></div>
                                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(therapy, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                                  </>
                                )}
                              </div>
                              {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                            </div>
                          );
                        }
                        // Object therapy
                        const therapyTitle = therapy.type || `Therapy ${pIdx + 1}`;
                        return (
                          <div key={pIdx} className="rec-mini-card">
                            <div className="subsection-header">
                              <div className="nested-subtitle">{highlightText(therapyTitle)}</div>
                              <button className={`copy-btn ${copiedItems[`therapy-${idx}-${pIdx}`] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); const lines = [therapyTitle]; if (therapy.date) lines.push(`Date: ${therapy.date}`); if (therapy.duration) lines.push(`Duration: ${therapy.duration}`); if (therapy.outcome) lines.push(`Outcome: ${therapy.outcome}`); copyItem(lines.join('\n'), `therapy-${idx}-${pIdx}`); }}>{copiedItems[`therapy-${idx}-${pIdx}`] ? 'Copied!' : 'Copy Section'}</button>
                            </div>
                            {renderNestedEditableField(record, 'previousPsychotherapy', pIdx, 'date', idx, sid, 'Date')}
                            {renderNestedEditableField(record, 'previousPsychotherapy', pIdx, 'duration', idx, sid, 'Duration')}
                            {renderNestedEditableField(record, 'previousPsychotherapy', pIdx, 'outcome', idx, sid, 'Outcome')}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Section 7: Family Psychiatric History */}
              {(() => {
                const sid = 'family-history';
                if (!shouldShowSection(record, sid)) return null;
                const fam = record.familyPsychHistory;
                if (!fam?.length) return null;
                const copyId = `${sid}-${idx}`;
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
                        <div className="header-right-actions">
                          <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => { const lines = ['FAMILY PSYCHIATRIC HISTORY', '='.repeat(40)]; fam.forEach((f, i) => { lines.push(`${i + 1}. ${f.relative || 'Unknown'}`); if (f.condition) lines.push(`   Condition: ${f.condition}`); if (f.treatment) lines.push(`   Treatment: ${f.treatment}`); }); copySection(lines.join('\n'), copyId); }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
                          {renderApproveButton(record, sid, idx)}
                        </div>
                      </div>
                      {fam.map((member, mIdx) => {
                        const memberTitle = member.relative || `Family Member ${mIdx + 1}`;
                        if (isSearching && !record._showAllSections && !sectionTitleMatchesSearch(SECTION_TITLES[sid], 'Family History', memberTitle)) {
                          const memMatch = shouldShowRow(record, member.relative, member.condition, member.treatment);
                          if (!memMatch) return null;
                        }
                        return (
                          <div key={mIdx} className="rec-mini-card">
                            <div className="subsection-header">
                              <div className="nested-subtitle">{highlightText(memberTitle)}</div>
                              <button className={`copy-btn ${copiedItems[`fam-${idx}-${mIdx}`] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); const lines = [memberTitle]; if (member.condition) lines.push(`Condition: ${member.condition}`); if (member.treatment) lines.push(`Treatment: ${member.treatment}`); copyItem(lines.join('\n'), `fam-${idx}-${mIdx}`); }}>{copiedItems[`fam-${idx}-${mIdx}`] ? 'Copied!' : 'Copy Section'}</button>
                            </div>
                            {renderNestedEditableField(record, 'familyPsychHistory', mIdx, 'relative', idx, sid, 'Relative')}
                            {renderNestedEditableField(record, 'familyPsychHistory', mIdx, 'condition', idx, sid, 'Condition')}
                            {renderNestedEditableField(record, 'familyPsychHistory', mIdx, 'treatment', idx, sid, 'Treatment')}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Section 8: Findings */}
              {(() => {
                const sid = 'findings';
                if (!shouldShowSection(record, sid)) return null;
                if (!hasVal(record.findings)) return null;
                const copyId = `${sid}-${idx}`;
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
                        <div className="header-right-actions">
                          <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => { const lines = ['FINDINGS', '='.repeat(40)]; formatSentenceFieldLines(record.findings).forEach(l => lines.push(l)); copySection(lines.join('\n'), copyId); }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
                          {renderApproveButton(record, sid, idx)}
                        </div>
                      </div>
                      {renderEditableString(record, 'findings', idx, sid)}
                    </div>
                  </div>
                );
              })()}

              {/* Section 9: Assessment */}
              {(() => {
                const sid = 'assessment';
                if (!shouldShowSection(record, sid)) return null;
                if (!hasVal(record.assessment)) return null;
                const copyId = `${sid}-${idx}`;
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
                        <div className="header-right-actions">
                          <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => { const lines = ['ASSESSMENT', '='.repeat(40)]; formatSentenceFieldLines(record.assessment).forEach(l => lines.push(l)); copySection(lines.join('\n'), copyId); }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
                          {renderApproveButton(record, sid, idx)}
                        </div>
                      </div>
                      {renderEditableString(record, 'assessment', idx, sid)}
                    </div>
                  </div>
                );
              })()}

              {/* Section 10: Plan */}
              {(() => {
                const sid = 'plan';
                if (!shouldShowSection(record, sid)) return null;
                if (!hasVal(record.plan)) return null;
                const copyId = `${sid}-${idx}`;
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
                        <div className="header-right-actions">
                          <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => { const lines = ['PLAN', '='.repeat(40)]; formatSentenceFieldLines(record.plan).forEach(l => lines.push(l)); copySection(lines.join('\n'), copyId); }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
                          {renderApproveButton(record, sid, idx)}
                        </div>
                      </div>
                      {renderEditableString(record, 'plan', idx, sid)}
                    </div>
                  </div>
                );
              })()}

              {/* Section 11: Recommendations */}
              {(() => {
                const sid = 'recommendations';
                if (!shouldShowSection(record, sid)) return null;
                const recs = record.recommendations;
                if (!recs?.length) return null;
                const copyId = `${sid}-${idx}`;
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
                        <div className="header-right-actions">
                          <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => { const lines = ['RECOMMENDATIONS', '='.repeat(40)]; recs.forEach((r, i) => lines.push(`${i + 1}. ${r}`)); copySection(lines.join('\n'), copyId); }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
                          {renderApproveButton(record, sid, idx)}
                        </div>
                      </div>
                      {recs.map((rec, rIdx) => {
                        const editKey = `recommendations.${rIdx}-${idx}`;
                        const isEditing = editingField === editKey;
                        const isModified = editedFields[editKey];
                        if (isSearching && !record._showAllSections && !sectionTitleMatchesSearch('Recommendations') && !shouldShowRow(record, rec)) return null;
                        return (
                          <div key={rIdx}>
                            <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(rec); setSaveError(null); } }}>
                              {isEditing ? (
                                <div className="edit-field-container">
                                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                  {saveError && <div className="save-error">{saveError}</div>}
                                  <div className="edit-actions">
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setSaveError(null); const arr = [...((localEdits[`recommendations-${idx}`] !== undefined ? localEdits[`recommendations-${idx}`] : recs) || [])]; arr[rIdx] = editValue; stageEdit(record, `recommendations-${idx}`, arr, idx); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                                    <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="row-content"><span className="content-value">{highlightText(rec)}</span><span className="edit-indicator">&#9998;</span></div>
                                  <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(rec, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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
              })()}

              {/* Section 12: Notes */}
              {(() => {
                const sid = 'notes';
                if (!shouldShowSection(record, sid)) return null;
                if (!hasVal(record.notes)) return null;
                const copyId = `${sid}-${idx}`;
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
                        <div className="header-right-actions">
                          <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(`NOTES\n${'='.repeat(40)}\n${record.notes}`, copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
                          {renderApproveButton(record, sid, idx)}
                        </div>
                      </div>
                      {renderEditableString(record, 'notes', idx, sid)}
                    </div>
                  </div>
                );
              })()}

              {/* Section 13: Results (dynamic-key object) */}
              {(() => {
                const sid = 'results';
                if (!shouldShowSection(record, sid)) return null;
                const res = getFieldValue(record, 'results', idx);
                const leaves = (res && typeof res === 'object' && !Array.isArray(res)) ? flattenObjectLeaves(res) : [];
                if (leaves.length === 0) return null; // content-gated
                const copyId = `${sid}-${idx}`;
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
                        <div className="header-right-actions">
                          <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => { const lines = ['RESULTS', '='.repeat(40)]; leaves.forEach(l => lines.push(`${l.label}: ${l.value}`)); copySection(lines.join('\n'), copyId); }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
                          {renderApproveButton(record, sid, idx)}
                        </div>
                      </div>
                      {renderDynamicObject(record, 'results', idx, sid)}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PsychiatricHistoryDocument;
