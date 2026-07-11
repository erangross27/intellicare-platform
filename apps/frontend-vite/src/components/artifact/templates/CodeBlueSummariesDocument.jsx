/**
 * CodeBlueSummariesDocument.jsx
 * March 2026 - Complete rewrite with inline editing, blue glow theme
 * 5 sections: activation-location, cpr-details, medications, rosc-airway, outcome
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import CodeBlueSummariesDocumentPDFTemplate from '../pdf-templates/CodeBlueSummariesDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueTimePicker from '../components/BlueTimePicker';
import secureApiClient from '../../../services/secureApiClient';
import './CodeBlueSummariesDocument.css';

// Copy dividers (mirror the PDF): '=' under record + section titles, '-' under each field label.
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
// Decimal-aware step for the −/+ number stepper ("1.5" → 0.1, "12" → 1)
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };

const SECTION_FIELDS = {
  'activation-location': ['codeBlueActivationTime', 'locationOfCodeBlue', 'witnessedArrest', 'teamLeaderRole'],
  'cpr-details': ['cprStartTime', 'cprEndTime', 'totalCprDuration', 'initialRhythm', 'numberOfDefibrillations', 'acslsProtocolFollowed'],
  'medications': ['epinephrineAdministered', 'epinephrineDoses', 'amiodaroneAdministered', 'sodiumBicarbonateGiven', 'vasopressorsAdministered'],
  'rosc-airway': ['returnOfSpontaneousCirculation', 'roscTime', 'timeToRosc', 'endTidalCo2', 'intubationPerformed', 'intubationAttempts'],
  'outcome': ['codeBlueOutcome', 'precipitatingFactor', 'utsteincriteriaMet', 'targetedTemperatureManagement'],
};

const FIELD_LABELS = {
  codeBlueActivationTime: 'Activation Time',
  locationOfCodeBlue: 'Location',
  initialRhythm: 'Initial Rhythm',
  cprStartTime: 'CPR Start Time',
  cprEndTime: 'CPR End Time',
  totalCprDuration: 'Total CPR Duration (min)',
  numberOfDefibrillations: 'Defibrillations',
  epinephrineAdministered: 'Epinephrine Administered',
  epinephrineDoses: 'Epinephrine Doses',
  acslsProtocolFollowed: 'ACLS Protocol Followed',
  returnOfSpontaneousCirculation: 'Return of Spontaneous Circulation',
  roscTime: 'ROSC Time',
  timeToRosc: 'Time to ROSC (min)',
  endTidalCo2: 'End-Tidal CO2',
  intubationPerformed: 'Intubation Performed',
  intubationAttempts: 'Intubation Attempts',
  vasopressorsAdministered: 'Vasopressors',
  amiodaroneAdministered: 'Amiodarone Administered',
  sodiumBicarbonateGiven: 'Sodium Bicarbonate Given',
  codeBlueOutcome: 'Outcome',
  witnessedArrest: 'Witnessed Arrest',
  teamLeaderRole: 'Team Leader',
  precipitatingFactor: 'Precipitating Factor',
  utsteincriteriaMet: 'Utstein Criteria Met',
  targetedTemperatureManagement: 'Targeted Temperature Management',
};

const SECTION_TITLES = {
  'activation-location': 'Activation & Location',
  'cpr-details': 'CPR Details',
  'medications': 'Medications',
  'rosc-airway': 'ROSC & Airway',
  'outcome': 'Outcome',
};

const SENTENCE_FIELDS = ['precipitatingFactor', 'locationOfCodeBlue'];
const ARRAY_FIELDS = ['vasopressorsAdministered'];
const BOOLEAN_FIELDS = [
  'epinephrineAdministered', 'acslsProtocolFollowed', 'returnOfSpontaneousCirculation',
  'intubationPerformed', 'amiodaroneAdministered', 'sodiumBicarbonateGiven',
  'witnessedArrest', 'utsteincriteriaMet', 'targetedTemperatureManagement',
];
const DATETIME_FIELDS = ['codeBlueActivationTime', 'cprStartTime', 'cprEndTime', 'roscTime'];
const NUMBER_FIELDS = [
  'totalCprDuration', 'numberOfDefibrillations', 'epinephrineDoses',
  'timeToRosc', 'endTidalCo2', 'intubationAttempts',
];

// Convert a stored datetime (ISO string or Date) to the value a
// <input type="datetime-local"> expects: "YYYY-MM-DDTHH:mm".
const toDateTimeLocal = (val) => {
  if (!val) return '';
  const d = new Date(val.$date || val);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Convert a datetime-local input value back to the storage shape used in
// the DB for this collection: a local-time ISO-like string "YYYY-MM-DDTHH:mm:ss".
const fromDateTimeLocal = (val) => {
  if (!val) return '';
  return val.length === 16 ? `${val}:00` : val;
};

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" — arrays stored whole) */
const DRAFT_KEY = 'code_blue_summariesPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const CodeBlueSummariesDocument = ({ document: templateData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const textareaRef = useRef(null);
  const containerRef = useRef(null);

  const canEdit = true;

  // ========== DATA UNWRAPPING ==========
  const unwrappedData = useMemo(() => {
    if (!templateData) return [];
    if (Array.isArray(templateData)) {
      if (templateData.length > 0 && templateData[0]?.code_blue_summaries) {
        return templateData.flatMap(item => item.code_blue_summaries || []);
      }
      return templateData;
    }
    if (templateData.code_blue_summaries) return templateData.code_blue_summaries;
    if (templateData.documentData?.code_blue_summaries) return templateData.documentData.code_blue_summaries;
    if (templateData.documentData) {
      const docData = templateData.documentData;
      if (Array.isArray(docData)) return docData;
      return [docData];
    }
    return [templateData];
  }, [templateData]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    unwrappedData.forEach((record, idx) => {
      const rid = (() => {
        if (!record?._id) return null;
        if (typeof record._id === 'string') return record._id;
        if (record._id.$oid) return record._id.$oid;
        return String(record._id);
      })();
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldName, value]) => {
        const editKey = `${fieldName}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        if (Array.isArray(value)) {
          value.forEach((_, ai) => { nFields[`${fieldName}-${idx}-ai${ai}`] = 'edited'; });
        } else {
          nFields[editKey] = 'edited';
          nSentences[`${fieldName}-${idx}-s0`] = 'edited';
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [unwrappedData]);

  // ========== HELPERS ==========
  const hasVal = (v) => {
    if (v === null || v === undefined || v === '') return false;
    if (typeof v === 'number') return true;
    if (typeof v === 'boolean') return true;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'string') return v.trim().length > 0;
    return true;
  };

  const formatBoolean = (val) => {
    if (val === true || val === 'true' || val === 'Yes') return 'Yes';
    if (val === false || val === 'false' || val === 'No') return 'No';
    return val != null ? String(val) : '';
  };

  const formatDateTime = (d) => {
    if (!d) return '';
    try {
      const date = new Date(d.$date || d);
      if (isNaN(date.getTime())) return String(d);
      return date.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      });
    } catch {
      return String(d);
    }
  };

  const formatDate = (d) => {
    if (!d) return '';
    try {
      const date = new Date(d.$date || d);
      if (isNaN(date.getTime())) return String(d);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return String(d);
    }
  };

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

  const safeId = useCallback((r) => {
    if (!r?._id) return null;
    if (typeof r._id === 'string') return r._id;
    if (r._id.$oid) return r._id.$oid;
    return String(r._id);
  }, []);

  const displayFieldValue = (record, fieldName, idx) => {
    const val = getFieldValue(record, fieldName, idx);
    if (!hasVal(val)) return '';
    if (BOOLEAN_FIELDS.includes(fieldName)) return formatBoolean(val);
    if (DATETIME_FIELDS.includes(fieldName)) return formatDateTime(val);
    if (typeof val === 'number') return String(val);
    return String(val);
  };

  // ========== SPLIT BY SENTENCE ==========
  // Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 mg"
  const splitBySentence = (text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/)
      .map(s => s.trim())
      .filter(s => s && !/^[;.,!?]+$/.test(s));
  };

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  // ========== SEARCH ==========
  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || !text) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = String(text).split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i}>{part}</mark> : part
    );
  }, [searchTerm]);

  const shouldShowRow = useCallback((record, ...valuesToCheck) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    for (const val of valuesToCheck) {
      if (val && String(val).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm]);

  const shouldShowSection = useCallback((record, sectionId, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = SECTION_TITLES[sectionId] || '';
    if (title.toLowerCase().includes(phrase)) return true;
    const fields = SECTION_FIELDS[sectionId] || [];
    return fields.some(f => {
      const label = FIELD_LABELS[f] || '';
      if (label.toLowerCase().includes(phrase)) return true;
      if (ARRAY_FIELDS.includes(f)) {
        const arr = getEffectiveArray(record, f, idx);
        return arr.some(item => String(item).toLowerCase().includes(phrase));
      }
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return false;
      const display = displayFieldValue(record, f, idx);
      return display.toLowerCase().includes(phrase);
    });
  }, [searchTerm, getFieldValue, getEffectiveArray]);

  // ========== FILTERED RECORDS ==========
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return unwrappedData.map((r, i) => ({ ...r, _originalIdx: i, _showAllSections: false }));
    const phrase = searchTerm.toLowerCase().trim();
    return unwrappedData.map((record, i) => {
      const docTitle = `Code Blue Summary ${i + 1}`.toLowerCase();
      if (docTitle.includes(phrase) || phrase.includes('code blue')) {
        return { ...record, _originalIdx: i, _showAllSections: true };
      }
      const allFields = Object.keys(FIELD_LABELS);
      const searchableText = [
        'Code Blue Summary', ...Object.values(FIELD_LABELS), ...Object.values(SECTION_TITLES),
        ...allFields.map(k => {
          if (BOOLEAN_FIELDS.includes(k)) return formatBoolean(record[k]);
          if (DATETIME_FIELDS.includes(k)) return formatDateTime(record[k]);
          if (ARRAY_FIELDS.includes(k)) return (Array.isArray(record[k]) ? record[k] : []).join(' ');
          const val = getFieldValue(record, k, i);
          return hasVal(val) ? String(val) : '';
        }),
      ].filter(Boolean).join(' ').toLowerCase();
      if (searchableText.includes(phrase)) {
        return { ...record, _originalIdx: i, _showAllSections: false };
      }
      return null;
    }).filter(Boolean);
  }, [unwrappedData, searchTerm, getFieldValue]);

  // ========== pdfData MEMO ==========
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return unwrappedData;
    return unwrappedData.map((rec, idx) => {
      const merged = { ...rec };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldName = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx === idx) {
          if (ARRAY_FIELDS.includes(fieldName)) {
            merged[fieldName] = getEffectiveArray(rec, fieldName, idx);
          } else {
            merged[fieldName] = editVal;
          }
        }
      }
      return merged;
    });
  }, [unwrappedData, localEdits, getEffectiveArray, pendingEdits]);

  // ========== COPY ==========
  const copyToClipboard = useCallback(async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      const textarea = window.document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      (containerRef.current || window.document.body).appendChild(textarea);
      textarea.select();
      window.document.execCommand('copy');
      (containerRef.current || window.document.body).removeChild(textarea);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, []);

  // ========== COPY SECTION / ALL (EQ/DASH numbered — mirrors JSX + PDF) ==========
  // Single builder used by BOTH Copy Section (live edits) and Copy All (committed pdfData). valueOf/
  // arrayOf abstract the source. Format: "TITLE\n=(40)\n\nLabel\n-(40)\n1. value\n\n...".
  const buildSectionCopy = (sectionId, valueOf, arrayOf) => {
    const title = SECTION_TITLES[sectionId];
    const fields = SECTION_FIELDS[sectionId] || [];
    const blocks = [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      if (ARRAY_FIELDS.includes(f)) {
        const arr = (arrayOf(f) || []).filter(hasVal);
        if (!arr.length) return;
        blocks.push(`${label}\n${COPY_LINE_DASH}\n${arr.map((it, i) => `${i + 1}. ${it}`).join('\n')}`);
        return;
      }
      const val = valueOf(f);
      if (!hasVal(val)) return;
      let rows;
      if (BOOLEAN_FIELDS.includes(f)) rows = [formatBoolean(val)];
      else if (DATETIME_FIELDS.includes(f)) rows = [formatDateTime(val)];
      else if (SENTENCE_FIELDS.includes(f)) { const s = splitBySentence(String(val)); rows = s.length ? s : [String(val)]; }
      else rows = [String(val)];
      blocks.push(`${label}\n${COPY_LINE_DASH}\n${rows.map((r, i) => `${i + 1}. ${r}`).join('\n')}`);
    });
    if (!blocks.length) return '';
    return `${title.toUpperCase()}\n${COPY_LINE_EQ}\n\n${blocks.join('\n\n')}`;
  };

  const getSectionCopyText = (record, sectionId, idx) =>
    buildSectionCopy(sectionId, f => getFieldValue(record, f, idx), f => getEffectiveArray(record, f, idx));

  const handleCopyAll = useCallback(() => {
    const allText = pdfData.map((r, idx) => {
      const sections = Object.keys(SECTION_FIELDS)
        .map(sid => buildSectionCopy(sid, f => r[f], f => (Array.isArray(r[f]) ? r[f] : [])))
        .filter(Boolean);
      return `CODE BLUE SUMMARY ${idx + 1}\n${COPY_LINE_EQ}\n\n${sections.join('\n\n')}`;
    }).join('\n\n\n');
    copyToClipboard(allText, 'copy-all');
  }, [pdfData, copyToClipboard]);

  // ========== EDITING ==========
  const handleStartEdit = useCallback((fieldName, idx, currentValue, sentenceIdx = 0) => {
    const editKey = `${fieldName}-${idx}-s${sentenceIdx}`;
    setEditingField(editKey);
    const cleanValue = (currentValue || '').replace(/[.;]+$/, '').trim();
    setEditValue(cleanValue);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, sentenceIdx, valueOverride, editTrackingKey) => {
    const recordId = safeId(record);
    if (!recordId) { console.error('Cannot save - no record _id'); return; }
    const saveValue = valueOverride !== undefined ? valueOverride : editValue.trim();
    const sKey = editTrackingKey || `${fieldName}-${idx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;
    const editKey = `${fieldName}-${idx}`;
    let stagedValue = saveValue;
    if (ARRAY_FIELDS.includes(fieldName)) {
      const arrMatch = editingField?.match(/-ai(\d+)$/);
      const ai = arrMatch ? parseInt(arrMatch[1]) : null;
      if (ai === null) return;
      const arr = [...(getEffectiveArray(record, fieldName, idx))];
      arr[ai] = saveValue;
      stagedValue = arr;
      setLocalEdits(prev => ({ ...prev, [editKey]: arr }));
      setEditedFields(prev => ({ ...prev, [`${fieldName}-${idx}-ai${ai}`]: 'edited' }));
    } else {
      setLocalEdits(prev => ({ ...prev, [editKey]: saveValue }));
      setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    }
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => { const u = { ...prev }; delete u[`${sectionId}-${idx}`]; return u; });

    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldName] = stagedValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue, editingField, safeId, getEffectiveArray]);

  // PLAIN FUNCTION - saveSentence
  function saveSentence(record, fieldName, idx, sectionId, sentenceIdx) {
    const id = safeId(record);
    if (!id) return;
    const currentVal = String(getFieldValue(record, fieldName, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();

    // Handle delete — stage a DRAFT locally (no DB write); Approve commits it.
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences];
      updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      const editKey = `${fieldName}-${idx}`;
      setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
      setPendingEdits(prev => ({ ...prev, [editKey]: true }));
      setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
      setEditedSentences(prev => ({ ...prev, [`${fieldName}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setApprovedSections(prev => { const u = { ...prev }; delete u[`${sectionId}-${idx}`]; return u; });
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][fieldName] = fullText;
      writeDrafts(store);
      setEditingField(null);
      setEditValue('');
      return;
    }

    // Normal save
    const updated = [...sentences];
    updated[sentenceIdx] = editedVal;
    const fullText = reconstructFullText(updated);
    const newSentences = splitBySentence(fullText);
    const extraCount = newSentences.length - sentences.length;

    if (extraCount > 0) {
      const editedMap = {};
      editedMap[`${fieldName}-${idx}-s${sentenceIdx}`] = 'edited';
      for (let si = sentenceIdx + 1; si <= sentenceIdx + extraCount; si++) {
        editedMap[`${fieldName}-${idx}-s${si}`] = 'added';
      }
      setEditedSentences(prev => {
        const cleaned = {};
        for (const key of Object.keys(prev)) {
          if (!key.startsWith(`${fieldName}-${idx}-s`)) cleaned[key] = prev[key];
        }
        return { ...cleaned, ...editedMap };
      });
    } else {
      const prevVal = sentences[sentenceIdx] || '';
      if (editedVal !== prevVal.replace(/[;.]+$/, '').trim()) {
        setEditedSentences(prev => ({ ...prev, [`${fieldName}-${idx}-s${sentenceIdx}`]: 'edited' }));
      }
    }

    handleSaveField(record, fieldName, idx, sectionId, sentenceIdx, fullText);
  }

  // ========== APPROVE ==========
  const sectionHasEdits = useCallback((sectionId, idx) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    if (approvedSections[`${sectionId}-${idx}`]) return false;
    return fields.some(f => {
      const hasSentenceEdits = Object.keys(editedSentences).some(key => {
        if (!key.startsWith(`${f}-${idx}-s`)) return false;
        return editedSentences[key] === 'edited' || editedSentences[key] === 'added';
      });
      const hasFieldEdits = Object.keys(editedFields).some(key => key.startsWith(`${f}-${idx}`));
      return hasSentenceEdits || hasFieldEdits;
    });
  }, [editedSentences, editedFields, approvedSections]);

  // Approve = COMMIT all staged drafts for this section's fields to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sectionId, idx) => {
    const recordId = safeId(record);
    if (!recordId) return;
    const key = `${sectionId}-${idx}`;
    const isApproved = approvedSections[key];
    if (isApproved) return;
    setSaving(true);
    try {
      const fieldsForSection = SECTION_FIELDS[sectionId] || [];
      const suffix = `-${idx}`;
      // Staged edits for THIS record whose field belongs to THIS section.
      const toCommit = Object.keys(localEdits).filter(k =>
        pendingEdits[k] && k.endsWith(suffix) && fieldsForSection.includes(k.slice(0, -suffix.length))
      );
      for (const editKey of toCommit) {
        const fieldName = editKey.slice(0, -suffix.length);
        const value = localEdits[editKey];
        if (ARRAY_FIELDS.includes(fieldName) && Array.isArray(value)) {
          // Persist each array element with its arrayIndex (mirrors the per-element edit endpoint).
          for (let ai = 0; ai < value.length; ai++) {
            await secureApiClient.put(`/api/edit/code_blue_summaries/${recordId}/edit`, {
              field: fieldName,
              value: value[ai],
              arrayIndex: ai,
            });
          }
        } else {
          await secureApiClient.put(`/api/edit/code_blue_summaries/${recordId}/edit`, {
            field: fieldName,
            value,
          });
        }
      }
      await secureApiClient.put(`/api/edit/code_blue_summaries/${recordId}/approve`, {
        sectionId,
        approved: true,
      });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's committed drafts from localStorage (leave other sections' drafts intact)
      const store = readDrafts();
      if (store[recordId]) {
        toCommit.forEach(k => { delete store[recordId][k.slice(0, -suffix.length)]; });
        if (Object.keys(store[recordId]).length === 0) delete store[recordId];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [key]: true }));
      const fields = SECTION_FIELDS[sectionId] || [];
      setEditedSentences(prev => {
        const cleaned = { ...prev };
        for (const k of Object.keys(cleaned)) {
          if (fields.some(f => k.startsWith(`${f}-${idx}-s`))) delete cleaned[k];
        }
        return cleaned;
      });
      setEditedFields(prev => {
        const cleaned = { ...prev };
        for (const k of Object.keys(cleaned)) {
          if (fields.some(f => k.startsWith(`${f}-${idx}`))) delete cleaned[k];
        }
        return cleaned;
      });
    } catch (error) {
      console.error('Approve failed:', error);
    } finally { setSaving(false); }
  }, [approvedSections, safeId, localEdits, pendingEdits]);

  const renderApproveButton = (record, sectionId, idx) => {
    const key = `${sectionId}-${idx}`;
    const hasEdits = sectionHasEdits(sectionId, idx);
    const isApproved = approvedSections[key];
    if (!hasEdits && !isApproved) return null;
    return (
      <button
        className={`approve-btn ${isApproved ? 'approved' : 'pending'}`}
        disabled={saving}
        onClick={() => handleApproveSection(record, sectionId, idx)}
      >
        {saving && !isApproved ? 'Approving...' : isApproved ? 'Approved' : 'Pending Approve'}
      </button>
    );
  };

  // ========== RENDER EDITABLE FIELD ==========
  const renderEditableField = (record, fieldName, idx, sectionId) => {
    const val = getFieldValue(record, fieldName, idx);
    if (!hasVal(val)) return null;
    const label = FIELD_LABELS[fieldName] || fieldName;
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const isEdited = editedSentences[editKey] === 'edited';
    const copyId = `${fieldName}-${idx}`;

    const isBool = BOOLEAN_FIELDS.includes(fieldName);
    const isDt = DATETIME_FIELDS.includes(fieldName);
    const displayVal = isBool ? formatBoolean(val) : isDt ? formatDateTime(val) : String(val);
    const rawEditVal = isDt ? String(val) : String(val);

    return (
      <div key={fieldName} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea
                ref={textareaRef}
                className="edit-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    handleSaveField(record, fieldName, idx, sectionId, 0);
                  }
                  if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                }}
                disabled={saving}
              />
              <div className="edit-actions">
                <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                <button className="save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId, 0)} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                className={`row-content${canEdit ? ' editable' : ''}`}
                onClick={() => canEdit && handleStartEdit(fieldName, idx, rawEditVal)}
              >
                <span className="content-value">{highlightText(displayVal)}</span>
                {canEdit && !isEdited && <span className="edit-indicator">&#9998;</span>}
              </div>
              <button
                className={`copy-btn${copiedId === copyId ? ' copied' : ''}`}
                onClick={() => copyToClipboard(`${label}: ${displayVal}`, copyId)}
              >
                {copiedId === copyId ? 'Copied' : 'Copy'}
              </button>
            </>
          )}
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // ========== RENDER SENTENCE EDITABLE FIELD ==========
  const renderSentenceEditableField = (record, fieldName, idx, sectionId) => {
    const val = getFieldValue(record, fieldName, idx);
    if (!hasVal(val)) return null;
    const label = FIELD_LABELS[fieldName] || fieldName;
    const text = String(val);
    const sentences = splitBySentence(text);

    if (sentences.length <= 1) {
      return renderEditableField(record, fieldName, idx, sectionId);
    }

    return (
      <div key={fieldName} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {sentences.map((sentence, sIdx) => {
          const sentenceEditKey = `${fieldName}-${idx}-s${sIdx}`;
          const isSentenceEditing = editingField === sentenceEditKey;
          const badge = editedSentences[sentenceEditKey];
          const isSentenceEdited = badge === 'edited' || badge === 'added';

          return (
            <React.Fragment key={sIdx}>
              <div className={`numbered-row${isSentenceEdited ? ' modified' : ''}`}>
                {isSentenceEditing ? (
                  <div className="edit-field-container">
                    <textarea
                      ref={textareaRef}
                      className="edit-textarea"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveSentence(record, fieldName, idx, sectionId, sIdx);
                        if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                      }}
                      disabled={saving}
                    />
                    <div className="edit-actions">
                      <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                      <button className="save-btn" onClick={() => saveSentence(record, fieldName, idx, sectionId, sIdx)} disabled={saving}>
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      className={`row-content${canEdit ? ' editable' : ''}`}
                      onClick={() => canEdit && handleStartEdit(fieldName, idx, sentence, sIdx)}
                    >
                      <span className="content-value">{highlightText(sentence)}</span>
                      {canEdit && !isSentenceEdited && <span className="edit-indicator">&#9998;</span>}
                    </div>
                    <button
                      className={`copy-btn${copiedId === sentenceEditKey ? ' copied' : ''}`}
                      onClick={() => copyToClipboard(sentence, sentenceEditKey)}
                    >
                      {copiedId === sentenceEditKey ? 'Copied' : 'Copy'}
                    </button>
                  </>
                )}
              </div>
              {isSentenceEdited && (
                <div className={`modified-badge${badge === 'added' ? ' added' : ''}`}>
                  {badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // ========== RENDER EDITABLE ARRAY ITEM ==========
  const renderEditableArrayItem = (record, fieldName, idx, sectionId) => {
    const arr = getEffectiveArray(record, fieldName, idx);
    if (arr.length === 0) return null;
    const label = FIELD_LABELS[fieldName] || fieldName;

    return (
      <div key={fieldName} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {arr.map((item, ai) => {
          const editKey = `${fieldName}-${idx}-ai${ai}`;
          const isEditing = editingField === editKey;
          const badge = editedFields[editKey];
          const isEdited = badge === 'edited' || badge === 'added';
          const itemStr = String(item);
          const copyId = editKey;

          return (
            <React.Fragment key={ai}>
              <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea
                      ref={textareaRef}
                      className="edit-textarea"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          handleSaveField(record, fieldName, idx, sectionId, 0);
                        }
                        if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                      }}
                      disabled={saving}
                    />
                    <div className="edit-actions">
                      <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                      <button className="save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId, 0)} disabled={saving}>
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      className={`row-content${canEdit ? ' editable' : ''}`}
                      onClick={() => {
                        if (!canEdit) return;
                        setEditingField(editKey);
                        setEditValue(itemStr);
                        setTimeout(() => textareaRef.current?.focus(), 50);
                      }}
                    >
                      <span className="content-value">{highlightText(itemStr)}</span>
                      {canEdit && !isEdited && <span className="edit-indicator">&#9998;</span>}
                    </div>
                    <button
                      className={`copy-btn${copiedId === copyId ? ' copied' : ''}`}
                      onClick={() => copyToClipboard(itemStr, copyId)}
                    >
                      {copiedId === copyId ? 'Copied' : 'Copy'}
                    </button>
                  </>
                )}
              </div>
              {isEdited && (
                <div className={`modified-badge${badge === 'added' ? ' added' : ''}`}>
                  {badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // ========== RENDER NUMBER FIELD (typed, hide-zero unless meaningful) ==========
  // Numeric clinical counts/durations where 0 IS meaningful (e.g. 0 doses, 0 min to ROSC,
  // 0 defibrillations) — show whenever the value is a real number, including 0.
  const renderNumberField = (record, fieldName, idx, sectionId) => {
    const val = getFieldValue(record, fieldName, idx);
    if (typeof val !== 'number' || isNaN(val)) return null;
    const label = FIELD_LABELS[fieldName] || fieldName;
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const isEdited = editedSentences[editKey] === 'edited';
    const copyId = `${fieldName}-${idx}`;
    const displayVal = String(val);

    return (
      <div key={fieldName} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" disabled={saving} onClick={() => { const st = parseFloat(stepFor(val)) || 1; const dec = (String(st).split('.')[1] || '').length; const cur = parseFloat(editValue); setEditValue(Math.max(0, (isNaN(cur) ? 0 : cur) - st).toFixed(dec)); }}>−</button>
                <input
                  type="number"
                  step={stepFor(val)}
                  min="0"
                  className="edit-number"
                  ref={textareaRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      const num = parseFloat(editValue);
                      if (isNaN(num)) return;
                      handleSaveField(record, fieldName, idx, sectionId, 0, num);
                    }
                    if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                  }}
                  disabled={saving}
                />
                <button type="button" className="num-step" disabled={saving} onClick={() => { const st = parseFloat(stepFor(val)) || 1; const dec = (String(st).split('.')[1] || '').length; const cur = parseFloat(editValue); setEditValue(Math.max(0, (isNaN(cur) ? 0 : cur) + st).toFixed(dec)); }}>+</button>
              </div>
              <div className="edit-actions">
                <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                <button
                  className="save-btn"
                  disabled={saving}
                  onClick={() => {
                    const num = parseFloat(editValue);
                    if (isNaN(num)) return;
                    handleSaveField(record, fieldName, idx, sectionId, 0, num);
                  }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                className={`row-content${canEdit ? ' editable' : ''}`}
                onClick={() => { if (canEdit) { setEditingField(editKey); setEditValue(displayVal); } }}
              >
                <span className="content-value">{highlightText(displayVal)}</span>
                {canEdit && !isEdited && <span className="edit-indicator">&#9998;</span>}
              </div>
              <button
                className={`copy-btn${copiedId === copyId ? ' copied' : ''}`}
                onClick={() => copyToClipboard(`${label}: ${displayVal}`, copyId)}
              >
                {copiedId === copyId ? 'Copied' : 'Copy'}
              </button>
            </>
          )}
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // ========== RENDER BOOLEAN FIELD (typed Yes/No select) ==========
  const renderBooleanField = (record, fieldName, idx, sectionId) => {
    const val = getFieldValue(record, fieldName, idx);
    if (!hasVal(val)) return null;
    const label = FIELD_LABELS[fieldName] || fieldName;
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const isEdited = editedSentences[editKey] === 'edited';
    const copyId = `${fieldName}-${idx}`;
    const boolVal = val === true || val === 'true' || val === 'Yes';
    const displayVal = formatBoolean(val);

    return (
      <div key={fieldName} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
          {isEditing ? (
            <div className="edit-field-container">
              <select
                className="edit-select"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                disabled={saving}
                autoFocus
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
              <div className="edit-actions">
                <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                <button
                  className="save-btn"
                  disabled={saving}
                  onClick={() => handleSaveField(record, fieldName, idx, sectionId, 0, editValue === 'true')}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                className={`row-content${canEdit ? ' editable' : ''}`}
                onClick={() => { if (canEdit) { setEditingField(editKey); setEditValue(boolVal ? 'true' : 'false'); } }}
              >
                <span className="content-value">{highlightText(displayVal)}</span>
                {canEdit && !isEdited && <span className="edit-indicator">&#9998;</span>}
              </div>
              <button
                className={`copy-btn${copiedId === copyId ? ' copied' : ''}`}
                onClick={() => copyToClipboard(`${label}: ${displayVal}`, copyId)}
              >
                {copiedId === copyId ? 'Copied' : 'Copy'}
              </button>
            </>
          )}
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // ========== RENDER DATETIME FIELD (typed datetime-local picker) ==========
  const renderDateTimeField = (record, fieldName, idx, sectionId) => {
    const val = getFieldValue(record, fieldName, idx);
    if (!hasVal(val)) return null;
    const label = FIELD_LABELS[fieldName] || fieldName;
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const isEdited = editedSentences[editKey] === 'edited';
    const copyId = `${fieldName}-${idx}`;
    const displayVal = formatDateTime(val);

    return (
      <div key={fieldName} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
          {isEditing ? (
            <div className="edit-field-container">
              {/* Combined date + time on one row: BlueDatePicker sets the YYYY-MM-DD part,
                  BlueTimePicker sets the HH:mm part; editValue holds "YYYY-MM-DDTHH:mm". */}
              {(() => {
                const datePart = (editValue || '').slice(0, 10);
                const timePart = (editValue || '').length >= 16 ? editValue.slice(11, 16) : '';
                return (
                  <div className="datetime-pickers-row">
                    <BlueDatePicker value={datePart} onSelect={(iso) => setEditValue(`${iso}T${timePart || '00:00'}`)} />
                    <BlueTimePicker value={timePart} onChange={(hm) => setEditValue(`${datePart || toDateTimeLocal(new Date())}T${hm}`)} />
                  </div>
                );
              })()}
              <div className="edit-actions">
                <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                <button
                  className="save-btn"
                  disabled={saving || !editValue}
                  onClick={() => handleSaveField(record, fieldName, idx, sectionId, 0, fromDateTimeLocal(editValue))}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                className={`row-content${canEdit ? ' editable' : ''}`}
                onClick={() => { if (canEdit) { setEditingField(editKey); setEditValue(toDateTimeLocal(val)); } }}
              >
                <span className="content-value">{highlightText(displayVal)}</span>
                {canEdit && !isEdited && <span className="edit-indicator">&#9998;</span>}
              </div>
              <button
                className={`copy-btn${copiedId === copyId ? ' copied' : ''}`}
                onClick={() => copyToClipboard(`${label}: ${displayVal}`, copyId)}
              >
                {copiedId === copyId ? 'Copied' : 'Copy'}
              </button>
            </>
          )}
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // ========== RENDER SECTION ==========
  const renderSection = (record, idx, sectionId) => {
    if (!shouldShowSection(record, sectionId, idx)) return null;
    const title = SECTION_TITLES[sectionId];
    const fields = SECTION_FIELDS[sectionId] || [];
    const hasContent = fields.some(f => {
      if (ARRAY_FIELDS.includes(f)) return getEffectiveArray(record, f, idx).length > 0;
      return hasVal(getFieldValue(record, f, idx));
    });
    if (!hasContent) return null;

    const sectionCopyId = `section-${sectionId}-${idx}`;
    const sectionText = getSectionCopyText(record, sectionId, idx);

    return (
      <div key={sectionId} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h3 className="section-title">{highlightText(title)}</h3>
            <div className="header-right-actions">
              <button
                className={`copy-btn header-copy-btn${copiedId === sectionCopyId ? ' copied' : ''}`}
                onClick={() => copyToClipboard(sectionText, sectionCopyId)}
              >
                {copiedId === sectionCopyId ? 'Copied' : 'Copy Section'}
              </button>
              {renderApproveButton(record, sectionId, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (ARRAY_FIELDS.includes(f)) return renderEditableArrayItem(record, f, idx, sectionId);
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sectionId);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sectionId);
            if (DATETIME_FIELDS.includes(f)) return renderDateTimeField(record, f, idx, sectionId);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sectionId);
            return renderEditableField(record, f, idx, sectionId);
          })}
        </div>
      </div>
    );
  };

  // ========== EMPTY STATE ==========
  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <div className="code-blue-summaries-document" ref={containerRef}>
        <div className="document-header">
          <h1 className="document-title">Code Blue Summaries</h1>
        </div>
        <div className="empty-state">No code blue summary records available.</div>
      </div>
    );
  }

  return (
    <div className="code-blue-summaries-document" ref={containerRef}>
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">Code Blue Summaries</h1>
        <div className="header-actions">
          <button
            className={`copy-btn header-copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`}
            onClick={handleCopyAll}
          >
            {copiedId === 'copy-all' ? 'Copied' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<CodeBlueSummariesDocumentPDFTemplate document={pdfData} />}
            fileName="Code_Blue_Summaries.pdf"
          >
            {({ loading }) => (
              <button className="copy-btn header-copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>
            )}
          </PDFDownloadLink>
        </div>
      </div>

      {/* Search */}
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search code blue summaries..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button className="clear-search" onClick={() => setSearchTerm('')}>x</button>
        )}
      </div>

      {/* Records */}
      <div className="records-container">
        {filteredRecords.length === 0 && searchTerm.trim() ? (
          <div className="no-results">No results for "{searchTerm}"</div>
        ) : (
          filteredRecords.map((record, rIdx) => {
            const idx = record._originalIdx !== undefined ? record._originalIdx : rIdx;
            const activationTime = getFieldValue(record, 'codeBlueActivationTime', idx);
            const dateBadgeText = activationTime ? formatDate(activationTime) : (record.createdAt ? formatDate(record.createdAt) : '');

            return (
              <div key={safeId(record) || rIdx} className="record-card">
                {/* Record Header */}
                <div className="record-header">
                  <div className="record-meta-row">
                    {dateBadgeText && <span className="date-badge">{dateBadgeText}</span>}
                  </div>
                  <h2 className="record-title">{highlightText(`Code Blue Summary ${rIdx + 1}`)}</h2>
                </div>

                {/* Sections */}
                {renderSection(record, idx, 'activation-location')}
                {renderSection(record, idx, 'cpr-details')}
                {renderSection(record, idx, 'medications')}
                {renderSection(record, idx, 'rosc-airway')}
                {renderSection(record, idx, 'outcome')}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CodeBlueSummariesDocument;
