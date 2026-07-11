import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import AllergyImmunologyAssessmentPDFTemplate from '../pdf-templates/AllergyImmunologyAssessmentPDFTemplate';
import './AllergyImmunologyAssessmentDocument.css';

/**
 * AllergyImmunologyAssessmentDocument - Inline Editing with per-section approve
 * Blue mini-card theme, per-sentence editing, comma-split per-part editing
 * 4-level search with sectionTitleMatches pattern
 */

const SECTION_FIELDS = {
  providerDetails: ['type', 'provider', 'facility', 'status'],
  immuneFunction: ['immuneFunction'],
  skinTesting: ['skinTesting'],
  specificIge: ['specificIge'],
  componentTesting: ['componentTesting'],
  challengeTests: ['challengeTests'],
  findings: ['findings'],
  assessment: ['assessment'],
  plan: ['plan'],
  recommendations: ['recommendations'],
  results: ['results'],
  notes: ['notes'],
};

const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'notes'];

const SECTION_LABELS = {
  providerDetails: 'Provider Details',
  immuneFunction: 'Immune Function',
  skinTesting: 'Skin Testing',
  specificIge: 'Specific IgE',
  componentTesting: 'Component Testing',
  challengeTests: 'Challenge Tests',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  results: 'Results',
  notes: 'Notes',
};

const FIELD_LABELS = {
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  recommendations: 'Recommendations',
  immuneFunction: 'Immune Function',
  skinTesting: 'Skin Testing',
  specificIge: 'Specific IgE',
  componentTesting: 'Component Testing',
  challengeTests: 'Challenge Tests',
  results: 'Results',
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

// Status field edit dropdown options (active / not active). Any other existing value (e.g. "Complete")
// is preserved by prepending it as a selectable option so editing never loses it.
const STATUS_OPTIONS = ['active', 'not active'];

// splitNumberUnit: for measurement values like "285 IU/mL (elevated)", ">100 kUA/L (Class 6)", "1.63"
// split into { prefix (optional comparator), number, suffix (unit + qualifier) } so the user can edit
// ONLY the leading number while the unit/qualifier stay untouched. Returns null when the value is NOT
// numeric-leading (e.g. "Positive (Class 3)") or is date-like (e.g. "2026-02-12") → caller falls back
// to the normal text editor. Verified round-trip on the real allergy_immunology_assessment value corpus.
const splitNumberUnit = (raw) => {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(s)) return null; // date-like → not a number+unit
  const m = raw.match(/^(\s*[<>≤≥~]?\s*)(-?\d+(?:\.\d+)?)([\s\S]*)$/);
  if (!m) return null;
  if (/^[-/.]?\d/.test(m[3])) return null; // number followed by digit/date-separator → compound, skip
  return { prefix: m[1] || '', number: m[2], suffix: m[3] || '' };
};

// splitFirstNumber: extract the FIRST standalone number EMBEDDED in a string, keeping the text BEFORE
// (label) and AFTER (unit + qualifier) so the user can edit only that number. For findings rows like
// "IgE 285 IU/mL (elevated)" / "Blood eosinophils 420 cells/µL (elevated, reference <300)" → edits
// 285 / 420 only. The number must NOT be glued to a label (lookbehind skips "IgG4"→takes the real
// value). Returns null for narrative text with no number, or date-like values.
const splitFirstNumber = (raw) => {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(s)) return null; // date-like → not a measurement
  const m = raw.match(/(?<![\w.])(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  return { before: raw.slice(0, m.index), number: m[1], after: raw.slice(m.index + m[0].length) };
};

const humanizeKey = (key) =>
  key.replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').replace(/^./, s => s.toUpperCase()).replace(/\s+/g, ' ').trim();

const flattenObject = (obj, prefix = '') => {
  const result = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return result;
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const label = humanizeKey(key);
    if (Array.isArray(val)) {
      // Array-valued key → one editable row per item (skip empty arrays / empty items)
      val.forEach((item, i) => {
        if (item === null || item === undefined || item === '') return;
        if (typeof item === 'object') {
          // Object array item → flatten readably into a single value line (no [object Object])
          const inner = flattenObject(item).map(e => `${e.label}: ${e.value}`).join('; ');
          if (inner) result.push({ path: `${path}[${i}]`, label, value: inner, isObjectItem: true });
        } else {
          result.push({ path: `${path}[${i}]`, label, value: String(item) });
        }
      });
    } else if (val && typeof val === 'object') {
      result.push(...flattenObject(val, path));
    } else if (val !== null && val !== undefined && val !== '') {
      result.push({ path, label, value: String(val) });
    }
  }
  return result;
};

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldName]: value } } */
const DRAFT_KEY = 'allergy_immunology_assessmentPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const setNestedValue = (obj, path, value) => {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let target = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (target[key] === undefined || target[key] === null) {
      target[key] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    }
    target = target[key];
  }
  target[parts[parts.length - 1]] = value;
};

const AllergyImmunologyAssessmentDocument = ({ document: doc }) => {
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
      if (doc[0]?.allergy_immunology_assessment && Array.isArray(doc[0].allergy_immunology_assessment)) {
        return doc[0].allergy_immunology_assessment;
      }
      return doc;
    }
    if (doc.allergy_immunology_assessment && Array.isArray(doc.allergy_immunology_assessment)) {
      return doc.allergy_immunology_assessment;
    }
    if (doc.documentData) {
      const dd = doc.documentData;
      if (Array.isArray(dd)) return dd;
      if (dd.allergy_immunology_assessment) {
        const raw = dd.allergy_immunology_assessment;
        return Array.isArray(raw) ? raw : [raw];
      }
      return [dd];
    }
    if (doc.type || doc.provider || doc.findings || doc.assessment) {
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
      const recordId = record && (record._id?.$oid || record._id);
      const recDrafts = recordId ? store[recordId] : null;
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
    if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0) return null;
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

  const canEdit = true;

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
    persistToLocalStorage('allergy_immunology_assessment', recordId, fieldName, saveValue);
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow
    setApprovedSections(prev => { const u = { ...prev }; delete u[`${sectionId}-${idx}`]; return u; });

    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldName] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue, persistToLocalStorage]);

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

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  // ONE-WAY approve — return early if already approved. Clears edit markers.
  const handleApproveSection = useCallback(async (record, idx, sectionId) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) return;
    const approveKey = `${sectionId}-${idx}`;
    const isApproved = approvedSections[approveKey];
    if (isApproved) return; // Already approved — no toggle back
    setApproving(true);
    try {
      // Persist each staged field for THIS section to the DB now (only pending edits whose
      // base field belongs to this section).
      const fields = SECTION_FIELDS[sectionId] || [];
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const baseField = fieldPart.includes('.') ? fieldPart.slice(0, fieldPart.indexOf('.')) : fieldPart;
        return fields.includes(baseField);
      });
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const dotIdx = fieldPart.indexOf('.');
        const payload = { field: dotIdx === -1 ? fieldPart : fieldPart.slice(0, dotIdx), value: localEdits[editKey] };
        if (dotIdx !== -1) payload.arrayIndex = parseInt(fieldPart.slice(dotIdx + 1), 10);
        const resp = await secureApiClient.put(`/api/edit/allergy_immunology_assessment/${recordId}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/allergy_immunology_assessment/${recordId}/approve`, {
        sectionId, approved: true,
      });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this section's committed drafts from localStorage
      const store = readDrafts();
      if (store[recordId]) {
        toCommit.forEach(editKey => {
          const fieldPart = editKey.slice(0, -suffix.length);
          const baseField = fieldPart.includes('.') ? fieldPart.slice(0, fieldPart.indexOf('.')) : fieldPart;
          delete store[recordId][baseField];
        });
        if (Object.keys(store[recordId]).length === 0) delete store[recordId];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [approveKey]: true }));
      // Clear edit markers for this section
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
      const label = FIELD_LABELS[f] || '';
      if (stm(label)) return true;
      const val = getFieldValue(record, f, record._originalIdx);
      if (formatValue(val) === null) return false;
      if (typeof val === 'object' && !Array.isArray(val)) {
        return shouldShowRow(record, JSON.stringify(val));
      }
      if (Array.isArray(val)) {
        return val.some(item => shouldShowRow(record, typeof item === 'object' ? JSON.stringify(item) : String(item)));
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
      const recordTitle = `Allergy Immunology Assessment ${record._originalIdx + 1}`;
      const searchableText = [
        'Allergy Immunology Assessment', recordTitle,
        'Provider Details', 'Type', record.type,
        'Provider', record.provider,
        'Facility', record.facility,
        'Status', record.status,
        'Immune Function', JSON.stringify(record.immuneFunction || {}),
        'Skin Testing', JSON.stringify(record.skinTesting || {}),
        'Specific IgE', JSON.stringify(record.specificIge || {}),
        'Component Testing', JSON.stringify(record.componentTesting || {}),
        'Challenge Tests', JSON.stringify(record.challengeTests || {}),
        'Findings', record.findings,
        'Assessment', record.assessment,
        'Plan', record.plan,
        'Recommendations', ...(record.recommendations || []).map(r => r.recommendation || ''),
        'Results', JSON.stringify(record.results || {}),
        'Notes', record.notes,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!searchableText.includes(searchLower)) return false;
      const titleLower = recordTitle.toLowerCase();
      if (titleLower.startsWith(searchLower) || searchLower.startsWith(titleLower) ||
          'allergy immunology assessment'.startsWith(searchLower) || searchLower.startsWith('allergy immunology assessment')) {
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

  const getObjectText = (obj) => {
    const entries = flattenObject(obj);
    if (entries.length === 0) return '';
    return entries.map(e => `${e.label}: ${e.value}`).join('\n');
  };

  const getSectionText = (record, sectionId, idx) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return '';
    const label = SECTION_LABELS[sectionId] || sectionId;
    const lines = [label.toUpperCase()];

    if (sectionId === 'recommendations') {
      const recs = getFieldValue(record, 'recommendations', idx);
      if (recs && Array.isArray(recs)) {
        recs.forEach((r, i) => {
          const text = r.recommendation || r;
          const date = r.date ? ` (${formatDate(r.date)})` : '';
          lines.push(`${i + 1}. ${text}${date}`);
        });
      }
      return lines.join('\n');
    }

    fields.forEach(f => {
      const val = getFieldValue(record, f, idx);
      if (formatValue(val) === null) return;
      const fieldLabel = FIELD_LABELS[f];

      // Object fields
      if (typeof val === 'object' && !Array.isArray(val)) {
        const objText = getObjectText(val);
        if (objText) {
          if (fields.length > 1 && fieldLabel) {
            lines.push(`${fieldLabel}:`);
            objText.split('\n').forEach(l => lines.push(`  ${l}`));
          } else {
            objText.split('\n').forEach(l => lines.push(l));
          }
        }
        return;
      }

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
    lines.push(`ALLERGY & IMMUNOLOGY ASSESSMENT ${idx + 1}`);
    lines.push('='.repeat(40));
    if (record.date) lines.push(`Date: ${formatDate(record.date)}`);
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

    if (isEditing) {
      // Status field → active / not active dropdown (preserve any other existing value as an option).
      if (fieldName === 'status') {
        const cur = String(val);
        const opts = STATUS_OPTIONS.includes(cur) ? STATUS_OPTIONS : [cur, ...STATUS_OPTIONS];
        return (
          <div className="edit-field-container">
            <select
              className="edit-select"
              value={editValue}
              autoFocus
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
            >
              {opts.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
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
        // Multiple comma items — per-part editing with empty part filtering.
        // Only wrap in a rec-mini-card when there's a subtitle (parsed.label) to head the group;
        // unlabeled comma items render as bare sibling rows (no empty subtitle-less inner card).
        const partsContent = displayParts.map((part, pi) => {
              const partEditKey = `${fieldName}-${idx}-s${sIdx}-p${pi}`;
              const isPartEditing = editingField === partEditKey;
              const isPartEdited = editedSentences[partEditKey] === 'edited';
              const partCopyId = `${fieldName}-${idx}-s${sIdx}-p${pi}`;
              // Findings measurement rows ("IgE 285 IU/mL (elevated)") → edit ONLY the embedded number;
              // the label-before + unit/qualifier-after are preserved. null → normal text edit.
              const pfn = fieldName === 'findings' ? splitFirstNumber(part) : null;

              // Per-part search filtering
              if (searchTerm && !record._showAllSections && !sectionTitleMatches) {
                if (parsed.isLabeled && !stm(parsed.label) && !shouldShowRow(record, part)) return null;
                if (!parsed.isLabeled && !shouldShowRow(record, part)) return null;
              }

              // Rebuild this part (number-only reconstruction when pfn), then replace it in the full
              // field text and stage the draft. Shared by textarea + number editors / Enter + Save.
              const savePart = () => {
                const newParts = [...displayParts];
                newParts[pi] = pfn ? `${pfn.before}${editValue.trim()}${pfn.after}` : editValue.trim();
                const filteredParts = newParts.filter(p => p.trim().length > 0);
                const sourceText = String(getFieldValue(record, fieldName, idx) || '');
                const fullSentence = parsed.isLabeled ? `${parsed.label}: ${textToSplit}` : sentence;
                let replacement = '';
                if (filteredParts.length > 0) {
                  replacement = parsed.isLabeled ? `${parsed.label}: ${filteredParts.join(', ')}` : filteredParts.join(', ');
                }
                const newFullText = replacement
                  ? sourceText.replace(fullSentence, replacement)
                  : sourceText.replace(fullSentence, '').replace(/\.\s*\./g, '.').replace(/\s{2,}/g, ' ').trim();
                handleSaveField(record, fieldName, idx, sectionId, 0, newFullText, partEditKey);
              };

              if (isPartEditing) {
                // Number-only editor for findings measurement parts
                if (pfn) {
                  return (
                    <div key={partCopyId} className="edit-field-container">
                      <div className="number-edit-row">
                        {pfn.before.trim() ? <span className="number-edit-unit">{pfn.before.trim()}</span> : null}
                        <input
                          type="number"
                          step="any"
                          ref={textareaRef}
                          className="edit-number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && editValue.trim() !== '') savePart();
                            if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                          }}
                        />
                        {pfn.after.trim() ? <span className="number-edit-unit">{pfn.after.trim()}</span> : null}
                      </div>
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={() => { if (editValue.trim() !== '') savePart(); }}>
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={partCopyId} className="edit-field-container">
                    <textarea
                      ref={textareaRef}
                      className="edit-textarea"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) savePart();
                        if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                      }}
                    />
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={savePart}>
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
                        setEditValue(pfn ? pfn.number : part.replace(/[.;]+$/, '').trim());
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
        });
        return parsed.isLabeled ? (
          <div key={sIdx} className="rec-mini-card">
            <div className="nested-subtitle">{highlightText(parsed.label)}</div>
            {partsContent}
          </div>
        ) : (
          <React.Fragment key={sIdx}>{partsContent}</React.Fragment>
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

  // Render nested object fields (immuneFunction, skinTesting, etc.)
  const renderObjectField = (record, fieldName, idx, sectionId) => {
    const obj = getFieldValue(record, fieldName, idx);
    if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) return null;
    const entries = flattenObject(obj);
    if (entries.length === 0) return null;
    const sectionTitleMatches = searchTerm && stm(FIELD_LABELS[fieldName] || fieldName);

    return entries.map((entry, eIdx) => {
      if (searchTerm && !record._showAllSections && !sectionTitleMatches) {
        if (!shouldShowRow(record, entry.label, entry.value)) return null;
      }

      const editKey = `${fieldName}.${entry.path}-${idx}-s${eIdx}`;
      const isEditing = editingField === editKey;
      const isEdited = editedSentences[editKey] === 'edited';
      // Object-array items are flattened read-only summaries — editing them as a
      // string would clobber the object shape, so they are display/copy only.
      const itemEditable = canEdit && !entry.isObjectItem;
      // Numeric measurement leaves (e.g. "285 IU/mL (elevated)") edit ONLY the leading number;
      // the unit + qualifier are preserved. Non-numeric leaves stay null → normal text edit.
      const nu = itemEditable ? splitNumberUnit(entry.value) : null;

      if (isEditing) {
        // Numeric measurement leaf → edit ONLY the number; reconstruct prefix + number + unit/qualifier.
        if (nu) {
          const saveNumber = () => {
            const n = editValue.trim();
            if (n === '') { setEditingField(null); setEditValue(''); return; }
            const newVal = `${nu.prefix}${n}${nu.suffix}`;
            const current = JSON.parse(JSON.stringify(getFieldValue(record, fieldName, idx) || {}));
            setNestedValue(current, entry.path, newVal);
            handleSaveField(record, fieldName, idx, sectionId, eIdx, current, editKey);
          };
          return (
            <div key={eIdx} className="edit-field-container">
              <div className="number-edit-row">
                {nu.prefix.trim() ? <span className="number-edit-unit">{nu.prefix.trim()}</span> : null}
                <input
                  type="number"
                  step="any"
                  ref={textareaRef}
                  className="edit-number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveNumber();
                    if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                  }}
                />
                {nu.suffix.trim() ? <span className="number-edit-unit">{nu.suffix.trim()}</span> : null}
              </div>
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={saveNumber}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
              </div>
            </div>
          );
        }
        return (
          <div key={eIdx} className="edit-field-container">
            <textarea
              ref={textareaRef}
              className="edit-textarea"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  const current = JSON.parse(JSON.stringify(getFieldValue(record, fieldName, idx) || {}));
                  setNestedValue(current, entry.path, editValue.trim());
                  handleSaveField(record, fieldName, idx, sectionId, eIdx, current, editKey);
                }
                if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
              }}
            />
            <div className="edit-actions">
              <button className="save-btn" disabled={saving} onClick={() => {
                const current = JSON.parse(JSON.stringify(getFieldValue(record, fieldName, idx) || {}));
                setNestedValue(current, entry.path, editValue.trim());
                handleSaveField(record, fieldName, idx, sectionId, eIdx, current, editKey);
              }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        );
      }

      return (
        <React.Fragment key={eIdx}>
          <div className="nested-subtitle">{highlightText(entry.label)}</div>
          <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
            <div
              className={`row-content${itemEditable ? ' editable' : ''}`}
              onClick={() => {
                if (!itemEditable) return;
                setEditingField(editKey);
                setEditValue(nu ? nu.number : entry.value);
                setTimeout(() => textareaRef.current?.focus(), 50);
              }}
            >
              <span className="content-value">{highlightText(entry.value)}</span>
              {itemEditable && !isEdited && <span className="edit-indicator">✎</span>}
            </div>
            <button
              className={`copy-btn${copiedId === `${fieldName}-${eIdx}-${idx}` ? ' copied' : ''}`}
              onClick={() => copyToClipboard(`${entry.label}: ${entry.value}`, `${fieldName}-${eIdx}-${idx}`)}
            >
              {copiedId === `${fieldName}-${eIdx}-${idx}` ? 'Copied' : 'Copy'}
            </button>
          </div>
          {isEdited && <div className="modified-badge">edited — click pending approve to save</div>}
        </React.Fragment>
      );
    });
  };

  // Render recommendations array
  const renderRecommendationsSection = (record, idx) => {
    const recs = getFieldValue(record, 'recommendations', idx);
    if (!recs || !Array.isArray(recs) || recs.length === 0) return null;
    const sectionId = 'recommendations';
    const sectionTitleMatches = searchTerm && stm('Recommendations');

    return recs.map((rec, rIdx) => {
      const recText = typeof rec === 'string' ? rec : (rec.recommendation || '');
      const recDate = typeof rec === 'object' ? rec.date : null;

      if (searchTerm && !record._showAllSections && !sectionTitleMatches) {
        if (!shouldShowRow(record, recText, recDate ? formatDate(recDate) : '')) return null;
      }

      const editKey = `recommendations-${idx}-s${rIdx}`;
      const isEditing = editingField === editKey;
      const isEdited = editedSentences[editKey] === 'edited';

      if (isEditing) {
        return (
          <div key={rIdx} className="edit-field-container">
            <textarea
              ref={textareaRef}
              className="edit-textarea"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  const newRecs = [...recs];
                  if (typeof newRecs[rIdx] === 'object') {
                    newRecs[rIdx] = { ...newRecs[rIdx], recommendation: editValue.trim() };
                  } else {
                    newRecs[rIdx] = editValue.trim();
                  }
                  handleSaveField(record, 'recommendations', idx, sectionId, rIdx, newRecs, editKey);
                }
                if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
              }}
            />
            <div className="edit-actions">
              <button className="save-btn" disabled={saving} onClick={() => {
                const newRecs = [...recs];
                if (typeof newRecs[rIdx] === 'object') {
                  newRecs[rIdx] = { ...newRecs[rIdx], recommendation: editValue.trim() };
                } else {
                  newRecs[rIdx] = editValue.trim();
                }
                handleSaveField(record, 'recommendations', idx, sectionId, rIdx, newRecs, editKey);
              }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        );
      }

      return (
        <div key={rIdx} className="rec-mini-card">
          {recDate && <div className="nested-subtitle">{highlightText(formatDate(recDate))}</div>}
          <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
            <div
              className={`row-content${canEdit ? ' editable' : ''}`}
              onClick={() => {
                setEditingField(editKey);
                setEditValue(recText);
                setTimeout(() => textareaRef.current?.focus(), 50);
              }}
            >
              <span className="content-value">{highlightText(recText)}</span>
              {canEdit && !isEdited && <span className="edit-indicator">✎</span>}
            </div>
            <button
              className={`copy-btn${copiedId === `rec-${idx}-${rIdx}` ? ' copied' : ''}`}
              onClick={() => copyToClipboard(`${recText}${recDate ? ` (${formatDate(recDate)})` : ''}`, `rec-${idx}-${rIdx}`)}
            >
              {copiedId === `rec-${idx}-${rIdx}` ? 'Copied' : 'Copy'}
            </button>
          </div>
          {isEdited && <div className="modified-badge">edited — click pending approve to save</div>}
        </div>
      );
    });
  };

  const renderSection = (record, idx, sectionId) => {
    const label = SECTION_LABELS[sectionId];
    if (!shouldShowSection(record, sectionId, label)) return null;
    const fields = SECTION_FIELDS[sectionId];

    // Special handling for recommendations array
    if (sectionId === 'recommendations') {
      const recs = getFieldValue(record, 'recommendations', idx);
      if (!recs || !Array.isArray(recs) || recs.length === 0) return null;
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
          {renderRecommendationsSection(record, idx)}
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
          const val = getFieldValue(record, f, idx);
          const fieldLabel = fields.length > 1 ? FIELD_LABELS[f] : null;

          // Object fields (immuneFunction, skinTesting, etc.)
          if (typeof val === 'object' && val !== null && !Array.isArray(val) && Object.keys(val).length > 0) {
            return <React.Fragment key={f}>{renderObjectField(record, f, idx, sectionId)}</React.Fragment>;
          }

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
      <div className="allergy-immunology-assessment-document">
        <div className="empty-state">
          <div className="empty-icon">🧬</div>
          <div className="empty-text">No allergy & immunology assessment data available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="allergy-immunology-assessment-document">
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">Allergy & Immunology Assessment</h1>
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
            document={<AllergyImmunologyAssessmentPDFTemplate document={pdfData} />}
            fileName="Allergy_Immunology_Assessment.pdf"
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
          placeholder="Search findings, assessment, provider, recommendations..."
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
                  {record.date && (
                    <span className="date-badge">{highlightText(formatDate(record.date))}</span>
                  )}
                  {record.status && (
                    <span className="status-badge">{highlightText(record.status)}</span>
                  )}
                </div>
                <h2 className="card-title">{highlightText(`Allergy & Immunology Assessment ${idx + 1}`)}</h2>
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

export default AllergyImmunologyAssessmentDocument;
