/**
 * AirwayManagementDocument.jsx
 * March 2026 - Blue Glow Theme with inline editing
 * Per-section approve, per-sentence editing, pdfData memo
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import AirwayManagementPDFTemplate from '../pdf-templates/AirwayManagementPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './AirwayManagementDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'airway_management_recordsPendingEdits';
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
  assessment: ['airwayAssessmentScore', 'thyromentalDistance', 'mouthOpeningDistance', 'neckCircumference', 'neckMobilityRestriction'],
  intubation: ['intubationMethod', 'laryngoscopeBladeType', 'endotrachealTubeSize', 'endotrachealTubeType', 'tubeDepthAtTeeth', 'cormackLehaneGrade', 'intubationAttempts'],
  induction: ['preoxygenationMethod', 'inductionAgents', 'neuromusculatBlocker'],
  flags: ['rapidSequenceIntubation', 'cricoidPressureApplied', 'difficultAirwayEncountered'],
  devices: ['alternativeAirwayDevices', 'tubePlacementConfirmation'],
  postIntubation: ['endTidalCO2Value', 'cuffPressure', 'oxygenSaturationPostIntubation', 'extubationTime'],
  complications: ['complicationsDuringIntubation'],
};

const FIELD_LABELS = {
  airwayAssessmentScore: 'Airway Assessment Score',
  thyromentalDistance: 'Thyromental Distance (cm)',
  mouthOpeningDistance: 'Mouth Opening (cm)',
  neckCircumference: 'Neck Circumference (cm)',
  neckMobilityRestriction: 'Neck Mobility Restriction',
  intubationMethod: 'Intubation Method',
  laryngoscopeBladeType: 'Laryngoscope Blade',
  endotrachealTubeSize: 'ET Tube Size',
  endotrachealTubeType: 'ET Tube Type',
  tubeDepthAtTeeth: 'Tube Depth at Teeth (cm)',
  cormackLehaneGrade: 'Cormack-Lehane Grade',
  intubationAttempts: 'Intubation Attempts',
  preoxygenationMethod: 'Preoxygenation Method',
  inductionAgents: 'Induction Agents',
  neuromusculatBlocker: 'Neuromuscular Blocker',
  rapidSequenceIntubation: 'Rapid Sequence Intubation',
  cricoidPressureApplied: 'Cricoid Pressure Applied',
  difficultAirwayEncountered: 'Difficult Airway',
  alternativeAirwayDevices: 'Alternative Airway Devices',
  tubePlacementConfirmation: 'Tube Placement Confirmation',
  endTidalCO2Value: 'End-Tidal CO2',
  cuffPressure: 'Cuff Pressure',
  oxygenSaturationPostIntubation: 'SpO2 Post-Intubation',
  extubationTime: 'Extubation Time',
  complicationsDuringIntubation: 'Complications During Intubation',
};

const SENTENCE_FIELDS = ['inductionAgents', 'alternativeAirwayDevices', 'tubePlacementConfirmation', 'complicationsDuringIntubation'];
const BOOLEAN_FIELDS = ['neckMobilityRestriction', 'rapidSequenceIntubation', 'cricoidPressureApplied', 'difficultAirwayEncountered'];
// Schema-typed numeric fields — edited via number input, zero treated as "no value"
const NUMBER_FIELDS = ['thyromentalDistance', 'mouthOpeningDistance', 'neckCircumference', 'endotrachealTubeSize', 'tubeDepthAtTeeth', 'intubationAttempts', 'endTidalCO2Value', 'cuffPressure', 'oxygenSaturationPostIntubation'];
// Per-field display units appended to numeric values
const NUMBER_UNITS = {
  thyromentalDistance: 'cm',
  mouthOpeningDistance: 'cm',
  neckCircumference: 'cm',
  tubeDepthAtTeeth: 'cm',
  endTidalCO2Value: 'mmHg',
  cuffPressure: 'cmH2O',
  oxygenSaturationPostIntubation: '%',
};
// Schema-typed Date fields — edited via date picker
const DATE_FIELDS = ['extubationTime'];

const AirwayManagementDocument = ({ document }) => {
  const templateData = document;
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const textareaRef = useRef(null);
  const containerRef = useRef(null);

  const canEdit = true;

  // ========== DATA UNWRAPPING ==========
  const unwrappedData = useMemo(() => {
    if (!templateData) return [];
    if (Array.isArray(templateData)) {
      if (templateData.length > 0 && templateData[0]?.airway_management_records) {
        return templateData.flatMap(item => item.airway_management_records || []);
      }
      return templateData;
    }
    if (templateData.airway_management_records) return templateData.airway_management_records;
    if (templateData.documentData?.airway_management_records) return templateData.documentData.airway_management_records;
    return [templateData];
  }, [templateData]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    unwrappedData.forEach((rec, idx) => {
      const recordId = rec && (rec._id?.$oid || rec._id);
      const recDrafts = recordId ? store[recordId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        // fieldPart is "field" (no dotted/array fields in this template) → editKey = "field-idx"
        const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
        const editKey = `${baseField}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = true;
        nSentences[`${baseField}-${idx}-s0`] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [unwrappedData]);

  // ========== pdfData MEMO ==========
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return unwrappedData;
    return unwrappedData.map((rec, idx) => {
      const merged = { ...rec };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldName = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx === idx) merged[fieldName] = editVal;
      }
      return merged;
    });
  }, [unwrappedData, localEdits, pendingEdits]);

  // ========== HELPERS ==========
  const hasValue = (val) => {
    if (val === null || val === undefined || val === '') return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'string') return val.trim().length > 0;
    return true;
  };

  // Numeric "show" check — zero is treated as "no value" (extractor default for unmeasured)
  const numberShows = (val) => {
    if (val === null || val === undefined || val === '') return false;
    const n = parseFloat(val);
    return !isNaN(n) && n !== 0;
  };

  const formatNumber = (fieldName, val) => {
    const n = parseFloat(val);
    if (isNaN(n)) return '';
    const unit = NUMBER_UNITS[fieldName];
    return unit ? `${n} ${unit}` : String(n);
  };

  const formatBoolean = (val) => {
    if (val === true || val === 'true' || val === 'Yes') return 'Yes';
    if (val === false || val === 'false' || val === 'No') return 'No';
    return val != null ? String(val) : '';
  };

  const getFieldValue = (record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    const raw = record[fieldName];
    if (Array.isArray(raw)) return raw.join('. ');
    return raw;
  };

  const formatDate = (d) => {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // ========== SPLIT BY SENTENCE ==========
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
    if (!text || typeof text !== 'string') return [];
    const result = [];
    let current = '';
    let parenDepth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') parenDepth++;
      else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
      if (ch === ',' && parenDepth === 0) {
        const trimmed = current.trim();
        if (trimmed) result.push(trimmed);
        current = '';
      } else {
        current += ch;
      }
    }
    const trimmed = current.trim();
    if (trimmed) result.push(trimmed);
    return result;
  };

  const parseLabel = (text) => {
    if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
    const match = text.match(/^([^:]{2,40}):\s*(.+)/);
    if (match) return { isLabeled: true, label: match[1].trim(), value: match[2].trim() };
    return { isLabeled: false, label: '', value: text };
  };

  // ========== SEARCH ==========
  const stm = (...titles) => {
    if (!searchTerm.trim()) return true;
    const p = searchTerm.toLowerCase().trim();
    return titles.some(title => {
      if (!title) return false;
      const t = title.toLowerCase();
      return t.startsWith(p) || p.startsWith(t);
    });
  };

  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || !text) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = String(text).split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i}>{part}</mark> : part
    );
  }, [searchTerm]);

  const shouldShowRow = useCallback((record, ...valuesToCheck) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    for (const val of valuesToCheck) {
      if (val && String(val).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm]);

  const shouldShowSection = (record, sectionId, title, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    if (stm(title)) return true;
    const fields = SECTION_FIELDS[sectionId] || [];
    return fields.some(f => {
      const label = FIELD_LABELS[f] || '';
      if (stm(label)) return true;
      const val = getCopyValue(record, f, idx);
      return val !== null && shouldShowRow(record, label, String(val));
    });
  };

  // ========== COPY ==========
  const copyToClipboard = useCallback(async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      const textarea = window.document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      (containerRef.current || window.document.body).appendChild(textarea);
      textarea.select();
      window.document.execCommand('copy');
      (containerRef.current || window.document.body).removeChild(textarea);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, []);

  // ========== EDITING HANDLERS ==========
  const handleStartEdit = useCallback((fieldName, idx, currentValue, sentenceIdx = 0) => {
    const editKey = `${fieldName}-${idx}-s${sentenceIdx}`;
    setEditingField(editKey);
    const cleanValue = (currentValue || '').replace(/[.;]+$/, '').trim();
    setEditValue(cleanValue);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, sentenceIdx, valueOverride, editTrackingKey) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) { console.error('Cannot save — no record _id'); return; }
    const saveValue = valueOverride !== undefined ? valueOverride : editValue.trim();
    const sKey = editTrackingKey || `${fieldName}-${idx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;
    const fullEditKey = `${fieldName}-${idx}`;

    setLocalEdits(prev => ({ ...prev, [fullEditKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [fullEditKey]: true }));
    setEditedFields(prev => ({ ...prev, [fullEditKey]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    // Re-edit after approval → drop this section's 'approved' flag so the button goes back to yellow
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
    const sourceText = hasFullEdit ? localEdits[fullEditKey] : String(getFieldValue(record, fieldName, idx) || '');
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

  // ========== APPROVE ==========
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
  const handleApproveSection = useCallback(async (record, sectionId, idx) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) return;
    const key = `${sectionId}-${idx}`;
    const isApproved = approvedSections[key];
    if (isApproved) return; // Already approved — no toggle back
    const fields = SECTION_FIELDS[sectionId] || [];
    const suffix = `-${idx}`;
    // Staged edits for THIS section's fields only (editKey = "field-idx")
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fieldPart = k.slice(0, -suffix.length); // "field" or "field.arrayIndex"
      const lastDot = fieldPart.lastIndexOf('.');
      const baseField = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1)))
        ? fieldPart.slice(0, lastDot)
        : fieldPart;
      return fields.includes(baseField);
    });
    try {
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        const isArr = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        const payload = { field: isArr ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArr) payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        await secureApiClient.put(`/api/edit/airway_management_records/${recordId}/edit`, payload);
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/airway_management_records/${recordId}/approve`, {
        sectionId,
        approved: true,
      });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's drafts for committed fields from localStorage (now committed)
      const store = readDrafts();
      if (store[recordId]) {
        toCommit.forEach(editKey => {
          const fieldPart = editKey.slice(0, -suffix.length);
          const lastDot = fieldPart.lastIndexOf('.');
          const baseField = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1)))
            ? fieldPart.slice(0, lastDot)
            : fieldPart;
          delete store[recordId][baseField];
        });
        if (Object.keys(store[recordId]).length === 0) delete store[recordId];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [key]: true }));
      // When approving, clear edited markers for this section's fields
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
    }
  }, [approvedSections, localEdits, pendingEdits]);

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

  // ========== COPY SECTION TEXT ==========
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

  // Resolve a field's copyable display string, honoring number hide-zero+units and date formatting.
  // Returns null when the field has no displayable value.
  const getCopyValue = (record, fieldName, idx) => {
    if (BOOLEAN_FIELDS.includes(fieldName)) {
      const editKey = `${fieldName}-${idx}`;
      const rv = localEdits[editKey] !== undefined ? localEdits[editKey] : record[fieldName];
      return hasValue(rv) ? formatBoolean(rv) : null;
    }
    if (NUMBER_FIELDS.includes(fieldName)) {
      const editKey = `${fieldName}-${idx}`;
      const rv = localEdits[editKey] !== undefined ? localEdits[editKey] : record[fieldName];
      return numberShows(rv) ? formatNumber(fieldName, rv) : null;
    }
    if (DATE_FIELDS.includes(fieldName)) {
      const editKey = `${fieldName}-${idx}`;
      const rv = localEdits[editKey] !== undefined ? localEdits[editKey] : record[fieldName];
      return hasValue(rv) ? formatDate(rv) : null;
    }
    const val = getFieldValue(record, fieldName, idx);
    return hasValue(val) ? val : null;
  };

  const getSectionText = (record, sectionId, idx) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return '';
    const lines = [];
    fields.forEach(f => {
      const val = getCopyValue(record, f, idx);
      if (val === null) return;
      const label = FIELD_LABELS[f] || f;
      const text = String(val);
      const isSentence = SENTENCE_FIELDS.includes(f);
      const needsFormat = isSentence && (splitBySentence(text).length > 1 || splitByComma(text).length >= 2);
      if (needsFormat) {
        lines.push(`${label}:`);
        formatSentenceFieldLines(text).forEach(l => lines.push(`  ${l}`));
      } else {
        lines.push(`${label}: ${val}`);
      }
    });
    return lines.join('\n');
  };

  const getBooleanSectionText = (record, fields, idx) => {
    const lines = [];
    fields.forEach(f => {
      const val = getCopyValue(record, f, idx);
      if (val !== null) lines.push(`${FIELD_LABELS[f]}: ${val}`);
    });
    return lines.join('\n');
  };

  const getAllRecordText = (record, idx) => {
    const lines = [];
    // Assessment
    const assessFields = [...(SECTION_FIELDS.assessment || [])];
    assessFields.forEach(f => {
      const val = getCopyValue(record, f, idx);
      if (val !== null) lines.push(`${FIELD_LABELS[f]}: ${val}`);
    });
    // Intubation
    (SECTION_FIELDS.intubation || []).forEach(f => {
      const val = getCopyValue(record, f, idx);
      if (val !== null) lines.push(`${FIELD_LABELS[f]}: ${val}`);
    });
    // Induction
    (SECTION_FIELDS.induction || []).forEach(f => {
      const val = getFieldValue(record, f, idx);
      if (hasValue(val)) {
        const text = String(val);
        const isSentence = SENTENCE_FIELDS.includes(f);
        const needsFormat = isSentence && (splitBySentence(text).length > 1 || splitByComma(text).length >= 2);
        if (needsFormat) {
          lines.push(`${FIELD_LABELS[f]}:`);
          formatSentenceFieldLines(text).forEach(l => lines.push(`  ${l}`));
        } else {
          lines.push(`${FIELD_LABELS[f]}: ${val}`);
        }
      }
    });
    // Flags
    (SECTION_FIELDS.flags || []).forEach(f => {
      const val = getCopyValue(record, f, idx);
      if (val !== null) lines.push(`${FIELD_LABELS[f]}: ${val}`);
    });
    // Devices
    (SECTION_FIELDS.devices || []).forEach(f => {
      const val = getFieldValue(record, f, idx);
      if (hasValue(val)) {
        const text = String(val);
        const isSentence = SENTENCE_FIELDS.includes(f);
        const needsFormat = isSentence && (splitBySentence(text).length > 1 || splitByComma(text).length >= 2);
        if (needsFormat) {
          lines.push(`${FIELD_LABELS[f]}:`);
          formatSentenceFieldLines(text).forEach(l => lines.push(`  ${l}`));
        } else {
          lines.push(`${FIELD_LABELS[f]}: ${val}`);
        }
      }
    });
    // Post-Intubation
    (SECTION_FIELDS.postIntubation || []).forEach(f => {
      const val = getCopyValue(record, f, idx);
      if (val !== null) lines.push(`${FIELD_LABELS[f]}: ${val}`);
    });
    // Complications
    const compVal = getFieldValue(record, 'complicationsDuringIntubation', idx);
    if (hasValue(compVal)) {
      const text = String(compVal);
      const needsFormat = splitBySentence(text).length > 1 || splitByComma(text).length >= 2;
      if (needsFormat) {
        lines.push('Complications During Intubation:');
        formatSentenceFieldLines(text).forEach(l => lines.push(`  ${l}`));
      } else {
        lines.push(`Complications During Intubation: ${compVal}`);
      }
    }
    return lines.join('\n');
  };

  // ========== RENDER NUMBER FIELD (typed numeric input, hide-zero) ==========
  const renderNumberField = (record, fieldName, idx, sectionId) => {
    const editKey = `${fieldName}-${idx}`;
    const rawEdit = localEdits[editKey];
    const rawVal = rawEdit !== undefined ? rawEdit : record[fieldName];
    if (!numberShows(rawVal)) return null;
    const label = FIELD_LABELS[fieldName] || fieldName;
    const display = formatNumber(fieldName, rawVal);
    const sKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === sKey;
    const isEdited = editedSentences[sKey] === 'edited' || editedFields[editKey];
    const unit = NUMBER_UNITS[fieldName];

    const doSave = () => {
      const n = parseFloat(editValue);
      if (isNaN(n)) return; // invalid → keep editing
      handleSaveField(record, fieldName, idx, sectionId, 0, n);
    };

    return (
      <div key={fieldName} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="number-edit-row">
                <input
                  type="number"
                  step="any"
                  className="edit-number"
                  value={editValue}
                  autoFocus
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') doSave();
                    if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                  }}
                  disabled={saving}
                />
                {unit && <span className="number-edit-unit">{unit}</span>}
              </div>
              <div className="edit-actions">
                <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                <button className="save-btn" onClick={doSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                className={`row-content${canEdit ? ' editable' : ''}`}
                onClick={() => canEdit && (setEditingField(sKey), setEditValue(String(parseFloat(rawVal))))}
              >
                <span className="content-value">{highlightText(display)}</span>
                {canEdit && !isEdited && <span className="edit-indicator">✎</span>}
              </div>
              <button
                className={`copy-btn${copiedId === editKey ? ' copied' : ''}`}
                onClick={() => copyToClipboard(`${label}: ${display}`, editKey)}
              >
                {copiedId === editKey ? 'Copied' : 'Copy'}
              </button>
            </>
          )}
        </div>
        {isEdited && <div className="modified-badge">edited — click pending approve to save</div>}
      </div>
    );
  };

  // ========== RENDER DATE FIELD (typed date picker) ==========
  const toDateInputValue = (d) => {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  };

  const renderDateField = (record, fieldName, idx, sectionId) => {
    const editKey = `${fieldName}-${idx}`;
    const rawEdit = localEdits[editKey];
    const rawVal = rawEdit !== undefined ? rawEdit : record[fieldName];
    if (!hasValue(rawVal)) return null;
    const label = FIELD_LABELS[fieldName] || fieldName;
    const display = formatDate(rawVal);
    const sKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === sKey;
    const isEdited = editedSentences[sKey] === 'edited' || editedFields[editKey];

    const doSave = () => {
      handleSaveField(record, fieldName, idx, sectionId, 0, editValue);
    };

    return (
      <div key={fieldName} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
          {isEditing ? (
            <div className="edit-field-container">
              <input
                type="date"
                className="edit-date"
                value={editValue}
                autoFocus
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') doSave();
                  if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                }}
                disabled={saving}
              />
              <div className="edit-actions">
                <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                <button className="save-btn" onClick={doSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                className={`row-content${canEdit ? ' editable' : ''}`}
                onClick={() => canEdit && (setEditingField(sKey), setEditValue(toDateInputValue(rawVal)))}
              >
                <span className="content-value">{highlightText(display)}</span>
                {canEdit && !isEdited && <span className="edit-indicator">✎</span>}
              </div>
              <button
                className={`copy-btn${copiedId === editKey ? ' copied' : ''}`}
                onClick={() => copyToClipboard(`${label}: ${display}`, editKey)}
              >
                {copiedId === editKey ? 'Copied' : 'Copy'}
              </button>
            </>
          )}
        </div>
        {isEdited && <div className="modified-badge">edited — click pending approve to save</div>}
      </div>
    );
  };

  // ========== RENDER EDITABLE FIELD ==========
  const renderEditableField = (record, fieldName, idx, sectionId) => {
    const val = getFieldValue(record, fieldName, idx);
    if (!hasValue(val)) return null;
    const label = FIELD_LABELS[fieldName] || fieldName;
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const isEdited = editedSentences[editKey] === 'edited';
    const copyId = `${fieldName}-${idx}`;

    return (
      <div key={fieldName} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
          {isEditing ? (
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
                <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                <button className="save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId, 0)} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                className={`row-content${canEdit ? ' editable' : ''}`}
                onClick={() => canEdit && handleStartEdit(fieldName, idx, String(val))}
              >
                <span className="content-value">{highlightText(String(val))}</span>
                {canEdit && !isEdited && <span className="edit-indicator">✎</span>}
              </div>
              <button
                className={`copy-btn${copiedId === copyId ? ' copied' : ''}`}
                onClick={() => copyToClipboard(`${label}: ${val}`, copyId)}
              >
                {copiedId === copyId ? 'Copied' : 'Copy'}
              </button>
            </>
          )}
        </div>
        {isEdited && <div className="modified-badge">edited — click pending approve to save</div>}
      </div>
    );
  };

  // ========== RENDER BOOLEAN FIELD (editable Yes/No dropdown) ==========
  const renderBooleanField = (record, fieldName, idx, sectionId) => {
    const editKey = `${fieldName}-${idx}`;
    const rawVal = localEdits[editKey] !== undefined ? localEdits[editKey] : record[fieldName];
    if (!hasValue(rawVal)) return null;
    const label = FIELD_LABELS[fieldName] || fieldName;
    const formatted = formatBoolean(rawVal);
    const boolStr = (rawVal === true || rawVal === 'true' || rawVal === 'Yes') ? 'true' : 'false';
    const sKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === sKey;
    const isEdited = editedSentences[sKey] === 'edited' || editedFields[editKey];
    const copyId = `bool-${fieldName}-${idx}`;

    // Save the actual boolean (true/false) as a draft — committed on Pending Approve.
    const doSave = () => {
      handleSaveField(record, fieldName, idx, sectionId, 0, editValue === 'true');
    };

    return (
      <div key={fieldName} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
          {isEditing ? (
            <div className="edit-field-container">
              <select
                className="edit-select"
                value={editValue}
                autoFocus
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
                disabled={saving}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
              <div className="edit-actions">
                <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                <button className="save-btn" onClick={doSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                className={`row-content${canEdit ? ' editable' : ''}`}
                onClick={() => canEdit && (setEditingField(sKey), setEditValue(boolStr))}
              >
                <span className="content-value">{highlightText(formatted)}</span>
                {canEdit && !isEdited && <span className="edit-indicator">✎</span>}
              </div>
              <button
                className={`copy-btn${copiedId === copyId ? ' copied' : ''}`}
                onClick={() => copyToClipboard(`${label}: ${formatted}`, copyId)}
              >
                {copiedId === copyId ? 'Copied' : 'Copy'}
              </button>
            </>
          )}
        </div>
        {isEdited && <div className="modified-badge">edited — click pending approve to save</div>}
      </div>
    );
  };

  // ========== RENDER SENTENCE EDITABLE FIELD ==========
  const renderSentenceEditableField = (record, fieldName, idx, sectionId) => {
    const val = getFieldValue(record, fieldName, idx);
    if (!hasValue(val)) return null;
    const label = FIELD_LABELS[fieldName] || fieldName;
    const text = String(val);
    const sentences = splitBySentence(text);

    if (sentences.length <= 1 && splitByComma(text).length < 2) {
      return renderEditableField(record, fieldName, idx, sectionId);
    }

    return sentences.map((sentence, sIdx) => {
      const parsed = parseLabel(sentence);
      const textToSplit = parsed.isLabeled ? parsed.value : sentence;
      const displayParts = splitByComma(textToSplit);
      const origIdx = sIdx;
      const isSentenceEdited = editedSentences[`${fieldName}-${idx}-s${sIdx}`] === 'edited' ||
                                editedSentences[`${fieldName}-${idx}-s${sIdx}`] === 'added';
      const sentenceEditKey = `${fieldName}-${idx}-s${sIdx}`;
      const isSentenceEditing = editingField === sentenceEditKey;

      if (displayParts.length >= 2) {
        return (
          <div key={sIdx} className="rec-mini-card">
            {(sIdx === 0 || parsed.isLabeled) && (
              <div className="nested-subtitle">{highlightText(sIdx === 0 ? label : parsed.label)}</div>
            )}
            {displayParts.map((part, pi) => {
              const partEditKey = `${fieldName}-${idx}-s${origIdx}-p${pi}`;
              const isPartEditing = editingField === partEditKey;
              const isPartEdited = editedSentences[partEditKey] === 'edited';
              const partCopyId = `${fieldName}-${idx}-s${origIdx}-p${pi}`;
              const fullSentence = sentence;
              const itemLabel = parsed.isLabeled ? parsed.label : '';

              return (
                <React.Fragment key={partCopyId}>
                  <div className={`numbered-row${isPartEdited ? ' modified' : ''}`}>
                    {isPartEditing ? (
                      <div className="edit-field-container">
                        <textarea
                          ref={textareaRef}
                          className="edit-textarea"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                              const newParts = [...displayParts];
                              newParts[pi] = editValue.trim();
                              const filteredParts = newParts.filter(p => p.trim().length > 0);
                              const sourceText = String(getFieldValue(record, fieldName, idx) || '');
                              let replacement = '';
                              if (filteredParts.length > 0) {
                                replacement = parsed.isLabeled ? `${itemLabel}: ${filteredParts.join(', ')}` : filteredParts.join(', ');
                              }
                              const newFullText = replacement
                                ? sourceText.replace(fullSentence, replacement)
                                : sourceText.replace(fullSentence, '').replace(/\.\s*\./g, '.').replace(/\s{2,}/g, ' ').trim();
                              handleSaveField(record, fieldName, idx, sectionId, 0, newFullText, partEditKey);
                            }
                            if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                          }}
                          disabled={saving}
                        />
                        <div className="edit-actions">
                          <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                          <button className="save-btn" onClick={() => {
                            const newParts = [...displayParts];
                            newParts[pi] = editValue.trim();
                            const filteredParts = newParts.filter(p => p.trim().length > 0);
                            const sourceText = String(getFieldValue(record, fieldName, idx) || '');
                            let replacement = '';
                            if (filteredParts.length > 0) {
                              replacement = parsed.isLabeled ? `${itemLabel}: ${filteredParts.join(', ')}` : filteredParts.join(', ');
                            }
                            const newFullText = replacement
                              ? sourceText.replace(fullSentence, replacement)
                              : sourceText.replace(fullSentence, '').replace(/\.\s*\./g, '.').replace(/\s{2,}/g, ' ').trim();
                            handleSaveField(record, fieldName, idx, sectionId, 0, newFullText, partEditKey);
                          }} disabled={saving}>
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          className={`row-content${canEdit ? ' editable' : ''}`}
                          onClick={() => canEdit && handleStartEdit(fieldName, idx, part, origIdx * 1000 + pi)}
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
                      </>
                    )}
                  </div>
                  {isPartEdited && <div className="modified-badge">edited — click pending approve to save</div>}
                </React.Fragment>
              );
            })}
          </div>
        );
      }

      // Single item branch
      const singleContent = (
        <>
          {(sIdx === 0 || parsed.isLabeled) && (
            <div className="nested-subtitle">{highlightText(sIdx === 0 ? label : parsed.label)}</div>
          )}
          <div className={`numbered-row${isSentenceEdited ? ' modified' : ''}`}>
            {isSentenceEditing ? (
              <div className="edit-field-container">
                <textarea
                  ref={textareaRef}
                  className="edit-textarea"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveSentence(record, fieldName, idx, sectionId, sIdx);
                    if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                  }}
                  disabled={saving}
                />
                <div className="edit-actions">
                  <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                  <button className="save-btn" onClick={() => saveSentence(record, fieldName, idx, sectionId, sIdx)} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div
                  className={`row-content${canEdit ? ' editable' : ''}`}
                  onClick={() => canEdit && handleStartEdit(fieldName, idx, parsed.isLabeled ? parsed.value : sentence, sIdx)}
                >
                  <span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : sentence)}</span>
                  {canEdit && !isSentenceEdited && <span className="edit-indicator">✎</span>}
                </div>
                <button
                  className={`copy-btn${copiedId === sentenceEditKey ? ' copied' : ''}`}
                  onClick={() => copyToClipboard(parsed.isLabeled ? `${parsed.label}: ${parsed.value}` : sentence, sentenceEditKey)}
                >
                  {copiedId === sentenceEditKey ? 'Copied' : 'Copy'}
                </button>
              </>
            )}
          </div>
          {isSentenceEdited && <div className="modified-badge">edited — click pending approve to save</div>}
        </>
      );

      return parsed.isLabeled
        ? <div key={sIdx} className="rec-mini-card">{singleContent}</div>
        : <React.Fragment key={sIdx}>{singleContent}</React.Fragment>;
    });
  };

  // ========== RENDER SECTION ==========
  const renderSection = (record, idx, sectionId, title, fields, options = {}) => {
    if (!shouldShowSection(record, sectionId, title, idx)) return null;
    const { isBooleanSection } = options;
    const hasContent = fields.some(f => {
      if (BOOLEAN_FIELDS.includes(f)) return hasValue(record[f]);
      if (NUMBER_FIELDS.includes(f)) {
        const editKey = `${f}-${idx}`;
        const rv = localEdits[editKey] !== undefined ? localEdits[editKey] : record[f];
        return numberShows(rv);
      }
      return hasValue(getFieldValue(record, f, idx));
    });
    if (!hasContent) return null;

    const sectionCopyId = `section-${sectionId}-${idx}`;
    const sectionText = isBooleanSection
      ? getBooleanSectionText(record, fields, idx)
      : getSectionText(record, sectionId, idx);

    return (
      <div key={sectionId} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h3 className="section-title">{highlightText(title)}</h3>
            <div className="header-right-actions">
              <button
                className={`copy-btn${copiedId === sectionCopyId ? ' copied' : ''}`}
                onClick={() => copyToClipboard(sectionText, sectionCopyId)}
              >
                {copiedId === sectionCopyId ? 'Copied' : 'Copy Section'}
              </button>
              {renderApproveBtn(record, sectionId, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sectionId);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sectionId);
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sectionId);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sectionId);
            return renderEditableField(record, f, idx, sectionId);
          })}
        </div>
      </div>
    );
  };

  // ========== FILTERING ==========
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return unwrappedData.map((r, i) => ({ ...r, _originalIdx: i }));
    const phrase = searchTerm.toLowerCase().trim();
    return unwrappedData.map((record, i) => {
      const allLabels = Object.values(FIELD_LABELS);
      const allValues = Object.keys(FIELD_LABELS).map(k => {
        if (BOOLEAN_FIELDS.includes(k)) return formatBoolean(record[k]);
        const val = getCopyValue(record, k, i);
        return val !== null ? String(val) : '';
      });
      const searchableText = ['Airway Management', ...allLabels, ...allValues].filter(Boolean).join(' ').toLowerCase();
      if (searchableText.includes(phrase)) {
        return { ...record, _originalIdx: i, _showAllSections: allLabels.some(l => l.toLowerCase().startsWith(phrase) || phrase.startsWith(l.toLowerCase())) && !allValues.some(v => v.toLowerCase().includes(phrase)) ? false : false };
      }
      return null;
    }).filter(Boolean);
  }, [unwrappedData, searchTerm]);

  // ========== EMPTY STATE ==========
  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <div className="airway-management-document" ref={containerRef}>
        <div className="document-header">
          <h1 className="document-title">Airway Management Records</h1>
        </div>
        <div className="empty-state">No airway management records available.</div>
      </div>
    );
  }

  return (
    <div className="airway-management-document" ref={containerRef}>
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">Airway Management Records</h1>
        <div className="header-actions">
          <button
            className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`}
            onClick={() => {
              const allText = filteredRecords.map((r) => getAllRecordText(r, r._originalIdx)).join('\n\n---\n\n');
              copyToClipboard(allText, 'copy-all');
            }}
          >
            {copiedId === 'copy-all' ? 'Copied' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<AirwayManagementPDFTemplate document={pdfData} />}
            fileName={`airway-management-${new Date().toISOString().split('T')[0]}.pdf`}
          >
            {({ loading }) => (
              <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>
            )}
          </PDFDownloadLink>
        </div>
      </div>

      {/* Search */}
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search airway management records..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button className="clear-search" onClick={() => setSearchTerm('')}>x</button>
        )}
      </div>

      {/* Records */}
      <div className="records-container">
        {filteredRecords.length === 0 && searchTerm.trim() ? (
          <div className="no-results">No results for "{searchTerm}"</div>
        ) : (
          filteredRecords.map((record, rIdx) => {
            const idx = record._originalIdx !== undefined ? record._originalIdx : rIdx;
            return (
              <div key={record._id?.$oid || record._id || rIdx} className="record-card">
                {/* Record Header */}
                <div className="record-header">
                  <div className="header-top-row">
                    {record.date && <span className="date-badge">{formatDate(record.date)}</span>}
                    {record.createdAt && !record.date && <span className="date-badge">{formatDate(record.createdAt)}</span>}
                  </div>
                  <h2 className="record-title">{highlightText(`Airway Management Record ${rIdx + 1}`)}</h2>
                </div>

                {/* Airway Assessment */}
                {renderSection(record, idx, 'assessment', 'Airway Assessment', SECTION_FIELDS.assessment)}

                {/* Intubation Details */}
                {renderSection(record, idx, 'intubation', 'Intubation Details', SECTION_FIELDS.intubation)}

                {/* Preoxygenation & Induction */}
                {renderSection(record, idx, 'induction', 'Preoxygenation & Induction', SECTION_FIELDS.induction)}

                {/* Procedure Flags */}
                {renderSection(record, idx, 'flags', 'Procedure Flags', SECTION_FIELDS.flags, { isBooleanSection: true })}

                {/* Alternative Devices & Confirmation */}
                {renderSection(record, idx, 'devices', 'Alternative Devices & Confirmation', SECTION_FIELDS.devices)}

                {/* Post-Intubation Values */}
                {renderSection(record, idx, 'postIntubation', 'Post-Intubation Values', SECTION_FIELDS.postIntubation)}

                {/* Complications */}
                {renderSection(record, idx, 'complications', 'Complications', SECTION_FIELDS.complications)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AirwayManagementDocument;
