import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import AdvanceCarePlanningDocumentPDFTemplate from '../pdf-templates/AdvanceCarePlanningDocumentPDFTemplate';
import './AdvanceCarePlanningDocument.css';

/**
 * AdvanceCarePlanningDocument - Inline Editing with per-section approve
 * Blue mini-card theme, per-sentence editing, comma-split per-part editing
 * 4-level search with sectionTitleMatches pattern
 */

const SECTION_FIELDS = {
  codeStatus: ['codeStatus'],
  participants: ['participants'],
  goalsOfCare: ['goalsOfCare'],
  values: ['values'],
  treatmentPreferences: ['treatmentPreferences'],
  healthcareAgent: ['healthcareAgent'],
  advanceDirectiveStatus: ['advanceDirectiveStatus'],
  prognosisDiscussion: ['prognosisDiscussion'],
  qualityOfLife: ['qualityOfLife'],
  spiritualConcerns: ['spiritualConcerns'],
  followUpPlanned: ['followUpPlanned'],
  notes: ['notes'],
  providerInfo: ['provider', 'facility'],
};

const SENTENCE_FIELDS = [
  'goalsOfCare', 'values', 'treatmentPreferences', 'advanceDirectiveStatus',
  'prognosisDiscussion', 'qualityOfLife', 'spiritualConcerns', 'followUpPlanned', 'notes',
];

const SECTION_LABELS = {
  codeStatus: 'Code Status',
  participants: 'Participants',
  goalsOfCare: 'Goals of Care',
  values: 'Values',
  treatmentPreferences: 'Treatment Preferences',
  healthcareAgent: 'Healthcare Agent',
  advanceDirectiveStatus: 'Advance Directive Status',
  prognosisDiscussion: 'Prognosis Discussion',
  qualityOfLife: 'Quality of Life',
  spiritualConcerns: 'Spiritual Concerns',
  followUpPlanned: 'Follow-Up Planned',
  notes: 'Notes',
  providerInfo: 'Provider Information',
};

const FIELD_LABELS = {
  codeStatus: 'Code Status',
  participants: 'Participants',
  goalsOfCare: 'Goals of Care',
  values: 'Values',
  treatmentPreferences: 'Treatment Preferences',
  healthcareAgent: 'Healthcare Agent',
  advanceDirectiveStatus: 'Advance Directive Status',
  prognosisDiscussion: 'Prognosis Discussion',
  qualityOfLife: 'Quality of Life',
  spiritualConcerns: 'Spiritual Concerns',
  followUpPlanned: 'Follow-Up Planned',
  notes: 'Notes',
  provider: 'Provider',
  facility: 'Facility',
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
    if (ch === ',' && parenDepth === 0) {
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

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'advance_care_planningPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const AdvanceCarePlanningDocument = ({ document: doc }) => {
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
    if (Array.isArray(doc)) {
      if (doc.length === 0) return [];
      if (doc[0]?.advance_care_planning && Array.isArray(doc[0].advance_care_planning)) {
        return doc[0].advance_care_planning;
      }
      return doc;
    }
    if (doc.advance_care_planning && Array.isArray(doc.advance_care_planning)) {
      return doc.advance_care_planning;
    }
    if (doc.documentData) {
      const dd = doc.documentData;
      if (Array.isArray(dd)) return dd;
      if (dd.advance_care_planning) {
        const raw = dd.advance_care_planning;
        return Array.isArray(raw) ? raw : [raw];
      }
      return [dd];
    }
    if (doc.planningDate || doc.codeStatus || doc.participants) {
      return [doc];
    }
    return [];
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
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = true;
        nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
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
    if (Array.isArray(val)) return val.length > 0 ? val : null;
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
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => { const u = { ...prev }; delete u[`${sectionId}-${idx}`]; return u; });
    // Stage the draft in localStorage (fieldPart = fieldName; this template stores the full field value).
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

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sectionId) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) return;
    const approveKey = `${sectionId}-${idx}`;
    const isCurrentlyApproved = approvedSections[approveKey];
    setApproving(true);
    try {
      if (!isCurrentlyApproved) {
        // Persist each staged field in THIS section to the DB now.
        const sectionFields = SECTION_FIELDS[sectionId] || [];
        const suffix = `-${idx}`;
        const toCommit = Object.keys(localEdits).filter(k => {
          if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
          const fieldPart = k.slice(0, -suffix.length); // "field" or "field.arrayIndex"
          const lastDot = fieldPart.lastIndexOf('.');
          const baseField = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1)))
            ? fieldPart.slice(0, lastDot)
            : fieldPart;
          return sectionFields.includes(baseField);
        });
        for (const editKey of toCommit) {
          const fieldPart = editKey.slice(0, -suffix.length);
          const lastDot = fieldPart.lastIndexOf('.');
          const isArrayIdx = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
          const payload = {
            field: isArrayIdx ? fieldPart.slice(0, lastDot) : fieldPart,
            value: localEdits[editKey],
          };
          if (isArrayIdx) payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
          const resp = await secureApiClient.put(`/api/edit/advance_care_planning/${recordId}/edit`, payload);
          if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        }
        // Flag the section approved (audit trail)
        await secureApiClient.put(`/api/edit/advance_care_planning/${recordId}/approve`, {
          sectionId, approved: true,
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
          toCommit.forEach(editKey => {
            const fieldPart = editKey.slice(0, -suffix.length);
            const lastDot = fieldPart.lastIndexOf('.');
            const baseField = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1)))
              ? fieldPart.slice(0, lastDot)
              : fieldPart;
            delete store[recordId][baseField];
            delete store[recordId][fieldPart];
          });
          if (Object.keys(store[recordId]).length === 0) delete store[recordId];
          writeDrafts(store);
        }
      } else {
        // Un-approve toggle — no DB edit replay, just flip the audit flag.
        await secureApiClient.put(`/api/edit/advance_care_planning/${recordId}/approve`, {
          sectionId, approved: false,
        });
      }
      setApprovedSections(prev => ({ ...prev, [approveKey]: !isCurrentlyApproved }));
      if (!isCurrentlyApproved) {
        const fields = SECTION_FIELDS[sectionId] || [];
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
    // Check field labels
    const fields = SECTION_FIELDS[sectionId] || [];
    return fields.some(f => {
      const label = FIELD_LABELS[f] || '';
      if (stm(label)) return true;
      const val = getFieldValue(record, f, record._originalIdx);
      if (formatValue(val) === null) return false;
      if (Array.isArray(val)) {
        return val.some(item => shouldShowRow(record, String(item)));
      }
      return shouldShowRow(record, String(val));
    });
  };

  const filteredRecords = useMemo(() => {
    const enriched = unwrappedData.map((record, idx) => ({
      ...record,
      _originalIdx: idx,
      _showAllSections: false,
    }));
    if (!searchTerm.trim()) return enriched.map(r => ({ ...r, _showAllSections: true }));
    const searchLower = searchTerm.toLowerCase().trim();
    return enriched.filter((record) => {
      const recordTitle = `Advance Care Planning ${record._originalIdx + 1}`;
      const searchableText = [
        'Advance Care Planning', recordTitle,
        'Code Status', record.codeStatus,
        'Participants', ...(record.participants || []),
        'Goals of Care', record.goalsOfCare,
        'Values', record.values,
        'Treatment Preferences', record.treatmentPreferences,
        'Healthcare Agent', record.healthcareAgent,
        'Advance Directive Status', record.advanceDirectiveStatus,
        'Prognosis Discussion', record.prognosisDiscussion,
        'Quality of Life', record.qualityOfLife,
        'Spiritual Concerns', record.spiritualConcerns,
        'Follow-Up Planned', 'Follow Up Planned', record.followUpPlanned,
        'Notes', record.notes,
        'Provider Information', 'Provider', record.provider,
        'Facility', record.facility,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!searchableText.includes(searchLower)) return false;
      const titleLower = recordTitle.toLowerCase();
      if (titleLower.startsWith(searchLower) || searchLower.startsWith(titleLower) ||
          'advance care planning'.startsWith(searchLower) || searchLower.startsWith('advance care planning')) {
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
      if (f === 'participants' && Array.isArray(val)) {
        val.forEach((item, i) => { lines.push(`${i + 1}. ${item}`); });
        return;
      }
      const fieldLabel = FIELD_LABELS[f];
      const text = String(val);
      const isSentence = SENTENCE_FIELDS.includes(f);
      const needsFormat = isSentence && (splitBySentence(text).length > 1 || splitByComma(text).length >= 2);
      if (fields.length > 1 && fieldLabel) {
        if (needsFormat) {
          lines.push(`${fieldLabel}:`);
          formatSentenceFieldLines(text).forEach(l => lines.push(`  ${l}`));
        } else {
          lines.push(`${fieldLabel}: ${text}`);
        }
      } else {
        if (needsFormat) {
          formatSentenceFieldLines(text).forEach(l => lines.push(l));
        } else {
          lines.push(text);
        }
      }
    });
    return lines.join('\n');
  };

  const getAllRecordText = (record, idx) => {
    const lines = [];
    lines.push(`ADVANCE CARE PLANNING ${idx + 1}`);
    lines.push('='.repeat(40));
    if (record.planningDate) lines.push(`Date: ${formatDate(record.planningDate)}`);
    Object.keys(SECTION_FIELDS).forEach(sectionId => {
      const text = getSectionText(record, sectionId, idx);
      if (text) { lines.push(''); lines.push(text); }
    });
    return lines.join('\n');
  };

  // --- Render functions ---

  const renderApproveBtn = (record, idx, sectionId) => {
    const approveKey = `${sectionId}-${idx}`;
    if (!sectionHasEdits(sectionId, idx) && !approvedSections[approveKey]) return null;
    return (
      <button
        className={`approve-btn${approvedSections[approveKey] ? ' approved' : ' pending'}`}
        onClick={() => handleApproveSection(record, idx, sectionId)}
        disabled={approving}
      >
        {approving ? 'Approving...' : approvedSections[approveKey] ? 'Approved' : 'Pending Approve'}
      </button>
    );
  };

  const renderEditableField = (record, fieldName, idx, sectionId, label) => {
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
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
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

    return sentences.map((sentence, sIdx) => {
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
        return (
          <div key={sIdx} className="rec-mini-card">
            {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
            {displayParts.map((part, pi) => {
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
            })}
          </div>
        );
      }

      // Single item — standard sentence editing
      const sentenceEditKey = `${fieldName}-${idx}-s${sIdx}`;
      const isSentenceEditing = editingField === sentenceEditKey;
      const isSentenceEdited = editedSentences[sentenceEditKey] === 'edited' || editedSentences[sentenceEditKey] === 'added';

      if (isSentenceEditing) {
        return (
          <div key={sIdx} className="edit-field-container">
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
      }

      const singleContent = (
        <>
          {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
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
        </>
      );

      return parsed.isLabeled
        ? <div key={sIdx} className="rec-mini-card">{singleContent}</div>
        : <React.Fragment key={sIdx}>{singleContent}</React.Fragment>;
    });
  };

  // Render participants array with per-item editing
  const renderParticipantsSection = (record, idx) => {
    const participants = getFieldValue(record, 'participants', idx);
    if (!participants || !Array.isArray(participants) || participants.length === 0) return null;
    const sectionId = 'participants';
    const canEdit = true;
    const sectionTitleMatches = searchTerm && stm('Participants');

    return participants.map((item, pIdx) => {
      // Per-item search filtering
      if (searchTerm && !record._showAllSections && !sectionTitleMatches) {
        if (!shouldShowRow(record, item)) return null;
      }

      const editKey = `participants-${idx}-s${pIdx}`;
      const isEditing = editingField === editKey;
      const isEdited = editedSentences[editKey] === 'edited';

      if (isEditing) {
        return (
          <div key={pIdx} className="edit-field-container">
            <textarea
              ref={textareaRef}
              className="edit-textarea"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  // Reconstruct full array with edited item
                  const newParticipants = [...participants];
                  newParticipants[pIdx] = editValue.trim();
                  handleSaveField(record, 'participants', idx, sectionId, pIdx, newParticipants, editKey);
                }
                if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
              }}
            />
            <div className="edit-actions">
              <button className="save-btn" disabled={saving} onClick={() => {
                const newParticipants = [...participants];
                newParticipants[pIdx] = editValue.trim();
                handleSaveField(record, 'participants', idx, sectionId, pIdx, newParticipants, editKey);
              }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        );
      }

      return (
        <React.Fragment key={pIdx}>
          <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
            <div
              className={`row-content${canEdit ? ' editable' : ''}`}
              onClick={() => {
                setEditingField(editKey);
                setEditValue(item);
                setTimeout(() => textareaRef.current?.focus(), 50);
              }}
            >
              <span className="content-value">{highlightText(item)}</span>
              {canEdit && !isEdited && <span className="edit-indicator">✎</span>}
            </div>
            <button
              className={`copy-btn${copiedId === `participant-${idx}-${pIdx}` ? ' copied' : ''}`}
              onClick={() => copyToClipboard(item, `participant-${idx}-${pIdx}`)}
            >
              {copiedId === `participant-${idx}-${pIdx}` ? 'Copied' : 'Copy'}
            </button>
          </div>
          {isEdited && <div className="modified-badge">edited — click pending approve to save</div>}
        </React.Fragment>
      );
    });
  };

  const renderSection = (record, idx, sectionId) => {
    const label = SECTION_LABELS[sectionId];
    if (!shouldShowSection(record, sectionId, label)) return null;
    const fields = SECTION_FIELDS[sectionId];

    // Special handling for participants array
    if (sectionId === 'participants') {
      const participants = getFieldValue(record, 'participants', idx);
      if (!participants || !Array.isArray(participants) || participants.length === 0) return null;
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
              {renderApproveBtn(record, idx, sectionId)}
            </div>
          </div>
          {renderParticipantsSection(record, idx)}
        </div>
      );
    }

    const hasContent = fields.some(f => formatValue(getFieldValue(record, f, idx)) !== null);
    if (!hasContent) return null;

    const isSentence = fields.length === 1 && SENTENCE_FIELDS.includes(fields[0]);

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
            {renderApproveBtn(record, idx, sectionId)}
          </div>
        </div>
        {fields.map(f => {
          const fieldLabel = fields.length > 1 ? FIELD_LABELS[f] : null;
          return (
            <React.Fragment key={f}>
              {isSentence
                ? renderSentenceEditableField(record, f, idx, sectionId, label)
                : SENTENCE_FIELDS.includes(f)
                  ? renderSentenceEditableField(record, f, idx, sectionId, fieldLabel || label)
                  : renderEditableField(record, f, idx, sectionId, fieldLabel)}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // --- Empty state ---
  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <div className="advance-care-planning-document">
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-text">No advance care planning data available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="advance-care-planning-document">
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">Advance Care Planning</h1>
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
            document={<AdvanceCarePlanningDocumentPDFTemplate document={pdfData} />}
            fileName="Advance_Care_Planning.pdf"
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
          placeholder="Search code status, participants, provider..."
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
                  {record.planningDate && (
                    <span className="date-badge">{highlightText(formatDate(record.planningDate))}</span>
                  )}
                </div>
                <h2 className="card-title">{highlightText(`Advance Care Planning ${idx + 1}`)}</h2>
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

export default AdvanceCarePlanningDocument;
