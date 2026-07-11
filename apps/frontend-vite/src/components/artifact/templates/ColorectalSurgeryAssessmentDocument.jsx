/**
 * ColorectalSurgeryAssessmentDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: colorectal_surgery_assessment
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ColorectalSurgeryAssessmentDocumentPDFTemplate from '../pdf-templates/ColorectalSurgeryAssessmentDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueDatePicker from '../components/BlueDatePicker';
import './ColorectalSurgeryAssessmentDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [localEditKey]: { value, payloads: [{field, value, arrayIndex?}, ...] } } }
   localEditKey is the same "<fn>-<idx>" key used in localEdits; payloads are the exact PUT bodies
   the old save handlers sent (replayed verbatim at Approve so the DB write is unchanged). */
const DRAFT_KEY = 'colorectal_surgery_assessmentPendingEdits';
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
  providerInfo: 'Provider Information',
  findingsAssessment: 'Findings & Assessment',
  colonoscopy: 'Colonoscopy',
  anorectalManometry: 'Anorectal Manometry',
  defecography: 'Defecography',
  results: 'Results',
  stomaAssessment: 'Stoma Assessment',
  oncologicMarkers: 'Oncologic Markers',
  recommendations: 'Recommendations',
};

const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility', type: 'Type', status: 'Status',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan', notes: 'Notes',
  'colonoscopy.preparation': 'Preparation', 'colonoscopy.completeness': 'Completeness',
  'colonoscopy.polyps': 'Polyps', 'colonoscopy.lesions': 'Lesions',
  anorectalManometry: 'Anorectal Manometry', defecography: 'Defecography', results: 'Results',
  'stomaAssessment.type': 'Stoma Type', 'stomaAssessment.site': 'Site',
  'stomaAssessment.viability': 'Viability', 'stomaAssessment.complications': 'Complications',
  'oncologicMarkers.cea': 'CEA', 'oncologicMarkers.ca199': 'CA 19-9',
  'oncologicMarkers.microsatelliteStatus': 'Microsatellite Status', 'oncologicMarkers.kras': 'KRAS',
  recommendations: 'Recommendations',
};

const KEY_OVERRIDES = {
  restingPressure: 'Resting Pressure', squeezePressure: 'Squeeze Pressure',
  sensoryThreshold: 'Sensory Threshold', compliance: 'Compliance',
  pelvicFloorDescent: 'Pelvic Floor Descent', rectocele: 'Rectocele',
  intussusception: 'Intussusception', evacuation: 'Evacuation',
};

const SECTION_FIELDS = {
  providerInfo: ['date', 'provider', 'facility', 'type', 'status'],
  findingsAssessment: ['findings', 'assessment', 'plan', 'notes'],
  colonoscopy: ['colonoscopy.preparation', 'colonoscopy.completeness', 'colonoscopy.polyps', 'colonoscopy.lesions'],
  anorectalManometry: ['anorectalManometry'],
  defecography: ['defecography'],
  results: ['results'],
  stomaAssessment: ['stomaAssessment.type', 'stomaAssessment.site', 'stomaAssessment.viability', 'stomaAssessment.complications'],
  oncologicMarkers: ['oncologicMarkers.cea', 'oncologicMarkers.ca199', 'oncologicMarkers.microsatelliteStatus', 'oncologicMarkers.kras'],
  recommendations: ['recommendations'],
};

const SENTENCE_FIELDS = ['findings', 'assessment', 'plan'];
const DATE_FIELDS = ['date'];
const OBJECT_FIELDS = ['anorectalManometry', 'defecography', 'results'];
const DOT_PATH_FIELDS = ['colonoscopy.preparation', 'colonoscopy.completeness', 'stomaAssessment.type', 'stomaAssessment.site', 'stomaAssessment.viability', 'oncologicMarkers.cea', 'oncologicMarkers.ca199', 'oncologicMarkers.microsatelliteStatus', 'oncologicMarkers.kras'];
const ARRAY_FIELDS = ['colonoscopy.polyps', 'colonoscopy.lesions', 'stomaAssessment.complications'];
// Fixed-choice fields → dropdown (keep any unmatched current value as an extra option so nothing is lost).
const ENUM_FIELDS = { status: ['active', 'not active'] };
const enumOptionsWith = (opts, current) => { const cur = String(current ?? '').trim(); return cur && !opts.some(o => o.toLowerCase() === cur.toLowerCase()) ? [cur, ...opts] : opts; };

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
// Detect a leading "Label: value" (colon 1..60, no '.' in label, not a time like 10:30). Returns {label, value} or null.
const parseLabel = (sentence) => {
  if (!sentence || typeof sentence !== 'string') return null;
  const ci = sentence.indexOf(':');
  if (ci < 1 || ci > 60) return null;
  if (/\d/.test(sentence[ci - 1] || '') && /\d/.test(sentence[ci + 1] || '')) return null; // time guard (10:30)
  const label = sentence.slice(0, ci).trim();
  const value = sentence.slice(ci + 1).trim();
  if (!label || !value || label.includes('.')) return null;
  return { label, value };
};

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const splitNumberUnit = (text) => {
  if (text === null || text === undefined) return null;
  const s = String(text).trim();
  if (s === '') return null;
  if (/^-?\d+(?:\.\d+)?\s*\/\s*\d/.test(s)) return null;
  const m = s.match(/^(-?[\d,]*\.?\d+)(\s*)(.*)$/);
  if (!m || !/\d/.test(m[1])) return null;
  return { num: m[1].replace(/,/g, ''), sep: m[2] || '', unit: (m[3] || '').trim() };
};
const splitRatio = (text) => {
  if (text === null || text === undefined) return null;
  const m = String(text).trim().match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return { num: m[1], denom: m[2] };
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
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (isScalar(v)) return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
};

const ColorectalSurgeryAssessmentDocument = ({ document: docProp }) => {
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
  // localEditKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const containerRef = useRef(null);

  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.colorectal_surgery_assessment) return Array.isArray(r.colorectal_surgery_assessment) ? r.colorectal_surgery_assessment : [r.colorectal_surgery_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.colorectal_surgery_assessment) return Array.isArray(dd.colorectal_surgery_assessment) ? dd.colorectal_surgery_assessment : [dd.colorectal_surgery_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  const safeIdOf = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record) => {
      const id = safeIdOf(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([localEditKey, entry]) => {
        if (!entry || typeof entry !== 'object') return;
        nLocal[localEditKey] = entry.value;
        nPending[localEditKey] = Array.isArray(entry.payloads) ? entry.payloads : [];
        (entry.markers?.fields || []).forEach(k => { nFields[k] = 'edited'; });
        (entry.markers?.sentences || []).forEach(([k, v]) => { nSentences[k] = v; });
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records, safeIdOf]);

  const hasVal = useCallback((v) => {
    if (v === null || v === undefined || v === '') return false;
    if (typeof v === 'boolean') return true;
    if (typeof v === 'number') return true;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  }, []);

  const formatDate = useCallback((d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } }, []);
  const toInputDate = useCallback((d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return ''; return dt.toISOString().split('T')[0]; } catch { return ''; } }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);
  // Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 mg".
  const splitBySentence = useCallback((text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); }, []);
  // Sentence field → groups. Each sentence: a "Label: value" head becomes a labeled group (value comma-split
  // when >=3, Rule #73); an unlabeled sentence is its own group (also comma-split >=3). si = sentence index
  // (edit keys reconstruct that sentence, preserving its label). Used by JSX render, Copy, and mirrored in PDF.
  const buildSentenceGroups = useCallback((text) => splitBySentence(text).map((s, si) => {
    const strip = (p) => p.replace(/[.;]+$/, '').trim();
    const parsed = parseLabel(s);
    if (parsed) { const c = splitByComma(parsed.value); return { si, label: parsed.label, parts: (c.length >= 3 ? c : [parsed.value]).map(strip) }; }
    const c = splitByComma(s); return { si, label: null, parts: (c.length >= 3 ? c : [s]).map(strip) };
  }), [splitBySentence]);
  function reconstructFullText(sentences) { if (!sentences || sentences.length === 0) return ''; return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' '); }

  const getDotPathValue = useCallback((record, dotPath) => {
    const parts = dotPath.split('.');
    let val = record;
    for (const p of parts) { val = val?.[p]; if (val === undefined || val === null) return val; }
    return val;
  }, []);

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    if (fn.includes('.')) return getDotPathValue(record, fn);
    return record[fn];
  }, [localEdits, getDotPathValue]);

  const getEffectiveArray = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    const val = fn.includes('.') ? getDotPathValue(record, fn) : record[fn];
    return Array.isArray(val) ? val : [];
  }, [localEdits, getDotPathValue]);


  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || !text) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = String(text).split(regex);
    return parts.map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part);
  }, [searchTerm]);

  const contentMatches = useCallback((text) => {
    if (!searchTerm.trim()) return true;
    return String(text || '').toLowerCase().includes(searchTerm.toLowerCase().trim());
  }, [searchTerm]);

  const sectionTitleMatches = useCallback((sectionId) => {
    if (!searchTerm.trim()) return false;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sectionId] || '').toLowerCase();
    return title.includes(phrase) || phrase.includes(title);
  }, [searchTerm]);

  const shouldShowSection = useCallback((record, sectionId) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sectionId] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    const fields = SECTION_FIELDS[sectionId] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, 0);
      if (val !== null && val !== undefined) {
        if (Array.isArray(val)) { if (val.some(item => typeof item === 'string' ? contentMatches(item) : contentMatches(item?.recommendation))) return true; }
        else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, contentMatches]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const recordTitle = `Colorectal Surgery Assessment ${idx + 1}`.toLowerCase();
      if (recordTitle.includes(phrase) || phrase.includes(recordTitle)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      if (contentMatches(record.provider) || contentMatches(record.facility) || contentMatches(record.findings) || contentMatches(record.assessment) || contentMatches(record.plan) || contentMatches(record.notes)) return true;
      for (const dp of DOT_PATH_FIELDS) { if (contentMatches(fmtVal(getDotPathValue(record, dp)))) return true; }
      for (const af of ARRAY_FIELDS) { const arr = getDotPathValue(record, af); if (Array.isArray(arr) && arr.some(item => contentMatches(item))) return true; }
      for (const of of OBJECT_FIELDS) { if (contentMatches(flattenSearchable(record[of]))) return true; }
      if (record.recommendations?.some(r => contentMatches(r.recommendation) || (r.date && formatDate(r.date).toLowerCase().includes(phrase)))) return true;
      return false;
    });
  }, [records, searchTerm, contentMatches, fmtVal, getDotPathValue, formatDate]);

  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      if (record.colonoscopy) merged.colonoscopy = { ...record.colonoscopy };
      if (record.stomaAssessment) merged.stomaAssessment = { ...record.stomaAssessment };
      if (record.oncologicMarkers) merged.oncologicMarkers = { ...record.oncologicMarkers };
      OBJECT_FIELDS.forEach(of => { if (record[of] && typeof record[of] === 'object') merged[of] = JSON.parse(JSON.stringify(record[of])); });
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fn = m[1];
          if (OBJECT_FIELDS.includes(fn)) {
            merged[fn] = localEdits[key];
          } else if (fn.includes('.')) {
            const parts = fn.split('.');
            if (parts.length === 2) {
              if (!merged[parts[0]]) merged[parts[0]] = {};
              merged[parts[0]][parts[1]] = localEdits[key];
            }
          } else {
            merged[fn] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  // ========== EDIT (defer-save-until-approve) ==========
  // Stage a DRAFT locally + persist it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection
  // replays the exact PUT payloads). localEditKey = "<fn>-<idx>"; payload = the body the old handler sent.
  const stageDraft = useCallback((record, idx, localEditKey, value, payload, markers = {}) => {
    const id = safeIdOf(record); if (!id) return;
    setLocalEdits(prev => ({ ...prev, [localEditKey]: value }));
    setPendingEdits(prev => {
      const existing = Array.isArray(prev[localEditKey]) ? prev[localEditKey] : [];
      return { ...prev, [localEditKey]: [...existing, payload] };
    });
    if (markers.fields) markers.fields.forEach(k => setEditedFields(prev => ({ ...prev, [k]: 'edited' })));
    if (markers.sentences) markers.sentences.forEach(([k, v]) => setEditedSentences(prev => ({ ...prev, [k]: v })));
    if (markers.clearApproveSid !== undefined) {
      setApprovedSections(prev => { const n = { ...prev }; delete n[`${markers.clearApproveSid}-${idx}`]; return n; });
    }
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    const cur = store[id][localEditKey] && typeof store[id][localEditKey] === 'object' ? store[id][localEditKey] : { payloads: [], markers: { fields: [], sentences: [] } };
    const payloads = [...(Array.isArray(cur.payloads) ? cur.payloads : []), payload];
    const mFields = Array.from(new Set([...((cur.markers && cur.markers.fields) || []), ...((markers.fields) || [])]));
    const mSentences = [...((cur.markers && cur.markers.sentences) || []), ...((markers.sentences) || [])];
    store[id][localEditKey] = { value, payloads, markers: { fields: mFields, sentences: mSentences } };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeIdOf]);

  const handleSaveField = useCallback((record, fn, idx, sid) => {
    const id = safeIdOf(record); if (!id) return;
    const trimmed = editValue.trim();
    const originalVal = fn.includes('.') ? getDotPathValue(record, fn) : record[fn];
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
    // Date: validate parseable
    if (['date', 'consultationDate'].includes(fn)) {
      const testDate = new Date(trimmed);
      if (isNaN(testDate.getTime())) { setSaveError('Please enter a valid date'); return; }
    }
    setSaveError('');
    stageDraft(record, idx, `${fn}-${idx}`, saveVal, { field: fn, value: saveVal }, {
      fields: [`${fn}-${idx}`], clearApproveSid: sid,
    });
  }, [editValue, safeIdOf, getDotPathValue, stageDraft]);

  const handleSaveArrayItem = useCallback((record, fn, idx, arrayIndex, sid) => {
    const id = safeIdOf(record); if (!id) return;
    const arr = [...(getEffectiveArray(record, fn, idx))];
    arr[arrayIndex] = editValue;
    stageDraft(record, idx, `${fn}-${idx}`, arr, { field: fn, value: editValue, arrayIndex }, {
      fields: [`${fn}-${idx}-ai${arrayIndex}`], clearApproveSid: sid,
    });
  }, [editValue, safeIdOf, getEffectiveArray, stageDraft]);

  const handleSaveRecommendation = useCallback((record, idx, recIdx, sid) => {
    const id = safeIdOf(record); if (!id) return;
    const base = (localEdits[`recommendations-${idx}`] ? [...localEdits[`recommendations-${idx}`]] : [...(record.recommendations || [])]);
    base[recIdx] = { ...base[recIdx], recommendation: editValue };
    stageDraft(record, idx, `recommendations-${idx}`, base, { field: `recommendations.${recIdx}.recommendation`, value: editValue }, {
      fields: [`recommendations-${idx}-ri${recIdx}`], clearApproveSid: sid,
    });
  }, [editValue, safeIdOf, localEdits, stageDraft]);

  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeIdOf(record); if (!id) return;
    const dottedField = `${rootField}.${path.join('.')}`;
    setSaveError('');
    const cur = localEdits[`${rootField}-${idx}`] !== undefined ? localEdits[`${rootField}-${idx}`] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    node[path[path.length - 1]] = newVal;
    stageDraft(record, idx, `${rootField}-${idx}`, clone, { field: dottedField, value: newVal }, {
      fields: [leafKeyTrack], clearApproveSid: sid,
    });
  }, [safeIdOf, localEdits, stageDraft]);

  // Edit ONE comma-part within a sentence group. Rebuilds that sentence (preserving its "Label:" head),
  // then the full field text. Empty edit removes the part (and the sentence if it empties out).
  function saveCommaPart(record, fn, idx, sid, si, ci) {
    const id = safeIdOf(record); if (!id) return;
    const sentences = splitBySentence(String(getFieldValue(record, fn, idx) || ''));
    if (!sentences[si]) return;
    const parsed = parseLabel(sentences[si]);
    const source = parsed ? parsed.value : sentences[si];
    const c = splitByComma(source);
    const parts = c.length >= 3 ? c : [source];
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) { parts.splice(ci, 1); }
    else { const np = splitByComma(editedVal); parts.splice(ci, 1, ...(np.length ? np : [editedVal])); }
    const joined = parts.join(', ').trim();
    const newSentences = [...sentences];
    if (!joined) newSentences.splice(si, 1);
    else newSentences[si] = parsed ? `${parsed.label}: ${joined}` : joined;
    const fullText = reconstructFullText(newSentences);
    stageDraft(record, idx, `${fn}-${idx}`, fullText, { field: fn, value: fullText }, {
      sentences: [[`${fn}-${idx}-s${si}-c${ci}`, 'edited']], clearApproveSid: sid,
    });
  }

  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`)));
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section to MongoDB (replaying the exact PUT payloads
  // each save handler recorded), then call /approve, then clear pending so committed values flow into
  // pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeIdOf(record); if (!id) return;
    setSaving(true); setSaveError('');
    try {
      // localEditKeys staged for THIS section + THIS record (e.g. "findings-3", "colonoscopy.polyps-3")
      const fields = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      const sectionKeys = Object.keys(pendingEdits).filter(k => {
        if (!k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        return fields.includes(fieldPart);
      });
      // Replay each staged payload verbatim (preserves arrayIndex / dotted-field semantics)
      for (const key of sectionKeys) {
        const payloads = Array.isArray(pendingEdits[key]) ? pendingEdits[key] : [];
        for (const payload of payloads) {
          const resp = await secureApiClient.put(`/api/edit/colorectal_surgery_assessment/${id}/edit`, payload);
          if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        }
      }
      await secureApiClient.put(`/api/edit/colorectal_surgery_assessment/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; sectionKeys.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) { sectionKeys.forEach(k => { delete store[id][k]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => {
        const n = { ...prev };
        fields.forEach(f => { Object.keys(n).forEach(k => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); });
        return n;
      });
      setEditedSentences(prev => {
        const n = { ...prev };
        fields.forEach(f => { Object.keys(n).forEach(k => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); });
        return n;
      });
    } catch (err) { console.error('[ColorectalSurgeryAssessment] Approve error:', err); setSaveError('Approve failed.'); }
    finally { setSaving(false); }
  }, [safeIdOf, pendingEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection]);

  // ========== COPY ==========
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  // Shared EQ/DASH numbered section-copy builder (4-area mirror). Copy Section passes live getFieldValue;
  // Copy All passes pdfData's committed values. Sentence fields use labeled groups (label + DASH, value rows,
  // numbering restarts at each labeled group). Returns '' when the section has no present fields.
  const buildSectionCopy = useCallback((record, idx, sid, valueOf) => {
    const title = SECTION_TITLES[sid];
    const lines = [];
    (SECTION_FIELDS[sid] || []).forEach(f => {
      const val = valueOf(f);
      const label = FIELD_LABELS[f] || humanizeKey(f);
      const showLabel = label.toLowerCase() !== title.toLowerCase();
      if (DATE_FIELDS.includes(f)) {
        if (!hasVal(val)) return;
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        lines.push(`1. ${formatDate(val)}`, '');
      } else if (SENTENCE_FIELDS.includes(f)) {
        if (!hasVal(val)) return;
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        let n = 0;
        buildSentenceGroups(fmtVal(val)).forEach(g => {
          if (g.label) { lines.push(g.label, COPY_LINE_DASH); n = 0; }
          g.parts.forEach(p => lines.push(`${++n}. ${p}`));
        });
        lines.push('');
      } else if (ARRAY_FIELDS.includes(f)) {
        const arr = Array.isArray(val) ? val : [];
        if (arr.length === 0) return;
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        arr.forEach((item, i) => lines.push(`${i + 1}. ${String(item)}`));
        lines.push('');
      } else if (OBJECT_FIELDS.includes(f)) {
        if (!val || typeof val !== 'object' || isEmptyDeep(val)) return;
        const walk = (obj) => Object.entries(obj).forEach(([k, v]) => {
          if (isEmptyDeep(v)) return;
          if (isScalar(v)) lines.push(humanizeKey(k), COPY_LINE_DASH, `1. ${fmtScalar(v)}`, '');
          else { lines.push(humanizeKey(k), COPY_LINE_DASH); walk(v); }
        });
        walk(val);
      } else {
        if (!hasVal(val)) return;
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        lines.push(`1. ${fmtVal(val)}`, '');
      }
    });
    if (lines.length === 0) return '';
    return `${title}\n${COPY_LINE_EQ}\n\n${lines.join('\n')}\n`;
  }, [buildSentenceGroups, hasVal, fmtVal, formatDate]);

  // Recommendations copy: grouped by date (EQ under title, DASH under each date, numbered rows restart per date).
  const buildRecommendationsCopy = useCallback((recs) => {
    const valid = (Array.isArray(recs) ? recs : []).filter(r => r?.recommendation);
    if (!valid.length) return '';
    const grouped = {};
    valid.forEach(rec => { const d = rec.date ? formatDate(rec.date) : 'No Date'; (grouped[d] = grouped[d] || []).push(rec); });
    const sortedDates = Object.keys(grouped).sort((a, b) => a === 'No Date' ? 1 : b === 'No Date' ? -1 : new Date(b) - new Date(a));
    const lines = [];
    sortedDates.forEach(d => { lines.push(d, COPY_LINE_DASH); grouped[d].forEach((r, i) => lines.push(`${i + 1}. ${r.recommendation}`)); lines.push(''); });
    return `Recommendations\n${COPY_LINE_EQ}\n\n${lines.join('\n')}\n`;
  }, [formatDate]);

  const COPY_SECTION_ORDER = ['providerInfo', 'findingsAssessment', 'colonoscopy', 'anorectalManometry', 'defecography', 'results', 'stomaAssessment', 'oncologicMarkers'];
  const copyAllText = useCallback(async () => {
    let text = '=== COLORECTAL SURGERY ASSESSMENT ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Colorectal Surgery Assessment ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      COPY_SECTION_ORDER.forEach(sid => {
        const block = buildSectionCopy(r, idx, sid, f => (f.includes('.') ? getDotPathValue(r, f) : r[f]));
        if (block) text += `${block}\n`;
      });
      const rec = buildRecommendationsCopy(r.recommendations);
      if (rec) text += `${rec}\n`;
      text += '\n';
    });
    const ok = await copyToClipboard(text); if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, buildSectionCopy, buildRecommendationsCopy, getDotPathValue, copyToClipboard]);

  // ========== RENDER HELPERS ==========
  // −/+ number stepper (native spinner arrows banned). min 0; Enter saves; stopPropagation so the row click
  // doesn't re-open/close the editor. onSave commits the field/leaf.
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
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const isDateField = fn === 'date';
    const enumOpts = ENUM_FIELDS[fn] ? enumOptionsWith(ENUM_FIELDS[fn], val) : null;
    const displayVal = isDateField ? formatDate(val) : fmtVal(val);
    const badge = editedFields[editKey];
    if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(sid) && !contentMatches(displayVal) && !contentMatches(label)) return null;
    // Seed the enum editor with the canonical option matching the current value (case-insensitive).
    const seedEnum = () => { const cur = String(val ?? '').trim(); const match = enumOpts.find(o => o.toLowerCase() === cur.toLowerCase()); setEditValue(match || cur); };
    return (
      <div key={fn}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setSaveError(''); setEditingField(editKey); if (enumOpts) seedEnum(); else setEditValue(displayVal); } }}>
          {isEditing ? (<div className="edit-field-container">{enumOpts ? (
            <select className="edit-select" value={editValue} autoFocus onChange={e => { setSaveError(''); setEditValue(e.target.value); }} onKeyDown={e => { if (e.key === 'Escape') { setSaveError(''); setEditingField(null); setEditValue(''); } }}>
              {enumOpts.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
            </select>
          ) : (<textarea className="edit-textarea" value={editValue} onChange={e => { setSaveError(''); setEditValue(e.target.value); }} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setSaveError(''); setEditingField(null); setEditValue(''); } }} />)}{saveError && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setSaveError(''); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
          ) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
        </div>
        {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    // Labeled groups: a "Label: value" sentence → sub-label + comma-split value rows; unlabeled → plain rows.
    // Each part edits via saveCommaPart keyed (si,ci); the sentence is rebuilt preserving its "Label:" head.
    const groups = buildSentenceGroups(val); if (groups.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !contentMatches(val) && !contentMatches(label)) return null;
    return (
      <div key={fn}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="rec-mini-card">
          {groups.map((g) => (
            <div key={g.si}>
              {g.label && <div className="nested-subtitle sub-label">{highlightText(g.label)}</div>}
              {g.parts.map((part, cIdx) => {
                const partKey = `${fn}-${idx}-s${g.si}-c${cIdx}`; const isEditing = editingField === partKey; const badge = editedSentences[partKey];
                const partMatches = phraseMatch || (searchTerm.trim() && (part.toLowerCase().includes(searchTerm.toLowerCase().trim()) || (g.label || '').toLowerCase().includes(searchTerm.toLowerCase().trim())));
                if (!partMatches && searchTerm.trim()) return null;
                return (
                  <div key={cIdx}>
                    <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(partKey); setEditValue(part.replace(/[;.]+$/, '').trim()); } }}>
                      {isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaPart(record, fn, idx, sid, g.si, cIdx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
                      ) : (<><div className="row-content"><span className="content-value">{highlightText(part)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[partKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(part, partKey); }}>{copiedItems[partKey] ? 'Copied!' : 'Copy'}</button></>)}
                    </div>
                    {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderArrayField = (record, fn, idx, sid, title) => {
    const arr = getEffectiveArray(record, fn, idx);
    if (!arr || arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !arr.some(item => contentMatches(item)) && !contentMatches(label)) return null;
    return (
      <div key={fn}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className="rec-mini-card">
          {arr.map((item, ai) => {
            const editKey = `${fn}-${idx}-ai${ai}`;
            const isEditing = editingField === editKey;
            const badge = editedFields[editKey];
            const itemStr = String(item || '');
            if (searchTerm.trim() && !phraseMatch && !contentMatches(itemStr)) return null;
            return (
              <div key={ai}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); } }}>
                  {isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, ai, sid); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
                  ) : (<><div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
                </div>
                {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDateField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = formatDate(val);
    const badge = editedFields[editKey];
    if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(sid) && !contentMatches(displayVal) && !contentMatches(label)) return null;
    return (
      <div key={fn}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setSaveError(''); setEditingField(editKey); setEditValue(toInputDate(val)); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={(iso) => { setSaveError(''); setEditValue(iso); }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setSaveError(''); setEditingField(null); setEditValue(''); }}>Cancel</button></div>
            </div>
          ) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
        </div>
        {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const ratio = isBool ? null : splitRatio(leafValueString);
    const nu = (isBool || ratio) ? null : splitNumberUnit(leafValueString);
    const editStartValue = isBool ? (value ? 'yes' : 'no') : ratio ? ratio.num : nu ? nu.num : leafValueString;
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
              ) : (ratio || nu) ? (
                <div className="num-stepper-row">
                  <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const s = parseFloat(stepFor(editValue)) || 1; setEditValue(String(Math.max(0, Math.round(((parseFloat(editValue) || 0) - s) * 1e6) / 1e6))); }}>−</button>
                  <input type="number" step={stepFor(editValue)} min="0" className="edit-number" value={editValue} autoFocus onClick={e => e.stopPropagation()} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(''); } }} />
                  <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const s = parseFloat(stepFor(editValue)) || 1; setEditValue(String(Math.max(0, Math.round(((parseFloat(editValue) || 0) + s) * 1e6) / 1e6))); }}>+</button>
                  {ratio ? <span className="number-edit-unit">{`/ ${ratio.denom}`}</span> : (nu.unit && <span className="number-edit-unit">{nu.unit}</span>)}
                </div>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(''); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => {
                  e.stopPropagation();
                  let newVal;
                  if (isBool) { newVal = editValue === 'yes'; }
                  else if (ratio) { const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } newVal = `${n}/${ratio.denom}`; }
                  else if (nu) { const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } newVal = nu.unit ? `${n}${nu.sep || ' '}${nu.unit}` : String(n); }
                  else { newVal = editValue.trim(); }
                  saveLeaf(record, rootField, path, idx, sid, leafKey, newVal);
                }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[leafKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${humanizeKey(path[path.length - 1])}\n${leafValueString}`, leafKey); }}>{copiedItems[leafKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

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
    const sl = label.trim().toLowerCase() !== (title || '').trim().toLowerCase();
    if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(sid) && !contentMatches(flattenSearchable(val)) && !contentMatches(label)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div key={fn}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([k, v]) => (
          isScalar(v) ? renderObjectLeaf(record, fn, [k], idx, sid, v)
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fn, idx, sid, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    );
  };

  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => {
      if (ARRAY_FIELDS.includes(f)) return getEffectiveArray(record, f, idx).length > 0;
      if (OBJECT_FIELDS.includes(f)) { const v = getFieldValue(record, f, idx); return v && typeof v === 'object' && !isEmptyDeep(v); }
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
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopy(record, idx, sid, f => getFieldValue(record, f, idx)), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid, title);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid, title);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  const renderRecommendations = (record, idx) => {
    const localRecs = localEdits[`recommendations-${idx}`];
    const recs = Array.isArray(localRecs) ? localRecs : (Array.isArray(record.recommendations) ? record.recommendations : []);
    const validRecs = recs.filter(r => r?.recommendation);
    if (validRecs.length === 0) return null;
    const title = 'Recommendations';
    const sid = 'recommendations';
    const stm = sectionTitleMatches(sid);
    const isSearching = searchTerm.trim().length > 0;
    if (isSearching && !record._showAllSections && !stm && !validRecs.some(r => contentMatches(r.recommendation) || (r.date && contentMatches(formatDate(r.date))))) return null;
    const copyId = `recommendations-${idx}`;

    const grouped = {};
    validRecs.forEach((rec, ri) => {
      const dateKey = rec.date ? formatDate(rec.date) : 'No Date';
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push({ ...rec, originalIdx: recs.indexOf(rec) !== -1 ? recs.indexOf(rec) : ri });
    });
    const sortedDates = Object.keys(grouped).sort((a, b) => {
      if (a === 'No Date') return 1; if (b === 'No Date') return -1;
      return new Date(b) - new Date(a);
    });

    return (
      <div className="section"><div className="mini-cards-container">
        <div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildRecommendationsCopy(recs), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>{renderApproveButton(record, sid, idx)}</div></div>
        {sortedDates.map(dateStr => {
          const items = grouped[dateStr];
          const dateMatches = contentMatches(dateStr);
          const visibleItems = isSearching && !record._showAllSections && !stm && !dateMatches ? items.filter(r => contentMatches(r.recommendation)) : items;
          if (visibleItems.length === 0) return null;
          return (<div key={dateStr} className="rec-mini-card">
            <div className="nested-subtitle">{highlightText(dateStr)}</div>
            {visibleItems.map((rec) => {
              const ri = rec.originalIdx;
              const editKey = `rec-${idx}-${ri}`;
              const isEditing = editingField === editKey;
              const badge = editedFields[`recommendations-${idx}-ri${ri}`];
              return (<div key={ri}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(rec.recommendation); } }}>
                  {isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveRecommendation(record, idx, ri, sid); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
                  ) : (<><div className="row-content"><span className="content-value">{highlightText(rec.recommendation)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(rec.recommendation, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
                </div>
                {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>);
            })}
          </div>);
        })}
      </div></div>
    );
  };

  if (!records || records.length === 0) {
    return (<div className="colorectal-surgery-assessment" ref={containerRef}><div className="document-header"><h2 className="document-title">Colorectal Surgery Assessment</h2></div><div className="empty-state">No colorectal surgery assessment records available</div></div>);
  }

  return (
    <div className="colorectal-surgery-assessment" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Colorectal Surgery Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ColorectalSurgeryAssessmentDocumentPDFTemplate document={pdfData} />} fileName="Colorectal_Surgery_Assessment.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search colorectal surgery assessment..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">{record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}</div>
              <h3 className="record-name">{highlightText(`Colorectal Surgery Assessment ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'providerInfo')}
            {renderSection(record, idx, 'findingsAssessment')}
            {renderSection(record, idx, 'colonoscopy')}
            {renderSection(record, idx, 'anorectalManometry')}
            {renderSection(record, idx, 'defecography')}
            {renderSection(record, idx, 'results')}
            {renderSection(record, idx, 'stomaAssessment')}
            {renderSection(record, idx, 'oncologicMarkers')}
            {renderRecommendations(record, idx)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ColorectalSurgeryAssessmentDocument;
