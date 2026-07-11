/**
 * TherapyProgressNotesDocument.jsx
 * February 2026 Standard Template
 *
 * Features:
 * - Own useState for searchTerm (not prop)
 * - PDFDownloadLink import (not onExportPDF)
 * - 4-level search with IIFE sectionTitleMatches pattern
 * - parseSubtitleItems for text fields with "Label: detail" patterns
 * - Blue theme: #0d1929, #93c5fd, rgba(96, 165, 250, 0.3)
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import TherapyProgressNotesDocumentPDFTemplate from '../pdf-templates/TherapyProgressNotesDocumentPDFTemplate';
import './TherapyProgressNotesDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'therapy_progress_notesPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const TherapyProgressNotesDocument = ({ document, data }) => {
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
    unwrappedData.forEach((record, idx) => {
      const rid = record && record._id ? (record._id.$oid || record._id) : null;
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // map fieldPart back to its owning sectionId so the section shows edited + Pending Approve
        const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
        const sectionId = Object.keys(SECTION_FIELDS).find(sid => SECTION_FIELDS[sid].includes(baseField));
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

  // Parse "Label: detail" subtitle items for text fields
  // Splits on semicolons first, then falls back to sentence boundaries
  const parseSubtitleItems = (text) => {
    if (!text || typeof text !== 'string') return [];
    // If text contains semicolons, split on them (e.g. "PHQ-9: 16/27; GAD-7: 14/21")
    let segments;
    if (text.includes(';')) {
      segments = text.split(/;\s*/).filter(s => s.trim());
    } else {
      // Fallback: split on sentence boundaries but NOT after abbreviations
      segments = text.split(/(?<!(?:Dr|Mr|Mrs|Ms|Jr|Sr|St|vs|etc)\.)(?<=\.)\s+(?=[A-Z])/).filter(s => s.trim());
    }
    if (segments.length === 0) return [];
    return segments.map(segment => {
      const colonMatch = segment.match(/^([^:]+?):\s*(.+)$/s);
      if (colonMatch && colonMatch[1].length < 80) {
        return { label: colonMatch[1].trim(), value: colonMatch[2].trim().replace(/\.$/, ''), isGeneric: false };
      }
      return { label: '', value: segment.trim().replace(/\.$/, ''), isGeneric: true };
    });
  };

  // Parse array subtitle items (for therapeuticInterventionsProvided)
  const parseArraySubtitleItems = (items) => {
    if (!items || !Array.isArray(items)) return [];
    return items.map(item => {
      if (typeof item !== 'string') return { label: null, content: String(item) };
      const colonIdx = item.indexOf(':');
      if (colonIdx > 0 && colonIdx < 60) {
        return {
          label: item.substring(0, colonIdx).trim(),
          content: item.substring(colonIdx + 1).trim()
        };
      }
      return { label: null, content: item };
    });
  };

  // Sentence splitter with title protection (Mr., Dr., etc.) and quote awareness
  const splitBySentence = (text) => {
    if (!text || typeof text !== 'string') return [];

    const sentences = [];
    let current = '';
    let quoteDepth = 0;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const prev = i > 0 ? text[i - 1] : '';
      const next = i < text.length - 1 ? text[i + 1] : '';

      // Track single quotes (distinguish from apostrophes like I've, it's, don't)
      if (ch === "'") {
        const prevIsLetter = /[a-zA-Z]/.test(prev);
        const nextIsLetter = /[a-zA-Z]/.test(next);
        if (prevIsLetter && nextIsLetter) {
          // Apostrophe — no change to quote depth
        } else if (quoteDepth > 0) {
          quoteDepth--;
        } else {
          quoteDepth++;
        }
        current += ch;
        // Sentence boundary at closing quote after period: `.' `
        if (quoteDepth === 0 && prev === '.' && i + 1 < text.length && /\s/.test(next)) {
          const sentence = current.trim();
          if (sentence) sentences.push(sentence);
          current = '';
          while (i + 1 < text.length && /\s/.test(text[i + 1])) i++;
        }
        continue;
      }

      // Track double quotes
      if (ch === '"' || ch === '\u201C' || ch === '\u201D') {
        if (ch === '"') quoteDepth = quoteDepth > 0 ? quoteDepth - 1 : quoteDepth + 1;
        else if (ch === '\u201C') quoteDepth++;
        else quoteDepth--;
      }

      current += ch;

      // Check for sentence boundary: `. ` outside of quotes
      if (ch === '.' && quoteDepth === 0 && i + 1 < text.length && /\s/.test(next)) {
        if (!/\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc)\.$/i.test(current.trimEnd())) {
          const sentence = current.replace(/\.\s*$/, '').trim();
          if (sentence) sentences.push(sentence);
          current = '';
          while (i + 1 < text.length && /\s/.test(text[i + 1])) i++;
        }
      }
    }

    // Add remaining text
    const remaining = current.replace(/\.$/, '').trim();
    if (remaining) sentences.push(remaining);

    return sentences;
  };

  // Semicolon splitter for score/metric fields
  const splitBySemicolon = (text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/;\s*/).map(s => s.trim()).filter(Boolean);
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

  const persistToLocalStorage = useCallback((recordId, fieldName, newValue) => {
    try {
      const key = 'artifactGridData';
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const gridData = JSON.parse(raw);
      const walk = (node) => {
        if (!node) return false;
        if (Array.isArray(node)) return node.some(walk);
        if (typeof node === 'object') {
          if (node._id === recordId) { node[fieldName] = newValue; return true; }
          return Object.values(node).some(walk);
        }
        return false;
      };
      if (walk(gridData)) localStorage.setItem(key, JSON.stringify(gridData));
    } catch (e) { /* ignore */ }
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
    const recordId = record._id && (record._id.$oid || record._id);
    if (!recordId) return;
    const saveValue = (valueOverride !== undefined ? valueOverride : editValue.trim());
    const fieldPart = (typeof arrayIndex === 'number') ? `${fieldName}.${arrayIndex}` : fieldName;
    const editKey = `${fieldPart}-${idx}`;
    const sKey = `${fieldPart}-${idx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;

    setLocalEdits(prev => ({ ...prev, [editKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow
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
    const recordId = record._id && (record._id.$oid || record._id);
    if (!recordId) return;
    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayElem = lastDot !== -1 && /^\d+$/.test(trailing);
        const payload = { field: isArrayElem ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArrayElem) payload.arrayIndex = parseInt(trailing, 10);
        const response = await secureApiClient.put(`/api/edit/therapy_progress_notes/${recordId}/edit`, payload);
        if (!response || !response.success) throw new Error((response && response.error) || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/therapy_progress_notes/${recordId}/approve`);

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
      console.error('[TherapyProgressNotes] Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // ============== SECTION_FIELDS + sectionHasEdits ==============
  const SECTION_FIELDS = {
    'subjective': ['patientSubjectiveReport'],
    'functional': ['functionalOutcomeMeasures'],
    'pain': ['painScaleAssessment'],
    'cognitive': ['cognitiveFunctionAssessment'],
    'interventions': ['therapeuticInterventionsProvided'],
    'compliance': ['patientComplianceLevel'],
    'homeExercise': ['homeExerciseProgramStatus'],
    'discharge': ['dischargeReadinessIndicators'],
    'adverse': ['adverseEventsDocumentation'],
    'family': ['familyCaregiverEducation'],
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

  // ============== RENDER EDITABLE SENTENCE ROWS (per-row editing) ==============
  const renderEditableSentenceRows = (record, recordWithFlag, idx, fieldName, sectionId, sectionObj, splitter = splitBySentence, withSubtitles = false) => {
    const canEdit = !!record._id;
    const isSemicolon = splitter === splitBySemicolon;
    const joiner = isSemicolon ? '; ' : ' ';

    // Get source text: full-field edit if available, otherwise original
    const fullEditKey = `${fieldName}-${idx}`;
    const hasFullEdit = localEdits[fullEditKey] !== undefined;
    const sourceText = hasFullEdit ? localEdits[fullEditKey] : (record[fieldName] || '');
    const sentences = splitter(sourceText);

    if (sentences.length === 0) return null;

    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];

    // Preserve original index through search filter
    const visibleSentences = sentences
      .map((sentence, origIdx) => ({ sentence, origIdx }))
      .filter(({ sentence }) => {
        if (!isSearching || sectionObj.bypassL4) return true;
        return shouldShowRow(recordWithFlag, sentence);
      });

    if (visibleSentences.length === 0) return null;

    return visibleSentences.map(({ sentence, origIdx: sIdx }) => {
      const editKey = `${fieldName}-${idx}-s${sIdx}`;
      const isEditing = editingField === editKey;
      const isEdited = sectionWasEdited && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';
      const isAdded = sectionWasEdited && editedSentences[editKey] === 'added' && statusOverrides[idx] !== 'approved';
      const copyId = `${fieldName}-${idx}-${sIdx}`;

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
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    let edited = editValue.trim();
                    if (!isSemicolon && edited && !/[.!?]$/.test(edited)) edited += '.';
                    const allCurrent = splitter(sourceText);
                    const updated = allCurrent.map((s, i) => {
                      const t = i === sIdx ? edited : s;
                      if (isSemicolon) return t;
                      return (t && !/[.!?]['"]?\s*$/.test(t)) ? t + '.' : t;
                    });
                    const fullText = updated.join(joiner);
                    handleSaveField(record, fieldName, idx, sectionId, undefined, fullText, sIdx);
                  }
                }}
                rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))}
                disabled={saving}
              />
              <div className="edit-actions">
                <button className="edit-save-btn" onClick={() => {
                  let edited = editValue.trim();
                  if (!isSemicolon && edited && !/[.!?]$/.test(edited)) edited += '.';
                  const allCurrent = splitter(sourceText);
                  const updated = allCurrent.map((s, i) => {
                    const t = i === sIdx ? edited : s;
                    if (isSemicolon) return t;
                    return (t && !/[.!?]['"]?\s*$/.test(t)) ? t + '.' : t;
                  });
                  const fullText = updated.join(joiner);
                  handleSaveField(record, fieldName, idx, sectionId, undefined, fullText, sIdx);
                }} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
              </div>
            </div>
          </div>
        );
      }

      // Parse label patterns for nested-subtitle rendering
      if (withSubtitles) {
        const colonIdx = sentence.indexOf(':');
        const dashIdx = sentence.indexOf(' - ');
        const textBeforeColon = colonIdx > 0 ? sentence.substring(0, colonIdx) : '';

        // Case 1: "Label - SubLabel: val, SubLabel: val, ..." → nested structure with sub-rows
        if (dashIdx > 0 && dashIdx < 50) {
          const mainLabel = sentence.substring(0, dashIdx).trim();
          const remainder = sentence.substring(dashIdx + 3).trim();
          const subItems = remainder.split(/,\s*/).filter(Boolean);
          const parsedSubs = subItems.map(sub => {
            const ci = sub.indexOf(':');
            if (ci > 0) return { label: sub.substring(0, ci).trim(), value: sub.substring(ci + 1).trim() };
            return { label: null, value: sub.trim() };
          });

          // Level 4: filter sub-items by search (label-only check on main label)
          const mainLabelMatches = !isSearching || sectionObj.bypassL4 || shouldShowRow(recordWithFlag, mainLabel);
          const visibleSubs = mainLabelMatches
            ? parsedSubs
            : parsedSubs.filter(sub => shouldShowRow(recordWithFlag, sub.label, sub.value));
          if (visibleSubs.length === 0) return null;

          return (
            <div className="rec-mini-card" key={sIdx}>
              <div className="nested-subtitle">{highlightText(mainLabel)}</div>
              {visibleSubs.map((sub, si) => (
                <div key={si} className="nested-mini-card">
                  {sub.label && <div className="nested-subtitle sub-label">{highlightText(sub.label)}</div>}
                  <div className={`numbered-row${isEdited ? ' modified' : ''}${isAdded ? ' added' : ''}`}>
                    <div
                      className={`row-content${canEdit ? ' editable' : ''}`}
                      onClick={() => canEdit && handleStartEdit(fieldName, idx, sentence, sIdx)}
                      title={canEdit ? 'Click to edit' : undefined}
                    >
                      <span className="content-value">{highlightText(sub.value)}</span>
                      {canEdit && si === 0 && !isEdited && !isAdded && editIndicator}
                    </div>
                    <button
                      className={`copy-btn ${copiedId === `${copyId}-${si}` ? 'copied' : ''}`}
                      onClick={() => copyToClipboard(`${sub.label ? sub.label + ': ' : ''}${sub.value}`, `${copyId}-${si}`)}
                    >
                      {copiedId === `${copyId}-${si}` ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              ))}
              {isEdited && <div className="modified-badge">edited — click approve to save</div>}
              {isAdded && <div className="added-badge">Added</div>}
            </div>
          );
        }

        // Case 2: "Label: Value" → simple nested-subtitle + value
        if (colonIdx > 0 && colonIdx < 50) {
          return (
            <div className="rec-mini-card" key={sIdx}>
              <div className="nested-subtitle">{highlightText(textBeforeColon.trim())}</div>
              <div className={`numbered-row${isEdited ? ' modified' : ''}${isAdded ? ' added' : ''}`}>
                <div
                  className={`row-content${canEdit ? ' editable' : ''}`}
                  onClick={() => canEdit && handleStartEdit(fieldName, idx, sentence, sIdx)}
                  title={canEdit ? 'Click to edit' : undefined}
                >
                  <span className="content-value">{highlightText(sentence.substring(colonIdx + 1).trim())}</span>
                  {canEdit && !isEdited && !isAdded && editIndicator}
                </div>
                <button
                  className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
                  onClick={() => copyToClipboard(sentence, copyId)}
                >
                  {copiedId === copyId ? 'Copied!' : 'Copy'}
                </button>
              </div>
              {isEdited && <div className="modified-badge">edited — click approve to save</div>}
              {isAdded && <div className="added-badge">Added</div>}
            </div>
          );
        }
      }

      // Default: flat row (no subtitle parsing)
      return (
        <React.Fragment key={sIdx}>
          <div className={`numbered-row${isEdited ? ' modified' : ''}${isAdded ? ' added' : ''}`}>
            <div
              className={`row-content${canEdit ? ' editable' : ''}`}
              onClick={() => canEdit && handleStartEdit(fieldName, idx, sentence, sIdx)}
              title={canEdit ? 'Click to edit' : undefined}
            >
              <span className="content-value">{highlightText(sentence)}</span>
              {canEdit && !isEdited && !isAdded && editIndicator}
            </div>
            <button
              className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
              onClick={() => copyToClipboard(sentence, copyId)}
            >
              {copiedId === copyId ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {isEdited && <div className="modified-badge">edited — click approve to save</div>}
          {isAdded && <div className="added-badge">Added</div>}
        </React.Fragment>
      );
    });
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
  const getAllRecordText = (record, idx) => {
    const lines = [];
    lines.push(`THERAPY PROGRESS NOTES ${idx + 1}`);
    lines.push('═══════════════════════════════════════');

    // Session Info
    if (record.createdAt || record.sessionDurationMinutes) {
      lines.push('\nSESSION INFORMATION');
      lines.push('───────────────────────────────────────');
      if (record.createdAt) lines.push(`Date:\n   ${formatDate(record.createdAt)}`);
      if (record.sessionDurationMinutes) lines.push(`Session Duration:\n   ${record.sessionDurationMinutes} minutes`);
    }

    // Patient Subjective Report
    if (record.patientSubjectiveReport) {
      lines.push('\nPATIENT SUBJECTIVE REPORT');
      lines.push('───────────────────────────────────────');
      splitBySentence(record.patientSubjectiveReport).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }

    // Functional Outcome Measures
    if (record.functionalOutcomeMeasures) {
      lines.push('\nFUNCTIONAL OUTCOME MEASURES');
      lines.push('───────────────────────────────────────');
      splitBySemicolon(record.functionalOutcomeMeasures).forEach((s, i) => {
        const dashIdx = s.indexOf(' - ');
        if (dashIdx > 0 && dashIdx < 50) {
          const mainLabel = s.substring(0, dashIdx).trim();
          const remainder = s.substring(dashIdx + 3).trim();
          lines.push(`\n${mainLabel}:`);
          remainder.split(/,\s*/).filter(Boolean).forEach(sub => {
            lines.push(`   ${sub.trim()}`);
          });
        } else {
          const colonIdx = s.indexOf(':');
          if (colonIdx > 0 && colonIdx < 50) {
            lines.push(`\n${s.substring(0, colonIdx).trim()}:`);
            lines.push(`   ${s.substring(colonIdx + 1).trim()}`);
          } else {
            lines.push(`${i + 1}. ${s}`);
          }
        }
      });
    }

    // Pain Scale Assessment
    if (record.painScaleAssessment) {
      lines.push('\nPAIN SCALE ASSESSMENT');
      lines.push('───────────────────────────────────────');
      splitBySemicolon(record.painScaleAssessment).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }

    // Cognitive Function Assessment
    if (record.cognitiveFunctionAssessment) {
      lines.push('\nCOGNITIVE FUNCTION ASSESSMENT');
      lines.push('───────────────────────────────────────');
      splitBySentence(record.cognitiveFunctionAssessment).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }

    // Physical Assessments group
    const physFields = [
      ['Range of Motion', record.rangeOfMotionMeasurements],
      ['Muscle Strength', record.muscleStrengthGrading],
      ['Balance Assessment', record.balanceAssessmentScores],
      ['Gait Analysis', record.gaitAnalysisFindings],
    ].filter(([, v]) => v && v.trim());
    if (physFields.length > 0) {
      lines.push('\nPHYSICAL ASSESSMENTS');
      lines.push('───────────────────────────────────────');
      physFields.forEach(([label, value]) => {
        lines.push(`${label}:\n   ${value}`);
      });
    }

    // Additional Assessments group
    const addlFields = [
      ['Activities of Daily Living', record.activitiesOfDailyLivingStatus],
      ['Speech & Language', record.speechLanguageEvaluation],
      ['Respiratory Function', record.respiratoryFunctionMetrics],
      ['Cardiovascular Response', record.cardiovascularResponse],
    ].filter(([, v]) => v && v.trim());
    if (addlFields.length > 0) {
      lines.push('\nADDITIONAL ASSESSMENTS');
      lines.push('───────────────────────────────────────');
      addlFields.forEach(([label, value]) => {
        lines.push(`${label}:\n   ${value}`);
      });
    }

    // Therapeutic Interventions
    if (record.therapeuticInterventionsProvided?.length > 0) {
      lines.push('\nTHERAPEUTIC INTERVENTIONS');
      lines.push('───────────────────────────────────────');
      const parsed = parseArraySubtitleItems(record.therapeuticInterventionsProvided);
      parsed.forEach((item, i) => {
        if (item.label) {
          lines.push(`\n${item.label}:`);
          lines.push(`   ${item.content}`);
        } else {
          lines.push(`${i + 1}. ${item.content}`);
        }
      });
    }

    // Patient Compliance
    if (record.patientComplianceLevel) {
      lines.push('\nPATIENT COMPLIANCE');
      lines.push('───────────────────────────────────────');
      splitBySentence(record.patientComplianceLevel).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }

    // Home Exercise Program
    if (record.homeExerciseProgramStatus) {
      lines.push('\nHOME EXERCISE PROGRAM');
      lines.push('───────────────────────────────────────');
      splitBySentence(record.homeExerciseProgramStatus).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }

    // Assistive Device Recommendations
    if (record.assistiveDeviceRecommendations) {
      lines.push('\nASSISTIVE DEVICE RECOMMENDATIONS');
      lines.push('───────────────────────────────────────');
      splitBySentence(record.assistiveDeviceRecommendations).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }

    // Discharge Readiness
    if (record.dischargeReadinessIndicators) {
      lines.push('\nDISCHARGE READINESS');
      lines.push('───────────────────────────────────────');
      splitBySentence(record.dischargeReadinessIndicators).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }

    // Adverse Events
    if (record.adverseEventsDocumentation) {
      lines.push('\nADVERSE EVENTS');
      lines.push('───────────────────────────────────────');
      splitBySentence(record.adverseEventsDocumentation).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }

    // Family/Caregiver Education
    if (record.familyCaregiverEducation) {
      lines.push('\nFAMILY/CAREGIVER EDUCATION');
      lines.push('───────────────────────────────────────');
      splitBySentence(record.familyCaregiverEducation).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }

    return lines.join('\n');
  };

  // Empty state
  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <div className="therapy-progress-notes-document">
        <div className="document-header">
          <h1 className="document-title">Therapy Progress Notes</h1>
        </div>
        <div className="empty-state">No therapy progress notes available</div>
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
      `Therapy Progress Notes ${idx + 1}`, `therapy progress notes ${idx + 1}`,

      // Section titles (ALL must be here for Level 1 gate!)
      'Session Information', 'session information',
      'Patient Subjective Report', 'patient subjective report', 'subjective',
      'Functional Outcome Measures', 'functional outcome measures', 'outcome measures',
      'Pain Scale Assessment', 'pain scale assessment', 'pain scale', 'pain',
      'Cognitive Function Assessment', 'cognitive function assessment', 'cognitive',
      'Physical Assessments', 'physical assessments',
      'Range of Motion', 'range of motion', 'ROM',
      'Muscle Strength', 'muscle strength', 'strength grading',
      'Balance Assessment', 'balance assessment',
      'Gait Analysis', 'gait analysis',
      'Additional Assessments', 'additional assessments',
      'Activities of Daily Living', 'activities of daily living', 'ADL',
      'Speech & Language', 'speech language', 'speech evaluation',
      'Respiratory Function', 'respiratory function', 'respiratory metrics',
      'Cardiovascular Response', 'cardiovascular response',
      'Therapeutic Interventions', 'therapeutic interventions', 'interventions',
      'Patient Compliance', 'patient compliance', 'compliance level',
      'Home Exercise Program', 'home exercise program', 'exercise program', 'homework',
      'Assistive Device Recommendations', 'assistive device', 'recommendations',
      'Discharge Readiness', 'discharge readiness', 'discharge indicators',
      'Adverse Events', 'adverse events', 'adverse events documentation',
      'Family/Caregiver Education', 'family caregiver education', 'family education',

      // Field labels
      'Session Duration', 'session duration', 'Duration',
      'Date', 'date',

      // Field values
      record.createdAt ? formatDate(record.createdAt) : null,
      record.sessionDurationMinutes ? `${record.sessionDurationMinutes} minutes` : null,
      record.patientSubjectiveReport,
      record.functionalOutcomeMeasures,
      record.painScaleAssessment,
      record.cognitiveFunctionAssessment,
      record.rangeOfMotionMeasurements,
      record.muscleStrengthGrading,
      record.balanceAssessmentScores,
      record.gaitAnalysisFindings,
      record.activitiesOfDailyLivingStatus,
      record.speechLanguageEvaluation,
      record.respiratoryFunctionMetrics,
      record.cardiovascularResponse,
      record.patientComplianceLevel,
      record.homeExerciseProgramStatus,
      record.assistiveDeviceRecommendations,
      record.dischargeReadinessIndicators,
      record.adverseEventsDocumentation,
      record.familyCaregiverEducation,

      // Array values
      ...(record.therapeuticInterventionsProvided || []),
    ].filter(Boolean).join(' ').toLowerCase();

    const searchLower = searchTerm.toLowerCase().trim();
    const matchesLevel1 = searchableText.includes(searchLower);

    if (!matchesLevel1) return { ...record, _show: false };

    // _showAllSections = true ONLY when searching for document title
    const docTitle = `therapy progress notes ${idx + 1}`;
    const _showAllSections = searchLower === docTitle ||
      /^therapy\s+progress\s+notes?\s*\d*$/i.test(searchTerm.trim());

    return { ...record, _show: true, _showAllSections };
  }).filter(r => r._show);

  // Helper: render a text section with parseSubtitleItems
  const renderTextSection = (record, recordWithFlag, idx, fieldName, title, value, sectionKey, sectionObj) => {
    if (!value || !value.trim()) return null;
    if (!sectionObj.show) return null;

    const items = parseSubtitleItems(value);
    if (items.length === 0) return null;

    // Level 4 filtering
    const visibleItems = items.filter(item => {
      if (sectionObj.bypassL4) return true;
      return shouldShowRow(recordWithFlag, item.label, item.value);
    });
    if (visibleItems.length === 0) return null;

    return (
      <div className="section" key={fieldName}>
        <div className="mini-cards-container">
          <div className="section-header">
            <h3 className="section-title">{highlightText(title)}</h3>
            <button
              className={`copy-btn ${copiedSectionId === `${sectionKey}-${idx}` ? 'copied' : ''}`}
              onClick={() => {
                const lines = [title.toUpperCase(), '═══════════════════════════════════════'];
                items.forEach((item, i) => {
                  if (!item.isGeneric) {
                    lines.push(`\n${item.label}:`);
                    lines.push(`   ${item.value}`);
                  } else {
                    lines.push(`${i + 1}. ${item.value}`);
                  }
                });
                copySectionToClipboard(lines.join('\n'), `${sectionKey}-${idx}`);
              }}
            >
              {copiedSectionId === `${sectionKey}-${idx}` ? 'Copied!' : 'Copy Section'}
            </button>
          </div>

          {visibleItems.map((item, iIdx) => (
            <div key={iIdx} className="rec-mini-card">
              {!item.isGeneric && <div className="nested-subtitle">{highlightText(item.label)}</div>}
              <div className="numbered-row">
                <div className="row-content">
                  <span className="content-value">{highlightText(item.value)}</span>
                </div>
                <button
                  className={`copy-btn ${copiedId === `${fieldName}-${idx}-${iIdx}` ? 'copied' : ''}`}
                  onClick={() => copyToClipboard(
                    item.isGeneric ? item.value : `${item.label}: ${item.value}`,
                    `${fieldName}-${idx}-${iIdx}`
                  )}
                >
                  {copiedId === `${fieldName}-${idx}-${iIdx}` ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Helper: render a grouped field section (multiple label:value pairs in one container)
  const renderFieldGroupSection = (record, recordWithFlag, idx, fields, title, sectionKey, sectionObj) => {
    if (!sectionObj.show) return null;

    const validFields = fields.filter(([, v]) => v && String(v).trim());
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
          </div>

          {visibleFields.map(([label, value], fIdx) => (
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
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="therapy-progress-notes-document">
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">Therapy Progress Notes</h1>

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
            document={<TherapyProgressNotesDocumentPDFTemplate document={pdfData} />}
            fileName="therapy-progress-notes.pdf"
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
            placeholder="Search therapy progress notes..."
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

        // Session Information
        const sessionInfoSection = (() => {
          if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
          const sectionTitleMatch = sectionTitleMatchesSearch('Session Information', 'session info', 'session details');
          if (sectionTitleMatch) return { show: true, bypassL4: true };
          const hasMatchingContent = shouldShowRow(recordWithFlag,
            'Session Duration', 'session duration', 'Duration', 'minutes',
            'Date', 'date',
            record.sessionDurationMinutes ? `${record.sessionDurationMinutes} minutes` : null,
            record.createdAt ? formatDate(record.createdAt) : null
          );
          return { show: hasMatchingContent, bypassL4: false };
        })();

        // Patient Subjective Report
        const subjectiveSection = (() => {
          if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
          const sectionTitleMatch = sectionTitleMatchesSearch('Patient Subjective Report', 'subjective report', 'subjective');
          if (sectionTitleMatch) return { show: true, bypassL4: true };
          const items = parseSubtitleItems(record.patientSubjectiveReport || '');
          const hasMatchingContent = items.some(item =>
            shouldShowRow(recordWithFlag, item.label, item.value)
          );
          return { show: hasMatchingContent, bypassL4: false };
        })();

        // Functional Outcome Measures
        const functionalSection = (() => {
          if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
          const sectionTitleMatch = sectionTitleMatchesSearch('Functional Outcome Measures', 'outcome measures', 'functional outcome');
          if (sectionTitleMatch) return { show: true, bypassL4: true };
          const items = parseSubtitleItems(record.functionalOutcomeMeasures || '');
          const hasMatchingContent = items.some(item =>
            shouldShowRow(recordWithFlag, item.label, item.value)
          );
          return { show: hasMatchingContent, bypassL4: false };
        })();

        // Pain Scale Assessment
        const painSection = (() => {
          if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
          const sectionTitleMatch = sectionTitleMatchesSearch('Pain Scale Assessment', 'pain scale', 'pain assessment');
          if (sectionTitleMatch) return { show: true, bypassL4: true };
          const items = parseSubtitleItems(record.painScaleAssessment || '');
          const hasMatchingContent = items.some(item =>
            shouldShowRow(recordWithFlag, item.label, item.value)
          );
          return { show: hasMatchingContent, bypassL4: false };
        })();

        // Cognitive Function Assessment
        const cognitiveSection = (() => {
          if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
          const sectionTitleMatch = sectionTitleMatchesSearch('Cognitive Function Assessment', 'cognitive function', 'cognitive assessment');
          if (sectionTitleMatch) return { show: true, bypassL4: true };
          const items = parseSubtitleItems(record.cognitiveFunctionAssessment || '');
          const hasMatchingContent = items.some(item =>
            shouldShowRow(recordWithFlag, item.label, item.value)
          );
          return { show: hasMatchingContent, bypassL4: false };
        })();

        // Physical Assessments (grouped)
        const physicalSection = (() => {
          if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
          const sectionTitleMatch = sectionTitleMatchesSearch('Physical Assessments', 'range of motion', 'muscle strength', 'balance assessment', 'gait analysis');
          if (sectionTitleMatch) return { show: true, bypassL4: true };
          const hasMatchingContent = shouldShowRow(recordWithFlag,
            'Range of Motion', 'range of motion', 'ROM',
            'Muscle Strength', 'muscle strength',
            'Balance Assessment', 'balance assessment',
            'Gait Analysis', 'gait analysis',
            record.rangeOfMotionMeasurements,
            record.muscleStrengthGrading,
            record.balanceAssessmentScores,
            record.gaitAnalysisFindings
          );
          return { show: hasMatchingContent, bypassL4: false };
        })();

        // Additional Assessments (grouped)
        const additionalSection = (() => {
          if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
          const sectionTitleMatch = sectionTitleMatchesSearch('Additional Assessments', 'activities of daily living', 'speech language', 'respiratory function', 'cardiovascular');
          if (sectionTitleMatch) return { show: true, bypassL4: true };
          const hasMatchingContent = shouldShowRow(recordWithFlag,
            'Activities of Daily Living', 'ADL',
            'Speech & Language', 'speech evaluation',
            'Respiratory Function', 'respiratory',
            'Cardiovascular Response', 'cardiovascular',
            record.activitiesOfDailyLivingStatus,
            record.speechLanguageEvaluation,
            record.respiratoryFunctionMetrics,
            record.cardiovascularResponse
          );
          return { show: hasMatchingContent, bypassL4: false };
        })();

        // Therapeutic Interventions
        const interventionsSection = (() => {
          if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
          const sectionTitleMatch = sectionTitleMatchesSearch('Therapeutic Interventions', 'interventions', 'treatment interventions');
          if (sectionTitleMatch) return { show: true, bypassL4: true };
          const parsed = parseArraySubtitleItems(record.therapeuticInterventionsProvided || []);
          const hasMatchingContent = parsed.some(item =>
            shouldShowRow(recordWithFlag, item.label, item.content)
          );
          return { show: hasMatchingContent, bypassL4: false };
        })();

        // Patient Compliance
        const complianceSection = (() => {
          if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
          const sectionTitleMatch = sectionTitleMatchesSearch('Patient Compliance', 'compliance level', 'compliance');
          if (sectionTitleMatch) return { show: true, bypassL4: true };
          const items = parseSubtitleItems(record.patientComplianceLevel || '');
          const hasMatchingContent = items.some(item =>
            shouldShowRow(recordWithFlag, item.label, item.value)
          );
          return { show: hasMatchingContent, bypassL4: false };
        })();

        // Home Exercise Program
        const homeExerciseSection = (() => {
          if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
          const sectionTitleMatch = sectionTitleMatchesSearch('Home Exercise Program', 'exercise program', 'homework');
          if (sectionTitleMatch) return { show: true, bypassL4: true };
          const items = parseSubtitleItems(record.homeExerciseProgramStatus || '');
          const hasMatchingContent = items.some(item =>
            shouldShowRow(recordWithFlag, item.label, item.value)
          );
          return { show: hasMatchingContent, bypassL4: false };
        })();

        // Assistive Device Recommendations
        const assistiveSection = (() => {
          if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
          const sectionTitleMatch = sectionTitleMatchesSearch('Assistive Device Recommendations', 'assistive device', 'device recommendations');
          if (sectionTitleMatch) return { show: true, bypassL4: true };
          const items = parseSubtitleItems(record.assistiveDeviceRecommendations || '');
          const hasMatchingContent = items.some(item =>
            shouldShowRow(recordWithFlag, item.label, item.value)
          );
          return { show: hasMatchingContent, bypassL4: false };
        })();

        // Discharge Readiness
        const dischargeSection = (() => {
          if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
          const sectionTitleMatch = sectionTitleMatchesSearch('Discharge Readiness', 'discharge indicators', 'discharge');
          if (sectionTitleMatch) return { show: true, bypassL4: true };
          const items = parseSubtitleItems(record.dischargeReadinessIndicators || '');
          const hasMatchingContent = items.some(item =>
            shouldShowRow(recordWithFlag, item.label, item.value)
          );
          return { show: hasMatchingContent, bypassL4: false };
        })();

        // Adverse Events
        const adverseSection = (() => {
          if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
          const sectionTitleMatch = sectionTitleMatchesSearch('Adverse Events', 'adverse events documentation');
          if (sectionTitleMatch) return { show: true, bypassL4: true };
          const items = parseSubtitleItems(record.adverseEventsDocumentation || '');
          const hasMatchingContent = items.some(item =>
            shouldShowRow(recordWithFlag, item.label, item.value)
          );
          return { show: hasMatchingContent, bypassL4: false };
        })();

        // Family/Caregiver Education
        const familySection = (() => {
          if (!isSearching || recordWithFlag._showAllSections) return { show: true, bypassL4: true };
          const sectionTitleMatch = sectionTitleMatchesSearch('Family/Caregiver Education', 'family education', 'caregiver education');
          if (sectionTitleMatch) return { show: true, bypassL4: true };
          const items = parseSubtitleItems(record.familyCaregiverEducation || '');
          const hasMatchingContent = items.some(item =>
            shouldShowRow(recordWithFlag, item.label, item.value)
          );
          return { show: hasMatchingContent, bypassL4: false };
        })();

        return (
          <div key={idx} className="record-card">
            {/* Record Header */}
            <div className="record-header">
              <div className="header-top-row">
                {record.createdAt && (
                  <span className="date-badge">{formatDate(record.createdAt)}</span>
                )}
              </div>
              <h2 className="record-title">{highlightText(`Therapy Progress Notes ${idx + 1}`)}</h2>
            </div>

            {/* ========== Session Information ========== */}
            {sessionInfoSection.show && (record.createdAt || record.sessionDurationMinutes) && (
              <div className="section">
                <div className="mini-cards-container">
                  <div className="section-header">
                    <h3 className="section-title">{highlightText('Session Information')}</h3>
                    <button
                      className={`copy-btn ${copiedSectionId === `session-${idx}` ? 'copied' : ''}`}
                      onClick={() => {
                        const lines = ['SESSION INFORMATION', '═══════════════════════════════════════'];
                        if (record.createdAt) lines.push(`Date:\n   ${formatDate(record.createdAt)}`);
                        if (record.sessionDurationMinutes) lines.push(`Session Duration:\n   ${record.sessionDurationMinutes} minutes`);
                        copySectionToClipboard(lines.join('\n'), `session-${idx}`);
                      }}
                    >
                      {copiedSectionId === `session-${idx}` ? 'Copied!' : 'Copy Section'}
                    </button>
                  </div>

                  {record.createdAt && (!isSearching || sessionInfoSection.bypassL4 || shouldShowRow(recordWithFlag, 'Date', 'date', formatDate(record.createdAt))) && (
                    <div className="rec-mini-card">
                      <div className="nested-subtitle">{highlightText('Date')}</div>
                      <div className="numbered-row">
                        <div className="row-content">
                          <span className="content-value">{highlightText(formatDate(record.createdAt))}</span>
                        </div>
                        <button
                          className={`copy-btn ${copiedId === `date-${idx}` ? 'copied' : ''}`}
                          onClick={() => copyToClipboard(formatDate(record.createdAt), `date-${idx}`)}
                        >
                          {copiedId === `date-${idx}` ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  )}

                  {record.sessionDurationMinutes && (!isSearching || sessionInfoSection.bypassL4 || shouldShowRow(recordWithFlag, 'Session Duration', 'duration', 'minutes', String(record.sessionDurationMinutes))) && (
                    <div className="rec-mini-card">
                      <div className="nested-subtitle">{highlightText('Session Duration')}</div>
                      <div className="numbered-row">
                        <div className="row-content">
                          <span className="content-value">{highlightText(`${record.sessionDurationMinutes} minutes`)}</span>
                        </div>
                        <button
                          className={`copy-btn ${copiedId === `duration-${idx}` ? 'copied' : ''}`}
                          onClick={() => copyToClipboard(`${record.sessionDurationMinutes} minutes`, `duration-${idx}`)}
                        >
                          {copiedId === `duration-${idx}` ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ========== Patient Subjective Report — editable per-sentence ========== */}
            {subjectiveSection.show && getFieldValue(record, 'patientSubjectiveReport', idx) && (
              <div className="section">
                <div className="mini-cards-container">
                  {renderSectionHeader('Patient Subjective Report', `subjective-${idx}`, () => {
                    const lines = ['PATIENT SUBJECTIVE REPORT', '═══════════════════════════════════════'];
                    const r = pdfData[idx] || record;
                    splitBySentence(r.patientSubjectiveReport || '').forEach((s, i) => lines.push(`${i + 1}. ${s}`));
                    copySectionToClipboard(lines.join('\n'), `subjective-${idx}`);
                  }, idx, 'subjective')}
                  {renderEditableSentenceRows(record, recordWithFlag, idx, 'patientSubjectiveReport', 'subjective', subjectiveSection)}
                </div>
              </div>
            )}

            {/* ========== Functional Outcome Measures — editable per-semicolon ========== */}
            {functionalSection.show && getFieldValue(record, 'functionalOutcomeMeasures', idx) && (
              <div className="section">
                <div className="mini-cards-container">
                  {renderSectionHeader('Functional Outcome Measures', `functional-${idx}`, () => {
                    const lines = ['FUNCTIONAL OUTCOME MEASURES', '═══════════════════════════════════════'];
                    const r = pdfData[idx] || record;
                    splitBySemicolon(r.functionalOutcomeMeasures || '').forEach((s, i) => {
                      const dIdx = s.indexOf(' - ');
                      if (dIdx > 0 && dIdx < 50) {
                        const mainLabel = s.substring(0, dIdx).trim();
                        const remainder = s.substring(dIdx + 3).trim();
                        lines.push(`\n${mainLabel}:`);
                        remainder.split(/,\s*/).filter(Boolean).forEach(sub => lines.push(`   ${sub.trim()}`));
                      } else {
                        const ci = s.indexOf(':');
                        if (ci > 0 && ci < 50) {
                          lines.push(`\n${s.substring(0, ci).trim()}:`);
                          lines.push(`   ${s.substring(ci + 1).trim()}`);
                        } else {
                          lines.push(`${i + 1}. ${s}`);
                        }
                      }
                    });
                    copySectionToClipboard(lines.join('\n'), `functional-${idx}`);
                  }, idx, 'functional')}
                  {renderEditableSentenceRows(record, recordWithFlag, idx, 'functionalOutcomeMeasures', 'functional', functionalSection, splitBySemicolon, true)}
                </div>
              </div>
            )}

            {/* ========== Pain Scale Assessment — editable per-semicolon ========== */}
            {painSection.show && getFieldValue(record, 'painScaleAssessment', idx) && (
              <div className="section">
                <div className="mini-cards-container">
                  {renderSectionHeader('Pain Scale Assessment', `pain-${idx}`, () => {
                    const lines = ['PAIN SCALE ASSESSMENT', '═══════════════════════════════════════'];
                    const r = pdfData[idx] || record;
                    splitBySemicolon(r.painScaleAssessment || '').forEach((s, i) => lines.push(`${i + 1}. ${s}`));
                    copySectionToClipboard(lines.join('\n'), `pain-${idx}`);
                  }, idx, 'pain')}
                  {renderEditableSentenceRows(record, recordWithFlag, idx, 'painScaleAssessment', 'pain', painSection, splitBySemicolon)}
                </div>
              </div>
            )}

            {/* ========== Cognitive Function Assessment — editable per-sentence ========== */}
            {cognitiveSection.show && getFieldValue(record, 'cognitiveFunctionAssessment', idx) && (
              <div className="section">
                <div className="mini-cards-container">
                  {renderSectionHeader('Cognitive Function Assessment', `cognitive-${idx}`, () => {
                    const lines = ['COGNITIVE FUNCTION ASSESSMENT', '═══════════════════════════════════════'];
                    const r = pdfData[idx] || record;
                    splitBySentence(r.cognitiveFunctionAssessment || '').forEach((s, i) => lines.push(`${i + 1}. ${s}`));
                    copySectionToClipboard(lines.join('\n'), `cognitive-${idx}`);
                  }, idx, 'cognitive')}
                  {renderEditableSentenceRows(record, recordWithFlag, idx, 'cognitiveFunctionAssessment', 'cognitive', cognitiveSection)}
                </div>
              </div>
            )}

            {/* ========== Physical Assessments (grouped) ========== */}
            {renderFieldGroupSection(record, recordWithFlag, idx,
              [
                ['Range of Motion', record.rangeOfMotionMeasurements],
                ['Muscle Strength', record.muscleStrengthGrading],
                ['Balance Assessment', record.balanceAssessmentScores],
                ['Gait Analysis', record.gaitAnalysisFindings],
              ],
              'Physical Assessments', 'physical', physicalSection
            )}

            {/* ========== Additional Assessments (grouped) ========== */}
            {renderFieldGroupSection(record, recordWithFlag, idx,
              [
                ['Activities of Daily Living', record.activitiesOfDailyLivingStatus],
                ['Speech & Language', record.speechLanguageEvaluation],
                ['Respiratory Function', record.respiratoryFunctionMetrics],
                ['Cardiovascular Response', record.cardiovascularResponse],
              ],
              'Additional Assessments', 'additional', additionalSection
            )}

            {/* ========== Therapeutic Interventions — editable array ========== */}
            {interventionsSection.show && record.therapeuticInterventionsProvided?.length > 0 && (
              <div className="section">
                <div className="mini-cards-container">
                  {renderSectionHeader('Therapeutic Interventions', `interventions-${idx}`, () => {
                    const lines = ['THERAPEUTIC INTERVENTIONS', '═══════════════════════════════════════'];
                    const r = pdfData[idx] || record;
                    const parsed = parseArraySubtitleItems(r.therapeuticInterventionsProvided || []);
                    parsed.forEach((item, i) => {
                      if (item.label) { lines.push(`\n${item.label}:`); lines.push(`   ${item.content}`); }
                      else { lines.push(`${i + 1}. ${item.content}`); }
                    });
                    copySectionToClipboard(lines.join('\n'), `interventions-${idx}`);
                  }, idx, 'interventions')}

                  {record.therapeuticInterventionsProvided.map((item, iIdx) => {
                    if (!interventionsSection.bypassL4 && !shouldShowRow(recordWithFlag, item)) return null;
                    return (
                      <div key={iIdx} className="rec-mini-card">
                        {renderEditableArrayItem(record, 'therapeuticInterventionsProvided', item, idx, iIdx, 'interventions', `intervention-${idx}-${iIdx}`)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ========== Patient Compliance — editable per-sentence ========== */}
            {complianceSection.show && getFieldValue(record, 'patientComplianceLevel', idx) && (
              <div className="section">
                <div className="mini-cards-container">
                  {renderSectionHeader('Patient Compliance', `compliance-${idx}`, () => {
                    const lines = ['PATIENT COMPLIANCE', '═══════════════════════════════════════'];
                    const r = pdfData[idx] || record;
                    splitBySentence(r.patientComplianceLevel || '').forEach((s, i) => lines.push(`${i + 1}. ${s}`));
                    copySectionToClipboard(lines.join('\n'), `compliance-${idx}`);
                  }, idx, 'compliance')}
                  {renderEditableSentenceRows(record, recordWithFlag, idx, 'patientComplianceLevel', 'compliance', complianceSection)}
                </div>
              </div>
            )}

            {/* ========== Home Exercise Program — editable per-sentence ========== */}
            {homeExerciseSection.show && getFieldValue(record, 'homeExerciseProgramStatus', idx) && (
              <div className="section">
                <div className="mini-cards-container">
                  {renderSectionHeader('Home Exercise Program', `homeExercise-${idx}`, () => {
                    const lines = ['HOME EXERCISE PROGRAM', '═══════════════════════════════════════'];
                    const r = pdfData[idx] || record;
                    splitBySentence(r.homeExerciseProgramStatus || '').forEach((s, i) => lines.push(`${i + 1}. ${s}`));
                    copySectionToClipboard(lines.join('\n'), `homeExercise-${idx}`);
                  }, idx, 'homeExercise')}
                  {renderEditableSentenceRows(record, recordWithFlag, idx, 'homeExerciseProgramStatus', 'homeExercise', homeExerciseSection)}
                </div>
              </div>
            )}

            {/* ========== Assistive Device Recommendations — read-only ========== */}
            {renderTextSection(record, recordWithFlag, idx, 'assistive', 'Assistive Device Recommendations', record.assistiveDeviceRecommendations, 'assistive', assistiveSection)}

            {/* ========== Discharge Readiness — editable per-sentence ========== */}
            {dischargeSection.show && getFieldValue(record, 'dischargeReadinessIndicators', idx) && (
              <div className="section">
                <div className="mini-cards-container">
                  {renderSectionHeader('Discharge Readiness', `discharge-${idx}`, () => {
                    const lines = ['DISCHARGE READINESS', '═══════════════════════════════════════'];
                    const r = pdfData[idx] || record;
                    splitBySentence(r.dischargeReadinessIndicators || '').forEach((s, i) => lines.push(`${i + 1}. ${s}`));
                    copySectionToClipboard(lines.join('\n'), `discharge-${idx}`);
                  }, idx, 'discharge')}
                  {renderEditableSentenceRows(record, recordWithFlag, idx, 'dischargeReadinessIndicators', 'discharge', dischargeSection)}
                </div>
              </div>
            )}

            {/* ========== Adverse Events — editable per-sentence ========== */}
            {adverseSection.show && getFieldValue(record, 'adverseEventsDocumentation', idx) && (
              <div className="section">
                <div className="mini-cards-container">
                  {renderSectionHeader('Adverse Events', `adverse-${idx}`, () => {
                    const lines = ['ADVERSE EVENTS', '═══════════════════════════════════════'];
                    const r = pdfData[idx] || record;
                    splitBySentence(r.adverseEventsDocumentation || '').forEach((s, i) => lines.push(`${i + 1}. ${s}`));
                    copySectionToClipboard(lines.join('\n'), `adverse-${idx}`);
                  }, idx, 'adverse')}
                  {renderEditableSentenceRows(record, recordWithFlag, idx, 'adverseEventsDocumentation', 'adverse', adverseSection)}
                </div>
              </div>
            )}

            {/* ========== Family/Caregiver Education — editable per-sentence ========== */}
            {familySection.show && getFieldValue(record, 'familyCaregiverEducation', idx) && (
              <div className="section">
                <div className="mini-cards-container">
                  {renderSectionHeader('Family/Caregiver Education', `family-${idx}`, () => {
                    const lines = ['FAMILY/CAREGIVER EDUCATION', '═══════════════════════════════════════'];
                    const r = pdfData[idx] || record;
                    splitBySentence(r.familyCaregiverEducation || '').forEach((s, i) => lines.push(`${i + 1}. ${s}`));
                    copySectionToClipboard(lines.join('\n'), `family-${idx}`);
                  }, idx, 'family')}
                  {renderEditableSentenceRows(record, recordWithFlag, idx, 'familyCaregiverEducation', 'family', familySection)}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TherapyProgressNotesDocument;
