/**
 * DermatologyConsultationsDocument.jsx
 * March 2026 Standard - Blue Glow Theme + Inline Editing
 *
 * Collection: dermatology_consultations
 * Patient: Jessica Turner
 * ServiceId: dermatology-consultations-edit-service
 *
 * Displays dermatology consultation records with 4-level search hierarchy:
 * Level 1: Document (record) with _originalIdx + title search + _showAllSections
 * Level 2: Section (section title) with startsWith bidirectional
 * Level 4: Row/Field (individual fields) with phrase matching
 *
 * Layout:
 * - Document title on top, Copy All + Export PDF buttons below (right-aligned)
 * - Record header: date/status badges on top row (right), title below (left)
 * - Sections: Chief Complaint, Skin Lesion Locations, Lesion Morphology, Lesion Details,
 *   ABCDE Assessment (semicolon-split with label:value nested subtitles),
 *   Dermatoscope Findings (comma-split), Biopsy Information, Histopathology Results,
 *   PASI Score (bar chart), Suspected Diagnoses, Allergic Reactions,
 *   Topical Medications, Systemic Therapy, Phototherapy, Follow-Up, Referral
 *
 * Inline editing follows per-sentence + per-item patterns:
 * - Per-sentence editing for text fields (chiefComplaint, histopathologyResults, referralSpecialty)
 * - Per-item editing for arrays (skinLesionLocation, suspectedDiagnosis, etc.)
 * - Simple field editing for lesionSize, biopsyType
 * - Boolean select editing for biopsyPerformed, phototherapyRecommended
 * - Number editing for pasiScore
 * - Semicolon-split editing for abcdeAssessment, lesionMorphology, followUpInterval
 * - Comma-split editing for dermatoscopeFindings
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import SearchBar from '../components/SearchBar';
import DermatologyConsultationsDocumentPDFTemplate from '../pdf-templates/DermatologyConsultationsDocumentPDFTemplate';
import './DermatologyConsultationsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldName]: value } }  (value = full field value: string or array) */
const DRAFT_KEY = 'dermatology_consultationsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* Canonical section titles — single source for JSX headers, Copy Section, Copy All */
const SECTION_TITLES = {
  'chief-complaint': 'Chief Complaint',
  'skin-lesion-locations': 'Skin Lesion Locations',
  'lesion-morphology': 'Lesion Morphology',
  'lesion-details': 'Lesion Details',
  'abcde-assessment': 'ABCDE Assessment',
  'dermatoscope-findings': 'Dermatoscope Findings',
  'biopsy-info': 'Biopsy Information',
  'histopathology': 'Histopathology Results',
  'pasi-score': 'PASI Score',
  'scorad-index': 'SCORAD Index',
  'fitzpatrick-skin-type': 'Fitzpatrick Skin Type',
  'melanoma-staging': 'Melanoma Staging',
  'patch-test': 'Patch Test Results',
  'woods-lamp': "Wood's Lamp Findings",
  'koh-test': 'KOH Test',
  'suspected-diagnoses': 'Suspected Diagnoses',
  'allergic-reactions': 'Allergic Reactions',
  'topical-medications': 'Topical Medications',
  'systemic-therapy': 'Systemic Therapy',
  'phototherapy': 'Phototherapy',
  'follow-up': 'Follow-Up Interval',
  'referral': 'Referral Specialty',
};

/* Known clinical scales → full-scale dropdowns (keep an off-scale stored value selectable) */
const ENUM_FIELDS = {
  fitzpatrickSkinType: ['Type I', 'Type II', 'Type III', 'Type IV', 'Type V', 'Type VI'],
  biopsyType: ['Shave', 'Punch', 'Excisional', 'Incisional'],
  melanomaClark: ['Level I', 'Level II', 'Level III', 'Level IV', 'Level V'],
};
const enumCanonical = (options, current) => {
  const cur = String(current ?? '').trim();
  const hit = options.find(o => o.toLowerCase() === cur.toLowerCase());
  return hit || cur;
};
const enumOptionsWith = (options, current) => {
  const cur = String(current ?? '').trim();
  if (!cur || options.some(o => o.toLowerCase() === cur.toLowerCase())) return options;
  return [cur, ...options];
};

const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* stepper step: decimals step 0.1, integers step 1 */
const stepFor = (v) => (/\.\d/.test(String(v)) ? 0.1 : 1);

/* Measurement-text fields ("9mm x 7mm (pigmented lesion)") — every number edits with its own
   −/+ segment, literals/units preserved verbatim */
const MEASUREMENT_FIELDS = ['lesionSize'];
const parseNumeric = (text) => {
  if (text === null || text === undefined) return null;
  const s = String(text);
  if (!/\d/.test(s)) return null;
  const nums = []; const literals = [];
  const re = /-?\d+(?:\.\d+)?/g; let last = 0; let m;
  while ((m = re.exec(s)) !== null) { literals.push(s.slice(last, m.index)); nums.push(m[0]); last = m.index + m[0].length; }
  literals.push(s.slice(last));
  return { nums, literals };
};
const rebuildNumeric = (literals, nums) => literals.slice(0, -1).map((lit, i) => lit + (nums[i] ?? '')).join('') + literals[literals.length - 1];

const DermatologyConsultationsDocument = ({ document: docProp, data, templateData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [copiedAll, setCopiedAll] = useState(false);
  const containerRef = useRef(null);

  // Editing state
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [approving, setApproving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys (`${fieldName}-${idx}`) that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  // segmented numeric editing ({nums, literals}) for measurement-text values ("9mm x 7mm")
  const [editNums, setEditNums] = useState(null);
  const textareaRef = useRef(null);

  /* stepper helpers: adjust editValue by the value's step, clamped >= 0 (clinical scores) */
  const stepEditValue = (dir) => {
    setEditValue(prev => {
      const n = parseFloat(prev);
      const s = stepFor(prev);
      const next = (isNaN(n) ? 0 : n) + dir * s;
      return String(Math.max(0, Math.round(next * 100) / 100));
    });
  };
  /* segmented-numeric helpers: per-number −/+ inside a measurement string, clamped >= 0 */
  const stepNum = (ni, dir) => setEditNums(prev => {
    if (!prev) return prev;
    const nums = [...prev.nums];
    const n = parseFloat(nums[ni]); const s = stepFor(nums[ni]);
    nums[ni] = String(Math.max(0, Math.round(((isNaN(n) ? 0 : n) + dir * s) * 100) / 100));
    return { ...prev, nums };
  });
  const setNum = (ni, v) => setEditNums(prev => {
    if (!prev) return prev;
    const nums = [...prev.nums]; nums[ni] = v;
    return { ...prev, nums };
  });

  // Format date helper
  const formatDate = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return dateVal;
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateVal;
    }
  };

  // Safe value check
  const hasValue = (val) => {
    if (val === null || val === undefined || val === '') return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'number') return true;
    if (typeof val === 'boolean') return true;
    return true;
  };

  // Sentence splitter with parenthesis + title protection
  const splitBySentence = (text) => {
    if (!text || typeof text !== 'string') return [];
    const result = [];
    let current = '';
    let parenDepth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') parenDepth++;
      else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
      if ((ch === '.' || ch === ';') && parenDepth === 0 && i + 1 < text.length && /\s/.test(text[i + 1])) {
        if (ch === '.' && /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc)$/.test(current)) {
          current += ch;
          continue;
        }
        const trimmed = current.trim();
        if (trimmed) result.push(trimmed);
        current = '';
        while (i + 1 < text.length && /\s/.test(text[i + 1])) i++;
      } else {
        current += ch;
      }
    }
    const trimmed = current.replace(/[.;]+$/, '').trim();
    if (trimmed) result.push(trimmed);
    return result;
  };

  // Split by semicolon (parenthesis-aware)
  const splitBySemicolon = (text) => {
    if (!text || typeof text !== 'string') return [];
    const result = [];
    let current = '';
    let parenDepth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') parenDepth++;
      else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
      if (ch === ';' && parenDepth === 0) {
        const trimmed = current.trim();
        if (trimmed) result.push(trimmed);
        current = '';
      } else {
        current += ch;
      }
    }
    const trimmed = current.trim();
    if (trimmed) result.push(trimmed);
    return result;
  };

  // Parse label from "Label: Value" pattern
  const parseLabel = (text) => {
    if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text };
    const colonIdx = text.indexOf(':');
    if (colonIdx > 0 && colonIdx < text.length - 1) {
      const label = text.substring(0, colonIdx).trim();
      const value = text.substring(colonIdx + 1).trim();
      if (label.length > 0 && label.length < 60 && value.length > 0) {
        return { isLabeled: true, label, value };
      }
    }
    return { isLabeled: false, label: '', value: text };
  };

  // Split by comma (parenthesis-aware + guards: skip no-space commas ("$18,000"), keep
  // "and"/"or" adjacent to the comma connected, next non-space char must be letter/>/( )
  const splitByComma = (text) => {
    if (!text || typeof text !== 'string') return [];
    const result = [];
    let current = '';
    let parenDepth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') parenDepth++;
      else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
      if (ch === ',' && parenDepth === 0) {
        const rest = text.slice(i + 1);
        const noSpace = !/^\s/.test(rest);
        const nextWordM = rest.match(/^\s*([^\s,]+)/);
        const nextWord = nextWordM ? nextWordM[1].toLowerCase() : '';
        const prevWordM = current.match(/(\S+)\s*$/);
        const prevWord = prevWordM ? prevWordM[1].toLowerCase() : '';
        const nextCharM = rest.match(/^\s*(.)/);
        const nextChar = nextCharM ? nextCharM[1] : '';
        const badNext = nextChar && !/[A-Za-z>(]/.test(nextChar);
        if (noSpace || nextWord === 'and' || nextWord === 'or' || prevWord === 'and' || prevWord === 'or' || badNext) {
          current += ch;
          continue;
        }
        const trimmed = current.trim();
        if (trimmed) result.push(trimmed);
        current = '';
      } else {
        current += ch;
      }
    }
    const trimmed = current.trim();
    if (trimmed) result.push(trimmed);
    return result;
  };

  // 3-prop data unwrapping with useMemo
  const records = useMemo(() => {
    const raw = templateData || docProp || data;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (raw?.dermatology_consultations) return Array.isArray(raw.dermatology_consultations) ? raw.dermatology_consultations : [raw.dermatology_consultations];
    if (raw?.documentData) {
      const docData = raw.documentData;
      if (Array.isArray(docData)) return docData;
      if (docData?.dermatology_consultations) return Array.isArray(docData.dermatology_consultations) ? docData.dermatology_consultations : [docData.dermatology_consultations];
      return [docData];
    }
    if (typeof raw === 'object') return [raw];
    return [];
  }, [templateData, docProp, data]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const rid = record && (record._id?.$oid || record._id);
      const recDrafts = rid ? store[String(rid)] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldName, value]) => {
        const editKey = `${fieldName}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = true;
        nSentences[`${fieldName}-${idx}-s0`] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  // SECTION_FIELDS mapping
  const SECTION_FIELDS = {
    'chief-complaint': ['chiefComplaint'],
    'skin-lesion-locations': ['skinLesionLocation'],
    'lesion-morphology': ['lesionMorphology'],
    'lesion-details': ['lesionSize'],
    'abcde-assessment': ['abcdeAssessment'],
    'dermatoscope-findings': ['dermatoscopeFindings'],
    'biopsy-info': ['biopsyPerformed', 'biopsyType'],
    'histopathology': ['histopathologyResults'],
    'pasi-score': ['pasiScore'],
    'scorad-index': ['scoradIndex'],
    'fitzpatrick-skin-type': ['fitzpatrickSkinType'],
    'melanoma-staging': ['melanomaBreslow', 'melanomaClark'],
    'patch-test': ['patchTestResults'],
    'woods-lamp': ['woodsLampFindings'],
    'koh-test': ['kOHTest'],
    'suspected-diagnoses': ['suspectedDiagnosis'],
    'allergic-reactions': ['allergicReactions'],
    'topical-medications': ['topicalMedications'],
    'systemic-therapy': ['systemicTherapy'],
    'phototherapy': ['phototherapyRecommended'],
    'follow-up': ['followUpInterval'],
    'referral': ['referralSpecialty'],
  };

  // Reverse lookup: field -> sectionId
  const SECTION_FIELDS_REV = {};
  Object.entries(SECTION_FIELDS).forEach(([sid, fields]) => { fields.forEach(f => { SECTION_FIELDS_REV[f] = sid; }); });

  // SENTENCE_FIELDS — narrative text fields that use per-sentence editing
  const SENTENCE_FIELDS = ['chiefComplaint', 'abcdeAssessment', 'histopathologyResults', 'patchTestResults', 'woodsLampFindings'];
  // SIMPLE_STRING_FIELDS — short text fields that stay simple
  const SIMPLE_STRING_FIELDS = ['lesionMorphology', 'lesionSize', 'fitzpatrickSkinType', 'biopsyType', 'melanomaBreslow', 'melanomaClark', 'kOHTest', 'followUpInterval', 'referralSpecialty'];
  // ARRAY_FIELDS
  const ARRAY_FIELDS = ['skinLesionLocation', 'suspectedDiagnosis', 'allergicReactions', 'topicalMedications', 'systemicTherapy'];
  // BOOLEAN_FIELDS
  const BOOLEAN_FIELDS = ['biopsyPerformed', 'phototherapyRecommended'];
  // NUMBER_FIELDS
  const NUMBER_FIELDS = ['pasiScore', 'scoradIndex'];
  // SEMICOLON_SPLIT_FIELDS
  const SEMICOLON_SPLIT_FIELDS = ['lesionMorphology', 'followUpInterval'];
  // COMMA_SPLIT_FIELDS — list-like comma values, one row per finding
  const COMMA_SPLIT_FIELDS = ['dermatoscopeFindings'];

  // Highlight text — phrase matching
  const highlightText = useCallback((text) => {
    const textStr = String(text || '');
    if (!searchTerm.trim()) return textStr;
    const phrase = searchTerm.trim();
    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedPhrase})`, 'gi');
    const parts = textStr.split(regex);
    const phraseLower = phrase.toLowerCase();

    return parts.map((part, i) =>
      part.toLowerCase() === phraseLower ? <mark key={i}>{part}</mark> : part
    );
  }, [searchTerm]);

  // ========== LEVEL 1: Document Filtering ==========
  const filteredRecords = useMemo(() => {
    if (!records || records.length === 0) return [];
    if (!searchTerm.trim()) return records.map((r, idx) => ({ ...r, _originalIdx: idx, _showAllSections: true }));

    const searchLower = searchTerm.toLowerCase().trim();

    return records
      .map((record, idx) => {
        const recordTitle = `Dermatology Consultation ${idx + 1}`;
        const searchableText = [
          'Dermatology Consultation', 'Dermatology Consultations',
          recordTitle,
          // Section titles
          'Chief Complaint', 'Skin Lesion Locations', 'Lesion Morphology', 'Lesion Details',
          'ABCDE Assessment', 'Dermatoscope Findings', 'Biopsy Information', 'Histopathology Results',
          'PASI Score', 'SCORAD Index', 'Fitzpatrick Skin Type', 'Melanoma Staging', 'Patch Test Results',
          "Wood's Lamp Findings", 'KOH Test', 'Suspected Diagnoses', 'Allergic Reactions', 'Topical Medications',
          'Systemic Therapy', 'Phototherapy', 'Follow-Up Interval', 'Referral Specialty',
          // Field values
          record.chiefComplaint,
          Array.isArray(record.skinLesionLocation) ? record.skinLesionLocation.join(' ') : (record.skinLesionLocation || ''),
          record.lesionMorphology,
          record.lesionSize,
          record.abcdeAssessment,
          record.dermatoscopeFindings,
          record.biopsyPerformed !== undefined ? (record.biopsyPerformed ? 'Yes' : 'No') : '',
          record.biopsyType,
          record.histopathologyResults,
          record.pasiScore !== undefined ? String(record.pasiScore) : '',
          record.scoradIndex !== undefined ? String(record.scoradIndex) : '',
          record.fitzpatrickSkinType,
          record.melanomaBreslow,
          record.melanomaClark,
          record.patchTestResults,
          record.woodsLampFindings,
          record.kOHTest,
          Array.isArray(record.suspectedDiagnosis) ? record.suspectedDiagnosis.join(' ') : '',
          Array.isArray(record.allergicReactions) ? record.allergicReactions.join(' ') : '',
          Array.isArray(record.topicalMedications) ? record.topicalMedications.join(' ') : '',
          Array.isArray(record.systemicTherapy) ? record.systemicTherapy.join(' ') : '',
          record.phototherapyRecommended !== undefined ? (record.phototherapyRecommended ? 'Yes' : 'No') : '',
          record.followUpInterval,
          record.referralSpecialty,
        ].filter(Boolean).join(' ').toLowerCase();

        if (!searchableText.includes(searchLower)) return null;

        const titleLower = recordTitle.toLowerCase();
        const collectionLower = 'dermatology consultation';
        const _showAllSections = titleLower.startsWith(searchLower) || searchLower.startsWith(titleLower) ||
            collectionLower.startsWith(searchLower) || searchLower.startsWith(collectionLower);

        return { ...record, _originalIdx: idx, _showAllSections };
      })
      .filter(Boolean);
  }, [records, searchTerm]);

  // ========== LEVEL 2: Section Filtering ==========
  const shouldShowSection = useCallback((record, sectionTitle, ...sectionContent) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;

    const searchLower = searchTerm.toLowerCase().trim();

    if (sectionTitle) {
      const titleLower = sectionTitle.toLowerCase();
      if (titleLower.startsWith(searchLower) || searchLower.startsWith(titleLower)) return true;
    }

    const contentText = sectionContent.filter(Boolean).join(' ').toLowerCase();
    return contentText.includes(searchLower);
  }, [searchTerm]);

  // ========== LEVEL 4: Row Filtering ==========
  const shouldShowRow = useCallback((record, ...rowContent) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;

    const searchLower = searchTerm.toLowerCase().trim();
    const rowText = rowContent.filter(Boolean).map(String).join(' ').toLowerCase();
    return rowText.includes(searchLower);
  }, [searchTerm]);

  // ========== EDITING HANDLERS ==========

  const getRecordId = (record) => {
    const id = record._id?.$oid || record._id;
    if (!id) {
      console.error('Cannot save — no record _id');
      return null;
    }
    return String(id);
  };

  const getFieldValue = (record, fieldName, idx) => {
    const fullEditKey = `${fieldName}-${idx}`;
    if (localEdits[fullEditKey] !== undefined) return localEdits[fullEditKey];
    return record[fieldName];
  };

  const getEffectiveArray = (record, fieldName, idx) => {
    const localKey = `${fieldName}-${idx}`;
    if (localEdits[localKey] !== undefined) return localEdits[localKey];
    return Array.isArray(record[fieldName]) ? record[fieldName] : [];
  };

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, sentenceIdx, valueOverride) => {
    const recordId = getRecordId(record);
    if (!recordId) return;

    let saveValue = valueOverride !== undefined ? valueOverride : editValue.trim();
    const sKey = `${fieldName}-${idx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;

    // Field type validation
    if (NUMBER_FIELDS.includes(fieldName) && valueOverride === undefined) {
      if (isNaN(Number(saveValue))) {
        setSaveError('Please enter a valid number');
        return;
      }
      saveValue = Number(saveValue);
    }
    if (BOOLEAN_FIELDS.includes(fieldName) && valueOverride === undefined) {
      const lower = String(saveValue).toLowerCase();
      if (!['yes', 'no', 'true', 'false'].includes(lower)) {
        setSaveError('Please enter Yes or No');
        return;
      }
      saveValue = lower === 'yes' || lower === 'true';
    }

    setSaveError('');
    const fullEditKey = `${fieldName}-${idx}`;

    // Array fields → stage the full updated array as the draft value
    if (ARRAY_FIELDS.includes(fieldName) && typeof sentenceIdx === 'number') {
      const currentArr = getEffectiveArray(record, fieldName, idx);
      const updatedArr = [...currentArr];
      if (sentenceIdx < updatedArr.length) {
        updatedArr[sentenceIdx] = typeof saveValue === 'string' ? saveValue : String(saveValue);
      }
      saveValue = updatedArr;
      setEditedFields(prev => ({ ...prev, [`${fieldName}-${idx}-${sentenceIdx}`]: true }));
    } else {
      setEditedFields(prev => ({ ...prev, [fullEditKey]: true }));
    }

    setLocalEdits(prev => ({ ...prev, [fullEditKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [fullEditKey]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));

    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow
    setApprovedSections(prev => {
      const updated = { ...prev };
      delete updated[`${sectionId}-${idx}`];
      return updated;
    });

    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldName] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Reconstruct full text from sentences
  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  // Stage a full-text DRAFT for a field (no DB write). localStorage keeps it across refresh; Approve commits it.
  function stageDraft(recordId, fieldName, idx, fullValue) {
    const fullEditKey = `${fieldName}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [fullEditKey]: fullValue }));
    setPendingEdits(prev => ({ ...prev, [fullEditKey]: true }));
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldName] = fullValue;
    writeDrafts(store);
  }

  // Save sentence (per-sentence editing) — stages a DRAFT (no DB write).
  function saveSentence(record, fieldName, idx, sectionId, sIdx) {
    const recordId = getRecordId(record);
    if (!recordId) return;
    const currentVal = String(getFieldValue(record, fieldName, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    setSaveError('');
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sIdx, 1);
      const fullText = reconstructFullText(updated);
      stageDraft(recordId, fieldName, idx, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fieldName}-${idx}-s${sIdx}`]: 'edited' }));
      setApprovedSections(prev => { const u = { ...prev }; delete u[`${sectionId}-${idx}`]; return u; });
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    stageDraft(recordId, fieldName, idx, fullText);
    const orig = sentences[sIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fieldName}-${idx}-s${sIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fieldName}-${idx}-s${sIdx + 1 + ei}`] = 'added';
      return n;
    });
    setApprovedSections(prev => { const u = { ...prev }; delete u[`${sectionId}-${idx}`]; return u; });
    setEditingField(null); setEditValue('');
  }

  // Save semicolon item (per-item semicolon editing)
  function saveSemicolonItem(record, fieldName, idx, itemIdx, newText) {
    const recordId = getRecordId(record);
    if (!recordId) return;
    const currentVal = String(getFieldValue(record, fieldName, idx) || '');
    const items = splitBySemicolon(currentVal);
    items[itemIdx] = newText.trim();
    const fullText = items.join('; ');
    const itemKey = `${fieldName}-${idx}-sc${itemIdx}`;
    setSaveError('');
    stageDraft(recordId, fieldName, idx, fullText);
    setEditedSentences(prev => ({ ...prev, [itemKey]: 'edited' }));
    setApprovedSections(prev => { const u = { ...prev }; delete u[`${SECTION_FIELDS_REV[fieldName]}-${idx}`]; return u; });
    setEditingField(null); setEditValue('');
  }

  // Save comma item in sentence (per-item comma editing within a labeled sentence)
  function saveCommaItemInSentence(record, fieldName, idx, sIdx, commaIdx, newItemText) {
    const recordId = getRecordId(record);
    if (!recordId) return;
    const currentVal = String(getFieldValue(record, fieldName, idx) || '');
    const sentences = splitBySentence(currentVal);
    const sentence = sentences[sIdx] || '';
    const parsed = parseLabel(sentence);
    if (!parsed.isLabeled) return;
    const items = splitByComma(parsed.value);
    const trimmed = newItemText.trim();
    // Handle ". Test" pattern — split by ". " into new comma items within same label group
    const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s);
    if (subParts.length > 1) {
      items.splice(commaIdx, 1, ...subParts);
    } else {
      items[commaIdx] = trimmed.replace(/[;.]+$/, '').trim();
    }
    const rebuilt = `${parsed.label}: ${items.join(', ')}`;
    const allSentences = [...sentences];
    allSentences[sIdx] = rebuilt;
    const fullText = reconstructFullText(allSentences);
    const commaKey = `${fieldName}-${idx}-s${sIdx}-c${commaIdx}`;
    setSaveError('');
    stageDraft(recordId, fieldName, idx, fullText);
    const n = { [commaKey]: 'edited' };
    for (let ei = 1; ei < subParts.length; ei++) n[`${fieldName}-${idx}-s${sIdx}-c${commaIdx + ei}`] = 'added';
    setEditedSentences(prev => ({ ...prev, ...n }));
    setApprovedSections(prev => { const u = { ...prev }; delete u[`${SECTION_FIELDS_REV[fieldName]}-${idx}`]; return u; });
    setEditingField(null); setEditValue('');
  }

  // Save comma item in an UNLABELED sentence (>=3 guarded comma items → per-comma rows)
  function saveCommaItemInUnlabeledSentence(record, fieldName, idx, sIdx, commaIdx, newItemText) {
    const recordId = getRecordId(record);
    if (!recordId) return;
    const currentVal = String(getFieldValue(record, fieldName, idx) || '');
    const sentences = splitBySentence(currentVal);
    const sentence = (sentences[sIdx] || '').replace(/[;.]+$/, '').trim();
    const items = splitByComma(sentence);
    const trimmed = newItemText.trim().replace(/[;.]+$/, '').trim();
    if (trimmed) items[commaIdx] = trimmed; else items.splice(commaIdx, 1);
    const allSentences = [...sentences];
    allSentences[sIdx] = items.join(', ');
    const fullText = reconstructFullText(allSentences);
    const commaKey = `${fieldName}-${idx}-s${sIdx}-c${commaIdx}`;
    setSaveError('');
    stageDraft(recordId, fieldName, idx, fullText);
    setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' }));
    setApprovedSections(prev => { const u = { ...prev }; delete u[`${SECTION_FIELDS_REV[fieldName]}-${idx}`]; return u; });
    setEditingField(null); setEditValue('');
  }

  // Save array item (per-item array editing) — stages a DRAFT of the full updated array (no DB write).
  function saveArrayItem(record, fieldName, idx, arrayIdx, newText) {
    const recordId = getRecordId(record);
    if (!recordId) return;
    const arrKey = `${fieldName}-${idx}-a${arrayIdx}`;
    setSaveError('');
    const currentArr = [...getEffectiveArray(record, fieldName, idx)];
    currentArr[arrayIdx] = newText;
    stageDraft(recordId, fieldName, idx, currentArr);
    setEditedSentences(prev => ({ ...prev, [arrKey]: 'edited' }));
    setApprovedSections(prev => { const u = { ...prev }; delete u[`${SECTION_FIELDS_REV[fieldName]}-${idx}`]; return u; });
    setEditingField(null); setEditValue('');
  }

  // Save comma item in comma-split field (for dermatoscopeFindings)
  function saveCommaItem(record, fieldName, idx, commaIdx, newText) {
    const recordId = getRecordId(record);
    if (!recordId) return;
    const currentVal = String(getFieldValue(record, fieldName, idx) || '');
    const items = splitByComma(currentVal);
    const trimmed = newText.trim();
    // Handle ". Test" pattern — split by ". " into new comma items
    const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s);
    if (subParts.length > 1) {
      items.splice(commaIdx, 1, ...subParts);
    } else {
      items[commaIdx] = trimmed.replace(/[;.]+$/, '').trim();
    }
    const fullText = items.join(', ');
    const commaKey = `${fieldName}-${idx}-c${commaIdx}`;
    setSaveError('');
    stageDraft(recordId, fieldName, idx, fullText);
    const n = { [commaKey]: 'edited' };
    for (let ei = 1; ei < subParts.length; ei++) n[`${fieldName}-${idx}-c${commaIdx + ei}`] = 'added';
    setEditedSentences(prev => ({ ...prev, ...n }));
    setApprovedSections(prev => { const u = { ...prev }; delete u[`${SECTION_FIELDS_REV[fieldName]}-${idx}`]; return u; });
    setEditingField(null); setEditValue('');
  }

  const handleCancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue('');
    setSaveError('');
  }, []);

  // Approve = COMMIT all staged drafts for THIS section's fields to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sectionId, idx) => {
    const recordId = getRecordId(record);
    if (!recordId) return;

    const fields = SECTION_FIELDS[sectionId] || [];
    // Staged edits for this record + section: editKey = `${fieldName}-${idx}`, value = full field value
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k]) return false;
      const dashIdx = k.lastIndexOf('-');
      if (dashIdx === -1) return false;
      const f = k.substring(0, dashIdx);
      const eIdx = parseInt(k.substring(dashIdx + 1), 10);
      return eIdx === idx && fields.includes(f);
    });

    setApproving(true);
    try {
      // Persist each staged field to the DB now (full field value: string or array)
      for (const editKey of toCommit) {
        const dashIdx = editKey.lastIndexOf('-');
        const fieldName = editKey.substring(0, dashIdx);
        const resp = await secureApiClient.put(`/api/edit/dermatology_consultations/${recordId}/edit`, {
          field: fieldName,
          value: localEdits[editKey],
        });
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/dermatology_consultations/${recordId}/approve`, {
        sectionId,
        approved: true,
      });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this section's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[recordId]) {
        fields.forEach(f => { delete store[recordId][f]; });
        if (Object.keys(store[recordId]).length === 0) delete store[recordId];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
      // Clear all edit markers for this section's fields
      setEditedFields(prev => {
        const n = { ...prev };
        Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); });
        return n;
      });
      setEditedSentences(prev => {
        const n = { ...prev };
        Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); });
        return n;
      });
    } catch (error) {
      console.error('[DermatologyConsultations] Approve failed:', error);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // Check if section has edits — checks ALL edit key patterns: flat, -s, -sc, -c, -a
  const sectionHasEdits = useCallback((idx, sectionId) => {
    const fields = SECTION_FIELDS[sectionId] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // PASI Score visualization helpers
  const getPASISeverity = (pasi) => {
    if (pasi === null || pasi === undefined) return null;
    const val = typeof pasi === 'number' ? pasi : parseFloat(pasi);
    if (isNaN(val)) return null;
    if (val <= 5) return { label: 'Clear/Almost Clear', color: '#22c55e', percentage: Math.max(7, (val / 72) * 100) };
    if (val <= 10) return { label: 'Mild', color: '#3b82f6', percentage: (val / 72) * 100 };
    if (val <= 20) return { label: 'Moderate', color: '#f59e0b', percentage: (val / 72) * 100 };
    return { label: 'Severe', color: '#ef4444', percentage: (val / 72) * 100 };
  };

  // ========== COPY HELPERS ==========

  const copyFieldValue = useCallback((value, label, itemId) => {
    const text = label ? `${label}\n${value}` : String(value);
    navigator.clipboard.writeText(text);
    if (itemId) {
      setCopiedItems(prev => ({ ...prev, [itemId]: true }));
      setTimeout(() => setCopiedItems(prev => { const n = { ...prev }; delete n[itemId]; return n; }), 2000);
    }
  }, []);

  // Field labels for copy sub-labels (single-name rule hides a label equal to the section title)
  const FIELD_LABELS = {
    chiefComplaint: 'Chief Complaint',
    skinLesionLocation: 'Skin Lesion Locations',
    lesionMorphology: 'Lesion Morphology',
    lesionSize: 'Lesion Size',
    abcdeAssessment: 'ABCDE Assessment',
    dermatoscopeFindings: 'Dermatoscope Findings',
    biopsyPerformed: 'Biopsy Performed',
    biopsyType: 'Biopsy Type',
    histopathologyResults: 'Histopathology Results',
    pasiScore: 'PASI Score',
    scoradIndex: 'SCORAD Index',
    fitzpatrickSkinType: 'Fitzpatrick Skin Type',
    melanomaBreslow: 'Breslow Depth',
    melanomaClark: 'Clark Level',
    patchTestResults: 'Patch Test Results',
    woodsLampFindings: "Wood's Lamp Findings",
    kOHTest: 'KOH Test',
    suspectedDiagnosis: 'Suspected Diagnoses',
    allergicReactions: 'Allergic Reactions',
    topicalMedications: 'Topical Medications',
    systemicTherapy: 'Systemic Therapy',
    phototherapyRecommended: 'Phototherapy Recommended',
    followUpInterval: 'Follow-Up Interval',
    referralSpecialty: 'Referral Specialty',
  };

  // Canonical section copy: title + EQ; DASH under every field/item sub-label; every value
  // row numbered ("1." even singles); labeled groups restart numbering, unlabeled rows run on;
  // single-name label hidden; hide-zero numbers; empty values skipped.
  const buildSectionCopyText = useCallback((record, idx, sectionId) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return '';
    const title = SECTION_TITLES[sectionId] || sectionId;
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;

    fields.forEach(field => {
      const localKey = `${field}-${idx}`;
      const rawValue = localEdits[localKey] !== undefined ? localEdits[localKey] : record[field];
      if (!hasValue(rawValue)) return;
      const label = FIELD_LABELS[field] || field;
      const sameAsTitle = label.trim().toLowerCase() === title.trim().toLowerCase();
      const head = sameAsTitle ? '' : `${label}\n${COPY_LINE_DASH}\n`;

      if (NUMBER_FIELDS.includes(field)) {
        const n = parseFloat(rawValue);
        if (isNaN(n) || n === 0) return;
        text += `${head}1. ${n}\n\n`; return;
      }
      if (BOOLEAN_FIELDS.includes(field)) { text += `${head}1. ${rawValue ? 'Yes' : 'No'}\n\n`; return; }
      if (ARRAY_FIELDS.includes(field)) {
        const arr = getEffectiveArray(record, field, idx);
        if (arr.length === 0) return;
        text += head;
        arr.forEach((item, i) => { text += `${i + 1}. ${item}\n`; });
        text += '\n'; return;
      }
      if (SEMICOLON_SPLIT_FIELDS.includes(field)) {
        const items = splitBySemicolon(String(rawValue));
        if (items.length === 0) return;
        text += head;
        let running = 1;
        items.forEach(item => {
          const parsed = parseLabel(item);
          if (parsed.isLabeled) text += `${parsed.label}\n${COPY_LINE_DASH}\n1. ${parsed.value}\n`;
          else text += `${running++}. ${item}\n`;
        });
        text += '\n'; return;
      }
      if (COMMA_SPLIT_FIELDS.includes(field)) {
        const items = splitByComma(String(rawValue));
        if (items.length === 0) return;
        text += head;
        items.forEach((item, i) => { text += `${i + 1}. ${item}\n`; });
        text += '\n'; return;
      }
      if (SENTENCE_FIELDS.includes(field)) {
        const sentences = splitBySentence(String(rawValue));
        if (sentences.length === 0) return;
        text += head;
        let running = 1;
        sentences.forEach(sentence => {
          const parsed = parseLabel(sentence);
          const value = (parsed.isLabeled ? parsed.value : sentence).replace(/[;.]+$/, '').trim();
          if (!value) return;
          const items = splitByComma(value);
          if (parsed.isLabeled) {
            text += `${parsed.label}\n${COPY_LINE_DASH}\n`;
            if (items.length >= 3) items.forEach((it, i) => { text += `${i + 1}. ${it}\n`; });
            else text += `1. ${value}\n`;
          } else if (items.length >= 3) {
            items.forEach(it => { text += `${running++}. ${it}\n`; });
          } else {
            text += `${running++}. ${value}\n`;
          }
        });
        text += '\n'; return;
      }
      text += `${head}1. ${rawValue}\n\n`;
    });
    return text;
  }, [localEdits]);

  const copySection = useCallback((record, idx, sectionId) => {
    const text = buildSectionCopyText(record, idx, sectionId);
    navigator.clipboard.writeText(text);
    const copiedId = `${sectionId}-${idx}`;
    setCopiedSection(copiedId);
    setTimeout(() => setCopiedSection(null), 2000);
  }, [buildSectionCopyText]);

  // Copy all text — doc title + EQ, record titles + EQ, sections via the shared builder
  // with the >2-non-empty-line empty-section guard (title + divider alone don't count).
  const copyAllText = useCallback(() => {
    let text = `Dermatology Consultations\n${COPY_LINE_EQ}\n\n`;
    filteredRecords.forEach((record, idx) => {
      text += `Dermatology Consultation ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sectionId => {
        const st = buildSectionCopyText(record, idx, sectionId);
        if (st.split('\n').filter(l => l.trim()).length > 2) text += st;
      });
      text += '\n';
    });
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }, [filteredRecords, buildSectionCopyText]);

  // PDF data — merges localEdits into records for accurate PDF export
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((rec, recIdx) => {
      const merged = { ...rec };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldName = editKey.substring(0, dashIdx);
        const eIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (eIdx === recIdx) {
          merged[fieldName] = editVal;
        }
      }
      return merged;
    });
  }, [records, localEdits, pendingEdits]);

  // ========== RENDER HELPERS ==========

  // Pencil icon SVG
  const PencilIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );

  // Render editable field (simple fields) — uses flat editKey, getFieldValue for effective value.
  // Widgets by value shape: boolean → Yes/No select; known clinical scale → enum select;
  // number → −/+ stepper; measurement text → per-number segmented stepper; else textarea.
  // Single-name rule: label == section title (case-insensitive) → label hidden.
  const renderEditableField = (record, fieldName, idx, sectionId, label, value) => {
    const editKey = `${fieldName}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    const effectiveValue = getFieldValue(record, fieldName, idx) !== undefined ? getFieldValue(record, fieldName, idx) : value;

    const isBool = BOOLEAN_FIELDS.includes(fieldName);
    const isNum = NUMBER_FIELDS.includes(fieldName);
    const enumOpts = ENUM_FIELDS[fieldName];

    // hide-zero for number fields: parseFloat, skip 0/NaN
    if (isNum) {
      const n = parseFloat(effectiveValue);
      if (isNaN(n) || n === 0) return null;
    }

    // Field display
    const displayValue = isBool
      ? (effectiveValue ? 'Yes' : 'No')
      : (isNum
        ? String(parseFloat(effectiveValue))
        : (typeof effectiveValue === 'number' ? String(effectiveValue) : String(effectiveValue || '')));

    const sectionTitle = SECTION_TITLES[sectionId] || '';
    const showLabel = label && label.trim().toLowerCase() !== sectionTitle.trim().toLowerCase();
    const numParsed = MEASUREMENT_FIELDS.includes(fieldName) ? parseNumeric(displayValue) : null;

    return (
      <div className="rec-mini-card" key={fieldName}>
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''}`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(enumOpts ? enumCanonical(enumOpts, displayValue) : displayValue); setEditNums(numParsed ? { literals: numParsed.literals, nums: [...numParsed.nums] } : null); setSaveError(''); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              ) : enumOpts ? (
                <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') handleCancelEdit(); }}>
                  {enumOptionsWith(enumOpts, displayValue).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : isNum ? (
                <div className="num-stepper-row">
                  <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(-1); }}>&#8722;</button>
                  <input type="number" step="any" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') handleCancelEdit(); if (e.key === 'Enter') { e.preventDefault(); handleSaveField(record, fieldName, idx, sectionId, 0); } }} />
                  <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(1); }}>+</button>
                </div>
              ) : numParsed && editNums ? (
                <div className="number-edit-row">
                  {editNums.literals[0] ? <span className="number-edit-unit">{editNums.literals[0]}</span> : null}
                  {editNums.nums.map((n, ni) => (
                    <React.Fragment key={ni}>
                      <div className="num-seg">
                        <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepNum(ni, -1); }}>&#8722;</button>
                        <input type="number" step="any" className="edit-number" value={n} autoFocus={ni === 0} onChange={e => setNum(ni, e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { handleCancelEdit(); setEditNums(null); } }} />
                        <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepNum(ni, 1); }}>+</button>
                      </div>
                      {editNums.literals[ni + 1] ? <span className="number-edit-unit">{editNums.literals[ni + 1]}</span> : null}
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <textarea ref={textareaRef} className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') handleCancelEdit(); if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleSaveField(record, fieldName, idx, sectionId, 0); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (numParsed && editNums) { handleSaveField(record, fieldName, idx, sectionId, 0, rebuildNumeric(editNums.literals, editNums.nums)); setEditNums(null); } else { handleSaveField(record, fieldName, idx, sectionId, 0); } }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); handleCancelEdit(); setEditNums(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayValue)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn${copiedItems[editKey] ? ' copied' : ''}`} onClick={e => { e.stopPropagation(); copyFieldValue(displayValue, label, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  // Render sentence editable field with parseLabel + comma-split support
  const renderSentenceEditableField = (record, fieldName, idx, sectionId, label, value) => {
    const val = String(getFieldValue(record, fieldName, idx) || '');
    if (!val.trim()) return null;
    const sentences = splitBySentence(val);
    if (sentences.length === 0) return null;
    const canEdit = !!record._id;
    const showLabel = label ? true : false;
    const phraseMatch = !searchTerm.trim() || record._showAllSections;
    const labelMatch = searchTerm.trim() && label && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

    return (
      <div className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {sentences.map((sentence, sIdx) => {
          const sentenceKey = `${fieldName}-${idx}-s${sIdx}`;
          const isEditing = editingField === sentenceKey;
          const badge = editedSentences[sentenceKey];
          const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
          if (!sentenceMatches && searchTerm.trim()) return null;

          /* parseLabel for Label: value patterns */
          const parsed = parseLabel(sentence);
          if (parsed.isLabeled) {
            const textToSplit = parsed.value;
            const commaItems = splitByComma(textToSplit);
            if (commaItems.length >= 3) {
              /* parsedLabelMatch for search: show ALL comma items under this subtitle when label matches */
              const sublabelMatch = searchTerm.trim() && parsed.label.toLowerCase().includes(searchTerm.toLowerCase().trim());
              return (
                <div key={sIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                  <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                  {commaItems.map((ci, ciIdx) => {
                    const commaKey = `${sentenceKey}-c${ciIdx}`;
                    const ciEditing = editingField === commaKey;
                    const ciBadge = editedSentences[commaKey];
                    const ciMatches = phraseMatch || labelMatch || sublabelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
                    if (!ciMatches && searchTerm.trim()) return null;
                    return (
                      <div key={ciIdx}>
                        <div className={`numbered-row ${ciBadge ? 'modified' : ''}`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(''); } }}>
                          {ciEditing ? (
                            <div className="edit-field-container">
                              <textarea ref={textareaRef} className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') handleCancelEdit(); if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); saveCommaItemInSentence(record, fieldName, idx, sIdx, ciIdx, editValue); } }} />
                              {saveError && <div className="save-error">{saveError}</div>}
                              <div className="edit-actions">
                                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItemInSentence(record, fieldName, idx, sIdx, ciIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                                <button className="cancel-btn" onClick={e => { e.stopPropagation(); handleCancelEdit(); }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">✎</span></div>
                              <button className={`copy-btn${copiedItems[commaKey] ? ' copied' : ''}`} onClick={e => { e.stopPropagation(); copyFieldValue(ci, parsed.label, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
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

            /* Single-value labeled sentence: show nested-subtitle + value row. Edit shows only value. Save reconstructs "Label: value" */
            return (
              <div key={sIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                <div className={`numbered-row ${badge ? 'modified' : ''}`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.value); setSaveError(''); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea ref={textareaRef} className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') handleCancelEdit(); if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); /* Reconstruct "Label: value" and stage a DRAFT (no DB write) */ const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const allSentences = splitBySentence(String(getFieldValue(record, fieldName, idx) || '')); allSentences[sIdx] = reconstructed; const fullText = reconstructFullText(allSentences); const recordId = getRecordId(record); if (!recordId) return; setSaveError(''); stageDraft(recordId, fieldName, idx, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fieldName}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setApprovedSections(prev => { const u = { ...prev }; delete u[`${sectionId}-${idx}`]; return u; }); setEditingField(null); setEditValue(''); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const allSentences = splitBySentence(String(getFieldValue(record, fieldName, idx) || '')); allSentences[sIdx] = reconstructed; const fullText = reconstructFullText(allSentences); const recordId = getRecordId(record); if (!recordId) return; setSaveError(''); stageDraft(recordId, fieldName, idx, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fieldName}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setApprovedSections(prev => { const u = { ...prev }; delete u[`${sectionId}-${idx}`]; return u; }); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); handleCancelEdit(); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(parsed.value)}</span><span className="edit-indicator">✎</span></div>
                      <button className={`copy-btn${copiedItems[sentenceKey] ? ' copied' : ''}`} onClick={e => { e.stopPropagation(); copyFieldValue(sentence, label, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
              </div>
            );
          }

          /* Unlabeled sentence with >=3 guarded comma items → one editable row per item */
          const unlabeledItems = splitByComma(sentence.replace(/[;.]+$/, '').trim());
          if (unlabeledItems.length >= 3) {
            return (
              <div key={sIdx} className="rec-mini-card" style={{ marginTop: sIdx > 0 ? 8 : 0 }}>
                {unlabeledItems.map((ci, ciIdx) => {
                  const commaKey = `${sentenceKey}-c${ciIdx}`;
                  const ciEditing = editingField === commaKey;
                  const ciBadge = editedSentences[commaKey];
                  const ciMatches = phraseMatch || labelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
                  if (!ciMatches && searchTerm.trim()) return null;
                  return (
                    <div key={ciIdx}>
                      <div className={`numbered-row ${ciBadge ? 'modified' : ''}`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(''); } }}>
                        {ciEditing ? (
                          <div className="edit-field-container">
                            <textarea ref={textareaRef} className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') handleCancelEdit(); if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); saveCommaItemInUnlabeledSentence(record, fieldName, idx, sIdx, ciIdx, editValue); } }} />
                            {saveError && <div className="save-error">{saveError}</div>}
                            <div className="edit-actions">
                              <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItemInUnlabeledSentence(record, fieldName, idx, sIdx, ciIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                              <button className="cancel-btn" onClick={e => { e.stopPropagation(); handleCancelEdit(); }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">✎</span></div>
                            <button className={`copy-btn${copiedItems[commaKey] ? ' copied' : ''}`} onClick={e => { e.stopPropagation(); copyFieldValue(ci, label, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
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

          /* Regular sentence row (no label) */
          return (
            <div key={sIdx}>
              <div className={`numbered-row ${badge ? 'modified' : ''}`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(sentence.replace(/[;.]+$/, '').trim()); setSaveError(''); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea ref={textareaRef} className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') handleCancelEdit(); if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); saveSentence(record, fieldName, idx, sectionId, sIdx); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fieldName, idx, sectionId, sIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); handleCancelEdit(); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(sentence)}</span><span className="edit-indicator">✎</span></div>
                    <button className={`copy-btn${copiedItems[sentenceKey] ? ' copied' : ''}`} onClick={e => { e.stopPropagation(); copyFieldValue(sentence, label, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
            </div>
          );
        })}
      </div>
    );
  };

  // Render editable array section (per-item editing via saveArrayItem)
  const renderEditableArray = (record, fieldName, idx, sectionId, label) => {
    const items = getEffectiveArray(record, fieldName, idx);
    if (items.length === 0) return null;

    const canEdit = !!record._id;

    return (
      <div className="rec-mini-card">
        {items.map((item, itemIdx) => {
          const arrKey = `${fieldName}-${idx}-a${itemIdx}`;
          const isEditing = editingField === arrKey;
          const badge = editedSentences[arrKey];

          if (!shouldShowRow(record, item)) return null;

          return (
            <div key={itemIdx}>
              <div className={`numbered-row ${badge ? 'modified' : ''}`} onClick={() => { if (!isEditing) { setEditingField(arrKey); setEditValue(item); setSaveError(''); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea ref={textareaRef} className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') handleCancelEdit(); if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); saveArrayItem(record, fieldName, idx, itemIdx, editValue); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveArrayItem(record, fieldName, idx, itemIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); handleCancelEdit(); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(item)}</span><span className="edit-indicator">✎</span></div>
                    <button className={`copy-btn${copiedItems[arrKey] ? ' copied' : ''}`} onClick={e => { e.stopPropagation(); copyFieldValue(item, label, arrKey); }}>{copiedItems[arrKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  // Render semicolon-split field with per-item editing via saveSemicolonItem
  const renderSemicolonSplitField = (record, fieldName, idx, sectionId, label) => {
    const effectiveVal = String(getFieldValue(record, fieldName, idx) || '');
    if (!effectiveVal.trim()) return null;

    const items = splitBySemicolon(effectiveVal);
    if (items.length === 0) return null;

    const canEdit = !!record._id;
    const phraseMatch = !searchTerm.trim() || record._showAllSections;
    const labelMatch = searchTerm.trim() && label && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

    return (
      <div className="rec-mini-card">
        {items.map((item, itemIdx) => {
          const itemKey = `${fieldName}-${idx}-sc${itemIdx}`;
          const isEditing = editingField === itemKey;
          const badge = editedSentences[itemKey];
          const parsed = parseLabel(item);
          const itemMatches = phraseMatch || labelMatch || !searchTerm.trim() || item.toLowerCase().includes(searchTerm.toLowerCase().trim());
          if (!itemMatches && searchTerm.trim()) return null;

          return (
            <div key={itemIdx}>
              {parsed.isLabeled && <div className="nested-subtitle sub-label">{highlightText(parsed.label)}</div>}
              <div className={`numbered-row ${badge ? 'modified' : ''}`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(parsed.isLabeled ? parsed.value : item); setSaveError(''); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea ref={textareaRef} className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') handleCancelEdit(); if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); const saveText = parsed.isLabeled ? `${parsed.label}: ${editValue.trim()}` : editValue.trim(); saveSemicolonItem(record, fieldName, idx, itemIdx, saveText); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const saveText = parsed.isLabeled ? `${parsed.label}: ${editValue.trim()}` : editValue.trim(); saveSemicolonItem(record, fieldName, idx, itemIdx, saveText); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); handleCancelEdit(); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : item)}</span><span className="edit-indicator">✎</span></div>
                    <button className={`copy-btn${copiedItems[itemKey] ? ' copied' : ''}`} onClick={e => { e.stopPropagation(); copyFieldValue(parsed.isLabeled ? `${parsed.label}: ${parsed.value}` : item, label, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  // Render comma-split field with per-item editing via saveCommaItem
  const renderCommaSplitField = (record, fieldName, idx, sectionId, label) => {
    const effectiveVal = String(getFieldValue(record, fieldName, idx) || '');
    if (!effectiveVal.trim()) return null;

    const items = splitByComma(effectiveVal);
    if (items.length === 0) return null;

    const canEdit = !!record._id;
    const phraseMatch = !searchTerm.trim() || record._showAllSections;
    const labelMatch = searchTerm.trim() && label && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

    return (
      <div className="rec-mini-card">
        {items.map((item, itemIdx) => {
          const commaKey = `${fieldName}-${idx}-c${itemIdx}`;
          const isEditing = editingField === commaKey;
          const badge = editedSentences[commaKey];
          const itemMatches = phraseMatch || labelMatch || !searchTerm.trim() || item.toLowerCase().includes(searchTerm.toLowerCase().trim());
          if (!itemMatches && searchTerm.trim()) return null;

          return (
            <div key={itemIdx}>
              <div className={`numbered-row ${badge ? 'modified' : ''}`} onClick={() => { if (!isEditing) { setEditingField(commaKey); setEditValue(item); setSaveError(''); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea ref={textareaRef} className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') handleCancelEdit(); if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); saveCommaItem(record, fieldName, idx, itemIdx, editValue); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItem(record, fieldName, idx, itemIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); handleCancelEdit(); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(item)}</span><span className="edit-indicator">✎</span></div>
                    <button className={`copy-btn${copiedItems[commaKey] ? ' copied' : ''}`} onClick={e => { e.stopPropagation(); copyFieldValue(item, label, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
            </div>
          );
        })}
      </div>
    );
  };

  // Render approve button
  const renderApproveBtn = useCallback((record, idx, sectionId) => {
    const hasEdits = sectionHasEdits(idx, sectionId);
    const isApproved = approvedSections[`${sectionId}-${idx}`];

    if (hasEdits) return (
      <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(record, sectionId, idx); }} disabled={approving}>
        {approving ? 'Approving...' : 'Pending Approve'}
      </button>
    );
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection, approving]);

  // Render a generic section wrapper
  const renderSection = (record, idx, sectionId, sectionTitle, contentFn, ...searchContent) => {
    if (!shouldShowSection(record, sectionTitle, ...searchContent.filter(Boolean))) return null;

    return (
      <div className="section" key={sectionId}>
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(sectionTitle)}</h4>
            <div className="header-right-actions">
              <button
                className={`copy-btn${copiedSection === `${sectionId}-${idx}` ? ' copied' : ''}`}
                onClick={() => copySection(record, idx, sectionId)}
              >
                {copiedSection === `${sectionId}-${idx}` ? 'Copied!' : 'Copy Section'}
              </button>
              {renderApproveBtn(record, idx, sectionId)}
            </div>
          </div>
          {contentFn()}
        </div>
      </div>
    );
  };

  // ========== MAIN RENDER ==========

  if (!filteredRecords || filteredRecords.length === 0) {
    return (
      <div className="dermatology-consultations-document" ref={containerRef}>
        <div className="document-header">
          <h2 className="document-title">Dermatology Consultations</h2>
          <div className="document-actions">
            <button className={`copy-all-button${copiedAll ? ' copied' : ''}`} onClick={copyAllText}>
              {copiedAll ? 'Copied!' : 'Copy All'}
            </button>
            <PDFDownloadLink
              document={<DermatologyConsultationsDocumentPDFTemplate document={pdfData} />}
              fileName="Dermatology_Consultations.pdf"
              className="export-pdf-button"
            >
              {({ loading }) => (loading ? 'Preparing PDF...' : 'Export PDF')}
            </PDFDownloadLink>
          </div>
        </div>
        <div className="no-data">No dermatology consultation records found</div>
      </div>
    );
  }

  return (
    <div className="dermatology-consultations-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Dermatology Consultations</h2>
        <div className="document-actions">
          <button className={`copy-all-button${copiedAll ? ' copied' : ''}`} onClick={copyAllText}>
            {copiedAll ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<DermatologyConsultationsDocumentPDFTemplate document={pdfData} />}
            fileName="Dermatology_Consultations.pdf"
            className="export-pdf-button"
          >
            {({ loading }) => (loading ? 'Preparing PDF...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>
      </div>

      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />

      {filteredRecords.map((record, idx) => {
        const recordId = record._id?.$oid || record._id;
        const originalIdx = record._originalIdx !== undefined ? record._originalIdx : idx;
        const effectivePasiScore = getFieldValue(record, 'pasiScore', idx);
        const pasiSeverity = getPASISeverity(effectivePasiScore);

        return (
          <div key={recordId || idx} className="record-container">
            {/* Record Header */}
            <div className="record-header">
              <div className="header-top-row">
                {record.date && <span className="date-badge">{highlightText(formatDate(record.date))}</span>}
              </div>
              <h3 className="record-title">
                {highlightText(`Dermatology Consultation ${originalIdx + 1}`)}
              </h3>
            </div>

            {/* Chief Complaint */}
            {hasValue(record.chiefComplaint) && renderSection(
              record, idx, 'chief-complaint', 'Chief Complaint',
              () => renderSentenceEditableField(record, 'chiefComplaint', idx, 'chief-complaint', null, record.chiefComplaint),
              record.chiefComplaint
            )}

            {/* Skin Lesion Locations - Array */}
            {hasValue(record.skinLesionLocation) && renderSection(
              record, idx, 'skin-lesion-locations', 'Skin Lesion Locations',
              () => renderEditableArray(record, 'skinLesionLocation', idx, 'skin-lesion-locations', 'Skin Lesion Location'),
              ...(Array.isArray(record.skinLesionLocation) ? record.skinLesionLocation : [record.skinLesionLocation])
            )}

            {/* Lesion Morphology - Semicolon split */}
            {hasValue(record.lesionMorphology) && renderSection(
              record, idx, 'lesion-morphology', 'Lesion Morphology',
              () => renderSemicolonSplitField(record, 'lesionMorphology', idx, 'lesion-morphology', 'Lesion Morphology'),
              record.lesionMorphology
            )}

            {/* Lesion Details */}
            {hasValue(record.lesionSize) && renderSection(
              record, idx, 'lesion-details', 'Lesion Details',
              () => renderEditableField(record, 'lesionSize', idx, 'lesion-details', 'Lesion Size', record.lesionSize),
              record.lesionSize
            )}

            {/* ABCDE Assessment - Per-sentence (handles label:value + comma-split internally) */}
            {hasValue(record.abcdeAssessment) && renderSection(
              record, idx, 'abcde-assessment', 'ABCDE Assessment',
              () => renderSentenceEditableField(record, 'abcdeAssessment', idx, 'abcde-assessment', null, record.abcdeAssessment),
              record.abcdeAssessment
            )}

            {/* Dermatoscope Findings - comma list, one row per finding */}
            {hasValue(record.dermatoscopeFindings) && renderSection(
              record, idx, 'dermatoscope-findings', 'Dermatoscope Findings',
              () => renderCommaSplitField(record, 'dermatoscopeFindings', idx, 'dermatoscope-findings', 'Dermatoscope Findings'),
              record.dermatoscopeFindings
            )}

            {/* Biopsy Information */}
            {(hasValue(record.biopsyPerformed) || hasValue(record.biopsyType)) && renderSection(
              record, idx, 'biopsy-info', 'Biopsy Information',
              () => (
                <>
                  {hasValue(record.biopsyPerformed) && renderEditableField(record, 'biopsyPerformed', idx, 'biopsy-info', 'Biopsy Performed', record.biopsyPerformed)}
                  {hasValue(record.biopsyType) && renderEditableField(record, 'biopsyType', idx, 'biopsy-info', 'Biopsy Type', record.biopsyType)}
                </>
              ),
              record.biopsyPerformed !== undefined ? (record.biopsyPerformed ? 'Yes' : 'No') : '',
              record.biopsyType
            )}

            {/* Histopathology Results */}
            {hasValue(record.histopathologyResults) && renderSection(
              record, idx, 'histopathology', 'Histopathology Results',
              () => renderSentenceEditableField(record, 'histopathologyResults', idx, 'histopathology', null, record.histopathologyResults),
              record.histopathologyResults
            )}

            {/* PASI Score - Bar Chart + editable number */}
            {hasValue(record.pasiScore) && parseFloat(record.pasiScore) !== 0 && renderSection(
              record, idx, 'pasi-score', 'PASI Score',
              () => (
                <>
                  {pasiSeverity && (
                    <div className="chart-section">
                      <div className="chart-legend">
                        <div className="legend-item"><span className="legend-color" style={{ backgroundColor: '#22c55e' }}></span><span className="legend-text">Clear/Mild</span></div>
                        <div className="legend-item"><span className="legend-color" style={{ backgroundColor: '#f59e0b' }}></span><span className="legend-text">Moderate</span></div>
                        <div className="legend-item"><span className="legend-color" style={{ backgroundColor: '#ef4444' }}></span><span className="legend-text">Severe</span></div>
                      </div>
                      <div className="bar-chart-row">
                        <div className="bar-label">{highlightText('PASI (Psoriasis Area Severity Index)')}</div>
                        <div className="bar-category-value" style={{ color: pasiSeverity.color }}>
                          {highlightText(String(typeof effectivePasiScore === 'number' ? effectivePasiScore : record.pasiScore))}
                        </div>
                        <div className="bar-container">
                          <div className="bar-background">
                            <div className="bar-fill" style={{ width: `${pasiSeverity.percentage}%`, backgroundColor: pasiSeverity.color }} />
                          </div>
                        </div>
                        <div className="bar-interpretation" style={{ color: pasiSeverity.color }}>{highlightText(pasiSeverity.label)}</div>
                      </div>
                    </div>
                  )}
                  {renderEditableField(record, 'pasiScore', idx, 'pasi-score', 'PASI Score', record.pasiScore)}
                </>
              ),
              String(record.pasiScore)
            )}

            {/* SCORAD Index - editable number */}
            {hasValue(record.scoradIndex) && record.scoradIndex !== 0 && renderSection(
              record, idx, 'scorad-index', 'SCORAD Index',
              () => renderEditableField(record, 'scoradIndex', idx, 'scorad-index', 'SCORAD Index', record.scoradIndex),
              String(record.scoradIndex)
            )}

            {/* Fitzpatrick Skin Type */}
            {hasValue(record.fitzpatrickSkinType) && renderSection(
              record, idx, 'fitzpatrick-skin-type', 'Fitzpatrick Skin Type',
              () => renderEditableField(record, 'fitzpatrickSkinType', idx, 'fitzpatrick-skin-type', 'Fitzpatrick Skin Type', record.fitzpatrickSkinType),
              record.fitzpatrickSkinType
            )}

            {/* Melanoma Staging */}
            {(hasValue(record.melanomaBreslow) || hasValue(record.melanomaClark)) && renderSection(
              record, idx, 'melanoma-staging', 'Melanoma Staging',
              () => (
                <>
                  {hasValue(record.melanomaBreslow) && renderEditableField(record, 'melanomaBreslow', idx, 'melanoma-staging', 'Breslow Depth', record.melanomaBreslow)}
                  {hasValue(record.melanomaClark) && renderEditableField(record, 'melanomaClark', idx, 'melanoma-staging', 'Clark Level', record.melanomaClark)}
                </>
              ),
              record.melanomaBreslow,
              record.melanomaClark
            )}

            {/* Patch Test Results - Per-sentence */}
            {hasValue(record.patchTestResults) && renderSection(
              record, idx, 'patch-test', 'Patch Test Results',
              () => renderSentenceEditableField(record, 'patchTestResults', idx, 'patch-test', null, record.patchTestResults),
              record.patchTestResults
            )}

            {/* Wood's Lamp Findings - Per-sentence */}
            {hasValue(record.woodsLampFindings) && renderSection(
              record, idx, 'woods-lamp', "Wood's Lamp Findings",
              () => renderSentenceEditableField(record, 'woodsLampFindings', idx, 'woods-lamp', null, record.woodsLampFindings),
              record.woodsLampFindings
            )}

            {/* KOH Test */}
            {hasValue(record.kOHTest) && renderSection(
              record, idx, 'koh-test', 'KOH Test',
              () => renderEditableField(record, 'kOHTest', idx, 'koh-test', 'KOH Test', record.kOHTest),
              record.kOHTest
            )}

            {/* Suspected Diagnoses - Array */}
            {hasValue(record.suspectedDiagnosis) && renderSection(
              record, idx, 'suspected-diagnoses', 'Suspected Diagnoses',
              () => renderEditableArray(record, 'suspectedDiagnosis', idx, 'suspected-diagnoses', 'Suspected Diagnosis'),
              ...(Array.isArray(record.suspectedDiagnosis) ? record.suspectedDiagnosis : [])
            )}

            {/* Allergic Reactions - Array */}
            {hasValue(record.allergicReactions) && renderSection(
              record, idx, 'allergic-reactions', 'Allergic Reactions',
              () => renderEditableArray(record, 'allergicReactions', idx, 'allergic-reactions', 'Allergic Reaction'),
              ...(Array.isArray(record.allergicReactions) ? record.allergicReactions : [])
            )}

            {/* Topical Medications - Array */}
            {hasValue(record.topicalMedications) && renderSection(
              record, idx, 'topical-medications', 'Topical Medications',
              () => renderEditableArray(record, 'topicalMedications', idx, 'topical-medications', 'Topical Medication'),
              ...(Array.isArray(record.topicalMedications) ? record.topicalMedications : [])
            )}

            {/* Systemic Therapy - Array */}
            {hasValue(record.systemicTherapy) && renderSection(
              record, idx, 'systemic-therapy', 'Systemic Therapy',
              () => renderEditableArray(record, 'systemicTherapy', idx, 'systemic-therapy', 'Systemic Therapy'),
              ...(Array.isArray(record.systemicTherapy) ? record.systemicTherapy : [])
            )}

            {/* Phototherapy */}
            {hasValue(record.phototherapyRecommended) && renderSection(
              record, idx, 'phototherapy', 'Phototherapy',
              () => renderEditableField(record, 'phototherapyRecommended', idx, 'phototherapy', 'Phototherapy Recommended', record.phototherapyRecommended),
              record.phototherapyRecommended ? 'Yes' : 'No'
            )}

            {/* Follow-Up Interval - Semicolon split */}
            {hasValue(record.followUpInterval) && renderSection(
              record, idx, 'follow-up', 'Follow-Up Interval',
              () => renderSemicolonSplitField(record, 'followUpInterval', idx, 'follow-up', 'Follow-Up'),
              record.followUpInterval
            )}

            {/* Referral Specialty */}
            {hasValue(record.referralSpecialty) && renderSection(
              record, idx, 'referral', 'Referral Specialty',
              () => renderSentenceEditableField(record, 'referralSpecialty', idx, 'referral', null, record.referralSpecialty),
              record.referralSpecialty
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DermatologyConsultationsDocument;
