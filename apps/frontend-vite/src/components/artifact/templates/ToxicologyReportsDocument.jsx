/**
 * ToxicologyReportsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: toxicology_reports
 *
 * 10 Sections:
 *   1. specimen-info: specimenType, collectionDateTime
 *   2. chain-of-custody: chainOfCustody
 *   3. substances-detected: substancesDetected
 *   4. concentration-levels: concentrationLevels
 *   5. analysis-details: therapeuticRange, analyticalMethod, poisoningClassification, clinicalSeverity, postmortemFindings
 *   6. detection-parameters: limitOfDetection, limitOfQuantification
 *   7. pharmacokinetics: metabolites, drugInteractions, halfLife, timeToDetection, antidoteRecommended, interferingSubstances
 *   8. additional-markers: carboxyhemoglobinLevel, cholinesteraseActivity, ethylGlucuronide
 *   9. forensic-implications: forensicImplications
 *  10. quality-control: qualityControlResults
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ToxicologyReportsDocumentPDFTemplate from '../pdf-templates/ToxicologyReportsDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './ToxicologyReportsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field"; value may be string or array) */
const DRAFT_KEY = 'toxicology_reportsPendingEdits';
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
  'patient-info': 'Patient Information',
  'specimen-info': 'Specimen Information',
  'chain-of-custody': 'Chain of Custody',
  'substances-detected': 'Substances Detected',
  'concentration-levels': 'Concentration Levels',
  'analysis-details': 'Analysis Details',
  'detection-parameters': 'Detection Parameters',
  'pharmacokinetics': 'Pharmacokinetics',
  'additional-markers': 'Additional Markers',
  'forensic-implications': 'Forensic Implications',
  'quality-control': 'Quality Control',
};

const FIELD_LABELS = {
  patientAge: 'Patient Age',
  specimenType: 'Specimen Type',
  collectionDateTime: 'Collection Date',
  chainOfCustody: 'Chain of Custody',
  substancesDetected: 'Substances Detected',
  concentrationLevels: 'Concentration Levels',
  therapeuticRange: 'Therapeutic Range',
  analyticalMethod: 'Analytical Method',
  poisoningClassification: 'Poisoning Classification',
  clinicalSeverity: 'Clinical Severity',
  postmortemFindings: 'Postmortem Findings',
  limitOfDetection: 'Limit of Detection',
  limitOfQuantification: 'Limit of Quantification',
  metabolites: 'Metabolites',
  drugInteractions: 'Drug Interactions',
  halfLife: 'Half Life',
  timeToDetection: 'Time to Detection',
  antidoteRecommended: 'Antidote Recommended',
  interferingSubstances: 'Interfering Substances',
  carboxyhemoglobinLevel: 'Carboxyhemoglobin Level',
  cholinesteraseActivity: 'Cholinesterase Activity',
  ethylGlucuronide: 'Ethyl Glucuronide',
  forensicImplications: 'Forensic Implications',
  qualityControlResults: 'Quality Control',
};

const SECTION_FIELDS = {
  'patient-info': ['patientAge'],
  'specimen-info': ['specimenType', 'collectionDateTime'],
  'chain-of-custody': ['chainOfCustody'],
  'substances-detected': ['substancesDetected'],
  'concentration-levels': ['concentrationLevels'],
  'analysis-details': ['therapeuticRange', 'analyticalMethod', 'poisoningClassification', 'clinicalSeverity', 'postmortemFindings'],
  'detection-parameters': ['limitOfDetection', 'limitOfQuantification'],
  'pharmacokinetics': ['metabolites', 'drugInteractions', 'halfLife', 'timeToDetection', 'antidoteRecommended', 'interferingSubstances'],
  'additional-markers': ['carboxyhemoglobinLevel', 'cholinesteraseActivity', 'ethylGlucuronide'],
  'forensic-implications': ['forensicImplications'],
  'quality-control': ['qualityControlResults'],
};

const BOOLEAN_FIELDS = ['postmortemFindings'];
const DATE_FIELDS = ['collectionDateTime'];
const NUMBER_FIELDS = ['patientAge', 'limitOfDetection', 'limitOfQuantification', 'halfLife', 'timeToDetection', 'carboxyhemoglobinLevel', 'cholinesteraseActivity', 'ethylGlucuronide'];
const ARRAY_FIELDS = ['substancesDetected', 'concentrationLevels', 'metabolites', 'drugInteractions', 'interferingSubstances'];
const STRING_FIELDS = ['specimenType', 'chainOfCustody', 'therapeuticRange', 'analyticalMethod', 'poisoningClassification', 'clinicalSeverity', 'antidoteRecommended', 'forensicImplications', 'qualityControlResults'];
const SELECT_OPTIONS = {
  specimenType: ['Blood', 'Urine', 'Saliva', 'Hair', 'Tissue', 'Other'],
  therapeuticRange: ['Therapeutic', 'Subtherapeutic', 'Toxic', 'Negative', 'Not Applicable'],
  poisoningClassification: ['Accidental', 'Intentional', 'Environmental', 'Occupational', 'Unknown', 'Not Applicable'],
  clinicalSeverity: ['None', 'Mild', 'Moderate', 'Severe', 'Life-Threatening', 'Fatal', 'Not Applicable'],
};
const PERIOD_SPLIT_FIELDS = new Set(['chainOfCustody', 'antidoteRecommended', 'forensicImplications', 'qualityControlResults']);
const COMMA_SPLIT_FIELDS = new Set(['analyticalMethod', 'antidoteRecommended', 'qualityControlResults']);

const sameAsTitle = (label, sid) => (label || '').trim().toLowerCase() === (SECTION_TITLES[sid] || '').trim().toLowerCase();
const stepFor = value => {
  const match = String(value).trim().match(/\.(\d+)/);
  return match ? Math.pow(10, -match[1].length) : 1;
};
const editableNumberTokens = value => {
  const source = String(value ?? '');
  const tokens = [];
  const matcher = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
  let cursor = 0;
  let match;
  let editableIndex = 0;
  while ((match = matcher.exec(source))) {
    if (match.index > cursor) tokens.push({ text: source.slice(cursor, match.index), editable: false });
    const start = match.index;
    const end = start + match[0].length;
    const previousCharacter = source[start - 1] || '';
    const nextCharacter = source[end] || '';
    const editable = previousCharacter !== '#' && previousCharacter !== '/' && !/[A-Za-z0-9]/.test(previousCharacter) && !/[A-Za-z]/.test(nextCharacter);
    tokens.push({ text: match[0], editable, editableIndex: editable ? editableIndex++ : null });
    cursor = end;
  }
  if (cursor < source.length) tokens.push({ text: source.slice(cursor), editable: false });
  return tokens;
};
const replaceEditableNumber = (value, targetIndex, replacement) => editableNumberTokens(value)
  .map(token => token.editable && token.editableIndex === targetIndex ? String(replacement) : token.text).join('');
const isInterpretationLadenNumber = value => /(?:^|\s)</.test(String(value ?? '')) || /\((?:low|high|elevated|decreased|positive|negative|normal|suppressed)\)/i.test(String(value ?? ''));
const hasEditableNumber = value => !isInterpretationLadenNumber(value) && editableNumberTokens(value).some(token => token.editable);
const NumberTextEditor = ({ value, onChange }) => (
  <div className="multi-number-edit-row">
    {editableNumberTokens(value).map((token, tokenIndex) => {
      if (!token.editable) return <span className="number-edit-unit fixed-number-text" key={`${tokenIndex}-${token.text}`}>{token.text}</span>;
      const change = direction => {
        const numeric = Number(token.text.replace(/,/g, ''));
        const next = Number((numeric + direction * stepFor(token.text)).toFixed(10));
        const formatted = token.text.includes(',') ? next.toLocaleString('en-US', { maximumFractionDigits: 10 }) : String(next);
        onChange(replaceEditableNumber(value, token.editableIndex, formatted));
      };
      return <div className="multi-number-control" key={`${tokenIndex}-${token.editableIndex}`}>
        <button type="button" className="num-step" onClick={event => { event.stopPropagation(); change(-1); }}>&minus;</button>
        <input type="text" inputMode="decimal" className="edit-number" value={token.text} onChange={event => onChange(replaceEditableNumber(value, token.editableIndex, event.target.value))} onClick={event => event.stopPropagation()} />
        <button type="button" className="num-step" onClick={event => { event.stopPropagation(); change(1); }}>+</button>
      </div>;
    })}
  </div>
);

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
    else if (ch === ',' && depth === 0) {
      const before = current.trim(); const after = text.slice(i + 1).trimStart();
      if (/\d$/.test(before) && /^\d{3}\b/.test(after)) current += ch;
      else { if (before) result.push(before); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

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
    const safeSemicolon = character === ';' && PERIOD_SPLIT_FIELDS.has(fieldPath) && depth === 0;
    if (safePeriod || safeSemicolon) {
      let delimiter = character;
      while (/\s/.test(source[index + 1] || '')) { delimiter += source[index + 1]; index += 1; }
      push(delimiter);
    } else current += character;
  }
  push('');
  return parts.length ? parts : [{ text: source, delimiter: '' }];
};
const reconstructClauses = parts => parts.map(part => `${part.text}${part.delimiter}`).join('');

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* ═══════ COMPONENT ═══════ */
const ToxicologyReportsDocument = ({ document: docProp }) => {
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

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.toxicology_reports) return Array.isArray(r.toxicology_reports) ? r.toxicology_reports : [r.toxicology_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.toxicology_reports) return Array.isArray(dd.toxicology_reports) ? dd.toxicology_reports : [dd.toxicology_reports]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const recId = idOf(record);
      const recDrafts = recId ? store[recId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = 'edited';
        nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\d)\.\s+|;\s+/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
      const rt = `Toxicology Report ${idx + 1}`.toLowerCase();
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
    const editKey = `${fn}-${idx}`;
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // Re-edit after approval → drop this section's approved flag so the button returns to yellow Pending Approve
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // Stage a DRAFT for a full-text field value (no DB write). localStorage keeps it across refresh; Approve commits.
  const stageDraft = (record, fn, idx, sid, fullText) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
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
      stageDraft(record, fn, idx, sid, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setSaveError(null);
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

  // Approve = COMMIT all staged drafts for this section's fields to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true); setSaveError(null);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      // Pending editKeys for THIS record's fields in THIS section. localEdits keys are always "<field>-<idx>".
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        const m = k.match(/^(.+)-(\d+)$/);
        if (!m || parseInt(m[2], 10) !== idx) return false;
        const fieldPart = m[1];
        // arrayIndex ONLY when the segment after the LAST dot is purely numeric
        const lastDot = fieldPart.lastIndexOf('.');
        const baseField = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1))) ? fieldPart.slice(0, lastDot) : fieldPart;
        return fields.includes(baseField);
      });
      for (const editKey of toCommit) {
        const m = editKey.match(/^(.+)-(\d+)$/);
        const fieldPart = m[1];
        const lastDot = fieldPart.lastIndexOf('.');
        const isArrIdx = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        const payload = { field: isArrIdx ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArrIdx) payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        const resp = await secureApiClient.put(`/api/edit/toxicology_reports/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/toxicology_reports/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts (committed). Remove only this section's fields from the draft store.
      const store = readDrafts();
      if (store[id]) { fields.forEach(f => { delete store[id][f]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[ToxicologyReports] Approve error:', err); setSaveError('Save failed. Please try again.'); }
    finally { setSaving(false); }
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
  const formatSentenceFieldLines = useCallback((text, fieldPath) => {
    const sentences = splitEditableClauses(text, fieldPath);
    const lines = []; let n = 1;
    sentences.forEach(clause => {
      const parsed = parseLabel(clause.text);
      if (parsed.isLabeled) {
        lines.push(parsed.label + ':');
        const parts = COMMA_SPLIT_FIELDS.has(fieldPath) ? splitByComma(parsed.value) : [parsed.value];
        parts.forEach(item => { lines.push(`${n++}. ${item}`); });
      } else {
        const parts = COMMA_SPLIT_FIELDS.has(fieldPath) ? splitByComma(clause.text) : [clause.text];
        parts.forEach(item => { lines.push(`${n++}. ${item}`); });
      }
    });
    return lines;
  }, []);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    const header = `${title}\n${'='.repeat(40)}\n\n`;
    let text = header;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        text += `${label}\n1. ${formatDate(val)}\n\n`;
      } else if (BOOLEAN_FIELDS.includes(f)) {
        text += `${label}\n1. ${val ? 'Yes' : 'No'}\n\n`;
      } else if (NUMBER_FIELDS.includes(f)) {
        text += `${label}\n1. ${val}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val : [val];
        if (!sameAsTitle(label, sid)) text += `${label}\n`;
        let rowNumber = 1;
        items.forEach(item => {
          const parsed = parseLabel(String(item));
          if (parsed.isLabeled) text += `${parsed.label}\n`;
          text += `${rowNumber++}. ${parsed.isLabeled ? parsed.value : item}\n`;
        });
        text += '\n';
      } else if (STRING_FIELDS.includes(f)) {
        const strVal = fmtVal(val);
        if (!sameAsTitle(label, sid)) text += `${label}\n`;
        formatSentenceFieldLines(strVal, f).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else {
        text += `${label}\n${fmtVal(val)}\n\n`;
      }
    });
    return text === header ? '' : text;
  }, [getFieldValue, hasVal, fmtVal, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = `Toxicology Reports\n${'='.repeat(40)}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Toxicology Report ${idx + 1}\n${'='.repeat(40)}\n\n`;
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
      <div key={fn} className="rec-mini-card nested-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div data-edit-field={fn}>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onChange={setEditValue} />
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
      </div>
    );
  };

  /* ═══════ RENDER: BOOLEAN FIELD — select Yes/No, convert to boolean on save ═══════ */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = val ? 'Yes' : 'No';
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card nested-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div data-edit-field={fn}>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(val ? 'Yes' : 'No'); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue} onChange={setEditValue} options={['Yes', 'No']} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const boolVal = editValue === 'Yes'; handleSaveField(record, fn, idx, sid, null, boolVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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
      </div>
    );
  };

  /* ═══════ RENDER: NUMBER FIELD ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const numVal = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(numVal) || numVal === 0) return null; // hide-zero / hide-invalid
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = String(numVal);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card nested-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div data-edit-field={fn}>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); setEditValue(String(Number((Number(editValue) - stepFor(editValue)).toFixed(10)))); }}>&minus;</button>
                <input type="text" inputMode="decimal" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus />
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); setEditValue(String(Number((Number(editValue) + stepFor(editValue)).toFixed(10)))); }}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const parsedNum = parseFloat(editValue); if (isNaN(parsedNum)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, parsedNum); }}>{saving ? 'Saving...' : 'Save'}</button>
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
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY FIELD (per-item editing with dot-path keys) ═══════ */
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
          const displayValue = parsed.isLabeled ? parsed.value : itemStr;
          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections && !`${label} ${itemStr}`.toLowerCase().includes(searchTerm.toLowerCase().trim())) return null;
          const saveArrayItem = () => {
            const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])];
            currentArr[itemIdx] = parsed.isLabeled ? `${parsed.label}: ${editValue}` : editValue;
            stageDraft(record, fn, idx, sid, currentArr);
            setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
            setEditingField(null); setEditValue('');
          };
          return (
            <div key={itemIdx} className={parsed.isLabeled ? 'nested-mini-card' : ''}>
              {parsed.isLabeled && <div className="nested-subtitle sub-label">{highlightText(parsed.label)}</div>}
              <div data-edit-field={fn}>
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayValue); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      {hasEditableNumber(displayValue) ? <NumberTextEditor value={editValue} onChange={setEditValue} /> : <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus />}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveArrayItem(); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : <><div className="row-content"><span className="content-value">{highlightText(displayValue)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${parsed.isLabeled ? `${parsed.label}\n` : ''}${displayValue}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>}
                </div>
                {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence: render with splitBySentence */
    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
      const sectionTitle = SECTION_TITLES[sid] || '';
      const showLabel = label !== sectionTitle;

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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setSaveError(null); stageDraft(record, fn, idx, sid, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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

              /* Unlabeled sentence with comma items - split into rows */
              if (!parsed.isLabeled) {
                const unlabeledCommaItems = splitByComma(sentence.replace(/[;.]+$/, '').trim());
                if (unlabeledCommaItems.length >= 2) {
                  return (
                    <div key={sIdx}>
                      {unlabeledCommaItems.map((ci, ciIdx) => {
                        const commaKey = `${sentenceKey}-c${ciIdx}`;
                        const ciEditing = editingField === commaKey;
                        const ciBadge = editedSentences[commaKey];
                        const ciMatches = phraseMatch || labelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
                        if (!ciMatches && searchTerm.trim()) return null;
                        return (
                          <div key={ciIdx}>
                            <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                              {ciEditing ? (
                                <div className="edit-field-container">
                                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                  {saveError && <div className="save-error">{saveError}</div>}
                                  <div className="edit-actions">
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const rawSentence = sentences2[sIdx] || ''; const items2 = splitByComma(rawSentence.replace(/[;.]+$/, '').trim()); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = items2.join(', ') + '.'; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setSaveError(null); stageDraft(record, fn, idx, sid, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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

              /* Regular sentence row (single item, no comma split needed) */
              return (
                <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                  {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setSaveError(null); stageDraft(record, fn, idx, sid, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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
    const isModified = editedFields[editKey] || editedSentences[`${fn}-${idx}-s0`];
    const sectionTitleSingle = SECTION_TITLES[sid] || '';
    const showLabelSingle = label.toLowerCase() !== sectionTitleSingle.toLowerCase();

    return (
      <div key={fn} className="rec-mini-card">
        {showLabelSingle && <div className="nested-subtitle">{highlightText(label)}</div>}
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

  /* Canonical string renderer: inventoried delimiters, semantic grouping, and numeric-token steppers. */
  const renderCanonicalStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const clauses = splitEditableClauses(strVal, fn);
    return (
      <div key={fn} className="rec-mini-card nested-mini-card">
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        {clauses.map((clause, clauseIndex) => {
          const parsed = parseLabel(clause.text);
          const rawValue = parsed.isLabeled ? parsed.value : clause.text;
          const items = COMMA_SPLIT_FIELDS.has(fn) ? splitByComma(rawValue) : [rawValue];
          return (
            <div key={clauseIndex} className={parsed.isLabeled ? 'nested-mini-card' : ''}>
              {parsed.isLabeled && <div className="nested-subtitle sub-label">{highlightText(parsed.label)}</div>}
              {items.map((item, itemIndex) => {
                const editKey = `${fn}-${idx}-s${clauseIndex}-c${itemIndex}`;
                const isEditing = editingField === editKey;
                const badge = editedSentences[editKey];
                const saveItem = () => {
                  const currentClauses = splitEditableClauses(String(getFieldValue(record, fn, idx) || ''), fn);
                  const currentParsed = parseLabel(currentClauses[clauseIndex]?.text || '');
                  const currentValue = currentParsed.isLabeled ? currentParsed.value : currentClauses[clauseIndex]?.text || '';
                  const currentItems = COMMA_SPLIT_FIELDS.has(fn) ? splitByComma(currentValue) : [currentValue];
                  currentItems[itemIndex] = editValue.trim();
                  currentClauses[clauseIndex].text = currentParsed.isLabeled ? `${currentParsed.label}: ${currentItems.join(', ')}` : currentItems.join(', ');
                  stageDraft(record, fn, idx, sid, reconstructClauses(currentClauses));
                  setEditedSentences(prev => ({ ...prev, [editKey]: 'edited' }));
                  setEditingField(null); setEditValue('');
                };
                return (
                  <div key={itemIndex} data-edit-field={fn}>
                    <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(item); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          {SELECT_OPTIONS[fn] && items.length === 1
                            ? <BlueSelect value={editValue} onChange={setEditValue} options={SELECT_OPTIONS[fn]} />
                            : hasEditableNumber(item)
                              ? <NumberTextEditor value={editValue} onChange={setEditValue} />
                              : <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus />}
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveItem(); }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : <><div className="row-content"><span className="content-value">{highlightText(item)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${parsed.isLabeled ? `${parsed.label}\n` : ''}${item}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>}
                    </div>
                    {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                  </div>
                );
              })}
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
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            return renderCanonicalStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="toxicology-reports-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Toxicology Reports</h2></div>
        <div className="empty-state">No toxicology report records available</div>
      </div>
    );
  }

  return (
    <div className="toxicology-reports-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Toxicology Reports</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ToxicologyReportsDocumentPDFTemplate document={pdfData} />} fileName="Toxicology_Reports.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search toxicology reports..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Toxicology Report ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'patient-info')}
            {renderSection(record, idx, 'specimen-info')}
            {renderSection(record, idx, 'chain-of-custody')}
            {renderSection(record, idx, 'substances-detected')}
            {renderSection(record, idx, 'concentration-levels')}
            {renderSection(record, idx, 'analysis-details')}
            {renderSection(record, idx, 'detection-parameters')}
            {renderSection(record, idx, 'pharmacokinetics')}
            {renderSection(record, idx, 'additional-markers')}
            {renderSection(record, idx, 'forensic-implications')}
            {renderSection(record, idx, 'quality-control')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ToxicologyReportsDocument;
