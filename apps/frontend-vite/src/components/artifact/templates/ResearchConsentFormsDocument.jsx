/**
 * ResearchConsentFormsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: research_consent_forms
 *
 * 6 Sections:
 *   1. study-details: studyTitle, studyProtocolNumber, principalInvestigatorName, irbApprovalNumber, fdaInvestigationalNewDrugNumber, consentVersionDate, studyPhase
 *   2. participation: participantEligibilityCriteria, interventionalProcedures
 *   3. drug-design: investigationalDrugName, placeboControlled, randomizationMethod, studyDurationWeeks
 *   4. safety-monitoring: adverseEventReporting, geneticTestingIncluded, radiationExposure, contraceptiveRequirements
 *   5. compliance: dataMonitoringCommittee, hipaaAuthorizationIncluded, compensationAmount
 *   6. endpoints-rights: primaryEndpoint, withdrawalRights, pregnancyTesting
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import ResearchConsentFormsDocumentPDFTemplate from '../pdf-templates/ResearchConsentFormsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './ResearchConsentFormsDocument.css';

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'study-details': 'Study Details',
  'participation': 'Participation',
  'drug-design': 'Drug & Design',
  'safety-monitoring': 'Safety & Monitoring',
  'compliance': 'Compliance',
  'endpoints-rights': 'Endpoints & Rights',
};

const FIELD_LABELS = {
  studyTitle: 'Study Title',
  studyProtocolNumber: 'Study Protocol Number',
  principalInvestigatorName: 'Principal Investigator',
  irbApprovalNumber: 'IRB Approval Number',
  fdaInvestigationalNewDrugNumber: 'FDA IND Number',
  consentVersionDate: 'Consent Version Date',
  studyPhase: 'Study Phase',
  participantEligibilityCriteria: 'Participant Eligibility Criteria',
  interventionalProcedures: 'Interventional Procedures',
  investigationalDrugName: 'Investigational Drug Name',
  placeboControlled: 'Placebo Controlled',
  randomizationMethod: 'Randomization Method',
  studyDurationWeeks: 'Study Duration (Weeks)',
  adverseEventReporting: 'Adverse Event Reporting',
  geneticTestingIncluded: 'Genetic Testing Included',
  radiationExposure: 'Radiation Exposure',
  contraceptiveRequirements: 'Contraceptive Requirements',
  dataMonitoringCommittee: 'Data Monitoring Committee',
  hipaaAuthorizationIncluded: 'HIPAA Authorization Included',
  compensationAmount: 'Compensation Amount',
  primaryEndpoint: 'Primary Endpoint',
  withdrawalRights: 'Withdrawal Rights',
  pregnancyTesting: 'Pregnancy Testing',
};

const SECTION_FIELDS = {
  'study-details': ['studyTitle', 'studyProtocolNumber', 'principalInvestigatorName', 'irbApprovalNumber', 'fdaInvestigationalNewDrugNumber', 'consentVersionDate', 'studyPhase'],
  'participation': ['participantEligibilityCriteria', 'interventionalProcedures'],
  'drug-design': ['investigationalDrugName', 'placeboControlled', 'randomizationMethod', 'studyDurationWeeks'],
  'safety-monitoring': ['adverseEventReporting', 'geneticTestingIncluded', 'radiationExposure', 'contraceptiveRequirements'],
  'compliance': ['dataMonitoringCommittee', 'hipaaAuthorizationIncluded', 'compensationAmount'],
  'endpoints-rights': ['primaryEndpoint', 'withdrawalRights', 'pregnancyTesting'],
};

const BOOLEAN_FIELDS = ['placeboControlled', 'geneticTestingIncluded', 'dataMonitoringCommittee', 'hipaaAuthorizationIncluded', 'pregnancyTesting'];
const DATE_FIELDS = ['consentVersionDate'];
const NUMBER_FIELDS = ['studyDurationWeeks', 'compensationAmount'];
const ARRAY_FIELDS = ['participantEligibilityCriteria', 'interventionalProcedures'];
const STRING_FIELDS = ['studyTitle', 'studyProtocolNumber', 'principalInvestigatorName', 'irbApprovalNumber', 'fdaInvestigationalNewDrugNumber', 'studyPhase', 'investigationalDrugName', 'randomizationMethod', 'adverseEventReporting', 'radiationExposure', 'contraceptiveRequirements', 'primaryEndpoint', 'withdrawalRights'];
const LABELED_NARRATIVE_FIELDS = ['studyTitle', 'randomizationMethod', 'adverseEventReporting', 'radiationExposure', 'contraceptiveRequirements', 'withdrawalRights'];
const COMMA_SPLIT_STRING_FIELDS = ['randomizationMethod', 'adverseEventReporting'];
const NUMBER_LIMITS = {
  studyDurationWeeks: { min: 0 },
  compensationAmount: { min: 0 },
};
const stepFor = (value) => {
  const decimals = String(value ?? '').split('.')[1];
  return decimals ? Number(`0.${'0'.repeat(Math.max(0, decimals.length - 1))}1`) : 1;
};

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

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'research_consent_formsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ═══════ COMPONENT ═══════ */
const ResearchConsentFormsDocument = ({ document: docProp }) => {
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

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.research_consent_forms) return Array.isArray(r.research_consent_forms) ? r.research_consent_forms : [r.research_consent_forms];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.research_consent_forms) return Array.isArray(dd.research_consent_forms) ? dd.research_consent_forms : [dd.research_consent_forms]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const recId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = recId(record);
      const recDrafts = id ? store[id] : null;
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
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text
      .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;]\s+/)
      .map(value => value.replace(/^[;.,\s]+|[;.,\s]+$/g, '').trim())
      .filter(value => value && !/^[;.,!?]+$/.test(value));
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  const setNestedValue = useCallback(function setNestedValueRecursive(source, path, value) {
    if (!path.length) return value;
    const [head, ...tail] = path;
    const arrayIndex = /^\d+$/.test(String(head));
    const clone = Array.isArray(source) ? [...source] : { ...(source && typeof source === 'object' ? source : {}) };
    const key = arrayIndex ? Number(head) : head;
    clone[key] = setNestedValueRecursive(clone[key], tail, value);
    return clone;
  }, []);

  const getNestedValue = useCallback((source, path) => String(path).split('.').reduce((value, key) => value?.[key], source), []);

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    let value = getNestedValue(record, fn);
    const suffix = `-${idx}`;
    Object.entries(localEdits).forEach(([editKey, editValue]) => {
      if (!editKey.endsWith(suffix)) return;
      const fieldPath = editKey.slice(0, -suffix.length);
      if (!fieldPath.startsWith(`${fn}.`)) return;
      value = setNestedValue(value, fieldPath.slice(fn.length + 1).split('.'), editValue);
    });
    return value;
  }, [localEdits, getNestedValue, setNestedValue]);

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
      const rt = `Research Consent Form ${idx + 1}`.toLowerCase();
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
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fieldPath = m[1];
          if (fieldPath.includes('.')) {
            const [rootField, ...path] = fieldPath.split('.');
            merged[rootField] = setNestedValue(merged[rootField], path, localEdits[key]);
          } else merged[fieldPath] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits, setNestedValue]);

  /* ═══════ EDIT HANDLERS ═══════ */
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
    // Re-edit after approval → drop the approved flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setSaveError(null);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // Save one sentence = stage a DRAFT locally (full reconstructed text). No DB write until Approve.
  const stageFieldDraft = (record, fn, idx, sid, fullText) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
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
      stageFieldDraft(record, fn, idx, sid, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setSaveError(null); setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
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
    setSaveError(null); setEditingField(null); setEditValue('');
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
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(key => {
        if (!pendingEdits[key] || !key.endsWith(suffix)) return false;
        const fieldPath = key.slice(0, -suffix.length);
        return fields.includes(fieldPath) || fields.includes(fieldPath.split('.')[0]);
      });
      for (const editKey of toCommit) {
        const fieldPath = editKey.slice(0, -suffix.length);
        const resp = await secureApiClient.put(`/api/edit/research_consent_forms/${id}/edit`, { field: fieldPath, value: localEdits[editKey] });
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/research_consent_forms/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending for this section's committed fields → committed values now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(key => delete next[key]); return next; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) {
        Object.keys(store[id]).forEach(path => { if (fields.includes(path) || fields.includes(path.split('.')[0])) delete store[id][path]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) {
      console.error('[ResearchConsentForms] Approve error:', err);
      setSaveError('Approve failed. Please try again.');
    } finally { setSaving(false); }
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
  const formatSentenceFieldLines = useCallback((text, fn) => {
    const sentences = splitBySentence(text);
    const lines = []; let n = 1;
    sentences.forEach(s => {
      const parsed = LABELED_NARRATIVE_FIELDS.includes(fn) ? parseLabel(s) : { isLabeled: false, label: '', value: s };
      if (parsed.isLabeled) {
        const parts = COMMA_SPLIT_STRING_FIELDS.includes(fn) ? splitByComma(parsed.value) : [parsed.value];
        lines.push(parsed.label);
        lines.push('-'.repeat(40));
        n = 1;
        parts.forEach(item => { lines.push(`${n++}. ${item}`); });
      } else { lines.push(`${n++}. ${s}`); }
    });
    return lines;
  }, [splitBySentence]);

  const buildSectionCopyText = useCallback((record, idx, sid, includeRecordTitle = true) => {
    const title = SECTION_TITLES[sid];
    const recordTitle = `Research Consent Forms ${idx + 1}`;
    let text = includeRecordTitle ? `${recordTitle}\n${'='.repeat(40)}\n\n` : '';
    text += `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        text += `${label}\n${'-'.repeat(40)}\n1. ${formatDate(val)}\n\n`;
      } else if (BOOLEAN_FIELDS.includes(f)) {
        text += `${label}\n${'-'.repeat(40)}\n1. ${val ? 'Yes' : 'No'}\n\n`;
      } else if (NUMBER_FIELDS.includes(f)) {
        text += `${label}\n${'-'.repeat(40)}\n1. ${val}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val : [val];
        text += `${label}\n${'-'.repeat(40)}\n${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}\n\n`;
      } else if (STRING_FIELDS.includes(f)) {
        const strVal = fmtVal(val);
        text += `${label}\n${'-'.repeat(40)}\n`;
        formatSentenceFieldLines(strVal, f).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else {
        text += `${label}\n${'-'.repeat(40)}\n1. ${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== RESEARCH CONSENT FORMS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Research Consent Forms ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid, false);
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
        <div className="nested-mini-card" data-edit-field={fn}>
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
                <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(displayVal, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className="nested-mini-card" data-edit-field={fn}>
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(val ? 'Yes' : 'No'); setSaveError(null); } }}>
            {isEditing ? (
              <div className="edit-field-container">
                <BlueSelect value={editValue} options={['Yes', 'No']} onChange={setEditValue} />
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, null, editValue === 'Yes'); }}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
                <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(displayVal, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = String(val);
    const isModified = editedFields[editKey];
    const limits = NUMBER_LIMITS[fn] || {};
    const clamp = number => Math.min(limits.max ?? Number.POSITIVE_INFINITY, Math.max(limits.min ?? Number.NEGATIVE_INFINITY, number));
    const saveNumber = () => {
      const parsed = Number.parseFloat(editValue);
      if (!Number.isFinite(parsed) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; }
      handleSaveField(record, fn, idx, sid, null, clamp(parsed));
    };
    const stepValue = direction => {
      const step = stepFor(editValue);
      const decimals = (String(step).split('.')[1] || '').length;
      const current = Number.parseFloat(editValue);
      setEditValue(String(clamp(Number(((Number.isFinite(current) ? current : 0) + direction * step).toFixed(decimals)))));
    };
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className="nested-mini-card" data-edit-field={fn}>
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
            {isEditing ? (
              <div className="edit-field-container">
                <div className="num-stepper-row">
                  <button type="button" className="num-step" disabled={saving} onClick={event => { event.stopPropagation(); stepValue(-1); }}>−</button>
                  <input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onClick={event => event.stopPropagation()} onChange={event => setEditValue(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (event.key === 'Enter') { event.preventDefault(); saveNumber(); } }} />
                  <button type="button" className="num-step" disabled={saving} onClick={event => { event.stopPropagation(); stepValue(1); }}>+</button>
                </div>
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation(); saveNumber(); }}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
                <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(displayVal, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className="nested-mini-card">
          {items.map((item, itemIdx) => {
            const fieldPath = `${fn}.${itemIdx}`;
            const editKey = `${fieldPath}-${idx}`;
            const isEditing = editingField === editKey;
            const isModified = editedFields[editKey];
            const currentItem = getFieldValue(record, fieldPath, idx);
            const itemStr = String(currentItem === undefined ? item : currentItem);

            if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
              const phrase = searchTerm.toLowerCase().trim();
              const labelLower = label.toLowerCase();
              if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
            }

            return (
              <div key={itemIdx} data-edit-field={fieldPath}>
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus onKeyDown={event => { if (event.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation(); handleSaveField(record, fieldPath, idx, sid, null, editValue.trim(), editKey); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(itemStr, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const groups = [];
    sentences.forEach((sentence, sentenceIndex) => {
      const parsed = LABELED_NARRATIVE_FIELDS.includes(fn) ? parseLabel(sentence) : { isLabeled: false, label: '', value: sentence };
      const sourceValue = parsed.isLabeled ? parsed.value : sentence;
      const parts = COMMA_SPLIT_STRING_FIELDS.includes(fn) ? splitByComma(sourceValue) : [sourceValue];
      const rows = parts.map((text, partIndex) => ({ text, sentenceIndex, partIndex: parts.length > 1 ? partIndex : null, parsedLabel: parsed.isLabeled ? parsed.label : '' }));
      if (parsed.isLabeled) groups.push({ label: parsed.label, rows });
      else {
        const previous = groups[groups.length - 1];
        if (previous && !previous.label) previous.rows.push(...rows);
        else groups.push({ label: '', rows });
      }
    });

    const saveClause = (row, rowKey) => {
      if (row.partIndex === null && !row.parsedLabel) { saveSentence(record, fn, idx, sid, row.sentenceIndex); return; }
      const currentSentences = splitBySentence(String(getFieldValue(record, fn, idx) || ''));
      const currentSentence = currentSentences[row.sentenceIndex] || '';
      const parsed = LABELED_NARRATIVE_FIELDS.includes(fn) ? parseLabel(currentSentence) : { isLabeled: false, label: '', value: currentSentence };
      const sourceValue = parsed.isLabeled ? parsed.value : currentSentence;
      const parts = row.partIndex === null ? [sourceValue] : splitByComma(sourceValue);
      const cleanValue = editValue.replace(/[;.]+$/, '').trim();
      if (row.partIndex === null) parts[0] = cleanValue;
      else parts[row.partIndex] = cleanValue;
      currentSentences[row.sentenceIndex] = `${parsed.isLabeled ? `${parsed.label}: ` : ''}${parts.join(', ')}`;
      stageFieldDraft(record, fn, idx, sid, reconstructFullText(currentSentences));
      setEditedSentences(prev => ({ ...prev, [rowKey]: 'edited' }));
      setSaveError(null); setEditingField(null); setEditValue('');
    };

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {groups.map((group, groupIndex) => (
          <div key={`${fn}-group-${groupIndex}`} className={`nested-mini-card ${group.label ? '' : 'regular-row-group'}`}>
            {group.label && <div className="nested-subtitle">{highlightText(group.label)}</div>}
            {group.rows.map((row, rowIndex) => {
              const rowKey = `${fn}-${idx}-s${row.sentenceIndex}${row.partIndex === null ? '' : `-c${row.partIndex}`}`;
              const isEditing = editingField === rowKey;
              const badge = editedSentences[rowKey];
              const phrase = searchTerm.toLowerCase().trim();
              const matches = !phrase || sectionTitleMatches(sid) || record._showAllSections || label.toLowerCase().includes(phrase) || group.label.toLowerCase().includes(phrase) || row.text.toLowerCase().includes(phrase);
              if (!matches) return null;
              return (
                <div key={`${row.sentenceIndex}-${rowIndex}`} data-edit-field={fn}>
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(rowKey); setEditValue(row.text); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus onKeyDown={event => { if (event.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation(); saveClause(row, rowKey); }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(row.text)}</span><span className="edit-indicator">&#9998;</span></div>
                        <button className={`copy-btn ${copiedItems[rowKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(row.text, rowKey); }}>{copiedItems[rowKey] ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>edited - click Pending Approve to save</span>}
                </div>
              );
            })}
          </div>
        ))}
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
            return renderStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="research-consent-forms-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Research Consent Forms</h2></div>
        <div className="empty-state">No research consent forms records available</div>
      </div>
    );
  }

  return (
    <div className="research-consent-forms-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Research Consent Forms</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ResearchConsentFormsDocumentPDFTemplate document={pdfData} />} fileName="Research_Consent_Forms.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search research consent forms..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Research Consent Forms ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'study-details')}
            {renderSection(record, idx, 'participation')}
            {renderSection(record, idx, 'drug-design')}
            {renderSection(record, idx, 'safety-monitoring')}
            {renderSection(record, idx, 'compliance')}
            {renderSection(record, idx, 'endpoints-rights')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResearchConsentFormsDocument;
