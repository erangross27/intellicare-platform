import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PulmonaryImagingDocumentPDFTemplate from '../pdf-templates/PulmonaryImagingDocumentPDFTemplate';
import './PulmonaryImagingDocument.css';
import secureApiClient from '../../../services/secureApiClient';
import SearchBar from '../components/SearchBar';

/**
 * Pulmonary Imaging Document - February 2026
 * Following February 2026 patterns:
 * - 3-prop signature ({ document, data, templateData })
 * - Per-sentence editing for findings and notes
 * - 4-level search with sectionTitleMatches
 * - Section header INSIDE mini-cards-container
 * - Provider Details as proper section (NOT badges)
 * - _originalIdx for stable record numbering
 */

// ============== HELPER FUNCTIONS ==============

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return String(dateString);
  }
};

// yyyy-mm-dd for <input type="date"> using LOCAL components (avoids UTC off-by-one)
const toInputDate = (dateString) => {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch { return ''; }
};

const hasValue = (val) => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object') return Object.keys(val).length > 0;
  return true;
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc))\.\s+/)
    .map(s => s.replace(/\.$/, '').trim())
    .filter(Boolean);
};

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'pulmonaryImagingPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

// ============== COMPONENT ==============

const PulmonaryImagingDocument = ({ document: docProp, data, templateData }) => {
  // Data unwrapping (3-prop pattern)
  const records = useMemo(() => {
    const raw = templateData || docProp || data;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (raw?.pulmonary_imaging) return raw.pulmonary_imaging;
    if (raw?.documentData) {
      const docData = raw.documentData;
      if (Array.isArray(docData)) return docData;
      if (docData?.pulmonary_imaging) return docData.pulmonary_imaging;
      return [docData];
    }
    if (typeof raw === 'object') return [raw];
    return [];
  }, [templateData, docProp, data]);

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
        const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[`${baseField}-${idx}`] = true;
        nSentences[`${baseField}-${idx}-s0`] = 'edited';
        nStatus[idx] = 'amended';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
    setStatusOverrides(prev => ({ ...nStatus, ...prev }));
  }, [records]);

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [statusOverrides, setStatusOverrides] = useState({});
  const textareaRef = useRef(null);

  // ============== EDIT INDICATOR ==============
  const editIndicator = (
    <span className="edit-indicator" title="Click to edit">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span className="edit-tag">edit</span>
    </span>
  );

  // ============== SEARCH HELPERS ==============

  // Level 4: shouldShowRow
  const shouldShowRow = useCallback((record, ...valuesToCheck) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    for (const val of valuesToCheck) {
      if (val && String(val).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm]);

  // Level 3: shouldShowSection — uses .startsWith() for title
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

  // Highlight matching text
  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || !text) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = String(text).split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i}>{part}</mark> : part
    );
  }, [searchTerm]);

  // Level 1: Document-level filtering with _originalIdx
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records.map((r, i) => ({ ...r, _originalIdx: i, _showAllSections: true }));
    const searchLower = searchTerm.toLowerCase().trim();

    // Detect record number search
    const recordNumMatch = searchLower.match(/(?:pulmonary\s+)?(?:imaging\s+)?record\s+(\d+)/);

    return records.map((r, i) => ({ ...r, _originalIdx: i })).filter((record) => {
      const origIdx = record._originalIdx;

      // Strict record number matching
      if (recordNumMatch) {
        const targetNum = parseInt(recordNumMatch[1], 10);
        if (targetNum === origIdx + 1) {
          record._showAllSections = true;
          return true;
        }
        return false;
      }

      const recordTitle = `Pulmonary Imaging Record ${origIdx + 1}`;
      const searchableText = [
        'Pulmonary Imaging',
        recordTitle,
        'Provider Details', record.date ? formatDate(record.date) : '', record.provider, record.facility, 'Status', record.status,
        'Imaging Studies', 'Chest X-Ray', record.chestXray, 'CT Chest', record.ctChest,
        'Ventilation/Perfusion', record.ventilationPerfusion, 'Pulmonary Angiography', record.pulmonaryAngiography,
        'Findings', ...(record.findings ? splitBySentence(record.findings) : []),
        'Results', record.results,
        'Assessment', record.assessment,
        'Plan', record.plan,
        'Recommendations', ...(record.recommendations || []),
        'Notes', ...(record.notes ? splitBySentence(record.notes) : []),
      ].filter(Boolean).join(' ').toLowerCase();

      const matches = searchableText.includes(searchLower);
      if (matches) {
        const titleLower = recordTitle.toLowerCase();
        if (titleLower.startsWith(searchLower) || searchLower.startsWith(titleLower) ||
            'pulmonary imaging'.startsWith(searchLower) || searchLower.startsWith('pulmonary imaging')) {
          record._showAllSections = true;
        } else {
          record._showAllSections = false;
        }
      }
      return matches;
    });
  }, [records, searchTerm]);

  // ============== COPY FUNCTIONS ==============

  const copyToClipboard = useCallback(async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, []);

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
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, arrayIndex, valueOverride, sentenceIdx) => {
    if (!record._id) return;
    const recId = (typeof record._id === 'object' && record._id.$oid) ? record._id.$oid : record._id;
    const saveValue = (valueOverride !== undefined ? valueOverride : editValue.trim());
    const fieldPart = (typeof arrayIndex === 'number') ? `${fieldName}.${arrayIndex}` : fieldName;
    const editKey = `${fieldPart}-${idx}`;
    const sectionKey = `${sectionId}-${idx}`;
    const sKey = `${fieldName}-${idx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;

    setLocalEdits(prev => ({ ...prev, [editKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [sectionKey]: true }));
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
    if (!record._id) return;
    const recId = (typeof record._id === 'object' && record._id.$oid) ? record._id.$oid : record._id;
    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements).
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayIndex = lastDot !== -1 && /^\d+$/.test(trailing);
        const payload = { field: isArrayIndex ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArrayIndex) payload.arrayIndex = parseInt(trailing, 10);
        const response = await secureApiClient.put(`/api/edit/pulmonary_imaging/${recId}/edit`, payload);
        if (!response || !response.success) throw new Error((response && response.error) || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/pulmonary_imaging/${recId}/approve`);

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
      console.error('[PulmonaryImaging] Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  const getFieldValue = useCallback((record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    return record[fieldName];
  }, [localEdits]);

  // ============== PDF DATA (merges localEdits) ==============

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((rec, idx) => {
      const merged = { ...rec };

      // Merge simple fields and dot-notation array fields
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldPart = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx !== idx) continue;

        // Dot-notation for arrays (e.g., recommendations.0)
        const dotMatch = fieldPart.match(/^(\w+)\.(\d+)$/);
        if (dotMatch) {
          const arrField = dotMatch[1];
          const arrIdx = parseInt(dotMatch[2], 10);
          if (!merged[arrField]) merged[arrField] = [];
          merged[arrField] = [...merged[arrField]];
          merged[arrField][arrIdx] = editVal;
        } else {
          merged[fieldPart] = editVal;
        }
      }

      // Pre-compute sentence arrays
      const computeSentences = (fieldName) => {
        const fullKey = `${fieldName}-${idx}`;
        // A pending (un-approved) full-field edit must NOT flow into the PDF — fall back to original.
        const hasCommittedFull = localEdits[fullKey] !== undefined && !pendingEdits[fullKey];
        const source = hasCommittedFull ? localEdits[fullKey] : (rec[fieldName] || '');
        if (!source) return null;
        const sentences = splitBySentence(source);
        if (hasCommittedFull) return sentences;
        return sentences.map((s, i) => {
          const pKey = `${fieldName}.s${i}-${idx}`;
          return (localEdits[pKey] !== undefined && !pendingEdits[pKey]) ? localEdits[pKey] : s;
        });
      };

      const findingsCommitted = localEdits[`findings-${idx}`] !== undefined && !pendingEdits[`findings-${idx}`];
      const notesCommitted = localEdits[`notes-${idx}`] !== undefined && !pendingEdits[`notes-${idx}`];
      if (rec.findings || findingsCommitted) merged._findingsSentences = computeSentences('findings');
      if (rec.notes || notesCommitted) merged._notesSentences = computeSentences('notes');

      return merged;
    });
  }, [records, localEdits, pendingEdits]);

  // ============== COPY ALL ==============

  const handleCopyAll = useCallback(() => {
    const allText = pdfData.map((record, idx) => {
      const lines = [];
      lines.push(`PULMONARY IMAGING RECORD ${idx + 1}`);
      lines.push('');

      // Provider Details
      if (record.date || record.provider || record.facility || hasValue(record.status)) {
        lines.push('PROVIDER DETAILS');
        if (record.date) lines.push(`Date: ${formatDate(record.date)}`);
        if (record.provider) lines.push(`Provider: ${record.provider}`);
        if (record.facility) lines.push(`Facility: ${record.facility}`);
        if (hasValue(record.status)) lines.push(`Status: ${record.status}`);
        lines.push('');
      }

      // Imaging Studies
      if (record.chestXray || record.ctChest || record.ventilationPerfusion || record.pulmonaryAngiography) {
        lines.push('IMAGING STUDIES');
        if (record.chestXray) lines.push(`Chest X-Ray: ${record.chestXray}`);
        if (record.ctChest) lines.push(`CT Chest: ${record.ctChest}`);
        if (record.ventilationPerfusion) lines.push(`Ventilation/Perfusion: ${record.ventilationPerfusion}`);
        if (record.pulmonaryAngiography) lines.push(`Pulmonary Angiography: ${record.pulmonaryAngiography}`);
        lines.push('');
      }

      // Findings
      const findingsSentences = record._findingsSentences || splitBySentence(record.findings);
      if (findingsSentences.length > 0) {
        lines.push('FINDINGS');
        findingsSentences.forEach((s, i) => {
          lines.push(`${i + 1}. ${s}${s.endsWith('.') ? '' : '.'}`);
        });
        lines.push('');
      }

      // Results
      if (hasValue(record.results)) {
        lines.push('RESULTS');
        lines.push(record.results);
        lines.push('');
      }

      // Assessment
      if (hasValue(record.assessment)) {
        lines.push('ASSESSMENT');
        lines.push(record.assessment);
        lines.push('');
      }

      // Plan
      if (hasValue(record.plan)) {
        lines.push('PLAN');
        lines.push(record.plan);
        lines.push('');
      }

      // Recommendations
      const recs = Array.isArray(record.recommendations) ? record.recommendations : [];
      if (recs.length > 0) {
        lines.push('RECOMMENDATIONS');
        recs.forEach((r, i) => {
          const recText = typeof r === 'object' ? (r.recommendation || r.__simpleType || '') : r;
          lines.push(`${i + 1}. ${recText}`);
        });
        lines.push('');
      }

      // Notes
      const notesSentences = record._notesSentences || splitBySentence(record.notes);
      if (notesSentences.length > 0) {
        lines.push('NOTES');
        notesSentences.forEach((s, i) => {
          lines.push(`${i + 1}. ${s}${s.endsWith('.') ? '' : '.'}`);
        });
        lines.push('');
      }

      return lines.join('\n');
    }).join('\n\n');

    copyToClipboard(allText, 'all');
  }, [pdfData, copyToClipboard]);

  // ============== RENDER HELPERS ==============

  // Render editable simple field (single value, not per-sentence)
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
        <>
          <div className={`numbered-row${isFieldEdited ? ' modified' : ''}`}>
            <div
              className={`row-content${canEdit ? ' editable' : ''}`}
              onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue)}
              title={canEdit ? 'Click to edit' : undefined}
            >
              <span className="content-value">{highlightText(displayValue)}</span>
              {canEdit && editIndicator}
            </div>
            <button
              className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
              onClick={() => copyToClipboard(displayValue, copyId)}
            >
              {copiedId === copyId ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {isFieldEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
        </>
      </div>
    );
  };

  // Render editable array item (recommendations)
  const renderEditableArrayItem = (record, idx, fieldName, arrayIndex, itemText, sectionId) => {
    const editKey = `${fieldName}-${idx}-s${arrayIndex}`;
    const isEditing = editingField === editKey;
    const canEdit = !!record._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const sentenceState = sectionWasEdited ? editedSentences[editKey] : undefined;
    const recordStatus = statusOverrides[idx] || 'active';
    const isFieldEdited = sentenceState === 'edited' && recordStatus !== 'approved';

    // Get display value from localEdits or original
    const editLocalKey = `${fieldName}.${arrayIndex}-${idx}`;
    const displayValue = localEdits[editLocalKey] !== undefined ? localEdits[editLocalKey] : itemText;

    if (isEditing) {
      return (
        <div className="numbered-row edit-row" key={`${fieldName}-${arrayIndex}`}>
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
      <React.Fragment key={`${fieldName}-${arrayIndex}`}>
        <div className={`numbered-row${isFieldEdited ? ' modified' : ''}`}>
          <div
            className={`row-content${canEdit ? ' editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue, arrayIndex)}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && editIndicator}
          </div>
          <button
            className={`copy-btn ${copiedId === `${fieldName}-${idx}-${arrayIndex}` ? 'copied' : ''}`}
            onClick={() => copyToClipboard(displayValue, `${fieldName}-${idx}-${arrayIndex}`)}
          >
            {copiedId === `${fieldName}-${idx}-${arrayIndex}` ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </React.Fragment>
    );
  };

  // Render per-sentence editable rows (findings, notes)
  const renderEditableSentenceRows = (record, idx, fieldName, sectionId, sectionMatches, recordWithFlag) => {
    const canEdit = !!record._id;
    const splitter = splitBySentence;

    // Use full-field edit if available (reflects new sentence boundaries immediately)
    const fullEditKey = `${fieldName}-${idx}`;
    const hasFullEdit = localEdits[fullEditKey] !== undefined;
    const sourceText = hasFullEdit ? localEdits[fullEditKey] : (record[fieldName] || '');
    const currentSentences = splitter(sourceText);

    if (currentSentences.length === 0) return null;

    return currentSentences
      .map((sentence, origIdx) => {
        // Only apply per-sentence overlays when splitting from ORIGINAL (no full edit)
        let displaySentence = sentence;
        if (!hasFullEdit) {
          const perSentenceKey = `${fieldName}.s${origIdx}-${idx}`;
          displaySentence = localEdits[perSentenceKey] !== undefined ? localEdits[perSentenceKey] : sentence;
        }
        return { sentence: displaySentence, origIdx };
      })
      .filter(({ sentence }) => sectionMatches || shouldShowRow(recordWithFlag, sentence))
      .map(({ sentence, origIdx: sIdx }) => {
        const editKey = `${fieldName}-${idx}-s${sIdx}`;
        const isEditing = editingField === editKey;
        const sentenceState = editedSentences[editKey];
        const isEdited = sentenceState === 'edited';
        const isAdded = sentenceState === 'added';
        const recordStatus = statusOverrides[idx] || 'active';
        const showBadge = (isEdited || isAdded) && recordStatus !== 'approved';

        if (isEditing) {
          return (
            <div key={`${fieldName}-s${sIdx}`} className="numbered-row edit-row">
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
                    onClick={() => {
                      // Auto-add period, reconstruct full text
                      let editedSentence = editValue.trim();
                      if (editedSentence && !/[.!?]$/.test(editedSentence)) {
                        editedSentence += '.';
                      }

                      // Reconstruct from current source
                      const allCurrent = splitter(sourceText);
                      const updated = allCurrent.map((s, i) => {
                        if (i === sIdx) return editedSentence;
                        if (!hasFullEdit) {
                          const pKey = `${fieldName}.s${i}-${idx}`;
                          return localEdits[pKey] !== undefined ? localEdits[pKey] : s;
                        }
                        return s;
                      });
                      const fullText = updated.join(' ');

                      // Detect added sentences
                      const newSentences = splitter(fullText);
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

                      handleSaveField(record, fieldName, idx, sectionId, undefined, fullText, sIdx);
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
          );
        }

        return (
          <React.Fragment key={`${fieldName}-s${sIdx}`}>
            <div className={`numbered-row${isEdited && showBadge ? ' modified' : ''}${isAdded && showBadge ? ' added' : ''}`}>
              <div
                className={`row-content${canEdit ? ' editable' : ''}`}
                onClick={() => {
                  if (!canEdit) return;
                  const editText = sentence.replace(/[.!?]+$/, '').trim();
                  handleStartEdit(fieldName, idx, editText, sIdx);
                }}
                title={canEdit ? 'Click to edit' : undefined}
              >
                <span className="content-value">{highlightText(sentence)}</span>
                {canEdit && editIndicator}
              </div>
              <button
                className={`copy-btn ${copiedId === `${fieldName}-${idx}-s${sIdx}` ? 'copied' : ''}`}
                onClick={() => copyToClipboard(sentence, `${fieldName}-${idx}-s${sIdx}`)}
              >
                {copiedId === `${fieldName}-${idx}-s${sIdx}` ? 'Copied!' : 'Copy'}
              </button>
            </div>
            {isEdited && showBadge && <div className="modified-badge">edited - click Pending Approve to save</div>}
            {isAdded && showBadge && <div className="added-badge">added - click Pending Approve to save</div>}
          </React.Fragment>
        );
      });
  };

  // ============== RENDER ==============

  if (!records || records.length === 0) {
    return (
      <div className="pulmonary-imaging-document">
        <div className="empty-state">
          <p className="empty-text">No pulmonary imaging data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pulmonary-imaging-document">
      {/* Document Header */}
      <div className="document-header">
        <h2 className="document-title">Pulmonary Imaging</h2>
        <div className="header-actions">
          <button
            className={`copy-btn ${copiedId === 'all' ? 'copied' : ''}`}
            onClick={handleCopyAll}
          >
            {copiedId === 'all' ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<PulmonaryImagingDocumentPDFTemplate document={pdfData} />}
            fileName={`Pulmonary_Imaging_${new Date().toISOString().split('T')[0]}.pdf`}
            className="pdf-btn"
          >
            {({ loading }) => (loading ? 'Preparing...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>
        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          placeholder="Search pulmonary imaging..."
        />
      </div>

      {/* Search Results Count */}
      {searchTerm && (
        <div className="search-results-count">
          Showing {filteredRecords.length} of {records.length} records
        </div>
      )}

      {/* Empty Search State */}
      {filteredRecords.length === 0 && searchTerm && (
        <div className="empty-state">
          <p className="empty-text">No pulmonary imaging records found for "{searchTerm}"</p>
          <p className="empty-subtext">Try a different search term</p>
        </div>
      )}

      {/* Records */}
      <div className="records-container">
        {filteredRecords.map((record) => {
          const idx = record._originalIdx;
          const isSearching = searchTerm.trim().length > 0;
          const canEdit = !!record._id;
          const recordStatus = statusOverrides[idx] || 'active';

          // ============== SECTION VISIBILITY ==============

          // Provider Details
          const providerFields = [
            ['Date', record.date ? formatDate(record.date) : null],
            ['Provider', record.provider || null],
            ['Facility', record.facility || null],
            ['Status', hasValue(record.status) ? String(record.status) : null],
          ].filter(([, val]) => val !== null);

          const showProviderDetails = providerFields.length > 0 && shouldShowSection(record, 'Provider Details',
            ...providerFields.map(([label, val]) => `${label}: ${val}`)
          );

          // Imaging Studies
          const studyFields = [
            ['Chest X-Ray', record.chestXray],
            ['CT Chest', record.ctChest],
            ['Ventilation/Perfusion', record.ventilationPerfusion],
            ['Pulmonary Angiography', record.pulmonaryAngiography],
          ].filter(([, val]) => hasValue(val));

          const showImagingStudies = studyFields.length > 0 && shouldShowSection(record, 'Imaging Studies',
            ...studyFields.map(([label, val]) => `${label}: ${val}`)
          );

          // Findings (per-sentence)
          const findingsVal = getFieldValue(record, 'findings', idx);
          const showFindings = hasValue(findingsVal) && shouldShowSection(record, 'Findings',
            ...(findingsVal ? splitBySentence(findingsVal) : [])
          );

          // Results
          const resultsVal = getFieldValue(record, 'results', idx);
          const showResults = hasValue(resultsVal) && shouldShowSection(record, 'Results', resultsVal);

          // Assessment
          const assessmentVal = getFieldValue(record, 'assessment', idx);
          const showAssessment = hasValue(assessmentVal) && shouldShowSection(record, 'Assessment', assessmentVal);

          // Plan
          const planVal = getFieldValue(record, 'plan', idx);
          const showPlan = hasValue(planVal) && shouldShowSection(record, 'Plan', planVal);

          // Recommendations
          const recsArr = Array.isArray(record.recommendations) ? record.recommendations.filter(r => hasValue(r)) : [];
          const showRecommendations = recsArr.length > 0 && shouldShowSection(record, 'Recommendations', ...recsArr);

          // Notes (per-sentence)
          const notesVal = getFieldValue(record, 'notes', idx);
          const showNotes = hasValue(notesVal) && shouldShowSection(record, 'Notes',
            ...(notesVal ? splitBySentence(notesVal) : [])
          );

          return (
            <div key={idx} className="record-card">
              {/* Record Header */}
              <div className="record-header">
                <h3 className="record-title">{highlightText(`Pulmonary Imaging Record ${idx + 1}`)}</h3>
              </div>

              {/* Record Body */}
              <div className="record-body">

                {/* SECTION 1: Provider Details */}
                {showProviderDetails && (() => {
                  const searchLower = searchTerm.toLowerCase().trim();
                  const sectionTitleMatches = !isSearching || record._showAllSections || (searchLower && ('provider details'.startsWith(searchLower) || searchLower.startsWith('provider details')));

                  const visibleFields = providerFields.filter(([label, val]) => {
                    if (!isSearching || record._showAllSections || sectionTitleMatches) return true;
                    return shouldShowRow(record, label, val, `${label}: ${val}`);
                  });
                  if (visibleFields.length === 0) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Provider Details')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedId === `provider-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const text = `PROVIDER DETAILS\n${providerFields.map(([l, v]) => `${l}: ${v}`).join('\n')}`;
                                copyToClipboard(text, `provider-${idx}`);
                              }}
                            >
                              {copiedId === `provider-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {canEdit && Object.keys(editedFields).some(k => k.startsWith('provider-') && k.endsWith(`-${idx}`)) && recordStatus !== 'approved' && (
                              <button className="approve-btn pending" onClick={() => handleApprove(record, idx)} disabled={approving}>
                                {approving ? 'Approving...' : 'Pending Approve'}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="rec-mini-card">
                          {visibleFields.map(([label, val], i) => {
                            // Status is NOT editable (report metadata)
                            if (label === 'Status') {
                              return (
                                <React.Fragment key={label}>
                                  <div className="nested-subtitle">{highlightText(label)}</div>
                                  <div className="numbered-row" style={{ marginBottom: i < visibleFields.length - 1 ? '8px' : '0' }}>
                                    <div className="row-content">
                                      <span className="content-value">{highlightText(val)}</span>
                                    </div>
                                    <button
                                      className={`copy-btn ${copiedId === `${label.toLowerCase()}-${idx}` ? 'copied' : ''}`}
                                      onClick={() => copyToClipboard(`${label}: ${val}`, `${label.toLowerCase()}-${idx}`)}
                                    >
                                      {copiedId === `${label.toLowerCase()}-${idx}` ? 'Copied!' : 'Copy'}
                                    </button>
                                  </div>
                                </React.Fragment>
                              );
                            }

                            // Date — editable via date picker
                            if (label === 'Date') {
                              const dateRaw = getFieldValue(record, 'date', idx) || record.date;
                              const editKeyD = `date-${idx}-s0`;
                              const isEditingDate = editingField === editKeyD;
                              const dateState = editedFields[`provider-${idx}`] ? editedSentences[`date-${idx}-s0`] : undefined;
                              const isDateEdited = dateState === 'edited' && recordStatus !== 'approved';
                              if (isEditingDate) {
                                return (
                                  <React.Fragment key={label}>
                                    <div className="nested-subtitle">{highlightText(label)}</div>
                                    <div className="numbered-row edit-row" style={{ marginBottom: i < visibleFields.length - 1 ? '8px' : '0' }}>
                                      <div className="edit-field-container">
                                        <input
                                          type="date"
                                          className="edit-date-input"
                                          value={editValue}
                                          onChange={(e) => setEditValue(e.target.value)}
                                          disabled={saving}
                                          ref={(el) => { if (el) { try { el.showPicker(); } catch { /* showPicker unsupported */ } } }}
                                        />
                                        <div className="edit-actions">
                                          <button
                                            className="edit-save-btn"
                                            onClick={() => handleSaveField(record, 'date', idx, 'provider', null, editValue ? new Date(`${editValue}T12:00:00`).toISOString() : '')}
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
                                  </React.Fragment>
                                );
                              }
                              return (
                                <React.Fragment key={label}>
                                  <div className="nested-subtitle">{highlightText(label)}</div>
                                  <div className={`numbered-row${isDateEdited ? ' modified' : ''}`} style={{ marginBottom: i < visibleFields.length - 1 ? '8px' : '0' }}>
                                    <div
                                      className={`row-content${canEdit ? ' editable' : ''}`}
                                      onClick={() => canEdit && handleStartEdit('date', idx, toInputDate(dateRaw))}
                                      title={canEdit ? 'Click to edit' : undefined}
                                    >
                                      <span className="content-value">{highlightText(formatDate(dateRaw))}</span>
                                      {canEdit && editIndicator}
                                    </div>
                                    <button
                                      className={`copy-btn ${copiedId === `date-${idx}` ? 'copied' : ''}`}
                                      onClick={() => copyToClipboard(`Date: ${formatDate(dateRaw)}`, `date-${idx}`)}
                                    >
                                      {copiedId === `date-${idx}` ? 'Copied!' : 'Copy'}
                                    </button>
                                  </div>
                                  {isDateEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
                                </React.Fragment>
                              );
                            }

                            // Provider and Facility are editable
                            const fieldName = label.toLowerCase();
                            const editKeyS = `${fieldName}-${idx}-s0`;
                            const isEditing = editingField === editKeyS;
                            const currentVal = getFieldValue(record, fieldName, idx) || val;
                            const sentenceState = editedFields[`provider-${idx}`] ? editedSentences[`${fieldName}-${idx}-s0`] : undefined;
                            const isFieldEdited = sentenceState === 'edited' && recordStatus !== 'approved';

                            if (isEditing) {
                              return (
                                <React.Fragment key={label}>
                                  <div className="nested-subtitle">{highlightText(label)}</div>
                                  <div className="numbered-row edit-row" style={{ marginBottom: i < visibleFields.length - 1 ? '8px' : '0' }}>
                                    <div className="edit-field-container">
                                      <textarea
                                        ref={textareaRef}
                                        className="edit-textarea"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        rows={2}
                                        disabled={saving}
                                      />
                                      <div className="edit-actions">
                                        <button
                                          className="edit-save-btn"
                                          onClick={() => handleSaveField(record, fieldName, idx, 'provider')}
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
                                </React.Fragment>
                              );
                            }

                            return (
                              <React.Fragment key={label}>
                                <div className="nested-subtitle">{highlightText(label)}</div>
                                <div className={`numbered-row${isFieldEdited ? ' modified' : ''}`} style={{ marginBottom: i < visibleFields.length - 1 ? '8px' : '0' }}>
                                  <div
                                    className={`row-content${canEdit ? ' editable' : ''}`}
                                    onClick={() => canEdit && handleStartEdit(fieldName, idx, currentVal)}
                                    title={canEdit ? 'Click to edit' : undefined}
                                  >
                                    <span className="content-value">{highlightText(currentVal)}</span>
                                    {canEdit && editIndicator}
                                  </div>
                                  <button
                                    className={`copy-btn ${copiedId === `${fieldName}-${idx}` ? 'copied' : ''}`}
                                    onClick={() => copyToClipboard(`${label}: ${currentVal}`, `${fieldName}-${idx}`)}
                                  >
                                    {copiedId === `${fieldName}-${idx}` ? 'Copied!' : 'Copy'}
                                  </button>
                                </div>
                                {isFieldEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* SECTION 2: Imaging Studies */}
                {showImagingStudies && (() => {
                  const searchLower = searchTerm.toLowerCase().trim();
                  const sectionTitleMatches = !isSearching || record._showAllSections || (searchLower && ('imaging studies'.startsWith(searchLower) || searchLower.startsWith('imaging studies')));

                  const visibleStudies = studyFields.filter(([label, val]) => {
                    if (!isSearching || record._showAllSections || sectionTitleMatches) return true;
                    return shouldShowRow(record, label, val, `${label}: ${val}`);
                  });
                  if (visibleStudies.length === 0) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Imaging Studies')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedId === `studies-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const text = `IMAGING STUDIES\n${studyFields.map(([l, v]) => `${l}: ${v}`).join('\n')}`;
                                copyToClipboard(text, `studies-${idx}`);
                              }}
                            >
                              {copiedId === `studies-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {canEdit && Object.keys(editedFields).some(k => k.startsWith('studies-') && k.endsWith(`-${idx}`)) && recordStatus !== 'approved' && (
                              <button className="approve-btn pending" onClick={() => handleApprove(record, idx)} disabled={approving}>
                                {approving ? 'Approving...' : 'Pending Approve'}
                              </button>
                            )}
                          </div>
                        </div>
                        {visibleStudies.map(([label, val]) => {
                          // Map label to field name
                          const fieldMap = {
                            'Chest X-Ray': 'chestXray',
                            'CT Chest': 'ctChest',
                            'Ventilation/Perfusion': 'ventilationPerfusion',
                            'Pulmonary Angiography': 'pulmonaryAngiography',
                          };
                          const fieldName = fieldMap[label];
                          const displayVal = getFieldValue(record, fieldName, idx) || val;

                          return renderEditableField(record, idx, fieldName, label, displayVal, 'studies', `${fieldName}-val-${idx}`);
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* SECTION 3: Findings (per-sentence) */}
                {showFindings && (() => {
                  const searchLower = searchTerm.toLowerCase().trim();
                  const sectionTitleMatches = !isSearching || record._showAllSections || (searchLower && ('findings'.startsWith(searchLower) || searchLower.startsWith('findings')));

                  const sentenceRows = renderEditableSentenceRows(record, idx, 'findings', 'findings', sectionTitleMatches, record);
                  if (!sentenceRows || sentenceRows.length === 0) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Findings')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedId === `findings-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const fullEditKey = `findings-${idx}`;
                                const source = localEdits[fullEditKey] !== undefined ? localEdits[fullEditKey] : (record.findings || '');
                                const sentences = splitBySentence(source);
                                const displaySentences = localEdits[fullEditKey] !== undefined
                                  ? sentences
                                  : sentences.map((s, i) => {
                                      const pKey = `findings.s${i}-${idx}`;
                                      return localEdits[pKey] !== undefined ? localEdits[pKey] : s;
                                    });
                                const text = `FINDINGS\n${displaySentences.map((s, i) => `${i + 1}. ${s}${s.endsWith('.') ? '' : '.'}`).join('\n')}`;
                                copyToClipboard(text, `findings-${idx}`);
                              }}
                            >
                              {copiedId === `findings-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {canEdit && Object.keys(editedFields).some(k => k.startsWith('findings-') && k.endsWith(`-${idx}`)) && recordStatus !== 'approved' && (
                              <button className="approve-btn pending" onClick={() => handleApprove(record, idx)} disabled={approving}>
                                {approving ? 'Approving...' : 'Pending Approve'}
                              </button>
                            )}
                          </div>
                        </div>
                        {sentenceRows}
                      </div>
                    </div>
                  );
                })()}

                {/* SECTION 4: Results (simple text) */}
                {showResults && (() => {
                  const searchLower = searchTerm.toLowerCase().trim();
                  const sectionTitleMatches = !isSearching || record._showAllSections || (searchLower && ('results'.startsWith(searchLower) || searchLower.startsWith('results')));

                  if (!sectionTitleMatches && !shouldShowRow(record, resultsVal)) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Results')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedId === `results-${idx}` ? 'copied' : ''}`}
                              onClick={() => copyToClipboard(`RESULTS\n${resultsVal}`, `results-${idx}`)}
                            >
                              {copiedId === `results-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {canEdit && Object.keys(editedFields).some(k => k.startsWith('results-') && k.endsWith(`-${idx}`)) && recordStatus !== 'approved' && (
                              <button className="approve-btn pending" onClick={() => handleApprove(record, idx)} disabled={approving}>
                                {approving ? 'Approving...' : 'Pending Approve'}
                              </button>
                            )}
                          </div>
                        </div>
                        {renderEditableField(record, idx, 'results', null, resultsVal, 'results', `results-val-${idx}`)}
                      </div>
                    </div>
                  );
                })()}

                {/* SECTION 5: Assessment (simple text) */}
                {showAssessment && (() => {
                  const searchLower = searchTerm.toLowerCase().trim();
                  const sectionTitleMatches = !isSearching || record._showAllSections || (searchLower && ('assessment'.startsWith(searchLower) || searchLower.startsWith('assessment')));

                  if (!sectionTitleMatches && !shouldShowRow(record, assessmentVal)) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Assessment')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedId === `assessment-${idx}` ? 'copied' : ''}`}
                              onClick={() => copyToClipboard(`ASSESSMENT\n${assessmentVal}`, `assessment-${idx}`)}
                            >
                              {copiedId === `assessment-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {canEdit && Object.keys(editedFields).some(k => k.startsWith('assessment-') && k.endsWith(`-${idx}`)) && recordStatus !== 'approved' && (
                              <button className="approve-btn pending" onClick={() => handleApprove(record, idx)} disabled={approving}>
                                {approving ? 'Approving...' : 'Pending Approve'}
                              </button>
                            )}
                          </div>
                        </div>
                        {renderEditableField(record, idx, 'assessment', null, assessmentVal, 'assessment', `assessment-val-${idx}`)}
                      </div>
                    </div>
                  );
                })()}

                {/* SECTION 6: Plan (simple text) */}
                {showPlan && (() => {
                  const searchLower = searchTerm.toLowerCase().trim();
                  const sectionTitleMatches = !isSearching || record._showAllSections || (searchLower && ('plan'.startsWith(searchLower) || searchLower.startsWith('plan')));

                  if (!sectionTitleMatches && !shouldShowRow(record, planVal)) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Plan')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedId === `plan-${idx}` ? 'copied' : ''}`}
                              onClick={() => copyToClipboard(`PLAN\n${planVal}`, `plan-${idx}`)}
                            >
                              {copiedId === `plan-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {canEdit && Object.keys(editedFields).some(k => k.startsWith('plan-') && k.endsWith(`-${idx}`)) && recordStatus !== 'approved' && (
                              <button className="approve-btn pending" onClick={() => handleApprove(record, idx)} disabled={approving}>
                                {approving ? 'Approving...' : 'Pending Approve'}
                              </button>
                            )}
                          </div>
                        </div>
                        {renderEditableField(record, idx, 'plan', null, planVal, 'plan', `plan-val-${idx}`)}
                      </div>
                    </div>
                  );
                })()}

                {/* SECTION 7: Recommendations (array items) */}
                {showRecommendations && (() => {
                  const searchLower = searchTerm.toLowerCase().trim();
                  const sectionTitleMatches = !isSearching || record._showAllSections || (searchLower && ('recommendations'.startsWith(searchLower) || searchLower.startsWith('recommendations')));

                  const visibleRecs = recsArr.filter(rec => {
                    const recText = typeof rec === 'object' ? (rec.recommendation || rec.__simpleType || '') : rec;
                    return sectionTitleMatches || shouldShowRow(record, recText);
                  });
                  if (visibleRecs.length === 0) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Recommendations')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedId === `recs-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const text = `RECOMMENDATIONS\n${recsArr.map((r, i) => {
                                  const t = typeof r === 'object' ? (r.recommendation || r.__simpleType || '') : r;
                                  return `${i + 1}. ${t}`;
                                }).join('\n')}`;
                                copyToClipboard(text, `recs-${idx}`);
                              }}
                            >
                              {copiedId === `recs-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {canEdit && Object.keys(editedFields).some(k => k.startsWith('recommendations-') && k.endsWith(`-${idx}`)) && recordStatus !== 'approved' && (
                              <button className="approve-btn pending" onClick={() => handleApprove(record, idx)} disabled={approving}>
                                {approving ? 'Approving...' : 'Pending Approve'}
                              </button>
                            )}
                          </div>
                        </div>
                        {visibleRecs.map((rec, ri) => {
                          const recText = typeof rec === 'object' ? (rec.recommendation || rec.__simpleType || '') : rec;
                          const originalIndex = recsArr.indexOf(rec);
                          return renderEditableArrayItem(record, idx, 'recommendations', originalIndex, recText, 'recommendations');
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* SECTION 8: Notes (per-sentence) */}
                {showNotes && (() => {
                  const searchLower = searchTerm.toLowerCase().trim();
                  const sectionTitleMatches = !isSearching || record._showAllSections || (searchLower && ('notes'.startsWith(searchLower) || searchLower.startsWith('notes')));

                  const sentenceRows = renderEditableSentenceRows(record, idx, 'notes', 'notes', sectionTitleMatches, record);
                  if (!sentenceRows || sentenceRows.length === 0) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Notes')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedId === `notes-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const fullEditKey = `notes-${idx}`;
                                const source = localEdits[fullEditKey] !== undefined ? localEdits[fullEditKey] : (record.notes || '');
                                const sentences = splitBySentence(source);
                                const displaySentences = localEdits[fullEditKey] !== undefined
                                  ? sentences
                                  : sentences.map((s, i) => {
                                      const pKey = `notes.s${i}-${idx}`;
                                      return localEdits[pKey] !== undefined ? localEdits[pKey] : s;
                                    });
                                const text = `NOTES\n${displaySentences.map((s, i) => `${i + 1}. ${s}${s.endsWith('.') ? '' : '.'}`).join('\n')}`;
                                copyToClipboard(text, `notes-${idx}`);
                              }}
                            >
                              {copiedId === `notes-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {canEdit && Object.keys(editedFields).some(k => k.startsWith('notes-') && k.endsWith(`-${idx}`)) && recordStatus !== 'approved' && (
                              <button className="approve-btn pending" onClick={() => handleApprove(record, idx)} disabled={approving}>
                                {approving ? 'Approving...' : 'Pending Approve'}
                              </button>
                            )}
                          </div>
                        </div>
                        {sentenceRows}
                      </div>
                    </div>
                  );
                })()}

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PulmonaryImagingDocument;
