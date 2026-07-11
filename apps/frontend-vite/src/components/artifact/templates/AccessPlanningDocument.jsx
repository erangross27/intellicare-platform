import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import AccessPlanningDocumentPDFTemplate from '../pdf-templates/AccessPlanningDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './AccessPlanningDocument.css';

// Section fields for per-section approve
const SECTION_FIELDS = {
  planningInfo: ['date', 'provider', 'facility'],
  accessDetails: ['accessType', 'indication', 'plannedSite', 'vascularMapping'],
  procedureDetails: ['plannedDate', 'surgeon'],
  clinicalConsiderations: ['preoperativeConsiderations', 'anticoagulation', 'temporaryAccess'],
  followUp: ['maturationTime', 'followUp'],
  notes: ['notes'],
};

const SENTENCE_FIELDS = ['followUp', 'notes'];
const ARRAY_FIELDS = ['preoperativeConsiderations'];

// Split text into sentences (standard pattern)
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

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'access_planningPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const AccessPlanningDocument = ({ document, data }) => {
  // Search state
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
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const textareaRef = useRef(null);

  const canEdit = true;

  // Data unwrapping
  const templateData = document || data;
  let records = [];
  if (Array.isArray(templateData)) {
    if (templateData.length > 0 && templateData[0]?.records) {
      records = templateData[0].records;
    } else if (templateData.length > 0 && templateData[0]?._records) {
      records = templateData[0]._records;
    } else {
      records = templateData;
    }
  } else if (templateData?.records) {
    records = templateData.records;
  } else if (templateData?._records) {
    records = templateData._records;
  } else if (templateData) {
    records = [templateData];
  }

  const validRecords = Array.isArray(records) ? records : [];

  // Stable record indexing
  const unwrappedData = useMemo(() => {
    return validRecords.filter(r => r && Object.keys(r).length > 0)
      .map((r, i) => ({ ...r, _originalIdx: i }));
  }, [validRecords]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    unwrappedData.forEach((record, idx) => {
      const recordId = record && (record._id?.$oid || record._id);
      const recDrafts = recordId ? store[recordId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        // fieldPart is "field" (or "field.arrayIndex" — never used in this template's saves)
        const dotIdx = fieldPart.indexOf('.');
        const isArrayIndex = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
        const fieldName = isArrayIndex ? fieldPart.slice(0, dotIdx) : fieldPart;
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

  // ─── Format helpers ─────────────────────────────────────────────────

  const formatDate = (dateValue) => {
    if (!dateValue) return '';
    try {
      const dateStr = dateValue.$date || dateValue;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return String(dateValue);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return String(dateValue);
    }
  };

  const formatDateISO = (dateValue) => {
    if (!dateValue) return '';
    try {
      const dateStr = dateValue.$date || dateValue;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const highlightText = (text) => {
    if (!text) return '';
    const textStr = String(text);
    if (!searchTerm.trim()) return textStr;
    const searchLower = searchTerm.toLowerCase().trim();
    const textLower = textStr.toLowerCase();
    const index = textLower.indexOf(searchLower);
    if (index === -1) return textStr;
    return (
      <>
        {textStr.substring(0, index)}
        <mark>{textStr.substring(index, index + searchLower.length)}</mark>
        {textStr.substring(index + searchLower.length)}
      </>
    );
  };

  const shouldShowRow = (record, ...args) => {
    if (!searchTerm.trim()) return true;
    const searchLower = searchTerm.toLowerCase().trim();
    const searchWords = searchLower.split(/\s+/).map(w => w.replace(/[()[\],.<>&:]+/g, '')).filter(w => w.length > 0);
    const combinedText = args.filter(Boolean)
      .map(arg => String(arg).toLowerCase().replace(/[()[\],.<>&:]/g, '').replace(/-/g, ' '))
      .join(' ');
    return searchWords.every(word => {
      const wordNoHyphen = word.replace(/-/g, ' ');
      if (word.length <= 3) {
        const wordBoundaryRegex = new RegExp(`\\b${word}\\b`, 'i');
        const wordNoHyphenRegex = new RegExp(`\\b${wordNoHyphen}\\b`, 'i');
        return wordBoundaryRegex.test(combinedText) || wordNoHyphenRegex.test(combinedText);
      }
      return combinedText.includes(word) || combinedText.includes(wordNoHyphen);
    });
  };

  const shouldShowSection = (record, sectionTitle, sectionContent) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;
    const searchLower = searchTerm.toLowerCase().trim();
    const searchWords = searchLower.split(/\s+/).map(w => w.replace(/[()[\],.<>&:]+/g, '')).filter(w => w.length > 0);
    const contentText = [sectionTitle, sectionContent].filter(Boolean)
      .map(item => String(item).toLowerCase().replace(/[()[\],.<>&:]/g, ''))
      .join(' ');
    return searchWords.every(word => contentText.includes(word));
  };

  // ─── Editing helpers ──────────────────────────────────────────────────

  const getEffective = (record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    return localEdits[editKey] !== undefined ? localEdits[editKey] : record[fieldName];
  };

  const getEffectiveArray = (record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    return localEdits[editKey] !== undefined ? localEdits[editKey] : (record[fieldName] || []);
  };

  const handleStartEdit = useCallback((fieldName, idx, currentValue, sentenceIdx = 0) => {
    const editKey = `${fieldName}-${idx}-s${sentenceIdx}`;
    setEditingField(editKey);
    const cleanValue = (currentValue || '').replace(/[.;]+$/, '').trim();
    setEditValue(cleanValue);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const handleStartEditArray = useCallback((fieldName, idx, itemIdx, currentValue) => {
    const editKey = `${fieldName}-${idx}-item${itemIdx}`;
    setEditingField(editKey);
    setEditValue(currentValue || '');
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

    // Stage the draft (no DB write). localStorage keeps it across refresh; Approve commits it.
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldName] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // reconstructFullText — PLAIN FUNCTION (not useCallback)
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

  // saveSentence — PLAIN FUNCTION (not useCallback)
  const saveSentence = (record, fieldName, idx, sectionId, sIdx) => {
    let editedSentenceVal = editValue.trim();
    if (editedSentenceVal && !/[.!?]$/.test(editedSentenceVal)) editedSentenceVal += '.';
    const fullEditKey = `${fieldName}-${idx}`;
    const hasFullEdit = localEdits[fullEditKey] !== undefined;
    const sourceText = hasFullEdit ? localEdits[fullEditKey] : (record[fieldName] || '');
    const allCurrent = splitBySentence(sourceText);
    const fullText = reconstructFullText(allCurrent, sIdx, editedSentenceVal, fieldName, idx, hasFullEdit);
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

  // saveArrayItem — for preoperativeConsiderations
  const saveArrayItem = (record, fieldName, idx, sectionId, itemIdx) => {
    const newValue = editValue.trim();
    const currentArray = [...getEffectiveArray(record, fieldName, idx)];
    currentArray[itemIdx] = newValue;
    handleSaveField(record, fieldName, idx, sectionId, 0, currentArray, `${fieldName}-${idx}-item${itemIdx}`);
  };

  // sectionHasEdits — checks approvedSections (NOT statusOverrides)
  const sectionHasEdits = useCallback((sectionId, idx) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    if (approvedSections[`${sectionId}-${idx}`]) return false;
    return fields.some(f => {
      const hasSentenceEdits = Object.keys(editedSentences).some(key => {
        if (!key.startsWith(`${f}-${idx}-s`)) return false;
        return editedSentences[key] === 'edited' || editedSentences[key] === 'added';
      });
      const hasObjectEdits = Object.keys(editedFields).some(key =>
        key.startsWith(`${f}-${idx}`)
      );
      const hasArrayEdits = Object.keys(editedSentences).some(key => {
        if (!key.startsWith(`${f}-${idx}-item`)) return false;
        return editedSentences[key] === 'edited';
      });
      return hasSentenceEdits || hasObjectEdits || hasArrayEdits;
    });
  }, [editedSentences, editedFields, approvedSections]);

  // Approve = COMMIT this section's staged drafts for this record to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sectionId) => {
    const approveKey = `${sectionId}-${idx}`;
    const isCurrentlyApproved = approvedSections[approveKey];

    setApprovedSections(prev => ({ ...prev, [approveKey]: !isCurrentlyApproved }));

    const fields = SECTION_FIELDS[sectionId] || [];
    if (!isCurrentlyApproved) {
      setEditedSentences(prev => {
        const cleaned = { ...prev };
        fields.forEach(f => {
          Object.keys(cleaned).forEach(key => {
            if (key.startsWith(`${f}-${idx}-`)) delete cleaned[key];
          });
        });
        return cleaned;
      });
      setEditedFields(prev => {
        const cleaned = { ...prev };
        fields.forEach(f => {
          Object.keys(cleaned).forEach(key => {
            if (key.startsWith(`${f}-${idx}`)) delete cleaned[key];
          });
        });
        return cleaned;
      });
    }

    const recordId = record._id?.$oid || record._id;
    if (recordId) {
      setApproving(true);
      try {
        // Persist each staged field for this section+record to the DB now (only on the approve transition).
        let committed = [];
        if (!isCurrentlyApproved) {
          const suffix = `-${idx}`;
          committed = Object.keys(localEdits).filter(k => {
            if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
            const fieldPart = k.slice(0, -suffix.length); // "field" or "field.arrayIndex"
            const dotIdx = fieldPart.indexOf('.');
            const isArrayIndex = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
            const baseField = isArrayIndex ? fieldPart.slice(0, dotIdx) : fieldPart;
            return fields.includes(baseField);
          });
          for (const editKey of committed) {
            const fieldPart = editKey.slice(0, -suffix.length);
            const dotIdx = fieldPart.indexOf('.');
            const isArrayIndex = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
            const payload = { field: isArrayIndex ? fieldPart.slice(0, dotIdx) : fieldPart, value: localEdits[editKey] };
            if (isArrayIndex) payload.arrayIndex = parseInt(fieldPart.slice(dotIdx + 1), 10);
            await secureApiClient.put(`/api/edit/access_planning/${recordId}/edit`, payload);
          }
        }
        await secureApiClient.put(`/api/edit/access_planning/${recordId}/approve`, {
          sectionId,
          approved: !isCurrentlyApproved,
        });
        if (!isCurrentlyApproved && committed.length > 0) {
          // Clear pending → committed edits now flow into pdfData/PDF
          setPendingEdits(prev => {
            const next = { ...prev };
            committed.forEach(k => delete next[k]);
            return next;
          });
          // Drop this record's committed fields from the localStorage draft store
          const store = readDrafts();
          if (store[recordId]) {
            committed.forEach(editKey => {
              const fieldPart = editKey.slice(0, -`-${idx}`.length);
              const dotIdx = fieldPart.indexOf('.');
              const isArrayIndex = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
              const baseField = isArrayIndex ? fieldPart.slice(0, dotIdx) : fieldPart;
              delete store[recordId][baseField];
            });
            if (Object.keys(store[recordId]).length === 0) delete store[recordId];
            writeDrafts(store);
          }
        }
      } catch (error) {
        console.error('Approve failed:', error);
      } finally {
        setApproving(false);
      }
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

  // ─── Copy helpers ─────────────────────────────────────────────────

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ─── Section text helpers (use getEffective for editable fields) ──

  const getPlanningInfoText = (record, idx) => {
    const lines = [];
    if (record.date) lines.push(`1. Date\n${formatDate(record.date)}`);
    const provider = getEffective(record, 'provider', idx);
    if (provider) lines.push(`2. Provider\n${provider}`);
    const facility = getEffective(record, 'facility', idx);
    if (facility) lines.push(`3. Facility\n${facility}`);
    return lines.join('\n\n');
  };

  const getPlanningInfoSearchContent = (record) => {
    return [
      'Planning Information',
      'date', 'Date', formatDate(record.date), formatDateISO(record.date), record.date,
      'provider', 'Provider', record.provider,
      'facility', 'Facility', record.facility,
    ].filter(Boolean).join(' ');
  };

  const getAccessDetailsText = (record, idx) => {
    const lines = [];
    const accessType = getEffective(record, 'accessType', idx);
    if (accessType) lines.push(`1. Access Type\n${accessType}`);
    const indication = getEffective(record, 'indication', idx);
    if (indication) lines.push(`2. Indication\n${indication}`);
    const plannedSite = getEffective(record, 'plannedSite', idx);
    if (plannedSite) lines.push(`3. Planned Site\n${plannedSite}`);
    const vascularMapping = getEffective(record, 'vascularMapping', idx);
    if (vascularMapping) lines.push(`4. Vascular Mapping\n${vascularMapping}`);
    return lines.join('\n\n');
  };

  const getAccessDetailsSearchContent = (record) => {
    return [
      'Access Details',
      'access type', 'Access Type', record.accessType,
      'indication', 'Indication', record.indication,
      'planned site', 'Planned Site', record.plannedSite,
      'vascular mapping', 'Vascular Mapping', record.vascularMapping,
    ].filter(Boolean).join(' ');
  };

  const getProcedureDetailsText = (record, idx) => {
    const lines = [];
    if (record.plannedDate) lines.push(`1. Planned Date\n${formatDate(record.plannedDate)}`);
    const surgeon = getEffective(record, 'surgeon', idx);
    if (surgeon) lines.push(`2. Surgeon\n${surgeon}`);
    return lines.join('\n\n');
  };

  const getProcedureDetailsSearchContent = (record) => {
    return [
      'Procedure Details',
      'planned date', 'Planned Date', formatDate(record.plannedDate), formatDateISO(record.plannedDate), record.plannedDate,
      'surgeon', 'Surgeon', record.surgeon,
    ].filter(Boolean).join(' ');
  };

  const getClinicalConsiderationsText = (record, idx) => {
    const lines = [];
    const preops = getEffectiveArray(record, 'preoperativeConsiderations', idx);
    if (preops.length) {
      lines.push('Preoperative Considerations');
      preops.forEach((item, i) => {
        lines.push(`${i + 1}. ${item}`);
      });
    }
    const anticoag = getEffective(record, 'anticoagulation', idx);
    if (anticoag) lines.push(`\nAnticoagulation\n${anticoag}`);
    const tempAccess = getEffective(record, 'temporaryAccess', idx);
    if (tempAccess) lines.push(`\nTemporary Access\n${tempAccess}`);
    return lines.join('\n');
  };

  const getClinicalConsiderationsSearchContent = (record) => {
    return [
      'Clinical Considerations',
      'preoperative considerations', 'Preoperative Considerations',
      ...(record.preoperativeConsiderations || []),
      'anticoagulation', 'Anticoagulation', record.anticoagulation,
      'temporary access', 'Temporary Access', record.temporaryAccess,
    ].filter(Boolean).join(' ');
  };

  const getFollowUpText = (record, idx) => {
    const lines = [];
    const matTime = getEffective(record, 'maturationTime', idx);
    if (matTime) lines.push(`1. Maturation Time\n${matTime}`);
    const fUp = getEffective(record, 'followUp', idx);
    if (fUp) lines.push(`2. Follow-Up Plan\n${fUp}`);
    return lines.join('\n\n');
  };

  const getFollowUpSearchContent = (record) => {
    return [
      'Follow-Up', 'Follow Up',
      'maturation time', 'Maturation Time', record.maturationTime,
      'follow up', 'Follow Up', record.followUp,
    ].filter(Boolean).join(' ');
  };

  const getNotesText = (record, idx) => {
    const notes = getEffective(record, 'notes', idx);
    if (!notes) return '';
    return `Notes\n${notes}`;
  };

  const getAllText = () => {
    return filteredRecords.map(record => {
      const idx = record._originalIdx;
      const sections = [];
      sections.push(`ACCESS PLANNING ${idx + 1}`);
      sections.push('');

      const planningInfo = getPlanningInfoText(record, idx);
      if (planningInfo) sections.push(`PLANNING INFORMATION\n${planningInfo}`);

      const accessDetails = getAccessDetailsText(record, idx);
      if (accessDetails) sections.push(`ACCESS DETAILS\n${accessDetails}`);

      const procedureDetails = getProcedureDetailsText(record, idx);
      if (procedureDetails) sections.push(`PROCEDURE DETAILS\n${procedureDetails}`);

      const clinicalConsiderations = getClinicalConsiderationsText(record, idx);
      if (clinicalConsiderations) sections.push(`CLINICAL CONSIDERATIONS\n${clinicalConsiderations}`);

      const followUp = getFollowUpText(record, idx);
      if (followUp) sections.push(`FOLLOW-UP\n${followUp}`);

      const notesText = getNotesText(record, idx);
      if (notesText) sections.push(notesText);

      return sections.join('\n\n');
    }).join('\n\n---\n\n');
  };

  // ─── Filtered records ─────────────────────────────────────────────

  const filteredRecords = useMemo(() => {
    if (!unwrappedData.length) return [];

    return unwrappedData.map((record) => {
      const idx = record._originalIdx;
      const recordNumber = String(idx + 1);
      const docTitle = `Access Planning ${recordNumber}`;

      const searchableText = [
        docTitle, recordNumber,
        'access planning', 'vascular access', 'dialysis access',
        'av fistula', 'av graft', 'hd catheter',
        `access planning ${recordNumber}`,
        'planning information', 'access details', 'procedure details',
        'clinical considerations', 'follow-up', 'follow up', 'notes',
        'date', 'provider', 'facility', 'access type', 'indication',
        'planned site', 'vascular mapping', 'planned date', 'surgeon',
        'preoperative considerations', 'anticoagulation', 'temporary access',
        'maturation time',
        formatDate(record.date), formatDateISO(record.date), record.date,
        formatDate(record.plannedDate), formatDateISO(record.plannedDate), record.plannedDate,
        record.provider, record.facility, record.accessType, record.indication,
        record.plannedSite, record.vascularMapping, record.surgeon,
        record.anticoagulation, record.temporaryAccess, record.maturationTime,
        record.followUp, record.notes,
        ...(record.preoperativeConsiderations || []),
      ].filter(Boolean);

      if (!searchTerm.trim()) {
        return { ...record, _documentTitle: docTitle, _recordNumber: recordNumber };
      }

      const searchLower = searchTerm.toLowerCase().trim();
      const searchWords = searchLower.split(/\s+/).map(w => w.replace(/[()[\],.<>&:]+/g, '')).filter(w => w.length > 0);

      const searchNumber = searchLower.match(/\d+/)?.[0];
      let showAllSections = false;

      if (searchNumber === recordNumber) {
        const titleWords = ['access', 'planning'];
        if (titleWords.some(w => searchLower.includes(w)) || searchLower === searchNumber) {
          showAllSections = true;
        }
      }

      const matches = searchWords.every(word => {
        const wordNoHyphen = word.replace(/-/g, ' ');
        return searchableText.some(text => {
          const textLower = String(text).toLowerCase().replace(/[()[\],.<>&:]/g, '').replace(/-/g, ' ');
          if (word.length <= 3) {
            const wordBoundaryRegex = new RegExp(`\\b${word}\\b`, 'i');
            const wordNoHyphenRegex = new RegExp(`\\b${wordNoHyphen}\\b`, 'i');
            return wordBoundaryRegex.test(textLower) || wordNoHyphenRegex.test(textLower);
          }
          return textLower.includes(word) || textLower.includes(wordNoHyphen);
        });
      });

      if (!matches && !showAllSections) return null;

      return { ...record, _documentTitle: docTitle, _recordNumber: recordNumber, _showAllSections: showAllSections };
    }).filter(Boolean);
  }, [unwrappedData, searchTerm]);

  // ─── Render helpers ───────────────────────────────────────────────

  const renderEditableField = (record, fieldName, idx, sectionId, label, copyId) => {
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const val = getEffective(record, fieldName, idx);
    const isEdited = editedSentences[editKey] === 'edited';

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={copyId}>
          {label && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className="nested-mini-card">
            <div className="numbered-row">
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
                  disabled={saving}
                />
                <div className="edit-actions">
                  <button className="save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId, 0)} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rec-mini-card" key={copyId}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="nested-mini-card">
          <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
            <div
              className={`row-content${canEdit ? ' editable' : ''}`}
              onClick={() => canEdit && handleStartEdit(fieldName, idx, val || '')}
            >
              <span className="content-value">
                {highlightText(val || '')}
                {canEdit && !isEdited && <span className="edit-indicator">✏️</span>}
              </span>
            </div>
            <button
              className={`copy-btn${copiedId === copyId ? ' copied' : ''}`}
              onClick={() => copyToClipboard(label ? `${label}\n${val || ''}` : (val || ''), copyId)}
            >
              {copiedId === copyId ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {isEdited && <div className="modified-badge">edited — click Pending Approve to save</div>}
        </div>
      </div>
    );
  };

  // Date field with a native date picker. Saves as local-noon ISO (avoids timezone day-shift).
  const renderDateField = (record, fieldName, idx, sectionId, label, copyId) => {
    const val = getEffective(record, fieldName, idx);
    if (!val) return null;

    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const isEdited = editedSentences[editKey] === 'edited';

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={copyId}>
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className="nested-mini-card">
            <div className="numbered-row">
              <div className="edit-field-container">
                <input
                  type="date"
                  className="edit-date-input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onFocus={(e) => e.target.showPicker && e.target.showPicker()}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
                  disabled={saving}
                  autoFocus
                />
                <div className="edit-actions">
                  <button
                    className="save-btn"
                    onClick={() => handleSaveField(record, fieldName, idx, sectionId, 0, editValue ? new Date(`${editValue}T12:00:00`).toISOString() : '')}
                    disabled={saving || !editValue}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rec-mini-card" key={copyId}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className="nested-mini-card">
          <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
            <div
              className={`row-content${canEdit ? ' editable' : ''}`}
              onClick={() => { if (canEdit) { setEditingField(editKey); setEditValue(formatDateISO(val)); } }}
            >
              <span className="content-value">
                {highlightText(formatDate(val))}
                {canEdit && !isEdited && <span className="edit-indicator">✏️</span>}
              </span>
            </div>
            <button
              className={`copy-btn${copiedId === copyId ? ' copied' : ''}`}
              onClick={() => copyToClipboard(`${label}\n${formatDate(val)}`, copyId)}
            >
              {copiedId === copyId ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {isEdited && <div className="modified-badge">edited — click Pending Approve to save</div>}
        </div>
      </div>
    );
  };

  const renderSentenceEditableField = (record, fieldName, idx, sectionId, label, copyId) => {
    const val = getEffective(record, fieldName, idx);
    if (!val) return null;

    const sentences = splitBySentence(String(val));
    if (sentences.length <= 1) {
      return renderEditableField(record, fieldName, idx, sectionId, label, copyId);
    }

    return (
      <div className="rec-mini-card" key={copyId}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        {sentences.map((sentence, sIdx) => {
          const editKey = `${fieldName}-${idx}-s${sIdx}`;
          const isEditing = editingField === editKey;
          const isEdited = editedSentences[editKey] === 'edited' || editedSentences[editKey] === 'added';
          const itemCopyId = `${copyId}-s${sIdx}`;

          if (isEditing) {
            return (
              <div className="nested-mini-card" key={itemCopyId}>
                <div className="numbered-row">
                  <div className="edit-field-container">
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
                      disabled={saving}
                    />
                    <div className="edit-actions">
                      <button className="save-btn" onClick={() => saveSentence(record, fieldName, idx, sectionId, sIdx)} disabled={saving}>
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div className="nested-mini-card" key={itemCopyId}>
              <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
                <div
                  className={`row-content${canEdit ? ' editable' : ''}`}
                  onClick={() => canEdit && handleStartEdit(fieldName, idx, sentence, sIdx)}
                >
                  <span className="content-value">
                    {highlightText(sentence)}
                    {canEdit && !isEdited && <span className="edit-indicator">✏️</span>}
                  </span>
                </div>
                <button
                  className={`copy-btn${copiedId === itemCopyId ? ' copied' : ''}`}
                  onClick={() => copyToClipboard(sentence, itemCopyId)}
                >
                  {copiedId === itemCopyId ? 'Copied!' : 'Copy'}
                </button>
              </div>
              {isEdited && <div className="modified-badge">{editedSentences[editKey] === 'added' ? 'added' : 'edited'} — click Pending Approve to save</div>}
            </div>
          );
        })}
      </div>
    );
  };

  const renderEditableArrayItem = (record, fieldName, idx, sectionId, itemIdx, item, copyId) => {
    const editKey = `${fieldName}-${idx}-item${itemIdx}`;
    const isEditing = editingField === editKey;
    const isEdited = editedSentences[editKey] === 'edited';

    if (isEditing) {
      return (
        <div className="nested-mini-card" key={copyId}>
          <div className="numbered-row">
            <div className="edit-field-container">
              <textarea
                ref={textareaRef}
                className="edit-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    saveArrayItem(record, fieldName, idx, sectionId, itemIdx);
                  }
                  if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                }}
                disabled={saving}
              />
              <div className="edit-actions">
                <button className="save-btn" onClick={() => saveArrayItem(record, fieldName, idx, sectionId, itemIdx)} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="nested-mini-card" key={copyId}>
        <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
          <div
            className={`row-content${canEdit ? ' editable' : ''}`}
            onClick={() => canEdit && handleStartEditArray(fieldName, idx, itemIdx, item)}
          >
            <span className="content-value">
              {highlightText(item)}
              {canEdit && !isEdited && <span className="edit-indicator">✏️</span>}
            </span>
          </div>
          <button
            className={`copy-btn${copiedId === copyId ? ' copied' : ''}`}
            onClick={() => copyToClipboard(item, copyId)}
          >
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isEdited && <div className="modified-badge">edited — click Pending Approve to save</div>}
      </div>
    );
  };

  const renderApproveBtn = (record, idx, sectionId) => {
    const approveKey = `${sectionId}-${idx}`;
    const hasEdits = sectionHasEdits(sectionId, idx);
    const isApproved = approvedSections[approveKey];
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

  // ─── Empty state ──────────────────────────────────────────────────

  if (!unwrappedData.length) {
    return (
      <div className="access-planning-document">
        <h1 className="document-title">Access Planning</h1>
        <p className="no-data-message">No access planning data available</p>
      </div>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────

  return (
    <div className="access-planning-document">
      <h1 className="document-title">Access Planning</h1>

      <div className="header-controls">
        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          placeholder="Search access planning..."
        />
        <div className="action-buttons">
          <button
            className={`action-btn${copiedId === 'copy-all' ? ' copied' : ''}`}
            onClick={() => copyToClipboard(getAllText(), 'copy-all')}
          >
            {copiedId === 'copy-all' ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<AccessPlanningDocumentPDFTemplate document={pdfData} />}
            fileName="access-planning.pdf"
          >
            {({ loading }) => (
              <button className={`action-btn${copiedId === 'pdf-export' ? ' copied' : ''}`}>
                {loading ? 'Preparing...' : 'Export PDF'}
              </button>
            )}
          </PDFDownloadLink>
        </div>
      </div>

      <div className="records-container">
        {filteredRecords.map((record) => {
          const idx = record._originalIdx;

          return (
            <div key={idx} className="record-card">
              <div className="card-header">
                <div className="header-top-row">
                  {record.date && <span className="date-badge">{formatDate(record.date)}</span>}
                  {record.accessType && (
                    <span className="type-badge">
                      {record.accessType.toUpperCase()}
                    </span>
                  )}
                </div>
                <h3 className="card-title">{highlightText(`Access Planning ${idx + 1}`)}</h3>
              </div>

              <div className="card-content">
                {/* ─── Planning Information ──────────────────────────────── */}
                {shouldShowSection(record, 'Planning Information', getPlanningInfoSearchContent(record)) && (() => {
                  const sectionTitleMatches = searchTerm && shouldShowRow(record,
                    'planning information', 'Planning Information', 'PLANNING INFORMATION');
                  const showAll = record._showAllSections || sectionTitleMatches;

                  const showDate = record.date && (showAll || shouldShowRow(record, 'date', 'Date', 'DATE', formatDate(record.date), formatDateISO(record.date), record.date));
                  const providerVal = getEffective(record, 'provider', idx);
                  const showProvider = providerVal && (showAll || shouldShowRow(record, 'provider', 'Provider', 'PROVIDER', record.provider));
                  const facilityVal = getEffective(record, 'facility', idx);
                  const showFacility = facilityVal && (showAll || shouldShowRow(record, 'facility', 'Facility', 'FACILITY', record.facility));

                  if (!(showDate || showProvider || showFacility)) return null;

                  return (
                    <div className="section">
                      <div className="numbered-rows-wrapper">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Planning Information')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`section-copy-btn${copiedId === `planning-info-${idx}` ? ' copied' : ''}`}
                              onClick={() => copyToClipboard(getPlanningInfoText(record, idx), `planning-info-${idx}`)}
                            >
                              {copiedId === `planning-info-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, idx, 'planningInfo')}
                          </div>
                        </div>
                        {/* Date - EDITABLE (date picker) */}
                        {showDate && renderDateField(record, 'date', idx, 'planningInfo', 'Date', `date-${idx}`)}
                        {showProvider && renderEditableField(record, 'provider', idx, 'planningInfo', 'Provider', `provider-${idx}`)}
                        {showFacility && renderEditableField(record, 'facility', idx, 'planningInfo', 'Facility', `facility-${idx}`)}
                      </div>
                    </div>
                  );
                })()}

                {/* ─── Access Details ──────────────────────────────────── */}
                {shouldShowSection(record, 'Access Details', getAccessDetailsSearchContent(record)) && (() => {
                  const sectionTitleMatches = searchTerm && shouldShowRow(record,
                    'access details', 'Access Details', 'ACCESS DETAILS');
                  const showAll = record._showAllSections || sectionTitleMatches;

                  const accessTypeVal = getEffective(record, 'accessType', idx);
                  const showAccessType = accessTypeVal && (showAll || shouldShowRow(record, 'access type', 'Access Type', 'ACCESS TYPE', record.accessType));
                  const indicationVal = getEffective(record, 'indication', idx);
                  const showIndication = indicationVal && (showAll || shouldShowRow(record, 'indication', 'Indication', 'INDICATION', record.indication));
                  const plannedSiteVal = getEffective(record, 'plannedSite', idx);
                  const showPlannedSite = plannedSiteVal && (showAll || shouldShowRow(record, 'planned site', 'Planned Site', 'PLANNED SITE', record.plannedSite));
                  const vascularMappingVal = getEffective(record, 'vascularMapping', idx);
                  const showVascularMapping = vascularMappingVal && (showAll || shouldShowRow(record, 'vascular mapping', 'Vascular Mapping', 'VASCULAR MAPPING', record.vascularMapping));

                  if (!(showAccessType || showIndication || showPlannedSite || showVascularMapping)) return null;

                  return (
                    <div className="section">
                      <div className="numbered-rows-wrapper">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Access Details')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`section-copy-btn${copiedId === `access-details-${idx}` ? ' copied' : ''}`}
                              onClick={() => copyToClipboard(getAccessDetailsText(record, idx), `access-details-${idx}`)}
                            >
                              {copiedId === `access-details-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, idx, 'accessDetails')}
                          </div>
                        </div>
                        {showAccessType && renderEditableField(record, 'accessType', idx, 'accessDetails', 'Access Type', `accessType-${idx}`)}
                        {showIndication && renderEditableField(record, 'indication', idx, 'accessDetails', 'Indication', `indication-${idx}`)}
                        {showPlannedSite && renderEditableField(record, 'plannedSite', idx, 'accessDetails', 'Planned Site', `plannedSite-${idx}`)}
                        {showVascularMapping && renderEditableField(record, 'vascularMapping', idx, 'accessDetails', 'Vascular Mapping', `vascularMapping-${idx}`)}
                      </div>
                    </div>
                  );
                })()}

                {/* ─── Procedure Details ───────────────────────────────── */}
                {shouldShowSection(record, 'Procedure Details', getProcedureDetailsSearchContent(record)) && (() => {
                  const sectionTitleMatches = searchTerm && shouldShowRow(record,
                    'procedure details', 'Procedure Details', 'PROCEDURE DETAILS');
                  const showAll = record._showAllSections || sectionTitleMatches;

                  const showPlannedDate = record.plannedDate && (showAll || shouldShowRow(record, 'planned date', 'Planned Date', 'PLANNED DATE', formatDate(record.plannedDate), formatDateISO(record.plannedDate), record.plannedDate));
                  const surgeonVal = getEffective(record, 'surgeon', idx);
                  const showSurgeon = surgeonVal && (showAll || shouldShowRow(record, 'surgeon', 'Surgeon', 'SURGEON', record.surgeon));

                  if (!(showPlannedDate || showSurgeon)) return null;

                  return (
                    <div className="section">
                      <div className="numbered-rows-wrapper">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Procedure Details')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`section-copy-btn${copiedId === `procedure-details-${idx}` ? ' copied' : ''}`}
                              onClick={() => copyToClipboard(getProcedureDetailsText(record, idx), `procedure-details-${idx}`)}
                            >
                              {copiedId === `procedure-details-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, idx, 'procedureDetails')}
                          </div>
                        </div>
                        {/* Planned Date - EDITABLE (date picker) */}
                        {showPlannedDate && renderDateField(record, 'plannedDate', idx, 'procedureDetails', 'Planned Date', `plannedDate-${idx}`)}
                        {showSurgeon && renderEditableField(record, 'surgeon', idx, 'procedureDetails', 'Surgeon', `surgeon-${idx}`)}
                      </div>
                    </div>
                  );
                })()}

                {/* ─── Clinical Considerations ─────────────────────────── */}
                {shouldShowSection(record, 'Clinical Considerations', getClinicalConsiderationsSearchContent(record)) && (() => {
                  const sectionTitleMatches = searchTerm && shouldShowRow(record,
                    'clinical considerations', 'Clinical Considerations', 'CLINICAL CONSIDERATIONS');
                  const showAll = record._showAllSections || sectionTitleMatches;
                  const isSearching = searchTerm.trim();

                  const preops = getEffectiveArray(record, 'preoperativeConsiderations', idx);
                  const hasPreopConsiderations = preops.length > 0;
                  const anticoagVal = getEffective(record, 'anticoagulation', idx);
                  const showAnticoagulation = anticoagVal && (showAll || shouldShowRow(record, 'anticoagulation', 'Anticoagulation', 'ANTICOAGULATION', record.anticoagulation));
                  const tempAccessVal = getEffective(record, 'temporaryAccess', idx);
                  const showTemporaryAccess = tempAccessVal && (showAll || shouldShowRow(record, 'temporary access', 'Temporary Access', 'TEMPORARY ACCESS', record.temporaryAccess));

                  const filteredPreopConsiderations = hasPreopConsiderations
                    ? preops.filter((item) =>
                        !isSearching || showAll || shouldShowRow(record, 'preoperative considerations', 'Preoperative Considerations', item)
                      )
                    : [];

                  if (!(filteredPreopConsiderations.length > 0 || showAnticoagulation || showTemporaryAccess)) return null;

                  return (
                    <div className="section">
                      <div className="numbered-rows-wrapper">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Clinical Considerations')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`section-copy-btn${copiedId === `clinical-considerations-${idx}` ? ' copied' : ''}`}
                              onClick={() => copyToClipboard(getClinicalConsiderationsText(record, idx), `clinical-considerations-${idx}`)}
                            >
                              {copiedId === `clinical-considerations-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, idx, 'clinicalConsiderations')}
                          </div>
                        </div>
                        {filteredPreopConsiderations.length > 0 && (
                          <div className="subsection">
                            <div className="subsection-title">{highlightText('Preoperative Considerations')}</div>
                            <div className="subsection-items">
                              {filteredPreopConsiderations.map((item, itemIdx) =>
                                renderEditableArrayItem(record, 'preoperativeConsiderations', idx, 'clinicalConsiderations', itemIdx, item, `preop-${idx}-${itemIdx}`)
                              )}
                            </div>
                          </div>
                        )}
                        {showAnticoagulation && renderEditableField(record, 'anticoagulation', idx, 'clinicalConsiderations', 'Anticoagulation', `anticoagulation-${idx}`)}
                        {showTemporaryAccess && renderEditableField(record, 'temporaryAccess', idx, 'clinicalConsiderations', 'Temporary Access', `temporaryAccess-${idx}`)}
                      </div>
                    </div>
                  );
                })()}

                {/* ─── Follow-Up ───────────────────────────────────────── */}
                {shouldShowSection(record, 'Follow-Up', getFollowUpSearchContent(record)) && (() => {
                  const sectionTitleMatches = searchTerm && shouldShowRow(record,
                    'follow-up', 'Follow-Up', 'FOLLOW-UP', 'follow up', 'Follow Up', 'FOLLOW UP');
                  const showAll = record._showAllSections || sectionTitleMatches;

                  const matTimeVal = getEffective(record, 'maturationTime', idx);
                  const showMaturationTime = matTimeVal && (showAll || shouldShowRow(record, 'maturation time', 'Maturation Time', 'MATURATION TIME', record.maturationTime));
                  const followUpVal = getEffective(record, 'followUp', idx);
                  const showFollowUp = followUpVal && (showAll || shouldShowRow(record, 'follow up', 'Follow Up', 'FOLLOW UP', record.followUp));

                  if (!(showMaturationTime || showFollowUp)) return null;

                  return (
                    <div className="section">
                      <div className="numbered-rows-wrapper">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Follow-Up')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`section-copy-btn${copiedId === `follow-up-${idx}` ? ' copied' : ''}`}
                              onClick={() => copyToClipboard(getFollowUpText(record, idx), `follow-up-${idx}`)}
                            >
                              {copiedId === `follow-up-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, idx, 'followUp')}
                          </div>
                        </div>
                        {showMaturationTime && renderEditableField(record, 'maturationTime', idx, 'followUp', 'Maturation Time', `maturationTime-${idx}`)}
                        {showFollowUp && renderSentenceEditableField(record, 'followUp', idx, 'followUp', 'Follow-Up Plan', `followUp-${idx}`)}
                      </div>
                    </div>
                  );
                })()}

                {/* ─── Notes ───────────────────────────────────────────── */}
                {(() => {
                  const notesVal = getEffective(record, 'notes', idx);
                  if (!notesVal) return null;
                  if (!shouldShowSection(record, 'Notes', `notes Notes NOTES ${record.notes}`)) return null;

                  const sectionTitleMatches = searchTerm && shouldShowRow(record, 'notes', 'Notes', 'NOTES');
                  const showAll = record._showAllSections || sectionTitleMatches;
                  const showNotes = showAll || shouldShowRow(record, 'notes', 'Notes', 'NOTES', record.notes);

                  if (!showNotes) return null;

                  return (
                    <div className="section">
                      <div className="numbered-rows-wrapper">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Notes')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`section-copy-btn${copiedId === `notes-${idx}` ? ' copied' : ''}`}
                              onClick={() => copyToClipboard(getNotesText(record, idx), `notes-${idx}`)}
                            >
                              {copiedId === `notes-${idx}` ? 'Copied!' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, idx, 'notes')}
                          </div>
                        </div>
                        {renderSentenceEditableField(record, 'notes', idx, 'notes', null, `notes-field-${idx}`)}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AccessPlanningDocument;
