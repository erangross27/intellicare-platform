import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import './RespiratoryMedicationsDocument.css';
import secureApiClient from '../../../services/secureApiClient';
import SearchBar from '../components/SearchBar';
import { PDFDownloadLink } from '@react-pdf/renderer';
import RespiratoryMedicationsDocumentPDFTemplate from '../pdf-templates/RespiratoryMedicationsDocumentPDFTemplate';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'respiratory_medicationsPendingEdits';
// Maps a draft's base field (segment before first dot) → the sectionId used for the Approve button.
// Used on rehydrate to re-show the owning section's Approve button after a refresh.
const FIELD_SECTION_MAP = {
  genericName: 'medinfo', dosage: 'medinfo', frequency: 'medinfo', route: 'medinfo',
  controllers: 'controller',
  relievers: 'reliever',
  biologics: 'biologics',
  oralCorticosteroids: 'ocs',
  duration: 'addinfo', durationDays: 'addinfo', durationUnit: 'addinfo',
  prescriber: 'addinfo', indication: 'addinfo', instructions: 'addinfo', refills: 'addinfo',
};
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const RespiratoryMedicationsDocument = ({ document: docProp, data, templateData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSectionId, setCopiedSectionId] = useState(null);

  // Debug: Log what we receive
  console.log('[RespiratoryMedicationsDocument] Received document:', docProp);

  // 3-prop pattern data unwrapping
  const records = useMemo(() => {
    const raw = templateData || docProp || data;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (raw?.respiratory_medications) return raw.respiratory_medications;
    if (raw?.documentData) {
      const docData = raw.documentData;
      if (Array.isArray(docData)) return docData;
      if (docData?.respiratory_medications) return docData.respiratory_medications;
      return [docData];
    }
    if (typeof raw === 'object') return [raw];
    return [];
  }, [templateData, docProp, data]);

  console.log('[RespiratoryMedicationsDocument] Final records:', records);

  // Editing state
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [statusOverrides, setStatusOverrides] = useState({});
  const [numberError, setNumberError] = useState(null);
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const textareaRef = useRef(null);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nStatus = {};
    records.forEach((rec, idx) => {
      const recId = rec && rec._id ? (typeof rec._id === 'object' && rec._id.$oid ? rec._id.$oid : rec._id) : null;
      const recDrafts = recId ? store[recId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
        nStatus[idx] = 'amended';
        // Re-flag the owning section so its Approve button reappears (base = segment before first dot)
        const baseField = fieldPart.indexOf('.') === -1 ? fieldPart : fieldPart.slice(0, fieldPart.indexOf('.'));
        const sectionId = FIELD_SECTION_MAP[baseField];
        if (sectionId) nFields[`${sectionId}-${idx}`] = true;
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
    setStatusOverrides(prev => ({ ...nStatus, ...prev }));
  }, [records]);

  // Editing handlers
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
    const recId = record && record._id ? (typeof record._id === 'object' && record._id.$oid ? record._id.$oid : record._id) : null;
    if (!recId) return;
    const saveValue = (valueOverride !== undefined ? valueOverride : editValue.trim());
    // fieldPart EXACTLY mirrors the editKey field segment: append .arrayIndex ONLY when arrayIndex is a number
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
    const recId = record && record._id ? (typeof record._id === 'object' && record._id.$oid ? record._id.$oid : record._id) : null;
    if (!recId) return;
    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now (field, or field+arrayIndex for array-element edits)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        // arrayIndex ONLY when the segment after the LAST dot is purely numeric (reverses handleSaveField)
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayIdx = lastDot !== -1 && /^\d+$/.test(trailing);
        const payload = { field: isArrayIdx ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArrayIdx) payload.arrayIndex = parseInt(trailing, 10);
        const resp = await secureApiClient.put(`/api/edit/respiratory_medications/${recId}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/respiratory_medications/${recId}/approve`);

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
      console.error('Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // Field value helpers
  const getFieldValue = (record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    const val = record[fieldName];
    if (Array.isArray(val)) return val.join(', ');
    return val;
  };

  const getNestedFieldValue = (record, parentField, childField, idx) => {
    const dotPath = `${parentField}.${childField}`;
    const editKey = `${dotPath}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    return record[parentField]?.[childField];
  };

  const getArrayFieldValue = (record, parentField, arrayIdx, childField, idx) => {
    const dotPath = `${parentField}.${arrayIdx}.${childField}`;
    const editKey = `${dotPath}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    return record[parentField]?.[arrayIdx]?.[childField];
  };

  // pdfData memo - merges localEdits into records for PDF/Copy All
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((rec, idx) => {
      const merged = { ...rec };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldPath = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx === idx) {
          const parts = fieldPath.split('.');
          if (parts.length === 3) {
            // e.g., controllers.0.dose
            const [arrField, arrIdxStr, prop] = parts;
            const ai = parseInt(arrIdxStr, 10);
            if (Array.isArray(merged[arrField]) && merged[arrField][ai]) {
              merged[arrField] = [...merged[arrField]];
              merged[arrField][ai] = { ...merged[arrField][ai], [prop]: editVal };
            }
          } else if (parts.length === 2) {
            // e.g., biologics.medication or nebulizers.0
            const [parent, child] = parts;
            if (merged[parent] && typeof merged[parent] === 'object' && !Array.isArray(merged[parent])) {
              merged[parent] = { ...merged[parent], [child]: editVal };
            } else if (Array.isArray(merged[parent])) {
              const ai = parseInt(child, 10);
              merged[parent] = [...merged[parent]];
              merged[parent][ai] = editVal;
            }
          } else {
            merged[fieldPath] = editVal;
          }
        }
      }
      return merged;
    });
  }, [records, localEdits, pendingEdits]);

  // Edit indicator SVG
  const editIndicator = (
    <span className="edit-indicator" title="Click to edit">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  );

  // Render editable field helper (simple string fields)
  const renderEditableField = (record, idx, fieldName, label, sectionId, displayValue) => {
    const canEdit = !!record._id;
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const value = displayValue !== undefined ? displayValue : (getFieldValue(record, fieldName, idx) || '');
    const wasEdited = editedSentences[editKey] === 'edited';

    if (!value && !isEditing) return null;

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {isEditing ? (
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <textarea
                ref={textareaRef}
                className="edit-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={2}
              />
              <div className="edit-actions">
                <button className="save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId)} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className={`numbered-row${wasEdited ? ' modified' : ''}`}>
              <div className={`row-content${canEdit ? ' editable' : ''}`}
                onClick={() => canEdit && handleStartEdit(fieldName, idx, value)}>
                <span className="content-value">{highlightText(String(value))}</span>
                {canEdit && editIndicator}
              </div>
              <button
                className={`copy-btn ${copiedSectionId === `${sectionId}-${fieldName}-${idx}` ? 'copied' : ''}`}
                onClick={() => copySection(`${label}: ${value}`, `${sectionId}-${fieldName}-${idx}`)}
              >
                {copiedSectionId === `${sectionId}-${fieldName}-${idx}` ? 'Copied' : 'Copy'}
              </button>
            </div>
            {wasEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
          </>
        )}
      </div>
    );
  };

  // Render editable NUMBER field helper (durationDays, refills) — typed number input
  const renderNumberField = (record, idx, fieldName, label, sectionId) => {
    const canEdit = !!record._id;
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const rawVal = getFieldValue(record, fieldName, idx);
    const wasEdited = editedSentences[editKey] === 'edited';

    // hide-zero: treat 0 / empty / non-number as nothing to show
    const numVal = parseFloat(rawVal);
    const hasVal = rawVal !== undefined && rawVal !== null && rawVal !== '' && !isNaN(numVal) && numVal !== 0;
    if (!hasVal && !isEditing) return null;

    const displayValue = hasVal ? String(numVal) : '';

    const saveNumber = () => {
      const parsed = parseFloat(editValue);
      if (isNaN(parsed)) { setNumberError('Please enter a valid number'); return; }
      setNumberError(null);
      handleSaveField(record, fieldName, idx, sectionId, undefined, parsed);
    };

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {isEditing ? (
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <input
                type="number"
                step="any"
                className="edit-textarea"
                style={{ minHeight: 'auto', padding: '10px' }}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { handleCancelEdit(); setNumberError(null); }
                  if (e.key === 'Enter') { e.stopPropagation(); saveNumber(); }
                }}
              />
              {numberError && <div className="save-error" style={{ color: '#b91c1c', fontSize: '12px', marginTop: '4px' }}>{numberError}</div>}
              <div className="edit-actions">
                <button className="save-btn" onClick={saveNumber} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="cancel-btn" onClick={() => { handleCancelEdit(); setNumberError(null); }}>Cancel</button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className={`numbered-row${wasEdited ? ' modified' : ''}`}>
              <div className={`row-content${canEdit ? ' editable' : ''}`}
                onClick={() => { if (canEdit) { handleStartEdit(fieldName, idx, displayValue); setNumberError(null); } }}>
                <span className="content-value">{highlightText(displayValue)}</span>
                {canEdit && editIndicator}
              </div>
              <button
                className={`copy-btn ${copiedSectionId === `${sectionId}-${fieldName}-${idx}` ? 'copied' : ''}`}
                onClick={() => copySection(`${label}: ${displayValue}`, `${sectionId}-${fieldName}-${idx}`)}
              >
                {copiedSectionId === `${sectionId}-${fieldName}-${idx}` ? 'Copied' : 'Copy'}
              </button>
            </div>
            {wasEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
          </>
        )}
      </div>
    );
  };

  // Render editable BOOLEAN field via a Yes/No-style <select> (e.g. oralCorticosteroids.current, active).
  // fieldKey is the flat or dotted path used for the edit key + handleSaveField; rawValue is the
  // (staged-merged) boolean; trueLabel/falseLabel are the displayed options (Yes/No, Active/Discontinued).
  const renderBooleanField = (record, idx, fieldKey, label, sectionId, rawValue, trueLabel, falseLabel) => {
    const canEdit = !!record._id;
    const editKey = `${fieldKey}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const wasEdited = editedSentences[editKey] === 'edited';
    const displayValue = rawValue ? trueLabel : falseLabel;

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {isEditing ? (
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <select
                className="edit-select"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Escape') handleCancelEdit(); }}
              >
                <option value={trueLabel}>{trueLabel}</option>
                <option value={falseLabel}>{falseLabel}</option>
              </select>
              <div className="edit-actions">
                <button className="save-btn" onClick={() => handleSaveField(record, fieldKey, idx, sectionId, undefined, editValue === trueLabel)} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className={`numbered-row${wasEdited ? ' modified' : ''}`}>
              <div className={`row-content${canEdit ? ' editable' : ''}`}
                onClick={() => canEdit && handleStartEdit(fieldKey, idx, displayValue)}>
                <span className="content-value">{highlightText(displayValue)}</span>
                {canEdit && editIndicator}
              </div>
              <button
                className={`copy-btn ${copiedSectionId === `${sectionId}-${fieldKey}-${idx}` ? 'copied' : ''}`}
                onClick={() => copySection(`${label}: ${displayValue}`, `${sectionId}-${fieldKey}-${idx}`)}
              >
                {copiedSectionId === `${sectionId}-${fieldKey}-${idx}` ? 'Copied' : 'Copy'}
              </button>
            </div>
            {wasEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
          </>
        )}
      </div>
    );
  };

  // Render nested editable field helper (e.g., biologics.medication, oralCorticosteroids.dose)
  const renderNestedEditableField = (record, idx, parentField, childField, label, sectionId, displayValue) => {
    const canEdit = !!record._id;
    const dotPath = `${parentField}.${childField}`;
    const editKey = `${dotPath}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const value = displayValue !== undefined ? displayValue : (getNestedFieldValue(record, parentField, childField, idx) || '');
    const wasEdited = editedSentences[editKey] === 'edited';

    if (!value && !isEditing) return null;

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {isEditing ? (
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <textarea
                ref={textareaRef}
                className="edit-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={2}
              />
              <div className="edit-actions">
                <button className="save-btn" onClick={() => handleSaveField(record, dotPath, idx, sectionId)} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className={`numbered-row${wasEdited ? ' modified' : ''}`}>
              <div className={`row-content${canEdit ? ' editable' : ''}`}
                onClick={() => canEdit && handleStartEdit(dotPath, idx, String(value))}>
                <span className="content-value">{highlightText(String(value))}</span>
                {canEdit && editIndicator}
              </div>
              <button
                className={`copy-btn ${copiedSectionId === `${sectionId}-${dotPath}-${idx}` ? 'copied' : ''}`}
                onClick={() => copySection(`${label}: ${value}`, `${sectionId}-${dotPath}-${idx}`)}
              >
                {copiedSectionId === `${sectionId}-${dotPath}-${idx}` ? 'Copied' : 'Copy'}
              </button>
            </div>
            {wasEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
          </>
        )}
      </div>
    );
  };

  // Render array object field helper (e.g., controllers[0].dose, relievers[1].frequency)
  const renderArrayObjectField = (record, idx, parentField, arrayIdx, childField, label, sectionId) => {
    const canEdit = !!record._id;
    const dotPath = `${parentField}.${arrayIdx}.${childField}`;
    const editKey = `${dotPath}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const value = getArrayFieldValue(record, parentField, arrayIdx, childField, idx) || '';
    const wasEdited = editedSentences[editKey] === 'edited';

    if (!value && !isEditing) return null;

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {isEditing ? (
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <textarea
                ref={textareaRef}
                className="edit-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={1}
              />
              <div className="edit-actions">
                <button className="save-btn" onClick={() => handleSaveField(record, dotPath, idx, sectionId)} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className={`numbered-row${wasEdited ? ' modified' : ''}`}>
              <div className={`row-content${canEdit ? ' editable' : ''}`}
                onClick={() => canEdit && handleStartEdit(dotPath, idx, String(value))}>
                <span className="content-value">{highlightText(String(value))}</span>
                {canEdit && editIndicator}
              </div>
              <button
                className={`copy-btn ${copiedSectionId === `${sectionId}-${dotPath}-${idx}` ? 'copied' : ''}`}
                onClick={() => copySection(`${label}: ${value}`, `${sectionId}-${dotPath}-${idx}`)}
              >
                {copiedSectionId === `${sectionId}-${dotPath}-${idx}` ? 'Copied' : 'Copy'}
              </button>
            </div>
            {wasEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
          </>
        )}
      </div>
    );
  };

  // Format date helper
  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Filter medications based on search - THREE-LEVEL FILTERING
  const filteredMeds = useMemo(() => {
    if (!searchTerm.trim()) return records;

    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);

    return records.filter((med, idx) => {
      const recordTitle = `Respiratory Medication ${idx + 1}`;
      const searchableText = [
        // Document-level keywords
        'Respiratory Medications',
        recordTitle,
        'respiratory medication',
        'respiratory meds',
        formatDate(med.startDate),
        med.startDate,
        med.name,
        // Field labels for search - ALL labels from all sections
        'generic name', 'GENERIC NAME',
        'dosage', 'DOSAGE', 'dose', 'DOSE',
        'frequency', 'FREQUENCY',
        'route', 'ROUTE',
        'prescriber', 'PRESCRIBER',
        'indication', 'INDICATION',
        'instructions', 'INSTRUCTIONS',
        'controller medications', 'CONTROLLER',
        'reliever medications', 'RELIEVER',
        'biologic therapy', 'BIOLOGICS',
        'nebulizer medications', 'NEBULIZERS',
        'oral corticosteroids', 'ORAL STEROIDS',
        'device', 'DEVICE',
        'class', 'CLASS',
        'technique', 'TECHNIQUE',
        'adherence', 'ADHERENCE',
        'max daily use', 'MAX DAILY USE',
        'medication', 'MEDICATION',
        'start date', 'START DATE',
        'response', 'RESPONSE',
        'current', 'CURRENT',
        'duration', 'DURATION',
        'taper schedule', 'TAPER SCHEDULE',
        'yearly bursts', 'YEARLY BURSTS',
        'end date', 'END DATE',
        'duration', 'DURATION', 'duration days', 'DURATION DAYS', 'duration unit', 'DURATION UNIT',
        'refills', 'REFILLS',
        'status', 'STATUS', 'active', 'discontinued',
        'side effects', 'SIDE EFFECTS',
        'safety warning', 'SAFETY WARNING',
        // ALL field values
        med.genericName,
        med.dosage,
        med.frequency,
        med.route,
        med.duration,
        (med.durationDays !== undefined && med.durationDays !== null && parseFloat(med.durationDays) !== 0) ? String(parseFloat(med.durationDays)) : '',
        med.durationUnit,
        med.prescriber,
        med.indication,
        med.instructions,
        (med.refills !== undefined && med.refills !== null && parseFloat(med.refills) !== 0) ? String(parseFloat(med.refills)) : '',
        // Controllers
        med.controllers?.map(c => [
          c.medication, c.class, c.dose, c.frequency,
          c.device, c.technique, c.adherence
        ].filter(Boolean).join(' ')).join(' '),
        // Relievers
        med.relievers?.map(r => [
          r.medication, r.dose, r.frequency, r.maxDailyUse
        ].filter(Boolean).join(' ')).join(' '),
        // Biologics
        med.biologics?.medication,
        med.biologics?.dose,
        med.biologics?.frequency,
        med.biologics?.route,
        med.biologics?.response,
        // Nebulizers
        med.nebulizers?.join(' '),
        // Oral Corticosteroids
        med.oralCorticosteroids?.dose,
        med.oralCorticosteroids?.duration,
        med.oralCorticosteroids?.taperSchedule,
        // Side effects (array) + safety warning (string) values
        med.sideEffects?.join(' '),
        med.safetyWarning
      ].filter(Boolean).join(' ').toLowerCase();

      const matches = searchWords.every(word => searchableText.includes(word));
      if (matches) {
        const titleLower = recordTitle.toLowerCase();
        const searchLower = searchTerm.toLowerCase().trim();
        if (titleLower.startsWith(searchLower) || searchLower.startsWith(titleLower) ||
            'respiratory medications'.startsWith(searchLower) || searchLower.startsWith('respiratory medications')) {
          med._showAllSections = true;
        } else {
          med._showAllSections = false;
        }
      }
      return matches;
    });
  }, [records, searchTerm]);

  // shouldShowSection - Section-level filtering with document-level intelligence
  const shouldShowSection = (med, sectionTitle, sectionContent) => {
    if (!searchTerm.trim()) return true;
    if (med._showAllSections) return true;

    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);

    // Check if search matches document-level data (name/date)
    const documentLevelText = [
      med.name || '',
      formatDate(med.startDate),
      med.startDate || ''
    ].filter(Boolean).join(' ').toLowerCase();

    const documentMatches = documentLevelText && searchWords.every(word => documentLevelText.includes(word));

    // If search matches the document name/date, show ALL sections
    if (documentMatches) return true;

    // Otherwise, filter at section level (content search)
    const titleLower = (sectionTitle || '').toLowerCase();
    const contentText = Array.isArray(sectionContent)
      ? sectionContent.filter(Boolean).join(' ').toLowerCase()
      : (sectionContent || '').toString().toLowerCase();

    const combinedText = `${titleLower} ${contentText}`;

    // ALL search words must be present
    return searchWords.every(word => combinedText.includes(word));
  };

  // shouldShowRow - Row-level filtering with document-level intelligence
  const shouldShowRow = (med, ...rowContent) => {
    if (!searchTerm.trim()) return true;
    if (med._showAllSections) return true;

    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);

    // Check if search matches document-level data (name/date)
    const documentLevelText = [
      med.name || '',
      formatDate(med.startDate),
      med.startDate || ''
    ].filter(Boolean).join(' ').toLowerCase();

    const documentMatches = documentLevelText && searchWords.every(word => documentLevelText.includes(word));

    // If search matches the document name/date, show ALL rows
    if (documentMatches) return true;

    // Otherwise, filter at row level
    const rowText = rowContent
      .filter(Boolean)
      .map(item => String(item))
      .join(' ')
      .toLowerCase();

    // ALL search words must be present
    return searchWords.every(word => rowText.includes(word));
  };

  // Highlight text function - multi-word OR logic
  const highlightText = (text) => {
    if (!searchTerm.trim() || !text) return text;

    const searchWords = searchTerm.trim().split(/\s+/);
    const regex = new RegExp(
      `(${searchWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
      'gi'
    );

    const textStr = String(text);
    const parts = textStr.split(regex);

    return parts.map((part, index) => {
      const isMatch = searchWords.some(word =>
        part.toLowerCase() === word.toLowerCase()
      );

      if (isMatch) {
        return (
          <mark key={index} style={{
            backgroundColor: '#fef08a',
            color: '#000',
            padding: '2px 4px',
            margin: '0',
            fontWeight: 'inherit',
            borderRadius: '2px'
          }}>
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  // Copy to clipboard helper
  const copySection = async (text, sectionId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSectionId(sectionId);
      setTimeout(() => setCopiedSectionId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // Copy all function - uses pdfData (merged edits)
  const copyAll = () => {
    let text = '=== RESPIRATORY MEDICATIONS ===\n\n';

    pdfData.forEach((med, idx) => {
      text += `Respiratory Medication ${idx + 1}\n`;
      text += '\u2500'.repeat(50) + '\n\n';

      // Basic Information
      if (med.name || med.genericName || med.dosage || med.frequency || med.route) {
        text += 'MEDICATION INFORMATION\n';
        if (med.name) text += `  Name: ${med.name}\n`;
        if (med.genericName) text += `  Generic Name: ${med.genericName}\n`;
        if (med.dosage) text += `  Dosage: ${med.dosage}\n`;
        if (med.frequency) text += `  Frequency: ${med.frequency}\n`;
        if (med.route) text += `  Route: ${med.route}\n`;
        text += '\n';
      }

      // Controllers
      if (med.controllers && med.controllers.length > 0) {
        text += 'CONTROLLER MEDICATIONS\n';
        med.controllers.forEach((controller, i) => {
          text += `  ${i + 1}. ${controller.medication || 'N/A'}\n`;
          if (controller.class) text += `      Class: ${controller.class}\n`;
          if (controller.dose) text += `      Dose: ${controller.dose}\n`;
          if (controller.frequency) text += `      Frequency: ${controller.frequency}\n`;
          if (controller.device) text += `      Device: ${controller.device}\n`;
          if (controller.technique) text += `      Technique: ${controller.technique}\n`;
          if (controller.adherence) text += `      Adherence: ${controller.adherence}\n`;
          text += '\n';
        });
      }

      // Relievers
      if (med.relievers && med.relievers.length > 0) {
        text += 'RELIEVER MEDICATIONS\n';
        med.relievers.forEach((reliever, i) => {
          text += `  ${i + 1}. ${reliever.medication || 'N/A'}\n`;
          if (reliever.dose) text += `      Dose: ${reliever.dose}\n`;
          if (reliever.frequency) text += `      Frequency: ${reliever.frequency}\n`;
          if (reliever.maxDailyUse) text += `      Max Daily Use: ${reliever.maxDailyUse}\n`;
          text += '\n';
        });
      }

      // Biologics
      if (med.biologics && (med.biologics.medication || med.biologics.dose)) {
        text += 'BIOLOGIC THERAPY\n';
        if (med.biologics.medication) text += `  Medication: ${med.biologics.medication}\n`;
        if (med.biologics.dose) text += `  Dose: ${med.biologics.dose}\n`;
        if (med.biologics.frequency) text += `  Frequency: ${med.biologics.frequency}\n`;
        if (med.biologics.route) text += `  Route: ${med.biologics.route}\n`;
        if (med.biologics.startDate) text += `  Start Date: ${formatDate(med.biologics.startDate)}\n`;
        if (med.biologics.response) text += `  Response: ${med.biologics.response}\n`;
        text += '\n';
      }

      // Nebulizers
      if (med.nebulizers && med.nebulizers.length > 0) {
        text += 'NEBULIZER MEDICATIONS\n';
        med.nebulizers.forEach((neb, i) => {
          text += `  ${i + 1}. ${neb}\n`;
        });
        text += '\n';
      }

      // Oral Corticosteroids
      if (med.oralCorticosteroids && (med.oralCorticosteroids.current !== undefined || med.oralCorticosteroids.dose)) {
        text += 'ORAL CORTICOSTEROIDS\n';
        if (med.oralCorticosteroids.current !== undefined) text += `  Current: ${med.oralCorticosteroids.current ? 'Yes' : 'No'}\n`;
        if (med.oralCorticosteroids.dose) text += `  Dose: ${med.oralCorticosteroids.dose}\n`;
        if (med.oralCorticosteroids.duration) text += `  Duration: ${med.oralCorticosteroids.duration}\n`;
        if (med.oralCorticosteroids.taperSchedule) text += `  Taper Schedule: ${med.oralCorticosteroids.taperSchedule}\n`;
        if (med.oralCorticosteroids.yearlyBursts !== undefined) text += `  Yearly Bursts: ${med.oralCorticosteroids.yearlyBursts}\n`;
        text += '\n';
      }

      // Additional Information
      if (med.startDate || med.endDate || med.prescriber || med.indication || med.instructions || med.active !== undefined || (med.sideEffects && med.sideEffects.length > 0) || med.safetyWarning) {
        text += 'ADDITIONAL INFORMATION\n';
        if (med.startDate) text += `  Start Date: ${formatDate(med.startDate)}\n`;
        if (med.endDate) text += `  End Date: ${formatDate(med.endDate)}\n`;
        if (med.duration) text += `  Duration: ${med.duration}\n`;
        if (med.durationDays !== undefined && med.durationDays !== null && !isNaN(parseFloat(med.durationDays)) && parseFloat(med.durationDays) !== 0) text += `  Duration (Days): ${parseFloat(med.durationDays)}\n`;
        if (med.durationUnit) text += `  Duration Unit: ${med.durationUnit}\n`;
        if (med.prescriber) text += `  Prescriber: ${med.prescriber}\n`;
        if (med.indication) text += `  Indication: ${med.indication}\n`;
        if (med.instructions) text += `  Instructions: ${med.instructions}\n`;
        if (med.refills !== undefined && med.refills !== null && !isNaN(parseFloat(med.refills)) && parseFloat(med.refills) !== 0) text += `  Refills: ${parseFloat(med.refills)}\n`;
        if (med.active !== undefined) text += `  Status: ${med.active ? 'Active' : 'Discontinued'}\n`;
        if (med.sideEffects && med.sideEffects.length > 0) {
          text += `  Side Effects:\n`;
          med.sideEffects.forEach((se, i) => { text += `    ${i + 1}. ${se}\n`; });
        }
        if (med.safetyWarning) text += `  Safety Warning: ${med.safetyWarning}\n`;
        text += '\n';
      }

      text += '='.repeat(80) + '\n\n';
    });

    copySection(text, 'all');
  };


  // Early return for no data
  if (!records || records.length === 0) {
    return (
      <div className="respiratory-medications-document">
        <div className="document-header">
          <h2 className="document-title">Respiratory Medications</h2>
        </div>
        <div className="empty-state">No respiratory medication records found</div>
      </div>
    );
  }

  return (
    <div className="respiratory-medications-document">
      {/* Header */}
      <div className="document-header">
        <h2 className="document-title">Respiratory Medications</h2>
      </div>
      <div className="header-actions">
        <button
          className={`action-btn ${copiedSectionId === 'all' ? 'copied' : ''}`}
          onClick={copyAll}
        >
          {copiedSectionId === 'all' ? 'Copied' : 'Copy All'}
        </button>
        <PDFDownloadLink
          document={<RespiratoryMedicationsDocumentPDFTemplate document={pdfData} />}
          fileName="respiratory-medications.pdf"
          className="action-btn"
        >
          {({ loading }) => (loading ? 'Preparing PDF...' : 'Export to PDF')}
        </PDFDownloadLink>
      </div>

      {/* Search Bar */}
      <SearchBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search respiratory medications..."
      />

      {/* Medications Container */}
      <div className="medications-container">
        {filteredMeds.length === 0 ? (
          <div className="no-data-message">
            {searchTerm ? 'No medications match your search.' : 'No medications available.'}
          </div>
        ) : (
          filteredMeds.map((med, idx) => {
            const medId = med._id || `med-${idx}`;

            return (
              <div key={medId} className="medication-card">
                {/* Card Header */}
                <div className="card-header">
                  <div className="medication-name">
                    {highlightText(med.name || `Respiratory Medication ${idx + 1}`)}
                  </div>
                </div>

                {/* Card Content */}
                <div className="card-content">
                  {/* Medication Information */}
                  {(med.genericName || med.dosage || med.frequency || med.route) && shouldShowSection(med, 'Medication Information', [
                    'generic name', 'GENERIC NAME', med.genericName,
                    'dosage', 'DOSAGE', med.dosage,
                    'frequency', 'FREQUENCY', med.frequency,
                    'route', 'ROUTE', med.route
                  ].filter(Boolean).join(' ')) && (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title" style={{ margin: 0 }}>{highlightText('Medication Information')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedSectionId === `medinfo-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const parts = [];
                                const gn = getFieldValue(med, 'genericName', idx);
                                const dos = getFieldValue(med, 'dosage', idx);
                                const freq = getFieldValue(med, 'frequency', idx);
                                const rt = getFieldValue(med, 'route', idx);
                                if (gn) parts.push(`Generic Name: ${gn}`);
                                if (dos) parts.push(`Dosage: ${dos}`);
                                if (freq) parts.push(`Frequency: ${freq}`);
                                if (rt) parts.push(`Route: ${rt}`);
                                copySection(parts.join('\n'), `medinfo-${idx}`);
                              }}
                            >
                              {copiedSectionId === `medinfo-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {editedFields[`medinfo-${idx}`] && (
                              <button className="approve-btn pending" onClick={() => handleApprove(med, idx)} disabled={approving}>
                                {approving ? 'Approving...' : 'Pending Approve'}
                              </button>
                            )}
                          </div>
                        </div>
                        {renderEditableField(med, idx, 'genericName', 'Generic Name', 'medinfo')}
                        {renderEditableField(med, idx, 'dosage', 'Dosage', 'medinfo')}
                        {renderEditableField(med, idx, 'frequency', 'Frequency', 'medinfo')}
                        {renderEditableField(med, idx, 'route', 'Route', 'medinfo')}
                      </div>
                    </div>
                  )}

                  {/* Controllers */}
                  {med.controllers && med.controllers.length > 0 && shouldShowSection(med, 'Controller Medications',
                    med.controllers.map(c => [
                      c.medication, 'class', 'CLASS', c.class, 'dose', 'DOSE', c.dose,
                      'frequency', 'FREQUENCY', c.frequency, 'device', 'DEVICE', c.device,
                      'technique', 'TECHNIQUE', c.technique, 'adherence', 'ADHERENCE', c.adherence
                    ].filter(Boolean).join(' ')).join(' ')
                  ) && (() => {
                    // Calculate sectionTitleMatches ONCE - if section title matches, show ALL rows
                    const sectionTitleMatches = searchTerm && (
                      shouldShowRow(med, 'Controller Medications', 'CONTROLLER') ||
                      shouldShowRow(med, 'Controllers')
                    );

                    return (
                      <div className="section">
                        <div className="mini-cards-container">
                          <div className="section-header">
                            <h4 className="section-title" style={{ margin: 0 }}>{highlightText('Controller Medications')}</h4>
                            <div className="header-right-actions">
                              <button
                                className={`copy-btn ${copiedSectionId === `controllers-${idx}` ? 'copied' : ''}`}
                                onClick={() => {
                                  const text = med.controllers.map((c, ci) => {
                                    const parts = [`${ci + 1}. ${getArrayFieldValue(med, 'controllers', ci, 'medication', idx) || c.medication || 'N/A'}`];
                                    ['class', 'dose', 'frequency', 'device', 'technique', 'adherence'].forEach(f => {
                                      const v = getArrayFieldValue(med, 'controllers', ci, f, idx) || c[f];
                                      if (v) parts.push(`  ${f.charAt(0).toUpperCase() + f.slice(1)}: ${v}`);
                                    });
                                    return parts.join('\n');
                                  }).join('\n\n');
                                  copySection(text, `controllers-${idx}`);
                                }}
                              >
                                {copiedSectionId === `controllers-${idx}` ? 'Copied' : 'Copy Section'}
                              </button>
                              {editedFields[`controller-${idx}`] && (
                                <button className="approve-btn pending" onClick={() => handleApprove(med, idx)} disabled={approving}>
                                  {approving ? 'Approving...' : 'Pending Approve'}
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="numbered-rows-wrapper" style={{ border: 'none', background: 'transparent', padding: 0 }}>
                            {med.controllers
                              .filter(controller => sectionTitleMatches || shouldShowRow(med,
                                controller.medication,
                                'class', 'CLASS', controller.class,
                                'dose', 'DOSE', controller.dose,
                                'frequency', 'FREQUENCY', controller.frequency,
                                'device', 'DEVICE', controller.device,
                                'technique', 'TECHNIQUE', controller.technique,
                                'adherence', 'ADHERENCE', controller.adherence
                              ))
                              .map((controller, cIdx) => (
                                <React.Fragment key={cIdx}>
                                  {/* Medication Name Header */}
                                  {(sectionTitleMatches || shouldShowRow(med, controller.medication)) && (
                                    <div className="plan-header" style={{ fontWeight: 600, marginTop: cIdx > 0 ? '12px' : '0' }}>
                                      {highlightText(getArrayFieldValue(med, 'controllers', cIdx, 'medication', idx) || controller.medication || 'N/A')}
                                    </div>
                                  )}

                                  {renderArrayObjectField(med, idx, 'controllers', cIdx, 'class', 'CLASS', `controller-${cIdx}`)}
                                  {renderArrayObjectField(med, idx, 'controllers', cIdx, 'dose', 'DOSE', `controller-${cIdx}`)}
                                  {renderArrayObjectField(med, idx, 'controllers', cIdx, 'frequency', 'FREQUENCY', `controller-${cIdx}`)}
                                  {renderArrayObjectField(med, idx, 'controllers', cIdx, 'device', 'DEVICE', `controller-${cIdx}`)}
                                  {renderArrayObjectField(med, idx, 'controllers', cIdx, 'technique', 'TECHNIQUE', `controller-${cIdx}`)}
                                  {renderArrayObjectField(med, idx, 'controllers', cIdx, 'adherence', 'ADHERENCE', `controller-${cIdx}`)}
                                </React.Fragment>
                              ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Relievers */}
                  {med.relievers && med.relievers.length > 0 && shouldShowSection(med, 'Reliever Medications',
                    med.relievers.map(r => [
                      r.medication, 'dose', 'DOSE', r.dose, 'frequency', 'FREQUENCY', r.frequency,
                      'max daily use', 'MAX DAILY USE', r.maxDailyUse
                    ].filter(Boolean).join(' ')).join(' ')
                  ) && (() => {
                    // Calculate sectionTitleMatches ONCE - if section title matches, show ALL rows
                    const sectionTitleMatches = searchTerm && (
                      shouldShowRow(med, 'Reliever Medications', 'RELIEVER') ||
                      shouldShowRow(med, 'Relievers')
                    );

                    return (
                      <div className="section">
                        <div className="mini-cards-container">
                          <div className="section-header">
                            <h4 className="section-title" style={{ margin: 0 }}>{highlightText('Reliever Medications')}</h4>
                            <div className="header-right-actions">
                              <button
                                className={`copy-btn ${copiedSectionId === `relievers-${idx}` ? 'copied' : ''}`}
                                onClick={() => {
                                  const text = med.relievers.map((r, ri) => {
                                    const parts = [`${ri + 1}. ${getArrayFieldValue(med, 'relievers', ri, 'medication', idx) || r.medication || 'N/A'}`];
                                    ['dose', 'frequency', 'maxDailyUse'].forEach(f => {
                                      const v = getArrayFieldValue(med, 'relievers', ri, f, idx) || r[f];
                                      if (v) parts.push(`  ${f === 'maxDailyUse' ? 'Max Daily Use' : f.charAt(0).toUpperCase() + f.slice(1)}: ${v}`);
                                    });
                                    return parts.join('\n');
                                  }).join('\n\n');
                                  copySection(text, `relievers-${idx}`);
                                }}
                              >
                                {copiedSectionId === `relievers-${idx}` ? 'Copied' : 'Copy Section'}
                              </button>
                              {editedFields[`reliever-${idx}`] && (
                                <button className="approve-btn pending" onClick={() => handleApprove(med, idx)} disabled={approving}>
                                  {approving ? 'Approving...' : 'Pending Approve'}
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="numbered-rows-wrapper" style={{ border: 'none', background: 'transparent', padding: 0 }}>
                            {med.relievers
                              .filter(reliever => sectionTitleMatches || shouldShowRow(med,
                                reliever.medication,
                                'dose', 'DOSE', reliever.dose,
                                'frequency', 'FREQUENCY', reliever.frequency,
                                'max daily use', 'MAX DAILY USE', reliever.maxDailyUse
                              ))
                              .map((reliever, rIdx) => (
                                <React.Fragment key={rIdx}>
                                  {/* Medication Name Header */}
                                  {(sectionTitleMatches || shouldShowRow(med, reliever.medication)) && (
                                    <div className="plan-header" style={{ fontWeight: 600, marginTop: rIdx > 0 ? '12px' : '0' }}>
                                      {highlightText(getArrayFieldValue(med, 'relievers', rIdx, 'medication', idx) || reliever.medication || 'N/A')}
                                    </div>
                                  )}

                                  {renderArrayObjectField(med, idx, 'relievers', rIdx, 'dose', 'DOSE', `reliever-${rIdx}`)}
                                  {renderArrayObjectField(med, idx, 'relievers', rIdx, 'frequency', 'FREQUENCY', `reliever-${rIdx}`)}
                                  {renderArrayObjectField(med, idx, 'relievers', rIdx, 'maxDailyUse', 'MAX DAILY USE', `reliever-${rIdx}`)}
                                </React.Fragment>
                              ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Biologics */}
                  {med.biologics && (med.biologics.medication || med.biologics.dose || med.biologics.frequency || med.biologics.route || med.biologics.startDate || med.biologics.response) && shouldShowSection(med, 'Biologic Therapy', [
                    'medication', 'MEDICATION', med.biologics?.medication,
                    'dose', 'DOSE', med.biologics?.dose,
                    'frequency', 'FREQUENCY', med.biologics?.frequency,
                    'route', 'ROUTE', med.biologics?.route,
                    'start date', 'START DATE', med.biologics?.startDate,
                    'response', 'RESPONSE', med.biologics?.response
                  ].filter(Boolean).join(' ')) && (() => {
                    // Pre-check: Will ANY rows actually display?
                    const hasVisibleRows = (
                      (med.biologics?.medication && shouldShowRow(med, 'MEDICATION', 'medication', med.biologics.medication)) ||
                      (med.biologics?.dose && shouldShowRow(med, 'DOSE', 'dose', med.biologics.dose)) ||
                      (med.biologics?.frequency && shouldShowRow(med, 'FREQUENCY', 'frequency', med.biologics.frequency)) ||
                      (med.biologics?.route && shouldShowRow(med, 'ROUTE', 'route', med.biologics.route)) ||
                      (med.biologics?.startDate && shouldShowRow(med, 'START DATE', 'start date', formatDate(med.biologics.startDate))) ||
                      (med.biologics?.response && shouldShowRow(med, 'RESPONSE', 'response', med.biologics.response))
                    );

                    // If no rows will show, don't render the section at all
                    if (!hasVisibleRows) return null;

                    return (
                      <div className="section">
                        <div className="mini-cards-container">
                          <div className="section-header">
                            <h4 className="section-title" style={{ margin: 0 }}>{highlightText('Biologic Therapy')}</h4>
                            <div className="header-right-actions">
                              <button
                                className={`copy-btn ${copiedSectionId === `biologics-${idx}` ? 'copied' : ''}`}
                                onClick={() => {
                                  const parts = [];
                                  const bm = getNestedFieldValue(med, 'biologics', 'medication', idx);
                                  const bd = getNestedFieldValue(med, 'biologics', 'dose', idx);
                                  const bf = getNestedFieldValue(med, 'biologics', 'frequency', idx);
                                  const br = getNestedFieldValue(med, 'biologics', 'route', idx);
                                  const bsd = med.biologics?.startDate;
                                  const bresp = getNestedFieldValue(med, 'biologics', 'response', idx);
                                  if (bm) parts.push(`Medication: ${bm}`);
                                  if (bd) parts.push(`Dose: ${bd}`);
                                  if (bf) parts.push(`Frequency: ${bf}`);
                                  if (br) parts.push(`Route: ${br}`);
                                  if (bsd) parts.push(`Start Date: ${formatDate(bsd)}`);
                                  if (bresp) parts.push(`Response: ${bresp}`);
                                  copySection(parts.join('\n'), `biologics-${idx}`);
                                }}
                              >
                                {copiedSectionId === `biologics-${idx}` ? 'Copied' : 'Copy Section'}
                              </button>
                              {editedFields[`biologics-${idx}`] && (
                                <button className="approve-btn pending" onClick={() => handleApprove(med, idx)} disabled={approving}>
                                  {approving ? 'Approving...' : 'Pending Approve'}
                                </button>
                              )}
                            </div>
                          </div>
                          {renderNestedEditableField(med, idx, 'biologics', 'medication', 'Medication', 'biologics')}
                          {renderNestedEditableField(med, idx, 'biologics', 'dose', 'Dose', 'biologics')}
                          {renderNestedEditableField(med, idx, 'biologics', 'frequency', 'Frequency', 'biologics')}
                          {renderNestedEditableField(med, idx, 'biologics', 'route', 'Route', 'biologics')}
                          {/* Start Date - NON-EDITABLE */}
                          {med.biologics?.startDate && shouldShowRow(med, 'START DATE', 'start date', formatDate(med.biologics.startDate)) && (
                            <div className="rec-mini-card">
                              <div className="nested-subtitle">{highlightText('Start Date')}</div>
                              <div className="numbered-row">
                                <div className="row-content">
                                  <span className="content-value">{highlightText(formatDate(med.biologics.startDate))}</span>
                                </div>
                                <button
                                  className={`copy-btn ${copiedSectionId === `${medId}-bio-start` ? 'copied' : ''}`}
                                  onClick={() => copySection(`Start Date: ${formatDate(med.biologics.startDate)}`, `${medId}-bio-start`)}
                                >
                                  {copiedSectionId === `${medId}-bio-start` ? 'Copied' : 'Copy'}
                                </button>
                              </div>
                            </div>
                          )}
                          {renderNestedEditableField(med, idx, 'biologics', 'response', 'Response', 'biologics')}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Nebulizers - STRICT Row-Level Filtering */}
                  {med.nebulizers && med.nebulizers.length > 0 && shouldShowSection(med, 'Nebulizer Medications', med.nebulizers.join(' ')) && (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title" style={{ margin: 0 }}>{highlightText('Nebulizer Medications')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedSectionId === `nebulizers-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const text = med.nebulizers.map((n, ni) => `${ni + 1}. ${n}`).join('\n');
                                copySection(text, `nebulizers-${idx}`);
                              }}
                            >
                              {copiedSectionId === `nebulizers-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                          </div>
                        </div>
                        <div className="numbered-rows-wrapper" style={{ border: 'none', background: 'transparent', padding: 0 }}>
                          {med.nebulizers
                            .filter(neb => shouldShowRow(med, neb))
                            .map((neb, nIdx) => (
                              <div key={nIdx} className="numbered-row">
                                <div className="numbered-row-content">
                                  {highlightText(neb)}
                                </div>
                                <button
                                  className={`copy-btn ${copiedSectionId === `${medId}-neb-${nIdx}` ? 'copied' : ''}`}
                                  onClick={() => copySection(`${nIdx + 1}. ${neb}`, `${medId}-neb-${nIdx}`)}
                                >
                                  {copiedSectionId === `${medId}-neb-${nIdx}` ? 'Copied' : 'Copy'}
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Oral Corticosteroids */}
                  {med.oralCorticosteroids && (med.oralCorticosteroids.current !== undefined || med.oralCorticosteroids.dose || med.oralCorticosteroids.duration || med.oralCorticosteroids.taperSchedule || med.oralCorticosteroids.yearlyBursts !== undefined) && shouldShowSection(med, 'Oral Corticosteroids', [
                    'current', 'CURRENT', med.oralCorticosteroids?.current !== undefined ? (med.oralCorticosteroids.current ? 'Yes' : 'No') : '',
                    'dose', 'DOSE', med.oralCorticosteroids?.dose,
                    'duration', 'DURATION', med.oralCorticosteroids?.duration,
                    'taper schedule', 'TAPER SCHEDULE', med.oralCorticosteroids?.taperSchedule,
                    'yearly bursts', 'YEARLY BURSTS', med.oralCorticosteroids?.yearlyBursts
                  ].filter(Boolean).join(' ')) && (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title" style={{ margin: 0 }}>{highlightText('Oral Corticosteroids')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedSectionId === `ocs-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const parts = [];
                                if (med.oralCorticosteroids?.current !== undefined) parts.push(`Current: ${med.oralCorticosteroids.current ? 'Yes' : 'No'}`);
                                const ocd = getNestedFieldValue(med, 'oralCorticosteroids', 'dose', idx);
                                const ocdur = getNestedFieldValue(med, 'oralCorticosteroids', 'duration', idx);
                                const octaper = getNestedFieldValue(med, 'oralCorticosteroids', 'taperSchedule', idx);
                                if (ocd) parts.push(`Dose: ${ocd}`);
                                if (ocdur) parts.push(`Duration: ${ocdur}`);
                                if (octaper) parts.push(`Taper Schedule: ${octaper}`);
                                if (med.oralCorticosteroids?.yearlyBursts !== undefined) parts.push(`Yearly Bursts: ${med.oralCorticosteroids.yearlyBursts}`);
                                copySection(parts.join('\n'), `ocs-${idx}`);
                              }}
                            >
                              {copiedSectionId === `ocs-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {editedFields[`ocs-${idx}`] && (
                              <button className="approve-btn pending" onClick={() => handleApprove(med, idx)} disabled={approving}>
                                {approving ? 'Approving...' : 'Pending Approve'}
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Current - editable Yes/No */}
                        {med.oralCorticosteroids?.current !== undefined && shouldShowRow(med, 'CURRENT', 'current', med.oralCorticosteroids.current ? 'Yes' : 'No') &&
                          renderBooleanField(med, idx, 'oralCorticosteroids.current', 'Current', 'ocs', getNestedFieldValue(med, 'oralCorticosteroids', 'current', idx), 'Yes', 'No')
                        }
                        {renderNestedEditableField(med, idx, 'oralCorticosteroids', 'dose', 'Dose', 'ocs')}
                        {renderNestedEditableField(med, idx, 'oralCorticosteroids', 'duration', 'Duration', 'ocs')}
                        {renderNestedEditableField(med, idx, 'oralCorticosteroids', 'taperSchedule', 'Taper Schedule', 'ocs')}
                        {/* Yearly Bursts - editable */}
                        {med.oralCorticosteroids?.yearlyBursts !== undefined && shouldShowRow(med, 'YEARLY BURSTS', 'yearly bursts', String(med.oralCorticosteroids.yearlyBursts)) &&
                          renderNestedEditableField(med, idx, 'oralCorticosteroids', 'yearlyBursts', 'Yearly Bursts', 'ocs', String(getNestedFieldValue(med, 'oralCorticosteroids', 'yearlyBursts', idx) ?? ''))
                        }
                      </div>
                    </div>
                  )}

                  {/* Additional Information */}
                  {(med.startDate || med.endDate || med.duration || (med.durationDays !== undefined && med.durationDays !== null && parseFloat(med.durationDays) !== 0) || med.durationUnit || med.prescriber || med.indication || med.instructions || (med.refills !== undefined && med.refills !== null && parseFloat(med.refills) !== 0) || med.active !== undefined || (med.sideEffects && med.sideEffects.length > 0) || med.safetyWarning) && shouldShowSection(med, 'Additional Information', [
                    'end date', 'END DATE', med.endDate,
                    'duration', 'DURATION', med.duration,
                    'duration days', 'DURATION DAYS', (med.durationDays !== undefined && med.durationDays !== null && parseFloat(med.durationDays) !== 0) ? String(parseFloat(med.durationDays)) : '',
                    'duration unit', 'DURATION UNIT', med.durationUnit,
                    'prescriber', 'PRESCRIBER', med.prescriber,
                    'indication', 'INDICATION', med.indication,
                    'instructions', 'INSTRUCTIONS', med.instructions,
                    'refills', 'REFILLS', (med.refills !== undefined && med.refills !== null && parseFloat(med.refills) !== 0) ? String(parseFloat(med.refills)) : '',
                    'status', 'STATUS', med.active !== undefined ? (med.active ? 'Active' : 'Discontinued') : '',
                    'side effects', 'SIDE EFFECTS', (med.sideEffects && med.sideEffects.length > 0) ? med.sideEffects.join(' ') : '',
                    'safety warning', 'SAFETY WARNING', med.safetyWarning
                  ].filter(Boolean).join(' ')) && (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title" style={{ margin: 0 }}>{highlightText('Additional Information')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedSectionId === `addinfo-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const parts = [];
                                if (med.startDate) parts.push(`Start Date: ${formatDate(med.startDate)}`);
                                if (med.endDate) parts.push(`End Date: ${formatDate(med.endDate)}`);
                                const dur = getFieldValue(med, 'duration', idx);
                                const durDaysRaw = getFieldValue(med, 'durationDays', idx);
                                const durUnit = getFieldValue(med, 'durationUnit', idx);
                                const presc = getFieldValue(med, 'prescriber', idx);
                                const ind = getFieldValue(med, 'indication', idx);
                                const inst = getFieldValue(med, 'instructions', idx);
                                const refillsRaw = getFieldValue(med, 'refills', idx);
                                if (dur) parts.push(`Duration: ${dur}`);
                                if (durDaysRaw !== undefined && durDaysRaw !== null && durDaysRaw !== '' && !isNaN(parseFloat(durDaysRaw)) && parseFloat(durDaysRaw) !== 0) parts.push(`Duration (Days): ${parseFloat(durDaysRaw)}`);
                                if (durUnit) parts.push(`Duration Unit: ${durUnit}`);
                                if (presc) parts.push(`Prescriber: ${presc}`);
                                if (ind) parts.push(`Indication: ${ind}`);
                                if (inst) parts.push(`Instructions: ${inst}`);
                                if (refillsRaw !== undefined && refillsRaw !== null && refillsRaw !== '' && !isNaN(parseFloat(refillsRaw)) && parseFloat(refillsRaw) !== 0) parts.push(`Refills: ${parseFloat(refillsRaw)}`);
                                if (med.active !== undefined) parts.push(`Status: ${med.active ? 'Active' : 'Discontinued'}`);
                                if (med.sideEffects && med.sideEffects.length > 0) parts.push(`Side Effects:\n${med.sideEffects.map((se, i) => `  ${i + 1}. ${se}`).join('\n')}`);
                                if (med.safetyWarning) parts.push(`Safety Warning: ${med.safetyWarning}`);
                                copySection(parts.join('\n'), `addinfo-${idx}`);
                              }}
                            >
                              {copiedSectionId === `addinfo-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {editedFields[`addinfo-${idx}`] && (
                              <button className="approve-btn pending" onClick={() => handleApprove(med, idx)} disabled={approving}>
                                {approving ? 'Approving...' : 'Pending Approve'}
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Start Date - NON-EDITABLE */}
                        {med.startDate && shouldShowRow(med, 'START DATE', 'start date', formatDate(med.startDate)) && (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText('Start Date')}</div>
                            <div className="numbered-row">
                              <div className="row-content">
                                <span className="content-value">{highlightText(formatDate(med.startDate))}</span>
                              </div>
                              <button
                                className={`copy-btn ${copiedSectionId === `${medId}-start` ? 'copied' : ''}`}
                                onClick={() => copySection(`Start Date: ${formatDate(med.startDate)}`, `${medId}-start`)}
                              >
                                {copiedSectionId === `${medId}-start` ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}
                        {/* End Date - NON-EDITABLE */}
                        {med.endDate && shouldShowRow(med, 'END DATE', 'end date', formatDate(med.endDate)) && (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText('End Date')}</div>
                            <div className="numbered-row">
                              <div className="row-content">
                                <span className="content-value">{highlightText(formatDate(med.endDate))}</span>
                              </div>
                              <button
                                className={`copy-btn ${copiedSectionId === `${medId}-end` ? 'copied' : ''}`}
                                onClick={() => copySection(`End Date: ${formatDate(med.endDate)}`, `${medId}-end`)}
                              >
                                {copiedSectionId === `${medId}-end` ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}
                        {renderEditableField(med, idx, 'duration', 'Duration', 'addinfo')}
                        {renderNumberField(med, idx, 'durationDays', 'Duration (Days)', 'addinfo')}
                        {renderEditableField(med, idx, 'durationUnit', 'Duration Unit', 'addinfo')}
                        {renderEditableField(med, idx, 'prescriber', 'Prescriber', 'addinfo')}
                        {renderEditableField(med, idx, 'indication', 'Indication', 'addinfo')}
                        {renderEditableField(med, idx, 'instructions', 'Instructions', 'addinfo')}
                        {renderNumberField(med, idx, 'refills', 'Refills', 'addinfo')}
                        {/* Status (active) - editable Active/Discontinued */}
                        {med.active !== undefined && shouldShowRow(med, 'STATUS', 'status', med.active ? 'Active' : 'Discontinued') &&
                          renderBooleanField(med, idx, 'active', 'Status', 'addinfo', getFieldValue(med, 'active', idx), 'Active', 'Discontinued')
                        }
                        {/* Side Effects - NON-EDITABLE (array) */}
                        {med.sideEffects && med.sideEffects.length > 0 && shouldShowRow(med, 'SIDE EFFECTS', 'side effects', med.sideEffects.join(' ')) && (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText('Side Effects')}</div>
                            <div className="numbered-rows-wrapper" style={{ border: 'none', background: 'transparent', padding: 0 }}>
                              {med.sideEffects.map((se, seIdx) => (
                                <div key={seIdx} className="numbered-row">
                                  <div className="numbered-row-content">
                                    {highlightText(se)}
                                  </div>
                                  <button
                                    className={`copy-btn ${copiedSectionId === `${medId}-se-${seIdx}` ? 'copied' : ''}`}
                                    onClick={() => copySection(`${seIdx + 1}. ${se}`, `${medId}-se-${seIdx}`)}
                                  >
                                    {copiedSectionId === `${medId}-se-${seIdx}` ? 'Copied' : 'Copy'}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Safety Warning - editable string */}
                        {med.safetyWarning && shouldShowRow(med, 'SAFETY WARNING', 'safety warning', med.safetyWarning) &&
                          renderEditableField(med, idx, 'safetyWarning', 'Safety Warning', 'addinfo')
                        }
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default RespiratoryMedicationsDocument;
