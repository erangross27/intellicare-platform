import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import SearchBar from '../components/SearchBar';
import TherapyRequestsDocumentPDFTemplate from '../pdf-templates/TherapyRequestsDocumentPDFTemplate';
import './TherapyRequestsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'therapyRequestsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const TherapyRequestsDocument = ({ document }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItem, setCopiedItem] = useState(null);
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

  // Data unwrapping
  const validRecords = useMemo(() => {
    let records = [];
    if (Array.isArray(document)) {
      if (document.length > 0 && document[0]?.records) {
        records = document[0].records;
      } else if (document.length > 0 && document[0]?._records) {
        records = document[0]._records;
      } else {
        records = document;
      }
    } else if (document?.records) {
      records = document.records;
    } else if (document?._records) {
      records = document._records;
    } else if (document) {
      records = [document];
    }
    return Array.isArray(records) ? records : [];
  }, [document]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nStatus = {};
    validRecords.forEach((record, idx) => {
      const rawId = record && record._id;
      const recId = rawId && typeof rawId === 'object' ? (rawId.$oid || rawId.toString()) : rawId;
      const recordDrafts = recId ? store[recId] : null;
      if (!recordDrafts) return;
      Object.entries(recordDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
        // Map base field → its sectionId so the edited/approve markers light up
        const sectionId = Object.keys(SECTION_FIELDS).find(sid => SECTION_FIELDS[sid].includes(baseField));
        nLocal[editKey] = value;
        nPending[editKey] = true;
        if (sectionId) nFields[`${sectionId}-${idx}`] = true;
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
  }, [validRecords]); // eslint-disable-line react-hooks/exhaustive-deps

  // Safe string conversion
  const safeString = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (typeof val === 'object') {
      if (Object.keys(val).length === 0) return '';
      if (val.value !== undefined) return String(val.value);
      if (val.text !== undefined) return String(val.text);
      return JSON.stringify(val);
    }
    return String(val);
  };

  // Format date helper
  const formatDate = (dateValue) => {
    if (!dateValue) return '';
    try {
      const dateStr = dateValue.$date || dateValue;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return String(dateValue || '');
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return String(dateValue || '');
    }
  };

  // Format date ISO for search
  const formatDateISO = (dateValue) => {
    if (!dateValue) return '';
    try {
      const dateStr = dateValue.$date || dateValue;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  // Highlight text with search term
  const highlightText = (text) => {
    if (!text) return '';
    const textStr = safeString(text);
    if (!searchTerm.trim()) return textStr;

    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
    if (searchWords.length === 0) return textStr;

    const escapedWords = searchWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escapedWords.join('|')})`, 'gi');

    const parts = textStr.split(regex);
    if (parts.length === 1) return textStr;

    return (
      <>
        {parts.map((part, i) => {
          const isMatch = searchWords.some(w => part.toLowerCase() === w.toLowerCase());
          return isMatch ? <mark key={i}>{part}</mark> : part;
        })}
      </>
    );
  };

  // Should show row based on search
  const shouldShowRow = (record, ...values) => {
    if (!searchTerm.trim()) return true;
    const searchLower = searchTerm.toLowerCase().trim();
    const searchWords = searchLower.split(/\s+/).map(w => w.replace(/[()[\],.<>&:%]+/g, '')).filter(w => w.length > 0);

    return searchWords.every(word => {
      const wordNoHyphen = word.replace(/-/g, ' ');
      return values.some(val => {
        if (!val) return false;
        const valStr = safeString(val).toLowerCase().replace(/-/g, ' ');
        if (word.length <= 3) {
          const wordBoundaryRegex = new RegExp(`\\b${word}\\b`, 'i');
          return wordBoundaryRegex.test(valStr) || valStr.includes(wordNoHyphen);
        }
        return valStr.includes(word) || valStr.includes(wordNoHyphen);
      });
    });
  };

  // Should show section
  const shouldShowSection = (record, sectionTitle, sectionContent) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;

    const searchLower = searchTerm.toLowerCase().trim();
    const searchWords = searchLower.split(/\s+/).map(w => w.replace(/[()[\],.<>]+/g, '')).filter(w => w.length > 0);

    const titleLower = sectionTitle.toLowerCase();
    const contentLower = safeString(sectionContent).toLowerCase();
    const combinedText = `${titleLower} ${contentLower}`;

    return searchWords.every(word => {
      const wordNoHyphen = word.replace(/-/g, ' ');
      return combinedText.includes(word) || combinedText.includes(wordNoHyphen);
    });
  };

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
    const rawId = record._id;
    const recId = rawId && typeof rawId === 'object' ? (rawId.$oid || rawId.toString()) : rawId;
    if (!recId) return;
    const saveValue = editValue.trim();
    const fieldPart = (typeof arrayIndex === 'number') ? `${fieldName}.${arrayIndex}` : fieldName;
    const editKey = `${fieldPart}-${idx}`;
    const sKey = `${fieldName}-${idx}-s0`;

    setLocalEdits(prev => ({ ...prev, [editKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending
    setApprovedSections(prev => {
      if (!prev[sectionId]) return prev;
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });

    const store = readDrafts();
    if (!store[recId]) store[recId] = {};
    store[recId][fieldPart] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this record to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApprove = useCallback(async (record, idx, sectionId) => {
    const rawId = record._id;
    const recId = rawId && typeof rawId === 'object' ? (rawId.$oid || rawId.toString()) : rawId;
    if (!recId) return;
    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const dotIdx = fieldPart.lastIndexOf('.');
        const tail = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const isArrayIdx = dotIdx !== -1 && /^\d+$/.test(tail);
        const payload = { field: isArrayIdx ? fieldPart.slice(0, dotIdx) : fieldPart, value: localEdits[editKey] };
        if (isArrayIdx) payload.arrayIndex = parseInt(tail, 10);
        const response = await secureApiClient.put(`/api/edit/therapy_requests/${recId}/edit`, payload);
        if (!response || !response.success) throw new Error((response && response.error) || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/therapy_requests/${recId}/approve`);

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
      console.error('[TherapyRequests] Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // ============== SECTION_FIELDS + sectionHasEdits ==============
  const SECTION_FIELDS = {
    'request-info': ['requestIntent', 'requestPriority'],
    'therapy-details': ['therapyType'],
    'clinical-justification': ['reasonCode'],
    'requester-info': ['requesterName', 'requesterSpecialty', 'requesterId'],
    'performer-info': ['performerType', 'performerId'],
    'schedule': ['occurrenceTiming'],
    'functional-goals': ['functionalGoals'],
    'authorization': ['priorAuthorizationNumber'],
    'setting': ['settingType'],
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
    if (Object.keys(localEdits).length === 0) return validRecords;
    return validRecords.map((record, idx) => {
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
  }, [validRecords, localEdits, pendingEdits]);

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
    const displayValue = safeString(getFieldValue(record, fieldName, idx));
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
            className={`copy-btn ${copiedItem === copyId ? 'copied' : ''}`}
            onClick={() => copyItem(displayValue, copyId)}
          >
            {copiedItem === copyId ? 'Copied!' : 'Copy'}
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
            className={`copy-btn ${copiedItem === copyId ? 'copied' : ''}`}
            onClick={() => copyItem(displayValue, copyId)}
          >
            {copiedItem === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isItemEdited && <div className="modified-badge">edited — click approve to save</div>}
      </React.Fragment>
    );
  };

  // ============== SECTION HEADER WITH APPROVE ==============
  const renderSectionHeader = (title, copyId, copyFn, idx, sectionId) => (
    <div className="section-header">
      <h4 className="section-title">{highlightText(title)}</h4>
      <div className="header-right-actions">
        <button
          className={`section-copy-btn ${copiedSection === copyId ? 'copied' : ''}`}
          onClick={copyFn}
        >
          {copiedSection === copyId ? 'Copied!' : 'Copy Section'}
        </button>
        {(sectionHasEdits(sectionId) || approvedSections[sectionId]) && (
          <button
            className={`approve-btn${approvedSections[sectionId] ? ' approved' : ''}`}
            onClick={() => handleApprove(validRecords[idx], idx, sectionId)}
            disabled={approving}
          >
            {approving ? 'Approving...' : approvedSections[sectionId] ? 'Approved' : 'Approve'}
          </button>
        )}
      </div>
    </div>
  );

  // Filtered records with document-level search
  const filteredRecords = useMemo(() => {
    if (!validRecords.length) return [];

    return validRecords.map((record, idx) => {
      const recordNumber = String(idx + 1);
      const docTitle = `Therapy Request ${recordNumber}`;

      const searchableText = [
        docTitle,
        recordNumber,
        'therapy request', 'Therapy Request', 'THERAPY REQUEST',
        'therapy', 'Therapy', 'THERAPY',
        'request', 'Request', 'REQUEST',
        `therapy request ${recordNumber}`,
        // Section titles
        'request information', 'Request Information', 'REQUEST INFORMATION',
        'therapy details', 'Therapy Details', 'THERAPY DETAILS',
        'clinical justification', 'Clinical Justification', 'CLINICAL JUSTIFICATION',
        'requester information', 'Requester Information', 'REQUESTER INFORMATION',
        'performer information', 'Performer Information', 'PERFORMER INFORMATION',
        'schedule', 'Schedule', 'SCHEDULE',
        'functional goals', 'Functional Goals', 'FUNCTIONAL GOALS',
        'authorization', 'Authorization', 'AUTHORIZATION',
        'setting', 'Setting', 'SETTING',
        // Field labels
        'date', 'Date', 'DATE',
        'intent', 'Intent', 'INTENT',
        'priority', 'Priority', 'PRIORITY',
        'authored on', 'Authored On', 'AUTHORED ON',
        'therapy type', 'Therapy Type', 'THERAPY TYPE',
        'body structure', 'Body Structure', 'BODY STRUCTURE',
        'laterality', 'Laterality', 'LATERALITY',
        'therapy code', 'Therapy Code', 'THERAPY CODE',
        'code system', 'Code System', 'CODE SYSTEM',
        'reason', 'Reason', 'REASON',
        'reason code', 'Reason Code', 'REASON CODE',
        'reason reference', 'Reason Reference', 'REASON REFERENCE',
        'requester', 'Requester', 'REQUESTER',
        'requester id', 'Requester ID', 'REQUESTER ID',
        'specialty', 'Specialty', 'SPECIALTY',
        'performer type', 'Performer Type', 'PERFORMER TYPE',
        'performer id', 'Performer ID', 'PERFORMER ID',
        'number of sessions', 'Number of Sessions', 'NUMBER OF SESSIONS',
        'session duration', 'Session Duration', 'SESSION DURATION',
        'occurrence timing', 'Occurrence Timing', 'OCCURRENCE TIMING',
        'start date', 'Start Date', 'START DATE',
        'end date', 'End Date', 'END DATE',
        'prior authorization', 'Prior Authorization', 'PRIOR AUTHORIZATION',
        'authorization number', 'Authorization Number', 'AUTHORIZATION NUMBER',
        'insurance verified', 'Insurance Verified', 'INSURANCE VERIFIED',
        'setting type', 'Setting Type', 'SETTING TYPE',
        'location', 'Location', 'LOCATION',
        // Field values
        formatDate(record.date),
        formatDateISO(record.date),
        record.date,
        record.requestIntent,
        record.requestPriority,
        record.authoredOn,
        record.therapyType,
        record.bodyStructure,
        record.laterality,
        record.therapyCode,
        record.therapyCodeSystem,
        record.reasonCode,
        record.reasonReference,
        record.requesterName,
        record.requesterSpecialty,
        record.requesterId,
        record.performerType,
        record.performerId,
        record.numberOfSessions,
        record.sessionDuration,
        record.occurrenceTiming,
        formatDate(record.occurrenceStartDate),
        formatDateISO(record.occurrenceStartDate),
        formatDate(record.occurrenceEndDate),
        formatDateISO(record.occurrenceEndDate),
        record.priorAuthorizationNumber,
        record.settingType,
        record.locationId,
        // Goals array
        ...(record.functionalGoals || []),
        // Boolean values as strings
        record.priorAuthorizationRequired ? 'yes required' : 'no not required',
        record.insuranceVerified ? 'yes verified' : 'no not verified',
      ].filter(Boolean);

      if (!searchTerm.trim()) {
        return { ...record, _documentTitle: docTitle, _recordNumber: recordNumber };
      }

      const searchLower = searchTerm.toLowerCase().trim();
      const searchWords = searchLower.split(/\s+/).map(w => w.replace(/[()[\],.<>&:%]+/g, '')).filter(w => w.length > 0);

      const searchNumber = searchLower.match(/\d+/)?.[0];
      let showAllSections = false;

      if (searchNumber === recordNumber) {
        const titleWords = ['therapy', 'request'];
        if (titleWords.some(w => searchLower.includes(w)) || searchLower === searchNumber) {
          showAllSections = true;
        }
      }

      const matches = searchWords.every(word => {
        const wordNoHyphen = word.replace(/-/g, ' ');
        return searchableText.some(text => {
          const textLower = safeString(text).toLowerCase().replace(/[()[\],.<>&:%]/g, '').replace(/-/g, ' ');
          if (word.length <= 3) {
            const wordBoundaryRegex = new RegExp(`\\b${word}\\b`, 'i');
            const wordNoHyphenRegex = new RegExp(`\\b${wordNoHyphen}\\b`, 'i');
            return wordBoundaryRegex.test(textLower) || wordNoHyphenRegex.test(textLower);
          }
          return textLower.includes(word) || textLower.includes(wordNoHyphen);
        });
      });

      if (!matches) return null;

      return { ...record, _documentTitle: docTitle, _recordNumber: recordNumber, _showAllSections: showAllSections };
    }).filter(Boolean);
  }, [validRecords, searchTerm]);

  // Copy functions
  const copySection = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const copyItem = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(id);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  // Get text functions for copy
  const getRequestInfoText = (record) => {
    const lines = [];
    if (record.date) lines.push(`Date: ${formatDate(record.date)}`);
    if (record.requestIntent) lines.push(`Intent: ${safeString(record.requestIntent)}`);
    if (record.requestPriority) lines.push(`Priority: ${safeString(record.requestPriority)}`);
    if (record.authoredOn) lines.push(`Authored On: ${formatDate(record.authoredOn)}`);
    return lines.join('\n');
  };

  const getTherapyDetailsText = (record) => {
    const lines = [];
    if (record.therapyType) lines.push(`Therapy Type: ${safeString(record.therapyType)}`);
    if (record.bodyStructure) lines.push(`Body Structure: ${safeString(record.bodyStructure)}`);
    if (record.laterality) lines.push(`Laterality: ${safeString(record.laterality)}`);
    if (record.therapyCode) lines.push(`Therapy Code: ${safeString(record.therapyCode)}`);
    if (record.therapyCodeSystem) lines.push(`Code System: ${safeString(record.therapyCodeSystem)}`);
    return `Therapy Details\n${lines.join('\n')}`;
  };

  const getClinicalJustificationText = (record) => {
    const lines = [];
    if (record.reasonCode) lines.push(`Reason: ${safeString(record.reasonCode)}`);
    if (record.reasonReference) lines.push(`Reference: ${safeString(record.reasonReference)}`);
    return `Clinical Justification\n${lines.join('\n')}`;
  };

  const getRequesterInfoText = (record) => {
    const lines = [];
    if (record.requesterName) lines.push(`Requester: ${safeString(record.requesterName)}`);
    if (record.requesterSpecialty) lines.push(`Specialty: ${safeString(record.requesterSpecialty)}`);
    if (record.requesterId) lines.push(`Requester ID: ${safeString(record.requesterId)}`);
    return `Requester Information\n${lines.join('\n')}`;
  };

  const getPerformerInfoText = (record) => {
    const lines = [];
    if (record.performerType) lines.push(`Performer Type: ${safeString(record.performerType)}`);
    if (record.performerId) lines.push(`Performer ID: ${safeString(record.performerId)}`);
    return `Performer Information\n${lines.join('\n')}`;
  };

  const getScheduleText = (record) => {
    const lines = [];
    if (record.numberOfSessions) lines.push(`Number of Sessions: ${record.numberOfSessions}`);
    if (record.sessionDuration) lines.push(`Session Duration: ${record.sessionDuration} minutes`);
    if (record.occurrenceTiming) lines.push(`Occurrence Timing: ${safeString(record.occurrenceTiming)}`);
    if (record.occurrenceStartDate) lines.push(`Start Date: ${formatDate(record.occurrenceStartDate)}`);
    if (record.occurrenceEndDate) lines.push(`End Date: ${formatDate(record.occurrenceEndDate)}`);
    return `Schedule\n${lines.join('\n')}`;
  };

  const getFunctionalGoalsText = (record) => {
    if (!record.functionalGoals || !record.functionalGoals.length) return '';
    const lines = record.functionalGoals.map((goal, i) => `${i + 1}. ${goal}`);
    return `Functional Goals\n${lines.join('\n')}`;
  };

  const getAuthorizationText = (record) => {
    const lines = [];
    lines.push(`Prior Authorization Required: ${record.priorAuthorizationRequired ? 'Yes' : 'No'}`);
    if (record.priorAuthorizationNumber) lines.push(`Authorization Number: ${safeString(record.priorAuthorizationNumber)}`);
    lines.push(`Insurance Verified: ${record.insuranceVerified ? 'Yes' : 'No'}`);
    return `Authorization\n${lines.join('\n')}`;
  };

  const getSettingText = (record) => {
    const lines = [];
    if (record.settingType) lines.push(`Setting Type: ${safeString(record.settingType)}`);
    if (record.locationId) lines.push(`Location: ${safeString(record.locationId)}`);
    return `Setting\n${lines.join('\n')}`;
  };

  const getAllText = () => {
    const dataToUse = Object.keys(localEdits).length > 0 ? pdfData : filteredRecords;
    return dataToUse.map((record, rIdx) => {
      const recNumber = record._recordNumber || String(rIdx + 1);
      const sections = [];
      sections.push(`THERAPY REQUEST ${recNumber}`);
      sections.push('');

      const requestInfo = getRequestInfoText(record);
      if (requestInfo) sections.push(`REQUEST INFORMATION\n${requestInfo}`);

      if (record.therapyType || record.bodyStructure || record.laterality || record.therapyCode) {
        sections.push(getTherapyDetailsText(record));
      }

      if (record.reasonCode || record.reasonReference) {
        sections.push(getClinicalJustificationText(record));
      }

      if (record.requesterName || record.requesterSpecialty || record.requesterId) {
        sections.push(getRequesterInfoText(record));
      }

      if (record.performerType || record.performerId) {
        sections.push(getPerformerInfoText(record));
      }

      if (record.numberOfSessions || record.sessionDuration || record.occurrenceTiming || record.occurrenceStartDate || record.occurrenceEndDate) {
        sections.push(getScheduleText(record));
      }

      if (record.functionalGoals?.length) {
        sections.push(getFunctionalGoalsText(record));
      }

      sections.push(getAuthorizationText(record));

      if (record.settingType || record.locationId) {
        sections.push(getSettingText(record));
      }

      return sections.join('\n\n');
    }).join('\n\n---\n\n');
  };

  // Empty state
  if (!validRecords.length) {
    return (
      <div className="therapy-requests-document">
        <h1 className="document-title">Therapy Requests</h1>
        <p className="no-data-message">No therapy request data available</p>
      </div>
    );
  }

  return (
    <div className="therapy-requests-document">
      <h1 className="document-title">Therapy Requests</h1>

      <div className="header-controls">
        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />
        <div className="action-buttons">
          <button
            className={`action-btn ${copiedSection === 'all' ? 'copied' : ''}`}
            onClick={() => copySection(getAllText(), 'all')}
          >
            {copiedSection === 'all' ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<TherapyRequestsDocumentPDFTemplate document={pdfData} />}
            fileName="therapy-requests.pdf"
            className="action-btn"
          >
            {({ loading }) => (loading ? 'Preparing PDF...' : 'Export to PDF')}
          </PDFDownloadLink>
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <p className="no-results-message">No results found for "{searchTerm}"</p>
      ) : (
        filteredRecords.map((record, idx) => {
          const showAll = record._showAllSections;
          const isSearching = searchTerm.trim();

          return (
            <div key={idx} className="record-container">
              <h2 className="record-title">{highlightText(`Therapy Request ${record._recordNumber}`)}</h2>

              {/* Request Information Section */}
              {(record.date || record.requestIntent || record.requestPriority || record.authoredOn) && (() => {
                const sectionContent = `request information Request Information REQUEST INFORMATION date intent priority authored on ${formatDate(record.date)} ${formatDateISO(record.date)} ${record.requestIntent} ${record.requestPriority} ${record.authoredOn}`;

                if (!shouldShowSection(record, 'Request Information', sectionContent)) return null;

                const sectionTitleMatches = searchTerm && shouldShowRow(record,
                  'request information', 'Request Information', 'REQUEST INFORMATION');

                const showDate = record.date && (showAll || sectionTitleMatches || shouldShowRow(record, 'date', 'Date', formatDate(record.date), formatDateISO(record.date)));
                const showIntent = record.requestIntent && (showAll || sectionTitleMatches || shouldShowRow(record, 'intent', 'Intent', record.requestIntent));
                const showPriority = record.requestPriority && (showAll || sectionTitleMatches || shouldShowRow(record, 'priority', 'Priority', record.requestPriority));
                const showAuthoredOn = record.authoredOn && (showAll || sectionTitleMatches || shouldShowRow(record, 'authored on', 'Authored On', formatDate(record.authoredOn)));

                if (!isSearching || showDate || showIntent || showPriority || showAuthoredOn) {
                  return (
                    <div className="section">
                      {renderSectionHeader('Request Information', `request-${idx}`, () => copySection(getRequestInfoText(pdfData[idx] || record), `request-${idx}`), idx, 'request-info')}
                      <div className="mini-cards-container">
                        {/* date — read-only */}
                        {(!isSearching || showDate) && record.date && (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText('Date')}</div>
                            <div className="numbered-row">
                              <div className="row-content">
                                <span className="content-value">{highlightText(formatDate(record.date))}</span>
                              </div>
                              <button
                                className={`copy-btn ${copiedItem === `date-${idx}` ? 'copied' : ''}`}
                                onClick={() => copyItem(formatDate(record.date), `date-${idx}`)}
                              >
                                {copiedItem === `date-${idx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}
                        {/* requestIntent — editable */}
                        {(!isSearching || showIntent) &&
                          renderEditableField(record, 'requestIntent', 'Intent', idx, 'request-info', `intent-${idx}`)
                        }
                        {/* requestPriority — editable */}
                        {(!isSearching || showPriority) &&
                          renderEditableField(record, 'requestPriority', 'Priority', idx, 'request-info', `priority-${idx}`)
                        }
                        {/* authoredOn — read-only */}
                        {(!isSearching || showAuthoredOn) && record.authoredOn && (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText('Authored On')}</div>
                            <div className="numbered-row">
                              <div className="row-content">
                                <span className="content-value">{highlightText(formatDate(record.authoredOn))}</span>
                              </div>
                              <button
                                className={`copy-btn ${copiedItem === `authored-${idx}` ? 'copied' : ''}`}
                                onClick={() => copyItem(formatDate(record.authoredOn), `authored-${idx}`)}
                              >
                                {copiedItem === `authored-${idx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Therapy Details Section */}
              {(record.therapyType || record.bodyStructure || record.laterality || record.therapyCode || record.therapyCodeSystem) && (() => {
                const sectionContent = `therapy details Therapy Details THERAPY DETAILS therapy type body structure laterality code system ${record.therapyType} ${record.bodyStructure} ${record.laterality} ${record.therapyCode} ${record.therapyCodeSystem}`;

                if (!shouldShowSection(record, 'Therapy Details', sectionContent)) return null;

                const sectionTitleMatches = searchTerm && shouldShowRow(record,
                  'therapy details', 'Therapy Details', 'THERAPY DETAILS');

                const showTherapyType = record.therapyType && (showAll || sectionTitleMatches || shouldShowRow(record, 'therapy type', 'Therapy Type', record.therapyType));
                const showBodyStructure = record.bodyStructure && (showAll || sectionTitleMatches || shouldShowRow(record, 'body structure', 'Body Structure', record.bodyStructure));
                const showLaterality = record.laterality && (showAll || sectionTitleMatches || shouldShowRow(record, 'laterality', 'Laterality', record.laterality));
                const showTherapyCode = record.therapyCode && (showAll || sectionTitleMatches || shouldShowRow(record, 'therapy code', 'Therapy Code', record.therapyCode));
                const showCodeSystem = record.therapyCodeSystem && (showAll || sectionTitleMatches || shouldShowRow(record, 'code system', 'Code System', record.therapyCodeSystem));

                if (!isSearching || showTherapyType || showBodyStructure || showLaterality || showTherapyCode || showCodeSystem) {
                  return (
                    <div className="section">
                      {renderSectionHeader('Therapy Details', `therapy-${idx}`, () => copySection(getTherapyDetailsText(pdfData[idx] || record), `therapy-${idx}`), idx, 'therapy-details')}
                      <div className="mini-cards-container">
                        {/* therapyType — editable */}
                        {(!isSearching || showTherapyType) &&
                          renderEditableField(record, 'therapyType', 'Therapy Type', idx, 'therapy-details', `therapy-type-${idx}`)
                        }
                        {/* bodyStructure — read-only */}
                        {(!isSearching || showBodyStructure) && record.bodyStructure && (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText('Body Structure')}</div>
                            <div className="numbered-row">
                              <div className="row-content">
                                <span className="content-value">{highlightText(safeString(record.bodyStructure))}</span>
                              </div>
                              <button
                                className={`copy-btn ${copiedItem === `body-structure-${idx}` ? 'copied' : ''}`}
                                onClick={() => copyItem(safeString(record.bodyStructure), `body-structure-${idx}`)}
                              >
                                {copiedItem === `body-structure-${idx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}
                        {/* laterality — read-only */}
                        {(!isSearching || showLaterality) && record.laterality && (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText('Laterality')}</div>
                            <div className="numbered-row">
                              <div className="row-content">
                                <span className="content-value">{highlightText(safeString(record.laterality))}</span>
                              </div>
                              <button
                                className={`copy-btn ${copiedItem === `laterality-${idx}` ? 'copied' : ''}`}
                                onClick={() => copyItem(safeString(record.laterality), `laterality-${idx}`)}
                              >
                                {copiedItem === `laterality-${idx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}
                        {/* therapyCode — read-only */}
                        {(!isSearching || showTherapyCode) && record.therapyCode && (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText('Therapy Code')}</div>
                            <div className="numbered-row">
                              <div className="row-content">
                                <span className="content-value">{highlightText(safeString(record.therapyCode))}</span>
                              </div>
                              <button
                                className={`copy-btn ${copiedItem === `therapy-code-${idx}` ? 'copied' : ''}`}
                                onClick={() => copyItem(safeString(record.therapyCode), `therapy-code-${idx}`)}
                              >
                                {copiedItem === `therapy-code-${idx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}
                        {/* therapyCodeSystem — read-only */}
                        {(!isSearching || showCodeSystem) && record.therapyCodeSystem && (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText('Code System')}</div>
                            <div className="numbered-row">
                              <div className="row-content">
                                <span className="content-value">{highlightText(safeString(record.therapyCodeSystem))}</span>
                              </div>
                              <button
                                className={`copy-btn ${copiedItem === `code-system-${idx}` ? 'copied' : ''}`}
                                onClick={() => copyItem(safeString(record.therapyCodeSystem), `code-system-${idx}`)}
                              >
                                {copiedItem === `code-system-${idx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Clinical Justification Section */}
              {(record.reasonCode || record.reasonReference) && (() => {
                const sectionContent = `clinical justification Clinical Justification CLINICAL JUSTIFICATION reason code reference ${record.reasonCode} ${record.reasonReference}`;

                if (!shouldShowSection(record, 'Clinical Justification', sectionContent)) return null;

                const sectionTitleMatches = searchTerm && shouldShowRow(record,
                  'clinical justification', 'Clinical Justification', 'CLINICAL JUSTIFICATION');

                const showReasonCode = record.reasonCode && (showAll || sectionTitleMatches || shouldShowRow(record, 'reason', 'Reason', 'reason code', record.reasonCode));
                const showReasonReference = record.reasonReference && (showAll || sectionTitleMatches || shouldShowRow(record, 'reference', 'Reference', 'reason reference', record.reasonReference));

                if (!isSearching || showReasonCode || showReasonReference) {
                  return (
                    <div className="section">
                      {renderSectionHeader('Clinical Justification', `justification-${idx}`, () => copySection(getClinicalJustificationText(pdfData[idx] || record), `justification-${idx}`), idx, 'clinical-justification')}
                      <div className="mini-cards-container">
                        {/* reasonCode — editable */}
                        {(!isSearching || showReasonCode) &&
                          renderEditableField(record, 'reasonCode', 'Reason', idx, 'clinical-justification', `reason-${idx}`)
                        }
                        {/* reasonReference — read-only */}
                        {(!isSearching || showReasonReference) && record.reasonReference && (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText('Reference')}</div>
                            <div className="numbered-row">
                              <div className="row-content">
                                <span className="content-value">{highlightText(safeString(record.reasonReference))}</span>
                              </div>
                              <button
                                className={`copy-btn ${copiedItem === `reference-${idx}` ? 'copied' : ''}`}
                                onClick={() => copyItem(safeString(record.reasonReference), `reference-${idx}`)}
                              >
                                {copiedItem === `reference-${idx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Requester Information Section */}
              {(record.requesterName || record.requesterSpecialty || record.requesterId) && (() => {
                const sectionContent = `requester information Requester Information REQUESTER INFORMATION requester specialty requester id ${record.requesterName} ${record.requesterSpecialty} ${record.requesterId}`;

                if (!shouldShowSection(record, 'Requester Information', sectionContent)) return null;

                const sectionTitleMatches = searchTerm && shouldShowRow(record,
                  'requester information', 'Requester Information', 'REQUESTER INFORMATION');

                const showRequesterName = record.requesterName && (showAll || sectionTitleMatches || shouldShowRow(record, 'requester', 'Requester', record.requesterName));
                const showSpecialty = record.requesterSpecialty && (showAll || sectionTitleMatches || shouldShowRow(record, 'specialty', 'Specialty', record.requesterSpecialty));
                const showRequesterId = record.requesterId && (showAll || sectionTitleMatches || shouldShowRow(record, 'requester id', 'Requester ID', record.requesterId));

                if (!isSearching || showRequesterName || showSpecialty || showRequesterId) {
                  return (
                    <div className="section">
                      {renderSectionHeader('Requester Information', `requester-${idx}`, () => copySection(getRequesterInfoText(pdfData[idx] || record), `requester-${idx}`), idx, 'requester-info')}
                      <div className="mini-cards-container">
                        {/* requesterName — editable */}
                        {(!isSearching || showRequesterName) &&
                          renderEditableField(record, 'requesterName', 'Requester', idx, 'requester-info', `requester-name-${idx}`)
                        }
                        {/* requesterSpecialty — editable */}
                        {(!isSearching || showSpecialty) &&
                          renderEditableField(record, 'requesterSpecialty', 'Specialty', idx, 'requester-info', `specialty-${idx}`)
                        }
                        {/* requesterId — editable */}
                        {(!isSearching || showRequesterId) &&
                          renderEditableField(record, 'requesterId', 'Requester ID', idx, 'requester-info', `requester-id-${idx}`)
                        }
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Performer Information Section */}
              {(record.performerType || record.performerId) && (() => {
                const sectionContent = `performer information Performer Information PERFORMER INFORMATION performer type performer id ${record.performerType} ${record.performerId}`;

                if (!shouldShowSection(record, 'Performer Information', sectionContent)) return null;

                const sectionTitleMatches = searchTerm && shouldShowRow(record,
                  'performer information', 'Performer Information', 'PERFORMER INFORMATION');

                const showPerformerType = record.performerType && (showAll || sectionTitleMatches || shouldShowRow(record, 'performer type', 'Performer Type', record.performerType));
                const showPerformerId = record.performerId && (showAll || sectionTitleMatches || shouldShowRow(record, 'performer id', 'Performer ID', record.performerId));

                if (!isSearching || showPerformerType || showPerformerId) {
                  return (
                    <div className="section">
                      {renderSectionHeader('Performer Information', `performer-${idx}`, () => copySection(getPerformerInfoText(pdfData[idx] || record), `performer-${idx}`), idx, 'performer-info')}
                      <div className="mini-cards-container">
                        {/* performerType — editable */}
                        {(!isSearching || showPerformerType) &&
                          renderEditableField(record, 'performerType', 'Performer Type', idx, 'performer-info', `performer-type-${idx}`)
                        }
                        {/* performerId — editable */}
                        {(!isSearching || showPerformerId) &&
                          renderEditableField(record, 'performerId', 'Performer ID', idx, 'performer-info', `performer-id-${idx}`)
                        }
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Schedule Section */}
              {(record.numberOfSessions || record.sessionDuration || record.occurrenceTiming || record.occurrenceStartDate || record.occurrenceEndDate) && (() => {
                const sectionContent = `schedule Schedule SCHEDULE number of sessions session duration occurrence timing start date end date ${record.numberOfSessions} ${record.sessionDuration} ${record.occurrenceTiming} ${formatDate(record.occurrenceStartDate)} ${formatDate(record.occurrenceEndDate)}`;

                if (!shouldShowSection(record, 'Schedule', sectionContent)) return null;

                const sectionTitleMatches = searchTerm && shouldShowRow(record,
                  'schedule', 'Schedule', 'SCHEDULE');

                const showNumSessions = record.numberOfSessions && (showAll || sectionTitleMatches || shouldShowRow(record, 'number of sessions', 'Number of Sessions', record.numberOfSessions));
                const showDuration = record.sessionDuration && (showAll || sectionTitleMatches || shouldShowRow(record, 'session duration', 'Session Duration', record.sessionDuration));
                const showTiming = record.occurrenceTiming && (showAll || sectionTitleMatches || shouldShowRow(record, 'occurrence timing', 'Occurrence Timing', record.occurrenceTiming));
                const showStartDate = record.occurrenceStartDate && (showAll || sectionTitleMatches || shouldShowRow(record, 'start date', 'Start Date', formatDate(record.occurrenceStartDate)));
                const showEndDate = record.occurrenceEndDate && (showAll || sectionTitleMatches || shouldShowRow(record, 'end date', 'End Date', formatDate(record.occurrenceEndDate)));

                if (!isSearching || showNumSessions || showDuration || showTiming || showStartDate || showEndDate) {
                  return (
                    <div className="section">
                      {renderSectionHeader('Schedule', `schedule-${idx}`, () => copySection(getScheduleText(pdfData[idx] || record), `schedule-${idx}`), idx, 'schedule')}
                      <div className="mini-cards-container">
                        {/* numberOfSessions — read-only */}
                        {(!isSearching || showNumSessions) && record.numberOfSessions !== undefined && record.numberOfSessions !== null && (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText('Number of Sessions')}</div>
                            <div className="numbered-row">
                              <div className="row-content">
                                <span className="content-value">{highlightText(String(record.numberOfSessions))}</span>
                              </div>
                              <button
                                className={`copy-btn ${copiedItem === `num-sessions-${idx}` ? 'copied' : ''}`}
                                onClick={() => copyItem(String(record.numberOfSessions), `num-sessions-${idx}`)}
                              >
                                {copiedItem === `num-sessions-${idx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}
                        {/* sessionDuration — read-only */}
                        {(!isSearching || showDuration) && record.sessionDuration !== undefined && record.sessionDuration !== null && record.sessionDuration > 0 && (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText('Session Duration')}</div>
                            <div className="numbered-row">
                              <div className="row-content">
                                <span className="content-value">{highlightText(`${record.sessionDuration} minutes`)}</span>
                              </div>
                              <button
                                className={`copy-btn ${copiedItem === `duration-${idx}` ? 'copied' : ''}`}
                                onClick={() => copyItem(`${record.sessionDuration} minutes`, `duration-${idx}`)}
                              >
                                {copiedItem === `duration-${idx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}
                        {/* occurrenceTiming — editable */}
                        {(!isSearching || showTiming) &&
                          renderEditableField(record, 'occurrenceTiming', 'Occurrence Timing', idx, 'schedule', `timing-${idx}`)
                        }
                        {/* occurrenceStartDate — read-only */}
                        {(!isSearching || showStartDate) && record.occurrenceStartDate && (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText('Start Date')}</div>
                            <div className="numbered-row">
                              <div className="row-content">
                                <span className="content-value">{highlightText(formatDate(record.occurrenceStartDate))}</span>
                              </div>
                              <button
                                className={`copy-btn ${copiedItem === `start-date-${idx}` ? 'copied' : ''}`}
                                onClick={() => copyItem(formatDate(record.occurrenceStartDate), `start-date-${idx}`)}
                              >
                                {copiedItem === `start-date-${idx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}
                        {/* occurrenceEndDate — read-only */}
                        {(!isSearching || showEndDate) && record.occurrenceEndDate && (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText('End Date')}</div>
                            <div className="numbered-row">
                              <div className="row-content">
                                <span className="content-value">{highlightText(formatDate(record.occurrenceEndDate))}</span>
                              </div>
                              <button
                                className={`copy-btn ${copiedItem === `end-date-${idx}` ? 'copied' : ''}`}
                                onClick={() => copyItem(formatDate(record.occurrenceEndDate), `end-date-${idx}`)}
                              >
                                {copiedItem === `end-date-${idx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Functional Goals Section */}
              {record.functionalGoals && record.functionalGoals.length > 0 && (() => {
                const sectionContent = `functional goals Functional Goals FUNCTIONAL GOALS ${record.functionalGoals.join(' ')}`;

                if (!shouldShowSection(record, 'Functional Goals', sectionContent)) return null;

                const sectionTitleMatches = searchTerm && shouldShowRow(record,
                  'functional goals', 'Functional Goals', 'FUNCTIONAL GOALS');

                const filteredGoals = record.functionalGoals.filter(goal => {
                  return !isSearching || showAll || sectionTitleMatches || shouldShowRow(record, goal);
                });

                if (filteredGoals.length === 0) return null;

                return (
                  <div className="section">
                    {renderSectionHeader('Functional Goals', `goals-${idx}`, () => copySection(getFunctionalGoalsText(pdfData[idx] || record), `goals-${idx}`), idx, 'functional-goals')}
                    <div className="mini-cards-container">
                      {/* functionalGoals — editable array */}
                      {(isSearching && !showAll && !sectionTitleMatches ? filteredGoals : record.functionalGoals).map((goal, gIdx) =>
                        renderEditableArrayItem(record, 'functionalGoals', goal, idx, gIdx, 'functional-goals', `goal-${idx}-${gIdx}`)
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Authorization Section */}
              {(() => {
                const sectionContent = `authorization Authorization AUTHORIZATION prior authorization required number insurance verified ${record.priorAuthorizationRequired ? 'yes required' : 'no'} ${record.priorAuthorizationNumber} ${record.insuranceVerified ? 'yes verified' : 'no'}`;

                if (!shouldShowSection(record, 'Authorization', sectionContent)) return null;

                const sectionTitleMatches = searchTerm && shouldShowRow(record,
                  'authorization', 'Authorization', 'AUTHORIZATION');

                const showPriorAuth = showAll || sectionTitleMatches || shouldShowRow(record, 'prior authorization', 'Prior Authorization', record.priorAuthorizationRequired ? 'yes required' : 'no');
                const showAuthNumber = record.priorAuthorizationNumber && (showAll || sectionTitleMatches || shouldShowRow(record, 'authorization number', 'Authorization Number', record.priorAuthorizationNumber));
                const showInsurance = showAll || sectionTitleMatches || shouldShowRow(record, 'insurance verified', 'Insurance Verified', record.insuranceVerified ? 'yes verified' : 'no');

                if (!isSearching || showPriorAuth || showAuthNumber || showInsurance) {
                  return (
                    <div className="section">
                      {renderSectionHeader('Authorization', `auth-${idx}`, () => copySection(getAuthorizationText(pdfData[idx] || record), `auth-${idx}`), idx, 'authorization')}
                      <div className="mini-cards-container">
                        {/* priorAuthorizationRequired — read-only boolean */}
                        {(!isSearching || showPriorAuth) && (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText('Prior Authorization Required')}</div>
                            <div className="numbered-row">
                              <div className="row-content">
                                <span className={`content-value status-badge ${record.priorAuthorizationRequired ? 'status-yes' : 'status-no'}`}>
                                  {record.priorAuthorizationRequired ? 'Yes' : 'No'}
                                </span>
                              </div>
                              <button
                                className={`copy-btn ${copiedItem === `prior-auth-${idx}` ? 'copied' : ''}`}
                                onClick={() => copyItem(record.priorAuthorizationRequired ? 'Yes' : 'No', `prior-auth-${idx}`)}
                              >
                                {copiedItem === `prior-auth-${idx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}
                        {/* priorAuthorizationNumber — editable */}
                        {(!isSearching || showAuthNumber) &&
                          renderEditableField(record, 'priorAuthorizationNumber', 'Authorization Number', idx, 'authorization', `auth-number-${idx}`)
                        }
                        {/* insuranceVerified — read-only boolean */}
                        {(!isSearching || showInsurance) && (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText('Insurance Verified')}</div>
                            <div className="numbered-row">
                              <div className="row-content">
                                <span className={`content-value status-badge ${record.insuranceVerified ? 'status-yes' : 'status-no'}`}>
                                  {record.insuranceVerified ? 'Yes' : 'No'}
                                </span>
                              </div>
                              <button
                                className={`copy-btn ${copiedItem === `insurance-${idx}` ? 'copied' : ''}`}
                                onClick={() => copyItem(record.insuranceVerified ? 'Yes' : 'No', `insurance-${idx}`)}
                              >
                                {copiedItem === `insurance-${idx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Setting Section */}
              {(record.settingType || record.locationId) && (() => {
                const sectionContent = `setting Setting SETTING setting type location ${record.settingType} ${record.locationId}`;

                if (!shouldShowSection(record, 'Setting', sectionContent)) return null;

                const sectionTitleMatches = searchTerm && shouldShowRow(record,
                  'setting', 'Setting', 'SETTING');

                const showSettingType = record.settingType && (showAll || sectionTitleMatches || shouldShowRow(record, 'setting type', 'Setting Type', record.settingType));
                const showLocation = record.locationId && (showAll || sectionTitleMatches || shouldShowRow(record, 'location', 'Location', record.locationId));

                if (!isSearching || showSettingType || showLocation) {
                  return (
                    <div className="section">
                      {renderSectionHeader('Setting', `setting-${idx}`, () => copySection(getSettingText(pdfData[idx] || record), `setting-${idx}`), idx, 'setting')}
                      <div className="mini-cards-container">
                        {/* settingType — editable */}
                        {(!isSearching || showSettingType) &&
                          renderEditableField(record, 'settingType', 'Setting Type', idx, 'setting', `setting-type-${idx}`)
                        }
                        {/* locationId — read-only */}
                        {(!isSearching || showLocation) && record.locationId && (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText('Location')}</div>
                            <div className="numbered-row">
                              <div className="row-content">
                                <span className="content-value">{highlightText(safeString(record.locationId))}</span>
                              </div>
                              <button
                                className={`copy-btn ${copiedItem === `location-${idx}` ? 'copied' : ''}`}
                                onClick={() => copyItem(safeString(record.locationId), `location-${idx}`)}
                              >
                                {copiedItem === `location-${idx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          );
        })
      )}
    </div>
  );
};

export default TherapyRequestsDocument;
