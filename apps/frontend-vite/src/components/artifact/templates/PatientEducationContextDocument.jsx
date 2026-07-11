/**
 * PatientEducationContextDocument.jsx
 * June 2026 — Inline editing, blue glow theme
 * Collection: patient_education_context
 *
 * 5 Sections:
 *   1. session-overview: provider, facility, educationalTopicCategory, specificConditionTaught, educationDurationMinutes
 *   2. teaching-method: educationMethodUsed, materialsProvided[], languageOfInstruction, interpreterUsed, demonstrationPerformed, returnDemonstrationCompleted
 *   3. comprehension-engagement: healthLiteracyLevel, learningBarriers[], patientComprehensionLevel, teachBackPerformed, teachBackSuccessful, patientEngagementLevel, reinforcementNeeded, familyMembersPresent[], culturalConsiderations
 *   4. content-covered: medicationsEducated[], sideEffectsDiscussed[], selfManagementSkillsTaught[], dietaryRestrictions[], activityLimitations[], warningSignsEducated[]
 *   5. follow-up: followUpInstructions
 *
 * NOTE: this schema HAS a date field — record header shows a date badge above the numbered record title.
 *       date lives ONLY in the record header (not in any section).
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PatientEducationContextDocumentPDFTemplate from '../pdf-templates/PatientEducationContextDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './PatientEducationContextDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'patient_education_contextPendingEdits';
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
  'session-overview': 'Session Overview',
  'teaching-method': 'Teaching Method',
  'comprehension-engagement': 'Comprehension and Engagement',
  'content-covered': 'Content Covered',
  'follow-up': 'Follow-Up',
};

const FIELD_LABELS = {
  provider: 'Provider',
  facility: 'Facility',
  educationalTopicCategory: 'Topic Category',
  specificConditionTaught: 'Condition Taught',
  educationDurationMinutes: 'Duration (minutes)',
  educationMethodUsed: 'Education Method',
  materialsProvided: 'Materials Provided',
  languageOfInstruction: 'Language of Instruction',
  interpreterUsed: 'Interpreter Used',
  demonstrationPerformed: 'Demonstration Performed',
  returnDemonstrationCompleted: 'Return Demonstration Completed',
  healthLiteracyLevel: 'Health Literacy Level',
  learningBarriers: 'Learning Barriers',
  patientComprehensionLevel: 'Comprehension Level',
  teachBackPerformed: 'Teach-Back Performed',
  teachBackSuccessful: 'Teach-Back Successful',
  patientEngagementLevel: 'Engagement Level',
  reinforcementNeeded: 'Reinforcement Needed',
  familyMembersPresent: 'Family Members Present',
  culturalConsiderations: 'Cultural Considerations',
  medicationsEducated: 'Medications Educated',
  sideEffectsDiscussed: 'Side Effects Discussed',
  selfManagementSkillsTaught: 'Self-Management Skills Taught',
  dietaryRestrictions: 'Dietary Restrictions',
  activityLimitations: 'Activity Limitations',
  warningSignsEducated: 'Warning Signs Educated',
  followUpInstructions: 'Follow-Up Instructions',
};

const SECTION_FIELDS = {
  'session-overview': ['provider', 'facility', 'educationalTopicCategory', 'specificConditionTaught', 'educationDurationMinutes'],
  'teaching-method': ['educationMethodUsed', 'materialsProvided', 'languageOfInstruction', 'interpreterUsed', 'demonstrationPerformed', 'returnDemonstrationCompleted'],
  'comprehension-engagement': ['healthLiteracyLevel', 'learningBarriers', 'patientComprehensionLevel', 'teachBackPerformed', 'teachBackSuccessful', 'patientEngagementLevel', 'reinforcementNeeded', 'familyMembersPresent', 'culturalConsiderations'],
  'content-covered': ['medicationsEducated', 'sideEffectsDiscussed', 'selfManagementSkillsTaught', 'dietaryRestrictions', 'activityLimitations', 'warningSignsEducated'],
  'follow-up': ['followUpInstructions'],
};

const SENTENCE_FIELDS = ['followUpInstructions', 'culturalConsiderations', 'reinforcementNeeded'];
const SIMPLE_FIELDS = ['provider', 'facility', 'educationalTopicCategory', 'specificConditionTaught', 'educationMethodUsed', 'languageOfInstruction', 'interpreterUsed', 'healthLiteracyLevel', 'patientComprehensionLevel', 'teachBackPerformed', 'teachBackSuccessful', 'demonstrationPerformed', 'returnDemonstrationCompleted', 'patientEngagementLevel', 'educationDurationMinutes'];
/* Numeric schema fields — edited with a TYPED number input (parseFloat + isNaN guard), saving a real number. */
const NUMBER_FIELDS = ['educationDurationMinutes'];
/* NO boolean fields in this schema — interpreterUsed / teachBackPerformed / teachBackSuccessful /
   demonstrationPerformed / returnDemonstrationCompleted are free-text strings ("yes"/"no"/etc.). */
const BOOLEAN_FIELDS = [];
const ARRAY_FIELDS = ['materialsProvided', 'learningBarriers', 'familyMembersPresent', 'medicationsEducated', 'sideEffectsDiscussed', 'selfManagementSkillsTaught', 'dietaryRestrictions', 'activityLimitations', 'warningSignsEducated'];
/* Numeric field where 0 means "not recorded" — hidden when exactly 0.
   educationDurationMinutes: a 0-minute education session means duration was not documented. */
const HIDE_ZERO_FIELDS = ['educationDurationMinutes'];

/* parseLabel: detect "Label: value" patterns (skip subordinate-clause openers) */
const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware comma split with date-aware guard
   — items like "Infusion reaction signs (throat tightness, rash, fever)" stay intact */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).trimStart();
      if (/^\d{4}\b/.test(rest)) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* fmtDate: record-header date (handles Date, ISO string and {$date}) */
const fmtDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const d = new Date(dateValue.$date || dateValue);
    if (isNaN(d.getTime())) return String(dateValue);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateValue); }
};

/* toInputDate: ISO yyyy-mm-dd for BlueDatePicker */
const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* dateHasVal: present + not the 1970-01-01 epoch "not set" sentinel */
const isEpochDate = (v) => { if (!v) return false; try { const d = new Date(v.$date || v); return d.getUTCFullYear() === 1970 && d.getUTCMonth() === 0 && d.getUTCDate() === 1; } catch { return false; } };

/* ═══════ COMPONENT ═══════ */
const PatientEducationContextDocument = ({ document: docProp, data, templateData }) => {
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
  const [saveError, setSaveError] = useState(null);
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP — all formats (document / data / templateData) ═══════ */
  const records = useMemo(() => {
    const source = docProp || data || templateData;
    if (!source) return [];
    let arr = Array.isArray(source) ? source : [source];
    arr = arr.flatMap(r => {
      if (r?.patient_education_context) return Array.isArray(r.patient_education_context) ? r.patient_education_context : [r.patient_education_context];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.patient_education_context) return Array.isArray(dd.patient_education_context) ? dd.patient_education_context : [dd.patient_education_context]; return [dd]; }
      return [r];
    });
    const filtered = arr.filter(r => r && typeof r === 'object');
    filtered.forEach((r, i) => { r._originalIdx = i; });
    return filtered;
  }, [docProp, data, templateData]);

  /* recordId helper (string / {$oid}) for matching localStorage drafts to records. */
  const recordIdOf = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     fieldPart "field"          → localEdits[`field-idx`] = value
     fieldPart "field.arrayIdx" → localEdits[`field-idx`] rebuilt from the record array with the item replaced. */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = recordIdOf(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const lastDot = fieldPart.lastIndexOf('.');
        const seg = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayItem = lastDot !== -1 && /^\d+$/.test(seg);
        if (isArrayItem) {
          const fn = fieldPart.slice(0, lastDot);
          const arrIndex = parseInt(seg, 10);
          const baseArr = Array.isArray(record[fn]) ? record[fn] : [];
          const merged = nLocal[`${fn}-${idx}`] !== undefined && Array.isArray(nLocal[`${fn}-${idx}`])
            ? [...nLocal[`${fn}-${idx}`]] : [...baseArr];
          merged[arrIndex] = value;
          nLocal[`${fn}-${idx}`] = merged;
          nPending[`${fn}-${idx}`] = true;
          nFields[`${fn}.${arrIndex}-${idx}`] = 'edited';
        } else {
          nLocal[`${fieldPart}-${idx}`] = value;
          nPending[`${fieldPart}-${idx}`] = true;
          if (SENTENCE_FIELDS.includes(fieldPart)) nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
          else nFields[`${fieldPart}-${idx}`] = 'edited';
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records, recordIdOf]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  /* hasFieldVal: null/undefined-safe presence check with per-field zero hiding (4-AREA RULE: used by JSX, Copy Section, Copy All and mirrored in PDF) */
  const hasFieldVal = useCallback((fn, v) => { if (HIDE_ZERO_FIELDS.includes(fn) && v === 0) return false; return hasVal(v); }, [hasVal]);
  /* dateHasVal: present + not the 1970-01-01 epoch "not set" sentinel */
  const dateHasVal = useCallback((v) => hasVal(v) && !isEpochDate(v), [hasVal]);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); const s = String(v || ''); return s.replace(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?/g, '$1 $2'); }, []);
  const arrItemText = useCallback((item) => { if (item === null || item === undefined) return ''; if (typeof item === 'object') return Object.values(item).filter(x => x !== null && x !== undefined && x !== '').map(String).join(' — '); return String(item); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  const splitBySemicolon = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/;\s*/).map(s => s.trim()).filter(Boolean);
  }, []);

  function reconstructFullText(sentences, isSemicolon) {
    if (!sentences || sentences.length === 0) return '';
    if (isSemicolon) return sentences.join('; ');
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

  const valueMatchesPhrase = useCallback((fn, val, phrase) => {
    if (val === null || val === undefined) return false;
    if (Array.isArray(val)) {
      return val.some(item => arrItemText(item).toLowerCase().includes(phrase));
    }
    return fmtVal(val).toLowerCase().includes(phrase);
  }, [fmtVal, arrItemText]);

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
    return t.startsWith(p) || p.startsWith(t);
  }, [searchTerm]);

  /* ═══════ SEARCH — 4-LEVEL ═══════ */
  const shouldShowSection = useCallback((record, sid, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.startsWith(phrase) || phrase.startsWith(title)) return true;
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.startsWith(phrase) || phrase.startsWith(label)) return true;
      const val = getFieldValue(record, f, idx);
      if (!hasFieldVal(f, val)) continue;
      if (valueMatchesPhrase(f, val, phrase)) return true;
    }
    return false;
  }, [searchTerm, getFieldValue, valueMatchesPhrase, hasFieldVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (!hasFieldVal(fn, val)) return false;
    return valueMatchesPhrase(fn, val, phrase);
  }, [searchTerm, getFieldValue, valueMatchesPhrase, hasFieldVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record) => {
      const oi = record._originalIdx ?? 0;
      record._showAllSections = false;
      /* Level 1: document title + record title */
      const docTitle = 'patient education context';
      const rt = `patient education context ${oi + 1}`;
      if (docTitle.includes(phrase) || phrase.includes(docTitle) || rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      /* Level 2: section titles */
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      /* Level 3: field labels (keyToLabel) */
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      /* Level 4: values ("Label: Value" entries match via label/value cross-inclusion above + value scan here) */
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, oi);
          if (!hasFieldVal(f, val)) continue;
          if (valueMatchesPhrase(f, val, phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, valueMatchesPhrase, hasFieldVal]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record) => {
      const oi = record._originalIdx ?? 0;
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === oi) {
          merged[m[1]] = localEdits[key];
        }
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
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const periodItems = splitBySentence(currentVal);
    const isSemicolon = periodItems.length < 2;
    const sentences = isSemicolon ? splitBySemicolon(currentVal) : periodItems;
    const editedVal = editValue.trim();
    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    const stageDraft = (fullText) => { const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = fullText; writeDrafts(store); };
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated, isSemicolon);
      setSaveError(null);
      setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
      setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
      stageDraft(fullText);
      setEditingField(null); setEditValue('');
      return;
    }
    const newPeriodItems = splitBySentence(editedVal);
    const newSentences = newPeriodItems.length >= 2 ? newPeriodItems : (isSemicolon ? splitBySemicolon(editedVal) : newPeriodItems);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated, isSemicolon);
    setSaveError(null);
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
    stageDraft(fullText);
    setEditingField(null); setEditValue('');
  }

  function saveCommaItem(record, fn, idx, sid, sIdx, ciIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const periodItems = splitBySentence(currentVal);
    const isSemicolon = periodItems.length < 2;
    const sentences = isSemicolon ? splitBySemicolon(currentVal) : periodItems;
    const s = sentences[sIdx] || '';
    const p = parseLabel(s);
    if (!p.isLabeled) return;
    const semiSub = splitBySemicolon(p.value);
    const useSemicolon = semiSub.length >= 2;
    const items = useSemicolon ? semiSub : splitByComma(p.value);
    const trimmed = editValue.trim();
    const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp);
    if (subParts.length > 1) { items.splice(ciIdx, 1, ...subParts); } else { items[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); }
    const joiner = useSemicolon ? '; ' : ', ';
    const rebuilt = `${p.label}: ${items.join(joiner)}.`;
    const allS = [...sentences]; allS[sIdx] = rebuilt;
    const fullText = reconstructFullText(allS, isSemicolon);
    setSaveError(null);
    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    const sentenceKey = `${fn}-${idx}-s${sIdx}`;
    const commaKey = `${sentenceKey}-c${ciIdx}`;
    const marks = { [commaKey]: 'edited' };
    for (let ei = 1; ei < subParts.length; ei++) marks[`${sentenceKey}-c${ciIdx + ei}`] = 'added';
    setEditedSentences(prev => ({ ...prev, ...marks }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
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
      // Persist each staged draft for THIS section's fields (field, or field+arrayIndex for array elements).
      const store = readDrafts();
      const recDrafts = store[id] || {};
      const committedFieldParts = [];
      for (const [fieldPart, value] of Object.entries(recDrafts)) {
        const lastDot = fieldPart.lastIndexOf('.');
        const seg = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayItem = lastDot !== -1 && /^\d+$/.test(seg);
        const baseField = isArrayItem ? fieldPart.slice(0, lastDot) : fieldPart;
        if (!fields.includes(baseField)) continue; // only this section's fields
        const payload = { field: baseField, value };
        if (isArrayItem) payload.arrayIndex = parseInt(seg, 10);
        const resp = await secureApiClient.put(`/api/edit/patient_education_context/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        committedFieldParts.push(fieldPart);
      }
      await secureApiClient.put(`/api/edit/patient_education_context/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const n = { ...prev };
        fields.forEach(f => { delete n[`${f}-${idx}`]; });
        return n;
      });
      // Drop this section's committed drafts from localStorage
      if (committedFieldParts.length > 0) {
        const s2 = readDrafts();
        if (s2[id]) { committedFieldParts.forEach(fp => { delete s2[id][fp]; }); if (Object.keys(s2[id]).length === 0) delete s2[id]; writeDrafts(s2); }
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
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
  const copySectionText = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* ═══════ FORMAT HELPERS FOR COPY ═══════ */
  const formatSentenceFieldLines = useCallback((text) => {
    const sentences = splitBySentence(text);
    const lines = []; let n = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        const semiItems = splitBySemicolon(parsed.value);
        const parts = semiItems.length >= 2 ? semiItems : splitByComma(parsed.value);
        const hasOxford = parts.some(ci => ci.trim().toLowerCase().startsWith('and '));
        if (parts.length >= 2 && !hasOxford) {
          lines.push(parsed.label + ':');
          parts.forEach(item => { lines.push(`  ${n++}. ${item}`); });
        } else { lines.push(parsed.label + ':'); lines.push(`  ${n++}. ${parsed.value}`); }
      } else { lines.push(`${n++}. ${s}`); }
    });
    return lines;
  }, [splitBySentence, splitBySemicolon]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title.toUpperCase()}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasFieldVal(f, val)) return;
      const showLabel = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
      if (ARRAY_FIELDS.includes(f)) {
        const items = (Array.isArray(val) ? val : [val]).map(arrItemText).filter(Boolean);
        if (items.length === 0) return;
        if (showLabel) text += `${label}\n`;
        text += `${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}\n\n`;
      } else if (SENTENCE_FIELDS.includes(f)) {
        const strVal = fmtVal(val);
        const periodItems = splitBySentence(strVal);
        const isSemicolon = periodItems.length < 2;
        if (!isSemicolon) {
          if (showLabel) text += `${label}\n`;
          formatSentenceFieldLines(strVal).forEach(l => { text += `${l}\n`; });
          text += '\n';
        } else {
          const semiItems = splitBySemicolon(strVal);
          if (semiItems.length >= 2) {
            if (showLabel) text += `${label}\n`;
            semiItems.forEach((item, i) => { text += `${i + 1}. ${item}\n`; });
            text += '\n';
          } else {
            const commaItems = splitByComma(strVal);
            const hasOxfordCopy = commaItems.some(ci => ci.trim().toLowerCase().startsWith('and '));
            if (commaItems.length >= 2 && !hasOxfordCopy) {
              if (showLabel) text += `${label}\n`;
              commaItems.forEach((item, i) => { text += `${i + 1}. ${item}\n`; });
              text += '\n';
            } else {
              if (showLabel) text += `${label}\n`;
              text += `${strVal}\n\n`;
            }
          }
        }
      } else {
        text += `${label}\n${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, hasFieldVal, fmtVal, splitBySentence, splitBySemicolon, formatSentenceFieldLines, arrItemText]);

  const copyAllText = useCallback(async () => {
    let text = '=== PATIENT EDUCATION CONTEXT ===\n\n';
    pdfData.forEach((r) => {
      const oi = r._originalIdx ?? 0;
      text += `Patient Education Context ${oi + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, oi, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: SIMPLE FIELD (no splitting — providers, categories, levels, durations) ═══════ */
  const renderSimpleField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasFieldVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    const isNumber = NUMBER_FIELDS.includes(fn);
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* saveNumber — parse the typed number, reject non-numbers, save a real Number (not a string) */
    const saveNumber = () => {
      const n = parseFloat(editValue);
      if (isNaN(n)) { setSaveError('Please enter a valid number'); return; }
      handleSaveField(record, fn, idx, sid, null, n);
    };

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(isNumber ? String(val) : displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isNumber ? (
                <div className="num-stepper-row">
                  <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) - 1)); }}>&minus;</button>
                  <input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); saveNumber(); } }} />
                  <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) + 1)); }}>+</button>
                </div>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { handleSaveField(record, fn, idx, sid, null, editValue); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNumber) { saveNumber(); } else { handleSaveField(record, fn, idx, sid, null, editValue); } }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: ARRAY FIELD (per-item editing with arrayIndex — items render VERBATIM, never split) ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(item => arrItemText(item)) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, itemIdx) => {
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemStr = arrItemText(item);
          /* Labeled items ("Title: subtitle" material names) render the label as a nested-subtitle
             ABOVE the value — never a side-by-side "Label: value" row. parseLabel first (canonical),
             then a title fallback for clause-opener leads ("When to Call…") parseLabel declines. */
          const ip = parseLabel(itemStr);
          let itemLabel = ip.isLabeled ? ip.label : null;
          let itemBody = ip.isLabeled ? ip.value : itemStr;
          if (!itemLabel) { const cm = itemStr.match(/^([A-Za-z][^:]{1,60}?):\s+(\S[\s\S]*)$/); if (cm) { itemLabel = cm[1].trim(); itemBody = cm[2].trim(); } }

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
          }

          /* saveArrayItem — named closure shared by Save button AND Ctrl+Enter. Stages a DRAFT (no DB write);
             the draft store keeps the item under "fn.itemIdx" so Approve replays it with arrayIndex. */
          const saveArrayItem = () => { const id2 = safeId(record); if (!id2) return; setSaveError(null); const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = editValue; setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: currentArr })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); const store = readDrafts(); if (!store[id2]) store[id2] = {}; store[id2][`${fn}.${itemIdx}`] = editValue; writeDrafts(store); setEditingField(null); setEditValue(''); };

          return (
            <div key={itemIdx}>
              {itemLabel && <div className="nested-subtitle">{highlightText(itemLabel)}</div>}
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { saveArrayItem(); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveArrayItem(); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(itemBody)}</span><span className="edit-indicator">&#9998;</span></div>
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

  /* ═══════ RENDER: SENTENCE FIELD with splitBySentence / splitBySemicolon ═══════ */
  const renderSentenceField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasFieldVal(fn, val)) return null;
    const strVal = fmtVal(val);
    const periodItems = splitBySentence(strVal);
    const isSemicolon = periodItems.length < 2;
    const sentences = isSemicolon ? splitBySemicolon(strVal) : periodItems;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence: render with period-first splitting, parseLabel for subtitles */
    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn}>
          <div className="rec-mini-card">
            {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
            {sentences.map((sentence, sIdx) => {
              const sentenceKey = `${fn}-${idx}-s${sIdx}`;
              const isEditing = editingField === sentenceKey;
              const badge = editedSentences[sentenceKey];
              const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
              if (!sentenceMatches && searchTerm.trim()) return null;

              const parsed = parseLabel(sentence);
              if (parsed.isLabeled) {
                const semiItems2 = splitBySemicolon(parsed.value);
                const commaItems = semiItems2.length >= 2 ? semiItems2 : splitByComma(parsed.value);
                const hasOxfordComma = commaItems.some(ci => ci.trim().toLowerCase().startsWith('and '));
                const parsedLabelMatch = searchTerm.trim() && parsed.label.toLowerCase().includes(searchTerm.toLowerCase().trim());
                if (commaItems.length >= 2 && !hasOxfordComma) {
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
                                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { saveCommaItem(record, fn, idx, sid, sIdx, ciIdx); } }} />
                                  {saveError && <div className="save-error">{saveError}</div>}
                                  <div className="edit-actions">
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItem(record, fn, idx, sid, sIdx, ciIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                            {ciBadge && <span className={`modified-badge ${ciBadge === 'added' ? 'added' : ''}`}>{ciBadge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                }
              }

              /* Regular sentence row — saveThisSentence shared by Save button AND Ctrl+Enter (both restore periods via reconstructFullText) */
              const saveThisSentence = () => { if (parsed.isLabeled) { const id = safeId(record); if (!id) return; const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const currentSentences = isSemicolon ? splitBySemicolon(String(getFieldValue(record, fn, idx) || '')) : splitBySentence(String(getFieldValue(record, fn, idx) || '')); currentSentences[sIdx] = reconstructed; const fullText = reconstructFullText(currentSentences, isSemicolon); setSaveError(null); setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = fullText; writeDrafts(store); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } };
              return (
                <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                  {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { saveThisSentence(); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveThisSentence(); }}>{saving ? 'Saving...' : 'Save'}</button>
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

    /* Single-value: split comma items into separate rows (labeled or not) */
    const singleCommaItems = splitByComma(strVal);
    const hasOxfordComma = singleCommaItems.some(ci => ci.trim().toLowerCase().startsWith('and '));

    if (singleCommaItems.length >= 2 && !hasOxfordComma) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn}>
          <div className="rec-mini-card">
            {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
            {singleCommaItems.map((ci, ciIdx) => {
              const ciParsed = parseLabel(ci);
              const commaKey = `${fn}-${idx}-s0-c${ciIdx}`;
              const ciEditing = editingField === commaKey;
              const ciBadge = editedSentences[commaKey];
              const ciMatches = phraseMatch || labelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
              if (!ciMatches && searchTerm.trim()) return null;

              if (ciParsed.isLabeled) {
                const saveLabeledCommaItem = () => { const id = safeId(record); if (!id) return; const allItems = splitByComma(String(getFieldValue(record, fn, idx) || '')); allItems[ciIdx] = `${ciParsed.label}: ${editValue.trim()}`; const fullText = allItems.join(', '); setSaveError(null); setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = fullText; writeDrafts(store); setEditingField(null); setEditValue(''); };
                return (
                  <div key={ciIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                    <div className="nested-subtitle">{highlightText(ciParsed.label)}</div>
                    <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ciParsed.value); setSaveError(null); } }}>
                      {ciEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { saveLabeledCommaItem(); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveLabeledCommaItem(); }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(ciParsed.value)}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${ciParsed.label}: ${ciParsed.value}`, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {ciBadge && <span className={`modified-badge ${ciBadge === 'added' ? 'added' : ''}`}>{ciBadge === 'added' ? 'added' : 'edited'} - click Pending Approve to save</span>}
                  </div>
                );
              }

              const savePlainCommaItem = () => { const id = safeId(record); if (!id) return; const allItems = splitByComma(String(getFieldValue(record, fn, idx) || '')); allItems[ciIdx] = editValue.trim(); const fullText = allItems.join(', '); setSaveError(null); setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = fullText; writeDrafts(store); setEditingField(null); setEditValue(''); };
              return (
                <div key={ciIdx}>
                  <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                    {ciEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { savePlainCommaItem(); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); savePlainCommaItem(); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                  {ciBadge && <span className={`modified-badge ${ciBadge === 'added' ? 'added' : ''}`}>{ciBadge === 'added' ? 'added' : 'edited'} - click Pending Approve to save</span>}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    /* Single-value string (no comma items): saveSentence editable — Save AND Ctrl+Enter both go through reconstructFullText */
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey] || editedSentences[`${fn}-${idx}-s0`];

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(strVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { saveSentence(record, fn, idx, sid, 0); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, 0); }}>{saving ? 'Saving...' : 'Save'}</button>
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
        {editedSentences[`${fn}-${idx}-s0`] && <span className={`modified-badge ${editedSentences[`${fn}-${idx}-s0`] === 'added' ? 'added' : ''}`}>{editedSentences[`${fn}-${idx}-s0`] === 'added' ? 'added' : 'edited'} - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: RECORD DATE (header BlueDatePicker) — top-level `date` lives ONLY in the header ═══════ */
  const renderRecordDate = (record, idx) => {
    const val = getFieldValue(record, 'date', idx); if (!dateHasVal(val)) return null;
    const editKey = `date-${idx}`;
    const isEditing = editingField === editKey;
    const displayVal = fmtDate(val);
    const isModified = editedFields[editKey];
    return (
      <span className={`record-date ${isModified ? 'modified' : ''}`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }} style={{ cursor: 'pointer' }}>
        {isEditing ? (
          <span className="edit-field-container" onClick={e => e.stopPropagation()}>
            <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} />
            {saveError && <span className="save-error">{saveError}</span>}
            <span className="edit-actions">
              <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, 'date', idx, 'header', null, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
            </span>
          </span>
        ) : (
          <>{highlightText(displayVal)} <span className="edit-indicator">&#9998;</span></>
        )}
      </span>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid, idx)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => {
      const val = getFieldValue(record, f, idx);
      if (ARRAY_FIELDS.includes(f)) return Array.isArray(val) && val.some(item => arrItemText(item));
      return hasFieldVal(f, val);
    });
    if (!hasAnyVal) return null;

    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySectionText(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            if (BOOLEAN_FIELDS.includes(f)) return null; /* no boolean fields in this schema */
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceField(record, f, idx, sid);
            return renderSimpleField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="patient-education-context-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Patient Education Context</h2></div>
        <div className="empty-state">No patient education context records available</div>
      </div>
    );
  }

  return (
    <div className="patient-education-context-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Patient Education Context</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<PatientEducationContextDocumentPDFTemplate document={pdfData} />} fileName="Patient_Education_Context.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search patient education context..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => {
          const origIdx = record._originalIdx ?? idx;
          return (
            <div key={safeId(record) || idx} className="record-card">
              {/* date field EXISTS in this schema — editable BlueDatePicker in the record header (NOT in any section) */}
              <div className="record-header">
                {dateHasVal(record.date) && (
                  <div className="record-meta-row">
                    {renderRecordDate(record, origIdx)}
                  </div>
                )}
                <h3 className="record-name">{highlightText(`Patient Education Context ${origIdx + 1}`)}</h3>
              </div>
              {renderSection(record, origIdx, 'session-overview')}
              {renderSection(record, origIdx, 'teaching-method')}
              {renderSection(record, origIdx, 'comprehension-engagement')}
              {renderSection(record, origIdx, 'content-covered')}
              {renderSection(record, origIdx, 'follow-up')}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PatientEducationContextDocument;
