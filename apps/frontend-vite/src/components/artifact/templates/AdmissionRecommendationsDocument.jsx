import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import AdmissionRecommendationsDocumentPDFTemplate from '../pdf-templates/AdmissionRecommendationsDocumentPDFTemplate';
import './AdmissionRecommendationsDocument.css';

/**
 * Admission Recommendations Document Template
 * Blue mini-card theme, per-sentence editing, comma-split per-part editing
 * 4-level search with sectionTitleMatches pattern
 */

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldName]: value } } */
const DRAFT_KEY = 'admission_recommendationsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const SECTION_FIELDS = {
  reportType: ['reportType'],
  clinicalIndication: ['clinicalIndication'],
  findings: ['findings'],
  urgency: ['urgency'],
  recommendations: ['recommendations'],
  followUp: ['followUp'],
};

const SENTENCE_FIELDS = ['clinicalIndication', 'findings', 'recommendations', 'followUp'];

const SECTION_LABELS = {
  reportType: 'Report Type',
  clinicalIndication: 'Clinical Indication',
  findings: 'Findings',
  urgency: 'Urgency',
  recommendations: 'Recommendations',
  followUp: 'Follow-Up',
};

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
  if (!text) return [];
  const items = [];
  let current = '';
  let parenDepth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    // Skip thousands separators: a comma directly between two digits (e.g. 85,000) is part of the number, not a list separator
    const isThousandsSep = ch === ',' && /\d/.test(text[i - 1] || '') && /\d/.test(text[i + 1] || '');
    if (ch === ',' && parenDepth === 0 && !isThousandsSep) {
      if (current.trim()) items.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) items.push(current.trim());
  return items;
};

const parseLabel = (text) => {
  if (!text) return { isLabeled: false, label: null, value: text };
  const colonIdx = text.indexOf(':');
  if (colonIdx > 0 && colonIdx < 50) {
    return { isLabeled: true, label: text.substring(0, colonIdx).trim(), value: text.substring(colonIdx + 1).trim() };
  }
  return { isLabeled: false, label: null, value: text };
};

const AdmissionRecommendationsDocument = ({ document: doc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const textareaRef = useRef(null);

  // Data unwrapping
  const unwrappedData = useMemo(() => {
    if (!doc) return [];
    if (Array.isArray(doc)) return doc;
    if (doc.admission_recommendations) {
      const raw = doc.admission_recommendations;
      return Array.isArray(raw) ? raw : [raw];
    }
    if (doc.documentData) {
      const dd = doc.documentData;
      if (Array.isArray(dd)) return dd;
      if (dd.admission_recommendations) {
        const raw = dd.admission_recommendations;
        return Array.isArray(raw) ? raw : [raw];
      }
      return [dd];
    }
    return [doc];
  }, [doc]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    unwrappedData.forEach((record, idx) => {
      const recId = record && (record._id?.$oid || record._id);
      const recDrafts = recId ? store[recId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldName, value]) => {
        const editKey = `${fieldName}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = true;
        nSentences[`${fieldName}-${idx}-s0`] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [unwrappedData]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return String(dateString);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return String(dateString);
    }
  };

  const highlightText = (text) => {
    if (!searchTerm || !text) return text;
    const str = String(text);
    const i = str.toLowerCase().indexOf(searchTerm.toLowerCase());
    if (i === -1) return str;
    return <>{str.substring(0, i)}<mark>{str.substring(i, i + searchTerm.length)}</mark>{str.substring(i + searchTerm.length)}</>;
  };

  const shouldShowRow = (record, ...args) => {
    if (!searchTerm) return true;
    const sl = searchTerm.toLowerCase();
    return args.some(a => a && String(a).toLowerCase().includes(sl));
  };

  const getFieldValue = (record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    return localEdits[editKey] !== undefined ? localEdits[editKey] : record[fieldName];
  };

  const formatValue = (val) => {
    if (val === null || val === undefined || val === '') return null;
    return String(val);
  };

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // --- Editing functions ---

  const persistToLocalStorage = useCallback((collection, recordId, fieldName, value) => {
    try {
      const key = `edit_${collection}_${recordId}_${fieldName}`;
      localStorage.setItem(key, JSON.stringify({ value, timestamp: Date.now() }));
    } catch {}
  }, []);

  const handleStartEdit = useCallback((fieldName, idx, currentValue, sentenceIdx = 0) => {
    const editKey = `${fieldName}-${idx}-s${sentenceIdx}`;
    setEditingField(editKey);
    const cleanValue = (currentValue || '').replace(/[.;]+$/, '').trim();
    setEditValue(cleanValue);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, sentenceIdx, valueOverride, editTrackingKey) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) { console.error('Cannot save — no _id'); return; }
    const saveValue = valueOverride !== undefined ? valueOverride : editValue.trim();
    const sKey = editTrackingKey || `${fieldName}-${idx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;
    const fullEditKey = `${fieldName}-${idx}`;

    setLocalEdits(prev => ({ ...prev, [fullEditKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [fullEditKey]: true }));
    setEditedFields(prev => ({ ...prev, [fullEditKey]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow
    setApprovedSections(prev => { const u = { ...prev }; delete u[`${sectionId}-${idx}`]; return u; });

    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldName] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // PLAIN FUNCTION — no useCallback
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
      return (t && !/[.!?]$/.test(t)) ? t + '.' : t;
    });
    return updated.join(' ');
  };

  // PLAIN FUNCTION — no useCallback
  const saveSentence = (record, fieldName, idx, sectionId, sIdx) => {
    let editedSentence = editValue.trim();
    if (editedSentence && !/[.!?]$/.test(editedSentence)) editedSentence += '.';
    const fullEditKey = `${fieldName}-${idx}`;
    const hasFullEdit = localEdits[fullEditKey] !== undefined;
    const sourceText = hasFullEdit ? localEdits[fullEditKey] : (record[fieldName] || '');
    const allCurrent = splitBySentence(sourceText);
    const fullText = reconstructFullText(allCurrent, sIdx, editedSentence, fieldName, idx, hasFullEdit);
    const newSentences = splitBySentence(fullText);
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
    handleSaveField(record, fieldName, idx, sectionId, sIdx, fullText);
  };

  const sectionHasEdits = useCallback((sectionId, idx) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    if (approvedSections[`${sectionId}-${idx}`]) return false;
    return fields.some(f => {
      const hasSentenceEdits = Object.keys(editedSentences).some(key => {
        if (!key.startsWith(`${f}-${idx}-s`)) return false;
        return editedSentences[key] === 'edited' || editedSentences[key] === 'added';
      });
      const hasObjectEdits = Object.keys(editedFields).some(key => key.startsWith(`${f}-${idx}`));
      return hasSentenceEdits || hasObjectEdits;
    });
  }, [editedSentences, editedFields, approvedSections]);

  // Approve = COMMIT this section's staged drafts for this record to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sectionId) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) return;
    const approveKey = `${sectionId}-${idx}`;
    const isCurrentlyApproved = approvedSections[approveKey];
    const fields = SECTION_FIELDS[sectionId] || [];
    setApproving(true);
    try {
      // Persist each staged field in this section to the DB now
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        const baseField = fieldPart.includes('.') ? fieldPart.slice(0, fieldPart.indexOf('.')) : fieldPart;
        return fields.includes(baseField);
      });
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const dotIdx = fieldPart.indexOf('.');
        const payload = { field: dotIdx === -1 ? fieldPart : fieldPart.slice(0, dotIdx), value: localEdits[editKey] };
        if (dotIdx !== -1) payload.arrayIndex = parseInt(fieldPart.slice(dotIdx + 1), 10);
        const resp = await secureApiClient.put(`/api/edit/admission_recommendations/${recordId}/edit`, payload);
        if (!resp || !resp.success) throw new Error((resp && resp.error) || 'save failed');
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/admission_recommendations/${recordId}/approve`, {
        sectionId, approved: !isCurrentlyApproved,
      });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this section's committed fields from the localStorage draft store
      const store = readDrafts();
      if (store[recordId]) {
        fields.forEach(f => { delete store[recordId][f]; });
        if (Object.keys(store[recordId]).length === 0) delete store[recordId];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [approveKey]: !isCurrentlyApproved }));
      if (!isCurrentlyApproved) {
        setEditedSentences(prev => {
          const cleaned = {};
          for (const key of Object.keys(prev)) {
            const shouldRemove = fields.some(f => key.startsWith(`${f}-${idx}-s`));
            if (!shouldRemove) cleaned[key] = prev[key];
          }
          return cleaned;
        });
        setEditedFields(prev => {
          const cleaned = {};
          for (const key of Object.keys(prev)) {
            const shouldRemove = fields.some(f => key.startsWith(`${f}-${idx}`));
            if (!shouldRemove) cleaned[key] = prev[key];
          }
          return cleaned;
        });
      }
    } catch (error) {
      console.error('Approve failed:', error);
    } finally {
      setApproving(false);
    }
  }, [approvedSections, localEdits, pendingEdits]);

  // pdfData memo — merges localEdits into unwrappedData
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
          merged[fieldName] = editVal;
        }
      }
      return merged;
    });
  }, [unwrappedData, localEdits, pendingEdits]);

  // --- Search ---

  const stm = (...titles) => {
    if (!searchTerm.trim()) return true;
    const p = searchTerm.toLowerCase().trim();
    return titles.some(title => {
      const t = String(title).toLowerCase();
      return t.startsWith(p) || p.startsWith(t);
    });
  };

  const shouldShowSection = (record, sectionId, title) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    if (stm(title)) return true;
    const fields = SECTION_FIELDS[sectionId] || [];
    return fields.some(f => {
      const val = getFieldValue(record, f, record._originalIdx);
      if (formatValue(val) === null) return false;
      return shouldShowRow(record, String(val));
    });
  };

  const filteredRecords = useMemo(() => {
    const enriched = unwrappedData.map((record, idx) => ({
      ...record,
      _originalIdx: idx,
      _showAllSections: false,
    }));
    if (!searchTerm.trim()) return enriched;
    const searchLower = searchTerm.toLowerCase().trim();
    return enriched.filter((record) => {
      const recordTitle = `Admission Recommendation ${record._originalIdx + 1}`;
      const searchableText = [
        'Admission Recommendations', recordTitle,
        'Report Type', record.reportType,
        'Clinical Indication', record.clinicalIndication,
        'Findings', record.findings,
        'Urgency', record.urgency,
        'Recommendations', record.recommendations,
        'Follow-Up', 'Follow Up', record.followUp,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!searchableText.includes(searchLower)) return false;
      const titleLower = recordTitle.toLowerCase();
      if (titleLower.startsWith(searchLower) || searchLower.startsWith(titleLower) ||
          'admission recommendations'.startsWith(searchLower) || searchLower.startsWith('admission recommendations')) {
        record._showAllSections = true;
      } else {
        record._showAllSections = false;
      }
      return true;
    });
  }, [unwrappedData, searchTerm]);

  // --- Copy helpers ---

  const formatSentenceFieldLines = (text) => {
    const sentences = splitBySentence(text);
    const lines = [];
    let n = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        const parts = splitByComma(parsed.value);
        if (parts.length >= 2) {
          lines.push(parsed.label);
          parts.forEach(item => { lines.push(`  ${n++}. ${item}`); });
        } else {
          lines.push(`${n++}. ${s}`);
        }
      } else {
        const parts = splitByComma(s);
        if (parts.length >= 2) {
          parts.forEach(item => { lines.push(`${n++}. ${item}`); });
        } else {
          lines.push(`${n++}. ${s}`);
        }
      }
    });
    return lines;
  };

  const getSectionText = (record, sectionId, idx) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return '';
    const label = SECTION_LABELS[sectionId] || sectionId;
    const lines = [label.toUpperCase()];
    fields.forEach(f => {
      const val = getFieldValue(record, f, idx);
      if (formatValue(val) === null) return;
      const text = String(val);
      const isSentence = SENTENCE_FIELDS.includes(f);
      const needsFormat = isSentence && (splitBySentence(text).length > 1 || splitByComma(text).length >= 2);
      if (needsFormat) {
        formatSentenceFieldLines(text).forEach(l => lines.push(l));
      } else {
        lines.push(text);
      }
    });
    return lines.join('\n');
  };

  const getAllRecordText = (record, idx) => {
    const lines = [];
    lines.push(`ADMISSION RECOMMENDATION ${idx + 1}`);
    lines.push('='.repeat(40));
    if (record.reportDate) lines.push(`Date: ${formatDate(record.reportDate)}`);
    Object.keys(SECTION_FIELDS).forEach(sectionId => {
      const text = getSectionText(record, sectionId, idx);
      if (text) { lines.push(''); lines.push(text); }
    });
    return lines.join('\n');
  };

  // --- Render functions ---

  const renderEditableField = (record, fieldName, idx, sectionId) => {
    const val = getFieldValue(record, fieldName, idx);
    if (formatValue(val) === null) return null;
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const isEdited = editedSentences[editKey] === 'edited';
    const canEdit = true;

    if (isEditing) {
      return (
        <div className="edit-field-container">
          <textarea
            ref={textareaRef}
            className="edit-textarea"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                handleSaveField(record, fieldName, idx, sectionId, 0);
              }
              if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
            }}
          />
          <div className="edit-actions">
            <button className="save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId, 0)} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
          </div>
        </div>
      );
    }

    return (
      <React.Fragment>
        <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
          <div
            className={`row-content${canEdit ? ' editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(fieldName, idx, String(val), 0)}
          >
            <span className="content-value">{highlightText(String(val))}</span>
            {canEdit && !isEdited && <span className="edit-indicator">✎</span>}
          </div>
          <button
            className={`copy-btn${copiedId === `${fieldName}-${idx}` ? ' copied' : ''}`}
            onClick={() => copyToClipboard(String(val), `${fieldName}-${idx}`)}
          >
            {copiedId === `${fieldName}-${idx}` ? 'Copied' : 'Copy'}
          </button>
        </div>
        {isEdited && <div className="modified-badge">edited — click pending approve to save</div>}
      </React.Fragment>
    );
  };

  const renderSentenceEditableField = (record, fieldName, idx, sectionId, label) => {
    const val = getFieldValue(record, fieldName, idx);
    if (formatValue(val) === null) return null;
    const sentences = splitBySentence(String(val));
    const canEdit = true;
    const sectionTitleMatches = searchTerm && stm(label);

    // Single sentence with <2 comma items → simple field
    if (sentences.length <= 1 && splitByComma(String(val)).length < 2) {
      return renderEditableField(record, fieldName, idx, sectionId);
    }

    // Build the rows for each sentence WITHOUT the mini-card wrapper, so consecutive unlabeled
    // sentences can be grouped into ONE card afterwards.
    const buildSentence = (sentence, sIdx) => {
      // Per-sentence search filtering (Level 4)
      if (searchTerm && !record._showAllSections && !sectionTitleMatches) {
        if (!shouldShowRow(record, sentence)) return null;
      }

      const parsed = parseLabel(sentence);
      const textToSplit = parsed.isLabeled ? parsed.value : sentence;
      const rawComma = splitByComma(textToSplit);
      const displayParts = rawComma.length >= 2 ? rawComma : [textToSplit];

      if (displayParts.length >= 2) {
        // Multiple comma items — per-part editing
        const rows = displayParts.map((part, pi) => {
              const partEditKey = `${fieldName}-${idx}-s${sIdx}-p${pi}`;
              const isPartEditing = editingField === partEditKey;
              const isPartEdited = editedSentences[partEditKey] === 'edited';
              const partCopyId = `${fieldName}-${idx}-s${sIdx}-p${pi}`;

              // Per-part search filtering
              if (searchTerm && !record._showAllSections && !sectionTitleMatches) {
                if (parsed.isLabeled && !stm(parsed.label) && !shouldShowRow(record, part)) return null;
                if (!parsed.isLabeled && !shouldShowRow(record, part)) return null;
              }

              if (isPartEditing) {
                return (
                  <div key={partCopyId} className="edit-field-container">
                    <textarea
                      ref={textareaRef}
                      className="edit-textarea"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          const newParts = [...displayParts];
                          newParts[pi] = editValue.trim();
                          const sourceText = String(getFieldValue(record, fieldName, idx));
                          const fullSentence = parsed.isLabeled ? `${parsed.label}: ${textToSplit}` : sentence;
                          const replacement = parsed.isLabeled
                            ? `${parsed.label}: ${newParts.join(', ')}`
                            : newParts.join(', ');
                          const newFullText = sourceText.replace(fullSentence, replacement);
                          handleSaveField(record, fieldName, idx, sectionId, 0, newFullText, partEditKey);
                        }
                        if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                      }}
                    />
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={() => {
                        const newParts = [...displayParts];
                        newParts[pi] = editValue.trim();
                        const sourceText = String(getFieldValue(record, fieldName, idx));
                        const fullSentence = parsed.isLabeled ? `${parsed.label}: ${textToSplit}` : sentence;
                        const replacement = parsed.isLabeled
                          ? `${parsed.label}: ${newParts.join(', ')}`
                          : newParts.join(', ');
                        const newFullText = sourceText.replace(fullSentence, replacement);
                        handleSaveField(record, fieldName, idx, sectionId, 0, newFullText, partEditKey);
                      }}>
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                    </div>
                  </div>
                );
              }

              return (
                <React.Fragment key={partCopyId}>
                  <div className={`numbered-row${isPartEdited ? ' modified' : ''}`}>
                    <div
                      className={`row-content${canEdit ? ' editable' : ''}`}
                      onClick={() => {
                        setEditingField(partEditKey);
                        setEditValue(part.replace(/[.;]+$/, '').trim());
                        setTimeout(() => textareaRef.current?.focus(), 50);
                      }}
                    >
                      <span className="content-value">{highlightText(part)}</span>
                      {canEdit && !isPartEdited && <span className="edit-indicator">✎</span>}
                    </div>
                    <button
                      className={`copy-btn${copiedId === partCopyId ? ' copied' : ''}`}
                      onClick={() => copyToClipboard(part, partCopyId)}
                    >
                      {copiedId === partCopyId ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  {isPartEdited && <div className="modified-badge">edited — click pending approve to save</div>}
                </React.Fragment>
              );
            }).filter(Boolean);
        return { isLabeled: parsed.isLabeled, label: parsed.label, rows };
      }

      // Single item — standard sentence editing
      const sentenceEditKey = `${fieldName}-${idx}-s${sIdx}`;
      const isSentenceEditing = editingField === sentenceEditKey;
      const isSentenceEdited = editedSentences[sentenceEditKey] === 'edited' || editedSentences[sentenceEditKey] === 'added';

      if (isSentenceEditing) {
        const editRow = (
          <div key={sentenceEditKey} className="edit-field-container">
            <textarea
              ref={textareaRef}
              className="edit-textarea"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  saveSentence(record, fieldName, idx, sectionId, sIdx);
                }
                if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
              }}
            />
            <div className="edit-actions">
              <button className="save-btn" onClick={() => saveSentence(record, fieldName, idx, sectionId, sIdx)} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        );
        return { isLabeled: parsed.isLabeled, label: parsed.label, rows: [editRow] };
      }

      const singleRow = (
        <React.Fragment key={sentenceEditKey}>
          <div className={`numbered-row${isSentenceEdited ? ' modified' : ''}`}>
            <div
              className={`row-content${canEdit ? ' editable' : ''}`}
              onClick={() => canEdit && handleStartEdit(fieldName, idx, sentence, sIdx)}
            >
              <span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : sentence)}</span>
              {canEdit && !isSentenceEdited && <span className="edit-indicator">✎</span>}
            </div>
            <button
              className={`copy-btn${copiedId === `${fieldName}-${idx}-s${sIdx}` ? ' copied' : ''}`}
              onClick={() => copyToClipboard(sentence, `${fieldName}-${idx}-s${sIdx}`)}
            >
              {copiedId === `${fieldName}-${idx}-s${sIdx}` ? 'Copied' : 'Copy'}
            </button>
          </div>
          {isSentenceEdited && (
            <div className={`modified-badge${editedSentences[sentenceEditKey] === 'added' ? ' added' : ''}`}>
              {editedSentences[sentenceEditKey] === 'added' ? 'added' : 'edited — click pending approve to save'}
            </div>
          )}
        </React.Fragment>
      );
      return { isLabeled: parsed.isLabeled, label: parsed.label, rows: [singleRow] };
    };

    const built = sentences.map((s, i) => buildSentence(s, i)).filter((b) => b && b.rows.length > 0);

    // Group consecutive UNLABELED sentences into ONE mini-card; each LABELED sentence gets its own card.
    // → Findings (no labels) collapses to a single card; Follow-Up keeps Week 2/4/12 + Monthly separate.
    const units = [];
    built.forEach((b) => {
      const last = units[units.length - 1];
      if (!b.isLabeled && last && !last.isLabeled) {
        last.rows.push(...b.rows);
      } else {
        units.push({ isLabeled: b.isLabeled, label: b.label, rows: [...b.rows] });
      }
    });

    return units.map((u, ui) => (
      <div key={ui} className="rec-mini-card">
        {u.isLabeled && <div className="nested-subtitle">{highlightText(u.label)}</div>}
        {u.rows}
      </div>
    ));
  };

  const renderSection = (record, idx, sectionId) => {
    const label = SECTION_LABELS[sectionId];
    if (!shouldShowSection(record, sectionId, label)) return null;
    const fields = SECTION_FIELDS[sectionId];
    const hasContent = fields.some(f => formatValue(getFieldValue(record, f, idx)) !== null);
    if (!hasContent) return null;

    const isSentence = SENTENCE_FIELDS.includes(sectionId);

    return (
      <div key={sectionId} className="mini-cards-container">
        <div className="section-header">
          <h3 className="section-title">{highlightText(label)}</h3>
          <div className="header-right-actions">
            <button
              className={`copy-btn${copiedId === `section-${sectionId}-${idx}` ? ' copied' : ''}`}
              onClick={() => copyToClipboard(getSectionText(record, sectionId, idx), `section-${sectionId}-${idx}`)}
            >
              {copiedId === `section-${sectionId}-${idx}` ? 'Copied' : 'Copy Section'}
            </button>
            {(sectionHasEdits(sectionId, idx) || approvedSections[`${sectionId}-${idx}`]) && (
              <button
                className={`approve-btn${approvedSections[`${sectionId}-${idx}`] ? ' approved' : ' pending'}`}
                onClick={() => handleApproveSection(record, idx, sectionId)}
                disabled={approving}
              >
                {approving ? 'Approving...' : approvedSections[`${sectionId}-${idx}`] ? 'Approved' : 'Pending Approve'}
              </button>
            )}
          </div>
        </div>
        {fields.map(f => (
          <React.Fragment key={f}>
            {isSentence
              ? renderSentenceEditableField(record, f, idx, sectionId, label)
              : renderEditableField(record, f, idx, sectionId)}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // --- Empty state ---
  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <div className="admission-recommendations-document">
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-text">No admission recommendations available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admission-recommendations-document">
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">Admission Recommendations</h1>
        <div className="header-actions">
          <button
            className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`}
            onClick={() => {
              const allText = filteredRecords.map(r => getAllRecordText(r, r._originalIdx)).join('\n\n---\n\n');
              copyToClipboard(allText, 'copy-all');
            }}
          >
            {copiedId === 'copy-all' ? 'Copied' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<AdmissionRecommendationsDocumentPDFTemplate document={pdfData} />}
            fileName="Admission_Recommendations.pdf"
          >
            {({ loading }) => (
              <button
                className={`copy-btn${copiedId === 'pdf' ? ' copied' : ''}`}
                onClick={() => { setCopiedId('pdf'); setTimeout(() => setCopiedId(null), 2000); }}
              >
                {loading ? 'Preparing...' : copiedId === 'pdf' ? 'Exported!' : 'Export PDF'}
              </button>
            )}
          </PDFDownloadLink>
        </div>
      </div>

      {/* Search */}
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search recommendations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>
        )}
      </div>

      {/* No Results */}
      {filteredRecords.length === 0 && searchTerm && (
        <div className="no-results">No results found for "{searchTerm}"</div>
      )}

      {/* Records */}
      <div className="records-list">
        {filteredRecords.map((record) => {
          const idx = record._originalIdx;

          return (
            <div key={record._id || idx} className="record-card">
              {/* Record Header */}
              <div className="card-header">
                <div className="header-top-row">
                  {record.reportDate && (
                    <span className="date-badge">{highlightText(formatDate(record.reportDate))}</span>
                  )}
                  {record.urgency && (
                    <span className="status-badge urgency">{highlightText(record.urgency)}</span>
                  )}
                </div>
                <h2 className="card-title">{highlightText(`Admission Recommendation ${idx + 1}`)}</h2>
              </div>

              {/* Card Content */}
              <div className="card-content">
                {Object.keys(SECTION_FIELDS).map(sectionId => renderSection(record, idx, sectionId))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdmissionRecommendationsDocument;
