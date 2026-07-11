import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import AnticipatoryGuidanceDocumentPDFTemplate from '../pdf-templates/AnticipatoryGuidanceDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './AnticipatoryGuidanceDocument.css';

/**
 * AnticipatoryGuidanceDocument - Inline Editing Edition
 *
 * Sections with editing:
 * 1. Guidance Information (date/provider/facility/status non-editable)
 * 2. Nutrition (array editing)
 * 3. Physical Activity (array editing)
 * 4. Screen Time (per-sentence editing)
 * 5. Sleep (nested object: dot-path simple + concerns array)
 * 6. Safety (array editing)
 * 7. Dental Care (array editing)
 * 8. Social Development (array editing)
 * 9. Toileting (per-sentence editing)
 * 10. Discipline (array editing)
 * 11. Findings (per-sentence editing)
 * 12. Assessment (per-sentence editing)
 * 13. Plan (per-sentence editing)
 * 14. Notes (per-sentence editing)
 */

// ==================== SECTION_FIELDS for per-section approve ====================
const SECTION_FIELDS = {
  guidanceInfo: ['type', 'date', 'provider', 'facility'],
  nutrition: ['nutrition'],
  physicalActivity: ['physicalActivity'],
  screenTime: ['screenTime'],
  sleep: ['sleep'],
  safety: ['safety'],
  dental: ['dental'],
  socialDevelopment: ['socialDevelopment'],
  toileting: ['toileting'],
  discipline: ['discipline'],
  findings: ['findings'],
  assessment: ['assessment'],
  plan: ['plan'],
  results: ['results'],
  recommendations: ['recommendations'],
  notes: ['notes'],
};

const NON_EDITABLE_FIELDS = ['status', 'createdAt', 'updatedAt', '_id', 'patientId'];

const OBJECT_FIELDS = ['results'];

const SENTENCE_FIELDS = ['screenTime', 'toileting', 'findings', 'assessment', 'plan', 'notes'];

const ARRAY_FIELDS = ['nutrition', 'physicalActivity', 'safety', 'dental', 'socialDevelopment', 'discipline', 'recommendations'];

// ==================== PLAIN FUNCTIONS ====================

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<=[.;])\s+/).map(s => s.trim()).filter(s => s.length > 0);
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const match = text.match(/^([A-Z][A-Za-z0-9 &/()>=<+%.#-]+):\s*(.+)$/);
  if (match) return { isLabeled: true, label: match[1].trim(), value: match[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const reconstructFullText = (sentences) => {
  return sentences.map((s, i) => {
    let trimmed = s.trim();
    if (i < sentences.length - 1 && trimmed && !/[.;!?]$/.test(trimmed)) {
      trimmed += '.';
    }
    return trimmed;
  }).filter(Boolean).join(' ');
};

const formatKey = (key) => {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
};

// ==================== OBJECT FIELD HELPERS (recursive — for results) ====================
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};

const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [editKey]: { value, payload } } }
   - editKey mirrors the file's own convention (e.g. "screenTime-0", "nutrition-0-2", "results-0").
   - payload is the EXACT PUT body to replay on Approve (handles arrayIndex + dotted object fields). */
const DRAFT_KEY = 'anticipatory_guidancePendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

// ==================== COMPONENT ====================

const AnticipatoryGuidanceDocument = ({ document: docProp }) => {
  const templateData = docProp;

  const [searchTerm, setSearchTerm] = useState('');
  const [copyAllStatus, setCopyAllStatus] = useState('idle');
  const [copiedSection, setCopiedSection] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [localEdits, setLocalEdits] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  // pdfExportStatus removed — using PDFDownloadLink (reactive)
  const textareaRef = useRef(null);

  // Format date helper
  const formatDate = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return String(dateVal);
    }
  };

  // ISO/date → YYYY-MM-DD for <input type="date"> (UTC so the stored midnight-UTC calendar day round-trips)
  const toInputDate = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().slice(0, 10);
    } catch { return ''; }
  };

  // Safe string conversion
  const safeString = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (Array.isArray(val)) return val.filter(Boolean).join(', ');
    if (typeof val === 'object') {
      if (Object.keys(val).length === 0) return '';
      return JSON.stringify(val);
    }
    return String(val);
  };

  // Unwrap document data
  let records = [];
  if (Array.isArray(templateData)) {
    records = templateData.flatMap(item => {
      if (item.anticipatory_guidance) return item.anticipatory_guidance;
      if (item.records) return item.records;
      return item;
    });
  } else if (templateData?.anticipatory_guidance) {
    records = Array.isArray(templateData.anticipatory_guidance) ? templateData.anticipatory_guidance : [templateData.anticipatory_guidance];
  } else if (templateData?.documentData?.anticipatory_guidance) {
    records = Array.isArray(templateData.documentData.anticipatory_guidance) ? templateData.documentData.anticipatory_guidance : [templateData.documentData.anticipatory_guidance];
  } else if (templateData?.documentData) {
    records = Array.isArray(templateData.documentData) ? templateData.documentData : [templateData.documentData];
  } else if (templateData && typeof templateData === 'object') {
    records = [templateData];
  }
  records = records.filter(r => r && Object.keys(r).length > 0);

  // ==================== SAFE _id EXTRACTION ====================
  const getRecordId = (record) => {
    const id = record._id;
    if (!id) return '';
    if (typeof id === 'string') return id;
    if (id.$oid) return id.$oid;
    return String(id);
  };

  // Stable signature of the record ids so the rehydrate effect only re-runs when the data changes.
  const recordsSignature = records.map(getRecordId).join('|');

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  // Maps each record's stored editKeys (display markers) using the record's render index.
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const recId = getRecordId(record);
      const recDrafts = recId ? store[recId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([editKey, entry]) => {
        if (!entry) return;
        if (entry.markerType === 'objectLeaf') {
          // Nested-object (results) leaf: localEdits holds the whole cloned object under rollupKey,
          // the rollupKey is pending (kept out of pdfData), the leafKey shows the edited badge.
          const rollup = entry.rollupKey || editKey;
          nLocal[rollup] = entry.value;
          nPending[rollup] = true;
          nFields[editKey] = 'edited';
          return;
        }
        nLocal[editKey] = entry.value;
        nPending[editKey] = true;
        // Mark the matching display state. Sentence edits are stored under the field-level editKey
        // ("field-idx") with a sentence marker so the row renders as edited.
        if (entry.markerType === 'sentence') {
          nSentences[entry.markerKey || editKey] = 'edited';
        } else {
          nFields[editKey] = 'edited';
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordsSignature]);

  // ==================== GET FIELD VALUE (with local edits) ====================
  const getFieldValue = (record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    const val = fieldName.includes('.') ? fieldName.split('.').reduce((o, k) => o?.[k], record) : record[fieldName];
    return val;
  };

  // Get array with per-item local edits applied
  const getEffectiveArray = (record, fieldName, idx) => {
    const raw = fieldName.includes('.')
      ? fieldName.split('.').reduce((o, k) => o?.[k], record)
      : record[fieldName];
    const arr = Array.isArray(raw) ? [...raw] : [];
    arr.forEach((item, itemIdx) => {
      const itemKey = `${fieldName}-${idx}-${itemIdx}`;
      if (localEdits[itemKey] !== undefined) arr[itemIdx] = localEdits[itemKey];
    });
    return arr;
  };

  // ==================== pdfData MEMO — merges localEdits into records ====================
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    // Pending drafts (saved locally, not yet approved) must stay OUT of the PDF/Copy All.
    // committedValue(editKey) returns the local edit ONLY if it has been approved.
    const isPending = (editKey) => !!pendingEdits[editKey];
    // Array merge that ignores pending item edits (committed item edits still apply).
    const committedArray = (record, fieldName, ridx) => {
      const raw = fieldName.includes('.')
        ? fieldName.split('.').reduce((o, k) => o?.[k], record)
        : record[fieldName];
      const arr = Array.isArray(raw) ? [...raw] : [];
      arr.forEach((item, itemIdx) => {
        const itemKey = `${fieldName}-${ridx}-${itemIdx}`;
        if (localEdits[itemKey] !== undefined && !isPending(itemKey)) arr[itemIdx] = localEdits[itemKey];
      });
      return arr;
    };
    return records.map((record, idx) => {
      const merged = { ...record };
      // Merge simple/sentence field edits (skip pending drafts)
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (isPending(editKey)) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldPart = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx === idx && !fieldPart.includes('-')) {
          // Simple field like 'screenTime-0' → fieldPart='screenTime', recIdx=0
          if (fieldPart.includes('.')) {
            const [parent, child] = fieldPart.split('.');
            merged[parent] = { ...(merged[parent] || {}), [child]: editVal };
          } else {
            merged[fieldPart] = editVal;
          }
        }
      }
      // Merge array item edits (committed only)
      ARRAY_FIELDS.forEach(field => {
        merged[field] = committedArray(record, field, idx);
      });
      // Merge sleep.concerns array (committed only)
      const sleepConcerns = committedArray(record, 'sleep.concerns', idx);
      if (sleepConcerns.length > 0) {
        merged.sleep = { ...(merged.sleep || {}), concerns: sleepConcerns };
      }
      // Merge sleep dot-path simple fields (committed only)
      const hrsKey = `sleep.hoursRecommended-${idx}`;
      const patKey = `sleep.currentPattern-${idx}`;
      const hrs = !isPending(hrsKey) ? getFieldValue(record, 'sleep.hoursRecommended', idx) : record.sleep?.hoursRecommended;
      const pat = !isPending(patKey) ? getFieldValue(record, 'sleep.currentPattern', idx) : record.sleep?.currentPattern;
      if (hrs !== undefined && hrs !== record.sleep?.hoursRecommended) {
        merged.sleep = { ...(merged.sleep || {}), hoursRecommended: hrs };
      }
      if (pat !== undefined && pat !== record.sleep?.currentPattern) {
        merged.sleep = { ...(merged.sleep || {}), currentPattern: pat };
      }
      return merged;
    });
  }, [records, localEdits, pendingEdits]);

  // ==================== SEARCH ====================
  const stm = (sectionTitle) => {
    if (!searchTerm.trim()) return false;
    const sl = searchTerm.toLowerCase().trim();
    const tl = (sectionTitle || '').toLowerCase().trim();
    return tl.startsWith(sl) || sl.startsWith(tl);
  };

  const shouldShowRow = (record, ...values) => {
    if (!searchTerm.trim()) return true;
    const searchLower = searchTerm.toLowerCase().trim();
    const combinedText = values.map(v => safeString(v)).filter(Boolean).join(' ').toLowerCase();
    return combinedText.includes(searchLower);
  };

  const shouldShowSection = (record, sectionTitle, ...sectionContent) => {
    if (!searchTerm.trim()) return true;
    const searchLower = searchTerm.toLowerCase().trim();
    const titleLower = (sectionTitle || '').toLowerCase();
    const contentText = sectionContent.map(v => safeString(v)).filter(Boolean).join(' ').toLowerCase();
    return `${titleLower} ${contentText}`.includes(searchLower);
  };

  const highlightText = (text) => {
    if (!text) return '';
    const textStr = String(text);
    if (!searchTerm.trim()) return textStr;
    const escapedPhrase = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedPhrase})`, 'gi');
    const parts = textStr.split(regex);
    if (parts.length === 1) return textStr;
    return (
      <>
        {parts.map((part, i) => {
          const isMatch = part.toLowerCase() === searchTerm.trim().toLowerCase();
          return isMatch ? <mark key={i}>{part}</mark> : part;
        })}
      </>
    );
  };

  const flattenObj = (obj) => {
    if (!obj || typeof obj !== 'object') return '';
    return Object.entries(obj).map(([k, v]) => {
      const label = formatKey(k);
      if (Array.isArray(v)) return `${label} ${v.map(item => typeof item === 'object' ? Object.values(item || {}).join(' ') : String(item)).join(' ')}`;
      if (v && typeof v === 'object') return `${label} ${flattenObj(v)}`;
      return `${label} ${safeString(v)}`;
    }).join(' ');
  };

  // ==================== FILTERED RECORDS ====================
  const isSearching = searchTerm.trim().length > 0;

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) {
      return records.map(record => ({ ...record, _showAllSections: false }));
    }
    const searchLower = searchTerm.toLowerCase().trim();

    return records.map((record, idx) => {
      const docTitle = `Anticipatory Guidance ${idx + 1}`;
      if (docTitle.toLowerCase().includes(searchLower)) {
        return { ...record, _showAllSections: true };
      }

      const searchableText = [
        docTitle,
        'Guidance Information', 'Nutrition', 'Physical Activity', 'Screen Time',
        'Sleep', 'Safety', 'Dental Care', 'Social Development', 'Toileting',
        'Discipline', 'Findings', 'Assessment', 'Plan', 'Results', 'Recommendations', 'Notes', 'Status',
        'Hours Recommended', 'Current Pattern', 'Concerns',
        formatDate(record.date), record.provider, record.facility,
        safeString(record.nutrition), safeString(record.physicalActivity),
        record.screenTime, flattenObj(record.sleep),
        safeString(record.safety), safeString(record.dental),
        safeString(record.socialDevelopment), record.toileting,
        safeString(record.discipline), record.findings,
        record.assessment, record.plan, safeString(record.recommendations),
        record.notes, record.status, record.type,
      ].filter(Boolean).join(' ').toLowerCase();

      return searchableText.includes(searchLower) ? { ...record, _showAllSections: false } : null;
    }).filter(Boolean);
  }, [records, searchTerm]);

  // ==================== EDITING HELPERS ====================
  const sectionHasEdits = (sectionId, idx) => {
    const fields = SECTION_FIELDS[sectionId] || [];
    for (const f of fields) {
      for (const k of Object.keys(editedSentences)) {
        if (fields.some(fld => k.startsWith(`${fld}-${idx}-s`))) return true;
      }
      for (const k of Object.keys(editedFields)) {
        if (fields.some(fld => k.startsWith(`${fld}-${idx}`))) return true;
      }
    }
    return false;
  };

  // ==================== SAVE FIELD ====================
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = (record, fieldName, idx, sectionId, arrayIndex, fullValue, editKey) => {
    const recordId = getRecordId(record);
    if (!recordId) return;
    const key = editKey || `${fieldName}-${idx}`;

    // EXACT PUT body to replay on Approve (arrayIndex only for array-element edits)
    const payload = { field: fieldName, value: fullValue };
    if (arrayIndex !== undefined && arrayIndex !== null) payload.arrayIndex = arrayIndex;

    setLocalEdits(prev => ({ ...prev, [key]: fullValue }));
    setPendingEdits(prev => ({ ...prev, [key]: true }));
    setEditedFields(prev => ({ ...prev, [key]: 'edited' }));
    // Re-edit after approval → drop the section 'approved' flag so the button returns to yellow Pending
    setApprovedSections(prev => {
      const u = { ...prev };
      delete u[`${sectionId}-${idx}`];
      return u;
    });

    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][key] = { value: fullValue, payload };
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  };

  // ==================== SAVE SENTENCE ====================
  function saveSentence(record, fieldName, idx, sectionId, sIdx, newText) {
    const currentValue = String(getFieldValue(record, fieldName, idx) || '');
    const currentSentences = splitBySentence(currentValue);
    const newSentences = splitBySentence(newText.trim());
    const allCurrent = [...currentSentences];
    allCurrent.splice(sIdx, 1, ...newSentences);
    const fullText = reconstructFullText(allCurrent);
    const extraCount = newSentences.length - 1;
    const recIdx = idx;

    if (extraCount > 0) {
      const editedMap = {};
      if (allCurrent[sIdx] !== newSentences[sIdx]) {
        editedMap[`${fieldName}-${recIdx}-s${sIdx}`] = 'edited';
      }
      for (let si = sIdx + 1; si <= sIdx + extraCount; si++) {
        editedMap[`${fieldName}-${recIdx}-s${si}`] = 'added';
      }
      setEditedSentences(prev => ({ ...prev, ...editedMap }));
    } else {
      setEditedSentences(prev => ({ ...prev, [`${fieldName}-${recIdx}-s${sIdx}`]: 'edited' }));
    }

    const editKey = `${fieldName}-${idx}`;
    handleSaveField(record, fieldName, idx, sectionId, null, fullText, editKey);
    // Tag this draft as a sentence edit so refresh restores the per-sentence 'edited' marker
    // (renderSentenceEditableField reads editedSentences, not editedFields).
    const recordId = getRecordId(record);
    if (recordId) {
      const store = readDrafts();
      if (store[recordId] && store[recordId][editKey]) {
        store[recordId][editKey].markerType = 'sentence';
        store[recordId][editKey].markerKey = `${fieldName}-${recIdx}-s${sIdx}`;
        writeDrafts(store);
      }
    }
  }

  // ==================== SAVE OBJECT LEAF (nested dot-path — results) ====================
  // Defer-save: stage the cloned object locally + persist the dotted-field PUT to the draft store.
  // Committed to MongoDB only on Approve. The whole rootField stays out of the PDF while pending.
  const saveObjectLeaf = (record, rootField, path, idx, sectionId, leafKey, newVal) => {
    const recordId = getRecordId(record);
    if (!recordId) return;
    const dottedField = `${rootField}.${path.join('.')}`;
    const rollupKey = `${rootField}-${idx}`;

    let cloneForStore;
    setLocalEdits(prev => {
      const cur = prev[rollupKey] !== undefined ? prev[rollupKey] : record[rootField];
      const clone = JSON.parse(JSON.stringify(cur ?? {}));
      let node = clone;
      for (let i = 0; i < path.length - 1; i++) {
        if (node[path[i]] === undefined || node[path[i]] === null) node[path[i]] = {};
        node = node[path[i]];
      }
      node[path[path.length - 1]] = newVal;
      cloneForStore = clone;
      return { ...prev, [rollupKey]: clone };
    });
    // Whole object pending → kept out of pdfData until Approve commits every staged leaf.
    setPendingEdits(prev => ({ ...prev, [rollupKey]: true }));
    setEditedFields(prev => ({ ...prev, [leafKey]: 'edited' }));
    setApprovedSections(prev => { const u = { ...prev }; delete u[`${sectionId}-${idx}`]; return u; });

    // Stage to localStorage: one draft entry PER leaf (replays each dotted PUT on Approve);
    // value carries the latest full cloned object so refresh restores localEdits[rollupKey].
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][leafKey] = {
      value: cloneForStore,
      rollupKey,
      payload: { field: dottedField, value: newVal },
      markerType: 'objectLeaf',
    };
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  };

  // ==================== APPROVE SECTION ====================
  // Approve = COMMIT this section's staged drafts to MongoDB (the ONLY path that writes to the DB),
  // then clear pending so the committed values flow into pdfData/PDF/Copy All.
  const handleApproveSection = useCallback(async (record, sectionId, idx) => {
    const key = `${sectionId}-${idx}`;
    const isApproved = approvedSections[key];
    if (isApproved) return;

    const recordId = getRecordId(record);
    if (!recordId) return;

    const fields = SECTION_FIELDS[sectionId] || [];
    // A staged draft belongs to this section when its editKey's field-part resolves to one of this
    // section's fields at this record index. Handles simple ("field-idx"), array ("field-idx-n"),
    // object-leaf ("field-idx-path") AND dotted sleep keys ("sleep.hoursRecommended-idx",
    // "sleep.concerns-idx-n") — the base field before the first dot must be a section field.
    const belongsToSection = (editKey) => {
      const dashIdx = editKey.indexOf(`-${idx}`);
      if (dashIdx === -1) return false;
      const after = editKey.slice(dashIdx + `-${idx}`.length);
      if (after !== '' && !after.startsWith('-')) return false; // e.g. "sleep-10" must not match idx 1
      const fieldPart = editKey.slice(0, dashIdx);
      const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
      return fields.includes(baseField);
    };

    try {
      const store = readDrafts();
      const recDrafts = store[recordId] || {};
      const draftKeys = Object.keys(recDrafts).filter(belongsToSection);
      // Persist each staged edit to the DB now (replay the exact PUT body captured on save).
      const committedRollups = new Set();
      for (const dk of draftKeys) {
        const entry = recDrafts[dk];
        if (!entry || !entry.payload) continue;
        await secureApiClient.put(`/api/edit/anticipatory_guidance/${recordId}/edit`, entry.payload);
        if (entry.rollupKey) committedRollups.add(entry.rollupKey);
      }
      // Flag the section approved (audit trail) — existing endpoint
      await secureApiClient.put(`/api/edit/anticipatory_guidance/${recordId}/approve`, {
        sectionId,
        approved: true,
      });

      // Clear pending for the committed edits → committed values now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        draftKeys.forEach(dk => {
          delete next[dk];
          const ent = recDrafts[dk];
          if (ent && ent.rollupKey) delete next[ent.rollupKey];
        });
        return next;
      });
      // Drop this section's drafts from localStorage (now committed)
      if (store[recordId]) {
        draftKeys.forEach(dk => { delete store[recordId][dk]; });
        if (Object.keys(store[recordId]).length === 0) delete store[recordId];
        writeDrafts(store);
      }

      setEditedSentences(prev => {
        const cleaned = { ...prev };
        for (const k of Object.keys(cleaned)) {
          if (fields.some(f => k.startsWith(`${f}-${idx}-s`))) delete cleaned[k];
        }
        return cleaned;
      });
      setEditedFields(prev => {
        const cleaned = { ...prev };
        for (const k of Object.keys(cleaned)) {
          if (fields.some(f => k.startsWith(`${f}-${idx}`))) delete cleaned[k];
        }
        return cleaned;
      });
      setApprovedSections(prev => ({ ...prev, [key]: true }));
    } catch (err) {
      console.error('[AnticipatoryGuidance] Approve error:', err.message);
    }
  }, [approvedSections, pendingEdits, localEdits]);

  // ==================== RENDER APPROVE BUTTON ====================
  const renderApproveBtn = (record, sectionId, idx) => {
    const key = `${sectionId}-${idx}`;
    const isApproved = approvedSections[key];
    const hasEdits = sectionHasEdits(sectionId, idx);
    if (!hasEdits && !isApproved) return null;
    return (
      <button
        className={`approve-btn ${isApproved ? 'approved' : 'pending'}`}
        onClick={() => handleApproveSection(record, sectionId, idx)}
      >
        {isApproved ? 'Approved' : 'Pending Approve'}
      </button>
    );
  };

  // ==================== RENDER EDITABLE FIELD (simple) ====================
  const renderEditableField = (record, fieldName, idx, sectionId, label, showLabel = true) => {
    const value = safeString(getFieldValue(record, fieldName, idx));
    if (!value) return null;
    const editKey = `${fieldName}-${idx}`;
    const isEditing = editingField === editKey;
    const isEdited = editedFields[editKey];

    return (
      <div className={showLabel ? 'rec-mini-card' : undefined}>
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {isEditing ? (
          <div className="edit-field-container">
            <textarea
              ref={textareaRef}
              className="edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  handleSaveField(record, fieldName, idx, sectionId, null, editValue.trim(), editKey);
                }
                if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
              }}
              autoFocus
              rows={2}
            />
            <div className="edit-actions">
              <button className="save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId, null, editValue.trim(), editKey)}>Save</button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div
            className={`numbered-row editable-row${isEdited ? ' modified' : ''}`}
            onClick={() => { setEditingField(editKey); setEditValue(value); }}
          >
            <div className="row-content">
              <span className="content-value">{highlightText(value)}</span>
              <span className="edit-indicator">&#9998;</span>
            </div>
            <button
              className={`copy-btn ${copiedSection === editKey ? 'copied' : ''}`}
              onClick={e => { e.stopPropagation(); copyToClipboard(value, editKey); }}
            >
              {copiedSection === editKey ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
        {isEdited && !isEditing && (
          <div className={`modified-badge${isEdited === 'added' ? ' added' : ''}`}>
            {isEdited === 'added' ? 'added' : 'edited'} - click Pending Approve to save
          </div>
        )}
      </div>
    );
  };

  // ==================== RENDER EDITABLE DATE FIELD (date picker) ====================
  // Defer-save: edit via <input type="date">, stage the ISO value as a draft; Approve commits it.
  const renderDateField = (record, fieldName, idx, sectionId, label = 'Date') => {
    const rawVal = getFieldValue(record, fieldName, idx);
    if (!rawVal) return null;
    const editKey = `${fieldName}-${idx}`;
    const isEditing = editingField === editKey;
    const isEdited = editedFields[editKey];
    const displayVal = formatDate(rawVal);

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {isEditing ? (
          <div className="edit-field-container">
            <input
              type="date"
              className="edit-date"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { if (editValue) handleSaveField(record, fieldName, idx, sectionId, null, `${editValue}T00:00:00.000Z`, editKey); }
                if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
              }}
              autoFocus
            />
            <div className="edit-actions">
              <button className="save-btn" onClick={() => { if (editValue) handleSaveField(record, fieldName, idx, sectionId, null, `${editValue}T00:00:00.000Z`, editKey); }}>Save</button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div
            className={`numbered-row editable-row${isEdited ? ' modified' : ''}`}
            onClick={() => { setEditingField(editKey); setEditValue(toInputDate(rawVal)); }}
          >
            <div className="row-content">
              <span className="content-value">{highlightText(displayVal)}</span>
              <span className="edit-indicator">&#9998;</span>
            </div>
            <button
              className={`copy-btn ${copiedSection === editKey ? 'copied' : ''}`}
              onClick={e => { e.stopPropagation(); copyToClipboard(displayVal, editKey); }}
            >
              {copiedSection === editKey ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
        {isEdited && !isEditing && (
          <div className="modified-badge">edited - click Pending Approve to save</div>
        )}
      </div>
    );
  };

  // ==================== RENDER EDITABLE ARRAY ITEM ====================
  const renderEditableArrayItem = (record, fieldName, idx, sectionId, itemIdx, item) => {
    const editKey = `${fieldName}-${idx}-${itemIdx}`;
    const isEditing = editingField === editKey;
    const isEdited = editedFields[editKey];
    const displayValue = localEdits[editKey] !== undefined ? localEdits[editKey] : safeString(item);

    return (
      <div key={itemIdx}>
        {isEditing ? (
          <div className="edit-field-container">
            <textarea
              ref={textareaRef}
              className="edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  handleSaveField(record, fieldName, idx, sectionId, itemIdx, editValue.trim(), editKey);
                }
                if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
              }}
              autoFocus
              rows={2}
            />
            <div className="edit-actions">
              <button className="save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId, itemIdx, editValue.trim(), editKey)}>Save</button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div
            className={`numbered-row editable-row${isEdited ? ' modified' : ''}`}
            onClick={() => { setEditingField(editKey); setEditValue(displayValue); }}
            style={{ marginBottom: '8px' }}
          >
            <div className="row-content">
              <span className="content-value">{highlightText(displayValue)}</span>
              <span className="edit-indicator">&#9998;</span>
            </div>
            <button
              className={`copy-btn ${copiedSection === editKey ? 'copied' : ''}`}
              onClick={e => { e.stopPropagation(); copyToClipboard(displayValue, editKey); }}
            >
              {copiedSection === editKey ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
        {isEdited && !isEditing && (
          <div className={`modified-badge${isEdited === 'added' ? ' added' : ''}`}>
            {isEdited === 'added' ? 'added' : 'edited'} - click Pending Approve to save
          </div>
        )}
      </div>
    );
  };

  // ==================== RENDER SENTENCE EDITABLE FIELD ====================
  const renderSentenceEditableField = (record, fieldName, idx, sectionId, label, showLabel = true) => {
    const value = String(getFieldValue(record, fieldName, idx) || '');
    if (!value.trim()) return null;
    const sentences = splitBySentence(value);
    if (sentences.length <= 1) return renderEditableField(record, fieldName, idx, sectionId, label, showLabel);

    return sentences.map((sentence, sIdx) => {
      const parsed = parseLabel(sentence);
      const sentenceKey = `${fieldName}-${idx}-s${sIdx}`;
      const isEditing = editingField === sentenceKey;
      const isSentenceEdited = editedSentences[sentenceKey];

      // Per-sentence search filtering
      if (searchTerm && !record._showAllSections && !stm(label)) {
        const sentenceText = parsed.isLabeled ? `${parsed.label} ${parsed.value}` : sentence;
        if (!shouldShowRow(record, sentenceText)) return null;
      }

      const displayText = parsed.isLabeled ? parsed.value : sentence;
      const editText = sentence.replace(/[.;]\s*$/, '');

      if (isEditing) {
        return (
          <div key={sIdx} className="rec-mini-card">
            {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
            <div className="edit-field-container">
              <textarea
                ref={textareaRef}
                className="edit-textarea"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    saveSentence(record, fieldName, idx, sectionId, sIdx, editValue);
                  }
                  if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                }}
                autoFocus
                rows={2}
              />
              <div className="edit-actions">
                <button className="save-btn" onClick={() => saveSentence(record, fieldName, idx, sectionId, sIdx, editValue)}>Save</button>
                <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div key={sIdx} className="rec-mini-card">
          {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
          <div
            className={`numbered-row editable-row${isSentenceEdited ? ' modified' : ''}`}
            onClick={() => { setEditingField(sentenceKey); setEditValue(editText); }}
          >
            <div className="row-content">
              <span className="content-value">{highlightText(displayText)}</span>
              <span className="edit-indicator">&#9998;</span>
            </div>
            <button
              className={`copy-btn ${copiedSection === sentenceKey ? 'copied' : ''}`}
              onClick={e => { e.stopPropagation(); copyToClipboard(sentence, sentenceKey); }}
            >
              {copiedSection === sentenceKey ? 'Copied' : 'Copy'}
            </button>
          </div>
          {isSentenceEdited && (
            <div className={`modified-badge${isSentenceEdited === 'added' ? ' added' : ''}`}>
              {isSentenceEdited === 'added' ? 'added' : 'edited'} - click Pending Approve to save
            </div>
          )}
        </div>
      );
    });
  };

  // ==================== RENDER OBJECT LEAF / NODE / FIELD (recursive — results) ====================
  const renderObjectLeaf = (record, rootField, path, idx, sectionId, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        {isEditing ? (
          <div className="edit-field-container">
            <textarea
              ref={textareaRef}
              className="edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && e.ctrlKey) { saveObjectLeaf(record, rootField, path, idx, sectionId, leafKey, editValue.trim()); }
                if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
              }}
              autoFocus
              rows={2}
            />
            <div className="edit-actions">
              <button className="save-btn" onClick={() => saveObjectLeaf(record, rootField, path, idx, sectionId, leafKey, editValue.trim())}>Save</button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div
            className={`numbered-row editable-row${isModified ? ' modified' : ''}`}
            onClick={() => { setEditingField(leafKey); setEditValue(leafValueString); }}
          >
            <div className="row-content">
              <span className="content-value">{highlightText(leafValueString)}</span>
              <span className="edit-indicator">&#9998;</span>
            </div>
            <button
              className={`copy-btn ${copiedSection === leafKey ? 'copied' : ''}`}
              onClick={e => { e.stopPropagation(); copyToClipboard(`${humanizeKey(path[path.length - 1])}\n${leafValueString}`, leafKey); }}
            >
              {copiedSection === leafKey ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
        {isModified && !isEditing && (
          <div className="modified-badge">edited - click Pending Approve to save</div>
        )}
      </div>
    );
  };

  const renderObjectNode = (record, rootField, idx, sectionId, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sectionId, value);
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && <div className={labelClass}>{highlightText(label)}</div>}
        <div className="nested-group">
          {entries.map(([k, v]) => (
            isScalar(v)
              ? renderObjectLeaf(record, rootField, [...path, k], idx, sectionId, v)
              : <div className="nested-mini-card" key={k}>{renderObjectNode(record, rootField, idx, sectionId, humanizeKey(k), v, [...path, k], depth + 1)}</div>
          ))}
        </div>
      </React.Fragment>
    );
  };

  const renderObjectField = (record, fieldName, idx, sectionId) => {
    const val = getFieldValue(record, fieldName, idx);
    if (isEmptyDeep(val) || isScalar(val)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div className="rec-mini-card">
        {entries.map(([k, v]) => (
          isScalar(v)
            ? renderObjectLeaf(record, fieldName, [k], idx, sectionId, v)
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fieldName, idx, sectionId, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    );
  };

  // recursive object → copy lines
  const objectCopyLines = (label, value, indent) => {
    const pad = '  '.repeat(indent); const out = [];
    if (isEmptyDeep(value)) return out;
    if (isScalar(value)) { out.push(`${pad}${label ? label + ': ' : ''}${fmtScalar(value)}`); return out; }
    if (label) out.push(`${pad}${label}:`);
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectCopyLines(humanizeKey(k), v, indent + (label ? 1 : 0))));
    return out;
  };

  // ==================== COPY HELPERS ====================
  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(id);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const formatSentenceFieldLines = (text) => {
    const sentences = splitBySentence(text);
    const lines = [];
    let n = 1;
    sentences.forEach(s => {
      lines.push(`${n++}. ${s}`);
    });
    return lines;
  };

  const copyAllToClipboard = async () => {
    const allText = pdfData.map((record, idx) => {
      let text = `ANTICIPATORY GUIDANCE ${idx + 1}\n`;
      text += '='.repeat(50) + '\n\n';

      if (record.date || record.provider || record.facility) {
        text += 'GUIDANCE INFORMATION\n';
        if (record.date) text += `Date: ${formatDate(record.date)}\n`;
        if (record.provider) text += `Provider: ${record.provider}\n`;
        if (record.facility) text += `Facility: ${record.facility}\n`;
        text += '\n';
      }

      const arrSections = [
        { field: 'nutrition', title: 'NUTRITION' },
        { field: 'physicalActivity', title: 'PHYSICAL ACTIVITY' },
        { field: 'safety', title: 'SAFETY' },
        { field: 'dental', title: 'DENTAL CARE' },
        { field: 'socialDevelopment', title: 'SOCIAL DEVELOPMENT' },
        { field: 'discipline', title: 'DISCIPLINE' },
        { field: 'recommendations', title: 'RECOMMENDATIONS' },
      ];
      arrSections.forEach(({ field, title }) => {
        const arr = getEffectiveArray(record, field, idx);
        if (arr.length > 0) {
          text += `${title}\n`;
          arr.forEach((item, i) => { text += `${i + 1}. ${safeString(item)}\n`; });
          text += '\n';
        }
      });

      if (getFieldValue(record, 'screenTime', idx)) {
        text += 'SCREEN TIME\n';
        formatSentenceFieldLines(String(getFieldValue(record, 'screenTime', idx))).forEach(l => { text += `${l}\n`; });
        text += '\n';
      }

      const sleepHours = getFieldValue(record, 'sleep.hoursRecommended', idx) ?? record.sleep?.hoursRecommended;
      const sleepPattern = getFieldValue(record, 'sleep.currentPattern', idx) ?? record.sleep?.currentPattern;
      const sleepConcerns = getEffectiveArray(record, 'sleep.concerns', idx).length > 0
        ? getEffectiveArray(record, 'sleep.concerns', idx)
        : (record.sleep?.concerns || []);
      if (sleepHours || sleepPattern || sleepConcerns.length > 0) {
        text += 'SLEEP\n';
        if (sleepHours) text += `Hours Recommended: ${safeString(sleepHours)}\n`;
        if (sleepPattern) text += `Current Pattern: ${safeString(sleepPattern)}\n`;
        if (sleepConcerns.length > 0) {
          text += 'Concerns:\n';
          sleepConcerns.forEach((item, i) => { text += `  ${i + 1}. ${safeString(item)}\n`; });
        }
        text += '\n';
      }

      if (getFieldValue(record, 'toileting', idx)) {
        text += 'TOILETING\n';
        formatSentenceFieldLines(String(getFieldValue(record, 'toileting', idx))).forEach(l => { text += `${l}\n`; });
        text += '\n';
      }

      const sentenceFields = [
        { field: 'findings', title: 'FINDINGS' },
        { field: 'assessment', title: 'ASSESSMENT' },
        { field: 'plan', title: 'PLAN' },
      ];
      sentenceFields.forEach(({ field, title }) => {
        const val = getFieldValue(record, field, idx);
        if (val) {
          text += `${title}\n`;
          formatSentenceFieldLines(String(val)).forEach(l => { text += `${l}\n`; });
          text += '\n';
        }
      });

      const resultsVal = getFieldValue(record, 'results', idx);
      if (!isEmptyDeep(resultsVal) && !isScalar(resultsVal)) {
        text += 'RESULTS\n';
        Object.entries(resultsVal).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
          objectCopyLines(humanizeKey(k), v, 0).forEach(l => { text += `${l}\n`; });
        });
        text += '\n';
      }

      const notesVal = getFieldValue(record, 'notes', idx);
      if (notesVal) {
        text += 'NOTES\n';
        formatSentenceFieldLines(String(notesVal)).forEach(l => { text += `${l}\n`; });
        text += '\n';
      }

      if (record.status) {
        text += `STATUS\n${safeString(record.status)}\n\n`;
      }

      return text;
    }).join('\n');

    try {
      await navigator.clipboard.writeText(allText);
      setCopyAllStatus('copied');
      setTimeout(() => setCopyAllStatus('idle'), 2000);
    } catch (err) {
      console.error('Copy all failed:', err);
    }
  };

  // PDF export uses PDFDownloadLink with pdfData (reactive, auto-updates with edits)

  // ==================== RENDER ====================
  if (records.length === 0) {
    return (
      <div className="anticipatory-guidance-document">
        <div className="document-header">
          <h1 className="document-title">Anticipatory Guidance</h1>
        </div>
        <div className="no-data-message">No anticipatory guidance records found.</div>
      </div>
    );
  }

  return (
    <div className="anticipatory-guidance-document">
      {/* Header */}
      <div className="document-header">
        <h1 className="document-title">Anticipatory Guidance</h1>
        <div className="header-actions">
          <button
            className={`copy-btn ${copyAllStatus === 'copied' ? 'copied' : ''}`}
            onClick={copyAllToClipboard}
          >
            {copyAllStatus === 'copied' ? 'Copied' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<AnticipatoryGuidanceDocumentPDFTemplate document={pdfData} />}
            fileName="anticipatory-guidance.pdf"
          >
            {({ loading }) => (
              <button className="copy-btn">
                {loading ? 'Preparing...' : 'Export PDF'}
              </button>
            )}
          </PDFDownloadLink>
        </div>
        <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      </div>

      {/* Records */}
      <div className="records-container">
        {filteredRecords.map((record, idx) => {
          const showAll = record._showAllSections;
          const sleep = record.sleep;

          return (
            <div key={idx} className="record-card">
              <div className="record-header">
                <h2 className="record-title">{highlightText(`Anticipatory Guidance ${idx + 1}`)}</h2>
                {record.date && (
                  <span className="date-badge">{highlightText(formatDate(record.date))}</span>
                )}
              </div>

              {/* Guidance Information — editable (date picker + provider/facility text), defer-save-until-approve */}
              {(() => {
                const dateVal = getFieldValue(record, 'date', idx);
                const providerVal = safeString(getFieldValue(record, 'provider', idx));
                const facilityVal = safeString(getFieldValue(record, 'facility', idx));
                if (!dateVal && !providerVal && !facilityVal) return null;
                if (!showAll && isSearching && !stm('Guidance Information') &&
                    !shouldShowSection(record, 'Guidance Information',
                      formatDate(dateVal), providerVal, facilityVal)) {
                  return null;
                }

                const sectionCopyText = (() => {
                  let t = 'GUIDANCE INFORMATION\n';
                  if (dateVal) t += `Date: ${formatDate(dateVal)}\n`;
                  if (providerVal) t += `Provider: ${providerVal}\n`;
                  if (facilityVal) t += `Facility: ${facilityVal}\n`;
                  return t.trim();
                })();

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Guidance Information')}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`copy-btn ${copiedSection === `info-${idx}` ? 'copied' : ''}`}
                            onClick={() => copyToClipboard(sectionCopyText, `info-${idx}`)}
                          >
                            {copiedSection === `info-${idx}` ? 'Copied' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, 'guidanceInfo', idx)}
                        </div>
                      </div>
                      {dateVal && (showAll || stm('Guidance Information') || shouldShowRow(record, 'Date', formatDate(dateVal))) &&
                        renderDateField(record, 'date', idx, 'guidanceInfo', 'Date')}
                      {providerVal && (showAll || stm('Guidance Information') || shouldShowRow(record, 'Provider', providerVal)) &&
                        renderEditableField(record, 'provider', idx, 'guidanceInfo', 'Provider')}
                      {facilityVal && (showAll || stm('Guidance Information') || shouldShowRow(record, 'Facility', facilityVal)) &&
                        renderEditableField(record, 'facility', idx, 'guidanceInfo', 'Facility')}
                    </div>
                  </div>
                );
              })()}

              {/* Array Sections: Nutrition, Physical Activity, Safety, Dental, Social Development, Discipline */}
              {[
                { field: 'nutrition', title: 'Nutrition', sectionId: 'nutrition' },
                { field: 'physicalActivity', title: 'Physical Activity', sectionId: 'physicalActivity' },
                { field: 'safety', title: 'Safety', sectionId: 'safety' },
                { field: 'dental', title: 'Dental Care', sectionId: 'dental' },
                { field: 'socialDevelopment', title: 'Social Development', sectionId: 'socialDevelopment' },
                { field: 'discipline', title: 'Discipline', sectionId: 'discipline' },
              ].map(({ field, title, sectionId }) => {
                const arr = getEffectiveArray(record, field, idx);
                if (arr.length === 0) return null;

                if (!showAll && isSearching && !stm(title) &&
                    !shouldShowSection(record, title, safeString(arr))) {
                  return null;
                }

                const sectionCopyText = (() => {
                  let t = `${title.toUpperCase()}\n`;
                  arr.forEach((item, i) => { t += `${i + 1}. ${safeString(item)}\n`; });
                  return t.trim();
                })();

                return (
                  <div key={field} className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText(title)}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`copy-btn ${copiedSection === `${field}-${idx}` ? 'copied' : ''}`}
                            onClick={() => copyToClipboard(sectionCopyText, `${field}-${idx}`)}
                          >
                            {copiedSection === `${field}-${idx}` ? 'Copied' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, sectionId, idx)}
                        </div>
                      </div>
                      {arr.map((item, itemIdx) => {
                        if (!showAll && isSearching && !stm(title) && !shouldShowRow(record, item)) {
                          return null;
                        }
                        return renderEditableArrayItem(record, field, idx, sectionId, itemIdx, item);
                      }).filter(Boolean)}
                    </div>
                  </div>
                );
              })}

              {/* Screen Time — sentence editing */}
              {(() => {
                const val = getFieldValue(record, 'screenTime', idx);
                if (!val) return null;
                if (!showAll && isSearching && !stm('Screen Time') &&
                    !shouldShowSection(record, 'Screen Time', val)) {
                  return null;
                }

                const sectionCopyText = (() => {
                  let t = 'SCREEN TIME\n';
                  formatSentenceFieldLines(String(val)).forEach(l => { t += `${l}\n`; });
                  return t.trim();
                })();

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Screen Time')}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`copy-btn ${copiedSection === `screenTime-${idx}` ? 'copied' : ''}`}
                            onClick={() => copyToClipboard(sectionCopyText, `screenTime-${idx}`)}
                          >
                            {copiedSection === `screenTime-${idx}` ? 'Copied' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, 'screenTime', idx)}
                        </div>
                      </div>
                      {renderSentenceEditableField(record, 'screenTime', idx, 'screenTime', 'Screen Time', false)}
                    </div>
                  </div>
                );
              })()}

              {/* Sleep — nested object */}
              {sleep && (sleep.hoursRecommended || sleep.currentPattern || sleep.concerns?.length > 0) && (() => {
                if (!showAll && isSearching && !stm('Sleep') &&
                    !shouldShowSection(record, 'Sleep', flattenObj(sleep))) {
                  return null;
                }

                const sectionCopyText = (() => {
                  let t = 'SLEEP\n';
                  const hrs = getFieldValue(record, 'sleep.hoursRecommended', idx) ?? sleep.hoursRecommended;
                  const pat = getFieldValue(record, 'sleep.currentPattern', idx) ?? sleep.currentPattern;
                  const conc = getEffectiveArray(record, 'sleep.concerns', idx).length > 0
                    ? getEffectiveArray(record, 'sleep.concerns', idx) : (sleep.concerns || []);
                  if (hrs) t += `Hours Recommended: ${safeString(hrs)}\n`;
                  if (pat) t += `Current Pattern: ${safeString(pat)}\n`;
                  if (conc.length > 0) {
                    t += 'Concerns:\n';
                    conc.forEach((item, i) => { t += `  ${i + 1}. ${safeString(item)}\n`; });
                  }
                  return t.trim();
                })();

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Sleep')}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`copy-btn ${copiedSection === `sleep-${idx}` ? 'copied' : ''}`}
                            onClick={() => copyToClipboard(sectionCopyText, `sleep-${idx}`)}
                          >
                            {copiedSection === `sleep-${idx}` ? 'Copied' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, 'sleep', idx)}
                        </div>
                      </div>
                      {sleep.hoursRecommended && (showAll || stm('Sleep') || shouldShowRow(record, 'Hours Recommended', sleep.hoursRecommended)) &&
                        renderEditableField(record, 'sleep.hoursRecommended', idx, 'sleep', 'Hours Recommended')
                      }
                      {sleep.currentPattern && (showAll || stm('Sleep') || shouldShowRow(record, 'Current Pattern', sleep.currentPattern)) &&
                        renderEditableField(record, 'sleep.currentPattern', idx, 'sleep', 'Current Pattern')
                      }
                      {sleep.concerns?.length > 0 && (showAll || stm('Sleep') || shouldShowRow(record, 'Concerns', safeString(sleep.concerns))) && (
                        <div className="rec-mini-card">
                          <div className="nested-subtitle">{highlightText('Concerns')}</div>
                          {sleep.concerns.map((item, itemIdx) => {
                            if (!showAll && isSearching && !stm('Sleep') && !shouldShowRow(record, 'Concerns', item)) {
                              return null;
                            }
                            return renderEditableArrayItem(record, 'sleep.concerns', idx, 'sleep', itemIdx, item);
                          }).filter(Boolean)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Toileting — sentence editing */}
              {(() => {
                const val = getFieldValue(record, 'toileting', idx);
                if (!val) return null;
                if (!showAll && isSearching && !stm('Toileting') &&
                    !shouldShowSection(record, 'Toileting', val)) {
                  return null;
                }

                const sectionCopyText = (() => {
                  let t = 'TOILETING\n';
                  formatSentenceFieldLines(String(val)).forEach(l => { t += `${l}\n`; });
                  return t.trim();
                })();

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Toileting')}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`copy-btn ${copiedSection === `toileting-${idx}` ? 'copied' : ''}`}
                            onClick={() => copyToClipboard(sectionCopyText, `toileting-${idx}`)}
                          >
                            {copiedSection === `toileting-${idx}` ? 'Copied' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, 'toileting', idx)}
                        </div>
                      </div>
                      {renderSentenceEditableField(record, 'toileting', idx, 'toileting', 'Toileting', false)}
                    </div>
                  </div>
                );
              })()}

              {/* Sentence Fields: Findings, Assessment, Plan */}
              {[
                { field: 'findings', title: 'Findings', sectionId: 'findings' },
                { field: 'assessment', title: 'Assessment', sectionId: 'assessment' },
                { field: 'plan', title: 'Plan', sectionId: 'plan' },
              ].map(({ field, title, sectionId }) => {
                const val = getFieldValue(record, field, idx);
                if (!val) return null;
                if (!showAll && isSearching && !stm(title) &&
                    !shouldShowSection(record, title, val)) {
                  return null;
                }

                const sectionCopyText = (() => {
                  let t = `${title.toUpperCase()}\n`;
                  formatSentenceFieldLines(String(val)).forEach(l => { t += `${l}\n`; });
                  return t.trim();
                })();

                return (
                  <div key={field} className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText(title)}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`copy-btn ${copiedSection === `${field}-${idx}` ? 'copied' : ''}`}
                            onClick={() => copyToClipboard(sectionCopyText, `${field}-${idx}`)}
                          >
                            {copiedSection === `${field}-${idx}` ? 'Copied' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, sectionId, idx)}
                        </div>
                      </div>
                      {renderSentenceEditableField(record, field, idx, sectionId, title, false)}
                    </div>
                  </div>
                );
              })}

              {/* Results — nested object (recursive) */}
              {(() => {
                const val = getFieldValue(record, 'results', idx);
                if (isEmptyDeep(val) || isScalar(val)) return null;
                if (!showAll && isSearching && !stm('Results') &&
                    !shouldShowSection(record, 'Results', flattenSearchable(val))) {
                  return null;
                }

                const sectionCopyText = (() => {
                  let t = 'RESULTS\n';
                  Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
                    objectCopyLines(humanizeKey(k), v, 0).forEach(l => { t += `${l}\n`; });
                  });
                  return t.trim();
                })();

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Results')}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`copy-btn ${copiedSection === `results-${idx}` ? 'copied' : ''}`}
                            onClick={() => copyToClipboard(sectionCopyText, `results-${idx}`)}
                          >
                            {copiedSection === `results-${idx}` ? 'Copied' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, 'results', idx)}
                        </div>
                      </div>
                      {renderObjectField(record, 'results', idx, 'results')}
                    </div>
                  </div>
                );
              })()}

              {/* Recommendations — array editing */}
              {(() => {
                const arr = getEffectiveArray(record, 'recommendations', idx);
                if (arr.length === 0) return null;
                if (!showAll && isSearching && !stm('Recommendations') &&
                    !shouldShowSection(record, 'Recommendations', safeString(arr))) {
                  return null;
                }

                const sectionCopyText = (() => {
                  let t = 'RECOMMENDATIONS\n';
                  arr.forEach((item, i) => { t += `${i + 1}. ${safeString(item)}\n`; });
                  return t.trim();
                })();

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Recommendations')}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`copy-btn ${copiedSection === `recommendations-${idx}` ? 'copied' : ''}`}
                            onClick={() => copyToClipboard(sectionCopyText, `recommendations-${idx}`)}
                          >
                            {copiedSection === `recommendations-${idx}` ? 'Copied' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, 'recommendations', idx)}
                        </div>
                      </div>
                      {arr.map((item, itemIdx) => {
                        if (!showAll && isSearching && !stm('Recommendations') && !shouldShowRow(record, item)) {
                          return null;
                        }
                        return renderEditableArrayItem(record, 'recommendations', idx, 'recommendations', itemIdx, item);
                      }).filter(Boolean)}
                    </div>
                  </div>
                );
              })()}

              {/* Notes — sentence editing */}
              {(() => {
                const val = getFieldValue(record, 'notes', idx);
                if (!val) return null;
                if (!showAll && isSearching && !stm('Notes') &&
                    !shouldShowSection(record, 'Notes', val)) {
                  return null;
                }

                const sectionCopyText = (() => {
                  let t = 'NOTES\n';
                  formatSentenceFieldLines(String(val)).forEach(l => { t += `${l}\n`; });
                  return t.trim();
                })();

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Notes')}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`copy-btn ${copiedSection === `notes-${idx}` ? 'copied' : ''}`}
                            onClick={() => copyToClipboard(sectionCopyText, `notes-${idx}`)}
                          >
                            {copiedSection === `notes-${idx}` ? 'Copied' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, 'notes', idx)}
                        </div>
                      </div>
                      {renderSentenceEditableField(record, 'notes', idx, 'notes', 'Notes', false)}
                    </div>
                  </div>
                );
              })()}

              {/* Status — non-editable simple string */}
              {record.status && (() => {
                if (!showAll && isSearching && !stm('Status') &&
                    !shouldShowSection(record, 'Status', record.status)) {
                  return null;
                }
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Status')}</h3>
                        <button
                          className={`copy-btn ${copiedSection === `status-${idx}` ? 'copied' : ''}`}
                          onClick={() => copyToClipboard(safeString(record.status), `status-${idx}`)}
                        >
                          {copiedSection === `status-${idx}` ? 'Copied' : 'Copy Section'}
                        </button>
                      </div>
                      <div className="rec-mini-card">
                        <div className="numbered-row">
                          <div className="row-content">
                            <span className="content-value">{highlightText(safeString(record.status))}</span>
                          </div>
                        </div>
                      </div>
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

export default AnticipatoryGuidanceDocument;
