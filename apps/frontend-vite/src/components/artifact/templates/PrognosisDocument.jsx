import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import PrognosisDocumentPDFTemplate from '../pdf-templates/PrognosisDocumentPDFTemplate';
import './PrognosisDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field", "field.arrayIndex",
   "field.arrayIndex.subField", or "field.objectKey") */
const DRAFT_KEY = 'prognosisPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/**
 * PrognosisDocument - December 2025 Complete Rebuild
 *
 * Following December 2025 Template Standards:
 * - PDFDownloadLink (NOT pdf().toBlob())
 * - Own useState('') for searchTerm
 * - mini-cards-container → rec-mini-card → nested-subtitle → numbered-row
 * - Section headers INSIDE mini-cards-container
 * - 4-level search with IIFE pattern
 * - Blue theme only (#0d1929, #93c5fd, rgba(96, 165, 250, 0.3))
 * - Font hierarchy: section-title 19px > nested-subtitle 17px > content-value 16px
 *
 * Sections:
 * 1. Record Info (date, provider, facility)
 * 2. Short-Term Prognosis (parseNotesWithLabels)
 * 3. Long-Term Prognosis (parseNotesWithLabels)
 * 4. Risk Factors (array - red badges)
 * 5. Protective Factors (array - green badges)
 * 6. Motivation Factors (parseNumberedItems)
 * 7. Previous Treatment Response
 * 8. Insight Level
 * 9. Assessment (splitBySentence)
 * 10. Notes (parseNotesWithLabels for "Factors Favoring/Against Success")
 */
const PrognosisDocument = ({ document, data }) => {
  const templateData = document || data;
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);

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
  const unwrappedData = useMemo(() => {
    const rawData = templateData?.documentData || templateData?.data || templateData;
    if (Array.isArray(rawData)) return rawData;
    if (rawData?.prognosis) return Array.isArray(rawData.prognosis) ? rawData.prognosis : [rawData.prognosis];
    if (rawData?.data) return Array.isArray(rawData.data) ? rawData.data : [rawData.data];
    if (rawData && typeof rawData === 'object') return [rawData];
    return [];
  }, [templateData]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nStatus = {};
    unwrappedData.forEach((record, idx) => {
      const rid = record && (record._id && record._id.$oid ? record._id.$oid : record._id);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // Mark every section that owns the base field so the modified badge + approve button show.
        const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
        for (const [sectionId, fields] of Object.entries(SECTION_FIELDS)) {
          if (fields.includes(baseField)) nFields[`${sectionId}-${idx}`] = true;
        }
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
  }, [unwrappedData]);

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Split by sentence
  const splitBySentence = (text) => {
    if (!text || typeof text !== 'string') return [];
    return text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  };

  // Parse numbered items like "(1) text (2) text (3) text"
  const parseNumberedItems = (text) => {
    if (!text || typeof text !== 'string') return [];

    // Split by "(1)", "(2)", etc.
    const parts = text.split(/\(\d+\)\s*/);
    return parts
      .filter(p => p.trim())
      .map(p => p.trim().replace(/;\s*$/, ''));
  };

  // Parse text with embedded labels like "Label: content. Another Label: content."
  // Returns hierarchical structure: parent labels with child label:value pairs
  const parseNotesWithLabels = (text) => {
    if (!text || typeof text !== 'string') return [];

    // TOP-LEVEL labels - mark major sections
    // NOTE: "Abstinence-Only" removed because it's always part of "Without MAT (Abstinence-Only)"
    const topLevelPatterns = [
      'With MAT', 'Without MAT',
      'Improved functioning',
      'Factors Favoring Success', 'Factors Against Success',
      'Overall', 'Success depends'
    ];

    // Find all top-level labels
    const matches = [];
    for (const pattern of topLevelPatterns) {
      const regex = new RegExp(`(${pattern}[^:]*?):\\s*`, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          label: match[1].trim(),
          startContentIdx: match.index + match[0].length,
          labelStartIdx: match.index
        });
      }
    }

    matches.sort((a, b) => a.labelStartIdx - b.labelStartIdx);

    const results = [];

    // Extract content for each parent label and parse children
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const endIdx = i + 1 < matches.length ? matches[i + 1].labelStartIdx : text.length;
      const rawContent = text.substring(current.startContentIdx, endIdx).trim().replace(/[.;,]\s*$/, '');

      if (rawContent) {
        // Parse child label:value pairs from content
        const children = parseChildLabels(rawContent);
        results.push({
          label: current.label,
          content: rawContent,
          children: children.length > 0 ? children : null
        });
      }
    }

    // Remove duplicates
    const seen = new Set();
    const uniqueResults = results.filter(r => {
      const key = r.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (uniqueResults.length > 0) {
      return uniqueResults;
    }

    // No top-level labels found, try parsing as child labels
    const children = parseChildLabels(text);
    if (children.length > 0) {
      return [{ label: null, content: text, children }];
    }

    // Fallback: split by sentence
    return splitBySentence(text).map(s => ({ label: null, content: s, children: null }));
  };

  // Parse child "Label: value" pairs from content string
  // For content without label:value patterns, splits by sentence
  const parseChildLabels = (content) => {
    if (!content || typeof content !== 'string') return [];

    // Match patterns like "Label name: value. Another label: value."
    const parts = content.split(/(?<=[.!?%])\s+/);
    const children = [];
    const nonLabelParts = [];

    for (const part of parts) {
      const colonIdx = part.indexOf(':');
      // Valid label:value pair must have:
      // - Colon not at start or end
      // - Label without special chars like ), (, [, ]
      // - Label length between 3-60 chars
      // - Value that's not empty
      if (colonIdx > 2 && colonIdx < part.length - 1) {
        const label = part.substring(0, colonIdx).trim();
        const value = part.substring(colonIdx + 1).trim().replace(/[.;,]$/, '');
        // Reject labels with unbalanced parentheses or brackets (fragments like "Abstinence-Only)")
        // Allow balanced parens like "(2019-2021)" in labels
        const hasUnbalancedParens = (label.match(/\(/g) || []).length !== (label.match(/\)/g) || []).length;
        const hasBrackets = /[\[\]{}]/.test(label);
        if (label && value && label.length >= 3 && label.length < 60 && !hasUnbalancedParens && !hasBrackets) {
          children.push({ label, value });
        } else {
          // Not a valid label:value, treat as regular content
          nonLabelParts.push(part.trim());
        }
      } else {
        // No colon or invalid position, treat as regular sentence
        const trimmed = part.trim().replace(/[.;,]$/, '');
        if (trimmed) {
          nonLabelParts.push(trimmed);
        }
      }
    }

    // Combine label:value pairs WITH non-label sentences
    const results = [...children];

    // Add non-label parts (sentences without "Label:" pattern)
    if (nonLabelParts.length > 0) {
      const allText = nonLabelParts.join(' ').trim();
      if (allText) {
        // Only split by comma if it looks like a LIST (short items), not a sentence with clauses
        // Remove parenthetical content first, then check for clause words
        const textWithoutParens = allText.replace(/\([^)]*\)/g, '');
        const isSentenceWithClauses = /\b(when|if|because|within|after|before|while|since|although|unless)\b/i.test(textWithoutParens);
        const commaParts = allText.split(',').map(p => p.trim()).filter(p => p);

        // Split by comma ONLY if: multiple parts AND no clause words outside parens AND parts are short (list-like)
        const isListLike = commaParts.length > 1 &&
                          !isSentenceWithClauses &&
                          commaParts.every(p => p.length < 50);

        if (isListLike) {
          commaParts.forEach(text => results.push({ label: null, value: text }));
        } else {
          // Keep as single sentence
          results.push({ label: null, value: allText });
        }
      }
    }

    // Return combined results, or fallback to original text split by sentence
    if (results.length > 0) {
      return results;
    }

    // Fallback: return original as single item
    return [{ label: null, value: content }];
  };

  // Humanize a camelCase / PascalCase / snake_case object key into a readable label
  const humanizeKey = (key) => {
    if (!key && key !== 0) return '';
    return String(key)
      .replace(/_/g, ' ')
      .replace(/([a-z\d])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  };

  // True only when a value actually carries renderable content (Rule #74 content gating)
  const hasContent = (val) => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string') return val.trim().length > 0;
    if (Array.isArray(val)) return val.some(hasContent);
    if (typeof val === 'object') return Object.values(val).some(hasContent);
    return true; // numbers (incl. 0) and booleans are meaningful
  };

  // Flatten a recommendation item (object {recommendation,date} or string) into a readable line
  const flattenRecommendation = (item) => {
    if (item === null || item === undefined) return '';
    if (typeof item === 'string') return item;
    if (typeof item === 'object' && !Array.isArray(item)) {
      const main = item.recommendation || item.text || item.value || '';
      const date = item.date ? ` (${formatDate(item.date)})` : '';
      if (main) return `${main}${date}`;
      return Object.entries(item)
        .filter(([, v]) => hasContent(v))
        .map(([k, v]) => `${humanizeKey(k)}: ${v}`)
        .join(', ');
    }
    return String(item);
  };

  // Copy to clipboard
  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      } catch (e) {
        console.error('Copy failed:', e);
      }
      document.body.removeChild(textarea);
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
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, arrayIndex, subField) => {
    const rid = record._id && record._id.$oid ? record._id.$oid : record._id;
    if (!rid) return;
    const saveValue = editValue.trim();
    // Build the dot-path fieldPart: fieldName[.arrayIndex][.subField]
    let fieldPart = fieldName;
    if (typeof arrayIndex === 'number') fieldPart = `${fieldPart}.${arrayIndex}`;
    if (subField) fieldPart = `${fieldPart}.${subField}`;
    const editKey = `${fieldPart}-${idx}`;
    const sKey = `${fieldName}-${idx}-s0`;

    setLocalEdits(prev => ({ ...prev, [editKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending.
    setApprovedSections(prev => {
      if (!prev[sectionId]) return prev;
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });

    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fieldPart] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this record to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApprove = useCallback(async (record, idx, sectionId) => {
    const rid = record._id && record._id.$oid ? record._id.$oid : record._id;
    if (!rid) return;
    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now. Reverse handleSaveField's fieldPart:
      // a trailing ".<n>" (purely numeric LAST segment) = arrayIndex; otherwise it is part of field.
      for (const key of toCommit) {
        const fieldPart = key.slice(0, -suffix.length); // "field", "field.idx", "field.idx.sub", or "field.key"
        const lastDot = fieldPart.lastIndexOf('.');
        let field = fieldPart, arrayIndex;
        if (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1))) {
          field = fieldPart.slice(0, lastDot);
          arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        }
        const payload = { field, value: localEdits[key] };
        if (typeof arrayIndex === 'number') payload.arrayIndex = arrayIndex;
        const response = await secureApiClient.put(`/api/edit/prognosis/${rid}/edit`, payload);
        if (!response || !response.success) throw new Error((response && response.error) || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/prognosis/${rid}/approve`);

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[rid]) { delete store[rid]; writeDrafts(store); }

      setStatusOverrides(prev => ({ ...prev, [idx]: 'approved' }));
      setApprovedSections(prev => ({ ...prev, [sectionId]: true }));
      setEditedSentences(prev => {
        const updated = {};
        for (const k of Object.keys(prev)) {
          if (!k.includes(`-${idx}-`)) updated[k] = prev[k];
        }
        return updated;
      });
      setEditedFields(prev => {
        const updated = {};
        for (const k of Object.keys(prev)) {
          if (!k.endsWith(`-${idx}`)) updated[k] = prev[k];
        }
        return updated;
      });
    } catch (err) {
      console.error('[Prognosis] Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // ============== SECTION_FIELDS + sectionHasEdits ==============
  const SECTION_FIELDS = {
    'record-info': ['provider'],
    'short-term': ['shortTerm'],
    'long-term': ['longTerm'],
    'risk-factors': ['riskFactors'],
    'protective-factors': ['protectiveFactors'],
    'motivation': ['motivationFactors'],
    'prev-treatment': ['previousTreatmentResponse'],
    'insight': ['insightLevel'],
    'assessment': ['assessment', 'findings', 'plan'],
    'notes': ['notes', 'mortality', 'functionalStatus', 'recommendations'],
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
              // Array of scalars: replace element
              merged[parent] = [...merged[parent]];
              merged[parent][childNum] = editVal;
            } else if (isNaN(childNum) && merged[parent] && typeof merged[parent] === 'object') {
              // Dynamic-key object (e.g. results.<key>): replace value
              merged[parent] = { ...merged[parent], [child]: editVal };
            }
          } else if (dotParts.length === 3) {
            // Array-of-objects subfield: parent.<index>.<subField> (e.g. recommendations.0.recommendation)
            const [parent, child, subField] = dotParts;
            const childNum = parseInt(child, 10);
            if (!isNaN(childNum) && Array.isArray(merged[parent]) &&
                merged[parent][childNum] && typeof merged[parent][childNum] === 'object') {
              merged[parent] = [...merged[parent]];
              merged[parent][childNum] = { ...merged[parent][childNum], [subField]: editVal };
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
  const renderEditableArrayItem = (record, fieldName, item, idx, itemIdx, sectionId, copyId, extraClassName) => {
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
        <div className={`numbered-row${extraClassName ? ' ' + extraClassName : ''}${isItemEdited ? ' modified' : ''}`}>
          <div
            className={`row-content${canEdit ? ' editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(`${fieldName}.${itemIdx}`, idx, displayValue)}
            title={canEdit ? 'Click to edit' : undefined}
          >
            {extraClassName === 'risk-row' && <span className="risk-badge">⚠</span>}
            {extraClassName === 'protective-row' && <span className="protective-badge">✓</span>}
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

  // Read a dot-path leaf value honoring local edits (e.g. recommendations.0.recommendation, results.<key>)
  const getDotPathValue = useCallback((record, fieldPath, idx, fallback) => {
    const editKey = `${fieldPath}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    return fallback;
  }, [localEdits]);

  // ============== RENDER EDITABLE LEAF (dot-path subfield/object key) ==============
  // Renders ONE editable row for a single leaf, saving via arrayIndex+subField (or object key) dot-path.
  // This preserves the parent object/array shape on save (no flat-string corruption).
  const renderEditableLeaf = (record, fieldName, label, leafValue, idx, sectionId, copyId, opts = {}) => {
    const { arrayIndex, subField, objectKey } = opts;
    let fieldPath = fieldName;
    if (typeof arrayIndex === 'number') fieldPath = `${fieldPath}.${arrayIndex}`;
    if (subField) fieldPath = `${fieldPath}.${subField}`;
    if (objectKey) fieldPath = `${fieldPath}.${objectKey}`;

    const displayValue = getDotPathValue(record, fieldPath, idx, leafValue);
    if (displayValue === undefined || displayValue === null || String(displayValue).trim() === '') return null;

    const canEdit = !!record._id;
    const editKey = `${fieldPath}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const isLeafEdited = sectionWasEdited && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';

    const doSave = () => handleSaveField(record, fieldName, idx, sectionId, arrayIndex, subField || objectKey);

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={copyId}>
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
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) doSave();
                }}
                rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))}
                disabled={saving}
              />
              <div className="edit-actions">
                <button className="edit-save-btn" onClick={doSave} disabled={saving}>
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
      <div className="rec-mini-card" key={copyId}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row${isLeafEdited ? ' modified' : ''}`}>
          <div
            className={`row-content${canEdit ? ' editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(fieldPath, idx, displayValue)}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span className="content-value">{highlightText(String(displayValue))}</span>
            {canEdit && !isLeafEdited && editIndicator}
          </div>
          <button
            className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(String(displayValue), copyId)}
          >
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isLeafEdited && <div className="modified-badge">edited — click approve to save</div>}
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

  // LEVEL 4: Row-level filtering
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

  // Highlight text
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

  // LEVEL 1: Document-level filtering with searchableText
  const filteredRecords = useMemo(() => {
    const recordsWithFlags = unwrappedData.map((record, idx) => {
      const searchableText = [
        // Record title with case variations
        `Prognosis ${idx + 1}`, `prognosis ${idx + 1}`, `PROGNOSIS ${idx + 1}`,

        // Section titles with case variations
        'Record Info', 'record info', 'RECORD INFO',
        'Short-Term Prognosis', 'short-term prognosis', 'SHORT-TERM PROGNOSIS',
        'Short Term', 'short term', 'SHORT TERM',
        'Long-Term Prognosis', 'long-term prognosis', 'LONG-TERM PROGNOSIS',
        'Long Term', 'long term', 'LONG TERM',
        'Risk Factors', 'risk factors', 'RISK FACTORS',
        'Protective Factors', 'protective factors', 'PROTECTIVE FACTORS',
        'Motivation Factors', 'motivation factors', 'MOTIVATION FACTORS',
        'Previous Treatment Response', 'previous treatment response', 'PREVIOUS TREATMENT RESPONSE',
        'Treatment Response', 'treatment response', 'TREATMENT RESPONSE',
        'Insight Level', 'insight level', 'INSIGHT LEVEL',
        'Assessment', 'assessment', 'ASSESSMENT',
        'Notes', 'notes', 'NOTES',
        'Provider', 'provider', 'PROVIDER',
        'Facility', 'facility', 'FACILITY',
        'Date', 'date', 'DATE',

        // Embedded labels
        'With MAT', 'with mat', 'WITHOUT MAT', 'without mat',
        'Retention in treatment', 'retention in treatment',
        'Overdose risk', 'overdose risk',
        'Relapse rate', 'relapse rate',
        'Factors Favoring Success', 'factors favoring success',
        'Factors Against Success', 'factors against success',

        // Field values
        record.shortTerm,
        record.longTerm,
        record.motivationFactors,
        record.previousTreatmentResponse,
        record.insightLevel,
        record.assessment,
        record.findings,
        record.plan,
        record.mortality,
        record.functionalStatus,
        record.notes,
        record.provider,
        record.facility,
        formatDate(record.date),

        // Section titles for new fields
        'Findings', 'findings', 'Plan', 'plan', 'Mortality', 'mortality',
        'Functional Status', 'functional status',
        'Recommendations', 'recommendations', 'Results', 'results',

        // Arrays
        ...(record.riskFactors || []),
        ...(record.protectiveFactors || []),

        // Recommendations (array of {recommendation, date} objects)
        ...(Array.isArray(record.recommendations)
          ? record.recommendations.map(flattenRecommendation)
          : []),

        // Results (dynamic-key object {Label: value})
        ...(record.results && typeof record.results === 'object' && !Array.isArray(record.results)
          ? Object.entries(record.results).flatMap(([k, v]) => [humanizeKey(k), String(v ?? '')])
          : []),
      ].filter(Boolean).join(' ').toLowerCase();

      return { ...record, _searchableText: searchableText, _recordIndex: idx };
    });

    if (!searchTerm.trim()) {
      return recordsWithFlags;
    }

    const phrase = searchTerm.toLowerCase().trim();

    return recordsWithFlags.filter(record => {
      // Check for record title match
      const recordTitle = `prognosis ${record._recordIndex + 1}`;
      if (recordTitle.includes(phrase) || phrase.includes('prognosis')) {
        const numberMatch = phrase.match(/\d+/);
        if (numberMatch && recordTitle.includes(numberMatch[0])) {
          record._showAllSections = true;
          return true;
        }
        if (!numberMatch && phrase === 'prognosis') {
          record._showAllSections = true;
          return true;
        }
      }

      // Check searchableText
      if (record._searchableText.includes(phrase)) {
        return true;
      }

      return false;
    });
  }, [unwrappedData, searchTerm]);

  // Get section text for copy
  const getSectionText = (title, items, includeNumbers = true) => {
    const lines = [title.toUpperCase(), '═══════════════════════════════════════'];
    items.forEach((item, idx) => {
      if (includeNumbers) {
        lines.push(`${idx + 1}. ${item}`);
      } else {
        lines.push(item);
      }
    });
    return lines.join('\n');
  };

  // Helper to split long text into sentence lines
  const splitIntoSentences = (text) => {
    if (!text || text.length < 80) return [text]; // Short text, no split
    // Split by sentence endings OR by ") Uppercase" (parenthetical followed by new sentence)
    return text.split(/(?<=[.!?])\s+|(?<=\))\s+(?=[A-Z])/).filter(s => s && s.trim());
  };

  // Helper to format parsed items with labels for copy
  const formatParsedItems = (parsedItems, indent = '') => {
    const lines = [];
    parsedItems.forEach((item, idx) => {
      if (item.label) {
        lines.push(`${indent}${item.label}:`);
        if (item.children && item.children.length > 0) {
          item.children.forEach((child, cIdx) => {
            if (child.label) {
              lines.push(`${indent}  • ${child.label}: ${child.value}`);
            } else {
              // Split long child values
              const sentences = splitIntoSentences(child.value);
              sentences.forEach((s, sIdx) => {
                lines.push(`${indent}  • ${s.trim()}`);
              });
            }
          });
        } else if (item.content) {
          // Split long content
          const sentences = splitIntoSentences(item.content);
          sentences.forEach((s, sIdx) => {
            lines.push(`${indent}  ${sIdx > 0 ? '  ' : ''}${s.trim()}`);
          });
        }
      } else if (item.content) {
        // Split long non-label content
        const sentences = splitIntoSentences(item.content);
        sentences.forEach((s, sIdx) => {
          const num = sentences.length > 1 ? `${idx + 1}${String.fromCharCode(97 + sIdx)}` : `${idx + 1}`;
          lines.push(`${indent}${num}. ${s.trim()}`);
        });
      } else if (item.value) {
        // Split long non-label values
        const sentences = splitIntoSentences(item.value);
        sentences.forEach((s, sIdx) => {
          const num = sentences.length > 1 ? `${idx + 1}${String.fromCharCode(97 + sIdx)}` : `${idx + 1}`;
          lines.push(`${indent}${num}. ${s.trim()}`);
        });
      }
    });
    return lines;
  };

  // Get all record text for copy
  const getAllRecordText = (record, idx) => {
    const lines = [`PROGNOSIS ${idx + 1}`, '═══════════════════════════════════════'];

    if (record.date) lines.push(`Date: ${formatDate(record.date)}`);
    if (record.provider) lines.push(`Provider: ${record.provider}`);
    if (record.facility) lines.push(`Facility: ${record.facility}`);

    if (record.shortTerm) {
      lines.push('', 'SHORT-TERM PROGNOSIS', '───────────────────────────────────────');
      const parsed = parseNotesWithLabels(record.shortTerm);
      lines.push(...formatParsedItems(parsed));
    }

    if (record.longTerm) {
      lines.push('', 'LONG-TERM PROGNOSIS', '───────────────────────────────────────');
      const parsed = parseNotesWithLabels(record.longTerm);
      lines.push(...formatParsedItems(parsed));
    }

    if (record.riskFactors?.length > 0) {
      lines.push('', 'RISK FACTORS', '───────────────────────────────────────');
      record.riskFactors.forEach((f, i) => lines.push(`${i + 1}. ⚠ ${f}`));
    }

    if (record.protectiveFactors?.length > 0) {
      lines.push('', 'PROTECTIVE FACTORS', '───────────────────────────────────────');
      record.protectiveFactors.forEach((f, i) => lines.push(`${i + 1}. ✓ ${f}`));
    }

    if (record.motivationFactors) {
      lines.push('', 'MOTIVATION FACTORS', '───────────────────────────────────────');
      const parsed = parseNumberedItems(record.motivationFactors);
      parsed.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
    }

    if (record.previousTreatmentResponse) {
      lines.push('', 'PREVIOUS TREATMENT RESPONSE', '───────────────────────────────────────');
      const parsed = parseChildLabels(record.previousTreatmentResponse);
      parsed.forEach((item, i) => {
        if (item.label) {
          lines.push(`${item.label}: ${item.value}`);
        } else {
          lines.push(`${i + 1}. ${item.value}`);
        }
      });
    }

    if (record.insightLevel) {
      lines.push('', 'INSIGHT LEVEL', '───────────────────────────────────────');
      lines.push(record.insightLevel);
    }

    if (record.assessment) {
      lines.push('', 'ASSESSMENT', '───────────────────────────────────────');
      const parsed = parseChildLabels(record.assessment);
      parsed.forEach((item, i) => {
        if (item.label) {
          lines.push(`${item.label}: ${item.value}`);
        } else {
          // Split long non-label values by sentence patterns
          const sentences = item.value.split(/(?<=[.!?])\s+|(?<=\))\s+(?=[A-Z])/).filter(s => s.trim());
          sentences.forEach((sentence, sIdx) => {
            lines.push(`${i + 1}.${sentences.length > 1 ? String.fromCharCode(97 + sIdx) : ''} ${sentence.trim()}`);
          });
        }
      });
    }

    if (record.findings) {
      lines.push('', 'FINDINGS', '───────────────────────────────────────');
      splitBySentence(record.findings).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }

    if (record.plan) {
      lines.push('', 'PLAN', '───────────────────────────────────────');
      splitBySentence(record.plan).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }

    if (Array.isArray(record.recommendations) && hasContent(record.recommendations)) {
      lines.push('', 'RECOMMENDATIONS', '───────────────────────────────────────');
      record.recommendations
        .map(flattenRecommendation)
        .filter((l) => l && l.trim())
        .forEach((l, i) => lines.push(`${i + 1}. ${l}`));
    }

    if (record.results && typeof record.results === 'object' && !Array.isArray(record.results) && hasContent(record.results)) {
      lines.push('', 'RESULTS', '───────────────────────────────────────');
      Object.entries(record.results)
        .filter(([, v]) => hasContent(v))
        .forEach(([k, v]) => lines.push(`${humanizeKey(k)}: ${v}`));
    }

    if (record.mortality) {
      lines.push('', 'MORTALITY', '───────────────────────────────────────');
      splitBySentence(record.mortality).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }

    if (record.functionalStatus) {
      lines.push('', 'FUNCTIONAL STATUS', '───────────────────────────────────────');
      splitBySentence(record.functionalStatus).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }

    if (record.notes) {
      lines.push('', 'NOTES', '───────────────────────────────────────');
      const parsed = parseNotesWithLabels(record.notes);
      lines.push(...formatParsedItems(parsed));
    }

    return lines.join('\n');
  };

  if (!templateData || unwrappedData.length === 0) {
    return (
      <div className="prognosis-document">
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p className="empty-text">No prognosis data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="prognosis-document">
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">Prognosis</h1>

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
            document={<PrognosisDocumentPDFTemplate document={pdfData} />}
            fileName={`prognosis-${new Date().toISOString().split('T')[0]}.pdf`}
            className="pdf-btn"
          >
            {({ loading }) => (loading ? 'Preparing...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>

        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search prognosis..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')}>
              ×
            </button>
          )}
        </div>
      </div>

      {/* Records */}
      {filteredRecords.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <p className="empty-text">No prognosis records match your search</p>
        </div>
      ) : (
        <div className="records-container">
          {filteredRecords.map((record, idx) => {
            const recordId = `record-${idx}`;
            const recordWithFlag = { ...record, _showAllSections: record._showAllSections };

            // LEVEL 3: sectionTitleMatches for each section (using IIFE pattern)
            const recordInfoMatches = (() => {
              if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
              return shouldShowRow(recordWithFlag,
                'Record Info', 'record info', 'RECORD INFO',
                'Provider', 'provider', 'Facility', 'facility', 'Date', 'date',
                record.provider, record.facility, formatDate(record.date)
              );
            })();

            // Short-Term Prognosis: Check if SECTION TITLE matches (show all items) vs CONTENT matches (filter items)
            const shortTermSearchesSectionTitle = (() => {
              if (!searchTerm.trim()) return false;
              const phrase = searchTerm.toLowerCase().trim();
              return ['short-term prognosis', 'short term', 'short-term'].some(t => t.includes(phrase) || phrase.includes(t));
            })();

            const shortTermHasContent = (() => {
              if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
              return shouldShowRow(recordWithFlag,
                'Short-Term Prognosis', 'short-term prognosis', 'SHORT-TERM PROGNOSIS',
                'Short Term', 'short term', record.shortTerm
              );
            })();

            const shortTermMatches = shortTermSearchesSectionTitle || shortTermHasContent;

            // Long-Term Prognosis: Check if SECTION TITLE matches (show all items) vs CONTENT matches (filter items)
            const longTermSearchesSectionTitle = (() => {
              if (!searchTerm.trim()) return false;
              const phrase = searchTerm.toLowerCase().trim();
              return ['long-term prognosis', 'long term', 'long-term'].some(t => t.includes(phrase) || phrase.includes(t));
            })();

            const longTermHasContent = (() => {
              if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
              return shouldShowRow(recordWithFlag,
                'Long-Term Prognosis', 'long-term prognosis', 'LONG-TERM PROGNOSIS',
                'Long Term', 'long term', record.longTerm
              );
            })();

            const longTermMatches = longTermSearchesSectionTitle || longTermHasContent;

            const riskFactorsMatches = (() => {
              if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
              const riskText = (record.riskFactors || []).join(' ');
              return shouldShowRow(recordWithFlag,
                'Risk Factors', 'risk factors', 'RISK FACTORS', riskText
              );
            })();

            const protectiveFactorsMatches = (() => {
              if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
              const protectiveText = (record.protectiveFactors || []).join(' ');
              return shouldShowRow(recordWithFlag,
                'Protective Factors', 'protective factors', 'PROTECTIVE FACTORS', protectiveText
              );
            })();

            const motivationMatches = (() => {
              if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
              return shouldShowRow(recordWithFlag,
                'Motivation Factors', 'motivation factors', 'MOTIVATION FACTORS',
                'Motivation', 'motivation', record.motivationFactors
              );
            })();

            const previousTreatmentMatches = (() => {
              if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
              return shouldShowRow(recordWithFlag,
                'Previous Treatment Response', 'previous treatment response',
                'Treatment Response', 'treatment response', record.previousTreatmentResponse
              );
            })();

            const insightMatches = (() => {
              if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
              return shouldShowRow(recordWithFlag,
                'Insight Level', 'insight level', 'INSIGHT LEVEL',
                'Insight', 'insight', record.insightLevel
              );
            })();

            const assessmentMatches = (() => {
              if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
              return shouldShowRow(recordWithFlag,
                'Assessment', 'assessment', 'ASSESSMENT', record.assessment
              );
            })();

            // Notes section: Check if SECTION TITLE matches (show all items) vs CONTENT matches (filter items)
            const notesSearchesSectionTitle = (() => {
              if (!searchTerm.trim()) return false;
              const phrase = searchTerm.toLowerCase().trim();
              return ['notes'].some(t => t.includes(phrase) || phrase.includes(t));
            })();

            const notesHasContent = (() => {
              if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
              const recsText = Array.isArray(record.recommendations)
                ? record.recommendations.map(flattenRecommendation).join(' ') : '';
              const resultsText = (record.results && typeof record.results === 'object' && !Array.isArray(record.results))
                ? Object.entries(record.results).map(([k, v]) => `${humanizeKey(k)} ${v}`).join(' ') : '';
              // Check if any content matches (section will show, but items will be filtered)
              return shouldShowRow(recordWithFlag,
                'Notes', 'notes', 'NOTES',
                'Factors Favoring Success', 'Factors Against Success',
                'Recommendations', 'recommendations', 'Results', 'results',
                'Mortality', 'mortality', 'Functional Status', 'functional status',
                record.notes, record.mortality, record.functionalStatus, recsText, resultsText
              );
            })();

            // Section shows if: searching section title OR has any matching content
            const notesMatches = notesSearchesSectionTitle || notesHasContent;

            return (
              <div key={idx} className="record-card">
                {/* Record Header */}
                <div className="record-header">
                  <h2 className="record-title">{highlightText(`Prognosis ${idx + 1}`)}</h2>
                  <div className="header-top-row">
                    {record.date && (
                      <span className="date-badge">{highlightText(formatDate(record.date))}</span>
                    )}
                  </div>
                </div>

                {/* Section 1: Record Info */}
                {(record.provider || record.facility) && recordInfoMatches && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Record Info', `${recordId}-info`, () => {
                        const r = pdfData[idx] || record;
                        const lines = ['RECORD INFO', '═══════════════════════════════════════'];
                        if (r.date) lines.push(`Date: ${formatDate(r.date)}`);
                        if (r.provider) lines.push(`Provider: ${r.provider}`);
                        if (r.facility) lines.push(`Facility: ${r.facility}`);
                        copyToClipboard(lines.join('\n'), `${recordId}-info`);
                      }, idx, 'record-info')}

                      {/* provider — editable */}
                      {(recordInfoMatches || shouldShowRow(recordWithFlag, 'Provider', record.provider)) &&
                        renderEditableField(record, 'provider', 'Provider', idx, 'record-info', `${recordId}-provider`)
                      }

                      {record.facility && (recordInfoMatches || shouldShowRow(recordWithFlag, 'Facility', record.facility)) && (
                        <div className="rec-mini-card">
                          <div className="nested-subtitle">{highlightText('Facility')}</div>
                          <div className="numbered-row">
                            <div className="row-content">
                              <span className="content-value">{highlightText(record.facility)}</span>
                            </div>
                            <button
                              className={`copy-btn ${copiedId === `${recordId}-facility` ? 'copied' : ''}`}
                              onClick={() => copyToClipboard(record.facility, `${recordId}-facility`)}
                            >
                              {copiedId === `${recordId}-facility` ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Section 2: Short-Term Prognosis — editable as whole field */}
                {shortTermMatches && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Short-Term Prognosis', `${recordId}-shortterm`, () => {
                        const r = pdfData[idx] || record;
                        const parsed = parseNotesWithLabels(r.shortTerm || '');
                        const lines = ['SHORT-TERM PROGNOSIS', '═══════════════════════════════════════'];
                        lines.push(...formatParsedItems(parsed));
                        copyToClipboard(lines.join('\n'), `${recordId}-shortterm`);
                      }, idx, 'short-term')}

                      {renderEditableField(record, 'shortTerm', 'Short-Term Prognosis', idx, 'short-term', `${recordId}-shortterm-field`)}
                    </div>
                  </div>
                )}

                {/* Section 3: Long-Term Prognosis — editable as whole field */}
                {longTermMatches && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Long-Term Prognosis', `${recordId}-longterm`, () => {
                        const r = pdfData[idx] || record;
                        const parsed = parseNotesWithLabels(r.longTerm || '');
                        const lines = ['LONG-TERM PROGNOSIS', '═══════════════════════════════════════'];
                        lines.push(...formatParsedItems(parsed));
                        copyToClipboard(lines.join('\n'), `${recordId}-longterm`);
                      }, idx, 'long-term')}

                      {renderEditableField(record, 'longTerm', 'Long-Term Prognosis', idx, 'long-term', `${recordId}-longterm-field`)}
                    </div>
                  </div>
                )}

                {/* Section 4: Risk Factors — editable array */}
                {record.riskFactors?.length > 0 && riskFactorsMatches && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Risk Factors', `${recordId}-riskfactors`, () => {
                        const r = pdfData[idx] || record;
                        const text = getSectionText('Risk Factors', r.riskFactors || []);
                        copyToClipboard(text, `${recordId}-riskfactors`);
                      }, idx, 'risk-factors')}

                      {record.riskFactors.map((factor, fIdx) => {
                        const factorMatches = shouldShowRow(recordWithFlag, factor) || riskFactorsMatches;
                        if (!factorMatches) return null;

                        return renderEditableArrayItem(record, 'riskFactors', factor, idx, fIdx, 'risk-factors', `${recordId}-rf-${fIdx}`, 'risk-row');
                      })}
                    </div>
                  </div>
                )}

                {/* Section 5: Protective Factors — editable array */}
                {record.protectiveFactors?.length > 0 && protectiveFactorsMatches && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Protective Factors', `${recordId}-protectivefactors`, () => {
                        const r = pdfData[idx] || record;
                        const text = getSectionText('Protective Factors', r.protectiveFactors || []);
                        copyToClipboard(text, `${recordId}-protectivefactors`);
                      }, idx, 'protective-factors')}

                      {record.protectiveFactors.map((factor, fIdx) => {
                        const factorMatches = shouldShowRow(recordWithFlag, factor) || protectiveFactorsMatches;
                        if (!factorMatches) return null;

                        return renderEditableArrayItem(record, 'protectiveFactors', factor, idx, fIdx, 'protective-factors', `${recordId}-pf-${fIdx}`, 'protective-row');
                      })}
                    </div>
                  </div>
                )}

                {/* Section 6: Motivation Factors — editable as whole field */}
                {motivationMatches && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Motivation Factors', `${recordId}-motivation`, () => {
                        const r = pdfData[idx] || record;
                        const motivationItems = parseNumberedItems(r.motivationFactors || '');
                        const text = getSectionText('Motivation Factors', motivationItems);
                        copyToClipboard(text, `${recordId}-motivation`);
                      }, idx, 'motivation')}

                      {renderEditableField(record, 'motivationFactors', 'Motivation Factors', idx, 'motivation', `${recordId}-motivation-field`)}
                    </div>
                  </div>
                )}

                {/* Section 7: Previous Treatment Response — editable as whole field */}
                {previousTreatmentMatches && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Previous Treatment Response', `${recordId}-prevtreat`, () => {
                        const r = pdfData[idx] || record;
                        const parsedItems = parseChildLabels(r.previousTreatmentResponse || '');
                        const lines = ['PREVIOUS TREATMENT RESPONSE', '═══════════════════════════════════════'];
                        parsedItems.forEach((item, i) => {
                          if (item.label) {
                            lines.push(`${item.label}: ${item.value}`);
                          } else {
                            lines.push(`${i + 1}. ${item.value}`);
                          }
                        });
                        copyToClipboard(lines.join('\n'), `${recordId}-prevtreat`);
                      }, idx, 'prev-treatment')}

                      {renderEditableField(record, 'previousTreatmentResponse', 'Previous Treatment Response', idx, 'prev-treatment', `${recordId}-prevtreat-field`)}
                    </div>
                  </div>
                )}

                {/* Section 8: Insight Level — editable */}
                {insightMatches && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Insight Level', `${recordId}-insight`, () => {
                        const r = pdfData[idx] || record;
                        const lines = ['INSIGHT LEVEL', '═══════════════════════════════════════'];
                        if (r.insightLevel) lines.push(r.insightLevel);
                        copyToClipboard(lines.join('\n'), `${recordId}-insight`);
                      }, idx, 'insight')}

                      {renderEditableField(record, 'insightLevel', 'Insight Level', idx, 'insight', `${recordId}-insight-field`)}
                    </div>
                  </div>
                )}

                {/* Section 9: Assessment — editable (assessment, findings, plan) */}
                {assessmentMatches && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Assessment', `${recordId}-assessment`, () => {
                        const r = pdfData[idx] || record;
                        const lines = ['ASSESSMENT', '═══════════════════════════════════════'];
                        if (r.assessment) lines.push(`Assessment: ${r.assessment}`);
                        if (r.findings) lines.push(`Findings: ${r.findings}`);
                        if (r.plan) lines.push(`Plan: ${r.plan}`);
                        copyToClipboard(lines.join('\n'), `${recordId}-assessment`);
                      }, idx, 'assessment')}

                      {renderEditableField(record, 'assessment', 'Assessment', idx, 'assessment', `${recordId}-assess-field`)}
                      {renderEditableField(record, 'findings', 'Findings', idx, 'assessment', `${recordId}-findings-field`)}
                      {renderEditableField(record, 'plan', 'Plan', idx, 'assessment', `${recordId}-plan-field`)}
                    </div>
                  </div>
                )}

                {/* Section 10: Notes — editable (notes, mortality, functionalStatus, recommendations) */}
                {notesMatches && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Notes & Additional', `${recordId}-notes`, () => {
                        const r = pdfData[idx] || record;
                        const lines = ['NOTES & ADDITIONAL', '═══════════════════════════════════════'];
                        if (r.notes) lines.push(`Notes: ${r.notes}`);
                        if (r.mortality) lines.push(`Mortality: ${r.mortality}`);
                        if (r.functionalStatus) lines.push(`Functional Status: ${r.functionalStatus}`);
                        if (Array.isArray(r.recommendations) && hasContent(r.recommendations)) {
                          lines.push('Recommendations:');
                          r.recommendations
                            .map(flattenRecommendation)
                            .filter((l) => l && l.trim())
                            .forEach((l, i) => lines.push(`  ${i + 1}. ${l}`));
                        }
                        if (r.results && typeof r.results === 'object' && !Array.isArray(r.results) && hasContent(r.results)) {
                          lines.push('Results:');
                          Object.entries(r.results)
                            .filter(([, v]) => hasContent(v))
                            .forEach(([k, v]) => lines.push(`  • ${humanizeKey(k)}: ${v}`));
                        }
                        copyToClipboard(lines.join('\n'), `${recordId}-notes`);
                      }, idx, 'notes')}

                      {renderEditableField(record, 'notes', 'Notes', idx, 'notes', `${recordId}-notes-field`)}
                      {renderEditableField(record, 'mortality', 'Mortality', idx, 'notes', `${recordId}-mortality-field`)}
                      {renderEditableField(record, 'functionalStatus', 'Functional Status', idx, 'notes', `${recordId}-funcstatus-field`)}

                      {/* Recommendations — array of {recommendation, date} objects: per-subfield editable rows */}
                      {Array.isArray(record.recommendations) && hasContent(record.recommendations) &&
                        record.recommendations.map((rec, rIdx) => {
                          if (!hasContent(rec)) return null;
                          if (rec && typeof rec === 'object' && !Array.isArray(rec)) {
                            return (
                              <React.Fragment key={`rec-${rIdx}`}>
                                {renderEditableLeaf(record, 'recommendations',
                                  `Recommendation ${rIdx + 1}`, rec.recommendation, idx, 'notes',
                                  `${recordId}-rec-${rIdx}-text`, { arrayIndex: rIdx, subField: 'recommendation' })}
                                {renderEditableLeaf(record, 'recommendations',
                                  `Recommendation ${rIdx + 1} Date`, rec.date, idx, 'notes',
                                  `${recordId}-rec-${rIdx}-date`, { arrayIndex: rIdx, subField: 'date' })}
                              </React.Fragment>
                            );
                          }
                          // String recommendation: scalar array item
                          return renderEditableLeaf(record, 'recommendations',
                            `Recommendation ${rIdx + 1}`, rec, idx, 'notes',
                            `${recordId}-rec-${rIdx}`, { arrayIndex: rIdx });
                        })}

                      {/* Results — dynamic-key object {Label: value}: per-key editable rows */}
                      {record.results && typeof record.results === 'object' && !Array.isArray(record.results) &&
                        hasContent(record.results) &&
                        Object.entries(record.results)
                          .filter(([, v]) => hasContent(v))
                          .map(([key, val]) =>
                            renderEditableLeaf(record, 'results', humanizeKey(key), val, idx, 'notes',
                              `${recordId}-result-${key}`, { objectKey: key })
                          )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PrognosisDocument;
