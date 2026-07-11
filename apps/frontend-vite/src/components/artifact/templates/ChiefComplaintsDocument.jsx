import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import ChiefComplaintsDocumentPDFTemplate from '../pdf-templates/ChiefComplaintsDocumentPDFTemplate';
import './ChiefComplaintsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'chiefComplaintsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/**
 * ChiefComplaintsDocument - February 2026 (Inline Editing Update)
 *
 * Displays chief complaint records with medical-specific fields.
 * Inline editing follows AllergiesDocument pattern exactly:
 *   useRef + secureApiClient, 10 editing states, 4 handlers,
 *   persistToLocalStorage, getFieldValue, pdfData useMemo,
 *   SECTION_FIELDS + sectionHasEdits, renderEditableField,
 *   array fields with arrayIndex, approve in section-headers.
 *
 * Editable string fields: primaryComplaint, painCharacter, painLocation,
 *   painRadiation, symptomSeverity, functionalImpact, progressionPattern,
 *   triggeringEvent, traumaHistory
 * Array fields (arrayIndex): secondaryComplaints, alleviatingFactors,
 *   aggravatingFactors, associatedSymptoms, recentMedicationChanges,
 *   emergencySymptoms, systemsReview, patientConcerns
 * Non-editable: dates, _id, patientId, timestamps, painScaleScore,
 *   symptomDurationHours, previousEpisodes, workRelated
 */
const ChiefComplaintsDocument = ({ document, data }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSectionId, setCopiedSectionId] = useState(null);

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

  // Accept both document and data props
  const templateData = document || data;

  // Unwrap data - handle both wrapped and unwrapped formats
  const unwrappedData = useMemo(() => {
    if (!templateData) return [];

    if (Array.isArray(templateData)) {
      return templateData.flatMap(item => {
        if (item.chief_complaints) return item.chief_complaints;
        if (item.records) return item.records;
        return item;
      });
    }

    if (templateData.data) {
      if (Array.isArray(templateData.data)) {
        return templateData.data.flatMap(item => {
          if (item.chief_complaints) return item.chief_complaints;
          if (item.records) return item.records;
          return item;
        });
      }
      return [templateData.data];
    }

    return [templateData];
  }, [templateData]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nStatus = {};
    unwrappedData.forEach((record, idx) => {
      const rid = record && (record._id?.$oid || record._id);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // Base field (strip a trailing numeric ".N" arrayIndex only)
        const dotIdx = fieldPart.lastIndexOf('.');
        const baseField = (dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1)))
          ? fieldPart.slice(0, dotIdx)
          : fieldPart;
        // Mark every section that contains this field as edited (drives badges + Approve button)
        for (const [sectionId, fields] of Object.entries(SECTION_FIELDS)) {
          if (fields.includes(baseField)) nFields[`${sectionId}-${idx}`] = true;
        }
        nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
        nStatus[idx] = 'amended';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
    setStatusOverrides(prev => ({ ...nStatus, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unwrappedData]);

  // Copy to clipboard helper
  const copyToClipboard = useCallback((text, sectionId) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSectionId(sectionId);
      setTimeout(() => setCopiedSectionId(null), 2000);
    });
  }, []);

  // Format date helper
  const formatDate = (dateValue) => {
    if (!dateValue) return '';
    try {
      const date = new Date(dateValue.$date || dateValue);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return String(dateValue);
    }
  };

  // Get date from record (handles both createdAt and createdAtUTC)
  const getRecordDate = (record) => {
    return record.createdAt || record.createdAtUTC || record.date || null;
  };

  // Convert a date value to YYYY-MM-DD for <input type="date">
  const toInputDate = (dateValue) => {
    if (!dateValue) return '';
    try {
      const d = new Date(dateValue.$date || dateValue);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  // Format duration (hours to readable format)
  const formatDuration = (hours) => {
    if (!hours && hours !== 0) return '';
    if (hours < 24) return `${hours} hours`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) return `${days} day${days > 1 ? 's' : ''}`;
    return `${days} day${days > 1 ? 's' : ''}, ${remainingHours} hour${remainingHours > 1 ? 's' : ''}`;
  };

  // Check if value exists
  const hasValue = (val) => {
    if (val === null || val === undefined || val === '') return false;
    if (Array.isArray(val)) return val.length > 0;
    return true;
  };

  // Split by semicolon for compound fields
  const splitBySemicolon = (text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/;\s*/).map(s => s.trim()).filter(Boolean);
  };

  // Highlight search matches
  const highlightText = useCallback((text) => {
    if (!text || !searchTerm || typeof text !== 'string') return text;
    const searchLower = searchTerm.toLowerCase().trim();
    if (!searchLower) return text;

    const textLower = text.toLowerCase();
    const index = textLower.indexOf(searchLower);

    if (index === -1) return text;

    return (
      <>
        {text.substring(0, index)}
        <mark>{text.substring(index, index + searchTerm.length)}</mark>
        {text.substring(index + searchTerm.length)}
      </>
    );
  }, [searchTerm]);

  // 4-level search: Check if search term matches (phrase matching)
  const shouldShowRow = useCallback((record, ...args) => {
    if (!searchTerm || !searchTerm.trim()) return true;
    if (record._showAllSections) return true;

    const searchLower = searchTerm.toLowerCase().trim();

    return args.some(arg => {
      if (!arg) return false;
      const text = String(arg).toLowerCase();
      return text.includes(searchLower);
    });
  }, [searchTerm]);

  // Section-level filtering
  const shouldShowSection = useCallback((record, sectionTitle, contentToCheck, additionalKeywords = []) => {
    if (!searchTerm || !searchTerm.trim()) return true;
    if (record._showAllSections) return true;

    const searchLower = searchTerm.toLowerCase().trim();

    if (sectionTitle.toLowerCase().includes(searchLower)) return true;

    if (contentToCheck) {
      const content = Array.isArray(contentToCheck)
        ? contentToCheck.filter(Boolean).join(' ').toLowerCase()
        : String(contentToCheck).toLowerCase();
      if (content.includes(searchLower)) return true;
    }

    if (additionalKeywords.some(kw => kw.toLowerCase().includes(searchLower))) return true;

    return false;
  }, [searchTerm]);

  // --- Edit handlers (following AllergiesDocument pattern exactly) ---

  const handleStartEdit = useCallback((fieldName, idx, currentValue, arrayIndex) => {
    const editKey = arrayIndex !== undefined
      ? `${fieldName}.${arrayIndex}-${idx}-s0`
      : `${fieldName}-${idx}-s0`;
    setEditingField(editKey);
    setEditValue(currentValue || '');
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  // Start editing a specific semicolon-split item
  const handleStartSplitEdit = useCallback((fieldName, idx, currentValue, sentenceIdx) => {
    const editKey = `${fieldName}-${idx}-s${sentenceIdx}`;
    setEditingField(editKey);
    setEditValue(currentValue || '');
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue('');
  }, []);

  // Stage one edit as a DRAFT: update localEdits + pendingEdits + edited/status markers, clear the
  // section's approved flag (re-edit → yellow Pending), and write the draft to the localStorage store.
  const stageDraft = useCallback((recordId, fieldPart, idx, sectionId, value, sentenceIdx = 0) => {
    const editKey = `${fieldPart}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [`${fieldPart}-${idx}-s${sentenceIdx}`]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));
    setApprovedSections(prev => {
      if (!prev[sectionId]) return prev;
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldPart] = value;
    writeDrafts(store);
    setEditingField(null);
    setEditValue('');
  }, []);

  // Save = stage a DRAFT locally + localStorage (survives refresh). NOT written to MongoDB and NOT
  // shown in the PDF until the user clicks Approve (handleApprove commits). Synchronous now.
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, arrayIndex) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) {
      console.error('[ChiefComplaints] Cannot save — no record _id');
      return;
    }
    const fieldPart = typeof arrayIndex === 'number' ? `${fieldName}.${arrayIndex}` : fieldName;
    stageDraft(recordId, fieldPart, idx, sectionId, editValue.trim());
  }, [editValue, stageDraft]);

  // Save a Date field — stages an explicit ISO value (not editValue.trim())
  const handleSaveDateField = useCallback((record, fieldName, idx, sectionId, isoValue) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) {
      console.error('[ChiefComplaints] Cannot save — no record _id');
      return;
    }
    stageDraft(recordId, fieldName, idx, sectionId, isoValue);
  }, [stageDraft]);

  // Save a semicolon-split item — reconstructs full text, then stages it as a DRAFT
  const handleSaveSplitField = useCallback((record, fieldName, idx, sectionId, sentenceIdx) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) {
      console.error('[ChiefComplaints] Cannot save — no record _id');
      return;
    }

    let saveValue = editValue.trim();

    // Reconstruct full text from semicolon items
    const fullEditKey = `${fieldName}-${idx}`;
    const currentFull = localEdits[fullEditKey] !== undefined ? localEdits[fullEditKey] : (record[fieldName] || '');
    const items = splitBySemicolon(String(currentFull));
    if (sentenceIdx < items.length) {
      items[sentenceIdx] = saveValue;
    }
    saveValue = items.join('; ');

    stageDraft(recordId, fieldName, idx, sectionId, saveValue, sentenceIdx);
  }, [editValue, localEdits, stageDraft]);

  // Save one comma-part — re-split current value (guarded), splice the edited part, rejoin ', '.
  const handleSaveCommaField = useCallback((record, fieldName, idx, sectionId, partIdx) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) { console.error('[ChiefComplaints] Cannot save — no record _id'); return; }
    const saveValue = editValue.trim();
    const fullEditKey = `${fieldName}-${idx}`;
    const currentFull = localEdits[fullEditKey] !== undefined ? localEdits[fullEditKey] : (record[fieldName] || '');
    const items = splitByComma(String(currentFull));
    if (partIdx < items.length) items[partIdx] = saveValue;
    const rebuilt = items.map(s => String(s).trim()).filter(Boolean).join(', ');
    stageDraft(recordId, fieldName, idx, sectionId, rebuilt, partIdx);
  }, [editValue, localEdits, stageDraft]);

  // Save a boolean field (Yes/No dropdown) — stores true/false so Copy/PDF/backend stay unchanged.
  const handleSaveBoolField = useCallback((record, fieldName, idx, sectionId) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) { console.error('[ChiefComplaints] Cannot save — no record _id'); return; }
    stageDraft(recordId, fieldName, idx, sectionId, editValue === 'Yes');
  }, [editValue, stageDraft]);

  // Save a numeric field — stores a real number (parseFloat) so Copy/PDF/backend stay unchanged.
  const handleSaveNumberField = useCallback((record, fieldName, idx, sectionId) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) { console.error('[ChiefComplaints] Cannot save — no record _id'); return; }
    const n = parseFloat(editValue);
    if (isNaN(n)) return;
    stageDraft(recordId, fieldName, idx, sectionId, n);
  }, [editValue, stageDraft]);

  // Approve = COMMIT all staged drafts for this record to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApprove = useCallback(async (record, idx, sectionId) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) {
      console.error('[ChiefComplaints] Cannot approve — no record _id');
      return;
    }

    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements).
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const dotIdx = fieldPart.lastIndexOf('.');
        const isArrayElem = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
        const payload = { field: isArrayElem ? fieldPart.slice(0, dotIdx) : fieldPart, value: localEdits[editKey] };
        if (isArrayElem) payload.arrayIndex = parseInt(fieldPart.slice(dotIdx + 1), 10);
        const resp = await secureApiClient.put(`/api/edit/chief_complaints/${recordId}/edit`, payload);
        if (!resp || !resp.success) throw new Error((resp && resp.error) || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/chief_complaints/${recordId}/approve`);

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[recordId]) { delete store[recordId]; writeDrafts(store); }

      setStatusOverrides(prev => ({ ...prev, [idx]: 'approved' }));
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
          if (!key.endsWith(`-${idx}`)) updated[key] = prev[key];
        }
        return updated;
      });
    } catch (err) {
      console.error('[ChiefComplaints] Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // Get effective field value (local edit overrides original)
  const getFieldValue = useCallback((record, fieldName, idx, arrayIndex) => {
    const editKey = arrayIndex !== undefined
      ? `${fieldName}.${arrayIndex}-${idx}`
      : `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    if (arrayIndex !== undefined) {
      const arr = record[fieldName];
      return Array.isArray(arr) ? arr[arrayIndex] : undefined;
    }
    return record[fieldName];
  }, [localEdits]);

  // pdfData — merges localEdits into records for PDF + Copy All
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return unwrappedData;
    return unwrappedData.map((record, idx) => {
      const merged = { ...record };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldPart = editKey.substring(0, dashIdx);
        const recordIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recordIdx === idx) {
          // Handle array dot notation: "fieldName.arrayIndex"
          if (fieldPart.includes('.')) {
            const [arrField, arrIdx] = fieldPart.split('.');
            const arrIndex = parseInt(arrIdx, 10);
            if (!isNaN(arrIndex) && Array.isArray(merged[arrField])) {
              merged[arrField] = [...merged[arrField]];
              merged[arrField][arrIndex] = editVal;
            }
          } else {
            merged[fieldPart] = editVal;
          }
        }
      }
      return merged;
    });
  }, [unwrappedData, localEdits, pendingEdits]);

  // SECTION_FIELDS: maps sectionId -> field names for that section (for approve detection)
  const SECTION_FIELDS = {
    primaryComplaintInfo: ['primaryComplaint'],
    emergencySymptomsInfo: ['emergencySymptoms'],
    secondaryComplaintsInfo: ['secondaryComplaints'],
    symptomDetailsInfo: ['symptomOnsetDateTime', 'symptomDurationHours', 'symptomSeverity', 'progressionPattern', 'triggeringEvent'],
    associatedSymptomsInfo: ['associatedSymptoms'],
    painAssessmentInfo: ['painScaleScore', 'painCharacter', 'painLocation', 'painRadiation'],
    alleviatingFactorsInfo: ['alleviatingFactors'],
    aggravatingFactorsInfo: ['aggravatingFactors'],
    patientConcernsInfo: ['patientConcerns'],
    functionalImpactInfo: ['functionalImpact'],
    historyInfo: ['previousEpisodes', 'workRelated', 'traumaHistory'],
    medicationChangesInfo: ['recentMedicationChanges'],
    systemsReviewInfo: ['systemsReview'],
  };

  // sectionHasEdits: returns true if any field in this section has pending edits for a given record idx
  const sectionHasEdits = useCallback((sectionId, idx) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    const recordStatus = statusOverrides[idx] || 'active';
    if (recordStatus === 'approved') return false;
    return fields.some(fieldName => {
      // Check string field
      const directKey = `${sectionId}-${idx}`;
      if (editedFields[directKey]) return true;
      // Check array entries
      for (const key of Object.keys(editedSentences)) {
        if (key.startsWith(`${fieldName}`) && key.includes(`-${idx}-`)) {
          return true;
        }
      }
      return false;
    });
  }, [editedFields, editedSentences, statusOverrides]);

  // Helper: render a single editable string field
  const splitBySentence = (text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|i\.e|e\.g))\.(?:\s+)/)
      .map(s => s.trim().replace(/[;.]+$/, '').trim())
      .filter(s => s && !/^[;.,!?]+$/.test(s));
  };

  // Guarded comma split: never inside parentheses; ", and …"/", or …" stays connected on either side;
  // no-space commas kept ("$18,000"). Used for the primary complaint (one long comma-separated sentence).
  const splitByComma = (text) => {
    if (!text || typeof text !== 'string') return [];
    const result = []; let current = ''; let depth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') { depth++; current += ch; }
      else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
      else if (ch === ',' && depth === 0) {
        if (!/\s/.test(text[i + 1] || '')) { current += ch; continue; }
        const rest = text.slice(i + 1).replace(/^\s+/, '');
        if (/^(and|or)\b/i.test(rest)) { current += ch; continue; }
        if (/\b(and|or)\s*$/i.test(current)) { current += ch; continue; }
        const t = current.trim(); if (t) result.push(t); current = '';
      }
      else { current += ch; }
    }
    const t = current.trim(); if (t) result.push(t);
    return result.length ? result : (text.trim() ? [text.trim()] : []);
  };

  // decimal-aware step size for the −/+ number stepper
  const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };

  // PLAIN function (NOT useCallback — avoids stale closure on editValue/localEdits)
  // Rebuild the full field text from all sentences, replacing index sIdx with the
  // edited sentence, and restore a period on EVERY sentence lacking .!? so the
  // stored MongoDB value stays splittable (otherwise it collapses into one block).
  const reconstructFullText = (allSentences, sIdx, editedSentence) => {
    return allSentences
      .map((s, i) => {
        const t = i === sIdx ? editedSentence : s;
        return (t && !/[.!?]$/.test(t)) ? t + '.' : t;
      })
      .join(' ');
  };

  // PLAIN function — save one sentence within a sentence-split text field.
  // Reconstructs the WHOLE field then stages it as a DRAFT (no DB write until Approve).
  const saveSentence = (record, fieldName, idx, sectionId, sIdx) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) {
      console.error('[ChiefComplaints] Cannot save — no record _id');
      return;
    }

    let editedSentence = editValue.trim();

    const fullEditKey = `${fieldName}-${idx}`;
    const sourceText = localEdits[fullEditKey] !== undefined
      ? localEdits[fullEditKey]
      : (record[fieldName] || '');
    const allCurrent = splitBySentence(sourceText);
    const fullText = reconstructFullText(allCurrent, sIdx, editedSentence);

    stageDraft(recordId, fieldName, idx, sectionId, fullText, sIdx);
  };

  // Render a sentence-split text field — each sentence is its own editable row.
  // Label/nested-subtitle only on the first row; per-row Copy button preserved.
  const renderSentenceEditableField = (record, idx, fieldName, label, displayValue, sectionId, copyId) => {
    if (!displayValue || !String(displayValue).trim()) return null;

    const sentences = splitBySentence(displayValue);

    // Single sentence → fall back to whole-field edit (one row)
    if (sentences.length <= 1) {
      return renderEditableField(record, idx, fieldName, label, displayValue, sectionId, copyId);
    }

    const canEdit = !!record._id;
    const recordStatus = statusOverrides[idx] || 'active';
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];

    return sentences.map((sentence, sIdx) => {
      const rowText = sentence + (sentence.endsWith('.') ? '' : '.');
      const editKey = `${fieldName}-${idx}-s${sIdx}`;
      const isEditing = editingField === editKey;
      const sentenceState = sectionWasEdited ? editedSentences[editKey] : undefined;
      const isFieldEdited = sentenceState === 'edited' && recordStatus !== 'approved';
      const isPending = sentenceState && recordStatus !== 'approved';
      const rowCopyId = `${copyId}-s${sIdx}`;

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
                    className="edit-save-btn"
                    onClick={() => saveSentence(record, fieldName, idx, sectionId, sIdx)}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>
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
          <div className={`numbered-row ${isFieldEdited ? 'modified' : ''}`}>
            <div
              className={`row-content ${canEdit ? 'editable' : ''}`}
              onClick={() => canEdit && handleStartSplitEdit(fieldName, idx, sentence, sIdx)}
              title={canEdit ? 'Click to edit' : undefined}
            >
              <span className="content-value">{highlightText(rowText)}</span>
              {canEdit && !isPending && (
                <span className="edit-indicator">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                  </svg>
                  <span className="edit-tag">edit</span>
                </span>
              )}
            </div>
            <button
              className={`copy-btn ${copiedSectionId === rowCopyId ? 'copied' : ''}`}
              onClick={() => copyToClipboard(rowText, rowCopyId)}
            >
              {copiedSectionId === rowCopyId ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {isFieldEdited && (
            <div className="modified-badge">edited — click approve to save</div>
          )}
        </div>
      );
    });
  };

  const renderEditableField = (record, idx, fieldName, label, displayValue, sectionId, copyId) => {
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const canEdit = !!record._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const sentenceState = sectionWasEdited ? editedSentences[`${fieldName}-${idx}-s0`] : undefined;
    const recordStatus = statusOverrides[idx] || 'active';
    const isFieldEdited = sentenceState === 'edited' && recordStatus !== 'approved';
    const isPending = sentenceState && recordStatus !== 'approved';

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={fieldName}>
          {label && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <textarea
                ref={textareaRef}
                className="edit-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={Math.max(2, editValue.split('\n').length)}
                disabled={saving}
              />
              <div className="edit-actions">
                <button
                  className="edit-save-btn"
                  onClick={() => handleSaveField(record, fieldName, idx, sectionId)}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rec-mini-card" key={fieldName}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        {(() => {
          const _sentences = splitBySentence(displayValue);
          const _multi = _sentences.length > 1;
          const _rows = _multi ? _sentences.map(s => s + (s.endsWith('.') ? '' : '.')) : [displayValue];
          return _rows.map((rowText, sIdx) => {
            const rowCopyId = _multi ? `${copyId}-${sIdx}` : copyId;
            return (
              <div key={sIdx} className={`numbered-row ${isFieldEdited ? 'modified' : ''}`}>
                <div
                  className={`row-content ${canEdit ? 'editable' : ''}`}
                  onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue)}
                  title={canEdit ? 'Click to edit' : undefined}
                >
                  <span className="content-value">{highlightText(rowText)}</span>
                  {canEdit && !isPending && sIdx === 0 && (
                    <span className="edit-indicator">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        <path d="m15 5 4 4" />
                      </svg>
                      <span className="edit-tag">edit</span>
                    </span>
                  )}
                </div>
                <button
                  className={`copy-btn ${copiedSectionId === rowCopyId ? 'copied' : ''}`}
                  onClick={() => copyToClipboard(_multi ? rowText : displayValue, rowCopyId)}
                >
                  {copiedSectionId === rowCopyId ? 'Copied!' : 'Copy'}
                </button>
              </div>
            );
          });
        })()}
        {isFieldEdited && (
          <div className="modified-badge">edited — click approve to save</div>
        )}
      </div>
    );
  };

  // Helper: render an editable boolean field — Yes/No dropdown, stores true/false.
  const renderBooleanField = (record, idx, fieldName, label, boolValue, sectionId, copyId) => {
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const canEdit = !!record._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const sentenceState = sectionWasEdited ? editedSentences[`${fieldName}-${idx}-s0`] : undefined;
    const recordStatus = statusOverrides[idx] || 'active';
    const isFieldEdited = sentenceState === 'edited' && recordStatus !== 'approved';
    const isPending = sentenceState && recordStatus !== 'approved';
    const display = boolValue ? 'Yes' : 'No';

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={fieldName}>
          {label && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <select
                className="edit-select"
                value={editValue}
                autoFocus
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') handleCancelEdit(); }}
                disabled={saving}
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
              <div className="edit-actions">
                <button className="edit-save-btn" onClick={() => handleSaveBoolField(record, fieldName, idx, sectionId)} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rec-mini-card" key={fieldName}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isFieldEdited ? 'modified' : ''}`}>
          <div
            className={`row-content ${canEdit ? 'editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(fieldName, idx, display)}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span className="content-value">{highlightText(display)}</span>
            {canEdit && !isPending && (
              <span className="edit-indicator">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
                <span className="edit-tag">edit</span>
              </span>
            )}
          </div>
          <button
            className={`copy-btn ${copiedSectionId === copyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(`${label}: ${display}`, copyId)}
          >
            {copiedSectionId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && <div className="modified-badge">edited — click approve to save</div>}
      </div>
    );
  };

  // Helper: render an editable numeric field — −/+ stepper editing the RAW number; the read row
  // shows a formatted string (e.g. "0 hours", "0/10"). Stores a real number so Copy/PDF/backend
  // stay unchanged. opts: { min, max } clamp the stepper.
  const renderNumberField = (record, idx, fieldName, label, rawNumber, displayText, sectionId, copyId, opts = {}) => {
    const { min, max } = opts;
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const canEdit = !!record._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const sentenceState = sectionWasEdited ? editedSentences[`${fieldName}-${idx}-s0`] : undefined;
    const recordStatus = statusOverrides[idx] || 'active';
    const isFieldEdited = sentenceState === 'edited' && recordStatus !== 'approved';
    const isPending = sentenceState && recordStatus !== 'approved';
    const clamp = (n) => { if (min != null && n < min) n = min; if (max != null && n > max) n = max; return n; };
    const step = parseFloat(stepFor(rawNumber)) || 1;
    const dec = (String(step).split('.')[1] || '').length;
    const bump = (delta) => { const cur = parseFloat(editValue); setEditValue(clamp((isNaN(cur) ? 0 : cur) + delta).toFixed(dec)); };

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={fieldName}>
          {label && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={() => bump(-step)} disabled={saving}>−</button>
                <input
                  type="number"
                  className="edit-number"
                  value={editValue}
                  step={stepFor(rawNumber)}
                  min={min}
                  max={max}
                  autoFocus
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') handleCancelEdit();
                    if (e.key === 'Enter') { e.preventDefault(); handleSaveNumberField(record, fieldName, idx, sectionId); }
                  }}
                  disabled={saving}
                />
                <button type="button" className="num-step" onClick={() => bump(step)} disabled={saving}>+</button>
              </div>
              <div className="edit-actions">
                <button className="edit-save-btn" onClick={() => handleSaveNumberField(record, fieldName, idx, sectionId)} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rec-mini-card" key={fieldName}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isFieldEdited ? 'modified' : ''}`}>
          <div
            className={`row-content ${canEdit ? 'editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(fieldName, idx, String(rawNumber ?? ''))}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span className="content-value">{highlightText(displayText)}</span>
            {canEdit && !isPending && (
              <span className="edit-indicator">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
                <span className="edit-tag">edit</span>
              </span>
            )}
          </div>
          <button
            className={`copy-btn ${copiedSectionId === copyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(`${label}: ${displayText}`, copyId)}
          >
            {copiedSectionId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && <div className="modified-badge">edited — click approve to save</div>}
      </div>
    );
  };

  // Helper: render a comma-split field — each guarded comma part is its own editable row.
  const renderCommaSplitField = (record, idx, fieldName, label, displayValue, sectionId, copyId) => {
    if (!displayValue || !String(displayValue).trim()) return null;
    const parts = splitByComma(displayValue);
    if (parts.length <= 1) return renderEditableField(record, idx, fieldName, label, displayValue, sectionId, copyId);

    const canEdit = !!record._id;
    const recordStatus = statusOverrides[idx] || 'active';
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];

    return parts.map((part, pIdx) => {
      const editKey = `${fieldName}-${idx}-s${pIdx}`;
      const isEditing = editingField === editKey;
      const sentenceState = sectionWasEdited ? editedSentences[editKey] : undefined;
      const isFieldEdited = sentenceState === 'edited' && recordStatus !== 'approved';
      const isPending = sentenceState && recordStatus !== 'approved';
      const rowCopyId = `${copyId}-s${pIdx}`;

      if (isEditing) {
        return (
          <div className="rec-mini-card" key={`${fieldName}-s${pIdx}`}>
            {pIdx === 0 && label && <div className="nested-subtitle">{highlightText(label)}</div>}
            <div className="numbered-row edit-row">
              <div className="edit-field-container">
                <textarea
                  ref={textareaRef}
                  className="edit-textarea"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') handleCancelEdit();
                    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleSaveCommaField(record, fieldName, idx, sectionId, pIdx); }
                  }}
                  rows={Math.max(2, editValue.split('\n').length)}
                  disabled={saving}
                />
                <div className="edit-actions">
                  <button className="edit-save-btn" onClick={() => handleSaveCommaField(record, fieldName, idx, sectionId, pIdx)} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="rec-mini-card" key={`${fieldName}-s${pIdx}`}>
          {pIdx === 0 && label && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className={`numbered-row ${isFieldEdited ? 'modified' : ''}`}>
            <div
              className={`row-content ${canEdit ? 'editable' : ''}`}
              onClick={() => canEdit && handleStartSplitEdit(fieldName, idx, part, pIdx)}
              title={canEdit ? 'Click to edit' : undefined}
            >
              <span className="content-value">{highlightText(part)}</span>
              {canEdit && !isPending && (
                <span className="edit-indicator">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                  </svg>
                  <span className="edit-tag">edit</span>
                </span>
              )}
            </div>
            <button
              className={`copy-btn ${copiedSectionId === rowCopyId ? 'copied' : ''}`}
              onClick={() => copyToClipboard(part, rowCopyId)}
            >
              {copiedSectionId === rowCopyId ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {isFieldEdited && <div className="modified-badge">edited — click approve to save</div>}
        </div>
      );
    });
  };

  // Helper: render an editable Date field (date-picker, ISO save)
  const renderDateField = (record, idx, fieldName, label, dateValue, sectionId, copyId) => {
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const canEdit = !!record._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const sentenceState = sectionWasEdited ? editedSentences[`${fieldName}-${idx}-s0`] : undefined;
    const recordStatus = statusOverrides[idx] || 'active';
    const isFieldEdited = sentenceState === 'edited' && recordStatus !== 'approved';
    const isPending = sentenceState && recordStatus !== 'approved';
    const displayValue = formatDate(dateValue);

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={fieldName}>
          {label && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <input
                type="date"
                className="edit-date"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                ref={(el) => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }}
                onKeyDown={(e) => { if (e.key === 'Escape') handleCancelEdit(); }}
                disabled={saving}
              />
              <div className="edit-actions">
                <button
                  className="edit-save-btn"
                  onClick={() => {
                    if (!editValue || isNaN(new Date(editValue).getTime())) return;
                    handleSaveDateField(record, fieldName, idx, sectionId, editValue + 'T00:00:00.000Z');
                  }}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rec-mini-card" key={fieldName}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isFieldEdited ? 'modified' : ''}`}>
          <div
            className={`row-content ${canEdit ? 'editable' : ''}`}
            onClick={() => { if (canEdit) { setEditingField(editKey); setEditValue(toInputDate(dateValue)); } }}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isPending && (
              <span className="edit-indicator">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
                <span className="edit-tag">edit</span>
              </span>
            )}
          </div>
          <button
            className={`copy-btn ${copiedSectionId === copyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(`${label}: ${displayValue}`, copyId)}
          >
            {copiedSectionId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && (
          <div className="modified-badge">edited — click approve to save</div>
        )}
      </div>
    );
  };

  // Helper: render semicolon-split editable field — each item as its own editable row
  const renderSplitEditableField = (record, idx, fieldName, label, sectionId) => {
    const fullEditKey = `${fieldName}-${idx}`;
    const hasFullEdit = localEdits[fullEditKey] !== undefined;
    const sourceText = hasFullEdit ? localEdits[fullEditKey] : (record[fieldName] || '');

    if (!sourceText?.trim()) return null;

    const items = splitBySemicolon(sourceText);

    // If only one item, fall back to renderEditableField
    if (items.length <= 1) {
      return renderEditableField(record, idx, fieldName, label, sourceText, sectionId, `${record._id}-${fieldName}`);
    }

    const canEdit = !!record._id;
    const recordStatus = statusOverrides[idx] || 'active';
    const isSearching = searchTerm && searchTerm.trim();
    const searchLower = searchTerm?.toLowerCase().trim() || '';

    // Filter items by search (preserve original index)
    const visibleItems = items
      .map((item, origIdx) => ({ item, origIdx }))
      .filter(({ item }) => {
        if (!isSearching) return true;
        return item.toLowerCase().includes(searchLower) || label.toLowerCase().includes(searchLower);
      });

    if (visibleItems.length === 0) return null;

    return visibleItems.map(({ item, origIdx }) => {
      const editKey = `${fieldName}-${idx}-s${origIdx}`;
      const isEditing = editingField === editKey;
      const sectionKey = `${sectionId}-${idx}`;
      const sectionWasEdited = editedFields[sectionKey];
      const sentenceState = sectionWasEdited ? editedSentences[editKey] : undefined;
      const isFieldEdited = sentenceState === 'edited' && recordStatus !== 'approved';
      const isPending = sentenceState && recordStatus !== 'approved';

      if (isEditing) {
        return (
          <div className="rec-mini-card" key={`${fieldName}-s${origIdx}`}>
            {origIdx === 0 && label && <div className="nested-subtitle">{highlightText(label)}</div>}
            <div className="numbered-row edit-row">
              <div className="edit-field-container">
                <textarea
                  ref={textareaRef}
                  className="edit-textarea"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={Math.max(2, editValue.split('\n').length)}
                  disabled={saving}
                />
                <div className="edit-actions">
                  <button
                    className="edit-save-btn"
                    onClick={() => handleSaveSplitField(record, fieldName, idx, sectionId, origIdx)}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="rec-mini-card" key={`${fieldName}-s${origIdx}`}>
          {origIdx === 0 && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className={`numbered-row ${isFieldEdited ? 'modified' : ''}`}>
            <div
              className={`row-content ${canEdit ? 'editable' : ''}`}
              onClick={() => canEdit && handleStartSplitEdit(fieldName, idx, item, origIdx)}
              title={canEdit ? 'Click to edit' : undefined}
            >
              <span className="content-value">{highlightText(item)}</span>
              {canEdit && !isPending && (
                <span className="edit-indicator">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                  </svg>
                  <span className="edit-tag">edit</span>
                </span>
              )}
            </div>
            <button
              className={`copy-btn ${copiedSectionId === `${fieldName}-${idx}-s${origIdx}` ? 'copied' : ''}`}
              onClick={() => copyToClipboard(item, `${fieldName}-${idx}-s${origIdx}`)}
            >
              {copiedSectionId === `${fieldName}-${idx}-s${origIdx}` ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {isFieldEdited && (
            <div className="modified-badge">edited — click approve to save</div>
          )}
        </div>
      );
    });
  };

  // Helper: render editable array item
  const renderEditableArrayItem = (record, idx, fieldName, item, arrayIndex, sectionId, copyId) => {
    const editKey = `${fieldName}.${arrayIndex}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const canEdit = !!record._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const sentenceState = sectionWasEdited ? editedSentences[`${fieldName}.${arrayIndex}-${idx}-s0`] : undefined;
    const recordStatus = statusOverrides[idx] || 'active';
    const isFieldEdited = sentenceState === 'edited' && recordStatus !== 'approved';
    const isPending = sentenceState && recordStatus !== 'approved';
    const displayValue = getFieldValue(record, fieldName, idx, arrayIndex) || item;

    if (isEditing) {
      return (
        <div key={`${fieldName}-${arrayIndex}`} className="numbered-row edit-row">
          <div className="edit-field-container">
            <textarea
              ref={textareaRef}
              className="edit-textarea"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              rows={Math.max(2, editValue.split('\n').length)}
              disabled={saving}
            />
            <div className="edit-actions">
              <button
                className="edit-save-btn"
                onClick={() => handleSaveField(record, fieldName, idx, sectionId, arrayIndex)}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={`${fieldName}-${arrayIndex}`}>
        <div className={`numbered-row ${isFieldEdited ? 'modified' : ''}`}>
          <div
            className={`row-content ${canEdit ? 'editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue, arrayIndex)}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isPending && (
              <span className="edit-indicator">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
                <span className="edit-tag">edit</span>
              </span>
            )}
          </div>
          <button
            className={`copy-btn ${copiedSectionId === copyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(displayValue, copyId)}
          >
            {copiedSectionId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && (
          <div className="modified-badge">edited — click approve to save</div>
        )}
      </div>
    );
  };

  // Get all record text for copying (uses pdfData for edited values)
  const getAllRecordText = useCallback((record, recordIdx) => {
    const lines = [];
    lines.push(`CHIEF COMPLAINT ${recordIdx + 1}`);
    lines.push('═══════════════════════════════════════');

    const recordDate = getRecordDate(record);
    if (recordDate) lines.push(`Date: ${formatDate(recordDate)}`);

    if (record.primaryComplaint) {
      lines.push('');
      lines.push('PRIMARY COMPLAINT');
      lines.push('───────────────────────────────────────');
      splitByComma(record.primaryComplaint).forEach((s, i) => { lines.push(`${i + 1}. ${s}`); });
    }

    if (record.emergencySymptoms?.length > 0) {
      lines.push('');
      lines.push('EMERGENCY SYMPTOMS');
      lines.push('───────────────────────────────────────');
      record.emergencySymptoms.forEach((s, idx) => lines.push(`${idx + 1}. ${s}`));
    }

    if (record.secondaryComplaints?.length > 0) {
      lines.push('');
      lines.push('SECONDARY COMPLAINTS');
      lines.push('───────────────────────────────────────');
      record.secondaryComplaints.forEach((s, idx) => lines.push(`${idx + 1}. ${s}`));
    }

    if (hasValue(record.symptomOnsetDateTime) || hasValue(record.symptomDurationHours) || hasValue(record.symptomSeverity) ||
        hasValue(record.progressionPattern) || hasValue(record.triggeringEvent)) {
      lines.push('');
      lines.push('SYMPTOM DETAILS');
      lines.push('───────────────────────────────────────');
      if (hasValue(record.symptomOnsetDateTime)) lines.push(`Symptom Onset: ${formatDate(record.symptomOnsetDateTime)}`);
      if (hasValue(record.symptomDurationHours)) lines.push(`Duration: ${formatDuration(record.symptomDurationHours)}`);
      if (record.symptomSeverity) lines.push(`Severity: ${record.symptomSeverity}`);
      if (record.progressionPattern) {
        const progItems = splitBySemicolon(record.progressionPattern);
        if (progItems.length > 1) {
          lines.push('Progression:');
          progItems.forEach((item, i) => lines.push(`  ${i + 1}. ${item}`));
        } else {
          lines.push(`Progression: ${record.progressionPattern}`);
        }
      }
      if (record.triggeringEvent) {
        const trigItems = splitBySemicolon(record.triggeringEvent);
        if (trigItems.length > 1) {
          lines.push('Triggering Event:');
          trigItems.forEach((item, i) => lines.push(`  ${i + 1}. ${item}`));
        } else {
          lines.push(`Triggering Event: ${record.triggeringEvent}`);
        }
      }
    }

    if (record.associatedSymptoms?.length > 0) {
      lines.push('');
      lines.push('ASSOCIATED SYMPTOMS');
      lines.push('───────────────────────────────────────');
      record.associatedSymptoms.forEach((s, idx) => lines.push(`${idx + 1}. ${s}`));
    }

    if (hasValue(record.painScaleScore) || hasValue(record.painCharacter) ||
        hasValue(record.painLocation) || hasValue(record.painRadiation)) {
      lines.push('');
      lines.push('PAIN ASSESSMENT');
      lines.push('───────────────────────────────────────');
      if (hasValue(record.painScaleScore)) lines.push(`Pain Scale: ${record.painScaleScore}/10`);
      if (record.painCharacter) lines.push(`Character: ${record.painCharacter}`);
      if (record.painLocation) lines.push(`Location: ${record.painLocation}`);
      if (record.painRadiation) lines.push(`Radiation: ${record.painRadiation}`);
    }

    if (record.alleviatingFactors?.length > 0) {
      lines.push('');
      lines.push('ALLEVIATING FACTORS');
      lines.push('───────────────────────────────────────');
      record.alleviatingFactors.forEach((s, idx) => lines.push(`${idx + 1}. ${s}`));
    }

    if (record.aggravatingFactors?.length > 0) {
      lines.push('');
      lines.push('AGGRAVATING FACTORS');
      lines.push('───────────────────────────────────────');
      record.aggravatingFactors.forEach((s, idx) => lines.push(`${idx + 1}. ${s}`));
    }

    if (record.patientConcerns?.length > 0) {
      lines.push('');
      lines.push('PATIENT CONCERNS');
      lines.push('───────────────────────────────────────');
      record.patientConcerns.forEach((s, idx) => lines.push(`${idx + 1}. ${s}`));
    }

    if (record.functionalImpact) {
      lines.push('');
      lines.push('FUNCTIONAL IMPACT');
      lines.push('───────────────────────────────────────');
      const fiItems = splitBySemicolon(record.functionalImpact);
      if (fiItems.length > 1) {
        fiItems.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
      } else {
        lines.push(record.functionalImpact);
      }
    }

    if (hasValue(record.previousEpisodes) || hasValue(record.workRelated) || record.traumaHistory) {
      lines.push('');
      lines.push('HISTORY');
      lines.push('───────────────────────────────────────');
      if (hasValue(record.previousEpisodes)) lines.push(`Previous Episodes: ${record.previousEpisodes ? 'Yes' : 'No'}`);
      if (hasValue(record.workRelated)) lines.push(`Work Related: ${record.workRelated ? 'Yes' : 'No'}`);
      if (record.traumaHistory) lines.push(`Trauma History: ${record.traumaHistory}`);
    }

    if (record.recentMedicationChanges?.length > 0) {
      lines.push('');
      lines.push('RECENT MEDICATION CHANGES');
      lines.push('───────────────────────────────────────');
      record.recentMedicationChanges.forEach((s, idx) => lines.push(`${idx + 1}. ${s}`));
    }

    if (record.systemsReview?.length > 0) {
      lines.push('');
      lines.push('SYSTEMS REVIEW');
      lines.push('───────────────────────────────────────');
      record.systemsReview.forEach((s, idx) => lines.push(`${idx + 1}. ${s}`));
    }

    return lines.join('\n');
  }, []);

  // Render an array section (with per-item editable support)
  const renderArraySection = (record, recordIdx, sectionKey, sectionTitle, fieldName, items, sectionId, additionalKeywords = [], extraClassName = '') => {
    if (!items || items.length === 0) return null;

    const enhancedRecord = record;
    const isSearching = searchTerm && searchTerm.trim();
    const canEdit = !!record._id;
    const recordStatus = statusOverrides[recordIdx] || 'active';

    if (!shouldShowSection(enhancedRecord, sectionTitle, items, additionalKeywords)) return null;

    const sectionTitleMatches = (() => {
      if (!searchTerm.trim()) return true;
      if (enhancedRecord._showAllSections) return true;
      return shouldShowRow(enhancedRecord, sectionTitle, sectionTitle.toLowerCase(), sectionTitle.toUpperCase());
    })();

    const visibleItems = items.map((item, arrIdx) => ({ item, arrIdx })).filter(({ item }) => {
      if (!isSearching || enhancedRecord._showAllSections || sectionTitleMatches) return true;
      return shouldShowRow(enhancedRecord, item);
    });

    if (visibleItems.length === 0) return null;

    const getSectionText = () => {
      const lines = [sectionTitle.toUpperCase(), '═══════════════════════════════════════'];
      items.forEach((item, idx) => lines.push(`${idx + 1}. ${item}`));
      return lines.join('\n');
    };

    // Check if this section has pending edits
    const canApprove = canEdit && sectionHasEdits(sectionId, recordIdx);

    return (
      <div className="section" key={sectionKey}>
        <div className={`mini-cards-container ${extraClassName}`}>
          <div className="section-header">
            <h3 className={`section-title ${extraClassName ? 'emergency-title' : ''}`}>{highlightText(sectionTitle)}</h3>
            <div className="header-right-actions">
              <button
                className={`copy-btn ${copiedSectionId === `${sectionKey}-${recordIdx}` ? 'copied' : ''}`}
                onClick={() => copyToClipboard(getSectionText(), `${sectionKey}-${recordIdx}`)}
              >
                {copiedSectionId === `${sectionKey}-${recordIdx}` ? 'Copied!' : 'Copy Section'}
              </button>
              {(canApprove || approvedSections[sectionId]) && (
                <button
                  className={`approve-btn${approvedSections[sectionId] ? ' approved' : ''}`}
                  onClick={() => handleApprove(record, recordIdx, sectionId)}
                  disabled={approving}
                >
                  {approving ? 'Approving...' : approvedSections[sectionId] ? 'Approved' : 'Approve'}
                </button>
              )}
            </div>
          </div>

          {visibleItems.map(({ item, arrIdx }) => {
            const displayValue = getFieldValue(record, fieldName, recordIdx, arrIdx) || item;
            return renderEditableArrayItem(
              record, recordIdx, fieldName, displayValue, arrIdx, sectionId,
              `${sectionKey}-item-${recordIdx}-${arrIdx}`
            );
          })}
        </div>
      </div>
    );
  };

  // Render record
  const renderRecord = (record, recordIdx) => {
    const isSearching = searchTerm && searchTerm.trim();
    const searchLower = searchTerm?.toLowerCase().trim() || '';

    // Build searchable text for document-level filtering
    const recordDate = getRecordDate(record);
    const searchableText = [
      'Chief Complaint', 'chief complaint', 'CHIEF COMPLAINT',
      `Chief Complaint ${recordIdx + 1}`,
      formatDate(recordDate),
      formatDate(record.symptomOnsetDateTime),
      record.primaryComplaint,
      ...(record.secondaryComplaints || []),
      record.symptomSeverity,
      record.progressionPattern,
      record.triggeringEvent,
      ...(record.associatedSymptoms || []),
      ...(record.emergencySymptoms || []),
      record.painCharacter,
      record.painLocation,
      record.painRadiation,
      ...(record.alleviatingFactors || []),
      ...(record.aggravatingFactors || []),
      ...(record.patientConcerns || []),
      record.functionalImpact,
      record.traumaHistory,
      ...(record.recentMedicationChanges || []),
      ...(record.systemsReview || []),
      // Section titles
      'Primary Complaint', 'primary complaint',
      'Secondary Complaints', 'secondary complaints',
      'Symptom Details', 'symptom details',
      'Associated Symptoms', 'associated symptoms',
      'Emergency Symptoms', 'emergency symptoms',
      'Pain Assessment', 'pain assessment',
      'Alleviating Factors', 'alleviating factors',
      'Aggravating Factors', 'aggravating factors',
      'Patient Concerns', 'patient concerns',
      'Functional Impact', 'functional impact',
      'History', 'history',
      'Medication Changes', 'medication changes',
      'Systems Review', 'systems review',
      // Field labels
      'Symptom Onset', 'symptom onset', 'onset',
      'Duration', 'Severity', 'Progression', 'Triggering Event',
      'Pain Scale', 'Character', 'Location', 'Radiation',
      'Previous Episodes', 'Work Related', 'Trauma History',
    ].filter(Boolean).join(' ').toLowerCase();

    if (isSearching && !searchableText.includes(searchLower)) {
      return null;
    }

    // Determine if document title search (show all sections)
    let showAllSections = false;
    if (isSearching) {
      const recordNumber = String(recordIdx + 1);
      const titlePatterns = [
        /^chief\s+complaint(\s+\d+)?$/i,
        /^complaint\s+\d+$/i,
        new RegExp(`^${recordNumber}$`)
      ];
      if (titlePatterns.some(p => p.test(searchLower))) {
        showAllSections = true;
      }
    }

    const enhancedRecord = { ...record, _showAllSections: showAllSections };
    const canEdit = !!record._id;

    // Check for sections with data
    const hasSymptomDetails = hasValue(record.symptomOnsetDateTime) || hasValue(record.symptomDurationHours) || hasValue(record.symptomSeverity) ||
                              hasValue(record.progressionPattern) || hasValue(record.triggeringEvent);
    const hasPainAssessment = hasValue(record.painScaleScore) || hasValue(record.painCharacter) ||
                              hasValue(record.painLocation) || hasValue(record.painRadiation);
    const hasHistory = hasValue(record.previousEpisodes) || hasValue(record.workRelated) || hasValue(record.traumaHistory);

    // Use pdfData for copy text
    const pdfRecord = pdfData[recordIdx] || record;

    return (
      <div key={record._id?.$oid || recordIdx} className="chief-complaints-record">
        {/* Record Header */}
        <div className="record-header">
          <div className="header-top-row">
            {recordDate && (
              <span className="date-badge">{formatDate(recordDate)}</span>
            )}
          </div>
          <h2 className="record-title">
            {highlightText(`Chief Complaint ${recordIdx + 1}`)}
          </h2>
        </div>

        {/* Primary Complaint - Highlighted Section (editable string) */}
        {hasValue(record.primaryComplaint) && shouldShowSection(enhancedRecord, 'Primary Complaint',
          record.primaryComplaint, ['primary', 'complaint', 'main complaint']
        ) && (() => {
          const primaryVal = getFieldValue(record, 'primaryComplaint', recordIdx) || record.primaryComplaint;
          const canApproveSection = canEdit && sectionHasEdits('primaryComplaintInfo', recordIdx);

          return (
            <div className="section">
              <div className="mini-cards-container primary-complaint-box">
                <div className="section-header">
                  <h3 className="section-title">{highlightText('Primary Complaint')}</h3>
                  <div className="header-right-actions">
                    <button
                      className={`copy-btn ${copiedSectionId === `primary-${recordIdx}` ? 'copied' : ''}`}
                      onClick={() => copyToClipboard(splitByComma(primaryVal).map((s, i) => `${i + 1}. ${s}`).join('\n'), `primary-${recordIdx}`)}
                    >
                      {copiedSectionId === `primary-${recordIdx}` ? 'Copied!' : 'Copy Section'}
                    </button>
                    {(canApproveSection || approvedSections['primaryComplaintInfo']) && (
                      <button
                        className={`approve-btn${approvedSections['primaryComplaintInfo'] ? ' approved' : ''}`}
                        onClick={() => handleApprove(record, recordIdx, 'primaryComplaintInfo')}
                        disabled={approving}
                      >
                        {approving ? 'Approving...' : approvedSections['primaryComplaintInfo'] ? 'Approved' : 'Approve'}
                      </button>
                    )}
                  </div>
                </div>
                {renderCommaSplitField(record, recordIdx, 'primaryComplaint', null, primaryVal, 'primaryComplaintInfo', `${record._id}-primaryComplaint`)}
              </div>
            </div>
          );
        })()}

        {/* Emergency Symptoms - CRITICAL: array editable */}
        {renderArraySection(enhancedRecord, recordIdx, 'emergency', 'Emergency Symptoms',
          'emergencySymptoms', record.emergencySymptoms, 'emergencySymptomsInfo',
          ['emergency', 'urgent', 'warning'], 'emergency-section')}

        {/* Secondary Complaints - array editable */}
        {renderArraySection(enhancedRecord, recordIdx, 'secondary', 'Secondary Complaints',
          'secondaryComplaints', record.secondaryComplaints, 'secondaryComplaintsInfo',
          ['additional', 'other complaints'])}

        {/* Symptom Details Section (mixed: editable strings + read-only duration) */}
        {hasSymptomDetails && shouldShowSection(enhancedRecord, 'Symptom Details',
          [record.symptomSeverity, record.progressionPattern, record.triggeringEvent,
           formatDuration(record.symptomDurationHours), formatDate(record.symptomOnsetDateTime)].filter(Boolean).join(' '),
          ['duration', 'severity', 'progression', 'trigger', 'onset', 'symptom onset']
        ) && (() => {
          const sectionTitleMatches = (() => {
            if (!searchTerm.trim()) return true;
            if (enhancedRecord._showAllSections) return true;
            return shouldShowRow(enhancedRecord, 'Symptom Details', 'symptom details');
          })();

          const showOnset = enhancedRecord._showAllSections || sectionTitleMatches ||
            shouldShowRow(enhancedRecord, 'Symptom Onset', 'onset', formatDate(record.symptomOnsetDateTime));
          const showDuration = enhancedRecord._showAllSections || sectionTitleMatches ||
            shouldShowRow(enhancedRecord, 'Duration', 'duration', formatDuration(record.symptomDurationHours));
          const showSeverity = enhancedRecord._showAllSections || sectionTitleMatches ||
            shouldShowRow(enhancedRecord, 'Severity', 'severity', record.symptomSeverity);
          const showProgression = enhancedRecord._showAllSections || sectionTitleMatches ||
            shouldShowRow(enhancedRecord, 'Progression', 'progression', record.progressionPattern);
          const showTrigger = enhancedRecord._showAllSections || sectionTitleMatches ||
            shouldShowRow(enhancedRecord, 'Triggering Event', 'trigger', record.triggeringEvent);

          if (isSearching && !showOnset && !showDuration && !showSeverity && !showProgression && !showTrigger) return null;

          const getSectionText = () => {
            const lines = ['SYMPTOM DETAILS', '═══════════════════════════════════════'];
            if (hasValue(record.symptomOnsetDateTime)) lines.push(`Symptom Onset: ${formatDate(record.symptomOnsetDateTime)}`);
            if (hasValue(record.symptomDurationHours)) lines.push(`Duration: ${formatDuration(record.symptomDurationHours)}`);
            if (record.symptomSeverity) lines.push(`Severity: ${record.symptomSeverity}`);
            if (record.progressionPattern) {
              const progItems = splitBySemicolon(record.progressionPattern);
              if (progItems.length > 1) {
                lines.push('Progression:');
                progItems.forEach((item, i) => lines.push(`  ${i + 1}. ${item}`));
              } else {
                lines.push(`Progression: ${record.progressionPattern}`);
              }
            }
            if (record.triggeringEvent) {
              const trigItems = splitBySemicolon(record.triggeringEvent);
              if (trigItems.length > 1) {
                lines.push('Triggering Event:');
                trigItems.forEach((item, i) => lines.push(`  ${i + 1}. ${item}`));
              } else {
                lines.push(`Triggering Event: ${record.triggeringEvent}`);
              }
            }
            return lines.join('\n');
          };

          const canApproveSection = canEdit && sectionHasEdits('symptomDetailsInfo', recordIdx);

          return (
            <div className="section">
              <div className="mini-cards-container">
                <div className="section-header">
                  <h3 className="section-title">{highlightText('Symptom Details')}</h3>
                  <div className="header-right-actions">
                    <button
                      className={`copy-btn ${copiedSectionId === `symptom-details-${recordIdx}` ? 'copied' : ''}`}
                      onClick={() => copyToClipboard(getSectionText(), `symptom-details-${recordIdx}`)}
                    >
                      {copiedSectionId === `symptom-details-${recordIdx}` ? 'Copied!' : 'Copy Section'}
                    </button>
                    {(canApproveSection || approvedSections['symptomDetailsInfo']) && (
                      <button
                        className={`approve-btn${approvedSections['symptomDetailsInfo'] ? ' approved' : ''}`}
                        onClick={() => handleApprove(record, recordIdx, 'symptomDetailsInfo')}
                        disabled={approving}
                      >
                        {approving ? 'Approving...' : approvedSections['symptomDetailsInfo'] ? 'Approved' : 'Approve'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Symptom Onset — editable date (date-picker, ISO save) */}
                {hasValue(record.symptomOnsetDateTime) && showOnset &&
                  renderDateField(record, recordIdx, 'symptomOnsetDateTime', 'Symptom Onset',
                    getFieldValue(record, 'symptomOnsetDateTime', recordIdx) || record.symptomOnsetDateTime,
                    'symptomDetailsInfo', `onset-${recordIdx}`)}

                {/* Duration — editable number stepper (raw hours), displays formatted */}
                {hasValue(getFieldValue(record, 'symptomDurationHours', recordIdx)) && showDuration &&
                  renderNumberField(record, recordIdx, 'symptomDurationHours', 'Duration',
                    getFieldValue(record, 'symptomDurationHours', recordIdx),
                    formatDuration(getFieldValue(record, 'symptomDurationHours', recordIdx)),
                    'symptomDetailsInfo', `duration-${recordIdx}`, { min: 0 })}

                {/* Severity — editable */}
                {hasValue(record.symptomSeverity) && showSeverity &&
                  renderEditableField(record, recordIdx, 'symptomSeverity', 'Severity',
                    getFieldValue(record, 'symptomSeverity', recordIdx) || record.symptomSeverity,
                    'symptomDetailsInfo', `severity-${recordIdx}`)}

                {/* Progression — semicolon-split editable */}
                {hasValue(record.progressionPattern) && showProgression &&
                  renderSplitEditableField(record, recordIdx, 'progressionPattern', 'Progression',
                    'symptomDetailsInfo')}

                {/* Triggering Event — semicolon-split editable */}
                {hasValue(record.triggeringEvent) && showTrigger &&
                  renderSplitEditableField(record, recordIdx, 'triggeringEvent', 'Triggering Event',
                    'symptomDetailsInfo')}
              </div>
            </div>
          );
        })()}

        {/* Associated Symptoms — array editable */}
        {renderArraySection(enhancedRecord, recordIdx, 'associated', 'Associated Symptoms',
          'associatedSymptoms', record.associatedSymptoms, 'associatedSymptomsInfo',
          ['symptoms', 'related symptoms'])}

        {/* Pain Assessment Section (mixed: editable strings + read-only painScaleScore) */}
        {hasPainAssessment && shouldShowSection(enhancedRecord, 'Pain Assessment',
          [record.painCharacter, record.painLocation, record.painRadiation,
           hasValue(record.painScaleScore) ? `${record.painScaleScore}/10` : ''].filter(Boolean).join(' '),
          ['pain', 'pain scale', 'location', 'character']
        ) && (() => {
          const sectionTitleMatches = (() => {
            if (!searchTerm.trim()) return true;
            if (enhancedRecord._showAllSections) return true;
            return shouldShowRow(enhancedRecord, 'Pain Assessment', 'pain assessment', 'pain');
          })();

          const showScale = enhancedRecord._showAllSections || sectionTitleMatches ||
            shouldShowRow(enhancedRecord, 'Pain Scale', 'pain scale', record.painScaleScore);
          const showCharacter = enhancedRecord._showAllSections || sectionTitleMatches ||
            shouldShowRow(enhancedRecord, 'Character', 'character', record.painCharacter);
          const showLocation = enhancedRecord._showAllSections || sectionTitleMatches ||
            shouldShowRow(enhancedRecord, 'Location', 'location', record.painLocation);
          const showRadiation = enhancedRecord._showAllSections || sectionTitleMatches ||
            shouldShowRow(enhancedRecord, 'Radiation', 'radiation', record.painRadiation);

          if (isSearching && !showScale && !showCharacter && !showLocation && !showRadiation) return null;

          const getSectionText = () => {
            const lines = ['PAIN ASSESSMENT', '═══════════════════════════════════════'];
            if (hasValue(record.painScaleScore)) lines.push(`Pain Scale: ${record.painScaleScore}/10`);
            if (record.painCharacter) lines.push(`Character: ${record.painCharacter}`);
            if (record.painLocation) lines.push(`Location: ${record.painLocation}`);
            if (record.painRadiation) lines.push(`Radiation: ${record.painRadiation}`);
            return lines.join('\n');
          };

          const canApproveSection = canEdit && sectionHasEdits('painAssessmentInfo', recordIdx);

          return (
            <div className="section">
              <div className="mini-cards-container">
                <div className="section-header">
                  <h3 className="section-title">{highlightText('Pain Assessment')}</h3>
                  <div className="header-right-actions">
                    <button
                      className={`copy-btn ${copiedSectionId === `pain-${recordIdx}` ? 'copied' : ''}`}
                      onClick={() => copyToClipboard(getSectionText(), `pain-${recordIdx}`)}
                    >
                      {copiedSectionId === `pain-${recordIdx}` ? 'Copied!' : 'Copy Section'}
                    </button>
                    {(canApproveSection || approvedSections['painAssessmentInfo']) && (
                      <button
                        className={`approve-btn${approvedSections['painAssessmentInfo'] ? ' approved' : ''}`}
                        onClick={() => handleApprove(record, recordIdx, 'painAssessmentInfo')}
                        disabled={approving}
                      >
                        {approving ? 'Approving...' : approvedSections['painAssessmentInfo'] ? 'Approved' : 'Approve'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Pain Scale — editable number stepper (0-10), displays "N/10" */}
                {hasValue(getFieldValue(record, 'painScaleScore', recordIdx)) && showScale &&
                  renderNumberField(record, recordIdx, 'painScaleScore', 'Pain Scale',
                    getFieldValue(record, 'painScaleScore', recordIdx),
                    `${getFieldValue(record, 'painScaleScore', recordIdx)}/10`,
                    'painAssessmentInfo', `pain-scale-${recordIdx}`, { min: 0, max: 10 })}

                {/* Character — editable */}
                {hasValue(record.painCharacter) && showCharacter &&
                  renderEditableField(record, recordIdx, 'painCharacter', 'Character',
                    getFieldValue(record, 'painCharacter', recordIdx) || record.painCharacter,
                    'painAssessmentInfo', `pain-char-${recordIdx}`)}

                {/* Location — editable */}
                {hasValue(record.painLocation) && showLocation &&
                  renderEditableField(record, recordIdx, 'painLocation', 'Location',
                    getFieldValue(record, 'painLocation', recordIdx) || record.painLocation,
                    'painAssessmentInfo', `pain-loc-${recordIdx}`)}

                {/* Radiation — editable */}
                {hasValue(record.painRadiation) && showRadiation &&
                  renderEditableField(record, recordIdx, 'painRadiation', 'Radiation',
                    getFieldValue(record, 'painRadiation', recordIdx) || record.painRadiation,
                    'painAssessmentInfo', `pain-rad-${recordIdx}`)}
              </div>
            </div>
          );
        })()}

        {/* Alleviating Factors — array editable */}
        {renderArraySection(enhancedRecord, recordIdx, 'alleviating', 'Alleviating Factors',
          'alleviatingFactors', record.alleviatingFactors, 'alleviatingFactorsInfo',
          ['alleviating', 'relief', 'helps'])}

        {/* Aggravating Factors — array editable */}
        {renderArraySection(enhancedRecord, recordIdx, 'aggravating', 'Aggravating Factors',
          'aggravatingFactors', record.aggravatingFactors, 'aggravatingFactorsInfo',
          ['aggravating', 'worsens', 'makes worse'])}

        {/* Patient Concerns — array editable */}
        {renderArraySection(enhancedRecord, recordIdx, 'concerns', 'Patient Concerns',
          'patientConcerns', record.patientConcerns, 'patientConcernsInfo',
          ['concerns', 'worries', 'patient'])}

        {/* Functional Impact — editable string */}
        {hasValue(record.functionalImpact) && shouldShowSection(enhancedRecord, 'Functional Impact',
          record.functionalImpact, ['functional', 'impact', 'daily activities']
        ) && (() => {
          const functionalVal = getFieldValue(record, 'functionalImpact', recordIdx) || record.functionalImpact;
          const canApproveSection = canEdit && sectionHasEdits('functionalImpactInfo', recordIdx);

          return (
            <div className="section">
              <div className="mini-cards-container">
                <div className="section-header">
                  <h3 className="section-title">{highlightText('Functional Impact')}</h3>
                  <div className="header-right-actions">
                    <button
                      className={`copy-btn ${copiedSectionId === `functional-${recordIdx}` ? 'copied' : ''}`}
                      onClick={() => {
                        const fiItems = splitBySemicolon(functionalVal);
                        const fiText = fiItems.length > 1
                          ? 'FUNCTIONAL IMPACT\n═══════════════════════════════════════\n' + fiItems.map((item, i) => `${i + 1}. ${item}`).join('\n')
                          : `Functional Impact: ${functionalVal}`;
                        copyToClipboard(fiText, `functional-${recordIdx}`);
                      }}
                    >
                      {copiedSectionId === `functional-${recordIdx}` ? 'Copied!' : 'Copy Section'}
                    </button>
                    {(canApproveSection || approvedSections['functionalImpactInfo']) && (
                      <button
                        className={`approve-btn${approvedSections['functionalImpactInfo'] ? ' approved' : ''}`}
                        onClick={() => handleApprove(record, recordIdx, 'functionalImpactInfo')}
                        disabled={approving}
                      >
                        {approving ? 'Approving...' : approvedSections['functionalImpactInfo'] ? 'Approved' : 'Approve'}
                      </button>
                    )}
                  </div>
                </div>
                {renderSplitEditableField(record, recordIdx, 'functionalImpact', null, 'functionalImpactInfo')}
              </div>
            </div>
          );
        })()}

        {/* History Section (mixed: read-only booleans + editable traumaHistory) */}
        {hasHistory && shouldShowSection(enhancedRecord, 'History',
          [record.previousEpisodes ? 'Yes' : 'No', record.workRelated ? 'Yes' : 'No', record.traumaHistory].filter(Boolean).join(' '),
          ['history', 'previous', 'Previous Episodes', 'previous episodes', 'work related', 'Work Related', 'trauma', 'Trauma History', 'trauma history']
        ) && (() => {
          const sectionTitleMatches = (() => {
            if (!searchTerm.trim()) return true;
            if (enhancedRecord._showAllSections) return true;
            return shouldShowRow(enhancedRecord, 'History', 'history');
          })();

          const showPrevious = enhancedRecord._showAllSections || sectionTitleMatches ||
            shouldShowRow(enhancedRecord, 'Previous Episodes', 'previous episodes');
          const showWorkRelated = enhancedRecord._showAllSections || sectionTitleMatches ||
            shouldShowRow(enhancedRecord, 'Work Related', 'work related');
          const showTrauma = enhancedRecord._showAllSections || sectionTitleMatches ||
            shouldShowRow(enhancedRecord, 'Trauma History', 'trauma history', record.traumaHistory);

          if (isSearching && !showPrevious && !showWorkRelated && !showTrauma) return null;

          const getSectionText = () => {
            const lines = ['HISTORY', '═══════════════════════════════════════'];
            if (hasValue(record.previousEpisodes)) lines.push(`Previous Episodes: ${record.previousEpisodes ? 'Yes' : 'No'}`);
            if (hasValue(record.workRelated)) lines.push(`Work Related: ${record.workRelated ? 'Yes' : 'No'}`);
            if (record.traumaHistory) lines.push(`Trauma History: ${record.traumaHistory}`);
            return lines.join('\n');
          };

          const canApproveSection = canEdit && sectionHasEdits('historyInfo', recordIdx);

          return (
            <div className="section">
              <div className="mini-cards-container">
                <div className="section-header">
                  <h3 className="section-title">{highlightText('History')}</h3>
                  <div className="header-right-actions">
                    <button
                      className={`copy-btn ${copiedSectionId === `history-${recordIdx}` ? 'copied' : ''}`}
                      onClick={() => copyToClipboard(getSectionText(), `history-${recordIdx}`)}
                    >
                      {copiedSectionId === `history-${recordIdx}` ? 'Copied!' : 'Copy Section'}
                    </button>
                    {(canApproveSection || approvedSections['historyInfo']) && (
                      <button
                        className={`approve-btn${approvedSections['historyInfo'] ? ' approved' : ''}`}
                        onClick={() => handleApprove(record, recordIdx, 'historyInfo')}
                        disabled={approving}
                      >
                        {approving ? 'Approving...' : approvedSections['historyInfo'] ? 'Approved' : 'Approve'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Previous Episodes — editable boolean (Yes/No) */}
                {hasValue(getFieldValue(record, 'previousEpisodes', recordIdx)) && showPrevious &&
                  renderBooleanField(record, recordIdx, 'previousEpisodes', 'Previous Episodes',
                    getFieldValue(record, 'previousEpisodes', recordIdx), 'historyInfo', `prev-${recordIdx}`)}

                {/* Work Related — editable boolean (Yes/No) */}
                {hasValue(getFieldValue(record, 'workRelated', recordIdx)) && showWorkRelated &&
                  renderBooleanField(record, recordIdx, 'workRelated', 'Work Related',
                    getFieldValue(record, 'workRelated', recordIdx), 'historyInfo', `work-${recordIdx}`)}

                {/* Trauma History — editable string */}
                {hasValue(record.traumaHistory) && showTrauma &&
                  renderEditableField(record, recordIdx, 'traumaHistory', 'Trauma History',
                    getFieldValue(record, 'traumaHistory', recordIdx) || record.traumaHistory,
                    'historyInfo', `trauma-${recordIdx}`)}
              </div>
            </div>
          );
        })()}

        {/* Recent Medication Changes — array editable */}
        {renderArraySection(enhancedRecord, recordIdx, 'med-changes', 'Recent Medication Changes',
          'recentMedicationChanges', record.recentMedicationChanges, 'medicationChangesInfo',
          ['medication', 'changes', 'drugs'])}

        {/* Systems Review — array editable */}
        {renderArraySection(enhancedRecord, recordIdx, 'systems', 'Systems Review',
          'systemsReview', record.systemsReview, 'systemsReviewInfo',
          ['systems', 'review', 'ros'])}

      </div>
    );
  };

  // No data state
  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <div className="chief-complaints-document">
        <div className="no-data">No chief complaint records available.</div>
      </div>
    );
  }

  return (
    <div className="chief-complaints-document">
      {/* Document Header - Three Row Layout */}
      <header className="document-header">
        {/* Row 1: Title */}
        <h1 className="document-title">Chief Complaints</h1>

        {/* Row 2: Action Buttons (right-aligned) */}
        <div className="header-actions">
          <button
            className={`copy-btn ${copiedSectionId === 'all-documents' ? 'copied' : ''}`}
            onClick={() => {
              const allText = pdfData.map((r, i) => getAllRecordText(r, i)).join('\n\n');
              copyToClipboard(allText, 'all-documents');
            }}
          >
            {copiedSectionId === 'all-documents' ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<ChiefComplaintsDocumentPDFTemplate document={pdfData} />}
            fileName="chief-complaints.pdf"
            className="pdf-btn"
          >
            {({ loading }) => (loading ? 'Preparing...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>

        {/* Row 3: Search Bar (100% width) */}
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search: primary complaint, symptoms, severity, pain..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')}>x</button>
          )}
        </div>
      </header>

      {/* Records */}
      <div className="records-container">
        {unwrappedData.map((record, idx) => renderRecord(record, idx))}
      </div>
    </div>
  );
};

export default ChiefComplaintsDocument;
