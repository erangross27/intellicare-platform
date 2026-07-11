/**
 * StressManagementReferralsDocument.jsx
 * February 2026 Standard Template with Inline Editing
 *
 * Features:
 * - Own useState for searchTerm (not prop)
 * - PDFDownloadLink import (not onExportPDF)
 * - 4-level search with IIFE sectionTitleMatches pattern
 * - splitBySentence with parenthesis + title protection
 * - parseLabel for "Label: value" nested subtitle rendering
 * - Per-sentence editing with per-row copy
 * - Blue theme: #0d1929, #93c5fd, rgba(96, 165, 250, 0.3)
 * - Inline editing with approve workflow (per AllergiesDocument pattern)
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import StressManagementReferralsDocumentPDFTemplate from '../pdf-templates/StressManagementReferralsDocumentPDFTemplate';
import './StressManagementReferralsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'stressManagementReferralsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const StressManagementReferralsDocument = ({ document, data }) => {
  const templateData = document || data;
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
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

  // Unwrap data to handle nested document structures
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

  const unwrappedData = unwrapData(templateData);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nStatus = {};
    unwrappedData.forEach((rec, idx) => {
      const rid = rec && rec._id ? (rec._id.$oid || rec._id) : null;
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        // baseField = part before a numeric arrayIndex suffix (else the whole fieldPart)
        const lastDot = fieldPart.lastIndexOf('.');
        const baseField = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1)))
          ? fieldPart.slice(0, lastDot) : fieldPart;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateData]);

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

  // Sentence splitter with parenthesis + title protection
  // Splits on periods AND semicolons while respecting parentheses and honorific titles
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

  // Parse "Label: value" from a single sentence
  const parseLabel = (sentence) => {
    if (!sentence || typeof sentence !== 'string') return { label: null, value: sentence || '', isLabeled: false };
    const colonMatch = sentence.match(/^([^:]+?):\s*(.+)$/s);
    if (colonMatch && colonMatch[1].length < 80) {
      return { label: colonMatch[1].trim(), value: colonMatch[2].trim(), isLabeled: true };
    }
    return { label: null, value: sentence.trim(), isLabeled: false };
  };

  // Highlight search term helper
  const highlightText = useCallback((text) => {
    if (!text || !searchTerm.trim()) return text;
    const textStr = String(text);
    const phrase = searchTerm.trim();
    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedPhrase})`, 'gi');
    const parts = textStr.split(regex);
    const phraseLower = phrase.toLowerCase();

    return parts.map((part, i) =>
      part.toLowerCase() === phraseLower ? <mark key={i}>{part}</mark> : part
    );
  }, [searchTerm]);

  // Level 4: Check if search term matches any of the provided strings (phrase match)
  const shouldShowRow = useCallback((record, ...searchableStrings) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;
    const searchLower = searchTerm.toLowerCase().trim();
    return searchableStrings.some(str =>
      str && String(str).toLowerCase().includes(searchLower)
    );
  }, [searchTerm]);

  // Level 2.5: Check if section title matches search
  const sectionTitleMatchesSearch = useCallback((title, ...aliases) => {
    if (!searchTerm.trim()) return false;
    const searchLower = searchTerm.toLowerCase().trim();
    const allTitles = [title, ...aliases].filter(Boolean);
    return allTitles.some(t => t.toLowerCase().startsWith(searchLower) || searchLower.startsWith(t.toLowerCase()));
  }, [searchTerm]);

  // Copy to clipboard helper
  const copyToClipboard = useCallback((text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  // Copy section to clipboard helper
  const copySectionToClipboard = useCallback((text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSectionId(id);
      setTimeout(() => setCopiedSectionId(null), 2000);
    });
  }, []);

  // --- Edit handlers ---

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
    const recordId = record._id ? (record._id.$oid || record._id) : null;
    if (!recordId) {
      console.error('[StressManagementReferrals] Cannot save — no record _id');
      return;
    }

    const saveValue = (valueOverride !== undefined ? valueOverride : editValue.trim());
    const fieldPart = (typeof arrayIndex === 'number') ? `${fieldName}.${arrayIndex}` : fieldName;
    const editKey = `${fieldPart}-${idx}`;
    const sKey = `${fieldName}-${idx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;

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
    if (!recordId) {
      console.error('[StressManagementReferrals] Cannot approve — no record _id');
      return;
    }

    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        // Treat a dot-suffix as arrayIndex ONLY when the trailing segment is purely numeric
        const isArrayIdx = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        const payload = { field: isArrayIdx ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArrayIdx) payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        const response = await secureApiClient.put(`/api/edit/stress_management_referrals/${recordId}/edit`, payload);
        if (!response || !response.success) throw new Error((response && response.error) || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/stress_management_referrals/${recordId}/approve`);

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
      console.error('[StressManagementReferrals] Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // Get effective field value (local edit overrides original)
  const getFieldValue = useCallback((record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    return record[fieldName];
  }, [localEdits]);

  // pdfData — merges localEdits into records for PDF + Copy All
  const pdfData = useMemo(() => {
    const computeSentences = (rec, idx, fieldName) => {
      const fullKey = `${fieldName}-${idx}`;
      const source = localEdits[fullKey] !== undefined ? localEdits[fullKey] : (rec[fieldName] || '');
      if (!source) return null;
      const sentences = splitBySentence(source);
      if (localEdits[fullKey] !== undefined) return sentences;
      return sentences.map((s, i) => {
        const pKey = `${fieldName}.s${i}-${idx}`;
        return localEdits[pKey] !== undefined ? localEdits[pKey] : s;
      });
    };

    return unwrappedData.map((rec, idx) => {
      const merged = { ...rec };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldName = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx === idx) merged[fieldName] = editVal;
      }
      if (rec.reason || localEdits[`reason-${idx}`]) merged._reasonSentences = computeSentences(rec, idx, 'reason');
      if (rec.notes || localEdits[`notes-${idx}`]) merged._notesSentences = computeSentences(rec, idx, 'notes');
      return merged;
    });
  }, [unwrappedData, localEdits, pendingEdits]);

  // SECTION_FIELDS mapping
  const SECTION_FIELDS = {
    'referralInfo': ['specialty', 'status', 'urgency', 'referringProvider'],
    'reason': ['reason'],
    'notes': ['notes'],
  };

  // sectionHasEdits helper — checks per-sentence keys
  const sectionHasEdits = (sectionId, idx) => {
    const fields = SECTION_FIELDS[sectionId] || [];
    const recordStatus = statusOverrides[idx] || 'active';
    if (recordStatus === 'approved') return false;
    return fields.some(f => {
      return Object.keys(editedSentences).some(key => {
        if (!key.startsWith(`${f}-${idx}-s`)) return false;
        const state = editedSentences[key];
        return state === 'edited' || state === 'added';
      });
    });
  };

  // Edit indicator SVG
  const editIndicator = (
    <span className="edit-indicator">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="m15 5 4 4" />
      </svg>
      <span className="edit-tag">edit</span>
    </span>
  );

  // Helper: render a single editable field (used by renderFieldGroupSection)
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
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isFieldEdited ? 'modified' : ''}`}>
          <div
            className={`row-content ${canEdit ? 'editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue)}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isPending && editIndicator}
          </div>
          <button
            className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(displayValue, copyId)}
          >
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && (
          <div className="modified-badge">edited — click approve to save</div>
        )}
      </div>
    );
  };

  // Get all record text for Copy All
  const getAllRecordText = (record, idx) => {
    const lines = [];
    lines.push(`STRESS MANAGEMENT REFERRAL ${idx + 1}`);
    lines.push('═══════════════════════════════════════');

    // Referral Information
    const refFields = [
      ['Date', record.date ? formatDate(record.date) : null],
      ['Status', record.status],
      ['Urgency', record.urgency],
      ['Specialty', record.specialty],
      ['Referring Provider', record.referringProvider],
    ].filter(([, v]) => v && String(v).trim());
    if (refFields.length > 0) {
      lines.push('\nREFERRAL INFORMATION');
      lines.push('───────────────────────────────────────');
      refFields.forEach(([label, value]) => {
        lines.push(`${label}:\n   ${value}`);
      });
    }

    // Reason for Referral — labeled items first, then generic
    const reasonSentences = record._reasonSentences || splitBySentence(record.reason || '');
    if (reasonSentences.length > 0) {
      const reasonParsed = reasonSentences.map(s => ({ ...parseLabel(s), raw: s }));
      reasonParsed.sort((a, b) => {
        if (a.isLabeled && !b.isLabeled) return -1;
        if (!a.isLabeled && b.isLabeled) return 1;
        return 0;
      });
      lines.push('\nREASON FOR REFERRAL');
      lines.push('───────────────────────────────────────');
      reasonParsed.forEach((p, i) => {
        if (p.isLabeled) {
          lines.push(`\n${p.label}:`);
          lines.push(`   ${i + 1}. ${p.value}`);
        } else {
          lines.push(`${i + 1}. ${p.raw}`);
        }
      });
    }

    // Notes — labeled items first, then generic
    const notesSentences = record._notesSentences || splitBySentence(record.notes || '');
    if (notesSentences.length > 0) {
      const notesParsed = notesSentences.map(s => ({ ...parseLabel(s), raw: s }));
      notesParsed.sort((a, b) => {
        if (a.isLabeled && !b.isLabeled) return -1;
        if (!a.isLabeled && b.isLabeled) return 1;
        return 0;
      });
      lines.push('\nNOTES');
      lines.push('───────────────────────────────────────');
      notesParsed.forEach((p, i) => {
        if (p.isLabeled) {
          lines.push(`\n${p.label}:`);
          lines.push(`   ${i + 1}. ${p.value}`);
        } else {
          lines.push(`${i + 1}. ${p.raw}`);
        }
      });
    }

    return lines.join('\n');
  };

  // Empty state
  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <div className="stress-management-referrals-document">
        <div className="document-header">
          <h1 className="document-title">Stress Management Referrals</h1>
        </div>
        <div className="empty-state">No stress management referrals available</div>
      </div>
    );
  }

  // ==================== LEVEL 1: Filter records based on search ====================
  const isSearching = searchTerm.trim().length > 0;

  const filteredRecords = unwrappedData.map((record, idx) => {
    if (!isSearching) return { ...record, _show: true, _showAllSections: false };

    // Build searchable text for Level 1 (record-level gate)
    const searchableText = [
      // Record title
      `Stress Management Referral ${idx + 1}`, `stress management referral ${idx + 1}`,

      // Section titles (ALL must be here for Level 1 gate!)
      'Referral Information', 'referral information',
      'Reason for Referral', 'reason for referral', 'reason',
      'Notes', 'notes', 'referral notes',

      // Field labels
      'Date', 'date',
      'Status', 'status',
      'Urgency', 'urgency',
      'Specialty', 'specialty',
      'Referring Provider', 'referring provider', 'provider',

      // Common search terms
      'stress management', 'stress', 'referral',
      'scheduled', 'routine', 'urgent',
      'MBSR', 'mindfulness', 'relaxation', 'biofeedback',
      'yoga', 'meditation', 'therapy',

      // Field values
      record.date ? formatDate(record.date) : null,
      record.status,
      record.urgency,
      record.specialty,
      record.referringProvider,
      record.reason,
      record.notes,
    ].filter(Boolean).join(' ').toLowerCase();

    const searchLower = searchTerm.toLowerCase().trim();
    const matchesLevel1 = searchableText.includes(searchLower);

    if (!matchesLevel1) return { ...record, _show: false };

    // _showAllSections = true ONLY when searching for document title
    const docTitle = `stress management referral ${idx + 1}`;
    const _showAllSections = searchLower === docTitle ||
      /^stress\s+management\s+referral(s)?\s*\d*$/i.test(searchTerm.trim());

    return { ...record, _show: true, _showAllSections };
  }).filter(r => r._show);

  // Helper: render a text section with per-sentence editing + label:value minicards
  const renderTextSection = (record, recordWithFlag, idx, fieldName, title, sectionKey, sectionObj) => {
    if (!sectionObj.show) return null;

    const canEdit = !!record._id;
    const recordStatus = statusOverrides[idx] || 'active';
    const hasPendingEdits = sectionHasEdits(sectionKey, idx);

    // Get effective value — full-field edit is authoritative
    const fullEditKey = `${fieldName}-${idx}`;
    const hasFullEdit = localEdits[fullEditKey] !== undefined;
    const sourceText = hasFullEdit ? localEdits[fullEditKey] : (record[fieldName] || '');
    if (!sourceText || !sourceText.trim()) return null;

    // Split by sentences with parenthesis + title protection
    const currentSentences = splitBySentence(sourceText);
    if (currentSentences.length === 0) return null;

    // Build items with original index preserved through filtering
    const items = currentSentences
      .map((sentence, origIdx) => {
        // Apply per-sentence overlay if splitting from original (no full edit)
        let displaySentence = sentence;
        if (!hasFullEdit) {
          const pKey = `${fieldName}.s${origIdx}-${idx}`;
          if (localEdits[pKey] !== undefined) displaySentence = localEdits[pKey];
        }
        // Parse label:value
        const parsed = parseLabel(displaySentence);
        return { ...parsed, origIdx, fullSentence: displaySentence };
      })
      .filter(item => {
        if (sectionObj.bypassL4) return true;
        return shouldShowRow(recordWithFlag, item.label || title, item.value);
      })
      .sort((a, b) => {
        // Labeled items (mini-cards with nested subtitles) first, then generic
        if (a.isLabeled && !b.isLabeled) return -1;
        if (!a.isLabeled && b.isLabeled) return 1;
        return 0; // preserve original order within same type
      });

    if (items.length === 0) return null;

    // Copy Section text builder — labeled items first, then generic
    const copySectionText = () => {
      const sentences = splitBySentence(sourceText);
      const parsed = sentences.map(s => ({ ...parseLabel(s), raw: s }));
      // Sort: labeled first, then generic (preserves order within each group)
      parsed.sort((a, b) => {
        if (a.isLabeled && !b.isLabeled) return -1;
        if (!a.isLabeled && b.isLabeled) return 1;
        return 0;
      });
      const lines = [title.toUpperCase(), '═══════════════════════════════════════'];
      parsed.forEach((p, i) => {
        if (p.isLabeled) {
          lines.push(`\n${p.label}:`);
          lines.push(`   ${i + 1}. ${p.value}`);
        } else {
          lines.push(`${i + 1}. ${p.raw}`);
        }
      });
      return lines.join('\n');
    };

    return (
      <div className="section" key={fieldName}>
        <div className="mini-cards-container">
          <div className="section-header">
            <h3 className="section-title">{highlightText(title)}</h3>
            <div className="header-right-actions">
              <button
                className={`copy-btn ${copiedSectionId === `${sectionKey}-${idx}` ? 'copied' : ''}`}
                onClick={() => copySectionToClipboard(copySectionText(), `${sectionKey}-${idx}`)}
              >
                {copiedSectionId === `${sectionKey}-${idx}` ? 'Copied!' : 'Copy Section'}
              </button>
              {(hasPendingEdits || approvedSections[sectionKey]) && (
                <button
                  className={`approve-btn${approvedSections[sectionKey] ? ' approved' : ''}`}
                  onClick={() => handleApprove(record, idx, sectionKey)}
                  disabled={approving}
                >
                  {approving ? 'Approving...' : approvedSections[sectionKey] ? 'Approved' : 'Approve'}
                </button>
              )}
            </div>
          </div>

          {/* Per-sentence rows — labeled items get rec-mini-card + nested-subtitle */}
          {items.map(item => {
            const { label, value: itemValue, isLabeled, origIdx: sIdx, fullSentence } = item;
            const editKey = `${fieldName}-${idx}-s${sIdx}`;
            const isEditing = editingField === editKey;
            const sentenceState = editedSentences[editKey];
            const isEdited = sentenceState === 'edited' && recordStatus !== 'approved';
            const isAdded = sentenceState === 'added';

            // Edit text — strip trailing punctuation before showing in textarea
            const editText = fullSentence.replace(/[.!?;]+$/, '').trim();

            // ========== EDIT MODE ==========
            if (isEditing) {
              return (
                <div key={sIdx} className="rec-mini-card">
                  {isLabeled && <div className="nested-subtitle">{highlightText(label)}</div>}
                  <div className="numbered-row edit-row">
                    <div className="edit-field-container">
                      <textarea
                        ref={textareaRef}
                        className="edit-textarea"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        rows={Math.max(2, editValue.split('\n').length)}
                        disabled={saving}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') handleCancelEdit();
                          if (e.key === 'Enter' && e.ctrlKey) {
                            e.preventDefault();
                            // Save with full text reconstruction
                            let editedSentence = editValue.trim();
                            if (editedSentence && !/[.!?]$/.test(editedSentence)) editedSentence += '.';

                            const allCurrent = splitBySentence(sourceText);
                            const updated = allCurrent.map((s, i) => {
                              let t;
                              if (i === sIdx) {
                                t = editedSentence;
                              } else if (!hasFullEdit) {
                                const pKey = `${fieldName}.s${i}-${idx}`;
                                t = localEdits[pKey] !== undefined ? localEdits[pKey] : s;
                              } else {
                                t = s;
                              }
                              // CRITICAL: Add period to ALL sentences, not just edited one
                              return (t && !/[.!?]$/.test(t)) ? t + '.' : t;
                            });
                            const fullText = updated.join(' ');

                            // Detect added sentences
                            const newSentences = splitBySentence(fullText);
                            const extraCount = newSentences.length - allCurrent.length;
                            if (extraCount > 0) {
                              const editedMap = {};
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

                            handleSaveField(record, fieldName, idx, sectionKey, undefined, fullText, sIdx);
                          }
                        }}
                      />
                      <div className="edit-actions">
                        <button
                          className="edit-save-btn"
                          onClick={() => {
                            // Save with full text reconstruction
                            let editedSentence = editValue.trim();
                            if (editedSentence && !/[.!?]$/.test(editedSentence)) editedSentence += '.';

                            const allCurrent = splitBySentence(sourceText);
                            const updated = allCurrent.map((s, i) => {
                              let t;
                              if (i === sIdx) {
                                t = editedSentence;
                              } else if (!hasFullEdit) {
                                const pKey = `${fieldName}.s${i}-${idx}`;
                                t = localEdits[pKey] !== undefined ? localEdits[pKey] : s;
                              } else {
                                t = s;
                              }
                              // CRITICAL: Add period to ALL sentences
                              return (t && !/[.!?]$/.test(t)) ? t + '.' : t;
                            });
                            const fullText = updated.join(' ');

                            // Detect added sentences
                            const newSentences = splitBySentence(fullText);
                            const extraCount = newSentences.length - allCurrent.length;
                            if (extraCount > 0) {
                              const editedMap = {};
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

                            handleSaveField(record, fieldName, idx, sectionKey, undefined, fullText, sIdx);
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

            // ========== VIEW MODE — LABELED (rec-mini-card with nested-subtitle) ==========
            if (isLabeled) {
              return (
                <React.Fragment key={sIdx}>
                  <div className="rec-mini-card">
                    <div className="nested-subtitle">{highlightText(label)}</div>
                    <div className={`numbered-row${isEdited ? ' modified' : ''}${isAdded ? ' added' : ''}`}>
                      <div
                        className={`row-content${canEdit ? ' editable' : ''}`}
                        onClick={() => canEdit && handleStartEdit(fieldName, idx, editText, sIdx)}
                        title={canEdit ? 'Click to edit' : undefined}
                      >
                        <span className="content-value">{highlightText(itemValue)}</span>
                        {canEdit && !isEdited && !isAdded && editIndicator}
                      </div>
                      <button
                        className={`copy-btn ${copiedId === `${fieldName}-${idx}-s${sIdx}` ? 'copied' : ''}`}
                        onClick={() => copyToClipboard(`${label}: ${itemValue}`, `${fieldName}-${idx}-s${sIdx}`)}
                      >
                        {copiedId === `${fieldName}-${idx}-s${sIdx}` ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    {isEdited && <div className="modified-badge">Modified</div>}
                    {isAdded && <div className="added-badge">Added</div>}
                  </div>
                </React.Fragment>
              );
            }

            // ========== VIEW MODE — GENERIC (wrapped in rec-mini-card for uniform look) ==========
            return (
              <React.Fragment key={sIdx}>
                <div className="rec-mini-card">
                  <div className={`numbered-row${isEdited ? ' modified' : ''}${isAdded ? ' added' : ''}`}>
                    <div
                      className={`row-content${canEdit ? ' editable' : ''}`}
                      onClick={() => canEdit && handleStartEdit(fieldName, idx, editText, sIdx)}
                      title={canEdit ? 'Click to edit' : undefined}
                    >
                      <span className="content-value">{highlightText(itemValue)}</span>
                      {canEdit && !isEdited && !isAdded && editIndicator}
                    </div>
                    <button
                      className={`copy-btn ${copiedId === `${fieldName}-${idx}-s${sIdx}` ? 'copied' : ''}`}
                      onClick={() => copyToClipboard(itemValue, `${fieldName}-${idx}-s${sIdx}`)}
                    >
                      {copiedId === `${fieldName}-${idx}-s${sIdx}` ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  {isEdited && <div className="modified-badge">Modified</div>}
                  {isAdded && <div className="added-badge">Added</div>}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  // Helper: render a grouped field section (multiple label:value pairs in one container) — now with editing
  const renderFieldGroupSection = (record, recordWithFlag, idx, fields, title, sectionKey, sectionObj) => {
    if (!sectionObj.show) return null;

    const canEdit = !!record._id;
    const recordStatus = statusOverrides[idx] || 'active';
    const hasPendingEdits = sectionHasEdits(sectionKey, idx);

    // Build fields with effective values (local edits override originals)
    const effectiveFields = fields.map(([label, value, fieldName]) => {
      if (!fieldName) return [label, value, null];
      const effectiveVal = getFieldValue(record, fieldName, idx);
      return [label, effectiveVal ? String(effectiveVal) : value, fieldName];
    });

    const validFields = effectiveFields.filter(([, v]) => v && String(v).trim());
    if (validFields.length === 0) return null;

    // Level 4 filtering
    const visibleFields = validFields.filter(([label, value]) => {
      if (sectionObj.bypassL4) return true;
      return shouldShowRow(recordWithFlag, label, value);
    });
    if (visibleFields.length === 0) return null;

    return (
      <div className="section" key={sectionKey}>
        <div className="mini-cards-container">
          <div className="section-header">
            <h3 className="section-title">{highlightText(title)}</h3>
            <div className="header-right-actions">
              <button
                className={`copy-btn ${copiedSectionId === `${sectionKey}-${idx}` ? 'copied' : ''}`}
                onClick={() => {
                  const lines = [title.toUpperCase(), '═══════════════════════════════════════'];
                  validFields.forEach(([label, value]) => {
                    lines.push(`${label}:\n   ${value}`);
                  });
                  copySectionToClipboard(lines.join('\n'), `${sectionKey}-${idx}`);
                }}
              >
                {copiedSectionId === `${sectionKey}-${idx}` ? 'Copied!' : 'Copy Section'}
              </button>
              {(hasPendingEdits || approvedSections[sectionKey]) && (
                <button
                  className={`approve-btn${approvedSections[sectionKey] ? ' approved' : ''}`}
                  onClick={() => handleApprove(record, idx, sectionKey)}
                  disabled={approving}
                >
                  {approving ? 'Approving...' : approvedSections[sectionKey] ? 'Approved' : 'Approve'}
                </button>
              )}
            </div>
          </div>

          {visibleFields.map(([label, value, fieldName], fIdx) => {
            // Date fields are NOT editable
            if (!fieldName || label === 'Date') {
              return (
                <div key={fIdx} className="rec-mini-card">
                  <div className="nested-subtitle">{highlightText(label)}</div>
                  <div className="numbered-row">
                    <div className="row-content">
                      <span className="content-value">{highlightText(value)}</span>
                    </div>
                    <button
                      className={`copy-btn ${copiedId === `${sectionKey}-${idx}-${fIdx}` ? 'copied' : ''}`}
                      onClick={() => copyToClipboard(`${label}: ${value}`, `${sectionKey}-${idx}-${fIdx}`)}
                    >
                      {copiedId === `${sectionKey}-${idx}-${fIdx}` ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              );
            }

            // Editable fields
            return renderEditableField(record, idx, fieldName, label, value, sectionKey, `${sectionKey}-${idx}-${fIdx}`);
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="stress-management-referrals-document">
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">Stress Management Referrals</h1>

        {/* Header Actions - Row 2 */}
        <div className="header-actions">
          <button
            className={`copy-btn ${copiedId === 'copy-all' ? 'copied' : ''}`}
            onClick={() => {
              const allText = pdfData.map((r, i) => getAllRecordText(r, i)).join('\n\n');
              copyToClipboard(allText, 'copy-all');
            }}
          >
            {copiedId === 'copy-all' ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<StressManagementReferralsDocumentPDFTemplate document={pdfData} />}
            fileName="stress-management-referrals.pdf"
            className="pdf-btn"
          >
            {({ loading }) => loading ? 'Preparing...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>

        {/* Search - Row 3 */}
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search stress management referrals..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')}>&times;</button>
          )}
        </div>
      </div>

      {/* No results */}
      {filteredRecords.length === 0 && isSearching && (
        <div className="no-results">No results found for "{searchTerm}"</div>
      )}

      {/* Records */}
      {filteredRecords.map((recordWithFlag, idx) => {
        const record = recordWithFlag;

        // ==================== LEVEL 2: IIFE Section Visibility ====================

        // Referral Information (grouped: date, status, urgency, specialty, referringProvider)
        const referralInfoSection = (() => {
          if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
          const sectionTitleMatch = sectionTitleMatchesSearch('Referral Information', 'referral info', 'referral details');
          if (sectionTitleMatch) return { show: true, bypassL4: true };
          const hasMatchingContent = shouldShowRow(recordWithFlag,
            'Date', 'date', record.date ? formatDate(record.date) : null,
            'Status', 'status', record.status,
            'Urgency', 'urgency', record.urgency,
            'Specialty', 'specialty', record.specialty,
            'Referring Provider', 'referring provider', 'provider', record.referringProvider
          );
          return { show: hasMatchingContent, bypassL4: false };
        })();

        // Reason for Referral
        const reasonSection = (() => {
          if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
          const sectionTitleMatch = sectionTitleMatchesSearch('Reason for Referral', 'reason', 'referral reason');
          if (sectionTitleMatch) return { show: true, bypassL4: true };
          const effectiveReason = getFieldValue(record, 'reason', idx);
          const sentences = splitBySentence(effectiveReason || '');
          const hasMatchingContent = sentences.some(s => {
            const parsed = parseLabel(s);
            return shouldShowRow(recordWithFlag, parsed.label || '', parsed.value);
          });
          return { show: hasMatchingContent, bypassL4: false };
        })();

        // Notes
        const notesSection = (() => {
          if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
          const sectionTitleMatch = sectionTitleMatchesSearch('Notes', 'referral notes');
          if (sectionTitleMatch) return { show: true, bypassL4: true };
          const effectiveNotes = getFieldValue(record, 'notes', idx);
          const sentences = splitBySentence(effectiveNotes || '');
          const hasMatchingContent = sentences.some(s => {
            const parsed = parseLabel(s);
            return shouldShowRow(recordWithFlag, parsed.label || '', parsed.value);
          });
          return { show: hasMatchingContent, bypassL4: false };
        })();

        return (
          <div key={idx} className="record-card">
            {/* Record Header */}
            <div className="record-header">
              <div className="header-top-row">
                {record.date && (
                  <span className="date-badge">{formatDate(record.date)}</span>
                )}
              </div>
              <h2 className="record-title">{highlightText(`Stress Management Referral ${idx + 1}`)}</h2>
            </div>

            {/* ========== Referral Information (grouped) ========== */}
            {renderFieldGroupSection(record, recordWithFlag, idx,
              [
                ['Date', record.date ? formatDate(record.date) : null, null],
                ['Status', record.status, 'status'],
                ['Urgency', record.urgency, 'urgency'],
                ['Specialty', record.specialty, 'specialty'],
                ['Referring Provider', record.referringProvider, 'referringProvider'],
              ],
              'Referral Information', 'referralInfo', referralInfoSection
            )}

            {/* ========== Reason for Referral ========== */}
            {record.reason && renderTextSection(record, recordWithFlag, idx, 'reason', 'Reason for Referral', 'reason', reasonSection)}

            {/* ========== Notes ========== */}
            {record.notes && renderTextSection(record, recordWithFlag, idx, 'notes', 'Notes', 'notes', notesSection)}
          </div>
        );
      })}
    </div>
  );
};

export default StressManagementReferralsDocument;
