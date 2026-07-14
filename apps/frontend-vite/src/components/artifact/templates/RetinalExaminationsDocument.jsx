/**
 * RetinalExaminationsDocument.jsx
 * July 2026 — canonical one-pass template with staged exact-path edits
 * Collection: retinal_examinations
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import BlueTimePicker from '../components/BlueTimePicker';
import RetinalExaminationsDocumentPDFTemplate from '../pdf-templates/RetinalExaminationsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './RetinalExaminationsDocument.css';

const DRAFT_KEY = 'retinal_examinationsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* localStorage may be unavailable */ }
};

const SECTION_TITLES = {
  record: 'Record Information',
  visualAcuity: 'Visual Acuity',
  pressure: 'Intraocular Pressure',
  pupils: 'Pupil Response',
  cupDisc: 'Cup-to-Disc Ratio',
  macula: 'Macular Appearance',
  vascular: 'Retinal Vascular Changes',
  retinopathy: 'Diabetic & Hypertensive Retinopathy',
  oct: 'Optical Coherence Tomography',
  imaging: 'Imaging Studies',
  peripheral: 'Peripheral Retina & Vitreous',
  amsler: 'Amsler Grid & Retinoschisis',
};

const FIELD_LABELS = {
  createdAt: 'Examination Date',
  visualAcuityOD: 'Visual Acuity OD (Right Eye)',
  visualAcuityOS: 'Visual Acuity OS (Left Eye)',
  intraocularPressureOD: 'IOP OD (Right Eye)',
  intraocularPressureOS: 'IOP OS (Left Eye)',
  pupilResponseOD: 'Pupil Response OD (Right Eye)',
  pupilResponseOS: 'Pupil Response OS (Left Eye)',
  cupDiscRatioOD: 'Cup-to-Disc Ratio OD (Right Eye)',
  cupDiscRatioOS: 'Cup-to-Disc Ratio OS (Left Eye)',
  macularAppearanceOD: 'Macular Appearance OD (Right Eye)',
  macularAppearanceOS: 'Macular Appearance OS (Left Eye)',
  retinalVascularChangesOD: 'Vascular Changes OD (Right Eye)',
  retinalVascularChangesOS: 'Vascular Changes OS (Left Eye)',
  diabeticRetinopathyGradeOD: 'Diabetic Retinopathy Grade OD',
  diabeticRetinopathyGradeOS: 'Diabetic Retinopathy Grade OS',
  hypertensiveRetinopathyGradeOD: 'Hypertensive Retinopathy Grade OD',
  hypertensiveRetinopathyGradeOS: 'Hypertensive Retinopathy Grade OS',
  opticalCoherenceTomographyOD: 'OCT OD (Right Eye)',
  opticalCoherenceTomographyOS: 'OCT OS (Left Eye)',
  fundusPhotographyPerformed: 'Fundus Photography Performed',
  fluoresceinAngiographyFindings: 'Fluorescein Angiography Findings',
  peripheralRetinalExaminationOD: 'Peripheral Retina OD (Right Eye)',
  peripheralRetinalExaminationOS: 'Peripheral Retina OS (Left Eye)',
  vitreousExaminationOD: 'Vitreous OD (Right Eye)',
  vitreousExaminationOS: 'Vitreous OS (Left Eye)',
  amslerGridTestOD: 'Amsler Grid OD (Right Eye)',
  amslerGridTestOS: 'Amsler Grid OS (Left Eye)',
  retinoschisisseverity: 'Retinoschisis Severity',
};

const SECTION_FIELDS = {
  record: ['createdAt'],
  visualAcuity: ['visualAcuityOD', 'visualAcuityOS'],
  pressure: ['intraocularPressureOD', 'intraocularPressureOS'],
  pupils: ['pupilResponseOD', 'pupilResponseOS'],
  cupDisc: ['cupDiscRatioOD', 'cupDiscRatioOS'],
  macula: ['macularAppearanceOD', 'macularAppearanceOS'],
  vascular: ['retinalVascularChangesOD', 'retinalVascularChangesOS'],
  retinopathy: ['diabeticRetinopathyGradeOD', 'diabeticRetinopathyGradeOS', 'hypertensiveRetinopathyGradeOD', 'hypertensiveRetinopathyGradeOS'],
  oct: ['opticalCoherenceTomographyOD', 'opticalCoherenceTomographyOS'],
  imaging: ['fundusPhotographyPerformed', 'fluoresceinAngiographyFindings'],
  peripheral: ['peripheralRetinalExaminationOD', 'peripheralRetinalExaminationOS', 'vitreousExaminationOD', 'vitreousExaminationOS'],
  amsler: ['amslerGridTestOD', 'amslerGridTestOS', 'retinoschisisseverity'],
};

const ARRAY_FIELDS = ['retinalVascularChangesOD', 'retinalVascularChangesOS'];
const BOOLEAN_FIELDS = ['fundusPhotographyPerformed'];
const DATE_FIELDS = ['createdAt'];
const DATETIME_FIELDS = [];
const NUMBER_FIELDS = ['intraocularPressureOD', 'intraocularPressureOS', 'cupDiscRatioOD', 'cupDiscRatioOS'];
const MINUTE_FIELDS = [];
const COMMA_FIELDS = ['pupilResponseOD', 'pupilResponseOS', 'macularAppearanceOD', 'macularAppearanceOS', 'opticalCoherenceTomographyOD', 'opticalCoherenceTomographyOS', 'fluoresceinAngiographyFindings', 'peripheralRetinalExaminationOD', 'peripheralRetinalExaminationOS'];
const SEMICOLON_FIELDS = ['fluoresceinAngiographyFindings'];

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
const cloneValue = (value) => {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneValue(child)]));
  return value;
};
const getPath = (record, path) => String(path).split('.').reduce((value, key) => value?.[key], record);
const setPath = (record, path, value) => {
  const segments = String(path).split('.');
  let cursor = record;
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) cursor[segment] = value;
    else {
      const nextIsIndex = /^\d+$/.test(segments[index + 1]);
      if (!cursor[segment] || typeof cursor[segment] !== 'object') cursor[segment] = nextIsIndex ? [] : {};
      cursor = cursor[segment];
    }
  });
  return record;
};

const asWallClock = (value) => {
  const source = String(value?.$date || value || '');
  const match = source.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4] || 0), Number(match[5] || 0)));
};
const formatDate = (value) => {
  const date = asWallClock(value);
  return date ? date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : String(value || '');
};
const formatDateTime = (value) => {
  const date = asWallClock(value);
  return date ? date.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }) : String(value || '');
};
const toInputDate = (value) => String(value?.$date || value || '').slice(0, 10);
const toInputDateTime = (value) => {
  const source = String(value?.$date || value || '');
  const [datePart, rest] = source.split('T');
  return datePart ? `${datePart}T${rest ? rest.slice(0, 5) : '00:00'}` : '';
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
    const protectedComma = (/\d$/.test(before) && /^\d{3}\b/.test(trimmed)) || after.length === trimmed.length;
    if (protectedComma) current += char;
    else { if (before) result.push(before); current = ''; }
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [source];
};
const splitBySentence = (text) => String(text || '')
  .split(/(?:;\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+)/)
  .map((part) => part.replace(/^[;.,\s]+|[;.,\s]+$/g, '').trim())
  .filter((part) => part && !/^[;.,!?-]+$/.test(part));
const splitFieldValue = (field, value) => {
  const source = String(value || '');
  const firstPass = SEMICOLON_FIELDS.includes(field) || source.includes('. ') ? splitBySentence(source) : [source.trim()].filter(Boolean);
  return firstPass.flatMap((part) => COMMA_FIELDS.includes(field) ? splitGuardedComma(part) : [part]);
};
const joinFieldParts = (field, parts) => {
  if (field === 'fluoresceinAngiographyFindings') return groupLabeledParts(parts).map((group) => {
    const values = group.items.map((item) => item.value).join(', ');
    return group.label ? `${group.label}: ${values}` : values;
  }).join('. ');
  if (COMMA_FIELDS.includes(field)) return parts.join(', ');
  if (SEMICOLON_FIELDS.includes(field)) return parts.join('; ');
  return parts.join('. ');
};
const parseLabel = (text) => {
  const match = String(text || '').match(/^([A-Za-z][A-Za-z0-9 /&()+-]{0,30}):\s+(.+)$/);
  return match ? { label: match[1].trim(), value: match[2].trim() } : null;
};
const groupLabeledParts = (parts) => {
  const groups = [];
  let current = { label: '', items: [] };
  parts.forEach((part, partIndex) => {
    const parsed = parseLabel(part);
    if (parsed) {
      if (current.items.length) groups.push(current);
      current = { label: parsed.label, items: [{ value: parsed.value, partIndex, partLabel: parsed.label }] };
    } else current.items.push({ value: part, partIndex, partLabel: '' });
  });
  if (current.items.length) groups.push(current);
  return groups;
};
const displayText = (value) => String(value ?? '').replace(/μ/g, 'u');
const displayScalar = (field, value) => {
  if (DATE_FIELDS.includes(field)) return formatDate(value);
  if (DATETIME_FIELDS.includes(field)) return formatDateTime(value);
  if (BOOLEAN_FIELDS.includes(field)) return value ? 'Yes' : 'No';
  if (NUMBER_FIELDS.includes(field)) return `${value}${MINUTE_FIELDS.includes(field) ? ' minutes' : ''}`;
  return displayText(value);
};

const ValueRow = ({ path, leafKey, displayValue, editStartValue, editor, onSave, editingField, setEditingField, setEditValue, setSaveError, saveError, saving, cancelEdit, modified, copied, copyItem }) => {
  const editing = editingField === leafKey;
  return (
    <div data-edit-field={path}>
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
            <div className="row-content"><span className="content-value">{displayValue}</span><span className="edit-indicator">✎</span></div>
            <button className={'copy-btn' + (copied ? ' copied' : '')} onClick={(event) => { event.stopPropagation(); copyItem(displayValue, leafKey); }}>{copied ? 'Copied!' : 'Copy'}</button>
          </>
        )}
      </div>
      {modified && <span className="modified-badge">edited - click Pending Approve to save</span>}
    </div>
  );
};

const RetinalExaminationsDocument = ({ document: docProp }) => {
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
      if (record?.retinal_examinations) return Array.isArray(record.retinal_examinations) ? record.retinal_examinations : [record.retinal_examinations];
      if (record?.documentData) {
        const nested = record.documentData;
        if (Array.isArray(nested)) return nested;
        if (nested?.retinal_examinations) return Array.isArray(nested.retinal_examinations) ? nested.retinal_examinations : [nested.retinal_examinations];
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
        const key = `${recordIndex}|${path}`;
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

  const effectiveRecord = useCallback((record, recordIndex, approvedOnly = false) => {
    const merged = cloneValue(record);
    Object.entries(localEdits).forEach(([key, value]) => {
      const separator = key.indexOf('|');
      if (Number(key.slice(0, separator)) !== recordIndex) return;
      if (approvedOnly && pendingEdits[key]) return;
      setPath(merged, key.slice(separator + 1), cloneValue(value));
    });
    return merged;
  }, [localEdits, pendingEdits]);

  const stagePath = useCallback((record, recordIndex, path, value, leafKey) => {
    const id = safeId(record);
    if (!id) return;
    const key = `${recordIndex}|${path}`;
    setLocalEdits((previous) => ({ ...previous, [key]: value }));
    setPendingEdits((previous) => ({ ...previous, [key]: true }));
    setEditedLeaves((previous) => ({ ...previous, [leafKey || key]: true, [key]: true }));
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][path] = value;
    writeDrafts(store);
    setEditingField(null);
    setEditValue('');
    setSaveError(null);
    const sectionId = Object.keys(SECTION_FIELDS).find((candidate) => SECTION_FIELDS[candidate].includes(path.split('.')[0]));
    if (sectionId) setApprovedSections((previous) => { const next = { ...previous }; delete next[`${sectionId}-${recordIndex}`]; return next; });
  }, []);

  const cancelEdit = useCallback(() => { setEditingField(null); setEditValue(''); setSaveError(null); }, []);
  const sectionPendingPaths = useCallback((recordIndex, sectionId) => Object.keys(pendingEdits).filter((key) => {
    const separator = key.indexOf('|');
    const path = key.slice(separator + 1);
    return Number(key.slice(0, separator)) === recordIndex && SECTION_FIELDS[sectionId].includes(path.split('.')[0]);
  }), [pendingEdits]);
  const approveSection = useCallback(async (record, recordIndex, sectionId) => {
    const id = safeId(record);
    if (!id) return;
    const keys = sectionPendingPaths(recordIndex, sectionId);
    setSaving(true);
    setSaveError(null);
    try {
      for (const key of keys) {
        const path = key.slice(key.indexOf('|') + 1);
        await secureApiClient.put(`/api/edit/retinal_examinations/${id}/edit`, { field: path, value: localEdits[key] });
      }
      await secureApiClient.put(`/api/edit/retinal_examinations/${id}/approve`, { sectionId, approved: true });
      setPendingEdits((previous) => { const next = { ...previous }; keys.forEach((key) => delete next[key]); return next; });
      const store = readDrafts();
      if (store[id]) {
        keys.forEach((key) => delete store[id][key.slice(key.indexOf('|') + 1)]);
        if (!Object.keys(store[id]).length) delete store[id];
        writeDrafts(store);
      }
      setApprovedSections((previous) => ({ ...previous, [`${sectionId}-${recordIndex}`]: true }));
      setEditedLeaves((previous) => {
        const next = { ...previous };
        keys.forEach((key) => Object.keys(next).forEach((leaf) => { if (leaf === key || leaf.startsWith(`${key}-part-`)) delete next[leaf]; }));
        return next;
      });
    } catch (error) {
      console.error(error);
      setSaveError('Save failed. Please try again.');
    } finally { setSaving(false); }
  }, [localEdits, sectionPendingPaths]);

  const copyToClipboard = useCallback(async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch {
      const area = window.document.createElement('textarea');
      area.value = text;
      area.style.position = 'absolute';
      area.style.left = '-9999px';
      (containerRef.current || window.document.body).appendChild(area);
      area.select();
      window.document.execCommand('copy');
      area.remove();
      return true;
    }
  }, []);
  const copyItem = useCallback(async (text, key) => {
    if (await copyToClipboard(String(text))) {
      setCopiedItems((previous) => ({ ...previous, [key]: true }));
      setTimeout(() => setCopiedItems((previous) => ({ ...previous, [key]: false })), 2000);
    }
  }, [copyToClipboard]);

  const fieldRows = useCallback((record, field) => {
    const value = record[field];
    if (!hasVal(value)) return [];
    if (ARRAY_FIELDS.includes(field)) return value.filter(hasVal).map(displayText);
    if (typeof value === 'string' && (SEMICOLON_FIELDS.includes(field) || COMMA_FIELDS.includes(field) || value.includes('. '))) return splitFieldValue(field, value).map(displayText);
    return [displayScalar(field, value)];
  }, []);
  const buildSectionCopy = useCallback((record, sectionId) => {
    let text = `${SECTION_TITLES[sectionId]}\n${'='.repeat(40)}\n\n`;
    SECTION_FIELDS[sectionId].forEach((field) => {
      const rows = fieldRows(record, field);
      if (!rows.length) return;
      text += `${FIELD_LABELS[field]}\n${'-'.repeat(40)}\n`;
      let rowNumber = 1;
      groupLabeledParts(rows).forEach((group) => {
        if (group.label) text += `${group.label}\n`;
        group.items.forEach((item) => { text += `${rowNumber}. ${item.value}\n`; rowNumber += 1; });
      });
      text += '\n';
    });
    return text;
  }, [fieldRows]);
  const pdfData = useMemo(() => records.map((record, recordIndex) => effectiveRecord(record, recordIndex, true)), [records, effectiveRecord]);
  const copyAll = useCallback(async () => {
    let text = '=== RETINAL EXAMINATIONS ===\n\n';
    pdfData.forEach((record, recordIndex) => {
      text += `Retinal Examination ${recordIndex + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach((sectionId) => { text += buildSectionCopy(record, sectionId); });
    });
    if (await copyToClipboard(text)) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, buildSectionCopy, copyToClipboard]);

  const renderValueRow = (record, recordIndex, path, field, value, options = {}) => {
    const leafKey = options.leafKey || `${recordIndex}|${path}`;
    const fieldValue = options.fieldValue;
    const parts = options.parts;
    const partIndex = options.partIndex;
    const partLabel = options.partLabel;
    let editor = <textarea className="edit-textarea" value={editValue} onChange={(event) => setEditValue(event.target.value)} autoFocus />;
    let editStartValue = String(value ?? '');
    let saveValue = () => stagePath(record, recordIndex, path, editValue, leafKey);

    if (DATE_FIELDS.includes(field)) {
      editStartValue = toInputDate(value);
      editor = <BlueDatePicker value={editValue} onSelect={setEditValue} />;
      saveValue = () => {
        if (!editValue) { setSaveError('Please choose a date'); return; }
        stagePath(record, recordIndex, path, `${editValue}T00:00:00.000Z`, leafKey);
      };
    } else if (DATETIME_FIELDS.includes(field)) {
      editStartValue = toInputDateTime(value);
      editor = <div className="datetime-pickers-row">
        <BlueDatePicker value={editValue.split('T')[0] || ''} onSelect={(date) => setEditValue(`${date}T${editValue.split('T')[1] || '00:00'}`)} />
        <BlueTimePicker value={editValue.split('T')[1] || ''} onChange={(time) => setEditValue(`${editValue.split('T')[0] || ''}T${time}`)} />
      </div>;
      saveValue = () => {
        const [date, time = '00:00'] = editValue.split('T');
        if (!date) { setSaveError('Please choose a date'); return; }
        stagePath(record, recordIndex, path, `${date}T${time}:00`, leafKey);
      };
    } else if (BOOLEAN_FIELDS.includes(field)) {
      editStartValue = value ? 'Yes' : 'No';
      editor = <BlueSelect value={editValue} options={['Yes', 'No']} onChange={setEditValue} />;
      saveValue = () => stagePath(record, recordIndex, path, editValue === 'Yes', leafKey);
    } else if (NUMBER_FIELDS.includes(field)) {
      editStartValue = String(value);
      const step = Number.isInteger(Number(value)) ? 1 : 0.25;
      editor = <div className="num-stepper-row">
        <button type="button" className="num-step num-step-btn" onClick={() => setEditValue(String(Number(editValue || 0) - step))}>−</button>
        <input type="text" inputMode="decimal" className="edit-number" value={editValue} onChange={(event) => setEditValue(event.target.value)} />
        <button type="button" className="num-step num-step-btn" onClick={() => setEditValue(String(Number(editValue || 0) + step))}>+</button>
        {MINUTE_FIELDS.includes(field) && <span className="num-unit">minutes</span>}
      </div>;
      saveValue = () => {
        const number = Number(editValue);
        if (Number.isNaN(number)) { setSaveError('Please enter a valid number'); return; }
        stagePath(record, recordIndex, path, number, leafKey);
      };
    } else if (parts) {
      editStartValue = String(value);
      saveValue = () => {
        const updated = [...parts];
        updated[partIndex] = partLabel ? `${partLabel}: ${editValue.trim()}` : editValue.trim();
        stagePath(record, recordIndex, field, joinFieldParts(field, updated), leafKey);
      };
    } else if (fieldValue !== undefined) {
      editStartValue = String(value);
      saveValue = () => stagePath(record, recordIndex, path, editValue.trim(), leafKey);
    }

    return <ValueRow
      key={leafKey}
      path={path}
      leafKey={leafKey}
      displayValue={displayScalar(field, value)}
      editStartValue={editStartValue}
      editor={editor}
      onSave={saveValue}
      editingField={editingField}
      setEditingField={setEditingField}
      setEditValue={setEditValue}
      setSaveError={setSaveError}
      saveError={saveError}
      saving={saving}
      cancelEdit={cancelEdit}
      modified={Boolean(editedLeaves[leafKey] || editedLeaves[`${recordIndex}|${path}`])}
      copied={Boolean(copiedItems[leafKey])}
      copyItem={copyItem}
    />;
  };

  const renderField = (record, recordIndex, field) => {
    const effective = effectiveRecord(record, recordIndex);
    const value = effective[field];
    if (!hasVal(value)) return null;
    const label = FIELD_LABELS[field];
    if (searchTerm && !`${label} ${JSON.stringify(value)}`.toLowerCase().includes(searchTerm.toLowerCase())) return null;
    if (ARRAY_FIELDS.includes(field)) return <div key={field} className="nested-mini-card">
      <div className="nested-subtitle">{label}</div>
      {value.map((item, itemIndex) => hasVal(item) ? renderValueRow(record, recordIndex, `${field}.${itemIndex}`, field, item, { fieldValue: value }) : null)}
    </div>;
    if (typeof value === 'string' && (SEMICOLON_FIELDS.includes(field) || COMMA_FIELDS.includes(field) || value.includes('. '))) {
      const parts = splitFieldValue(field, value);
      return <div key={field} className="nested-mini-card">
        <div className="nested-subtitle">{label}</div>
        {groupLabeledParts(parts).map((group, groupIndex) => <div key={`${field}-group-${groupIndex}`} className="narrative-subgroup">
          {group.label && <div className="nested-subtitle subgroup-title">{group.label}</div>}
          {group.items.map((item) => renderValueRow(record, recordIndex, field, field, item.value, {
            parts,
            partIndex: item.partIndex,
            partLabel: item.partLabel,
            leafKey: `${recordIndex}|${field}-part-${item.partIndex}`,
          }))}
        </div>)}
      </div>;
    }
    return <div key={field} className="nested-mini-card">
      <div className="nested-subtitle">{label}</div>
      {renderValueRow(record, recordIndex, field, field, value)}
    </div>;
  };

  const renderSection = (record, recordIndex, sectionId) => {
    const effective = effectiveRecord(record, recordIndex);
    const visibleFields = SECTION_FIELDS[sectionId].filter((field) => hasVal(effective[field]));
    if (!visibleFields.length) return null;
    const renderedFields = visibleFields.map((field) => renderField(record, recordIndex, field)).filter(Boolean);
    if (!renderedFields.length) return null;
    const copyId = `${sectionId}-${recordIndex}`;
    const pending = sectionPendingPaths(recordIndex, sectionId).length > 0;
    return <div key={sectionId} className="section">
      <div className="mini-cards-container">
        <div className="section-header">
          <h4 className="section-title">{SECTION_TITLES[sectionId]}</h4>
          <div className="header-right-actions">
            <button className={'copy-btn' + (copiedSection === copyId ? ' copied' : '')} onClick={async () => {
              if (await copyToClipboard(buildSectionCopy(effective, sectionId))) { setCopiedSection(copyId); setTimeout(() => setCopiedSection(null), 2000); }
            }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
            {pending && <button className="approve-btn pending" onClick={() => approveSection(record, recordIndex, sectionId)}>Pending Approve</button>}
            {!pending && approvedSections[copyId] && <span className="approve-btn approved">Approved</span>}
          </div>
        </div>
        {renderedFields}
      </div>
    </div>;
  };

  if (!records.length) return <div className="retinal-examinations-document" ref={containerRef}>
    <div className="document-header"><h2 className="document-title">Retinal Examinations</h2></div>
    <div className="empty-state">No retinal examinations available</div>
  </div>;

  return <div className="retinal-examinations-document" ref={containerRef}>
    <div className="document-header">
      <h2 className="document-title">Retinal Examinations</h2>
      <div className="header-actions">
        <button className={'copy-btn' + (showCopied ? ' copied' : '')} onClick={copyAll}>{showCopied ? 'Copied!' : 'Copy All'}</button>
        <PDFDownloadLink document={<RetinalExaminationsDocumentPDFTemplate document={pdfData} />} fileName="Retinal_Examinations.pdf" className="copy-btn">
          {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
        </PDFDownloadLink>
      </div>
    </div>
    <div className="search-container">
      <input type="text" className="search-input" placeholder="Search retinal examinations..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
    </div>
    <div className="records-container">
      {records.map((record, recordIndex) => <div key={safeId(record) || recordIndex} className="record-card">
        <div className="record-header"><h3 className="record-name">Retinal Examination {recordIndex + 1}</h3></div>
        {Object.keys(SECTION_FIELDS).map((sectionId) => renderSection(record, recordIndex, sectionId))}
      </div>)}
    </div>
  </div>;
};

export default RetinalExaminationsDocument;
