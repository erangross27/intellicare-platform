/**
 * GuidelineComplianceDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: guideline_compliance
 *
 * 4 Sections:
 *   1. session-info: date (date), type (string), provider (string), facility (string), status (string)
 *   2. guidelines: guidelines (ARRAY of complex objects)
 *      Each guideline object: guidelineName, compliance, gaps[], recommendations[], priority,
 *        quantitativeMonitoring:{parameter,baselineValue,targetValue,currentStatus,nextAssessment},
 *        clinicalRationale,
 *        patientReportedOutcomes:{outcomeMeasure,currentScore,guidelineTarget,interpretation,frequency}
 *   3. clinical-notes: findings (string), assessment (string/long), plan (string/long)
 *   4. additional: notes (string/long)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import GuidelineComplianceDocumentPDFTemplate from '../pdf-templates/GuidelineComplianceDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './GuidelineComplianceDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [putFieldPart]: value } }
   putFieldPart EXACTLY encodes the PUT payload a save handler would have sent:
     - top-level field            → "findings"                       (field only)
     - guideline sub-field        → "guidelines.0.clinicalRationale" (field only; trailing seg non-numeric)
     - guideline nested object    → "guidelines.0.quantitativeMonitoring.parameter" (field only)
     - guideline string-array item→ "guidelines.0.gaps.2"            (field=..gaps, arrayIndex=2; trailing seg numeric) */
const DRAFT_KEY = 'guideline_compliancePendingEdits';
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
  'session-info': 'Session Information',
  'guidelines': 'Guidelines',
  'clinical-notes': 'Clinical Notes',
  'additional': 'Additional Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  guidelines: 'Guidelines',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'type', 'provider', 'facility', 'status'],
  'guidelines': ['guidelines'],
  'clinical-notes': ['findings', 'assessment', 'plan'],
  'additional': ['notes'],
};

const DATE_FIELDS = ['date'];
const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'notes'];

/* Guideline sub-field labels */
const GUIDELINE_FIELD_LABELS = {
  guidelineName: 'Guideline Name',
  compliance: 'Compliance',
  priority: 'Priority',
  clinicalRationale: 'Clinical Rationale',
  gaps: 'Gaps',
  recommendations: 'Recommendations',
  quantitativeMonitoring: 'Quantitative Monitoring',
  patientReportedOutcomes: 'Patient-Reported Outcomes',
};

const QM_LABELS = {
  parameter: 'Parameter',
  baselineValue: 'Baseline Value',
  targetValue: 'Target Value',
  currentStatus: 'Current Status',
  nextAssessment: 'Next Assessment',
};

const PRO_LABELS = {
  outcomeMeasure: 'Outcome Measure',
  currentScore: 'Current Score',
  guidelineTarget: 'Guideline Target',
  interpretation: 'Interpretation',
  frequency: 'Frequency',
};

/* parseLabel: detect "Label: value" patterns (CLAUSE_OPENER guard rejects sentence clauses) */
const CLAUSE_OPENER = /^(?:and|but|or|nor|so|yet|if|when|while|because|since|although|though|however|whereas|unless|until|after|before|note|then|also|thus|therefore|moreover|for example|e\.g|i\.e|see|per|as)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return null;
  const m = text.match(/^([A-Za-z][A-Za-z\s/&(),.#≥≤><%0-9'"-]{2,}?):\s+(.*)/);
  if (!m) return null;
  const label = m[1].trim();
  if (CLAUSE_OPENER.test(label) || label.split(/\s+/).length > 6) return null;
  return { label, content: m[2].trim() };
};

/* ═══════ COMPONENT ═══════ */
const GuidelineComplianceDocument = ({ document: docProp }) => {
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
  // localEdits keys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.guideline_compliance) return Array.isArray(r.guideline_compliance) ? r.guideline_compliance : [r.guideline_compliance];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.guideline_compliance) return Array.isArray(dd.guideline_compliance) ? dd.guideline_compliance : [dd.guideline_compliance]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Resolve a record's id (string | {$oid} | other) — same logic as safeId, hoisted for the rehydrate effect. */
  const resolveId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     Reverses each putFieldPart into the SAME localEdits/pendingEdits/edited* markers the save handlers set. */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = resolveId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      // Seed a working copy of the guidelines array so multiple guideline drafts compose correctly.
      let guidelinesWorking = null;
      const ensureGuidelines = () => {
        if (!guidelinesWorking) guidelinesWorking = Array.isArray(record.guidelines) ? record.guidelines.map(g => (g && typeof g === 'object' ? { ...g } : g)) : [];
        return guidelinesWorking;
      };
      Object.entries(recDrafts).forEach(([putFieldPart, value]) => {
        const segs = putFieldPart.split('.');
        const lastNumeric = /^\d+$/.test(segs[segs.length - 1]);
        if (segs[0] !== 'guidelines') {
          // Top-level simple/sentence field — value is the full field string.
          nLocal[`${putFieldPart}-${idx}`] = value;
          nPending[`${putFieldPart}-${idx}`] = true;
          nFields[`${putFieldPart}-${idx}`] = 'edited';
          return;
        }
        // Guideline edit: "guidelines.<gi>.<subField>[.<k|arrayIndex>]"
        const gi = parseInt(segs[1], 10);
        const arr = ensureGuidelines();
        if (!arr[gi] || typeof arr[gi] !== 'object') arr[gi] = {};
        if (segs.length === 3) {
          // guidelines.gi.subField — simple sub-field
          const subField = segs[2];
          arr[gi] = { ...arr[gi], [subField]: value };
          nFields[`guidelines-${idx}-g${gi}-${subField}`] = 'edited';
        } else if (segs.length === 4 && lastNumeric) {
          // guidelines.gi.subField.arrayIndex — string-array item (gaps/recommendations)
          const subField = segs[2];
          const ai = parseInt(segs[3], 10);
          const gObj = { ...arr[gi] };
          const subArr = [...(gObj[subField] || [])];
          subArr[ai] = value;
          gObj[subField] = subArr;
          arr[gi] = gObj;
          nFields[`guidelines-${idx}-g${gi}-${subField}-${ai}`] = 'edited';
        } else if (segs.length === 4) {
          // guidelines.gi.subField.k — nested object field (quantitativeMonitoring/patientReportedOutcomes)
          const subField = segs[2];
          const k = segs[3];
          const gObj = { ...arr[gi] };
          gObj[subField] = { ...(gObj[subField] || {}), [k]: value };
          arr[gi] = gObj;
          nFields[`guidelines-${idx}-g${gi}-${subField}.${k}`] = 'edited';
        }
      });
      if (guidelinesWorking) {
        nLocal[`guidelines-${idx}`] = guidelinesWorking;
        nPending[`guidelines-${idx}`] = true;
      }
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

  const formatDate = useCallback((d) => {
    if (!d) return '';
    try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); }
  }, []);

  const formatDateInput = useCallback((d) => {
    if (!d) return '';
    try { const dt = new Date(d.$date || d); return dt.toISOString().split('T')[0]; } catch { return ''; }
  }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    const safe = text.replace(/\bvs\.\s/gi, 'vs\u200B ');
    return safe.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.replace(/vs\u200B/g, 'vs.').trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' ');
  }

  const splitByComma = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    const parts = []; let current = ''; let depth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ',' && depth === 0 && i + 1 < text.length && /\s/.test(text[i + 1])) {
        parts.push(current.trim()); current = ''; i++; continue;
      }
      current += ch;
    }
    if (current.trim()) parts.push(current.trim());
    return parts.filter(Boolean);
  }, []);

  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getEffectiveArray = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) { const v = localEdits[k]; return Array.isArray(v) ? v : [v]; } return Array.isArray(record[fn]) ? record[fn] : []; }, [localEdits]);
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
  const guidelinesMatchSearch = useCallback((record, idx, phrase) => {
    const arr = getEffectiveArray(record, 'guidelines', idx);
    for (const g of arr) {
      if (typeof g !== 'object') continue;
      if ((g.guidelineName || '').toLowerCase().includes(phrase)) return true;
      if ((g.compliance || '').toLowerCase().includes(phrase)) return true;
      if ((g.priority || '').toLowerCase().includes(phrase)) return true;
      if ((g.clinicalRationale || '').toLowerCase().includes(phrase)) return true;
      if (Array.isArray(g.gaps)) { for (const gap of g.gaps) { if (String(gap).toLowerCase().includes(phrase)) return true; } }
      if (Array.isArray(g.recommendations)) { for (const rec of g.recommendations) { if (String(rec).toLowerCase().includes(phrase)) return true; } }
      if (g.quantitativeMonitoring && typeof g.quantitativeMonitoring === 'object') {
        for (const v of Object.values(g.quantitativeMonitoring)) { if (String(v).toLowerCase().includes(phrase)) return true; }
      }
      if (g.patientReportedOutcomes && typeof g.patientReportedOutcomes === 'object') {
        for (const v of Object.values(g.patientReportedOutcomes)) { if (String(v).toLowerCase().includes(phrase)) return true; }
      }
    }
    return false;
  }, [getEffectiveArray]);

  const shouldShowSection = useCallback((record, sid) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      if (f === 'guidelines') {
        if (guidelinesMatchSearch(record, 0, phrase)) return true;
      } else {
        const val = getFieldValue(record, f, 0);
        if (val !== null && val !== undefined) { if (fmtVal(val).toLowerCase().includes(phrase)) return true; }
      }
    }
    return false;
  }, [searchTerm, getFieldValue, getEffectiveArray, fmtVal, guidelinesMatchSearch]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    if (fn === 'guidelines') {
      return guidelinesMatchSearch(record, idx, phrase);
    }
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) { return fmtVal(val).toLowerCase().includes(phrase); }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, guidelinesMatchSearch]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Guideline Compliance ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          if (f === 'guidelines') {
            if (guidelinesMatchSearch(record, idx, phrase)) return true;
          } else {
            const val = getFieldValue(record, f, idx);
            if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
          }
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, getEffectiveArray, fmtVal, guidelinesMatchSearch]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) { merged[m[1]] = localEdits[key]; }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // Re-edit after approval → drop the section 'approved' flag so the button returns to yellow Pending.
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // Stage a sentence edit as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
  const stageFieldDraft = (record, fn, idx, sid, fullText) => {
    const id = safeId(record); if (!id) return;
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
  };

  // Stage a guideline-array edit as a DRAFT (no DB write). Updates the in-memory guidelines array for
  // rendering (localEdits["guidelines-<idx>"]), marks the whole array pending, and records the exact PUT
  // payload as putFieldPart so Approve can replay it. updater(nextGuidelinesArray) mutates the cloned array.
  const stageGuidelineDraft = (record, idx, putFieldPart, value, updater) => {
    const id = safeId(record); if (!id) return;
    setLocalEdits(prev => {
      const a = [...getEffectiveArray(record, 'guidelines', idx)];
      updater(a);
      return { ...prev, [`guidelines-${idx}`]: a };
    });
    setPendingEdits(prev => ({ ...prev, [`guidelines-${idx}`]: true }));
    setApprovedSections(prev => { const k = `guidelines-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][putFieldPart] = value;
    writeDrafts(store);
  };

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setSaveError(null);
      stageFieldDraft(record, fn, idx, sid, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setSaveError(null);
    stageFieldDraft(record, fn, idx, sid, fullText);
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

  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    try {
      await secureApiClient.put(`/api/edit/guideline_compliance/${id}/approve`, { sectionId: sid, approved: true });
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      const fields = SECTION_FIELDS[sid] || [];
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
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

  /* ═══════ FORMAT HELPERS FOR COPY ═══════ */
  const formatSentenceFieldLines = useCallback((text) => {
    const sentences = splitBySentence(text);
    const lines = []; let n = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      if (parsed) {
        const parts = splitByComma(parsed.content);
        if (parts.length >= 2) {
          lines.push(parsed.label + ':');
          parts.forEach(item => { lines.push(`  ${n++}. ${item}`); });
        } else { lines.push(parsed.label + ':'); lines.push(`  ${n++}. ${parsed.content}`); }
      } else { lines.push(`${n++}. ${s}`); }
    });
    return lines;
  }, [splitBySentence, splitByComma]);

  const buildGuidelineCopyText = useCallback((g) => {
    let text = '';
    text += `  Guideline: ${g.guidelineName || 'N/A'}\n`;
    if (g.compliance) text += `  Compliance: ${g.compliance}\n`;
    if (g.priority) text += `  Priority: ${g.priority}\n`;
    if (g.clinicalRationale) text += `  Clinical Rationale: ${g.clinicalRationale}\n`;
    if (Array.isArray(g.gaps) && g.gaps.length > 0) {
      text += `  Gaps:\n`;
      g.gaps.forEach((gap, i) => { text += `    ${i + 1}. ${gap}\n`; });
    }
    if (Array.isArray(g.recommendations) && g.recommendations.length > 0) {
      text += `  Recommendations:\n`;
      g.recommendations.forEach((rec, i) => { text += `    ${i + 1}. ${rec}\n`; });
    }
    if (g.quantitativeMonitoring && typeof g.quantitativeMonitoring === 'object') {
      const qm = g.quantitativeMonitoring;
      text += `  Quantitative Monitoring:\n`;
      Object.entries(QM_LABELS).forEach(([k, label]) => { if (qm[k]) text += `    ${label}: ${qm[k]}\n`; });
    }
    if (g.patientReportedOutcomes && typeof g.patientReportedOutcomes === 'object') {
      const pro = g.patientReportedOutcomes;
      text += `  Patient-Reported Outcomes:\n`;
      Object.entries(PRO_LABELS).forEach(([k, label]) => { if (pro[k]) text += `    ${label}: ${pro[k]}\n`; });
    }
    return text;
  }, []);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      if (f === 'guidelines') {
        const arr = getEffectiveArray(record, f, idx);
        if (arr.length === 0) return;
        text += `${label}\n`;
        arr.forEach((g, gi) => {
          text += `\n--- Guideline ${gi + 1} ---\n`;
          text += buildGuidelineCopyText(g);
        });
        text += '\n';
        return;
      }
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        text += `${label}\n${formatDate(val)}\n\n`;
      } else if (SENTENCE_FIELDS.includes(f)) {
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
  }, [getFieldValue, getEffectiveArray, hasVal, fmtVal, formatDate, splitBySentence, formatSentenceFieldLines, buildGuidelineCopyText]);

  const copyAllText = useCallback(async () => {
    let text = '=== GUIDELINE COMPLIANCE ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Guideline Compliance ${idx + 1}\n${'='.repeat(40)}\n\n`;
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
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(formatDateInput(val)); setSaveError(null); } }}>
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

  /* ═══════ RENDER: SIMPLE STRING FIELD ═══════ */
  const renderSimpleStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const strVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

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

  /* ═══════ RENDER: SENTENCE-EDITABLE FIELD (splitBySentence) ═══════ */
  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
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
              if (parsed) {
                const commaItems = splitByComma(parsed.content);
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2) return; const items2 = splitByComma(p2.content); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setSaveError(null); stageFieldDraft(record, fn, idx, sid, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                <div key={sIdx} className={parsed ? 'rec-mini-card' : ''} style={parsed ? { marginTop: 8 } : undefined}>
                  {parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed ? parsed.content : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setSaveError(null); stageFieldDraft(record, fn, idx, sid, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(parsed ? parsed.content : sentence)}</span><span className="edit-indicator">&#9998;</span></div>
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

  /* ═══════ RENDER: GUIDELINE SUB-FIELD (editable string within a guideline object) ═══════ */
  const renderGuidelineSubField = (record, idx, gi, subField, label, value) => {
    if (!hasVal(value)) return null;
    const editKey = `guidelines-${idx}-g${gi}-${subField}`;
    const isEditing = editingField === editKey;
    const strVal = fmtVal(value);
    const isModified = editedFields[editKey];

    if (searchTerm.trim()) {
      const phrase = searchTerm.toLowerCase().trim();
      if (!strVal.toLowerCase().includes(phrase) && !label.toLowerCase().includes(phrase) && !sectionTitleMatches('guidelines')) return null;
    }

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(strVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setSaveError(null); const val = editValue; stageGuidelineDraft(record, idx, `guidelines.${gi}.${subField}`, val, a => { a[gi] = { ...a[gi], [subField]: val }; }); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(strVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${strVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: GUIDELINE STRING-ARRAY (gaps[], recommendations[]) ═══════ */
  const renderGuidelineArrayField = (record, idx, gi, subField, label, arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches('guidelines');

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(`${label} (${arr.length})`)}</div>
        {arr.map((item, ai) => {
          const itemText = String(item);
          const itemEditKey = `guidelines-${idx}-g${gi}-${subField}-${ai}`;
          const itemEditing = editingField === itemEditKey;
          const itemBadge = editedFields[itemEditKey];
          const itemMatches = phraseMatch || (searchTerm.trim() && itemText.toLowerCase().includes(searchTerm.toLowerCase().trim()));
          if (!itemMatches && searchTerm.trim()) return null;

          return (
            <div key={ai}>
              <div className={`numbered-row ${itemBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!itemEditing) { setEditingField(itemEditKey); setEditValue(itemText); setSaveError(null); } }}>
                {itemEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setSaveError(null); const val = editValue; stageGuidelineDraft(record, idx, `guidelines.${gi}.${subField}.${ai}`, val, a => { const gObj = { ...a[gi] }; const subArr = [...(gObj[subField] || [])]; subArr[ai] = val; gObj[subField] = subArr; a[gi] = gObj; }); setEditedFields(prev => ({ ...prev, [itemEditKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(itemText)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[itemEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemText, itemEditKey); }}>{copiedItems[itemEditKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: GUIDELINE NESTED OBJECT (quantitativeMonitoring, patientReportedOutcomes) ═══════ */
  const renderGuidelineNestedObject = (record, idx, gi, subField, label, obj, fieldLabels) => {
    if (!obj || typeof obj !== 'object') return null;
    const entries = Object.entries(fieldLabels).filter(([k]) => hasVal(obj[k]));
    if (entries.length === 0) return null;

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {entries.map(([k, subLabel]) => {
          const subVal = fmtVal(obj[k]);
          const subEditKey = `guidelines-${idx}-g${gi}-${subField}.${k}`;
          const subEditing = editingField === subEditKey;
          const subBadge = editedFields[subEditKey];

          if (searchTerm.trim()) {
            const phrase = searchTerm.toLowerCase().trim();
            if (!subVal.toLowerCase().includes(phrase) && !subLabel.toLowerCase().includes(phrase) && !label.toLowerCase().includes(phrase) && !sectionTitleMatches('guidelines')) return null;
          }

          return (
            <div key={k} className="guideline-nested-row">
              <span className="guideline-nested-label">{highlightText(subLabel)}</span>
              <div className={`numbered-row ${subBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!subEditing) { setEditingField(subEditKey); setEditValue(subVal); setSaveError(null); } }}>
                {subEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setSaveError(null); const val = editValue; stageGuidelineDraft(record, idx, `guidelines.${gi}.${subField}.${k}`, val, a => { const gObj = { ...a[gi] }; gObj[subField] = { ...(gObj[subField] || {}), [k]: val }; a[gi] = gObj; }); setEditedFields(prev => ({ ...prev, [subEditKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(subVal)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[subEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${subLabel}: ${subVal}`, subEditKey); }}>{copiedItems[subEditKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {subBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: GUIDELINES ARRAY (each guideline as a mini-card) ═══════ */
  const renderGuidelines = (record, idx, sid) => {
    const arr = getEffectiveArray(record, 'guidelines', idx); if (arr.length === 0) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, 'guidelines', idx)) return null;

    return arr.map((g, gi) => {
      if (!g || typeof g !== 'object') return null;
      const gName = g.guidelineName || `Guideline ${gi + 1}`;
      const compliance = (g.compliance || '').toLowerCase();
      const complianceClass = compliance.includes('non') ? 'compliance-non' : compliance.includes('partial') ? 'compliance-partial' : compliance ? 'compliance-full' : '';
      const priority = (g.priority || '').toLowerCase();
      const priorityClass = (priority === 'high' || priority === 'critical') ? 'priority-high' : (priority === 'medium' || priority === 'important') ? 'priority-medium' : priority ? 'priority-low' : '';

      /* Search filter at guideline level */
      if (searchTerm.trim() && !phraseMatch) {
        const phrase = searchTerm.toLowerCase().trim();
        const gText = [gName, g.compliance, g.priority, g.clinicalRationale, ...(g.gaps || []), ...(g.recommendations || [])].join(' ').toLowerCase();
        const qmText = g.quantitativeMonitoring ? Object.values(g.quantitativeMonitoring).join(' ').toLowerCase() : '';
        const proText = g.patientReportedOutcomes ? Object.values(g.patientReportedOutcomes).join(' ').toLowerCase() : '';
        if (!gText.includes(phrase) && !qmText.includes(phrase) && !proText.includes(phrase)) return null;
      }

      const copyId = `guideline-${idx}-${gi}`;

      return (
        <div key={gi} className="guideline-card">
          <div className="guideline-card-header">
            <div className="guideline-name-row">
              <h5 className="guideline-name">{highlightText(gName)}</h5>
              <button className={`copy-btn ${copiedItems[copyId] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(buildGuidelineCopyText(g), copyId); }}>{copiedItems[copyId] ? 'Copied!' : 'Copy'}</button>
            </div>
            <div className="guideline-badges">
              {g.compliance && <span className={`guideline-badge ${complianceClass}`}>{g.compliance}</span>}
              {g.priority && <span className={`guideline-badge ${priorityClass}`}>{g.priority} Priority</span>}
            </div>
          </div>

          {/* Clinical Rationale */}
          {renderGuidelineSubField(record, idx, gi, 'clinicalRationale', GUIDELINE_FIELD_LABELS.clinicalRationale, g.clinicalRationale)}

          {/* Gaps array */}
          {renderGuidelineArrayField(record, idx, gi, 'gaps', GUIDELINE_FIELD_LABELS.gaps, g.gaps)}

          {/* Recommendations array */}
          {renderGuidelineArrayField(record, idx, gi, 'recommendations', GUIDELINE_FIELD_LABELS.recommendations, g.recommendations)}

          {/* Quantitative Monitoring nested object */}
          {renderGuidelineNestedObject(record, idx, gi, 'quantitativeMonitoring', GUIDELINE_FIELD_LABELS.quantitativeMonitoring, g.quantitativeMonitoring, QM_LABELS)}

          {/* Patient-Reported Outcomes nested object */}
          {renderGuidelineNestedObject(record, idx, gi, 'patientReportedOutcomes', GUIDELINE_FIELD_LABELS.patientReportedOutcomes, g.patientReportedOutcomes, PRO_LABELS)}
        </div>
      );
    });
  };

  /* ═══════ RENDER: GENERIC SECTION (mixed fields) ═══════ */
  const renderMixedSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid]; if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => {
      if (f === 'guidelines') return getEffectiveArray(record, f, idx).length > 0;
      return hasVal(getFieldValue(record, f, idx));
    }); if (!hasAnyVal) return null;
    const copyId = `${sid}-${idx}`;
    return (<div key={sid} className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>{renderApproveButton(record, sid, idx)}</div></div>{fields.map(f => {
      if (f === 'guidelines') return <React.Fragment key={f}>{renderGuidelines(record, idx, sid)}</React.Fragment>;
      if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
      if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
      return renderSimpleStringField(record, f, idx, sid);
    })}</div></div>);
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="guideline-compliance-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Guideline Compliance</h2></div>
        <div className="empty-state">No guideline compliance records available</div>
      </div>
    );
  }

  return (
    <div className="guideline-compliance-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Guideline Compliance</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<GuidelineComplianceDocumentPDFTemplate document={pdfData} />} fileName="Guideline_Compliance.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search guideline compliance..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Guideline Compliance ${idx + 1}`)}</h3>
            </div>
            {renderMixedSection(record, idx, 'session-info')}
            {renderMixedSection(record, idx, 'guidelines')}
            {renderMixedSection(record, idx, 'clinical-notes')}
            {renderMixedSection(record, idx, 'additional')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GuidelineComplianceDocument;
