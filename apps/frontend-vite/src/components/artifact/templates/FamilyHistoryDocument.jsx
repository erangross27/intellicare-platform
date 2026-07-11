/* FamilyHistoryDocument.jsx - December 2025 REBUILD */
/* Blue theme | Comfortaa font | Mini-card pattern | 4-level search */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import BlueSelect from '../components/BlueSelect';
import FamilyHistoryDocumentPDFTemplate from '../pdf-templates/FamilyHistoryDocumentPDFTemplate';
import './FamilyHistoryDocument.css';

/* Copy dividers: EQ (====) under section/record titles, DASH (----) under EVERY field label. */
const COPY_EQ = '='.repeat(40);
const COPY_DASH = '-'.repeat(40);

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'family_historyPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const FamilyHistoryDocument = ({ document, data }) => {
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

  // Unwrap nested documents
  const unwrappedData = useMemo(() => {
    if (!templateData) return [];
    if (Array.isArray(templateData)) {
      return templateData.flatMap(item => {
        if (item?.document) return Array.isArray(item.document) ? item.document : [item.document];
        if (item?.data) return Array.isArray(item.data) ? item.data : [item.data];
        return [item];
      });
    }
    return [templateData];
  }, [templateData]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nStatus = {};
    unwrappedData.forEach((record, idx) => {
      const recId = record && record._id ? (record._id.$oid || record._id) : null;
      const recordDrafts = recId ? store[recId] : null;
      if (!recordDrafts) return;
      Object.entries(recordDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // Mark every section that contains this field so the Pending Approve button shows + row highlights.
        Object.keys(SECTION_FIELDS).forEach(sectionId => {
          const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
          if (SECTION_FIELDS[sectionId].includes(baseField)) {
            nFields[`${sectionId}-${idx}`] = true;
          }
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

  // Format date helper
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

  // Split by semicolon helper (parenthesis-aware)
  // Split narrative text into sentences/items — on '. ' (sentence) AND ';' at paren depth 0.
  // Paren-aware ("(unconfirmed)" stays intact) + title-protected (won't split after Dr., Mr., etc.).
  const splitBySemicolon = (text) => {
    if (!text || typeof text !== 'string') return [];
    const result = [];
    let current = '';
    let parenDepth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') parenDepth++;
      else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
      if ((ch === ';' || ch === '.') && parenDepth === 0 && i + 1 < text.length && /\s/.test(text[i + 1])) {
        if (ch === '.' && /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|No|approx|Inc|Ltd|Co)$/i.test(current)) {
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

  // Fields that use semicolon splitting
  const SEMICOLON_FIELDS = ['maternalHistory', 'paternalHistory', 'grandparentalHistory', 'longevityPatterns', 'adoptionHistory', 'ethnicityHealthRisks', 'ageOfOnsetPatterns', 'reproductiveHistory'];

  // Highlight text helper
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

  // Copy to clipboard helper
  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // Copy section to clipboard helper
  const copySectionToClipboard = async (text, sectionId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSectionId(sectionId);
      setTimeout(() => setCopiedSectionId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
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
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, sentenceIdx, valueOverride) => {
    const recordId = record._id ? (record._id.$oid || record._id) : null;
    if (!recordId) return;
    let saveValue = valueOverride !== undefined ? valueOverride : editValue.trim();
    // For array items, sentenceIdx is used as arrayIndex when it's a number and not a semicolon field
    const isArrayField = typeof sentenceIdx === 'number' && !SEMICOLON_FIELDS.includes(fieldName);
    const fieldPart = isArrayField ? `${fieldName}.${sentenceIdx}` : fieldName;
    const editKey = `${fieldPart}-${idx}`;
    const sKey = isArrayField ? `${fieldName}.${sentenceIdx}-${idx}-s0` : `${fieldName}-${idx}-s${sentenceIdx || 0}`;

    setLocalEdits(prev => ({ ...prev, [editKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));
    // Re-edit after approval → drop the approved flag so the button goes back to yellow Pending Approve.
    setApprovedSections(prev => {
      const next = { ...prev };
      delete next[sectionId];
      delete next[`record-${idx}`];
      return next;
    });

    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldPart] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Save a boolean field (consanguinity / pedigreeAvailable) — stage a DRAFT locally (no DB write).
  const handleSaveBoolean = useCallback((record, fieldName, idx, sectionId, boolValue) => {
    const recordId = record._id ? (record._id.$oid || record._id) : null;
    if (!recordId) return;
    const editKey = `${fieldName}-${idx}`;
    const sKey = `${fieldName}-${idx}-s0`;

    setLocalEdits(prev => ({ ...prev, [editKey]: boolValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));
    setApprovedSections(prev => {
      const next = { ...prev };
      delete next[sectionId];
      delete next[`record-${idx}`];
      return next;
    });

    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldName] = boolValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, []);

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
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const dotIdx = fieldPart.lastIndexOf('.');
        const trailing = dotIdx !== -1 ? fieldPart.slice(dotIdx + 1) : '';
        const isArrayIndex = dotIdx !== -1 && /^\d+$/.test(trailing);
        const payload = { field: isArrayIndex ? fieldPart.slice(0, dotIdx) : fieldPart, value: localEdits[editKey] };
        if (isArrayIndex) payload.arrayIndex = parseInt(trailing, 10);
        const response = await secureApiClient.put(`/api/edit/family_history/${recordId}/edit`, payload);
        if (!response || !response.success) throw new Error((response && response.error) || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/family_history/${recordId}/approve`);

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
      setEditedFields(prev => {
        const updated = {};
        for (const key of Object.keys(prev)) {
          if (!key.endsWith(`-${idx}`)) updated[key] = prev[key];
        }
        return updated;
      });
      setEditedSentences(prev => {
        const updated = {};
        for (const key of Object.keys(prev)) {
          if (!key.includes(`-${idx}-`)) updated[key] = prev[key];
        }
        return updated;
      });
    } catch (err) {
      console.error('[FamilyHistory] Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // ============== SECTION_FIELDS + sectionHasEdits ==============
  const SECTION_FIELDS = {
    'immediate': ['maternalHistory', 'paternalHistory', 'siblingHistory', 'grandparentalHistory'],
    'conditions': ['psychiatricFamilyHistory', 'familialCancerHistory', 'cardiovascularFamilyHistory', 'diabetesFamilyHistory', 'neurologicalFamilyHistory', 'geneticDisorders', 'autoimmuneFamilyHistory', 'endocrineFamilyHistory', 'renalFamilyHistory', 'pulmonaryFamilyHistory', 'gastrointestinalFamilyHistory'],
    'additional': ['consanguinity', 'pedigreeAvailable', 'longevityPatterns', 'geneticTestingHistory', 'adoptionHistory', 'ethnicityHealthRisks', 'ageOfOnsetPatterns', 'reproductiveHistory'],
  };

  const sectionHasEdits = useCallback((sectionId, idx) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    const recordStatus = statusOverrides[idx] || 'active';
    if (recordStatus === 'approved') return false;
    return fields.some(f => {
      return Object.keys(editedSentences).some(key => {
        // Match both semicolon keys (field-idx-sN) and array keys (field.N-idx-s0)
        const matchesSemicolon = key.startsWith(`${f}-${idx}-s`);
        const matchesArray = key.startsWith(`${f}.`) && key.includes(`-${idx}-s`);
        if (!matchesSemicolon && !matchesArray) return false;
        return editedSentences[key] === 'edited' || editedSentences[key] === 'added';
      });
    });
  }, [editedSentences, statusOverrides]);

  // Save a semicolon item — reconstructs full text (for string fields)
  const saveSemicolonItem = useCallback((record, fieldName, idx, sectionId, sIdx) => {
    const itemValue = editValue.trim();
    const fullEditKey = `${fieldName}-${idx}`;
    const currentFull = localEdits[fullEditKey] !== undefined ? localEdits[fullEditKey] : (record[fieldName] || '');
    const items = splitBySemicolon(String(currentFull));
    if (sIdx < items.length) {
      items[sIdx] = itemValue;
    }
    // Rejoin as period-separated sentences (each item ends with a period, joined by a space)
    // so the field stays sentence-split on re-render rather than collapsing periods into ';'.
    const fullText = items
      .map((it) => String(it).replace(/[.;]+$/, '').trim())
      .filter(Boolean)
      .map((it) => `${it}.`)
      .join(' ');
    handleSaveField(record, fieldName, idx, sectionId, sIdx, fullText);
  }, [editValue, localEdits, handleSaveField]);

  // Save an array semicolon item — reconstructs full array element, then stages a DRAFT locally (no DB write).
  const saveArraySemicolonItem = useCallback((record, fieldName, idx, sectionId, arrIdx, sIdx) => {
    const recordId = record._id ? (record._id.$oid || record._id) : null;
    if (!recordId) return;
    const itemValue = editValue.trim();
    const currentFull = getArrayFieldValue(record, fieldName, arrIdx, idx) || '';
    const currentItems = splitBySemicolon(String(currentFull));
    if (sIdx < currentItems.length) {
      currentItems[sIdx] = itemValue;
    }
    const fullText = currentItems.join('; ');
    const fieldPart = `${fieldName}.${arrIdx}`;
    const editKey = `${fieldPart}-${idx}`;
    const sKey = `${fieldName}.${arrIdx}-${idx}-s${sIdx}`;

    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));
    setApprovedSections(prev => {
      const next = { ...prev };
      delete next[sectionId];
      delete next[`record-${idx}`];
      return next;
    });

    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldPart] = fullText;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue, getArrayFieldValue]);

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
        <div
          className={`numbered-row single-value-row${isFieldEdited ? ' modified' : ''}${canEdit ? ' editable-row' : ''}`}
          onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue)}
        >
          <div
            className={`row-content${canEdit ? ' editable' : ''}`}
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
        {isFieldEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // ============== RENDER SEMICOLON EDITABLE FIELD ==============
  const renderSemicolonEditableField = (record, fieldName, label, idx, sectionId) => {
    const fullEditKey = `${fieldName}-${idx}`;
    const hasFullEdit = localEdits[fullEditKey] !== undefined;
    const sourceText = hasFullEdit ? localEdits[fullEditKey] : (record[fieldName] || '');
    if (!sourceText?.trim()) return null;

    const items = splitBySemicolon(sourceText);
    if (items.length <= 1) return renderEditableField(record, fieldName, label, idx, sectionId, `${fieldName}-${idx}`);

    const canEdit = !!record._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];

    return (
      <div className="rec-mini-card" key={fieldName}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        {items.map((item, sIdx) => {
          const editKey = `${fieldName}-${idx}-s${sIdx}`;
          const isEditing = editingField === editKey;
          const isItemEdited = sectionWasEdited && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';
          const isItemAdded = sectionWasEdited && editedSentences[editKey] === 'added' && statusOverrides[idx] !== 'approved';

          if (isEditing) {
            return (
              <div key={sIdx} className="numbered-row edit-row">
                <div className="edit-field-container">
                  <textarea
                    ref={textareaRef}
                    className="edit-textarea"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') handleCancelEdit();
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveSemicolonItem(record, fieldName, idx, sectionId, sIdx);
                    }}
                    rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))}
                    disabled={saving}
                  />
                  <div className="edit-actions">
                    <button className="edit-save-btn" onClick={() => saveSemicolonItem(record, fieldName, idx, sectionId, sIdx)} disabled={saving}>
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
              <div
                className={`numbered-row${isItemEdited ? ' modified' : ''}${isItemAdded ? ' modified' : ''}${canEdit ? ' editable-row' : ''}`}
                onClick={() => canEdit && handleStartEdit(fieldName, idx, item, sIdx)}
              >
                <div
                  className={`row-content${canEdit ? ' editable' : ''}`}
                  title={canEdit ? 'Click to edit' : undefined}
                >
                  <span className="content-value">{highlightText(item)}</span>
                  {canEdit && !isItemEdited && !isItemAdded && editIndicator}
                </div>
                <button
                  className={`copy-btn ${copiedId === `${fieldName}-${idx}-${sIdx}` ? 'copied' : ''}`}
                  onClick={() => copyToClipboard(item, `${fieldName}-${idx}-${sIdx}`)}
                >
                  {copiedId === `${fieldName}-${idx}-${sIdx}` ? 'Copied!' : 'Copy'}
                </button>
              </div>
              {isItemEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
              {isItemAdded && <div className="modified-badge">added - click Pending Approve to save</div>}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // ============== RENDER ARRAY SEMICOLON EDITABLE FIELD ==============
  // For array fields where each array element contains semicolons (e.g., siblingHistory)
  const renderArraySemicolonEditableField = (record, fieldName, label, idx, sectionId) => {
    const arr = record[fieldName];
    if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
    const canEdit = !!record._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];

    return (
      <div className="rec-mini-card" key={fieldName}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        {arr.map((arrayItem, arrIdx) => {
          const displayValue = getArrayFieldValue(record, fieldName, arrIdx, idx) || arrayItem;
          if (!displayValue) return null;
          const items = splitBySemicolon(displayValue);

          if (items.length <= 1) {
            // Single item — render as normal editable row
            const editKey = `${fieldName}.${arrIdx}-${idx}-s0`;
            const isEditing = editingField === editKey;
            const isItemEdited = sectionWasEdited && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';

            if (isEditing) {
              return (
                <div key={arrIdx} className="numbered-row edit-row">
                  <div className="edit-field-container">
                    <textarea
                      ref={textareaRef}
                      className="edit-textarea"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') handleCancelEdit();
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveField(record, fieldName, idx, sectionId, arrIdx);
                      }}
                      rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))}
                      disabled={saving}
                    />
                    <div className="edit-actions">
                      <button className="edit-save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId, arrIdx)} disabled={saving}>
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <React.Fragment key={arrIdx}>
                <div
                  className={`numbered-row${isItemEdited ? ' modified' : ''}${canEdit ? ' editable-row' : ''}`}
                  onClick={() => canEdit && handleStartEdit(`${fieldName}.${arrIdx}`, idx, displayValue)}
                >
                  <div
                    className={`row-content${canEdit ? ' editable' : ''}`}
                    title={canEdit ? 'Click to edit' : undefined}
                  >
                    <span className="content-value">{highlightText(displayValue)}</span>
                    {canEdit && !isItemEdited && editIndicator}
                  </div>
                  <button
                    className={`copy-btn ${copiedId === `${fieldName}-${idx}-${arrIdx}` ? 'copied' : ''}`}
                    onClick={() => copyToClipboard(displayValue, `${fieldName}-${idx}-${arrIdx}`)}
                  >
                    {copiedId === `${fieldName}-${idx}-${arrIdx}` ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                {isItemEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
              </React.Fragment>
            );
          }

          // Multiple semicolon items — render each as its own row
          return items.map((subItem, sIdx) => {
            const editKey = `${fieldName}.${arrIdx}-${idx}-s${sIdx}`;
            const isEditing = editingField === editKey;
            const isItemEdited = sectionWasEdited && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';

            if (isEditing) {
              return (
                <div key={`${arrIdx}-${sIdx}`} className="numbered-row edit-row">
                  <div className="edit-field-container">
                    <textarea
                      ref={textareaRef}
                      className="edit-textarea"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') handleCancelEdit();
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveArraySemicolonItem(record, fieldName, idx, sectionId, arrIdx, sIdx);
                      }}
                      rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))}
                      disabled={saving}
                    />
                    <div className="edit-actions">
                      <button className="edit-save-btn" onClick={() => saveArraySemicolonItem(record, fieldName, idx, sectionId, arrIdx, sIdx)} disabled={saving}>
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <React.Fragment key={`${arrIdx}-${sIdx}`}>
                <div
                  className={`numbered-row${isItemEdited ? ' modified' : ''}${canEdit ? ' editable-row' : ''}`}
                  onClick={() => canEdit && handleStartEdit(`${fieldName}.${arrIdx}`, idx, subItem, sIdx)}
                >
                  <div
                    className={`row-content${canEdit ? ' editable' : ''}`}
                    title={canEdit ? 'Click to edit' : undefined}
                  >
                    <span className="content-value">{highlightText(subItem)}</span>
                    {canEdit && !isItemEdited && editIndicator}
                  </div>
                  <button
                    className={`copy-btn ${copiedId === `${fieldName}-${idx}-${arrIdx}-${sIdx}` ? 'copied' : ''}`}
                    onClick={() => copyToClipboard(subItem, `${fieldName}-${idx}-${arrIdx}-${sIdx}`)}
                  >
                    {copiedId === `${fieldName}-${idx}-${arrIdx}-${sIdx}` ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                {isItemEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
              </React.Fragment>
            );
          });
        })}
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
        <div
          className={`numbered-row${isItemEdited ? ' modified' : ''}${canEdit ? ' editable-row' : ''}`}
          onClick={() => canEdit && handleStartEdit(`${fieldName}.${itemIdx}`, idx, displayValue)}
        >
          <div
            className={`row-content${canEdit ? ' editable' : ''}`}
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
        {isItemEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </React.Fragment>
    );
  };

  // ============== RENDER EDITABLE BOOLEAN FIELD (Yes/No select) ==============
  const renderEditableBoolean = (record, fieldName, label, idx, sectionId) => {
    const editKeyField = `${fieldName}-${idx}`;
    const rawValue = localEdits[editKeyField] !== undefined ? localEdits[editKeyField] : record[fieldName];
    const boolValue = rawValue === true || rawValue === 'true' || rawValue === 'Yes' || rawValue === 'yes';
    const displayValue = boolValue ? 'Yes' : 'No';
    const canEdit = !!record._id;
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const isFieldEdited = sectionWasEdited && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';
    const copyId = `${fieldName}-${idx}`;

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={fieldName}>
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <BlueSelect
                value={editValue}
                options={['Yes', 'No']}
                onChange={(v) => setEditValue(v)}
              />
              <div className="edit-actions">
                <button className="edit-save-btn" onClick={() => handleSaveBoolean(record, fieldName, idx, sectionId, editValue === 'Yes')} disabled={saving}>
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
        <div
          className={`numbered-row single-value-row${isFieldEdited ? ' modified' : ''}${canEdit ? ' editable-row' : ''}`}
          onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue)}
        >
          <div
            className={`row-content${canEdit ? ' editable' : ''}`}
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
        {isFieldEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // ============== SECTION HEADER WITH APPROVE ==============
  const renderSectionHeader = (title, copyId, copyFn, idx, sectionId) => (
    <div className="section-header">
      <h3 className="section-title">{highlightText(title)}</h3>
      <div className="header-right-actions">
        <button
          className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
          onClick={copyFn}
        >
          {copiedId === copyId ? 'Copied!' : 'Copy Section'}
        </button>
        {(sectionHasEdits(sectionId, idx) || approvedSections[sectionId]) && (
          <button
            className={`approve-btn${approvedSections[sectionId] ? ' approved' : ' pending'}`}
            onClick={() => handleApprove(unwrappedData[idx], idx, sectionId)}
            disabled={approving}
          >
            {approving ? 'Approving...' : approvedSections[sectionId] ? 'Approved' : 'Pending Approve'}
          </button>
        )}
      </div>
    </div>
  );

  // Condition fields configuration
  const conditionFieldsConfig = [
    { key: 'psychiatricFamilyHistory', label: 'Psychiatric' },
    { key: 'familialCancerHistory', label: 'Cancer' },
    { key: 'cardiovascularFamilyHistory', label: 'Cardiovascular' },
    { key: 'diabetesFamilyHistory', label: 'Diabetes' },
    { key: 'neurologicalFamilyHistory', label: 'Neurological' },
    { key: 'geneticDisorders', label: 'Genetic Disorders' },
    { key: 'autoimmuneFamilyHistory', label: 'Autoimmune' },
    { key: 'endocrineFamilyHistory', label: 'Endocrine' },
    { key: 'renalFamilyHistory', label: 'Renal' },
    { key: 'pulmonaryFamilyHistory', label: 'Pulmonary' },
    { key: 'gastrointestinalFamilyHistory', label: 'Gastrointestinal' },
  ];

  // ============== CANONICAL COPY (text mirror of the PDF box-free underlines) ==============
  // EQ (====) under the record title + every section title; DASH (----) under EVERY field label.
  // Values are STACKED under the label (never "Label: value" side-by-side); arrays/sentences numbered.
  const SECTION_COPY_TITLE = {
    immediate: 'Immediate Family',
    conditions: 'Medical Conditions by Category',
    additional: 'Additional Information',
  };

  const sectionCopyLines = (r, sectionId) => {
    const out = [];
    const pushSemi = (label, val) => {
      if (!val) return;
      out.push(label, COPY_DASH);
      splitBySemicolon(String(val)).forEach((s, i) => out.push(`${i + 1}. ${s}`));
      out.push('');
    };
    const pushArr = (label, arr) => {
      const items = (arr || []).filter(Boolean);
      if (items.length === 0) return;
      out.push(label, COPY_DASH);
      items.forEach((item, i) => out.push(`${i + 1}. ${item}`));
      out.push('');
    };
    const pushBool = (label, v) => {
      if (v === undefined) return;
      out.push(label, COPY_DASH, v ? 'Yes' : 'No', '');
    };
    if (sectionId === 'immediate') {
      pushSemi('Maternal History', r.maternalHistory);
      pushSemi('Paternal History', r.paternalHistory);
      pushArr('Sibling History', r.siblingHistory);
      pushSemi('Grandparental History', r.grandparentalHistory);
    } else if (sectionId === 'conditions') {
      conditionFieldsConfig.forEach(({ key, label }) => pushArr(label, r[key]));
    } else if (sectionId === 'additional') {
      pushBool('Consanguinity', r.consanguinity);
      pushBool('Pedigree Available', r.pedigreeAvailable);
      pushSemi('Longevity Patterns', r.longevityPatterns);
      pushArr('Genetic Testing History', r.geneticTestingHistory);
      pushSemi('Adoption History', r.adoptionHistory);
      pushSemi('Ethnicity Health Risks', r.ethnicityHealthRisks);
      pushSemi('Age of Onset Patterns', r.ageOfOnsetPatterns);
      pushSemi('Reproductive History', r.reproductiveHistory);
    }
    while (out.length && out[out.length - 1] === '') out.pop();
    return out;
  };

  // Single-section copy (Copy Section button) — empty section drops to ''.
  const buildSectionCopy = (r, sectionId) => {
    const body = sectionCopyLines(r, sectionId);
    if (body.length === 0) return '';
    return [SECTION_COPY_TITLE[sectionId], COPY_EQ, ...body].join('\n');
  };

  // Get all record text for Copy All — record title + each populated section (empty-drop).
  const getAllRecordText = (record, idx) => {
    const lines = [`Family History ${idx + 1}`, COPY_EQ];
    ['immediate', 'conditions', 'additional'].forEach((sid) => {
      const body = sectionCopyLines(record, sid);
      if (body.length === 0) return;
      lines.push('', SECTION_COPY_TITLE[sid], COPY_EQ, ...body);
    });
    return lines.join('\n');
  };

  // 4-Level Search: shouldShowRow helper
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

  // Filter records based on search
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return unwrappedData;

    const phrase = searchTerm.toLowerCase().trim();

    return unwrappedData.map(record => {
      // Build searchable text for Level 1
      const searchableText = [
        // Record title
        'Family History', 'family history', 'FAMILY HISTORY',
        // Section titles
        'Record Info', 'record info', 'RECORD INFO',
        'Immediate Family', 'immediate family', 'IMMEDIATE FAMILY',
        'Medical Conditions by Category', 'medical conditions by category',
        'Additional Information', 'additional information',
        // Field labels
        'Maternal History', 'maternal history', 'Paternal History', 'paternal history',
        'Sibling History', 'sibling history', 'Grandparental History', 'grandparental history',
        'Psychiatric', 'psychiatric', 'Cancer', 'cancer', 'Cardiovascular', 'cardiovascular',
        'Diabetes', 'diabetes', 'Neurological', 'neurological', 'Genetic Disorders', 'genetic disorders',
        'Autoimmune', 'autoimmune', 'Endocrine', 'endocrine', 'Renal', 'renal',
        'Pulmonary', 'pulmonary', 'Gastrointestinal', 'gastrointestinal',
        'Consanguinity', 'consanguinity', 'Pedigree Available', 'pedigree available',
        'Longevity Patterns', 'longevity patterns', 'Genetic Testing History', 'genetic testing history',
        'Adoption History', 'adoption history', 'Ethnicity Health Risks', 'ethnicity health risks',
        'Age of Onset Patterns', 'age of onset patterns', 'Reproductive History', 'reproductive history',
        // Values
        record.maternalHistory,
        record.paternalHistory,
        record.grandparentalHistory,
        record.longevityPatterns,
        record.adoptionHistory,
        record.ethnicityHealthRisks,
        record.ageOfOnsetPatterns,
        record.reproductiveHistory,
        ...(record.siblingHistory || []),
        ...conditionFieldsConfig.flatMap(f => record[f.key] || []),
        ...(record.geneticTestingHistory || []),
      ].filter(Boolean).join(' ').toLowerCase();

      const recordMatches = searchableText.includes(phrase);

      // Check if searching for document title
      const isDocTitleSearch = /^family\s+history(\s+\d+)?$/i.test(phrase);

      return {
        ...record,
        _matches: recordMatches,
        _showAllSections: isDocTitleSearch,
      };
    }).filter(r => r._matches);
  }, [unwrappedData, searchTerm]);

  // Render a record
  const renderRecord = (record, idx) => {
    const isSearching = searchTerm.trim();

    // Level 3: sectionTitleMatches for each section
    const recordInfoTitleMatches = isSearching && shouldShowRow(record,
      'Record Info', 'record info', 'RECORD INFO'
    );
    const immediateFamilyTitleMatches = isSearching && shouldShowRow(record,
      'Immediate Family', 'immediate family', 'IMMEDIATE FAMILY'
    );
    const medicalConditionsTitleMatches = isSearching && shouldShowRow(record,
      'Medical Conditions by Category', 'medical conditions by category', 'MEDICAL CONDITIONS BY CATEGORY'
    );
    const additionalInfoTitleMatches = isSearching && shouldShowRow(record,
      'Additional Information', 'additional information', 'ADDITIONAL INFORMATION'
    );

    // showAll flags per section
    const recordInfoShowAll = record._showAllSections || recordInfoTitleMatches;
    const immediateFamilyShowAll = record._showAllSections || immediateFamilyTitleMatches;
    const medicalConditionsShowAll = record._showAllSections || medicalConditionsTitleMatches;
    const additionalInfoShowAll = record._showAllSections || additionalInfoTitleMatches;

    // Section visibility checks
    const recordInfoMatches = (() => {
      if (!isSearching || record._showAllSections) return true;
      if (recordInfoTitleMatches) return true;
      return shouldShowRow(record, 'Date', 'date', formatDate(record.createdAt));
    })();

    const immediateFamilyMatches = (() => {
      if (!isSearching || record._showAllSections) return true;
      if (immediateFamilyTitleMatches) return true;
      return shouldShowRow(record,
        'Maternal History', 'maternal history', record.maternalHistory,
        'Paternal History', 'paternal history', record.paternalHistory,
        'Sibling History', 'sibling history', ...(record.siblingHistory || []),
        'Grandparental History', 'grandparental history', record.grandparentalHistory
      );
    })();

    const medicalConditionsMatches = (() => {
      if (!isSearching || record._showAllSections) return true;
      if (medicalConditionsTitleMatches) return true;
      for (const { key, label } of conditionFieldsConfig) {
        if (record[key]?.length > 0) {
          if (shouldShowRow(record, label, label.toLowerCase(), ...record[key])) {
            return true;
          }
        }
      }
      return false;
    })();

    const additionalInfoMatches = (() => {
      if (!isSearching || record._showAllSections) return true;
      if (additionalInfoTitleMatches) return true;
      return shouldShowRow(record,
        'Consanguinity', 'consanguinity',
        'Pedigree Available', 'pedigree available',
        'Longevity Patterns', 'longevity patterns', record.longevityPatterns,
        'Genetic Testing History', 'genetic testing history', ...(record.geneticTestingHistory || []),
        'Adoption History', 'adoption history', record.adoptionHistory,
        'Ethnicity Health Risks', 'ethnicity health risks', record.ethnicityHealthRisks,
        'Age of Onset Patterns', 'age of onset patterns', record.ageOfOnsetPatterns,
        'Reproductive History', 'reproductive history', record.reproductiveHistory
      );
    })();

    // Data checks
    const hasImmediateFamily = record.maternalHistory || record.paternalHistory ||
      (record.siblingHistory?.length > 0) || record.grandparentalHistory;
    const activeConditions = conditionFieldsConfig.filter(f => record[f.key]?.length > 0);
    const hasAdditional = record.consanguinity !== undefined || record.pedigreeAvailable !== undefined ||
      record.longevityPatterns || record.geneticTestingHistory?.length > 0 ||
      record.adoptionHistory || record.ethnicityHealthRisks ||
      record.ageOfOnsetPatterns || record.reproductiveHistory;

    return (
      <div key={record._id || idx} className="record-card">
        {/* Record Header */}
        <div className="record-header">
          <h2 className="record-title">{highlightText(`Family History ${idx + 1}`)}</h2>
        </div>

        {/* Section: Immediate Family */}
        {hasImmediateFamily && immediateFamilyMatches && (
          <div className="section">
            <div className="mini-cards-container">
              {renderSectionHeader('Immediate Family', `immediate-${idx}`, () => {
                copySectionToClipboard(buildSectionCopy(pdfData[idx] || record, 'immediate'), `immediate-${idx}`);
              }, idx, 'immediate')}

              {/* Maternal History — semicolon editable */}
              {(!isSearching || immediateFamilyShowAll || shouldShowRow(record, 'Maternal History', 'maternal history', record.maternalHistory)) &&
                renderSemicolonEditableField(record, 'maternalHistory', 'Maternal History', idx, 'immediate')
              }

              {/* Paternal History — semicolon editable */}
              {(!isSearching || immediateFamilyShowAll || shouldShowRow(record, 'Paternal History', 'paternal history', record.paternalHistory)) &&
                renderSemicolonEditableField(record, 'paternalHistory', 'Paternal History', idx, 'immediate')
              }

              {/* Sibling History — array with semicolon splitting */}
              {record.siblingHistory?.length > 0 && (!isSearching || immediateFamilyShowAll || shouldShowRow(record, 'Sibling History', 'sibling history', ...record.siblingHistory)) &&
                renderArraySemicolonEditableField(record, 'siblingHistory', 'Sibling History', idx, 'immediate')
              }

              {/* Grandparental History — semicolon editable */}
              {(!isSearching || immediateFamilyShowAll || shouldShowRow(record, 'Grandparental History', 'grandparental history', record.grandparentalHistory)) &&
                renderSemicolonEditableField(record, 'grandparentalHistory', 'Grandparental History', idx, 'immediate')
              }
            </div>
          </div>
        )}

        {/* Section 3: Medical Conditions by Category */}
        {activeConditions.length > 0 && medicalConditionsMatches && (
          <div className="section">
            <div className="mini-cards-container">
              {renderSectionHeader('Medical Conditions by Category', `conditions-${idx}`, () => {
                copySectionToClipboard(buildSectionCopy(pdfData[idx] || record, 'conditions'), `conditions-${idx}`);
              }, idx, 'conditions')}

              {activeConditions.map(({ key, label }) => {
                const items = record[key];
                const showCondition = !isSearching || medicalConditionsShowAll ||
                  shouldShowRow(record, label, label.toLowerCase(), ...items);

                if (!showCondition) return null;

                return (
                  <div key={key} className="rec-mini-card">
                    <div className="nested-subtitle">{highlightText(label)}</div>
                    {items.map((item, itemIdx) =>
                      renderEditableArrayItem(record, key, item, idx, itemIdx, 'conditions', `${key}-${idx}-${itemIdx}`)
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 4: Additional Information */}
        {hasAdditional && additionalInfoMatches && (
          <div className="section">
            <div className="mini-cards-container">
              {renderSectionHeader('Additional Information', `additional-${idx}`, () => {
                copySectionToClipboard(buildSectionCopy(pdfData[idx] || record, 'additional'), `additional-${idx}`);
              }, idx, 'additional')}

              {/* Consanguinity — editable boolean (Yes/No select) */}
              {record.consanguinity !== undefined && (!isSearching || additionalInfoShowAll || shouldShowRow(record, 'Consanguinity', 'consanguinity')) &&
                renderEditableBoolean(record, 'consanguinity', 'Consanguinity', idx, 'additional')
              }

              {/* Pedigree Available — editable boolean (Yes/No select) */}
              {record.pedigreeAvailable !== undefined && (!isSearching || additionalInfoShowAll || shouldShowRow(record, 'Pedigree Available', 'pedigree available')) &&
                renderEditableBoolean(record, 'pedigreeAvailable', 'Pedigree Available', idx, 'additional')
              }

              {/* Longevity Patterns — semicolon editable */}
              {(!isSearching || additionalInfoShowAll || shouldShowRow(record, 'Longevity Patterns', 'longevity patterns', record.longevityPatterns)) &&
                renderSemicolonEditableField(record, 'longevityPatterns', 'Longevity Patterns', idx, 'additional')
              }

              {/* Genetic Testing History — array with semicolon splitting */}
              {record.geneticTestingHistory?.length > 0 && (!isSearching || additionalInfoShowAll || shouldShowRow(record, 'Genetic Testing History', 'genetic testing history', ...record.geneticTestingHistory)) &&
                renderArraySemicolonEditableField(record, 'geneticTestingHistory', 'Genetic Testing History', idx, 'additional')
              }

              {/* Adoption History — semicolon editable */}
              {(!isSearching || additionalInfoShowAll || shouldShowRow(record, 'Adoption History', 'adoption history', record.adoptionHistory)) &&
                renderSemicolonEditableField(record, 'adoptionHistory', 'Adoption History', idx, 'additional')
              }

              {/* Ethnicity Health Risks — semicolon editable */}
              {(!isSearching || additionalInfoShowAll || shouldShowRow(record, 'Ethnicity Health Risks', 'ethnicity health risks', record.ethnicityHealthRisks)) &&
                renderSemicolonEditableField(record, 'ethnicityHealthRisks', 'Ethnicity Health Risks', idx, 'additional')
              }

              {/* Age of Onset Patterns — semicolon editable */}
              {(!isSearching || additionalInfoShowAll || shouldShowRow(record, 'Age of Onset Patterns', 'age of onset patterns', record.ageOfOnsetPatterns)) &&
                renderSemicolonEditableField(record, 'ageOfOnsetPatterns', 'Age of Onset Patterns', idx, 'additional')
              }

              {/* Reproductive History — semicolon editable */}
              {(!isSearching || additionalInfoShowAll || shouldShowRow(record, 'Reproductive History', 'reproductive history', record.reproductiveHistory)) &&
                renderSemicolonEditableField(record, 'reproductiveHistory', 'Reproductive History', idx, 'additional')
              }
            </div>
          </div>
        )}
      </div>
    );
  };

  // Empty state
  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <div className="family-history-document">
        <div className="empty-state">No family history records available.</div>
      </div>
    );
  }

  return (
    <div className="family-history-document">
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">Family History</h1>
        <div className="header-actions">
          <button
            className={`copy-btn ${copiedId === 'all-documents' ? 'copied' : ''}`}
            onClick={() => {
              const allText = pdfData.map((record, idx) => getAllRecordText(record, idx)).join('\n\n');
              copyToClipboard(allText, 'all-documents');
            }}
          >
            {copiedId === 'all-documents' ? 'Copied' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<FamilyHistoryDocumentPDFTemplate document={pdfData} />}
            fileName="Family_History.pdf"
            className="pdf-btn"
          >
            {({ loading }) => (loading ? 'Preparing...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search family history..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="search-clear" onClick={() => setSearchTerm('')}>×</button>
          )}
        </div>
      </div>

      {/* Records */}
      <div className="records-container">
        {filteredRecords.length > 0 ? (
          filteredRecords.map((record, idx) => renderRecord(record, idx))
        ) : (
          <div className="no-results">No records match your search.</div>
        )}
      </div>
    </div>
  );
};

export default FamilyHistoryDocument;
