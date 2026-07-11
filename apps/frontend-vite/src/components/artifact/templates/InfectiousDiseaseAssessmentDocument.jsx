/**
 * InfectiousDiseaseAssessmentDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: infectious_disease_assessment
 *
 * 8 Sections:
 *   1. session-info: date (date picker), provider (string), facility (string), status (string)
 *   2. hiv-status: hivStatus.cd4Count, hivStatus.cd4Percentage, hivStatus.viralLoad,
 *                  hivStatus.resistance (array), hivStatus.artRegimen (array)
 *   3. opportunistic-infections: opportunisticInfections[] ({infection, treatment, prophylaxis})
 *   4. hepatitis-panel: hepatitisPanel.hbsAg, hepatitisPanel.hbcAb, hepatitisPanel.hcvRna, hepatitisPanel.hcvGenotype
 *   5. antimicrobial-therapy: antimicrobialTherapy[] ({antibiotic, indication, duration, monitoring})
 *   6. cultures: cultures[] ({source, organism, sensitivity[]})
 *   7. assessment-plan: assessment (long), plan (long)
 *   8. notes: notes (string)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import InfectiousDiseaseAssessmentDocumentPDFTemplate from '../pdf-templates/InfectiousDiseaseAssessmentDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './InfectiousDiseaseAssessmentDocument.css';

/* ═══════ CONSTANTS ═══════ */
const API_BASE = '/api/edit/infectious_disease_assessment';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [editKey]: { field, value } } }  (editKey = localEdits key e.g. "fn-idx";
   field/value = the exact DB PUT payload the old code would have sent). */
const DRAFT_KEY = 'infectious_disease_assessmentPendingEdits';
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
  'session-info': 'Session Information',
  'hiv-status': 'HIV Status',
  'opportunistic-infections': 'Opportunistic Infections',
  'hepatitis-panel': 'Hepatitis Panel',
  'antimicrobial-therapy': 'Antimicrobial Therapy',
  'cultures': 'Cultures',
  'assessment-plan': 'Assessment & Plan',
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
  'hivStatus.cd4Count': 'CD4 Count',
  'hivStatus.cd4Percentage': 'CD4 Percentage',
  'hivStatus.viralLoad': 'Viral Load',
  'hivStatus.resistance': 'Resistance',
  'hivStatus.artRegimen': 'ART Regimen',
  'hepatitisPanel.hbsAg': 'HBsAg',
  'hepatitisPanel.hbcAb': 'HBcAb',
  'hepatitisPanel.hcvRna': 'HCV RNA',
  'hepatitisPanel.hcvGenotype': 'HCV Genotype',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  results: 'Results',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'type', 'provider', 'facility', 'status'],
  'hiv-status': ['hivStatus.cd4Count', 'hivStatus.cd4Percentage', 'hivStatus.viralLoad', 'hivStatus.resistance', 'hivStatus.artRegimen'],
  'opportunistic-infections': ['opportunisticInfections'],
  'hepatitis-panel': ['hepatitisPanel.hbsAg', 'hepatitisPanel.hbcAb', 'hepatitisPanel.hcvRna', 'hepatitisPanel.hcvGenotype'],
  'antimicrobial-therapy': ['antimicrobialTherapy'],
  'cultures': ['cultures'],
  'assessment-plan': ['findings', 'assessment', 'plan'],
  'recommendations': ['recommendations'],
  'results': ['results'],
  'notes': ['notes'],
};

const DATE_FIELDS = ['date'];

/* All long-text string fields that use splitBySentence + textarea editing */
const STRING_FIELDS = [
  'type', 'provider', 'facility', 'status',
  'hivStatus.cd4Count', 'hivStatus.cd4Percentage', 'hivStatus.viralLoad',
  'hepatitisPanel.hbsAg', 'hepatitisPanel.hbcAb', 'hepatitisPanel.hcvRna', 'hepatitisPanel.hcvGenotype',
  'findings', 'assessment', 'plan', 'notes',
];

/* Array-of-string fields rendered as tag lists */
const ARRAY_STRING_FIELDS = ['hivStatus.resistance', 'hivStatus.artRegimen'];

/* Array-of-objects fields rendered as mini-cards */
const ARRAY_OBJECT_FIELDS = ['opportunisticInfections', 'antimicrobialTherapy', 'cultures'];

/* Date-grouped array-of-objects fields ({recommendation, date}) */
const RECOMMENDATION_FIELDS = ['recommendations'];

/* Free-form object fields rendered as key/value editable rows */
const OBJECT_FIELDS = ['results'];

/* Sub-field definitions for array-of-objects */
const ARRAY_OBJECT_SUBFIELDS = {
  opportunisticInfections: [
    { key: 'infection', label: 'Infection' },
    { key: 'treatment', label: 'Treatment' },
    { key: 'prophylaxis', label: 'Prophylaxis' },
  ],
  antimicrobialTherapy: [
    { key: 'antibiotic', label: 'Antibiotic' },
    { key: 'indication', label: 'Indication' },
    { key: 'duration', label: 'Duration' },
    { key: 'monitoring', label: 'Monitoring' },
  ],
  cultures: [
    { key: 'source', label: 'Source' },
    { key: 'organism', label: 'Organism' },
    { key: 'sensitivity', label: 'Sensitivity', isArray: true },
  ],
};

/* ═══════ UTILITY FUNCTIONS ═══════ */
/* parseLabel: detect "Label: value" patterns (skip subordinate-clause openers) */
const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
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
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* Resolve nested dot-path values */
const resolvePath = (obj, path) => {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
};

/* Extract recommendation text from a {recommendation,date} object or plain string */
const recommendationText = (rec) => {
  if (rec === null || rec === undefined) return '';
  if (typeof rec === 'string') return rec;
  if (typeof rec === 'object') return String(rec.recommendation ?? rec.text ?? rec.value ?? '');
  return String(rec);
};

/* Extract a recommendation's date (raw value) for grouping */
const recommendationDate = (rec) => {
  if (rec && typeof rec === 'object') return rec.date || '';
  return '';
};

/* Group an array of recommendations by formatted date, preserving first-seen order */
const groupRecommendationsByDate = (arr) => {
  const order = [];
  const map = {};
  (arr || []).forEach((rec) => {
    const rawDate = recommendationDate(rec);
    const dateLabel = rawDate ? formatDate(rawDate) : '';
    const key = dateLabel || '__nodate__';
    if (!map[key]) { map[key] = { date: dateLabel, items: [] }; order.push(key); }
    const txt = recommendationText(rec);
    if (txt) map[key].items.push(txt);
  });
  return order.map((k) => map[k]).filter((g) => g.items.length > 0);
};

/* Format an object key (camelCase / snake_case) to a Title Case label */
const formatObjectKey = (key) => String(key)
  .replace(/_/g, ' ')
  .replace(/([A-Z])/g, ' $1')
  .replace(/^./, (s) => s.toUpperCase())
  .trim();

/* Format an arbitrary object value to a readable string */
const formatObjectValue = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.map((x) => (x && typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${formatObjectKey(k)}: ${val}`).join('; ');
  return String(v);
};

/* ═══════ COMPONENT ═══════ */
const InfectiousDiseaseAssessmentDocument = ({ document: docProp }) => {
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
      if (r?.infectious_disease_assessment) return Array.isArray(r.infectious_disease_assessment) ? r.infectious_disease_assessment : [r.infectious_disease_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.infectious_disease_assessment) return Array.isArray(dd.infectious_disease_assessment) ? dd.infectious_disease_assessment : [dd.infectious_disease_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = idOf(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([editKey, entry]) => {
        if (!entry || typeof entry !== 'object') return;
        // editKey is the localEdits key WITHOUT the trailing "-<storedIdx>"; rebind it to THIS idx.
        const localKey = `${editKey}-${idx}`;
        nLocal[localKey] = entry.value;
        nPending[localKey] = true;
        nFields[localKey] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

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
    return resolvePath(record, fn);
  }, [localEdits]);

  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  /* Stage a DRAFT locally (NO DB write). localStorage keeps it across refresh; Approve commits it.
     editKey = the localEdits key (e.g. "fn-idx"); dbField/value = the exact PUT payload Approve replays.
     idx is parsed from the trailing "-<idx>" of editKey so the draft is stored per-record. */
  const stageEdit = useCallback((record, editKey, dbField, value) => {
    const id = safeId(record); if (!id) return;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const dash = editKey.lastIndexOf('-');
    const idxPart = dash === -1 ? '' : editKey.slice(dash + 1);
    const draftKey = dash === -1 ? editKey : editKey.slice(0, dash);
    // Re-edit after approval → drop this section's approved flag so the button returns to yellow Pending.
    setApprovedSections(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (k.endsWith(`-${idxPart}`)) delete next[k]; });
      return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][draftKey] = { field: dbField, value };
    writeDrafts(store);
  }, [safeId]);

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
      if (ARRAY_OBJECT_FIELDS.includes(f) || RECOMMENDATION_FIELDS.includes(f)) {
        const arrVal = resolvePath(record, f);
        if (Array.isArray(arrVal)) {
          for (const item of arrVal) {
            if (item && typeof item === 'object') {
              for (const v of Object.values(item)) {
                if (v && String(v).toLowerCase().includes(phrase)) return true;
              }
            } else if (item && String(item).toLowerCase().includes(phrase)) return true;
          }
        }
        continue;
      }
      if (OBJECT_FIELDS.includes(f)) {
        const objVal = resolvePath(record, f);
        if (objVal && typeof objVal === 'object') {
          for (const [k, v] of Object.entries(objVal)) {
            if (k.toLowerCase().includes(phrase)) return true;
            if (v && String(v).toLowerCase().includes(phrase)) return true;
          }
        }
        continue;
      }
      const val = getFieldValue(record, f, 0);
      if (val !== null && val !== undefined) {
        if (Array.isArray(val)) {
          if (val.some(v => String(v).toLowerCase().includes(phrase))) return true;
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
      if (Array.isArray(val)) return val.some(v => String(v).toLowerCase().includes(phrase));
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Infectious Disease Assessment ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          if (ARRAY_OBJECT_FIELDS.includes(f) || RECOMMENDATION_FIELDS.includes(f)) {
            const arrVal = resolvePath(record, f);
            if (Array.isArray(arrVal)) {
              for (const item of arrVal) {
                if (item && typeof item === 'object') {
                  for (const v of Object.values(item)) {
                    if (v && String(v).toLowerCase().includes(phrase)) return true;
                    if (Array.isArray(v) && v.some(sv => String(sv).toLowerCase().includes(phrase))) return true;
                  }
                } else if (item && String(item).toLowerCase().includes(phrase)) return true;
              }
            }
            continue;
          }
          if (OBJECT_FIELDS.includes(f)) {
            const objVal = resolvePath(record, f);
            if (objVal && typeof objVal === 'object') {
              for (const [k, v] of Object.entries(objVal)) {
                if (k.toLowerCase().includes(phrase)) return true;
                if (v && String(v).toLowerCase().includes(phrase)) return true;
              }
            }
            continue;
          }
          const val = getFieldValue(record, f, idx);
          if (val && Array.isArray(val)) {
            if (val.some(v => String(v).toLowerCase().includes(phrase))) return true;
          } else if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
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
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const path = m[1];
          if (path.includes('.')) {
            const parts = path.split('.');
            let obj = merged;
            for (let i = 0; i < parts.length - 1; i++) {
              if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') obj[parts[i]] = {};
              obj = obj[parts[i]];
            }
            obj[parts[parts.length - 1]] = localEdits[key];
          } else {
            merged[path] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    // Stage as a DRAFT (no DB write). Approve commits it.
    stageEdit(record, `${fn}-${idx}`, fn, saveVal);
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
      stageEdit(record, `${fn}-${idx}`, fn, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setSaveError(null);
    stageEdit(record, `${fn}-${idx}`, fn, fullText);
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

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    try {
      // Which staged drafts belong to this section/record? Match localEdits keys ending in "-<idx>"
      // whose base field (before the trailing "-idx", first dot-segment) is in this section.
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(`-${idx}`)) return false;
        const base = k.slice(0, -`-${idx}`.length);
        const baseField = base.includes('.') ? base.slice(0, base.indexOf('.')) : base;
        return fields.includes(baseField) || fields.includes(base);
      });
      // Persist each staged field now using the exact PUT payload captured at save time.
      const store = readDrafts();
      const recDrafts = store[id] || {};
      for (const editKey of toCommit) {
        const draftKey = editKey.slice(0, -`-${idx}`.length);
        const entry = recDrafts[draftKey];
        const dbField = entry ? entry.field : (draftKey.includes('.') ? draftKey.slice(0, draftKey.indexOf('.')) : draftKey);
        const value = entry ? entry.value : localEdits[editKey];
        const resp = await secureApiClient.put(`${API_BASE}/${id}/edit`, { field: dbField, value });
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`${API_BASE}/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this section's committed drafts from localStorage
      if (store[id]) {
        toCommit.forEach(editKey => { delete store[id][editKey.slice(0, -`-${idx}`.length)]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

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
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => {
      if (ARRAY_OBJECT_FIELDS.includes(f) || RECOMMENDATION_FIELDS.includes(f)) {
        const arrVal = resolvePath(record, f);
        return Array.isArray(arrVal) && arrVal.length > 0;
      }
      if (OBJECT_FIELDS.includes(f)) {
        const objVal = resolvePath(record, f);
        return objVal && typeof objVal === 'object' && Object.keys(objVal).length > 0;
      }
      return hasVal(getFieldValue(record, f, idx));
    });
    if (!hasAnyVal) return '';
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'-'.repeat(40)}\n\n`;
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      if (ARRAY_OBJECT_FIELDS.includes(f)) {
        const arrVal = resolvePath(record, f);
        if (Array.isArray(arrVal) && arrVal.length > 0) {
          text += `${label}\n`;
          const subfields = ARRAY_OBJECT_SUBFIELDS[f] || [];
          arrVal.forEach((item, i) => {
            const titleField = subfields[0];
            const titleVal = titleField ? item[titleField.key] : null;
            text += `  ${i + 1}. ${titleVal || ''}\n`;
            subfields.slice(titleVal ? 1 : 0).forEach(sf => {
              const v = item[sf.key];
              if (!hasVal(v)) return;
              const dv = sf.isArray && Array.isArray(v) ? v.join(', ') : v;
              text += `     ${sf.label}\n       ${dv}\n`;
            });
          });
          text += '\n';
        }
        return;
      }
      if (RECOMMENDATION_FIELDS.includes(f)) {
        const arrVal = resolvePath(record, f);
        if (Array.isArray(arrVal) && arrVal.length > 0) {
          text += `${label}\n`;
          const grouped = groupRecommendationsByDate(arrVal);
          grouped.forEach(({ date, items }) => {
            if (date) text += `  ${date}\n`;
            items.forEach((rec, i) => { text += `    ${i + 1}. ${rec}\n`; });
          });
          text += '\n';
        }
        return;
      }
      if (OBJECT_FIELDS.includes(f)) {
        const objVal = resolvePath(record, f);
        if (objVal && typeof objVal === 'object' && Object.keys(objVal).length > 0) {
          text += `${label}\n`;
          Object.entries(objVal).forEach(([k, v]) => {
            text += `  ${formatObjectKey(k)}: ${formatObjectValue(v)}\n`;
          });
          text += '\n';
        }
        return;
      }
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        text += `${label}\n${formatDate(val)}\n\n`;
      } else if (ARRAY_STRING_FIELDS.includes(f)) {
        const arr = Array.isArray(val) ? val : [val];
        text += `${label}\n${arr.join(', ')}\n\n`;
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
    let text = '=== INFECTIOUS DISEASE ASSESSMENT ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Infectious Disease Assessment ${idx + 1}\n${'='.repeat(40)}\n\n`;
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

    /* Multi-sentence OR a single labeled "Label: v1, v2…" sentence: decompose (never side-by-side) */
    if (sentences.length > 1 || (sentences.length === 1 && parseLabel(sentences[0]).isLabeled)) {
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
                        const ciParsed = parseLabel(ci);
                        return (
                          <div key={ciIdx}>
                            {ciParsed.isLabeled && <div className="nested-subtitle">{highlightText(ciParsed.label)}</div>}
                            <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                              {ciEditing ? (
                                <div className="edit-field-container">
                                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                  {saveError && <div className="save-error">{saveError}</div>}
                                  <div className="edit-actions">
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setSaveError(null); stageEdit(record, `${fn}-${idx}`, fn, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                                    <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="row-content"><span className="content-value">{highlightText(ciParsed.isLabeled ? ciParsed.value : ci)}</span><span className="edit-indicator">&#9998;</span></div>
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
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setSaveError(null); stageEdit(record, `${fn}-${idx}`, fn, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: ARRAY-OF-STRING FIELD (resistance, artRegimen) ═══════ */
  const renderArrayStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const items = Array.isArray(val) ? val : [val];
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {items.map((item, iIdx) => {
          const itemStr = fmtVal(item);
          const itemKey = `${fn}-${idx}-i${iIdx}`;
          const itemEditing = editingField === itemKey;
          const itemBadge = editedFields[itemKey];
          const itemMatches = phraseMatch || labelMatch || (searchTerm.trim() && itemStr.toLowerCase().includes(searchTerm.toLowerCase().trim()));
          if (!itemMatches && searchTerm.trim()) return null;

          return (
            <div key={iIdx}>
              <div className={`numbered-row ${itemBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!itemEditing) { setEditingField(itemKey); setEditValue(itemStr); setSaveError(null); } }}>
                {itemEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentArr = Array.isArray(getFieldValue(record, fn, idx)) ? [...getFieldValue(record, fn, idx)] : []; currentArr[iIdx] = editValue.trim(); setSaveError(null); stageEdit(record, `${fn}-${idx}`, fn, currentArr); setEditedFields(prev => ({ ...prev, [itemKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {itemBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY-OF-OBJECTS FIELD (opportunisticInfections, antimicrobialTherapy, cultures) ═══════ */
  /* Array-of-objects render READ-ONLY: first sub-field value is the mini-card subtitle,
     each remaining populated sub-field is a decomposed value row (content-subtitle label
     ABOVE-of/beside the content-value — NEVER a baked-in "Label: value" string). */
  const renderArrayObjectField = (record, fn, idx, sid) => {
    const arrVal = resolvePath(record, fn);
    if (!Array.isArray(arrVal) || arrVal.length === 0) return null;
    const subfields = ARRAY_OBJECT_SUBFIELDS[fn] || [];
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    return arrVal.map((item, iIdx) => {
      if (!item || typeof item !== 'object') return null;
      /* Check if item matches search */
      if (searchTerm.trim() && !phraseMatch) {
        const phrase = searchTerm.toLowerCase().trim();
        const itemText = subfields.map(sf => {
          const v = item[sf.key];
          if (sf.isArray && Array.isArray(v)) return v.join(' ');
          return v ? String(v) : '';
        }).join(' ').toLowerCase();
        if (!itemText.includes(phrase)) return null;
      }

      const titleField = subfields[0];
      const titleVal = titleField ? item[titleField.key] : null;
      const restFields = subfields.slice(titleVal ? 1 : 0);

      return (
        <div key={`${fn}-${iIdx}`} className="rec-mini-card" style={{ marginTop: iIdx > 0 ? 8 : 0 }}>
          {titleVal && <div className="nested-subtitle">{highlightText(String(titleVal))}</div>}
          {restFields.map(sf => {
            const v = item[sf.key];
            if (!hasVal(v)) return null;
            const dispVal = sf.isArray && Array.isArray(v) ? v.join(', ') : fmtVal(v);
            const sfKey = `${fn}.${iIdx}.${sf.key}-${idx}`;
            return (
              <div key={sf.key} className="numbered-row">
                <div className="row-content">
                  <span className="content-subtitle">{highlightText(sf.label)}</span>
                  <span className="content-value">{highlightText(dispVal)}</span>
                </div>
                <button className={`copy-btn ${copiedItems[sfKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${sf.label}: ${dispVal}`, sfKey); }}>{copiedItems[sfKey] ? 'Copied!' : 'Copy'}</button>
              </div>
            );
          })}
        </div>
      );
    });
  };

  /* ═══════ RENDER: RECOMMENDATIONS (date-grouped array of {recommendation, date}) ═══════ */
  const renderRecommendationsField = (record, fn, idx, sid) => {
    const arrVal = resolvePath(record, fn);
    if (!Array.isArray(arrVal) || arrVal.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

    /* Build a flat index map so each recommendation has a stable position for editing */
    let flatIdx = 0;
    const groups = groupRecommendationsByDate(arrVal).map((g) => ({
      ...g,
      items: g.items.map((txt) => ({ txt, pos: flatIdx++ })),
    }));

    const saveRecommendation = (pos, newText) => {
      const id2 = safeId(record); if (!id2) return;
      const eff = getFieldValue(record, fn, idx);
      const current = Array.isArray(eff) ? eff : (Array.isArray(resolvePath(record, fn)) ? resolvePath(record, fn) : []);
      const updated = current.map((rec, i) => {
        if (i !== pos) return rec;
        if (rec && typeof rec === 'object') return { ...rec, recommendation: newText };
        return newText;
      });
      setSaveError(null);
      // Stage as a DRAFT (no DB write). Approve commits it.
      stageEdit(record, `${fn}-${idx}`, fn, updated);
      setEditedFields(prev => ({ ...prev, [`${fn}.${pos}-${idx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
    };

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {groups.map((g, gIdx) => {
          const groupItems = g.items.filter(({ txt }) => phraseMatch || labelMatch || !searchTerm.trim() || txt.toLowerCase().includes(searchTerm.toLowerCase().trim()));
          if (groupItems.length === 0) return null;
          return (
            <div key={gIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
              {g.date && <div className="nested-subtitle">{highlightText(g.date)}</div>}
              {groupItems.map(({ txt, pos }) => {
                const itemKey = `${fn}.${pos}-${idx}`;
                const itemEditing = editingField === itemKey;
                const itemBadge = editedFields[itemKey];
                return (
                  <div key={pos}>
                    <div className={`numbered-row ${itemBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!itemEditing) { setEditingField(itemKey); setEditValue(txt); setSaveError(null); } }}>
                      {itemEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveRecommendation(pos, editValue.trim()); }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(txt)}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(txt, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {itemBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: FREE-FORM OBJECT FIELD (results) — key/value editable rows ═══════ */
  const renderObjectField = (record, fn, idx, sid) => {
    const objVal = resolvePath(record, fn);
    if (!objVal || typeof objVal !== 'object' || Array.isArray(objVal) || Object.keys(objVal).length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

    const entries = Object.entries(objVal).filter(([k, v]) => {
      if (phraseMatch || labelMatch || !searchTerm.trim()) return true;
      const p = searchTerm.toLowerCase().trim();
      return k.toLowerCase().includes(p) || String(formatObjectValue(v)).toLowerCase().includes(p);
    });
    if (entries.length === 0) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {entries.map(([k, v]) => {
          const sfKey = `${fn}.${k}-${idx}`;
          const sfEditing = editingField === sfKey;
          const sfBadge = editedFields[sfKey];
          const keyLabel = formatObjectKey(k);
          const effV = localEdits[sfKey] !== undefined ? localEdits[sfKey] : v;
          const dispVal = formatObjectValue(effV);
          const isScalar = v === null || v === undefined || typeof v !== 'object';
          return (
            <div key={k}>
              <div className={`numbered-row ${sfBadge ? 'modified' : ''} ${isScalar ? 'editable-row' : ''}`} onClick={() => { if (isScalar && !sfEditing) { setEditingField(sfKey); setEditValue(dispVal); setSaveError(null); } }}>
                {isScalar && sfEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; setSaveError(null); const sv = editValue.trim(); stageEdit(record, sfKey, `${fn}.${k}`, sv); setEditedFields(prev => ({ ...prev, [sfKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="sub-label">{keyLabel}:</span> <span className="content-value">{highlightText(dispVal)}</span>{isScalar && <span className="edit-indicator">&#9998;</span>}</div>
                    <button className={`copy-btn ${copiedItems[sfKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${keyLabel}: ${dispVal}`, sfKey); }}>{copiedItems[sfKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {sfBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
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
      if (ARRAY_OBJECT_FIELDS.includes(f) || RECOMMENDATION_FIELDS.includes(f)) {
        const arrVal = resolvePath(record, f);
        return Array.isArray(arrVal) && arrVal.length > 0;
      }
      if (OBJECT_FIELDS.includes(f)) {
        const objVal = resolvePath(record, f);
        return objVal && typeof objVal === 'object' && Object.keys(objVal).length > 0;
      }
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
            if (RECOMMENDATION_FIELDS.includes(f)) return renderRecommendationsField(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            if (ARRAY_OBJECT_FIELDS.includes(f)) return renderArrayObjectField(record, f, idx, sid);
            if (ARRAY_STRING_FIELDS.includes(f)) return renderArrayStringField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="infectious-disease-assessment-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Infectious Disease Assessment</h2></div>
        <div className="empty-state">No infectious disease assessment records available</div>
      </div>
    );
  }

  return (
    <div className="infectious-disease-assessment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Infectious Disease Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<InfectiousDiseaseAssessmentDocumentPDFTemplate document={pdfData} />} fileName="Infectious_Disease_Assessment.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search infectious disease assessments..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Infectious Disease Assessment ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'session-info')}
            {renderSection(record, idx, 'hiv-status')}
            {renderSection(record, idx, 'opportunistic-infections')}
            {renderSection(record, idx, 'hepatitis-panel')}
            {renderSection(record, idx, 'antimicrobial-therapy')}
            {renderSection(record, idx, 'cultures')}
            {renderSection(record, idx, 'assessment-plan')}
            {renderSection(record, idx, 'recommendations')}
            {renderSection(record, idx, 'results')}
            {renderSection(record, idx, 'notes')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default InfectiousDiseaseAssessmentDocument;
