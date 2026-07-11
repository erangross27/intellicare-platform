/**
 * CkdAssessmentDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: ckd_assessment
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import CkdAssessmentDocumentPDFTemplate from '../pdf-templates/CkdAssessmentDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './CkdAssessmentDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field", "field.arrayIndex", or "root.dotted.path") */
const DRAFT_KEY = 'ckd_assessmentPendingEdits';
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
  ckdStage: 'CKD Stage & Labs',
  egfrTrend: 'eGFR Trend',
  creatinineTrend: 'Creatinine Trend',
  progression: 'Progression',
  riskFactors: 'Risk Factors',
  chronicity: 'Chronicity',
  findings: 'Findings',
  clinical: 'Clinical Assessment',
  plan: 'Plan',
  results: 'Results',
  recommendations: 'Recommendations',
  providerInfo: 'Provider Information',
  notes: 'Notes',
};

const FIELD_LABELS = {
  stage: 'CKD Stage', egfr: 'eGFR', creatinine: 'Creatinine', bun: 'BUN',
  bunCreatinineRatio: 'BUN/Creatinine Ratio', progressionRate: 'Progression Rate',
  etiology: 'Etiology', assessment: 'Assessment', plan: 'Plan',
  provider: 'Provider', facility: 'Facility', status: 'Status',
  notes: 'Notes', findings: 'Findings', progressionRiskFactors: 'Risk Factors',
  chronicity: 'Chronicity', results: 'Results',
};

const SECTION_FIELDS = {
  ckdStage: ['stage', 'egfr', 'creatinine', 'bun', 'bunCreatinineRatio'],
  progression: ['progressionRate', 'etiology'],
  riskFactors: ['progressionRiskFactors'],
  chronicity: ['chronicity'],
  findings: ['findings'],
  clinical: ['assessment'],
  plan: ['plan'],
  results: ['results'],
  providerInfo: ['provider', 'facility', 'status'],
  notes: ['notes'],
};

const ARRAY_FIELDS = ['progressionRiskFactors'];
const SENTENCE_FIELDS = ['assessment', 'plan', 'notes', 'findings'];
const OBJECT_FIELDS = ['chronicity', 'results'];
// Number(+unit) metric fields → edit the NUMBER via a −/+ stepper, unit left untouched (splitNumberUnit).
// Explicit list (NOT value-shape detection) so dates/text are never stepped.
const NUMERIC_UNIT_FIELDS = ['egfr', 'creatinine', 'bun', 'progressionRate'];
// Fixed-choice fields → dropdown; status = Active/Not Active (unmatched current value kept as option).
const ENUM_FIELDS = { status: ['Active', 'Not Active'] };
const enumOptionsWith = (opts, current) => { const cur = String(current ?? '').trim(); return cur && !opts.some(o => o.toLowerCase() === cur.toLowerCase()) ? [cur, ...opts] : opts; };
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

const KEY_OVERRIDES = { ckd: 'CKD', egfr: 'eGFR', bun: 'BUN', gfr: 'GFR', mdrd: 'MDRD' };
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
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const objectCopyLines = (label, value, indent) => {
  const out = [];
  const pad = '  '.repeat(indent);
  if (isEmptyDeep(value)) return out;
  if (isScalar(value)) { out.push(`${pad}${label ? label + ': ' : ''}${fmtScalar(value)}`); return out; }
  if (label) out.push(`${pad}${label}`);
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectCopyLines(humanizeKey(k), v, indent + (label ? 1 : 0))));
  return out;
};
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};

const CkdAssessmentDocument = ({ document: docProp }) => {
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
  // editKeys (`${rootField}-${idx}`) that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const containerRef = useRef(null);

  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.ckd_assessment) return Array.isArray(r.ckd_assessment) ? r.ckd_assessment : [r.ckd_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.ckd_assessment) return Array.isArray(dd.ckd_assessment) ? dd.ckd_assessment : [dd.ckd_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  const safeId = useCallback((record) => {
    if (!record?._id) return null;
    if (typeof record._id === 'string') return record._id;
    if (record._id.$oid) return record._id.$oid;
    return String(record._id);
  }, []);

  // Treat a dot-suffix as an arrayIndex ONLY when the segment after the LAST dot is purely numeric.
  // "socialDeterminants.housing" -> base="socialDeterminants.housing" (no arrayIndex);
  // "progressionRiskFactors.2"   -> base="progressionRiskFactors", arrayIndex=2.
  const parseFieldPart = (fieldPart) => {
    const dot = fieldPart.lastIndexOf('.');
    if (dot !== -1 && /^\d+$/.test(fieldPart.slice(dot + 1))) {
      return { rootField: fieldPart.slice(0, dot), arrayIndex: parseInt(fieldPart.slice(dot + 1), 10) };
    }
    return { rootField: fieldPart, arrayIndex: null };
  };

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = safeId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const { rootField, arrayIndex } = parseFieldPart(fieldPart);
        const localKey = `${rootField}-${idx}`;
        if (arrayIndex !== null) {
          // Array element edit: localEdits holds the full array.
          const base = nLocal[localKey] !== undefined
            ? nLocal[localKey]
            : (Array.isArray(record[rootField]) ? [...record[rootField]] : []);
          const arr = Array.isArray(base) ? [...base] : [];
          arr[arrayIndex] = value;
          nLocal[localKey] = arr;
          nFields[`${rootField}-${idx}-ai${arrayIndex}`] = 'edited';
        } else if (rootField !== fieldPart) {
          // Dotted (non-numeric) leaf edit: localEdits holds the full cloned object keyed by the true root.
          const trueRoot = fieldPart.split('.')[0];
          const objKey = `${trueRoot}-${idx}`;
          const curBase = nLocal[objKey] !== undefined ? nLocal[objKey] : record[trueRoot];
          const clone = JSON.parse(JSON.stringify(curBase ?? {}));
          const fullPath = fieldPart.split('.').slice(1);
          let node = clone;
          for (let i = 0; i < fullPath.length - 1; i++) { if (node[fullPath[i]] === undefined) node[fullPath[i]] = {}; node = node[fullPath[i]]; }
          node[fullPath[fullPath.length - 1]] = value;
          nLocal[objKey] = clone;
          nPending[objKey] = true;
          nFields[`${trueRoot}-${idx}-${fullPath.join('.')}`] = 'edited';
          return;
        } else {
          // Plain scalar / sentence field: localEdits holds the full value.
          nLocal[localKey] = value;
          nFields[`${rootField}-${idx}`] = 'edited';
        }
        nPending[localKey] = true;
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    if (Object.keys(nSentences).length) setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records, safeId]);

  const hasVal = useCallback((v) => {
    if (v === null || v === undefined || v === '') return false;
    if (typeof v === 'boolean') return true;
    if (typeof v === 'number') return true;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  }, []);

  const formatDate = useCallback((d) => {
    if (!d) return '';
    try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); }
  }, []);

  const fmtVal = useCallback((v) => {
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'number') return String(v);
    return String(v || '');
  }, []);

  // Sentence split with abbreviation+decimal guard (never breaks "vs."/"Dr."/"3.5"/"i.e.").
  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => {
      let clean = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) clean += '.';
      return clean;
    }).join(' ');
  }

  const getFieldValue = useCallback((record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    return record[fieldName];
  }, [localEdits]);

  const getEffectiveArray = useCallback((record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) {
      const v = localEdits[editKey];
      return Array.isArray(v) ? v : [v];
    }
    return Array.isArray(record[fieldName]) ? record[fieldName] : [];
  }, [localEdits]);

  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || !text) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = String(text).split(regex);
    return parts.map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part);
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
      if (Array.isArray(val)) {
        if (val.some(item => String(item).toLowerCase().includes(phrase))) return true;
      } else if (val && typeof val === 'object') {
        if (flattenSearchable(val).toLowerCase().includes(phrase)) return true;
      } else if (val !== null && val !== undefined) {
        if (fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const fieldMatches = useCallback((record, fieldName, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fieldName] || fieldName).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fieldName, idx);
    if (Array.isArray(val)) return val.some(item => String(item).toLowerCase().includes(phrase));
    if (val && typeof val === 'object') return flattenSearchable(val).toLowerCase().includes(phrase);
    return val !== null && val !== undefined && fmtVal(val).toLowerCase().includes(phrase);
  }, [searchTerm, getFieldValue, fmtVal]);

  const sectionTitleMatches = useCallback((sectionId) => {
    if (!searchTerm.trim()) return false;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sectionId] || '').toLowerCase();
    return title.includes(phrase) || phrase.includes(title);
  }, [searchTerm]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const recordTitle = `CKD Assessment ${idx + 1}`.toLowerCase();
      if (recordTitle.includes(phrase) || phrase.includes(recordTitle)) {
        record._showAllSections = true;
        return true;
      }
      const allTitles = Object.values(SECTION_TITLES);
      for (const t of allTitles) {
        if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true;
      }
      const allLabels = Object.values(FIELD_LABELS);
      for (const l of allLabels) {
        if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true;
      }
      for (const f of Object.keys(FIELD_LABELS)) {
        const val = record[f];
        if (Array.isArray(val)) {
          if (val.some(item => String(item).toLowerCase().includes(phrase))) return true;
        } else if (val && typeof val === 'object') {
          if (flattenSearchable(val).toLowerCase().includes(phrase)) return true;
        } else if (val !== null && val !== undefined) {
          if (fmtVal(val).toLowerCase().includes(phrase)) return true;
        }
      }
      if (Array.isArray(record.egfrTrend) && record.egfrTrend.some(t => `${t.date} ${t.value}`.toLowerCase().includes(phrase))) return true;
      if (Array.isArray(record.creatinineTrend) && record.creatinineTrend.some(t => `${t.date} ${t.value}`.toLowerCase().includes(phrase))) return true;
      if (Array.isArray(record.recommendations) && record.recommendations.some(r => (r.recommendation || '').toLowerCase().includes(phrase))) return true;
      return false;
    });
  }, [records, searchTerm, fmtVal]);

  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const match = key.match(/^(.+)-(\d+)$/);
        if (match && parseInt(match[2]) === idx) merged[match[1]] = localEdits[key];
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  // ========== EDIT FUNCTIONS ==========
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, overrideValue) => {
    const id = safeId(record);
    if (!id) return;
    const valueToSave = overrideValue !== undefined ? overrideValue : editValue;
    const isArray = ARRAY_FIELDS.includes(fieldName);
    const localKey = `${fieldName}-${idx}`;
    const editKey = editingField;
    let fieldPart = fieldName;
    if (isArray) {
      const arrMatch = editKey?.match(/-ai(\d+)$/);
      const arrayIndex = arrMatch ? parseInt(arrMatch[1]) : null;
      if (arrayIndex === null) return;
      fieldPart = `${fieldName}.${arrayIndex}`;
      const arr = [...getEffectiveArray(record, fieldName, idx)];
      arr[arrayIndex] = valueToSave;
      setLocalEdits(prev => ({ ...prev, [localKey]: arr }));
      setEditedFields(prev => ({ ...prev, [`${fieldName}-${idx}-ai${arrayIndex}`]: 'edited' }));
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][fieldPart] = valueToSave;
      writeDrafts(store);
    } else {
      setLocalEdits(prev => ({ ...prev, [localKey]: valueToSave }));
      setEditedFields(prev => ({ ...prev, [`${fieldName}-${idx}`]: 'edited' }));
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][fieldPart] = valueToSave;
      writeDrafts(store);
    }
    setPendingEdits(prev => ({ ...prev, [localKey]: true }));
    // Re-edit after approval → drop the section 'approved' flag so the button returns to yellow Pending Approve
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });
    setEditingField(null);
    setEditValue('');
  }, [editingField, editValue, safeId, getEffectiveArray]);

  // Save one sentence = stage the reconstructed full text as a DRAFT (no DB write). localStorage
  // keeps it across refresh; the section Pending Approve button commits it.
  function saveSentence(record, fieldName, idx, sectionId, sentenceIdx) {
    const id = safeId(record);
    if (!id) return;
    const localKey = `${fieldName}-${idx}`;
    const stageDraft = (fullText) => {
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][fieldName] = fullText;
      writeDrafts(store);
      setLocalEdits(prev => ({ ...prev, [localKey]: fullText }));
      setPendingEdits(prev => ({ ...prev, [localKey]: true }));
      setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });
      setEditingField(null);
      setEditValue('');
    };
    const currentVal = String(getFieldValue(record, fieldName, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();

    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences];
      updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setEditedFields(prev => ({ ...prev, [`${fieldName}-${idx}`]: 'edited' }));
      stageDraft(fullText);
      return;
    }

    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences];
    updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    const originalSentence = sentences[sentenceIdx] || '';
    const originalChanged = newSentences[0].replace(/[;.]+$/, '').trim() !== originalSentence.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (originalChanged) n[`${fieldName}-${idx}-s${sentenceIdx}`] = 'edited';
      const extraCount = newSentences.length - 1;
      for (let ei = 0; ei < extraCount; ei++) {
        n[`${fieldName}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      }
      return n;
    });
    stageDraft(fullText);
  }

  const sectionHasEdits = useCallback((idx, sectionId) => {
    const fields = SECTION_FIELDS[sectionId] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sectionId, idx) => {
    const approveKey = `${sectionId}-${idx}`;
    const id = safeId(record);
    if (!id) return;
    setSaving(true);
    try {
      const fields = SECTION_FIELDS[sectionId] || [];
      const store = readDrafts();
      const recDrafts = store[id] || {};
      // Drafts belonging to this section (base field name in this section's field list)
      const toCommit = Object.keys(recDrafts).filter(fieldPart => {
        const baseField = fieldPart.split('.')[0];
        return fields.includes(baseField);
      });
      // Persist each staged field now: field (+ arrayIndex only when the trailing dot-segment is purely numeric)
      for (const fieldPart of toCommit) {
        const dot = fieldPart.lastIndexOf('.');
        const isArrayIdx = dot !== -1 && /^\d+$/.test(fieldPart.slice(dot + 1));
        const payload = isArrayIdx
          ? { field: fieldPart.slice(0, dot), value: recDrafts[fieldPart], arrayIndex: parseInt(fieldPart.slice(dot + 1), 10) }
          : { field: fieldPart, value: recDrafts[fieldPart] };
        await secureApiClient.put(`/api/edit/ckd_assessment/${id}/edit`, payload);
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/ckd_assessment/${id}/approve`, { sectionId, approved: true });

      // Clear pending for this section's localEdits keys → committed values now flow into pdfData/PDF
      const localKeysCleared = new Set(toCommit.map(fp => `${fp.split('.')[0]}-${idx}`));
      setPendingEdits(prev => {
        const next = { ...prev };
        localKeysCleared.forEach(k => delete next[k]);
        return next;
      });
      // Drop this section's drafts from localStorage (now committed)
      toCommit.forEach(fp => delete recDrafts[fp]);
      if (Object.keys(recDrafts).length === 0) delete store[id];
      else store[id] = recDrafts;
      writeDrafts(store);

      setApprovedSections(prev => ({ ...prev, [approveKey]: true }));
      setEditedFields(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete next[k]; }); });
        return next;
      });
      setEditedSentences(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete next[k]; }); });
        return next;
      });
    } catch (err) { console.error('[CkdAssessment] Approve error:', err); }
    finally { setSaving(false); }
  }, [safeId]);

  const renderApproveButton = useCallback((record, sectionId, idx) => {
    const approveKey = `${sectionId}-${idx}`;
    const isApproved = approvedSections[approveKey] || record.approvedSections?.[sectionId];
    const hasEdits = sectionHasEdits(idx, sectionId);
    if (hasEdits) {
      return (<button className="approve-btn pending" disabled={saving} onClick={(e) => { e.stopPropagation(); handleApproveSection(record, sectionId, idx); }}>{saving ? 'Approving...' : 'Pending Approve'}</button>);
    }
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [approvedSections, sectionHasEdits, handleApproveSection]);

  // ========== COPY HELPERS ==========
  const copyToClipboard = useCallback(async (text) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = window.document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        (containerRef.current || window.document.body).appendChild(ta);
        ta.select();
        window.document.execCommand('copy');
        (containerRef.current || window.document.body).removeChild(ta);
      }
      return true;
    } catch { return false; }
  }, []);

  const copySection = useCallback(async (text, sectionId) => {
    const ok = await copyToClipboard(text);
    if (ok) { setCopiedSection(sectionId); setTimeout(() => setCopiedSection(null), 2000); }
  }, [copyToClipboard]);

  const copyItem = useCallback(async (text, itemId) => {
    const ok = await copyToClipboard(text);
    if (ok) { setCopiedItems(prev => ({ ...prev, [itemId]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [itemId]: false })), 2000); }
  }, [copyToClipboard]);

  // One top-level field → copy lines. Sub-label + DASH unless it equals the section title (single-name);
  // arrays/sentences number each row; scalars get "1."; object fields recurse (label + DASH).
  const emitField = useCallback((record, f, title) => {
    const label = FIELD_LABELS[f] || f;
    const val = record[f];
    if (!hasVal(val)) return '';
    const showLbl = label.toLowerCase() !== (title || '').toLowerCase();
    let out = '';
    if (OBJECT_FIELDS.includes(f) && !isScalar(val)) {
      if (showLbl) out += `${label}\n${COPY_LINE_DASH}\n`;
      objectCopyLines('', val, 0).forEach(l => { out += `${l}\n`; });
      return out + '\n';
    }
    if (showLbl) out += `${label}\n${COPY_LINE_DASH}\n`;
    if (Array.isArray(val)) { val.forEach((item, i) => { out += `${i + 1}. ${item}\n`; }); }
    else if (SENTENCE_FIELDS.includes(f)) { splitBySentence(fmtVal(val)).forEach((s, i) => { out += `${i + 1}. ${s}\n`; }); }
    else { out += `1. ${fmtVal(val)}\n`; }
    return out + '\n';
  }, [hasVal, fmtVal, splitBySentence]);

  // Grouped trend/recommendations: numbering restarts at each labeled (dated) group, else continues.
  const emitGrouped = useCallback((rows, getKey, getDate, getText) => {
    const gs = [];
    rows.forEach(r => { const d = getDate(r) ? String(getDate(r)) : ''; const last = gs[gs.length - 1]; if (last && last.k === d) last.items.push(getText(r)); else gs.push({ k: d, date: getDate(r) || null, items: [getText(r)] }); });
    let out = ''; let n = 0;
    gs.forEach(g => { if (g.date) { n = 0; out += `${formatDate(g.date)}\n${COPY_LINE_DASH}\n`; } g.items.forEach(it => { out += `${++n}. ${it}\n`; }); });
    return out;
  }, [formatDate]);

  const buildSectionCopyText = useCallback((record, idx, sectionId) => {
    const title = SECTION_TITLES[sectionId] || sectionId;
    const pr = pdfData[idx] || record;
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    if (sectionId === 'egfrTrend' || sectionId === 'creatinineTrend') {
      (Array.isArray(pr[sectionId]) ? pr[sectionId] : []).forEach((t, i) => { text += `${i + 1}. ${t.date || ''}: ${t.value || ''}\n`; });
    } else if (sectionId === 'recommendations') {
      text += emitGrouped((Array.isArray(pr.recommendations) ? pr.recommendations : []).filter(r => r?.recommendation), r => r.date, r => r.date, r => r.recommendation);
    } else {
      (SECTION_FIELDS[sectionId] || []).forEach(f => { text += emitField(pr, f, title); });
    }
    return text;
  }, [pdfData, emitField, emitGrouped]);

  const copyAllText = useCallback(async () => {
    let text = `CKD ASSESSMENT\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((record, idx) => {
      text += `CKD Assessment ${idx + 1}\n${COPY_LINE_EQ}\n`;
      if (record.date) text += `${formatDate(record.date)}\n`;
      Object.keys(SECTION_TITLES).forEach(sid => {
        const title = SECTION_TITLES[sid];
        if (sid === 'egfrTrend' || sid === 'creatinineTrend') {
          const trend = Array.isArray(record[sid]) ? record[sid] : [];
          if (trend.length > 0) { text += `\n${title}\n${COPY_LINE_EQ}\n`; trend.forEach((t, i) => { text += `${i + 1}. ${t.date || ''}: ${t.value || ''}\n`; }); }
        } else if (sid === 'recommendations') {
          const recs = Array.isArray(record.recommendations) ? record.recommendations.filter(r => r?.recommendation) : [];
          if (recs.length > 0) { text += `\n${title}\n${COPY_LINE_EQ}\n`; text += emitGrouped(recs, r => r.date, r => r.date, r => r.recommendation); }
        } else {
          const fields = SECTION_FIELDS[sid] || [];
          if (!fields.some(f => hasVal(record[f]))) return;
          text += `\n${title}\n${COPY_LINE_EQ}\n`;
          fields.forEach(f => { text += emitField(record, f, title); });
        }
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, hasVal, formatDate, emitField, emitGrouped]);

  // Save an object leaf = stage a DRAFT (no DB write). The dotted path is the localStorage fieldPart;
  // the section Pending Approve button commits it to MongoDB.
  const saveLeaf = useCallback((record, rootField, path, idx, sectionId, leafKeyTrack, newVal) => {
    const id = safeId(record);
    if (!id) return;
    const dottedField = `${rootField}.${path.join('.')}`;
    const localKey = `${rootField}-${idx}`;
    setLocalEdits(prev => {
      const cur = prev[localKey] !== undefined ? prev[localKey] : record[rootField];
      const clone = JSON.parse(JSON.stringify(cur ?? {}));
      let node = clone;
      for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
      node[path[path.length - 1]] = newVal;
      return { ...prev, [localKey]: clone };
    });
    setPendingEdits(prev => ({ ...prev, [localKey]: true }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][dottedField] = newVal;
    writeDrafts(store);
    setEditingField(null);
    setEditValue('');
  }, [safeId]);

  // ========== RENDER HELPERS ==========
  const renderObjectLeaf = (record, rootField, path, idx, sectionId, value) => {
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
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(editStartValue); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : (ratio || nu) ? (
                <div className="number-edit-row">
                  <input type="number" step="any" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />
                  {ratio ? <span className="number-edit-unit">{`/ ${ratio.denom}`}</span> : (nu.unit && <span className="number-edit-unit">{nu.unit}</span>)}
                </div>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />
              )}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => {
                  e.stopPropagation();
                  let newVal;
                  if (isBool) { newVal = editValue === 'yes'; }
                  else if (ratio) { const n = parseFloat(editValue); if (isNaN(n)) return; newVal = `${n}/${ratio.denom}`; }
                  else if (nu) { const n = parseFloat(editValue); if (isNaN(n)) return; newVal = nu.unit ? `${n}${nu.sep || ' '}${nu.unit}` : String(n); }
                  else { newVal = editValue.trim(); }
                  saveLeaf(record, rootField, path, idx, sectionId, leafKey, newVal);
                }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button>
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

  const renderObjectNode = (record, rootField, idx, sectionId, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sectionId, value);
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && <div className={labelClass}>{highlightText(label)}</div>}
        <div className="nested-group">
          {entries.map(([k, v]) => (
            isScalar(v) ? renderObjectLeaf(record, rootField, [...path, k], idx, sectionId, v)
              : <div className="nested-mini-card" key={k}>{renderObjectNode(record, rootField, idx, sectionId, humanizeKey(k), v, [...path, k], depth + 1)}</div>
          ))}
        </div>
      </React.Fragment>
    );
  };

  const renderObjectField = (record, fieldName, idx, sectionId, title) => {
    const val = getFieldValue(record, fieldName, idx);
    if (!hasVal(val) || isScalar(val)) return null;
    const label = FIELD_LABELS[fieldName] || fieldName;
    const showSubLabel = label.trim().toLowerCase() !== (title || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fieldName, idx) && !sectionTitleMatches(sectionId)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div key={fieldName} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([k, v]) => (
          isScalar(v) ? renderObjectLeaf(record, fieldName, [k], idx, sectionId, v)
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fieldName, idx, sectionId, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    );
  };

  const renderEditableField = (record, fieldName, idx, sectionId, title) => {
    const val = getFieldValue(record, fieldName, idx);
    if (!hasVal(val)) return null;
    const editKey = `${fieldName}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fieldName] || fieldName;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    const itemId = `${fieldName}-${idx}`;

    if (searchTerm.trim() && !fieldMatches(record, fieldName, idx) && !sectionTitleMatches(sectionId)) return null;

    // Widget selection: fixed-choice → enum <select>; number(+unit) → −/+ stepper editing ONLY the
    // number (unit preserved verbatim); else textarea. Edit-only: stored string is unchanged.
    const isEnum = !!ENUM_FIELDS[fieldName];
    const nu = (!isEnum && NUMERIC_UNIT_FIELDS.includes(fieldName)) ? splitNumberUnit(displayVal) : null;
    const enumOpts = isEnum ? enumOptionsWith(ENUM_FIELDS[fieldName], displayVal) : null;
    const startEditVal = isEnum ? (enumOpts.find(o => o.toLowerCase() === displayVal.toLowerCase()) || displayVal) : nu ? nu.num : displayVal;
    const st = nu ? (parseFloat(stepFor(nu.num)) || 1) : 1;
    const dec = (String(st).split('.')[1] || '').length;
    const bump = (d) => { const cur = parseFloat(editValue); setEditValue((Math.max(0, (isNaN(cur) ? 0 : cur) + d)).toFixed(dec)); };
    const saveNumUnit = () => { const n = parseFloat(editValue); if (isNaN(n)) return; handleSaveField(record, fieldName, idx, sectionId, nu.unit ? `${n}${nu.sep || ' '}${nu.unit}` : String(n)); };

    return (
      <div key={fieldName}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(startEditVal); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isEnum ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}>
                  {enumOpts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : nu ? (
                <div className="num-stepper-row">
                  <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); bump(-st); }}>−</button>
                  <input type="number" step={stepFor(nu.num)} min="0" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } else if (e.key === 'Enter') { e.preventDefault(); saveNumUnit(); } }} />
                  <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); bump(st); }}>+</button>
                  {nu.unit && <span className="number-edit-unit">{nu.unit}</span>}
                </div>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />
              )}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (nu) saveNumUnit(); else handleSaveField(record, fieldName, idx, sectionId); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content">
                <span className="content-value">{highlightText(displayVal)}</span>
                <span className="edit-indicator">✎</span>
              </div>
              <button className={`copy-btn ${copiedItems[itemId] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, itemId); }}>{copiedItems[itemId] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">{isModified === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
      </div>
    );
  };

  const renderSentenceEditableField = (record, fieldName, idx, sectionId, title) => {
    const val = String(getFieldValue(record, fieldName, idx) || '');
    if (!val.trim()) return null;
    const sentences = splitBySentence(val);
    if (sentences.length === 0) return null;
    const label = FIELD_LABELS[fieldName] || fieldName;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sectionId);

    return (
      <div key={fieldName}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="rec-mini-card">
          {sentences.map((sentence, sIdx) => {
            const sentenceKey = `${fieldName}-${idx}-s${sIdx}`;
            const isEditing = editingField === sentenceKey;
            const badge = editedSentences[sentenceKey];
            const sentenceMatches = phraseMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!sentenceMatches && searchTerm.trim()) return null;
            return (
              <div key={sIdx}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(sentence.replace(/[;.]+$/, '').trim()); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fieldName, idx, sectionId, sIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content">
                        <span className="content-value">{highlightText(sentence)}</span>
                        <span className="edit-indicator">✎</span>
                      </div>
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

  const renderArraySection = (record, fieldName, idx, sectionId, title) => {
    const arr = getEffectiveArray(record, fieldName, idx);
    if (arr.length === 0) return null;
    const label = FIELD_LABELS[fieldName] || fieldName;
    const sl = label.toLowerCase() !== title.toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sectionId);

    return (
      <div key={fieldName}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="rec-mini-card">
          {arr.map((item, ai) => {
            const editKey = `${fieldName}-${idx}-ai${ai}`;
            const isEditing = editingField === editKey;
            const badge = editedFields[editKey];
            const itemMatches = phraseMatch || (searchTerm.trim() && String(item).toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!itemMatches && searchTerm.trim()) return null;
            return (
              <div key={ai}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(item)); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fieldName, idx, sectionId); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content">
                        <span className="content-value">{highlightText(String(item))}</span>
                        <span className="edit-indicator">✎</span>
                      </div>
                      <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(item), editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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

  const renderMixedSection = (record, idx, sectionId) => {
    const title = SECTION_TITLES[sectionId];
    if (!shouldShowSection(record, sectionId)) return null;
    const fields = SECTION_FIELDS[sectionId] || [];
    const hasAnyVal = fields.some(f => {
      if (ARRAY_FIELDS.includes(f)) return getEffectiveArray(record, f, idx).length > 0;
      if (OBJECT_FIELDS.includes(f)) { const v = getFieldValue(record, f, idx); return hasVal(v) && !isScalar(v); }
      return hasVal(getFieldValue(record, f, idx));
    });
    if (!hasAnyVal) return null;
    const copyId = `${sectionId}-${idx}`;

    return (
      <div key={sectionId} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sectionId), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sectionId, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (ARRAY_FIELDS.includes(f)) return renderArraySection(record, f, idx, sectionId, title);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sectionId, title);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sectionId, title);
            return renderEditableField(record, f, idx, sectionId, title);
          })}
        </div>
      </div>
    );
  };

  const renderTrendSection = (record, idx, sectionId, fieldName) => {
    const trend = Array.isArray(record[fieldName]) ? record[fieldName] : [];
    if (trend.length === 0) return null;
    const title = SECTION_TITLES[sectionId];
    const isSearching = searchTerm.trim().length > 0;
    if (isSearching && !record._showAllSections) {
      const phrase = searchTerm.toLowerCase().trim();
      const tl = title.toLowerCase();
      const titleMatch = tl.includes(phrase) || phrase.includes(tl);
      if (!titleMatch && !trend.some(t => `${t.date} ${t.value}`.toLowerCase().includes(phrase))) return null;
    }
    const titleMatch = sectionTitleMatches(sectionId);
    const copyId = `${sectionId}-${idx}`;
    return (
      <div key={sectionId} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sectionId), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
            </div>
          </div>
          {trend.map((t, ti) => {
            if (isSearching && !record._showAllSections && !titleMatch) {
              const phrase = searchTerm.toLowerCase().trim();
              if (!`${t.date} ${t.value}`.toLowerCase().includes(phrase)) return null;
            }
            return (
              <div key={ti} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(t.date || `Reading ${ti + 1}`)}</div>
                <div className="numbered-row">
                  <div className="row-content"><span className="content-value">{highlightText(t.value || '')}</span></div>
                  <button className={`copy-btn ${copiedItems[`${sectionId}-${idx}-${ti}`] ? 'copied' : ''}`} onClick={() => copyItem(`${t.date}: ${t.value}`, `${sectionId}-${idx}-${ti}`)}>{copiedItems[`${sectionId}-${idx}-${ti}`] ? 'Copied!' : 'Copy'}</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderRecommendations = (record, idx) => {
    const recs = Array.isArray(record.recommendations) ? record.recommendations.filter(r => r?.recommendation) : [];
    if (recs.length === 0) return null;
    const title = SECTION_TITLES.recommendations;
    if (searchTerm.trim() && !record._showAllSections) {
      const phrase = searchTerm.toLowerCase().trim();
      const tl = title.toLowerCase();
      if (!tl.includes(phrase) && !phrase.includes(tl) && !recs.some(r => r.recommendation.toLowerCase().includes(phrase))) return null;
    }
    const copyId = `recommendations-${idx}`;
    // Group consecutive same-date recommendations under one date header (merge same date).
    const groups = [];
    recs.forEach((rec, ri) => {
      const d = rec.date ? String(rec.date) : null;
      const last = groups[groups.length - 1];
      if (last && last.dateKey === (d || '')) last.entries.push({ rec, ri });
      else groups.push({ dateKey: d || '', date: rec.date || null, entries: [{ rec, ri }] });
    });
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, 'recommendations'), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
            </div>
          </div>
          {groups.map((group, gi) => (
            <div key={gi} className="rec-mini-card">
              {group.date && <div className="nested-subtitle">{highlightText(formatDate(group.date))}</div>}
              {group.entries.map(({ rec, ri }) => {
                const isSearching = searchTerm.trim().length > 0;
                const titleMatch = isSearching && (() => { const p = searchTerm.toLowerCase().trim(); const tl = title.toLowerCase(); return tl.includes(p) || p.includes(tl); })();
                if (isSearching && !record._showAllSections && !titleMatch && !rec.recommendation.toLowerCase().includes(searchTerm.toLowerCase().trim())) return null;
                return (
                  <div key={ri} className="numbered-row">
                    <div className="row-content"><span className="content-value">{highlightText(rec.recommendation)}</span></div>
                    <button className={`copy-btn ${copiedItems[`rec-${idx}-${ri}`] ? 'copied' : ''}`} onClick={() => copyItem(rec.recommendation, `rec-${idx}-${ri}`)}>{copiedItems[`rec-${idx}-${ri}`] ? 'Copied!' : 'Copy'}</button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ========== EMPTY STATE ==========
  if (!records || records.length === 0) {
    return (
      <div className="ckd-assessment-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">CKD Assessment</h2></div>
        <div className="empty-state">No CKD assessment records available</div>
      </div>
    );
  }

  return (
    <div className="ckd-assessment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">CKD Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<CkdAssessmentDocumentPDFTemplate document={pdfData} />} fileName="CKD_Assessment.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>

      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search CKD assessment records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>

      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">
                {record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}
              </div>
              <h3 className="record-name">{highlightText(`CKD Assessment ${idx + 1}`)}</h3>
            </div>
            {renderMixedSection(record, idx, 'ckdStage')}
            {renderTrendSection(record, idx, 'egfrTrend', 'egfrTrend')}
            {renderTrendSection(record, idx, 'creatinineTrend', 'creatinineTrend')}
            {renderMixedSection(record, idx, 'progression')}
            {renderMixedSection(record, idx, 'riskFactors')}
            {renderMixedSection(record, idx, 'chronicity')}
            {renderMixedSection(record, idx, 'findings')}
            {renderMixedSection(record, idx, 'clinical')}
            {renderMixedSection(record, idx, 'plan')}
            {renderMixedSection(record, idx, 'results')}
            {renderRecommendations(record, idx)}
            {renderMixedSection(record, idx, 'providerInfo')}
            {renderMixedSection(record, idx, 'notes')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CkdAssessmentDocument;
