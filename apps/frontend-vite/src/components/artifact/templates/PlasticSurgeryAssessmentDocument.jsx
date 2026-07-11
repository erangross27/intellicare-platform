/**
 * PlasticSurgeryAssessmentDocument.jsx
 * Collection: plastic_surgery_assessment
 * FULL TEMPLATE STANDARD — inline editing, blue glow theme.
 *
 * OBJECT-HEAVY schema. All 10 object fields render through the recursive
 * renderObjectLeaf / renderObjectNode machinery (every nested leaf typed:
 * number -> number input, boolean -> Yes/No select, ratio "x/y" -> number input,
 * else -> textarea). Narratives (findings, assessment, plan, notes) are
 * per-sentence editable. Arrays (patientConcerns, recommendations) via
 * renderArrayField. reconstructionOptionsDiscussed (array of objects with
 * sub-arrays) keeps its bespoke renderer. date -> date-picker.
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PlasticSurgeryAssessmentDocumentPDFTemplate from '../pdf-templates/PlasticSurgeryAssessmentDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './PlasticSurgeryAssessmentDocument.css';

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'header': 'Encounter',
  'reconstruction-options': 'Reconstruction Options Discussed',
  'patient-preference': 'Patient Preference',
  'patient-concerns': 'Patient Concerns',
  'donor-site': 'Donor Site Assessment',
  'measurements': 'Measurements',
  'preoperative-photography': 'Preoperative Photography',
  'skin-analysis': 'Skin Analysis',
  'flap-assessment': 'Flap Assessment',
  'implant-data': 'Implant Data',
  'vascular-exam': 'Vascular Examination',
  'aesthetic-goals': 'Aesthetic Goals',
  'results': 'Results',
  'findings-text': 'Findings',
  'assessment-text': 'Assessment',
  'plan-text': 'Plan',
  'notes-text': 'Notes',
  'recommendations-list': 'Recommendations',
};

const FIELD_LABELS = {
  'date': 'Date',
  'type': 'Type',
  'provider': 'Provider',
  'facility': 'Facility',
  'status': 'Status',
  'reconstructionOptionsDiscussed': 'Reconstruction Options Discussed',
  'patientPreference': 'Patient Preference',
  'patientConcerns': 'Patient Concerns',
  'donorSiteAssessment': 'Donor Site Assessment',
  'measurements': 'Measurements',
  'preoperativePhotography': 'Preoperative Photography',
  'skinAnalysis': 'Skin Analysis',
  'flapAssessment': 'Flap Assessment',
  'implantData': 'Implant Data',
  'vascularExamination': 'Vascular Examination',
  'aestheticGoals': 'Aesthetic Goals',
  'results': 'Results',
  'findings': 'Findings',
  'assessment': 'Assessment',
  'plan': 'Plan',
  'notes': 'Notes',
  'recommendations': 'Recommendations',
};

const SECTION_FIELDS = {
  'header': ['date', 'type', 'provider', 'facility', 'status'],
  'reconstruction-options': ['reconstructionOptionsDiscussed'],
  'patient-preference': ['patientPreference'],
  'patient-concerns': ['patientConcerns'],
  'donor-site': ['donorSiteAssessment'],
  'measurements': ['measurements'],
  'preoperative-photography': ['preoperativePhotography'],
  'skin-analysis': ['skinAnalysis'],
  'flap-assessment': ['flapAssessment'],
  'implant-data': ['implantData'],
  'vascular-exam': ['vascularExamination'],
  'aesthetic-goals': ['aestheticGoals'],
  'results': ['results'],
  'findings-text': ['findings'],
  'assessment-text': ['assessment'],
  'plan-text': ['plan'],
  'notes-text': ['notes'],
  'recommendations-list': ['recommendations'],
};

// ─── Defer-save draft store (localStorage) ────────────────────────────────────
// Save stages a local DRAFT only; Approve is the ONLY path that writes to MongoDB.
// Shape: { [recordId]: { [editKey]: {field, value, arrayIndex?} } } — stores each save
// site's EXACT PUT payload (dotted fields + arrayIndex for option advantages/disadvantages).
const DRAFT_KEY = 'plastic_surgery_assessmentPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch { return {}; }
};
const writeDrafts = (store) => {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(store)); } catch { /* ignore */ }
};
const stageDraft = (recId, key, payload) => {
  if (!recId) return;
  const store = readDrafts();
  store[recId] = { ...(store[recId] || {}), [key]: payload };
  writeDrafts(store);
};

const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['patientConcerns', 'recommendations'];
const OBJECT_FIELDS = ['patientPreference', 'donorSiteAssessment', 'measurements', 'preoperativePhotography', 'skinAnalysis', 'flapAssessment', 'implantData', 'vascularExamination', 'aestheticGoals', 'results'];
const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'notes'];
const SIMPLE_STRING_FIELDS = ['type', 'provider', 'facility', 'status'];

const KEY_OVERRIDES = {
  suitabilityForPAPFlap: 'Suitability for PAP Flap',
  suitabilityForGAPFlap: 'Suitability for GAP Flap',
  fitzpatrickType: 'Fitzpatrick Type',
};

const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const stepFor = (v) => { const s = String(v); const dot = s.indexOf('.'); if (dot === -1) return 1; const decimals = s.length - dot - 1; return decimals <= 0 ? 1 : Math.pow(10, -decimals); };
// Single-name gate: hide a field label that just repeats its section title (case-insensitive).
const sameAsTitle = (label, sid) => String(label || '').trim().toLowerCase() === String(SECTION_TITLES[sid] || '').trim().toLowerCase();

/* ═══════ PURE HELPERS ═══════ */
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
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

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

/* ═══════ COMPONENT ═══════ */
const PlasticSurgeryAssessmentDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
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
      if (!r || typeof r !== 'object') return [r];
      if (r.plastic_surgery_assessment) return Array.isArray(r.plastic_surgery_assessment) ? r.plastic_surgery_assessment : [r.plastic_surgery_assessment];
      if (r.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.plastic_surgery_assessment) return Array.isArray(dd.plastic_surgery_assessment) ? dd.plastic_surgery_assessment : [dd.plastic_surgery_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => !isEmptyDeep(v), []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' ');
  }

  const getNestedValue = useCallback((obj, path) => {
    if (!obj || !path) return undefined;
    const parts = path.split('.');
    let cur = obj;
    for (const p of parts) { if (cur === undefined || cur === null) return undefined; cur = cur[p]; }
    return cur;
  }, []);

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return getNestedValue(record, fn);
  }, [localEdits, getNestedValue]);

  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || text === null || text === undefined) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return String(text).split(regex).map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part);
  }, [searchTerm]);

  const sectionTitleMatches = useCallback((sid) => {
    if (!searchTerm.trim()) return false;
    const p = searchTerm.toLowerCase().trim();
    const t = (SECTION_TITLES[sid] || '').toLowerCase();
    return t.includes(p) || p.includes(t);
  }, [searchTerm]);

  /* searchable text for any field type */
  const fieldSearchText = useCallback((f, val) => {
    if (val === null || val === undefined) return '';
    if (OBJECT_FIELDS.includes(f) || (typeof val === 'object')) return flattenSearchable(val);
    return fmtVal(val);
  }, [fmtVal]);

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
      if (fieldSearchText(f, val).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm, getFieldValue, fieldSearchText]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    return fieldSearchText(fn, val).toLowerCase().includes(phrase);
  }, [searchTerm, getFieldValue, fieldSearchText]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Plastic Surgery Assessment ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (fieldSearchText(f, val).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fieldSearchText]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = JSON.parse(JSON.stringify(record));
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // un-approved draft stays OUT of PDF/Copy All
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const path = m[1];
          const parts = path.split('.');
          let cur = merged;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
            cur = cur[parts[i]];
          }
          cur[parts[parts.length - 1]] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  // DEFER-SAVE: rehydrate staged drafts on mount so a Save survives refresh (kept OUT of
  // DB/PDF until Approve). Restores pendingEdits + edited markers (so each section's Pending
  // Approve button reappears) and, for simple field drafts, localEdits so the value shows.
  // Approve reads the localStorage draft store directly, so it commits after refresh too.
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const le = {}, pe = {}, ef = {};
    filteredRecords.forEach((rec, idx) => {
      const id = safeId(rec);
      const drafts = id && store[id];
      if (!drafts) return;
      Object.entries(drafts).forEach(([key, p]) => {
        const reKey = `${key.replace(/-\d+$/, '')}-${idx}`;
        pe[reKey] = true;
        ef[reKey] = 'edited';
        if (p && typeof p === 'object' && p.arrayIndex === undefined && 'value' in p) {
          le[reKey] = p.value;
        }
      });
    });
    if (Object.keys(pe).length) {
      setLocalEdits(prev => ({ ...le, ...prev }));
      setPendingEdits(prev => ({ ...pe, ...prev }));
      setEditedFields(prev => ({ ...ef, ...prev }));
    }
  }, [filteredRecords]);

  /* ═══════ EDIT HANDLERS ═══════ */
  const handleSaveField = useCallback((record, fn, idx, sid, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    // DEFER-SAVE: stage a local draft only; Approve commits to the DB.
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; if (sid) delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue('');
    stageDraft(id, `${fn}-${idx}`, { field: fn, value: saveVal });
  }, [editValue, safeId]);

  /* saveLeaf — writes a deep object leaf via dotted path, updates local nested clone */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    const dottedField = `${rootField}.${path.join('.')}`;
    // DEFER-SAVE: stage a local draft only; Approve commits the dotted leaf to the DB.
    setLocalEdits(prev => {
      const cur = prev[`${rootField}-${idx}`] !== undefined ? prev[`${rootField}-${idx}`] : getNestedValue(record, rootField);
      const clone = JSON.parse(JSON.stringify(cur ?? {}));
      let node = clone;
      for (let i = 0; i < path.length - 1; i++) { if (!node[path[i]] || typeof node[path[i]] !== 'object') node[path[i]] = {}; node = node[path[i]]; }
      node[path[path.length - 1]] = newVal;
      return { ...prev, [`${rootField}-${idx}`]: clone };
    });
    setPendingEdits(prev => ({ ...prev, [`${rootField}-${idx}`]: true }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue('');
    stageDraft(id, `${dottedField}-${idx}`, { field: dottedField, value: newVal });
  }, [safeId, getNestedValue]);

  function saveSentence(record, fn, idx, sid, sentenceIdx, valueTextOverride) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = (valueTextOverride !== undefined ? valueTextOverride : editValue).trim();
    // DEFER-SAVE: stage a local draft only; Approve commits to the DB.
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
      setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
      setEditingField(null); setEditValue('');
      stageDraft(id, `${fn}-${idx}`, { field: fn, value: fullText });
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue('');
    stageDraft(id, `${fn}-${idx}`, { field: fn, value: fullText });
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.includes(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    const inSection = (k) => fields.some(f => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.includes(`-${idx}`)));
    try {
      // DEFER-SAVE: Approve is the ONLY DB writer — replay this section's staged draft
      // payloads to /edit (dotted fields + arrayIndex for option lists), then /approve.
      const store = readDrafts();
      const recordDrafts = store[id] || {};
      const toCommit = Object.entries(recordDrafts).filter(([k]) => inSection(k));
      for (const [, p] of toCommit) {
        const body = { field: p.field, value: p.value };
        if (p.arrayIndex !== undefined) body.arrayIndex = p.arrayIndex;
        await secureApiClient.put(`/api/edit/plastic_surgery_assessment/${id}/edit`, body);
      }
      await secureApiClient.put(`/api/edit/plastic_surgery_assessment/${id}/approve`, { sectionId: sid, approved: true });
      if (toCommit.length) {
        const remaining = { ...recordDrafts };
        toCommit.forEach(([k]) => delete remaining[k]);
        if (Object.keys(remaining).length) store[id] = remaining; else delete store[id];
        writeDrafts(store);
      }
      setPendingEdits(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (inSection(k)) delete n[k]; }); return n; });
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.includes(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); }
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

  /* recursive copy lines for object fields */
  const objectCopyLines = useCallback((label, value, indent) => {
    const out = [];
    const pad = '  '.repeat(indent);
    if (isEmptyDeep(value)) return out;
    if (isScalar(value)) { if (label) out.push(`${pad}${label}`); out.push(`${pad}${fmtScalar(value)}`); return out; }
    if (Array.isArray(value)) {
      if (label) out.push(`${pad}${label}:`);
      value.filter(v => !isEmptyDeep(v)).forEach((v, i) => {
        if (isScalar(v)) out.push(`${pad}  ${i + 1}. ${fmtScalar(v)}`);
        else objectCopyLines('', v, indent + 1).forEach(l => out.push(l));
      });
      return out;
    }
    if (label) out.push(`${pad}${label}:`);
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v, indent + (label ? 1 : 0)).forEach(l => out.push(l)));
    return out;
  }, []);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;

    if (sid === 'reconstruction-options') {
      const opts = Array.isArray(getFieldValue(record, 'reconstructionOptionsDiscussed', idx)) ? getFieldValue(record, 'reconstructionOptionsDiscussed', idx) : [];
      opts.forEach((opt, i) => {
        text += `Option ${i + 1}: ${opt.option || 'Unknown'}\n`;
        if (opt.recommended !== undefined) text += `  Recommended: ${opt.recommended ? 'Yes' : 'No'}\n`;
        (Array.isArray(opt.advantages) ? opt.advantages : []).forEach((a, j) => { text += `  Advantage ${j + 1}: ${a}\n`; });
        (Array.isArray(opt.disadvantages) ? opt.disadvantages : []).forEach((d, j) => { text += `  Disadvantage ${j + 1}: ${d}\n`; });
        text += '\n';
      });
      return text;
    }

    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      const label = FIELD_LABELS[f] || f;
      if (DATE_FIELDS.includes(f)) { text += `${label}\n${formatDate(val)}\n\n`; return; }
      if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val : [val];
        text += `${label}\n${items.map((item, i) => `${i + 1}. ${typeof item === 'object' ? objectCopyLines('', item, 0).join(' ') : item}`).join('\n')}\n\n`;
        return;
      }
      if (OBJECT_FIELDS.includes(f)) {
        objectCopyLines('', val, 0).forEach(l => { text += `${l}\n`; });
        text += '\n';
        return;
      }
      if (SENTENCE_FIELDS.includes(f)) {
        const sentences = splitBySentence(String(val));
        text += `${label}\n${sentences.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n`;
        return;
      }
      text += `${label}\n${fmtVal(val)}\n\n`;
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, objectCopyLines]);

  const copyAllText = useCallback(async () => {
    let text = `Plastic Surgery Assessment\n${'='.repeat(40)}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Plastic Surgery Assessment ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => { text += buildSectionCopyText(r, idx, sid); });
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
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={iso => { setEditValue(iso); setSaveError(null); }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (!editValue || isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, sid, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: SIMPLE STRING FIELD (provider, facility, status, type) ═══════ */
  const renderSimpleStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const label = FIELD_LABELS[fn] || fn;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
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

  /* ═══════ RENDER: SENTENCE FIELD (per-sentence editable narratives) ═══════ */
  const renderSentenceEditableField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
      return (
        <div key={fn} className="rec-mini-card">
          {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
          {sentences.map((sentence, sIdx) => {
            const sentenceKey = `${fn}-${idx}-s${sIdx}`;
            const isEditing = editingField === sentenceKey;
            const badge = editedSentences[sentenceKey];
            const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!sentenceMatches && searchTerm.trim()) return null;
            const parsed = parseLabel(sentence);
            const seed = parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim();
            const rebuilt = () => parsed.isLabeled ? `${parsed.label}: ${editValue.trim()}` : undefined;
            return (
              <div key={sIdx}>
                {parsed.isLabeled && <div className="nested-subtitle sub-label">{highlightText(parsed.label)}</div>}
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(seed); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); saveSentence(record, fn, idx, sid, sIdx, rebuilt()); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx, rebuilt()); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : sentence)}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(parsed.isLabeled ? `${parsed.label}\n${parsed.value}` : sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
              </div>
            );
          })}
        </div>
      );
    }

    /* Single-sentence narrative */
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    return (
      <div key={fn} className="rec-mini-card">
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(strVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleSaveField(record, fn, idx, sid); } }} />
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

  /* ═══════ RENDER: ARRAY FIELD (patientConcerns, recommendations) ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(v => !isEmptyDeep(v)) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, itemIdx) => {
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemStr = typeof item === 'object' ? flattenSearchable(item) : String(item);
          const isObjectItem = typeof item === 'object' && item !== null;
          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
          }
          if (isObjectItem) {
            return (
              <div key={itemIdx} className="nested-mini-card">
                <div className="nested-subtitle sub-label">{highlightText(`${label} ${itemIdx + 1}`)}</div>
                {Object.entries(item).filter(([, v]) => !isEmptyDeep(v)).map(([k, v]) => (
                  isScalar(v) ? renderObjectLeaf(record, fn, [String(itemIdx), k], idx, sid, v)
                    : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fn, idx, sid, humanizeKey(k), v, [String(itemIdx), k], 1)}</div>
                ))}
              </div>
            );
          }
          return (
            <div key={itemIdx}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = editValue; setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: currentArr })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); stageDraft(id, editKey, { field: fn, value: editValue, arrayIndex: itemIdx }); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: OBJECT LEAF (typed editable leaf) ═══════ */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const isNum = typeof value === 'number';
    const ratio = (isBool || isNum) ? null : splitRatio(leafValueString);
    const nu = (isBool || isNum || ratio) ? null : splitNumberUnit(leafValueString);
    const editStartValue = isBool ? (value ? 'yes' : 'no') : isNum ? String(value) : ratio ? ratio.num : nu ? nu.num : leafValueString;
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(editStartValue); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <BlueSelect value={editValue === 'yes' ? 'Yes' : 'No'} options={['Yes', 'No']} onChange={v => setEditValue(v === 'Yes' ? 'yes' : 'no')} />
              ) : (isNum || ratio || nu) ? (
                <div className="number-edit-row">
                  <div className="num-stepper-row">
                    <button className="num-step" tabIndex={-1} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); const base = isNaN(cur) ? 0 : cur; setEditValue(String(Math.max(0, +(base - stepFor(editValue)).toFixed(4)))); }}>&minus;</button>
                    <input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    <button className="num-step" tabIndex={-1} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); const base = isNaN(cur) ? 0 : cur; setEditValue(String(Math.max(0, +(base + stepFor(editValue)).toFixed(4)))); }}>+</button>
                  </div>
                  {ratio ? <span className="number-edit-unit">{`/ ${ratio.denom}`}</span> : (nu && nu.unit && <span className="number-edit-unit">{nu.unit}</span>)}
                </div>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => {
                  e.stopPropagation();
                  let newVal;
                  if (isBool) { newVal = editValue === 'yes'; }
                  else if (isNum) { const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } newVal = n; }
                  else if (ratio) { const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } newVal = `${n}/${ratio.denom}`; }
                  else if (nu) { const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } newVal = nu.unit ? `${n}${nu.sep || ' '}${nu.unit}` : String(n); }
                  else { newVal = editValue.trim(); }
                  saveLeaf(record, rootField, path, idx, sid, leafKey, newVal);
                }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
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

  /* ═══════ RENDER: OBJECT NODE (recursive) ═══════ */
  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sid, value);
    if (Array.isArray(value)) {
      const items = value.filter(v => !isEmptyDeep(v));
      if (items.length === 0) return null;
      return (
        <React.Fragment key={path.join('-') || rootField}>
          {label && <div className={labelClass}>{highlightText(label)}</div>}
          <div className="nested-group">
            {items.map((v, i) => (
              isScalar(v) ? renderObjectLeaf(record, rootField, [...path, String(i)], idx, sid, v)
                : <div className="nested-mini-card" key={i}>{renderObjectNode(record, rootField, idx, sid, `${label || 'Item'} ${i + 1}`, v, [...path, String(i)], depth + 1)}</div>
            ))}
          </div>
        </React.Fragment>
      );
    }
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

  /* ═══════ RENDER: OBJECT FIELD (entry point for an object root field) ═══════ */
  const renderObjectField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || isScalar(val)) return null;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    if (Array.isArray(val)) {
      const items = val.filter(v => !isEmptyDeep(v));
      if (items.length === 0) return null;
      return (
        <div key={fn} className="rec-mini-card">
          {items.map((v, i) => (
            isScalar(v) ? renderObjectLeaf(record, fn, [String(i)], idx, sid, v)
              : <div className="nested-mini-card" key={i}>{renderObjectNode(record, fn, idx, sid, `Item ${i + 1}`, v, [String(i)], 1)}</div>
          ))}
        </div>
      );
    }
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {entries.map(([k, v]) => (
          isScalar(v) ? renderObjectLeaf(record, fn, [k], idx, sid, v)
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fn, idx, sid, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    );
  };

  /* ═══════ RENDER: RECONSTRUCTION OPTIONS (array of objects w/ sub-arrays) ═══════ */
  const renderReconstructionOptions = (record, idx) => {
    const opts = Array.isArray(getFieldValue(record, 'reconstructionOptionsDiscussed', idx)) ? getFieldValue(record, 'reconstructionOptionsDiscussed', idx) : [];
    if (opts.length === 0) return null;
    const sid = 'reconstruction-options';
    if (!shouldShowSection(record, sid)) return null;
    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Reconstruction Options Discussed')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {opts.map((opt, optIdx) => {
            const optEditBase = `reconstructionOptionsDiscussed.${optIdx}`;
            const advs = Array.isArray(opt.advantages) ? opt.advantages : [];
            const disadvs = Array.isArray(opt.disadvantages) ? opt.disadvantages : [];
            const optNameKey = `${optEditBase}.option-${idx}`;
            const optNameEditing = editingField === optNameKey;
            const optNameModified = editedFields[optNameKey];
            const recKey = `${optEditBase}.recommended-${idx}`;
            const recEditing = editingField === recKey;
            const recModified = editedFields[recKey];
            return (
              <div className="rec-mini-card" key={optIdx}>
                <div className="nested-subtitle">{highlightText(`Option ${optIdx + 1}`)}{opt.recommended && <span className="recommended-badge" style={{ marginLeft: 8 }}>Recommended</span>}</div>
                <div className={`numbered-row ${optNameModified ? 'modified' : ''} editable-row`} onClick={() => { if (!optNameEditing) { setEditingField(optNameKey); setEditValue(opt.option || ''); setSaveError(null); } }}>
                  {optNameEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, `${optEditBase}.option`, idx, sid, editValue, optNameKey); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(opt.option || 'Unknown')}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[optNameKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(opt.option || '', optNameKey); }}>{copiedItems[optNameKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {optNameModified && <span className="modified-badge">edited - click Pending Approve to save</span>}

                {opt.recommended !== undefined && (
                  <>
                    <div className="nested-subtitle sub-label" style={{ marginTop: 4 }}>{highlightText('Recommended')}</div>
                    <div className={`numbered-row ${recModified ? 'modified' : ''} editable-row`} onClick={() => { if (!recEditing) { setEditingField(recKey); setEditValue(opt.recommended ? 'Yes' : 'No'); setSaveError(null); } }}>
                      {recEditing ? (
                        <div className="edit-field-container">
                          <BlueSelect value={editValue === 'Yes' ? 'Yes' : 'No'} options={['Yes', 'No']} onChange={v => setEditValue(v)} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const boolVal = editValue === 'Yes'; handleSaveField(record, `${optEditBase}.recommended`, idx, sid, boolVal, recKey); }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(opt.recommended ? 'Yes' : 'No')}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[recKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`Recommended\n${opt.recommended ? 'Yes' : 'No'}`, recKey); }}>{copiedItems[recKey] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {recModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                  </>
                )}

                {advs.length > 0 && (
                  <div className="rec-mini-card" style={{ marginTop: 8 }}>
                    <div className="nested-subtitle">{highlightText('Advantages')}</div>
                    {advs.map((adv, advIdx) => {
                      const advKey = `${optEditBase}.advantages.${advIdx}-${idx}`;
                      const advEditing = editingField === advKey;
                      const advModified = editedFields[advKey];
                      return (
                        <div key={advIdx}>
                          <div className={`numbered-row ${advModified ? 'modified' : ''} editable-row`} onClick={() => { if (!advEditing) { setEditingField(advKey); setEditValue(adv); setSaveError(null); } }}>
                            {advEditing ? (
                              <div className="edit-field-container">
                                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                {saveError && <div className="save-error">{saveError}</div>}
                                <div className="edit-actions">
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setPendingEdits(prev => ({ ...prev, [advKey]: true })); setEditedFields(prev => ({ ...prev, [advKey]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); stageDraft(id, advKey, { field: `${optEditBase}.advantages`, value: editValue, arrayIndex: advIdx }); }}>{saving ? 'Saving...' : 'Save'}</button>
                                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="row-content"><span className="content-value">{highlightText(adv)}</span><span className="edit-indicator">&#9998;</span></div>
                                <button className={`copy-btn ${copiedItems[advKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(adv, advKey); }}>{copiedItems[advKey] ? 'Copied!' : 'Copy'}</button>
                              </>
                            )}
                          </div>
                          {advModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {disadvs.length > 0 && (
                  <div className="rec-mini-card" style={{ marginTop: 8 }}>
                    <div className="nested-subtitle">{highlightText('Disadvantages')}</div>
                    {disadvs.map((dis, disIdx) => {
                      const disKey = `${optEditBase}.disadvantages.${disIdx}-${idx}`;
                      const disEditing = editingField === disKey;
                      const disModified = editedFields[disKey];
                      return (
                        <div key={disIdx}>
                          <div className={`numbered-row ${disModified ? 'modified' : ''} editable-row`} onClick={() => { if (!disEditing) { setEditingField(disKey); setEditValue(dis); setSaveError(null); } }}>
                            {disEditing ? (
                              <div className="edit-field-container">
                                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                {saveError && <div className="save-error">{saveError}</div>}
                                <div className="edit-actions">
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setPendingEdits(prev => ({ ...prev, [disKey]: true })); setEditedFields(prev => ({ ...prev, [disKey]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); stageDraft(id, disKey, { field: `${optEditBase}.disadvantages`, value: editValue, arrayIndex: disIdx }); }}>{saving ? 'Saving...' : 'Save'}</button>
                                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="row-content"><span className="content-value">{highlightText(dis)}</span><span className="edit-indicator">&#9998;</span></div>
                                <button className={`copy-btn ${copiedItems[disKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(dis, disKey); }}>{copiedItems[disKey] ? 'Copied!' : 'Copy'}</button>
                              </>
                            )}
                          </div>
                          {disModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderGenericSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
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
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid);
            return renderSimpleStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="plastic-surgery-assessment-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Plastic Surgery Assessment</h2></div>
        <div className="empty-state">No plastic surgery assessment records available</div>
      </div>
    );
  }

  return (
    <div className="plastic-surgery-assessment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Plastic Surgery Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<PlasticSurgeryAssessmentDocumentPDFTemplate document={pdfData} />} fileName="Plastic_Surgery_Assessment.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search plastic surgery assessment records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Plastic Surgery Assessment ${idx + 1}`)}</h3>
            </div>
            {renderGenericSection(record, idx, 'header')}
            {renderReconstructionOptions(record, idx)}
            {renderGenericSection(record, idx, 'patient-preference')}
            {renderGenericSection(record, idx, 'patient-concerns')}
            {renderGenericSection(record, idx, 'donor-site')}
            {renderGenericSection(record, idx, 'measurements')}
            {renderGenericSection(record, idx, 'preoperative-photography')}
            {renderGenericSection(record, idx, 'skin-analysis')}
            {renderGenericSection(record, idx, 'flap-assessment')}
            {renderGenericSection(record, idx, 'implant-data')}
            {renderGenericSection(record, idx, 'vascular-exam')}
            {renderGenericSection(record, idx, 'aesthetic-goals')}
            {renderGenericSection(record, idx, 'results')}
            {renderGenericSection(record, idx, 'findings-text')}
            {renderGenericSection(record, idx, 'assessment-text')}
            {renderGenericSection(record, idx, 'plan-text')}
            {renderGenericSection(record, idx, 'notes-text')}
            {renderGenericSection(record, idx, 'recommendations-list')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlasticSurgeryAssessmentDocument;
