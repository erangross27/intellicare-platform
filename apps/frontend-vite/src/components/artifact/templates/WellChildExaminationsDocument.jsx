/**
 * WellChildExaminationsDocument.jsx
 * Collection: well_child_examinations
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import WellChildExaminationsDocumentPDFTemplate from '../pdf-templates/WellChildExaminationsDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './WellChildExaminationsDocument.css';

const DRAFT_KEY = 'well_child_examinationsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* local drafts are best effort */ }
};

const SECTION_TITLES = {
  'visit-information': 'Visit Information',
  'growth-parameters': 'Growth Parameters',
  'developmental-screening': 'Developmental Screening',
  screenings: 'Screenings',
  immunizations: 'Immunizations Given',
  'anticipatory-guidance': 'Anticipatory Guidance',
};

const FIELD_LABELS = {
  visitDate: 'Visit Date',
  age: 'Age',
  nextWellVisit: 'Next Well Visit',
  'weight.value': 'Weight',
  'weight.percentile': 'Weight Percentile',
  'height.value': 'Height',
  'height.percentile': 'Height Percentile',
  'headCircumference.value': 'Head Circumference',
  'headCircumference.percentile': 'Head Circumference Percentile',
  'bmi.value': 'BMI',
  'bmi.percentile': 'BMI Percentile',
  'bmi.category': 'BMI Category',
  'developmentalScreening.result': 'Result',
  'developmentalScreening.notes': 'Notes',
  'developmentalScreening.grossMotor': 'Gross Motor',
  'developmentalScreening.fineMotor': 'Fine Motor',
  'developmentalScreening.language': 'Language',
  'developmentalScreening.socialEmotional': 'Social & Emotional',
  'visionScreening.result': 'Vision Result',
  'visionScreening.method': 'Vision Method',
  'visionScreening.acuity': 'Vision Acuity',
  'hearingScreening.result': 'Hearing Result',
  'hearingScreening.method': 'Hearing Method',
  'leadScreening.result': 'Lead Screening Result',
  immunizationsGiven: 'Immunizations Given',
  anticipatoryGuidance: 'Anticipatory Guidance',
};

const SECTION_FIELDS = {
  'visit-information': ['visitDate', 'age', 'nextWellVisit'],
  'growth-parameters': ['weight.value', 'weight.percentile', 'height.value', 'height.percentile', 'headCircumference.value', 'headCircumference.percentile', 'bmi.value', 'bmi.percentile', 'bmi.category'],
  'developmental-screening': ['developmentalScreening.result', 'developmentalScreening.notes', 'developmentalScreening.grossMotor', 'developmentalScreening.fineMotor', 'developmentalScreening.language', 'developmentalScreening.socialEmotional'],
  screenings: ['visionScreening.result', 'visionScreening.method', 'visionScreening.acuity', 'hearingScreening.result', 'hearingScreening.method', 'leadScreening.result'],
  immunizations: ['immunizationsGiven'],
  'anticipatory-guidance': ['anticipatoryGuidance'],
};

const DATE_FIELDS = new Set(['visitDate']);
const ARRAY_FIELDS = new Set(['immunizationsGiven', 'anticipatoryGuidance']);
const COMMA_ARRAY_FIELDS = new Set(['developmentalScreening.grossMotor']);

const hasVal = (value) => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(hasVal);
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

const safeId = (record) => {
  if (!record?._id) return null;
  if (typeof record._id === 'string') return record._id;
  return record._id.$oid || String(record._id);
};

const getPath = (record, path) => path.split('.').reduce((value, part) => value?.[part], record);

const setPath = (record, path, value) => {
  const parts = path.split('.');
  let cursor = record;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) cursor[part] = value;
    else {
      cursor[part] = cursor[part] && typeof cursor[part] === 'object' ? { ...cursor[part] } : {};
      cursor = cursor[part];
    }
  });
};

const splitByComma = (text) => {
  const result = [];
  let current = '';
  let depth = 0;
  for (const character of String(text || '')) {
    if (character === '(') depth += 1;
    if (character === ')') depth = Math.max(0, depth - 1);
    if (character === ',' && depth === 0) {
      if (current.trim()) result.push(current.trim());
      current = '';
    } else current += character;
  }
  if (current.trim()) result.push(current.trim());
  return result;
};

const splitBySentence = (text) => String(text || '')
  .split(/;\s+|(?<!\d)\.(?:\s+|$)/)
  .map(item => item.trim())
  .filter(item => item && !/^[;.,!?]+$/.test(item));

const splitFieldValue = (field, value) => {
  const clauses = splitBySentence(value);
  if (!COMMA_ARRAY_FIELDS.has(field)) return clauses;
  return clauses.flatMap(splitByComma).filter(Boolean);
};

const parseAnticipatory = (value) => {
  const text = String(value || '');
  const colon = text.indexOf(':');
  if (colon > 0 && colon <= 30) return { topic: text.slice(0, colon).trim(), content: text.slice(colon + 1).trim() };
  return { topic: '', content: text };
};

const formatDate = (value) => {
  if (!value) return '';
  try { return new Date(value.$date || value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(value); }
};

const toInputDate = (value) => {
  if (!value) return '';
  try { return new Date(value.$date || value).toISOString().slice(0, 10); } catch { return ''; }
};

const numericUnit = (value) => String(value || '').trim().match(/^(-?\d+(?:\.\d+)?)\s*([A-Za-z]{1,6}(?:\/[A-Za-z]{1,6})?)$/);

const WellChildExaminationsDocument = ({ document: documentProp, data: dataProp, templateData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [pendingEdits, setPendingEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  const records = useMemo(() => {
    const source = documentProp ?? dataProp ?? templateData;
    if (!source) return [];
    let rows = Array.isArray(source) ? source : [source];
    rows = rows.flatMap(row => {
      if (Array.isArray(row?.records)) return row.records;
      if (Array.isArray(row?._records)) return row._records;
      if (row?.well_child_examinations) return Array.isArray(row.well_child_examinations) ? row.well_child_examinations : [row.well_child_examinations];
      if (row?.documentData) {
        const nested = row.documentData;
        if (Array.isArray(nested)) return nested;
        if (nested?.well_child_examinations) return Array.isArray(nested.well_child_examinations) ? nested.well_child_examinations : [nested.well_child_examinations];
        return [nested];
      }
      return [row];
    });
    return rows.filter(row => row && typeof row === 'object');
  }, [documentProp, dataProp, templateData]);

  const getFieldValue = useCallback((record, field, recordIndex) => {
    const editKey = `${field}-${recordIndex}`;
    return localEdits[editKey] !== undefined ? localEdits[editKey] : getPath(record, field);
  }, [localEdits]);

  useEffect(() => {
    const store = readDrafts();
    const nextLocal = {};
    const nextPending = {};
    const nextEdited = {};
    records.forEach((record, recordIndex) => {
      const recordDrafts = store[safeId(record)] || {};
      Object.entries(recordDrafts).forEach(([fieldPart, value]) => {
        const match = fieldPart.match(/^(.+)\.(\d+)$/);
        if (match && ARRAY_FIELDS.has(match[1])) {
          const base = match[1];
          const arrayIndex = Number(match[2]);
          const editKey = `${base}-${recordIndex}`;
          const current = nextLocal[editKey] || [...(getPath(record, base) || [])];
          current[arrayIndex] = value;
          nextLocal[editKey] = current;
          nextPending[editKey] = true;
          nextEdited[`${fieldPart}-${recordIndex}`] = true;
        } else {
          nextLocal[`${fieldPart}-${recordIndex}`] = value;
          nextPending[`${fieldPart}-${recordIndex}`] = true;
          nextEdited[`${fieldPart}-${recordIndex}`] = true;
        }
      });
    });
    if (!Object.keys(nextPending).length) return;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from local draft storage */
    setLocalEdits(previous => ({ ...nextLocal, ...previous }));
    setPendingEdits(previous => ({ ...nextPending, ...previous }));
    setEditedFields(previous => ({ ...nextEdited, ...previous }));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [records]);

  const stageField = useCallback((record, field, recordIndex, value, trackingField = field) => {
    const id = safeId(record);
    if (!id) return;
    const editKey = `${field}-${recordIndex}`;
    setLocalEdits(previous => ({ ...previous, [editKey]: value }));
    setPendingEdits(previous => ({ ...previous, [editKey]: true }));
    setEditedFields(previous => ({ ...previous, [`${trackingField}-${recordIndex}`]: true }));
    const store = readDrafts();
    store[id] = { ...(store[id] || {}), [field]: value };
    writeDrafts(store);
    setEditingField(null);
    setEditValue('');
  }, []);

  const stageArrayElement = useCallback((record, field, recordIndex, arrayIndex, value) => {
    const id = safeId(record);
    if (!id) return;
    const current = [...(getFieldValue(record, field, recordIndex) || [])];
    current[arrayIndex] = value;
    const baseKey = `${field}-${recordIndex}`;
    const fieldPart = `${field}.${arrayIndex}`;
    setLocalEdits(previous => ({ ...previous, [baseKey]: current }));
    setPendingEdits(previous => ({ ...previous, [baseKey]: true }));
    setEditedFields(previous => ({ ...previous, [`${fieldPart}-${recordIndex}`]: true }));
    const store = readDrafts();
    store[id] = { ...(store[id] || {}), [fieldPart]: value };
    writeDrafts(store);
    setEditingField(null);
    setEditValue('');
  }, [getFieldValue]);

  const sectionHasEdits = useCallback((sectionId, recordIndex) => SECTION_FIELDS[sectionId]
    .some(field => pendingEdits[`${field}-${recordIndex}`]), [pendingEdits]);

  const approveSection = useCallback(async (record, sectionId, recordIndex) => {
    const id = safeId(record);
    if (!id) return;
    setSaving(true);
    setSaveError(null);
    try {
      const store = readDrafts();
      const recordDrafts = store[id] || {};
      const committed = [];
      for (const [fieldPart, value] of Object.entries(recordDrafts)) {
        const match = fieldPart.match(/^(.+)\.(\d+)$/);
        const baseField = match && ARRAY_FIELDS.has(match[1]) ? match[1] : fieldPart;
        if (!SECTION_FIELDS[sectionId].includes(baseField)) continue;
        const response = await secureApiClient.put(`/api/edit/well_child_examinations/${id}/edit`, { field: fieldPart, value });
        if (response?.success === false) throw new Error(response.error || 'Save failed');
        committed.push(fieldPart);
      }
      await secureApiClient.put(`/api/edit/well_child_examinations/${id}/approve`, { sectionId, approved: true });
      setPendingEdits(previous => {
        const next = { ...previous };
        SECTION_FIELDS[sectionId].forEach(field => delete next[`${field}-${recordIndex}`]);
        return next;
      });
      committed.forEach(fieldPart => delete recordDrafts[fieldPart]);
      if (Object.keys(recordDrafts).length) store[id] = recordDrafts;
      else delete store[id];
      writeDrafts(store);
      setApprovedSections(previous => ({ ...previous, [`${sectionId}-${recordIndex}`]: true }));
    } catch (error) {
      console.error(error);
      setSaveError('Save failed. Please try again.');
    } finally { setSaving(false); }
  }, []);

  const copyToClipboard = useCallback(async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
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

  const fieldRows = useCallback((field, value) => {
    if (DATE_FIELDS.has(field)) return [formatDate(value)];
    if (field === 'anticipatoryGuidance') {
      return (Array.isArray(value) ? value : []).flatMap(item => {
        const parsed = parseAnticipatory(item);
        return splitByComma(parsed.content).map(clause => ({ subtitle: parsed.topic, value: clause }));
      });
    }
    if (ARRAY_FIELDS.has(field)) return (Array.isArray(value) ? value : []).map(item => String(item));
    return splitFieldValue(field, String(value));
  }, []);

  const buildSectionCopyText = useCallback((record, recordIndex, sectionId) => {
    let text = `${SECTION_TITLES[sectionId]}\n${'='.repeat(40)}\n\n`;
    SECTION_FIELDS[sectionId].forEach(field => {
      const value = getFieldValue(record, field, recordIndex);
      if (!hasVal(value)) return;
      const label = FIELD_LABELS[field];
      text += `${label}\n${'-'.repeat(40)}\n`;
      const rows = fieldRows(field, value);
      let lastSubtitle = null;
      let rowNumber = 1;
      rows.forEach(row => {
        const normalized = typeof row === 'object' ? row : { subtitle: '', value: row };
        if (normalized.subtitle && normalized.subtitle !== lastSubtitle) text += `${normalized.subtitle}\n`;
        text += `${rowNumber++}. ${normalized.value}\n`;
        lastSubtitle = normalized.subtitle;
      });
      text += '\n';
    });
    return text;
  }, [fieldRows, getFieldValue]);

  const copyAll = useCallback(async () => {
    let text = `WELL CHILD EXAMINATIONS\n${'='.repeat(40)}\n\n`;
    records.forEach((record, recordIndex) => {
      text += `Well Child Examination ${recordIndex + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sectionId => { text += buildSectionCopyText(record, recordIndex, sectionId); });
    });
    if (await copyToClipboard(text)) {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  }, [buildSectionCopyText, copyToClipboard, records]);

  const highlight = useCallback((value) => {
    if (!searchTerm.trim()) return value;
    const escaped = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matcher = new RegExp(`(${escaped})`, 'gi');
    return String(value).split(matcher).map((part, index) => matcher.test(part) ? <mark key={index}>{part}</mark> : part);
  }, [searchTerm]);

  const renderEditor = (record, field, recordIndex, rowKey, originalValue, onSave, date = false) => {
    const unitMatch = !date && numericUnit(originalValue);
    return (
      <div className="edit-field-container">
        {date ? (
          <BlueDatePicker value={editValue} onSelect={value => setEditValue(value || '')} />
        ) : unitMatch ? (
          <div className="number-edit-row">
            <button type="button" className="num-step" onClick={event => { event.stopPropagation(); setEditValue(String((Number(editValue) || 0) - 1)); }}>−</button>
            <input type="text" className="edit-input" value={editValue} onChange={event => setEditValue(event.target.value)} />
            <span className="edit-unit">{unitMatch[2]}</span>
            <button type="button" className="num-step" onClick={event => { event.stopPropagation(); setEditValue(String((Number(editValue) || 0) + 1)); }}>+</button>
          </div>
        ) : (
          <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus />
        )}
        {saveError && <div className="save-error">{saveError}</div>}
        <div className="edit-actions">
          <button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation(); onSave(unitMatch ? `${editValue} ${unitMatch[2]}`.trim() : editValue); }}>Save</button>
          <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
        </div>
      </div>
    );
  };

  const renderRow = ({ record, field, recordIndex, rowKey, value, onSave, dataField = field, date = false }) => {
    const editing = editingField === rowKey;
    const modified = editedFields[`${dataField}-${recordIndex}`];
    return (
      <div key={rowKey} className="editable-leaf" data-edit-field={dataField}>
        <div className={`numbered-row editable-row ${modified ? 'modified' : ''}`} onClick={() => {
          if (editing) return;
          setEditingField(rowKey);
          const unitMatch = !date && numericUnit(value);
          setEditValue(date ? toInputDate(value) : (unitMatch ? unitMatch[1] : String(value)));
          setSaveError(null);
        }}>
          {editing ? renderEditor(record, field, recordIndex, rowKey, value, onSave, date) : (
            <>
              <div className="row-content"><span className="content-value">{highlight(date ? formatDate(value) : value)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[rowKey] ? 'copied' : ''}`} onClick={async event => {
                event.stopPropagation();
                if (await copyToClipboard(date ? formatDate(value) : String(value))) {
                  setCopiedItems(previous => ({ ...previous, [rowKey]: true }));
                  setTimeout(() => setCopiedItems(previous => ({ ...previous, [rowKey]: false })), 2000);
                }
              }}>{copiedItems[rowKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {modified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  const renderScalarField = (record, field, recordIndex) => {
    const value = getFieldValue(record, field, recordIndex);
    if (!hasVal(value)) return null;
    const clauses = DATE_FIELDS.has(field) ? [value] : splitFieldValue(field, String(value));
    const label = FIELD_LABELS[field];
    return (
      <div key={field} className="rec-mini-card nested-mini-card">
        <div className="nested-subtitle">{highlight(label)}</div>
        {clauses.map((clause, clauseIndex) => {
          const rowKey = `${field}-${recordIndex}-clause-${clauseIndex}`;
          return renderRow({
            record, field, recordIndex, rowKey, value: clause,
            date: DATE_FIELDS.has(field),
            onSave: nextValue => {
              if (DATE_FIELDS.has(field)) stageField(record, field, recordIndex, nextValue);
              else {
                const updated = [...clauses];
                updated[clauseIndex] = nextValue.trim();
                stageField(record, field, recordIndex, updated.filter(Boolean).join(COMMA_ARRAY_FIELDS.has(field) ? '; ' : '. '));
              }
            },
          });
        })}
      </div>
    );
  };

  const renderArrayField = (record, field, recordIndex) => {
    const value = getFieldValue(record, field, recordIndex);
    const items = Array.isArray(value) ? value.filter(hasVal) : [];
    if (!items.length) return null;
    if (field === 'immunizationsGiven') {
      return (
        <div key={field} className="rec-mini-card nested-mini-card">
          {items.map((item, itemIndex) => renderRow({
            record, field, recordIndex,
            rowKey: `${field}-${recordIndex}-${itemIndex}`,
            dataField: `${field}.${itemIndex}`,
            value: String(item),
            onSave: nextValue => stageArrayElement(record, field, recordIndex, itemIndex, nextValue),
          }))}
        </div>
      );
    }
    return items.map((item, itemIndex) => {
      const parsed = parseAnticipatory(item);
      const clauses = splitByComma(parsed.content);
      return (
        <div key={`${field}-${itemIndex}`} className="rec-mini-card nested-mini-card">
          {parsed.topic && <div className="nested-subtitle">{highlight(parsed.topic)}</div>}
          {clauses.map((clause, clauseIndex) => renderRow({
            record, field, recordIndex,
            rowKey: `${field}-${recordIndex}-${itemIndex}-${clauseIndex}`,
            dataField: `${field}.${itemIndex}`,
            value: clause,
            onSave: nextValue => {
              const updated = [...clauses];
              updated[clauseIndex] = nextValue.trim();
              const nextItem = `${parsed.topic ? `${parsed.topic}: ` : ''}${updated.filter(Boolean).join(', ')}`;
              stageArrayElement(record, field, recordIndex, itemIndex, nextItem);
            },
          }))}
        </div>
      );
    });
  };

  const recordMatchesSearch = useCallback(record => {
    if (!searchTerm.trim()) return true;
    return JSON.stringify(record).toLowerCase().includes(searchTerm.trim().toLowerCase());
  }, [searchTerm]);

  const pdfData = useMemo(() => records.filter(recordMatchesSearch).map((record, recordIndex) => {
    const merged = { ...record };
    Object.entries(localEdits).forEach(([key, value]) => {
      const match = key.match(/^(.+)-(\d+)$/);
      if (!match || Number(match[2]) !== recordIndex || pendingEdits[key]) return;
      setPath(merged, match[1], value);
    });
    return merged;
  }), [localEdits, pendingEdits, recordMatchesSearch, records]);

  return (
    <div ref={containerRef} className="well-child-examinations-document">
      <div className="document-header">
        <h2 className="document-title">Well Child Examinations</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAll}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<WellChildExaminationsDocumentPDFTemplate document={pdfData} />} fileName="Well_Child_Examinations.pdf" className="copy-btn">Export PDF</PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input className="search-input" type="text" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search well child examinations..." />
      </div>
      <div className="records-container">
        {records.filter(recordMatchesSearch).map((record, recordIndex) => (
          <div className="record-card" key={safeId(record) || recordIndex}>
            <div className="record-header"><h3 className="record-name">Well Child Examination {recordIndex + 1}</h3></div>
            {Object.keys(SECTION_FIELDS).map(sectionId => {
              const fields = SECTION_FIELDS[sectionId];
              if (!fields.some(field => hasVal(getFieldValue(record, field, recordIndex)))) return null;
              const copyId = `${sectionId}-${recordIndex}`;
              const hasEdits = sectionHasEdits(sectionId, recordIndex);
              return (
                <section className="section" key={sectionId}>
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h4 className="section-title">{SECTION_TITLES[sectionId]}</h4>
                      <div className="header-right-actions">
                        <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={async () => {
                          if (await copyToClipboard(buildSectionCopyText(record, recordIndex, sectionId))) {
                            setCopiedSection(copyId);
                            setTimeout(() => setCopiedSection(null), 2000);
                          }
                        }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
                        {hasEdits && <button className="approve-btn pending" disabled={saving} onClick={() => approveSection(record, sectionId, recordIndex)}>Pending Approve</button>}
                        {!hasEdits && approvedSections[copyId] && <span className="approve-btn approved">Approved</span>}
                      </div>
                    </div>
                    {fields.map(field => ARRAY_FIELDS.has(field) ? renderArrayField(record, field, recordIndex) : renderScalarField(record, field, recordIndex))}
                  </div>
                </section>
              );
            })}
          </div>
        ))}
        {!records.filter(recordMatchesSearch).length && <div className="no-data">No examination data available</div>}
      </div>
    </div>
  );
};

export default WellChildExaminationsDocument;
