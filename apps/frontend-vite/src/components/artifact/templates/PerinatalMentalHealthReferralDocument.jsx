/**
 * PerinatalMentalHealthReferralDocument.jsx
 * June 2026 — Perinatal mental health referral (EPDS / PHQ-9 / GAD-7 screening + risk + referral)
 * Collection: perinatal_mental_health_referral
 *
 * 6 Sections (covering all 21 extractable fields, none added):
 *   1. screening:     edinburghPostnatalScore, phq9Score, gad7Score, gestationalAgeAtScreening, weeksPostpartum
 *   2. risk:          suicidalIdeationPresent, psychosisRiskFactors, previousPsychiatricHistory,
 *                     maternalBondingImpairment, substanceUseHistory, domesticViolenceScreening
 *   3. clinical:      breastfeedingStatus, sleepDisturbanceLevel, appetiteChanges, socialSupportLevel, infantMedicalIssues
 *   4. pregnancy-delivery: pregnancyComplications, deliveryComplications
 *   5. medications:   currentPsychotropicMedications
 *   6. referral:      referralUrgencyLevel, requestedSpecialtyServices
 *
 * Field handling:
 *   - Booleans → Yes/No (false is meaningful, always shown)
 *   - Numbers  → numeric presence check (0/absent hidden, NEVER truthiness); EPDS /30, PHQ-9 /27, GAD-7 /21 suffixes
 *   - Strings  → shown when non-empty, per-sentence editing
 *   - Arrays   → splitByComma + per-item editing with arrayIndex, hidden when empty
 *
 * No date field exists → record header is TITLE-ONLY: "Perinatal Mental Health Referral {idx+1}".
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PerinatalMentalHealthReferralDocumentPDFTemplate from '../pdf-templates/PerinatalMentalHealthReferralDocumentPDFTemplate';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './PerinatalMentalHealthReferralDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'perinatal_mental_health_referralPendingEdits';
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
  'screening': 'Screening Scores',
  'risk': 'Risk Assessment',
  'clinical': 'Clinical Context',
  'pregnancy-delivery': 'Pregnancy & Delivery',
  'medications': 'Current Psychotropic Medications',
  'referral': 'Referral',
};

const FIELD_LABELS = {
  edinburghPostnatalScore: 'Edinburgh Postnatal Depression Score',
  phq9Score: 'PHQ-9 Score',
  gad7Score: 'GAD-7 Score',
  gestationalAgeAtScreening: 'Gestational Age at Screening',
  weeksPostpartum: 'Weeks Postpartum',
  suicidalIdeationPresent: 'Suicidal Ideation Present',
  psychosisRiskFactors: 'Psychosis Risk Factors',
  previousPsychiatricHistory: 'Previous Psychiatric History',
  maternalBondingImpairment: 'Maternal Bonding Impairment',
  substanceUseHistory: 'Substance Use History',
  domesticViolenceScreening: 'Domestic Violence Screening',
  breastfeedingStatus: 'Breastfeeding Status',
  sleepDisturbanceLevel: 'Sleep Disturbance Level',
  appetiteChanges: 'Appetite Changes',
  socialSupportLevel: 'Social Support Level',
  infantMedicalIssues: 'Infant Medical Issues',
  pregnancyComplications: 'Pregnancy Complications',
  deliveryComplications: 'Delivery Complications',
  currentPsychotropicMedications: 'Current Psychotropic Medications',
  referralUrgencyLevel: 'Referral Urgency Level',
  requestedSpecialtyServices: 'Requested Specialty Services',
};

const SECTION_FIELDS = {
  'screening': ['edinburghPostnatalScore', 'phq9Score', 'gad7Score', 'gestationalAgeAtScreening', 'weeksPostpartum'],
  'risk': ['suicidalIdeationPresent', 'psychosisRiskFactors', 'previousPsychiatricHistory', 'maternalBondingImpairment', 'substanceUseHistory', 'domesticViolenceScreening'],
  'clinical': ['breastfeedingStatus', 'sleepDisturbanceLevel', 'appetiteChanges', 'socialSupportLevel', 'infantMedicalIssues'],
  'pregnancy-delivery': ['pregnancyComplications', 'deliveryComplications'],
  'medications': ['currentPsychotropicMedications'],
  'referral': ['referralUrgencyLevel', 'requestedSpecialtyServices'],
};

// Booleans: always render Yes/No (false is clinically meaningful)
const BOOLEAN_FIELDS = ['suicidalIdeationPresent', 'previousPsychiatricHistory', 'maternalBondingImpairment', 'psychosisRiskFactors', 'substanceUseHistory', 'infantMedicalIssues'];
// Numbers: hide when 0/absent via numeric presence check (NEVER truthiness)
const NUMBER_FIELDS = ['edinburghPostnatalScore', 'gestationalAgeAtScreening', 'weeksPostpartum', 'phq9Score', 'gad7Score'];
// MEANINGFUL_ZERO_FIELDS: numerics where 0 is a valid clinical finding, not "not recorded".
// EPDS/PHQ-9/GAD-7 score 0 = no symptoms (clinically meaningful); weeksPostpartum 0 = delivery day.
// gestationalAgeAtScreening is excluded: 0 in postpartum screening = N/A sentinel, hidden when 0.
const MEANINGFUL_ZERO_FIELDS = ['edinburghPostnatalScore', 'phq9Score', 'gad7Score', 'weeksPostpartum'];
// Arrays: splitByComma + per-item editing, hide when empty
const ARRAY_FIELDS = ['currentPsychotropicMedications', 'pregnancyComplications', 'deliveryComplications', 'requestedSpecialtyServices'];
// Enums: fixed-choice clinical dropdowns (BlueSelect). "Act like a medical professional": each of these
// five fields stores a single canonical descriptor, so they render as themed dropdowns rather than free text.
// domesticViolenceScreening stays free-text (its stored format is unknown — empty in the data — so no enum invented).
const ENUM_FIELDS = ['breastfeedingStatus', 'sleepDisturbanceLevel', 'appetiteChanges', 'socialSupportLevel', 'referralUrgencyLevel'];
const ENUM_OPTIONS = {
  breastfeedingStatus: ['Exclusive Breastfeeding', 'Partial Breastfeeding', 'Formula Feeding', 'Not Breastfeeding', 'Weaning'],
  sleepDisturbanceLevel: ['None', 'Mild', 'Moderate', 'Severe'],
  appetiteChanges: ['Unchanged', 'Increased', 'Decreased'],
  socialSupportLevel: ['Poor', 'Limited', 'Adequate', 'Good', 'Strong'],
  referralUrgencyLevel: ['Routine', 'Urgent', 'Emergent'],
};
// Free-text string fields (narrative).
const STRING_FIELDS = ['domesticViolenceScreening'];

// enumCanonical: title-case the stored value ('exclusive breastfeeding' -> 'Exclusive Breastfeeding').
const enumCanonical = (v) => {
  const s = String(v == null ? '' : v).trim();
  if (!s) return '';
  return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
};
// enumOptionsWith: canonical option list, plus the current value when it is not already a listed option.
const enumOptionsWith = (fn, v) => {
  const base = ENUM_OPTIONS[fn] || [];
  const cur = enumCanonical(v);
  if (cur && !base.some(o => o.toLowerCase() === cur.toLowerCase())) return [...base, cur];
  return base;
};

// Screening score suffixes (EPDS /30, PHQ-9 /27, GAD-7 /21)
const SCORE_SUFFIX = {
  edinburghPostnatalScore: '/30',
  phq9Score: '/27',
  gad7Score: '/21',
};

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

/* ═══════ COMPONENT ═══════ */
const PerinatalMentalHealthReferralDocument = ({ document: docProp, data, templateData }) => {
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

  /* ═══════ DATA UNWRAP (3-prop signature; all wrapper formats) ═══════ */
  const records = useMemo(() => {
    const source = docProp ?? data ?? templateData;
    if (!source) return [];
    let arr = Array.isArray(source) ? source : [source];
    arr = arr.flatMap(r => {
      if (r?.perinatal_mental_health_referral) return Array.isArray(r.perinatal_mental_health_referral) ? r.perinatal_mental_health_referral : [r.perinatal_mental_health_referral];
      if (r?.data?.perinatal_mental_health_referral) return Array.isArray(r.data.perinatal_mental_health_referral) ? r.data.perinatal_mental_health_referral : [r.data.perinatal_mental_health_referral];
      if (r?.documentData?.perinatal_mental_health_referral) return Array.isArray(r.documentData.perinatal_mental_health_referral) ? r.documentData.perinatal_mental_health_referral : [r.documentData.perinatal_mental_health_referral];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.perinatal_mental_health_referral) return Array.isArray(dd.perinatal_mental_health_referral) ? dd.perinatal_mental_health_referral : [dd.perinatal_mental_health_referral]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp, data, templateData]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  // Maps each record's _id ($oid-aware) → its render index, then repopulates localEdits/pendingEdits + markers.
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const rid = idOf(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = 'edited';
        // For dotted (array-item) fieldParts the editedFields editKey above already matches the
        // "field.itemIdx-idx" badge key; for plain fields also flag the s0 sentence marker.
        if (fieldPart.indexOf('.') === -1) nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  // hasVal for strings + booleans + arrays; numbers handled per-field in fieldHasVal (meaningful-zero aware).
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); if (Array.isArray(v)) return v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').join(', '); return String(v || ''); }, []);

  // Per-field presence: booleans always present; numbers use hasNumber; arrays non-empty; strings non-empty.
  const fieldHasVal = useCallback((fn, v) => {
    if (BOOLEAN_FIELDS.includes(fn)) return typeof v === 'boolean' || v === 'true' || v === 'false';
    if (NUMBER_FIELDS.includes(fn)) {
      // Meaningful-zero scores (EPDS/PHQ-9/GAD-7, weeksPostpartum) render at 0; others hide 0/absent.
      if (v === null || v === undefined || v === '') return false;
      const n = Number(v);
      if (!Number.isFinite(n)) return false;
      if (n === 0) return MEANINGFUL_ZERO_FIELDS.includes(fn);
      return true;
    }
    if (ARRAY_FIELDS.includes(fn)) return Array.isArray(v) && v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0;
    return hasVal(v);
  }, [hasVal]);

  // value-aware formatter that returns null when absent (numeric-safe for searchableText)
  const formatValue = useCallback((fn, v) => {
    if (!fieldHasVal(fn, v)) return null;
    if (BOOLEAN_FIELDS.includes(fn)) return (v === true || v === 'true') ? 'Yes' : 'No';
    if (NUMBER_FIELDS.includes(fn)) { const suffix = SCORE_SUFFIX[fn] || ''; return `${v}${suffix}`; }
    if (ENUM_FIELDS.includes(fn)) return enumCanonical(v);
    if (ARRAY_FIELDS.includes(fn)) return fmtVal(v);
    return fmtVal(v);
  }, [fieldHasVal, fmtVal]);

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
      const fv = formatValue(f, val);
      if (fv !== null && fv.toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm, getFieldValue, formatValue]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    const fv = formatValue(fn, val);
    if (fv !== null) return fv.toLowerCase().includes(phrase);
    return false;
  }, [searchTerm, getFieldValue, formatValue]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Perinatal Mental Health Referral ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          const fv = formatValue(f, val);
          if (fv !== null && fv.toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, formatValue]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          merged[m[1]] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    // Re-edit after approval → drop the section's approved flag so the button returns to yellow Pending Approve
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    // Persist DRAFT to localStorage (plain field → fieldPart = fn). Booleans/numbers stored as their saved value.
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setSaveError(null);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // Save one sentence = stage a DRAFT locally (full reconstructed text) + persist to localStorage.
  // No DB write here; Approve commits. fieldPart = fn (plain field).
  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const allCurrent = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    const stageDraft = (fullText) => {
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][fn] = fullText;
      writeDrafts(store);
    };
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...allCurrent]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
      setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
      setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' }));
      setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
      stageDraft(fullText);
      setSaveError(null);
      setEditingField(null); setEditValue('');
      return;
    }
    const updated = [...allCurrent]; updated[sentenceIdx] = editedVal;
    const fullText = reconstructFullText(updated);
    const newSentences = splitBySentence(fullText);
    const extraCount = newSentences.length - allCurrent.length;
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    const editedMap = {};
    editedMap[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
    if (extraCount > 0) {
      for (let si = sentenceIdx + 1; si <= sentenceIdx + extraCount; si++) {
        editedMap[`${fn}-${idx}-s${si}`] = 'added';
      }
    }
    setEditedSentences(prev => {
      const cleaned = {};
      for (const key of Object.keys(prev)) {
        if (!key.startsWith(`${fn}-${idx}-s`)) cleaned[key] = prev[key];
      }
      return { ...cleaned, ...editedMap };
    });
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    stageDraft(fullText);
    setSaveError(null);
    setEditingField(null); setEditValue('');
  }

  /* save a single array element (arrayIndex editing) = stage a DRAFT locally + persist to localStorage.
     localEdits[`${fn}-${idx}`] holds the WHOLE updated array (drives JSX/PDF rendering).
     The localStorage draft stores the per-element payload exactly as the old DB call did, so Approve
     can replay it: empty removal → draft key `${fn}` = full array (no arrayIndex);
     element edit → draft key `${fn}.${itemIdx}` = trimmed value (Approve adds arrayIndex). No DB write here. */
  function saveArrayItem(record, fn, idx, sid, itemIdx, editKey) {
    const id = safeId(record); if (!id) return;
    const currentArr = Array.isArray(getFieldValue(record, fn, idx)) ? [...getFieldValue(record, fn, idx)] : [];
    const trimmed = editValue.trim();
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    // Empty value → remove the element (commit replays full-array write, no arrayIndex)
    if (!trimmed) {
      currentArr.splice(itemIdx, 1);
      setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: currentArr }));
      setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
      setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' }));
      setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
      // Removal supersedes any per-element drafts for this field; store full array under plain key.
      Object.keys(store[id]).forEach(k => { if (k === fn || k.startsWith(`${fn}.`)) delete store[id][k]; });
      store[id][fn] = currentArr;
      writeDrafts(store);
      setSaveError(null);
      setEditingField(null); setEditValue('');
      return;
    }
    currentArr[itemIdx] = trimmed;
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: currentArr }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    store[id][`${fn}.${itemIdx}`] = trimmed;
    writeDrafts(store);
    setSaveError(null);
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
  // values flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    try {
      // Collect this record's drafts that belong to this section, and replay each as the original DB call.
      const store = readDrafts();
      const recDrafts = store[id] || {};
      const toCommit = Object.keys(recDrafts).filter(fieldPart => {
        const base = fieldPart.indexOf('.') === -1 ? fieldPart : fieldPart.slice(0, fieldPart.indexOf('.'));
        return fields.includes(base);
      });
      for (const fieldPart of toCommit) {
        // arrayIndex ONLY when the segment after the LAST dot is purely numeric (reverses saveArrayItem's `${fn}.${itemIdx}`).
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { field: fieldPart, value: recDrafts[fieldPart] };
        if (lastDot !== -1 && /^\d+$/.test(tail)) {
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(tail, 10);
        }
        const resp = await secureApiClient.put(`/api/edit/perinatal_mental_health_referral/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/perinatal_mental_health_referral/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF (pending keys live as `${field}-${idx}`)
      setPendingEdits(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      // Drop this record's section drafts from localStorage (now committed)
      if (store[id]) {
        toCommit.forEach(fp => delete store[id][fp]);
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
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
    const title = SECTION_TITLES[sid];
    const fields = SECTION_FIELDS[sid] || [];
    let body = '';
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!fieldHasVal(f, val)) return;
      // Single-name gate: a field label that equals its section title suppresses the sub-label head.
      const sameAsTitle = label.trim().toLowerCase() === (title || '').trim().toLowerCase();
      const head = sameAsTitle ? '' : `${label}\n${'='.repeat(40)}\n`;
      if (BOOLEAN_FIELDS.includes(f) || NUMBER_FIELDS.includes(f) || ENUM_FIELDS.includes(f)) {
        body += `${head}1. ${formatValue(f, val)}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val.filter(x => x !== null && x !== undefined && String(x).trim() !== '') : [];
        body += head;
        items.forEach((item, i) => { body += `${i + 1}. ${item}\n`; });
        body += '\n';
      } else {
        const strVal = fmtVal(val);
        const sentences = splitBySentence(strVal);
        if (sentences.length > 1) {
          body += head;
          formatSentenceFieldLines(strVal).forEach(l => { body += `${l}\n`; });
          body += '\n';
        } else {
          body += `${head}1. ${strVal}\n\n`;
        }
      }
    });
    if (!body.trim()) return '';
    return `${title}\n${'='.repeat(40)}\n\n${body}`;
  }, [getFieldValue, fieldHasVal, fmtVal, formatValue, splitBySentence, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== PERINATAL MENTAL HEALTH REFERRAL ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Perinatal Mental Health Referral ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: BOOLEAN FIELD (Yes/No — false always shown) ═══════ */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!fieldHasVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const boolVal = (val === true || val === 'true');
    const displayVal = boolVal ? 'Yes' : 'No';
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(boolVal ? 'Yes' : 'No'); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue} options={['Yes', 'No']} onChange={v => setEditValue(v)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, null, editValue === 'Yes'); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: NUMBER FIELD (hidden when 0/absent; score suffix appended) ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!fieldHasVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const suffix = SCORE_SUFFIX[fn] || '';
    const displayVal = `${val}${suffix}`;
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={() => setEditValue(String((parseFloat(editValue) || 0) - 1))} disabled={saving}>&#8722;</button>
                <input type="text" inputMode="decimal" className="num-stepper-input" value={editValue} onChange={e => setEditValue(e.target.value.replace(/[^0-9.\-]/g, ''))} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.preventDefault(); const numVal = Number(editValue); if (!Number.isFinite(numVal) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); } }} />
                <button type="button" className="num-step" onClick={() => setEditValue(String((parseFloat(editValue) || 0) + 1))} disabled={saving}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = Number(editValue); if (!Number.isFinite(numVal) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: ENUM FIELD (BlueSelect fixed-choice dropdown) ═══════ */
  const renderEnumField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!fieldHasVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = enumCanonical(val);
    const isModified = editedFields[editKey];
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const options = enumOptionsWith(fn, val);

    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue} options={options} onChange={v => setEditValue(v)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, null, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: ARRAY FIELD (splitByComma + per-item arrayIndex editing) ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(x => x !== null && x !== undefined && String(x).trim() !== '') : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
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
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveArrayItem(record, fn, idx, sid, itemIdx, editKey); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!fieldHasVal(fn, val)) return null;
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

              return (
                <div key={sIdx}>
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
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
    }

    /* Single-value string */
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey] || editedSentences[`${fn}-${idx}-s0`];

    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(strVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
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
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => fieldHasVal(f, getFieldValue(record, f, idx)));
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
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            if (ENUM_FIELDS.includes(f)) return renderEnumField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="perinatal-mental-health-referral-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Perinatal Mental Health Referral</h2></div>
        <div className="empty-state">No perinatal mental health referral records available</div>
      </div>
    );
  }

  return (
    <div className="perinatal-mental-health-referral-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Perinatal Mental Health Referral</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<PerinatalMentalHealthReferralDocumentPDFTemplate document={pdfData} />} fileName="Perinatal_Mental_Health_Referral.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search perinatal mental health referral..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Perinatal Mental Health Referral ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'screening')}
            {renderSection(record, idx, 'risk')}
            {renderSection(record, idx, 'clinical')}
            {renderSection(record, idx, 'pregnancy-delivery')}
            {renderSection(record, idx, 'medications')}
            {renderSection(record, idx, 'referral')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PerinatalMentalHealthReferralDocument;
