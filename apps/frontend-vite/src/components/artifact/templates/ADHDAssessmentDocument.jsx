import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import ADHDAssessmentDocumentPDFTemplate from '../pdf-templates/ADHDAssessmentDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './ADHDAssessmentDocument.css';

/**
 * ADHDAssessmentDocument
 * Template for ADHD assessment records with inline editing
 *
 * Features:
 * - 4-level search with EXACT PHRASE matching
 * - Mini-card pattern with wrapped section titles
 * - Per-sentence editing for text fields
 * - Per-item editing for array fields
 * - Per-section approve (yellow→green)
 * - Copy Section / Copy All / Export PDF
 *
 * Created: December 2025
 * Updated: March 2026 — inline editing
 */

// Section → editable fields mapping (date editable via date picker)
const SECTION_FIELDS = {
  'info': ['date', 'provider', 'facility', 'screeningTool'],
  'parent': ['parentForm.inattentionScore', 'parentForm.hyperactivityScore', 'parentForm.oppositionalDefiantScore', 'parentForm.conductDisorderScore'],
  'teacher': ['teacherForm.classroomBehavior'],
  'symptoms': ['symptoms.duration', 'symptoms.onsetAge', 'symptoms.settings', 'symptoms.functionalImpairment'],
  'dsm': ['dsmCriteriaMet'],
  'clinical': ['differentialDiagnosis', 'comorbidities', 'familyHistory'],
  'rec': ['recommendations'],
  'findings': ['findings'],
  'results': ['results'],
  'assessmentPlan': ['assessment', 'plan'],
  'notes': ['notes'],
};

// Text fields that use per-sentence editing
const SENTENCE_FIELDS = ['teacherForm.classroomBehavior', 'findings', 'assessment', 'plan', 'notes'];

// humanizeKey — converts camelCase / snake_case keys to Title Case labels (for results object)
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// isScalar / isEmptyDeep / fmtScalar — recursive object helpers (for results object)
const isScalar = (v) => v === null || typeof v !== 'object';
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

// Array fields (arrays of strings)
const ARRAY_FIELDS = ['differentialDiagnosis', 'comorbidities', 'familyHistory', 'recommendations', 'symptoms.settings', 'symptoms.functionalImpairment'];

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the dotted field path, e.g. "findings" or "parentForm.inattentionScore") */
const DRAFT_KEY = 'adhd_assessmentPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const ADHDAssessmentDocument = ({ document, data }) => {
  const templateData = document || data;

  // Display state
  const [searchTerm, setSearchTerm] = useState('');
  const [copyAllStatus, setCopyAllStatus] = useState('idle');
  const [copiedRowId, setCopiedRowId] = useState(null);
  const [copiedSectionId, setCopiedSectionId] = useState(null);

  // Editing state (Step 4b)
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

  // canEdit is ALWAYS true (Step 4o)
  const canEdit = true;

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const formatDate = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal.$date || dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return String(dateVal);
    }
  };

  // YYYY-MM-DD for the native date <input> value.
  const formatDateISO = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal.$date || dateVal);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

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

  const hasValue = (val) => {
    if (val === null || val === undefined || val === '') return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'object') return Object.keys(val).length > 0;
    return true;
  };

  const splitByCommaIgnoreParentheses = (text) => {
    if (!text || typeof text !== 'string') return [];
    const result = [];
    let current = '';
    let parenDepth = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '(') { parenDepth++; current += char; }
      else if (char === ')') { parenDepth = Math.max(0, parenDepth - 1); current += char; }
      else if (char === ',' && parenDepth === 0) {
        const trimmed = current.trim();
        if (trimmed) result.push(trimmed);
        current = '';
      } else { current += char; }
    }
    const trimmed = current.trim();
    if (trimmed) result.push(trimmed);
    return result;
  };

  // splitBySentence — per checklist pattern
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

  // Navigate nested field path
  const getNestedValue = (obj, path) => {
    const parts = path.split('.');
    let val = obj;
    for (const p of parts) {
      if (val == null) return undefined;
      val = val[p];
    }
    return val;
  };

  // Get effective value: localEdits first, then record
  const getEffective = (record, fieldPath, idx) => {
    const editKey = `${fieldPath}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    return getNestedValue(record, fieldPath);
  };

  // ─── Data Unwrapping ────────────────────────────────────────────────────────

  let records = [];
  if (Array.isArray(templateData)) {
    records = templateData.flatMap(item => {
      if (item.adhd_assessment) return item.adhd_assessment;
      if (item.records) return item.records;
      return item;
    });
  } else if (templateData?.adhd_assessment) {
    records = Array.isArray(templateData.adhd_assessment) ? templateData.adhd_assessment : [templateData.adhd_assessment];
  } else if (templateData?.documentData?.adhd_assessment) {
    records = Array.isArray(templateData.documentData.adhd_assessment) ? templateData.documentData.adhd_assessment : [templateData.documentData.adhd_assessment];
  } else if (templateData?.documentData) {
    records = Array.isArray(templateData.documentData) ? templateData.documentData : [templateData.documentData];
  } else if (templateData && typeof templateData === 'object') {
    records = [templateData];
  }
  records = records.filter(r => r && Object.keys(r).length > 0);

  // Stable numbering
  const unwrappedData = useMemo(() => records.map((r, i) => ({ ...r, _originalIdx: i })), [records]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    unwrappedData.forEach((record) => {
      const idx = record._originalIdx;
      const recordId = record && (record._id?.$oid || record._id);
      const recDrafts = recordId ? store[recordId] : null;
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

  // ─── Search Functions ───────────────────────────────────────────────────────

  const shouldShowRow = (record, ...values) => {
    if (!searchTerm.trim()) return true;
    const searchPhrase = searchTerm.toLowerCase().trim().replace(/[()[\],.<>&:%\/]+/g, '');
    if (!searchPhrase) return true;
    const combinedText = values.map(v => safeString(v)).filter(Boolean).join(' ').toLowerCase().replace(/[()[\],.<>&:%\/]+/g, '');
    return combinedText.includes(searchPhrase);
  };

  const shouldShowSection = (record, sectionTitle, ...sectionContent) => {
    if (!searchTerm.trim()) return true;
    const searchPhrase = searchTerm.toLowerCase().trim().replace(/[()[\],.<>&:%\/]+/g, '');
    if (!searchPhrase) return true;
    const titleLower = (sectionTitle || '').toLowerCase();
    const contentText = sectionContent.map(v => safeString(v)).filter(Boolean).join(' ').toLowerCase().replace(/[()[\],.<>&:%\/]+/g, '');
    return `${titleLower} ${contentText}`.includes(searchPhrase);
  };

  const highlightText = (text) => {
    if (!text) return '';
    const textStr = String(text);
    if (!searchTerm.trim()) return textStr;
    const searchPhrase = searchTerm.trim();
    if (!searchPhrase) return textStr;
    const escapedPhrase = searchPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedPhrase})`, 'gi');
    const parts = textStr.split(regex);
    if (parts.length === 1) return textStr;
    return (
      <>
        {parts.map((part, i) => {
          const isMatch = part.toLowerCase() === searchPhrase.toLowerCase();
          return isMatch ? <mark key={i}>{part}</mark> : part;
        })}
      </>
    );
  };

  // ─── Filtered Records ──────────────────────────────────────────────────────

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) {
      return unwrappedData.map(record => ({ ...record, _showAllSections: false }));
    }
    const searchPhrase = searchTerm.toLowerCase().trim().replace(/[()[\],.<>&:%\/]+/g, '');
    if (!searchPhrase) {
      return unwrappedData.map(record => ({ ...record, _showAllSections: false }));
    }
    return unwrappedData.map((record, idx) => {
      const docTitle = `ADHD Assessment ${record._originalIdx + 1}`;
      const docTitleLower = docTitle.toLowerCase();
      if (docTitleLower.includes(searchPhrase) || searchPhrase.includes(docTitleLower.substring(0, searchPhrase.length))) {
        return { ...record, _showAllSections: true };
      }
      const searchableText = [
        'ADHD Assessment', docTitle,
        'Assessment Information', 'Parent Form Scores', 'Teacher Form', 'Symptoms',
        'DSM Criteria', 'Clinical Findings', 'Recommendations', 'Assessment & Plan', 'Notes',
        'Date', 'Provider', 'Facility', 'Screening Tool',
        'Inattention Score', 'Hyperactivity Score', 'Oppositional Defiant Score', 'Conduct Disorder Score',
        'Classroom Behavior', 'Duration', 'Settings', 'Onset Age', 'Functional Impairment',
        'Differential Diagnosis', 'Comorbidities', 'Family History', 'Assessment', 'Plan',
        formatDate(record.date), record.date, record.provider, record.facility, record.screeningTool,
        record.parentForm?.inattentionScore, record.parentForm?.hyperactivityScore,
        record.parentForm?.oppositionalDefiantScore, record.parentForm?.conductDisorderScore,
        record.teacherForm?.classroomBehavior,
        record.symptoms?.duration, safeString(record.symptoms?.settings),
        record.symptoms?.onsetAge, safeString(record.symptoms?.functionalImpairment),
        record.dsmCriteriaMet,
        safeString(record.differentialDiagnosis), safeString(record.comorbidities),
        safeString(record.familyHistory), safeString(record.recommendations),
        'Findings', record.findings,
        'Results', safeString(record.results),
        record.assessment, record.plan, record.notes,
      ].filter(Boolean).join(' ').toLowerCase().replace(/[()[\],.<>&:%\/]+/g, '');
      const matches = searchableText.includes(searchPhrase);
      return matches ? { ...record, _showAllSections: false } : null;
    }).filter(Boolean);
  }, [unwrappedData, searchTerm]);

  // ─── Editing Handlers ──────────────────────────────────────────────────────

  // handleStartEdit — accepts sentenceIdx (useCallback OK)
  const handleStartEdit = useCallback((fieldName, idx, currentValue, sentenceIdx = 0) => {
    const editKey = `${fieldName}-${idx}-s${sentenceIdx}`;
    setEditingField(editKey);
    const cleanValue = (currentValue || '').replace(/[.;]+$/, '').trim();
    setEditValue(cleanValue);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  // handleStartEditArray — for array items
  const handleStartEditArray = useCallback((fieldName, idx, currentValue, itemIdx) => {
    const editKey = `${fieldName}-${idx}-item-${itemIdx}`;
    setEditingField(editKey);
    setEditValue((currentValue || '').trim());
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  // handleStartEditDsm — for DSM comma-string items
  const handleStartEditDsm = useCallback((idx, currentValue, itemIdx) => {
    const editKey = `dsmCriteriaMet-${idx}-item-${itemIdx}`;
    setEditingField(editKey);
    setEditValue((currentValue || '').trim());
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
    // Re-edit after approval → drop this section's 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => { const u = { ...prev }; delete u[`${sectionId}-${idx}`]; return u; });

    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldName] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // reconstructFullText — PLAIN FUNCTION (no useCallback)
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

  // saveSentence — PLAIN FUNCTION (no useCallback)
  const saveSentence = (record, fieldName, idx, sectionId, sIdx) => {
    let editedSentence = editValue.trim();
    if (editedSentence && !/[.!?]$/.test(editedSentence)) editedSentence += '.';
    const fullEditKey = `${fieldName}-${idx}`;
    const hasFullEdit = localEdits[fullEditKey] !== undefined;
    const sourceText = hasFullEdit ? localEdits[fullEditKey] : (getNestedValue(record, fieldName) || '');
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

  // saveArrayItem — for array fields
  const saveArrayItem = (record, fieldPath, idx, sectionId, itemIdx) => {
    const newValue = editValue.trim();
    const currentArray = [...(getEffective(record, fieldPath, idx) || [])];
    currentArray[itemIdx] = newValue;
    const editTrackingKey = `${fieldPath}-${idx}-item-${itemIdx}`;
    handleSaveField(record, fieldPath, idx, sectionId, 0, currentArray, editTrackingKey);
  };

  // saveDsmItem — for DSM comma-string items
  const saveDsmItem = (record, idx, itemIdx) => {
    const newValue = editValue.trim();
    const currentStr = getEffective(record, 'dsmCriteriaMet', idx) || '';
    const items = splitByCommaIgnoreParentheses(currentStr);
    items[itemIdx] = newValue;
    const newStr = items.join(', ');
    const editTrackingKey = `dsmCriteriaMet-${idx}-item-${itemIdx}`;
    handleSaveField(record, 'dsmCriteriaMet', idx, 'dsm', 0, newStr, editTrackingKey);
  };

  // saveLeaf — for nested object leaf (results). Deep-clones object, sets value at path, saves whole object.
  const saveLeaf = (record, rootField, path, idx, sectionId, leafTrackingKey, newValue) => {
    const root = getEffective(record, rootField, idx);
    const cloned = root && typeof root === 'object' ? JSON.parse(JSON.stringify(root)) : {};
    let cursor = cloned;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (cursor[key] == null || typeof cursor[key] !== 'object') cursor[key] = {};
      cursor = cursor[key];
    }
    cursor[path[path.length - 1]] = newValue;
    handleSaveField(record, rootField, idx, sectionId, 0, cloned, leafTrackingKey);
  };

  // sectionHasEdits — checks BOTH editedSentences AND editedFields, uses approvedSections NOT statusOverrides (Step 4q)
  const sectionHasEdits = useCallback((sectionId, idx) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    if (approvedSections[`${sectionId}-${idx}`]) return false;
    return fields.some(f => {
      const hasSentenceEdits = Object.keys(editedSentences).some(key => {
        if (!key.startsWith(`${f}-${idx}-s`)) return false;
        return editedSentences[key] === 'edited' || editedSentences[key] === 'added';
      });
      const hasItemEdits = Object.keys(editedSentences).some(key => {
        if (!key.startsWith(`${f}-${idx}-item-`)) return false;
        return editedSentences[key] === 'edited';
      });
      const hasObjectEdits = Object.keys(editedFields).some(key => key.startsWith(`${f}-${idx}`));
      return hasSentenceEdits || hasItemEdits || hasObjectEdits;
    });
  }, [editedSentences, editedFields, approvedSections]);

  // Approve = COMMIT all staged drafts for this section's fields to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sectionId) => {
    const approveKey = `${sectionId}-${idx}`;
    const isCurrentlyApproved = approvedSections[approveKey];
    setApproving(true);
    try {
      const recordId = record._id?.$oid || record._id;
      if (recordId) {
        const suffix = `-${idx}`;
        const sectionFields = SECTION_FIELDS[sectionId] || [];
        // Collect this record's pending edits whose field belongs to this section
        const toCommit = Object.keys(localEdits).filter(k =>
          pendingEdits[k] && k.endsWith(suffix) && sectionFields.includes(k.slice(0, -suffix.length))
        );
        // Persist each staged field to the DB now (field, or field+arrayIndex when the trailing dot-segment is numeric)
        for (const editKey of toCommit) {
          const fieldPart = editKey.slice(0, -suffix.length); // dotted field path, e.g. "findings" or "parentForm.inattentionScore"
          const lastDot = fieldPart.lastIndexOf('.');
          const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
          const isArrayIdx = lastDot !== -1 && /^\d+$/.test(trailing);
          const payload = { field: isArrayIdx ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
          if (isArrayIdx) payload.arrayIndex = parseInt(trailing, 10);
          await secureApiClient.put(`/api/edit/adhd_assessment/${recordId}/edit`, payload);
        }
        await secureApiClient.put(`/api/edit/adhd_assessment/${recordId}/approve`, {
          sectionId, approved: !isCurrentlyApproved,
        });
        // Clear pending → committed edits now flow into pdfData/PDF
        setPendingEdits(prev => {
          const next = { ...prev };
          toCommit.forEach(k => delete next[k]);
          return next;
        });
        // Drop this record's drafts for the committed fields from localStorage (now committed)
        const store = readDrafts();
        if (store[recordId]) {
          toCommit.forEach(k => { delete store[recordId][k.slice(0, -suffix.length)]; });
          if (Object.keys(store[recordId]).length === 0) delete store[recordId];
          writeDrafts(store);
        }
      }
      setApprovedSections(prev => ({ ...prev, [approveKey]: !isCurrentlyApproved }));
      if (!isCurrentlyApproved) {
        const fields = SECTION_FIELDS[sectionId] || [];
        setEditedSentences(prev => {
          const cleaned = {};
          for (const key of Object.keys(prev)) {
            const shouldClear = fields.some(f => key.startsWith(`${f}-${idx}-`));
            if (!shouldClear) cleaned[key] = prev[key];
          }
          return cleaned;
        });
        setEditedFields(prev => {
          const cleaned = {};
          for (const key of Object.keys(prev)) {
            const shouldClear = fields.some(f => key.startsWith(`${f}-${idx}`));
            if (!shouldClear) cleaned[key] = prev[key];
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

  // ─── pdfData memo — merges localEdits into unwrappedData (Step 4n) ─────────

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
          // Handle nested fields (e.g., parentForm.inattentionScore)
          const parts = fieldName.split('.');
          if (parts.length === 1) {
            merged[fieldName] = editVal;
          } else {
            // Deep clone the nested object
            const topKey = parts[0];
            merged[topKey] = { ...(merged[topKey] || {}) };
            merged[topKey][parts[1]] = editVal;
          }
        }
      }
      return merged;
    });
  }, [unwrappedData, localEdits, pendingEdits]);

  // ─── Copy Functions ─────────────────────────────────────────────────────────

  const copyToClipboard = async (text, rowId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedRowId(rowId);
      setTimeout(() => setCopiedRowId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const copySectionToClipboard = async (text, sectionId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSectionId(sectionId);
      setTimeout(() => setCopiedSectionId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // Section text helpers
  const getAssessmentInfoText = (record, idx) => {
    let text = 'ASSESSMENT INFORMATION\n';
    if (record.date) text += `Date: ${formatDate(record.date)}\n`;
    const provider = getEffective(record, 'provider', idx);
    const facility = getEffective(record, 'facility', idx);
    const tool = getEffective(record, 'screeningTool', idx);
    if (provider) text += `Provider: ${provider}\n`;
    if (facility) text += `Facility: ${facility}\n`;
    if (tool) text += `Screening Tool: ${tool}\n`;
    return text.trim();
  };

  const getParentFormText = (record, idx) => {
    let text = 'PARENT FORM SCORES\n';
    const fields = [
      ['parentForm.inattentionScore', 'Inattention Score'],
      ['parentForm.hyperactivityScore', 'Hyperactivity Score'],
      ['parentForm.oppositionalDefiantScore', 'Oppositional Defiant Score'],
      ['parentForm.conductDisorderScore', 'Conduct Disorder Score'],
    ];
    fields.forEach(([path, label]) => {
      const val = getEffective(record, path, idx);
      if (hasValue(val)) text += `${label}: ${safeString(val)}\n`;
    });
    return text.trim();
  };

  const getTeacherFormText = (record, idx) => {
    let text = 'TEACHER FORM\n';
    const val = getEffective(record, 'teacherForm.classroomBehavior', idx);
    if (val) text += `Classroom Behavior: ${val}\n`;
    return text.trim();
  };

  const getSymptomsText = (record, idx) => {
    let text = 'SYMPTOMS\n';
    const duration = getEffective(record, 'symptoms.duration', idx);
    const settings = getEffective(record, 'symptoms.settings', idx);
    const onsetAge = getEffective(record, 'symptoms.onsetAge', idx);
    const fi = getEffective(record, 'symptoms.functionalImpairment', idx);
    if (duration) text += `Duration: ${duration}\n`;
    if (Array.isArray(settings) && settings.length > 0) text += `Settings: ${settings.join(', ')}\n`;
    if (onsetAge) text += `Onset Age: ${onsetAge}\n`;
    if (Array.isArray(fi) && fi.length > 0) {
      text += 'Functional Impairment:\n';
      fi.forEach((item, i) => { text += `  ${i + 1}. ${item}\n`; });
    }
    return text.trim();
  };

  const getClinicalFindingsText = (record, idx) => {
    let text = 'CLINICAL FINDINGS\n';
    const dd = getEffective(record, 'differentialDiagnosis', idx);
    const co = getEffective(record, 'comorbidities', idx);
    const fh = getEffective(record, 'familyHistory', idx);
    if (Array.isArray(dd) && dd.length > 0) {
      text += 'Differential Diagnosis:\n';
      dd.forEach((item, i) => { text += `  ${i + 1}. ${item}\n`; });
    }
    if (Array.isArray(co) && co.length > 0) {
      text += 'Comorbidities:\n';
      co.forEach((item, i) => { text += `  ${i + 1}. ${item}\n`; });
    }
    if (Array.isArray(fh) && fh.length > 0) {
      text += 'Family History:\n';
      fh.forEach((item, i) => { text += `  ${i + 1}. ${item}\n`; });
    }
    return text.trim();
  };

  const getRecommendationsText = (record, idx) => {
    const recs = getEffective(record, 'recommendations', idx);
    let text = 'RECOMMENDATIONS\n';
    if (Array.isArray(recs)) {
      recs.forEach((item, i) => { text += `${i + 1}. ${item}\n`; });
    }
    return text.trim();
  };

  // Flatten results object into "Label: value" copy lines (recursive)
  const objectCopyLines = (value, prefix = '') => {
    let lines = '';
    if (isScalar(value)) {
      if (!isEmptyDeep(value)) lines += `${prefix ? prefix + ': ' : ''}${fmtScalar(value)}\n`;
      return lines;
    }
    Object.entries(value).forEach(([k, v]) => {
      if (isEmptyDeep(v)) return;
      const label = `${prefix ? prefix + ' / ' : ''}${humanizeKey(k)}`;
      lines += objectCopyLines(v, label);
    });
    return lines;
  };

  const getFindingsText = (record, idx) => {
    const val = getEffective(record, 'findings', idx);
    if (!hasValue(val)) return '';
    return `FINDINGS\n${safeString(val)}`.trim();
  };

  const getResultsText = (record, idx) => {
    const val = getEffective(record, 'results', idx);
    if (!hasValue(val)) return '';
    return `RESULTS\n${objectCopyLines(val)}`.trim();
  };

  const copyAllToClipboard = async () => {
    const allText = filteredRecords.map((record, idx) => {
      const origIdx = record._originalIdx;
      let text = `ADHD ASSESSMENT ${origIdx + 1}\n${'═'.repeat(50)}\n\n`;
      text += getAssessmentInfoText(record, origIdx) + '\n\n';
      text += getParentFormText(record, origIdx) + '\n\n';
      text += getTeacherFormText(record, origIdx) + '\n\n';
      text += getSymptomsText(record, origIdx) + '\n\n';
      const dsm = getEffective(record, 'dsmCriteriaMet', origIdx);
      if (dsm) {
        text += 'DSM CRITERIA\n';
        splitByCommaIgnoreParentheses(dsm).forEach((item, i) => { text += `${i + 1}. ${item}\n`; });
        text += '\n';
      }
      text += getClinicalFindingsText(record, origIdx) + '\n\n';
      text += getRecommendationsText(record, origIdx) + '\n\n';
      const findingsText = getFindingsText(record, origIdx);
      if (findingsText) text += findingsText + '\n\n';
      const resultsText = getResultsText(record, origIdx);
      if (resultsText) text += resultsText + '\n\n';
      const ass = getEffective(record, 'assessment', origIdx);
      const pln = getEffective(record, 'plan', origIdx);
      if (ass || pln) {
        text += 'ASSESSMENT & PLAN\n';
        if (ass) text += `Assessment: ${ass}\n`;
        if (pln) text += `Plan: ${pln}\n`;
        text += '\n';
      }
      const n = getEffective(record, 'notes', origIdx);
      if (n) text += `NOTES\n${n}\n\n`;
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

  // ─── Render Helpers ─────────────────────────────────────────────────────────

  // Render approve button (below Copy Section)
  const renderApproveBtn = (record, idx, sectionId) => {
    const approveKey = `${sectionId}-${idx}`;
    const isApproved = approvedSections[approveKey];
    const hasEdits = sectionHasEdits(sectionId, idx);
    if (!hasEdits && !isApproved) return null;
    return (
      <button
        className={`approve-btn${isApproved ? ' approved' : ' pending'}`}
        onClick={() => handleApproveSection(record, idx, sectionId)}
        disabled={approving}
      >
        {approving ? 'Approving...' : isApproved ? 'Approved' : 'Pending Approve'}
      </button>
    );
  };

  // Render the Date field with a native date picker. Saves as local-noon ISO (avoids timezone day-shift).
  const renderDateField = (record, fieldPath, label, idx, sectionId, copyId) => {
    const val = getEffective(record, fieldPath, idx);
    if (!hasValue(val)) return null;
    const editKey = `${fieldPath}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const isEdited = editedSentences[editKey] === 'edited';

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {isEditing ? (
          <div className="edit-field-container">
            <input
              type="date"
              className="edit-date-input"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onFocus={e => e.target.showPicker && e.target.showPicker()}
              onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
              disabled={saving}
              autoFocus
            />
            <div className="edit-actions">
              <button
                className="save-btn"
                onClick={() => handleSaveField(record, fieldPath, idx, sectionId, 0, editValue ? new Date(`${editValue}T12:00:00`).toISOString() : '')}
                disabled={saving || !editValue}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <React.Fragment>
            <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
              <div className={`row-content${canEdit ? ' editable' : ''}`} onClick={() => { if (canEdit) { setEditingField(editKey); setEditValue(formatDateISO(val)); } }}>
                <span className="content-value">{highlightText(formatDate(val))}</span>
                {canEdit && !isEdited && <span className="edit-indicator" title="Click to edit">&#9998;</span>}
              </div>
              <button className={`copy-btn ${copiedRowId === copyId ? 'copied' : ''}`} onClick={() => copyToClipboard(formatDate(val), copyId)}>
                {copiedRowId === copyId ? 'Copied!' : 'Copy'}
              </button>
            </div>
            {isEdited && <div className="modified-badge">edited — click pending approve to save</div>}
          </React.Fragment>
        )}
      </div>
    );
  };

  // Render a simple editable field (single value, no sentence splitting)
  const renderEditableField = (record, fieldPath, label, idx, sectionId, copyId) => {
    const val = getEffective(record, fieldPath, idx);
    if (!hasValue(val)) return null;
    const editKey = `${fieldPath}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const isEdited = editedSentences[editKey] === 'edited';

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {isEditing ? (
          <div className="edit-field-container">
            <textarea
              ref={textareaRef}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleSaveField(record, fieldPath, idx, sectionId, 0);
                }
                if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
              }}
              rows={2}
              className="edit-textarea"
            />
            <div className="edit-actions">
              <button className="save-btn" onClick={() => handleSaveField(record, fieldPath, idx, sectionId, 0)} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <React.Fragment>
            <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
              <div className={`row-content${canEdit ? ' editable' : ''}`} onClick={() => canEdit && handleStartEdit(fieldPath, idx, safeString(val))}>
                <span className="content-value">{highlightText(safeString(val))}</span>
                {canEdit && !isEdited && <span className="edit-indicator" title="Click to edit">&#9998;</span>}
              </div>
              <button className={`copy-btn ${copiedRowId === copyId ? 'copied' : ''}`} onClick={() => copyToClipboard(safeString(val), copyId)}>
                {copiedRowId === copyId ? 'Copied!' : 'Copy'}
              </button>
            </div>
            {isEdited && <div className="modified-badge">edited — click pending approve to save</div>}
          </React.Fragment>
        )}
      </div>
    );
  };

  // Render sentence-editable field (per-sentence editing)
  const renderSentenceEditableField = (record, fieldPath, label, idx, sectionId, copyIdPrefix) => {
    const val = getEffective(record, fieldPath, idx);
    if (!hasValue(val)) return null;
    const sentences = splitBySentence(String(val));

    // If single sentence or empty, fall back to simple edit
    if (sentences.length <= 1) {
      return renderEditableField(record, fieldPath, label, idx, sectionId, `${copyIdPrefix}-${idx}`);
    }

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {sentences.map((sentence, sIdx) => {
          const editKey = `${fieldPath}-${idx}-s${sIdx}`;
          const isEditing = editingField === editKey;
          const isEdited = editedSentences[editKey] === 'edited' || editedSentences[editKey] === 'added';
          const badgeText = editedSentences[editKey] === 'added' ? 'added' : 'edited — click pending approve to save';

          if (isEditing) {
            return (
              <div key={sIdx} className="edit-field-container">
                <textarea
                  ref={textareaRef}
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      saveSentence(record, fieldPath, idx, sectionId, sIdx);
                    }
                    if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                  }}
                  rows={2}
                  className="edit-textarea"
                />
                <div className="edit-actions">
                  <button className="save-btn" onClick={() => saveSentence(record, fieldPath, idx, sectionId, sIdx)} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                </div>
              </div>
            );
          }

          return (
            <React.Fragment key={sIdx}>
              <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
                <div className={`row-content${canEdit ? ' editable' : ''}`} onClick={() => canEdit && handleStartEdit(fieldPath, idx, sentence, sIdx)}>
                  <span className="content-value">{highlightText(sentence)}</span>
                  {canEdit && !isEdited && <span className="edit-indicator" title="Click to edit">&#9998;</span>}
                </div>
                <button
                  className={`copy-btn ${copiedRowId === `${copyIdPrefix}-${idx}-${sIdx}` ? 'copied' : ''}`}
                  onClick={() => copyToClipboard(sentence, `${copyIdPrefix}-${idx}-${sIdx}`)}
                >
                  {copiedRowId === `${copyIdPrefix}-${idx}-${sIdx}` ? 'Copied!' : 'Copy'}
                </button>
              </div>
              {isEdited && <div className="modified-badge">{badgeText}</div>}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // Render editable array item
  const renderEditableArrayItem = (record, fieldPath, idx, sectionId, item, itemIdx, copyId) => {
    const editKey = `${fieldPath}-${idx}-item-${itemIdx}`;
    const isEditing = editingField === editKey;
    const isEdited = editedSentences[editKey] === 'edited';

    if (isEditing) {
      return (
        <div key={itemIdx} className="edit-field-container">
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                saveArrayItem(record, fieldPath, idx, sectionId, itemIdx);
              }
              if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
            }}
            rows={2}
            className="edit-textarea"
          />
          <div className="edit-actions">
            <button className="save-btn" onClick={() => saveArrayItem(record, fieldPath, idx, sectionId, itemIdx)} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
          </div>
        </div>
      );
    }

    return (
      <React.Fragment key={itemIdx}>
        <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
          <div className={`row-content${canEdit ? ' editable' : ''}`} onClick={() => canEdit && handleStartEditArray(fieldPath, idx, item, itemIdx)}>
            <span className="content-value">{highlightText(item)}</span>
            {canEdit && !isEdited && <span className="edit-indicator" title="Click to edit">&#9998;</span>}
          </div>
          <button className={`copy-btn ${copiedRowId === copyId ? 'copied' : ''}`} onClick={() => copyToClipboard(item, copyId)}>
            {copiedRowId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isEdited && <div className="modified-badge">edited — click pending approve to save</div>}
      </React.Fragment>
    );
  };

  // Render an editable object leaf (results nested scalar) — textarea editing
  const renderObjectLeaf = (record, rootField, path, idx, sectionId, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}.${path.join('.')}-${idx}-leaf`;
    const isEditing = editingField === leafKey;
    const isEdited = editedSentences[leafKey] === 'edited';
    const label = humanizeKey(path[path.length - 1]);
    const copyId = `${rootField}-${idx}-${path.join('.')}`;

    if (isEditing) {
      return (
        <div key={path[path.length - 1]} className="nested-mini-card">
          <div className="nested-subtitle sub-label">{highlightText(label)}</div>
          <div className="edit-field-container">
            <textarea
              ref={textareaRef}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { saveLeaf(record, rootField, path, idx, sectionId, leafKey, editValue.trim()); }
                if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
              }}
              rows={2}
              className="edit-textarea"
            />
            <div className="edit-actions">
              <button className="save-btn" onClick={() => saveLeaf(record, rootField, path, idx, sectionId, leafKey, editValue.trim())} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(label)}</div>
        <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
          <div className={`row-content${canEdit ? ' editable' : ''}`} onClick={() => canEdit && (setEditingField(leafKey), setEditValue(leafValueString))}>
            <span className="content-value">{highlightText(leafValueString)}</span>
            {canEdit && !isEdited && <span className="edit-indicator" title="Click to edit">&#9998;</span>}
          </div>
          <button className={`copy-btn ${copiedRowId === copyId ? 'copied' : ''}`} onClick={() => copyToClipboard(`${label}: ${leafValueString}`, copyId)}>
            {copiedRowId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isEdited && <div className="modified-badge">edited — click pending approve to save</div>}
      </div>
    );
  };

  // Render an object node recursively (results) — nested groups + leaves
  const renderObjectNode = (record, rootField, idx, sectionId, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sectionId, value);
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
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

  // Render the results object field — top-level container
  const renderResultsField = (record, fieldPath, idx, sectionId) => {
    const val = getEffective(record, fieldPath, idx);
    if (!hasValue(val) || isScalar(val)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div className="rec-mini-card">
        {entries.map(([k, v]) => (
          isScalar(v)
            ? renderObjectLeaf(record, fieldPath, [k], idx, sectionId, v)
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fieldPath, idx, sectionId, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    );
  };

  const isSearching = searchTerm.trim().length > 0;

  // ─── Empty State ────────────────────────────────────────────────────────────

  if (records.length === 0) {
    return (
      <div className="adhd-assessment-document">
        <div className="document-header">
          <h1 className="document-title">ADHD Assessment</h1>
        </div>
        <div className="no-data-message">No ADHD assessment records found.</div>
      </div>
    );
  }

  // ─── Main Render ────────────────────────────────────────────────────────────

  return (
    <div className="adhd-assessment-document">
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">ADHD Assessment</h1>
        <div className="header-actions">
          <button
            className={`copy-btn ${copyAllStatus === 'copied' ? 'copied' : ''}`}
            onClick={copyAllToClipboard}
          >
            {copyAllStatus === 'copied' ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<ADHDAssessmentDocumentPDFTemplate document={pdfData} />}
            fileName="adhd-assessment.pdf"
            className="pdf-btn"
          >
            {({ loading }) => (loading ? 'Generating...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>
        <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      </div>

      {/* Records */}
      <div className="records-container">
        {filteredRecords.map((record) => {
          const idx = record._originalIdx;
          const showAll = record._showAllSections;
          const pf = record.parentForm;
          const tf = record.teacherForm;
          const sym = record.symptoms;

          return (
            <div key={idx} className="record-card">
              <div className="record-header">
                <div className="header-top-row">
                  {record.date && (
                    <span className="date-badge">{highlightText(formatDate(record.date))}</span>
                  )}
                  {record.status && (
                    <span className={`status-badge status-${record.status}`}>{highlightText(record.status)}</span>
                  )}
                </div>
                <h2 className="record-title">{highlightText(`ADHD Assessment ${idx + 1}`)}</h2>
              </div>

              {/* ═══ Assessment Information ═══ */}
              {(record.date || record.provider || record.facility || record.screeningTool) && (() => {
                const sectionTitleMatches = isSearching && (
                  shouldShowRow(record, 'Assessment Information') ||
                  shouldShowRow(record, 'ASSESSMENT INFORMATION')
                );
                if (!showAll && isSearching && !sectionTitleMatches &&
                    !shouldShowSection(record, 'Assessment Information',
                      'Date', formatDate(record.date), record.date,
                      'Provider', getEffective(record, 'provider', idx),
                      'Facility', getEffective(record, 'facility', idx),
                      'Screening Tool', getEffective(record, 'screeningTool', idx))) {
                  return null;
                }
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Assessment Information')}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`section-copy-btn ${copiedSectionId === `info-${idx}` ? 'copied' : ''}`}
                            onClick={() => copySectionToClipboard(getAssessmentInfoText(record, idx), `info-${idx}`)}
                          >
                            {copiedSectionId === `info-${idx}` ? 'Copied!' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, idx, 'info')}
                        </div>
                      </div>
                      {/* Date — editable via native date picker */}
                      {record.date && (showAll || sectionTitleMatches || shouldShowRow(record, 'Date', formatDate(record.date), record.date)) &&
                        renderDateField(record, 'date', 'Date', idx, 'info', `date-${idx}`)}
                      {(showAll || sectionTitleMatches || shouldShowRow(record, 'Provider', getEffective(record, 'provider', idx))) &&
                        renderEditableField(record, 'provider', 'Provider', idx, 'info', `provider-${idx}`)}
                      {(showAll || sectionTitleMatches || shouldShowRow(record, 'Facility', getEffective(record, 'facility', idx))) &&
                        renderEditableField(record, 'facility', 'Facility', idx, 'info', `facility-${idx}`)}
                      {(showAll || sectionTitleMatches || shouldShowRow(record, 'Screening Tool', getEffective(record, 'screeningTool', idx))) &&
                        renderEditableField(record, 'screeningTool', 'Screening Tool', idx, 'info', `tool-${idx}`)}
                    </div>
                  </div>
                );
              })()}

              {/* ═══ Parent Form Scores ═══ */}
              {pf && (pf.inattentionScore || pf.hyperactivityScore || pf.oppositionalDefiantScore || pf.conductDisorderScore) && (() => {
                const sectionTitleMatches = isSearching && (
                  shouldShowRow(record, 'Parent Form Scores') ||
                  shouldShowRow(record, 'PARENT FORM SCORES') ||
                  shouldShowRow(record, 'Parent Form')
                );
                if (!showAll && isSearching && !sectionTitleMatches &&
                    !shouldShowSection(record, 'Parent Form Scores',
                      'Inattention Score', getEffective(record, 'parentForm.inattentionScore', idx),
                      'Hyperactivity Score', getEffective(record, 'parentForm.hyperactivityScore', idx),
                      'Oppositional Defiant Score', getEffective(record, 'parentForm.oppositionalDefiantScore', idx),
                      'Conduct Disorder Score', getEffective(record, 'parentForm.conductDisorderScore', idx))) {
                  return null;
                }
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Parent Form Scores')}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`section-copy-btn ${copiedSectionId === `parent-${idx}` ? 'copied' : ''}`}
                            onClick={() => copySectionToClipboard(getParentFormText(record, idx), `parent-${idx}`)}
                          >
                            {copiedSectionId === `parent-${idx}` ? 'Copied!' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, idx, 'parent')}
                        </div>
                      </div>
                      {(showAll || sectionTitleMatches || shouldShowRow(record, 'Inattention Score', getEffective(record, 'parentForm.inattentionScore', idx))) &&
                        renderEditableField(record, 'parentForm.inattentionScore', 'Inattention Score', idx, 'parent', `inattention-${idx}`)}
                      {(showAll || sectionTitleMatches || shouldShowRow(record, 'Hyperactivity Score', getEffective(record, 'parentForm.hyperactivityScore', idx))) &&
                        renderEditableField(record, 'parentForm.hyperactivityScore', 'Hyperactivity Score', idx, 'parent', `hyperactivity-${idx}`)}
                      {(showAll || sectionTitleMatches || shouldShowRow(record, 'Oppositional Defiant Score', getEffective(record, 'parentForm.oppositionalDefiantScore', idx))) &&
                        renderEditableField(record, 'parentForm.oppositionalDefiantScore', 'Oppositional Defiant Score', idx, 'parent', `oppositional-${idx}`)}
                      {(showAll || sectionTitleMatches || shouldShowRow(record, 'Conduct Disorder Score', getEffective(record, 'parentForm.conductDisorderScore', idx))) &&
                        renderEditableField(record, 'parentForm.conductDisorderScore', 'Conduct Disorder Score', idx, 'parent', `conduct-${idx}`)}
                    </div>
                  </div>
                );
              })()}

              {/* ═══ Teacher Form ═══ */}
              {tf && tf.classroomBehavior && (() => {
                const cbVal = getEffective(record, 'teacherForm.classroomBehavior', idx) || tf.classroomBehavior;
                const sectionTitleMatches = isSearching && (
                  shouldShowRow(record, 'Teacher Form') ||
                  shouldShowRow(record, 'TEACHER FORM')
                );
                if (!showAll && isSearching && !sectionTitleMatches &&
                    !shouldShowSection(record, 'Teacher Form', 'Classroom Behavior', cbVal)) {
                  return null;
                }
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Teacher Form')}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`section-copy-btn ${copiedSectionId === `teacher-${idx}` ? 'copied' : ''}`}
                            onClick={() => copySectionToClipboard(getTeacherFormText(record, idx), `teacher-${idx}`)}
                          >
                            {copiedSectionId === `teacher-${idx}` ? 'Copied!' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, idx, 'teacher')}
                        </div>
                      </div>
                      {(showAll || sectionTitleMatches || shouldShowRow(record, 'Classroom Behavior', cbVal)) &&
                        renderSentenceEditableField(record, 'teacherForm.classroomBehavior', 'Classroom Behavior', idx, 'teacher', 'classroom')}
                    </div>
                  </div>
                );
              })()}

              {/* ═══ Symptoms ═══ */}
              {sym && (sym.duration || sym.settings?.length > 0 || sym.onsetAge || sym.functionalImpairment?.length > 0) && (() => {
                const sectionTitleMatches = isSearching && (
                  shouldShowRow(record, 'Symptoms') ||
                  shouldShowRow(record, 'SYMPTOMS')
                );
                if (!showAll && isSearching && !sectionTitleMatches &&
                    !shouldShowSection(record, 'Symptoms',
                      'Duration', getEffective(record, 'symptoms.duration', idx),
                      'Settings', safeString(getEffective(record, 'symptoms.settings', idx)),
                      'Onset Age', getEffective(record, 'symptoms.onsetAge', idx),
                      'Functional Impairment', safeString(getEffective(record, 'symptoms.functionalImpairment', idx)))) {
                  return null;
                }
                const settingsArr = getEffective(record, 'symptoms.settings', idx) || sym.settings || [];
                const fiArr = getEffective(record, 'symptoms.functionalImpairment', idx) || sym.functionalImpairment || [];

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Symptoms')}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`section-copy-btn ${copiedSectionId === `symptoms-${idx}` ? 'copied' : ''}`}
                            onClick={() => copySectionToClipboard(getSymptomsText(record, idx), `symptoms-${idx}`)}
                          >
                            {copiedSectionId === `symptoms-${idx}` ? 'Copied!' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, idx, 'symptoms')}
                        </div>
                      </div>
                      {(showAll || sectionTitleMatches || shouldShowRow(record, 'Duration', getEffective(record, 'symptoms.duration', idx))) &&
                        renderEditableField(record, 'symptoms.duration', 'Duration', idx, 'symptoms', `duration-${idx}`)}
                      {/* Settings — array field */}
                      {Array.isArray(settingsArr) && settingsArr.length > 0 && (showAll || sectionTitleMatches || shouldShowRow(record, 'Settings', safeString(settingsArr))) && (
                        <div className="rec-mini-card">
                          <div className="nested-subtitle">{highlightText('Settings')}</div>
                          {settingsArr.map((item, itemIdx) => {
                            if (!showAll && isSearching && !sectionTitleMatches && !shouldShowRow(record, 'Settings', item)) return null;
                            return renderEditableArrayItem(record, 'symptoms.settings', idx, 'symptoms', item, itemIdx, `settings-${idx}-${itemIdx}`);
                          }).filter(Boolean)}
                        </div>
                      )}
                      {(showAll || sectionTitleMatches || shouldShowRow(record, 'Onset Age', getEffective(record, 'symptoms.onsetAge', idx))) &&
                        renderEditableField(record, 'symptoms.onsetAge', 'Onset Age', idx, 'symptoms', `onset-${idx}`)}
                      {/* Functional Impairment — array field */}
                      {Array.isArray(fiArr) && fiArr.length > 0 && (showAll || sectionTitleMatches || shouldShowRow(record, 'Functional Impairment', safeString(fiArr))) && (
                        <div className="rec-mini-card">
                          <div className="nested-subtitle">{highlightText('Functional Impairment')}</div>
                          {fiArr.map((item, itemIdx) => {
                            if (!showAll && isSearching && !sectionTitleMatches && !shouldShowRow(record, 'Functional Impairment', item)) return null;
                            return renderEditableArrayItem(record, 'symptoms.functionalImpairment', idx, 'symptoms', item, itemIdx, `impairment-${idx}-${itemIdx}`);
                          }).filter(Boolean)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ═══ DSM Criteria ═══ */}
              {(() => {
                const dsmVal = getEffective(record, 'dsmCriteriaMet', idx) || record.dsmCriteriaMet;
                if (!dsmVal) return null;
                const dsmItems = splitByCommaIgnoreParentheses(dsmVal);
                const sectionTitleMatches = isSearching && (
                  shouldShowRow(record, 'DSM Criteria') ||
                  shouldShowRow(record, 'DSM CRITERIA')
                );
                if (!showAll && isSearching && !sectionTitleMatches &&
                    !shouldShowSection(record, 'DSM Criteria', ...dsmItems)) {
                  return null;
                }
                const visibleItems = dsmItems.map((item, itemIdx) => {
                  if (!isSearching || showAll || sectionTitleMatches) return { item, itemIdx };
                  if (shouldShowRow(record, item)) return { item, itemIdx };
                  return null;
                }).filter(Boolean);

                if (visibleItems.length === 0) return null;

                const sectionCopyText = 'DSM CRITERIA\n' + dsmItems.map((item, i) => `${i + 1}. ${item}`).join('\n');

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('DSM Criteria')}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`section-copy-btn ${copiedSectionId === `dsm-${idx}` ? 'copied' : ''}`}
                            onClick={() => copySectionToClipboard(sectionCopyText, `dsm-${idx}`)}
                          >
                            {copiedSectionId === `dsm-${idx}` ? 'Copied!' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, idx, 'dsm')}
                        </div>
                      </div>
                      {visibleItems.map(({ item, itemIdx }) => {
                        const editKey = `dsmCriteriaMet-${idx}-item-${itemIdx}`;
                        const isEditingItem = editingField === editKey;
                        const isItemEdited = editedSentences[editKey] === 'edited';

                        if (isEditingItem) {
                          return (
                            <div key={itemIdx} className="edit-field-container">
                              <textarea
                                ref={textareaRef}
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { saveDsmItem(record, idx, itemIdx); }
                                  if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                                }}
                                rows={2}
                                className="edit-textarea"
                              />
                              <div className="edit-actions">
                                <button className="save-btn" onClick={() => saveDsmItem(record, idx, itemIdx)} disabled={saving}>
                                  {saving ? 'Saving...' : 'Save'}
                                </button>
                                <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <React.Fragment key={itemIdx}>
                            <div className={`numbered-row${isItemEdited ? ' modified' : ''}`}>
                              <div className={`row-content${canEdit ? ' editable' : ''}`} onClick={() => canEdit && handleStartEditDsm(idx, item, itemIdx)}>
                                <span className="content-value">{highlightText(item)}</span>
                                {canEdit && !isItemEdited && <span className="edit-indicator" title="Click to edit">&#9998;</span>}
                              </div>
                              <button
                                className={`copy-btn ${copiedRowId === `dsm-${idx}-${itemIdx}` ? 'copied' : ''}`}
                                onClick={() => copyToClipboard(item, `dsm-${idx}-${itemIdx}`)}
                              >
                                {copiedRowId === `dsm-${idx}-${itemIdx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                            {isItemEdited && <div className="modified-badge">edited — click pending approve to save</div>}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* ═══ Clinical Findings ═══ */}
              {(() => {
                const dd = getEffective(record, 'differentialDiagnosis', idx) || record.differentialDiagnosis || [];
                const co = getEffective(record, 'comorbidities', idx) || record.comorbidities || [];
                const fh = getEffective(record, 'familyHistory', idx) || record.familyHistory || [];
                if (!(Array.isArray(dd) && dd.length > 0) && !(Array.isArray(co) && co.length > 0) && !(Array.isArray(fh) && fh.length > 0)) return null;

                const sectionTitleMatches = isSearching && (
                  shouldShowRow(record, 'Clinical Findings') ||
                  shouldShowRow(record, 'CLINICAL FINDINGS')
                );
                if (!showAll && isSearching && !sectionTitleMatches &&
                    !shouldShowSection(record, 'Clinical Findings',
                      'Differential Diagnosis', safeString(dd),
                      'Comorbidities', safeString(co),
                      'Family History', safeString(fh))) {
                  return null;
                }
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Clinical Findings')}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`section-copy-btn ${copiedSectionId === `clinical-${idx}` ? 'copied' : ''}`}
                            onClick={() => copySectionToClipboard(getClinicalFindingsText(record, idx), `clinical-${idx}`)}
                          >
                            {copiedSectionId === `clinical-${idx}` ? 'Copied!' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, idx, 'clinical')}
                        </div>
                      </div>
                      {/* Differential Diagnosis */}
                      {Array.isArray(dd) && dd.length > 0 && (showAll || sectionTitleMatches || shouldShowRow(record, 'Differential Diagnosis', safeString(dd))) && (
                        <div className="rec-mini-card">
                          <div className="nested-subtitle">{highlightText('Differential Diagnosis')}</div>
                          {dd.map((item, itemIdx) => {
                            if (!showAll && isSearching && !sectionTitleMatches && !shouldShowRow(record, 'Differential Diagnosis', item)) return null;
                            return renderEditableArrayItem(record, 'differentialDiagnosis', idx, 'clinical', item, itemIdx, `diff-${idx}-${itemIdx}`);
                          }).filter(Boolean)}
                        </div>
                      )}
                      {/* Comorbidities */}
                      {Array.isArray(co) && co.length > 0 && (showAll || sectionTitleMatches || shouldShowRow(record, 'Comorbidities', safeString(co))) && (
                        <div className="rec-mini-card">
                          <div className="nested-subtitle">{highlightText('Comorbidities')}</div>
                          {co.map((item, itemIdx) => {
                            if (!showAll && isSearching && !sectionTitleMatches && !shouldShowRow(record, 'Comorbidities', item)) return null;
                            return renderEditableArrayItem(record, 'comorbidities', idx, 'clinical', item, itemIdx, `comorb-${idx}-${itemIdx}`);
                          }).filter(Boolean)}
                        </div>
                      )}
                      {/* Family History */}
                      {Array.isArray(fh) && fh.length > 0 && (showAll || sectionTitleMatches || shouldShowRow(record, 'Family History', safeString(fh))) && (
                        <div className="rec-mini-card">
                          <div className="nested-subtitle">{highlightText('Family History')}</div>
                          {fh.map((item, itemIdx) => {
                            if (!showAll && isSearching && !sectionTitleMatches && !shouldShowRow(record, 'Family History', item)) return null;
                            return renderEditableArrayItem(record, 'familyHistory', idx, 'clinical', item, itemIdx, `family-${idx}-${itemIdx}`);
                          }).filter(Boolean)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ═══ Recommendations ═══ */}
              {(() => {
                const recs = getEffective(record, 'recommendations', idx) || record.recommendations || [];
                if (!(Array.isArray(recs) && recs.length > 0)) return null;
                const sectionTitleMatches = isSearching && (
                  shouldShowRow(record, 'Recommendations') ||
                  shouldShowRow(record, 'RECOMMENDATIONS')
                );
                if (!showAll && isSearching && !sectionTitleMatches &&
                    !shouldShowSection(record, 'Recommendations', safeString(recs))) {
                  return null;
                }
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Recommendations')}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`section-copy-btn ${copiedSectionId === `rec-${idx}` ? 'copied' : ''}`}
                            onClick={() => copySectionToClipboard(getRecommendationsText(record, idx), `rec-${idx}`)}
                          >
                            {copiedSectionId === `rec-${idx}` ? 'Copied!' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, idx, 'rec')}
                        </div>
                      </div>
                      {recs.map((item, itemIdx) => {
                        if (!showAll && isSearching && !sectionTitleMatches && !shouldShowRow(record, item)) return null;
                        return renderEditableArrayItem(record, 'recommendations', idx, 'rec', item, itemIdx, `rec-${idx}-${itemIdx}`);
                      }).filter(Boolean)}
                    </div>
                  </div>
                );
              })()}

              {/* ═══ Findings ═══ */}
              {(() => {
                const findingsVal = getEffective(record, 'findings', idx) || record.findings;
                if (!hasValue(findingsVal)) return null;
                const sectionTitleMatches = isSearching && (
                  shouldShowRow(record, 'Findings') ||
                  shouldShowRow(record, 'FINDINGS')
                );
                if (!showAll && isSearching && !sectionTitleMatches &&
                    !shouldShowSection(record, 'Findings', findingsVal)) {
                  return null;
                }
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Findings')}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`section-copy-btn ${copiedSectionId === `findings-${idx}` ? 'copied' : ''}`}
                            onClick={() => copySectionToClipboard(getFindingsText(record, idx), `findings-${idx}`)}
                          >
                            {copiedSectionId === `findings-${idx}` ? 'Copied!' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, idx, 'findings')}
                        </div>
                      </div>
                      {(showAll || sectionTitleMatches || shouldShowRow(record, 'Findings', findingsVal)) &&
                        renderSentenceEditableField(record, 'findings', 'Findings', idx, 'findings', 'findingsval')}
                    </div>
                  </div>
                );
              })()}

              {/* ═══ Results ═══ */}
              {(() => {
                const resultsVal = getEffective(record, 'results', idx) || record.results;
                if (!hasValue(resultsVal) || isScalar(resultsVal)) return null;
                const sectionTitleMatches = isSearching && (
                  shouldShowRow(record, 'Results') ||
                  shouldShowRow(record, 'RESULTS')
                );
                if (!showAll && isSearching && !sectionTitleMatches &&
                    !shouldShowSection(record, 'Results', safeString(resultsVal))) {
                  return null;
                }
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Results')}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`section-copy-btn ${copiedSectionId === `results-${idx}` ? 'copied' : ''}`}
                            onClick={() => copySectionToClipboard(getResultsText(record, idx), `results-${idx}`)}
                          >
                            {copiedSectionId === `results-${idx}` ? 'Copied!' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, idx, 'results')}
                        </div>
                      </div>
                      {renderResultsField(record, 'results', idx, 'results')}
                    </div>
                  </div>
                );
              })()}

              {/* ═══ Assessment & Plan ═══ */}
              {(record.assessment || record.plan) && (() => {
                const assVal = getEffective(record, 'assessment', idx) || record.assessment;
                const planVal = getEffective(record, 'plan', idx) || record.plan;
                const sectionTitleMatches = isSearching && (
                  shouldShowRow(record, 'Assessment & Plan') ||
                  shouldShowRow(record, 'ASSESSMENT & PLAN') ||
                  shouldShowRow(record, 'Assessment') ||
                  shouldShowRow(record, 'Plan')
                );
                if (!showAll && isSearching && !sectionTitleMatches &&
                    !shouldShowSection(record, 'Assessment & Plan', 'Assessment', assVal, 'Plan', planVal)) {
                  return null;
                }
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Assessment & Plan')}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`section-copy-btn ${copiedSectionId === `ap-${idx}` ? 'copied' : ''}`}
                            onClick={() => copySectionToClipboard(`ASSESSMENT & PLAN\nAssessment: ${assVal || ''}\nPlan: ${planVal || ''}`, `ap-${idx}`)}
                          >
                            {copiedSectionId === `ap-${idx}` ? 'Copied!' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, idx, 'assessmentPlan')}
                        </div>
                      </div>
                      {(showAll || sectionTitleMatches || shouldShowRow(record, 'Assessment', assVal)) &&
                        renderSentenceEditableField(record, 'assessment', 'Assessment', idx, 'assessmentPlan', 'assessmentval')}
                      {(showAll || sectionTitleMatches || shouldShowRow(record, 'Plan', planVal)) &&
                        renderSentenceEditableField(record, 'plan', 'Plan', idx, 'assessmentPlan', 'planval')}
                    </div>
                  </div>
                );
              })()}

              {/* ═══ Notes ═══ */}
              {(() => {
                const notesVal = getEffective(record, 'notes', idx) || record.notes;
                if (!notesVal) return null;
                const sectionTitleMatches = isSearching && (
                  shouldShowRow(record, 'Notes') ||
                  shouldShowRow(record, 'NOTES')
                );
                if (!showAll && isSearching && !sectionTitleMatches &&
                    !shouldShowSection(record, 'Notes', notesVal)) {
                  return null;
                }
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Notes')}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`section-copy-btn ${copiedSectionId === `notes-${idx}` ? 'copied' : ''}`}
                            onClick={() => copySectionToClipboard(`NOTES\n${notesVal}`, `notes-${idx}`)}
                          >
                            {copiedSectionId === `notes-${idx}` ? 'Copied!' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, idx, 'notes')}
                        </div>
                      </div>
                      {(showAll || sectionTitleMatches || shouldShowRow(record, 'Notes', notesVal)) &&
                        renderSentenceEditableField(record, 'notes', 'Notes', idx, 'notes', 'notesval')}
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

export default ADHDAssessmentDocument;
