/**
 * PediatricScreeningDocument.jsx
 * March 2026 -- Complete rewrite with inline editing, blue glow theme
 * Collection: pediatric_screening
 *
 * 13 Sections:
 *   1. session-info: date, provider, facility, status
 *   2. vision-screening: visionScreening.result, visionScreening.acuity, visionScreening.method
 *   3. hearing-screening: hearingScreening.result, hearingScreening.method
 *   4. behavioral-screening: behavioralScreening.tool, behavioralScreening.score, behavioralScreening.result, behavioralScreening.teacherRating
 *   5. lead-level: leadLevel.riskAssessment
 *   6. developmental-screening: (dynamic keys from developmentalScreening object)
 *   7. cholesterol-screening: (dynamic keys from cholesterolScreening object)
 *   8. tuberculosis-risk: tuberculosisRisk
 *   9. dental-screening: dentalScreening
 *  10. assessment: assessment
 *  11. plan: plan
 *  12. findings: findings
 *  13. notes: notes
 *  14. recommendations: recommendations (array)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PediatricScreeningDocumentPDFTemplate from '../pdf-templates/PediatricScreeningDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './PediatricScreeningDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'pediatric_screeningPendingEdits';
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
  'session-info': 'Session Information',
  'vision-screening': 'Vision Screening',
  'hearing-screening': 'Hearing Screening',
  'behavioral-screening': 'Behavioral Screening',
  'lead-level': 'Lead Level',
  'developmental-screening': 'Developmental Screening',
  'cholesterol-screening': 'Cholesterol Screening',
  'results-section': 'Screening Results',
  'tuberculosis-risk': 'Tuberculosis Risk',
  'dental-screening': 'Dental Screening',
  'assessment-section': 'Assessment',
  'plan-section': 'Plan',
  'findings-section': 'Findings',
  'notes-section': 'Notes',
  'recommendations-section': 'Recommendations',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  'visionScreening.result': 'Result',
  'visionScreening.acuity': 'Acuity',
  'visionScreening.method': 'Method',
  'hearingScreening.result': 'Result',
  'hearingScreening.method': 'Method',
  'behavioralScreening.tool': 'Assessment Tool',
  'behavioralScreening.score': 'Score',
  'behavioralScreening.result': 'Result',
  'behavioralScreening.teacherRating': 'Teacher Rating',
  'leadLevel.riskAssessment': 'Risk Assessment',
  tuberculosisRisk: 'Tuberculosis Risk',
  dentalScreening: 'Dental Screening',
  assessment: 'Assessment',
  plan: 'Plan',
  findings: 'Findings',
  notes: 'Notes',
  recommendations: 'Recommendations',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility', 'status'],
  'vision-screening': ['visionScreening.result', 'visionScreening.acuity', 'visionScreening.method'],
  'hearing-screening': ['hearingScreening.result', 'hearingScreening.method'],
  'behavioral-screening': ['behavioralScreening.tool', 'behavioralScreening.score', 'behavioralScreening.result', 'behavioralScreening.teacherRating'],
  'lead-level': ['leadLevel.riskAssessment'],
  'tuberculosis-risk': ['tuberculosisRisk'],
  'dental-screening': ['dentalScreening'],
  'assessment-section': ['assessment'],
  'plan-section': ['plan'],
  'findings-section': ['findings'],
  'notes-section': ['notes'],
  'recommendations-section': ['recommendations'],
};

/* Maps a dynamic-object section to its record object key (these sids have no SECTION_FIELDS list;
   their staged drafts use dot-path fieldParts like "leadLevel.riskAssessment" / "results.a.b"). */
const SECTION_OBJECT_KEYS = {
  'lead-level': 'leadLevel',
  'developmental-screening': 'developmentalScreening',
  'cholesterol-screening': 'cholesterolScreening',
  'behavioral-screening': 'behavioralScreening',
  'results-section': 'results',
};

const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['recommendations'];
/* Comma-joined subscale scores (e.g. Vanderbilt "Inattention 7/9 (elevated), ...").
   On screen these render as a bar chart; in Copy text they split into numbered rows
   (one per subscale) to mirror the chart decomposition. */
const COMMA_FIELDS = ['behavioralScreening.score'];
const STRING_FIELDS = ['provider', 'facility', 'status', 'visionScreening.result', 'visionScreening.acuity', 'visionScreening.method', 'hearingScreening.result', 'hearingScreening.method', 'behavioralScreening.tool', 'behavioralScreening.score', 'behavioralScreening.result', 'behavioralScreening.teacherRating', 'leadLevel.riskAssessment', 'tuberculosisRisk', 'dentalScreening', 'assessment', 'plan', 'findings', 'notes'];

/* parseLabel: detect "Label: value" patterns (CLAUSE_OPENER guard, strip inline N. markers) */
const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
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

/* Parse behavioral scores: "8" or "Inattention: 7/9 (elevated), ..." */
const parseBehavioralScores = (scoreText) => {
  if (!scoreText || typeof scoreText !== 'string') return [];
  const items = scoreText.split(',').map(s => s.trim()).filter(s => s);
  return items.map(item => {
    /* Colon is OPTIONAL: real Vanderbilt data is "Inattention 7/9 (elevated)" (no colon),
       not "Inattention: 7/9". Without the optional colon the regex never matched and the
       bar chart never rendered -- fell back to one blob row. */
    const match = item.match(/^([^:]+?):?\s*(\d+)\/(\d+)\s*\(([^)]+)\)/i);
    if (match) {
      const [, label, score, max, status] = match;
      const percentage = Math.round((parseInt(score) / parseInt(max)) * 100);
      return { label: label.trim(), score: parseInt(score), max: parseInt(max), percentage, status: status.trim().toLowerCase(), raw: item };
    }
    return { label: item, raw: item };
  });
};

const getBarColor = (status, percentage) => {
  if (status === 'elevated' || status === 'high' || percentage >= 67) return '#ef4444';
  if (status === 'borderline' || status === 'moderate' || (percentage >= 34 && percentage < 67)) return '#f59e0b';
  return '#22c55e';
};

/* ======= COMPONENT ======= */
const PediatricScreeningDocument = ({ document: docProp, data: dataProp }) => {
  const docData = docProp || dataProp;
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
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ======= DATA UNWRAP ======= */
  const records = useMemo(() => {
    if (!docData) return [];
    let arr = Array.isArray(docData) ? docData : [docData];
    arr = arr.flatMap(r => {
      if (r?.pediatric_screening) return Array.isArray(r.pediatric_screening) ? r.pediatric_screening : [r.pediatric_screening];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.pediatric_screening) return Array.isArray(dd.pediatric_screening) ? dd.pediatric_screening : [dd.pediatric_screening]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docData]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = idOf(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        if (lastDot !== -1 && /^\d+$/.test(tail)) {
          // Array element draft: "recommendations.2" → whole-array localEdits + per-element markers
          const arrField = fieldPart.slice(0, lastDot);
          const arrIndex = parseInt(tail, 10);
          const arrKey = `${arrField}-${idx}`;
          const base = Array.isArray(nLocal[arrKey])
            ? nLocal[arrKey]
            : [...(Array.isArray(record[arrField]) ? record[arrField] : [])];
          base[arrIndex] = value;
          nLocal[arrKey] = base;
          nPending[arrKey] = true;
          nPending[`${fieldPart}-${idx}`] = true;
          nFields[`${fieldPart}-${idx}`] = 'edited';
        } else {
          // Plain or dotted-nested field draft
          const editKey = `${fieldPart}-${idx}`;
          nLocal[editKey] = value;
          nPending[editKey] = true;
          nFields[editKey] = 'edited';
          nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
        }
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

  /* getFieldValue: supports dot-path for nested fields like visionScreening.result */
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
      const rt = `Pediatric Screening ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && (Array.isArray(val) ? val.some(item => String(item).toLowerCase().includes(phrase)) : fmtVal(val).toLowerCase().includes(phrase))) return true;
        }
      }
      /* scan dynamic-key objects (lead/developmental/cholesterol/behavioral/results, incl. nested) */
      const scanObj = (o) => {
        if (!o || typeof o !== 'object') return false;
        return Object.entries(o).some(([k, v]) => {
          if (String(k).toLowerCase().includes(phrase)) return true;
          if (v && typeof v === 'object') return scanObj(v);
          return fmtVal(v).toLowerCase().includes(phrase);
        });
      };
      if ([record.leadLevel, record.developmentalScreening, record.cholesterolScreening, record.behavioralScreening, record.results].some(scanObj)) return true;
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal]);

  /* ======= PDF DATA ======= */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fieldPath = m[1];
          if (fieldPath.includes('.')) {
            const parts = fieldPath.split('.');
            if (!merged[parts[0]] || typeof merged[parts[0]] !== 'object') merged[parts[0]] = {};
            merged[parts[0]] = { ...merged[parts[0]], [parts[1]]: localEdits[key] };
          } else {
            merged[fieldPath] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ======= EDIT HANDLERS ======= */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow
    if (sid) setApprovedSections(prev => {
      const sk = `${sid}-${idx}`;
      if (!prev[sk]) return prev;
      const next = { ...prev }; delete next[sk]; return next;
    });
    // Stage the draft in localStorage (fieldPart = fn; no arrayIndex for this handler)
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId]);

  // Stage a single-sentence edit as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
  function stageDraft(record, fn, idx, sid, fullText) {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    if (sid) setApprovedSections(prev => {
      const sk = `${sid}-${idx}`;
      if (!prev[sk]) return prev;
      const next = { ...prev }; delete next[sk]; return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
  }

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageDraft(record, fn, idx, sid, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue(''); setSaveError(null);
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    stageDraft(record, fn, idx, sid, fullText);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    setEditingField(null); setEditValue(''); setSaveError(null);
  }

  /* ======= APPROVE ======= */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    const byField = fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
    if (byField) return true;
    // Dynamic-object / results sections: match staged edits by their object-key prefix.
    const objKey = SECTION_OBJECT_KEYS[sid];
    if (objKey) {
      const pref = `${objKey}.`;
      return Object.keys(editedFields).some(k => k.startsWith(pref) && k.endsWith(`-${idx}`)) ||
        Object.keys(editedSentences).some(k => k.startsWith(pref) && (k.endsWith(`-${idx}`) || k.includes(`-${idx}-s`)));
    }
    return false;
  }, [editedFields, editedSentences]);

  // Does a staged fieldPart belong to this section? (SECTION_FIELDS base field, or its object-key prefix)
  const fieldPartInSection = (fieldPart, sid) => {
    const base = /^\d+$/.test(fieldPart.split('.').pop()) ? fieldPart.slice(0, fieldPart.lastIndexOf('.')) : fieldPart;
    const fields = SECTION_FIELDS[sid] || [];
    if (fields.includes(base) || fields.includes(fieldPart)) return true;
    const objKey = SECTION_OBJECT_KEYS[sid];
    if (objKey && (fieldPart === objKey || fieldPart.startsWith(`${objKey}.`))) return true;
    return false;
  };

  // Approve = COMMIT all staged drafts for this section's fields to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    try {
      const store = readDrafts();
      const recDrafts = store[id] || {};
      // fieldParts of this record staged for THIS section
      const toCommit = Object.keys(recDrafts).filter(fp => fieldPartInSection(fp, sid));
      for (const fieldPart of toCommit) {
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { value: recDrafts[fieldPart] };
        if (lastDot !== -1 && /^\d+$/.test(tail)) {
          // array element: "recommendations.2" → field=recommendations, arrayIndex=2
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(tail, 10);
        } else {
          // plain or dotted nested field (e.g. "visionScreening.result"): NO arrayIndex
          payload.field = fieldPart;
        }
        const resp = await secureApiClient.put(`/api/edit/pediatric_screening/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/pediatric_screening/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const n = { ...prev };
        // whole-array localEdits keys + per-element pending keys for this section
        Object.keys(n).forEach(k => {
          const m = k.match(/^(.+)-(\d+)$/);
          if (m && parseInt(m[2], 10) === idx && fieldPartInSection(m[1], sid)) delete n[k];
        });
        return n;
      });
      // Drop this section's committed drafts from localStorage
      toCommit.forEach(fp => delete recDrafts[fp]);
      if (Object.keys(recDrafts).length === 0) delete store[id];
      else store[id] = recDrafts;
      writeDrafts(store);

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      const fields = SECTION_FIELDS[sid] || [];
      const objKey = SECTION_OBJECT_KEYS[sid];
      const matchesSection = (k) => {
        const mm = k.match(/^(.+?)-(\d+)(?:-s\d+(?:-c\d+)?)?$/);
        if (!mm || parseInt(mm[2], 10) !== idx) return false;
        return fieldPartInSection(mm[1], sid);
      };
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (matchesSection(k)) delete n[k]; }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); if (objKey) { if (k.startsWith(`${objKey}.`) && (k.includes(`-${idx}-s`) || k.endsWith(`-${idx}`))) delete n[k]; } }); return n; });
    } catch (err) { console.error('[PediatricScreening] Approve error:', err); }
  }, [safeId]);

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
    const fields = SECTION_FIELDS[sid] || [];
    let body = '';
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      const sameAsTitle = label.trim().toLowerCase() === (title || '').trim().toLowerCase();
      const head = sameAsTitle ? '' : `${label}\n${'='.repeat(40)}\n`;
      if (DATE_FIELDS.includes(f)) {
        body += `${head}1. ${formatDate(val)}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val : [val];
        body += `${head}${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}\n\n`;
      } else if (COMMA_FIELDS.includes(f)) {
        const parts = splitByComma(fmtVal(val));
        body += head;
        parts.forEach((item, i) => { body += `${i + 1}. ${item}\n`; });
        body += '\n';
      } else if (STRING_FIELDS.includes(f)) {
        const strVal = fmtVal(val);
        const sentences = splitBySentence(strVal);
        if (sentences.length > 1) {
          body += head;
          formatSentenceFieldLines(strVal).forEach(l => { body += `${l}\n`; });
          body += '\n';
        } else {
          body += `${head}1. ${strVal}\n\n`;
        }
      } else {
        body += `${head}1. ${fmtVal(val)}\n\n`;
      }
    });
    if (!body.trim()) return '';
    return `${title}\n${'='.repeat(40)}\n\n${body}`;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== PEDIATRIC SCREENING ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Pediatric Screening ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      if (r.results && typeof r.results === 'object' && Object.keys(r.results).length > 0) {
        const lines = flattenResults(r.results, '');
        if (lines.length > 0) {
          text += `${SECTION_TITLES['results-section']}\n${'='.repeat(40)}\n\n`;
          lines.forEach(l => { text += `${l}\n`; });
          text += '\n';
        }
      }
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ======= RENDER: DATE FIELD (BlueDatePicker) ======= */
  const isEpochSentinel = (v) => { try { const d = new Date(v?.$date || v); return !isNaN(d.getTime()) && d.getFullYear() === 1970; } catch { return false; } };
  const renderDateField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || isEpochSentinel(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = formatDate(val);
    const isModified = editedFields[editKey];
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
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
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = editValue; const arrKey = `${fn}-${idx}`; setLocalEdits(prev => ({ ...prev, [arrKey]: currentArr })); setPendingEdits(prev => ({ ...prev, [arrKey]: true, [editKey]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setApprovedSections(prev => { const sk = `${sid}-${idx}`; if (!prev[sk]) return prev; const next = { ...prev }; delete next[sk]; return next; }); const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][`${fn}.${itemIdx}`] = editValue; writeDrafts(store); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
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
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence: render with splitBySentence */
    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn}>
          <div className="rec-mini-card">
            {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); stageDraft(record, fn, idx, sid, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); stageDraft(record, fn, idx, sid, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); setSaveError(null); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
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

  /* ======= RENDER: BEHAVIORAL SCREENING (special section with bar chart) ======= */
  const renderBehavioralSection = (record, idx) => {
    const sid = 'behavioral-screening';
    if (!shouldShowSection(record, sid)) return null;
    const bs = record.behavioralScreening;
    if (!bs || typeof bs !== 'object' || Object.keys(bs).length === 0) return null;
    const hasTool = hasVal(bs.tool);
    const hasScore = hasVal(bs.score);
    const hasResult = hasVal(bs.result);
    const hasTeacher = hasVal(bs.teacherRating);
    if (!hasTool && !hasScore && !hasResult && !hasTeacher) return null;

    const copyId = `${sid}-${idx}`;

    /* Parse scores for bar chart */
    const scores = parseBehavioralScores(String(getFieldValue(record, 'behavioralScreening.score', idx) || ''));
    const validScores = scores.filter(s => s.score !== undefined);

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Behavioral Screening')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>

          {/* Assessment Tool */}
          {renderStringField(record, 'behavioralScreening.tool', idx, sid)}

          {/* Bar Chart for Scores (if parseable) */}
          {validScores.length > 0 && (
            <div className="rec-mini-card">
              <div className="nested-subtitle">{highlightText('Subscale Scores')}</div>
              <div className="chart-container">
                <div className="chart-legend">
                  <span className="legend-item"><span className="legend-color" style={{ background: '#22c55e' }}></span> Normal (0-33%)</span>
                  <span className="legend-item"><span className="legend-color" style={{ background: '#f59e0b' }}></span> Borderline (34-66%)</span>
                  <span className="legend-item"><span className="legend-color" style={{ background: '#ef4444' }}></span> Elevated (67-100%)</span>
                </div>
                {validScores.map((s, sIdx) => (
                  <div key={sIdx} className="bar-row">
                    <div className="bar-label">{highlightText(s.label)}</div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${s.percentage}%`, backgroundColor: getBarColor(s.status, s.percentage) }}></div>
                    </div>
                    <div className="bar-value">
                      {s.score}/{s.max}
                      <span className={`status-badge status-${s.status}`}>{highlightText(s.status)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Score as string if no bar chart */}
          {validScores.length === 0 && renderStringField(record, 'behavioralScreening.score', idx, sid)}

          {/* Result */}
          {renderStringField(record, 'behavioralScreening.result', idx, sid)}

          {/* Teacher Rating */}
          {renderStringField(record, 'behavioralScreening.teacherRating', idx, sid)}
        </div>
      </div>
    );
  };

  /* ======= RENDER: DYNAMIC OBJECT SECTION (leadLevel, developmentalScreening, cholesterolScreening) ======= */
  const renderDynamicObjectSection = (record, idx, sid, objectKey) => {
    if (!shouldShowSection(record, sid)) return null;
    const obj = record[objectKey];
    if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) return null;
    const entries = Object.entries(obj).filter(([, v]) => hasVal(v));
    if (entries.length === 0) return null;

    const title = SECTION_TITLES[sid];
    const copyId = `${sid}-${idx}`;

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => {
                let text = `${title}\n${'='.repeat(40)}\n\n`;
                entries.forEach(([k, v]) => { text += `${k}: ${v}\n`; });
                copySection(text, copyId);
              }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {entries.map(([key, val]) => {
            const fn = `${objectKey}.${key}`;
            const editKey = `${fn}-${idx}`;
            const isEditing = editingField === editKey;
            const isModified = editedFields[editKey];
            const displayVal = String(val);

            if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
              const phrase = searchTerm.toLowerCase().trim();
              if (!key.toLowerCase().includes(phrase) && !displayVal.toLowerCase().includes(phrase)) return null;
            }

            return (
              <div key={key} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(key)}</div>
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
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
                      <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${key}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ======= RENDER: RESULTS SECTION (dynamic-key object, recursive, TYPED leaves) ======= */
  /* results = dynamic-key object of screening results; leaves may be number / boolean / string.
     number -> number input (parseFloat, isNaN guard, 0 meaningful), boolean -> Yes/No select,
     string -> textarea. Nested objects recurse with dot-path field names. */
  const renderResultsLeaf = (record, idx, sid, fn, key, val, depth) => {
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    const isNumber = typeof val === 'number';
    const isBoolean = typeof val === 'boolean';
    const displayVal = isBoolean ? (val ? 'Yes' : 'No') : String(val);

    if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
      const phrase = searchTerm.toLowerCase().trim();
      if (!key.toLowerCase().includes(phrase) && !displayVal.toLowerCase().includes(phrase)) return null;
    }

    const beginEdit = () => {
      if (isEditing) return;
      setEditingField(editKey);
      setEditValue(isBoolean ? (val ? 'true' : 'false') : String(val));
      setSaveError(null);
    };
    const commitSave = (rawValue) => {
      let outVal = rawValue;
      if (isNumber) {
        const n = parseFloat(rawValue);
        if (isNaN(n)) { setSaveError('Please enter a valid number'); return; }
        outVal = n;
      } else if (isBoolean) {
        outVal = rawValue === 'true' || rawValue === 'Yes' || rawValue === true;
      }
      handleSaveField(record, fn, idx, sid, null, outVal);
    };

    return (
      <div key={editKey} className="rec-mini-card" style={depth > 0 ? { marginLeft: 12 } : undefined}>
        <div className="nested-subtitle">{highlightText(key)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={beginEdit}>
          {isEditing ? (
            <div className="edit-field-container">
              {isNumber ? (
                <div className="num-stepper-row">
                  <button type="button" className="num-step" onClick={() => setEditValue(String((parseFloat(editValue) || 0) - 1))} disabled={saving}>&#8722;</button>
                  <input type="text" inputMode="decimal" className="num-stepper-input" value={editValue} onChange={e => setEditValue(e.target.value.replace(/[^0-9.\-]/g, ''))} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.preventDefault(); commitSave(editValue); } }} />
                  <button type="button" className="num-step" onClick={() => setEditValue(String((parseFloat(editValue) || 0) + 1))} disabled={saving}>+</button>
                </div>
              ) : isBoolean ? (
                <BlueSelect value={editValue === 'true' || editValue === 'Yes' ? 'Yes' : 'No'} options={['Yes', 'No']} onChange={v => setEditValue(v === 'Yes' ? 'true' : 'false')} />
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); commitSave(editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${key}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  const renderResultsEntries = (record, idx, sid, obj, parentPath, depth) => {
    const out = [];
    Object.entries(obj).forEach(([key, val]) => {
      if (!hasVal(val)) return;
      const fn = `${parentPath}.${key}`;
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const nested = renderResultsEntries(record, idx, sid, val, fn, depth + 1);
        if (nested.length > 0) {
          out.push(
            <div key={fn} className="rec-mini-card" style={depth > 0 ? { marginLeft: 12 } : undefined}>
              <div className="nested-subtitle">{highlightText(key)}</div>
              {nested}
            </div>
          );
        }
      } else if (Array.isArray(val)) {
        const items = val.filter(hasVal);
        if (items.length === 0) return;
        out.push(
          <div key={fn} className="rec-mini-card" style={depth > 0 ? { marginLeft: 12 } : undefined}>
            <div className="nested-subtitle">{highlightText(key)}</div>
            {renderResultsLeaf(record, idx, sid, fn, key, items.map(fmtVal).join(', '), depth + 1)}
          </div>
        );
      } else {
        out.push(renderResultsLeaf(record, idx, sid, fn, key, val, depth));
      }
    });
    return out;
  };

  const flattenResults = (obj, prefix) => {
    const lines = [];
    Object.entries(obj).forEach(([key, val]) => {
      if (!hasVal(val)) return;
      const label = prefix ? `${prefix} > ${key}` : key;
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        lines.push(...flattenResults(val, label));
      } else if (Array.isArray(val)) {
        lines.push(`${label}: ${val.filter(hasVal).map(fmtVal).join(', ')}`);
      } else {
        lines.push(`${label}: ${fmtVal(val)}`);
      }
    });
    return lines;
  };

  const renderResultsSection = (record, idx) => {
    const sid = 'results-section';
    if (!shouldShowSection(record, sid)) return null;
    const obj = record.results;
    if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) return null;
    const rows = renderResultsEntries(record, idx, sid, obj, 'results', 0);
    if (rows.length === 0) return null;

    const title = SECTION_TITLES[sid];
    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => {
                let text = `${title}\n${'='.repeat(40)}\n\n`;
                flattenResults(obj, '').forEach(l => { text += `${l}\n`; });
                copySection(text, copyId);
              }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {rows}
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
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ======= MAIN RENDER ======= */
  if (!records || records.length === 0) {
    return (
      <div className="pediatric-screening-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Pediatric Screening</h2></div>
        <div className="empty-state">No pediatric screening records available</div>
      </div>
    );
  }

  return (
    <div className="pediatric-screening-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Pediatric Screening</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<PediatricScreeningDocumentPDFTemplate document={pdfData} />} fileName="Pediatric_Screening.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search screenings, results, providers..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
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
              <h3 className="record-name">{highlightText(`Pediatric Screening ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'session-info')}
            {renderSection(record, idx, 'vision-screening')}
            {renderSection(record, idx, 'hearing-screening')}
            {renderBehavioralSection(record, idx)}
            {renderDynamicObjectSection(record, idx, 'lead-level', 'leadLevel')}
            {renderDynamicObjectSection(record, idx, 'developmental-screening', 'developmentalScreening')}
            {renderDynamicObjectSection(record, idx, 'cholesterol-screening', 'cholesterolScreening')}
            {renderResultsSection(record, idx)}
            {renderSection(record, idx, 'tuberculosis-risk')}
            {renderSection(record, idx, 'dental-screening')}
            {renderSection(record, idx, 'assessment-section')}
            {renderSection(record, idx, 'plan-section')}
            {renderSection(record, idx, 'findings-section')}
            {renderSection(record, idx, 'notes-section')}
            {renderSection(record, idx, 'recommendations-section')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PediatricScreeningDocument;
