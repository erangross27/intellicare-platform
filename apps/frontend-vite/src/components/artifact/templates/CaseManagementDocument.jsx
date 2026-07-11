/**
 * CaseManagementDocument.jsx
 * February 2026 — Inline Editing Enabled
 *
 * Sections: Report Information, Services Needed, Barriers to Care,
 *           Clinical Assessment, Recommendations, Follow-Up
 *
 * Features: 4-level search, mini-card pattern, PDFDownloadLink, inline editing
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import CaseManagementDocumentPDFTemplate from '../pdf-templates/CaseManagementDocumentPDFTemplate';
import './CaseManagementDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'caseManagementPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const CaseManagementDocument = ({ document, data }) => {
  // December 2025 pattern: accept both props
  const templateData = document || data;

  // Own state for search (December 2025 requirement)
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

  // Unwrap data - handle various wrapper formats
  const unwrappedData = useMemo(() => {
    if (!templateData) return [];

    // If it's already an array
    if (Array.isArray(templateData)) {
      // Check for wrapper: [{ case_management: [...] }]
      if (templateData.length > 0 && templateData[0]?.case_management) {
        return templateData.flatMap(item =>
          Array.isArray(item.case_management) ? item.case_management : [item.case_management]
        ).filter(Boolean);
      }
      return templateData;
    }

    // Check for wrapper: { case_management: [...] }
    if (templateData.case_management) {
      return Array.isArray(templateData.case_management)
        ? templateData.case_management
        : [templateData.case_management];
    }

    // Single record
    if (templateData.reportDate || templateData.referralStatus || templateData.services) {
      return [templateData];
    }

    return [];
  }, [templateData]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nStatus = {};
    unwrappedData.forEach((record, idx) => {
      const recId = record && record._id
        ? (typeof record._id === 'object' && record._id.$oid ? record._id.$oid : record._id)
        : null;
      const recDrafts = recId ? store[recId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
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
  const formatDate = useCallback((dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return String(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return String(dateString);
    }
  }, []);

  // Split text by sentences - handles "Mr.", "Dr.", "()", etc.
  const splitBySentence = useCallback((text) => {
    if (!text) return [];
    const str = String(text).trim();
    if (!str) return [];

    // Replace abbreviations temporarily to avoid splitting on them
    let processed = str;
    const placeholders = [];

    // Common abbreviations that end with period
    const abbreviations = [
      'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Jr.', 'Sr.', 'Prof.',
      'vs.', 'i.e.', 'e.g.', 'etc.', 'approx.', 'St.',
      'No.', 'Vol.', 'Inc.', 'Corp.', 'Ltd.', 'Co.'
    ];

    abbreviations.forEach((abbr, i) => {
      const placeholder = `__ABBR${i}__`;
      const regex = new RegExp(abbr.replace('.', '\\.'), 'g');
      if (processed.includes(abbr)) {
        processed = processed.replace(regex, placeholder);
        placeholders.push({ placeholder, original: abbr });
      }
    });

    // Protect content inside parentheses
    const parenMatches = [];
    processed = processed.replace(/\([^)]*\)/g, (match) => {
      const placeholder = `__PAREN${parenMatches.length}__`;
      parenMatches.push({ placeholder, original: match });
      return placeholder;
    });

    // Split by sentence-ending punctuation followed by space or end
    const sentences = processed.split(/(?<=[.!?])\s+/);

    // Restore placeholders in each sentence
    return sentences.map(sentence => {
      let restored = sentence;
      // Restore parentheses
      parenMatches.forEach(({ placeholder, original }) => {
        restored = restored.replace(placeholder, original);
      });
      // Restore abbreviations
      placeholders.forEach(({ placeholder, original }) => {
        restored = restored.replace(new RegExp(placeholder, 'g'), original);
      });
      return restored.trim();
    }).filter(s => s.length > 0);
  }, []);

  // Parse text with embedded labels - "Label: content1, content2. Label2: content3"
  const parseFindingsWithLabels = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];

    const sentences = splitBySentence(text);
    const groups = [];

    sentences.forEach(sentence => {
      const colonIdx = sentence.indexOf(':');
      if (colonIdx >= 2 && colonIdx <= 40) {
        const beforeColon = sentence.substring(0, colonIdx).trim();
        const afterColon = sentence.substring(colonIdx + 1).trim();

        if (/^[A-Z]/.test(beforeColon) && !beforeColon.includes('.')) {
          const items = splitByCommaProtectParens(afterColon);
          if (items.length > 0) {
            groups.push({ label: beforeColon, items });
            return;
          }
        }
      }

      if (sentence.trim()) {
        groups.push({ label: null, items: [sentence.trim()] });
      }
    });

    return groups;
  }, [splitBySentence]);

  // Group recommendations by parent
  const groupRecommendationsByParent = useCallback((groups) => {
    const superGroups = [];
    let currentSuperGroup = null;

    groups.forEach(group => {
      if (group.label === null) {
        if (currentSuperGroup) {
          superGroups.push(currentSuperGroup);
        }
        currentSuperGroup = {
          parent: group.items[0],
          children: []
        };
      } else {
        if (currentSuperGroup) {
          currentSuperGroup.children.push(group);
        } else {
          currentSuperGroup = { parent: null, children: [] };
          currentSuperGroup.children.push(group);
        }
      }
    });

    if (currentSuperGroup) {
      superGroups.push(currentSuperGroup);
    }

    return superGroups;
  }, []);

  // Split by comma but protect content inside parentheses
  const splitByCommaProtectParens = useCallback((text) => {
    if (!text) return [];
    const items = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '(') depth++;
      else if (char === ')') depth--;
      else if (char === ',' && depth === 0) {
        const trimmed = current.trim();
        if (trimmed) items.push(trimmed);
        current = '';
        continue;
      }
      current += char;
    }

    const lastTrimmed = current.trim();
    if (lastTrimmed) items.push(lastTrimmed);

    return items;
  }, []);

  // Split by semicolon
  const splitBySemicolon = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/;\s*/).map(s => s.trim()).filter(Boolean);
  }, []);

  // Parse urgency into level and description
  const parseUrgency = useCallback((urgency) => {
    if (!urgency) return { level: null, description: '' };
    const text = String(urgency);
    const match = text.match(/^(\w+)(?:\s*-\s*)(.*)/i);
    if (match && match[2]) {
      return { level: match[1], description: match[2].trim() };
    }
    const lower = text.toLowerCase();
    if (lower.startsWith('critical')) return { level: 'Critical', description: text };
    if (lower.startsWith('very high')) return { level: 'Very High', description: text };
    if (lower.startsWith('high')) return { level: 'High', description: text };
    if (lower.startsWith('moderate')) return { level: 'Moderate', description: text };
    if (lower.startsWith('medium')) return { level: 'Medium', description: text };
    if (lower.startsWith('low')) return { level: 'Low', description: text };
    return { level: null, description: text };
  }, []);

  // Urgency badge renderer — Very High/Critical strongest, then High, Medium/Moderate, Low
  const renderUrgencyBadge = useCallback((level) => {
    if (!level) return null;
    const lower = String(level).toLowerCase();
    let className = 'badge-routine';
    if (lower.includes('very high') || lower.includes('critical') || lower.includes('immediate')) className = 'badge-critical';
    else if (lower.includes('high') || lower.includes('urgent')) className = 'badge-high';
    else if (lower.includes('moderate') || lower.includes('medium')) className = 'badge-moderate';
    return <span className={`urgency-badge ${className}`}>{level}</span>;
  }, []);

  // Highlight text for search
  const highlightText = useCallback((text) => {
    if (!text) return '';
    const textStr = String(text);
    if (!searchTerm.trim()) return textStr;

    const phrase = searchTerm.trim();
    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedPhrase})`, 'gi');
    const parts = textStr.split(regex);

    if (parts.length === 1) return textStr;

    const phraseLower = phrase.toLowerCase();
    return parts.map((part, i) =>
      part.toLowerCase() === phraseLower ? <mark key={i}>{part}</mark> : part
    );
  }, [searchTerm]);

  // shouldShowRow - Level 4 row filtering
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

  // ============== EDITING HELPERS ==============

  const getFieldValue = useCallback((record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    const val = record[fieldName];
    if (Array.isArray(val)) return val.join(', ');
    return val;
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
    } catch (e) { /* ignore localStorage errors */ }
  }, []);

  // ============== SECTION_FIELDS + sectionHasEdits ==============
  const SECTION_FIELDS = {
    'report-info': ['reportType', 'referralStatus', 'urgency', 'coordinator'],
    'services': ['services'],
    'barriers': ['barriers'],
    'clinical': ['clinicalIndication', 'findings'],
    'recommendations': ['recommendations'],
    'followup': ['followUp'],
  };

  const sectionHasEdits = useCallback((sectionId) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    return Object.keys(localEdits).some(editKey => {
      const dashIdx = editKey.lastIndexOf('-');
      const fieldPart = editKey.substring(0, dashIdx);
      const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
      return fields.includes(baseField);
    });
  }, [localEdits]);

  // ============== 4 EDITING HANDLERS ==============

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
    if (!store[recId]) store[recId] = {};
    store[recId][fieldPart] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this record to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApprove = useCallback(async (record, idx, sectionId) => {
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
        const isArrayIdx = lastDot !== -1 && /^\d+$/.test(trailing);
        const payload = {
          field: isArrayIdx ? fieldPart.slice(0, lastDot) : fieldPart,
          value: localEdits[editKey],
        };
        if (isArrayIdx) payload.arrayIndex = parseInt(trailing, 10);
        await secureApiClient.put(`/api/edit/case_management/${recId}/edit`, payload);
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/case_management/${recId}/approve`);

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
      setEditedFields({});
      setEditedSentences({});
    } catch (err) {
      console.error('Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // ============== EDIT INDICATOR SVG ==============
  const editIndicator = (
    <span className="edit-indicator">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </span>
  );

  // Copy to clipboard helper
  const copyToClipboard = useCallback(async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, []);

  // ============== RENDER EDITABLE FIELD ==============
  // Fixed-choice fields edit via a dropdown instead of a textarea (stored value stays a plain string).
  const ENUM_FIELDS = {
    referralStatus: ['Active', 'Not Active'],
    urgency: ['Low', 'Medium', 'High', 'Very High'],
  };

  const renderEditableField = useCallback((record, fieldName, label, idx, sectionId) => {
    const canEdit = !!record._id;
    const value = getFieldValue(record, fieldName, idx);
    if (!value && !canEdit) return null;

    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const editKeyForCheck = `${fieldName}-${idx}`;
    const isModified = !!pendingEdits[editKeyForCheck];
    const enumOpts = ENUM_FIELDS[fieldName];

    if (isEditing) {
      return (
        <div className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              {enumOpts ? (
                <select className="edit-select" value={editValue} autoFocus onChange={(e) => setEditValue(e.target.value)}>
                  {!enumOpts.some(o => o.toLowerCase() === String(editValue).trim().toLowerCase()) && editValue ? <option value={editValue}>{editValue}</option> : null}
                  {enumOpts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <textarea
                  ref={textareaRef}
                  className="edit-textarea"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={3}
                />
              )}
              <div className="edit-actions">
                <button className="edit-cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                <button className="edit-save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId)} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {isModified ? (
          <>
            <div className="numbered-row modified">
              <div className={`row-content${canEdit ? ' editable' : ''}`}
                onClick={() => canEdit && handleStartEdit(fieldName, idx, value || '')}>
                <span className="content-value">{highlightText(value || '')}</span>
                {canEdit && editIndicator}
              </div>
              <button
                className={`copy-btn ${copiedId === `${fieldName}-${idx}` ? 'copied' : ''}`}
                onClick={() => copyToClipboard(String(value || ''), `${fieldName}-${idx}`)}
              >
                {copiedId === `${fieldName}-${idx}` ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="modified-badge">edited - click Pending Approve to save</div>
          </>
        ) : (
          <div className="numbered-row">
            <div className={`row-content${canEdit ? ' editable' : ''}`}
              onClick={() => canEdit && handleStartEdit(fieldName, idx, value || '')}>
              <span className="content-value">{highlightText(value || '')}</span>
              {canEdit && editIndicator}
            </div>
            <button
              className={`copy-btn ${copiedId === `${fieldName}-${idx}` ? 'copied' : ''}`}
              onClick={() => copyToClipboard(String(value || ''), `${fieldName}-${idx}`)}
            >
              {copiedId === `${fieldName}-${idx}` ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </div>
    );
  }, [editingField, editValue, saving, localEdits, copiedId, highlightText, handleStartEdit, handleCancelEdit, handleSaveField, getFieldValue, editIndicator, copyToClipboard]);

  // ============== RENDER EDITABLE ARRAY ITEM ==============
  const renderEditableArrayItem = useCallback((record, fieldName, arrayIndex, idx, sectionId, copyIdPrefix) => {
    const canEdit = !!record._id;
    const value = getArrayFieldValue(record, fieldName, arrayIndex, idx);
    if (!value && !canEdit) return null;

    const editKey = `${fieldName}.${arrayIndex}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const editKeyForCheck = `${fieldName}.${arrayIndex}-${idx}`;
    const isModified = !!pendingEdits[editKeyForCheck];

    if (isEditing) {
      return (
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
              <button className="edit-cancel-btn" onClick={handleCancelEdit}>Cancel</button>
              <button className="edit-save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId, arrayIndex)} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    const copyId = `${copyIdPrefix}-${arrayIndex}`;
    return isModified ? (
      <>
        <div className="numbered-row modified">
          <div className={`row-content${canEdit ? ' editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(`${fieldName}.${arrayIndex}`, idx, value || '')}>
            <span className="content-value">{highlightText(value || '')}</span>
            {canEdit && editIndicator}
          </div>
          <button
            className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(String(value || ''), copyId)}
          >
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="modified-badge">edited - click Pending Approve to save</div>
      </>
    ) : (
      <div className="numbered-row">
        <div className={`row-content${canEdit ? ' editable' : ''}`}
          onClick={() => canEdit && handleStartEdit(`${fieldName}.${arrayIndex}`, idx, value || '')}>
          <span className="content-value">{highlightText(value || '')}</span>
          {canEdit && editIndicator}
        </div>
        <button
          className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
          onClick={() => copyToClipboard(String(value || ''), copyId)}
        >
          {copiedId === copyId ? 'Copied!' : 'Copy'}
        </button>
      </div>
    );
  }, [editingField, editValue, saving, localEdits, copiedId, highlightText, handleStartEdit, handleCancelEdit, handleSaveField, getArrayFieldValue, editIndicator, copyToClipboard]);

  // ============== RENDER SECTION HEADER WITH APPROVE ==============
  const renderSectionHeader = useCallback((title, sectionId, record, idx, copyId, onCopy) => {
    return (
      <div className="section-header">
        <h3 className="section-title">{highlightText(title)}</h3>
        <div className="header-right-actions">
          <button
            className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
            onClick={onCopy}
          >
            {copiedId === copyId ? 'Copied!' : 'Copy Section'}
          </button>
          {(sectionHasEdits(sectionId) || approvedSections[sectionId]) && (
            <button
              className={`approve-btn${approvedSections[sectionId] ? ' approved' : ' pending'}`}
              onClick={() => handleApprove(record, idx, sectionId)}
              disabled={approving}
            >
              {approving ? 'Approving...' : approvedSections[sectionId] ? 'Approved' : 'Pending Approve'}
            </button>
          )}
        </div>
      </div>
    );
  }, [copiedId, approvedSections, approving, highlightText, sectionHasEdits, handleApprove]);

  // ============== PDF DATA MEMO ==============
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return unwrappedData;
    return unwrappedData.map((rec, idx) => {
      const merged = { ...rec };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldName = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx === idx) {
          if (fieldName.includes('.')) {
            const dotIdx = fieldName.indexOf('.');
            const arrField = fieldName.substring(0, dotIdx);
            const arrIdxStr = fieldName.substring(dotIdx + 1);
            const arrIdx = parseInt(arrIdxStr, 10);
            if (!isNaN(arrIdx) && Array.isArray(merged[arrField])) {
              merged[arrField] = [...merged[arrField]];
              merged[arrField][arrIdx] = editVal;
            }
          } else {
            merged[fieldName] = editVal;
          }
        }
      }
      return merged;
    });
  }, [unwrappedData, localEdits, pendingEdits]);

  // Document-level filtering with _showAllSections
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) {
      return pdfData.map(r => ({ ...r, _showAllSections: false }));
    }

    const phrase = searchTerm.toLowerCase().trim();

    return pdfData.map((record, idx) => {
      const recordTitle = `Case Management ${idx + 1}`;

      // Level 1: searchableText - all content
      const searchableText = [
        // Record title variations
        recordTitle, 'case management', 'Case Management', 'CASE MANAGEMENT',

        // Section titles with 3 case variations
        'Report Information', 'report information', 'REPORT INFORMATION',
        'Services Needed', 'services needed', 'SERVICES NEEDED',
        'Barriers to Care', 'barriers to care', 'BARRIERS TO CARE',
        'Clinical Assessment', 'clinical assessment', 'CLINICAL ASSESSMENT',
        'Clinical Indication', 'clinical indication', 'CLINICAL INDICATION',
        'Findings', 'findings', 'FINDINGS',
        'Recommendations', 'recommendations', 'RECOMMENDATIONS',
        'Follow-Up', 'follow-up', 'FOLLOW-UP', 'follow up', 'Follow Up',

        // Field labels
        'Status', 'status', 'STATUS',
        'Urgency', 'urgency', 'URGENCY',
        'Coordinator', 'coordinator', 'COORDINATOR',

        // Field values
        formatDate(record.reportDate),
        record.reportType,
        record.referralStatus,
        record.urgency,
        record.coordinator,
        record.clinicalIndication,
        record.findings,
        record.recommendations,
        record.followUp,

        // Array values
        ...(record.services || []),
        ...(record.barriers || [])
      ].filter(Boolean).join(' ').toLowerCase();

      // Check if document matches
      if (!searchableText.includes(phrase)) return null;

      // Check if record title matches for _showAllSections
      const titleMatches = recordTitle.toLowerCase().includes(phrase) ||
        'case management'.includes(phrase);

      return { ...record, _showAllSections: titleMatches };
    }).filter(Boolean);
  }, [pdfData, searchTerm, formatDate]);

  // Get all record text for Copy All — uses pdfData
  const getAllRecordText = useCallback((record, idx) => {
    const lines = [];
    lines.push(`CASE MANAGEMENT ${idx + 1}`);
    lines.push('═══════════════════════════════════════');

    if (record.reportDate) lines.push(`Date: ${formatDate(record.reportDate)}`);
    if (record.reportType) lines.push(`Report Type: ${record.reportType}`);

    // Report Information
    if (record.reportType || record.referralStatus || record.urgency || record.coordinator) {
      lines.push('', 'REPORT INFORMATION', '───────────────────────────────────────');
      if (record.reportType) lines.push(`Report Type: ${record.reportType}`);
      if (record.referralStatus) lines.push(`Status: ${record.referralStatus}`);
      if (record.urgency) lines.push(`Urgency: ${record.urgency}`);
      if (record.coordinator) {
        const coordParts = record.coordinator.split(';').map(s => s.trim()).filter(Boolean);
        coordParts.forEach((part, ci) => lines.push(`Coordinator ${ci + 1}: ${part}`));
      }
    }

    // Services Needed
    if (record.services?.length > 0) {
      lines.push('', 'SERVICES NEEDED', '───────────────────────────────────────');
      record.services.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }

    // Barriers to Care
    if (record.barriers?.length > 0) {
      lines.push('', 'BARRIERS TO CARE', '───────────────────────────────────────');
      record.barriers.forEach((b, i) => lines.push(`${i + 1}. ${b}`));
    }

    // Clinical Assessment
    if (record.clinicalIndication || record.findings) {
      lines.push('', 'CLINICAL ASSESSMENT', '───────────────────────────────────────');
      if (record.clinicalIndication) {
        lines.push('Clinical Indication:');
        const indParts = record.clinicalIndication.split(';').map(s => s.trim()).filter(Boolean);
        indParts.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
      }
      if (record.findings) {
        lines.push('', 'Findings:');
        // Match parseFindingsGroups: split by ". " then detect subtitle pattern
        const sentences = record.findings.split(/\.\s+/).map(s => s.replace(/\.$/, '').trim()).filter(Boolean);
        let fNum = 1;
        for (const sentence of sentences) {
          const colonIdx = sentence.indexOf(':');
          const firstSemiIdx = sentence.indexOf(';');
          if (colonIdx > 0 && firstSemiIdx > colonIdx) {
            const subtitle = sentence.substring(0, colonIdx).trim();
            const items = sentence.substring(colonIdx + 1).split(';').map(s => s.trim()).filter(Boolean);
            lines.push(`  ${subtitle}:`);
            items.forEach(item => { lines.push(`    ${fNum}. ${item}`); fNum++; });
          } else if (sentence.includes(';')) {
            const items = sentence.split(';').map(s => s.trim()).filter(Boolean);
            items.forEach(item => { lines.push(`  ${fNum}. ${item}`); fNum++; });
          } else {
            lines.push(`  ${fNum}. ${sentence}`); fNum++;
          }
        }
      }
    }

    // Recommendations
    if (record.recommendations) {
      lines.push('', 'RECOMMENDATIONS', '───────────────────────────────────────');
      const parsedGroups = parseFindingsWithLabels(record.recommendations);
      let itemNum = 1;
      parsedGroups.forEach(group => {
        if (group.label) {
          lines.push('', `${group.label}:`);
          group.items.forEach(item => {
            lines.push(`  ${itemNum}. ${item}`);
            itemNum++;
          });
        } else {
          group.items.forEach(item => {
            lines.push(`${itemNum}. ${item}`);
            itemNum++;
          });
        }
      });
    }

    // Follow-Up
    if (record.followUp) {
      lines.push('', 'FOLLOW-UP', '───────────────────────────────────────');
      const followUpSentences = splitBySentence(record.followUp);
      followUpSentences.forEach((s, i) => {
        lines.push(`${i + 1}. ${s}`);
      });
    }

    return lines.join('\n');
  }, [formatDate, splitBySentence, parseFindingsWithLabels]);

  // Empty state
  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <div className="case-management-document">
        <div className="document-header">
          <h1 className="document-title">Case Management</h1>
        </div>
        <p className="no-data-message">No case management records available.</p>
      </div>
    );
  }

  return (
    <div className="case-management-document">
      {/* Document Header - 3 Rows */}
      <div className="document-header">
        {/* Row 1: Title */}
        <h1 className="document-title">Case Management</h1>

        {/* Row 2: Actions */}
        <div className="header-actions">
          <button
            className={`copy-btn ${copiedId === 'all-documents' ? 'copied' : ''}`}
            onClick={() => {
              const allText = pdfData.map((r, i) => getAllRecordText(r, i)).join('\n\n');
              copyToClipboard(allText, 'all-documents');
            }}
          >
            {copiedId === 'all-documents' ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<CaseManagementDocumentPDFTemplate document={pdfData} />}
            fileName="Case_Management.pdf"
            className="pdf-btn"
          >
            {({ loading }) => (loading ? 'Preparing...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>

        {/* Row 3: Search */}
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search case management records..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>
          )}
        </div>
      </div>

      {/* Search Results Count */}
      {searchTerm.trim() && (
        <div className="search-results-count">
          Showing {filteredRecords.length} of {unwrappedData.length} record{unwrappedData.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* No Results */}
      {filteredRecords.length === 0 && searchTerm.trim() && (
        <p className="no-data-message">No records match your search.</p>
      )}

      {/* Records List */}
      <div className="records-list">
        {filteredRecords.map((record, idx) => {
          const isSearching = searchTerm.trim().length > 0;
          const urgencyParsed = parseUrgency(record.urgency);

          return (
            <div key={record._id || idx} className="record-card">
              {/* Record Header */}
              <div className="record-header">
                <div className="header-top-row">
                  {record.reportDate && (
                    <span className="date-badge">{highlightText(formatDate(record.reportDate))}</span>
                  )}
                </div>
                <h2 className="record-title">
                  {highlightText(`Case Management ${idx + 1}`)}
                </h2>
              </div>

              {/* Report Information Section */}
              {(() => {
                const sectionTitleMatches = (() => {
                  if (!searchTerm.trim() || record._showAllSections) return true;
                  return shouldShowRow(record,
                    'Report Information', 'report information', 'REPORT INFORMATION',
                    'Report Type', 'report type', 'REPORT TYPE',
                    'Status', 'status', 'STATUS',
                    'Urgency', 'urgency', 'URGENCY',
                    'Coordinator', 'coordinator', 'COORDINATOR'
                  );
                })();

                const hasReportType = record.reportType &&
                  (!isSearching || sectionTitleMatches || shouldShowRow(record, record.reportType));
                const hasStatus = record.referralStatus &&
                  (!isSearching || sectionTitleMatches || shouldShowRow(record, record.referralStatus));
                const hasUrgency = record.urgency &&
                  (!isSearching || sectionTitleMatches || shouldShowRow(record, record.urgency));
                const hasCoordinator = record.coordinator &&
                  (!isSearching || sectionTitleMatches || shouldShowRow(record, record.coordinator));

                if (!hasReportType && !hasStatus && !hasUrgency && !hasCoordinator) return null;

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Report Information', 'report-info', record, idx, `info-${idx}`, () => {
                        const lines = ['REPORT INFORMATION', '═══════════════════════════════════════'];
                        const typeVal = getFieldValue(record, 'reportType', idx);
                        const statusVal = getFieldValue(record, 'referralStatus', idx);
                        const urgencyVal = getFieldValue(record, 'urgency', idx);
                        const coordVal = getFieldValue(record, 'coordinator', idx);
                        if (typeVal) lines.push(`Report Type: ${typeVal}`);
                        if (statusVal) lines.push(`Status: ${statusVal}`);
                        if (urgencyVal) lines.push(`Urgency: ${urgencyVal}`);
                        if (coordVal) {
                          const coordParts = coordVal.split(';').map(s => s.trim()).filter(Boolean);
                          coordParts.forEach((part, ci) => lines.push(`Coordinator ${ci + 1}: ${part}`));
                        }
                        copyToClipboard(lines.join('\n'), `info-${idx}`);
                      })}

                      {hasReportType && renderEditableField(record, 'reportType', 'Report Type', idx, 'report-info')}
                      {hasStatus && renderEditableField(record, 'referralStatus', 'Status', idx, 'report-info')}

                      {hasUrgency && (() => {
                        const canEdit = !!record._id;
                        const urgValue = getFieldValue(record, 'urgency', idx);
                        const editKey = `urgency-${idx}-s0`;
                        const isEditing = editingField === editKey;
                        const editKeyCheck = `urgency-${idx}`;
                        const isModified = !!pendingEdits[editKeyCheck];
                        const urgParsed = parseUrgency(urgValue);

                        if (isEditing) {
                          return (
                            <div className="rec-mini-card">
                              <div className="nested-subtitle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{highlightText('Urgency')}</span>
                                {urgParsed.level && renderUrgencyBadge(urgParsed.level)}
                              </div>
                              <div className="numbered-row edit-row">
                                <div className="edit-field-container">
                                  <select className="edit-select" value={editValue} autoFocus onChange={(e) => setEditValue(e.target.value)}>
                                    {!ENUM_FIELDS.urgency.some(o => o.toLowerCase() === String(editValue).trim().toLowerCase()) && editValue ? <option value={editValue}>{editValue}</option> : null}
                                    {ENUM_FIELDS.urgency.map(o => <option key={o} value={o}>{o}</option>)}
                                  </select>
                                  <div className="edit-actions">
                                    <button className="edit-cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                                    <button className="edit-save-btn" onClick={() => handleSaveField(record, 'urgency', idx, 'report-info')} disabled={saving}>
                                      {saving ? 'Saving...' : 'Save'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{highlightText('Urgency')}</span>
                              {urgParsed.level && renderUrgencyBadge(urgParsed.level)}
                            </div>
                            {isModified ? (
                              <>
                                <div className="numbered-row modified">
                                  <div className={`row-content${canEdit ? ' editable' : ''}`}
                                    onClick={() => canEdit && handleStartEdit('urgency', idx, urgValue || '')}>
                                    <span className="content-value">{highlightText(urgParsed.description || urgValue)}</span>
                                    {canEdit && editIndicator}
                                  </div>
                                  <button
                                    className={`copy-btn ${copiedId === `urgency-${idx}` ? 'copied' : ''}`}
                                    onClick={() => copyToClipboard(urgValue, `urgency-${idx}`)}
                                  >
                                    {copiedId === `urgency-${idx}` ? 'Copied!' : 'Copy'}
                                  </button>
                                </div>
                                <div className="modified-badge">edited - click Pending Approve to save</div>
                              </>
                            ) : (
                              <div className="numbered-row">
                                <div className={`row-content${canEdit ? ' editable' : ''}`}
                                  onClick={() => canEdit && handleStartEdit('urgency', idx, urgValue || '')}>
                                  <span className="content-value">{highlightText(urgParsed.description || urgValue)}</span>
                                  {canEdit && editIndicator}
                                </div>
                                <button
                                  className={`copy-btn ${copiedId === `urgency-${idx}` ? 'copied' : ''}`}
                                  onClick={() => copyToClipboard(urgValue, `urgency-${idx}`)}
                                >
                                  {copiedId === `urgency-${idx}` ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {hasCoordinator && (() => {
                        const canEdit = !!record._id;
                        const coordVal = getFieldValue(record, 'coordinator', idx);
                        const editKeyCheck = `coordinator-${idx}`;
                        const isModified = !!pendingEdits[editKeyCheck];
                        const coordParts = (coordVal || '').split(';').map(s => s.trim()).filter(Boolean);

                        return (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText('Coordinator')}</div>
                            {coordParts.map((part, pIdx) => {
                              const rowEditKey = `coordinator.r${pIdx}-${idx}-s0`;
                              const isEditingRow = editingField === rowEditKey;

                              if (isEditingRow) {
                                return (
                                  <div key={pIdx} className="numbered-row edit-row">
                                    <div className="edit-field-container">
                                      <textarea ref={textareaRef} className="edit-textarea" value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)} rows={2} />
                                      <div className="edit-actions">
                                        <button className="edit-cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                                        <button className="edit-save-btn" disabled={saving} onClick={() => {
                                          const newParts = [...coordParts];
                                          newParts[pIdx] = editValue.trim();
                                          handleSaveField(record, 'coordinator', idx, 'report-info', undefined, newParts.join('; '));
                                        }}>{saving ? 'Saving...' : 'Save'}</button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div key={pIdx} className={`numbered-row${isModified ? ' modified' : ''}`}>
                                  <div className={`row-content${canEdit ? ' editable' : ''}`}
                                    onClick={() => { if (!canEdit) return; setEditingField(rowEditKey); setEditValue(part); setTimeout(() => textareaRef.current?.focus(), 50); }}>
                                    <span className="content-value">{highlightText(part)}</span>
                                    {canEdit && editIndicator}
                                  </div>
                                  <button className={`copy-btn ${copiedId === `coord-${idx}-${pIdx}` ? 'copied' : ''}`}
                                    onClick={() => copyToClipboard(part, `coord-${idx}-${pIdx}`)}>
                                    {copiedId === `coord-${idx}-${pIdx}` ? 'Copied!' : 'Copy'}
                                  </button>
                                </div>
                              );
                            })}
                            {isModified && <div className="modified-badge">edited - click Pending Approve to save</div>}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })()}

              {/* Services Needed Section */}
              {(() => {
                if (!record.services || record.services.length === 0) return null;

                const sectionTitleMatches = (() => {
                  if (!searchTerm.trim() || record._showAllSections) return true;
                  return shouldShowRow(record,
                    'Services Needed', 'services needed', 'SERVICES NEEDED',
                    'Services', 'services', 'SERVICES'
                  );
                })();

                // Build visible array items with original indices
                const visibleServices = record.services
                  .map((service, origIdx) => ({ service: getArrayFieldValue(record, 'services', origIdx, idx) || service, origIdx }))
                  .filter(({ service }) =>
                    !isSearching || sectionTitleMatches || shouldShowRow(record, service)
                  );

                if (visibleServices.length === 0) return null;

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Services Needed', 'services', record, idx, `services-${idx}`, () => {
                        const lines = ['SERVICES NEEDED', '═══════════════════════════════════════'];
                        const allServices = record.services.map((s, si) => getArrayFieldValue(record, 'services', si, idx) || s);
                        allServices.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
                        copyToClipboard(lines.join('\n'), `services-${idx}`);
                      })}

                      {visibleServices.map(({ service, origIdx }) => (
                        <React.Fragment key={origIdx}>
                          {renderEditableArrayItem(record, 'services', origIdx, idx, 'services', `serv-${idx}`)}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Barriers to Care Section */}
              {(() => {
                if (!record.barriers || record.barriers.length === 0) return null;

                const sectionTitleMatches = (() => {
                  if (!searchTerm.trim() || record._showAllSections) return true;
                  return shouldShowRow(record,
                    'Barriers to Care', 'barriers to care', 'BARRIERS TO CARE',
                    'Barriers', 'barriers', 'BARRIERS'
                  );
                })();

                const visibleBarriers = record.barriers
                  .map((barrier, origIdx) => ({ barrier: getArrayFieldValue(record, 'barriers', origIdx, idx) || barrier, origIdx }))
                  .filter(({ barrier }) =>
                    !isSearching || sectionTitleMatches || shouldShowRow(record, barrier)
                  );

                if (visibleBarriers.length === 0) return null;

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Barriers to Care', 'barriers', record, idx, `barriers-${idx}`, () => {
                        const lines = ['BARRIERS TO CARE', '═══════════════════════════════════════'];
                        const allBarriers = record.barriers.map((b, bi) => getArrayFieldValue(record, 'barriers', bi, idx) || b);
                        allBarriers.forEach((b, i) => lines.push(`${i + 1}. ${b}`));
                        copyToClipboard(lines.join('\n'), `barriers-${idx}`);
                      })}

                      {visibleBarriers.map(({ barrier, origIdx }) => (
                        <React.Fragment key={origIdx}>
                          {renderEditableArrayItem(record, 'barriers', origIdx, idx, 'barriers', `barr-${idx}`)}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Clinical Assessment Section */}
              {(() => {
                const sectionTitleMatches = (() => {
                  if (!searchTerm.trim() || record._showAllSections) return true;
                  return shouldShowRow(record,
                    'Clinical Assessment', 'clinical assessment', 'CLINICAL ASSESSMENT',
                    'Clinical Indication', 'clinical indication', 'CLINICAL INDICATION',
                    'Findings', 'findings', 'FINDINGS'
                  );
                })();

                const indicationVal = getFieldValue(record, 'clinicalIndication', idx);
                const findingsVal = getFieldValue(record, 'findings', idx);

                const hasIndication = indicationVal &&
                  (!isSearching || sectionTitleMatches || shouldShowRow(record, indicationVal));
                const hasFindings = findingsVal &&
                  (!isSearching || sectionTitleMatches || shouldShowRow(record, findingsVal));

                if (!hasIndication && !hasFindings) return null;

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Clinical Assessment', 'clinical', record, idx, `clinical-${idx}`, () => {
                        const lines = ['CLINICAL ASSESSMENT', '═══════════════════════════════════════'];
                        if (indicationVal) {
                          lines.push('Clinical Indication:');
                          const indCopyParts = indicationVal.split(';').map(s => s.trim()).filter(Boolean);
                          indCopyParts.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
                        }
                        if (findingsVal) {
                          lines.push('', 'Findings:');
                          // Match parseFindingsGroups: split by ". " then detect subtitle pattern
                          const sentences = findingsVal.split(/\.\s+/).map(s => s.replace(/\.$/, '').trim()).filter(Boolean);
                          let fNum = 1;
                          for (const sentence of sentences) {
                            const colonIdx = sentence.indexOf(':');
                            const firstSemiIdx = sentence.indexOf(';');
                            if (colonIdx > 0 && firstSemiIdx > colonIdx) {
                              const subtitle = sentence.substring(0, colonIdx).trim();
                              const items = sentence.substring(colonIdx + 1).split(';').map(s => s.trim()).filter(Boolean);
                              lines.push(`  ${subtitle}:`);
                              items.forEach(item => { lines.push(`    ${fNum}. ${item}`); fNum++; });
                            } else if (sentence.includes(';')) {
                              const items = sentence.split(';').map(s => s.trim()).filter(Boolean);
                              items.forEach(item => { lines.push(`  ${fNum}. ${item}`); fNum++; });
                            } else {
                              lines.push(`  ${fNum}. ${sentence}`); fNum++;
                            }
                          }
                        }
                        copyToClipboard(lines.join('\n'), `clinical-${idx}`);
                      })}

                      {hasIndication && (() => {
                        const canEdit = !!record._id;
                        const editKeyCheck = `clinicalIndication-${idx}`;
                        const isModified = !!pendingEdits[editKeyCheck];
                        const indParts = (indicationVal || '').split(';').map(s => s.trim()).filter(Boolean);

                        return (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText('Clinical Indication')}</div>
                            {indParts.map((part, pIdx) => {
                              const rowEditKey = `clinicalIndication.r${pIdx}-${idx}-s0`;
                              const isEditingRow = editingField === rowEditKey;

                              if (isEditingRow) {
                                return (
                                  <div key={pIdx} className="numbered-row edit-row">
                                    <div className="edit-field-container">
                                      <textarea ref={textareaRef} className="edit-textarea" value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)} rows={2} />
                                      <div className="edit-actions">
                                        <button className="edit-cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                                        <button className="edit-save-btn" disabled={saving} onClick={() => {
                                          const newParts = [...indParts];
                                          newParts[pIdx] = editValue.trim();
                                          handleSaveField(record, 'clinicalIndication', idx, 'clinical', undefined, newParts.join('; '));
                                        }}>{saving ? 'Saving...' : 'Save'}</button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div key={pIdx} className={`numbered-row${isModified ? ' modified' : ''}`}>
                                  <div className={`row-content${canEdit ? ' editable' : ''}`}
                                    onClick={() => { if (!canEdit) return; setEditingField(rowEditKey); setEditValue(part); setTimeout(() => textareaRef.current?.focus(), 50); }}>
                                    <span className="content-value">{highlightText(part)}</span>
                                    {canEdit && editIndicator}
                                  </div>
                                  <button className={`copy-btn ${copiedId === `ind-${idx}-${pIdx}` ? 'copied' : ''}`}
                                    onClick={() => copyToClipboard(part, `ind-${idx}-${pIdx}`)}>
                                    {copiedId === `ind-${idx}-${pIdx}` ? 'Copied!' : 'Copy'}
                                  </button>
                                </div>
                              );
                            })}
                            {isModified && <div className="modified-badge">edited - click Pending Approve to save</div>}
                          </div>
                        );
                      })()}

                      {hasFindings && (() => {
                        const canEdit = !!record._id;
                        const editKeyCheck = `findings-${idx}`;
                        const isModified = !!pendingEdits[editKeyCheck];

                        // Parse findings into groups: sentences, subtitle+items, semicolon lists
                        const parseFindingsGroups = (text) => {
                          if (!text) return { groups: [], flatItems: [] };
                          const groups = [];
                          const flatItems = [];
                          // Split by ". " (period + space) for sentence boundaries
                          const sentences = text.split(/\.\s+/).map(s => s.replace(/\.$/, '').trim()).filter(Boolean);
                          for (const sentence of sentences) {
                            const colonIdx = sentence.indexOf(':');
                            const firstSemiIdx = sentence.indexOf(';');
                            if (colonIdx > 0 && firstSemiIdx > colonIdx) {
                              // "Subtitle: item1; item2; item3" pattern
                              const subtitle = sentence.substring(0, colonIdx).trim();
                              const items = sentence.substring(colonIdx + 1).split(';').map(s => s.trim()).filter(Boolean);
                              const startIdx = flatItems.length;
                              items.forEach(item => flatItems.push(item));
                              groups.push({ type: 'subtitle-group', subtitle, items, startIdx, count: items.length });
                            } else if (sentence.includes(';')) {
                              const items = sentence.split(';').map(s => s.trim()).filter(Boolean);
                              const startIdx = flatItems.length;
                              items.forEach(item => flatItems.push(item));
                              groups.push({ type: 'items', items, startIdx, count: items.length });
                            } else {
                              const startIdx = flatItems.length;
                              flatItems.push(sentence);
                              groups.push({ type: 'text', text: sentence, startIdx, count: 1 });
                            }
                          }
                          return { groups, flatItems };
                        };

                        const reconstructFindings = (groups, flatItems) => {
                          const parts = [];
                          for (const g of groups) {
                            if (g.type === 'subtitle-group') {
                              const items = flatItems.slice(g.startIdx, g.startIdx + g.count);
                              parts.push(`${g.subtitle}: ${items.join('; ')}`);
                            } else if (g.type === 'items') {
                              const items = flatItems.slice(g.startIdx, g.startIdx + g.count);
                              parts.push(items.join('; '));
                            } else {
                              parts.push(flatItems[g.startIdx]);
                            }
                          }
                          return parts.join('. ') + '.';
                        };

                        const parsed = parseFindingsGroups(findingsVal);
                        const { groups: fGroups, flatItems } = parsed;

                        // Check which flat row is being edited
                        const editingFlatIdx = (() => {
                          if (!editingField) return -1;
                          const match = editingField.match(/^findings\.r(\d+)-/);
                          return match ? parseInt(match[1], 10) : -1;
                        })();

                        const renderFindingsRow = (text, flatIdx) => {
                          const rowEditKey = `findings.r${flatIdx}-${idx}-s0`;
                          const isEditingRow = editingField === rowEditKey;

                          if (isEditingRow) {
                            return (
                              <div key={flatIdx} className="numbered-row edit-row">
                                <div className="edit-field-container">
                                  <textarea
                                    ref={textareaRef}
                                    className="edit-textarea"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    rows={2}
                                  />
                                  <div className="edit-actions">
                                    <button className="edit-cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                                    <button className="edit-save-btn" disabled={saving} onClick={() => {
                                      const newFlat = [...flatItems];
                                      newFlat[flatIdx] = editValue.trim();
                                      const reconstructed = reconstructFindings(fGroups, newFlat);
                                      handleSaveField(record, 'findings', idx, 'clinical', undefined, reconstructed);
                                    }}>
                                      {saving ? 'Saving...' : 'Save'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={flatIdx} className={`numbered-row${isModified ? ' modified' : ''}`}>
                              <div className={`row-content${canEdit ? ' editable' : ''}`}
                                onClick={() => {
                                  if (!canEdit) return;
                                  setEditingField(`findings.r${flatIdx}-${idx}-s0`);
                                  setEditValue(text);
                                  setTimeout(() => textareaRef.current?.focus(), 50);
                                }}>
                                <span className="content-value">{highlightText(text)}</span>
                                {canEdit && editIndicator}
                              </div>
                              <button
                                className={`copy-btn ${copiedId === `finding-${idx}-${flatIdx}` ? 'copied' : ''}`}
                                onClick={() => copyToClipboard(text, `finding-${idx}-${flatIdx}`)}
                              >
                                {copiedId === `finding-${idx}-${flatIdx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          );
                        };

                        return (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText('Findings')}</div>
                            {fGroups.map((group, gIdx) => {
                              if (group.type === 'subtitle-group') {
                                return (
                                  <div key={gIdx} className="rec-mini-card">
                                    <div className="nested-subtitle">{highlightText(group.subtitle)}</div>
                                    {group.items.map((item, iIdx) => renderFindingsRow(item, group.startIdx + iIdx))}
                                  </div>
                                );
                              } else if (group.type === 'items') {
                                return group.items.map((item, iIdx) => renderFindingsRow(item, group.startIdx + iIdx));
                              } else {
                                return renderFindingsRow(group.text, group.startIdx);
                              }
                            })}
                            {isModified && <div className="modified-badge">edited - click Pending Approve to save</div>}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })()}

              {/* Recommendations Section */}
              {(() => {
                const recsVal = getFieldValue(record, 'recommendations', idx);
                if (!recsVal) return null;

                const sectionTitleMatches = (() => {
                  if (!searchTerm.trim() || record._showAllSections) return true;
                  return shouldShowRow(record,
                    'Recommendations', 'recommendations', 'RECOMMENDATIONS'
                  );
                })();

                if (!sectionTitleMatches && !shouldShowRow(record, recsVal)) return null;

                // Parse for display (read-only view of the parsed structure)
                const parsedGroups = parseFindingsWithLabels(recsVal);
                const superGroups = groupRecommendationsByParent(parsedGroups);

                const canEdit = !!record._id;
                const editKey = `recommendations-${idx}-s0`;
                const isEditing = editingField === editKey;
                const editKeyCheck = `recommendations-${idx}`;
                const isModified = !!pendingEdits[editKeyCheck];

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Recommendations', 'recommendations', record, idx, `recs-${idx}`, () => {
                        const lines = ['RECOMMENDATIONS', '═══════════════════════════════════════'];
                        let recNum = 1;
                        superGroups.forEach((sg, sgIdx) => {
                          if (sg.parent) {
                            lines.push('', `RECOMMENDATION ${sgIdx + 1}:`);
                            lines.push(`  ${recNum}. ${sg.parent}`);
                            recNum++;
                          }
                          sg.children.forEach(child => {
                            if (child.label) {
                              lines.push(`  ${child.label}:`);
                            }
                            child.items.forEach(item => {
                              lines.push(`    ${recNum}. ${item}`);
                              recNum++;
                            });
                          });
                        });
                        copyToClipboard(lines.join('\n'), `recs-${idx}`);
                      })}

                      {(() => {
                        // Build a flat list of every editable item in render order
                        // (parent first, then each labeled child's items), aligned with the
                        // parsed superGroup structure so reconstruction is lossless.
                        const flatItems = [];
                        superGroups.forEach(sg => {
                          if (sg.parent) flatItems.push(sg.parent);
                          sg.children.forEach(child => {
                            child.items.forEach(item => flatItems.push(item));
                          });
                        });

                        // Rebuild the original recommendations string from the (possibly edited)
                        // flat item list, mirroring the display structure: a parent is one
                        // sentence, a labeled child becomes "Label: item1, item2, ...".
                        const reconstructRecommendations = (items) => {
                          let cur = 0;
                          const sentences = [];
                          superGroups.forEach(sg => {
                            if (sg.parent) {
                              sentences.push(items[cur++]);
                            }
                            sg.children.forEach(child => {
                              const childItems = child.items.map(() => items[cur++]).filter(v => v != null && v !== '');
                              if (childItems.length === 0) return;
                              if (child.label) {
                                sentences.push(`${child.label}: ${childItems.join(', ')}`);
                              } else {
                                childItems.forEach(ci => sentences.push(ci));
                              }
                            });
                          });
                          const cleaned = sentences.filter(s => s != null && String(s).trim() !== '');
                          if (cleaned.length === 0) return '';
                          return cleaned
                            .map(s => { const t = String(s).trim(); return /[.!?]$/.test(t) ? t : `${t}.`; })
                            .join(' ');
                        };

                        let flatIdx = 0;

                        const renderRecRow = (text, fIdx, copyId) => {
                          const rowEditKey = `recommendations.r${fIdx}-${idx}-s0`;
                          const isEditingRow = editingField === rowEditKey;

                          if (isEditingRow) {
                            return (
                              <div key={`edit-${fIdx}`} className="numbered-row edit-row">
                                <div className="edit-field-container">
                                  <textarea ref={textareaRef} className="edit-textarea" value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)} rows={2} />
                                  <div className="edit-actions">
                                    <button className="edit-cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                                    <button className="edit-save-btn" disabled={saving} onClick={() => {
                                      const newFlat = [...flatItems];
                                      newFlat[fIdx] = editValue.trim();
                                      handleSaveField(record, 'recommendations', idx, 'recommendations', undefined, reconstructRecommendations(newFlat));
                                    }}>{saving ? 'Saving...' : 'Save'}</button>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={fIdx} className={`numbered-row${isModified ? ' modified' : ''}`}>
                              <div className={`row-content${canEdit ? ' editable' : ''}`}
                                onClick={() => { if (!canEdit) return; setEditingField(rowEditKey); setEditValue(text); setTimeout(() => textareaRef.current?.focus(), 50); }}>
                                <span className="content-value">{highlightText(text)}</span>
                                {canEdit && editIndicator}
                              </div>
                              <button className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
                                onClick={() => copyToClipboard(text, copyId)}>
                                {copiedId === copyId ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          );
                        };

                        // Map parsed display groups to flat indices matching rawParts
                        // We track flatIdx across all items to align with rawParts
                        return (
                          <>
                            {superGroups.map((sg, sgIdx) => {
                              const showAll = !isSearching || sectionTitleMatches;

                              return (
                                <div key={sgIdx} className="recommendation-group">
                                  {sg.parent && (() => {
                                    const fi = flatIdx++;
                                    return (
                                      <div className="rec-mini-card parent-recommendation">
                                        {renderRecRow(sg.parent, fi, `rec-parent-${idx}-${sgIdx}`)}
                                      </div>
                                    );
                                  })()}

                                  {sg.children.map((child, cIdx) => {
                                    const childLabelMatches = isSearching && child.label && shouldShowRow(record, child.label);
                                    const showChild = showAll || childLabelMatches ||
                                      child.items.some(item => shouldShowRow(record, item));

                                    const childItems = child.items.map((item, itemIdx) => {
                                      const fi = flatIdx++;
                                      const showItem = showAll || childLabelMatches || shouldShowRow(record, item);
                                      if (!showChild || !showItem) return null;
                                      return renderRecRow(item, fi, `rec-${idx}-${sgIdx}-${cIdx}-${itemIdx}`);
                                    });

                                    if (!showChild) return null;

                                    return (
                                      <div key={cIdx} className="rec-mini-card child-recommendation">
                                        {child.label && (
                                          <div className="nested-subtitle">{highlightText(child.label)}</div>
                                        )}
                                        {childItems}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                            {isModified && <div className="modified-badge">edited - click Pending Approve to save</div>}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                );
              })()}

              {/* Follow-Up Section — per-sentence editing */}
              {(() => {
                const followUpVal = getFieldValue(record, 'followUp', idx);
                if (!followUpVal) return null;
                const canEdit = !!record._id;

                const sectionTitleMatches = (() => {
                  if (!searchTerm.trim() || record._showAllSections) return true;
                  return shouldShowRow(record,
                    'Follow-Up', 'follow-up', 'FOLLOW-UP',
                    'Follow Up', 'follow up', 'FOLLOW UP'
                  );
                })();

                const sentences = splitBySentence(followUpVal);
                const visibleSentences = sentences
                  .map((sentence, origIdx) => ({ sentence, origIdx }))
                  .filter(({ sentence }) => sectionTitleMatches || shouldShowRow(record, sentence));

                if (visibleSentences.length === 0) return null;

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Follow-Up', 'followup', record, idx, `followup-${idx}`, () => {
                        const lines = ['FOLLOW-UP', '═══════════════════════════════════════'];
                        sentences.forEach((s, i) => {
                          lines.push(`${i + 1}. ${s}`);
                        });
                        copyToClipboard(lines.join('\n'), `followup-${idx}`);
                      })}

                      {visibleSentences.map(({ sentence, origIdx: sIdx }) => {
                        const editKey = `followUp-${idx}-s${sIdx}`;
                        const isEditingRow = editingField === editKey;
                        const sentenceState = editedSentences[editKey];
                        const isEdited = sentenceState === 'edited';
                        const isAdded = sentenceState === 'added';

                        if (isEditingRow) {
                          return (
                            <div key={sIdx} className="numbered-row edit-row">
                              <div className="edit-field-container">
                                <textarea
                                  ref={textareaRef}
                                  className="edit-textarea"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  rows={2}
                                />
                                <div className="edit-actions">
                                  <button className="edit-cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                                  <button
                                    className="edit-save-btn"
                                    disabled={saving}
                                    onClick={() => {
                                      let editedSentence = editValue.trim();
                                      if (editedSentence && !/[.!?]$/.test(editedSentence)) {
                                        editedSentence += '.';
                                      }
                                      const allCurrent = splitBySentence(followUpVal);
                                      const updated = allCurrent.map((s, i) => {
                                        if (i === sIdx) return editedSentence;
                                        if (s && !/[.!?]$/.test(s)) return s + '.';
                                        return s;
                                      });
                                      const fullText = updated.join(' ');

                                      const newSentences = splitBySentence(fullText);
                                      const extraCount = newSentences.length - allCurrent.length;
                                      if (extraCount > 0) {
                                        const editedMap = {};
                                        editedMap[`followUp-${idx}-s${sIdx}`] = 'edited';
                                        for (let si = sIdx + 1; si <= sIdx + extraCount; si++) {
                                          editedMap[`followUp-${idx}-s${si}`] = 'added';
                                        }
                                        setEditedSentences(prev => {
                                          const cleaned = {};
                                          for (const key of Object.keys(prev)) {
                                            if (!key.startsWith(`followUp-${idx}-s`)) cleaned[key] = prev[key];
                                          }
                                          return { ...cleaned, ...editedMap };
                                        });
                                      }
                                      handleSaveField(record, 'followUp', idx, 'followup', undefined, fullText, sIdx);
                                    }}
                                  >
                                    {saving ? 'Saving...' : 'Save'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <React.Fragment key={sIdx}>
                            <div className={`numbered-row${isEdited ? ' modified' : ''}${isAdded ? ' added' : ''}`}>
                              <div className={`row-content${canEdit ? ' editable' : ''}`}
                                onClick={() => {
                                  if (!canEdit) return;
                                  const editText = sentence.replace(/[.!?]+$/, '').trim();
                                  handleStartEdit('followUp', idx, editText, sIdx);
                                }}>
                                <span className="content-value">{highlightText(sentence)}</span>
                                {canEdit && editIndicator}
                              </div>
                              <button
                                className={`copy-btn ${copiedId === `followUp-s${sIdx}-${idx}` ? 'copied' : ''}`}
                                onClick={() => copyToClipboard(sentence, `followUp-s${sIdx}-${idx}`)}
                              >
                                {copiedId === `followUp-s${sIdx}-${idx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                            {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
                            {isAdded && <div className="added-badge">Added</div>}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CaseManagementDocument;
