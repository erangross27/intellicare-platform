import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import ReferralsDocumentPDFTemplate from '../pdf-templates/ReferralsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './ReferralsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" for this template) */
const DRAFT_KEY = 'referralsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const CARD_FIELDS = ['date', 'specialty', 'reason', 'urgency', 'status', 'provider', 'referringProvider', 'notes'];
const ENUM_FIELDS = {
  urgency: ['routine', 'urgent', 'emergent'],
  status: ['pending', 'referred', 'scheduled', 'completed', 'cancelled', 'planned']
};
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/**
 * ReferralsDocument - February 2026
 *
 * Mini-card blue glow pattern with inline editing.
 * Referrals grouped by status (Pending, Referred, Scheduled, Completed, Cancelled).
 * Per-card approve (yellow→green) since referrals are flat cards.
 */
const ReferralsDocument = ({ document: docProp, data, templateData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [copiedSectionId, setCopiedSectionId] = useState(null);
  // ===== EDITING STATE =====
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const saving = false;
  const [approving, setApproving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [statusOverrides, setStatusOverrides] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const textareaRef = useRef(null);

  // ===== DATA UNWRAPPING (3-prop pattern) =====
  const records = useMemo(() => {
    const raw = templateData || docProp || data;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (raw?.referrals) return Array.isArray(raw.referrals) ? raw.referrals : [raw.referrals];
    if (raw?.data) return Array.isArray(raw.data) ? raw.data : [raw.data];
    if (raw?.records) return Array.isArray(raw.records) ? raw.records : [raw.records];
    if (raw?.documentData) {
      const docData = raw.documentData;
      if (Array.isArray(docData)) return docData;
      if (docData?.referrals) return Array.isArray(docData.referrals) ? docData.referrals : [docData.referrals];
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
      const recId = rec && rec._id ? (rec._id.$oid || rec._id) : null;
      const recDrafts = recId ? store[recId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[`card-${idx}-${idx}`] = true;
        nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
        nStatus[idx] = 'amended';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    const timer = window.setTimeout(() => {
      setLocalEdits(prev => ({ ...nLocal, ...prev }));
      setPendingEdits(prev => ({ ...nPending, ...prev }));
      setEditedFields(prev => ({ ...nFields, ...prev }));
      setEditedSentences(prev => ({ ...nSentences, ...prev }));
      setStatusOverrides(prev => ({ ...nStatus, ...prev }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [records]);

  // ===== HELPERS =====
  const formatDate = useCallback((dateValue) => {
    if (!dateValue) return '';
    try {
      const d = new Date(dateValue.$date || dateValue);
      if (isNaN(d.getTime())) return String(dateValue);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return String(dateValue);
    }
  }, []);

  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || !text) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = String(text).split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i}>{part}</mark> : part
    );
  }, [searchTerm]);

  const splitBySemicolon = (text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/;\s*/).map(s => s.trim()).filter(Boolean);
  };

  // Canonical delimiter shape is /[.;]\s+/. This implementation is also parenthesis-aware.
  // Split narrative text on ". " and "; " — parenthesis-aware (keeps "(Dr. X, PsyD)" intact)
  // and title-protected (Dr./Mr./etc. do not split). Used for Reason + Notes.
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

  const copyToClipboard = useCallback(async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, []);

  const copySectionToClipboard = useCallback(async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSectionId(id);
      setTimeout(() => setCopiedSectionId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, []);

  // ===== EDITING HANDLERS =====
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
    const recId = record._id ? (record._id.$oid || record._id) : null;
    if (!recId) return;
    let saveValue = valueOverride !== undefined ? valueOverride : editValue.trim();

    // If sentenceIdx provided, splice the edited item back into the original text,
    // preserving its real delimiters (". " / "; ") so reason/notes don't get corrupted.
    if (sentenceIdx !== undefined && sentenceIdx !== null) {
      const fullEditKey = `${fieldName}-${idx}`;
      const currentFull = String(localEdits[fullEditKey] !== undefined ? localEdits[fullEditKey] : (record[fieldName] || ''));
      const splitter = (fieldName === 'reason' || fieldName === 'notes') ? splitBySentence : splitBySemicolon;
      const items = splitter(currentFull);
      let cursor = 0, rebuilt = '', ok = true;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const pos = currentFull.indexOf(it, cursor);
        if (pos === -1) { ok = false; break; }
        rebuilt += currentFull.slice(cursor, pos) + (i === sentenceIdx ? saveValue : it);
        cursor = pos + it.length;
      }
      saveValue = ok
        ? (rebuilt + currentFull.slice(cursor))
        : items.map((it, i) => (i === sentenceIdx ? saveValue : it)).join((fieldName === 'reason' || fieldName === 'notes') ? '. ' : '; ');
    }

    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    const editKey = `${fieldName}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [`${editKey}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));

    const store = readDrafts();
    if (!store[recId]) store[recId] = {};
    store[recId][fieldName] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue, localEdits]);

  // Approve = COMMIT all staged drafts for this record to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApprove = useCallback(async (record, idx) => {
    const recId = record._id ? (record._id.$oid || record._id) : null;
    if (!recId) return;
    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now (field, or field+arrayIndex for numeric array elements)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const dotIdx = fieldPart.lastIndexOf('.');
        const tail = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const isArrayIdx = dotIdx !== -1 && /^\d+$/.test(tail);
        const payload = { field: isArrayIdx ? fieldPart.slice(0, dotIdx) : fieldPart, value: localEdits[editKey] };
        if (isArrayIdx) payload.arrayIndex = parseInt(tail, 10);
        const resp = await secureApiClient.put(`/api/edit/referrals/${recId}/edit`, payload);
        if (!resp || !resp.success) throw new Error((resp && resp.error) || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/referrals/${recId}/approve`);

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
      console.error('[Referrals] Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // ===== EDITING HELPERS =====
  const getFieldValue = useCallback((record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    const val = record[fieldName];
    if (Array.isArray(val)) return val.join(', ');
    return val;
  }, [localEdits]);

  const cardHasEdits = useCallback((cardIdx) => {
    return Object.keys(localEdits).some(editKey => {
      const dashIdx = editKey.lastIndexOf('-');
      const fieldPart = editKey.substring(0, dashIdx);
      const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
      return recIdx === cardIdx && CARD_FIELDS.includes(fieldPart);
    });
  }, [localEdits]);

  // ===== pdfData MEMO =====
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((rec, idx) => {
      const merged = { ...rec };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldName = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx === idx) merged[fieldName] = editVal;
      }
      return merged;
    });
  }, [records, localEdits, pendingEdits]);

  // ===== SEARCH FUNCTIONS =====
  const shouldShowRow = useCallback((record, ...valuesToCheck) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    for (const val of valuesToCheck) {
      if (val && String(val).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm]);

  // Level 1: Filtering with _origIdx preserved
  const filteredReferrals = useMemo(() => {
    const indexed = pdfData.map((ref, idx) => ({ ...ref, _origIdx: idx }));
    if (!searchTerm.trim()) {
      return indexed.map(ref => ({ ...ref, _showAllSections: true }));
    }
    const phrase = searchTerm.toLowerCase().trim();
    // Precise per-record filter: "Medical Referrals 3" → only record #3 (not 30, 31, …)
    const recordNumMatch = phrase.match(/^medical referrals\s+(\d+)$/);
    return indexed.filter((ref) => {
      const recordNumber = ref._origIdx + 1;
      const recordTitle = `Medical Referrals ${recordNumber}`;
      if (recordNumMatch) {
        if (parseInt(recordNumMatch[1], 10) !== recordNumber) return false;
        ref._showAllSections = true;
        return true;
      }
      const searchableText = [
        'Medical Referrals', 'referrals', 'referral',
        recordTitle,
        'Referral Details',
        'Specialty', 'Reason', 'Urgency', 'Status', 'Provider', 'Referring Provider', 'Notes', 'Date',
        ref.specialty, ref.urgency, ref.status, ref.provider, ref.referringProvider,
        ...splitBySentence(ref.reason || ''), ...splitBySentence(ref.notes || ''),
        ref.reason, ref.notes,
        formatDate(ref.date), ref.date
      ].filter(Boolean).join(' ').toLowerCase();

      if (!searchableText.includes(phrase)) return false;

      const titleLower = recordTitle.toLowerCase();
      const specLower = (ref.specialty || '').toLowerCase();
      if (titleLower.includes(phrase) || phrase.includes('referral') || specLower.includes(phrase)) {
        ref._showAllSections = true;
      } else {
        ref._showAllSections = false;
      }
      return true;
    });
  }, [pdfData, searchTerm, formatDate]);

  // Edit indicator
  const editIndicator = (
    <span className="edit-indicator">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="m15 5 4 4" />
      </svg>
      <span className="edit-tag">edit</span>
    </span>
  );

  const enumOptionsWith = (fieldName, currentValue) => {
    const base = ENUM_FIELDS[fieldName] || [];
    const current = String(currentValue || '').trim();
    if (!current || base.some(o => o.toLowerCase() === current.toLowerCase())) return base;
    return [current, ...base];
  };

  // ===== renderEditableField (rec-mini-card pattern) =====
  const renderEditableField = (record, fieldName, label, idx, sectionId) => {
    const displayValue = getFieldValue(record, fieldName, idx);
    if (!displayValue) return null;

    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const canEdit = !!record._id;
    const copyId = `${fieldName}-${idx}`;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const sentenceState = sectionWasEdited ? editedSentences[`${fieldName}-${idx}-s0`] : undefined;
    const refStatus = statusOverrides[idx] || 'active';
    const isFieldEdited = sentenceState === 'edited' && refStatus !== 'approved';

    if (!shouldShowRow(record, label, displayValue)) return null;

    if (isEditing) {
      return (
        <div className="rec-mini-card nested-mini-card" data-edit-field={fieldName} key={fieldName}>
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className="numbered-row edit-row editable-row">
            <div className="edit-field-container">
              {ENUM_FIELDS[fieldName] ? (
                <BlueSelect
                  value={editValue}
                  options={enumOptionsWith(fieldName, editValue)}
                  onChange={setEditValue}
                />
              ) : (
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
              )}
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
      <div className="rec-mini-card nested-mini-card" data-edit-field={fieldName} key={fieldName}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div
          className={`numbered-row editable-row ${isFieldEdited ? 'modified' : ''}`}
          onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue)}
          title={canEdit ? 'Click to edit' : undefined}
        >
          <div
            className={`row-content ${canEdit ? 'editable' : ''}`}
          >
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isFieldEdited && editIndicator}
          </div>
          <button
            className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
            onClick={(event) => { event.stopPropagation(); copyToClipboard(`${label}\n${displayValue}`, copyId); }}
          >
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // ===== toInputDate: ISO/date → yyyy-mm-dd for BlueDatePicker =====
  const toInputDate = (d) => {
    if (!d) return '';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return '';
      return dt.toISOString().slice(0, 10);
    } catch { return ''; }
  };

  // ===== Editable Date field =====
  const renderEditableDateField = (record, idx, sectionId) => {
    const canEdit = !!record._id;
    const rawDate = getFieldValue(record, 'date', idx);
    const displayValue = formatDate(rawDate);
    if (!displayValue) return null;
    if (!shouldShowRow(record, 'Date', displayValue)) return null;

    const editKey = `date-${idx}-s0`;
    const isEditing = editingField === editKey;
    const copyId = `date-${idx}`;
    const sectionWasEdited = editedFields[`${sectionId}-${idx}`];
    const sentenceState = sectionWasEdited ? editedSentences[editKey] : undefined;
    const refStatus = statusOverrides[idx] || 'active';
    const isFieldEdited = sentenceState === 'edited' && refStatus !== 'approved';

    if (isEditing) {
      return (
        <div className="rec-mini-card nested-mini-card" data-edit-field="date" key="date">
          <div className="nested-subtitle">{highlightText('Date')}</div>
          <div className="numbered-row edit-row editable-row">
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={setEditValue} />
              <div className="edit-actions">
                <button
                  className="edit-save-btn"
                  disabled={saving || !editValue}
                  onClick={() => handleSaveField(record, 'date', idx, sectionId, undefined, new Date(editValue + 'T00:00:00.000Z').toISOString())}
                >
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
      <div className="rec-mini-card nested-mini-card" data-edit-field="date" key="date">
        <div className="nested-subtitle">{highlightText('Date')}</div>
        <div
          className={`numbered-row editable-row ${isFieldEdited ? 'modified' : ''}`}
          onClick={() => canEdit && handleStartEdit('date', idx, toInputDate(rawDate))}
          title={canEdit ? 'Click to edit' : undefined}
        >
          <div
            className={`row-content ${canEdit ? 'editable' : ''}`}
          >
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isFieldEdited && editIndicator}
          </div>
          <button
            className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
            onClick={(event) => { event.stopPropagation(); copyToClipboard(`Date\n${displayValue}`, copyId); }}
          >
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // ===== renderSplitEditableField (semicolon-split field → per-row editing) =====
  const renderSplitEditableField = (record, fieldName, label, idx, sectionId, splitter = splitBySemicolon) => {
    const displayValue = getFieldValue(record, fieldName, idx);
    if (!displayValue) return null;

    const canEdit = !!record._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const refStatus = statusOverrides[idx] || 'active';

    const items = splitter(displayValue);
    if (items.length === 0) return null;

    // Field-level search check
    if (!shouldShowRow(record, label, ...items)) return null;

    // Level 4: filter individual items by search
    const labelMatches = (() => {
      if (!searchTerm.trim() || record._showAllSections) return true;
      const phrase = searchTerm.toLowerCase().trim();
      return label.toLowerCase().includes(phrase);
    })();

    // Map first to preserve original index, then filter
    const visibleItems = items
      .map((item, origIdx) => ({ item, origIdx }))
      .filter(({ item }) => {
        if (!searchTerm.trim() || record._showAllSections || labelMatches) return true;
        return shouldShowRow(record, item);
      });

    if (visibleItems.length === 0) return null;

    return (
      <div className="rec-mini-card nested-mini-card" key={fieldName}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        {visibleItems.map(({ item, origIdx }, vi) => {
          const editKey = `${fieldName}-${idx}-s${origIdx}`;
          const isEditing = editingField === editKey;
          const sentenceState = sectionWasEdited ? editedSentences[editKey] : undefined;
          const isItemEdited = sentenceState === 'edited' && refStatus !== 'approved';

          if (isEditing) {
            return (
              <div key={origIdx} data-edit-field={fieldName}>
                <div className="numbered-row edit-row editable-row">
                  <div className="edit-field-container">
                    <textarea
                      ref={textareaRef}
                      className="edit-textarea"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') handleCancelEdit();
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveField(record, fieldName, idx, sectionId, origIdx);
                      }}
                      rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))}
                      disabled={saving}
                    />
                    <div className="edit-actions">
                      <button
                        className="edit-save-btn"
                        onClick={() => handleSaveField(record, fieldName, idx, sectionId, origIdx)}
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
            <div key={origIdx} data-edit-field={fieldName}>
              <div
                className={`numbered-row editable-row${isItemEdited ? ' modified' : ''}`}
                style={{ marginBottom: vi < visibleItems.length - 1 ? '8px' : '0' }}
                onClick={() => canEdit && handleStartEdit(fieldName, idx, item, origIdx)}
                title={canEdit ? 'Click to edit' : undefined}
              >
                <div
                  className={`row-content${canEdit ? ' editable' : ''}`}
                >
                  <span className="content-value">{highlightText(item)}</span>
                  {canEdit && !isItemEdited && editIndicator}
                </div>
                <button
                  className={`copy-btn ${copiedId === `${fieldName}-${idx}-${origIdx}` ? 'copied' : ''}`}
                  onClick={(event) => { event.stopPropagation(); copyToClipboard(item, `${fieldName}-${idx}-${origIdx}`); }}
                >
                  {copiedId === `${fieldName}-${idx}-${origIdx}` ? 'Copied!' : 'Copy'}
                </button>
              </div>
              {isItemEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
            </div>
          );
        })}
      </div>
    );
  };

  // ===== Get referral text for copy =====
  const pushField = (lines, label, value, splitter = (item) => [String(item)]) => {
    if (!value) return;
    const items = splitter(String(value)).filter(Boolean);
    if (!items.length) return;
    lines.push(label, COPY_LINE_DASH);
    items.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
  };

  const getReferralText = (ref, idx) => {
    const lines = [];
    lines.push(`Medical Referrals ${idx + 1}`, COPY_LINE_EQ, 'Referral Details', COPY_LINE_EQ);
    pushField(lines, 'Date', ref.date ? formatDate(ref.date) : '');
    pushField(lines, 'Specialty', getFieldValue(ref, 'specialty', idx));
    pushField(lines, 'Reason', getFieldValue(ref, 'reason', idx), splitBySentence);
    pushField(lines, 'Urgency', getFieldValue(ref, 'urgency', idx));
    pushField(lines, 'Status', getFieldValue(ref, 'status', idx));
    pushField(lines, 'Provider', getFieldValue(ref, 'provider', idx));
    pushField(lines, 'Referring Provider', getFieldValue(ref, 'referringProvider', idx));
    pushField(lines, 'Notes', getFieldValue(ref, 'notes', idx), splitBySentence);
    return lines.join('\n');
  };

  // ===== Copy All =====
  const getAllText = () => {
    const lines = ['Medical Referrals', COPY_LINE_EQ, ''];
    filteredReferrals.forEach((ref) => {
      const idx = ref._origIdx;
      lines.push(getReferralText(ref, idx), '');
    });
    return lines.join('\n');
  };

  // ===== EMPTY STATE =====
  if (records.length === 0) {
    return (
      <div className="referrals-document">
        <div className="document-header">
          <h1 className="document-title">Medical Referrals</h1>
        </div>
        <div className="no-data">No referrals available.</div>
      </div>
    );
  }

  return (
    <div className="referrals-document">
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">Medical Referrals</h1>
        <div className="header-actions">
          <button
            className={`copy-btn ${copiedId === 'all-referrals' ? 'copied' : ''}`}
            onClick={() => copyToClipboard(getAllText(), 'all-referrals')}
          >
            {copiedId === 'all-referrals' ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={
              <ReferralsDocumentPDFTemplate
                document={{ referrals: filteredReferrals }}
              />
            }
            fileName="Medical_Referrals.pdf"
            className="pdf-btn"
          >
            {({ loading }) => (loading ? 'Generating...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>
        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          placeholder="Search referrals..."
        />
        {searchTerm && (
          <div className="search-results-count">
            Showing {filteredReferrals.length} of {records.length} referrals
          </div>
        )}
      </div>

      {/* Records Container */}
      <div className="records-container">
        {filteredReferrals.map((ref) => {
          const idx = ref._origIdx;
          const sectionId = `card-${idx}`;
          const canEdit = !!ref._id;
          const hasEdits = cardHasEdits(idx);
          const diagStatus = statusOverrides[idx] || 'active';
          const canApprove = canEdit && diagStatus !== 'approved' && hasEdits;
          const isApproved = diagStatus === 'approved';

          return (
                    <div key={`ref-${idx}`} className="referral-record">
                      {/* Record Header */}
                      <div className="record-header">
                        <div className="header-top-row">
                          <button
                            className={`copy-referral-btn ${copiedId === `ref-${idx}` ? 'copied' : ''}`}
                            onClick={() => copyToClipboard(getReferralText(ref, idx), `ref-${idx}`)}
                          >
                            {copiedId === `ref-${idx}` ? 'Copied!' : 'Copy Referral'}
                          </button>
                        </div>
                        <h3 className="record-title">
                          {highlightText(`Medical Referrals ${idx + 1}`)}
                        </h3>
                      </div>

                      {/* Referral Details Section */}
                      <div className="section">
                        <div className="mini-cards-container">
                          <div className="section-header">
                            <h4 className="section-title">{highlightText('Referral Details')}</h4>
                            <div className="header-right-actions">
                              <button
                                className={`copy-btn ${copiedSectionId === `details-${idx}` ? 'copied' : ''}`}
                                onClick={() => copySectionToClipboard(getReferralText(ref, idx), `details-${idx}`)}
                              >
                                {copiedSectionId === `details-${idx}` ? 'Copied!' : 'Copy Section'}
                              </button>
                              {(canApprove || isApproved) && (
                                <button
                                  className={`approve-btn${isApproved ? ' approved' : ' pending'}`}
                                  onClick={() => handleApprove(ref, idx)}
                                  disabled={approving || isApproved}
                                >
                                  {approving ? 'Approving...' : isApproved ? 'Approved' : 'Pending Approve'}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Date - read-only */}
                          {renderEditableDateField(ref, idx, sectionId)}

                          {/* Editable fields */}
                          {renderEditableField(ref, 'specialty', 'Specialty', idx, sectionId)}
                          {renderSplitEditableField(ref, 'reason', 'Reason', idx, sectionId, splitBySentence)}
                          {renderEditableField(ref, 'urgency', 'Urgency', idx, sectionId)}
                          {renderEditableField(ref, 'status', 'Status', idx, sectionId)}
                          {renderEditableField(ref, 'provider', 'Provider', idx, sectionId)}
                          {renderEditableField(ref, 'referringProvider', 'Referring Provider', idx, sectionId)}
                          {renderSplitEditableField(ref, 'notes', 'Notes', idx, sectionId, splitBySentence)}
                        </div>
                      </div>
                    </div>
          );
        })}
      </div>

      {/* No Results */}
      {filteredReferrals.length === 0 && searchTerm && (
        <div className="no-data">No referrals found matching &ldquo;{searchTerm}&rdquo;</div>
      )}
    </div>
  );
};

export default ReferralsDocument;
