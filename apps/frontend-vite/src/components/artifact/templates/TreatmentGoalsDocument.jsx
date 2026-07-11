/**
 * TreatmentGoalsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: treatment_goals
 *
 * 8 Sections:
 *   1. general-info: date, type, provider, facility, status
 *   2. immediate-goals: immediateGoals[] (goal, timeframe, measurable)
 *   3. short-term-goals: shortTermGoals[] (goal, timeframe, measurable)
 *   4. long-term-goals: longTermGoals[] (goal, timeframe, measurable)
 *   5. patient-goals: patientGoals[]
 *   6. family-goals: familyGoals[]
 *   7. clinical-notes: assessment, plan, findings, notes
 *   8. recommendations: recommendations[]
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import TreatmentGoalsDocumentPDFTemplate from '../pdf-templates/TreatmentGoalsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './TreatmentGoalsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: putValue } }
   fieldPart is the exact DB write target: "field", "field.arrayIndex" (numeric tail = array elem),
   or "field.path" (dotted object/goal sub-path; non-numeric tail). value is the per-write payload value. */
const DRAFT_KEY = 'treatment_goalsPendingEdits';
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
  'general-info': 'General Information',
  'immediate-goals': 'Immediate Goals',
  'short-term-goals': 'Short Term Goals',
  'long-term-goals': 'Long Term Goals',
  'patient-goals': 'Patient Goals',
  'family-goals': 'Family Goals',
  'clinical-notes': 'Clinical Notes',
  'recommendations': 'Recommendations',
  'results': 'Results',
};

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  immediateGoals: 'Immediate Goals',
  shortTermGoals: 'Short Term Goals',
  longTermGoals: 'Long Term Goals',
  patientGoals: 'Patient Goals',
  familyGoals: 'Family Goals',
  assessment: 'Assessment',
  plan: 'Plan',
  findings: 'Findings',
  notes: 'Notes',
  recommendations: 'Recommendations',
  results: 'Results',
};

const SECTION_FIELDS = {
  'general-info': ['date', 'type', 'provider', 'facility', 'status'],
  'immediate-goals': ['immediateGoals'],
  'short-term-goals': ['shortTermGoals'],
  'long-term-goals': ['longTermGoals'],
  'patient-goals': ['patientGoals'],
  'family-goals': ['familyGoals'],
  'clinical-notes': ['assessment', 'plan', 'findings', 'notes'],
  'recommendations': ['recommendations'],
  'results': ['results'],
};

const DATE_FIELDS = ['date'];
const BOOLEAN_FIELDS = [];
const NUMBER_FIELDS = [];
const ARRAY_FIELDS = ['patientGoals', 'familyGoals', 'recommendations'];
const OBJECT_FIELDS = ['results'];
const GOAL_ARRAY_FIELDS = ['immediateGoals', 'shortTermGoals', 'longTermGoals'];
const STRING_FIELDS = ['type', 'provider', 'facility', 'status', 'assessment', 'plan', 'findings', 'notes'];

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

/* humanizeKey: dynamic DB key -> readable label */
const humanizeKey = (key) => {
  if (!key) return '';
  return String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, c => c.toUpperCase());
};

/* flattenObject: dynamic-key object (incl. nested) -> [{label, value, path}] with typed leaves */
const flattenObject = (obj, prefixLabel = '', prefixPath = '') => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const items = [];
  Object.entries(obj).forEach(([key, value]) => {
    const label = prefixLabel ? `${prefixLabel} - ${humanizeKey(key)}` : humanizeKey(key);
    const path = prefixPath ? `${prefixPath}.${key}` : key;
    if (value === null || value === undefined || value === '') return;
    if (typeof value === 'boolean') {
      items.push({ label, value: value ? 'Yes' : 'No', path, raw: value });
    } else if (typeof value === 'number') {
      items.push({ label, value: String(value), path, raw: value });
    } else if (Array.isArray(value)) {
      const flat = value.filter(v => v !== null && v !== undefined && v !== '').map(v => (typeof v === 'object' ? flattenObject(v, label).map(x => `${x.label}: ${x.value}`).join('; ') : String(v)));
      if (flat.length) items.push({ label, value: flat.join(', '), path, raw: value });
    } else if (typeof value === 'object') {
      if (value.$date) { items.push({ label, value: String(value.$date), path, raw: value }); return; }
      if (Object.keys(value).length === 0) return;
      items.push(...flattenObject(value, label, path));
    } else {
      items.push({ label, value: String(value), path, raw: value });
    }
  });
  return items;
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
const TreatmentGoalsDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // draft keys (fieldPart-idx) staged locally, NOT yet committed to DB/PDF. Cleared on Approve.
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
      if (r?.treatment_goals) return Array.isArray(r.treatment_goals) ? r.treatment_goals : [r.treatment_goals];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.treatment_goals) return Array.isArray(dd.treatment_goals) ? dd.treatment_goals : [dd.treatment_goals]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const recId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    // Set the per-fieldPart drafted value into a (possibly array/object) base, returning the merged base.
    const applyDraftToBase = (base, fieldPart, value) => {
      const dotIdx = fieldPart.indexOf('.');
      if (dotIdx === -1) return value; // whole-field replacement (string/date/sentence text)
      const subPath = fieldPart.slice(dotIdx + 1);
      const lastSeg = subPath.slice(subPath.lastIndexOf('.') + 1);
      if (/^\d+$/.test(lastSeg) && subPath.indexOf('.') === -1) {
        // array element: field.<num>
        const arr = Array.isArray(base) ? [...base] : [];
        arr[parseInt(lastSeg, 10)] = value;
        return arr;
      }
      // dotted object/goal sub-path: clone base object/array and set deep path
      const segs = subPath.split('.');
      const root = (base && typeof base === 'object') ? JSON.parse(JSON.stringify(base)) : (/^\d+$/.test(segs[0]) ? [] : {});
      let cursor = root;
      for (let p = 0; p < segs.length - 1; p++) {
        const key = /^\d+$/.test(segs[p]) ? parseInt(segs[p], 10) : segs[p];
        if (typeof cursor[key] !== 'object' || cursor[key] === null) cursor[key] = /^\d+$/.test(segs[p + 1]) ? [] : {};
        cursor = cursor[key];
      }
      const lastKey = /^\d+$/.test(segs[segs.length - 1]) ? parseInt(segs[segs.length - 1], 10) : segs[segs.length - 1];
      cursor[lastKey] = value;
      return root;
    };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = recId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const baseField = fieldPart.indexOf('.') === -1 ? fieldPart : fieldPart.slice(0, fieldPart.indexOf('.'));
        const localKey = `${baseField}-${idx}`;
        const base = nLocal[localKey] !== undefined ? nLocal[localKey] : record[baseField];
        nLocal[localKey] = applyDraftToBase(base, fieldPart, value);
        nPending[`${fieldPart}-${idx}`] = true;
        // edited markers — mirror save handlers' tracking keys
        if (fieldPart.indexOf('.') === -1) {
          nFields[`${fieldPart}-${idx}`] = 'edited';
          nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
        } else {
          nFields[`${fieldPart}-${idx}`] = 'edited';
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
        if (Array.isArray(val)) {
          if (val.some(item => {
            if (typeof item === 'string') return item.toLowerCase().includes(phrase);
            if (typeof item === 'object' && item !== null) return [item.goal, item.timeframe, item.measurable].filter(Boolean).some(v => String(v).toLowerCase().includes(phrase));
            return String(item).toLowerCase().includes(phrase);
          })) return true;
        }
        else if (typeof val === 'object') {
          if (flattenObject(val).some(it => `${it.label} ${it.value}`.toLowerCase().includes(phrase))) return true;
        }
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
      if (Array.isArray(val)) return val.some(item => {
        if (typeof item === 'string') return item.toLowerCase().includes(phrase);
        if (typeof item === 'object' && item !== null) return [item.goal, item.timeframe, item.measurable].filter(Boolean).some(v => String(v).toLowerCase().includes(phrase));
        return String(item).toLowerCase().includes(phrase);
      });
      if (typeof val === 'object') return flattenObject(val).some(it => `${it.label} ${it.value}`.toLowerCase().includes(phrase));
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Treatment Goals ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && (Array.isArray(val) ? val.some(item => {
            if (typeof item === 'string') return item.toLowerCase().includes(phrase);
            if (typeof item === 'object' && item !== null) return [item.goal, item.timeframe, item.measurable].filter(Boolean).some(v => String(v).toLowerCase().includes(phrase));
            return String(item).toLowerCase().includes(phrase);
          }) : (typeof val === 'object' ? flattenObject(val).some(it => `${it.label} ${it.value}`.toLowerCase().includes(phrase)) : fmtVal(val).toLowerCase().includes(phrase)))) return true;
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
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fn = m[1];
          // pending drafts stay OUT of the PDF/Copy All until approved — skip if any draft targets this field
          const hasPending = Object.keys(pendingEdits).some(pk => {
            const pm = pk.match(/^(.+)-(\d+)$/);
            if (!pm || parseInt(pm[2]) !== idx) return false;
            const pBase = pm[1].indexOf('.') === -1 ? pm[1] : pm[1].slice(0, pm[1].indexOf('.'));
            return pBase === fn;
          });
          if (hasPending) return;
          merged[fn] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Persist one staged draft into the localStorage store (survives refresh; NOT DB/PDF until Approve)
  // and flag it pending. fieldPart = exact DB write target ("field", "field.arrayIndex", "field.path").
  // Also drops the section's approved flag so re-edit returns the button to yellow Pending Approve.
  const stageDraft = useCallback((record, idx, fieldPart) => {
    const id = safeId(record); if (!id) return;
    const baseField = fieldPart.indexOf('.') === -1 ? fieldPart : fieldPart.slice(0, fieldPart.indexOf('.'));
    setPendingEdits(prev => ({ ...prev, [`${fieldPart}-${idx}`]: true }));
    setApprovedSections(prev => {
      const sid = Object.keys(SECTION_FIELDS).find(s => (SECTION_FIELDS[s] || []).includes(baseField));
      const key = sid ? `${sid}-${idx}` : null;
      if (!key || !prev[key]) return prev;
      const next = { ...prev }; delete next[key]; return next;
    });
    return id;
  }, [safeId]);

  // Write the per-field draft value into localStorage. value = the exact payload value the DB PUT uses.
  const writeFieldDraft = useCallback((id, fieldPart, value) => {
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = value;
    writeDrafts(store);
  }, []);

  // Save = stage a DRAFT locally (no DB write). Approve commits it.
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: saveVal }));
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    stageDraft(record, idx, fn);
    writeFieldDraft(id, fn, saveVal);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId, stageDraft, writeFieldDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      // Stage a DRAFT (no DB write). Approve commits.
      setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      stageDraft(record, idx, fn);
      writeFieldDraft(id, fn, fullText);
      setEditingField(null); setEditValue(''); setSaveError(null);
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    // Stage a DRAFT (no DB write). Approve commits.
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    stageDraft(record, idx, fn);
    writeFieldDraft(id, fn, fullText);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so committed values
  // flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    const suffix = `-${idx}`;
    // Pending draft keys for this record+section: "<fieldPart>-<idx>" where base field is in this section.
    const pendingFieldParts = Object.keys(pendingEdits)
      .filter(k => pendingEdits[k] && k.endsWith(suffix))
      .map(k => k.slice(0, -suffix.length))
      .filter(fp => fields.includes(fp.indexOf('.') === -1 ? fp : fp.slice(0, fp.indexOf('.'))));
    const store = readDrafts();
    const recDrafts = store[id] || {};
    setSaving(true); setSaveError(null);
    try {
      for (const fieldPart of pendingFieldParts) {
        const value = recDrafts[fieldPart];
        // Reverse handleSaveField's fieldPart convention: arrayIndex ONLY when the LAST dot-segment is numeric.
        const lastDot = fieldPart.lastIndexOf('.');
        const lastSeg = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        let payload;
        if (lastDot !== -1 && /^\d+$/.test(lastSeg)) {
          payload = { field: fieldPart.slice(0, lastDot), value, arrayIndex: parseInt(lastSeg, 10) };
        } else {
          payload = { field: fieldPart, value };
        }
        const resp = await secureApiClient.put(`/api/edit/treatment_goals/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/treatment_goals/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; pendingFieldParts.forEach(fp => delete n[`${fp}${suffix}`]); return n; });
      // Drop this section's committed drafts from localStorage
      pendingFieldParts.forEach(fp => { delete recDrafts[fp]; });
      if (Object.keys(recDrafts).length === 0) delete store[id]; else store[id] = recDrafts;
      writeDrafts(store);
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); setSaveError('Save failed. Please try again.'); }
    finally { setSaving(false); }
  }, [safeId, pendingEdits]);

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

  const buildGoalsCopyText = useCallback((title, goals) => {
    if (!goals || !Array.isArray(goals) || goals.length === 0) return '';
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    goals.forEach((goal, gIdx) => {
      const goalText = typeof goal === 'string' ? goal : goal.goal;
      text += `Goal ${gIdx + 1}: ${goalText}\n`;
      if (typeof goal === 'object') {
        if (goal.timeframe) text += `  Timeframe: ${goal.timeframe}\n`;
        if (goal.measurable) text += `  Measurable: ${goal.measurable}\n`;
      }
      text += '\n';
    });
    return text;
  }, []);

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
      } else if (GOAL_ARRAY_FIELDS.includes(f)) {
        text += buildGoalsCopyText(label, val);
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val : [val];
        text += `${label}\n${items.map((item, i) => `${i + 1}. ${typeof item === 'string' ? item : item.recommendation || String(item)}`).join('\n')}\n\n`;
      } else if (OBJECT_FIELDS.includes(f)) {
        const objItems = flattenObject(val);
        if (objItems.length > 0) text += `${label}\n${objItems.map((it, i) => `${i + 1}. ${it.label}: ${it.value}`).join('\n')}\n\n`;
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
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, formatSentenceFieldLines, buildGoalsCopyText]);

  const copyAllText = useCallback(async () => {
    let text = '=== TREATMENT GOALS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Treatment Goals ${idx + 1}\n${'='.repeat(40)}\n\n`;
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

  /* ═══════ RENDER: ARRAY FIELD (per-item editing with dot-path keys) ═══════ */
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
          const itemStr = typeof item === 'string' ? item : (item.recommendation || String(item));
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];

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
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = editValue; setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: currentArr })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); stageDraft(record, idx, `${fn}.${itemIdx}`); writeFieldDraft(id, `${fn}.${itemIdx}`, editValue); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: GOAL ARRAY FIELD (immediateGoals, shortTermGoals, longTermGoals) ═══════ */
  const renderGoalArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const goals = Array.isArray(val) ? val.filter(Boolean) : [];
    if (goals.length === 0) return null;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return goals.map((goal, gIdx) => {
      const goalText = typeof goal === 'string' ? goal : (goal.goal || '');
      const timeframe = typeof goal === 'object' ? goal.timeframe : null;
      const measurable = typeof goal === 'object' ? goal.measurable : null;

      // Sub-field edit keys
      const goalEditKey = `${fn}.${gIdx}.goal-${idx}`;
      const tfEditKey = `${fn}.${gIdx}.timeframe-${idx}`;
      const msEditKey = `${fn}.${gIdx}.measurable-${idx}`;
      const goalEditing = editingField === goalEditKey;
      const tfEditing = editingField === tfEditKey;
      const msEditing = editingField === msEditKey;
      const goalModified = editedFields[goalEditKey];
      const tfModified = editedFields[tfEditKey];
      const msModified = editedFields[msEditKey];

      // Search filtering at goal level
      if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
        const phrase = searchTerm.toLowerCase().trim();
        const goalMatches = goalText.toLowerCase().includes(phrase);
        const tfMatches = timeframe && timeframe.toLowerCase().includes(phrase);
        const msMatches = measurable && measurable.toLowerCase().includes(phrase);
        const labelMatches = 'goal'.includes(phrase) || 'timeframe'.includes(phrase) || 'measurable'.includes(phrase);
        if (!goalMatches && !tfMatches && !msMatches && !labelMatches) return null;
      }

      const saveGoalSubField = (subField, subIdx, newVal) => {
        const id = safeId(record); if (!id) return;
        const fullField = `${fn}.${gIdx}.${subField}`;
        // Stage a DRAFT (no DB write). Approve commits via PUT { field: fullField, value }.
        const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])];
        const updatedGoal = { ...(typeof currentArr[gIdx] === 'object' ? currentArr[gIdx] : { goal: currentArr[gIdx] }) };
        updatedGoal[subField] = newVal;
        currentArr[gIdx] = updatedGoal;
        setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: currentArr }));
        setEditedFields(prev => ({ ...prev, [`${fn}.${gIdx}.${subField}-${idx}`]: 'edited' }));
        stageDraft(record, idx, fullField);
        writeFieldDraft(id, fullField, newVal);
        setEditingField(null); setEditValue(''); setSaveError(null);
      };

      return (
        <div key={gIdx} className="rec-mini-card" style={{ marginBottom: 8 }}>
          <div className="nested-subtitle">{highlightText(`Goal ${gIdx + 1}`)}</div>

          {/* Goal text */}
          <div className={`numbered-row ${goalModified ? 'modified' : ''} editable-row`} onClick={() => { if (!goalEditing) { setEditingField(goalEditKey); setEditValue(goalText); setSaveError(null); } }}>
            {goalEditing ? (
              <div className="edit-field-container">
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveGoalSubField('goal', gIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="row-content"><span className="content-value">{highlightText(goalText)}</span><span className="edit-indicator">&#9998;</span></div>
                <button className={`copy-btn ${copiedItems[goalEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(goalText, goalEditKey); }}>{copiedItems[goalEditKey] ? 'Copied!' : 'Copy'}</button>
              </>
            )}
          </div>
          {goalModified && <span className="modified-badge">edited - click Pending Approve to save</span>}

          {/* Timeframe */}
          {timeframe && (
            <>
              <div className="goal-sub-label">{highlightText('Timeframe')}</div>
              <div className={`numbered-row ${tfModified ? 'modified' : ''} editable-row`} onClick={() => { if (!tfEditing) { setEditingField(tfEditKey); setEditValue(timeframe); setSaveError(null); } }}>
                {tfEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveGoalSubField('timeframe', gIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(timeframe)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[tfEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(timeframe, tfEditKey); }}>{copiedItems[tfEditKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {tfModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </>
          )}

          {/* Measurable */}
          {measurable && (
            <>
              <div className="goal-sub-label">{highlightText('Measurable')}</div>
              <div className={`numbered-row ${msModified ? 'modified' : ''} editable-row`} onClick={() => { if (!msEditing) { setEditingField(msEditKey); setEditValue(measurable); setSaveError(null); } }}>
                {msEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveGoalSubField('measurable', gIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(measurable)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[msEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(measurable, msEditKey); }}>{copiedItems[msEditKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {msModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </>
          )}
        </div>
      );
    });
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText2 })); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); stageDraft(record, idx, fn); writeFieldDraft(id2, fn, fullText2); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); const idL = safeId(record); if (!idL) return; setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText })); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); stageDraft(record, idx, fn); writeFieldDraft(idL, fn, fullText); setEditingField(null); setEditValue(''); setSaveError(null); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: OBJECT FIELD (dynamic-key object, humanized keys + typed leaves, dot-path save) ═══════ */
  const renderObjectField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val) || typeof val !== 'object' || Array.isArray(val)) return null;
    const items = flattenObject(val);
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {items.map((item) => {
          const editKey = `${fn}.${item.path}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const isNum = typeof item.raw === 'number';
          const isBool = typeof item.raw === 'boolean';

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            if (!item.label.toLowerCase().includes(phrase) && !String(item.value).toLowerCase().includes(phrase) && !phrase.includes('results')) return null;
          }

          const saveLeaf = (newVal) => {
            const id = safeId(record); if (!id) return;
            // Stage a DRAFT (no DB write). Approve commits via PUT { field: `${fn}.${item.path}`, value }.
            const currentObj = JSON.parse(JSON.stringify(typeof getFieldValue(record, fn, idx) === 'object' ? getFieldValue(record, fn, idx) : {}));
            const parts = item.path.split('.');
            let cursor = currentObj;
            for (let p = 0; p < parts.length - 1; p++) { if (typeof cursor[parts[p]] !== 'object' || cursor[parts[p]] === null) cursor[parts[p]] = {}; cursor = cursor[parts[p]]; }
            cursor[parts[parts.length - 1]] = newVal;
            setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: currentObj }));
            setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
            stageDraft(record, idx, `${fn}.${item.path}`);
            writeFieldDraft(id, `${fn}.${item.path}`, newVal);
            setEditingField(null); setEditValue(''); setSaveError(null);
          };

          return (
            <div key={item.path}>
              <div className="goal-sub-label">{highlightText(item.label)}</div>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(isBool ? (item.raw ? 'true' : 'false') : String(item.raw)); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    {isBool ? (
                      <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : isNum ? (
                      <input type="number" className="edit-input" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    ) : (
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    )}
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNum) { const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } saveLeaf(n); } else if (isBool) { saveLeaf(editValue === 'true'); } else { saveLeaf(editValue); } }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(item.value)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${item.label}: ${item.value}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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
            if (GOAL_ARRAY_FIELDS.includes(f)) return renderGoalArrayField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="treatment-goals-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Treatment Goals</h2></div>
        <div className="empty-state">No treatment goals records available</div>
      </div>
    );
  }

  return (
    <div className="treatment-goals-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Treatment Goals</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<TreatmentGoalsDocumentPDFTemplate document={pdfData} />} fileName={`treatment-goals-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search treatment goals..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
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
              <h3 className="record-name">{highlightText(record.type || `Treatment Goals ${idx + 1}`)}</h3>
              {hasVal(record.provider) && <span className="record-provider">{highlightText(record.provider)}</span>}
            </div>
            {renderSection(record, idx, 'general-info')}
            {renderSection(record, idx, 'immediate-goals')}
            {renderSection(record, idx, 'short-term-goals')}
            {renderSection(record, idx, 'long-term-goals')}
            {renderSection(record, idx, 'patient-goals')}
            {renderSection(record, idx, 'family-goals')}
            {renderSection(record, idx, 'clinical-notes')}
            {renderSection(record, idx, 'recommendations')}
            {renderSection(record, idx, 'results')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TreatmentGoalsDocument;
