/**
 * SchoolHealthFormsDocument.jsx
 * July 2026 — recursive, dot-path editable school health forms
 * Collection: school_health_forms
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import SchoolHealthFormsDocumentPDFTemplate from '../pdf-templates/SchoolHealthFormsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './SchoolHealthFormsDocument.css';

const DRAFT_KEY = 'school_health_formsPendingEdits';
const SECTION_TITLES = {
  studentInformation: 'Student Information',
  healthScreenings: 'Health Screenings',
  immunizationRecords: 'Immunization Records',
  allergicReactions: 'Allergic Reactions History',
  currentMedications: 'Current Medications',
  emergencyMedications: 'Emergency Medication Orders',
  chronicConditions: 'Chronic Medical Conditions',
  schoolAccommodations: 'School Accommodations',
  additionalInformation: 'Additional Information',
};
const FIELD_LABELS = {
  studentMedicalRecordNumber: 'Medical Record Number', primaryCarePhysician: 'Primary Care Physician',
  bodyMassIndexPercentile: 'BMI Percentile', visionScreeningResults: 'Vision Screening', hearingScreeningDecibels: 'Hearing Screening', scoliosisScreeningFindings: 'Scoliosis Screening', tuberculosisScreeningStatus: 'TB Screening',
  immunizationRecords: 'Immunization Records', allergicReactionsHistory: 'Allergic Reactions History', currentMedications: 'Current Medications', emergencyMedicationOrders: 'Emergency Medication Orders', chronicMedicalConditions: 'Chronic Medical Conditions',
  physicalEducationRestrictions: 'PE Restrictions', individualized504Plan: '504 Plan', emergencyActionPlan: 'Emergency Action Plan', parentalMedicalConsent: 'Parental Medical Consent',
  specialistReferrals: 'Specialist Referrals', mentalHealthServices: 'Mental Health Services', communicableDiseaseHistory: 'Communicable Disease History', medicalEquipmentNeeds: 'Medical Equipment Needs',
};
const SECTION_FIELDS = {
  studentInformation: ['studentMedicalRecordNumber', 'primaryCarePhysician'],
  healthScreenings: ['bodyMassIndexPercentile', 'visionScreeningResults', 'hearingScreeningDecibels', 'scoliosisScreeningFindings', 'tuberculosisScreeningStatus'],
  immunizationRecords: ['immunizationRecords'], allergicReactions: ['allergicReactionsHistory'], currentMedications: ['currentMedications'], emergencyMedications: ['emergencyMedicationOrders'], chronicConditions: ['chronicMedicalConditions'],
  schoolAccommodations: ['physicalEducationRestrictions', 'individualized504Plan', 'emergencyActionPlan', 'parentalMedicalConsent'],
  additionalInformation: ['specialistReferrals', 'mentalHealthServices', 'communicableDiseaseHistory', 'medicalEquipmentNeeds'],
};
const DATE_FIELDS = [];
const ENUM_FIELDS = [];
const NUMBER_FIELDS = ['bodyMassIndexPercentile'];
const NUMBER_STRING_FIELDS = [];
const OBJECT_FIELDS = ['immunizationRecords', 'allergicReactionsHistory', 'currentMedications', 'emergencyMedicationOrders', 'hearingScreeningDecibels'];
const OBJECT_ITEM_LABELS = {
  immunizationRecords: 'Immunization Record', allergicReactionsHistory: 'Allergic Reaction', currentMedications: 'Medication', emergencyMedicationOrders: 'Emergency Medication Order', hearingScreeningDecibels: 'Hearing Screening',
};
const NARRATIVE_PATHS = [];
const PARENTHETICAL_LABEL_FIELDS = [];
const COMMA_FIELDS = [];
const COMMA_ARRAY_FIELDS = ['physicalEducationRestrictions'];
const ARRAY_FIELDS = ['chronicMedicalConditions', 'physicalEducationRestrictions', 'specialistReferrals', 'communicableDiseaseHistory', 'medicalEquipmentNeeds'];
const SEMICOLON_FIELDS = ['scoliosisScreeningFindings', 'emergencyActionPlan', 'mentalHealthServices', 'communicableDiseaseHistory', 'medicalEquipmentNeeds'];

const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* storage can be unavailable */ }
};
const safeId = (record) => {
  if (!record?._id) return null;
  if (typeof record._id === 'string') return record._id;
  return record._id.$oid || String(record._id);
};
const KEY_LABELS = {};
const humanizeKey = (key) => KEY_LABELS[key] || String(key || '').replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/\b\w/g, (char) => char.toUpperCase()).trim();
const normalizeRulePath = (path) => String(path || '').replace(/\.\d+(?=\.|$)/g, '[]');
const fieldIn = (fields, path) => fields.includes(normalizeRulePath(path));
const hasVal = (value) => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'boolean' || typeof value === 'number') return true;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(hasVal);
  return typeof value === 'object' && Object.values(value).some(hasVal);
};
const isScalar = (value) => value === null || typeof value !== 'object';
const displayScalar = (value) => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '');
const rootOf = (path) => String(path || '').split('.')[0];
const getAtPath = (value, path) => {
  if (!path) return value;
  return String(path).split('.').reduce((node, key) => node == null ? undefined : node[key], value);
};
const setAtPath = (value, path, nextValue) => {
  const keys = String(path).split('.');
  let node = value;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) node[key] = nextValue;
    else {
      const nextKey = keys[index + 1];
      if (node[key] === null || typeof node[key] !== 'object') node[key] = /^\d+$/.test(nextKey) ? [] : {};
      node = node[key];
    }
  });
};
const deepClone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const formatDate = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value.$date || value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(value); }
};
const toInputDate = (value) => {
  try { return new Date(value?.$date || value).toISOString().slice(0, 10); } catch { return ''; }
};
const isDatePathValue = (path, value) => DATE_FIELDS.includes(rootOf(path))
  || (/(?:^|\.)(?:startDate|date)$/i.test(path) && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value));
const splitNumberUnit = (value) => {
  const match = String(value || '').trim().match(/^(-?\d+(?:\.\d+)?)\s*([A-Za-z%][A-Za-z0-9/%-]*)$/);
  return match ? { number: match[1], unit: match[2] } : null;
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
const splitBySentence = (text) => String(text || '')
  .split(/(?:;\s+|(?<=\d)\.(?=\s+[A-Z])\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+)/)
  .map((part) => part.replace(/^[;.,\s]+|[;.,\s]+$/g, '').trim())
  .filter(Boolean);
const splitFieldValue = (field, value) => {
  if (typeof value === 'boolean') return [value ? 'Yes' : 'No'];
  if (fieldIn(PARENTHETICAL_LABEL_FIELDS, field)) {
    const match = String(value || '').match(/^(.+?)\s*\(([A-Za-z][A-Za-z ]+):\s*([^)]+)\)\s*(.*)$/);
    if (match) return [match[1].trim(), match[2].trim() + ': ' + match[3].trim(), match[4].trim()].filter(Boolean);
  }
  const firstPass = fieldIn(SEMICOLON_FIELDS, field) || String(value ?? '').includes('. ')
    ? splitBySentence(value)
    : [String(value ?? '').trim()].filter(Boolean);
  return firstPass.flatMap((part) => fieldIn(COMMA_FIELDS, field) || fieldIn(COMMA_ARRAY_FIELDS, field) ? splitGuardedComma(part) : [part]);
};
const joinFieldParts = (field, parts) => {
  if (fieldIn(PARENTHETICAL_LABEL_FIELDS, field) && parts.length >= 2) {
    const labeled = parseLabel(parts[1]);
    return parts[0] + (labeled ? ' (' + labeled.label.toLowerCase() + ': ' + labeled.value + ')' : '; ' + parts[1]) + (parts[2] ? ' ' + parts[2] : '');
  }
  if (fieldIn(COMMA_FIELDS, field)) return parts.join(', ');
  if (fieldIn(SEMICOLON_FIELDS, field)) return parts.join('; ');
  return parts.join('. ');
};
const parseLabel = (text) => {
  const match = String(text || '').match(/^([A-Za-z0-9][A-Za-z0-9 /&()+-]{1,50}):\s+(.+)$/);
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
const enumOptionsFor = (path, value) => {
  const options = [];
  return [...new Set([String(value ?? ''), ...options].filter(Boolean))];
};
const flattenLeaves = (value, basePath) => {
  if (!hasVal(value)) return [];
  if (isScalar(value)) return [{ path: basePath, label: humanizeKey(String(basePath).split('.').pop()), value }];
  if (Array.isArray(value)) return value.flatMap((item, index) => flattenLeaves(item, basePath + '.' + index));
  return Object.entries(value).flatMap(([key, child]) => flattenLeaves(child, basePath + '.' + key));
};
const normalizeDateKey = (value) => {
  if (!value) return 'no-date';
  try { return new Date(value.$date || value).toISOString().slice(0, 10); } catch { return String(value); }
};
const groupRecommendations = (items) => {
  const groups = new Map();
  items.forEach((item, index) => {
    const date = typeof item === 'object' && item ? item.date : null;
    const key = normalizeDateKey(date);
    if (!groups.has(key)) groups.set(key, { key, date, items: [] });
    groups.get(key).items.push({ item, index });
  });
  return [...groups.values()];
};

const EditableLeaf = ({
  path, value, displayValue, editorType, unit, options, modified, copied, onStart, onCancel,
  onEditValue, editValue, editing, saveError, saving, onSave, onCopy, highlightText,
}) => {
  const numeric = editorType === 'number' || editorType === 'number-unit' || editorType === 'number-string';
  const parsed = Number.parseFloat(editValue);
  const base = Number.isFinite(parsed) ? parsed : 0;
  const step = String(value).includes('.') ? 0.1 : 1;
  return <div data-edit-field={path}>
    <div className={'numbered-row editable-row' + (modified ? ' modified' : '')} onClick={() => { if (!editing) onStart(); }}>
      {editing ? <div className="edit-field-container">
        {editorType === 'date' ? <BlueDatePicker value={editValue} onSelect={onEditValue} />
          : editorType === 'boolean' ? <BlueSelect value={editValue} options={['Yes', 'No']} onChange={onEditValue} />
            : editorType === 'enum' ? <BlueSelect value={editValue} options={options} onChange={onEditValue} />
              : numeric ? <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={(event) => { event.stopPropagation(); onEditValue(String(Number((base - step).toFixed(step < 1 ? 1 : 0)))); }}>−</button>
                <input className="edit-number" inputMode="decimal" value={editValue} onChange={(event) => onEditValue(event.target.value)} autoFocus />
                {unit && <span className="number-unit">{unit}</span>}
                <button type="button" className="num-step" onClick={(event) => { event.stopPropagation(); onEditValue(String(Number((base + step).toFixed(step < 1 ? 1 : 0)))); }}>+</button>
              </div>
                : <textarea className="edit-textarea" value={editValue} onChange={(event) => onEditValue(event.target.value)} autoFocus />}
        {saveError && <div className="save-error">{saveError}</div>}
        <div className="edit-actions">
          <button className="save-btn" disabled={saving} onClick={(event) => { event.stopPropagation(); onSave(); }}>{saving ? 'Saving...' : 'Save'}</button>
          <button className="cancel-btn" onClick={(event) => { event.stopPropagation(); onCancel(); }}>Cancel</button>
        </div>
      </div> : <>
        <div className="row-content"><span className="content-value">{highlightText(displayValue)}</span><span className="edit-indicator">✎</span></div>
        <button className={'copy-btn' + (copied ? ' copied' : '')} onClick={(event) => { event.stopPropagation(); onCopy(); }}>{copied ? 'Copied!' : 'Copy'}</button>
      </>}
    </div>
    {modified && <span className="modified-badge">edited - click Pending Approve to save</span>}
  </div>;
};

const SchoolHealthFormsDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [pendingEdits, setPendingEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef(null);

  const records = useMemo(() => {
    if (!docProp) return [];
    return (Array.isArray(docProp) ? docProp : [docProp]).flatMap((record) => {
      if (record?.school_health_forms) return Array.isArray(record.school_health_forms) ? record.school_health_forms : [record.school_health_forms];
      if (record?.documentData) {
        const nested = record.documentData;
        if (Array.isArray(nested)) return nested;
        if (nested?.school_health_forms) return Array.isArray(nested.school_health_forms) ? nested.school_health_forms : [nested.school_health_forms];
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
      const drafts = store[safeId(record)];
      if (!drafts) return;
      Object.entries(drafts).forEach(([path, value]) => {
        const key = recordIndex + '|' + path;
        nextLocal[key] = value;
        nextPending[key] = true;
        nextEdited[key] = true;
      });
    });
    if (Object.keys(nextLocal).length) {
      setLocalEdits((previous) => ({ ...nextLocal, ...previous }));
      setPendingEdits((previous) => ({ ...nextPending, ...previous }));
      setEditedFields((previous) => ({ ...nextEdited, ...previous }));
    }
  }, [records]);

  const getEffectiveRoot = useCallback((record, root, recordIndex, approvedOnly = false) => {
    let value = deepClone(record[root]);
    Object.entries(localEdits).forEach(([key, editValueEntry]) => {
      const prefix = recordIndex + '|';
      if (!key.startsWith(prefix)) return;
      if (approvedOnly && pendingEdits[key]) return;
      const path = key.slice(prefix.length);
      if (rootOf(path) !== root) return;
      if (path === root) value = deepClone(editValueEntry);
      else {
        if (value === null || typeof value !== 'object') value = /^\d+$/.test(path.split('.')[1] || '') ? [] : {};
        setAtPath(value, path.slice(root.length + 1), deepClone(editValueEntry));
      }
    });
    return value;
  }, [localEdits, pendingEdits]);
  const getValue = useCallback((record, path, recordIndex) => {
    const root = rootOf(path);
    const value = getEffectiveRoot(record, root, recordIndex);
    return path === root ? value : getAtPath(value, path.slice(root.length + 1));
  }, [getEffectiveRoot]);

  const stagePath = useCallback((record, path, recordIndex, sectionId, value) => {
    const id = safeId(record);
    if (!id) return;
    const key = recordIndex + '|' + path;
    setLocalEdits((previous) => ({ ...previous, [key]: value }));
    setPendingEdits((previous) => ({ ...previous, [key]: true }));
    setEditedFields((previous) => ({ ...previous, [key]: true }));
    setApprovedSections((previous) => { const next = { ...previous }; delete next[sectionId + '-' + recordIndex]; return next; });
    const store = readDrafts();
    store[id] = { ...(store[id] || {}), [path]: value };
    writeDrafts(store);
    setEditingField(null);
    setEditValue('');
    setSaveError(null);
  }, []);

  const sectionHasEdits = useCallback((sectionId, recordIndex) => {
    const fields = SECTION_FIELDS[sectionId] || [];
    return Object.keys(pendingEdits).some((key) => {
      const prefix = recordIndex + '|';
      return key.startsWith(prefix) && fields.includes(rootOf(key.slice(prefix.length)));
    });
  }, [pendingEdits]);
  const approveSection = useCallback(async (record, sectionId, recordIndex) => {
    const id = safeId(record);
    if (!id) return;
    setSaving(true);
    setSaveError(null);
    try {
      const fields = SECTION_FIELDS[sectionId] || [];
      const keys = Object.keys(pendingEdits).filter((key) => {
        const prefix = recordIndex + '|';
        return pendingEdits[key] && key.startsWith(prefix) && fields.includes(rootOf(key.slice(prefix.length)));
      });
      for (const key of keys) {
        const path = key.slice((recordIndex + '|').length);
        const response = await secureApiClient.put('/api/edit/school_health_forms/' + id + '/edit', { field: path, value: localEdits[key] });
        if (response?.success === false) throw new Error(response.error || 'Save failed');
      }
      await secureApiClient.put('/api/edit/school_health_forms/' + id + '/approve', { sectionId, approved: true });
      setPendingEdits((previous) => { const next = { ...previous }; keys.forEach((key) => delete next[key]); return next; });
      setEditedFields((previous) => { const next = { ...previous }; keys.forEach((key) => delete next[key]); return next; });
      const store = readDrafts();
      if (store[id]) {
        keys.forEach((key) => delete store[id][key.slice((recordIndex + '|').length)]);
        if (!Object.keys(store[id]).length) delete store[id];
        writeDrafts(store);
      }
      setApprovedSections((previous) => ({ ...previous, [sectionId + '-' + recordIndex]: true }));
    } catch (error) {
      console.error('[SchoolHealthForms] Approve error:', error);
      setSaveError('Approve failed. Please try again.');
    } finally { setSaving(false); }
  }, [localEdits, pendingEdits]);

  const pdfData = useMemo(() => records.map((record, recordIndex) => {
    const merged = deepClone(record);
    Object.keys(record).forEach((root) => { merged[root] = getEffectiveRoot(record, root, recordIndex, true); });
    return merged;
  }), [records, getEffectiveRoot]);

  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || text === null || text === undefined) return text;
    const phrase = searchTerm.trim();
    const escaped = phrase.replace(/[.*+?^{}$()|[\]\\]/g, '\\$&');
    const regex = new RegExp('(' + escaped + ')', 'gi');
    return String(text).split(regex).map((part, index) => part.toLowerCase() === phrase.toLowerCase() ? <mark key={index}>{part}</mark> : part);
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
  const cancelEdit = useCallback(() => { setEditingField(null); setEditValue(''); setSaveError(null); }, []);

  const leafProps = (record, path, recordIndex, sectionId, value, copyText) => {
    const key = recordIndex + '|' + path;
    const date = isDatePathValue(path, value);
    const numberUnit = typeof value === 'string' ? splitNumberUnit(value) : null;
    const numberString = NUMBER_STRING_FIELDS.includes(rootOf(path)) && /^-?\d+(?:\.\d+)?$/.test(String(value).trim());
    const editorType = date ? 'date'
      : typeof value === 'boolean' ? 'boolean'
        : typeof value === 'number' ? 'number'
          : numberString ? 'number-string'
          : numberUnit ? 'number-unit'
            : ENUM_FIELDS.includes(rootOf(path)) ? 'enum'
              : 'text';
    const displayValue = date ? formatDate(value) : displayScalar(value);
    const startValue = date ? toInputDate(value)
      : editorType === 'boolean' ? (value ? 'Yes' : 'No')
        : numberUnit ? numberUnit.number
          : displayScalar(value);
    const save = () => {
      let nextValue = editValue.trim();
      if (editorType === 'number' || editorType === 'number-unit' || editorType === 'number-string') {
        const number = Number(nextValue);
        if (Number.isNaN(number)) { setSaveError('Please enter a valid number'); return; }
        nextValue = editorType === 'number-unit' ? String(number) + ' ' + numberUnit.unit
          : editorType === 'number-string' ? String(number)
            : number;
      } else if (editorType === 'boolean') nextValue = nextValue === 'Yes';
      else if (editorType === 'date') {
        if (Number.isNaN(new Date(nextValue).getTime())) { setSaveError('Please enter a valid date'); return; }
        nextValue += 'T00:00:00.000Z';
      }
      stagePath(record, path, recordIndex, sectionId, nextValue);
    };
    return {
      path, value, displayValue, editorType, unit: numberUnit?.unit,
      options: ENUM_FIELDS.includes(rootOf(path)) ? enumOptionsFor(path, value) : [],
      modified: Boolean(editedFields[key]), copied: Boolean(copiedItems[key]),
      editing: editingField === key, editValue, saveError, saving, highlightText,
      onStart: () => { setEditingField(key); setEditValue(startValue); setSaveError(null); },
      onCancel: cancelEdit, onEditValue: setEditValue, onSave: save,
      onCopy: () => copyItem(copyText || displayValue, key),
    };
  };

  const saveNarrativePart = (record, field, recordIndex, sectionId, partIndex, parsed) => {
    const parts = splitFieldValue(field, getValue(record, field, recordIndex));
    parts[partIndex] = parsed ? parsed.label + ': ' + editValue.trim() : editValue.trim();
    stagePath(record, field, recordIndex, sectionId, joinFieldParts(field, parts));
  };
  const renderNarrative = (record, field, recordIndex, sectionId) => {
    const value = getValue(record, field, recordIndex);
    if (!hasVal(value)) return null;
    const label = FIELD_LABELS[field] || humanizeKey(field);
    const showLabel = label.toLowerCase() !== SECTION_TITLES[sectionId].toLowerCase();
    const groups = groupNarrativeParts(splitFieldValue(field, value));
    return <div key={field} className="field-group">
      {showLabel && <div className="nested-subtitle field-group-title">{highlightText(label)}</div>}
      {groups.map((group, groupIndex) => <div key={groupIndex} className={'rec-mini-card nested-mini-card' + (group.type === 'unlabeled' ? ' regular-row-group' : '')}>
        {group.type === 'labeled' && <div className="nested-subtitle">{highlightText(humanizeKey(group.items[0].label))}</div>}
        {group.items.map((item) => {
          const parsed = group.type === 'labeled' ? { label: item.label, value: item.value } : null;
          const rowValue = parsed ? parsed.value : item.value;
          const key = recordIndex + '|' + field;
          const props = leafProps(record, field, recordIndex, sectionId, rowValue, rowValue);
          props.path = field;
          props.modified = Boolean(editedFields[key]);
          props.editing = editingField === key + '-part-' + item.partIndex;
          props.onStart = () => { setEditingField(key + '-part-' + item.partIndex); setEditValue(rowValue); setSaveError(null); };
          props.onSave = () => saveNarrativePart(record, field, recordIndex, sectionId, item.partIndex, parsed);
          return <EditableLeaf key={item.partIndex} {...props} />;
        })}
      </div>)}
    </div>;
  };
  const renderNarrativeArray = (record, field, recordIndex, sectionId, labelOverride) => {
    const items = getValue(record, field, recordIndex);
    if (!Array.isArray(items) || !items.some(hasVal)) return null;
    const label = labelOverride !== undefined ? labelOverride : (FIELD_LABELS[field] || humanizeKey(String(field).split('.').pop()));
    const rows = items.flatMap((item, itemIndex) => splitFieldValue(field, item).map((part, partIndex) => ({ itemIndex, partIndex, part })));
    const groups = [];
    let unlabeled = [];
    const flushUnlabeled = () => {
      if (unlabeled.length) groups.push({ type: 'unlabeled', items: unlabeled });
      unlabeled = [];
    };
    rows.forEach((row) => {
      const parsed = parseLabel(row.part);
      if (parsed) {
        flushUnlabeled();
        groups.push({ type: 'labeled', label: parsed.label, items: [{ ...row, part: parsed.value, parsedLabel: parsed.label }] });
      } else unlabeled.push(row);
    });
    flushUnlabeled();
    return <div key={field} className="field-group">
      {label && <div className="nested-subtitle field-group-title">{highlightText(label)}</div>}
      {groups.map((group, groupIndex) => <div key={groupIndex} className={'rec-mini-card nested-mini-card' + (group.type === 'unlabeled' ? ' regular-row-group' : '')}>
        {group.type === 'labeled' && <div className="nested-subtitle">{highlightText(humanizeKey(group.label))}</div>}
        {group.items.map(({ itemIndex, partIndex, part, parsedLabel }) => {
          const path = field + '.' + itemIndex;
          const key = recordIndex + '|' + path;
          const props = leafProps(record, path, recordIndex, sectionId, part, part);
          props.path = path;
          props.modified = Boolean(editedFields[key]);
          props.editing = editingField === key + '-part-' + partIndex;
          props.onStart = () => { setEditingField(key + '-part-' + partIndex); setEditValue(part); setSaveError(null); };
          props.onSave = () => {
            const parts = splitFieldValue(field, getValue(record, path, recordIndex));
            parts[partIndex] = parsedLabel ? parsedLabel + ': ' + editValue.trim() : editValue.trim();
            stagePath(record, path, recordIndex, sectionId, joinFieldParts(field, parts));
          };
          return <EditableLeaf key={itemIndex + '-' + partIndex} {...props} />;
        })}
      </div>)}
    </div>;
  };
  const renderPathNarrative = (record, path, recordIndex, sectionId, label) => {
    const value = getValue(record, path, recordIndex);
    const parts = splitFieldValue(path, value);
    if (!parts.length) return null;
    const key = recordIndex + '|' + path;
    return <div key={path} className="field-group">
      {label && <div className="nested-subtitle field-group-title">{highlightText(label)}</div>}
      {groupNarrativeParts(parts).map((group, groupIndex) => <div key={groupIndex} className={'rec-mini-card nested-mini-card' + (group.type === 'unlabeled' ? ' regular-row-group' : '')}>
        {group.type === 'labeled' && <div className="nested-subtitle">{highlightText(group.items[0].label)}</div>}
        {group.items.map((item) => {
          const parsed = group.type === 'labeled' ? { label: item.label, value: item.value } : null;
          const part = parsed ? parsed.value : item.value;
          const props = leafProps(record, path, recordIndex, sectionId, part, part);
          props.path = path;
          props.modified = Boolean(editedFields[key]);
          props.editing = editingField === key + '-part-' + item.partIndex;
          props.onStart = () => { setEditingField(key + '-part-' + item.partIndex); setEditValue(part); setSaveError(null); };
          props.onSave = () => {
            const nextParts = splitFieldValue(path, getValue(record, path, recordIndex));
            nextParts[item.partIndex] = parsed ? parsed.label + ': ' + editValue.trim() : editValue.trim();
            stagePath(record, path, recordIndex, sectionId, joinFieldParts(path, nextParts));
          };
          return <EditableLeaf key={item.partIndex} {...props} />;
        })}
      </div>)}
    </div>;
  };
  const renderScalarField = (record, field, recordIndex, sectionId) => {
    const value = getValue(record, field, recordIndex);
    if (!hasVal(value)) return null;
    const label = FIELD_LABELS[field] || humanizeKey(field);
    const showLabel = label.toLowerCase() !== SECTION_TITLES[sectionId].toLowerCase();
    return <div key={field} className="rec-mini-card nested-mini-card">
      {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
      <EditableLeaf {...leafProps(record, field, recordIndex, sectionId, value, label + '\n' + (isDatePathValue(field, value) ? formatDate(value) : displayScalar(value)))} />
    </div>;
  };

  const renderRecursiveNode = (record, value, basePath, recordIndex, sectionId, label) => {
    if (!hasVal(value)) return null;
    if (isScalar(value) && fieldIn(NARRATIVE_PATHS, basePath)) return renderPathNarrative(record, basePath, recordIndex, sectionId, label);
    if (isScalar(value)) return <div className="rec-mini-card nested-mini-card" key={basePath}>
      {label && <div className="nested-subtitle">{highlightText(label)}</div>}
      <EditableLeaf {...leafProps(record, basePath, recordIndex, sectionId, value, displayScalar(value))} />
    </div>;
    if (Array.isArray(value) && value.every(isScalar) && fieldIn(COMMA_ARRAY_FIELDS, basePath)) return renderNarrativeArray(record, basePath, recordIndex, sectionId, label);
    if (Array.isArray(value) && value.every(isScalar)) return <div className="rec-mini-card nested-mini-card" key={basePath}>
      {label && <div className="nested-subtitle">{highlightText(label)}</div>}
      {value.map((item, index) => <EditableLeaf key={index} {...leafProps(record, basePath + '.' + index, recordIndex, sectionId, item, displayScalar(item))} />)}
    </div>;
    if (Array.isArray(value)) return <div className="nested-group" key={basePath}>
      {value.map((item, index) => <div className="rec-mini-card" key={index}>
        <div className="nested-subtitle">{highlightText(label + ' ' + (index + 1))}</div>
        {renderRecursiveNode(record, item, basePath + '.' + index, recordIndex, sectionId, '')}
      </div>)}
    </div>;
    return <div className="nested-group" key={basePath}>
      {label && <div className="nested-subtitle field-group-title">{highlightText(label)}</div>}
      {Object.entries(value).filter(([, child]) => hasVal(child)).map(([key, child]) =>
        renderRecursiveNode(record, child, basePath + '.' + key, recordIndex, sectionId, humanizeKey(key)))}
    </div>;
  };
  const renderMeasurableDisease = (record, recordIndex, sectionId) => {
    const items = getValue(record, 'measurableDisease', recordIndex);
    if (!Array.isArray(items) || !items.some(hasVal)) return null;
    return <div className="object-array-group">{items.map((item, itemIndex) => <div className="rec-mini-card" key={itemIndex}>
      <div className="nested-subtitle">{highlightText('Lesion ' + (itemIndex + 1))}</div>
      {Object.entries(item || {}).filter(([, value]) => hasVal(value)).map(([key, value]) =>
        renderRecursiveNode(record, value, 'measurableDisease.' + itemIndex + '.' + key, recordIndex, sectionId, humanizeKey(key)))}
    </div>)}</div>;
  };
  const renderResults = (record, recordIndex, sectionId) => {
    const value = getValue(record, 'results', recordIndex);
    if (!hasVal(value)) return null;
    return renderRecursiveNode(record, value, 'results', recordIndex, sectionId, '');
  };

  const renderRecommendations = (record, recordIndex, sectionId) => {
    const recommendations = getValue(record, 'recommendations', recordIndex);
    if (!Array.isArray(recommendations) || !recommendations.some(hasVal)) return null;
    return <div className="recommendation-groups">{groupRecommendations(recommendations).map((group) => {
      const datePaths = group.items.filter(({ item }) => typeof item === 'object' && item?.date).map(({ index }) => 'recommendations.' + index + '.date');
      const firstDatePath = datePaths[0];
      const dateKey = recordIndex + '|' + firstDatePath;
      const dateEditing = firstDatePath && editingField === dateKey;
      return <div className="recommendation-group" key={group.key}>
        {group.date && <div className="editable-date-subtitle" data-edit-field={firstDatePath} data-edit-fields={datePaths.join(',')}>
          <div className="nested-subtitle editable-row date-subtitle" onClick={() => {
            if (!dateEditing) { setEditingField(dateKey); setEditValue(toInputDate(group.date)); setSaveError(null); }
          }}>
            {dateEditing ? <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={setEditValue} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" onClick={(event) => {
                  event.stopPropagation();
                  if (Number.isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; }
                  datePaths.forEach((path) => stagePath(record, path, recordIndex, sectionId, editValue + 'T00:00:00.000Z'));
                }}>Save</button>
                <button className="cancel-btn" onClick={(event) => { event.stopPropagation(); cancelEdit(); }}>Cancel</button>
              </div>
            </div> : <><span className="content-value">{highlightText(formatDate(group.date))}</span><span className="edit-indicator">✎</span></>}
          </div>
        </div>}
        <div className="rec-mini-card nested-mini-card regular-row-group">
          {group.items.map(({ item, index }) => {
            const path = typeof item === 'string' ? 'recommendations.' + index : 'recommendations.' + index + '.recommendation';
            const value = typeof item === 'string' ? item : item.recommendation;
            if (!hasVal(value)) return null;
            return <EditableLeaf key={index} {...leafProps(record, path, recordIndex, sectionId, value, String(value))} />;
          })}
        </div>
      </div>;
    })}</div>;
  };

  const copyRecursiveLines = (value, basePath, indent = '') => {
    if (!hasVal(value)) return [];
    if (isScalar(value)) {
      const shown = isDatePathValue(basePath, value) ? formatDate(value) : displayScalar(value);
      const parts = fieldIn(NARRATIVE_PATHS, basePath) ? splitFieldValue(basePath, shown) : [shown];
      return [indent + humanizeKey(String(basePath).split('.').pop()) + '\n' + parts.map((part, index) => {
        const parsed = parseLabel(part);
        return parsed ? indent + parsed.label + '\n' + indent + (index + 1) + '. ' + parsed.value : indent + (index + 1) + '. ' + part;
      }).join('\n')];
    }
    if (Array.isArray(value) && fieldIn(COMMA_ARRAY_FIELDS, basePath)) {
      const parts = value.flatMap((item) => splitFieldValue(basePath, item));
      return [indent + humanizeKey(String(basePath).split('.').pop()) + '\n' + parts.map((part, index) => indent + (index + 1) + '. ' + part).join('\n')];
    }
    if (Array.isArray(value)) return value.flatMap((item, index) => copyRecursiveLines(item, basePath + '.' + index, indent));
    return Object.entries(value).flatMap(([key, child]) => copyRecursiveLines(child, basePath + '.' + key, indent));
  };
  const buildSectionCopyText = useCallback((record, recordIndex, sectionId) => {
    let text = SECTION_TITLES[sectionId] + '\n' + '-'.repeat(40) + '\n';
    (SECTION_FIELDS[sectionId] || []).forEach((field) => {
      const value = getValue(record, field, recordIndex);
      if (!hasVal(value)) return;
      const label = FIELD_LABELS[field] || humanizeKey(field);
      const showLabel = label.toLowerCase() !== SECTION_TITLES[sectionId].toLowerCase();
      if (field === 'measurableDisease') {
        value.forEach((item, itemIndex) => {
          text += 'Lesion ' + (itemIndex + 1) + '\n';
          copyRecursiveLines(item, field + '.' + itemIndex).forEach((line) => { text += line + '\n'; });
        });
      } else if (OBJECT_FIELDS.includes(field)) {
        (Array.isArray(value) ? value : [value]).forEach((item, itemIndex) => {
          text += (OBJECT_ITEM_LABELS[field] || label) + ' ' + (itemIndex + 1) + '\n';
          copyRecursiveLines(item, field + '.' + itemIndex).forEach((line) => { text += line + '\n'; });
        });
      } else if (fieldIn(ARRAY_FIELDS, field)) {
        if (showLabel) text += label + '\n';
        value.flatMap((item) => splitFieldValue(field, item)).forEach((part, index) => {
          const parsed = parseLabel(part);
          if (parsed) text += parsed.label + '\n' + (index + 1) + '. ' + parsed.value + '\n';
          else text += (index + 1) + '. ' + part + '\n';
        });
      } else if (field === 'recommendations') {
        groupRecommendations(value).forEach((group) => {
          if (group.date) text += 'Recommendation Date\n1. ' + formatDate(group.date) + '\n';
          group.items.forEach(({ item }, index) => {
            const recommendation = typeof item === 'string' ? item : item.recommendation;
            if (hasVal(recommendation)) text += (index + 1) + '. ' + recommendation + '\n';
          });
        });
      } else if (DATE_FIELDS.includes(field)) {
        if (showLabel) text += label + '\n';
        text += '1. ' + formatDate(value) + '\n';
      } else {
        if (showLabel) text += label + '\n';
        splitFieldValue(field, value).forEach((part, index) => { text += (index + 1) + '. ' + (parseLabel(part)?.value || part) + '\n'; });
      }
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
    let text = '=== SCHOOL HEALTH FORMS ===\n\n';
    records.forEach((record, recordIndex) => {
      text += 'School Health Form ' + (recordIndex + 1) + '\n' + '='.repeat(40) + '\n\n';
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

  const renderSection = (record, recordIndex, sectionId) => {
    const fields = SECTION_FIELDS[sectionId] || [];
    if (!fields.some((field) => hasVal(getValue(record, field, recordIndex)))) return null;
    const query = searchTerm.trim().toLowerCase();
    if (query) {
      const searchable = [SECTION_TITLES[sectionId], ...fields.flatMap((field) => [FIELD_LABELS[field], JSON.stringify(getValue(record, field, recordIndex))])].filter(Boolean).join(' ').toLowerCase();
      if (!searchable.includes(query)) return null;
    }
    const key = sectionId + '-' + recordIndex;
    const hasEdits = sectionHasEdits(sectionId, recordIndex);
    return <div className="section" key={sectionId}><div className="mini-cards-container">
      <div className="section-header">
        <h4 className="section-title">{highlightText(SECTION_TITLES[sectionId])}</h4>
        <div className="header-right-actions">
          <button className={'copy-btn' + (copiedSection === key ? ' copied' : '')} onClick={() => copySection(record, recordIndex, sectionId)}>{copiedSection === key ? 'Copied!' : 'Copy Section'}</button>
          {hasEdits && <button className="approve-btn pending" onClick={() => approveSection(record, sectionId, recordIndex)}>Pending Approve</button>}
          {!hasEdits && approvedSections[key] && <span className="approve-btn approved">Approved</span>}
        </div>
      </div>
      {sectionId === 'results' ? renderResults(record, recordIndex, sectionId)
          : sectionId === 'recommendations' ? renderRecommendations(record, recordIndex, sectionId)
            : fields.map((field) => fieldIn(ARRAY_FIELDS, field)
              ? renderNarrativeArray(record, field, recordIndex, sectionId, FIELD_LABELS[field]?.toLowerCase() === SECTION_TITLES[sectionId].toLowerCase() ? '' : FIELD_LABELS[field])
              : OBJECT_FIELDS.includes(field)
              ? renderRecursiveNode(record, getValue(record, field, recordIndex), field, recordIndex, sectionId, OBJECT_ITEM_LABELS[field] || FIELD_LABELS[field])
              : DATE_FIELDS.includes(field) || ENUM_FIELDS.includes(field) || NUMBER_FIELDS.includes(field)
                ? renderScalarField(record, field, recordIndex, sectionId)
                : renderNarrative(record, field, recordIndex, sectionId))}
    </div></div>;
  };

  if (!records.length) return <div className="school-health-forms-document" ref={containerRef}><div className="document-header"><h2 className="document-title">School Health Forms</h2></div><div className="empty-state">No school health forms records available</div></div>;
  const visibleRecords = records.filter((record, recordIndex) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return ['School Health Form ' + (recordIndex + 1), ...Object.keys(FIELD_LABELS).flatMap((field) => [FIELD_LABELS[field], JSON.stringify(getValue(record, field, recordIndex))])].filter(Boolean).join(' ').toLowerCase().includes(query);
  });

  return <div className="school-health-forms-document" ref={containerRef}>
    <div className="document-header">
      <h2 className="document-title">School Health Forms</h2>
      <div className="header-actions">
        <button className={'copy-btn' + (showCopied ? ' copied' : '')} onClick={copyAll}>{showCopied ? 'Copied!' : 'Copy All'}</button>
        <PDFDownloadLink document={<SchoolHealthFormsDocumentPDFTemplate document={pdfData} />} fileName="School_Health_Forms.pdf" className="copy-btn">
          {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
        </PDFDownloadLink>
      </div>
    </div>
    <div className="search-container">
      <input type="text" className="search-input" placeholder="Search school health forms..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
      {searchTerm && <span className="search-results">Showing {visibleRecords.length} of {records.length} records</span>}
    </div>
    <div className="records-container">{visibleRecords.map((record) => {
      const recordIndex = records.indexOf(record);
      return <div className="record-card" key={safeId(record) || recordIndex}>
        <div className="record-header"><h3 className="record-name">{highlightText('School Health Form ' + (recordIndex + 1))}</h3></div>
        {Object.keys(SECTION_FIELDS).map((sectionId) => renderSection(record, recordIndex, sectionId))}
      </div>;
    })}</div>
  </div>;
};

export default SchoolHealthFormsDocument;
