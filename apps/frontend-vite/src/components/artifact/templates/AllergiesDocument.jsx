import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import AllergiesPDFTemplate from '../pdf-templates/AllergiesPDFTemplate';
import './AllergiesDocument.css';

/**
 * AllergiesDocument - December 2025 Complete Rebuild
 *
 * Structure:
 * - Document header: Title, Copy All + Export PDF, Search
 * - Each allergy is its OWN SECTION: "Allergy 1", "Allergy 2", etc.
 * - Section header: "Allergy X" (left) + Severity badge (right, colored)
 * - Inner card header: Date badge (left) + Copy Section (right)
 * - Each field: nested-subtitle (label) + numbered-row (value only)
 * - Fonts: section-title 19px, nested-subtitle 17px, content-value 16px
 */

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [allergyId]: { [fieldName]: value } } */
const DRAFT_KEY = 'allergiesPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ── Notes segmentation: split the Notes value into readable rows ──
   - First split into sentences on '. ' (paren-aware + title-aware — never inside "(...)" or after "Dr.").
   - Then split each sentence on ';' at paren depth 0, so "(nausea, vomiting, diarrhea)" stays intact.
   - A leading "Label:" that introduces a >=2 item ';'-list (e.g. "Additional allergies: a; b; c")
     becomes a sub-subtitle, with each item on its own row.
   Returns an ordered array of { label: string|null, text: string }. Shared by JSX + Copy. */
const splitNotesSentences = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === '.' && depth === 0 && i + 1 < text.length && /\s/.test(text[i + 1])) {
      // Title / abbreviation protection (don't split after Dr., No., etc.)
      if (/(?:^|\s)(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|No|approx|Inc|Ltd|Co)$/i.test(current)) {
        current += ch;
        continue;
      }
      // Next non-space char must start a new sentence (uppercase letter or digit)
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (j < text.length && !/[A-Z0-9]/.test(text[j])) {
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
  const trimmed = current.trim();
  if (trimmed) result.push(trimmed);
  return result;
};

const splitNotesBySemicolon = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ';' && depth === 0) {
      const t = current.trim();
      if (t) result.push(t);
      current = '';
    } else {
      current += ch;
    }
  }
  const t = current.trim();
  if (t) result.push(t);
  return result;
};

const parseNotesLeadingLabel = (sentence) => {
  const m = sentence.match(/^([A-Z][A-Za-z][A-Za-z \-/]{0,38}[A-Za-z]):\s+(.+)$/);
  if (m) return { label: m[1].trim(), value: m[2].trim() };
  return { label: null, value: sentence };
};

const stripNotesTrailingPunct = (s) => String(s).replace(/[.;]+$/, '').trim();

const parseNotesSegments = (text) => {
  if (!text || typeof text !== 'string') return [];
  const segments = [];
  for (const sentence of splitNotesSentences(text)) {
    const { label, value } = parseNotesLeadingLabel(sentence);
    if (label) {
      const items = splitNotesBySemicolon(value);
      if (items.length >= 2) {
        // Labeled list (e.g. "Additional allergies: a; b; c") — grouped so the UI can box it together.
        items.forEach((item, i) => {
          segments.push({ label: i === 0 ? label : null, text: stripNotesTrailingPunct(item), grouped: true });
        });
        continue;
      }
    }
    const items = splitNotesBySemicolon(sentence);
    if (items.length >= 2) {
      items.forEach(item => segments.push({ label: null, text: stripNotesTrailingPunct(item), grouped: false }));
    } else {
      segments.push({ label: null, text: sentence.trim(), grouped: false });
    }
  }
  return segments;
};

const AllergiesDocument = ({ document, data }) => {
  const templateData = document || data;

  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Editing state — per-template isolation (NO shared hooks)
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

  // Unwrap data - handle multiple possible structures
  const unwrappedData = useMemo(() => {
    if (!templateData) return [];
    if (Array.isArray(templateData)) return templateData;
    // Backend wrapped format: { records: [...] }
    if (templateData.records && Array.isArray(templateData.records)) {
      return templateData.records;
    }
    if (templateData.allergies && Array.isArray(templateData.allergies)) {
      return templateData.allergies;
    }
    if (templateData.allergies?.[0]?.allergies) {
      return templateData.allergies[0].allergies;
    }
    // Handle single record flattened to top level (backend wraps single records too)
    if (templateData.allergen || templateData.allergenName || templateData.severity) {
      return [templateData];
    }
    return [];
  }, [templateData]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nStatus = {};
    unwrappedData.forEach((allergy, idx) => {
      const allergyDrafts = allergy && allergy._id ? store[allergy._id] : null;
      if (!allergyDrafts) return;
      Object.entries(allergyDrafts).forEach(([fieldName, value]) => {
        const editKey = `${fieldName}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[`${fieldName}Info-${idx}`] = true;
        nSentences[`${editKey}-s0`] = 'edited';
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

  // Copy to clipboard helper
  const copyToClipboard = useCallback(async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

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

  // Format date helper
  const formatDate = useCallback((dateString) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  }, []);

  // --- Edit handlers ---

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
  const handleSaveField = useCallback((allergy, fieldName, idx, sectionId) => {
    const allergyId = allergy._id;
    if (!allergyId) {
      console.error('[Allergies] Cannot save — no allergy _id');
      return;
    }
    const value = editValue.trim();
    const editKey = `${fieldName}-${idx}`;
    const sectionKey = `${sectionId}-${idx}`;

    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [sectionKey]: true }));
    setEditedSentences(prev => ({ ...prev, [`${editKey}-s0`]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));

    const store = readDrafts();
    if (!store[allergyId]) store[allergyId] = {};
    store[allergyId][fieldName] = value;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this allergy to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApprove = useCallback(async (allergy, idx) => {
    const allergyId = allergy._id;
    if (!allergyId) {
      console.error('[Allergies] Cannot approve — no allergy _id');
      return;
    }

    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const dotIdx = fieldPart.indexOf('.');
        const payload = { field: dotIdx === -1 ? fieldPart : fieldPart.slice(0, dotIdx), value: localEdits[editKey] };
        if (dotIdx !== -1) payload.arrayIndex = parseInt(fieldPart.slice(dotIdx + 1), 10);
        const resp = await secureApiClient.put(`/api/edit/allergies/${allergyId}/edit`, payload);
        if (!resp || !resp.success) throw new Error((resp && resp.error) || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/allergies/${allergyId}/approve`);

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this allergy's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[allergyId]) { delete store[allergyId]; writeDrafts(store); }

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
      console.error('[Allergies] Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // Get effective field value (local edit overrides original)
  const getFieldValue = useCallback((allergy, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    return allergy[fieldName];
  }, [localEdits]);

  // pdfData — merges localEdits into records for PDF + Copy All
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return unwrappedData;
    return unwrappedData.map((allergy, idx) => {
      const merged = { ...allergy };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldName = editKey.substring(0, dashIdx);
        const allergyIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (allergyIdx === idx) merged[fieldName] = editVal;
      }
      return merged;
    });
  }, [unwrappedData, localEdits, pendingEdits]);

  // Helper: render a single editable field
  const renderEditableField = (allergy, idx, fieldName, label, displayValue, sectionId, copyId) => {
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const canEdit = !!allergy._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const sentenceState = sectionWasEdited ? editedSentences[`${fieldName}-${idx}-s0`] : undefined;
    const allergyStatus = statusOverrides[idx] || 'active';
    const isFieldEdited = sentenceState === 'edited' && allergyStatus !== 'approved';
    const isPending = sentenceState && allergyStatus !== 'approved';

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
                rows={Math.max(2, editValue.split('\n').length)}
                disabled={saving}
              />
              <div className="edit-actions">
                <button
                  className="edit-save-btn"
                  onClick={() => handleSaveField(allergy, fieldName, idx, sectionId)}
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

    const sectionCopyId = `${copyId}-section`;
    return (
      <div className="rec-mini-card" key={fieldName}>
        {/* Field title row + "Copy Section" (copies the field TITLE + value, per memory 698979a6) */}
        <div className="field-card-header">
          <div className="nested-subtitle">{highlightText(label)}</div>
          <button
            className={`copy-btn section-copy-btn ${copiedId === sectionCopyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(`${label.toUpperCase()}\n${displayValue}`, sectionCopyId)}
            title="Copy section title + value"
          >
            {copiedId === sectionCopyId ? 'Copied!' : 'Copy Section'}
          </button>
        </div>
        <div className={`numbered-row ${isFieldEdited ? 'modified' : ''}`}>
          <div
            className={`row-content ${canEdit ? 'editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue)}
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
            className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(displayValue, copyId)}
          >
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && (
          <div className="modified-badge">edited — click pending approve to save</div>
        )}
      </div>
    );
  };

  // Helper: render the Notes field — split into rows by sentence + ';' separator.
  // Each segment is its own row; an "Additional allergies:"-style label becomes a sub-subtitle.
  // Editing stays whole-field: clicking any row opens the full notes text in one editor
  // (identical save/draft/approve flow as renderEditableField — no per-row reconstruction).
  const renderNotesField = (allergy, idx, notesValue, sectionId, copyIdBase) => {
    const fieldName = 'notes';
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const canEdit = !!allergy._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const sentenceState = sectionWasEdited ? editedSentences[`${fieldName}-${idx}-s0`] : undefined;
    const allergyStatus = statusOverrides[idx] || 'active';
    const isFieldEdited = sentenceState === 'edited' && allergyStatus !== 'approved';
    const isPending = sentenceState && allergyStatus !== 'approved';

    // Edit mode — single textarea over the WHOLE notes string (unchanged save flow)
    if (isEditing) {
      return (
        <div className="rec-mini-card" key={fieldName}>
          <div className="nested-subtitle">{highlightText('Notes')}</div>
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <textarea
                ref={textareaRef}
                className="edit-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={Math.max(3, editValue.split('\n').length)}
                disabled={saving}
              />
              <div className="edit-actions">
                <button
                  className="edit-save-btn"
                  onClick={() => handleSaveField(allergy, fieldName, idx, sectionId)}
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

    // Display mode — one row per segment
    const segments = parseNotesSegments(notesValue);
    if (segments.length === 0) return null;

    const notesSectionCopyId = `${copyIdBase}-section`;
    const notesCopyText = 'NOTES\n' + segments.map(seg =>
      seg.label ? `${seg.label}:\n• ${seg.text}` : `• ${seg.text}`
    ).join('\n');

    // Render one notes row (value + per-row Copy). Clicking opens the whole-notes editor.
    const renderNotesRow = (text, sIdx) => {
      const rowCopyId = `${copyIdBase}-n${sIdx}`;
      return (
        <div className={`numbered-row ${isFieldEdited ? 'modified' : ''}`} key={`row-${sIdx}`}>
          <div
            className={`row-content ${canEdit ? 'editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(fieldName, idx, notesValue)}
            title={canEdit ? 'Click to edit notes' : undefined}
          >
            <span className="content-value">{highlightText(text)}</span>
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
            className={`copy-btn ${copiedId === rowCopyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(text, rowCopyId)}
          >
            {copiedId === rowCopyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
      );
    };

    // Group contiguous labeled-list items (e.g. "Additional allergies") into ONE nested-mini-card box;
    // standalone sentences / bare lists render as plain rows.
    const blocks = [];
    segments.forEach((seg, sIdx) => {
      if (seg.grouped && seg.label) {
        blocks.push({ type: 'group', label: seg.label, rows: [{ text: seg.text, sIdx }] });
      } else if (seg.grouped && blocks.length && blocks[blocks.length - 1].type === 'group') {
        blocks[blocks.length - 1].rows.push({ text: seg.text, sIdx });
      } else {
        blocks.push({ type: 'row', text: seg.text, sIdx });
      }
    });

    return (
      <div className="rec-mini-card" key={fieldName}>
        {/* Notes title row + "Copy Section" (copies NOTES title + all segment lines) */}
        <div className="field-card-header">
          <div className="nested-subtitle">{highlightText('Notes')}</div>
          <button
            className={`copy-btn section-copy-btn ${copiedId === notesSectionCopyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(notesCopyText, notesSectionCopyId)}
            title="Copy section title + value"
          >
            {copiedId === notesSectionCopyId ? 'Copied!' : 'Copy Section'}
          </button>
        </div>
        {blocks.map((block, bIdx) => (
          block.type === 'group' ? (
            // "Additional allergies" group — surrounded by its own nested-mini-card box
            <div className="nested-mini-card" key={`grp-${bIdx}`}>
              <div className="nested-subtitle note-subtitle">{highlightText(block.label)}</div>
              {block.rows.map(r => renderNotesRow(r.text, r.sIdx))}
            </div>
          ) : (
            renderNotesRow(block.text, block.sIdx)
          )
        ))}
        {isFieldEdited && (
          <div className="modified-badge">edited — click pending approve to save</div>
        )}
      </div>
    );
  };

  // Get allergy text for copying
  const getAllergyText = useCallback((allergy, idx) => {
    const lines = [];
    lines.push(`ALLERGY ${idx + 1}`);
    lines.push('═'.repeat(40));
    if (allergy.allergen) lines.push(`Allergen: ${allergy.allergen}`);
    if (allergy.reaction) lines.push(`Reaction: ${allergy.reaction}`);
    if (allergy.severity) lines.push(`Severity: ${allergy.severity}`);
    if (allergy.type) lines.push(`Type: ${allergy.type}`);
    if (allergy.dateIdentified) lines.push(`Date Identified: ${formatDate(allergy.dateIdentified)}`);
    if (allergy.status) lines.push(`Status: ${allergy.status}`);
    if (allergy.management) lines.push(`Management: ${allergy.management}`);
    if (allergy.compliance) lines.push(`Compliance: ${allergy.compliance}`);

    // Notes - split into rows by sentence + ';' separator (labels become sub-headers)
    if (allergy.notes) {
      lines.push('');
      lines.push('Notes:');
      lines.push('─'.repeat(30));
      parseNotesSegments(allergy.notes).forEach(seg => {
        if (seg.label) {
          lines.push('');
          lines.push(`${seg.label}:`);
        }
        lines.push(`• ${seg.text}`);
      });
    }

    return lines.join('\n');
  }, [formatDate]);

  // Get all text for copying
  const getAllText = useCallback(() => {
    const sections = [];
    sections.push('ALLERGIES');
    sections.push('═'.repeat(50));
    sections.push('');

    pdfData.forEach((allergy, idx) => {
      sections.push(getAllergyText(allergy, idx));
      sections.push('');
    });

    return sections.join('\n');
  }, [pdfData, getAllergyText]);

  // 4-Level Search Implementation
  const searchableText = useMemo(() => {
    const texts = [
      'Allergies', 'allergies', 'ALLERGIES',
      'Allergy', 'allergy', 'ALLERGY',
      'Allergen', 'allergen', 'ALLERGEN',
      'Reaction', 'reaction', 'REACTION',
      'Severity', 'severity', 'SEVERITY',
      'Type', 'type', 'TYPE',
      'Status', 'status', 'STATUS',
      'Management', 'management', 'MANAGEMENT',
      'Compliance', 'compliance', 'COMPLIANCE',
      'Notes', 'notes', 'NOTES', 'Note', 'note', 'NOTE',
      'Date Identified', 'date identified', 'DATE IDENTIFIED',
      'Severe', 'severe', 'SEVERE',
      'Moderate', 'moderate', 'MODERATE',
      'Mild', 'mild', 'MILD'
    ];

    // Add "Allergy 1", "Allergy 2", etc. for searchability
    unwrappedData.forEach((allergy, idx) => {
      texts.push(`Allergy ${idx + 1}`, `allergy ${idx + 1}`, `ALLERGY ${idx + 1}`);
    });

    unwrappedData.forEach(allergy => {
      if (allergy.allergen) texts.push(allergy.allergen);
      if (allergy.reaction) texts.push(allergy.reaction);
      if (allergy.severity) texts.push(allergy.severity);
      if (allergy.type) texts.push(allergy.type);
      if (allergy.status) texts.push(allergy.status);
      if (allergy.management) texts.push(allergy.management);
      if (allergy.compliance) texts.push(allergy.compliance);
      if (allergy.notes) texts.push(allergy.notes);
    });

    return texts.filter(Boolean).join(' ').toLowerCase();
  }, [unwrappedData]);

  // shouldShowRow helper - Level 4 filtering
  // When sectionTitleMatches is true, show all content (section already matched)
  const shouldShowRow = useCallback((valuesToCheck, sectionTitleMatches = false) => {
    if (!searchTerm.trim()) return true;
    if (sectionTitleMatches) return true; // Show all if section title matched
    
    const phrase = searchTerm.toLowerCase().trim();

    for (const val of valuesToCheck) {
      if (val && String(val).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm]);

  // Check if allergy matches search (includes index for "Allergy X" matching)
  const allergyMatchesSearch = useCallback((allergy, idx) => {
    if (!searchTerm.trim()) return true;
    const phrase = searchTerm.toLowerCase().trim();

    const allergyText = [
      allergy.allergen, allergy.reaction, allergy.severity, allergy.type,
      allergy.status, allergy.management, allergy.compliance, allergy.notes,
      'Allergen', 'Reaction', 'Severity', 'Type', 'Status', 'Management', 'Compliance', 'Notes', 'Allergy',
      `Allergy ${idx + 1}`, `allergy ${idx + 1}`
    ].filter(Boolean).join(' ').toLowerCase();

    return allergyText.includes(phrase);
  }, [searchTerm]);

  // Check if document matches search
  const documentMatches = useMemo(() => {
    if (!searchTerm.trim()) return true;
    return searchableText.includes(searchTerm.toLowerCase().trim());
  }, [searchTerm, searchableText]);

  // Get severity badge class for color
  const getSeverityClass = (severity) => {
    const s = (severity || '').toLowerCase();
    if (s === 'severe') return 'severity-severe';
    if (s === 'moderate') return 'severity-moderate';
    if (s === 'mild' || s === 'low') return 'severity-mild';
    return 'severity-other';
  };

  // Render single allergy as its own section
  const renderAllergySection = (allergy, idx) => {
    const allergyId = allergy._id || `allergy-${idx}`;

    // Check if this allergy matches search (Level 2: Section filtering)
    if (!allergyMatchesSearch(allergy, idx)) return null;

    // Level 2 check: Does section title match? If yes, show ALL content (Level 4)
    const sectionTitleMatches = searchTerm.trim() &&
      (`Allergy ${idx + 1}`.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
       `allergy ${idx + 1}`.toLowerCase().includes(searchTerm.toLowerCase().trim()));

    // Get effective field values (local edit overrides)
    const allergenVal = getFieldValue(allergy, 'allergen', idx);
    const reactionVal = getFieldValue(allergy, 'reaction', idx);
    const severityVal = getFieldValue(allergy, 'severity', idx);
    const typeVal = getFieldValue(allergy, 'type', idx);
    const statusVal = getFieldValue(allergy, 'status', idx);
    const managementVal = getFieldValue(allergy, 'management', idx);
    const complianceVal = getFieldValue(allergy, 'compliance', idx);
    const notesVal = getFieldValue(allergy, 'notes', idx);

    // Approve button: YELLOW "Pending Approve" while edits are pending, GREEN "Approved" after approving
    const canEdit = !!allergy._id;
    const allergyStatusOverride = statusOverrides[idx] || 'active';
    const allergyApproved = allergyStatusOverride === 'approved';
    const hasPendingEdits = canEdit && Object.keys(editedFields).some(k => k.endsWith(`-${idx}`));
    const showApproveBtn = canEdit && (hasPendingEdits || allergyApproved);

    return (
      <div className="section" key={allergyId}>
        <div className="mini-cards-container">
          {/* Section Header: "Allergy X" on left; Date + Severity + Copy Section on right */}
          <div className="section-header">
            <h3 className="section-title">{highlightText(`Allergy ${idx + 1}`)}</h3>
            <div className="section-header-right">
              {(allergy.dateIdentified || allergy.createdAt) && (
                <span className="date-text">{formatDate(allergy.dateIdentified || allergy.createdAt)}</span>
              )}
              {allergy.severity && (
                <span className={`severity-badge ${getSeverityClass(allergy.severity)}`}>
                  {allergy.severity}
                </span>
              )}
            </div>
          </div>

          {/* Inner Card */}
          <div className="rec-mini-card">
            {/* Approve button row — YELLOW "Pending Approve" while edits pending, GREEN "Approved" after */}
            {showApproveBtn && (
              <div className="header-top-row inner-card-header">
                <div className="header-right-actions">
                  <button
                    className={`approve-btn ${allergyApproved ? 'approved' : 'pending'}`}
                    onClick={() => handleApprove(allergy, idx)}
                    disabled={approving}
                    title={allergyApproved ? 'Approved' : 'Click to approve and save'}
                  >
                    {approving ? 'Approving...' : allergyApproved ? 'Approved' : 'Pending Approve'}
                  </button>
                </div>
              </div>
            )}

            {/* Allergen Field — editable */}
            {allergenVal && shouldShowRow(['Allergen', 'allergen', allergenVal], sectionTitleMatches) &&
              renderEditableField(allergy, idx, 'allergen', 'Allergen', allergenVal, 'allergenInfo', `${allergyId}-allergen`)
            }

            {/* Reaction Field — editable */}
            {reactionVal && shouldShowRow(['Reaction', 'reaction', reactionVal], sectionTitleMatches) &&
              renderEditableField(allergy, idx, 'reaction', 'Reaction', reactionVal, 'reactionInfo', `${allergyId}-reaction`)
            }

            {/* Severity Field — editable */}
            {severityVal && shouldShowRow(['Severity', 'severity', severityVal], sectionTitleMatches) &&
              renderEditableField(allergy, idx, 'severity', 'Severity', severityVal, 'severityInfo', `${allergyId}-severity`)
            }

            {/* Type Field — editable */}
            {typeVal && shouldShowRow(['Type', 'type', typeVal], sectionTitleMatches) &&
              renderEditableField(allergy, idx, 'type', 'Type', typeVal, 'typeInfo', `${allergyId}-type`)
            }

            {/* Status Field — editable */}
            {statusVal && shouldShowRow(['Status', 'status', statusVal], sectionTitleMatches) &&
              renderEditableField(allergy, idx, 'status', 'Status', statusVal, 'statusInfo', `${allergyId}-status`)
            }

            {/* Management Field — editable */}
            {managementVal && shouldShowRow(['Management', 'management', managementVal], sectionTitleMatches) &&
              renderEditableField(allergy, idx, 'management', 'Management', managementVal, 'managementInfo', `${allergyId}-management`)
            }

            {/* Compliance Field — editable */}
            {complianceVal && shouldShowRow(['Compliance', 'compliance', complianceVal], sectionTitleMatches) &&
              renderEditableField(allergy, idx, 'compliance', 'Compliance', complianceVal, 'complianceInfo', `${allergyId}-compliance`)
            }

            {/* Notes Field — split into rows by sentence + ';' separator; editable as whole text */}
            {notesVal && shouldShowRow(['Notes', 'notes', 'Note', notesVal], sectionTitleMatches) &&
              renderNotesField(allergy, idx, notesVal, 'notesInfo', `${allergyId}-notes`)
            }
          </div>
        </div>
      </div>
    );
  };

  // Empty state
  if (!templateData || unwrappedData.length === 0) {
    return (
      <div className="allergies-document">
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p className="empty-text">No allergy data available</p>
        </div>
      </div>
    );
  }

  // No search results
  if (searchTerm.trim() && !documentMatches) {
    return (
      <div className="allergies-document">
        <div className="document-header">
          <h1 className="document-title">Allergies</h1>
          <div className="header-actions">
            <button
              className={`copy-btn ${copiedId === 'all-documents' ? 'copied' : ''}`}
              onClick={() => copyToClipboard(getAllText(), 'all-documents')}
            >
              {copiedId === 'all-documents' ? 'Copied' : 'Copy All'}
            </button>
            <PDFDownloadLink
              document={<AllergiesPDFTemplate document={pdfData} />}
              fileName={`Allergies_${new Date().toISOString().split('T')[0]}.pdf`}
              className="pdf-btn"
            >
              {({ loading }) => (loading ? 'Preparing...' : 'Export PDF')}
            </PDFDownloadLink>
          </div>
          <div className="search-container">
            <input
              type="text"
              className="search-input"
              placeholder="Search allergies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>
            )}
          </div>
        </div>
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <p className="empty-text">No allergies found for "{searchTerm}"</p>
        </div>
      </div>
    );
  }

  return (
    <div className="allergies-document">
      {/* Document Header - 3 Rows: Title, Actions, Search */}
      <div className="document-header">
        <h1 className="document-title">Allergies</h1>
        <div className="header-actions">
          <button
            className={`copy-btn ${copiedId === 'all-documents' ? 'copied' : ''}`}
            onClick={() => copyToClipboard(getAllText(), 'all-documents')}
          >
            {copiedId === 'all-documents' ? 'Copied' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<AllergiesPDFTemplate document={pdfData} />}
            fileName={`Allergies_${new Date().toISOString().split('T')[0]}.pdf`}
            className="pdf-btn"
          >
            {({ loading }) => (loading ? 'Preparing...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search allergies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>
          )}
        </div>
      </div>

      {/* Allergy Sections - Each allergy is its own section */}
      {unwrappedData.map((allergy, idx) => renderAllergySection(allergy, idx))}
    </div>
  );
};

export default AllergiesDocument;
