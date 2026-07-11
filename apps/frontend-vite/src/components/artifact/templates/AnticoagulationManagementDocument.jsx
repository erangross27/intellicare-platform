import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import AnticoagulationManagementDocumentPDFTemplate from '../pdf-templates/AnticoagulationManagementDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './AnticoagulationManagementDocument.css';

/**
 * AnticoagulationManagementDocument - Inline Editing Edition
 *
 * Sections with editing:
 * 1. Anticoagulation Information (anticoagulant, indication — editable; date/provider/facility — non-editable)
 * 2. INR Monitoring (targetInr, currentInr — editable)
 * 3. aPTT Monitoring (targetAptt, currentAptt — editable)
 * 4. Dosing (doseAdjustment — per-sentence, nextDose — simple)
 * 5. Clinical Events (bleedingEvents, thromboticEvents — per-sentence)
 * 6. Drug Interactions (array editing)
 * 7. Dietary Considerations (per-sentence)
 * 8. Treatment Duration (per-sentence)
 * 9. Follow-Up Testing (per-sentence)
 * 10. Notes (per-sentence)
 */

// ==================== SECTION_FIELDS for per-section approve ====================
const SECTION_FIELDS = {
  anticoagInfo: ['anticoagulant', 'indication'],
  inrMonitoring: ['targetInr', 'currentInr'],
  apttMonitoring: ['targetAptt', 'currentAptt'],
  dosing: ['doseAdjustment', 'nextDose'],
  clinicalEvents: ['bleedingEvents', 'thromboticEvents'],
  drugInteractions: ['drugInteractions'],
  dietaryConsiderations: ['dietaryConsiderations'],
  durationPlan: ['durationPlan'],
  followUpTesting: ['followUpTesting'],
  notes: ['notes'],
};

const NON_EDITABLE_FIELDS = ['date', 'provider', 'facility', 'createdAt', 'updatedAt', '_id', 'patientId'];

const SENTENCE_FIELDS = ['doseAdjustment', 'bleedingEvents', 'thromboticEvents', 'dietaryConsiderations', 'durationPlan', 'followUpTesting', 'notes'];

const ARRAY_FIELDS = ['drugInteractions'];

// ==================== PLAIN FUNCTIONS ====================

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<=[.;])\s+/).map(s => s.trim()).filter(s => s.length > 0);
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text];
  const parts = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) parts.push(trimmed);
      current = '';
    } else {
      current += ch;
    }
  }
  const trimmed = current.trim().replace(/[.;]\s*$/, '');
  if (trimmed) parts.push(trimmed);
  return parts.length > 1 ? parts : [text];
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

// Module-scope _id extraction (handles { $oid })
const extractRecordId = (record) => {
  const id = record && record._id;
  if (!id) return '';
  if (typeof id === 'string') return id;
  if (id.$oid) return id.$oid;
  return String(id);
};

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks (Pending) Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = editKey without the trailing "-<idx>") */
const DRAFT_KEY = 'anticoagulation_managementPendingEdits';
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

const AnticoagulationManagementDocument = ({ document: docProp }) => {
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
      if (item.anticoagulation_management) return item.anticoagulation_management;
      if (item.records) return item.records;
      return item;
    });
  } else if (templateData?.anticoagulation_management) {
    records = Array.isArray(templateData.anticoagulation_management) ? templateData.anticoagulation_management : [templateData.anticoagulation_management];
  } else if (templateData?.documentData?.anticoagulation_management) {
    records = Array.isArray(templateData.documentData.anticoagulation_management) ? templateData.documentData.anticoagulation_management : [templateData.documentData.anticoagulation_management];
  } else if (templateData?.documentData) {
    records = Array.isArray(templateData.documentData) ? templateData.documentData : [templateData.documentData];
  } else if (templateData && typeof templateData === 'object') {
    records = [templateData];
  }
  records = records.filter(r => r && Object.keys(r).length > 0);

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
      if (pendingEdits[itemKey]) return; // pending drafts stay OUT of committed/PDF output
      if (localEdits[itemKey] !== undefined) arr[itemIdx] = localEdits[itemKey];
    });
    return arr;
  };

  // ==================== pdfData MEMO — merges localEdits into records ====================
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const merged = { ...record };
      // Merge simple/sentence field edits
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldPart = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx === idx && !fieldPart.includes('-')) {
          if (fieldPart.includes('.')) {
            const [parent, child] = fieldPart.split('.');
            merged[parent] = { ...(merged[parent] || {}), [child]: editVal };
          } else {
            merged[fieldPart] = editVal;
          }
        }
      }
      // Merge array item edits using getEffectiveArray
      ARRAY_FIELDS.forEach(field => {
        merged[field] = getEffectiveArray(record, field, idx);
      });
      return merged;
    });
  }, [records, localEdits, pendingEdits]);

  // ==================== SAFE _id EXTRACTION ====================
  const getRecordId = (record) => extractRecordId(record);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  // Draft fieldPart convention (reverse of handleSaveField's storage):
  //   "field"        -> simple/sentence editKey  `${field}-${idx}`        (fields marker keyed `${field}-${idx}`)
  //   "field.item"   -> array-item editKey        `${field}-${idx}-${item}` (item segment is purely numeric)
  const recordIdsSig = records.map(r => extractRecordId(r)).join('|');
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const rid = extractRecordId(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const dotIdx = fieldPart.indexOf('.');
        if (dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1))) {
          // array item: field.item -> field-idx-item
          const field = fieldPart.slice(0, dotIdx);
          const item = fieldPart.slice(dotIdx + 1);
          const editKey = `${field}-${idx}-${item}`;
          nLocal[editKey] = value;
          nPending[editKey] = true;
          nFields[editKey] = 'edited';
        } else {
          // simple/sentence: field -> field-idx
          const editKey = `${fieldPart}-${idx}`;
          nLocal[editKey] = value;
          nPending[editKey] = true;
          nFields[editKey] = 'edited';
          nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordIdsSig]);

  // ==================== SEARCH ====================
  const stm = (sectionTitle) => {
    if (!searchTerm.trim()) return false;
    const sl = searchTerm.toLowerCase().trim();
    const tl = (sectionTitle || '').toLowerCase().trim();
    return tl.startsWith(sl) || sl.startsWith(tl);
  };

  const shouldShowRow = (record, ...values) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;
    const searchLower = searchTerm.toLowerCase().trim();
    const combinedText = values.map(v => safeString(v)).filter(Boolean).join(' ').toLowerCase();
    return combinedText.includes(searchLower);
  };

  const shouldShowSection = (record, sectionTitle, ...sectionContent) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;
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
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) {
      return records.map(record => ({ ...record, _showAllSections: false }));
    }
    const searchLower = searchTerm.toLowerCase().trim();

    return records.map((record, idx) => {
      const docTitle = `Anticoagulation Management ${idx + 1}`;
      if (docTitle.toLowerCase().includes(searchLower)) {
        return { ...record, _showAllSections: true };
      }

      // Check anticoagulant name match
      if (record.anticoagulant) {
        const anticoagulantLower = record.anticoagulant.toLowerCase();
        if (searchLower.includes(anticoagulantLower) || anticoagulantLower.includes(searchLower)) {
          return { ...record, _showAllSections: true };
        }
      }

      const searchableText = [
        docTitle,
        'Anticoagulation Information', 'INR Monitoring', 'aPTT Monitoring',
        'Dosing', 'Clinical Events', 'Drug Interactions', 'Dietary Considerations',
        'Treatment Duration', 'Follow-Up Testing', 'Notes',
        'Anticoagulant', 'Indication', 'Target INR', 'Current INR',
        'Target aPTT', 'Current aPTT', 'Dose Adjustment', 'Next Dose',
        'Bleeding Events', 'Thrombotic Events', 'Duration Plan', 'Follow Up Testing',
        'Provider', 'Facility',
        record.anticoagulant, record.indication,
        record.targetInr, record.currentInr,
        record.targetAptt, record.currentAptt,
        record.doseAdjustment, record.nextDose,
        record.bleedingEvents, record.thromboticEvents,
        record.dietaryConsiderations, record.durationPlan,
        record.followUpTesting, record.provider, record.facility,
        record.notes, formatDate(record.date),
        record.drugInteractions ? record.drugInteractions.join(' ') : '',
      ].filter(Boolean).join(' ').toLowerCase();

      return searchableText.includes(searchLower) ? { ...record, _showAllSections: false } : null;
    }).filter(Boolean);
  }, [records, searchTerm]);

  // ==================== CLIPBOARD HELPERS ====================
  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = window.document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      window.document.body.appendChild(ta);
      ta.select();
      try { window.document.execCommand('copy'); } catch {}
      window.document.body.removeChild(ta);
    }
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // ==================== FORMAT HELPERS ====================
  const formatSentenceFieldLines = (text) => {
    const sentences = splitBySentence(text);
    const lines = [];
    let n = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        const commaItems = splitByComma(parsed.value);
        if (commaItems.length > 1) {
          lines.push(`${parsed.label}:`);
          commaItems.forEach(item => { lines.push(`  ${n++}. ${item}`); });
        } else {
          lines.push(`${n++}. ${s}`);
        }
      } else {
        lines.push(`${n++}. ${s}`);
      }
    });
    return lines;
  };

  // Copy All — uses pdfData (includes localEdits)
  const copyAll = () => {
    let text = '=== ANTICOAGULATION MANAGEMENT ===\n\n';

    pdfData.forEach((record, idx) => {
      text += `Anticoagulation Management ${idx + 1}\n`;
      text += `${'='.repeat(50)}\n\n`;

      // Anticoagulation Information
      if (record.anticoagulant) text += `ANTICOAGULANT: ${record.anticoagulant}\n`;
      if (record.indication) text += `INDICATION: ${record.indication}\n`;
      if (record.date) text += `DATE: ${formatDate(record.date)}\n`;
      if (record.provider) text += `PROVIDER: ${record.provider}\n`;
      if (record.facility) text += `FACILITY: ${record.facility}\n`;
      text += '\n';

      // INR Monitoring
      if (record.targetInr || record.currentInr) {
        text += 'INR MONITORING:\n';
        text += `${'─'.repeat(40)}\n`;
        if (record.targetInr) text += `  Target INR: ${record.targetInr}\n`;
        if (record.currentInr) text += `  Current INR: ${record.currentInr}\n`;
        text += '\n';
      }

      // aPTT Monitoring
      if (record.targetAptt || record.currentAptt) {
        text += 'APTT MONITORING:\n';
        text += `${'─'.repeat(40)}\n`;
        if (record.targetAptt) text += `  Target aPTT: ${record.targetAptt}\n`;
        if (record.currentAptt) text += `  Current aPTT: ${record.currentAptt}\n`;
        text += '\n';
      }

      // Dosing
      if (record.doseAdjustment || record.nextDose) {
        text += 'DOSING:\n';
        text += `${'─'.repeat(40)}\n`;
        if (record.doseAdjustment) {
          formatSentenceFieldLines(record.doseAdjustment).forEach(l => { text += `  ${l}\n`; });
        }
        if (record.nextDose) text += `  Next Dose: ${record.nextDose}\n`;
        text += '\n';
      }

      // Clinical Events
      if (record.bleedingEvents || record.thromboticEvents) {
        text += 'CLINICAL EVENTS:\n';
        text += `${'─'.repeat(40)}\n`;
        if (record.bleedingEvents) {
          text += '  Bleeding Events:\n';
          formatSentenceFieldLines(record.bleedingEvents).forEach(l => { text += `    ${l}\n`; });
        }
        if (record.thromboticEvents) {
          text += '  Thrombotic Events:\n';
          formatSentenceFieldLines(record.thromboticEvents).forEach(l => { text += `    ${l}\n`; });
        }
        text += '\n';
      }

      // Drug Interactions (grouped by label)
      const interactions = record.drugInteractions;
      if (interactions && interactions.length > 0) {
        text += 'DRUG INTERACTIONS:\n';
        text += `${'─'.repeat(40)}\n`;
        const diGroups = {};
        const diOrder = [];
        interactions.forEach(item => {
          const parsed = parseLabel(safeString(item));
          const key = parsed.isLabeled ? parsed.label : 'Other';
          if (!diGroups[key]) { diGroups[key] = []; diOrder.push(key); }
          diGroups[key].push(parsed.isLabeled ? parsed.value : safeString(item));
        });
        diOrder.forEach(key => {
          text += `  ${key}:\n`;
          diGroups[key].forEach((val, i) => { text += `    ${i + 1}. ${val}\n`; });
        });
        text += '\n';
      }

      // Dietary Considerations
      if (record.dietaryConsiderations) {
        text += 'DIETARY CONSIDERATIONS:\n';
        text += `${'─'.repeat(40)}\n`;
        formatSentenceFieldLines(record.dietaryConsiderations).forEach(l => { text += `  ${l}\n`; });
        text += '\n';
      }

      // Duration Plan
      if (record.durationPlan) {
        text += 'TREATMENT DURATION:\n';
        text += `${'─'.repeat(40)}\n`;
        formatSentenceFieldLines(record.durationPlan).forEach(l => { text += `  ${l}\n`; });
        text += '\n';
      }

      // Follow-Up Testing
      if (record.followUpTesting) {
        text += 'FOLLOW-UP TESTING:\n';
        text += `${'─'.repeat(40)}\n`;
        formatSentenceFieldLines(record.followUpTesting).forEach(l => { text += `  ${l}\n`; });
        text += '\n';
      }

      // Notes
      if (record.notes) {
        text += 'NOTES:\n';
        text += `${'─'.repeat(40)}\n`;
        formatSentenceFieldLines(record.notes).forEach(l => { text += `  ${l}\n`; });
        text += '\n';
      }

      text += '\n' + '='.repeat(80) + '\n\n';
    });

    copyToClipboard(text, 'all');
    setCopyAllStatus('copied');
    setTimeout(() => setCopyAllStatus('idle'), 2000);
  };

  // ==================== EDITING HELPERS ====================
  const sectionHasEdits = (sectionId, idx) => {
    const fields = SECTION_FIELDS[sectionId] || [];
    for (const k of Object.keys(editedSentences)) {
      if (fields.some(fld => k.startsWith(`${fld}-${idx}-s`))) return true;
    }
    for (const k of Object.keys(editedFields)) {
      if (fields.some(fld => k.startsWith(`${fld}-${idx}`))) return true;
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
    // Draft fieldPart: "field.item" for array items, else "field" (reverse-mapped on rehydrate)
    const fieldPart = (arrayIndex !== undefined && arrayIndex !== null)
      ? `${fieldName}.${arrayIndex}`
      : fieldName;

    setLocalEdits(prev => ({ ...prev, [key]: fullValue }));
    setPendingEdits(prev => ({ ...prev, [key]: true }));
    setEditedFields(prev => ({ ...prev, [key]: 'edited' }));
    // Re-edit after approval → drop the section 'approved' flag so the button returns to yellow Pending Approve
    setApprovedSections(prev => {
      const u = { ...prev };
      delete u[`${sectionId}-${idx}`];
      return u;
    });

    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldPart] = fullValue;
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

    handleSaveField(record, fieldName, idx, sectionId, null, fullText, `${fieldName}-${idx}`);
  }

  // ==================== SAVE COMMA ITEM ====================
  function saveCommaItem(record, fieldName, idx, sectionId, sIdx, commaIdx, newItemText) {
    const currentValue = String(getFieldValue(record, fieldName, idx) || '');
    const currentSentences = splitBySentence(currentValue);
    const sentence = currentSentences[sIdx] || '';
    const parsed = parseLabel(sentence);
    if (!parsed.isLabeled) return;
    const items = splitByComma(parsed.value);
    items[commaIdx] = newItemText.trim();
    // Reconstruct sentence: "Label: item1, item2, item3."
    const rebuilt = `${parsed.label}: ${items.join(', ')}.`;
    const allSentences = [...currentSentences];
    allSentences[sIdx] = rebuilt;
    const fullText = reconstructFullText(allSentences);
    const commaKey = `${fieldName}-${idx}-s${sIdx}-c${commaIdx}`;
    setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' }));
    handleSaveField(record, fieldName, idx, sectionId, null, fullText, `${fieldName}-${idx}`);
  }

  // ==================== APPROVE SECTION ====================
  // Approve = COMMIT all staged drafts for this section/record to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF/Copy All. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sectionId, idx) => {
    const key = `${sectionId}-${idx}`;
    const isApproved = approvedSections[key];
    if (isApproved) return;

    const recordId = getRecordId(record);
    if (!recordId) return;

    const fields = SECTION_FIELDS[sectionId] || [];
    // Collect this section's staged (pending) editKeys: `${field}-${idx}` or `${field}-${idx}-${item}`
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k]) return false;
      return fields.some(fld => {
        if (k === `${fld}-${idx}`) return true;
        const prefix = `${fld}-${idx}-`;
        return k.startsWith(prefix) && /^\d+$/.test(k.slice(prefix.length));
      });
    });

    try {
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements)
      for (const editKey of toCommit) {
        let fieldName = null;
        let arrayIndex;
        for (const fld of fields) {
          if (editKey === `${fld}-${idx}`) { fieldName = fld; break; }
          const prefix = `${fld}-${idx}-`;
          if (editKey.startsWith(prefix) && /^\d+$/.test(editKey.slice(prefix.length))) {
            fieldName = fld;
            arrayIndex = parseInt(editKey.slice(prefix.length), 10);
            break;
          }
        }
        if (!fieldName) continue;
        const body = { field: fieldName, value: localEdits[editKey] };
        if (arrayIndex !== undefined) body.arrayIndex = arrayIndex;
        await secureApiClient.put(`/api/edit/anticoagulation_management/${recordId}/edit`, body);
      }

      await secureApiClient.put(`/api/edit/anticoagulation_management/${recordId}/approve`, {
        sectionId,
        approved: true,
      });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's drafts from localStorage for the committed fields (now persisted)
      const store = readDrafts();
      if (store[recordId]) {
        toCommit.forEach(editKey => {
          for (const fld of fields) {
            if (editKey === `${fld}-${idx}`) { delete store[recordId][fld]; break; }
            const prefix = `${fld}-${idx}-`;
            if (editKey.startsWith(prefix) && /^\d+$/.test(editKey.slice(prefix.length))) {
              delete store[recordId][`${fld}.${editKey.slice(prefix.length)}`];
              break;
            }
          }
        });
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
      console.error('[AnticoagulationManagement] Approve error:', err.message);
    }
  }, [approvedSections, localEdits, pendingEdits]);

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

    // Build per-sentence rows
    const sentenceRows = sentences.map((sentence, sIdx) => {
      const parsed = parseLabel(sentence);
      const sentenceKey = `${fieldName}-${idx}-s${sIdx}`;
      const isEditing = editingField === sentenceKey;
      const isSentenceEdited = editedSentences[sentenceKey];

      // Per-sentence search filtering
      if (searchTerm && !record._showAllSections && !stm(label)) {
        if (!shouldShowRow(record, sentence)) return null;
      }

      // showLabel=true (multi-field section): show full sentence — field label is at group level
      // showLabel=false (standalone section): show parsed value — parseLabel subtitle shown per-sentence
      const displayText = showLabel ? sentence : (parsed.isLabeled ? parsed.value : sentence);
      const editText = sentence.replace(/[.;]\s*$/, '');
      // In standalone sections (showLabel=false), show per-sentence parseLabel subtitles
      // In multi-field sections (showLabel=true), the field label is shown at group level
      const showParsedLabel = !showLabel && parsed.isLabeled;

      if (isEditing) {
        return (
          <div key={sIdx} className={!showLabel ? 'rec-mini-card' : undefined}>
            {showParsedLabel && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
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

      // Split comma items for labeled sentences in standalone sections
      const commaItems = showParsedLabel ? splitByComma(parsed.value) : null;
      const hasCommaItems = commaItems && commaItems.length > 1;

      return (
        <div key={sIdx} className={!showLabel ? 'rec-mini-card' : undefined}>
          {showParsedLabel && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
          {hasCommaItems ? (
            <>
              {commaItems.map((item, ci) => {
                const commaKey = `${sentenceKey}-c${ci}`;
                const isCommaEditing = editingField === commaKey;
                const isCommaEdited = editedSentences[commaKey];

                if (isCommaEditing) {
                  return (
                    <div key={ci} className="edit-field-container">
                      <textarea
                        ref={textareaRef}
                        className="edit-textarea"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && e.ctrlKey) {
                            saveCommaItem(record, fieldName, idx, sectionId, sIdx, ci, editValue);
                          }
                          if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                        }}
                        autoFocus
                        rows={1}
                      />
                      <div className="edit-actions">
                        <button className="save-btn" onClick={() => saveCommaItem(record, fieldName, idx, sectionId, sIdx, ci, editValue)}>Save</button>
                        <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                      </div>
                    </div>
                  );
                }

                return (
                  <React.Fragment key={ci}>
                    <div
                      className={`numbered-row editable-row${isCommaEdited ? ' modified' : ''}`}
                      onClick={() => { setEditingField(commaKey); setEditValue(item); }}
                    >
                      <div className="row-content">
                        <span className="content-value">{highlightText(item)}</span>
                        <span className="edit-indicator">&#9998;</span>
                      </div>
                      <button
                        className={`copy-btn ${copiedSection === commaKey ? 'copied' : ''}`}
                        onClick={e => { e.stopPropagation(); copyToClipboard(item, commaKey); }}
                      >
                        {copiedSection === commaKey ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    {isCommaEdited && (
                      <div className={`modified-badge${isCommaEdited === 'added' ? ' added' : ''}`}>
                        {isCommaEdited === 'added' ? 'added' : 'edited'} - click Pending Approve to save
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </>
          ) : (
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
                onClick={e => { e.stopPropagation(); copyToClipboard(displayText, sentenceKey); }}
              >
                {copiedSection === sentenceKey ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}
          {!hasCommaItems && isSentenceEdited && (
            <div className={`modified-badge${isSentenceEdited === 'added' ? ' added' : ''}`}>
              {isSentenceEdited === 'added' ? 'added' : 'edited'} - click Pending Approve to save
            </div>
          )}
        </div>
      );
    }).filter(Boolean);

    if (sentenceRows.length === 0) return null;

    // showLabel=true (multi-field section): group all sentences under field label in one rec-mini-card
    if (showLabel) {
      return (
        <div className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          {sentenceRows}
        </div>
      );
    }

    // showLabel=false (standalone section): sentences already wrapped individually in rec-mini-card
    return sentenceRows;
  };

  // ==================== COPY SECTION HELPERS ====================
  const copySectionText = (title, text) => {
    const lines = [`${title}:`];
    formatSentenceFieldLines(text).forEach(l => lines.push(`  ${l}`));
    return lines.join('\n');
  };

  // ==================== RENDER ====================
  return (
    <div className="anticoagulation-management-document">
      {/* Header — block layout */}
      <div className="document-header">
        <h2 className="document-title">{highlightText('Anticoagulation Management')}</h2>
        <div className="header-actions">
          <button
            className={`copy-btn ${copyAllStatus === 'copied' ? 'copied' : ''}`}
            onClick={copyAll}
          >
            {copyAllStatus === 'copied' ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<AnticoagulationManagementDocumentPDFTemplate document={pdfData} />}
            fileName="anticoagulation-management.pdf"
          >
            {({ loading }) => (
              <button className="copy-btn">
                {loading ? 'Preparing...' : 'Export PDF'}
              </button>
            )}
          </PDFDownloadLink>
        </div>
      </div>

      {/* Search */}
      <SearchBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search anticoagulation (warfarin, INR, dose, interactions...)"
        totalCount={records.length}
        filteredCount={filteredRecords.length}
      />

      {/* Content */}
      <div className="records-container">
        {filteredRecords.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💊</div>
            <div>No anticoagulation management records found</div>
          </div>
        ) : (
          filteredRecords.map((record, idx) => {
            const showAll = record._showAllSections;

            return (
              <div key={idx} className="record-card">
                {/* Record Header */}
                <div className="record-header">
                  <div className="record-meta-row">
                    {record.date && (
                      <span className="record-date">{highlightText(formatDate(record.date))}</span>
                    )}
                  </div>
                  <div className="record-title-row">
                    <h3 className="record-name">
                      {highlightText(`Anticoagulation Management ${idx + 1}`)}
                    </h3>
                  </div>
                </div>

                {/* ==================== Anticoagulation Information ==================== */}
                {shouldShowSection(record, 'Anticoagulation Information',
                  record.anticoagulant, record.indication, record.provider, record.facility
                ) && (() => {
                  const stmMatch = stm('Anticoagulation Information');
                  const showAllRows = showAll || stmMatch;

                  const hasVisible = showAllRows || (
                    (record.anticoagulant && shouldShowRow(record, 'Anticoagulant', record.anticoagulant)) ||
                    (record.indication && shouldShowRow(record, 'Indication', record.indication)) ||
                    (record.provider && shouldShowRow(record, 'Provider', record.provider)) ||
                    (record.facility && shouldShowRow(record, 'Facility', record.facility))
                  );
                  if (!hasVisible) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Anticoagulation Information')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedSection === `anticoagInfo-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const r = pdfData[idx] || record;
                                const lines = [];
                                if (r.anticoagulant) lines.push(`Anticoagulant: ${r.anticoagulant}`);
                                if (r.indication) lines.push(`Indication: ${r.indication}`);
                                if (r.date) lines.push(`Date: ${formatDate(r.date)}`);
                                if (r.provider) lines.push(`Provider: ${r.provider}`);
                                if (r.facility) lines.push(`Facility: ${r.facility}`);
                                copyToClipboard(lines.join('\n'), `anticoagInfo-${idx}`);
                              }}
                            >
                              {copiedSection === `anticoagInfo-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, 'anticoagInfo', idx)}
                          </div>
                        </div>

                        {record.anticoagulant && (showAllRows || shouldShowRow(record, 'Anticoagulant', record.anticoagulant)) &&
                          renderEditableField(record, 'anticoagulant', idx, 'anticoagInfo', 'Anticoagulant')}

                        {record.indication && (showAllRows || shouldShowRow(record, 'Indication', record.indication)) &&
                          renderEditableField(record, 'indication', idx, 'anticoagInfo', 'Indication')}

                        {record.provider && (showAllRows || shouldShowRow(record, 'Provider', record.provider)) && (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText('Provider')}</div>
                            <div className="numbered-row">
                              <div className="row-content">
                                <span className="content-value">{highlightText(record.provider)}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {record.facility && (showAllRows || shouldShowRow(record, 'Facility', record.facility)) && (
                          <div className="rec-mini-card">
                            <div className="nested-subtitle">{highlightText('Facility')}</div>
                            <div className="numbered-row">
                              <div className="row-content">
                                <span className="content-value">{highlightText(record.facility)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* ==================== INR Monitoring ==================== */}
                {(record.targetInr || record.currentInr) &&
                  shouldShowSection(record, 'INR Monitoring', record.targetInr, record.currentInr) && (() => {
                  const stmMatch = stm('INR Monitoring');
                  const showAllRows = showAll || stmMatch;

                  const hasVisible = showAllRows || (
                    (record.targetInr && shouldShowRow(record, 'Target INR', record.targetInr)) ||
                    (record.currentInr && shouldShowRow(record, 'Current INR', record.currentInr))
                  );
                  if (!hasVisible) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('INR Monitoring')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedSection === `inr-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const r = pdfData[idx] || record;
                                const lines = [];
                                if (r.targetInr) lines.push(`Target INR: ${r.targetInr}`);
                                if (r.currentInr) lines.push(`Current INR: ${r.currentInr}`);
                                copyToClipboard(lines.join('\n'), `inr-${idx}`);
                              }}
                            >
                              {copiedSection === `inr-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, 'inrMonitoring', idx)}
                          </div>
                        </div>

                        {record.targetInr && (showAllRows || shouldShowRow(record, 'Target INR', record.targetInr)) &&
                          renderEditableField(record, 'targetInr', idx, 'inrMonitoring', 'Target INR')}

                        {record.currentInr && (showAllRows || shouldShowRow(record, 'Current INR', record.currentInr)) &&
                          renderEditableField(record, 'currentInr', idx, 'inrMonitoring', 'Current INR')}
                      </div>
                    </div>
                  );
                })()}

                {/* ==================== aPTT Monitoring ==================== */}
                {(record.targetAptt || record.currentAptt) &&
                  shouldShowSection(record, 'aPTT Monitoring', record.targetAptt, record.currentAptt) && (() => {
                  const stmMatch = stm('aPTT Monitoring');
                  const showAllRows = showAll || stmMatch;

                  const hasVisible = showAllRows || (
                    (record.targetAptt && shouldShowRow(record, 'Target aPTT', record.targetAptt)) ||
                    (record.currentAptt && shouldShowRow(record, 'Current aPTT', record.currentAptt))
                  );
                  if (!hasVisible) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('aPTT Monitoring')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedSection === `aptt-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const r = pdfData[idx] || record;
                                const lines = [];
                                if (r.targetAptt) lines.push(`Target aPTT: ${r.targetAptt}`);
                                if (r.currentAptt) lines.push(`Current aPTT: ${r.currentAptt}`);
                                copyToClipboard(lines.join('\n'), `aptt-${idx}`);
                              }}
                            >
                              {copiedSection === `aptt-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, 'apttMonitoring', idx)}
                          </div>
                        </div>

                        {record.targetAptt && (showAllRows || shouldShowRow(record, 'Target aPTT', record.targetAptt)) &&
                          renderEditableField(record, 'targetAptt', idx, 'apttMonitoring', 'Target aPTT')}

                        {record.currentAptt && (showAllRows || shouldShowRow(record, 'Current aPTT', record.currentAptt)) &&
                          renderEditableField(record, 'currentAptt', idx, 'apttMonitoring', 'Current aPTT')}
                      </div>
                    </div>
                  );
                })()}

                {/* ==================== Dosing ==================== */}
                {(record.doseAdjustment || record.nextDose) &&
                  shouldShowSection(record, 'Dosing', record.doseAdjustment, record.nextDose) && (() => {
                  const stmMatch = stm('Dosing');
                  const showAllRows = showAll || stmMatch;

                  const hasVisible = showAllRows || (
                    (record.doseAdjustment && shouldShowRow(record, 'Dose Adjustment', record.doseAdjustment)) ||
                    (record.nextDose && shouldShowRow(record, 'Next Dose', record.nextDose))
                  );
                  if (!hasVisible) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Dosing')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedSection === `dosing-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const r = pdfData[idx] || record;
                                const lines = [];
                                if (r.doseAdjustment) lines.push(copySectionText('Dose Adjustment', r.doseAdjustment));
                                if (r.nextDose) lines.push(`Next Dose: ${r.nextDose}`);
                                copyToClipboard(lines.join('\n'), `dosing-${idx}`);
                              }}
                            >
                              {copiedSection === `dosing-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, 'dosing', idx)}
                          </div>
                        </div>

                        {(showAllRows || shouldShowRow(record, 'Dose Adjustment', record.doseAdjustment)) &&
                          renderSentenceEditableField(record, 'doseAdjustment', idx, 'dosing', 'Dose Adjustment')}

                        {record.nextDose && (showAllRows || shouldShowRow(record, 'Next Dose', record.nextDose)) &&
                          renderEditableField(record, 'nextDose', idx, 'dosing', 'Next Dose')}
                      </div>
                    </div>
                  );
                })()}

                {/* ==================== Clinical Events ==================== */}
                {(record.bleedingEvents || record.thromboticEvents) &&
                  shouldShowSection(record, 'Clinical Events', record.bleedingEvents, record.thromboticEvents) && (() => {
                  const stmMatch = stm('Clinical Events');
                  const showAllRows = showAll || stmMatch;

                  const hasVisible = showAllRows || (
                    (record.bleedingEvents && shouldShowRow(record, 'Bleeding Events', record.bleedingEvents)) ||
                    (record.thromboticEvents && shouldShowRow(record, 'Thrombotic Events', record.thromboticEvents))
                  );
                  if (!hasVisible) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Clinical Events')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedSection === `clinical-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const r = pdfData[idx] || record;
                                const lines = [];
                                if (r.bleedingEvents) lines.push(copySectionText('Bleeding Events', r.bleedingEvents));
                                if (r.thromboticEvents) lines.push(copySectionText('Thrombotic Events', r.thromboticEvents));
                                copyToClipboard(lines.join('\n'), `clinical-${idx}`);
                              }}
                            >
                              {copiedSection === `clinical-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, 'clinicalEvents', idx)}
                          </div>
                        </div>

                        {(showAllRows || shouldShowRow(record, 'Bleeding Events', record.bleedingEvents)) &&
                          renderSentenceEditableField(record, 'bleedingEvents', idx, 'clinicalEvents', 'Bleeding Events')}

                        {(showAllRows || shouldShowRow(record, 'Thrombotic Events', record.thromboticEvents)) &&
                          renderSentenceEditableField(record, 'thromboticEvents', idx, 'clinicalEvents', 'Thrombotic Events')}
                      </div>
                    </div>
                  );
                })()}

                {/* ==================== Drug Interactions ==================== */}
                {record.drugInteractions && record.drugInteractions.length > 0 &&
                  shouldShowSection(record, 'Drug Interactions', ...record.drugInteractions) && (() => {
                  const stmMatch = stm('Drug Interactions');
                  const showAllRows = showAll || stmMatch;
                  const arr = getEffectiveArray(record, 'drugInteractions', idx);

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Drug Interactions')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedSection === `interactions-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const effectiveArr = getEffectiveArray(record, 'drugInteractions', idx);
                                const groups = {};
                                const groupOrder = [];
                                effectiveArr.forEach(item => {
                                  const parsed = parseLabel(safeString(item));
                                  const key = parsed.isLabeled ? parsed.label : 'Other';
                                  if (!groups[key]) { groups[key] = []; groupOrder.push(key); }
                                  groups[key].push(parsed.isLabeled ? parsed.value : safeString(item));
                                });
                                const lines = ['Drug Interactions:'];
                                groupOrder.forEach(key => {
                                  lines.push(`  ${key}:`);
                                  groups[key].forEach((val, i) => { lines.push(`    ${i + 1}. ${val}`); });
                                });
                                copyToClipboard(lines.join('\n'), `interactions-${idx}`);
                              }}
                            >
                              {copiedSection === `interactions-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, 'drugInteractions', idx)}
                          </div>
                        </div>

                        {/* Group array items by parseLabel label (Avoid, Caution, etc.) */}
                        {(() => {
                          const groups = [];
                          const groupMap = {};
                          arr.forEach((item, itemIdx) => {
                            const displayValue = localEdits[`drugInteractions-${idx}-${itemIdx}`] !== undefined
                              ? localEdits[`drugInteractions-${idx}-${itemIdx}`]
                              : safeString(item);
                            if (!showAllRows && !shouldShowRow(record, 'Drug Interaction', displayValue)) return;
                            const parsed = parseLabel(displayValue);
                            const groupKey = parsed.isLabeled ? parsed.label : '__ungrouped__';
                            if (!groupMap[groupKey]) {
                              groupMap[groupKey] = { label: parsed.isLabeled ? parsed.label : null, items: [] };
                              groups.push(groupMap[groupKey]);
                            }
                            groupMap[groupKey].items.push({ item, itemIdx, displayValue, parsed });
                          });

                          return groups.map((group, gi) => (
                            <div key={gi} className="rec-mini-card">
                              {group.label && <div className="nested-subtitle">{highlightText(group.label)}</div>}
                              {group.items.map(({ item, itemIdx, displayValue, parsed }) => {
                                const editKey = `drugInteractions-${idx}-${itemIdx}`;
                                const isEditing = editingField === editKey;
                                const isEdited = editedFields[editKey];
                                const valueText = parsed.isLabeled ? parsed.value : displayValue;

                                if (isEditing) {
                                  return (
                                    <div key={itemIdx}>
                                      <div className="edit-field-container">
                                        <textarea
                                          ref={textareaRef}
                                          className="edit-textarea"
                                          value={editValue}
                                          onChange={e => setEditValue(e.target.value)}
                                          onKeyDown={e => {
                                            if (e.key === 'Enter' && e.ctrlKey) {
                                              handleSaveField(record, 'drugInteractions', idx, 'drugInteractions', itemIdx, editValue.trim(), editKey);
                                            }
                                            if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                                          }}
                                          autoFocus
                                          rows={2}
                                        />
                                        <div className="edit-actions">
                                          <button className="save-btn" onClick={() => handleSaveField(record, 'drugInteractions', idx, 'drugInteractions', itemIdx, editValue.trim(), editKey)}>Save</button>
                                          <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <div key={itemIdx}>
                                    <div
                                      className={`numbered-row editable-row${isEdited ? ' modified' : ''}`}
                                      onClick={() => { setEditingField(editKey); setEditValue(displayValue); }}
                                    >
                                      <div className="row-content">
                                        <span className="content-value">{highlightText(valueText)}</span>
                                        <span className="edit-indicator">&#9998;</span>
                                      </div>
                                      <button
                                        className={`copy-btn ${copiedSection === editKey ? 'copied' : ''}`}
                                        onClick={e => { e.stopPropagation(); copyToClipboard(displayValue, editKey); }}
                                      >
                                        {copiedSection === editKey ? 'Copied' : 'Copy'}
                                      </button>
                                    </div>
                                    {isEdited && (
                                      <div className={`modified-badge${isEdited === 'added' ? ' added' : ''}`}>
                                        {isEdited === 'added' ? 'added' : 'edited'} - click Pending Approve to save
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  );
                })()}

                {/* ==================== Dietary Considerations ==================== */}
                {record.dietaryConsiderations &&
                  shouldShowSection(record, 'Dietary Considerations', record.dietaryConsiderations) && (() => {
                  const stmMatch = stm('Dietary Considerations');
                  const showAllRows = showAll || stmMatch;

                  if (!showAllRows && !shouldShowRow(record, 'Dietary Considerations', record.dietaryConsiderations)) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Dietary Considerations')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedSection === `dietary-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const r = pdfData[idx] || record;
                                copyToClipboard(copySectionText('Dietary Considerations', r.dietaryConsiderations), `dietary-${idx}`);
                              }}
                            >
                              {copiedSection === `dietary-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, 'dietaryConsiderations', idx)}
                          </div>
                        </div>

                        {renderSentenceEditableField(record, 'dietaryConsiderations', idx, 'dietaryConsiderations', 'Dietary Considerations', false)}
                      </div>
                    </div>
                  );
                })()}

                {/* ==================== Treatment Duration ==================== */}
                {record.durationPlan &&
                  shouldShowSection(record, 'Treatment Duration', record.durationPlan) && (() => {
                  const stmMatch = stm('Treatment Duration');
                  const showAllRows = showAll || stmMatch;

                  if (!showAllRows && !shouldShowRow(record, 'Treatment Duration', record.durationPlan)) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Treatment Duration')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedSection === `duration-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const r = pdfData[idx] || record;
                                copyToClipboard(copySectionText('Treatment Duration', r.durationPlan), `duration-${idx}`);
                              }}
                            >
                              {copiedSection === `duration-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, 'durationPlan', idx)}
                          </div>
                        </div>

                        {renderSentenceEditableField(record, 'durationPlan', idx, 'durationPlan', 'Treatment Duration', false)}
                      </div>
                    </div>
                  );
                })()}

                {/* ==================== Follow-Up Testing ==================== */}
                {record.followUpTesting &&
                  shouldShowSection(record, 'Follow-Up Testing', record.followUpTesting) && (() => {
                  const stmMatch = stm('Follow-Up Testing');
                  const showAllRows = showAll || stmMatch;

                  if (!showAllRows && !shouldShowRow(record, 'Follow-Up Testing', record.followUpTesting)) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Follow-Up Testing')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedSection === `followup-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const r = pdfData[idx] || record;
                                copyToClipboard(copySectionText('Follow-Up Testing', r.followUpTesting), `followup-${idx}`);
                              }}
                            >
                              {copiedSection === `followup-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, 'followUpTesting', idx)}
                          </div>
                        </div>

                        {renderSentenceEditableField(record, 'followUpTesting', idx, 'followUpTesting', 'Follow-Up Testing', false)}
                      </div>
                    </div>
                  );
                })()}

                {/* ==================== Notes ==================== */}
                {record.notes &&
                  shouldShowSection(record, 'Notes', record.notes) && (() => {
                  const stmMatch = stm('Notes');
                  const showAllRows = showAll || stmMatch;

                  if (!showAllRows && !shouldShowRow(record, 'Notes', record.notes)) return null;

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Notes')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn ${copiedSection === `notes-${idx}` ? 'copied' : ''}`}
                              onClick={() => {
                                const r = pdfData[idx] || record;
                                copyToClipboard(copySectionText('Notes', r.notes), `notes-${idx}`);
                              }}
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AnticoagulationManagementDocument;
