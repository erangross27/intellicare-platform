/**
 * SurrogacyEvaluationDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: surrogacy_evaluation
 *
 * Covers the gestational-carrier profile, uterine assessment, laboratory and
 * infectious-disease review, psychological screening, and obstetric history.
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BlueSelect from '../components/BlueSelect';
import SurrogacyEvaluationDocumentPDFTemplate from '../pdf-templates/SurrogacyEvaluationDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './SurrogacyEvaluationDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = field name; localEdits keys are "field-idx") */
const DRAFT_KEY = 'surrogacyEvaluationPendingEdits';
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
  carrier: 'Carrier Profile',
  uterine: 'Uterine Assessment',
  serology: 'Blood & Infectious Disease',
  thrombophilia: 'Thrombophilia & Labs',
  psych: 'Psychological & Screening',
  obstetric: 'Obstetric History',
};

const FIELD_LABELS = {
  gestationalCarrierAge: 'Gestational Carrier Age',
  gravidityParityHistory: 'Gravidity and Parity History',
  previousUncomplictedLiveBirths: 'Previous Uncomplicated Live Births',
  bodyMassIndexKgM2: 'Body Mass Index (kg/m²)',
  cesareanSectionCount: 'Cesarean Section Count',
  uterineAnatomyAssessment: 'Uterine Anatomy Assessment',
  endometrialThicknessMm: 'Endometrial Thickness (mm)',
  cervicalCompetenceHistory: 'Cervical Competence History',
  bloodTypeAndRhFactor: 'Blood Type and Rh Factor',
  irregularAntibodyScreen: 'Irregular Antibody Screen',
  infectiousDiseasePanel: 'Infectious Disease Panel',
  cytomegalovirusSerostatus: 'Cytomegalovirus Serostatus',
  rubellaTiterImmunity: 'Rubella Titer Immunity',
  varicellaTiterImmunity: 'Varicella Titer Immunity',
  thrombophiliaScreening: 'Thrombophilia Screening',
  antiphospholipidAntibodyPanel: 'Antiphospholipid Antibody Panel',
  thyroidStimulatingHormoneMuL: 'TSH (mIU/L)',
  hemoglobinA1cPercent: 'Hemoglobin A1c (%)',
  psychologicalClearanceStatus: 'Psychological Clearance Status',
  minnesotaMultiphasicPersonalityInventoryResults: 'MMPI Results',
  nicotineCotinineScreenResult: 'Nicotine/Cotinine Screen Result',
  urineDrugScreenPanel: 'Urine Drug Screen Panel',
  preexistingHypertensionHistory: 'Pre-existing Hypertension History',
  gestationalDiabetesHistory: 'Gestational Diabetes History',
  preeclampsiaEclampsiaHistory: 'Preeclampsia/Eclampsia History',
};

const SECTION_FIELDS = {
  carrier: ['gestationalCarrierAge', 'gravidityParityHistory', 'previousUncomplictedLiveBirths', 'bodyMassIndexKgM2', 'cesareanSectionCount'],
  uterine: ['uterineAnatomyAssessment', 'endometrialThicknessMm', 'cervicalCompetenceHistory'],
  serology: ['bloodTypeAndRhFactor', 'irregularAntibodyScreen', 'infectiousDiseasePanel', 'cytomegalovirusSerostatus', 'rubellaTiterImmunity', 'varicellaTiterImmunity'],
  thrombophilia: ['thrombophiliaScreening', 'antiphospholipidAntibodyPanel', 'thyroidStimulatingHormoneMuL', 'hemoglobinA1cPercent'],
  psych: ['psychologicalClearanceStatus', 'minnesotaMultiphasicPersonalityInventoryResults', 'nicotineCotinineScreenResult', 'urineDrugScreenPanel'],
  obstetric: ['preexistingHypertensionHistory', 'gestationalDiabetesHistory', 'preeclampsiaEclampsiaHistory'],
};

const ARRAY_FIELDS = new Set();
const NUMBER_FIELDS = new Set(['gestationalCarrierAge', 'previousUncomplictedLiveBirths', 'bodyMassIndexKgM2', 'cesareanSectionCount', 'endometrialThicknessMm', 'thyroidStimulatingHormoneMuL', 'hemoglobinA1cPercent']);
const BOOLEAN_FIELDS = new Set(['cervicalCompetenceHistory', 'rubellaTiterImmunity', 'varicellaTiterImmunity', 'preexistingHypertensionHistory', 'gestationalDiabetesHistory']);
const ENUM_FIELDS = Object.fromEntries([...BOOLEAN_FIELDS].map(field => [field, ['Yes', 'No']]));
const COMMA_ARRAY_FIELDS = new Set(['uterineAnatomyAssessment', 'bloodTypeAndRhFactor', 'infectiousDiseasePanel', 'cytomegalovirusSerostatus', 'thrombophiliaScreening']);
const KEEP_LABEL_COMMA_FIELDS = new Set();
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
const sameAsTitle = (label, title) => String(label || '').trim().toLowerCase() === String(title || '').trim().toLowerCase();

const humanizeKey = (key) => String(key || '')
  .replace(/_/g, ' ')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/^./, character => character.toUpperCase());

const getPathValue = (record, path) => String(path).split('.').reduce((value, part) => value?.[part], record);
const scalarValue = (value) => {
  if (value && typeof value === 'object') {
    const numericKey = ['$numberInt', '$numberLong', '$numberDouble', '$numberDecimal'].find(key => value[key] !== undefined);
    if (numericKey) return Number(value[numericKey]);
  }
  return value;
};
const setPathValue = (record, path, value) => {
  const parts = String(path).split('.');
  let cursor = record;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) cursor[part] = value;
    else {
      const nextIsIndex = /^\d+$/.test(parts[index + 1]);
      if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = nextIsIndex ? [] : {};
      cursor = cursor[part];
    }
  });
};
const flattenLeafPaths = (value, prefix) => {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = `${prefix}.${key}`;
    if (child !== null && typeof child === 'object') return flattenLeafPaths(child, path);
    return child === '' || child === null || child === undefined ? [] : [path];
  });
};
const sectionFields = (record, sid) => {
  if (sid === 'results') return flattenLeafPaths(record?.results, 'results');
  if (sid === 'recommendations') return Array.isArray(record?.recommendations)
    ? record.recommendations.flatMap((recommendation, index) => [
      recommendation?.recommendation ? `recommendations.${index}.recommendation` : null,
      recommendation?.date ? `recommendations.${index}.date` : null,
    ].filter(Boolean))
    : [];
  return (SECTION_FIELDS[sid] || []).flatMap(field => {
    if (!ARRAY_FIELDS.has(field)) return [field];
    const values = record?.[field];
    return Array.isArray(values) ? values.map((_, index) => `${field}.${index}`) : [];
  });
};
const fieldLabel = (path) => {
  if (FIELD_LABELS[path]) return FIELD_LABELS[path];
  const parts = String(path).split('.');
  if (ARRAY_FIELDS.has(parts[0])) return FIELD_LABELS[parts[0]];
  if (parts[0] === 'recommendations') {
    const itemNumber = Number(parts[1]) + 1;
    return parts[2] === 'date' ? `Recommendation ${itemNumber} Date` : `Recommendation ${itemNumber}`;
  }
  return humanizeKey(parts[parts.length - 1]);
};
const isDateField = () => false;

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* Parenthesis-aware comma split with credential, conjunction, and numeric guards. */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const before = current.trim();
      const after = text.slice(i + 1);
      const afterTrimmed = after.trimStart();
      const numericThousands = /\d$/.test(before) && /^\d{3}\b/.test(afterTrimmed);
      const noFollowingSpace = after.length === afterTrimmed.length;
      if (numericThousands || noFollowingSpace) current += ch;
      else { if (before) result.push(before); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const raw = dateValue?.$date?.$numberLong ?? dateValue?.$date ?? dateValue; const d = new Date(typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : raw); if (isNaN(d.getTime()) || d.getFullYear() < 1971) return ''; return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const raw = dateValue?.$date?.$numberLong ?? dateValue?.$date ?? dateValue; const d = new Date(typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : raw); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* Text-backed clinical measurements stay readable while each meaningful number gets its own
   stepper. Ratio denominators, ordinal suffixes, staging-code digits, and # identifiers are fixed. */
const editableNumberTokens = (value) => {
  const source = String(value ?? '');
  const tokens = [];
  const matcher = /-?\d+(?:\.\d+)?/g;
  let cursor = 0;
  let match;
  let editableIndex = 0;
  while ((match = matcher.exec(source))) {
    if (match.index > cursor) tokens.push({ text: source.slice(cursor, match.index), numeric: false });
    const start = match.index;
    const end = start + match[0].length;
    const previousCharacter = source[start - 1] || '';
    const previousNonSpace = source.slice(0, start).match(/\S(?=\s*$)/)?.[0] || '';
    const nextCharacter = source[end] || '';
    const editable = previousNonSpace !== '/'
      && previousCharacter !== '#'
      && !/[A-Za-z0-9]/.test(previousCharacter)
      && !/[A-Za-z]/.test(nextCharacter);
    tokens.push({
      text: match[0],
      numeric: true,
      editable,
      editableIndex: editable ? editableIndex++ : null,
    });
    cursor = end;
  }
  if (cursor < source.length) tokens.push({ text: source.slice(cursor), numeric: false });
  return tokens;
};
const hasEditableNumber = (value) => editableNumberTokens(value).some(token => token.numeric && token.editable);
const replaceEditableNumber = (value, targetIndex, replacement) => editableNumberTokens(value)
  .map(token => token.numeric && token.editable && token.editableIndex === targetIndex ? String(replacement) : token.text)
  .join('');
const numberStep = (value) => String(value).includes('.') ? 0.1 : 1;

const NumberTextEditor = ({ value, onChange }) => (
  <div className="multi-number-edit-row">
    {editableNumberTokens(value).map((token, tokenIndex) => {
      if (!token.numeric || !token.editable) {
        return <span className="number-edit-unit fixed-number-text" key={`${tokenIndex}-${token.text}`}>{token.text}</span>;
      }
      const change = (direction) => {
        const next = Number((Number(token.text || 0) + direction * numberStep(token.text)).toFixed(10));
        onChange(replaceEditableNumber(value, token.editableIndex, next));
      };
      return (
        <div className="multi-number-control" key={`${tokenIndex}-${token.editableIndex}`}>
          <button type="button" className="num-step" onClick={event => { event.stopPropagation(); change(-1); }}>−</button>
          <input
            className="edit-number"
            inputMode="decimal"
            value={token.text}
            onChange={event => onChange(replaceEditableNumber(value, token.editableIndex, event.target.value))}
          />
          <button type="button" className="num-step" onClick={event => { event.stopPropagation(); change(1); }}>+</button>
        </div>
      );
    })}
  </div>
);

/* ═══════ COMPONENT ═══════ */
const SurrogacyEvaluationDocument = ({ document: docProp }) => {
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
      if (r?.surrogacy_evaluation) return Array.isArray(r.surrogacy_evaluation) ? r.surrogacy_evaluation : [r.surrogacy_evaluation];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.surrogacy_evaluation) return Array.isArray(dd.surrogacy_evaluation) ? dd.surrogacy_evaluation : [dd.surrogacy_evaluation]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* ═══════ REHYDRATE PENDING DRAFTS ═══════
     Read the localStorage draft store so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = record && record._id
        ? (typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id)))
        : null;
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((input) => { const v = scalarValue(input); if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean' || typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((input) => { const v = scalarValue(input); if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    const delimiterWithWhitespace = /[.;]\s/;
    const result = [];
    let current = '';
    let parenthesisDepth = 0;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === '(') parenthesisDepth += 1;
      else if (ch === ')') parenthesisDepth = Math.max(0, parenthesisDepth - 1);
      const isDelimiter = delimiterWithWhitespace.test(`${ch}${text[i + 1] || ''}`) && parenthesisDepth === 0;
      const isProtectedTitle = ch === '.' && /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)$/.test(current);
      if (isDelimiter && !isProtectedTitle) {
        const trimmed = current.trim();
        if (trimmed) result.push(trimmed);
        current = '';
        while (/\s/.test(text[i + 1] || '')) i += 1;
      } else current += ch;
    }
    const tail = current.replace(/[.;]+$/, '').trim();
    if (tail) result.push(tail);
    return result;
  }, []);

  const buildStringGroups = useCallback((text, fieldName = '') => {
    const groups = [];
    splitBySentence(text).forEach((sentence, sentenceIndex) => {
      const parsed = parseLabel(sentence);
      const splitCommas = (parsed.isLabeled && !KEEP_LABEL_COMMA_FIELDS.has(fieldName.split('.')[0])) || COMMA_ARRAY_FIELDS.has(fieldName);
      const source = parsed.isLabeled ? parsed.value : sentence;
      const rows = (splitCommas ? splitByComma(source) : [source]).map((row, commaIndex) => ({
        text: row.replace(/[;.]+$/, '').trim(),
        sentenceIndex,
        commaIndex: splitCommas ? commaIndex : null,
        label: parsed.isLabeled ? parsed.label : '',
      })).filter(row => row.text);
      if (!rows.length) return;
      if (!parsed.isLabeled && groups.length && !groups[groups.length - 1].label) groups[groups.length - 1].rows.push(...rows);
      else groups.push({ label: parsed.isLabeled ? parsed.label : '', rows });
    });
    return groups;
  }, [splitBySentence]);

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
    return getPathValue(record, fn);
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
  const shouldShowSection = useCallback((record, idx, sid) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    const fields = sectionFields(record, sid);
    for (const f of fields) {
      const label = fieldLabel(f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, idx);
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
    const label = fieldLabel(fn).toLowerCase();
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
      const rt = `Surrogacy Evaluation ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const sid of Object.keys(SECTION_TITLES)) {
        for (const f of sectionFields(record, sid)) {
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
      const merged = JSON.parse(JSON.stringify(record));
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          setPathValue(merged, m[1], localEdits[key]);
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
    const editKey = `${fn}-${idx}`;
    const trackKey = editTrackingKey || editKey;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // Re-edit after approval → drop this section's approved flag so the button returns to yellow Pending
    if (sid) setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // saveSentence = stage a DRAFT locally (no DB write). localStorage keeps it across refresh; Approve commits it.
  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    const editKey = `${fn}-${idx}`;
    const stageDraft = (fullText) => {
      setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
      setPendingEdits(prev => ({ ...prev, [editKey]: true }));
      if (sid) setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][fn] = fullText;
      writeDrafts(store);
    };
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setSaveError(null);
      stageDraft(fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setSaveError(null);
    stageDraft(fullText);
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
  const sectionHasEdits = useCallback((record, idx, sid) => {
    const fields = sectionFields(record, sid);
    return fields.some(f =>
      Object.keys(pendingEdits).some(k => k === `${f}-${idx}`) ||
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [pendingEdits, editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = sectionFields(record, sid);
    setSaving(true);
    try {
      // Persist each staged dotted/indexed leaf in this section to the DB now.
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        const m = k.match(/^(.+)-(\d+)$/);
        if (!m || parseInt(m[2], 10) !== idx) return false;
        return fields.includes(m[1]);
      });
      for (const editKey of toCommit) {
        const m = editKey.match(/^(.+)-(\d+)$/);
        const fieldPart = m[1];
        const payload = { field: fieldPart, value: localEdits[editKey] };
        const resp = await secureApiClient.put(`/api/edit/surrogacy_evaluation/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/surrogacy_evaluation/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) {
        fields.forEach(f => { if (store[id]) delete store[id][f]; });
        if (store[id] && Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) {
      console.error(err);
      setSaveError(err?.message || 'Approval failed');
    } finally {
      setSaving(false);
    }
  }, [safeId, localEdits, pendingEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(record, idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" disabled={saving} onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>{saving ? 'Approving...' : 'Pending Approve'}</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection, saving]);

  /* ═══════ COPY ═══════ */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* ═══════ FORMAT HELPERS FOR COPY ═══════ */
  const formatSentenceFieldLines = useCallback((text, fieldName) => {
    const lines = [];
    let unlabeledNumber = 1;
    buildStringGroups(text, fieldName).forEach(group => {
      if (group.label) {
        lines.push(group.label, COPY_LINE_DASH);
        group.rows.forEach((row, index) => lines.push(`${index + 1}. ${row.text}`));
      } else {
        group.rows.forEach(row => lines.push(`${unlabeledNumber++}. ${row.text}`));
      }
    });
    return lines;
  }, [buildStringGroups]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    const body = [];
    const fields = sectionFields(record, sid);
    fields.forEach(f => {
      const label = fieldLabel(f);
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (!sameAsTitle(label, title)) body.push(label, COPY_LINE_DASH);
      if (isDateField(f)) {
        body.push(`1. ${formatDate(val)}`);
      } else {
        body.push(...formatSentenceFieldLines(fmtVal(val), f));
      }
      body.push('');
    });
    if (!body.length) return '';
    return `${title}\n${COPY_LINE_EQ}\n\n${body.join('\n').trim()}\n\n`;
  }, [getFieldValue, hasVal, fmtVal, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = `Surrogacy Evaluation\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Surrogacy Evaluation ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_TITLES).forEach(sid => {
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
    const label = fieldLabel(fn);
    const displayVal = formatDate(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={setEditValue} />
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

  /* ═══════ RENDER: NUMBER FIELD ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = fieldLabel(fn);
    const rawValue = scalarValue(val);
    const displayVal = BOOLEAN_FIELDS.has(fn) ? (rawValue ? 'Yes' : 'No') : String(rawValue);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <NumberTextEditor value={editValue} onChange={setEditValue} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation(); const numericValue = Number(editValue); if (!Number.isFinite(numericValue)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numericValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: ENUM FIELD ═══════ */
  const renderEnumField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = fieldLabel(fn);
    const rawValue = scalarValue(val);
    const displayVal = BOOLEAN_FIELDS.has(fn) ? (rawValue ? 'Yes' : 'No') : String(rawValue);
    const options = ENUM_FIELDS[fn] || [displayVal];
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue} options={options} onChange={setEditValue} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation(); handleSaveField(record, fn, idx, sid, null, BOOLEAN_FIELDS.has(fn) ? editValue === 'Yes' : editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = fieldLabel(fn);
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Rich strings: multi-sentence values or a single embedded Label: value group. */
    if (sentences.length > 1 || (sentences[0] && parseLabel(sentences[0]).isLabeled) || COMMA_ARRAY_FIELDS.has(fn)) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn}>
          <div className="rec-mini-card nested-mini-card">
            {!sameAsTitle(label, title) && <div className="nested-subtitle">{highlightText(label)}</div>}
            {sentences.map((sentence, sIdx) => {
              const sentenceKey = `${fn}-${idx}-s${sIdx}`;
              const isEditing = editingField === sentenceKey;
              const badge = editedSentences[sentenceKey];
              const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
              if (!sentenceMatches && searchTerm.trim()) return null;

              const parsed = parseLabel(sentence);
              if ((parsed.isLabeled && !KEEP_LABEL_COMMA_FIELDS.has(fn.split('.')[0])) || COMMA_ARRAY_FIELDS.has(fn)) {
                const commaItems = splitByComma(parsed.isLabeled ? parsed.value : sentence);
                const parsedLabelMatch = searchTerm.trim() && parsed.label.toLowerCase().includes(searchTerm.toLowerCase().trim());
                if (commaItems.length >= 2) {
                  return (
                    <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card nested-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                      {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                      {commaItems.map((ci, ciIdx) => {
                        const commaKey = `${sentenceKey}-c${ciIdx}`;
                        const ciEditing = editingField === commaKey;
                        const ciBadge = editedSentences[commaKey];
                        const ciMatches = phraseMatch || labelMatch || parsedLabelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
                        if (!ciMatches && searchTerm.trim()) return null;
                        return (
                          <div key={ciIdx} data-edit-field={fn}>
                            <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                              {ciEditing ? (
                                <div className="edit-field-container">
                                  {hasEditableNumber(editValue)
                                    ? <NumberTextEditor value={editValue} onChange={setEditValue} />
                                    : <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />}
                                  {saveError && <div className="save-error">{saveError}</div>}
                                  <div className="edit-actions">
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); const items2 = splitByComma(p2.isLabeled ? p2.value : s2); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = p2.isLabeled ? `${p2.label}: ${items2.join(', ')}` : items2.join(', '); const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setSaveError(null); const stageKey = `${fn}-${idx}`; setLocalEdits(prev => ({ ...prev, [stageKey]: fullText2 })); setPendingEdits(prev => ({ ...prev, [stageKey]: true })); setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); const store = readDrafts(); if (!store[id2]) store[id2] = {}; store[id2][fn] = fullText2; writeDrafts(store); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                <div key={sIdx} data-edit-field={fn} className={parsed.isLabeled ? 'rec-mini-card nested-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                  {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        {hasEditableNumber(editValue)
                          ? <NumberTextEditor value={editValue} onChange={setEditValue} />
                          : <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />}
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const id3 = safeId(record); if (!id3) return; const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setSaveError(null); const stageKey = `${fn}-${idx}`; setLocalEdits(prev => ({ ...prev, [stageKey]: fullText })); setPendingEdits(prev => ({ ...prev, [stageKey]: true })); setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); const store = readDrafts(); if (!store[id3]) store[id3] = {}; store[id3][fn] = fullText; writeDrafts(store); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
        {!sameAsTitle(label, title) && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(strVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {hasEditableNumber(editValue)
                ? <NumberTextEditor value={editValue} onChange={setEditValue} />
                : <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />}
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

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, idx, sid)) return null;
    const fields = sectionFields(record, sid);

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
            if (isDateField(f)) return renderDateField(record, f, idx, sid);
            if (NUMBER_FIELDS.has(f)) return renderNumberField(record, f, idx, sid);
            if (ENUM_FIELDS[f]) return renderEnumField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="surrogacy-evaluation-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Surrogacy Evaluation</h2></div>
        <div className="empty-state">No surrogacy evaluation records available</div>
      </div>
    );
  }

  return (
    <div className="surrogacy-evaluation-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Surrogacy Evaluation</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<SurrogacyEvaluationDocumentPDFTemplate document={pdfData} />} fileName="Surrogacy_Evaluation.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search surrogacy evaluation..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Surrogacy Evaluation ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'carrier')}
            {renderSection(record, idx, 'uterine')}
            {renderSection(record, idx, 'serology')}
            {renderSection(record, idx, 'thrombophilia')}
            {renderSection(record, idx, 'psych')}
            {renderSection(record, idx, 'obstetric')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SurrogacyEvaluationDocument;
