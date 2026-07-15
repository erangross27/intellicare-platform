/**
 * TmjAssessmentDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: tmj_assessment
 *
 * 9 Sections:
 *   1. rom: maximalIncisorOpening, assistedMouthOpening, lateralExcursionRight, lateralExcursionLeft, protrusiveMovement, deviationOnOpening
 *   2. pain-functional: jawPainIntensity, jawFunctionalLimitationScale, gcps_chronicPainGrade, bruxismPresence
 *   3. joint-sounds: jointSoundsRight, jointSoundsLeft
 *   4. muscle-palpation: masseterPalpationTenderness, temporalisPalpationTenderness, lateralPterygoidPalpation, medialPterygoidPalpation
 *   5. capsular-joint: capsularTenderness
 *   6. disc-assessment: discDisplacementClassification, mriDiscPosition, effusionPresence
 *   7. dc-tmd-diagnosis: dc_tmdDiagnosis
 *   8. occlusion: occlusalClassification, overjetMeasurement, overbiteMeasurement
 *   9. condylar-morphology: condylarMorphology
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BlueSelect from '../components/BlueSelect';
import TmjAssessmentDocumentPDFTemplate from '../pdf-templates/TmjAssessmentDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './TmjAssessmentDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'tmj_assessmentPendingEdits';
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
  'rom': 'Range of Motion',
  'pain-functional': 'Pain and Functional Assessment',
  'joint-sounds': 'Joint Sounds',
  'muscle-palpation': 'Muscle Palpation',
  'capsular-joint': 'Capsular and Joint Assessment',
  'disc-assessment': 'Disc Assessment',
  'dc-tmd-diagnosis': 'DC/TMD Diagnosis',
  'occlusion': 'Occlusion',
  'condylar-morphology': 'Condylar Morphology',
};

const FIELD_LABELS = {
  maximalIncisorOpening: 'Maximal Opening',
  assistedMouthOpening: 'Assisted Opening',
  lateralExcursionRight: 'Lateral Excursion (Right)',
  lateralExcursionLeft: 'Lateral Excursion (Left)',
  protrusiveMovement: 'Protrusive Movement',
  deviationOnOpening: 'Deviation on Opening',
  jawPainIntensity: 'Pain Intensity',
  jawFunctionalLimitationScale: 'Jaw Functional Limitation Scale',
  gcps_chronicPainGrade: 'Chronic Pain Grade (GCPS)',
  bruxismPresence: 'Bruxism',
  jointSoundsRight: 'Right',
  jointSoundsLeft: 'Left',
  masseterPalpationTenderness: 'Masseter',
  temporalisPalpationTenderness: 'Temporalis',
  lateralPterygoidPalpation: 'Lateral Pterygoid',
  medialPterygoidPalpation: 'Medial Pterygoid',
  capsularTenderness: 'Capsular Tenderness',
  discDisplacementClassification: 'Disc Displacement Classification',
  mriDiscPosition: 'MRI Disc Position',
  effusionPresence: 'Effusion',
  dc_tmdDiagnosis: 'DC/TMD Diagnosis',
  occlusalClassification: 'Occlusal Classification',
  overjetMeasurement: 'Overjet',
  overbiteMeasurement: 'Overbite',
  condylarMorphology: 'Condylar Morphology',
};

const SECTION_FIELDS = {
  'rom': ['maximalIncisorOpening', 'assistedMouthOpening', 'lateralExcursionRight', 'lateralExcursionLeft', 'protrusiveMovement', 'deviationOnOpening'],
  'pain-functional': ['jawPainIntensity', 'jawFunctionalLimitationScale', 'gcps_chronicPainGrade', 'bruxismPresence'],
  'joint-sounds': ['jointSoundsRight', 'jointSoundsLeft'],
  'muscle-palpation': ['masseterPalpationTenderness', 'temporalisPalpationTenderness', 'lateralPterygoidPalpation', 'medialPterygoidPalpation'],
  'capsular-joint': ['capsularTenderness'],
  'disc-assessment': ['discDisplacementClassification', 'mriDiscPosition', 'effusionPresence'],
  'dc-tmd-diagnosis': ['dc_tmdDiagnosis'],
  'occlusion': ['occlusalClassification', 'overjetMeasurement', 'overbiteMeasurement'],
  'condylar-morphology': ['condylarMorphology'],
};

/* Mouth-opening measures where 0 is a sentinel (not measured / not performed),
   NOT a clinical reading. Excursions, protrusion, pain and JFLS keep 0 as meaningful. */
const MOUTH_OPENING_SENTINEL_FIELDS = ['maximalIncisorOpening', 'assistedMouthOpening'];
const isSentinelZero = (fn, v) => MOUTH_OPENING_SENTINEL_FIELDS.includes(fn) && (v === 0 || v === '0');

const BOOLEAN_FIELDS = ['bruxismPresence', 'effusionPresence'];
const NUMBER_FIELDS = ['maximalIncisorOpening', 'assistedMouthOpening', 'lateralExcursionRight', 'lateralExcursionLeft', 'protrusiveMovement', 'jawPainIntensity', 'jawFunctionalLimitationScale', 'overjetMeasurement', 'overbiteMeasurement'];
const ARRAY_FIELDS = ['dc_tmdDiagnosis'];
const STRING_FIELDS = ['deviationOnOpening', 'gcps_chronicPainGrade', 'jointSoundsRight', 'jointSoundsLeft', 'masseterPalpationTenderness', 'temporalisPalpationTenderness', 'lateralPterygoidPalpation', 'medialPterygoidPalpation', 'capsularTenderness', 'discDisplacementClassification', 'mriDiscPosition', 'occlusalClassification', 'condylarMorphology'];
const COMMA_SPLIT_FIELDS = new Set(['deviationOnOpening', 'jointSoundsRight', 'jointSoundsLeft', 'masseterPalpationTenderness', 'temporalisPalpationTenderness', 'lateralPterygoidPalpation', 'medialPterygoidPalpation', 'discDisplacementClassification', 'condylarMorphology']);
const PERIOD_SPLIT_FIELDS = new Set(STRING_FIELDS);

const sameAsTitle = (label, sid) => (label || '').trim().toLowerCase() === (SECTION_TITLES[sid] || '').trim().toLowerCase();

const stepFor = value => {
  const match = String(value).trim().match(/\.(\d+)/);
  return match ? Math.pow(10, -match[1].length) : 1;
};

const CLINICAL_UNITS = new Set(['mm', 'cm', 'mcg', 'mg', 'g', 'miu', 'iu', 'ng', 'pg', 'ml', 'dl', 'l', 'mmol']);
const editableNumberTokens = value => {
  const source = String(value ?? '');
  const tokens = [];
  const matcher = /-?\d+(?:\.\d+)?/g;
  let cursor = 0;
  let match;
  let editableIndex = 0;
  while ((match = matcher.exec(source))) {
    if (match.index > cursor) tokens.push({ text: source.slice(cursor, match.index), editable: false });
    const start = match.index;
    const end = start + match[0].length;
    const previousCharacter = source[start - 1] || '';
    const nextCharacter = source[end] || '';
    const adjacentUnit = source.slice(end).match(/^([A-Za-z]+)/)?.[1]?.toLowerCase() || '';
    const editable = previousCharacter !== '#'
      && previousCharacter !== '/'
      && !/[A-Za-z0-9]/.test(previousCharacter)
      && (!/[A-Za-z]/.test(nextCharacter) || CLINICAL_UNITS.has(adjacentUnit));
    tokens.push({ text: match[0], editable, editableIndex: editable ? editableIndex++ : null });
    cursor = end;
  }
  if (cursor < source.length) tokens.push({ text: source.slice(cursor), editable: false });
  return tokens;
};

const replaceEditableNumber = (value, targetIndex, replacement) => editableNumberTokens(value)
  .map(token => token.editable && token.editableIndex === targetIndex ? String(replacement) : token.text)
  .join('');

const NumberTextEditor = ({ value, onChange }) => (
  <div className="multi-number-edit-row">
    {editableNumberTokens(value).map((token, tokenIndex) => {
      if (!token.editable) return <span className="number-edit-unit fixed-number-text" key={`${tokenIndex}-${token.text}`}>{token.text}</span>;
      const change = direction => {
        const step = stepFor(token.text);
        const next = Number((Number(token.text || 0) + direction * step).toFixed(10));
        onChange(replaceEditableNumber(value, token.editableIndex, next));
      };
      return (
        <div className="multi-number-control" key={`${tokenIndex}-${token.editableIndex}`}>
          <button type="button" className="num-step" onClick={event => { event.stopPropagation(); change(-1); }}>&minus;</button>
          <input type="text" inputMode="decimal" className="edit-number" value={token.text} onChange={event => onChange(replaceEditableNumber(value, token.editableIndex, event.target.value))} onClick={event => event.stopPropagation()} />
          <button type="button" className="num-step" onClick={event => { event.stopPropagation(); change(1); }}>+</button>
        </div>
      );
    })}
  </div>
);

const hasEditableNumber = value => editableNumberTokens(value).some(token => token.editable);

const splitEditableClauses = (value, fieldPath) => {
  const source = String(value ?? '');
  const parts = [];
  let current = '';
  let depth = 0;
  const push = delimiter => { if (current.trim()) parts.push({ text: current.trim(), delimiter }); current = ''; };
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(') depth += 1;
    if (character === ')') depth = Math.max(0, depth - 1);
    const next = source[index + 1] || '';
    const previousWord = current.trim().match(/([A-Za-z]+)$/)?.[1] || '';
    const safePeriod = character === '.' && PERIOD_SPLIT_FIELDS.has(fieldPath) && depth === 0 && /\s/.test(next)
      && !['Mr', 'Mrs', 'Ms', 'Dr', 'St', 'Jr', 'Sr', 'Prof', 'Rev', 'Gen', 'Col', 'Sgt', 'vs', 'etc'].includes(previousWord)
      && !/\d$/.test(current);
    const safeComma = character === ',' && COMMA_SPLIT_FIELDS.has(fieldPath) && depth === 0;
    const safeSemicolon = character === ';' && depth === 0;
    if (safePeriod || safeComma || safeSemicolon) {
      let delimiter = character;
      while (/\s/.test(source[index + 1] || '')) { delimiter += source[index + 1]; index += 1; }
      push(delimiter);
    } else current += character;
  }
  push('');
  return parts.length ? parts : [{ text: source, delimiter: '' }];
};

const reconstructClauses = parts => parts.map(part => `${part.text}${part.delimiter}`).join('');

/* ── ROM Bar Chart Config ── */
const ROM_MEASURES = [
  { key: 'maximalIncisorOpening', label: 'Maximal Opening', max: 60, normalMin: 40, unit: 'mm' },
  { key: 'assistedMouthOpening', label: 'Assisted Opening', max: 60, normalMin: 45, unit: 'mm' },
  { key: 'lateralExcursionRight', label: 'Lateral Excursion (Right)', max: 15, normalMin: 8, unit: 'mm' },
  { key: 'lateralExcursionLeft', label: 'Lateral Excursion (Left)', max: 15, normalMin: 8, unit: 'mm' },
  { key: 'protrusiveMovement', label: 'Protrusive Movement', max: 15, normalMin: 8, unit: 'mm' },
];

const getRomColor = (value, normalMin) => {
  if (value >= normalMin) return '#22c55e';
  if (value >= normalMin * 0.7) return '#fbbf24';
  return '#ef4444';
};

const getRomInterpretation = (value, normalMin) => {
  if (value >= normalMin) return 'Normal';
  if (value >= normalMin * 0.7) return 'Mild';
  return 'Restricted';
};

const romToPercentage = (value, max) => Math.min(100, Math.max(2, (value / max) * 100));

const getPainColor = (value) => {
  if (value <= 3) return '#22c55e';
  if (value <= 6) return '#fbbf24';
  return '#ef4444';
};

const getPainInterpretation = (value) => {
  if (value <= 3) return 'Mild';
  if (value <= 6) return 'Moderate';
  return 'Severe';
};

const painToPercentage = (value) => Math.min(100, Math.max(2, (value / 10) * 100));

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

/* Bilateral Text Parser (for capsularTenderness) */
const parseBilateralText = (text) => {
  if (!text) return null;
  const matches = [...text.matchAll(/((?:Right|Left)\s+TMJ):\s*([\s\S]*?)(?=(?:Right|Left)\s+TMJ:|$)/gi)];
  if (matches.length === 0) return null;
  return matches.map(m => [m[1].trim(), m[2].trim().replace(/\.\s*$/, '')]);
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

/* ═══════ COMPONENT ═══════ */
const TmjAssessmentDocument = ({ document: docProp }) => {
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
      if (r?.tmj_assessment) return Array.isArray(r.tmj_assessment) ? r.tmj_assessment : [r.tmj_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.tmj_assessment) return Array.isArray(dd.tmj_assessment) ? dd.tmj_assessment : [dd.tmj_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  const safeIdOf = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     Draft store shape: { [recordId]: { [fieldPart]: value } } where fieldPart = "field" or "field.arrayIndex". */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = safeIdOf(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const lastDot = fieldPart.lastIndexOf('.');
        const isArrayElem = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        if (isArrayElem) {
          const baseField = fieldPart.slice(0, lastDot);
          const arrIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
          const localKey = `${baseField}-${idx}`;
          const base = Array.isArray(nLocal[localKey])
            ? nLocal[localKey]
            : [...(Array.isArray(record[baseField]) ? record[baseField] : [])];
          base[arrIndex] = value;
          nLocal[localKey] = base;
          nPending[localKey] = true;
          nFields[`${baseField}.${arrIndex}-${idx}`] = 'edited';
        } else {
          const localKey = `${fieldPart}-${idx}`;
          nLocal[localKey] = value;
          nPending[localKey] = true;
          nFields[localKey] = 'edited';
          nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records, safeIdOf]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?:(?<!\b[A-Z])(?<!\d)\.\s+|;\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
      const rt = `TMJ Assessment ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && (Array.isArray(val) ? val.some(item => String(item).toLowerCase().includes(phrase)) : fmtVal(val).toLowerCase().includes(phrase))) return true;
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
          merged[m[1]] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    const localKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [localKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [localKey]: true }));
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // Save = stage a DRAFT locally + localStorage (no DB write). Approve commits.
  function stageDraft(id, fn, idx, fullText) {
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
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
    setSaveError(null);
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageDraft(id, fn, idx, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    stageDraft(id, fn, idx, fullText);
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

  function saveTextPart(record, fn, idx, sid, partIndex, trackingKey) {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    const parts = splitEditableClauses(String(getFieldValue(record, fn, idx) || ''), fn);
    if (!editValue.trim()) parts.splice(partIndex, 1);
    else parts[partIndex] = { ...parts[partIndex], text: editValue.trim() };
    const fullText = reconstructClauses(parts);
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedSentences(prev => ({ ...prev, [trackingKey]: 'edited' }));
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const next = { ...prev }; delete next[`${sid}-${idx}`]; return next; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }

  function saveCommaPart(record, fn, idx, sid, partIndex, commaIndex, trackingKey) {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    const parts = splitEditableClauses(String(getFieldValue(record, fn, idx) || ''), fn);
    const parsed = parseLabel(parts[partIndex]?.text || '');
    if (!parsed.isLabeled) return;
    const commaItems = splitByComma(parsed.value);
    if (!editValue.trim()) commaItems.splice(commaIndex, 1);
    else commaItems[commaIndex] = editValue.trim();
    parts[partIndex] = { ...parts[partIndex], text: `${parsed.label}: ${commaItems.join(', ')}` };
    const fullText = reconstructClauses(parts);
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedSentences(prev => ({ ...prev, [trackingKey]: 'edited' }));
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const next = { ...prev }; delete next[`${sid}-${idx}`]; return next; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
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

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true); setSaveError(null);
    try {
      // Pull this record's staged drafts; commit only fieldParts that belong to this section.
      const store = readDrafts();
      const recDrafts = store[id] || {};
      const committedLocalKeys = new Set();
      for (const [fieldPart, value] of Object.entries(recDrafts)) {
        const lastDot = fieldPart.lastIndexOf('.');
        const isArrayElem = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        const baseField = isArrayElem ? fieldPart.slice(0, lastDot) : fieldPart;
        if (!fields.includes(baseField)) continue;
        const payload = { field: baseField, value };
        if (isArrayElem) payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        const resp = await secureApiClient.put(`/api/edit/tmj_assessment/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        committedLocalKeys.add(`${baseField}-${idx}`);
        delete recDrafts[fieldPart];
      }
      await secureApiClient.put(`/api/edit/tmj_assessment/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; committedLocalKeys.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      if (Object.keys(recDrafts).length === 0) delete store[id]; else store[id] = recDrafts;
      writeDrafts(store);

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); setSaveError('Approve failed. Please try again.'); }
    finally { setSaving(false); }
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
    const header = `${title}\n${'='.repeat(40)}\n\n`;
    let text = header;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val) || isSentinelZero(f, val)) return;
      const labelLine = sameAsTitle(label, sid) ? '' : `${label}\n`;
      if (BOOLEAN_FIELDS.includes(f)) {
        text += `${labelLine}1. ${val ? 'Yes' : 'No'}\n\n`;
      } else if (NUMBER_FIELDS.includes(f)) {
        const measure = ROM_MEASURES.find(m => m.key === f);
        if (measure) {
          text += `${labelLine}1. ${val} ${measure.unit}\n\n`;
        } else if (f === 'jawPainIntensity' || f === 'jawFunctionalLimitationScale') {
          text += `${labelLine}1. ${val}/10\n\n`;
        } else if (f === 'overjetMeasurement') {
          text += `${labelLine}1. ${val} mm\n\n`;
        } else if (f === 'overbiteMeasurement') {
          text += `${labelLine}1. ${val}%\n\n`;
        } else {
          text += `${labelLine}1. ${val}\n\n`;
        }
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val : [val];
        let number = 1;
        text += labelLine;
        items.forEach(item => {
          const parsed = parseLabel(String(item));
          if (parsed.isLabeled) text += `${parsed.label}\n${number++}. ${parsed.value}\n`;
          else text += `${number++}. ${item}\n`;
        });
        text += '\n';
      } else if (STRING_FIELDS.includes(f)) {
        let number = 1;
        text += labelLine;
        splitEditableClauses(fmtVal(val), f).forEach(entry => {
          const parsed = parseLabel(entry.text);
          if (parsed.isLabeled) {
            text += `${parsed.label}\n`;
            splitByComma(parsed.value).forEach(item => { text += `${number++}. ${item}\n`; });
          } else text += `${number++}. ${entry.text}\n`;
        });
        text += '\n';
      } else {
        text += `${labelLine}1. ${fmtVal(val)}\n\n`;
      }
    });
    return text === header ? '' : text;
  }, [getFieldValue, hasVal, fmtVal]);

  const copyAllText = useCallback(async () => {
    let text = '=== TMJ ASSESSMENT ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `TMJ Assessment ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: NUMBER FIELD ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || isSentinelZero(fn, val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const measure = ROM_MEASURES.find(m => m.key === fn);
    const isPain = fn === 'jawPainIntensity' || fn === 'jawFunctionalLimitationScale';
    let displayVal = String(val);
    let fixedUnit = '';
    if (measure) displayVal = `${val} ${measure.unit}`;
    if (measure) fixedUnit = ` ${measure.unit}`;
    else if (isPain) { displayVal = `${val}/10`; fixedUnit = '/10'; }
    else if (fn === 'overjetMeasurement') { displayVal = `${val} mm`; fixedUnit = ' mm'; }
    else if (fn === 'overbiteMeasurement') { displayVal = `${val}%`; fixedUnit = '%'; }
    const color = measure ? getRomColor(val, measure.normalMin) : isPain ? getPainColor(val) : null;
    const interpretation = measure ? getRomInterpretation(val, measure.normalMin) : isPain ? getPainInterpretation(val) : '';
    const percentage = measure ? romToPercentage(val, measure.max) : isPain ? painToPercentage(val) : null;
    const hasChart = Boolean(measure || isPain);

    return (
      <div key={fn} className={`rec-mini-card nested-mini-card ${hasChart ? 'rom-bar-row' : ''}`} data-edit-field={fn}>
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="number-edit-row">
                <div className="num-stepper-row">
                  <button type="button" className="num-step" onClick={e => { e.stopPropagation(); setEditValue(String(Number((Number(editValue || 0) - stepFor(editValue)).toFixed(10)))); }}>&minus;</button>
                  <input type="text" inputMode="decimal" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} onClick={e => e.stopPropagation()} />
                  <button type="button" className="num-step" onClick={e => { e.stopPropagation(); setEditValue(String(Number((Number(editValue || 0) + stepFor(editValue)).toFixed(10)))); }}>+</button>
                </div>
                {fixedUnit && <span className="number-edit-unit">{fixedUnit}</span>}
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = Number(editValue); if (isNaN(numVal)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className={`row-content ${hasChart ? 'rom-bar-container' : ''}`}>
                {hasChart && <div className="rom-bar-background"><div className="rom-bar-fill" style={{ width: `${percentage}%`, backgroundColor: color }} /></div>}
                <span className={hasChart ? 'content-value rom-bar-value' : 'content-value'} style={hasChart ? { color } : undefined}>{highlightText(displayVal)}</span>
                {hasChart && <span className="rom-bar-interpretation" style={{ color }}>{interpretation}</span>}
                <span className="edit-indicator">&#9998;</span>
              </div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}${interpretation ? ` (${interpretation})` : ''}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: BOOLEAN FIELD ═══════ */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = val ? 'Yes' : 'No';
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(val ? 'Yes' : 'No'); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue} options={['Yes', 'No']} onChange={setEditValue} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const boolVal = editValue === 'Yes'; handleSaveField(record, fn, idx, sid, null, boolVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: ARRAY FIELD ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card nested-mini-card">
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, itemIdx) => {
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemStr = String(item);
          const parsed = parseLabel(itemStr);
          const displayVal = parsed.isLabeled ? parsed.value : itemStr;

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
          }

          const row = (
            <div data-edit-field={fn}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    {hasEditableNumber(displayVal)
                      ? <NumberTextEditor value={editValue} onChange={setEditValue} />
                      : <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />}
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setSaveError(null); const savedItem = parsed.isLabeled ? `${parsed.label}: ${editValue}` : editValue; const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = savedItem; setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: currentArr })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][`${fn}.${itemIdx}`] = savedItem; writeDrafts(store); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(parsed.isLabeled ? `${parsed.label}\n${parsed.value}` : itemStr, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
          if (parsed.isLabeled) {
            return (
              <div key={itemIdx} className="rec-mini-card nested-mini-card" style={{ marginTop: 8 }}>
                <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                {row}
              </div>
            );
          }
          return <React.Fragment key={itemIdx}>{row}</React.Fragment>;
        })}
      </div>
    );
  };

  /* ═══════ RENDER: STRING FIELD with declared clause splitting ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const entries = splitEditableClauses(strVal, fn);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    if (entries.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn} className="rec-mini-card nested-mini-card">
          {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
          {entries.map((entry, partIndex) => {
              const partKey = `${fn}-${idx}-s${partIndex}`;
              const isEditing = editingField === partKey;
              const badge = editedSentences[partKey];
              const partMatches = phraseMatch || labelMatch || (searchTerm.trim() && entry.text.toLowerCase().includes(searchTerm.toLowerCase().trim()));
              if (!partMatches && searchTerm.trim()) return null;
              const parsed = parseLabel(entry.text);
              if (parsed.isLabeled) {
                const commaItems = splitByComma(parsed.value);
                const parsedLabelMatch = searchTerm.trim() && parsed.label.toLowerCase().includes(searchTerm.toLowerCase().trim());
                if (commaItems.length >= 2) {
                  return (
                    <div key={partIndex} className="rec-mini-card nested-mini-card" style={{ marginTop: 8 }}>
                      <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                      {commaItems.map((commaItem, commaIndex) => {
                        const commaKey = `${partKey}-c${commaIndex}`;
                        const ciEditing = editingField === commaKey;
                        const ciBadge = editedSentences[commaKey];
                        const ciMatches = phraseMatch || labelMatch || parsedLabelMatch || !searchTerm.trim() || commaItem.toLowerCase().includes(searchTerm.toLowerCase().trim());
                        if (!ciMatches && searchTerm.trim()) return null;
                        return (
                          <div key={commaIndex} data-edit-field={fn}>
                            <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(commaItem); setSaveError(null); } }}>
                              {ciEditing ? (
                                <div className="edit-field-container">
                                  {hasEditableNumber(commaItem)
                                    ? <NumberTextEditor value={editValue} onChange={setEditValue} />
                                    : <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />}
                                  {saveError && <div className="save-error">{saveError}</div>}
                                  <div className="edit-actions">
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaPart(record, fn, idx, sid, partIndex, commaIndex, commaKey); }}>{saving ? 'Saving...' : 'Save'}</button>
                                    <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="row-content"><span className="content-value">{highlightText(commaItem)}</span><span className="edit-indicator">&#9998;</span></div>
                                  <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(commaItem, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
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

              const displayValue = parsed.isLabeled ? parsed.value : entry.text;
              return (
                <div key={partIndex} className={parsed.isLabeled ? 'rec-mini-card nested-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined} data-edit-field={fn}>
                  {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(partKey); setEditValue(displayValue); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        {hasEditableNumber(displayValue)
                          ? <NumberTextEditor value={editValue} onChange={setEditValue} />
                          : <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />}
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const parts = splitEditableClauses(String(getFieldValue(record, fn, idx) || ''), fn); parts[partIndex] = { ...parts[partIndex], text: `${parsed.label}: ${editValue.trim()}` }; const id = safeId(record); if (!id) return; const fullText = reconstructClauses(parts); const editKey = `${fn}-${idx}`; setLocalEdits(prev => ({ ...prev, [editKey]: fullText })); setPendingEdits(prev => ({ ...prev, [editKey]: true })); setEditedSentences(prev => ({ ...prev, [partKey]: 'edited' })); const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = fullText; writeDrafts(store); setEditingField(null); setEditValue(''); setSaveError(null); } else saveTextPart(record, fn, idx, sid, partIndex, partKey); }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(displayValue)}</span><span className="edit-indicator">&#9998;</span></div>
                        <button className={`copy-btn ${copiedItems[partKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(parsed.isLabeled ? `${parsed.label}\n${parsed.value}` : entry.text, partKey); }}>{copiedItems[partKey] ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                </div>
              );
            })}
        </div>
      );
    }

    const parsed = parseLabel(entries[0]?.text || strVal);
    const displayValue = parsed.isLabeled ? parsed.value : strVal;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];

    return (
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        {parsed.isLabeled && <div className="nested-subtitle sub-label">{highlightText(parsed.label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayValue); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {hasEditableNumber(displayValue)
                ? <NumberTextEditor value={editValue} onChange={setEditValue} />
                : <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, null, parsed.isLabeled ? `${parsed.label}: ${editValue}` : editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayValue)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(parsed.isLabeled ? `${parsed.label}\n${parsed.value}` : `${label}\n${strVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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

    const hasAnyVal = fields.some(f => {
      const val = getFieldValue(record, f, idx);
      return hasVal(val);
    });
    if (!hasAnyVal) return null;

    /* Special handling for ROM section with bar chart legend */
    if (sid === 'rom') {
      const romFields = ROM_MEASURES.filter(m => { const v = getFieldValue(record, m.key, idx); return hasVal(v) && !isSentinelZero(m.key, v); });
      const hasDeviation = hasVal(getFieldValue(record, 'deviationOnOpening', idx));
      if (romFields.length === 0 && !hasDeviation) return null;

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
            {/* Legend */}
            <div className="rom-chart-legend">
              <div className="legend-item"><span className="legend-color" style={{ backgroundColor: '#22c55e' }} /><span>Normal</span></div>
              <div className="legend-item"><span className="legend-color" style={{ backgroundColor: '#fbbf24' }} /><span>Mildly Restricted</span></div>
              <div className="legend-item"><span className="legend-color" style={{ backgroundColor: '#ef4444' }} /><span>Restricted</span></div>
            </div>
            {/* ROM Bars */}
            {ROM_MEASURES.map(m => renderNumberField(record, m.key, idx, sid))}
            {/* Deviation on Opening */}
            {hasDeviation && renderStringField(record, 'deviationOnOpening', idx, sid)}
          </div>
        </div>
      );
    }

    /* Special handling for Pain section with bar charts */
    if (sid === 'pain-functional') {
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
            {/* Pain/JFLS bars */}
            {hasVal(getFieldValue(record, 'jawPainIntensity', idx)) && renderNumberField(record, 'jawPainIntensity', idx, sid)}
            {hasVal(getFieldValue(record, 'jawFunctionalLimitationScale', idx)) && renderNumberField(record, 'jawFunctionalLimitationScale', idx, sid)}
            {/* GCPS string */}
            {hasVal(getFieldValue(record, 'gcps_chronicPainGrade', idx)) && renderStringField(record, 'gcps_chronicPainGrade', idx, sid)}
            {/* Bruxism boolean */}
            {hasVal(getFieldValue(record, 'bruxismPresence', idx)) && renderBooleanField(record, 'bruxismPresence', idx, sid)}
          </div>
        </div>
      );
    }

    /* Generic section rendering */
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
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
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
      <div className="tmj-assessment-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">TMJ Assessment</h2></div>
        <div className="empty-state">No TMJ assessment data available</div>
      </div>
    );
  }

  return (
    <div className="tmj-assessment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">TMJ Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<TmjAssessmentDocumentPDFTemplate document={pdfData} />} fileName="TMJ_Assessment.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search TMJ assessments..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      {saveError && <div className="save-error">{saveError}</div>}
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`TMJ Assessment ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'rom')}
            {renderSection(record, idx, 'pain-functional')}
            {renderSection(record, idx, 'joint-sounds')}
            {renderSection(record, idx, 'muscle-palpation')}
            {renderSection(record, idx, 'capsular-joint')}
            {renderSection(record, idx, 'disc-assessment')}
            {renderSection(record, idx, 'dc-tmd-diagnosis')}
            {renderSection(record, idx, 'occlusion')}
            {renderSection(record, idx, 'condylar-morphology')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TmjAssessmentDocument;
