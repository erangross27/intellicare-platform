import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SocialHistoryDocumentPDFTemplate from '../pdf-templates/SocialHistoryDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './SocialHistoryDocument.css';

/**
 * SocialHistoryDocument - December 2025
 * 4-level search, mini-card pattern, blue theme
 */

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'social_historyPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const SocialHistoryDocument = ({ document, data }) => {
  const templateData = document || data;
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Editing state
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

  // Data unwrapping
  const unwrappedData = useMemo(() => {
    if (!templateData) return [];
    if (Array.isArray(templateData)) {
      if (templateData.length > 0 && templateData[0]?.social_history) {
        return templateData.flatMap(item =>
          Array.isArray(item.social_history) ? item.social_history : [item.social_history]
        );
      }
      return templateData;
    }
    if (templateData.social_history) {
      return Array.isArray(templateData.social_history)
        ? templateData.social_history
        : [templateData.social_history];
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
      const recDrafts = recId ? store[recId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // Mark the owning field's base name as edited (used to surface Approve buttons).
        const lastDot = fieldPart.lastIndexOf('.');
        const baseField = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1)))
          ? fieldPart.slice(0, lastDot) : fieldPart;
        nFields[`${baseField}-${idx}`] = true;
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
  const formatDate = useCallback((dateValue) => {
    if (!dateValue) return '';
    try {
      const date = new Date(dateValue.$date || dateValue);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return String(dateValue);
    }
  }, []);

  // Split by semicolon (for substanceUse)
  const splitBySemicolon = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/;\s*/).map(s => s.trim()).filter(s => s.length > 0);
  }, []);

  // Split by sentence
  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }, []);

  // Parse family support with labels (Mother:, Sister:, Children:, etc.)
  const parseFamilySupport = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];

    const labelPatterns = [
      'Mother', 'Father', 'Sister', 'Brother', 'Children',
      'Ex-wife', 'Ex-husband', 'Spouse', 'Partner', 'Wife', 'Husband',
      'Son', 'Daughter', 'Grandchildren', 'Grandparents'
    ];

    const labelPositions = [];
    labelPatterns.forEach((label) => {
      const regex = new RegExp(`${label}\\s*:`, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        labelPositions.push({
          label,
          startIndex: match.index,
          colonEndIndex: match.index + match[0].length,
        });
      }
    });

    labelPositions.sort((a, b) => a.startIndex - b.startIndex);
    const groups = [];

    labelPositions.forEach((pos, idx) => {
      const contentStart = pos.colonEndIndex;
      const contentEnd = idx + 1 < labelPositions.length
        ? labelPositions[idx + 1].startIndex
        : text.length;

      let content = text.substring(contentStart, contentEnd).trim();
      if (content.endsWith('.')) content = content.slice(0, -1).trim();

      if (content) {
        groups.push({ label: pos.label, content });
      }
    });

    // If no labels found, return as single item
    if (groups.length === 0 && text.trim()) {
      groups.push({ label: null, content: text.trim() });
    }

    return groups;
  }, []);

  // --- OBJECT (results) helpers ---
  const KEY_OVERRIDES = { id: 'ID', bmi: 'BMI', icd: 'ICD' };
  const humanizeKey = useCallback((key) => {
    if (key === null || key === undefined || key === '') return '';
    if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
    const s = String(key).replace(/_/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }, []);
  const isScalar = useCallback((v) => v === null || typeof v !== 'object', []);
  const isEmptyDeep = useCallback((v) => {
    if (v === null || v === undefined) return true;
    if (typeof v === 'boolean') return false;
    if (typeof v === 'number') return !Number.isFinite(v);
    if (typeof v === 'string') return v.trim() === '';
    if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
    if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
    return false;
  }, []);
  const fmtScalar = useCallback((v) => {
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'number') return String(v);
    return String(v ?? '');
  }, []);

  // Highlight text for search
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

  // shouldShowRow - Level 4 filtering
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

  // Copy to clipboard
  const copyToClipboard = useCallback(async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, []);

  // --- Editing handlers ---
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

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApprove commits).
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, arrayIndex, valueOverride, sentenceIdx) => {
    const recId = record._id ? (record._id.$oid || record._id) : null;
    if (!recId) return;
    const saveValue = (valueOverride !== undefined ? valueOverride : editValue.trim());
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
    const recId = record._id ? (record._id.$oid || record._id) : null;
    if (!recId) return;
    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements).
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        const isArrayElem = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        const payload = { field: isArrayElem ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArrayElem) payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        await secureApiClient.put(`/api/edit/social_history/${recId}/edit`, payload);
      }
      // Flag the record approved (audit trail).
      await secureApiClient.put(`/api/edit/social_history/${recId}/approve`);

      // Clear pending → committed edits now flow into pdfData/PDF.
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's drafts from localStorage (now committed).
      const store = readDrafts();
      if (store[recId]) { delete store[recId]; writeDrafts(store); }

      setStatusOverrides(prev => ({ ...prev, [idx]: 'approved' }));
      const keysToRemove = Object.keys(editedSentences).filter(k => k.includes(`-${idx}-s`));
      if (keysToRemove.length > 0) {
        setEditedSentences(prev => {
          const next = { ...prev };
          keysToRemove.forEach(k => delete next[k]);
          return next;
        });
      }
    } catch (err) {
      console.error('Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [editedSentences, localEdits, pendingEdits]);

  const getFieldValue = (record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    const val = record[fieldName];
    if (Array.isArray(val)) return val.join(', ');
    return val;
  };

  // Edit indicator SVG
  const editIndicator = (
    <span className="edit-indicator">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      <span className="edit-tag">edit</span>
    </span>
  );

  // Reusable editable field renderer for standard (non-sentence) fields
  const renderEditableField = (record, idx, fieldName, label, copiedKey, sectionId) => {
    const canEdit = !!record._id;
    const displayValue = getFieldValue(record, fieldName, idx) || record[fieldName];
    const editKey = `${fieldName}-${idx}-s0`;
    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {editingField === editKey ? (
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <textarea ref={textareaRef} value={editValue} onChange={(e) => setEditValue(e.target.value)} />
              <div className="edit-actions">
                <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                <button className="save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId || fieldName)} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="numbered-row">
              <div className={`row-content${canEdit ? ' editable' : ''}`}
                onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue)}>
                <span className="content-value">{highlightText(displayValue)}</span>
                {canEdit && editIndicator}
              </div>
              <button className={`copy-btn ${copiedId === copiedKey ? 'copied' : ''}`}
                onClick={() => copyToClipboard(displayValue, copiedKey)}>
                {copiedId === copiedKey ? 'Copied!' : 'Copy'}
              </button>
            </div>
            {editedSentences[editKey] && <div className="modified-badge">edited — click pending approve to save</div>}
          </>
        )}
      </div>
    );
  };

  // Render editable sentence rows for per-sentence editing
  const renderEditableSentenceRows = (record, idx, fieldName, label, sectionId, sectionMatches, recordWithFlag, splitter = splitBySentence) => {
    const canEdit = !!record._id;
    // Use full-field edit if available (reflects new sentence boundaries immediately)
    const fullEditKey = `${fieldName}-${idx}`;
    const hasFullEdit = localEdits[fullEditKey] !== undefined;
    const sourceText = hasFullEdit ? localEdits[fullEditKey] : (record[fieldName] || '');
    const currentSentences = splitter(sourceText);
    if (currentSentences.length === 0) return null;
    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {currentSentences
          .map((sentence, origIdx) => {
            // Only apply per-sentence overlays when splitting from original (no full edit)
            if (!hasFullEdit) {
              const perSentenceKey = `${fieldName}.s${origIdx}-${idx}`;
              const displaySentence = localEdits[perSentenceKey] !== undefined ? localEdits[perSentenceKey] : sentence;
              return { sentence: displaySentence, origIdx };
            }
            return { sentence, origIdx };
          })
          .filter(({ sentence }) => sectionMatches || shouldShowRow(recordWithFlag, sentence))
          .map(({ sentence, origIdx: sIdx }) => {
            const editKey = `${fieldName}-${idx}-s${sIdx}`;
            return editingField === editKey ? (
              <div key={sIdx} className="numbered-row edit-row">
                <div className="edit-field-container">
                  <textarea ref={textareaRef} value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                  <div className="edit-actions">
                    <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                    <button className="save-btn" disabled={saving} onClick={() => {
                      let editedSentence = editValue.trim();
                      if (editedSentence && !/[.!?]$/.test(editedSentence)) editedSentence += '.';
                      // Reconstruct from current source (full edit or original)
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
                      // Detect added sentences (new rows from period splits)
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
                    }}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <React.Fragment key={sIdx}>
                {(() => {
                  const sentenceState = editedSentences[editKey];
                  const isEdited = sentenceState === 'edited';
                  const isAdded = sentenceState === 'added';
                  return (
                    <>
                      <div className={`numbered-row${isEdited ? ' modified' : ''}${isAdded ? ' added' : ''}`}>
                        <div className={`row-content${canEdit ? ' editable' : ''}`}
                          onClick={() => {
                            const editText = sentence.replace(/[.!?]+$/, '').trim();
                            canEdit && handleStartEdit(fieldName, idx, editText, sIdx);
                          }}>
                          <span className="content-value">{highlightText(sentence)}</span>
                          {canEdit && editIndicator}
                        </div>
                        <button className={`copy-btn ${copiedId === `${sectionId}-${idx}-${sIdx}` ? 'copied' : ''}`}
                          onClick={() => copyToClipboard(sentence, `${sectionId}-${idx}-${sIdx}`)}>
                          {copiedId === `${sectionId}-${idx}-${sIdx}` ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      {isEdited && <div className="modified-badge">edited — click pending approve to save</div>}
                      {isAdded && <div className="added-badge">Added</div>}
                    </>
                  );
                })()}
              </React.Fragment>
            );
          })}
      </div>
    );
  };

  // Render editable array rows for array element editing
  const renderEditableArrayRows = (record, idx, fieldName, label, sectionId, sectionMatches, recordWithFlag) => {
    const canEdit = !!record._id;
    const items = record[fieldName];
    if (!Array.isArray(items) || items.length === 0) return null;
    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {items.map((item, aIdx) => {
          const editKey = `${fieldName}.${aIdx}-${idx}-s0`;
          const localKey = `${fieldName}.${aIdx}-${idx}`;
          const displayItem = localEdits[localKey] !== undefined ? localEdits[localKey] : item;
          if (!sectionMatches && !shouldShowRow(recordWithFlag, displayItem)) return null;
          return editingField === editKey ? (
            <div key={aIdx} className="numbered-row edit-row">
              <div className="edit-field-container">
                <textarea ref={textareaRef} value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                <div className="edit-actions">
                  <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                  <button className="save-btn" disabled={saving} onClick={() => handleSaveField(record, fieldName, idx, sectionId, aIdx)}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <React.Fragment key={aIdx}>
              <div className="numbered-row">
                <div className={`row-content${canEdit ? ' editable' : ''}`}
                  onClick={() => {
                    setEditingField(editKey);
                    setEditValue(displayItem || '');
                    setTimeout(() => textareaRef.current?.focus(), 50);
                  }}>
                  <span className="content-value">{highlightText(displayItem)}</span>
                  {canEdit && editIndicator}
                </div>
                <button className={`copy-btn ${copiedId === `${sectionId}-${idx}-${aIdx}` ? 'copied' : ''}`}
                  onClick={() => copyToClipboard(displayItem, `${sectionId}-${idx}-${aIdx}`)}>
                  {copiedId === `${sectionId}-${idx}-${aIdx}` ? 'Copied!' : 'Copy'}
                </button>
              </div>
              {editedSentences[`${fieldName}.${aIdx}-${idx}-s0`] && <div className="modified-badge">edited — click pending approve to save</div>}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // Render recommendations array (objects {recommendation, date} or plain strings), date-grouped
  const renderRecommendationsRows = (record, idx, fieldName, label, sectionId, sectionMatches, recordWithFlag) => {
    const canEdit = !!record._id;
    const items = record[fieldName];
    if (!Array.isArray(items) || items.length === 0) return null;
    // Normalize to {recommendation, date}
    const norm = items.map((it) => (typeof it === 'object' && it !== null)
      ? { recommendation: it.recommendation || '', date: it.date || '' }
      : { recommendation: String(it ?? ''), date: '' });
    const groups = [];
    norm.forEach((r) => {
      const d = (r.date || '').trim();
      const last = groups[groups.length - 1];
      if (last && last.date === d) last.items.push(r);
      else groups.push({ date: d, items: [r] });
    });
    const anyVisible = sectionMatches || norm.some(r =>
      shouldShowRow(recordWithFlag, r.recommendation, r.date));
    if (!anyVisible) return null;
    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {groups.map((group, gIdx) => (
          <div key={gIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
            {group.date && <div className="nested-subtitle">{highlightText(group.date)}</div>}
            {group.items.map((r, rIdx) => {
              const recText = (r.recommendation || '').trim();
              if (!sectionMatches && !shouldShowRow(recordWithFlag, recText, group.date)) return null;
              const copyKey = `${sectionId}-${idx}-${gIdx}-${rIdx}`;
              return (
                <div key={rIdx} className="numbered-row">
                  <div className="row-content">
                    <span className="content-value">{highlightText(recText)}</span>
                  </div>
                  <button className={`copy-btn ${copiedId === copyKey ? 'copied' : ''}`}
                    onClick={() => copyToClipboard(recText, copyKey)}>
                    {copiedId === copyKey ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // Recursive read-only renderer for OBJECT (results) — humanized key/value leaves
  const renderResultsLeaf = (label, value, keyPath, sectionId, idx) => {
    const leafValueString = fmtScalar(value);
    const copyKey = `${sectionId}-${idx}-${keyPath}`;
    return (
      <div key={keyPath} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(label)}</div>
        <div className="numbered-row">
          <div className="row-content">
            <span className="content-value">{highlightText(leafValueString)}</span>
          </div>
          <button className={`copy-btn ${copiedId === copyKey ? 'copied' : ''}`}
            onClick={() => copyToClipboard(`${label}\n${leafValueString}`, copyKey)}>
            {copiedId === copyKey ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    );
  };

  const renderResultsNode = (label, value, keyPath, sectionId, idx, depth) => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) return renderResultsLeaf(label, value, keyPath, sectionId, idx);
    const entries = Array.isArray(value)
      ? value.map((v, i) => [String(i + 1), v])
      : Object.entries(value);
    const filtered = entries.filter(([, v]) => !isEmptyDeep(v));
    if (filtered.length === 0) return null;
    return (
      <React.Fragment key={keyPath}>
        {label && <div className={depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle'}>{highlightText(label)}</div>}
        <div className="nested-group">
          {filtered.map(([k, v]) => (
            isScalar(v)
              ? renderResultsLeaf(humanizeKey(k), v, `${keyPath}-${k}`, sectionId, idx)
              : <div className="nested-mini-card" key={k}>{renderResultsNode(humanizeKey(k), v, `${keyPath}-${k}`, sectionId, idx, depth + 1)}</div>
          ))}
        </div>
      </React.Fragment>
    );
  };

  const renderResultsField = (record, idx, fieldName, label, sectionId, sectionMatches) => {
    const val = record[fieldName];
    if (!val || isScalar(val) || isEmptyDeep(val)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    if (!sectionMatches) return null;
    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {entries.map(([k, v]) => (
          isScalar(v)
            ? renderResultsLeaf(humanizeKey(k), v, `${k}`, sectionId, idx)
            : <div className="nested-mini-card" key={k}>{renderResultsNode(humanizeKey(k), v, `${k}`, sectionId, idx, 1)}</div>
        ))}
      </div>
    );
  };

  // pdfData memo — merges localEdits into records for Copy All + PDF
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return unwrappedData;
    return unwrappedData.map((rec, idx) => {
      const merged = { ...rec };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        if (editKey.includes('.s') && /\.s\d+-\d+$/.test(editKey)) continue;
        const dashIdx = editKey.lastIndexOf('-');
        const fieldName = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx === idx) {
          if (fieldName.includes('.')) {
            const [arrField, arrIdxStr] = fieldName.split('.');
            const arrIdx = parseInt(arrIdxStr, 10);
            if (Array.isArray(merged[arrField])) {
              merged[arrField] = [...merged[arrField]];
              merged[arrField][arrIdx] = editVal;
            }
          } else {
            merged[fieldName] = editVal;
          }
        }
      }
      // Pre-compute per-sentence fields (split from full edit if available)
      const computeSentences = (fieldName) => {
        const fullKey = `${fieldName}-${idx}`;
        const source = localEdits[fullKey] !== undefined ? localEdits[fullKey] : (rec[fieldName] || '');
        if (!source) return null;
        const sentences = splitBySentence(source);
        // If splitting from full edit, sentences already reflect all changes
        if (localEdits[fullKey] !== undefined) return sentences;
        // Otherwise apply per-sentence overlays
        return sentences.map((s, i) => {
          const pKey = `${fieldName}.s${i}-${idx}`;
          return localEdits[pKey] !== undefined ? localEdits[pKey] : s;
        });
      };
      if (rec.notes || localEdits[`notes-${idx}`]) merged._notesSentences = computeSentences('notes');
      if (rec.findings || localEdits[`findings-${idx}`]) merged._findingsSentences = computeSentences('findings');
      if (rec.assessment || localEdits[`assessment-${idx}`]) merged._assessmentSentences = computeSentences('assessment');
      if (rec.plan || localEdits[`plan-${idx}`]) merged._planSentences = computeSentences('plan');
      if (rec.livingSituation || localEdits[`livingSituation-${idx}`]) merged._livingSituationSentences = computeSentences('livingSituation');
      if (rec.occupation || localEdits[`occupation-${idx}`]) merged._occupationSentences = computeSentences('occupation');
      if (rec.supportSystem || localEdits[`supportSystem-${idx}`]) merged._supportSystemSentences = computeSentences('supportSystem');
      return merged;
    });
  }, [unwrappedData, localEdits, pendingEdits, splitBySentence]);

  // Get all text for a record (for Copy All)
  const getAllRecordText = useCallback((record, idx) => {
    const lines = [`SOCIAL HISTORY RECORD ${idx + 1}`, '═'.repeat(50)];

    if (record.date) lines.push(`Date: ${formatDate(record.date)}`);

    // Provider Information
    if (record.provider || record.facility) {
      lines.push('', 'PROVIDER INFORMATION', '───────────────────────────────────────');
      if (record.provider) lines.push(`Provider: ${record.provider}`);
      if (record.facility) lines.push(`Facility: ${record.facility}`);
    }

    // Tobacco
    if (record.smokingStatus || record.smokingHistory || record.packYearsHistory || record.tobaccoType || record.tobaccoQuitDate) {
      lines.push('', 'TOBACCO USE', '───────────────────────────────────────');
      if (record.smokingStatus) lines.push(`Smoking Status: ${record.smokingStatus}`);
      if (record.smokingHistory) lines.push(`Smoking History: ${record.smokingHistory}`);
      if (record.packYearsHistory) lines.push(`Pack Years: ${record.packYearsHistory}`);
      if (record.tobaccoType) lines.push(`Tobacco Type: ${record.tobaccoType}`);
      if (record.tobaccoQuitDate) lines.push(`Quit Date: ${formatDate(record.tobaccoQuitDate)}`);
    }

    // Alcohol
    if (record.alcoholUse || record.alcoholFrequency || record.alcoholQuantity) {
      lines.push('', 'ALCOHOL USE', '───────────────────────────────────────');
      if (record.alcoholUse) lines.push(`Alcohol Use: ${record.alcoholUse}`);
      if (record.alcoholFrequency) lines.push(`Frequency: ${record.alcoholFrequency}`);
      if (record.alcoholQuantity) lines.push(`Quantity: ${record.alcoholQuantity}`);
    }

    // Substance Use
    if (record.substanceUse || record.illicitDrugUse || (record.drugTypes && record.drugTypes.length > 0)) {
      lines.push('', 'SUBSTANCE USE', '───────────────────────────────────────');
      if (record.illicitDrugUse) lines.push(`Illicit Drug Use: ${record.illicitDrugUse}`);
      if (record.substanceUse) {
        const substances = splitBySemicolon(record.substanceUse);
        substances.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
      }
      if (record.drugTypes && record.drugTypes.length > 0) {
        lines.push('Drug Types:');
        record.drugTypes.forEach((d, i) => lines.push(`  ${i + 1}. ${d}`));
      }
    }

    // Living Situation
    if (record.livingSituation || record.livesAlone !== undefined || record.householdMembers || record.housingStability || record.homeEnvironment) {
      lines.push('', 'LIVING SITUATION', '───────────────────────────────────────');
      if (record.housingStability) lines.push(`Housing Stability: ${record.housingStability}`);
      if (record.livesAlone !== undefined) lines.push(`Lives Alone: ${record.livesAlone ? 'Yes' : 'No'}`);
      if (record.householdMembers) lines.push(`Household Members: ${record.householdMembers}`);
      if (record.homeEnvironment) lines.push(`Home Environment: ${record.homeEnvironment}`);
      if (record.livingSituation) {
        lines.push('Living Situation:');
        const livSentences = record._livingSituationSentences || splitBySentence(record.livingSituation);
        livSentences.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
      }
    }

    // Employment
    if (record.employmentStatus || record.occupation || (record.occupationalExposures && record.occupationalExposures.length > 0)) {
      lines.push('', 'EMPLOYMENT & OCCUPATION', '───────────────────────────────────────');
      if (record.employmentStatus) lines.push(`Employment Status: ${record.employmentStatus}`);
      if (record.occupation) {
        lines.push('Occupation:');
        const occSentences = record._occupationSentences || splitBySentence(record.occupation);
        occSentences.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
      }
      if (record.occupationalExposures && record.occupationalExposures.length > 0) {
        lines.push('Occupational Exposures:');
        record.occupationalExposures.forEach((e, i) => lines.push(`  ${i + 1}. ${e}`));
      }
    }

    // Education
    if (record.educationLevel || record.healthLiteracy) {
      lines.push('', 'EDUCATION', '───────────────────────────────────────');
      if (record.educationLevel) lines.push(`Education Level: ${record.educationLevel}`);
      if (record.healthLiteracy) lines.push(`Health Literacy: ${record.healthLiteracy}`);
    }

    // Family & Support
    if (record.maritalStatus || record.familySupport || record.supportSystem || record.caregiverStatus) {
      lines.push('', 'FAMILY & SUPPORT', '───────────────────────────────────────');
      if (record.maritalStatus) lines.push(`Marital Status: ${record.maritalStatus}`);
      if (record.caregiverStatus) lines.push(`Caregiver Status: ${record.caregiverStatus}`);
      if (record.familySupport) {
        lines.push('Family Support:');
        const parsed = parseFamilySupport(record.familySupport);
        parsed.forEach((p, i) => {
          if (p.label) {
            lines.push(`  ${p.label}: ${p.content}`);
          } else {
            lines.push(`  ${i + 1}. ${p.content}`);
          }
        });
      }
      if (record.supportSystem) {
        lines.push('Support System:');
        const supSentences = record._supportSystemSentences || splitBySentence(record.supportSystem);
        supSentences.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
      }
    }

    // Lifestyle
    if (record.exercise || record.diet || record.physicalActivityLevel || record.sleepPatterns || record.stressLevel) {
      lines.push('', 'LIFESTYLE', '───────────────────────────────────────');
      if (record.physicalActivityLevel) lines.push(`Physical Activity Level: ${record.physicalActivityLevel}`);
      if (record.exercise) lines.push(`Exercise: ${record.exercise}`);
      if (record.diet) lines.push(`Diet: ${record.diet}`);
      if (record.sleepPatterns) lines.push(`Sleep Patterns: ${record.sleepPatterns}`);
      if (record.stressLevel) lines.push(`Stress Level: ${record.stressLevel}`);
    }

    // Personal & Cultural
    if (record.religiousBeliefs || record.culturalFactors || record.sexualActivity || record.sexualOrientation || record.contraceptionMethod) {
      lines.push('', 'PERSONAL & CULTURAL', '───────────────────────────────────────');
      if (record.religiousBeliefs) lines.push(`Religious Beliefs: ${record.religiousBeliefs}`);
      if (record.culturalFactors) lines.push(`Cultural Factors: ${record.culturalFactors}`);
      if (record.sexualOrientation) lines.push(`Sexual Orientation: ${record.sexualOrientation}`);
      if (record.sexualActivity) lines.push(`Sexual Activity: ${record.sexualActivity}`);
      if (record.contraceptionMethod) lines.push(`Contraception Method: ${record.contraceptionMethod}`);
    }

    // Additional Information
    if (record.insurance || record.financialConcerns || record.transportation || record.foodSecurity || record.domesticViolence || record.recentTravel || record.militaryService || record.notes) {
      lines.push('', 'ADDITIONAL INFORMATION', '───────────────────────────────────────');
      if (record.insurance) lines.push(`Insurance: ${record.insurance}`);
      if (record.financialConcerns) lines.push(`Financial Concerns: ${record.financialConcerns}`);
      if (record.transportation) lines.push(`Transportation: ${record.transportation}`);
      if (record.foodSecurity) lines.push(`Food Security: ${record.foodSecurity}`);
      if (record.domesticViolence) lines.push(`Domestic Violence: ${record.domesticViolence}`);
      if (record.recentTravel) lines.push(`Recent Travel: ${record.recentTravel}`);
      if (record.militaryService) lines.push(`Military Service: ${record.militaryService}`);
      if (record.notes) {
        lines.push('Notes:');
        const notesSentences = record._notesSentences || splitBySentence(record.notes);
        notesSentences.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
      }
    }

    // Clinical Summary
    if (record.findings || record.assessment || record.plan || record.status) {
      lines.push('', 'CLINICAL SUMMARY', '───────────────────────────────────────');
      if (record.findings) {
        lines.push('Findings:');
        const fSentences = record._findingsSentences || splitBySentence(record.findings);
        fSentences.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
      }
      if (record.assessment) {
        lines.push('Assessment:');
        const aSentences = record._assessmentSentences || splitBySentence(record.assessment);
        aSentences.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
      }
      if (record.plan) {
        lines.push('Plan:');
        const pSentences = record._planSentences || splitBySentence(record.plan);
        pSentences.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
      }
      if (record.status) lines.push(`Status: ${record.status}`);
    }

    // Recommendations
    if (Array.isArray(record.recommendations) && record.recommendations.length > 0) {
      lines.push('', 'RECOMMENDATIONS', '───────────────────────────────────────');
      record.recommendations.forEach((r, i) => {
        const text = (typeof r === 'object' && r !== null ? r.recommendation : r) || '';
        const d = (typeof r === 'object' && r !== null ? r.date : '') || '';
        lines.push(`  ${i + 1}. ${text}${d ? ` (${d})` : ''}`);
      });
    }

    // Results (object)
    if (record.results && typeof record.results === 'object' && Object.keys(record.results).length > 0) {
      lines.push('', 'RESULTS', '───────────────────────────────────────');
      const walkResults = (obj, prefix) => {
        for (const [k, v] of Object.entries(obj)) {
          if (v === null || v === undefined || v === '') continue;
          if (typeof v === 'object' && !Array.isArray(v)) {
            lines.push(`${prefix}${k}:`);
            walkResults(v, `${prefix}  `);
          } else if (Array.isArray(v)) {
            lines.push(`${prefix}${k}: ${v.join(', ')}`);
          } else {
            const disp = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v;
            lines.push(`${prefix}${k}: ${disp}`);
          }
        }
      };
      walkResults(record.results, '  ');
    }

    return lines.join('\n');
  }, [formatDate, splitBySemicolon, splitBySentence, parseFamilySupport]);

  // Level 1: searchableText for document filtering
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return unwrappedData;

    const phrase = searchTerm.toLowerCase().trim();

    return unwrappedData.map((record, idx) => {
      // Build searchable text with all section titles and field labels
      const searchableText = [
        // Document title and record titles
        'social history', 'SOCIAL HISTORY', 'Social History',
        'Social History Record', 'social history record', 'SOCIAL HISTORY RECORD',
        'Record', 'record', 'RECORD',
        `Social History Record ${idx + 1}`,
        `social history record ${idx + 1}`,
        `Record ${idx + 1}`,

        // Section titles (all 3 case variations)
        'Provider Information', 'provider information', 'PROVIDER INFORMATION',
        'Tobacco Use', 'tobacco use', 'TOBACCO USE',
        'Alcohol Use', 'alcohol use', 'ALCOHOL USE',
        'Substance Use', 'substance use', 'SUBSTANCE USE',
        'Living Situation', 'living situation', 'LIVING SITUATION',
        'Employment & Occupation', 'employment & occupation', 'EMPLOYMENT & OCCUPATION',
        'Employment', 'employment', 'EMPLOYMENT',
        'Education', 'education', 'EDUCATION',
        'Family & Support', 'family & support', 'FAMILY & SUPPORT',
        'Lifestyle', 'lifestyle', 'LIFESTYLE',
        'Personal & Cultural', 'personal & cultural', 'PERSONAL & CULTURAL',
        'Additional Information', 'additional information', 'ADDITIONAL INFORMATION',

        // Field labels
        'provider', 'facility', 'date', 'doctor',
        'smoking status', 'smoking history', 'pack years', 'tobacco type', 'quit date',
        'alcohol frequency', 'alcohol quantity',
        'illicit drug use', 'drug types', 'substances',
        'housing stability', 'lives alone', 'household members', 'home environment',
        'employment status', 'occupation', 'occupational exposures',
        'education level', 'health literacy',
        'marital status', 'family support', 'support system', 'caregiver status',
        'physical activity', 'exercise', 'diet', 'sleep patterns', 'stress level',
        'religious beliefs', 'cultural factors', 'sexual orientation', 'sexual activity', 'contraception',
        'insurance', 'financial concerns',
        'transportation', 'food security', 'domestic violence', 'recent travel', 'military service',
        'Notes', 'notes', 'NOTES',
        'Clinical Summary', 'clinical summary', 'CLINICAL SUMMARY',
        'findings', 'assessment', 'plan', 'status',
        'Recommendations', 'recommendations', 'RECOMMENDATIONS',
        'Results', 'results', 'RESULTS',

        // Field values
        formatDate(record.date),
        record.provider,
        record.facility,
        record.smokingStatus,
        record.smokingHistory,
        record.packYearsHistory,
        record.tobaccoType,
        record.alcoholUse,
        record.alcoholFrequency,
        record.alcoholQuantity,
        record.substanceUse,
        record.illicitDrugUse,
        ...(record.drugTypes || []),
        record.livingSituation,
        record.housingStability,
        record.householdMembers,
        record.homeEnvironment,
        record.employmentStatus,
        record.occupation,
        ...(record.occupationalExposures || []),
        record.educationLevel,
        record.healthLiteracy,
        record.maritalStatus,
        record.familySupport,
        record.supportSystem,
        record.caregiverStatus,
        record.exercise,
        record.diet,
        record.physicalActivityLevel,
        record.sleepPatterns,
        record.stressLevel,
        record.religiousBeliefs,
        record.culturalFactors,
        record.sexualActivity,
        record.sexualOrientation,
        record.contraceptionMethod,
        record.insurance,
        record.financialConcerns,
        record.transportation,
        record.foodSecurity,
        record.domesticViolence,
        record.recentTravel,
        record.militaryService,
        record.notes,
        record.findings,
        record.assessment,
        record.plan,
        record.status,
        ...(Array.isArray(record.recommendations)
          ? record.recommendations.map(r => (typeof r === 'object' && r !== null ? `${r.recommendation || ''} ${r.date || ''}` : String(r ?? '')))
          : []),
        record.results ? JSON.stringify(record.results) : '',
      ].filter(Boolean).join(' ').toLowerCase();

      const matches = searchableText.includes(phrase);

      // Check if searching for document-level term (show all sections)
      // Matches: "social history", "social history 1", "social history record", "social history record 1", "record 1"
      const isDocumentSearch = /^(social\s*history(\s+record)?(\s+\d+)?|record(\s+\d+)?)$/i.test(searchTerm.trim());

      return matches ? { ...record, _showAllSections: isDocumentSearch } : null;
    }).filter(Boolean);
  }, [unwrappedData, searchTerm, formatDate]);

  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <div className="social-history-document">
        <div className="no-data">No social history records available</div>
      </div>
    );
  }

  return (
    <div className="social-history-document">
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">Social History</h1>

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
            document={<SocialHistoryDocumentPDFTemplate document={pdfData} />}
            fileName="Social_History.pdf"
            className="pdf-btn"
          >
            {({ loading }) => (loading ? 'Preparing...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>

        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search social history records..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>
          )}
        </div>
      </div>

      {/* Records */}
      <div className="records-container">
        {filteredRecords.length === 0 ? (
          <div className="no-results">No records match your search</div>
        ) : (
          filteredRecords.map((record, idx) => {
            // Create record with flag for section matching
            const recordWithFlag = { ...record };

            return (
              <div key={record._id?.$oid || idx} className="social-history-record">
                {/* Record Header */}
                <div className="record-header">
                  <div className="header-top-row">
                    {record.date && (
                      <span className="date-badge">{formatDate(record.date)}</span>
                    )}
                  </div>
                  <h2 className="record-title">
                    {highlightText(`Social History Record ${idx + 1}`)}
                  </h2>
                </div>

                {/* Provider Information Section */}
                {(() => {
                  const hasProviderData = record.provider || record.facility;
                  if (!hasProviderData) return null;

                  const sectionMatches = (() => {
                    if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
                    return shouldShowRow(recordWithFlag,
                      'Provider Information', 'provider information', 'PROVIDER INFORMATION',
                      'Provider', 'provider', 'PROVIDER',
                      'Doctor', 'doctor', 'DOCTOR', 'Facility', 'facility'
                    );
                  })();

                  const hasVisibleRows = sectionMatches ||
                    (record.provider && shouldShowRow(recordWithFlag, 'Provider', record.provider)) ||
                    (record.facility && shouldShowRow(recordWithFlag, 'Facility', record.facility));

                  if (!hasVisibleRows) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h3 className="section-title">{highlightText('Provider Information')}</h3>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedId === `provider-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const lines = ['PROVIDER INFORMATION', '═══════════════════════════════════════'];
                                if (record.provider) lines.push(`Provider: ${record.provider}`);
                                if (record.facility) lines.push(`Facility: ${record.facility}`);
                                copyToClipboard(lines.join('\n'), `provider-${idx}`);
                              }}
                            >
                              {copiedId === `provider-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {record._id && editedFields[`provider-${idx}`] && (
                              <button className={`approve-btn ${statusOverrides[idx] === 'approved' ? 'approved' : 'pending'}`} onClick={() => handleApprove(record, idx)} disabled={approving}>
                                {statusOverrides[idx] === 'approved' ? 'Approved' : approving ? 'Approving...' : 'Pending Approve'}
                              </button>
                            )}
                          </div>
                        </div>

                        {record.provider && (sectionMatches || shouldShowRow(recordWithFlag, 'Provider', record.provider)) &&
                          renderEditableField(record, idx, 'provider', 'Provider', `provider-name-${idx}`, 'provider')}

                        {record.facility && (sectionMatches || shouldShowRow(recordWithFlag, 'Facility', record.facility)) &&
                          renderEditableField(record, idx, 'facility', 'Facility', `facility-${idx}`, 'provider')}
                      </div>
                    </div>
                  );
                })()}

                {/* Tobacco Use Section */}
                {(() => {
                  const hasTobaccoData = record.smokingStatus || record.smokingHistory ||
                    record.packYearsHistory || record.tobaccoType || record.tobaccoQuitDate;
                  if (!hasTobaccoData) return null;

                  const sectionMatches = (() => {
                    if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
                    return shouldShowRow(recordWithFlag,
                      'Tobacco Use', 'tobacco use', 'TOBACCO USE',
                      'Smoking', 'smoking', 'SMOKING'
                    );
                  })();

                  const hasVisibleRows = sectionMatches ||
                    (record.smokingStatus && shouldShowRow(recordWithFlag, 'Smoking Status', record.smokingStatus)) ||
                    (record.smokingHistory && shouldShowRow(recordWithFlag, 'Smoking History', record.smokingHistory)) ||
                    (record.packYearsHistory && shouldShowRow(recordWithFlag, 'Pack Years', record.packYearsHistory)) ||
                    (record.tobaccoType && shouldShowRow(recordWithFlag, 'Tobacco Type', record.tobaccoType)) ||
                    (record.tobaccoQuitDate && shouldShowRow(recordWithFlag, 'Quit Date', formatDate(record.tobaccoQuitDate)));

                  if (!hasVisibleRows) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h3 className="section-title">{highlightText('Tobacco Use')}</h3>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedId === `tobacco-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const lines = ['TOBACCO USE', '═══════════════════════════════════════'];
                                if (record.smokingStatus) lines.push(`Smoking Status: ${record.smokingStatus}`);
                                if (record.smokingHistory) lines.push(`Smoking History: ${record.smokingHistory}`);
                                if (record.packYearsHistory) lines.push(`Pack Years: ${record.packYearsHistory}`);
                                if (record.tobaccoType) lines.push(`Tobacco Type: ${record.tobaccoType}`);
                                if (record.tobaccoQuitDate) lines.push(`Quit Date: ${formatDate(record.tobaccoQuitDate)}`);
                                copyToClipboard(lines.join('\n'), `tobacco-${idx}`);
                              }}
                            >
                              {copiedId === `tobacco-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {record._id && editedFields[`tobacco-${idx}`] && (
                              <button className={`approve-btn ${statusOverrides[idx] === 'approved' ? 'approved' : 'pending'}`} onClick={() => handleApprove(record, idx)} disabled={approving}>
                                {statusOverrides[idx] === 'approved' ? 'Approved' : approving ? 'Approving...' : 'Pending Approve'}
                              </button>
                            )}
                          </div>
                        </div>

                        {record.smokingStatus && (sectionMatches || shouldShowRow(recordWithFlag, 'Smoking Status', record.smokingStatus)) &&
                          renderEditableField(record, idx, 'smokingStatus', 'Smoking Status', `smoking-status-${idx}`, 'tobacco')}

                        {record.smokingHistory && (sectionMatches || shouldShowRow(recordWithFlag, 'Smoking History', record.smokingHistory)) &&
                          renderEditableField(record, idx, 'smokingHistory', 'Smoking History', `smoking-history-${idx}`, 'tobacco')}

                        {record.packYearsHistory && (sectionMatches || shouldShowRow(recordWithFlag, 'Pack Years', record.packYearsHistory)) &&
                          renderEditableField(record, idx, 'packYearsHistory', 'Pack Years', `pack-years-${idx}`, 'tobacco')}

                        {record.tobaccoType && (sectionMatches || shouldShowRow(recordWithFlag, 'Tobacco Type', record.tobaccoType)) &&
                          renderEditableField(record, idx, 'tobaccoType', 'Tobacco Type', `tobacco-type-${idx}`, 'tobacco')}

                        {record.tobaccoQuitDate && (sectionMatches || shouldShowRow(recordWithFlag, 'Quit Date', formatDate(record.tobaccoQuitDate))) && (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText('Quit Date')}</div>
                            <div className="numbered-row">
                              <div className="row-content">
                                <span className="content-value">{highlightText(formatDate(record.tobaccoQuitDate))}</span>
                              </div>
                              <button
                                className={`copy-btn ${copiedId === `quit-date-${idx}` ? 'copied' : ''}`}
                                onClick={() => copyToClipboard(formatDate(record.tobaccoQuitDate), `quit-date-${idx}`)}
                              >
                                {copiedId === `quit-date-${idx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Alcohol Use Section */}
                {(() => {
                  const hasAlcoholData = record.alcoholUse || record.alcoholFrequency || record.alcoholQuantity;
                  if (!hasAlcoholData) return null;

                  const sectionMatches = (() => {
                    if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
                    return shouldShowRow(recordWithFlag, 'Alcohol Use', 'alcohol use', 'ALCOHOL USE', 'Alcohol', 'alcohol');
                  })();

                  const hasVisibleRows = sectionMatches ||
                    (record.alcoholUse && shouldShowRow(recordWithFlag, 'Alcohol Use', record.alcoholUse)) ||
                    (record.alcoholFrequency && shouldShowRow(recordWithFlag, 'Frequency', record.alcoholFrequency)) ||
                    (record.alcoholQuantity && shouldShowRow(recordWithFlag, 'Quantity', record.alcoholQuantity));

                  if (!hasVisibleRows) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h3 className="section-title">{highlightText('Alcohol Use')}</h3>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedId === `alcohol-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const lines = ['ALCOHOL USE', '═══════════════════════════════════════'];
                                if (record.alcoholUse) lines.push(`Alcohol Use: ${record.alcoholUse}`);
                                if (record.alcoholFrequency) lines.push(`Frequency: ${record.alcoholFrequency}`);
                                if (record.alcoholQuantity) lines.push(`Quantity: ${record.alcoholQuantity}`);
                                copyToClipboard(lines.join('\n'), `alcohol-${idx}`);
                              }}
                            >
                              {copiedId === `alcohol-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {record._id && editedFields[`alcohol-${idx}`] && (
                              <button className={`approve-btn ${statusOverrides[idx] === 'approved' ? 'approved' : 'pending'}`} onClick={() => handleApprove(record, idx)} disabled={approving}>
                                {statusOverrides[idx] === 'approved' ? 'Approved' : approving ? 'Approving...' : 'Pending Approve'}
                              </button>
                            )}
                          </div>
                        </div>

                        {record.alcoholUse && (sectionMatches || shouldShowRow(recordWithFlag, 'Alcohol Use', record.alcoholUse)) &&
                          renderEditableField(record, idx, 'alcoholUse', 'Alcohol Use', `alcohol-use-${idx}`, 'alcohol')}

                        {record.alcoholFrequency && (sectionMatches || shouldShowRow(recordWithFlag, 'Frequency', record.alcoholFrequency)) &&
                          renderEditableField(record, idx, 'alcoholFrequency', 'Frequency', `alcohol-freq-${idx}`, 'alcohol')}

                        {record.alcoholQuantity && (sectionMatches || shouldShowRow(recordWithFlag, 'Quantity', record.alcoholQuantity)) &&
                          renderEditableField(record, idx, 'alcoholQuantity', 'Quantity', `alcohol-qty-${idx}`, 'alcohol')}
                      </div>
                    </div>
                  );
                })()}

                {/* Substance Use Section */}
                {(() => {
                  const hasSubstanceData = record.substanceUse || record.illicitDrugUse ||
                    (record.drugTypes && record.drugTypes.length > 0);
                  if (!hasSubstanceData) return null;

                  const sectionMatches = (() => {
                    if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
                    return shouldShowRow(recordWithFlag,
                      'Substance Use', 'substance use', 'SUBSTANCE USE',
                      'Drug', 'drug', 'DRUG', 'Illicit', 'illicit'
                    );
                  })();

                  const substances = splitBySemicolon(record.substanceUse);

                  const hasVisibleRows = sectionMatches ||
                    (record.illicitDrugUse && shouldShowRow(recordWithFlag, 'Illicit Drug Use', record.illicitDrugUse)) ||
                    substances.some(s => shouldShowRow(recordWithFlag, s)) ||
                    (record.drugTypes && record.drugTypes.some(d => shouldShowRow(recordWithFlag, d)));

                  if (!hasVisibleRows) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h3 className="section-title">{highlightText('Substance Use')}</h3>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedId === `substance-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const lines = ['SUBSTANCE USE', '═══════════════════════════════════════'];
                                if (record.illicitDrugUse) lines.push(`Illicit Drug Use: ${record.illicitDrugUse}`);
                                if (substances.length > 0) {
                                  lines.push('Substances:');
                                  substances.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
                                }
                                if (record.drugTypes && record.drugTypes.length > 0) {
                                  lines.push('Drug Types:');
                                  record.drugTypes.forEach((d, i) => lines.push(`  ${i + 1}. ${d}`));
                                }
                                copyToClipboard(lines.join('\n'), `substance-${idx}`);
                              }}
                            >
                              {copiedId === `substance-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {record._id && editedFields[`substance-${idx}`] && (
                              <button className={`approve-btn ${statusOverrides[idx] === 'approved' ? 'approved' : 'pending'}`} onClick={() => handleApprove(record, idx)} disabled={approving}>
                                {statusOverrides[idx] === 'approved' ? 'Approved' : approving ? 'Approving...' : 'Pending Approve'}
                              </button>
                            )}
                          </div>
                        </div>

                        {record.illicitDrugUse && (sectionMatches || shouldShowRow(recordWithFlag, 'Illicit Drug Use', record.illicitDrugUse)) &&
                          renderEditableField(record, idx, 'illicitDrugUse', 'Illicit Drug Use', `illicit-${idx}`, 'substance')}

                        {record.substanceUse && (sectionMatches || substances.some(s => shouldShowRow(recordWithFlag, s))) &&
                          renderEditableField(record, idx, 'substanceUse', 'Substances', `substance-text-${idx}`, 'substance')}

                        {record.drugTypes && record.drugTypes.length > 0 &&
                          renderEditableArrayRows(record, idx, 'drugTypes', 'Drug Types', 'substance', sectionMatches, recordWithFlag)}
                      </div>
                    </div>
                  );
                })()}

                {/* Living Situation Section */}
                {(() => {
                  const hasLivingData = record.livingSituation || record.livesAlone !== undefined ||
                    record.householdMembers || record.housingStability || record.homeEnvironment;
                  if (!hasLivingData) return null;

                  const livingSentences = splitBySentence(record.livingSituation);

                  const sectionMatches = (() => {
                    if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
                    return shouldShowRow(recordWithFlag,
                      'Living Situation', 'living situation', 'LIVING SITUATION',
                      'Housing', 'housing', 'HOUSING', 'Home', 'home'
                    );
                  })();

                  const hasVisibleRows = sectionMatches ||
                    (record.housingStability && shouldShowRow(recordWithFlag, 'Housing Stability', record.housingStability)) ||
                    (record.livesAlone !== undefined && shouldShowRow(recordWithFlag, 'Lives Alone', record.livesAlone ? 'Yes' : 'No')) ||
                    (record.householdMembers && shouldShowRow(recordWithFlag, 'Household Members', record.householdMembers)) ||
                    (record.homeEnvironment && shouldShowRow(recordWithFlag, 'Home Environment', record.homeEnvironment)) ||
                    livingSentences.some(s => shouldShowRow(recordWithFlag, s));

                  if (!hasVisibleRows) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h3 className="section-title">{highlightText('Living Situation')}</h3>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedId === `living-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const lines = ['LIVING SITUATION', '═══════════════════════════════════════'];
                                if (record.housingStability) lines.push(`Housing Stability: ${record.housingStability}`);
                                if (record.livesAlone !== undefined) lines.push(`Lives Alone: ${record.livesAlone ? 'Yes' : 'No'}`);
                                if (record.householdMembers) lines.push(`Household Members: ${record.householdMembers}`);
                                if (record.homeEnvironment) lines.push(`Home Environment: ${record.homeEnvironment}`);
                                if (livingSentences.length > 0) {
                                  lines.push('Details:');
                                  livingSentences.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
                                }
                                copyToClipboard(lines.join('\n'), `living-${idx}`);
                              }}
                            >
                              {copiedId === `living-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {record._id && editedFields[`living-${idx}`] && (
                              <button className={`approve-btn ${statusOverrides[idx] === 'approved' ? 'approved' : 'pending'}`} onClick={() => handleApprove(record, idx)} disabled={approving}>
                                {statusOverrides[idx] === 'approved' ? 'Approved' : approving ? 'Approving...' : 'Pending Approve'}
                              </button>
                            )}
                          </div>
                        </div>

                        {record.housingStability && (sectionMatches || shouldShowRow(recordWithFlag, 'Housing Stability', record.housingStability)) &&
                          renderEditableField(record, idx, 'housingStability', 'Housing Stability', `housing-stability-${idx}`, 'living')}

                        {record.livesAlone !== undefined && (sectionMatches || shouldShowRow(recordWithFlag, 'Lives Alone', record.livesAlone ? 'Yes' : 'No')) && (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText('Lives Alone')}</div>
                            <div className="numbered-row">
                              <div className="row-content">
                                <span className="content-value">{highlightText(record.livesAlone ? 'Yes' : 'No')}</span>
                              </div>
                              <button
                                className={`copy-btn ${copiedId === `lives-alone-${idx}` ? 'copied' : ''}`}
                                onClick={() => copyToClipboard(record.livesAlone ? 'Yes' : 'No', `lives-alone-${idx}`)}
                              >
                                {copiedId === `lives-alone-${idx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}

                        {record.householdMembers && (sectionMatches || shouldShowRow(recordWithFlag, 'Household Members', record.householdMembers)) &&
                          renderEditableField(record, idx, 'householdMembers', 'Household Members', `household-${idx}`, 'living')}

                        {record.homeEnvironment && (sectionMatches || shouldShowRow(recordWithFlag, 'Home Environment', record.homeEnvironment)) &&
                          renderEditableField(record, idx, 'homeEnvironment', 'Home Environment', `home-env-${idx}`, 'living')}

                        {record.livingSituation &&
                          renderEditableSentenceRows(record, idx, 'livingSituation', 'Details', 'living', sectionMatches, recordWithFlag)}
                      </div>
                    </div>
                  );
                })()}

                {/* Employment & Occupation Section */}
                {(() => {
                  const hasEmploymentData = record.employmentStatus || record.occupation ||
                    (record.occupationalExposures && record.occupationalExposures.length > 0);
                  if (!hasEmploymentData) return null;

                  const occupationSentences = splitBySentence(record.occupation);

                  const sectionMatches = (() => {
                    if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
                    return shouldShowRow(recordWithFlag,
                      'Employment & Occupation', 'employment & occupation', 'EMPLOYMENT & OCCUPATION',
                      'Employment', 'employment', 'EMPLOYMENT',
                      'Occupation', 'occupation', 'OCCUPATION', 'Job', 'job', 'Work', 'work'
                    );
                  })();

                  const hasVisibleRows = sectionMatches ||
                    (record.employmentStatus && shouldShowRow(recordWithFlag, 'Employment Status', record.employmentStatus)) ||
                    occupationSentences.some(s => shouldShowRow(recordWithFlag, s)) ||
                    (record.occupationalExposures && record.occupationalExposures.some(e => shouldShowRow(recordWithFlag, e)));

                  if (!hasVisibleRows) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h3 className="section-title">{highlightText('Employment & Occupation')}</h3>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedId === `employment-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const lines = ['EMPLOYMENT & OCCUPATION', '═══════════════════════════════════════'];
                                if (record.employmentStatus) lines.push(`Employment Status: ${record.employmentStatus}`);
                                if (occupationSentences.length > 0) {
                                  lines.push('Occupation:');
                                  occupationSentences.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
                                }
                                if (record.occupationalExposures && record.occupationalExposures.length > 0) {
                                  lines.push('Occupational Exposures:');
                                  record.occupationalExposures.forEach((e, i) => lines.push(`  ${i + 1}. ${e}`));
                                }
                                copyToClipboard(lines.join('\n'), `employment-${idx}`);
                              }}
                            >
                              {copiedId === `employment-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {record._id && editedFields[`employment-${idx}`] && (
                              <button className={`approve-btn ${statusOverrides[idx] === 'approved' ? 'approved' : 'pending'}`} onClick={() => handleApprove(record, idx)} disabled={approving}>
                                {statusOverrides[idx] === 'approved' ? 'Approved' : approving ? 'Approving...' : 'Pending Approve'}
                              </button>
                            )}
                          </div>
                        </div>

                        {record.employmentStatus && (sectionMatches || shouldShowRow(recordWithFlag, 'Employment Status', record.employmentStatus)) &&
                          renderEditableField(record, idx, 'employmentStatus', 'Employment Status', `emp-status-${idx}`, 'employment')}

                        {record.occupation &&
                          renderEditableSentenceRows(record, idx, 'occupation', 'Occupation', 'employment', sectionMatches, recordWithFlag)}

                        {record.occupationalExposures && record.occupationalExposures.length > 0 &&
                          renderEditableArrayRows(record, idx, 'occupationalExposures', 'Occupational Exposures', 'employment', sectionMatches, recordWithFlag)}
                      </div>
                    </div>
                  );
                })()}

                {/* Education Section */}
                {(() => {
                  const hasEducationData = record.educationLevel || record.healthLiteracy;
                  if (!hasEducationData) return null;

                  const sectionMatches = (() => {
                    if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
                    return shouldShowRow(recordWithFlag, 'Education', 'education', 'EDUCATION');
                  })();

                  const hasVisibleRows = sectionMatches ||
                    (record.educationLevel && shouldShowRow(recordWithFlag, 'Education Level', record.educationLevel)) ||
                    (record.healthLiteracy && shouldShowRow(recordWithFlag, 'Health Literacy', record.healthLiteracy));

                  if (!hasVisibleRows) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h3 className="section-title">{highlightText('Education')}</h3>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedId === `education-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const lines = ['EDUCATION', '═══════════════════════════════════════'];
                                if (record.educationLevel) lines.push(`Education Level: ${record.educationLevel}`);
                                if (record.healthLiteracy) lines.push(`Health Literacy: ${record.healthLiteracy}`);
                                copyToClipboard(lines.join('\n'), `education-${idx}`);
                              }}
                            >
                              {copiedId === `education-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {record._id && editedFields[`education-${idx}`] && (
                              <button className={`approve-btn ${statusOverrides[idx] === 'approved' ? 'approved' : 'pending'}`} onClick={() => handleApprove(record, idx)} disabled={approving}>
                                {statusOverrides[idx] === 'approved' ? 'Approved' : approving ? 'Approving...' : 'Pending Approve'}
                              </button>
                            )}
                          </div>
                        </div>

                        {record.educationLevel && (sectionMatches || shouldShowRow(recordWithFlag, 'Education Level', record.educationLevel)) &&
                          renderEditableField(record, idx, 'educationLevel', 'Education Level', `edu-level-${idx}`, 'education')}

                        {record.healthLiteracy && (sectionMatches || shouldShowRow(recordWithFlag, 'Health Literacy', record.healthLiteracy)) &&
                          renderEditableField(record, idx, 'healthLiteracy', 'Health Literacy', `health-lit-${idx}`, 'education')}
                      </div>
                    </div>
                  );
                })()}

                {/* Family & Support Section */}
                {(() => {
                  const hasFamilyData = record.maritalStatus || record.familySupport ||
                    record.supportSystem || record.caregiverStatus;
                  if (!hasFamilyData) return null;

                  const familySupportParsed = parseFamilySupport(record.familySupport);
                  const supportSentences = splitBySentence(record.supportSystem);

                  const sectionMatches = (() => {
                    if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
                    return shouldShowRow(recordWithFlag,
                      'Family & Support', 'family & support', 'FAMILY & SUPPORT',
                      'Family', 'family', 'FAMILY', 'Support', 'support', 'SUPPORT'
                    );
                  })();

                  const hasVisibleRows = sectionMatches ||
                    (record.maritalStatus && shouldShowRow(recordWithFlag, 'Marital Status', record.maritalStatus)) ||
                    (record.caregiverStatus && shouldShowRow(recordWithFlag, 'Caregiver Status', record.caregiverStatus)) ||
                    familySupportParsed.some(p => shouldShowRow(recordWithFlag, p.label, p.content)) ||
                    supportSentences.some(s => shouldShowRow(recordWithFlag, s));

                  if (!hasVisibleRows) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h3 className="section-title">{highlightText('Family & Support')}</h3>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedId === `family-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const lines = ['FAMILY & SUPPORT', '═══════════════════════════════════════'];
                                if (record.maritalStatus) lines.push(`Marital Status: ${record.maritalStatus}`);
                                if (record.caregiverStatus) lines.push(`Caregiver Status: ${record.caregiverStatus}`);
                                if (familySupportParsed.length > 0) {
                                  lines.push('Family Support:');
                                  familySupportParsed.forEach((p, i) => {
                                    if (p.label) {
                                      lines.push(`  ${p.label}: ${p.content}`);
                                    } else {
                                      lines.push(`  ${i + 1}. ${p.content}`);
                                    }
                                  });
                                }
                                if (supportSentences.length > 0) {
                                  lines.push('Support System:');
                                  supportSentences.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
                                }
                                copyToClipboard(lines.join('\n'), `family-${idx}`);
                              }}
                            >
                              {copiedId === `family-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {record._id && editedFields[`family-${idx}`] && (
                              <button className={`approve-btn ${statusOverrides[idx] === 'approved' ? 'approved' : 'pending'}`} onClick={() => handleApprove(record, idx)} disabled={approving}>
                                {statusOverrides[idx] === 'approved' ? 'Approved' : approving ? 'Approving...' : 'Pending Approve'}
                              </button>
                            )}
                          </div>
                        </div>

                        {record.maritalStatus && (sectionMatches || shouldShowRow(recordWithFlag, 'Marital Status', record.maritalStatus)) &&
                          renderEditableField(record, idx, 'maritalStatus', 'Marital Status', `marital-${idx}`, 'family')}

                        {record.caregiverStatus && (sectionMatches || shouldShowRow(recordWithFlag, 'Caregiver Status', record.caregiverStatus)) &&
                          renderEditableField(record, idx, 'caregiverStatus', 'Caregiver Status', `caregiver-${idx}`, 'family')}

                        {record.familySupport && (sectionMatches || familySupportParsed.some(p => shouldShowRow(recordWithFlag, p.label, p.content))) &&
                          renderEditableField(record, idx, 'familySupport', 'Family Support', `family-support-${idx}`, 'family')}

                        {record.supportSystem &&
                          renderEditableSentenceRows(record, idx, 'supportSystem', 'Support System', 'family', sectionMatches, recordWithFlag)}
                      </div>
                    </div>
                  );
                })()}

                {/* Lifestyle Section */}
                {(() => {
                  const hasLifestyleData = record.exercise || record.diet || record.physicalActivityLevel ||
                    record.sleepPatterns || record.stressLevel;
                  if (!hasLifestyleData) return null;

                  const sectionMatches = (() => {
                    if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
                    return shouldShowRow(recordWithFlag, 'Lifestyle', 'lifestyle', 'LIFESTYLE');
                  })();

                  const hasVisibleRows = sectionMatches ||
                    (record.physicalActivityLevel && shouldShowRow(recordWithFlag, 'Physical Activity', record.physicalActivityLevel)) ||
                    (record.exercise && shouldShowRow(recordWithFlag, 'Exercise', record.exercise)) ||
                    (record.diet && shouldShowRow(recordWithFlag, 'Diet', record.diet)) ||
                    (record.sleepPatterns && shouldShowRow(recordWithFlag, 'Sleep Patterns', record.sleepPatterns)) ||
                    (record.stressLevel && shouldShowRow(recordWithFlag, 'Stress Level', record.stressLevel));

                  if (!hasVisibleRows) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h3 className="section-title">{highlightText('Lifestyle')}</h3>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedId === `lifestyle-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const lines = ['LIFESTYLE', '═══════════════════════════════════════'];
                                if (record.physicalActivityLevel) lines.push(`Physical Activity Level: ${record.physicalActivityLevel}`);
                                if (record.exercise) lines.push(`Exercise: ${record.exercise}`);
                                if (record.diet) lines.push(`Diet: ${record.diet}`);
                                if (record.sleepPatterns) lines.push(`Sleep Patterns: ${record.sleepPatterns}`);
                                if (record.stressLevel) lines.push(`Stress Level: ${record.stressLevel}`);
                                copyToClipboard(lines.join('\n'), `lifestyle-${idx}`);
                              }}
                            >
                              {copiedId === `lifestyle-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {record._id && editedFields[`lifestyle-${idx}`] && (
                              <button className={`approve-btn ${statusOverrides[idx] === 'approved' ? 'approved' : 'pending'}`} onClick={() => handleApprove(record, idx)} disabled={approving}>
                                {statusOverrides[idx] === 'approved' ? 'Approved' : approving ? 'Approving...' : 'Pending Approve'}
                              </button>
                            )}
                          </div>
                        </div>

                        {record.physicalActivityLevel && (sectionMatches || shouldShowRow(recordWithFlag, 'Physical Activity', record.physicalActivityLevel)) &&
                          renderEditableField(record, idx, 'physicalActivityLevel', 'Physical Activity Level', `physical-${idx}`, 'lifestyle')}

                        {record.exercise && (sectionMatches || shouldShowRow(recordWithFlag, 'Exercise', record.exercise)) &&
                          renderEditableField(record, idx, 'exercise', 'Exercise', `exercise-${idx}`, 'lifestyle')}

                        {record.diet && (sectionMatches || shouldShowRow(recordWithFlag, 'Diet', record.diet)) &&
                          renderEditableField(record, idx, 'diet', 'Diet', `diet-${idx}`, 'lifestyle')}

                        {record.sleepPatterns && (sectionMatches || shouldShowRow(recordWithFlag, 'Sleep Patterns', record.sleepPatterns)) &&
                          renderEditableField(record, idx, 'sleepPatterns', 'Sleep Patterns', `sleep-${idx}`, 'lifestyle')}

                        {record.stressLevel && (sectionMatches || shouldShowRow(recordWithFlag, 'Stress Level', record.stressLevel)) &&
                          renderEditableField(record, idx, 'stressLevel', 'Stress Level', `stress-${idx}`, 'lifestyle')}
                      </div>
                    </div>
                  );
                })()}

                {/* Personal & Cultural Section */}
                {(() => {
                  const hasPersonalData = record.religiousBeliefs || record.culturalFactors ||
                    record.sexualActivity || record.sexualOrientation || record.contraceptionMethod;
                  if (!hasPersonalData) return null;

                  const sectionMatches = (() => {
                    if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
                    return shouldShowRow(recordWithFlag,
                      'Personal & Cultural', 'personal & cultural', 'PERSONAL & CULTURAL',
                      'Personal', 'personal', 'PERSONAL', 'Cultural', 'cultural', 'CULTURAL'
                    );
                  })();

                  const hasVisibleRows = sectionMatches ||
                    (record.religiousBeliefs && shouldShowRow(recordWithFlag, 'Religious Beliefs', record.religiousBeliefs)) ||
                    (record.culturalFactors && shouldShowRow(recordWithFlag, 'Cultural Factors', record.culturalFactors)) ||
                    (record.sexualOrientation && shouldShowRow(recordWithFlag, 'Sexual Orientation', record.sexualOrientation)) ||
                    (record.sexualActivity && shouldShowRow(recordWithFlag, 'Sexual Activity', record.sexualActivity)) ||
                    (record.contraceptionMethod && shouldShowRow(recordWithFlag, 'Contraception Method', record.contraceptionMethod));

                  if (!hasVisibleRows) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h3 className="section-title">{highlightText('Personal & Cultural')}</h3>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedId === `personal-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const lines = ['PERSONAL & CULTURAL', '═══════════════════════════════════════'];
                                if (record.religiousBeliefs) lines.push(`Religious Beliefs: ${record.religiousBeliefs}`);
                                if (record.culturalFactors) lines.push(`Cultural Factors: ${record.culturalFactors}`);
                                if (record.sexualOrientation) lines.push(`Sexual Orientation: ${record.sexualOrientation}`);
                                if (record.sexualActivity) lines.push(`Sexual Activity: ${record.sexualActivity}`);
                                if (record.contraceptionMethod) lines.push(`Contraception Method: ${record.contraceptionMethod}`);
                                copyToClipboard(lines.join('\n'), `personal-${idx}`);
                              }}
                            >
                              {copiedId === `personal-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {record._id && editedFields[`personal-${idx}`] && (
                              <button className={`approve-btn ${statusOverrides[idx] === 'approved' ? 'approved' : 'pending'}`} onClick={() => handleApprove(record, idx)} disabled={approving}>
                                {statusOverrides[idx] === 'approved' ? 'Approved' : approving ? 'Approving...' : 'Pending Approve'}
                              </button>
                            )}
                          </div>
                        </div>

                        {record.religiousBeliefs && (sectionMatches || shouldShowRow(recordWithFlag, 'Religious Beliefs', record.religiousBeliefs)) &&
                          renderEditableField(record, idx, 'religiousBeliefs', 'Religious Beliefs', `religious-${idx}`, 'personal')}

                        {record.culturalFactors && (sectionMatches || shouldShowRow(recordWithFlag, 'Cultural Factors', record.culturalFactors)) &&
                          renderEditableField(record, idx, 'culturalFactors', 'Cultural Factors', `cultural-${idx}`, 'personal')}

                        {record.sexualOrientation && (sectionMatches || shouldShowRow(recordWithFlag, 'Sexual Orientation', record.sexualOrientation)) &&
                          renderEditableField(record, idx, 'sexualOrientation', 'Sexual Orientation', `orientation-${idx}`, 'personal')}

                        {record.sexualActivity && (sectionMatches || shouldShowRow(recordWithFlag, 'Sexual Activity', record.sexualActivity)) &&
                          renderEditableField(record, idx, 'sexualActivity', 'Sexual Activity', `sexual-${idx}`, 'personal')}

                        {record.contraceptionMethod && (sectionMatches || shouldShowRow(recordWithFlag, 'Contraception Method', record.contraceptionMethod)) &&
                          renderEditableField(record, idx, 'contraceptionMethod', 'Contraception Method', `contraception-${idx}`, 'personal')}
                      </div>
                    </div>
                  );
                })()}

                {/* Additional Information Section */}
                {(() => {
                  const hasAdditionalData = record.insurance || record.financialConcerns ||
                    record.transportation || record.foodSecurity ||
                    record.domesticViolence || record.recentTravel || record.militaryService || record.notes;
                  if (!hasAdditionalData) return null;

                  const notesSentences = splitBySentence(record.notes);

                  const sectionMatches = (() => {
                    if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
                    return shouldShowRow(recordWithFlag,
                      'Additional Information', 'additional information', 'ADDITIONAL INFORMATION',
                      'Additional', 'additional', 'ADDITIONAL',
                      'Notes', 'notes', 'NOTES'
                    );
                  })();

                  const hasVisibleRows = sectionMatches ||
                    (record.insurance && shouldShowRow(recordWithFlag, 'Insurance', record.insurance)) ||
                    (record.financialConcerns && shouldShowRow(recordWithFlag, 'Financial Concerns', record.financialConcerns)) ||
                    (record.transportation && shouldShowRow(recordWithFlag, 'Transportation', record.transportation)) ||
                    (record.foodSecurity && shouldShowRow(recordWithFlag, 'Food Security', record.foodSecurity)) ||
                    (record.domesticViolence && shouldShowRow(recordWithFlag, 'Domestic Violence', record.domesticViolence)) ||
                    (record.recentTravel && shouldShowRow(recordWithFlag, 'Recent Travel', record.recentTravel)) ||
                    (record.militaryService && shouldShowRow(recordWithFlag, 'Military Service', record.militaryService)) ||
                    notesSentences.some(s => shouldShowRow(recordWithFlag, s));

                  if (!hasVisibleRows) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h3 className="section-title">{highlightText('Additional Information')}</h3>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedId === `additional-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const lines = ['ADDITIONAL INFORMATION', '═══════════════════════════════════════'];
                                if (record.insurance) lines.push(`Insurance: ${record.insurance}`);
                                if (record.financialConcerns) lines.push(`Financial Concerns: ${record.financialConcerns}`);
                                if (record.transportation) lines.push(`Transportation: ${record.transportation}`);
                                if (record.foodSecurity) lines.push(`Food Security: ${record.foodSecurity}`);
                                if (record.domesticViolence) lines.push(`Domestic Violence: ${record.domesticViolence}`);
                                if (record.recentTravel) lines.push(`Recent Travel: ${record.recentTravel}`);
                                if (record.militaryService) lines.push(`Military Service: ${record.militaryService}`);
                                if (notesSentences.length > 0) {
                                  lines.push('Notes:');
                                  notesSentences.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
                                }
                                copyToClipboard(lines.join('\n'), `additional-${idx}`);
                              }}
                            >
                              {copiedId === `additional-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {record._id && editedFields[`additional-${idx}`] && (
                              <button className={`approve-btn ${statusOverrides[idx] === 'approved' ? 'approved' : 'pending'}`} onClick={() => handleApprove(record, idx)} disabled={approving}>
                                {statusOverrides[idx] === 'approved' ? 'Approved' : approving ? 'Approving...' : 'Pending Approve'}
                              </button>
                            )}
                          </div>
                        </div>

                        {record.insurance && (sectionMatches || shouldShowRow(recordWithFlag, 'Insurance', record.insurance)) &&
                          renderEditableField(record, idx, 'insurance', 'Insurance', `insurance-${idx}`, 'additional')}

                        {record.financialConcerns && (sectionMatches || shouldShowRow(recordWithFlag, 'Financial Concerns', record.financialConcerns)) &&
                          renderEditableField(record, idx, 'financialConcerns', 'Financial Concerns', `financial-${idx}`, 'additional')}

                        {record.transportation && (sectionMatches || shouldShowRow(recordWithFlag, 'Transportation', record.transportation)) &&
                          renderEditableField(record, idx, 'transportation', 'Transportation', `transport-${idx}`, 'additional')}

                        {record.foodSecurity && (sectionMatches || shouldShowRow(recordWithFlag, 'Food Security', record.foodSecurity)) &&
                          renderEditableField(record, idx, 'foodSecurity', 'Food Security', `food-${idx}`, 'additional')}

                        {record.domesticViolence && (sectionMatches || shouldShowRow(recordWithFlag, 'Domestic Violence', record.domesticViolence)) &&
                          renderEditableField(record, idx, 'domesticViolence', 'Domestic Violence', `domestic-${idx}`, 'additional')}

                        {record.recentTravel && (sectionMatches || shouldShowRow(recordWithFlag, 'Recent Travel', record.recentTravel)) &&
                          renderEditableField(record, idx, 'recentTravel', 'Recent Travel', `travel-${idx}`, 'additional')}

                        {record.militaryService && (sectionMatches || shouldShowRow(recordWithFlag, 'Military Service', record.militaryService)) &&
                          renderEditableField(record, idx, 'militaryService', 'Military Service', `military-${idx}`, 'additional')}

                        {record.notes &&
                          renderEditableSentenceRows(record, idx, 'notes', 'Notes', 'additional', sectionMatches, recordWithFlag)}
                      </div>
                    </div>
                  );
                })()}

                {/* Clinical Summary Section (findings, assessment, plan, status) */}
                {(() => {
                  const hasClinicalData = record.findings || record.assessment || record.plan || record.status;
                  if (!hasClinicalData) return null;

                  const findingsSentences = splitBySentence(record.findings);
                  const assessmentSentences = splitBySentence(record.assessment);
                  const planSentences = splitBySentence(record.plan);

                  const sectionMatches = (() => {
                    if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
                    return shouldShowRow(recordWithFlag,
                      'Clinical Summary', 'clinical summary', 'CLINICAL SUMMARY',
                      'Findings', 'findings', 'Assessment', 'assessment',
                      'Plan', 'plan', 'Status', 'status'
                    );
                  })();

                  const hasVisibleRows = sectionMatches ||
                    findingsSentences.some(s => shouldShowRow(recordWithFlag, s)) ||
                    assessmentSentences.some(s => shouldShowRow(recordWithFlag, s)) ||
                    planSentences.some(s => shouldShowRow(recordWithFlag, s)) ||
                    (record.status && shouldShowRow(recordWithFlag, 'Status', record.status));

                  if (!hasVisibleRows) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h3 className="section-title">{highlightText('Clinical Summary')}</h3>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedId === `clinical-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const lines = ['CLINICAL SUMMARY', '═══════════════════════════════════════'];
                                if (findingsSentences.length > 0) {
                                  lines.push('Findings:');
                                  findingsSentences.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
                                }
                                if (assessmentSentences.length > 0) {
                                  lines.push('Assessment:');
                                  assessmentSentences.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
                                }
                                if (planSentences.length > 0) {
                                  lines.push('Plan:');
                                  planSentences.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
                                }
                                if (record.status) lines.push(`Status: ${record.status}`);
                                copyToClipboard(lines.join('\n'), `clinical-${idx}`);
                              }}
                            >
                              {copiedId === `clinical-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {record._id && editedFields[`clinical-${idx}`] && (
                              <button className={`approve-btn ${statusOverrides[idx] === 'approved' ? 'approved' : 'pending'}`} onClick={() => handleApprove(record, idx)} disabled={approving}>
                                {statusOverrides[idx] === 'approved' ? 'Approved' : approving ? 'Approving...' : 'Pending Approve'}
                              </button>
                            )}
                          </div>
                        </div>

                        {record.findings &&
                          renderEditableSentenceRows(record, idx, 'findings', 'Findings', 'clinical', sectionMatches, recordWithFlag)}

                        {record.assessment &&
                          renderEditableSentenceRows(record, idx, 'assessment', 'Assessment', 'clinical', sectionMatches, recordWithFlag)}

                        {record.plan &&
                          renderEditableSentenceRows(record, idx, 'plan', 'Plan', 'clinical', sectionMatches, recordWithFlag)}

                        {record.status && (sectionMatches || shouldShowRow(recordWithFlag, 'Status', record.status)) &&
                          renderEditableField(record, idx, 'status', 'Status', `status-${idx}`, 'clinical')}
                      </div>
                    </div>
                  );
                })()}

                {/* Recommendations Section */}
                {(() => {
                  const hasRecData = Array.isArray(record.recommendations) && record.recommendations.length > 0;
                  if (!hasRecData) return null;

                  const sectionMatches = (() => {
                    if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
                    return shouldShowRow(recordWithFlag,
                      'Recommendations', 'recommendations', 'RECOMMENDATIONS'
                    );
                  })();

                  const recsText = record.recommendations.map(r =>
                    (typeof r === 'object' && r !== null ? `${r.recommendation || ''} ${r.date || ''}` : String(r ?? '')));
                  const hasVisibleRows = sectionMatches || recsText.some(t => shouldShowRow(recordWithFlag, t));
                  if (!hasVisibleRows) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h3 className="section-title">{highlightText('Recommendations')}</h3>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedId === `recommendations-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const lines = ['RECOMMENDATIONS', '═══════════════════════════════════════'];
                                record.recommendations.forEach((r, i) => {
                                  const text = (typeof r === 'object' && r !== null ? r.recommendation : r) || '';
                                  const d = (typeof r === 'object' && r !== null ? r.date : '') || '';
                                  lines.push(`  ${i + 1}. ${text}${d ? ` (${d})` : ''}`);
                                });
                                copyToClipboard(lines.join('\n'), `recommendations-${idx}`);
                              }}
                            >
                              {copiedId === `recommendations-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {record._id && editedFields[`recommendations-${idx}`] && (
                              <button className={`approve-btn ${statusOverrides[idx] === 'approved' ? 'approved' : 'pending'}`} onClick={() => handleApprove(record, idx)} disabled={approving}>
                                {statusOverrides[idx] === 'approved' ? 'Approved' : approving ? 'Approving...' : 'Pending Approve'}
                              </button>
                            )}
                          </div>
                        </div>

                        {renderRecommendationsRows(record, idx, 'recommendations', 'Recommendations', 'recommendations', sectionMatches, recordWithFlag)}
                      </div>
                    </div>
                  );
                })()}

                {/* Results Section (OBJECT) */}
                {(() => {
                  const hasResultsData = record.results && !isScalar(record.results) && !isEmptyDeep(record.results);
                  if (!hasResultsData) return null;

                  const sectionMatches = (() => {
                    if (!searchTerm.trim() || recordWithFlag._showAllSections) return true;
                    return shouldShowRow(recordWithFlag,
                      'Results', 'results', 'RESULTS',
                      JSON.stringify(record.results)
                    );
                  })();

                  if (!sectionMatches) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h3 className="section-title">{highlightText('Results')}</h3>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedId === `results-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                copyToClipboard(`RESULTS\n${JSON.stringify(record.results, null, 2)}`, `results-${idx}`);
                              }}
                            >
                              {copiedId === `results-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {record._id && editedFields[`results-${idx}`] && (
                              <button className={`approve-btn ${statusOverrides[idx] === 'approved' ? 'approved' : 'pending'}`} onClick={() => handleApprove(record, idx)} disabled={approving}>
                                {statusOverrides[idx] === 'approved' ? 'Approved' : approving ? 'Approving...' : 'Pending Approve'}
                              </button>
                            )}
                          </div>
                        </div>

                        {renderResultsField(record, idx, 'results', 'Results', 'results', sectionMatches)}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SocialHistoryDocument;
