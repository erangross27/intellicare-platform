/**
 * ChronicPainAssessmentDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: chronic_pain_assessment
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ChronicPainAssessmentPDFTemplate from '../pdf-templates/ChronicPainAssessmentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueDatePicker from '../components/BlueDatePicker';
import './ChronicPainAssessmentDocument.css';

const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
// decimal-aware −/+ stepper step: 3.5→'0.1', ints→'1'
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldName]: value } }  (value = scalar OR full array for array fields) */
const DRAFT_KEY = 'chronicPainAssessmentPendingEdits';
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
  location: 'Pain Location & Onset',
  quality: 'Pain Quality',
  scores: 'Pain Scores',
  exacerbating: 'Exacerbating Factors',
  alleviating: 'Alleviating Factors',
  radiation: 'Radiating Pain',
  functional: 'Functional Impact',
  clinical: 'Clinical Scores',
  medications: 'Pain Medications',
  interventions: 'Prior Interventions',
  psychological: 'Psychological Comorbidities',
  redflags: 'Red Flag Symptoms',
  goals: 'Treatment Goals',
};

const FIELD_LABELS = {
  painLocation: 'Pain Location',
  painOnsetDate: 'Pain Onset Date',
  painDurationMonths: 'Pain Duration (months)',
  painIntensityScore: 'Pain Intensity Score',
  averagePainScore: 'Average Pain Score',
  worstPainScore: 'Worst Pain Score',
  painPattern: 'Pain Pattern',
  painQuality: 'Pain Quality',
  exacerbatingFactors: 'Exacerbating Factors',
  alleviatingFactors: 'Alleviating Factors',
  functionalImpairmentScore: 'Functional Impairment Score',
  activitiesOfDailyLivingImpact: 'ADL Impact',
  sleepDisturbance: 'Sleep Disturbance',
  currentPainMedications: 'Current Pain Medications',
  opioidTherapyActive: 'Opioid Therapy Active',
  morphineEquivalentDose: 'Morphine Equivalent Dose (mg/day)',
  painCatastrophizingScale: 'Pain Catastrophizing Scale',
  oswestryDisabilityIndex: 'Oswestry Disability Index',
  neuropathicPainPresent: 'Neuropathic Pain Present',
  radiatingPain: 'Radiating Pain',
  radiationPattern: 'Radiation Pattern',
  priorInterventions: 'Prior Interventions',
  psychologicalComorbidities: 'Psychological Comorbidities',
  redFlagSymptoms: 'Red Flag Symptoms',
  treatmentGoals: 'Treatment Goals',
};

const SECTION_FIELDS = {
  location: ['painLocation', 'painOnsetDate', 'painDurationMonths'],
  quality: ['painQuality'],
  scores: ['painIntensityScore', 'averagePainScore', 'worstPainScore', 'painPattern'],
  exacerbating: ['exacerbatingFactors'],
  alleviating: ['alleviatingFactors'],
  radiation: ['radiatingPain', 'neuropathicPainPresent', 'radiationPattern'],
  functional: ['functionalImpairmentScore', 'activitiesOfDailyLivingImpact', 'sleepDisturbance'],
  clinical: ['painCatastrophizingScale', 'oswestryDisabilityIndex'],
  medications: ['currentPainMedications', 'opioidTherapyActive', 'morphineEquivalentDose'],
  interventions: ['priorInterventions'],
  psychological: ['psychologicalComorbidities'],
  redflags: ['redFlagSymptoms'],
  goals: ['treatmentGoals'],
};

const ARRAY_FIELDS = ['painLocation', 'painQuality', 'exacerbatingFactors', 'alleviatingFactors', 'currentPainMedications', 'priorInterventions', 'psychologicalComorbidities', 'redFlagSymptoms', 'treatmentGoals'];
const SENTENCE_FIELDS = ['painPattern', 'activitiesOfDailyLivingImpact', 'radiationPattern'];
const NUMBER_FIELDS = ['painDurationMonths', 'painIntensityScore', 'averagePainScore', 'worstPainScore', 'functionalImpairmentScore', 'morphineEquivalentDose', 'painCatastrophizingScale', 'oswestryDisabilityIndex'];
const BOOLEAN_FIELDS = ['sleepDisturbance', 'opioidTherapyActive', 'neuropathicPainPresent', 'radiatingPain'];
const DATE_FIELDS = ['painOnsetDate'];

const ChronicPainAssessmentDocument = ({ document: docProp }) => {
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
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const containerRef = useRef(null);

  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.chronic_pain_assessment) return Array.isArray(r.chronic_pain_assessment) ? r.chronic_pain_assessment : [r.chronic_pain_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.chronic_pain_assessment) return Array.isArray(dd.chronic_pain_assessment) ? dd.chronic_pain_assessment : [dd.chronic_pain_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const recId = (r) => {
      if (!r?._id) return null;
      if (typeof r._id === 'string') return r._id;
      if (r._id.$oid) return r._id.$oid;
      return String(r._id);
    };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = recId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldName, value]) => {
        const editKey = `${fieldName}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        if (SENTENCE_FIELDS.includes(fieldName)) {
          nSentences[`${fieldName}-${idx}-s0`] = 'edited';
        } else {
          nFields[editKey] = 'edited';
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  const hasVal = useCallback((v) => {
    if (v === null || v === undefined || v === '') return false;
    if (typeof v === 'boolean') return true;
    if (typeof v === 'number') return true;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
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

  const safeId = useCallback((record) => {
    if (!record?._id) return null;
    if (typeof record._id === 'string') return record._id;
    if (record._id.$oid) return record._id.$oid;
    return String(record._id);
  }, []);

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
    if (Array.isArray(val)) {
      return val.some(item => String(item).toLowerCase().includes(phrase));
    }
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
    return records.filter((record) => {
      const allTitles = Object.values(SECTION_TITLES);
      for (const t of allTitles) {
        if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) {
          record._showAllSections = true;
          return true;
        }
      }
      const allLabels = Object.values(FIELD_LABELS);
      for (const l of allLabels) {
        if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true;
      }
      for (const f of Object.keys(FIELD_LABELS)) {
        const val = record[f];
        if (Array.isArray(val)) {
          if (val.some(item => String(item).toLowerCase().includes(phrase))) return true;
        } else if (val !== null && val !== undefined) {
          if (fmtVal(val).toLowerCase().includes(phrase)) return true;
        }
      }
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
    const isArray = ARRAY_FIELDS.includes(fieldName);
    const editKey = editingField;
    const valueToSave = overrideValue !== undefined ? overrideValue : editValue;
    const localKey = `${fieldName}-${idx}`;
    let draftValue;
    if (isArray) {
      const arrMatch = editKey?.match(/-ai(\d+)$/);
      const arrayIndex = arrMatch ? parseInt(arrMatch[1]) : null;
      if (arrayIndex === null) { setEditingField(null); setEditValue(''); return; }
      const arr = [...(getEffectiveArray(record, fieldName, idx))];
      arr[arrayIndex] = valueToSave;
      draftValue = arr;
      setLocalEdits(prev => ({ ...prev, [localKey]: arr }));
      setEditedFields(prev => ({ ...prev, [`${fieldName}-${idx}-ai${arrayIndex}`]: 'edited' }));
    } else {
      draftValue = valueToSave;
      setLocalEdits(prev => ({ ...prev, [localKey]: valueToSave }));
      setEditedFields(prev => ({ ...prev, [localKey]: 'edited' }));
    }
    setPendingEdits(prev => ({ ...prev, [localKey]: true }));
    // Re-edit after approval → drop the section's 'approved' flag so the button returns to yellow Pending Approve
    setApprovedSections(prev => {
      const approveKey = `${sectionId}-${idx}`;
      if (!prev[approveKey]) return prev;
      const next = { ...prev };
      delete next[approveKey];
      return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldName] = draftValue;
    writeDrafts(store);
    setEditingField(null);
    setEditValue('');
  }, [editingField, editValue, safeId, getEffectiveArray]);

  // Save one sentence = stage a DRAFT locally + localStorage (survives refresh). NO DB write here;
  // handleApproveSection commits the full reconstructed text.
  function saveSentence(record, fieldName, idx, sectionId, sentenceIdx) {
    const id = safeId(record);
    if (!id) return;
    const currentVal = String(getFieldValue(record, fieldName, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    const localKey = `${fieldName}-${idx}`;

    const stageDraft = (fullText) => {
      setLocalEdits(prev => ({ ...prev, [localKey]: fullText }));
      setPendingEdits(prev => ({ ...prev, [localKey]: true }));
      setApprovedSections(prev => {
        const approveKey = `${sectionId}-${idx}`;
        if (!prev[approveKey]) return prev;
        const next = { ...prev };
        delete next[approveKey];
        return next;
      });
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][fieldName] = fullText;
      writeDrafts(store);
      setEditingField(null);
      setEditValue('');
    };

    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences];
      updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setEditedFields(prev => ({ ...prev, [localKey]: 'edited' }));
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

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sectionId, idx) => {
    const approveKey = `${sectionId}-${idx}`;
    const id = safeId(record);
    if (!id) return;
    setSaving(true);
    try {
      const fields = SECTION_FIELDS[sectionId] || [];
      // Collect this section's staged edits (localKey === `${field}-${idx}`, value = scalar OR full array)
      const toCommit = fields
        .map(f => `${f}-${idx}`)
        .filter(localKey => pendingEdits[localKey] && localEdits[localKey] !== undefined);
      for (const localKey of toCommit) {
        const fieldName = localKey.slice(0, -`-${idx}`.length);
        await secureApiClient.put(`/api/edit/chronic_pain_assessment/${id}/edit`, { field: fieldName, value: localEdits[localKey] });
      }
      await secureApiClient.put(`/api/edit/chronic_pain_assessment/${id}/approve`, { sectionId, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's committed drafts for the section's fields from localStorage
      const store = readDrafts();
      if (store[id]) {
        fields.forEach(f => { delete store[id][f]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

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
    } catch (err) { console.error('[ChronicPainAssessment] Approve error:', err); }
    finally { setSaving(false); }
  }, [safeId, localEdits, pendingEdits]);

  const renderApproveButton = useCallback((record, sectionId, idx) => {
    const approveKey = `${sectionId}-${idx}`;
    const isApproved = approvedSections[approveKey] || record.approvedSections?.[sectionId];
    const hasEdits = sectionHasEdits(idx, sectionId);
    if (hasEdits) {
      return (<button className="approve-btn pending" disabled={saving} onClick={(e) => { e.stopPropagation(); handleApproveSection(record, sectionId, idx); }}>{saving ? 'Approving...' : 'Pending Approve'}</button>);
    }
    if (isApproved) {
      return <span className="approve-btn approved">Approved</span>;
    }
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

  // One field → copy lines. Sub-label + DASH unless it equals the section title (single-name rule);
  // arrays number each item; narrative fields sentence-split and number; scalars get "1.".
  const emitField = useCallback((record, f, idx, title) => {
    const label = FIELD_LABELS[f] || f;
    const val = getFieldValue(record, f, idx);
    if (!hasVal(val)) return '';
    let out = '';
    if ((label || '').toLowerCase() !== (title || '').toLowerCase()) out += `${label}\n${COPY_LINE_DASH}\n`;
    if (Array.isArray(val)) { val.forEach((item, i) => { out += `${i + 1}. ${item}\n`; }); }
    else if (SENTENCE_FIELDS.includes(f)) { splitBySentence(String(val)).forEach((s, i) => { out += `${i + 1}. ${s}\n`; }); }
    else { out += `1. ${DATE_FIELDS.includes(f) ? formatDate(val) : fmtVal(val)}\n`; }
    return out + '\n';
  }, [getFieldValue, hasVal, fmtVal, formatDate, splitBySentence]);

  const buildSectionCopyText = useCallback((record, idx, sectionId) => {
    const title = SECTION_TITLES[sectionId] || sectionId;
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    (SECTION_FIELDS[sectionId] || []).forEach(f => { text += emitField(record, f, idx, title); });
    return text;
  }, [emitField]);

  const copyAllText = useCallback(async () => {
    let text = `CHRONIC PAIN ASSESSMENT\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((record, idx) => {
      text += `Chronic Pain Assessment ${idx + 1}\n${COPY_LINE_EQ}\n`;
      if (record.date) text += `${formatDate(record.date)}\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const fields = SECTION_FIELDS[sid];
        if (!fields.some(f => hasVal(record[f]))) return;
        const title = SECTION_TITLES[sid];
        text += `\n${title}\n${COPY_LINE_EQ}\n`;
        fields.forEach(f => { text += emitField(record, f, idx, title); });
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, hasVal, formatDate, emitField]);

  // ========== RENDER HELPERS ==========
  const renderEditableField = (record, fieldName, idx, sectionId, title) => {
    const val = getFieldValue(record, fieldName, idx);
    if (!hasVal(val)) return null;
    const editKey = `${fieldName}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fieldName] || fieldName;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const isNumber = NUMBER_FIELDS.includes(fieldName);
    const isBoolean = BOOLEAN_FIELDS.includes(fieldName);
    const isDate = DATE_FIELDS.includes(fieldName);
    const displayVal = isDate ? formatDate(val) : fmtVal(val);
    const isModified = editedFields[editKey];
    const itemId = `${fieldName}-${idx}`;

    const startEdit = () => {
      if (isEditing) return;
      setEditingField(editKey);
      if (isBoolean) setEditValue(val === true ? 'Yes' : 'No');
      else if (isDate) { try { setEditValue(new Date(val.$date || val).toISOString().split('T')[0]); } catch { setEditValue(''); } }
      else setEditValue(isNumber ? String(val) : fmtVal(val));
    };

    const saveTyped = (e) => {
      e.stopPropagation();
      if (isNumber) {
        const num = parseFloat(editValue);
        if (isNaN(num)) return;
        handleSaveField(record, fieldName, idx, sectionId, num);
      } else if (isBoolean) {
        handleSaveField(record, fieldName, idx, sectionId, editValue === 'Yes');
      } else if (isDate) {
        if (!editValue) return;
        handleSaveField(record, fieldName, idx, sectionId, new Date(editValue + 'T00:00:00').toISOString());
      } else {
        handleSaveField(record, fieldName, idx, sectionId);
      }
    };

    if (!searchTerm.trim() || fieldMatches(record, fieldName, idx) || sectionTitleMatches(sectionId)) {
      return (
        <div key={fieldName}>
          {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={startEdit}>
            {isEditing ? (
              <div className="edit-field-container">
                {isBoolean ? (
                  <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                ) : isDate ? (
                  <BlueDatePicker value={editValue} onSelect={(iso) => setEditValue(iso)} />
                ) : isNumber ? (
                  (() => { const st = parseFloat(stepFor(val)) || 1; const dec = (String(st).split('.')[1] || '').length; const bump = (d) => { const cur = parseFloat(editValue); setEditValue((Math.max(0, (isNaN(cur) ? 0 : cur) + d)).toFixed(dec)); }; return (
                  <div className="num-stepper-row">
                    <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); bump(-st); }}>−</button>
                    <input type="number" step={stepFor(val)} min="0" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } else if (e.key === 'Enter') { e.preventDefault(); saveTyped(e); } }} />
                    <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); bump(st); }}>+</button>
                  </div>); })()
                ) : (
                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />
                )}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={saveTyped}>{saving ? 'Saving...' : 'Save'}</button>
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
    }
    return null;
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
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sectionId, title);
            return renderEditableField(record, f, idx, sectionId, title);
          })}
        </div>
      </div>
    );
  };

  // ========== EMPTY STATE ==========
  if (!records || records.length === 0) {
    return (
      <div className="chronic-pain-assessment-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Chronic Pain Assessment</h2></div>
        <div className="empty-state">No chronic pain assessment records available</div>
      </div>
    );
  }

  return (
    <div className="chronic-pain-assessment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Chronic Pain Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ChronicPainAssessmentPDFTemplate document={pdfData} />} fileName={`chronic-pain-assessment-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>

      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search chronic pain assessment records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>

      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">
                {record.date && <span className="record-date">{formatDate(record.date)}</span>}
              </div>
              <h3 className="record-name">{highlightText(`Chronic Pain Assessment ${idx + 1}`)}</h3>
            </div>
            {renderMixedSection(record, idx, 'location')}
            {renderMixedSection(record, idx, 'quality')}
            {renderMixedSection(record, idx, 'scores')}
            {renderMixedSection(record, idx, 'exacerbating')}
            {renderMixedSection(record, idx, 'alleviating')}
            {renderMixedSection(record, idx, 'radiation')}
            {renderMixedSection(record, idx, 'functional')}
            {renderMixedSection(record, idx, 'clinical')}
            {renderMixedSection(record, idx, 'medications')}
            {renderMixedSection(record, idx, 'interventions')}
            {renderMixedSection(record, idx, 'psychological')}
            {renderMixedSection(record, idx, 'redflags')}
            {renderMixedSection(record, idx, 'goals')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChronicPainAssessmentDocument;
