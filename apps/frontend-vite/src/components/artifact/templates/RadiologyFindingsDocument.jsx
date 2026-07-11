/**
 * RadiologyFindingsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: radiology_findings
 *
 * 9 Sections:
 *   1. study-information: modalityUsed, date, facility, provider
 *   2. technique: technique
 *   3. contrast-information: contrast.type, contrast.amount, contrast.reaction
 *   4. imaging-findings: findings (array of objects with anatomicLocation, finding, size, characteristics, significance)
 *   5. comparison: comparison
 *   6. impression: impression
 *   7. rads-scores: biRads, tirads, pirads
 *   8. results: results (dynamic-key object, possibly nested — humanized keys + typed leaves)
 *   9. recommendations: recommendations (array of objects with recommendation, date)
 *  10. clinical-summary: assessment, plan, notes, status
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import RadiologyFindingsDocumentPDFTemplate from '../pdf-templates/RadiologyFindingsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './RadiologyFindingsDocument.css';

/* ======= CONSTANTS ======= */
const SECTION_TITLES = {
  'study-information': 'Study Information',
  'technique': 'Technique',
  'contrast-information': 'Contrast Information',
  'imaging-findings': 'Imaging Findings',
  'comparison': 'Comparison',
  'impression': 'Impression',
  'rads-scores': 'RADS Scores',
  'results': 'Results',
  'recommendations': 'Recommendations',
  'clinical-summary': 'Clinical Summary',
};

const FIELD_LABELS = {
  modalityUsed: 'Modality',
  date: 'Date',
  facility: 'Facility',
  provider: 'Provider',
  technique: 'Technique',
  'contrast.type': 'Contrast Type',
  'contrast.amount': 'Contrast Amount',
  'contrast.reaction': 'Contrast Reaction',
  comparison: 'Comparison',
  impression: 'Impression',
  biRads: 'BI-RADS',
  tirads: 'TI-RADS',
  pirads: 'PI-RADS',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  status: 'Status',
  'findings.anatomicLocation': 'Anatomic Location',
  'findings.finding': 'Finding',
  'findings.size': 'Size',
  'findings.characteristics': 'Characteristics',
  'findings.significance': 'Significance',
  'recommendations.recommendation': 'Recommendation',
  'recommendations.date': 'Date',
};

const SECTION_FIELDS = {
  'study-information': ['modalityUsed', 'date', 'facility', 'provider'],
  'technique': ['technique'],
  'contrast-information': ['contrast.type', 'contrast.amount', 'contrast.reaction'],
  'imaging-findings': ['findings'],
  'comparison': ['comparison'],
  'impression': ['impression'],
  'rads-scores': ['biRads', 'tirads', 'pirads'],
  'results': ['results'],
  'recommendations': ['recommendations'],
  'clinical-summary': ['assessment', 'plan', 'notes', 'status'],
};

const BOOLEAN_FIELDS = [];
const DATE_FIELDS = ['date', 'recommendations.date'];
const NUMBER_FIELDS = [];
const ARRAY_FIELDS = [];
const STRING_FIELDS = ['modalityUsed', 'facility', 'provider', 'technique', 'contrast.type', 'contrast.amount', 'contrast.reaction', 'comparison', 'impression', 'biRads', 'tirads', 'pirads', 'assessment', 'plan', 'notes', 'status', 'findings.anatomicLocation', 'findings.finding', 'findings.size', 'findings.characteristics', 'findings.significance', 'recommendations.recommendation'];

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

/* humanizeKey: dynamic-key -> readable label (camelCase / snake_case / dotted) */
const humanizeKey = (key) => {
  if (key === null || key === undefined) return '';
  return String(key)
    .replace(/[_\-.]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
};

/* leafToString: typed leaf -> display string (no [object Object]) */
const leafToString = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  if (v instanceof Date) return v.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  if (typeof v === 'object' && v.$date) { const d = new Date(v.$date); return isNaN(d.getTime()) ? String(v.$date) : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
  return String(v);
};

/* flattenObject: recursively flatten a dynamic-key object into [{ path, label, value }] leaves.
   Arrays of primitives joined; objects recursed; content-gated (skips empties). */
const flattenObject = (obj, parentPath = '', parentLabel = '') => {
  const rows = [];
  if (!obj || typeof obj !== 'object') return rows;
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    const path = parentPath ? `${parentPath}.${key}` : key;
    const label = parentLabel ? `${parentLabel} — ${humanizeKey(key)}` : humanizeKey(key);
    if (val === null || val === undefined || val === '') return;
    if (typeof val === 'object' && !(val instanceof Date) && !val.$date) {
      if (Array.isArray(val)) {
        const flat = val.filter(item => item !== null && item !== undefined && item !== '');
        if (flat.length === 0) return;
        const allPrimitive = flat.every(item => typeof item !== 'object' || item === null);
        if (allPrimitive) {
          rows.push({ path, label, value: flat.map(leafToString).join(', ') });
        } else {
          flat.forEach((item, i) => {
            if (item && typeof item === 'object') rows.push(...flattenObject(item, `${path}.${i}`, `${label} ${i + 1}`));
            else rows.push({ path: `${path}.${i}`, label: `${label} ${i + 1}`, value: leafToString(item) });
          });
        }
      } else {
        if (Object.keys(val).length === 0) return;
        rows.push(...flattenObject(val, path, label));
      }
    } else {
      const sv = leafToString(val);
      if (sv.trim() === '') return;
      rows.push({ path, label, value: sv });
    }
  });
  return rows;
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = editKey without the "-<idx>" suffix) */
const DRAFT_KEY = 'radiologyFindingsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* ======= COMPONENT ======= */
const RadiologyFindingsDocument = ({ document: docProp }) => {
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
      if (r?.radiology_findings) return Array.isArray(r.radiology_findings) ? r.radiology_findings : [r.radiology_findings];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.radiology_findings) return Array.isArray(dd.radiology_findings) ? dd.radiology_findings : [dd.radiology_findings]; return [dd]; }
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
      const recId = idOf(record);
      const recDrafts = recId ? store[recId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // Mark edited so the badge + Pending Approve button show (covers field + sentence renderers)
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
    // Handle dot-path fields like contrast.type
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
      if (f === 'findings') {
        const findings = record.findings;
        if (Array.isArray(findings)) {
          for (const finding of findings) {
            for (const fk of ['anatomicLocation', 'finding', 'size', 'characteristics', 'significance']) {
              if (finding[fk] && String(finding[fk]).toLowerCase().includes(phrase)) return true;
            }
          }
        }
        continue;
      }
      if (f === 'recommendations') {
        const recs = record.recommendations;
        if (Array.isArray(recs)) {
          for (const rec of recs) {
            if (typeof rec === 'object') {
              if (rec.recommendation && String(rec.recommendation).toLowerCase().includes(phrase)) return true;
            } else if (String(rec).toLowerCase().includes(phrase)) return true;
          }
        }
        continue;
      }
      if (f === 'results') {
        const rows = flattenObject(record.results);
        for (const row of rows) {
          if (row.label.toLowerCase().includes(phrase) || phrase.includes(row.label.toLowerCase())) return true;
          if (String(row.value).toLowerCase().includes(phrase)) return true;
        }
        continue;
      }
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
      const rt = `Radiology Finding ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const sid of Object.keys(SECTION_FIELDS)) {
        if (shouldShowSection(record, sid)) return true;
      }
      return false;
    });
  }, [records, searchTerm, shouldShowSection]);

  /* ======= PDF DATA ======= */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fieldPath = m[1];
          if (fieldPath.includes('.')) {
            const parts = fieldPath.split('.');
            // Deep set along the dot-path, cloning each level (handles results.* nested keys)
            let cursor = merged;
            for (let pi = 0; pi < parts.length - 1; pi++) {
              const p = parts[pi];
              const existing = (cursor[p] && typeof cursor[p] === 'object') ? cursor[p] : {};
              cursor[p] = Array.isArray(existing) ? [...existing] : { ...existing };
              cursor = cursor[p];
            }
            cursor[parts[parts.length - 1]] = localEdits[key];
          } else {
            merged[fieldPath] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ======= EDIT HANDLERS ======= */
  // Map a fieldPart (editKey without "-<idx>") to the section id it belongs to, so re-editing an
  // approved section drops its approved flag (button returns to yellow Pending Approve).
  const sectionForFieldPart = useCallback((fieldPart) => {
    const base = fieldPart.split('.')[0];
    for (const [sid, fields] of Object.entries(SECTION_FIELDS)) {
      if (fields.includes(base)) return sid;
    }
    return null;
  }, []);

  // Stage a DRAFT locally (NO DB write). Writes to the pending-drafts localStorage store (survives
  // refresh) + sets the markers the UI uses. The committed write happens only on Approve.
  const stageDraft = useCallback((record, fieldPart, idx, value, opts = {}) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fieldPart}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    // Mark edited for whichever renderer shows this field (field-level + sentence-level markers)
    if (opts.sentenceMarks) {
      setEditedSentences(prev => ({ ...prev, ...opts.sentenceMarks }));
    } else {
      setEditedFields(prev => ({ ...prev, [opts.editTrackingKey || editKey]: 'edited' }));
    }
    // Re-edit after approval -> drop the section's approved flag so the button goes back to yellow
    const sid = sectionForFieldPart(fieldPart);
    if (sid) {
      setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    }
    // Persist the draft so a Save survives refresh (stored under the record id, keyed by fieldPart)
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId, sectionForFieldPart]);

  // Save = stage a DRAFT locally only (NOT written to MongoDB until the user clicks Approve).
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    stageDraft(record, fn, idx, saveVal, { editTrackingKey });
  }, [editValue, safeId, stageDraft]);

  // Save one sentence: rebuild the full text, then stage a DRAFT locally (no DB write; Approve commits).
  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    setSaveError(null);
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageDraft(record, fn, idx, fullText, { sentenceMarks: { [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' } });
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
    stageDraft(record, fn, idx, fullText, { sentenceMarks: marks });
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
    const suffix = `-${idx}`;
    // Pending editKeys for this record whose base field belongs to this section
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fieldPart = k.slice(0, -suffix.length); // "field" | "a.b" | "findings.0.size" | "recommendations.2"
      const base = fieldPart.split('.')[0];
      return fields.includes(base);
    });
    try {
      // Persist each staged field to the DB now. arrayIndex ONLY when the LAST dot-segment is numeric.
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const lastSeg = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { field: fieldPart, value: localEdits[editKey] };
        if (lastDot !== -1 && /^\d+$/.test(lastSeg)) {
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(lastSeg, 10);
        }
        const resp = await secureApiClient.put(`/api/edit/radiology_findings/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/radiology_findings/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending -> committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed)
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

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      if (f === 'findings') {
        const findings = record.findings;
        if (Array.isArray(findings) && findings.length > 0) {
          findings.forEach((finding, fIdx) => {
            text += `${finding.finding || `Finding ${fIdx + 1}`}\n`;
            if (finding.anatomicLocation) text += `  Anatomic Location: ${finding.anatomicLocation}\n`;
            if (finding.size) text += `  Size: ${finding.size}\n`;
            if (finding.characteristics) text += `  Characteristics: ${finding.characteristics}\n`;
            if (finding.significance) text += `  Significance: ${finding.significance}\n`;
            text += '\n';
          });
        }
        return;
      }
      if (f === 'results') {
        const rows = flattenObject(record.results);
        if (rows.length > 0) {
          rows.forEach(row => { text += `${row.label}\n${row.value}\n\n`; });
        }
        return;
      }
      if (f === 'recommendations') {
        const recs = record.recommendations;
        if (Array.isArray(recs) && recs.length > 0) {
          recs.forEach((rec, rIdx) => {
            if (typeof rec === 'object') {
              if (rec.date) text += `  ${formatDate(rec.date)}\n`;
              text += `  ${rIdx + 1}. ${rec.recommendation || 'N/A'}\n`;
            } else {
              text += `  ${rIdx + 1}. ${rec}\n`;
            }
          });
          text += '\n';
        }
        return;
      }
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        text += `${label}\n${formatDate(val)}\n\n`;
      } else if (BOOLEAN_FIELDS.includes(f)) {
        text += `${label}: ${val ? 'Yes' : 'No'}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val : [val];
        text += `${label}\n${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}\n\n`;
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
    let text = '=== RADIOLOGY FINDINGS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Radiology Finding ${idx + 1}\n${'='.repeat(40)}\n\n`;
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

  /* ======= RENDER: BOOLEAN FIELD -- select Yes/No, convert to boolean on save ======= */
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

  /* ======= RENDER: ARRAY FIELD (per-item editing with dot-path keys) ======= */
  const renderArrayField = (record, fn, idx, sid) => {
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
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setSaveError(null); stageDraft(record, `${fn}.${itemIdx}`, idx, editValue, { editTrackingKey: editKey }); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ======= RENDER: STRING FIELD with splitBySentence ======= */
  const renderStringField = (record, fn, idx, sid, title) => {
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setSaveError(null); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; stageDraft(record, fn, idx, fullText2, { sentenceMarks: marks }); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setSaveError(null); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; stageDraft(record, fn, idx, fullText, { sentenceMarks: marks }); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ======= RENDER: FINDINGS SECTION (array of objects) ======= */
  const renderFindingsSection = (record, idx, sid) => {
    const findings = record.findings;
    if (!Array.isArray(findings) || findings.length === 0) return null;
    if (!shouldShowSection(record, sid)) return null;

    const phrase = searchTerm.toLowerCase().trim();
    const copyId = `${sid}-${idx}`;

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Imaging Findings')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {findings.map((finding, fIdx) => {
            if (!finding) return null;
            // Filter by search
            if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(sid)) {
              const findingText = [finding.anatomicLocation, finding.finding, finding.size, finding.characteristics, finding.significance].filter(Boolean).join(' ').toLowerCase();
              if (!findingText.includes(phrase) && !['imaging findings', 'finding', 'anatomic location', 'size', 'characteristics', 'significance'].some(l => l.includes(phrase) || phrase.includes(l))) return null;
            }

            const findingFields = [
              { key: 'findings.anatomicLocation', subKey: 'anatomicLocation', label: 'Anatomic Location' },
              { key: 'findings.finding', subKey: 'finding', label: 'Finding' },
              { key: 'findings.size', subKey: 'size', label: 'Size' },
              { key: 'findings.characteristics', subKey: 'characteristics', label: 'Characteristics' },
              { key: 'findings.significance', subKey: 'significance', label: 'Significance' },
            ];

            return (
              <div key={fIdx} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(finding.finding || `Finding ${fIdx + 1}`)}</div>
                {findingFields.map(ff => {
                  const val = finding[ff.subKey];
                  if (!hasVal(val)) return null;
                  const editKey = `findings.${fIdx}.${ff.subKey}-${idx}`;
                  const isEditing = editingField === editKey;
                  const isModified = editedFields[editKey];

                  if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(sid)) {
                    const fieldLabel = ff.label.toLowerCase();
                    if (!String(val).toLowerCase().includes(phrase) && !fieldLabel.includes(phrase) && !phrase.includes(fieldLabel)) return null;
                  }

                  return (
                    <div key={ff.subKey}>
                      <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(val)); setSaveError(null); } }}>
                        {isEditing ? (
                          <div className="edit-field-container">
                            <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                            {saveError && <div className="save-error">{saveError}</div>}
                            <div className="edit-actions">
                              <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; setSaveError(null); stageDraft(record, `findings.${fIdx}.${ff.subKey}`, idx, editValue, { editTrackingKey: editKey }); }}>{saving ? 'Saving...' : 'Save'}</button>
                              <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="row-content">
                              <span className="content-value"><strong style={{ color: '#93c5fd', fontSize: '14px' }}>{highlightText(ff.label)}: </strong>{highlightText(String(val))}</span>
                              <span className="edit-indicator">&#9998;</span>
                            </div>
                            <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${ff.label}: ${val}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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
      </div>
    );
  };

  /* ======= RENDER: RECOMMENDATIONS SECTION (array of objects) ======= */
  const renderRecommendationsSection = (record, idx, sid) => {
    const recs = record.recommendations;
    if (!Array.isArray(recs) || recs.length === 0) return null;
    if (!shouldShowSection(record, sid)) return null;

    const phrase = searchTerm.toLowerCase().trim();
    const copyId = `${sid}-${idx}`;

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Recommendations')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {recs.map((rec, rIdx) => {
            if (!rec) return null;
            const recText = typeof rec === 'object' ? (rec.recommendation || '') : String(rec);
            const recDate = typeof rec === 'object' ? rec.date : null;

            if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(sid)) {
              const fullRecText = `${recText} ${recDate ? formatDate(recDate) : ''}`.toLowerCase();
              if (!fullRecText.includes(phrase) && !['recommendations', 'recommendation'].some(l => l.includes(phrase) || phrase.includes(l))) return null;
            }

            const editKeyRec = `recommendations.${rIdx}.recommendation-${idx}`;
            const isEditingRec = editingField === editKeyRec;
            const isModifiedRec = editedFields[editKeyRec];

            return (
              <div key={rIdx} className="rec-mini-card">
                {recDate && <div style={{ fontSize: '14px', color: '#60a5fa', marginBottom: '4px' }}>{highlightText(formatDate(recDate))}</div>}
                <div className={`numbered-row ${isModifiedRec ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditingRec) { setEditingField(editKeyRec); setEditValue(recText); setSaveError(null); } }}>
                  {isEditingRec ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; setSaveError(null); stageDraft(record, `recommendations.${rIdx}.recommendation`, idx, editValue, { editTrackingKey: editKeyRec }); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(recText)}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[editKeyRec] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${recDate ? formatDate(recDate) + '\n' : ''}${recText}`, editKeyRec); }}>{copiedItems[editKeyRec] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {isModifiedRec && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ======= RENDER: RESULTS SECTION (dynamic-key object, nested, typed leaves, dot-path save) ======= */
  const renderResultsSection = (record, idx, sid) => {
    const baseResults = getFieldValue(record, 'results', idx);
    // Overlay any saved nested results.* edits so they render immediately (deep clone + set)
    let resultsObj = (baseResults && typeof baseResults === 'object') ? JSON.parse(JSON.stringify(baseResults)) : {};
    Object.keys(localEdits).forEach(key => {
      const m = key.match(/^results\.(.+)-(\d+)$/);
      if (!m || parseInt(m[2], 10) !== idx) return;
      const parts = m[1].split('.');
      let cursor = resultsObj;
      for (let pi = 0; pi < parts.length - 1; pi++) {
        const p = parts[pi];
        if (!cursor[p] || typeof cursor[p] !== 'object') cursor[p] = {};
        cursor = cursor[p];
      }
      cursor[parts[parts.length - 1]] = localEdits[key];
    });
    const rows = flattenObject(resultsObj);
    if (rows.length === 0) return null;
    if (!shouldShowSection(record, sid)) return null;

    const phrase = searchTerm.toLowerCase().trim();
    const copyId = `${sid}-${idx}`;

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Results')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {rows.map((row) => {
            const fieldPath = `results.${row.path}`;
            const editKey = `${fieldPath}-${idx}`;
            const isEditing = editingField === editKey;
            const isModified = editedFields[editKey];
            const rawVal = (() => { const parts = row.path.split('.'); let v = resultsObj; for (const p of parts) { v = v?.[p]; } return v; })();
            const isNum = typeof rawVal === 'number';
            const isBool = typeof rawVal === 'boolean';
            // Joined array-of-primitives leaf: read-only to avoid array->string corruption on save
            const isArrayLeaf = Array.isArray(rawVal);

            if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(sid)) {
              const ll = row.label.toLowerCase();
              if (!ll.includes(phrase) && !phrase.includes(ll) && !String(row.value).toLowerCase().includes(phrase)) return null;
            }

            const doSave = (saveVal) => {
              const id2 = safeId(record); if (!id2) return;
              setSaveError(null);
              // Stage a DRAFT locally (no DB write). fieldPath = "results.<path>"; committed on Approve.
              stageDraft(record, fieldPath, idx, saveVal, { editTrackingKey: editKey });
            };

            if (isArrayLeaf) {
              return (
                <div key={row.path} className="rec-mini-card">
                  <div className="nested-subtitle">{highlightText(row.label)}</div>
                  <div className="numbered-row">
                    <div className="row-content"><span className="content-value">{highlightText(String(row.value))}</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${row.label}\n${row.value}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                  </div>
                </div>
              );
            }

            return (
              <div key={row.path} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(row.label)}</div>
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(isBool ? (rawVal ? 'Yes' : 'No') : String(rawVal ?? row.value)); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      {isBool ? (
                        <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      ) : isNum ? (
                        <input type="number" step="any" className="edit-input" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      ) : (
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      )}
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isBool) { doSave(editValue === 'Yes'); } else if (isNum) { const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } doSave(n); } else { doSave(editValue); } }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(String(row.value))}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${row.label}\n${row.value}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ======= RENDER: GENERIC SECTION ======= */
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
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ======= MAIN RENDER ======= */
  if (!records || records.length === 0) {
    return (
      <div className="radiology-findings-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Radiology Findings</h2></div>
        <div className="empty-state">No radiology findings records available</div>
      </div>
    );
  }

  return (
    <div className="radiology-findings-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Radiology Findings</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<RadiologyFindingsDocumentPDFTemplate document={pdfData} />} fileName={`radiology-findings-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search radiology findings..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              {hasVal(record.date) && (
                <div className="record-meta-row">
                  <span className="record-date">{formatDate(record.date)}</span>
                </div>
              )}
              <h3 className="record-name">{highlightText(record.modalityUsed || `Radiology Finding ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'study-information')}
            {renderSection(record, idx, 'technique')}
            {renderSection(record, idx, 'contrast-information')}
            {renderFindingsSection(record, idx, 'imaging-findings')}
            {renderSection(record, idx, 'comparison')}
            {renderSection(record, idx, 'impression')}
            {renderSection(record, idx, 'rads-scores')}
            {renderResultsSection(record, idx, 'results')}
            {renderRecommendationsSection(record, idx, 'recommendations')}
            {renderSection(record, idx, 'clinical-summary')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RadiologyFindingsDocument;
