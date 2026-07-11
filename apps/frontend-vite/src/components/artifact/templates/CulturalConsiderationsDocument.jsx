/**
 * CulturalConsiderationsDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: cultural_considerations
 * FULL TEMPLATE STANDARD: 14 non-system fields, 100% coverage.
 *  - DATE: date (date-picker)
 *  - ARRAYS: dietaryPreferences, supportStrategies, culturalResources, recommendations
 *  - OBJECT: results (recursive renderObjectLeaf/renderObjectNode — donor POCUS)
 *  - PER-SENTENCE narratives: familyDynamics, findings, assessment, plan, notes
 *  - SIMPLE strings: provider, facility, status
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import CulturalConsiderationsDocumentPDFTemplate from '../pdf-templates/CulturalConsiderationsDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './CulturalConsiderationsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }
     fieldPart = "field"            → PUT { field, value }
                 "field.<arrayIdx>" → PUT { field, value, arrayIndex } (suffix is purely numeric)
                 "root.leaf.path"   → PUT { field: "root.leaf.path", value } (dotted object leaf) */
const DRAFT_KEY = 'cultural_considerationsPendingEdits';
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
  provider: 'Provider Information',
  dietary: 'Dietary Preferences',
  family: 'Family & Support',
  clinical: 'Clinical Assessment',
  results: 'Results',
  resources: 'Resources & Notes',
};

const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility', status: 'Status',
  dietaryPreferences: 'Dietary Preferences',
  familyDynamics: 'Family Dynamics', supportStrategies: 'Support Strategies',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan',
  results: 'Results', recommendations: 'Recommendations',
  culturalResources: 'Cultural Resources', notes: 'Notes',
};

const SECTION_FIELDS = {
  provider: ['date', 'provider', 'facility', 'status'],
  dietary: ['dietaryPreferences'],
  family: ['familyDynamics', 'supportStrategies'],
  clinical: ['findings', 'assessment', 'plan'],
  results: ['results'],
  resources: ['culturalResources', 'recommendations', 'notes'],
};

const SENTENCE_FIELDS = ['familyDynamics', 'findings', 'assessment', 'plan', 'notes'];
const ARRAY_FIELDS = ['dietaryPreferences', 'supportStrategies', 'culturalResources', 'recommendations'];
const OBJECT_FIELDS = ['results'];
const DATE_FIELDS = ['date'];
/* Fixed-choice fields → dropdown. Options in canonical case; enumOptionsWith keeps an unmatched
   current value so a descriptive status is never lost. fmtEnumVal maps a stored value (any case)
   to its canonical option for DISPLAY in all 4 areas (stored value unchanged unless edited). */
const ENUM_FIELDS = { status: ['Active', 'Not Active'] };
const enumOptionsWith = (opts, current) => { const cur = String(current ?? '').trim(); return cur && !opts.some(o => o.toLowerCase() === cur.toLowerCase()) ? [cur, ...opts] : opts; };
const fmtEnumVal = (f, v) => { const opts = ENUM_FIELDS[f]; if (opts) { const hit = opts.find(o => o.toLowerCase() === String(v ?? '').toLowerCase().trim()); if (hit) return hit; } return null; };
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

const KEY_OVERRIDES = {};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};

/* Detect "Label: value". Cap 80 (a long framework label like "Uses ... (CANE) framework" is ~59 chars),
   lazy match, and REQUIRE whitespace after the colon so ratios/times ("3:2") never false-match. */
const parseLabel = (text) => { if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' }; const m = text.match(/^([A-Za-z][A-Za-z0-9 /()&,'.-]{1,80}?):\s+(.+)$/); return m ? { isLabeled: true, label: m[1].trim(), value: m[2].trim() } : { isLabeled: false, label: '', value: text }; };

const CulturalConsiderationsDocument = ({ document: docProp }) => {
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
  const [saveError, setSaveError] = useState('');
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const containerRef = useRef(null);

  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.cultural_considerations) return Array.isArray(r.cultural_considerations) ? r.cultural_considerations : [r.cultural_considerations];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cultural_considerations) return Array.isArray(dd.cultural_considerations) ? dd.cultural_considerations : [dd.cultural_considerations]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
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
        const lastDot = fieldPart.lastIndexOf('.');
        const lastSeg = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayIdx = lastDot !== -1 && /^\d+$/.test(lastSeg);
        if (isArrayIdx) {
          // array element: localEdits key = "field-idx-arrayIndex"
          const fn = fieldPart.slice(0, lastDot);
          const arrayIndex = lastSeg;
          const editKey = `${fn}-${idx}-${arrayIndex}`;
          nLocal[editKey] = value;
          nPending[editKey] = true;
          nFields[editKey] = 'edited';
        } else if (lastDot !== -1) {
          // dotted object leaf: localEdits stores the cloned root object under "root-idx"
          const rootField = fieldPart.slice(0, fieldPart.indexOf('.'));
          const path = fieldPart.split('.').slice(1);
          const editKey = `${rootField}-${idx}`;
          const leafKey = `${rootField}-${idx}-${path.join('.')}`;
          const cur = nLocal[editKey] !== undefined ? nLocal[editKey] : record[rootField];
          const clone = JSON.parse(JSON.stringify(cur ?? {}));
          let node = clone;
          for (let i = 0; i < path.length - 1; i++) { if (node[path[i]] === undefined || node[path[i]] === null || typeof node[path[i]] !== 'object') node[path[i]] = {}; node = node[path[i]]; }
          node[path[path.length - 1]] = value;
          nLocal[editKey] = clone;
          nPending[editKey] = true;
          nFields[leafKey] = 'edited';
        } else {
          // simple/sentence field: localEdits key = "field-idx"
          const editKey = `${fieldPart}-${idx}`;
          nLocal[editKey] = value;
          nPending[editKey] = true;
          nFields[editKey] = 'edited';
          if (SENTENCE_FIELDS.includes(fieldPart)) nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    if (Object.keys(nSentences).length) setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  const hasVal = useCallback((v) => !isEmptyDeep(v), []);
  const formatDate = useCallback((d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } }, []);
  const formatDateISO = useCallback((d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return ''; return dt.toISOString().split('T')[0]; } catch { return ''; } }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); if (Array.isArray(v)) return v.join(', '); if (v && typeof v === 'object') return flattenSearchable(v); return String(v || ''); }, []);
  /* Canonical: splits on '.' AND ';' with the abbreviation+decimal guard. */
  const splitBySentence = useCallback((text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); }, []);
  /* Guarded: paren-aware; keep Oxford ", and/or X"; skip no-space commas ("$18,000") and date commas ("January 8, 2026"). */
  const splitByComma = useCallback((text) => {
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
        const t = cur.trim(); if (t) parts.push(t); cur = '';
      } else cur += ch;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts.filter(Boolean);
  }, []);
  function reconstructFullText(sentences) { if (!sentences || sentences.length === 0) return ''; return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' '); }
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getEffectiveArray = useCallback((record, fn, idx) => { const orig = record[fn] || []; const edited = []; for (let i = 0; i < orig.length; i++) { const ik = `${fn}-${idx}-${i}`; edited.push(localEdits[ik] !== undefined ? localEdits[ik] : orig[i]); } return edited; }, [localEdits]);
  // Like getEffectiveArray but EXCLUDES pending (un-approved) drafts — used by pdfData/Copy so drafts stay out.
  const getApprovedArray = useCallback((record, fn, idx) => { const orig = record[fn] || []; const edited = []; for (let i = 0; i < orig.length; i++) { const ik = `${fn}-${idx}-${i}`; edited.push((localEdits[ik] !== undefined && !pendingEdits[ik]) ? localEdits[ik] : orig[i]); } return edited; }, [localEdits, pendingEdits]);
  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);
  const highlightText = useCallback((text) => { if (!searchTerm.trim() || !text) return text; const phrase = searchTerm.trim(); const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'); const parts = String(text).split(regex); return parts.map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part); }, [searchTerm]);

  const fieldSearchText = useCallback((f, val) => {
    if (OBJECT_FIELDS.includes(f)) return flattenSearchable(val);
    if (Array.isArray(val)) return val.map(v => String(v)).join(' ');
    return fmtVal(val);
  }, [fmtVal]);

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
      if (val !== null && val !== undefined && fieldSearchText(f, val).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm, getFieldValue, fieldSearchText]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) return fieldSearchText(fn, val).toLowerCase().includes(phrase);
    return false;
  }, [searchTerm, getFieldValue, fieldSearchText]);

  const sectionTitleMatches = useCallback((sid) => { if (!searchTerm.trim()) return false; const p = searchTerm.toLowerCase().trim(); const t = (SECTION_TITLES[sid] || '').toLowerCase(); return t.includes(p) || p.includes(t); }, [searchTerm]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Cultural Considerations ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const f of Object.keys(FIELD_LABELS)) {
        const val = getFieldValue(record, f, idx);
        if (val !== null && val !== undefined && fieldSearchText(f, val).toLowerCase().includes(phrase)) return true;
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fieldSearchText]);

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return filteredRecords;
    return filteredRecords.map((r, idx) => {
      const m = { ...r };
      Object.keys(localEdits).forEach(k => { if (pendingEdits[k]) return; const mt = k.match(/^(.+)-(\d+)$/); if (mt && parseInt(mt[2]) === idx && !k.match(/^.+-\d+-\d+$/)) m[mt[1]] = localEdits[k]; });
      ARRAY_FIELDS.forEach(f => { if (Array.isArray(r[f])) m[f] = getApprovedArray(r, f, idx); });
      return m;
    });
  }, [filteredRecords, localEdits, pendingEdits, getApprovedArray]);

  // Save = stage a DRAFT locally + persist to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sectionId, sentenceIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return; setSaveError('');
    const val = valueOverride !== undefined ? valueOverride : editValue;
    if (fn === 'date') {
      if (isNaN(new Date(val).getTime())) { setSaveError('Please enter a valid date'); return; }
    }
    const saveVal = fn === 'date' ? val + 'T00:00:00.000Z' : val;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const sKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [sKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  const handleSaveArrayItem = useCallback((record, fn, idx, sectionId, arrayIndex) => {
    const id = safeId(record); if (!id) return; setSaveError('');
    const editKey = `${fn}-${idx}-${arrayIndex}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: editValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][`${fn}.${arrayIndex}`] = editValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  /* save a nested OBJECT leaf by dot-path (e.g. results.foo) — value stays a STRING */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    const dottedField = `${rootField}.${path.join('.')}`;
    setSaveError('');
    const editKey = `${rootField}-${idx}`;
    setLocalEdits(prev => {
      const cur = prev[editKey] !== undefined ? prev[editKey] : record[rootField];
      const clone = JSON.parse(JSON.stringify(cur ?? {}));
      let node = clone;
      for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
      node[path[path.length - 1]] = newVal;
      return { ...prev, [editKey]: clone };
    });
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    // Stage the leaf as a dotted-field draft (DB write deferred until Approve).
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][dottedField] = newVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId]);

  // Stage a sentence edit as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
  function stageSentenceDraft(id, fn, idx, fullText) {
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
  }

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || ''); const sentences = splitBySentence(currentVal); const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) { const updated = [...sentences]; updated.splice(sentenceIdx, 1); const fullText = reconstructFullText(updated);
      stageSentenceDraft(id, fn, idx, fullText); setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); return; }
    const newSentences = splitBySentence(editedVal); const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences); const fullText = reconstructFullText(updated);
    stageSentenceDraft(id, fn, idx, fullText); const orig = sentences[sentenceIdx] || ''; const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => { const n = { ...prev }; if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; const extra = newSentences.length - 1; for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; return n; });
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue('');
  }

  function saveCommaItem(record, fn, idx, sid, sIdx, commaIdx, newItemText) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const currentSentences = splitBySentence(currentVal);
    const sentence = currentSentences[sIdx] || '';
    const parsed = parseLabel(sentence);
    if (!parsed.isLabeled) { return; }
    const items = splitByComma(parsed.value);
    items[commaIdx] = newItemText.trim();
    const filteredItems = items.filter(p => p.trim().length > 0);
    let rebuilt;
    if (filteredItems.length > 0) { rebuilt = `${parsed.label}: ${filteredItems.join(', ')}`; }
    else { rebuilt = ''; }
    const allSentences = [...currentSentences];
    if (rebuilt) { allSentences[sIdx] = rebuilt; } else { allSentences.splice(sIdx, 1); }
    const fullText = reconstructFullText(allSentences);
    const commaKey = `${fn}-${idx}-s${sIdx}-c${commaIdx}`;
    stageSentenceDraft(id, fn, idx, fullText);
    setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue('');
  }

  const sectionHasEdits = useCallback((idx, sid) => { const fields = SECTION_FIELDS[sid] || []; return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))); }, [editedFields, editedSentences]);
  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true); setSaveError('');
    try {
      const store = readDrafts();
      const recDrafts = (store && store[id]) ? store[id] : {};
      // fieldParts belonging to THIS section (base field = up to first dot)
      const committedFieldParts = [];
      for (const [fieldPart, value] of Object.entries(recDrafts)) {
        const baseField = fieldPart.indexOf('.') === -1 ? fieldPart : fieldPart.slice(0, fieldPart.indexOf('.'));
        if (!fields.includes(baseField)) continue;
        // arrayIndex ONLY when the segment after the LAST dot is purely numeric
        const lastDot = fieldPart.lastIndexOf('.');
        const lastSeg = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = lastDot !== -1 && /^\d+$/.test(lastSeg)
          ? { field: fieldPart.slice(0, lastDot), value, arrayIndex: parseInt(lastSeg, 10) }
          : { field: fieldPart, value };
        await secureApiClient.put(`/api/edit/cultural_considerations/${id}/edit`, payload);
        committedFieldParts.push(fieldPart);
      }
      // Flag the record/section approved (audit trail)
      await secureApiClient.put(`/api/edit/cultural_considerations/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF. localEdits keys: "field-idx" or "field-idx-arrayIndex".
      setPendingEdits(prev => {
        const n = { ...prev };
        committedFieldParts.forEach(fp => {
          const lastDot = fp.lastIndexOf('.');
          const lastSeg = lastDot === -1 ? '' : fp.slice(lastDot + 1);
          if (lastDot !== -1 && /^\d+$/.test(lastSeg)) delete n[`${fp.slice(0, lastDot)}-${idx}-${lastSeg}`];
          else { const root = fp.indexOf('.') === -1 ? fp : fp.slice(0, fp.indexOf('.')); delete n[`${root}-${idx}`]; }
        });
        return n;
      });
      // Drop this section's drafts from localStorage (now committed)
      committedFieldParts.forEach(fp => { delete recDrafts[fp]; });
      if (Object.keys(recDrafts).length === 0) delete store[id];
      writeDrafts(store);

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); setSaveError('Approve failed.'); } finally { setSaving(false); }
  }, [safeId]);
  const renderApproveButton = useCallback((record, sid, idx) => { const hasEdits = sectionHasEdits(idx, sid); const isApproved = approvedSections[`${sid}-${idx}`]; if (hasEdits) return (<button className="approve-btn pending" disabled={saving} onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>{saving ? 'Approving...' : 'Pending Approve'}</button>); if (isApproved) return <span className="approve-btn approved">Approved</span>; return null; }, [sectionHasEdits, approvedSections, handleApproveSection, saving]);

  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  const objectToLines = useCallback((value, indent) => {
    const lines = [];
    const pad = '  '.repeat(indent);
    if (isScalar(value)) { lines.push(`${pad}${fmtScalar(value)}`); return lines; }
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
      if (isScalar(v)) lines.push(`${pad}${humanizeKey(k)}: ${fmtScalar(v)}`);
      else { lines.push(`${pad}${humanizeKey(k)}`); objectToLines(v, indent + 1).forEach(l => lines.push(l)); }
    });
    return lines;
  }, []);

  /* EQ/DASH numbered lines for ONE field — the exact mirror of the PDF fieldLines (draft-aware via getFieldValue).
     Sentence rule: labeled sentence with >=3 comma parts → sub-label + numbered rows; else one numbered row per sentence. */
  const buildFieldLines = useCallback((record, f, idx, sectionTitle) => {
    const label = FIELD_LABELS[f] || f;
    const val = getFieldValue(record, f, idx);
    const lines = [];
    // SINGLE-NAME rule: when the field label == the section title, hide the label line (the EQ title already names it).
    const showLabel = label.toLowerCase() !== String(sectionTitle || '').toLowerCase();
    const head = showLabel ? [label, COPY_LINE_DASH] : [];
    if (ARRAY_FIELDS.includes(f)) {
      const items = (Array.isArray(val) ? val : []).map(x => String(x ?? '').trim()).filter(Boolean);
      if (items.length === 0) return lines;
      lines.push(...head);
      items.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
      lines.push('');
    } else if (OBJECT_FIELDS.includes(f)) {
      if (!hasVal(val)) return lines;
      lines.push(...head);
      objectToLines(val, 0).forEach(l => lines.push(l));
      lines.push('');
    } else if (DATE_FIELDS.includes(f)) {
      if (!hasVal(val)) return lines;
      lines.push(...head, `1. ${formatDate(val)}`, '');
    } else if (SENTENCE_FIELDS.includes(f)) {
      const strVal = String(val ?? ''); if (!strVal.trim()) return lines;
      lines.push(...head);
      let n = 0;
      splitBySentence(strVal).forEach(s => {
        const p = parseLabel(s);
        if (p.isLabeled) { const ci = splitByComma(p.value); if (ci.length >= 3) { lines.push(p.label, COPY_LINE_DASH); n = 0; ci.forEach(c => lines.push(`${++n}. ${c}`)); } else lines.push(`${++n}. ${s}`); }
        else lines.push(`${++n}. ${s}`);
      });
      lines.push('');
    } else {
      if (!hasVal(val)) return lines;
      const strVal = fmtEnumVal(f, val) ?? fmtVal(val);
      lines.push(...head, `1. ${strVal}`, '');
    }
    return lines;
  }, [getFieldValue, hasVal, fmtVal, formatDate, splitBySentence, splitByComma, objectToLines]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    const lines = (SECTION_FIELDS[sid] || []).flatMap(f => buildFieldLines(record, f, idx, title));
    if (lines.length === 0) return '';
    return `${title}\n${COPY_LINE_EQ}\n\n${lines.join('\n')}\n`;
  }, [buildFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== CULTURAL CONSIDERATIONS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Cultural Considerations ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => { const block = buildSectionCopyText(r, idx, sid); if (block) text += `${block}\n`; });
      text += '\n';
    });
    const ok = await copyToClipboard(text); if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ─── Render helpers ─── */

  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey; const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const isDateField = DATE_FIELDS.includes(fn); const isBoolField = typeof record[fn] === 'boolean';
    const enumOpts = ENUM_FIELDS[fn];
    const displayVal = isDateField ? formatDate(val) : (enumOpts ? (fmtEnumVal(fn, val) ?? fmtVal(val)) : fmtVal(val));
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setSaveError(''); setEditingField(editKey); setEditValue(isDateField ? formatDateISO(val) : (isBoolField ? (val ? 'Yes' : 'No') : (enumOpts ? (fmtEnumVal(fn, val) ?? fmtVal(val)) : fmtVal(val)))); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isDateField ? (
                <BlueDatePicker value={editValue} onSelect={(iso) => setEditValue(iso)} />
              ) : enumOpts ? (
                <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(''); } }}>
                  {enumOptionsWith(enumOpts, editValue).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : isBoolField ? (
                <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(''); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(''); }}>Cancel</button>
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

  const renderEditableArrayItem = (record, fn, idx, sid, title) => {
    const arr = getEffectiveArray(record, fn, idx); if (!arr || arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    return (
      <div key={fn} className="rec-mini-card">
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        {arr.map((item, ai) => {
          const itemKey = `${fn}-${idx}-${ai}`;
          const isEditing = editingField === itemKey;
          const badge = editedFields[itemKey];
          const itemStr = String(item || '');
          const itemMatches = !searchTerm.trim() || record._showAllSections || sectionTitleMatches(sid) || labelMatch || itemStr.toLowerCase().includes(searchTerm.toLowerCase().trim());
          if (!itemMatches) return null;
          return (
            <div key={ai}>
              <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setSaveError(''); setEditingField(itemKey); setEditValue(itemStr); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, sid, ai); } if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, sid, ai); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ─── OBJECT LEAF (editable scalar leaf inside results) ─── */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const editStartValue = isBool ? (value ? 'yes' : 'no') : leafValueString;
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(editStartValue); setSaveError(''); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(''); } }}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(''); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => {
                  e.stopPropagation();
                  const newVal = isBool ? (editValue === 'yes') : editValue.trim();
                  saveLeaf(record, rootField, path, idx, sid, leafKey, newVal);
                }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[leafKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${humanizeKey(path[path.length - 1])}\n${leafValueString}`, leafKey); }}>{copiedItems[leafKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ─── OBJECT NODE (recursive) ─── */
  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sid, value);
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && <div className={labelClass}>{highlightText(label)}</div>}
        <div className="nested-group">
          {entries.map(([k, v]) => (
            isScalar(v) ? renderObjectLeaf(record, rootField, [...path, k], idx, sid, v)
              : <div className="nested-mini-card" key={k}>{renderObjectNode(record, rootField, idx, sid, humanizeKey(k), v, [...path, k], depth + 1)}</div>
          ))}
        </div>
      </React.Fragment>
    );
  };

  const renderObjectField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || isScalar(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (title || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([k, v]) => (
          isScalar(v) ? renderObjectLeaf(record, fn, [k], idx, sid, v)
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fn, idx, sid, humanizeKey(k), v, [k], 1)}</div>
        ))}
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
    return (
      <div key={fn}>
        <div className="rec-mini-card">
          {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
          {sentences.map((sentence, sIdx) => {
            const sentenceKey = `${fn}-${idx}-s${sIdx}`; const isEditing = editingField === sentenceKey; const badge = editedSentences[sentenceKey];
            const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!sentenceMatches && searchTerm.trim()) return null;
            const parsed = parseLabel(sentence);
            if (parsed.isLabeled) {
              const commaItems = splitByComma(parsed.value);
              if (commaItems.length >= 3) {
                return (
                  <div key={sIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                    <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                    {commaItems.map((ci, ciIdx) => {
                      const commaKey = `${sentenceKey}-c${ciIdx}`;
                      const ciEditing = editingField === commaKey;
                      const ciBadge = editedSentences[commaKey];
                      return (
                        <div key={ciIdx}>
                          <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); } }}>
                            {ciEditing ? (
                              <div className="edit-field-container">
                                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveCommaItem(record, fn, idx, sid, sIdx, ciIdx, editValue); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />
                                <div className="edit-actions">
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItem(record, fn, idx, sid, sIdx, ciIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button>
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
              <div key={sIdx}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(sentence.replace(/[;.]+$/, '').trim()); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveSentence(record, fn, idx, sid, sIdx); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(sentence)}</span><span className="edit-indicator">&#9998;</span></div>
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
  };

  const renderMixedSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid]; if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => hasVal(getFieldValue(record, f, idx)));
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
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid, title);
            if (ARRAY_FIELDS.includes(f)) return renderEditableArrayItem(record, f, idx, sid, title);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  if (!records || records.length === 0) return (<div className="cultural-considerations-document" ref={containerRef}><div className="document-header"><h2 className="document-title">Cultural Considerations</h2></div><div className="empty-state">No cultural considerations records available</div></div>);

  return (
    <div className="cultural-considerations-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Cultural Considerations</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<CulturalConsiderationsDocumentPDFTemplate document={pdfData} />} fileName="Cultural_Considerations.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container"><input type="text" className="search-input" placeholder="Search cultural considerations..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />{searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}</div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header"><h3 className="record-name">{highlightText(`Cultural Considerations ${idx + 1}`)}</h3></div>
            {renderMixedSection(record, idx, 'provider')}
            {renderMixedSection(record, idx, 'dietary')}
            {renderMixedSection(record, idx, 'family')}
            {renderMixedSection(record, idx, 'clinical')}
            {renderMixedSection(record, idx, 'results')}
            {renderMixedSection(record, idx, 'resources')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CulturalConsiderationsDocument;
