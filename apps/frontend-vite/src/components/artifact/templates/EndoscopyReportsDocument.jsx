/**
 * EndoscopyReportsDocument.jsx
 * Blue Glow Theme + Inline Editing (March 2026)
 *
 * 4-level search hierarchy:
 * Level 1: Document (record) with _originalIdx + title search + _showAllSections
 * Level 2: Section (section title) with startsWith bidirectional
 * Level 4: Row/Field (individual fields) with phrase matching
 *
 * Inline editing:
 * - Per-sentence editing for text fields (barrettEsophagus, mucosal, helicobacterPyloriTesting, followUpRecommendations)
 * - Simple field editing for scalar fields
 * - Array item editing for string arrays (biopsyLocations, polypsDetected, etc.)
 * - Pending Approve (yellow) → Approved (green) badge
 * - Blue copy animations
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import secureApiClient from '../../../services/secureApiClient';
import EndoscopyReportsDocumentPDFTemplate from '../pdf-templates/EndoscopyReportsDocumentPDFTemplate';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import BlueSelect from '../components/BlueSelect';
import './EndoscopyReportsDocument.css';

const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

const SECTION_TITLES = {
  'procedure-overview': 'Procedure Overview',
  'preparation-quality': 'Preparation & Quality',
  'findings': 'Findings',
  'biopsy-testing': 'Biopsy & Testing',
  'polyps-interventions': 'Polyps & Interventions',
  'complications': 'Complications',
  'photodocumentation': 'Photodocumentation',
  'followup': 'Follow-Up Recommendations',
};

// "Label: value" → { isLabeled, label, value } (labels may carry periods e.g. "H. pylori stool antigen")
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

// Paren-aware comma split with Oxford (and/or) + numeric (50,000) guards
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const nextCh = text[i + 1] || '';
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (/\d/.test(nextCh) || /^(and|or)\b/i.test(rest)) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

// decimal-aware step for the −/+ number stepper
const stepFor = (v) => {
  const s = String(v ?? ''); const dot = s.indexOf('.');
  if (dot === -1) return '1';
  const decimals = s.length - dot - 1;
  return decimals <= 0 ? '1' : (1 / Math.pow(10, decimals)).toFixed(decimals);
};

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = field name; value may be a string or array) */
const DRAFT_KEY = 'endoscopy_reportsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const PROCEDURE_FIELDS = [
  { key: 'procedureType', label: 'Procedure Type' },
  { key: 'indicationForProcedure', label: 'Indication' },
  { key: 'sedationType', label: 'Sedation Type' },
  { key: 'endoscopeType', label: 'Endoscope Type' },
  { key: 'completenessOfExamination', label: 'Completeness of Examination' },
  { key: 'procedureDuration', label: 'Procedure Duration' },
];

const QUALITY_FIELDS = [
  { key: 'bowelPreparation', label: 'Bowel Preparation' },
  { key: 'cecalIntubationAchieved', label: 'Cecal Intubation Achieved' },
  { key: 'withdrawalTime', label: 'Withdrawal Time' },
  { key: 'retroflexionPerformed', label: 'Retroflexion Performed' },
  { key: 'adenomaDetectionRate', label: 'Adenoma Detection Rate' },
];

const FINDINGS_SCALAR_FIELDS = [
  { key: 'esophagitis', label: 'Esophagitis' },
  { key: 'barrettEsophagus', label: 'Barrett Esophagus' },
  { key: 'varicesGrade', label: 'Varices Grade' },
  { key: 'mucosal', label: 'Mucosal Assessment' },
];

const ALL_FIELD_DEFS = [
  ...PROCEDURE_FIELDS,
  ...QUALITY_FIELDS,
  ...FINDINGS_SCALAR_FIELDS,
  { key: 'anatomicalLandmarks', label: 'Anatomical Landmarks' },
  { key: 'biopsyLocations', label: 'Biopsy Locations' },
  { key: 'helicobacterPyloriTesting', label: 'Helicobacter Pylori Testing' },
  { key: 'polypectomyPerformed', label: 'Polypectomy Performed' },
  { key: 'polypsDetected', label: 'Polyps Detected' },
  { key: 'therapeuticInterventions', label: 'Therapeutic Interventions' },
  { key: 'complications', label: 'Complications' },
  { key: 'photodocumentation', label: 'Photodocumentation' },
  { key: 'followUpRecommendations', label: 'Follow-Up Recommendations' },
];

// Field typing classifications
const BOOLEAN_FIELDS = ['cecalIntubationAchieved', 'polypectomyPerformed', 'retroflexionPerformed'];
const NUMBER_FIELDS = ['withdrawalTime', 'procedureDuration', 'adenomaDetectionRate'];

const SECTION_FIELDS = {
  'procedure-overview': ['procedureType', 'indicationForProcedure', 'sedationType', 'endoscopeType', 'completenessOfExamination', 'procedureDuration'],
  'preparation-quality': ['bowelPreparation', 'cecalIntubationAchieved', 'withdrawalTime', 'retroflexionPerformed', 'adenomaDetectionRate'],
  'findings': ['esophagitis', 'barrettEsophagus', 'varicesGrade', 'mucosal', 'anatomicalLandmarks'],
  'biopsy-testing': ['biopsyLocations', 'helicobacterPyloriTesting'],
  'polyps-interventions': ['polypectomyPerformed', 'polypsDetected', 'therapeuticInterventions'],
  'complications': ['complications'],
  'photodocumentation': ['photodocumentation'],
  'followup': ['followUpRecommendations'],
};

const SENTENCE_FIELDS = ['indicationForProcedure', 'helicobacterPyloriTesting', 'followUpRecommendations', 'barrettEsophagus', 'mucosal'];
const ARRAY_FIELDS = ['biopsyLocations', 'polypsDetected', 'therapeuticInterventions', 'complications', 'anatomicalLandmarks', 'photodocumentation'];

const EndoscopyReportsDocument = ({ document: docProp, data, templateData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [copiedAll, setCopiedAll] = useState(false);
  const containerRef = useRef(null);

  // Editing state — per-template isolation (NO shared hooks)
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [statusOverrides, setStatusOverrides] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const textareaRef = useRef(null);

  // ========== UTILITY FUNCTIONS ==========

  const formatDate = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return String(dateVal);
    }
  };

  const formatDisplay = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (typeof val === 'number') return String(val);
    return String(val);
  };

  const isFieldPresent = (val) => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string' && val.trim() === '') return false;
    if (typeof val === 'number' && val === 0) return false;
    if (Array.isArray(val)) return val.filter(Boolean).length > 0;
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
        if (ch === '.' && (/\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc)$/.test(current) || /(?:^|\s)[A-Z]$/.test(current))) {
          // abbreviation (Dr., St.) or single-letter genus (H. pylori, E. coli) → do not split
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

  // ========== DATA UNWRAPPING ==========

  const records = useMemo(() => {
    const raw = templateData || docProp || data;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (raw?.endoscopy_reports) return Array.isArray(raw.endoscopy_reports) ? raw.endoscopy_reports : [raw.endoscopy_reports];
    if (raw?.documentData) {
      const docData = raw.documentData;
      if (Array.isArray(docData)) return docData;
      if (docData?.endoscopy_reports) return Array.isArray(docData.endoscopy_reports) ? docData.endoscopy_reports : [docData.endoscopy_reports];
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

  // ========== SEARCH HELPERS ==========

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

  const shouldShowRow = useCallback((record, ...rowContent) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;
    const searchLower = searchTerm.toLowerCase().trim();
    const rowText = rowContent.filter(Boolean).map(String).join(' ').toLowerCase();
    return rowText.includes(searchLower);
  }, [searchTerm]);

  // ========== LEVEL 1: Document Filtering ==========

  const filteredRecords = useMemo(() => {
    if (!records || records.length === 0) return [];
    if (!searchTerm.trim()) return records.map((r, idx) => ({ ...r, _originalIdx: idx, _showAllSections: true }));

    const searchLower = searchTerm.toLowerCase().trim();

    return records
      .map((record, idx) => {
        const recordTitle = `Endoscopy Report Record ${idx + 1}`;
        const biopsyItems = Array.isArray(record.biopsyLocations) ? record.biopsyLocations.filter(Boolean) : [];
        const polypsItems = Array.isArray(record.polypsDetected) ? record.polypsDetected.filter(Boolean) : [];
        const interventionItems = Array.isArray(record.therapeuticInterventions) ? record.therapeuticInterventions.filter(Boolean) : [];
        const complicationsItems = Array.isArray(record.complications) ? record.complications.filter(Boolean) : [];
        const landmarkItems = Array.isArray(record.anatomicalLandmarks) ? record.anatomicalLandmarks.filter(Boolean) : [];
        const photoItems = Array.isArray(record.photodocumentation) ? record.photodocumentation.filter(Boolean) : [];

        const searchableText = [
          'Endoscopy Reports',
          recordTitle,
          'Provider Details', 'Procedure Overview', 'Preparation & Quality',
          'Findings', 'Biopsy & Testing', 'Polyps & Interventions',
          'Complications', 'Photodocumentation', 'Follow-Up Recommendations',
          record.createdAt ? `Date: ${formatDate(record.createdAt)}` : null,
          ...PROCEDURE_FIELDS.map(f => record[f.key] ? `${f.label}: ${formatDisplay(record[f.key])}` : null),
          ...QUALITY_FIELDS.map(f => isFieldPresent(record[f.key]) ? `${f.label}: ${formatDisplay(record[f.key])}` : null),
          ...FINDINGS_SCALAR_FIELDS.map(f => record[f.key] ? `${f.label}: ${record[f.key]}` : null),
          ...landmarkItems.map(item => `Anatomical Landmarks: ${item}`),
          ...biopsyItems.map(item => `Biopsy Locations: ${item}`),
          record.helicobacterPyloriTesting ? `Helicobacter Pylori Testing: ${record.helicobacterPyloriTesting}` : null,
          record.polypectomyPerformed !== undefined ? `Polypectomy Performed: ${formatDisplay(record.polypectomyPerformed)}` : null,
          ...polypsItems.map(item => `Polyps Detected: ${item}`),
          ...interventionItems.map(item => `Therapeutic Interventions: ${item}`),
          ...complicationsItems.map(item => `Complications: ${item}`),
          ...photoItems.map(item => `Photodocumentation: ${item}`),
          record.followUpRecommendations ? `Follow-Up Recommendations: ${record.followUpRecommendations}` : null,
        ].filter(Boolean).join(' ').toLowerCase();

        if (!searchableText.includes(searchLower)) return null;

        const titleLower = recordTitle.toLowerCase();
        const collectionLower = 'endoscopy reports';
        const _showAllSections = titleLower.startsWith(searchLower) || searchLower.startsWith(titleLower) ||
            collectionLower.startsWith(searchLower) || searchLower.startsWith(collectionLower);

        return { ...record, _originalIdx: idx, _showAllSections };
      })
      .filter(Boolean);
  }, [records, searchTerm]);

  // ========== EDITING HANDLERS ==========

  const getRecordId = (record) => {
    const id = record._id?.$oid || record._id;
    if (!id) { console.error('Cannot save — no record _id'); return null; }
    return String(id);
  };

  const handleStartEdit = useCallback((fieldName, idx, currentValue, sentenceIdx = 0) => {
    const editKey = `${fieldName}-${idx}-s${sentenceIdx}`;
    setEditingField(editKey);
    const cleanValue = (currentValue || '').replace(/[.;]+$/, '').trim();
    setEditValue(cleanValue);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApprove commits).
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, sentenceIdx, valueOverride) => {
    const recordId = getRecordId(record);
    if (!recordId) return;

    let saveValue = valueOverride !== undefined ? valueOverride : editValue.trim();
    const sKey = `${fieldName}-${idx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;
    const localKey = `${fieldName}-${idx}`;
    let stagedValue;

    // Array fields: reconstruct the full array with the edited item
    if (ARRAY_FIELDS.includes(fieldName) && valueOverride === undefined) {
      const currentArray = localEdits[localKey] !== undefined
        ? [...localEdits[localKey]]
        : (Array.isArray(record[fieldName]) ? [...record[fieldName]] : []);
      const arrayIdx = sentenceIdx !== undefined ? sentenceIdx : 0;
      currentArray[arrayIdx] = saveValue;
      stagedValue = currentArray;
      setLocalEdits(prev => ({ ...prev, [localKey]: currentArray }));
      setEditedFields(prev => ({ ...prev, [`${fieldName}-${idx}-${arrayIdx}`]: true }));
      setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    } else {
      // Regular text/simple fields (including sentence field full text via valueOverride)
      stagedValue = saveValue;
      setLocalEdits(prev => ({ ...prev, [localKey]: saveValue }));
      setEditedFields(prev => ({ ...prev, [localKey]: true }));
      setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    }

    // Mark this editKey as a pending (uncommitted) draft, and re-edit-after-approve → drop the
    // section's 'approved' flag so the button goes back to yellow Pending Approve.
    setPendingEdits(prev => ({ ...prev, [localKey]: true }));
    setApprovedSections(prev => {
      const updated = { ...prev };
      delete updated[`${sectionId}-${idx}`];
      return updated;
    });

    // Persist the staged DRAFT to localStorage (survives refresh; NOT written to DB until Approve).
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldName] = stagedValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue, localEdits]);

  const handleCancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue('');
  }, []);

  // Approve = COMMIT all staged drafts for this record to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  // `sectionId` here is the full section id (`${sectionId}-${idx}`) passed by renderApproveBtn.
  const handleApprove = useCallback(async (record, idx, sectionId) => {
    const recordId = getRecordId(record);
    if (!recordId) return;

    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now (field, or field+arrayIndex for dotted numeric keys)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayIndex = lastDot !== -1 && /^\d+$/.test(tail);
        const payload = { field: isArrayIndex ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArrayIndex) payload.arrayIndex = parseInt(tail, 10);
        const resp = await secureApiClient.put(`/api/edit/endoscopy_reports/${recordId}/edit`, payload);
        if (!resp || !resp.success) throw new Error((resp && resp.error) || 'save failed');
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/endoscopy_reports/${recordId}/approve`, {
        sectionId,
        approved: true,
      });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[recordId]) { delete store[recordId]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [sectionId]: true }));
      setEditedSentences(prev => {
        const updated = {};
        for (const key of Object.keys(prev)) {
          if (!key.includes(`-${idx}-`)) updated[key] = prev[key];
        }
        return updated;
      });
      setEditedFields(prev => {
        const updated = {};
        for (const key of Object.keys(prev)) {
          if (!(key === `${idx}` || key.endsWith(`-${idx}`) || key.includes(`-${idx}-`))) updated[key] = prev[key];
        }
        return updated;
      });
    } catch (error) {
      console.error('[EndoscopyReports] Approve failed:', error);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // Check if section has edits — checks both editedSentences AND editedFields
  const sectionHasEdits = useCallback((sectionId, idx) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    const recordStatus = statusOverrides[idx] || 'active';
    if (recordStatus === 'approved') return false;

    return fields.some(f => {
      const hasSentenceEdits = Object.keys(editedSentences).some(key => {
        if (!key.startsWith(`${f}-${idx}-s`)) return false;
        const state = editedSentences[key];
        return state === 'edited' || state === 'added';
      });
      const hasObjectEdits = Object.keys(editedFields).some(key => key.startsWith(`${f}-${idx}`));
      return hasSentenceEdits || hasObjectEdits;
    });
  }, [editedSentences, editedFields, statusOverrides]);

  // ========== COPY HELPERS ==========

  const copyFieldValue = useCallback((value, label, itemId) => {
    const text = label ? `${label}\n${value}` : String(value);
    navigator.clipboard.writeText(text);
    if (itemId) {
      setCopiedItems(prev => ({ ...prev, [itemId]: true }));
      setTimeout(() => setCopiedItems(prev => { const n = { ...prev }; delete n[itemId]; return n; }), 2000);
    }
  }, []);

  // Canonical sentence-field lines: split [.;] → parseLabel → comma-split, numbered (Copy/PDF only)
  const formatSentenceLines = (text) => {
    const out = []; let n = 1;
    splitBySentence(text).forEach(s => {
      const p = parseLabel(s);
      const items = splitByComma(p.isLabeled ? p.value : s);
      if (p.isLabeled) {
        // labeled group → restart numbering within the group (canonical item 3)
        out.push(p.label); out.push(COPY_LINE_DASH);
        let m = 1;
        (items.length >= 2 ? items : [p.value]).forEach(it => out.push(`${m++}. ${it}`));
      } else if (items.length >= 2) {
        items.forEach(it => out.push(`${n++}. ${it}`));
      } else { out.push(`${n++}. ${s}`); }
    });
    return out;
  };

  // Canonical per-section copy text (EQ title, DASH field labels, numbered rows, single-name gate). '' if empty.
  const buildSectionCopyText = (record, idx, sectionId) => {
    const title = SECTION_TITLES[sectionId] || sectionId;
    const fields = SECTION_FIELDS[sectionId] || [];
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    let any = false;
    fields.forEach(field => {
      const localKey = `${field}-${idx}`;
      const rawValue = localEdits[localKey] !== undefined ? localEdits[localKey] : record[field];
      const label = ALL_FIELD_DEFS.find(f => f.key === field)?.label || field;
      const head = label.toLowerCase() !== title.toLowerCase() ? `${label}\n${COPY_LINE_DASH}\n` : '';
      if (SENTENCE_FIELDS.includes(field)) {
        if (!rawValue || typeof rawValue !== 'string' || !rawValue.trim()) return;
        const lines = formatSentenceLines(rawValue);
        if (!lines.length) return;
        text += head + lines.join('\n') + '\n\n'; any = true;
      } else if (ARRAY_FIELDS.includes(field) || Array.isArray(rawValue)) {
        const items = Array.isArray(rawValue) ? rawValue.filter(Boolean) : [];
        if (!items.length) return;
        text += head; items.forEach((it, i) => { text += `${i + 1}. ${String(it)}\n`; }); text += '\n'; any = true;
      } else if (BOOLEAN_FIELDS.includes(field)) {
        if (rawValue === null || rawValue === undefined) return;
        const bv = rawValue === true || rawValue === 'true' || rawValue === 'Yes';
        text += `${head}1. ${bv ? 'Yes' : 'No'}\n\n`; any = true;
      } else if (NUMBER_FIELDS.includes(field)) {
        const nn = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue);
        if (isNaN(nn) || nn === 0) return;
        text += `${head}1. ${nn}\n\n`; any = true;
      } else {
        if (rawValue === null || rawValue === undefined || (typeof rawValue === 'string' && !rawValue.trim())) return;
        text += `${head}1. ${formatDisplay(rawValue)}\n\n`; any = true;
      }
    });
    return any ? text : '';
  };

  const copySection = (record, idx, sectionId) => {
    const text = buildSectionCopyText(record, idx, sectionId);
    if (!text) return;
    navigator.clipboard.writeText(text.replace(/\n+$/, '\n'));
    const copiedId = `${sectionId}-${idx}`;
    setCopiedSection(copiedId);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const copyAllText = () => {
    let text = `Endoscopy Reports\n${COPY_LINE_EQ}\n\n`;
    filteredRecords.forEach((record, rIdx) => {
      const idx = record._originalIdx !== undefined ? record._originalIdx : rIdx;
      text += `Endoscopy Report ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sectionId => {
        text += buildSectionCopyText(record, idx, sectionId);
      });
      text += '\n';
    });
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // ========== PDF DATA ==========

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const merged = { ...record };
      Object.values(SECTION_FIELDS).flat().forEach(field => {
        const editKey = `${field}-${idx}`;
        if (pendingEdits[editKey]) return; // pending drafts stay OUT of the PDF until approved
        if (localEdits[editKey] !== undefined) {
          merged[field] = localEdits[editKey];
        }
      });
      return merged;
    });
  }, [records, localEdits, pendingEdits]);

  // ========== RENDER HELPERS ==========

  const editIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );

  // Render editable field (simple/scalar fields)
  const renderEditableField = (record, fieldName, idx, sectionId, label, value) => {
    const copyLabel = label || fieldName;
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const fullEditKey = `${fieldName}-${idx}`;
    const isEdited = editedFields[fullEditKey];
    const canEdit = !!record._id;
    const isApproved = approvedSections[`${sectionId}-${idx}`];

    const effectiveValue = localEdits[fullEditKey] !== undefined ? localEdits[fullEditKey] : value;
    const displayValue = fieldName === 'createdAt' ? formatDate(effectiveValue) : formatDisplay(effectiveValue);

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={editKey}>
          {label && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <textarea
                ref={textareaRef}
                className="edit-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    handleSaveField(record, fieldName, idx, sectionId, 0);
                  } else if (e.key === 'Escape') {
                    handleCancelEdit();
                  }
                }}
                rows={3}
                disabled={saving}
              />
              <div className="edit-actions">
                <button className="save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId, 0)} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rec-mini-card" key={`${fieldName}-${idx}`}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div
          className={`numbered-row${canEdit ? ' editable-row' : ''}${isEdited && !isApproved ? ' modified' : ''}`}
          onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue, 0)}
          title={canEdit ? 'Click to edit' : undefined}
        >
          <div className="row-content">
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isEdited && (
              <span className="edit-indicator">{editIcon}<span className="edit-tag">edit</span></span>
            )}
            {isEdited && !isApproved && (
              <span className="modified-indicator"><span className="modified-dot" /><span className="modified-text">edited</span></span>
            )}
          </div>
          <button
            className={`copy-btn${copiedItems[`${fieldName}-${idx}`] ? ' copied' : ''}`}
            onClick={(e) => { e.stopPropagation(); copyFieldValue(displayValue, copyLabel, `${fieldName}-${idx}`); }}
          >
            {copiedItems[`${fieldName}-${idx}`] ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isEdited && !isApproved && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // Render editable BOOLEAN field (Yes/No select)
  const renderBooleanField = (record, fieldName, idx, sectionId, label, value) => {
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const fullEditKey = `${fieldName}-${idx}`;
    const isEdited = editedFields[fullEditKey];
    const canEdit = !!record._id;
    const isApproved = approvedSections[`${sectionId}-${idx}`];

    const effectiveValue = localEdits[fullEditKey] !== undefined ? localEdits[fullEditKey] : value;
    const boolValue = effectiveValue === true || effectiveValue === 'true' || effectiveValue === 'Yes';
    const displayValue = boolValue ? 'Yes' : 'No';

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={editKey}>
          {label && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <BlueSelect
                value={editValue === 'Yes' ? 'Yes' : 'No'}
                options={['Yes', 'No']}
                onChange={(v) => setEditValue(v)}
              />
              <div className="edit-actions">
                <button
                  className="save-btn"
                  onClick={() => handleSaveField(record, fieldName, idx, sectionId, 0, editValue === 'Yes')}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rec-mini-card" key={fullEditKey}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div
          className={`numbered-row${canEdit ? ' editable-row' : ''}${isEdited && !isApproved ? ' modified' : ''}`}
          onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue, 0)}
          title={canEdit ? 'Click to edit' : undefined}
        >
          <div className="row-content">
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isEdited && (
              <span className="edit-indicator">{editIcon}<span className="edit-tag">edit</span></span>
            )}
            {isEdited && !isApproved && (
              <span className="modified-indicator"><span className="modified-dot" /><span className="modified-text">edited</span></span>
            )}
          </div>
          <button
            className={`copy-btn${copiedItems[fullEditKey] ? ' copied' : ''}`}
            onClick={(e) => { e.stopPropagation(); copyFieldValue(displayValue, label || fieldName, fullEditKey); }}
          >
            {copiedItems[fullEditKey] ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isEdited && !isApproved && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // Render editable NUMBER field (numeric input, parseFloat + isNaN block + hide-zero)
  const renderNumberField = (record, fieldName, idx, sectionId, label, value) => {
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const fullEditKey = `${fieldName}-${idx}`;
    const isEdited = editedFields[fullEditKey];
    const canEdit = !!record._id;
    const isApproved = approvedSections[`${sectionId}-${idx}`];

    const effectiveValue = localEdits[fullEditKey] !== undefined ? localEdits[fullEditKey] : value;
    const numEffective = typeof effectiveValue === 'number' ? effectiveValue : parseFloat(effectiveValue);
    if (isNaN(numEffective) || numEffective === 0) return null; // hide-zero / hide-invalid
    const displayValue = String(numEffective);

    const saveNumber = () => {
      const parsed = parseFloat(editValue);
      if (isNaN(parsed)) return; // block non-numeric saves
      handleSaveField(record, fieldName, idx, sectionId, 0, parsed);
    };

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={editKey}>
          {label && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={() => setEditValue(v => { const step = parseFloat(stepFor(v)); return String(Math.max(0, (parseFloat(v) || 0) - step)); })}>−</button>
                <input
                  type="text"
                  inputMode="decimal"
                  className="edit-number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); saveNumber(); }
                    else if (e.key === 'Escape') handleCancelEdit();
                  }}
                  disabled={saving}
                />
                <button type="button" className="num-step" onClick={() => setEditValue(v => { const step = parseFloat(stepFor(v)); return String((parseFloat(v) || 0) + step); })}>+</button>
              </div>
              <div className="edit-actions">
                <button className="save-btn" onClick={saveNumber} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rec-mini-card" key={fullEditKey}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div
          className={`numbered-row${canEdit ? ' editable-row' : ''}${isEdited && !isApproved ? ' modified' : ''}`}
          onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue, 0)}
          title={canEdit ? 'Click to edit' : undefined}
        >
          <div className="row-content">
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isEdited && (
              <span className="edit-indicator">{editIcon}<span className="edit-tag">edit</span></span>
            )}
            {isEdited && !isApproved && (
              <span className="modified-indicator"><span className="modified-dot" /><span className="modified-text">edited</span></span>
            )}
          </div>
          <button
            className={`copy-btn${copiedItems[fullEditKey] ? ' copied' : ''}`}
            onClick={(e) => { e.stopPropagation(); copyFieldValue(displayValue, label || fieldName, fullEditKey); }}
          >
            {copiedItems[fullEditKey] ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isEdited && !isApproved && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // Dispatch helper — routes a field to the correct typed renderer
  const renderTypedField = (record, fieldName, idx, sectionId, label, value) => {
    if (BOOLEAN_FIELDS.includes(fieldName)) {
      return renderBooleanField(record, fieldName, idx, sectionId, label, value);
    }
    if (NUMBER_FIELDS.includes(fieldName)) {
      return renderNumberField(record, fieldName, idx, sectionId, label, value);
    }
    if (SENTENCE_FIELDS.includes(fieldName)) {
      return renderSentenceEditableField(record, fieldName, idx, sectionId, label, value);
    }
    return renderEditableField(record, fieldName, idx, sectionId, label, value);
  };

  // Render sentence editable field — splits by sentence [.;], then parseLabel + comma-split.
  // Labeled sentence → nested sub-subtitle + per-comma editable rows; unlabeled ≥2 commas → bare rows; else one row.
  const renderSentenceEditableField = (record, fieldName, idx, sectionId, label, value) => {
    const fullEditKey = `${fieldName}-${idx}`;
    const hasFullEdit = localEdits[fullEditKey] !== undefined;
    const sourceText = hasFullEdit ? localEdits[fullEditKey] : (value || '');
    if (!sourceText || !String(sourceText).trim()) return null;

    const canEdit = !!record._id;
    const isApproved = approvedSections[`${sectionId}-${idx}`];
    const sectionTitle = SECTION_TITLES[sectionId] || '';
    const sl = !!label && label.toLowerCase() !== sectionTitle.toLowerCase();
    const sentences = splitBySentence(sourceText);

    // Save one comma-item (ciIdx) within sentence sIdx (ciIdx=null → whole single sentence). Rebuilds full field text.
    const saveCommaItem = (sIdx, ciIdx, rowKey) => {
      const curFull = localEdits[fullEditKey] !== undefined ? localEdits[fullEditKey] : (record[fieldName] || '');
      const sents = splitBySentence(curFull);
      const s = sents[sIdx] || '';
      const p = parseLabel(s);
      const items = splitByComma(p.isLabeled ? p.value : s);
      const trimmed = editValue.replace(/[.;]+$/, '').trim();
      if (ciIdx === null) {
        sents[sIdx] = p.isLabeled ? `${p.label}: ${trimmed}` : trimmed;
      } else {
        const subParts = trimmed.split(/\.\s+/).map(x => x.replace(/[;.]+$/, '').trim()).filter(Boolean);
        if (subParts.length > 1) items.splice(ciIdx, 1, ...subParts); else items[ciIdx] = trimmed;
        sents[sIdx] = p.isLabeled ? `${p.label}: ${items.join(', ')}` : items.join(', ');
      }
      const fullText = sents.map(x => (/[.!?]$/.test(x) ? x : x + '.')).join(' ');
      setEditedSentences(prev => ({ ...prev, [rowKey]: 'edited' }));
      handleSaveField(record, fieldName, idx, sectionId, 0, fullText);
    };

    const startEditRow = (rowKey, text) => { setEditingField(rowKey); setEditValue((text || '').replace(/[.;]+$/, '').trim()); setTimeout(() => textareaRef.current?.focus(), 50); };

    const editRow = (onSave) => (
      <div className="numbered-row edit-row">
        <div className="edit-field-container">
          <textarea ref={textareaRef} className="edit-textarea" value={editValue} onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') handleCancelEdit(); if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); onSave(); } }}
            rows={Math.max(2, editValue.split('\n').length)} disabled={saving} />
          <div className="edit-actions">
            <button className="save-btn" onClick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
          </div>
        </div>
      </div>
    );

    const displayRow = (rowKey, text, badge) => (
      <div className={`numbered-row${badge === 'edited' ? ' modified' : ''}${badge === 'added' ? ' added' : ''}`}>
        <div className={`row-content${canEdit ? ' editable' : ''}`} onClick={() => canEdit && startEditRow(rowKey, text)} title={canEdit ? 'Click to edit' : undefined}>
          <span className="content-value">{highlightText(text)}</span>
          {canEdit && !badge && (<span className="edit-indicator">{editIcon}<span className="edit-tag">edit</span></span>)}
          {badge && (<span className="modified-indicator"><span className="modified-dot" /><span className="modified-text">{badge === 'added' ? 'added' : 'edited'}</span></span>)}
        </div>
        <button className={`copy-btn${copiedItems[rowKey] ? ' copied' : ''}`} onClick={() => copyFieldValue(text, null, rowKey)}>{copiedItems[rowKey] ? 'Copied!' : 'Copy'}</button>
      </div>
    );

    const badgeOf = (rowKey) => { const st = editedSentences[rowKey]; return (st === 'edited' || st === 'added') && !isApproved ? st : null; };

    return (
      <div className={sl ? 'rec-mini-card' : ''} key={fullEditKey}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        {sentences.map((sentence, sIdx) => {
          const p = parseLabel(sentence);
          const items = splitByComma(p.isLabeled ? p.value : sentence);
          const groupKey = `${fieldName}-${idx}-s${sIdx}`;
          if (p.isLabeled) {
            return (
              <div className="nested-mini-card" key={sIdx}>
                <div className="nested-subtitle">{highlightText(p.label)}</div>
                {items.map((ci, ciIdx) => {
                  const rowKey = `${groupKey}-c${ciIdx}`;
                  return <div key={ciIdx}>{editingField === rowKey ? editRow(() => saveCommaItem(sIdx, ciIdx, rowKey)) : displayRow(rowKey, ci, badgeOf(rowKey))}</div>;
                })}
              </div>
            );
          }
          if (items.length >= 2) {
            return items.map((ci, ciIdx) => {
              const rowKey = `${groupKey}-c${ciIdx}`;
              return <div key={`${sIdx}-${ciIdx}`}>{editingField === rowKey ? editRow(() => saveCommaItem(sIdx, ciIdx, rowKey)) : displayRow(rowKey, ci, badgeOf(rowKey))}</div>;
            });
          }
          const rowKey = `${groupKey}-c0`;
          return <div key={sIdx}>{editingField === rowKey ? editRow(() => saveCommaItem(sIdx, null, rowKey)) : displayRow(rowKey, p.isLabeled ? p.value : sentence, badgeOf(rowKey))}</div>;
        })}
      </div>
    );
  };

  // Render editable array items (string array fields)
  const renderEditableArrayItems = (record, fieldName, idx, sectionId, label, sectionTitleMatches) => {
    const localKey = `${fieldName}-${idx}`;
    const items = localEdits[localKey] !== undefined
      ? localEdits[localKey]
      : (Array.isArray(record[fieldName]) ? record[fieldName] : []);
    const validItems = items.filter(Boolean);
    if (validItems.length === 0) return null;

    const canEdit = !!record._id;

    return (
      <div className="nested-mini-card" key={`${fieldName}-${idx}-array`}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        {validItems.map((item, aIdx) => {
          if (!sectionTitleMatches && !shouldShowRow(record, label, item)) return null;

          const editKey = `${fieldName}-${idx}-s${aIdx}`;
          const isEditing = editingField === editKey;
          const isEdited = editedSentences[editKey] === 'edited';
          const isApproved = approvedSections[`${sectionId}-${idx}`];

          if (isEditing) {
            return (
              <div key={aIdx} className="numbered-row edit-row">
                <div className="edit-field-container">
                  <textarea
                    ref={textareaRef}
                    className="edit-textarea"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.ctrlKey) {
                        handleSaveField(record, fieldName, idx, sectionId, aIdx);
                      } else if (e.key === 'Escape') {
                        handleCancelEdit();
                      }
                    }}
                    rows={2}
                    disabled={saving}
                  />
                  <div className="edit-actions">
                    <button className="save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId, aIdx)} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button className="cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={aIdx} className={`numbered-row${isEdited && !isApproved ? ' modified' : ''}`}>
              <div
                className={`row-content${canEdit ? ' editable' : ''}`}
                onClick={() => canEdit && handleStartEdit(fieldName, idx, item, aIdx)}
                title={canEdit ? 'Click to edit' : undefined}
              >
                <span className="content-value">{highlightText(item)}</span>
                {canEdit && !isEdited && (
                  <span className="edit-indicator">{editIcon}<span className="edit-tag">edit</span></span>
                )}
                {isEdited && !isApproved && (
                  <span className="modified-indicator"><span className="modified-dot" /><span className="modified-text">edited</span></span>
                )}
              </div>
              <button
                className={`copy-btn${copiedItems[`${fieldName}-${idx}-${aIdx}`] ? ' copied' : ''}`}
                onClick={() => copyFieldValue(item, label || fieldName, `${fieldName}-${idx}-${aIdx}`)}
              >
                {copiedItems[`${fieldName}-${idx}-${aIdx}`] ? 'Copied!' : 'Copy'}
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  // Render approve button
  const renderApproveBtn = (record, idx, sectionId) => {
    const fullSectionId = `${sectionId}-${idx}`;
    const hasEdits = sectionHasEdits(sectionId, idx);
    const isApproved = approvedSections[fullSectionId];
    if (!hasEdits && !isApproved) return null;

    return (
      <button
        className={`approve-btn${isApproved ? ' approved' : ' pending'}`}
        onClick={() => handleApprove(record, idx, fullSectionId)}
        disabled={approving}
      >
        {approving ? 'Approving...' : isApproved ? 'Approved' : 'Pending Approve'}
      </button>
    );
  };

  // ========== MAIN RENDER ==========

  if (!records || records.length === 0) {
    return (
      <div className="endoscopy-reports-document" ref={containerRef}>
        <div className="document-header">
          <h2 className="document-title">Endoscopy Reports</h2>
        </div>
        <div className="empty-state">No endoscopy reports available.</div>
      </div>
    );
  }

  return (
    <div className="endoscopy-reports-document" ref={containerRef}>
      {/* Document Header */}
      <div className="document-header">
        <div className="header-actions">
          <button className={`action-btn${copiedAll ? ' copied' : ''}`} onClick={copyAllText}>
            {copiedAll ? 'Copied All' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<EndoscopyReportsDocumentPDFTemplate records={pdfData} />}
            fileName="Endoscopy_Reports.pdf"
            className="action-btn"
          >
            {({ loading }) => (loading ? 'Preparing...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>
        <h2 className="document-title">Endoscopy Reports</h2>
      </div>

      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} placeholder="Search endoscopy reports..." />

      {filteredRecords.length === 0 ? (
        <div className="no-results">No matching records found.</div>
      ) : (
        <div className="records-container">
          {filteredRecords.map((record, rIdx) => {
            const idx = record._originalIdx !== undefined ? record._originalIdx : rIdx;

            return (
              <div key={record._id || idx} className="record-card">
                {/* Record Header */}
                <div className="record-header">
                  <h3 className="record-title">
                    {highlightText(`Endoscopy Report ${idx + 1}`)}
                  </h3>
                </div>

                {/* 1. Procedure Overview */}
                {PROCEDURE_FIELDS.some(f => isFieldPresent(record[f.key])) && shouldShowSection(record, 'Procedure Overview',
                  ...PROCEDURE_FIELDS.map(f => isFieldPresent(record[f.key]) ? `${f.label}: ${formatDisplay(record[f.key])}` : null).filter(Boolean)
                ) && (() => {
                  const searchLower = searchTerm.toLowerCase().trim();
                  const sectionTitleMatches = searchLower && 'procedure overview'.startsWith(searchLower);
                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Procedure Overview')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn${copiedSection === `procedure-overview-${idx}` ? ' copied' : ''}`}
                              onClick={() => copySection(record, idx, 'procedure-overview')}
                            >
                              {copiedSection === `procedure-overview-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, idx, 'procedure-overview')}
                          </div>
                        </div>
                        {PROCEDURE_FIELDS.map(f => {
                          if (!isFieldPresent(record[f.key])) return null;
                          if (!sectionTitleMatches && !shouldShowRow(record, f.label, formatDisplay(record[f.key]))) return null;
                          return renderTypedField(record, f.key, idx, 'procedure-overview', f.label, record[f.key]);
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Preparation & Quality */}
                {QUALITY_FIELDS.some(f => isFieldPresent(record[f.key])) && shouldShowSection(record, 'Preparation & Quality',
                  ...QUALITY_FIELDS.map(f => isFieldPresent(record[f.key]) ? `${f.label}: ${formatDisplay(record[f.key])}` : null).filter(Boolean)
                ) && (() => {
                  const searchLower = searchTerm.toLowerCase().trim();
                  const sectionTitleMatches = searchLower && 'preparation & quality'.startsWith(searchLower);
                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Preparation & Quality')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn${copiedSection === `preparation-quality-${idx}` ? ' copied' : ''}`}
                              onClick={() => copySection(record, idx, 'preparation-quality')}
                            >
                              {copiedSection === `preparation-quality-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, idx, 'preparation-quality')}
                          </div>
                        </div>
                        {QUALITY_FIELDS.map(f => {
                          if (!isFieldPresent(record[f.key])) return null;
                          if (!sectionTitleMatches && !shouldShowRow(record, f.label, formatDisplay(record[f.key]))) return null;
                          return renderTypedField(record, f.key, idx, 'preparation-quality', f.label, record[f.key]);
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* 4. Findings (scalar fields + anatomical landmarks array) */}
                {(FINDINGS_SCALAR_FIELDS.some(f => isFieldPresent(record[f.key])) ||
                  (Array.isArray(record.anatomicalLandmarks) && record.anatomicalLandmarks.filter(Boolean).length > 0)
                ) && shouldShowSection(record, 'Findings',
                  ...FINDINGS_SCALAR_FIELDS.map(f => record[f.key] ? `${f.label}: ${record[f.key]}` : null).filter(Boolean),
                  ...(Array.isArray(record.anatomicalLandmarks) ? record.anatomicalLandmarks.filter(Boolean).map(l => `Anatomical Landmarks: ${l}`) : [])
                ) && (() => {
                  const searchLower = searchTerm.toLowerCase().trim();
                  const sectionTitleMatches = searchLower && 'findings'.startsWith(searchLower);
                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Findings')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn${copiedSection === `findings-${idx}` ? ' copied' : ''}`}
                              onClick={() => copySection(record, idx, 'findings')}
                            >
                              {copiedSection === `findings-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, idx, 'findings')}
                          </div>
                        </div>
                        {/* Esophagitis - simple field */}
                        {isFieldPresent(record.esophagitis) && (sectionTitleMatches || shouldShowRow(record, 'Esophagitis', record.esophagitis)) &&
                          renderEditableField(record, 'esophagitis', idx, 'findings', 'Esophagitis', record.esophagitis)}
                        {/* Barrett Esophagus - text field (may have semicolons) */}
                        {isFieldPresent(record.barrettEsophagus) && (sectionTitleMatches || shouldShowRow(record, 'Barrett Esophagus', record.barrettEsophagus)) &&
                          renderSentenceEditableField(record, 'barrettEsophagus', idx, 'findings', 'Barrett Esophagus', record.barrettEsophagus)}
                        {/* Varices Grade - simple field */}
                        {isFieldPresent(record.varicesGrade) && (sectionTitleMatches || shouldShowRow(record, 'Varices Grade', record.varicesGrade)) &&
                          renderEditableField(record, 'varicesGrade', idx, 'findings', 'Varices Grade', record.varicesGrade)}
                        {/* Mucosal Assessment - text field (may have periods) */}
                        {isFieldPresent(record.mucosal) && (sectionTitleMatches || shouldShowRow(record, 'Mucosal Assessment', record.mucosal)) &&
                          renderSentenceEditableField(record, 'mucosal', idx, 'findings', 'Mucosal Assessment', record.mucosal)}
                        {/* Anatomical Landmarks - array */}
                        {renderEditableArrayItems(record, 'anatomicalLandmarks', idx, 'findings', 'Anatomical Landmarks', sectionTitleMatches)}
                      </div>
                    </div>
                  );
                })()}

                {/* 5. Biopsy & Testing (array + text) */}
                {((Array.isArray(record.biopsyLocations) && record.biopsyLocations.filter(Boolean).length > 0) ||
                  isFieldPresent(record.helicobacterPyloriTesting)
                ) && shouldShowSection(record, 'Biopsy & Testing',
                  ...(Array.isArray(record.biopsyLocations) ? record.biopsyLocations.filter(Boolean).map(l => `Biopsy Locations: ${l}`) : []),
                  record.helicobacterPyloriTesting ? `Helicobacter Pylori Testing: ${record.helicobacterPyloriTesting}` : null
                ) && (() => {
                  const searchLower = searchTerm.toLowerCase().trim();
                  const sectionTitleMatches = searchLower && 'biopsy & testing'.startsWith(searchLower);
                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Biopsy & Testing')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn${copiedSection === `biopsy-testing-${idx}` ? ' copied' : ''}`}
                              onClick={() => copySection(record, idx, 'biopsy-testing')}
                            >
                              {copiedSection === `biopsy-testing-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, idx, 'biopsy-testing')}
                          </div>
                        </div>
                        {renderEditableArrayItems(record, 'biopsyLocations', idx, 'biopsy-testing', 'Biopsy Locations', sectionTitleMatches)}
                        {isFieldPresent(record.helicobacterPyloriTesting) && (sectionTitleMatches || shouldShowRow(record, 'Helicobacter Pylori Testing', record.helicobacterPyloriTesting)) &&
                          renderSentenceEditableField(record, 'helicobacterPyloriTesting', idx, 'biopsy-testing', 'Helicobacter Pylori Testing', record.helicobacterPyloriTesting)}
                      </div>
                    </div>
                  );
                })()}

                {/* 6. Polyps & Interventions (bool + arrays) */}
                {(isFieldPresent(record.polypectomyPerformed) ||
                  (Array.isArray(record.polypsDetected) && record.polypsDetected.filter(Boolean).length > 0) ||
                  (Array.isArray(record.therapeuticInterventions) && record.therapeuticInterventions.filter(Boolean).length > 0)
                ) && shouldShowSection(record, 'Polyps & Interventions',
                  isFieldPresent(record.polypectomyPerformed) ? `Polypectomy Performed: ${formatDisplay(record.polypectomyPerformed)}` : null,
                  ...(Array.isArray(record.polypsDetected) ? record.polypsDetected.filter(Boolean).map(p => `Polyps Detected: ${p}`) : []),
                  ...(Array.isArray(record.therapeuticInterventions) ? record.therapeuticInterventions.filter(Boolean).map(t => `Therapeutic Interventions: ${t}`) : [])
                ) && (() => {
                  const searchLower = searchTerm.toLowerCase().trim();
                  const sectionTitleMatches = searchLower && 'polyps & interventions'.startsWith(searchLower);
                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Polyps & Interventions')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn${copiedSection === `polyps-interventions-${idx}` ? ' copied' : ''}`}
                              onClick={() => copySection(record, idx, 'polyps-interventions')}
                            >
                              {copiedSection === `polyps-interventions-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, idx, 'polyps-interventions')}
                          </div>
                        </div>
                        {isFieldPresent(record.polypectomyPerformed) && (sectionTitleMatches || shouldShowRow(record, 'Polypectomy Performed', formatDisplay(record.polypectomyPerformed))) &&
                          renderBooleanField(record, 'polypectomyPerformed', idx, 'polyps-interventions', 'Polypectomy Performed', record.polypectomyPerformed)}
                        {renderEditableArrayItems(record, 'polypsDetected', idx, 'polyps-interventions', 'Polyps Detected', sectionTitleMatches)}
                        {renderEditableArrayItems(record, 'therapeuticInterventions', idx, 'polyps-interventions', 'Therapeutic Interventions', sectionTitleMatches)}
                      </div>
                    </div>
                  );
                })()}

                {/* 7. Complications */}
                {(Array.isArray(record.complications) && record.complications.filter(Boolean).length > 0) &&
                  shouldShowSection(record, 'Complications',
                    ...(record.complications.filter(Boolean))
                  ) && (() => {
                  const searchLower = searchTerm.toLowerCase().trim();
                  const sectionTitleMatches = searchLower && 'complications'.startsWith(searchLower);
                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Complications')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn${copiedSection === `complications-${idx}` ? ' copied' : ''}`}
                              onClick={() => copySection(record, idx, 'complications')}
                            >
                              {copiedSection === `complications-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, idx, 'complications')}
                          </div>
                        </div>
                        {renderEditableArrayItems(record, 'complications', idx, 'complications', null, sectionTitleMatches)}
                      </div>
                    </div>
                  );
                })()}

                {/* 8. Photodocumentation */}
                {(Array.isArray(record.photodocumentation) && record.photodocumentation.filter(Boolean).length > 0) &&
                  shouldShowSection(record, 'Photodocumentation',
                    ...(record.photodocumentation.filter(Boolean).map(p => `Photodocumentation: ${p}`))
                  ) && (() => {
                  const searchLower = searchTerm.toLowerCase().trim();
                  const sectionTitleMatches = searchLower && 'photodocumentation'.startsWith(searchLower);
                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Photodocumentation')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn${copiedSection === `photodocumentation-${idx}` ? ' copied' : ''}`}
                              onClick={() => copySection(record, idx, 'photodocumentation')}
                            >
                              {copiedSection === `photodocumentation-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, idx, 'photodocumentation')}
                          </div>
                        </div>
                        {renderEditableArrayItems(record, 'photodocumentation', idx, 'photodocumentation', null, sectionTitleMatches)}
                      </div>
                    </div>
                  );
                })()}

                {/* 9. Follow-Up Recommendations */}
                {isFieldPresent(record.followUpRecommendations) && shouldShowSection(record, 'Follow-Up Recommendations',
                  `Follow-Up Recommendations: ${record.followUpRecommendations}`
                ) && (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h4 className="section-title">{highlightText('Follow-Up Recommendations')}</h4>
                        <div className="header-right-actions">
                          <button
                            className={`copy-btn${copiedSection === `followup-${idx}` ? ' copied' : ''}`}
                            onClick={() => copySection(record, idx, 'followup')}
                          >
                            {copiedSection === `followup-${idx}` ? 'Copied!' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, idx, 'followup')}
                        </div>
                      </div>
                      {renderSentenceEditableField(record, 'followUpRecommendations', idx, 'followup', null, record.followUpRecommendations)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EndoscopyReportsDocument;
