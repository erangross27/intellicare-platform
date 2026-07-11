/**
 * TreatmentPlansDocument.jsx
 * December 2025 Standard - Complete template rebuild
 *
 * Sections:
 * 1. Record Info (date, provider, specialty)
 * 2. Short-Term Goals
 * 3. Long-Term Goals
 * 4. Immediate Interventions (object with nested fields)
 * 5. Pending Procedures
 * 6. Rehabilitation Referrals
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import TreatmentPlansDocumentPDFTemplate from '../pdf-templates/TreatmentPlansDocumentPDFTemplate';
import './TreatmentPlansDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'treatment_plansPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const TreatmentPlansDocument = ({ document, data }) => {
  const templateData = document || data;
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [copiedSectionId, setCopiedSectionId] = useState(null);

  // ============== EDITING STATE ==============
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

  // Check if value exists
  const hasValue = (val) => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string') return val.trim().length > 0;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'object') return Object.keys(val).length > 0;
    return true;
  };

  // Humanize a dynamic object key into a readable label
  // e.g. "intraoperativeMapping" -> "Intraoperative Mapping",
  //      "UTI_Prophylaxis" -> "UTI Prophylaxis", "ECG Monitoring" -> "ECG Monitoring"
  const humanizeKey = (key) => {
    if (!key) return '';
    let s = String(key).replace(/[_-]+/g, ' ');
    s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    s = s.replace(/\s+/g, ' ').trim();
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Flatten an immediateInterventions value (string or string[]) to display lines
  const interventionLines = (val) => {
    if (Array.isArray(val)) return val.filter((v) => hasValue(v)).map((v) => String(v));
    if (hasValue(val)) return [String(val)];
    return [];
  };

  // Parse "Day X:" patterns for buprenorphine induction
  const parseDayLabels = (text) => {
    if (!text || typeof text !== 'string') return [{ label: null, content: text }];

    const dayPattern = /Day\s+\d+:/gi;
    const matches = [...text.matchAll(dayPattern)];

    if (matches.length === 0) {
      return [{ label: null, content: text.trim() }];
    }

    const results = [];
    matches.forEach((match, idx) => {
      const label = match[0].replace(':', '').trim();
      const startIdx = match.index + match[0].length;
      const endIdx = idx + 1 < matches.length ? matches[idx + 1].index : text.length;
      const content = text.substring(startIdx, endIdx).trim().replace(/\.$/, '');

      if (content) {
        results.push({ label, content });
      }
    });

    return results.length > 0 ? results : [{ label: null, content: text.trim() }];
  };

  // Unwrap nested data
  const unwrapData = (input) => {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input.flatMap(item => {
        if (item?.document) return Array.isArray(item.document) ? item.document : [item.document];
        if (item?.data) return Array.isArray(item.data) ? item.data : [item.data];
        return [item];
      });
    }
    if (input.document) return Array.isArray(input.document) ? input.document : [input.document];
    if (input.data) return Array.isArray(input.data) ? input.data : [input.data];
    return [input];
  };

  const unwrappedData = useMemo(() => unwrapData(templateData), [templateData]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nStatus = {};
    unwrappedData.forEach((record, idx) => {
      const rid = record && record._id ? (record._id.$oid || record._id) : null;
      const recordDrafts = rid ? store[rid] : null;
      if (!recordDrafts) return;
      Object.entries(recordDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
        // Mark every section that owns this field as edited so the row + Approve button light up.
        Object.keys(SECTION_FIELDS).forEach(sid => {
          if (SECTION_FIELDS[sid].includes(baseField)) nFields[`${sid}-${idx}`] = true;
        });
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
  }, [unwrappedData]);

  // Highlight search matches
  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || !text) return text;
    const phrase = searchTerm.trim();
    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedPhrase})`, 'gi');
    const parts = String(text).split(regex);
    const phraseLower = phrase.toLowerCase();

    return parts.map((part, i) =>
      part.toLowerCase() === phraseLower ? <mark key={i}>{part}</mark> : part
    );
  }, [searchTerm]);

  // shouldShowRow - Level 4: Row-level filtering
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

  // Copy to clipboard
  const copyToClipboard = useCallback((text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  // Copy section to clipboard
  const copySectionToClipboard = useCallback((text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSectionId(id);
      setTimeout(() => setCopiedSectionId(null), 2000);
    });
  }, []);

  // ============== EDITING HELPERS ==============

  const getFieldValue = useCallback((record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    return record[fieldName];
  }, [localEdits]);

  const getArrayFieldValue = useCallback((record, fieldName, arrayIndex, idx) => {
    const editKey = `${fieldName}.${arrayIndex}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    const arr = record[fieldName];
    if (Array.isArray(arr) && arrayIndex < arr.length) return arr[arrayIndex];
    return undefined;
  }, [localEdits]);

  // ============== EDITING HANDLERS ==============

  const handleStartEdit = useCallback((fieldName, idx, currentValue) => {
    const editKey = `${fieldName}-${idx}-s0`;
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
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, arrayIndex) => {
    const recordId = record._id ? (record._id.$oid || record._id) : null;
    if (!recordId) return;
    const saveValue = editValue.trim();
    const fieldPart = (typeof arrayIndex === 'number') ? `${fieldName}.${arrayIndex}` : fieldName;
    const editKey = `${fieldPart}-${idx}`;
    const sKey = `${fieldName}-${idx}-s0`;

    setLocalEdits(prev => ({ ...prev, [editKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => {
      if (!prev[sectionId]) return prev;
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });

    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldPart] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this record to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApprove = useCallback(async (record, idx, sectionId) => {
    const recordId = record._id ? (record._id.$oid || record._id) : null;
    if (!recordId) return;
    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements).
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex" or "a.b" (nested)
        const dotIdx = fieldPart.lastIndexOf('.');
        const tail = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const isArrayIndex = dotIdx !== -1 && /^\d+$/.test(tail);
        const payload = { field: isArrayIndex ? fieldPart.slice(0, dotIdx) : fieldPart, value: localEdits[editKey] };
        if (isArrayIndex) payload.arrayIndex = parseInt(tail, 10);
        const resp = await secureApiClient.put(`/api/edit/treatment_plans/${recordId}/edit`, payload);
        if (!resp || !resp.success) throw new Error((resp && resp.error) || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/treatment_plans/${recordId}/approve`);

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
      console.error('[TreatmentPlans] Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // ============== SECTION_FIELDS + sectionHasEdits ==============
  const SECTION_FIELDS = {
    'record-info': ['provider', 'specialty'],
    'short-term': ['shortTermGoals'],
    'long-term': ['longTermGoals'],
    'pending': ['pendingProcedures'],
    'rehab': ['rehabilitationReferrals'],
  };

  const sectionHasEdits = (sectionId) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    return Object.keys(localEdits).some(editKey => {
      const dashIdx = editKey.lastIndexOf('-');
      const fieldPart = editKey.substring(0, dashIdx);
      const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
      return fields.includes(baseField);
    });
  };

  // ============== pdfData MEMO ==============
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return unwrappedData;
    return unwrappedData.map((record, idx) => {
      const merged = { ...record };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldPart = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx === idx) {
          const dotParts = fieldPart.split('.');
          if (dotParts.length === 1) {
            merged[fieldPart] = editVal;
          } else if (dotParts.length === 2) {
            const [parent, child] = dotParts;
            const childNum = parseInt(child, 10);
            if (!isNaN(childNum) && Array.isArray(merged[parent])) {
              merged[parent] = [...merged[parent]];
              merged[parent][childNum] = editVal;
            }
          }
        }
      }
      return merged;
    });
  }, [unwrappedData, localEdits, pendingEdits]);

  // ============== EDIT INDICATOR ==============
  const editIndicator = (
    <span className="edit-indicator" title="Click to edit">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="m15 5 4 4" />
      </svg>
      <span className="edit-tag">edit</span>
    </span>
  );

  // ============== RENDER EDITABLE FIELD (string fields) ==============
  const renderEditableField = (record, fieldName, label, idx, sectionId, copyId) => {
    const displayValue = getFieldValue(record, fieldName, idx);
    if (!displayValue) return null;
    const canEdit = !!record._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const isFieldEdited = sectionWasEdited && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={fieldName}>
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <textarea
                ref={textareaRef}
                className="edit-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') handleCancelEdit();
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveField(record, fieldName, idx, sectionId);
                }}
                rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))}
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
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row${isFieldEdited ? ' modified' : ''}`}>
          <div
            className={`row-content${canEdit ? ' editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue)}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isFieldEdited && editIndicator}
          </div>
          <button
            className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(displayValue, copyId)}
          >
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && <div className="modified-badge">edited — click approve to save</div>}
      </div>
    );
  };

  // ============== RENDER EDITABLE ARRAY ITEM ==============
  const renderEditableArrayItem = (record, fieldName, item, idx, itemIdx, sectionId, copyId) => {
    const displayValue = getArrayFieldValue(record, fieldName, itemIdx, idx) || item;
    if (!displayValue) return null;
    const canEdit = !!record._id;
    const editKey = `${fieldName}.${itemIdx}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const isItemEdited = sectionWasEdited && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';

    if (isEditing) {
      return (
        <div key={itemIdx} className="numbered-row edit-row">
          <div className="edit-field-container">
            <textarea
              ref={textareaRef}
              className="edit-textarea"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleCancelEdit();
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveField(record, fieldName, idx, sectionId, itemIdx);
              }}
              rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))}
              disabled={saving}
            />
            <div className="edit-actions">
              <button className="edit-save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId, itemIdx)} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <React.Fragment key={itemIdx}>
        <div className={`numbered-row${isItemEdited ? ' modified' : ''}`}>
          <div
            className={`row-content${canEdit ? ' editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(`${fieldName}.${itemIdx}`, idx, displayValue)}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isItemEdited && editIndicator}
          </div>
          <button
            className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(displayValue, copyId)}
          >
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isItemEdited && <div className="modified-badge">edited — click approve to save</div>}
      </React.Fragment>
    );
  };

  // ============== SECTION HEADER WITH APPROVE ==============
  const renderSectionHeader = (title, copyId, copyFn, idx, sectionId) => (
    <div className="section-header">
      <h3 className="section-title">{highlightText(title)}</h3>
      <div className="header-right-actions">
        <button
          className={`copy-btn ${copiedSectionId === copyId ? 'copied' : ''}`}
          onClick={copyFn}
        >
          {copiedSectionId === copyId ? 'Copied!' : 'Copy Section'}
        </button>
        {(sectionHasEdits(sectionId) || approvedSections[sectionId]) && (
          <button
            className={`approve-btn${approvedSections[sectionId] ? ' approved' : ''}`}
            onClick={() => handleApprove(unwrappedData[idx], idx, sectionId)}
            disabled={approving}
          >
            {approving ? 'Approving...' : approvedSections[sectionId] ? 'Approved' : 'Approve'}
          </button>
        )}
      </div>
    </div>
  );

  // Get all record text for Copy All
  const getAllRecordText = useCallback((record, idx) => {
    const lines = [`TREATMENT PLAN ${idx + 1}`, '═══════════════════════════════════════'];

    if (record.date) lines.push(`Date: ${formatDate(record.date)}`);
    if (record.provider) lines.push(`Provider: ${record.provider}`);
    if (record.specialty) lines.push(`Specialty: ${record.specialty}`);

    if (hasValue(record.shortTermGoals)) {
      lines.push('', 'SHORT-TERM GOALS', '───────────────────────────────────────');
      record.shortTermGoals.forEach((goal, i) => lines.push(`${i + 1}. ${goal}`));
    }

    if (hasValue(record.longTermGoals)) {
      lines.push('', 'LONG-TERM GOALS', '───────────────────────────────────────');
      record.longTermGoals.forEach((goal, i) => lines.push(`${i + 1}. ${goal}`));
    }

    if (hasValue(record.immediateInterventions)) {
      lines.push('', 'IMMEDIATE INTERVENTIONS', '───────────────────────────────────────');
      const interventions = record.immediateInterventions;
      Object.keys(interventions).filter(k => hasValue(interventions[k])).forEach((k) => {
        const vals = interventionLines(interventions[k]);
        if (vals.length === 1) {
          lines.push(`${humanizeKey(k)}: ${vals[0]}`);
        } else if (vals.length > 1) {
          lines.push(`${humanizeKey(k)}:`);
          vals.forEach((v, i) => lines.push(`  ${i + 1}. ${v}`));
        }
      });
    }

    if (hasValue(record.pendingProcedures)) {
      lines.push('', 'PENDING PROCEDURES', '───────────────────────────────────────');
      record.pendingProcedures.forEach((proc, i) => lines.push(`${i + 1}. ${proc}`));
    }

    if (hasValue(record.rehabilitationReferrals)) {
      lines.push('', 'REHABILITATION REFERRALS', '───────────────────────────────────────');
      record.rehabilitationReferrals.forEach((ref, i) => lines.push(`${i + 1}. ${ref}`));
    }

    return lines.join('\n');
  }, []);

  // Filter records based on search
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return unwrappedData;

    return unwrappedData.map((record, idx) => {
      // Build searchableText (Level 1)
      const searchableText = [
        // Record title
        `Treatment Plan ${idx + 1}`, `treatment plan ${idx + 1}`,

        // Section titles with 3 case variations
        'Record Info', 'record info', 'RECORD INFO',
        'Short-Term Goals', 'short-term goals', 'SHORT-TERM GOALS',
        'Long-Term Goals', 'long-term goals', 'LONG-TERM GOALS',
        'Immediate Interventions', 'immediate interventions', 'IMMEDIATE INTERVENTIONS',
        // Dynamic intervention key labels (derived from actual object)
        ...Object.keys(record.immediateInterventions || {}).map(humanizeKey),
        'Pending Procedures', 'pending procedures', 'PENDING PROCEDURES',
        'Rehabilitation Referrals', 'rehabilitation referrals', 'REHABILITATION REFERRALS',

        // Field labels
        'Date', 'date', 'Provider', 'provider', 'Specialty', 'specialty',
        'Day 1', 'day 1', 'Day 2', 'day 2', 'Day 3', 'day 3',

        // Field values
        record.provider,
        record.specialty,
        formatDate(record.date),
        ...(record.shortTermGoals || []),
        ...(record.longTermGoals || []),
        // All dynamic intervention values (strings + flattened arrays)
        ...Object.values(record.immediateInterventions || {}).flatMap(interventionLines),
        ...(record.pendingProcedures || []),
        ...(record.rehabilitationReferrals || []),
      ].filter(Boolean).join(' ').toLowerCase();

      const phrase = searchTerm.toLowerCase().trim();

      // Check if record matches at all (Level 1 gate)
      if (!searchableText.includes(phrase)) {
        return null;
      }

      // Check if search matches document title for _showAllSections
      const docTitleRegex = /^treatment\s+plan(\s+\d+)?$/i;
      const showAllSections = docTitleRegex.test(phrase);

      return { ...record, _showAllSections: showAllSections };
    }).filter(Boolean);
  }, [unwrappedData, searchTerm]);

  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <div className="treatment-plans-document">
        <div className="no-data">No treatment plan data available</div>
      </div>
    );
  }

  return (
    <div className="treatment-plans-document">
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">Treatment Plans</h1>

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
            document={<TreatmentPlansDocumentPDFTemplate document={pdfData} />}
            fileName="treatment-plans.pdf"
            className="pdf-btn"
          >
            {({ loading }) => (loading ? 'Preparing...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>

        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search treatment plans..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>
          )}
        </div>
      </div>

      {/* Records */}
      {filteredRecords.map((record, idx) => {
        // Level 2/3: Section-level filtering with IIFE pattern
        const recordInfoMatches = (() => {
          if (!searchTerm.trim() || record._showAllSections) return true;
          return shouldShowRow(record,
            'Record Info', 'record info', 'RECORD INFO',
            'Date', 'date', 'Provider', 'provider', 'Specialty', 'specialty',
            record.provider, record.specialty, formatDate(record.date)
          );
        })();

        const shortTermGoalsMatches = (() => {
          if (!searchTerm.trim() || record._showAllSections) return true;
          const goalsText = (record.shortTermGoals || []).join(' ');
          return shouldShowRow(record,
            'Short-Term Goals', 'short-term goals', 'SHORT-TERM GOALS',
            goalsText
          );
        })();

        const longTermGoalsMatches = (() => {
          if (!searchTerm.trim() || record._showAllSections) return true;
          const goalsText = (record.longTermGoals || []).join(' ');
          return shouldShowRow(record,
            'Long-Term Goals', 'long-term goals', 'LONG-TERM GOALS',
            goalsText
          );
        })();

        const immediateInterventionsMatches = (() => {
          if (!searchTerm.trim() || record._showAllSections) return true;
          const interventions = record.immediateInterventions || {};
          const keyLabels = Object.keys(interventions).map(humanizeKey);
          const interventionsText = Object.values(interventions).flatMap(interventionLines).join(' ');
          return shouldShowRow(record,
            'Immediate Interventions', 'immediate interventions', 'IMMEDIATE INTERVENTIONS',
            ...keyLabels,
            interventionsText
          );
        })();

        const pendingProceduresMatches = (() => {
          if (!searchTerm.trim() || record._showAllSections) return true;
          const proceduresText = (record.pendingProcedures || []).join(' ');
          return shouldShowRow(record,
            'Pending Procedures', 'pending procedures', 'PENDING PROCEDURES',
            proceduresText
          );
        })();

        const rehabilitationReferralsMatches = (() => {
          if (!searchTerm.trim() || record._showAllSections) return true;
          const referralsText = (record.rehabilitationReferrals || []).join(' ');
          return shouldShowRow(record,
            'Rehabilitation Referrals', 'rehabilitation referrals', 'REHABILITATION REFERRALS',
            referralsText
          );
        })();

        return (
          <div key={idx} className="record-card">
            {/* Record Header */}
            <div className="record-header">
              <h2 className="record-title">{highlightText(`Treatment Plan ${idx + 1}`)}</h2>
              <div className="header-top-row">
                {record.date && (
                  <span className="date-badge">{highlightText(formatDate(record.date))}</span>
                )}
              </div>
            </div>

            {/* Section 1: Record Info */}
            {recordInfoMatches && (hasValue(record.provider) || hasValue(record.specialty)) && (() => {
              // IIFE for sectionTitleMatches - show ALL rows when section title is searched
              const sectionTitleMatches = (() => {
                if (!searchTerm.trim()) return true;
                if (record._showAllSections) return true;
                const phrase = searchTerm.toLowerCase().trim();
                const sectionTitles = ['record info', 'record information'];
                return sectionTitles.some(t => t.includes(phrase) || phrase.includes(t));
              })();

              return (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Record Info', `record-info-${idx}`, () => {
                      const lines = ['RECORD INFO', '═══════════════════════════════════════'];
                      const r = pdfData[idx] || record;
                      if (r.provider) lines.push(`Provider: ${r.provider}`);
                      if (r.specialty) lines.push(`Specialty: ${r.specialty}`);
                      copySectionToClipboard(lines.join('\n'), `record-info-${idx}`);
                    }, idx, 'record-info')}

                    {(sectionTitleMatches || shouldShowRow(record, 'Provider', 'provider', record.provider)) &&
                      renderEditableField(record, 'provider', 'Provider', idx, 'record-info', `provider-${idx}`)
                    }

                    {(sectionTitleMatches || shouldShowRow(record, 'Specialty', 'specialty', record.specialty)) &&
                      renderEditableField(record, 'specialty', 'Specialty', idx, 'record-info', `specialty-${idx}`)
                    }
                  </div>
                </div>
              );
            })()}

            {/* Section 2: Short-Term Goals */}
            {shortTermGoalsMatches && hasValue(record.shortTermGoals) && (() => {
              // IIFE for sectionTitleMatches - show ALL rows when section title is searched
              const sectionTitleMatches = (() => {
                if (!searchTerm.trim()) return true;
                if (record._showAllSections) return true;
                const phrase = searchTerm.toLowerCase().trim();
                const sectionTitles = ['short-term goals', 'short term goals'];
                return sectionTitles.some(t => t.includes(phrase) || phrase.includes(t));
              })();

              return (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Short-Term Goals', `short-term-${idx}`, () => {
                      const lines = ['SHORT-TERM GOALS', '═══════════════════════════════════════'];
                      const r = pdfData[idx] || record;
                      (r.shortTermGoals || []).forEach((goal, i) => lines.push(`${i + 1}. ${goal}`));
                      copySectionToClipboard(lines.join('\n'), `short-term-${idx}`);
                    }, idx, 'short-term')}

                    {record.shortTermGoals.map((goal, gIdx) => (
                      (sectionTitleMatches || shouldShowRow(record, goal)) &&
                        renderEditableArrayItem(record, 'shortTermGoals', goal, idx, gIdx, 'short-term', `short-goal-${idx}-${gIdx}`)
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Section 3: Long-Term Goals */}
            {longTermGoalsMatches && hasValue(record.longTermGoals) && (() => {
              // IIFE for sectionTitleMatches - show ALL rows when section title is searched
              const sectionTitleMatches = (() => {
                if (!searchTerm.trim()) return true;
                if (record._showAllSections) return true;
                const phrase = searchTerm.toLowerCase().trim();
                const sectionTitles = ['long-term goals', 'long term goals'];
                return sectionTitles.some(t => t.includes(phrase) || phrase.includes(t));
              })();

              return (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Long-Term Goals', `long-term-${idx}`, () => {
                      const lines = ['LONG-TERM GOALS', '═══════════════════════════════════════'];
                      const r = pdfData[idx] || record;
                      (r.longTermGoals || []).forEach((goal, i) => lines.push(`${i + 1}. ${goal}`));
                      copySectionToClipboard(lines.join('\n'), `long-term-${idx}`);
                    }, idx, 'long-term')}

                    {record.longTermGoals.map((goal, gIdx) => (
                      (sectionTitleMatches || shouldShowRow(record, goal)) &&
                        renderEditableArrayItem(record, 'longTermGoals', goal, idx, gIdx, 'long-term', `long-goal-${idx}-${gIdx}`)
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Section 4: Immediate Interventions (dynamic-key object) */}
            {immediateInterventionsMatches && hasValue(record.immediateInterventions) && (() => {
              const interventions = record.immediateInterventions;
              const interventionKeys = Object.keys(interventions).filter(k => hasValue(interventions[k]));
              if (interventionKeys.length === 0) return null;

              // IIFE for sectionTitleMatches - show ALL content when main section title is searched
              const sectionTitleMatches = (() => {
                if (!searchTerm.trim()) return true;
                if (record._showAllSections) return true;
                const phrase = searchTerm.toLowerCase().trim();
                const sectionTitles = ['immediate interventions', 'immediate', 'interventions'];
                return sectionTitles.some(t => t.includes(phrase) || phrase.includes(t));
              })();

              return (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h3 className="section-title">{highlightText('Immediate Interventions')}</h3>
                      <button
                        className={`copy-btn ${copiedSectionId === `interventions-${idx}` ? 'copied' : ''}`}
                        onClick={() => {
                          const lines = ['IMMEDIATE INTERVENTIONS', '═══════════════════════════════════════'];
                          interventionKeys.forEach((k) => {
                            const vals = interventionLines(interventions[k]);
                            if (vals.length === 1) {
                              lines.push(`${humanizeKey(k)}: ${vals[0]}`);
                            } else if (vals.length > 1) {
                              lines.push(`${humanizeKey(k)}:`);
                              vals.forEach((v, i) => lines.push(`  ${i + 1}. ${v}`));
                            }
                          });
                          copySectionToClipboard(lines.join('\n'), `interventions-${idx}`);
                        }}
                      >
                        {copiedSectionId === `interventions-${idx}` ? 'Copied!' : 'Copy Section'}
                      </button>
                    </div>

                    {interventionKeys.map((k) => {
                      const label = humanizeKey(k);
                      const vals = interventionLines(interventions[k]);
                      const subsectionMatches = (() => {
                        if (!searchTerm.trim()) return true;
                        if (record._showAllSections || sectionTitleMatches) return true;
                        const phrase = searchTerm.toLowerCase().trim();
                        return label.toLowerCase().includes(phrase) || phrase.includes(label.toLowerCase());
                      })();
                      const rowMatches = sectionTitleMatches || subsectionMatches || shouldShowRow(record, ...vals);
                      if (!rowMatches) return null;

                      return (
                        <div className="rec-mini-card" key={k}>
                          <div className="subsection-header">
                            <div className="nested-subtitle">{highlightText(label)}</div>
                            <button
                              className={`copy-btn ${copiedSectionId === `iv-${idx}-${k}` ? 'copied' : ''}`}
                              onClick={() => {
                                if (vals.length === 1) {
                                  copySectionToClipboard(`${label}: ${vals[0]}`, `iv-${idx}-${k}`);
                                } else {
                                  const lines = [label.toUpperCase(), '───────────────────────────────────────'];
                                  vals.forEach((v, i) => lines.push(`${i + 1}. ${v}`));
                                  copySectionToClipboard(lines.join('\n'), `iv-${idx}-${k}`);
                                }
                              }}
                            >
                              {copiedSectionId === `iv-${idx}-${k}` ? 'Copied!' : 'Copy Section'}
                            </button>
                          </div>
                          {vals.map((v, vIdx) => (
                            <div key={vIdx} className="numbered-row">
                              <div className="row-content">
                                <span className="content-value">{highlightText(v)}</span>
                              </div>
                              <button
                                className={`copy-btn ${copiedId === `iv-${idx}-${k}-${vIdx}` ? 'copied' : ''}`}
                                onClick={() => copyToClipboard(v, `iv-${idx}-${k}-${vIdx}`)}
                              >
                                {copiedId === `iv-${idx}-${k}-${vIdx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Section 5: Pending Procedures */}
            {pendingProceduresMatches && hasValue(record.pendingProcedures) && (() => {
              // IIFE for sectionTitleMatches - show ALL rows when section title is searched
              const sectionTitleMatches = (() => {
                if (!searchTerm.trim()) return true;
                if (record._showAllSections) return true;
                const phrase = searchTerm.toLowerCase().trim();
                const sectionTitles = ['pending procedures', 'pending', 'procedures'];
                return sectionTitles.some(t => t.includes(phrase) || phrase.includes(t));
              })();

              return (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Pending Procedures', `pending-${idx}`, () => {
                      const lines = ['PENDING PROCEDURES', '═══════════════════════════════════════'];
                      const r = pdfData[idx] || record;
                      (r.pendingProcedures || []).forEach((proc, i) => lines.push(`${i + 1}. ${proc}`));
                      copySectionToClipboard(lines.join('\n'), `pending-${idx}`);
                    }, idx, 'pending')}

                    {record.pendingProcedures.map((proc, pIdx) => (
                      (sectionTitleMatches || shouldShowRow(record, proc)) &&
                        renderEditableArrayItem(record, 'pendingProcedures', proc, idx, pIdx, 'pending', `proc-${idx}-${pIdx}`)
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Section 6: Rehabilitation Referrals */}
            {rehabilitationReferralsMatches && hasValue(record.rehabilitationReferrals) && (() => {
              // IIFE for sectionTitleMatches - show ALL rows when section title is searched
              const sectionTitleMatches = (() => {
                if (!searchTerm.trim()) return true;
                if (record._showAllSections) return true;
                const phrase = searchTerm.toLowerCase().trim();
                const sectionTitles = ['rehabilitation referrals', 'rehabilitation', 'referrals'];
                return sectionTitles.some(t => t.includes(phrase) || phrase.includes(t));
              })();

              return (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Rehabilitation Referrals', `rehab-${idx}`, () => {
                      const lines = ['REHABILITATION REFERRALS', '═══════════════════════════════════════'];
                      const r = pdfData[idx] || record;
                      (r.rehabilitationReferrals || []).forEach((ref, i) => lines.push(`${i + 1}. ${ref}`));
                      copySectionToClipboard(lines.join('\n'), `rehab-${idx}`);
                    }, idx, 'rehab')}

                    {record.rehabilitationReferrals.map((ref, rIdx) => (
                      (sectionTitleMatches || shouldShowRow(record, ref)) &&
                        renderEditableArrayItem(record, 'rehabilitationReferrals', ref, idx, rIdx, 'rehab', `ref-${idx}-${rIdx}`)
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })}

      {filteredRecords.length === 0 && searchTerm && (
        <div className="no-results">No results found for "{searchTerm}"</div>
      )}
    </div>
  );
};

export default TreatmentPlansDocument;
