import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import AssessmentPlansPDFTemplate from '../pdf-templates/AssessmentPlansPDFTemplate';
import './AssessmentPlansDocument.css';

/**
 * AssessmentPlansDocument - Rebuilt February 2026
 * Blue theme, mini-card pattern, 4-level search, per-sentence editing
 * No duplicate section titles, sentences split into individual rows
 */
/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'assessment_plansPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};
const AssessmentPlansDocument = ({ document: docProp, data, templateData: tplData }) => {
  const templateData = docProp || data || tplData;
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

  // ========== DATA UNWRAPPING ==========
  const unwrappedData = useMemo(() => {
    if (!templateData) return [];
    let records = [];
    if (Array.isArray(templateData)) {
      if (templateData.length > 0 && templateData[0]?.assessment_plans) {
        records = templateData.flatMap(item => item.assessment_plans || []);
      } else if (templateData.length > 0 && templateData[0]?.records) {
        records = templateData.flatMap(item => item.records || []);
      } else {
        records = templateData;
      }
    } else if (templateData.assessment_plans) {
      records = templateData.assessment_plans;
    } else if (templateData.records) {
      records = templateData.records;
    } else {
      records = [templateData];
    }
    return records
      .filter(r => r && (r.chiefComplaint || r.assessment || r.diagnoses?.length > 0))
      .map(record => {
        const cleanRecord = {};
        for (const key of Object.keys(record)) {
          if (!key.startsWith('_') || key === '_id') cleanRecord[key] = record[key];
        }
        return cleanRecord;
      });
  }, [templateData]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nStatus = {};
    unwrappedData.forEach((record, idx) => {
      const recordId = record && (record._id?.$oid || record._id);
      const recDrafts = recordId ? store[recordId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        const lastDot = fieldPart.lastIndexOf('.');
        const baseField = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1)))
          ? fieldPart.slice(0, lastDot) : fieldPart;
        const sectionId = Object.keys(SECTION_FIELDS).find(s => SECTION_FIELDS[s].includes(baseField));
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
  }, [unwrappedData]);

  // ========== HELPER FUNCTIONS ==========
  const formatDate = (dateValue) => {
    if (!dateValue) return '';
    try {
      const date = new Date(dateValue.$date || dateValue);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return String(dateValue); }
  };

  const getRecordDate = (record) => record.date || record.createdAt || record.createdAtUTC || null;

  // Proper splitBySentence with parenthesis awareness + title protection
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

  const splitByComma = (text) => {
    if (!text || typeof text !== 'string') return [];
    const results = [];
    let current = '';
    let parenDepth = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '(') { parenDepth++; current += char; }
      else if (char === ')') { parenDepth--; current += char; }
      else if (char === ',' && parenDepth === 0) {
        const trimmed = current.trim();
        if (trimmed) results.push(trimmed);
        current = '';
      } else { current += char; }
    }
    const trimmed = current.trim();
    if (trimmed) results.push(trimmed);
    return results;
  };

  // splitItemsAnd — split narrative text into per-finding rows for readability: break on . ;
  // (paren-aware) always, and on a comma (paren-aware) UNLESS it is immediately followed by
  // "and" (so "..., and X" stays attached). Commas inside parentheses never split.
  const splitItemsAnd = (text) => {
    if (!text || typeof text !== 'string') return [];
    const result = []; let current = ''; let depth = 0;
    const ANDNEXT = /^\s*and\b/i;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') { depth++; current += ch; continue; }
      if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; continue; }
      const isSentenceEnd = (ch === '.' || ch === ';') && i + 1 < text.length && /\s/.test(text[i + 1]);
      const isSplitComma = ch === ',' && depth === 0 && !ANDNEXT.test(text.slice(i + 1));
      if (depth === 0 && (isSentenceEnd || isSplitComma)) {
        if (isSentenceEnd && ch === '.' && /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc)$/.test(current)) { current += ch; continue; }
        const t = current.trim(); if (t) result.push(t); current = '';
        while (i + 1 < text.length && /\s/.test(text[i + 1])) i++;
        continue;
      }
      current += ch;
    }
    const t = current.replace(/[.;,]+$/, '').trim(); if (t) result.push(t);
    return result;
  };

  // Detect embedded subtitle groups in text: "Primary Diagnoses: ...; ... Secondary Diagnoses: ...; ..."
  // Returns [{subtitle: string|null, items: [{text, flatIdx}]}]
  const groupBySubtitles = (sentences) => {
    if (!sentences || sentences.length === 0) return [];
    // Detect subtitle pattern: multi-word capitalized phrase + colon at start of sentence
    const subtitleRegex = /^([A-Z][A-Za-z]+(?:\s+[A-Za-z,()0-9/-]+)+?):\s+(.+)$/;
    const groups = [];
    let currentGroup = null;
    let hasSubtitles = false;

    for (let i = 0; i < sentences.length; i++) {
      const match = sentences[i].match(subtitleRegex);
      if (match) {
        hasSubtitles = true;
        currentGroup = { subtitle: match[1].trim(), items: [{ text: match[2].trim(), flatIdx: i }] };
        groups.push(currentGroup);
      } else if (currentGroup) {
        currentGroup.items.push({ text: sentences[i], flatIdx: i });
      } else {
        // Pre-subtitle content (no group yet)
        if (groups.length === 0 || groups[groups.length - 1].subtitle !== null) {
          groups.push({ subtitle: null, items: [] });
        }
        groups[groups.length - 1].items.push({ text: sentences[i], flatIdx: i });
      }
    }

    // If no subtitles found, return single null-subtitle group with all items
    if (!hasSubtitles) {
      return [{ subtitle: null, items: sentences.map((s, i) => ({ text: s, flatIdx: i })) }];
    }
    return groups;
  };

  // Text fields that may have multiple sentences → per-sentence editing
  const SENTENCE_FIELDS = ['chiefComplaint', 'assessment', 'plan', 'patientEducation', 'followUp', 'notes'];

  // ========== COPY FUNCTIONS ==========
  const copyToClipboard = useCallback(async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) { console.error('Copy failed:', err); }
  }, []);

  const copySectionToClipboard = useCallback(async (text, sectionId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSectionId(sectionId);
      setTimeout(() => setCopiedSectionId(null), 2000);
    } catch (err) { console.error('Copy failed:', err); }
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
  const handleStartEdit = useCallback((fieldName, idx, currentValue, sentenceIdx = 0) => {
    const editKey = `${fieldName}-${idx}-s${sentenceIdx}`;
    setEditingField(editKey);
    const cleanValue = (currentValue || '').replace(/[.;]+$/, '').trim();
    setEditValue(cleanValue);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue('');
  }, []);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApprove commits).
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, sentenceIdx, valueOverride) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) {
      console.error('[AssessmentPlans] Cannot save — no record _id');
      return;
    }
    const saveValue = valueOverride !== undefined ? valueOverride : editValue.trim();
    // Array-element edits carry a numeric arrayIndex; text/sentence fields persist as the full field.
    const isArrayElement = typeof sentenceIdx === 'number' && !SENTENCE_FIELDS.includes(fieldName);
    const fieldPart = isArrayElement ? `${fieldName}.${sentenceIdx}` : fieldName;
    const editKey = `${fieldPart}-${idx}`;
    const sKey = `${fieldName}-${idx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;

    setLocalEdits(prev => ({ ...prev, [editKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow.
    setApprovedSections(prev => {
      const updated = { ...prev };
      delete updated[sectionId];
      delete updated[`record-${idx}`];
      return updated;
    });

    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldPart] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Reconstruct full text with period restoration on ALL sentences
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
      // CRITICAL: Add period to ALL sentences, not just the edited one
      return (t && !/[.!?]$/.test(t)) ? t + '.' : t;
    });
    return updated.join(' ');
  };

  // Helper: save a sentence within a text field (full text reconstruction)
  const saveSentence = (record, fieldName, idx, sectionId, sIdx) => {
    const editedSentence = editValue.trim();

    const fullEditKey = `${fieldName}-${idx}`;
    const hasFullEdit = localEdits[fullEditKey] !== undefined;
    const sourceText = hasFullEdit ? localEdits[fullEditKey] : (record[fieldName] || '');
    const allCurrent = splitItemsAnd(sourceText);

    // Splice the edited item back into the ORIGINAL text (walk item-by-item) so every
    // delimiter (. ; ,) + spacing is preserved exactly.
    let cursor = 0, rebuilt = '', ok = true;
    for (let i = 0; i < allCurrent.length; i++) {
      const item = allCurrent[i];
      const pos = sourceText.indexOf(item, cursor);
      if (pos === -1) { ok = false; break; }
      rebuilt += sourceText.slice(cursor, pos) + (i === sIdx ? editedSentence : item);
      cursor = pos + item.length;
    }
    const fullText = ok ? rebuilt + sourceText.slice(cursor)
      : allCurrent.map((s, i) => (i === sIdx ? editedSentence : s)).join('. ');

    // Detect added items
    const newSentences = splitItemsAnd(fullText);
    const extraCount = newSentences.length - allCurrent.length;
    if (extraCount > 0) {
      const editedMap = {};
      const editKey = `${fieldName}-${idx}-s${sIdx}`;
      editedMap[editKey] = 'edited';
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

  // Approve = COMMIT all staged drafts for this record to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApprove = useCallback(async (record, idx, sectionId) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) return;
    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements).
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        const isArrayElement = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        const payload = { field: isArrayElement ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArrayElement) payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        const resp = await secureApiClient.put(`/api/edit/assessment_plans/${recordId}/edit`, payload);
        if (!resp || !resp.success) throw new Error((resp && resp.error) || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/assessment_plans/${recordId}/approve`);

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
      setEditedFields({});
      setEditedSentences({});
    } catch (err) { console.error('[AssessmentPlans] Approve error:', err); }
    finally { setApproving(false); }
  }, [localEdits, pendingEdits]);

  // ============== SECTION_FIELDS + sectionHasEdits ==============
  const SECTION_FIELDS = {
    'general': ['provider', 'date'],
    'chief': ['chiefComplaint'],
    'assessment': ['assessment'],
    'diagnoses': ['diagnoses'],
    'plan': ['plan'],
    'meds': ['medications'],
    'procs': ['procedures'],
    'refs': ['referrals'],
    'testing': ['testing'],
    'education': ['patientEducation'],
    'followup': ['followUp'],
    'notes': ['notes'],
  };

  const sectionHasEdits = useCallback((sectionId, idx) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    const recordStatus = statusOverrides[idx] || 'active';
    if (recordStatus === 'approved') return false;
    return fields.some(f => {
      return Object.keys(editedSentences).some(key => {
        if (!key.startsWith(`${f}-${idx}-s`)) return false;
        return editedSentences[key] === 'edited' || editedSentences[key] === 'added';
      });
    });
  }, [editedSentences, statusOverrides]);

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

  // ========== SEARCH FUNCTIONS (4-Level) ==========
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

  const shouldShowRow = useCallback((record, ...valuesToCheck) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    for (const val of valuesToCheck) {
      if (val && String(val).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm]);

  // ========== FILTERED RECORDS (Level 1) ==========
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return unwrappedData;
    const phrase = searchTerm.toLowerCase().trim();

    return unwrappedData.map((record, idx) => {
      const recordTitle = `Assessment Plan ${idx + 1}`;
      const searchableText = [
        'Assessment Plans', recordTitle,
        'General Information', 'Chief Complaint', 'Assessment', 'Diagnoses',
        'Plan', 'Medications', 'Procedures', 'Referrals', 'Testing',
        'Patient Education', 'Follow-Up', 'Notes',
        'Date', 'Provider', 'Facility',
        formatDate(getRecordDate(record)),
        record.provider, record.facility, record.chiefComplaint,
        record.assessment, record.plan, record.patientEducation,
        record.followUp, record.notes,
        ...(record.diagnoses || []),
        ...(record.medications || []),
        ...(record.procedures || []),
        ...(record.referrals || []),
        ...(record.testing || [])
      ].filter(Boolean).join(' ').toLowerCase();

      if (searchableText.includes(phrase)) {
        const titleLower = recordTitle.toLowerCase();
        if (titleLower.startsWith(phrase) || phrase.startsWith(titleLower) ||
            'assessment plans'.startsWith(phrase) || phrase.startsWith('assessment plans')) {
          return { ...record, _showAllSections: true };
        }
        return record;
      }
      return null;
    }).filter(Boolean);
  }, [unwrappedData, searchTerm]);

  // ============== RENDER EDITABLE FIELD (simple fields like provider) ==============
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
          <div className={`row-content${canEdit ? ' editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue)}
            title={canEdit ? 'Click to edit' : undefined}>
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isFieldEdited && editIndicator}
          </div>
          <button className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(displayValue, copyId)}>
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && <div className="modified-badge">edited — click pending approve to save</div>}
      </div>
    );
  };

  // ============== RENDER EDITABLE DATE (date picker) ==============
  // ISO/date → "yyyy-mm-dd" for <input type="date"> (UTC slice; mirrors the stored midnight-UTC ISO)
  const toInputDate = (v) => {
    if (!v) return '';
    try {
      const d = new Date(v.$date || v);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().slice(0, 10);
    } catch { return ''; }
  };

  const saveDate = (record, idx) => {
    if (!editValue) return;
    // store back as midnight-UTC ISO so it round-trips with the stored format
    handleSaveField(record, 'date', idx, 'general', undefined, `${editValue}T00:00:00.000Z`);
  };

  const renderDateField = (record, idx, copyId) => {
    const rawVal = getFieldValue(record, 'date', idx) || getRecordDate(record);
    if (!rawVal) return null;
    const canEdit = !!record._id;
    const sectionWasEdited = editedFields[`general-${idx}`];
    const editKey = `date-${idx}-s0`;
    const isEditing = editingField === editKey;
    const isFieldEdited = sectionWasEdited && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';
    const display = formatDate(rawVal);

    if (isEditing) {
      return (
        <div className="rec-mini-card" key="date">
          <div className="nested-subtitle">{highlightText('Date')}</div>
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <input
                type="date"
                className="edit-date"
                value={editValue}
                autoFocus
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') handleCancelEdit();
                  if (e.key === 'Enter') saveDate(record, idx);
                }}
                disabled={saving}
              />
              <div className="edit-actions">
                <button className="edit-save-btn" onClick={() => saveDate(record, idx)} disabled={saving || !editValue}>
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
      <div className="rec-mini-card" key="date">
        <div className="nested-subtitle">{highlightText('Date')}</div>
        <div className={`numbered-row${isFieldEdited ? ' modified' : ''}`}>
          <div className={`row-content${canEdit ? ' editable' : ''}`}
            onClick={() => canEdit && handleStartEdit('date', idx, toInputDate(rawVal))}
            title={canEdit ? 'Click to edit' : undefined}>
            <span className="content-value">{highlightText(display)}</span>
            {canEdit && !isFieldEdited && editIndicator}
          </div>
          <button className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(display, copyId)}>
            {copiedId === copyId ? 'Copied' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && <div className="modified-badge">edited — click pending approve to save</div>}
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
          <div className={`row-content${canEdit ? ' editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(`${fieldName}.${itemIdx}`, idx, displayValue)}
            title={canEdit ? 'Click to edit' : undefined}>
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isItemEdited && editIndicator}
          </div>
          <button className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(displayValue, copyId)}>
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isItemEdited && <div className="modified-badge">edited — click pending approve to save</div>}
      </React.Fragment>
    );
  };

  // ============== RENDER SENTENCE ROWS (with subtitle grouping) ==============
  const renderSentenceRows = (record, fieldName, idx, sectionId, recordId) => {
    const fullEditKey = `${fieldName}-${idx}`;
    const hasFullEdit = localEdits[fullEditKey] !== undefined;
    const sourceText = hasFullEdit ? localEdits[fullEditKey] : (record[fieldName] || '');
    if (!sourceText?.trim()) return null;

    const sentences = splitItemsAnd(sourceText);
    if (sentences.length === 0) return null;
    const groups = groupBySubtitles(sentences);
    const canEdit = !!record._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];

    // Render a single item row (shared between grouped and ungrouped)
    const renderItemRow = (text, flatIdx) => {
      const editKey = `${fieldName}-${idx}-s${flatIdx}`;
      const isEditing = editingField === editKey;
      const sentenceStatus = editedSentences[editKey];
      const isEdited = sectionWasEdited && (sentenceStatus === 'edited' || sentenceStatus === 'added') && statusOverrides[idx] !== 'approved';
      const copyId = `${recordId}-${fieldName}-s${flatIdx}`;

      // Search filtering per item
      if (searchTerm.trim() && !record._showAllSections) {
        const phrase = searchTerm.toLowerCase().trim();
        if (!text.toLowerCase().includes(phrase)) return null;
      }

      if (isEditing) {
        return (
          <div key={`r-${flatIdx}`} className="numbered-row edit-row">
            <div className="edit-field-container">
              <textarea
                ref={textareaRef}
                className="edit-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') handleCancelEdit();
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveSentence(record, fieldName, idx, sectionId, flatIdx);
                }}
                rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))}
                disabled={saving}
              />
              <div className="edit-actions">
                <button className="edit-save-btn" onClick={() => saveSentence(record, fieldName, idx, sectionId, flatIdx)} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <React.Fragment key={`r-${flatIdx}`}>
          <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
            <div className={`row-content${canEdit ? ' editable' : ''}`}
              onClick={() => canEdit && handleStartEdit(fieldName, idx, text, flatIdx)}
              title={canEdit ? 'Click to edit' : undefined}>
              <span className="content-value">{highlightText(text)}</span>
              {canEdit && !isEdited && editIndicator}
            </div>
            <button className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
              onClick={() => copyToClipboard(text, copyId)}>
              {copiedId === copyId ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {isEdited && <div className="modified-badge">edited — click pending approve to save</div>}
        </React.Fragment>
      );
    };

    return groups.map((group, gIdx) => {
      if (group.subtitle) {
        // Grouped under a nested-subtitle inside a rec-mini-card
        const visibleItems = group.items.filter(item => {
          if (!searchTerm.trim() || record._showAllSections) return true;
          const phrase = searchTerm.toLowerCase().trim();
          return item.text.toLowerCase().includes(phrase) || group.subtitle.toLowerCase().includes(phrase);
        });
        if (visibleItems.length === 0) return null;

        return (
          <div className="rec-mini-card" key={`g-${gIdx}`}>
            <div className="nested-subtitle">{highlightText(group.subtitle)}</div>
            {visibleItems.map(item => renderItemRow(item.text, item.flatIdx))}
          </div>
        );
      } else {
        // Ungrouped — flat rows (no rec-mini-card wrapper)
        return group.items.map(item => renderItemRow(item.text, item.flatIdx));
      }
    });
  };

  // ============== RENDER APPROVE BUTTON ==============
  const renderApproveBtn = (record, idx, sectionId) => {
    if (!sectionHasEdits(sectionId, idx) && !approvedSections[sectionId]) return null;
    return (
      <button
        className={`approve-btn${approvedSections[sectionId] ? ' approved' : ' pending'}`}
        onClick={() => handleApprove(record, idx, sectionId)}
        disabled={approving}
      >
        {approving ? 'Approving...' : approvedSections[sectionId] ? 'Approved' : 'Pending Approve'}
      </button>
    );
  };

  // ============== SECTION HEADER ==============
  const renderSectionHeader = (title, copyId, copyFn, record, idx, sectionId) => (
    <div className="section-header">
      <h3 className="section-title">{highlightText(title)}</h3>
      <div className="header-right-actions">
        <button
          className={`copy-btn ${copiedSectionId === copyId ? 'copied' : ''}`}
          onClick={copyFn}
        >
          {copiedSectionId === copyId ? 'Copied!' : 'Copy Section'}
        </button>
        {renderApproveBtn(record, idx, sectionId)}
      </div>
    </div>
  );

  // ========== COPY TEXT HELPER: formats grouped text ==========
  const formatGroupedText = (text) => {
    const sentences = splitItemsAnd(text);
    const groups = groupBySubtitles(sentences);
    const lines = [];
    for (const group of groups) {
      if (group.subtitle) {
        lines.push(`${group.subtitle}:`);
        group.items.forEach((item, i) => lines.push(`  ${i + 1}. ${item.text}`));
      } else {
        group.items.forEach((item, i) => lines.push(`${i + 1}. ${item.text}`));
      }
    }
    return lines;
  };

  // ========== GET ALL RECORD TEXT (Copy All) ==========
  const getAllRecordText = useCallback((record, idx) => {
    const lines = [];
    lines.push(`ASSESSMENT PLAN ${idx + 1}`);
    lines.push('═══════════════════════════════════════');
    const recordDate = getRecordDate(record);
    if (recordDate || record.provider || record.facility) {
      lines.push('', 'GENERAL INFORMATION', '───────────────────────────────────────');
      if (recordDate) lines.push(`Date: ${formatDate(recordDate)}`);
      if (record.provider) lines.push(`Provider: ${record.provider}`);
      if (record.facility) lines.push(`Facility: ${record.facility}`);
    }
    if (record.chiefComplaint) {
      lines.push('', 'CHIEF COMPLAINT', '───────────────────────────────────────');
      lines.push(...formatGroupedText(record.chiefComplaint));
    }
    if (record.assessment) {
      lines.push('', 'ASSESSMENT', '───────────────────────────────────────');
      lines.push(...formatGroupedText(record.assessment));
    }
    if (record.diagnoses?.length > 0) {
      lines.push('', 'DIAGNOSES', '───────────────────────────────────────');
      record.diagnoses.forEach((d, i) => lines.push(`${i + 1}. ${d}`));
    }
    if (record.plan) {
      lines.push('', 'PLAN', '───────────────────────────────────────');
      lines.push(...formatGroupedText(record.plan));
    }
    if (record.medications?.length > 0) {
      lines.push('', 'MEDICATIONS', '───────────────────────────────────────');
      record.medications.forEach((m, i) => lines.push(`${i + 1}. ${m}`));
    }
    if (record.procedures?.length > 0) {
      lines.push('', 'PROCEDURES', '───────────────────────────────────────');
      record.procedures.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
    }
    if (record.referrals?.length > 0) {
      lines.push('', 'REFERRALS', '───────────────────────────────────────');
      record.referrals.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
    }
    if (record.testing?.length > 0) {
      lines.push('', 'TESTING', '───────────────────────────────────────');
      record.testing.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
    }
    if (record.patientEducation) {
      lines.push('', 'PATIENT EDUCATION', '───────────────────────────────────────');
      lines.push(...formatGroupedText(record.patientEducation));
    }
    if (record.followUp) {
      lines.push('', 'FOLLOW-UP', '───────────────────────────────────────');
      lines.push(...formatGroupedText(record.followUp));
    }
    if (record.notes) {
      lines.push('', 'NOTES', '───────────────────────────────────────');
      lines.push(...formatGroupedText(record.notes));
    }
    return lines.join('\n');
  }, []);

  // ========== RENDER ==========
  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <div className="assessment-plans-document">
        <div className="no-data">No assessment plans data available</div>
      </div>
    );
  }

  return (
    <div className="assessment-plans-document">
      {/* ========== DOCUMENT HEADER ========== */}
      <div className="document-header">
        <h1 className="document-title">Assessment Plans</h1>
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
            key={JSON.stringify(pdfData).length}
            document={<AssessmentPlansPDFTemplate document={pdfData} />}
            fileName="assessment-plans.pdf"
            className="pdf-btn"
          >
            {({ loading, error }) => {
              if (error) console.error('PDF Error:', error);
              return loading ? 'Preparing...' : 'Export PDF';
            }}
          </PDFDownloadLink>
        </div>
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search assessment plans..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>
          )}
        </div>
      </div>

      {/* ========== RECORDS ========== */}
      <div className="records-container">
        {filteredRecords.length === 0 ? (
          <div className="no-results">No records match your search.</div>
        ) : (
          filteredRecords.map((record, idx) => {
            const recordId = record._id?.$oid || record._id || `record-${idx}`;
            const recordDate = getFieldValue(record, 'date', idx) || getRecordDate(record);
            const rw = { ...record, _showAllSections: record._showAllSections };
            const isSearching = searchTerm.trim().length > 0;

            // Level 3: Section title matches (IIFE pattern)
            const sectionMatch = (title) => (() => {
              if (!isSearching || rw._showAllSections) return true;
              return shouldShowRow(rw, title);
            })();

            const generalInfoMatches = sectionMatch('General Information');
            const chiefComplaintMatches = sectionMatch('Chief Complaint');
            const assessmentMatches = sectionMatch('Assessment');
            const diagnosesMatches = sectionMatch('Diagnoses');
            const planMatches = sectionMatch('Plan');
            const medicationsMatches = sectionMatch('Medications');
            const proceduresMatches = sectionMatch('Procedures');
            const referralsMatches = sectionMatch('Referrals');
            const testingMatches = sectionMatch('Testing');
            const patientEducationMatches = sectionMatch('Patient Education');
            const followUpMatches = sectionMatch('Follow-Up');
            const notesMatches = sectionMatch('Notes');

            // Helper: should show a text section (title match OR any sentence matches)
            const shouldShowTextSection = (titleMatches, fieldValue) => {
              if (!isSearching || rw._showAllSections) return true;
              if (titleMatches) return true;
              if (!fieldValue) return false;
              return shouldShowRow(rw, fieldValue);
            };

            return (
              <div key={recordId} className="assessment-plans-record">
                {/* Record Header */}
                <div className="record-header">
                  <div className="header-top-row">
                    {recordDate && <span className="date-badge">{formatDate(recordDate)}</span>}
                  </div>
                  <h2 className="record-title">{highlightText(`Assessment Plan ${idx + 1}`)}</h2>
                </div>

                {/* ========== GENERAL INFORMATION ========== */}
                {(recordDate || record.provider || record.facility) && (() => {
                  const showDate = recordDate && (generalInfoMatches || shouldShowRow(rw, 'Date', formatDate(recordDate)));
                  const showProvider = record.provider && (generalInfoMatches || shouldShowRow(rw, 'Provider', record.provider));
                  const showFacility = record.facility && (generalInfoMatches || shouldShowRow(rw, 'Facility', record.facility));
                  if (!showDate && !showProvider && !showFacility) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        {renderSectionHeader('General Information', `${recordId}-general`, () => {
                          const r = pdfData[idx] || record;
                          const lines = ['GENERAL INFORMATION', '═══════════════════════════════════════'];
                          if (recordDate) lines.push(`Date: ${formatDate(recordDate)}`);
                          if (r.provider) lines.push(`Provider: ${r.provider}`);
                          if (r.facility) lines.push(`Facility: ${r.facility}`);
                          copySectionToClipboard(lines.join('\n'), `${recordId}-general`);
                        }, record, idx, 'general')}

                        {showDate && renderDateField(record, idx, `${recordId}-date`)}

                        {showProvider && renderEditableField(record, 'provider', 'Provider', idx, 'general', `${recordId}-provider`)}

                        {showFacility && (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText('Facility')}</div>
                            <div className="numbered-row">
                              <div className="row-content">
                                <span className="content-value">{highlightText(record.facility)}</span>
                              </div>
                              <button className={`copy-btn ${copiedId === `${recordId}-facility` ? 'copied' : ''}`}
                                onClick={() => copyToClipboard(record.facility, `${recordId}-facility`)}>
                                {copiedId === `${recordId}-facility` ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* ========== CHIEF COMPLAINT — sentence rows, NO duplicate subtitle ========== */}
                {shouldShowTextSection(chiefComplaintMatches, record.chiefComplaint) && record.chiefComplaint && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Chief Complaint', `${recordId}-chief`, () => {
                        const r = pdfData[idx] || record;
                        const lines = ['CHIEF COMPLAINT', '═══════════════════════════════════════'];
                        lines.push(...formatGroupedText(getFieldValue(r, 'chiefComplaint', idx) || r.chiefComplaint));
                        copySectionToClipboard(lines.join('\n'), `${recordId}-chief`);
                      }, record, idx, 'chief')}
                      {renderSentenceRows(record, 'chiefComplaint', idx, 'chief', recordId)}
                    </div>
                  </div>
                )}

                {/* ========== ASSESSMENT — sentence rows ========== */}
                {shouldShowTextSection(assessmentMatches, record.assessment) && record.assessment && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Assessment', `${recordId}-assessment`, () => {
                        const r = pdfData[idx] || record;
                        const lines = ['ASSESSMENT', '═══════════════════════════════════════'];
                        lines.push(...formatGroupedText(getFieldValue(r, 'assessment', idx) || r.assessment));
                        copySectionToClipboard(lines.join('\n'), `${recordId}-assessment`);
                      }, record, idx, 'assessment')}
                      {renderSentenceRows(record, 'assessment', idx, 'assessment', recordId)}
                    </div>
                  </div>
                )}

                {/* ========== DIAGNOSES — array items ========== */}
                {record.diagnoses?.length > 0 && (() => {
                  const visibleDiagnoses = record.diagnoses.filter(d =>
                    diagnosesMatches || shouldShowRow(rw, d)
                  );
                  if (visibleDiagnoses.length === 0) return null;
                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        {renderSectionHeader('Diagnoses', `${recordId}-diagnoses`, () => {
                          const r = pdfData[idx] || record;
                          const lines = ['DIAGNOSES', '═══════════════════════════════════════'];
                          (r.diagnoses || []).forEach((d, i) => lines.push(`${i + 1}. ${d}`));
                          copySectionToClipboard(lines.join('\n'), `${recordId}-diagnoses`);
                        }, record, idx, 'diagnoses')}
                        {record.diagnoses.map((diagnosis, dIdx) =>
                          renderEditableArrayItem(record, 'diagnoses', diagnosis, idx, dIdx, 'diagnoses', `${recordId}-diag-${dIdx}`)
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* ========== PLAN — sentence rows ========== */}
                {shouldShowTextSection(planMatches, record.plan) && record.plan && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Plan', `${recordId}-plan`, () => {
                        const r = pdfData[idx] || record;
                        const lines = ['PLAN', '═══════════════════════════════════════'];
                        lines.push(...formatGroupedText(getFieldValue(r, 'plan', idx) || r.plan));
                        copySectionToClipboard(lines.join('\n'), `${recordId}-plan`);
                      }, record, idx, 'plan')}
                      {renderSentenceRows(record, 'plan', idx, 'plan', recordId)}
                    </div>
                  </div>
                )}

                {/* ========== MEDICATIONS — array ========== */}
                {record.medications?.length > 0 && (() => {
                  const visible = record.medications.filter(m => medicationsMatches || shouldShowRow(rw, m));
                  if (visible.length === 0) return null;
                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        {renderSectionHeader('Medications', `${recordId}-meds`, () => {
                          const r = pdfData[idx] || record;
                          const lines = ['MEDICATIONS', '═══════════════════════════════════════'];
                          (r.medications || []).forEach((m, i) => lines.push(`${i + 1}. ${m}`));
                          copySectionToClipboard(lines.join('\n'), `${recordId}-meds`);
                        }, record, idx, 'meds')}
                        {record.medications.map((med, mIdx) =>
                          renderEditableArrayItem(record, 'medications', med, idx, mIdx, 'meds', `${recordId}-med-${mIdx}`)
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* ========== PROCEDURES — array ========== */}
                {record.procedures?.length > 0 && (() => {
                  const visible = record.procedures.filter(p => proceduresMatches || shouldShowRow(rw, p));
                  if (visible.length === 0) return null;
                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        {renderSectionHeader('Procedures', `${recordId}-procs`, () => {
                          const r = pdfData[idx] || record;
                          const lines = ['PROCEDURES', '═══════════════════════════════════════'];
                          (r.procedures || []).forEach((p, i) => lines.push(`${i + 1}. ${p}`));
                          copySectionToClipboard(lines.join('\n'), `${recordId}-procs`);
                        }, record, idx, 'procs')}
                        {record.procedures.map((proc, pIdx) =>
                          renderEditableArrayItem(record, 'procedures', proc, idx, pIdx, 'procs', `${recordId}-proc-${pIdx}`)
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* ========== REFERRALS — array ========== */}
                {record.referrals?.length > 0 && (() => {
                  const visible = record.referrals.filter(r => referralsMatches || shouldShowRow(rw, r));
                  if (visible.length === 0) return null;
                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        {renderSectionHeader('Referrals', `${recordId}-refs`, () => {
                          const r = pdfData[idx] || record;
                          const lines = ['REFERRALS', '═══════════════════════════════════════'];
                          (r.referrals || []).forEach((ref, i) => lines.push(`${i + 1}. ${ref}`));
                          copySectionToClipboard(lines.join('\n'), `${recordId}-refs`);
                        }, record, idx, 'refs')}
                        {record.referrals.map((ref, rIdx) =>
                          renderEditableArrayItem(record, 'referrals', ref, idx, rIdx, 'refs', `${recordId}-ref-${rIdx}`)
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* ========== TESTING — array ========== */}
                {record.testing?.length > 0 && (() => {
                  const visible = record.testing.filter(t => testingMatches || shouldShowRow(rw, t));
                  if (visible.length === 0) return null;
                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        {renderSectionHeader('Testing', `${recordId}-testing`, () => {
                          const r = pdfData[idx] || record;
                          const lines = ['TESTING', '═══════════════════════════════════════'];
                          (r.testing || []).forEach((t, i) => lines.push(`${i + 1}. ${t}`));
                          copySectionToClipboard(lines.join('\n'), `${recordId}-testing`);
                        }, record, idx, 'testing')}
                        {record.testing.map((test, tIdx) =>
                          renderEditableArrayItem(record, 'testing', test, idx, tIdx, 'testing', `${recordId}-test-${tIdx}`)
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* ========== PATIENT EDUCATION — sentence rows ========== */}
                {shouldShowTextSection(patientEducationMatches, record.patientEducation) && record.patientEducation && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Patient Education', `${recordId}-education`, () => {
                        const r = pdfData[idx] || record;
                        const lines = ['PATIENT EDUCATION', '═══════════════════════════════════════'];
                        lines.push(...formatGroupedText(getFieldValue(r, 'patientEducation', idx) || r.patientEducation));
                        copySectionToClipboard(lines.join('\n'), `${recordId}-education`);
                      }, record, idx, 'education')}
                      {renderSentenceRows(record, 'patientEducation', idx, 'education', recordId)}
                    </div>
                  </div>
                )}

                {/* ========== FOLLOW-UP — sentence rows ========== */}
                {shouldShowTextSection(followUpMatches, record.followUp) && record.followUp && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Follow-Up', `${recordId}-followup`, () => {
                        const r = pdfData[idx] || record;
                        const lines = ['FOLLOW-UP', '═══════════════════════════════════════'];
                        lines.push(...formatGroupedText(getFieldValue(r, 'followUp', idx) || r.followUp));
                        copySectionToClipboard(lines.join('\n'), `${recordId}-followup`);
                      }, record, idx, 'followup')}
                      {renderSentenceRows(record, 'followUp', idx, 'followup', recordId)}
                    </div>
                  </div>
                )}

                {/* ========== NOTES — sentence rows ========== */}
                {shouldShowTextSection(notesMatches, record.notes) && record.notes && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Notes', `${recordId}-notes`, () => {
                        const r = pdfData[idx] || record;
                        const lines = ['NOTES', '═══════════════════════════════════════'];
                        lines.push(...formatGroupedText(getFieldValue(r, 'notes', idx) || r.notes));
                        copySectionToClipboard(lines.join('\n'), `${recordId}-notes`);
                      }, record, idx, 'notes')}
                      {renderSentenceRows(record, 'notes', idx, 'notes', recordId)}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AssessmentPlansDocument;
