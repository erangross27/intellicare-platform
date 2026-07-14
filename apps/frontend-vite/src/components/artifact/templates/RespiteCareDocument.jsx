/**
 * RespiteCareDocument.jsx
 * July 2026 — one-pass template with staged edits and delimiter parity
 * Collection: respite_care
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BlueDatePicker from '../components/BlueDatePicker';
import RespiteCareDocumentPDFTemplate from '../pdf-templates/RespiteCareDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './RespiteCareDocument.css';

const DRAFT_KEY = 'respite_carePendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* localStorage can be unavailable in private contexts */ }
};

const SECTION_TITLES = {
  providerDetails: 'Provider Details',
  primaryDiagnosis: 'Primary Diagnosis',
  assessmentScores: 'Assessment Scores',
  physicalStatus: 'Physical Status',
  medicationList: 'Medication List',
  mobilityAids: 'Mobility Aids',
  behavioralSymptoms: 'Behavioral Symptoms',
  socialSupport: 'Social Support',
  dietaryRequirements: 'Dietary Requirements',
};

const FIELD_LABELS = {
  createdAt: 'Date',
  primaryDiagnosis: 'Primary Diagnosis',
  functionalStatusScore: 'Functional Status Score',
  activitiesOfDailyLivingScore: 'Activities of Daily Living Score',
  cognitiveAssessmentScore: 'Cognitive Assessment Score',
  caregiverBurdenScore: 'Caregiver Burden Score',
  painAssessmentScore: 'Pain Assessment Score',
  depressionScreeningScore: 'Depression Screening Score',
  fallRiskAssessment: 'Fall Risk Assessment',
  nutritionalStatus: 'Nutritional Status',
  bodyMassIndex: 'Body Mass Index',
  skinIntegrityAssessment: 'Skin Integrity Assessment',
  respiratoryStatus: 'Respiratory Status',
  continenceStatus: 'Continence Status',
  swallowingAssessment: 'Swallowing Assessment',
  medicationList: 'Medication List',
  mobilityAids: 'Mobility Aids',
  behavioralSymptoms: 'Behavioral Symptoms',
  socialSupportNetwork: 'Social Support Network',
  emergencyContactInformation: 'Emergency Contact',
  specialDietaryRequirements: 'Dietary Requirements',
};

const SECTION_FIELDS = {
  providerDetails: ['createdAt'],
  primaryDiagnosis: ['primaryDiagnosis'],
  assessmentScores: ['functionalStatusScore', 'activitiesOfDailyLivingScore', 'cognitiveAssessmentScore', 'caregiverBurdenScore', 'painAssessmentScore', 'depressionScreeningScore'],
  physicalStatus: ['fallRiskAssessment', 'nutritionalStatus', 'bodyMassIndex', 'skinIntegrityAssessment', 'respiratoryStatus', 'continenceStatus', 'swallowingAssessment'],
  medicationList: ['medicationList'],
  mobilityAids: ['mobilityAids'],
  behavioralSymptoms: ['behavioralSymptoms'],
  socialSupport: ['socialSupportNetwork', 'emergencyContactInformation'],
  dietaryRequirements: ['specialDietaryRequirements'],
};

const ARRAY_FIELDS = ['medicationList', 'mobilityAids', 'behavioralSymptoms', 'specialDietaryRequirements'];
const NUMBER_FIELDS = ['functionalStatusScore', 'activitiesOfDailyLivingScore', 'cognitiveAssessmentScore', 'caregiverBurdenScore', 'painAssessmentScore', 'depressionScreeningScore', 'bodyMassIndex'];
const DATE_FIELDS = ['createdAt'];
const COMMA_FIELDS = ['primaryDiagnosis', 'respiratoryStatus'];
const SEMICOLON_FIELDS = ['primaryDiagnosis', 'respiratoryStatus', 'continenceStatus', 'swallowingAssessment', 'socialSupportNetwork'];

const hasVal = (value) => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(hasVal);
  return typeof value === 'object' && Object.keys(value).length > 0;
};

const safeId = (record) => {
  if (!record?._id) return null;
  if (typeof record._id === 'string') return record._id;
  return record._id.$oid || String(record._id);
};

const formatDate = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value.$date || value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(value); }
};
const toInputDate = (value) => {
  try { return new Date(value?.$date || value).toISOString().slice(0, 10); } catch { return ''; }
};

const splitGuardedComma = (text) => {
  const source = String(text || '');
  const result = [];
  let current = '';
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') { depth += 1; current += char; continue; }
    if (char === ')') { depth = Math.max(0, depth - 1); current += char; continue; }
    if (char !== ',' || depth > 0) { current += char; continue; }
    const before = current.trim();
    const after = source.slice(index + 1);
    const trimmed = after.trimStart();
    const nextWord = (trimmed.match(/^([A-Za-z]+)/) || [])[1]?.toLowerCase();
    const previousWord = (before.match(/([A-Za-z]+)$/) || [])[1]?.toLowerCase();
    const protectedComma = (/\d$/.test(before) && /^\d{3}\b/.test(trimmed))
      || after.length === trimmed.length
      || ['and', 'or', 'then'].includes(nextWord)
      || ['and', 'or'].includes(previousWord);
    if (protectedComma) current += char;
    else { if (before) result.push(before); current = ''; }
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [source];
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/(?:;\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+)/)
    .map((part) => part.replace(/^[;.,\s]+|[;.,\s]+$/g, '').trim())
    .filter((part) => part && !/^[;.,!?-]+$/.test(part));
};
const splitFieldValue = (field, value) => {
  const firstPass = SEMICOLON_FIELDS.includes(field) || String(value || '').includes('. ')
    ? splitBySentence(String(value || ''))
    : [String(value || '').trim()].filter(Boolean);
  return firstPass.flatMap((part) => COMMA_FIELDS.includes(field) ? splitGuardedComma(part) : [part]);
};
const parseLabel = (text) => {
  const match = String(text || '').match(/^([A-Za-z][A-Za-z0-9 /&()+-]{1,50}):\s+(.+)$/);
  return match ? { label: match[1].trim(), value: match[2].trim() } : null;
};
const groupNarrativeParts = (parts) => {
  const groups = [];
  let unlabeled = [];
  const flush = () => {
    if (unlabeled.length) groups.push({ type: 'unlabeled', items: unlabeled });
    unlabeled = [];
  };
  parts.forEach((part, partIndex) => {
    const parsed = parseLabel(part);
    if (parsed) {
      flush();
      groups.push({ type: 'labeled', items: [{ ...parsed, partIndex }] });
    } else unlabeled.push({ value: part, partIndex });
  });
  flush();
  return groups;
};
const joinFieldParts = (field, parts) => {
  if (COMMA_FIELDS.includes(field)) return parts.join(', ');
  if (SEMICOLON_FIELDS.includes(field)) return parts.join('; ');
  return parts.join('. ');
};

const ValueRow = ({
  field, recordIndex, leafKey, displayValue, editStartValue, editor, onSave, copyText,
  editingField, setEditingField, setEditValue, setSaveError, saveError, saving,
  cancelEdit, editedLeaves, highlightText, copiedItems, copyItem,
}) => {
  const editing = editingField === leafKey;
  const modified = Boolean(editedLeaves[leafKey] || editedLeaves[field + '-' + recordIndex]);
  return (
    <div data-edit-field={field}>
      <div className={'numbered-row editable-row' + (modified ? ' modified' : '')} onClick={() => {
        if (!editing) { setEditingField(leafKey); setEditValue(editStartValue); setSaveError(null); }
      }}>
        {editing ? (
          <div className="edit-field-container">
            {editor}
            {saveError && <div className="save-error">{saveError}</div>}
            <div className="edit-actions">
              <button className="save-btn" disabled={saving} onClick={(event) => { event.stopPropagation(); onSave(); }}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="cancel-btn" onClick={(event) => { event.stopPropagation(); cancelEdit(); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div className="row-content"><span className="content-value">{highlightText(displayValue)}</span><span className="edit-indicator">✎</span></div>
            <button className={'copy-btn' + (copiedItems[leafKey] ? ' copied' : '')} onClick={(event) => { event.stopPropagation(); copyItem(copyText || displayValue, leafKey); }}>{copiedItems[leafKey] ? 'Copied!' : 'Copy'}</button>
          </>
        )}
      </div>
      {modified && <span className="modified-badge">edited - click Pending Approve to save</span>}
    </div>
  );
};

const RespiteCareDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [pendingEdits, setPendingEdits] = useState({});
  const [editedLeaves, setEditedLeaves] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef(null);

  const records = useMemo(() => {
    if (!docProp) return [];
    const source = Array.isArray(docProp) ? docProp : [docProp];
    return source.flatMap((record) => {
      if (record?.respite_care) return Array.isArray(record.respite_care) ? record.respite_care : [record.respite_care];
      if (record?.documentData) {
        const nested = record.documentData;
        if (Array.isArray(nested)) return nested;
        if (nested?.respite_care) return Array.isArray(nested.respite_care) ? nested.respite_care : [nested.respite_care];
        return [nested];
      }
      return [record];
    }).filter((record) => record && typeof record === 'object');
  }, [docProp]);

  useEffect(() => {
    const store = readDrafts();
    const nextLocal = {};
    const nextPending = {};
    const nextEdited = {};
    records.forEach((record, recordIndex) => {
      const recordDrafts = store[safeId(record)];
      if (!recordDrafts) return;
      Object.entries(recordDrafts).forEach(([field, value]) => {
        const key = field + '-' + recordIndex;
        nextLocal[key] = value;
        nextPending[key] = true;
        nextEdited[key] = true;
      });
    });
    if (Object.keys(nextLocal).length) {
      setLocalEdits((previous) => ({ ...nextLocal, ...previous }));
      setPendingEdits((previous) => ({ ...nextPending, ...previous }));
      setEditedLeaves((previous) => ({ ...nextEdited, ...previous }));
    }
  }, [records]);

  const getValue = useCallback((record, field, recordIndex) => {
    const key = field + '-' + recordIndex;
    return localEdits[key] !== undefined ? localEdits[key] : record[field];
  }, [localEdits]);

  const stageField = useCallback((record, field, recordIndex, value, leafKey) => {
    const id = safeId(record);
    if (!id) return;
    const fieldKey = field + '-' + recordIndex;
    setLocalEdits((previous) => ({ ...previous, [fieldKey]: value }));
    setPendingEdits((previous) => ({ ...previous, [fieldKey]: true }));
    setEditedLeaves((previous) => ({ ...previous, [leafKey || fieldKey]: true }));
    setApprovedSections((previous) => {
      const next = { ...previous };
      Object.entries(SECTION_FIELDS).forEach(([sectionId, fields]) => {
        if (fields.includes(field)) delete next[sectionId + '-' + recordIndex];
      });
      return next;
    });
    const store = readDrafts();
    store[id] = { ...(store[id] || {}), [field]: value };
    writeDrafts(store);
    setEditingField(null);
    setEditValue('');
    setSaveError(null);
  }, []);

  const saveScalar = useCallback((record, field, recordIndex, leafKey) => {
    let value = editValue.trim();
    if (NUMBER_FIELDS.includes(field)) {
      value = Number(value);
      if (Number.isNaN(value)) { setSaveError('Please enter a valid number'); return; }
    }
    if (DATE_FIELDS.includes(field)) {
      if (Number.isNaN(new Date(value).getTime())) { setSaveError('Please enter a valid date'); return; }
      value += 'T00:00:00.000Z';
    }
    stageField(record, field, recordIndex, value, leafKey);
  }, [editValue, stageField]);
  const saveNarrativePart = useCallback((record, field, recordIndex, partIndex, parsed, leafKey) => {
    const parts = splitFieldValue(field, getValue(record, field, recordIndex));
    parts[partIndex] = parsed ? parsed.label + ': ' + editValue.trim() : editValue.trim();
    stageField(record, field, recordIndex, joinFieldParts(field, parts), leafKey);
  }, [editValue, getValue, stageField]);
  const saveArrayItem = useCallback((record, field, recordIndex, itemIndex, leafKey) => {
    const current = getValue(record, field, recordIndex);
    const items = [...(Array.isArray(current) ? current : [])];
    items[itemIndex] = editValue.trim();
    stageField(record, field, recordIndex, items, leafKey);
  }, [editValue, getValue, stageField]);

  const sectionHasEdits = useCallback((sectionId, recordIndex) => {
    return (SECTION_FIELDS[sectionId] || []).some((field) => pendingEdits[field + '-' + recordIndex]);
  }, [pendingEdits]);
  const approveSection = useCallback(async (record, sectionId, recordIndex) => {
    const id = safeId(record);
    if (!id) return;
    setSaving(true);
    setSaveError(null);
    try {
      const fields = (SECTION_FIELDS[sectionId] || []).filter((field) => pendingEdits[field + '-' + recordIndex]);
      for (const field of fields) {
        const response = await secureApiClient.put('/api/edit/respite_care/' + id + '/edit', { field, value: localEdits[field + '-' + recordIndex] });
        if (response?.success === false) throw new Error(response.error || 'Save failed');
      }
      await secureApiClient.put('/api/edit/respite_care/' + id + '/approve', { sectionId, approved: true });
      setPendingEdits((previous) => {
        const next = { ...previous };
        fields.forEach((field) => delete next[field + '-' + recordIndex]);
        return next;
      });
      setEditedLeaves((previous) => {
        const next = { ...previous };
        Object.keys(next).forEach((key) => {
          if (fields.some((field) => key.startsWith(field + '-' + recordIndex))) delete next[key];
        });
        return next;
      });
      const store = readDrafts();
      if (store[id]) {
        fields.forEach((field) => delete store[id][field]);
        if (!Object.keys(store[id]).length) delete store[id];
        writeDrafts(store);
      }
      setApprovedSections((previous) => ({ ...previous, [sectionId + '-' + recordIndex]: true }));
    } catch (error) {
      console.error('[RespiteCare] Approve error:', error);
      setSaveError('Approve failed. Please try again.');
    } finally { setSaving(false); }
  }, [localEdits, pendingEdits]);

  const pdfData = useMemo(() => records.map((record, recordIndex) => {
    const merged = { ...record };
    Object.keys(FIELD_LABELS).forEach((field) => {
      const key = field + '-' + recordIndex;
      if (localEdits[key] !== undefined && !pendingEdits[key]) merged[field] = localEdits[key];
    });
    return merged;
  }), [records, localEdits, pendingEdits]);

  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || text === null || text === undefined) return text;
    const escaped = searchTerm.trim().replace(/[.*+?^{}$()|[\]\\]/g, '\\$&');
    const regex = new RegExp('(' + escaped + ')', 'gi');
    const phrase = searchTerm.trim().toLowerCase();
    return String(text).split(regex).map((part, index) => part.toLowerCase() === phrase ? <mark key={index}>{part}</mark> : part);
  }, [searchTerm]);
  const copyToClipboard = useCallback(async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const textarea = window.document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      (containerRef.current || window.document.body).appendChild(textarea);
      textarea.select();
      window.document.execCommand('copy');
      textarea.remove();
      return true;
    }
  }, []);
  const copyItem = useCallback(async (text, key) => {
    if (await copyToClipboard(text)) {
      setCopiedItems((previous) => ({ ...previous, [key]: true }));
      setTimeout(() => setCopiedItems((previous) => ({ ...previous, [key]: false })), 1600);
    }
  }, [copyToClipboard]);

  const buildSectionCopyText = useCallback((record, recordIndex, sectionId) => {
    let text = SECTION_TITLES[sectionId] + '\n' + '-'.repeat(40) + '\n';
    (SECTION_FIELDS[sectionId] || []).forEach((field) => {
      const value = getValue(record, field, recordIndex);
      if (!hasVal(value)) return;
      const label = FIELD_LABELS[field] || field;
      if (label.toLowerCase() !== SECTION_TITLES[sectionId].toLowerCase()) text += label + '\n';
      const rows = ARRAY_FIELDS.includes(field)
        ? value.filter(hasVal).map(String)
        : DATE_FIELDS.includes(field)
          ? [formatDate(value)]
          : NUMBER_FIELDS.includes(field)
            ? [String(value)]
            : splitFieldValue(field, value).map((part) => parseLabel(part)?.value || part);
      rows.forEach((row, rowIndex) => { text += (rowIndex + 1) + '. ' + row + '\n'; });
      text += '\n';
    });
    return text;
  }, [getValue]);
  const copySection = useCallback(async (record, recordIndex, sectionId) => {
    const key = sectionId + '-' + recordIndex;
    if (await copyToClipboard(buildSectionCopyText(record, recordIndex, sectionId))) {
      setCopiedSection(key);
      setTimeout(() => setCopiedSection(null), 1600);
    }
  }, [buildSectionCopyText, copyToClipboard]);
  const copyAll = useCallback(async () => {
    let text = '=== RESPITE CARE ===\n\n';
    records.forEach((record, recordIndex) => {
      text += 'Respite Care Record ' + (recordIndex + 1) + '\n' + '='.repeat(40) + '\n\n';
      Object.keys(SECTION_FIELDS).forEach((sectionId) => {
        if ((SECTION_FIELDS[sectionId] || []).some((field) => hasVal(getValue(record, field, recordIndex)))) {
          text += buildSectionCopyText(record, recordIndex, sectionId) + '\n';
        }
      });
    });
    if (await copyToClipboard(text)) {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 1600);
    }
  }, [records, getValue, buildSectionCopyText, copyToClipboard]);

  const cancelEdit = useCallback(() => { setEditingField(null); setEditValue(''); setSaveError(null); }, []);
  const rowUiProps = {
    editingField, setEditingField, setEditValue, setSaveError, saveError, saving,
    cancelEdit, editedLeaves, highlightText, copiedItems, copyItem,
  };

  const renderScalarField = (record, field, recordIndex, sectionId) => {
    const value = getValue(record, field, recordIndex);
    if (!hasVal(value)) return null;
    const label = FIELD_LABELS[field] || field;
    const showLabel = label.toLowerCase() !== SECTION_TITLES[sectionId].toLowerCase();
    const leafKey = field + '-' + recordIndex;
    const displayValue = DATE_FIELDS.includes(field) ? formatDate(value) : String(value);
    let editor = <textarea className="edit-textarea" value={editValue} onChange={(event) => setEditValue(event.target.value)} autoFocus />;
    if (NUMBER_FIELDS.includes(field)) {
      const parsed = Number.parseFloat(editValue);
      const base = Number.isFinite(parsed) ? parsed : 0;
      const step = String(value).includes('.') ? 0.1 : 1;
      editor = <div className="num-stepper-row">
        <button type="button" className="num-step" onClick={(event) => { event.stopPropagation(); setEditValue(String(Number((base - step).toFixed(step < 1 ? 1 : 0)))); }}>−</button>
        <input className="edit-number" inputMode="decimal" value={editValue} onChange={(event) => setEditValue(event.target.value)} autoFocus />
        <button type="button" className="num-step" onClick={(event) => { event.stopPropagation(); setEditValue(String(Number((base + step).toFixed(step < 1 ? 1 : 0)))); }}>+</button>
      </div>;
    } else if (DATE_FIELDS.includes(field)) editor = <BlueDatePicker value={editValue} onSelect={setEditValue} />;
    return <div key={field} className="rec-mini-card nested-mini-card">
      {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
      <ValueRow {...rowUiProps} field={field} recordIndex={recordIndex} leafKey={leafKey} displayValue={displayValue}
        editStartValue={DATE_FIELDS.includes(field) ? toInputDate(value) : String(value)} editor={editor}
        onSave={() => saveScalar(record, field, recordIndex, leafKey)} copyText={label + '\n' + displayValue} />
    </div>;
  };

  const renderNarrativeField = (record, field, recordIndex, sectionId) => {
    const value = getValue(record, field, recordIndex);
    if (!hasVal(value)) return null;
    const label = FIELD_LABELS[field] || field;
    const showLabel = label.toLowerCase() !== SECTION_TITLES[sectionId].toLowerCase();
    const groups = groupNarrativeParts(splitFieldValue(field, value));
    return <div key={field} className="field-group">
      {showLabel && <div className="nested-subtitle field-group-title">{highlightText(label)}</div>}
      {groups.map((group, groupIndex) => <div key={groupIndex} className={'rec-mini-card nested-mini-card' + (group.type === 'unlabeled' ? ' regular-row-group' : '')}>
        {group.type === 'labeled' && <div className="nested-subtitle">{highlightText(group.items[0].label)}</div>}
        {group.items.map((item) => {
          const parsed = group.type === 'labeled' ? { label: item.label, value: item.value } : null;
          const rowValue = parsed ? parsed.value : item.value;
          const leafKey = field + '-' + recordIndex + '-part-' + item.partIndex;
          return <ValueRow {...rowUiProps} key={item.partIndex} field={field} recordIndex={recordIndex} leafKey={leafKey}
            displayValue={rowValue} editStartValue={rowValue}
            editor={<textarea className="edit-textarea" value={editValue} onChange={(event) => setEditValue(event.target.value)} autoFocus />}
            onSave={() => saveNarrativePart(record, field, recordIndex, item.partIndex, parsed, leafKey)} copyText={rowValue} />;
        })}
      </div>)}
    </div>;
  };

  const renderArrayField = (record, field, recordIndex, sectionId) => {
    const value = getValue(record, field, recordIndex);
    const items = Array.isArray(value) ? value.filter(hasVal) : [];
    if (!items.length) return null;
    const label = FIELD_LABELS[field] || field;
    const showLabel = label.toLowerCase() !== SECTION_TITLES[sectionId].toLowerCase();
    return <div key={field} className="field-group">
      {showLabel && <div className="nested-subtitle field-group-title">{highlightText(label)}</div>}
      <div className="rec-mini-card nested-mini-card regular-row-group">
        {items.map((item, itemIndex) => {
          const leafKey = field + '-' + recordIndex + '-item-' + itemIndex;
          return <ValueRow {...rowUiProps} key={itemIndex} field={field} recordIndex={recordIndex} leafKey={leafKey}
            displayValue={String(item)} editStartValue={String(item)}
            editor={<textarea className="edit-textarea" value={editValue} onChange={(event) => setEditValue(event.target.value)} autoFocus />}
            onSave={() => saveArrayItem(record, field, recordIndex, itemIndex, leafKey)} copyText={String(item)} />;
        })}
      </div>
    </div>;
  };

  const renderSection = (record, recordIndex, sectionId) => {
    const fields = SECTION_FIELDS[sectionId] || [];
    if (!fields.some((field) => hasVal(getValue(record, field, recordIndex)))) return null;
    const query = searchTerm.trim().toLowerCase();
    if (query) {
      const searchable = [SECTION_TITLES[sectionId], ...fields.flatMap((field) => [FIELD_LABELS[field], getValue(record, field, recordIndex)])].flat().filter(Boolean).join(' ').toLowerCase();
      if (!searchable.includes(query)) return null;
    }
    const copyKey = sectionId + '-' + recordIndex;
    const hasEdits = sectionHasEdits(sectionId, recordIndex);
    const approved = approvedSections[copyKey];
    return <div key={sectionId} className="section">
      <div className="mini-cards-container">
        <div className="section-header">
          <h4 className="section-title">{highlightText(SECTION_TITLES[sectionId])}</h4>
          <div className="header-right-actions">
            <button className={'copy-btn' + (copiedSection === copyKey ? ' copied' : '')} onClick={() => copySection(record, recordIndex, sectionId)}>{copiedSection === copyKey ? 'Copied!' : 'Copy Section'}</button>
            {hasEdits && <button className="approve-btn pending" onClick={() => approveSection(record, sectionId, recordIndex)}>Pending Approve</button>}
            {!hasEdits && approved && <span className="approve-btn approved">Approved</span>}
          </div>
        </div>
        {fields.map((field) => ARRAY_FIELDS.includes(field)
          ? renderArrayField(record, field, recordIndex, sectionId)
          : NUMBER_FIELDS.includes(field) || DATE_FIELDS.includes(field)
            ? renderScalarField(record, field, recordIndex, sectionId)
            : renderNarrativeField(record, field, recordIndex, sectionId))}
      </div>
    </div>;
  };

  if (!records.length) return <div className="respite-care-document" ref={containerRef}><div className="document-header"><h2 className="document-title">Respite Care</h2></div><div className="empty-state">No respite care records available</div></div>;

  const visibleRecords = records.filter((record, recordIndex) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return ['Respite Care Record ' + (recordIndex + 1), ...Object.keys(FIELD_LABELS).flatMap((field) => [FIELD_LABELS[field], getValue(record, field, recordIndex)])].flat().filter(Boolean).join(' ').toLowerCase().includes(query);
  });

  return <div className="respite-care-document" ref={containerRef}>
    <div className="document-header">
      <h2 className="document-title">Respite Care</h2>
      <div className="header-actions">
        <button className={'copy-btn' + (showCopied ? ' copied' : '')} onClick={copyAll}>{showCopied ? 'Copied!' : 'Copy All'}</button>
        <PDFDownloadLink document={<RespiteCareDocumentPDFTemplate document={pdfData} />} fileName="Respite_Care.pdf" className="copy-btn">
          {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
        </PDFDownloadLink>
      </div>
    </div>
    <div className="search-container">
      <input className="search-input" type="text" placeholder="Search respite care..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
      {searchTerm && <span className="search-results">Showing {visibleRecords.length} of {records.length} records</span>}
    </div>
    <div className="records-container">
      {visibleRecords.map((record) => {
        const recordIndex = records.indexOf(record);
        return <div key={safeId(record) || recordIndex} className="record-card">
          <div className="record-header"><h3 className="record-name">{highlightText('Respite Care Record ' + (recordIndex + 1))}</h3></div>
          {Object.keys(SECTION_FIELDS).map((sectionId) => renderSection(record, recordIndex, sectionId))}
        </div>;
      })}
    </div>
  </div>;
};

export default RespiteCareDocument;
