import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import TreatmentCoursesPDFTemplate from '../pdf-templates/TreatmentCoursesPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './TreatmentCoursesDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'treatment_coursesPendingEdits';
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
 * TreatmentCoursesDocument - February 2026 Standards
 *
 * Blue-only mini-card pattern with 4-level search:
 * - Level 1: searchableText (document-level)
 * - Level 2: shouldShowSection (section-level)
 * - Level 3: sectionTitleMatches IIFE (title matching)
 * - Level 4: shouldShowRow (row-level)
 *
 * Font hierarchy: section-title 19px > nested-subtitle 17px > content-value 14px
 * Inline editing support for all text fields
 * Per-sentence editing for notes field
 * Array element editing for recommendations field
 */
const TreatmentCoursesDocument = ({ document, data }) => {
  const templateData = document || data;
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [statusOverrides, setStatusOverrides] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const textareaRef = useRef(null);

  // Data unwrapping
  const unwrappedData = useMemo(() => {
    if (!templateData) return [];
    const docData = templateData?.documentData || templateData?.data || templateData;
    const records = docData?.treatment_courses || (Array.isArray(docData) ? docData : [docData]);
    return records.filter(r => r && (r.type || r.findings || r.notes || r.assessment));
  }, [templateData]);

  // Map a base field name to its render sectionId (so rehydrated drafts re-flag the right section).
  const fieldToSectionId = useCallback((baseField) => {
    switch (baseField) {
      case 'reportDate': case 'provider': case 'facility': return 'providerDetails';
      case 'type': case 'reportType': case 'urgency': case 'status': return 'reportDetails';
      case 'clinicalIndication': return 'indication';
      case 'findings': return 'findings';
      case 'assessment': return 'assessment';
      case 'plan': return 'plan';
      case 'recommendations': return 'recommendations';
      case 'results': return 'results';
      case 'notes': return 'notes';
      case 'followUp': return 'followup';
      default: return baseField;
    }
  }, []);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nStatus = {};
    unwrappedData.forEach((record, idx) => {
      const recId = record && record._id
        ? (typeof record._id === 'object' && record._id.$oid ? record._id.$oid : record._id)
        : null;
      const recDrafts = recId ? store[recId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // base field name (strip a numeric arrayIndex suffix if present)
        const lastDot = fieldPart.lastIndexOf('.');
        const baseField = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1)))
          ? fieldPart.slice(0, lastDot) : fieldPart;
        const sectionId = fieldToSectionId(baseField);
        nFields[`${sectionId}-${idx}`] = true;
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
  }, [unwrappedData, fieldToSectionId]);

  // Format date helper
  const formatDate = useCallback((dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }, []);

  // Split by sentence for notes (MUST be useCallback BEFORE pdfData)
  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    // Protect common abbreviations
    let protected_text = text
      .replace(/Mr\./g, 'Mr<DOT>')
      .replace(/Mrs\./g, 'Mrs<DOT>')
      .replace(/Dr\./g, 'Dr<DOT>')
      .replace(/vs\./g, 'vs<DOT>')
      .replace(/i\.e\./g, 'i<DOT>e<DOT>')
      .replace(/e\.g\./g, 'e<DOT>g<DOT>')
      .replace(/(\d)\.(\d)/g, '$1<DOT>$2');

    return protected_text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.replace(/<DOT>/g, '.').trim())
      .filter(s => s.length > 0);
  }, []);

  // Highlight search term
  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || !text) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = String(text).split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="search-highlight">{part}</mark> : part
    );
  }, [searchTerm]);

  // Check if value exists
  const hasValue = (val) => {
    if (val === null || val === undefined) return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'string') return val.trim() !== '';
    return true;
  };

  // Level 4: shouldShowRow
  const shouldShowRow = useCallback((record, ...valuesToCheck) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    for (const val of valuesToCheck) {
      if (val && String(val).toLowerCase().includes(phrase)) {
        return true;
      }
    }
    return false;
  }, [searchTerm]);

  // Level 2: shouldShowSection
  const shouldShowSection = useCallback((record, sectionTitle, contentToCheck, additionalKeywords = []) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const titleLower = sectionTitle.toLowerCase();
    if (titleLower.includes(phrase) || phrase.includes(titleLower)) return true;
    for (const kw of additionalKeywords) {
      if (kw.toLowerCase().includes(phrase)) return true;
    }
    const content = (contentToCheck || '').toLowerCase();
    return content.includes(phrase);
  }, [searchTerm]);

  // Copy to clipboard - use window.document to avoid shadowing from 'document' prop
  const copyToClipboard = useCallback((text, id) => {
    const textarea = window.document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    window.document.body.appendChild(textarea);
    textarea.select();
    try {
      window.document.execCommand('copy');
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
    window.document.body.removeChild(textarea);
  }, []);

  // --- Editing handlers ---

  const handleStartEdit = useCallback((fieldName, idx, currentValue, sentenceIdx = 0) => {
    const editKey = `${fieldName}-${idx}-s${sentenceIdx}`;
    setEditingField(editKey);
    setEditValue(currentValue || '');
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue('');
  }, []);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApprove commits).
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, arrayIndex, valueOverride, sentenceIdx) => {
    const recId = record && record._id
      ? (typeof record._id === 'object' && record._id.$oid ? record._id.$oid : record._id)
      : null;
    if (!recId) return;
    const saveValue = (valueOverride !== undefined ? valueOverride : editValue.trim());
    const fieldPart = (typeof arrayIndex === 'number') ? `${fieldName}.${arrayIndex}` : fieldName;
    const editKey = `${fieldPart}-${idx}`;
    const sKey = `${fieldName}-${idx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;

    setLocalEdits(prev => ({ ...prev, [editKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));

    const store = readDrafts();
    if (!store[recId]) store[recId] = {};
    store[recId][fieldPart] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this record to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApprove = useCallback(async (record, idx) => {
    const recId = record && record._id
      ? (typeof record._id === 'object' && record._id.$oid ? record._id.$oid : record._id)
      : null;
    if (!recId) return;
    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements).
      // arrayIndex applies ONLY when the trailing dot-segment is purely numeric (e.g. "recommendations.2");
      // a "notes.s0" overlay key is display-only and stays a non-numeric fieldPart.
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field", "field.idx", or "notes.sN" overlay
        const lastDot = fieldPart.lastIndexOf('.');
        const isArrayElem = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        const payload = { field: isArrayElem ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArrayElem) payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        const resp = await secureApiClient.put(`/api/edit/treatment_courses/${recId}/edit`, payload);
        if (!resp || !resp.success) throw new Error((resp && resp.error) || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/treatment_courses/${recId}/approve`);

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[recId]) { delete store[recId]; writeDrafts(store); }

      setStatusOverrides(prev => ({ ...prev, [idx]: 'approved' }));
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
      console.error('[TreatmentCourses] Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  const getFieldValue = useCallback((record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    return record[fieldName];
  }, [localEdits]);

  // pdfData memo - merge local edits into data for PDF and Copy All
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return unwrappedData;
    return unwrappedData.map((rec, idx) => {
      const merged = { ...rec };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        // Skip per-sentence overlay keys
        if (editKey.match(/\.s\d+-/)) continue;
        const dashIdx = editKey.lastIndexOf('-');
        const fieldName = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx === idx) {
          if (fieldName.includes('.')) {
            const [arrField, arrIdxStr] = fieldName.split('.');
            const arrIdx = parseInt(arrIdxStr, 10);
            if (Array.isArray(merged[arrField])) {
              merged[arrField] = [...merged[arrField]];
              merged[arrField][arrIdx] = editVal;
            }
          } else {
            merged[fieldName] = editVal;
          }
        }
      }
      // Pre-compute sentences with per-sentence overlays for stable splitting
      if (rec.notes) {
        const originalSentences = splitBySentence(rec.notes);
        merged._notesSentences = originalSentences.map((s, i) => {
          const pKey = `notes.s${i}-${idx}`;
          return localEdits[pKey] !== undefined ? localEdits[pKey] : s;
        });
      }
      return merged;
    });
  }, [unwrappedData, localEdits, pendingEdits, splitBySentence]);

  // Render editable field helper
  const renderEditableField = (record, idx, fieldName, label, displayValue, sectionId, copyId) => {
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const canEdit = !!record._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const sentenceState = sectionWasEdited ? editedSentences[`${fieldName}-${idx}-s0`] : undefined;
    const recordStatus = statusOverrides[idx] || 'active';
    const isFieldEdited = sentenceState === 'edited' && recordStatus !== 'approved';

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
                <button className="edit-save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId)} disabled={saving}>
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
          <div className={`row-content ${canEdit ? 'editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue)}
            title={canEdit ? 'Click to edit' : undefined}>
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && (
              <span className="edit-indicator">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
                <span className="edit-tag">edit</span>
              </span>
            )}
          </div>
          <button className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`} onClick={() => copyToClipboard(displayValue, copyId)}>
            {copiedId === copyId ? 'Copied' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && <div className="modified-badge">edited -- click approve to save</div>}
      </div>
    );
  };

  // Convert a date value to YYYY-MM-DD for <input type="date">
  const toInputDate = useCallback((dateValue) => {
    if (!dateValue) return '';
    try {
      const d = new Date(dateValue.$date || dateValue);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  }, []);

  // Render an editable Date field (date-picker input, ISO save)
  const renderDateField = (record, idx, fieldName, label, sectionId, copyId) => {
    const displayValue = getFieldValue(record, fieldName, idx);
    if (!hasValue(displayValue)) return null;
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const canEdit = !!record._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const sentenceState = sectionWasEdited ? editedSentences[editKey] : undefined;
    const recordStatus = statusOverrides[idx] || 'active';
    const isFieldEdited = sentenceState === 'edited' && recordStatus !== 'approved';

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={fieldName}>
          {label && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <input
                type="date"
                className="edit-input-date"
                value={editValue}
                ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch (e) { /* showPicker unsupported */ } } }}
                onChange={(e) => setEditValue(e.target.value)}
                disabled={saving}
              />
              <div className="edit-actions">
                <button className="edit-save-btn" onClick={() => {
                  if (!editValue || isNaN(new Date(editValue).getTime())) return;
                  handleSaveField(record, fieldName, idx, sectionId, undefined, new Date(editValue).toISOString());
                }} disabled={saving}>
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
          <div className={`row-content ${canEdit ? 'editable' : ''}`}
            onClick={() => { if (canEdit) { setEditingField(editKey); setEditValue(toInputDate(displayValue)); } }}
            title={canEdit ? 'Click to edit' : undefined}>
            <span className="content-value">{highlightText(formatDate(displayValue))}</span>
            {canEdit && (
              <span className="edit-indicator">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
                <span className="edit-tag">edit</span>
              </span>
            )}
          </div>
          <button className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`} onClick={() => copyToClipboard(formatDate(displayValue), copyId)}>
            {copiedId === copyId ? 'Copied' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && <div className="modified-badge">edited -- click approve to save</div>}
      </div>
    );
  };

  // Get all record text for Copy All
  const getAllRecordText = useCallback((record, idx) => {
    const lines = [];
    lines.push(`TREATMENT COURSE ${idx + 1}`);
    lines.push('════════════════════════════════════════');
    lines.push('');

    // Provider Details
    if (record.date || record.reportDate || record.provider || record.facility) {
      lines.push('PROVIDER DETAILS');
      lines.push('────────────────────────────────────────');
      if (record.date) lines.push(`Date: ${formatDate(record.date)}`);
      if (record.reportDate) lines.push(`Report Date: ${formatDate(record.reportDate)}`);
      if (record.provider) lines.push(`Provider: ${record.provider}`);
      if (record.facility) lines.push(`Facility: ${record.facility}`);
      lines.push('');
    }

    // Report Details
    if (record.type || record.reportType || record.urgency || record.status) {
      lines.push('REPORT DETAILS');
      lines.push('────────────────────────────────────────');
      if (record.type) lines.push(`Type: ${record.type}`);
      if (record.reportType) lines.push(`Report Type: ${record.reportType}`);
      if (record.urgency) lines.push(`Urgency: ${record.urgency}`);
      if (record.status) lines.push(`Status: ${record.status}`);
      lines.push('');
    }

    // Clinical Indication
    if (record.clinicalIndication) {
      lines.push('CLINICAL INDICATION');
      lines.push('────────────────────────────────────────');
      lines.push(record.clinicalIndication);
      lines.push('');
    }

    // Findings
    if (record.findings) {
      lines.push('FINDINGS');
      lines.push('────────────────────────────────────────');
      lines.push(record.findings);
      lines.push('');
    }

    // Assessment
    if (record.assessment) {
      lines.push('ASSESSMENT');
      lines.push('────────────────────────────────────────');
      lines.push(record.assessment);
      lines.push('');
    }

    // Plan
    if (record.plan) {
      lines.push('PLAN');
      lines.push('────────────────────────────────────────');
      lines.push(record.plan);
      lines.push('');
    }

    // Recommendations
    if (record.recommendations?.length > 0) {
      lines.push('RECOMMENDATIONS');
      lines.push('────────────────────────────────────────');
      record.recommendations.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
      lines.push('');
    }

    // Results
    if (record.results) {
      lines.push('RESULTS');
      lines.push('────────────────────────────────────────');
      lines.push(record.results);
      lines.push('');
    }

    // Notes - use pre-computed sentences if available
    if (record.notes) {
      lines.push('NOTES');
      lines.push('────────────────────────────────────────');
      const sentences = record._notesSentences || splitBySentence(record.notes);
      sentences.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
      lines.push('');
    }

    // Follow Up
    if (record.followUp) {
      lines.push('FOLLOW UP');
      lines.push('────────────────────────────────────────');
      lines.push(record.followUp);
      lines.push('');
    }

    return lines.join('\n');
  }, [formatDate, splitBySentence]);

  // Filter records based on Level 1 search
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) {
      return unwrappedData.map(r => ({ ...r, _showAllSections: true }));
    }

    const phrase = searchTerm.toLowerCase().trim();
    const words = phrase.split(/\s+/).filter(w => w.length > 0);
    const isMultiWord = words.length > 1;

    return unwrappedData.map((record, idx) => {
      const searchableText = [
        // Record title
        `Treatment Course ${idx + 1}`, 'treatment course', 'treatment courses',

        // Section titles with case variations
        'Provider Details', 'provider details', 'PROVIDER DETAILS',
        'Date', 'date', 'DATE',
        'Report Date', 'report date', 'REPORT DATE',
        'Provider', 'provider', 'PROVIDER',
        'Facility', 'facility', 'FACILITY',
        'Report Details', 'report details', 'REPORT DETAILS',
        'Type', 'type', 'TYPE',
        'Report Type', 'report type', 'REPORT TYPE',
        'Urgency', 'urgency', 'URGENCY',
        'Status', 'status', 'STATUS',
        'Clinical Indication', 'clinical indication', 'CLINICAL INDICATION',
        'Findings', 'findings', 'FINDINGS',
        'Assessment', 'assessment', 'ASSESSMENT',
        'Plan', 'plan', 'PLAN',
        'Recommendations', 'recommendations', 'RECOMMENDATIONS',
        'Results', 'results', 'RESULTS',
        'Notes', 'notes', 'NOTES',
        'Follow Up', 'follow up', 'FOLLOW UP',

        // Field values
        record.type,
        record.reportType,
        record.provider,
        record.facility,
        record.clinicalIndication,
        record.findings,
        record.assessment,
        record.plan,
        record.results,
        record.notes,
        record.status,
        record.urgency,
        record.followUp,
        formatDate(record.date),
        formatDate(record.reportDate),
        ...(record.recommendations || [])
      ].filter(Boolean).join(' ').toLowerCase();

      const matchesSearch = searchableText.includes(phrase);

      // Multi-word document title check for _showAllSections
      const docTitlePattern = /^treatment\s+course(s)?(\s+\d+)?$/;
      const showAllSections = isMultiWord && docTitlePattern.test(phrase);

      return matchesSearch ? { ...record, _showAllSections: showAllSections } : null;
    }).filter(Boolean);
  }, [unwrappedData, searchTerm, formatDate]);

  // Empty state
  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <div className="treatment-courses-document">
        <div className="document-header">
          <div className="header-content">
            <h1 className="document-title">Treatment Courses</h1>
          </div>
        </div>
        <div className="empty-state">No treatment course records found.</div>
      </div>
    );
  }

  return (
    <div className="treatment-courses-document">
      {/* Document Header - 3 Row Layout */}
      <div className="document-header">
        <div className="header-content">
          <h1 className="document-title">Treatment Courses</h1>
          <span className="header-meta">{unwrappedData.length} record{unwrappedData.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="header-actions">
          <button
            className={`copy-btn ${copiedId === 'all-documents' ? 'copied' : ''}`}
            onClick={() => {
              const allText = pdfData.map((r, i) => getAllRecordText(r, i)).join('\n\n');
              copyToClipboard(allText, 'all-documents');
            }}
          >
            {copiedId === 'all-documents' ? 'Copied' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<TreatmentCoursesPDFTemplate documents={pdfData} />}
            fileName={`Treatment_Courses_${new Date().toISOString().split('T')[0]}.pdf`}
            className="pdf-btn"
          >
            {({ loading }) => (loading ? 'Preparing...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>
      </div>

      {/* Search */}
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search treatment course records..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>
        )}
      </div>

      {/* No Results */}
      {filteredRecords.length === 0 && searchTerm && (
        <div className="no-results">No records match "{searchTerm}"</div>
      )}

      {/* Records */}
      <div className="records-container">
        {filteredRecords.map((record, idx) => {
          const recordWithFlag = record;

          // Level 3: sectionTitleMatches - if title matches, show ALL rows
          const phrase = searchTerm.toLowerCase().trim();

          // Provider Details section
          const providerDetailsTitleMatches = !searchTerm.trim() || recordWithFlag._showAllSections ||
            ['provider details', 'provider', 'facility', 'date', 'report date'].some(t => t.includes(phrase) || phrase.includes(t));
          const providerDetailsMatches = (() => {
            if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
            if (providerDetailsTitleMatches) return true;
            return shouldShowRow(recordWithFlag,
              'Provider Details', 'provider details', 'PROVIDER DETAILS',
              'Date', 'date', 'Report Date', 'report date', 'Provider', 'provider', 'Facility', 'facility',
              formatDate(record.date), formatDate(getFieldValue(record, 'reportDate', idx)), record.provider, record.facility
            );
          })();

          // Report Details section
          const reportDetailsTitleMatches = !searchTerm.trim() || recordWithFlag._showAllSections ||
            ['report details', 'report type', 'type', 'urgency', 'status'].some(t => t.includes(phrase) || phrase.includes(t));
          const reportDetailsMatches = (() => {
            if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
            if (reportDetailsTitleMatches) return true;
            return shouldShowRow(recordWithFlag,
              'Report Details', 'report details', 'REPORT DETAILS',
              'Type', 'type', 'Report Type', 'report type', 'Urgency', 'urgency', 'Status', 'status',
              getFieldValue(record, 'type', idx), getFieldValue(record, 'reportType', idx),
              getFieldValue(record, 'urgency', idx), getFieldValue(record, 'status', idx)
            );
          })();

          // Clinical Indication
          const clinicalIndicationTitleMatches = !searchTerm.trim() || recordWithFlag._showAllSections ||
            ['clinical indication', 'indication'].some(t => t.includes(phrase) || phrase.includes(t));
          const clinicalIndicationMatches = (() => {
            if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
            if (clinicalIndicationTitleMatches) return true;
            return shouldShowRow(recordWithFlag,
              'Clinical Indication', 'clinical indication', 'CLINICAL INDICATION',
              getFieldValue(record, 'clinicalIndication', idx)
            );
          })();

          // Findings
          const findingsTitleMatches = !searchTerm.trim() || recordWithFlag._showAllSections ||
            ['findings'].some(t => t.includes(phrase) || phrase.includes(t));
          const findingsMatches = (() => {
            if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
            if (findingsTitleMatches) return true;
            return shouldShowRow(recordWithFlag,
              'Findings', 'findings', 'FINDINGS',
              getFieldValue(record, 'findings', idx)
            );
          })();

          // Assessment
          const assessmentTitleMatches = !searchTerm.trim() || recordWithFlag._showAllSections ||
            ['assessment'].some(t => t.includes(phrase) || phrase.includes(t));
          const assessmentMatches = (() => {
            if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
            if (assessmentTitleMatches) return true;
            return shouldShowRow(recordWithFlag,
              'Assessment', 'assessment', 'ASSESSMENT',
              getFieldValue(record, 'assessment', idx)
            );
          })();

          // Plan
          const planTitleMatches = !searchTerm.trim() || recordWithFlag._showAllSections ||
            ['plan'].some(t => t.includes(phrase) || phrase.includes(t));
          const planMatches = (() => {
            if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
            if (planTitleMatches) return true;
            return shouldShowRow(recordWithFlag,
              'Plan', 'plan', 'PLAN',
              getFieldValue(record, 'plan', idx)
            );
          })();

          // Recommendations
          const recommendationsTitleMatches = !searchTerm.trim() || recordWithFlag._showAllSections ||
            ['recommendations', 'recommendation'].some(t => t.includes(phrase) || phrase.includes(t));
          const recommendationsMatches = (() => {
            if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
            if (recommendationsTitleMatches) return true;
            return shouldShowRow(recordWithFlag,
              'Recommendations', 'recommendations', 'RECOMMENDATIONS',
              ...(record.recommendations || [])
            );
          })();

          // Results
          const resultsTitleMatches = !searchTerm.trim() || recordWithFlag._showAllSections ||
            ['results'].some(t => t.includes(phrase) || phrase.includes(t));
          const resultsMatches = (() => {
            if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
            if (resultsTitleMatches) return true;
            return shouldShowRow(recordWithFlag,
              'Results', 'results', 'RESULTS',
              getFieldValue(record, 'results', idx)
            );
          })();

          // Notes
          const notesTitleMatches = !searchTerm.trim() || recordWithFlag._showAllSections ||
            ['notes', 'note'].some(t => t.includes(phrase) || phrase.includes(t));
          const notesMatches = (() => {
            if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
            if (notesTitleMatches) return true;
            return shouldShowRow(recordWithFlag,
              'Notes', 'notes', 'NOTES',
              getFieldValue(record, 'notes', idx)
            );
          })();

          // Follow Up
          const followUpTitleMatches = !searchTerm.trim() || recordWithFlag._showAllSections ||
            ['follow up', 'follow-up', 'followup'].some(t => t.includes(phrase) || phrase.includes(t));
          const followUpMatches = (() => {
            if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
            if (followUpTitleMatches) return true;
            return shouldShowRow(recordWithFlag,
              'Follow Up', 'follow up', 'FOLLOW UP',
              getFieldValue(record, 'followUp', idx)
            );
          })();

          return (
            <div key={idx} className="record-card">
              {/* Record Header */}
              <div className="record-header">
                <h2 className="record-title">{highlightText(`Treatment Course ${idx + 1}`)}</h2>
                <div className="header-top-row">
                  {record.date && (
                    <span className="record-date">{highlightText(formatDate(record.date))}</span>
                  )}
                </div>
              </div>

              {/* Provider Details Section (date NOT editable, reportDate + provider + facility editable) */}
              {(hasValue(record.date) || hasValue(getFieldValue(record, 'reportDate', idx)) || hasValue(getFieldValue(record, 'provider', idx)) || hasValue(getFieldValue(record, 'facility', idx))) && providerDetailsMatches && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h3 className="section-title">{highlightText('Provider Details')}</h3>
                      <div className="header-right-actions">
                        <button
                          className={`copy-section-btn ${copiedId === `provider-details-${idx}` ? 'copied' : ''}`}
                          onClick={() => {
                            const lines = ['PROVIDER DETAILS', '════════════════════════════════════════'];
                            if (record.date) lines.push(`Date: ${formatDate(record.date)}`);
                            const rd = getFieldValue(record, 'reportDate', idx);
                            if (rd) lines.push(`Report Date: ${formatDate(rd)}`);
                            const prov = getFieldValue(record, 'provider', idx);
                            const fac = getFieldValue(record, 'facility', idx);
                            if (prov) lines.push(`Provider: ${prov}`);
                            if (fac) lines.push(`Facility: ${fac}`);
                            copyToClipboard(lines.join('\n'), `provider-details-${idx}`);
                          }}
                        >
                          {copiedId === `provider-details-${idx}` ? 'Copied' : 'Copy Section'}
                        </button>
                        {!!record._id && Object.keys(editedFields).some(k => k.startsWith('providerDetails-') && k.endsWith(`-${idx}`)) && statusOverrides[idx] !== 'approved' && (
                          <button className="approve-btn" onClick={() => handleApprove(record, idx)} disabled={approving}>
                            {approving ? 'Approving...' : 'Approve'}
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Date - read only */}
                    {hasValue(record.date) && (providerDetailsTitleMatches || shouldShowRow(recordWithFlag, 'Date', 'date', formatDate(record.date))) && (
                      <div className="rec-mini-card">
                        <div className="nested-subtitle">{highlightText('Date')}</div>
                        <div className="numbered-row">
                          <div className="row-content">
                            <span className="content-value">{highlightText(formatDate(record.date))}</span>
                          </div>
                          <button
                            className={`copy-btn ${copiedId === `date-${idx}` ? 'copied' : ''}`}
                            onClick={() => copyToClipboard(formatDate(record.date), `date-${idx}`)}
                          >
                            {copiedId === `date-${idx}` ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    )}
                    {/* Report Date - editable date-picker */}
                    {hasValue(getFieldValue(record, 'reportDate', idx)) && (providerDetailsTitleMatches || shouldShowRow(recordWithFlag, 'Report Date', 'report date', formatDate(getFieldValue(record, 'reportDate', idx)))) && (
                      renderDateField(record, idx, 'reportDate', 'Report Date', 'providerDetails', `reportDate-${idx}`)
                    )}
                    {/* Provider - editable */}
                    {hasValue(getFieldValue(record, 'provider', idx)) && (providerDetailsTitleMatches || shouldShowRow(recordWithFlag, 'Provider', 'provider', getFieldValue(record, 'provider', idx))) && (
                      renderEditableField(record, idx, 'provider', 'Provider', getFieldValue(record, 'provider', idx), 'providerDetails', `provider-${idx}`)
                    )}
                    {/* Facility - editable */}
                    {hasValue(getFieldValue(record, 'facility', idx)) && (providerDetailsTitleMatches || shouldShowRow(recordWithFlag, 'Facility', 'facility', getFieldValue(record, 'facility', idx))) && (
                      renderEditableField(record, idx, 'facility', 'Facility', getFieldValue(record, 'facility', idx), 'providerDetails', `facility-${idx}`)
                    )}
                  </div>
                </div>
              )}

              {/* Report Details Section (type, reportType, urgency, status - all editable) */}
              {(hasValue(getFieldValue(record, 'type', idx)) || hasValue(getFieldValue(record, 'reportType', idx)) || hasValue(getFieldValue(record, 'urgency', idx)) || hasValue(getFieldValue(record, 'status', idx))) && reportDetailsMatches && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h3 className="section-title">{highlightText('Report Details')}</h3>
                      <div className="header-right-actions">
                        <button
                          className={`copy-section-btn ${copiedId === `report-details-${idx}` ? 'copied' : ''}`}
                          onClick={() => {
                            const lines = ['REPORT DETAILS', '════════════════════════════════════════'];
                            const t = getFieldValue(record, 'type', idx);
                            const rt = getFieldValue(record, 'reportType', idx);
                            const u = getFieldValue(record, 'urgency', idx);
                            const s = getFieldValue(record, 'status', idx);
                            if (t) lines.push(`Type: ${t}`);
                            if (rt) lines.push(`Report Type: ${rt}`);
                            if (u) lines.push(`Urgency: ${u}`);
                            if (s) lines.push(`Status: ${s}`);
                            copyToClipboard(lines.join('\n'), `report-details-${idx}`);
                          }}
                        >
                          {copiedId === `report-details-${idx}` ? 'Copied' : 'Copy Section'}
                        </button>
                        {!!record._id && Object.keys(editedFields).some(k => k.startsWith('reportDetails-') && k.endsWith(`-${idx}`)) && statusOverrides[idx] !== 'approved' && (
                          <button className="approve-btn" onClick={() => handleApprove(record, idx)} disabled={approving}>
                            {approving ? 'Approving...' : 'Approve'}
                          </button>
                        )}
                      </div>
                    </div>
                    {hasValue(getFieldValue(record, 'type', idx)) && (reportDetailsTitleMatches || shouldShowRow(recordWithFlag, 'Type', 'type', getFieldValue(record, 'type', idx))) && (
                      renderEditableField(record, idx, 'type', 'Type', getFieldValue(record, 'type', idx), 'reportDetails', `type-${idx}`)
                    )}
                    {hasValue(getFieldValue(record, 'reportType', idx)) && (reportDetailsTitleMatches || shouldShowRow(recordWithFlag, 'Report Type', 'report type', getFieldValue(record, 'reportType', idx))) && (
                      renderEditableField(record, idx, 'reportType', 'Report Type', getFieldValue(record, 'reportType', idx), 'reportDetails', `reportType-${idx}`)
                    )}
                    {hasValue(getFieldValue(record, 'urgency', idx)) && (reportDetailsTitleMatches || shouldShowRow(recordWithFlag, 'Urgency', 'urgency', getFieldValue(record, 'urgency', idx))) && (
                      renderEditableField(record, idx, 'urgency', 'Urgency', getFieldValue(record, 'urgency', idx), 'reportDetails', `urgency-${idx}`)
                    )}
                    {hasValue(getFieldValue(record, 'status', idx)) && (reportDetailsTitleMatches || shouldShowRow(recordWithFlag, 'Status', 'status', getFieldValue(record, 'status', idx))) && (
                      renderEditableField(record, idx, 'status', 'Status', getFieldValue(record, 'status', idx), 'reportDetails', `status-${idx}`)
                    )}
                  </div>
                </div>
              )}

              {/* Clinical Indication - EDITABLE */}
              {hasValue(getFieldValue(record, 'clinicalIndication', idx)) && clinicalIndicationMatches && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h3 className="section-title">{highlightText('Clinical Indication')}</h3>
                      <div className="header-right-actions">
                        <button
                          className={`copy-section-btn ${copiedId === `indication-${idx}` ? 'copied' : ''}`}
                          onClick={() => copyToClipboard(getFieldValue(record, 'clinicalIndication', idx), `indication-${idx}`)}
                        >
                          {copiedId === `indication-${idx}` ? 'Copied' : 'Copy Section'}
                        </button>
                        {!!record._id && Object.keys(editedFields).some(k => k.startsWith('indication-') && k.endsWith(`-${idx}`)) && statusOverrides[idx] !== 'approved' && (
                          <button className="approve-btn" onClick={() => handleApprove(record, idx)} disabled={approving}>
                            {approving ? 'Approving...' : 'Approve'}
                          </button>
                        )}
                      </div>
                    </div>
                    {renderEditableField(record, idx, 'clinicalIndication', null, getFieldValue(record, 'clinicalIndication', idx), 'indication', `indication-row-${idx}`)}
                  </div>
                </div>
              )}

              {/* Findings - EDITABLE */}
              {hasValue(getFieldValue(record, 'findings', idx)) && findingsMatches && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h3 className="section-title">{highlightText('Findings')}</h3>
                      <div className="header-right-actions">
                        <button
                          className={`copy-section-btn ${copiedId === `findings-${idx}` ? 'copied' : ''}`}
                          onClick={() => copyToClipboard(getFieldValue(record, 'findings', idx), `findings-${idx}`)}
                        >
                          {copiedId === `findings-${idx}` ? 'Copied' : 'Copy Section'}
                        </button>
                        {!!record._id && Object.keys(editedFields).some(k => k.startsWith('findings-') && k.endsWith(`-${idx}`)) && statusOverrides[idx] !== 'approved' && (
                          <button className="approve-btn" onClick={() => handleApprove(record, idx)} disabled={approving}>
                            {approving ? 'Approving...' : 'Approve'}
                          </button>
                        )}
                      </div>
                    </div>
                    {renderEditableField(record, idx, 'findings', null, getFieldValue(record, 'findings', idx), 'findings', `findings-row-${idx}`)}
                  </div>
                </div>
              )}

              {/* Assessment - EDITABLE */}
              {hasValue(getFieldValue(record, 'assessment', idx)) && assessmentMatches && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h3 className="section-title">{highlightText('Assessment')}</h3>
                      <div className="header-right-actions">
                        <button
                          className={`copy-section-btn ${copiedId === `assessment-${idx}` ? 'copied' : ''}`}
                          onClick={() => copyToClipboard(getFieldValue(record, 'assessment', idx), `assessment-${idx}`)}
                        >
                          {copiedId === `assessment-${idx}` ? 'Copied' : 'Copy Section'}
                        </button>
                        {!!record._id && Object.keys(editedFields).some(k => k.startsWith('assessment-') && k.endsWith(`-${idx}`)) && statusOverrides[idx] !== 'approved' && (
                          <button className="approve-btn" onClick={() => handleApprove(record, idx)} disabled={approving}>
                            {approving ? 'Approving...' : 'Approve'}
                          </button>
                        )}
                      </div>
                    </div>
                    {renderEditableField(record, idx, 'assessment', null, getFieldValue(record, 'assessment', idx), 'assessment', `assessment-row-${idx}`)}
                  </div>
                </div>
              )}

              {/* Plan - EDITABLE */}
              {hasValue(getFieldValue(record, 'plan', idx)) && planMatches && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h3 className="section-title">{highlightText('Plan')}</h3>
                      <div className="header-right-actions">
                        <button
                          className={`copy-section-btn ${copiedId === `plan-${idx}` ? 'copied' : ''}`}
                          onClick={() => copyToClipboard(getFieldValue(record, 'plan', idx), `plan-${idx}`)}
                        >
                          {copiedId === `plan-${idx}` ? 'Copied' : 'Copy Section'}
                        </button>
                        {!!record._id && Object.keys(editedFields).some(k => k.startsWith('plan-') && k.endsWith(`-${idx}`)) && statusOverrides[idx] !== 'approved' && (
                          <button className="approve-btn" onClick={() => handleApprove(record, idx)} disabled={approving}>
                            {approving ? 'Approving...' : 'Approve'}
                          </button>
                        )}
                      </div>
                    </div>
                    {renderEditableField(record, idx, 'plan', null, getFieldValue(record, 'plan', idx), 'plan', `plan-row-${idx}`)}
                  </div>
                </div>
              )}

              {/* Recommendations - EDITABLE (array element editing with arrayIndex) */}
              {hasValue(record.recommendations) && recommendationsMatches && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h3 className="section-title">{highlightText('Recommendations')}</h3>
                      <div className="header-right-actions">
                        <button
                          className={`copy-section-btn ${copiedId === `recommendations-${idx}` ? 'copied' : ''}`}
                          onClick={() => {
                            const recs = record.recommendations || [];
                            const text = recs.map((r, i) => {
                              const editKeyOverlay = `recommendations.${i}-${idx}`;
                              const displayVal = localEdits[editKeyOverlay] !== undefined ? localEdits[editKeyOverlay] : r;
                              return `${i + 1}. ${displayVal}`;
                            }).join('\n');
                            copyToClipboard(`RECOMMENDATIONS\n════════════════════════════════════════\n${text}`, `recommendations-${idx}`);
                          }}
                        >
                          {copiedId === `recommendations-${idx}` ? 'Copied' : 'Copy Section'}
                        </button>
                        {!!record._id && Object.keys(editedFields).some(k => k.startsWith('recommendations-') && k.endsWith(`-${idx}`)) && statusOverrides[idx] !== 'approved' && (
                          <button className="approve-btn" onClick={() => handleApprove(record, idx)} disabled={approving}>
                            {approving ? 'Approving...' : 'Approve'}
                          </button>
                        )}
                      </div>
                    </div>
                    {(Array.isArray(record.recommendations) ? record.recommendations : [record.recommendations])
                      .map((rec, recIdx) => {
                        const editKeyOverlay = `recommendations.${recIdx}-${idx}`;
                        const displayValue = localEdits[editKeyOverlay] !== undefined ? localEdits[editKeyOverlay] : rec;
                        return { item: displayValue, origIdx: recIdx };
                      })
                      .filter(({ item }) => recommendationsTitleMatches || shouldShowRow(recordWithFlag, item))
                      .map(({ item, origIdx: recIdx }) => {
                        const canEdit = !!record._id;
                        const editKey = `recommendations.${recIdx}-${idx}-s0`;
                        const isEditing = editingField === editKey;
                        const sectionWasEdited = editedFields[`recommendations-${idx}`];
                        const sentenceState = sectionWasEdited ? editedSentences[`recommendations.${recIdx}-${idx}-s0`] : undefined;
                        const recordStatus = statusOverrides[idx] || 'active';
                        const isFieldEdited = sentenceState === 'edited' && recordStatus !== 'approved';

                        if (isEditing) {
                          return (
                            <div key={recIdx} className="numbered-row edit-row">
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
                                  <button className="edit-save-btn" onClick={() => handleSaveField(record, 'recommendations', idx, 'recommendations', recIdx)} disabled={saving}>
                                    {saving ? 'Saving...' : 'Save'}
                                  </button>
                                  <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <React.Fragment key={recIdx}>
                            <div className={`numbered-row ${isFieldEdited ? 'modified' : ''}`}>
                              <div className={`row-content ${canEdit ? 'editable' : ''}`}
                                onClick={() => {
                                  if (!canEdit) return;
                                  handleStartEdit(`recommendations.${recIdx}`, idx, item);
                                }}
                                title={canEdit ? 'Click to edit' : undefined}>
                                <span className="content-value">{highlightText(item)}</span>
                                {canEdit && (
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
                                className={`copy-btn ${copiedId === `rec-item-${idx}-${recIdx}` ? 'copied' : ''}`}
                                onClick={() => copyToClipboard(item, `rec-item-${idx}-${recIdx}`)}
                              >
                                {copiedId === `rec-item-${idx}-${recIdx}` ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                            {isFieldEdited && <div className="modified-badge">edited -- click approve to save</div>}
                          </React.Fragment>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Results - EDITABLE */}
              {hasValue(getFieldValue(record, 'results', idx)) && resultsMatches && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h3 className="section-title">{highlightText('Results')}</h3>
                      <div className="header-right-actions">
                        <button
                          className={`copy-section-btn ${copiedId === `results-${idx}` ? 'copied' : ''}`}
                          onClick={() => copyToClipboard(getFieldValue(record, 'results', idx), `results-${idx}`)}
                        >
                          {copiedId === `results-${idx}` ? 'Copied' : 'Copy Section'}
                        </button>
                        {!!record._id && Object.keys(editedFields).some(k => k.startsWith('results-') && k.endsWith(`-${idx}`)) && statusOverrides[idx] !== 'approved' && (
                          <button className="approve-btn" onClick={() => handleApprove(record, idx)} disabled={approving}>
                            {approving ? 'Approving...' : 'Approve'}
                          </button>
                        )}
                      </div>
                    </div>
                    {renderEditableField(record, idx, 'results', null, getFieldValue(record, 'results', idx), 'results', `results-row-${idx}`)}
                  </div>
                </div>
              )}

              {/* Notes - PER-SENTENCE EDITING */}
              {hasValue(getFieldValue(record, 'notes', idx)) && notesMatches && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h3 className="section-title">{highlightText('Notes')}</h3>
                      <div className="header-right-actions">
                        <button
                          className={`copy-section-btn ${copiedId === `notes-${idx}` ? 'copied' : ''}`}
                          onClick={() => {
                            // Use original sentences + per-sentence overlays for stable copy
                            const origSentences = splitBySentence(record.notes || '');
                            const displaySentences = origSentences.map((s, i) => {
                              const pKey = `notes.s${i}-${idx}`;
                              return localEdits[pKey] !== undefined ? localEdits[pKey] : s;
                            });
                            const text = displaySentences.map((s, i) => `${i + 1}. ${s}`).join('\n');
                            copyToClipboard(`NOTES\n════════════════════════════════════════\n${text}`, `notes-${idx}`);
                          }}
                        >
                          {copiedId === `notes-${idx}` ? 'Copied' : 'Copy Section'}
                        </button>
                        {!!record._id && Object.keys(editedFields).some(k => k.startsWith('notes-') && k.endsWith(`-${idx}`)) && statusOverrides[idx] !== 'approved' && (
                          <button className="approve-btn" onClick={() => handleApprove(record, idx)} disabled={approving}>
                            {approving ? 'Approving...' : 'Approve'}
                          </button>
                        )}
                      </div>
                    </div>
                    {(() => {
                      const canEdit = !!record._id;
                      const sectionWasEdited = editedFields[`notes-${idx}`];
                      const recordStatus = statusOverrides[idx] || 'active';
                      // Always split from ORIGINAL record data for stable sentence boundaries
                      const originalSentences = splitBySentence(record.notes || '');

                      return originalSentences
                        .map((origSentence, origIdx) => {
                          // Overlay per-sentence edits for stable display
                          const perSentenceKey = `notes.s${origIdx}-${idx}`;
                          const displaySentence = localEdits[perSentenceKey] !== undefined ? localEdits[perSentenceKey] : origSentence;
                          return { sentence: displaySentence, origIdx };
                        })
                        .filter(({ sentence }) => notesTitleMatches || shouldShowRow(recordWithFlag, sentence))
                        .map(({ sentence, origIdx: sIdx }) => {
                          const editKey = `notes-${idx}-s${sIdx}`;
                          const isEditing = editingField === editKey;
                          const sentenceState = sectionWasEdited ? editedSentences[editKey] : undefined;
                          const isSentenceEdited = sentenceState === 'edited' && recordStatus !== 'approved';

                          if (isEditing) {
                            return (
                              <div key={sIdx} className="numbered-row edit-row">
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
                                    <button className="edit-save-btn" onClick={() => {
                                      // Ensure edited sentence ends with punctuation for proper re-splitting after refresh
                                      let editedSentence = editValue.trim();
                                      if (editedSentence && !/[.!?]$/.test(editedSentence)) {
                                        editedSentence += '.';
                                      }
                                      // Reconstruct from ORIGINAL sentences + all per-sentence edits
                                      const origText = record.notes || '';
                                      const origSentences = splitBySentence(origText);
                                      const merged = origSentences.map((s, i) => {
                                        if (i === sIdx) return editedSentence;
                                        const pKey = `notes.s${i}-${idx}`;
                                        return localEdits[pKey] !== undefined ? localEdits[pKey] : s;
                                      });
                                      const reconstructed = merged.join(' ');
                                      // Store per-sentence edit (with punctuation) for stable display
                                      setLocalEdits(prev => ({ ...prev, [`notes.s${sIdx}-${idx}`]: editedSentence }));
                                      // Save full reconstructed text to MongoDB
                                      handleSaveField(record, 'notes', idx, 'notes', undefined, reconstructed, sIdx);
                                    }} disabled={saving}>
                                      {saving ? 'Saving...' : 'Save'}
                                    </button>
                                    <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <React.Fragment key={sIdx}>
                              <div className={`numbered-row ${isSentenceEdited ? 'modified' : ''}`}>
                                <div className={`row-content ${canEdit ? 'editable' : ''}`}
                                  onClick={() => {
                                    if (!canEdit) return;
                                    // Strip trailing punctuation so user edits content before the period
                                    const editText = sentence.replace(/[.!?]+$/, '').trim();
                                    handleStartEdit('notes', idx, editText, sIdx);
                                  }}
                                  title={canEdit ? 'Click to edit this sentence' : undefined}>
                                  <span className="content-value">{highlightText(sentence)}</span>
                                  {canEdit && (
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
                                  className={`copy-btn ${copiedId === `notes-sentence-${idx}-${sIdx}` ? 'copied' : ''}`}
                                  onClick={() => copyToClipboard(sentence, `notes-sentence-${idx}-${sIdx}`)}
                                >
                                  {copiedId === `notes-sentence-${idx}-${sIdx}` ? 'Copied' : 'Copy'}
                                </button>
                              </div>
                              {isSentenceEdited && <div className="modified-badge">edited -- click approve to save</div>}
                            </React.Fragment>
                          );
                        });
                    })()}
                  </div>
                </div>
              )}

              {/* Follow Up - EDITABLE */}
              {hasValue(getFieldValue(record, 'followUp', idx)) && followUpMatches && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h3 className="section-title">{highlightText('Follow Up')}</h3>
                      <div className="header-right-actions">
                        <button
                          className={`copy-section-btn ${copiedId === `followup-${idx}` ? 'copied' : ''}`}
                          onClick={() => copyToClipboard(getFieldValue(record, 'followUp', idx), `followup-${idx}`)}
                        >
                          {copiedId === `followup-${idx}` ? 'Copied' : 'Copy Section'}
                        </button>
                        {!!record._id && Object.keys(editedFields).some(k => k.startsWith('followup-') && k.endsWith(`-${idx}`)) && statusOverrides[idx] !== 'approved' && (
                          <button className="approve-btn" onClick={() => handleApprove(record, idx)} disabled={approving}>
                            {approving ? 'Approving...' : 'Approve'}
                          </button>
                        )}
                      </div>
                    </div>
                    {renderEditableField(record, idx, 'followUp', null, getFieldValue(record, 'followUp', idx), 'followup', `followup-row-${idx}`)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TreatmentCoursesDocument;
