/**
 * CancerSurveillanceDocument.jsx
 * February 2026 Standard - Blue Glow Theme + Inline Editing
 *
 * Displays cancer surveillance records with 4-level search hierarchy:
 * Level 1: Document (surveillance record) with _originalIdx + title search + _showAllSections
 * Level 2: Section (section title) with startsWith bidirectional
 * Level 4: Row/Field (individual fields) with startsWith on labels
 *
 * Layout:
 * - Document title on top, Copy All + Export PDF buttons below (right-aligned)
 * - Record header: date/status badges on top row (right), title below (left)
 * - Provider Details section (type, frequency, nextDue, provider, facility)
 * - All other sections with nested subtitles + mini-cards
 *
 * Inline editing follows PastMedicalHistory pattern:
 * - Per-sentence editing for text fields (findings, assessment, plan, notes)
 * - Simple field editing for status, type, provider, date, frequency, method, biopsyProtocol, nextDue
 * - Modified badge below edited rows
 * - Approve button below Copy Section in section header
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import SearchBar from '../components/SearchBar';
import CancerSurveillanceDocumentPDFTemplate from '../pdf-templates/CancerSurveillanceDocumentPDFTemplate';
import './CancerSurveillanceDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field"; value may be string/array/object) */
const DRAFT_KEY = 'cancer_surveillancePendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const CancerSurveillanceDocument = ({ document: docProp, data, templateData }) => {
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
  // editKeys (`${field}-${idx}`) that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const textareaRef = useRef(null);

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
  // YYYY-MM-DD for <input type="date"> (parses "February 2026" → 2026-02-01; blank if unparseable)
  const toInputDate = (val) => { if (!val) return ''; try { const d = new Date(val); if (isNaN(d.getTime())) return ''; return d.toISOString().split('T')[0]; } catch { return ''; } };

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

  // Parse label from "Label: Value" pattern
  const parseLabel = (text) => {
    if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text };
    const colonIdx = text.indexOf(':');
    if (colonIdx > 0 && colonIdx < text.length - 1) {
      const label = text.substring(0, colonIdx).trim();
      const value = text.substring(colonIdx + 1).trim();
      if (label.length > 0 && label.length < 50 && value.length > 0) {
        return { isLabeled: true, label, value };
      }
    }
    return { isLabeled: false, label: '', value: text };
  };

  // Split by comma (parenthesis-aware)
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
    if (raw?.cancer_surveillance) return Array.isArray(raw.cancer_surveillance) ? raw.cancer_surveillance : [raw.cancer_surveillance];
    if (raw?.documentData) {
      const docData = raw.documentData;
      if (Array.isArray(docData)) return docData;
      if (docData?.cancer_surveillance) return Array.isArray(docData.cancer_surveillance) ? docData.cancer_surveillance : [docData.cancer_surveillance];
      return [docData];
    }
    if (typeof raw === 'object') return [raw];
    return [];
  }, [templateData, docProp, data]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  // Keyed by record _id (handling _id.$oid) mapped to the record's index, matching the editKey convention.
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const recId = record && (record._id?.$oid || record._id);
      const recDrafts = recId ? store[String(recId)] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = true;
        nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  // Field definitions for search
  const fieldDefinitions = [
    { key: 'type', label: 'Type' },
    { key: 'frequency', label: 'Frequency' },
    { key: 'method', label: 'Method' },
    { key: 'biopsyProtocol', label: 'Biopsy Protocol' },
    { key: 'nextDue', label: 'Next Due' },
    { key: 'findings', label: 'Findings' },
    { key: 'assessment', label: 'Assessment' },
    { key: 'plan', label: 'Plan' },
    { key: 'recommendations', label: 'Recommendations' },
    { key: 'results', label: 'Results' },
    { key: 'notes', label: 'Notes' },
    { key: 'status', label: 'Status' }
  ];

  // SECTION_FIELDS mapping — maps each section to its field names
  // Only includes fields that are actually editable
  const SECTION_FIELDS = {
    'provider-details': ['type', 'frequency', 'nextDue', 'provider', 'facility'],
    'surveillance-info': ['status'],
    'method-protocol': ['method', 'biopsyProtocol'],
    'findings': ['findings'],
    'assessment': ['assessment'],
    'plan': ['plan'],
    'results': ['results'],
    'notes': ['notes'],
    'recommendations': ['recommendations'], // Array of objects - editable per item
  };

  // SENTENCE_FIELDS — text fields that use per-sentence editing
  // Rule: If a field's MongoDB data EVER contains multiple sentences (`. ` or `; `), use per-sentence editing
  const SENTENCE_FIELDS = ['method', 'findings', 'assessment', 'plan', 'notes'];

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
        const recordTitle = `Cancer Surveillance Record ${idx + 1}`;
        const searchableText = [
          'Cancer Surveillance',
          recordTitle,
          // Include field LABELS for label-based search
          'Type', 'Status', 'Frequency', 'Method', 'Biopsy Protocol', 'Next Due',
          'Findings', 'Assessment', 'Plan', 'Notes', 'Recommendations', 'Results',
          'Provider Details', 'Method & Protocol',
          record.type,
          record.status,
          record.frequency,
          record.method,
          record.biopsyProtocol,
          record.nextDue,
          record.findings,
          record.assessment,
          record.plan,
          record.notes,
          Array.isArray(record.recommendations) ? record.recommendations.map(r => r.recommendation).join(' ') : '',
          record.results ? Object.entries(record.results).map(([k, v]) => `${k}: ${v}`).join(' ') : '',
        ].filter(Boolean).join(' ').toLowerCase();

        if (!searchableText.includes(searchLower)) return null;

        const titleLower = recordTitle.toLowerCase();
        const collectionLower = 'cancer surveillance';
        const _showAllSections = titleLower.startsWith(searchLower) || searchLower.startsWith(titleLower) ||
            collectionLower.startsWith(searchLower) || searchLower.startsWith(collectionLower);

        return { ...record, _originalIdx: idx, _showAllSections };
      })
      .filter(Boolean);
  }, [records, searchTerm]);

  // ========== LEVEL 2: Section Filtering ==========
  const shouldShowSection = useCallback((record, sectionTitle, ...sectionContent) => {
    // A section renders ONLY if at least one content part has a real (non-empty) value — never show an
    // empty section box. Content parts are "Label: Value" (or plain strings); strip the label, check the rest.
    const hasContent = sectionContent.some(c => {
      if (!c) return false;
      const s = String(c); const ci = s.indexOf(': ');
      return (ci !== -1 ? s.slice(ci + 2) : s).trim() !== '';
    });
    if (!hasContent) return false;
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;

    const searchLower = searchTerm.toLowerCase().trim();

    // Check section title — .startsWith() prevents partial word matches
    if (sectionTitle) {
      const titleLower = sectionTitle.toLowerCase();
      if (titleLower.startsWith(searchLower) || searchLower.startsWith(titleLower)) return true;
    }

    // Check section content — "Label: Value" format, phrase matching
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

  // Safe _id extraction
  const getRecordId = (record) => {
    const id = record._id?.$oid || record._id;
    if (!id) {
      console.error('Cannot save — no record _id');
      return null;
    }
    return String(id);
  };

  // Handle start edit
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

    const saveValue = valueOverride !== undefined ? valueOverride : editValue.trim();
    const sKey = `${fieldName}-${idx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;
    const fullEditKey = `${fieldName}-${idx}`;
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};

    // Special handling for recommendations array field
    if (fieldName === 'recommendations' && typeof saveValue === 'string' && saveValue.includes('|')) {
      const [recText, recDate] = saveValue.split('|').map(s => s.trim());
      const currentRecs = Array.isArray(record.recommendations) ? record.recommendations : [];
      const updatedRecs = [...currentRecs];
      if (updatedRecs[sentenceIdx]) {
        updatedRecs[sentenceIdx] = { ...updatedRecs[sentenceIdx], recommendation: recText, date: recDate || undefined };
      }

      // Stage the full updated array locally (NO DB write)
      setLocalEdits(prev => ({ ...prev, [fullEditKey]: updatedRecs }));
      setPendingEdits(prev => ({ ...prev, [fullEditKey]: true }));
      // Track which specific index was edited
      const recEditKey = `${fieldName}-${idx}-${sentenceIdx}`;
      setEditedFields(prev => ({ ...prev, [recEditKey]: true }));
      // Also track in editedSentences for sectionHasEdits to work
      setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
      store[recordId][fieldName] = updatedRecs;
    }
    // Special handling for results object field
    else if (fieldName === 'results' && typeof saveValue === 'string' && saveValue.includes(':')) {
      const [key, val] = saveValue.split(':').map(s => s.trim());
      const currentResults = record.results || {};
      const updatedResults = { ...currentResults, [key]: val };

      // Stage the full updated results object locally (NO DB write)
      setLocalEdits(prev => ({ ...prev, [fullEditKey]: updatedResults }));
      setPendingEdits(prev => ({ ...prev, [fullEditKey]: true }));
      // Track which specific key was edited
      setEditedFields(prev => ({ ...prev, [`${fieldName}-${idx}-${key}`]: true }));
      // Also track in editedSentences for sectionHasEdits to work
      setEditedSentences(prev => ({ ...prev, [`${fieldName}-${idx}-s0`]: 'edited' }));
      store[recordId][fieldName] = updatedResults;
    } else {
      // CRITICAL: Stage the FULL reconstructed text (saveValue) with the full-field edit key (NO DB write)
      // This ensures all sentences display the updated value after save
      setLocalEdits(prev => ({ ...prev, [fullEditKey]: saveValue }));
      setPendingEdits(prev => ({ ...prev, [fullEditKey]: true }));
      setEditedFields(prev => ({ ...prev, [fullEditKey]: true }));
      setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
      store[recordId][fieldName] = saveValue;
    }

    // CRITICAL: Reset approve status for this section on any new edit → button returns to yellow Pending Approve
    setApprovedSections(prev => {
      const updated = { ...prev };
      delete updated[`${sectionId}-${idx}`];
      return updated;
    });

    // Persist the draft so it survives refresh (separate key — NOT artifactGridData, NOT the DB).
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Reconstruct full text from sentences (period restoration on ALL)
  const reconstructFullText = (allSentences, sIdx, editedSentence, fieldName, idx, hasFullEdit) => {
    const updated = allSentences.map((s, i) => {
      let t;
      if (i === sIdx) {
        t = editedSentence;
      } else if (!hasFullEdit) {
        const pKey = `${fieldName}.s${i}-${idx}`;
        t = localEdits[pKey] !== undefined ? localEdits[pKey] : s;
      } else {
        t = s;
      }
      return (t && !/[.!?]$/.test(t)) ? t + '.' : t;
    });
    return updated.join(' ');
  };

  // Save sentence (plain function - NOT useCallback)
  const saveSentence = (record, fieldName, idx, sectionId, sIdx) => {
    let editedSentence = editValue.trim();
    if (editedSentence && !/[.!?]$/.test(editedSentence)) editedSentence += '.';

    const fullEditKey = `${fieldName}-${idx}`;
    const hasFullEdit = localEdits[fullEditKey] !== undefined;
    const sourceText = hasFullEdit ? localEdits[fullEditKey] : (record[fieldName] || '');
    const allCurrent = splitBySentence(sourceText);
    const fullText = reconstructFullText(allCurrent, sIdx, editedSentence, fieldName, idx, hasFullEdit);
    const newSentences = splitBySentence(fullText);
    const extraCount = newSentences.length - allCurrent.length;

    if (extraCount > 0) {
      const editedMap = {};
      editedMap[`${fieldName}-${idx}-s${sIdx}`] = 'edited';
      for (let si = sIdx + 1; si <= sIdx + extraCount; si++) {
        editedMap[`${fieldName}-${idx}-s${si}`] = 'added';
      }
      setEditedSentences(prev => {
        const cleaned = {};
        for (const key of Object.keys(prev)) {
          if (!key.startsWith(`${fieldName}-${idx}-s`)) cleaned[key] = prev[key];
        }
        return { ...cleaned, ...editedMap };
      });
    }

    handleSaveField(record, fieldName, idx, sectionId, sIdx, fullText);
  };

  // Handle cancel edit
  const handleCancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue('');
  }, []);

  // Approve = COMMIT all staged drafts for this record to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  // NOTE: sectionId arrives already suffixed with the record index (e.g. "provider-details-0").
  const handleApprove = useCallback(async (record, idx, sectionId) => {
    const recordId = getRecordId(record);
    if (!recordId) return;

    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now.
      // editKey is "<field>-<idx>"; localEdits[editKey] is the full value (text, recommendations array, or results object).
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "<field>" (no numeric arrayIndex suffix used here)
        const dotIdx = fieldPart.lastIndexOf('.');
        const trailing = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const isArrayIndex = dotIdx !== -1 && /^\d+$/.test(trailing);
        const payload = { field: isArrayIndex ? fieldPart.slice(0, dotIdx) : fieldPart, value: localEdits[editKey] };
        if (isArrayIndex) payload.arrayIndex = parseInt(trailing, 10);
        const resp = await secureApiClient.put(`/api/edit/cancer_surveillance/${recordId}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the record/section approved (audit trail)
      await secureApiClient.put(`/api/edit/cancer_surveillance/${recordId}/approve`, {
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
      // Clear this record's per-field edited markers so the rows stop showing the pending badge
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
      console.error('[CancerSurveillance] Approve failed:', error);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // Check if section has edits — updated to handle both sentence fields AND object fields (like results)
  const sectionHasEdits = useCallback((sectionId, idx) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    const recordStatus = statusOverrides[idx] || 'active';
    if (recordStatus === 'approved') return false;
    
    return fields.some(f => {
      // Check for sentence-based edits (findings, assessment, plan, notes, method)
      const hasSentenceEdits = Object.keys(editedSentences).some(key => {
        if (!key.startsWith(`${f}-${idx}-s`)) return false;
        const state = editedSentences[key];
        return state === 'edited' || state === 'added';
      });
      
      // Check for object field edits (results uses different key format)
      const hasObjectEdits = Object.keys(editedFields).some(key => {
        return key.startsWith(`${f}-${idx}-`);
      });
      
      return hasSentenceEdits || hasObjectEdits;
    });
  }, [editedSentences, editedFields, statusOverrides]);

  // Copy field value with animation
  const copyFieldValue = useCallback((value, label, itemId) => {
    const text = `${label}: ${value}`;
    navigator.clipboard.writeText(text);
    if (itemId) {
      setCopiedItems(prev => ({ ...prev, [itemId]: true }));
      setTimeout(() => setCopiedItems(prev => { const n = { ...prev }; delete n[itemId]; return n; }), 2000);
    }
  }, []);

  // Copy section
  const copySection = useCallback((record, idx, sectionId) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return;

    const lines = [];
    const sectionTitle = sectionId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    lines.push(`${sectionTitle}:`);

    fields.forEach(field => {
      // Check for local edits first
      const localKey = `${field}-${idx}`;
      let rawValue = localEdits[localKey] !== undefined ? localEdits[localKey] : record[field];

      if (!rawValue) return;

      const label = fieldDefinitions.find(f => f.key === field)?.label || field;

      if (SENTENCE_FIELDS.includes(field)) {
        const sentences = splitBySentence(rawValue);
        sentences.forEach((s, i) => {
          lines.push(`  ${i + 1}. ${s}`);
        });
      } else if (Array.isArray(rawValue)) {
        rawValue.forEach((item, i) => {
          if (typeof item === 'object' && item.recommendation) {
            lines.push(`  ${i + 1}. ${item.recommendation}${item.date ? ` (${item.date})` : ''}`);
          } else if (typeof item === 'object') {
            lines.push(`  ${i + 1}. ${Object.values(item).join(', ')}`);
          } else {
            lines.push(`  ${i + 1}. ${item}`);
          }
        });
      } else if (typeof rawValue === 'object') {
        Object.entries(rawValue).forEach(([k, v]) => {
          lines.push(`  ${k}: ${v}`);
        });
      } else {
        lines.push(`  ${label}: ${rawValue}`);
      }
    });

    const text = lines.join('\n');
    navigator.clipboard.writeText(text);
    const copiedId = `${sectionId}-${idx}`;
    setCopiedSection(copiedId);
    setTimeout(() => setCopiedSection(null), 2000);
  }, [localEdits]);

  // Copy all text
  const copyAllText = useCallback(() => {
    const lines = ['CANCER SURVEILLANCE:'];

    filteredRecords.forEach((record, idx) => {
      lines.push(`\nRecord ${idx + 1}:`);

      Object.entries(SECTION_FIELDS).forEach(([sectionId, fields]) => {
        const sectionTitle = sectionId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        fields.forEach(field => {
          // Check for local edits first
          const localKey = `${field}-${idx}`;
          let rawValue = localEdits[localKey] !== undefined ? localEdits[localKey] : record[field];
          
          if (!rawValue) return;

          const label = fieldDefinitions.find(f => f.key === field)?.label || field;

          if (SENTENCE_FIELDS.includes(field)) {
            const sentences = splitBySentence(rawValue);
            sentences.forEach((s, i) => {
              lines.push(`  ${i + 1}. ${s}`);
            });
          } else if (Array.isArray(rawValue)) {
            rawValue.forEach((item, i) => {
              if (typeof item === 'object' && item.recommendation) {
                // Special handling for recommendations array
                lines.push(`  ${i + 1}. ${item.recommendation}${item.date ? ` (${item.date})` : ''}`);
              } else if (typeof item === 'object') {
                lines.push(`  ${i + 1}. ${Object.values(item).join(', ')}`);
              } else {
                lines.push(`  ${i + 1}. ${item}`);
              }
            });
          } else if (typeof rawValue === 'object') {
            Object.entries(rawValue).forEach(([k, v]) => {
              lines.push(`  ${k}: ${v}`);
            });
          } else {
            lines.push(`  ${label}: ${rawValue}`);
          }
        });
      });
    });

    const text = lines.join('\n');
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }, [filteredRecords, localEdits]);

  // pdfData — merges localEdits into filteredRecords so PDF reflects edited values
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      ['type', 'status', 'frequency', 'method', 'biopsyProtocol', 'nextDue',
       'findings', 'assessment', 'plan', 'notes'].forEach(field => {
        const editKey = `${field}-${idx}`;
        if (pendingEdits[editKey]) return; // pending drafts stay OUT of the PDF until approved
        if (localEdits[editKey] !== undefined) {
          merged[field] = localEdits[editKey];
        }
      });
      const recsKey = `recommendations-${idx}`;
      if (!pendingEdits[recsKey] && localEdits[recsKey] !== undefined) {
        merged.recommendations = localEdits[recsKey];
      }
      const resultsKey = `results-${idx}`;
      if (!pendingEdits[resultsKey] && localEdits[resultsKey] !== undefined) {
        merged.results = localEdits[resultsKey];
      }
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  // ========== RENDER HELPERS ==========

  // Render editable field (simple fields)
  const renderEditableField = (record, fieldName, idx, sectionId, label, value) => {
    const copyLabel = label || fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const fullEditKey = `${fieldName}-${idx}`;
    const isEdited = editedFields[fullEditKey];
    const canEdit = !!record._id;

    // Read from localEdits first — shows updated value after save
    const effectiveValue = localEdits[fullEditKey] !== undefined ? localEdits[fullEditKey] : value;

    // Empty fields are NOT rendered — never show a blank editable row (unless actively being edited).
    if (!isEditing && (effectiveValue === null || effectiveValue === undefined || (typeof effectiveValue === 'string' && effectiveValue.trim() === ''))) return null;

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={editKey}>
          {label && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className="numbered-row edit-row">
            <textarea
              ref={textareaRef}
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
              <button
                className="save-btn"
                onClick={() => handleSaveField(record, fieldName, idx, sectionId, 0)}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="cancel-btn" onClick={handleCancelEdit} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    const displayValue = formatDate(effectiveValue);

    return (
      <div className="rec-mini-card" key={`${fieldName}-${idx}`}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
          <div
            className={`row-content ${canEdit ? 'editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(fieldName, idx, effectiveValue, 0)}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isEdited && (
              <span className="edit-indicator">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
                <span className="edit-tag">edit</span>
              </span>
            )}
            {isEdited && (
              <span className="modified-indicator">
                <span className="modified-dot" />
                <span className="modified-text">edited</span>
              </span>
            )}
          </div>
          <button
            className={`copy-btn${copiedItems[`${fieldName}-${idx}`] ? ' copied' : ''}`}
            onClick={() => copyFieldValue(effectiveValue, copyLabel, `${fieldName}-${idx}`)}
          >
            {copiedItems[`${fieldName}-${idx}`] ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isEdited && !approvedSections[`${sectionId}-${idx}`] && <div className="modified-badge">edited — click pending approve to save</div>}
      </div>
    );
  };

  // Render a DATE field with a native date picker (input type=date). Empty → hidden.
  const renderDateField = (record, fieldName, idx, sectionId, label, value) => {
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const fullEditKey = `${fieldName}-${idx}`;
    const isEdited = editedFields[fullEditKey];
    const canEdit = !!record._id;
    const effectiveValue = localEdits[fullEditKey] !== undefined ? localEdits[fullEditKey] : value;
    if (!isEditing && (effectiveValue === null || effectiveValue === undefined || (typeof effectiveValue === 'string' && effectiveValue.trim() === ''))) return null;

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={editKey}>
          {label && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className="numbered-row edit-row">
            <input
              type="date"
              className="edit-date"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              ref={(el) => { if (el) { el.focus(); try { el.showPicker(); } catch { /* unsupported */ } } }}
              onKeyDown={(e) => { if (e.key === 'Escape') handleCancelEdit(); }}
              disabled={saving}
            />
            <div className="edit-actions">
              <button
                className="save-btn"
                onClick={() => { if (!editValue || isNaN(new Date(editValue).getTime())) return; handleSaveField(record, fieldName, idx, sectionId, 0, editValue + 'T00:00:00.000Z'); }}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }

    const displayValue = formatDate(effectiveValue);
    return (
      <div className="rec-mini-card" key={fullEditKey}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
          <div
            className={`row-content ${canEdit ? 'editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(fieldName, idx, toInputDate(effectiveValue), 0)}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isEdited && (
              <span className="edit-indicator">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
                <span className="edit-tag">edit</span>
              </span>
            )}
            {isEdited && (
              <span className="modified-indicator">
                <span className="modified-dot" />
                <span className="modified-text">edited</span>
              </span>
            )}
          </div>
          <button
            className={`copy-btn${copiedItems[`${fieldName}-${idx}`] ? ' copied' : ''}`}
            onClick={() => copyFieldValue(displayValue, label || fieldName, `${fieldName}-${idx}`)}
          >
            {copiedItems[`${fieldName}-${idx}`] ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isEdited && !approvedSections[`${sectionId}-${idx}`] && <div className="modified-badge">edited — click pending approve to save</div>}
      </div>
    );
  };

  // Render sentence editable field (text fields with per-sentence editing)
  const renderSentenceEditableField = (record, fieldName, idx, sectionId, label, value) => {
    const copyLabel = label || fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
    const fullEditKey = `${fieldName}-${idx}`;
    const hasFullEdit = localEdits[fullEditKey] !== undefined;
    const sourceText = hasFullEdit ? localEdits[fullEditKey] : (value || '');
    if (!sourceText || !sourceText.trim()) return null;

    const sentences = splitBySentence(sourceText);
    if (sentences.length <= 1) {
      // Single sentence — use regular editable field
      return renderEditableField(record, fieldName, idx, sectionId, label, sourceText);
    }

    const canEdit = !!record._id;
    const recordStatus = statusOverrides[idx] || 'active';

    return sentences.map((sentence, sIdx) => {
      // Apply per-sentence overlay if splitting from original (no full edit)
      let displaySentence = sentence;
      if (!hasFullEdit) {
        const pKey = `${fieldName}.s${sIdx}-${idx}`;
        if (localEdits[pKey] !== undefined) displaySentence = localEdits[pKey];
      }

      const editKey = `${fieldName}-${idx}-s${sIdx}`;
      const isEditing = editingField === editKey;
      const sentenceState = editedSentences[editKey];
      const isApproved = approvedSections[`${sectionId}-${idx}`];
      const isEdited = sentenceState === 'edited' && !isApproved;
      const isAdded = sentenceState === 'added' && !isApproved;
      const isPending = (isEdited || isAdded);

      // Strip trailing punctuation for edit text
      const editText = displaySentence.replace(/[.;]+$/, '').trim();

      if (isEditing) {
        return (
          <div className="rec-mini-card" key={`${fieldName}-s${sIdx}`}>
            {sIdx === 0 && label && <div className="nested-subtitle">{highlightText(label)}</div>}
            <div className="numbered-row edit-row">
              <div className="edit-field-container">
                <textarea
                  ref={textareaRef}
                  className="edit-textarea"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') handleCancelEdit();
                    if (e.key === 'Enter' && e.ctrlKey) {
                      e.preventDefault();
                      saveSentence(record, fieldName, idx, sectionId, sIdx);
                    }
                  }}
                  rows={Math.max(2, editValue.split('\n').length)}
                  disabled={saving}
                />
                <div className="edit-actions">
                  <button
                    className="save-btn"
                    onClick={() => saveSentence(record, fieldName, idx, sectionId, sIdx)}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button className="cancel-btn" onClick={handleCancelEdit} disabled={saving}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="rec-mini-card" key={`${fieldName}-s${sIdx}`}>
          {sIdx === 0 && label && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className={`numbered-row ${isEdited ? 'modified' : ''} ${isAdded ? 'added' : ''}`}>
            <div
              className={`row-content ${canEdit ? 'editable' : ''}`}
              onClick={() => canEdit && handleStartEdit(fieldName, idx, editText, sIdx)}
              title={canEdit ? 'Click to edit' : undefined}
            >
              <span className="content-value">{highlightText(displaySentence)}</span>
              {canEdit && !isPending && (
                <span className="edit-indicator">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                  </svg>
                  <span className="edit-tag">edit</span>
                </span>
              )}
              {isPending && (
                <span className="modified-indicator">
                  <span className="modified-dot" />
                  <span className="modified-text">{isAdded ? 'added' : 'edited'}</span>
                </span>
              )}
            </div>
            <button
              className={`copy-btn${copiedItems[`${fieldName}-${idx}-s${sIdx}`] ? ' copied' : ''}`}
              onClick={() => copyFieldValue(displaySentence, `${copyLabel} (sentence ${sIdx + 1})`, `${fieldName}-${idx}-s${sIdx}`)}
            >
              {copiedItems[`${fieldName}-${idx}-s${sIdx}`] ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      );
    });
  };

  // Render approve button
  const renderApproveBtn = (record, idx, sectionId) => {
    const hasEdits = sectionHasEdits(sectionId, idx);
    const isApproved = approvedSections[sectionId];

    if (!hasEdits && !isApproved) return null;

    return (
      <button
        className={`approve-btn${isApproved ? ' approved' : ' pending'}`}
        onClick={() => handleApprove(record, idx, sectionId)}
        disabled={approving}
      >
        {approving ? 'Approving...' : isApproved ? 'Approved' : 'Pending Approve'}
      </button>
    );
  };

  // ========== MAIN RENDER ==========

  if (!filteredRecords || filteredRecords.length === 0) {
    return (
      <div className="cancer-surveillance-document" ref={containerRef}>
        <div className="document-header">
          <h2 className="document-title">Cancer Surveillance</h2>
          <div className="document-actions">
            <button
              className={`copy-all-button${copiedAll ? ' copied' : ''}`}
              onClick={copyAllText}
            >
              {copiedAll ? 'Copied!' : 'Copy All'}
            </button>
            <PDFDownloadLink
              document={<CancerSurveillanceDocumentPDFTemplate data={pdfData} />}
              fileName="Cancer_Surveillance.pdf"
              className="export-pdf-button"
            >
              {({ loading }) => (loading ? 'Preparing PDF...' : 'Export PDF')}
            </PDFDownloadLink>
          </div>
        </div>
        <div className="no-data">No cancer surveillance records found</div>
      </div>
    );
  }

  return (
    <div className="cancer-surveillance-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Cancer Surveillance</h2>
        <div className="document-actions">
          <button
            className={`copy-all-button${copiedAll ? ' copied' : ''}`}
            onClick={copyAllText}
          >
            {copiedAll ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<CancerSurveillanceDocumentPDFTemplate data={pdfData} />}
            fileName="Cancer_Surveillance.pdf"
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

        return (
          <div key={recordId || idx} className="record-container">
            {/* Record Header - Two Row Layout */}
            <div className="record-header">
              <div className="header-top-row">
                {record.date && <span className="date-badge">{highlightText(formatDate(record.date))}</span>}
                {record.status && <span className="status-badge">{highlightText(record.status)}</span>}
              </div>
              <h3 className="record-title">
                {highlightText(`Cancer Surveillance Record ${originalIdx + 1}`)}
              </h3>
            </div>

            {/* Provider Details Section */}
            {shouldShowSection(record, 'Provider Details',
              record.type !== undefined ? `Type: ${record.type}` : null,
              record.frequency !== undefined ? `Frequency: ${record.frequency}` : null,
              record.nextDue !== undefined ? `Next Due: ${record.nextDue}` : null,
              record.provider !== undefined ? `Provider: ${record.provider}` : null,
              record.facility !== undefined ? `Facility: ${record.facility}` : null
            ) && (() => {
              const sectionTitle = 'Provider Details';
              const searchLower = searchTerm.toLowerCase().trim();
              const sectionTitleMatches = searchLower && sectionTitle.toLowerCase().startsWith(searchLower);
              return (
            <div className="section">
              <div className="mini-cards-container">
                <div className="section-header">
                  <h4 className="section-title">{highlightText('Provider Details')}</h4>
                  <div className="header-right-actions">
                    <button
                      className={`copy-btn${copiedSection === `provider-details-${idx}` ? ' copied' : ''}`}
                      onClick={() => copySection(record, idx, 'provider-details')}
                    >
                      {copiedSection === `provider-details-${idx}` ? 'Copied!' : 'Copy Section'}
                    </button>
                    {(sectionHasEdits('provider-details', idx) || approvedSections[`provider-details-${idx}`]) && (
                      <button
                        className={`approve-btn${approvedSections[`provider-details-${idx}`] ? ' approved' : ' pending'}`}
                        onClick={() => handleApprove(record, idx, `provider-details-${idx}`)}
                        disabled={approving}
                      >
                        {approving ? 'Approving...' : approvedSections[`provider-details-${idx}`] ? 'Approved' : 'Pending Approve'}
                      </button>
                    )}
                  </div>
                </div>
                {(sectionTitleMatches || shouldShowRow(record, 'Type', record.type)) && renderEditableField(record, 'type', idx, 'provider-details', 'Type', record.type)}
                {(sectionTitleMatches || shouldShowRow(record, 'Frequency', record.frequency)) && renderEditableField(record, 'frequency', idx, 'provider-details', 'Frequency', record.frequency)}
                {(sectionTitleMatches || shouldShowRow(record, 'Next Due', record.nextDue)) && renderDateField(record, 'nextDue', idx, 'provider-details', 'Next Due', record.nextDue)}
                {(sectionTitleMatches || shouldShowRow(record, 'Provider', record.provider)) && renderEditableField(record, 'provider', idx, 'provider-details', 'Provider', record.provider)}
                {(sectionTitleMatches || shouldShowRow(record, 'Facility', record.facility)) && renderEditableField(record, 'facility', idx, 'provider-details', 'Facility', record.facility)}
              </div>
            </div>
              );
            })()}

            {/* Method & Protocol Section */}
            {shouldShowSection(record, 'Method & Protocol',
              record.method !== undefined ? `Method: ${record.method}` : null,
              record.biopsyProtocol !== undefined ? `Biopsy Protocol: ${record.biopsyProtocol}` : null
            ) && (() => {
              const sectionTitle = 'Method & Protocol';
              const searchLower = searchTerm.toLowerCase().trim();
              const sectionTitleMatches = searchLower && sectionTitle.toLowerCase().startsWith(searchLower);
              return (
            <div className="section">
              <div className="mini-cards-container">
                <div className="section-header">
                  <h4 className="section-title">{highlightText('Method & Protocol')}</h4>
                  <div className="header-right-actions">
                    <button
                      className={`copy-btn${copiedSection === `method-protocol-${idx}` ? ' copied' : ''}`}
                      onClick={() => copySection(record, idx, 'method-protocol')}
                    >
                      {copiedSection === `method-protocol-${idx}` ? 'Copied!' : 'Copy Section'}
                    </button>
                    {(sectionHasEdits('method-protocol', idx) || approvedSections[`method-protocol-${idx}`]) && (
                      <button
                        className={`approve-btn${approvedSections[`method-protocol-${idx}`] ? ' approved' : ' pending'}`}
                        onClick={() => handleApprove(record, idx, `method-protocol-${idx}`)}
                        disabled={approving}
                      >
                        {approving ? 'Approving...' : approvedSections[`method-protocol-${idx}`] ? 'Approved' : 'Pending Approve'}
                      </button>
                    )}
                  </div>
                </div>
                {(sectionTitleMatches || shouldShowRow(record, 'Method', record.method)) && renderSentenceEditableField(record, 'method', idx, 'method-protocol', 'Method', record.method)}
                {(sectionTitleMatches || shouldShowRow(record, 'Biopsy Protocol', record.biopsyProtocol)) && renderEditableField(record, 'biopsyProtocol', idx, 'method-protocol', 'Biopsy Protocol', record.biopsyProtocol)}
              </div>
            </div>
              );
            })()}

            {/* Findings Section */}
            {shouldShowSection(record, 'Findings',
              record.findings !== undefined ? `Findings: ${record.findings}` : null
            ) && (
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
                    {(sectionHasEdits('findings', idx) || approvedSections[`findings-${idx}`]) && (
                      <button
                        className={`approve-btn${approvedSections[`findings-${idx}`] ? ' approved' : ' pending'}`}
                        onClick={() => handleApprove(record, idx, `findings-${idx}`)}
                        disabled={approving}
                      >
                        {approving ? 'Approving...' : approvedSections[`findings-${idx}`] ? 'Approved' : 'Pending Approve'}
                      </button>
                    )}
                  </div>
                </div>
                {renderSentenceEditableField(record, 'findings', idx, 'findings', null, record.findings)}
              </div>
            </div>
            )}

            {/* Assessment Section */}
            {shouldShowSection(record, 'Assessment',
              record.assessment !== undefined ? `Assessment: ${record.assessment}` : null
            ) && (
            <div className="section">
              <div className="mini-cards-container">
                <div className="section-header">
                  <h4 className="section-title">{highlightText('Assessment')}</h4>
                  <div className="header-right-actions">
                    <button
                      className={`copy-btn${copiedSection === `assessment-${idx}` ? ' copied' : ''}`}
                      onClick={() => copySection(record, idx, 'assessment')}
                    >
                      {copiedSection === `assessment-${idx}` ? 'Copied!' : 'Copy Section'}
                    </button>
                    {(sectionHasEdits('assessment', idx) || approvedSections[`assessment-${idx}`]) && (
                      <button
                        className={`approve-btn${approvedSections[`assessment-${idx}`] ? ' approved' : ' pending'}`}
                        onClick={() => handleApprove(record, idx, `assessment-${idx}`)}
                        disabled={approving}
                      >
                        {approving ? 'Approving...' : approvedSections[`assessment-${idx}`] ? 'Approved' : 'Pending Approve'}
                      </button>
                    )}
                  </div>
                </div>
                {renderSentenceEditableField(record, 'assessment', idx, 'assessment', null, record.assessment)}
              </div>
            </div>
            )}

            {/* Plan Section */}
            {shouldShowSection(record, 'Plan',
              record.plan !== undefined ? `Plan: ${record.plan}` : null
            ) && (
            <div className="section">
              <div className="mini-cards-container">
                <div className="section-header">
                  <h4 className="section-title">{highlightText('Plan')}</h4>
                  <div className="header-right-actions">
                    <button
                      className={`copy-btn${copiedSection === `plan-${idx}` ? ' copied' : ''}`}
                      onClick={() => copySection(record, idx, 'plan')}
                    >
                      {copiedSection === `plan-${idx}` ? 'Copied!' : 'Copy Section'}
                    </button>
                    {(sectionHasEdits('plan', idx) || approvedSections[`plan-${idx}`]) && (
                      <button
                        className={`approve-btn${approvedSections[`plan-${idx}`] ? ' approved' : ' pending'}`}
                        onClick={() => handleApprove(record, idx, `plan-${idx}`)}
                        disabled={approving}
                      >
                        {approving ? 'Approving...' : approvedSections[`plan-${idx}`] ? 'Approved' : 'Pending Approve'}
                      </button>
                    )}
                  </div>
                </div>
                {renderSentenceEditableField(record, 'plan', idx, 'plan', null, record.plan)}
              </div>
            </div>
            )}

            {/* Recommendations Section - Editable array of objects */}
            {shouldShowSection(record, 'Recommendations',
              ...(Array.isArray(record.recommendations) ? record.recommendations.map(r => r.recommendation) : [])
            ) && (
            <div className="section">
              <div className="mini-cards-container">
                <div className="section-header">
                  <h4 className="section-title">{highlightText('Recommendations')}</h4>
                  <div className="header-right-actions">
                    <button
                      className={`copy-btn${copiedSection === `recommendations-${idx}` ? ' copied' : ''}`}
                      onClick={() => copySection(record, idx, 'recommendations')}
                    >
                      {copiedSection === `recommendations-${idx}` ? 'Copied!' : 'Copy Section'}
                    </button>
                    {(sectionHasEdits('recommendations', idx) || approvedSections[`recommendations-${idx}`]) && (
                      <button
                        className={`approve-btn${approvedSections[`recommendations-${idx}`] ? ' approved' : ' pending'}`}
                        onClick={() => handleApprove(record, idx, `recommendations-${idx}`)}
                        disabled={approving}
                      >
                        {approving ? 'Approving...' : approvedSections[`recommendations-${idx}`] ? 'Approved' : 'Pending Approve'}
                      </button>
                    )}
                  </div>
                </div>
                {record.recommendations && Array.isArray(record.recommendations) && record.recommendations.length > 0 && (
                  <div className="rec-mini-card">
                    {record.recommendations.map((rec, recIdx) => {
                      const recEditingKey = `recommendations-${idx}-s${recIdx}`;
                      const isRecEditing = editingField === recEditingKey;
                      const isRecEdited = editedFields[`recommendations-${idx}-${recIdx}`];
                      const canEdit = !!record._id;

                      // Read from localEdits if available
                      const localRecs = localEdits[`recommendations-${idx}`];
                      const localRec = localRecs && localRecs[recIdx] ? localRecs[recIdx] : rec;
                      const displayRec = localRec.recommendation || rec.recommendation;
                      const displayDate = localRec.date || rec.date;

                      if (isRecEditing) {
                        return (
                          <div key={recEditingKey} className="nested-mini-card">
                            <div className="nested-subtitle sub-label">Recommendation {recIdx + 1}</div>
                            <div className="numbered-row edit-row">
                              <textarea
                                ref={textareaRef}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && e.ctrlKey) {
                                    e.preventDefault();
                                    handleSaveField(record, 'recommendations', idx, 'recommendations', recIdx, `${editValue.trim()}|${displayDate || ''}`);
                                  } else if (e.key === 'Escape') {
                                    handleCancelEdit();
                                  }
                                }}
                                rows={3}
                                disabled={saving}
                                placeholder="Enter recommendation (e.g., 'Continue surveillance every 6 months')"
                              />
                              <div className="edit-actions">
                                <button
                                  className="save-btn"
                                  onClick={() => handleSaveField(record, 'recommendations', idx, 'recommendations', recIdx, `${editValue.trim()}|${displayDate || ''}`)}
                                  disabled={saving}
                                >
                                  {saving ? 'Saving...' : 'Save'}
                                </button>
                                <button className="cancel-btn" onClick={handleCancelEdit} disabled={saving}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={recEditingKey} className={`nested-mini-card${isRecEdited ? ' modified' : ''}`}>
                          <div className="nested-subtitle sub-label">Recommendation {recIdx + 1}</div>
                          <div className="numbered-row">
                            <div
                              className={`row-content ${canEdit ? 'editable' : ''}`}
                              onClick={() => canEdit && handleStartEdit('recommendations', idx, displayRec, recIdx)}
                              title={canEdit ? 'Click to edit' : undefined}
                            >
                              <span className="content-value">
                                {highlightText(displayRec)}
                                {displayDate && <span className="meta-inline"> ({displayDate})</span>}
                              </span>
                              {canEdit && !isRecEdited && (
                                <span className="edit-indicator">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                    <path d="m15 5 4 4" />
                                  </svg>
                                  <span className="edit-tag">edit</span>
                                </span>
                              )}
                              {isRecEdited && (
                                <span className="modified-indicator">
                                  <span className="modified-dot" />
                                  <span className="modified-text">edited</span>
                                </span>
                              )}
                            </div>
                            <button
                              className={`copy-btn${copiedItems[`rec-${idx}-${recIdx}`] ? ' copied' : ''}`}
                              onClick={() => copyFieldValue(`${displayRec}${displayDate ? ` (${displayDate})` : ''}`, `Recommendation ${recIdx + 1}`, `rec-${idx}-${recIdx}`)}
                            >
                              {copiedItems[`rec-${idx}-${recIdx}`] ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {Object.keys(editedFields).some(k => k.startsWith(`recommendations-${idx}-`)) && !approvedSections[`recommendations-${idx}`] && (
                      <div className="modified-badge">edited — click pending approve to save</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            )}

            {/* Results Section - Each result is editable */}
            {shouldShowSection(record, 'Results',
              ...(record.results && typeof record.results === 'object' ? Object.entries(record.results).map(([k, v]) => `${k}: ${v}`) : [])
            ) && (
            <div className="section">
              <div className="mini-cards-container">
                <div className="section-header">
                  <h4 className="section-title">{highlightText('Results')}</h4>
                  <div className="header-right-actions">
                    <button
                      className={`copy-btn${copiedSection === `results-${idx}` ? ' copied' : ''}`}
                      onClick={() => copySection(record, idx, 'results')}
                    >
                      {copiedSection === `results-${idx}` ? 'Copied!' : 'Copy Section'}
                    </button>
                    {(sectionHasEdits('results', idx) || approvedSections[`results-${idx}`]) && (
                      <button
                        className={`approve-btn${approvedSections[`results-${idx}`] ? ' approved' : ' pending'}`}
                        onClick={() => handleApprove(record, idx, `results-${idx}`)}
                        disabled={approving}
                      >
                        {approving ? 'Approving...' : approvedSections[`results-${idx}`] ? 'Approved' : 'Pending Approve'}
                      </button>
                    )}
                  </div>
                </div>
                {record.results && typeof record.results === 'object' && (
                  <div className="rec-mini-card">
                    {Object.entries(record.results).map(([key, val], i) => {
                      const editKey = `results-${idx}-s${i}`;
                      const isEditing = editingField === editKey;
                      const isEdited = editedFields[`results-${idx}-${key}`];
                      const canEdit = !!record._id;

                      // Read from localEdits if available (for displaying updated values)
                      const localResults = localEdits[`results-${idx}`];
                      const displayValue = localResults && localResults[key] !== undefined ? localResults[key] : val;

                      if (isEditing) {
                        return (
                          <div key={editKey} className="nested-mini-card">
                            <div className="nested-subtitle sub-label">{highlightText(key)}</div>
                            <div className="numbered-row edit-row">
                              <textarea
                                ref={textareaRef}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && e.ctrlKey) {
                                    e.preventDefault();
                                    handleSaveField(record, 'results', idx, 'results', 0, `${key}: ${editValue.trim()}`);
                                  } else if (e.key === 'Escape') {
                                    handleCancelEdit();
                                  }
                                }}
                                rows={2}
                                disabled={saving}
                              />
                              <div className="edit-actions">
                                <button
                                  className="save-btn"
                                  onClick={() => handleSaveField(record, 'results', idx, 'results', 0, `${key}: ${editValue.trim()}`)}
                                  disabled={saving}
                                >
                                  {saving ? 'Saving...' : 'Save'}
                                </button>
                                <button className="cancel-btn" onClick={handleCancelEdit} disabled={saving}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={editKey} className="nested-mini-card">
                          <div className="nested-subtitle sub-label">{highlightText(key)}</div>
                          <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
                            <div
                              className={`row-content ${canEdit ? 'editable' : ''}`}
                              onClick={() => canEdit && handleStartEdit('results', idx, displayValue, i)}
                              title={canEdit ? 'Click to edit' : undefined}
                            >
                              <span className="content-value">{highlightText(displayValue)}</span>
                              {canEdit && !isEdited && (
                                <span className="edit-indicator">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                    <path d="m15 5 4 4" />
                                  </svg>
                                  <span className="edit-tag">edit</span>
                                </span>
                              )}
                              {isEdited && (
                                <span className="modified-indicator">
                                  <span className="modified-dot" />
                                  <span className="modified-text">edited</span>
                                </span>
                              )}
                            </div>
                            <button
                              className={`copy-btn${copiedItems[`res-${idx}-${key}`] ? ' copied' : ''}`}
                              onClick={() => copyFieldValue(displayValue, key, `res-${idx}-${key}`)}
                            >
                              {copiedItems[`res-${idx}-${key}`] ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {Object.keys(editedFields).some(k => k.startsWith(`results-${idx}-`)) && !approvedSections[`results-${idx}`] && (
                      <div className="modified-badge">edited — click pending approve to save</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            )}

            {/* Notes Section */}
            {shouldShowSection(record, 'Notes',
              record.notes !== undefined ? `Notes: ${record.notes}` : null
            ) && (
            <div className="section">
              <div className="mini-cards-container">
                <div className="section-header">
                  <h4 className="section-title">{highlightText('Notes')}</h4>
                  <div className="header-right-actions">
                    <button
                      className={`copy-btn${copiedSection === `notes-${idx}` ? ' copied' : ''}`}
                      onClick={() => copySection(record, idx, 'notes')}
                    >
                      {copiedSection === `notes-${idx}` ? 'Copied!' : 'Copy Section'}
                    </button>
                    {(sectionHasEdits('notes', idx) || approvedSections[`notes-${idx}`]) && (
                      <button
                        className={`approve-btn${approvedSections[`notes-${idx}`] ? ' approved' : ' pending'}`}
                        onClick={() => handleApprove(record, idx, `notes-${idx}`)}
                        disabled={approving}
                      >
                        {approving ? 'Approving...' : approvedSections[`notes-${idx}`] ? 'Approved' : 'Pending Approve'}
                      </button>
                    )}
                  </div>
                </div>
                {renderSentenceEditableField(record, 'notes', idx, 'notes', null, record.notes)}
              </div>
            </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CancerSurveillanceDocument;
