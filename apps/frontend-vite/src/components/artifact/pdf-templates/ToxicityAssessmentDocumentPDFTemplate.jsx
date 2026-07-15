/**
 * ToxicityAssessmentDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER size — box-free toxicity assessment
 * Collection: toxicity_assessment
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 5, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginTop: 12, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginTop: 6, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  noDataText: { fontSize: 14, color: '#000000', marginTop: 40 },
});

const SECTION_TITLES = {
  'visit-info': 'Visit Information',
  'adverse-events': 'Adverse Events',
  'dose-management': 'Dose Management',
  'supportive-measures': 'Supportive Measures',
  'clinical-assessment': 'Clinical Assessment',
};

const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility', status: 'Status', ctcaeGrade: 'CTCAE Grading', adverseEvents: 'Adverse Events',
  doseModifications: 'Dose Modifications', treatmentDelays: 'Treatment Delays', supportiveCare: 'Supportive Care', findings: 'Findings',
  assessment: 'Assessment', plan: 'Plan', notes: 'Notes', recommendations: 'Recommendations', results: 'Results',
};

const SECTION_FIELDS = {
  'visit-info': ['date', 'provider', 'facility', 'status', 'ctcaeGrade'],
  'adverse-events': ['adverseEvents'],
  'dose-management': ['doseModifications', 'treatmentDelays'],
  'supportive-measures': ['supportiveCare'],
  'clinical-assessment': ['findings', 'assessment', 'plan', 'notes', 'recommendations', 'results'],
};

const DATE_FIELDS = ['date'];
const OBJECT_FIELDS = ['ctcaeGrade', 'results'];
const OBJECT_ARRAY_FIELDS = ['adverseEvents'];
const STRING_ARRAY_FIELDS = ['doseModifications', 'treatmentDelays', 'supportiveCare', 'recommendations'];
const PERIOD_SPLIT_FIELDS = new Set(['findings', 'assessment', 'plan', 'notes', 'doseModifications', 'treatmentDelays', 'supportiveCare', 'recommendations']);

const safeString = value => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/×/g, 'x').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...');
};

const humanizeKey = key => {
  const overrides = { ctcae: 'CTCAE', id: 'ID' };
  if (overrides[String(key || '').toLowerCase()]) return overrides[String(key).toLowerCase()];
  const value = String(key || '').replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const formatDate = value => {
  if (!value) return '';
  try {
    const date = new Date(value.$date || value);
    return isNaN(date.getTime()) ? safeString(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return safeString(value); }
};

const parseLabel = text => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const match = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  return match ? { isLabeled: true, label: match[1].trim(), value: match[2].trim() } : { isLabeled: false, label: '', value: text };
};

const splitByComma = text => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = [];
  let current = '';
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '(') depth += 1;
    if (character === ')') depth = Math.max(0, depth - 1);
    if (character === ',' && depth === 0) {
      const before = current.trim();
      const after = text.slice(index + 1).trimStart();
      if (/\d$/.test(before) && /^\d{3}\b/.test(after)) current += character;
      else { if (before) result.push(before); current = ''; }
    } else current += character;
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [text];
};

const splitEditableClauses = (value, fieldPath) => {
  const source = String(value ?? '');
  const parts = [];
  let current = '';
  let depth = 0;
  const push = () => { if (current.trim()) parts.push(current.trim()); current = ''; };
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(') depth += 1;
    if (character === ')') depth = Math.max(0, depth - 1);
    const next = source[index + 1] || '';
    const previousWord = current.trim().match(/([A-Za-z]+)$/)?.[1] || '';
    const safePeriod = character === '.' && PERIOD_SPLIT_FIELDS.has(fieldPath) && depth === 0 && /\s/.test(next)
      && !['Mr', 'Mrs', 'Ms', 'Dr', 'St', 'Jr', 'Sr', 'Prof', 'Rev', 'Gen', 'Col', 'Sgt', 'vs', 'etc'].includes(previousWord)
      && !/\d$/.test(current);
    const safeSemicolon = character === ';' && PERIOD_SPLIT_FIELDS.has(fieldPath) && depth === 0;
    if (safePeriod || safeSemicolon) {
      push();
      while (/\s/.test(source[index + 1] || '')) index += 1;
    } else current += character;
  }
  push();
  return parts.length ? parts : [source];
};

const isEmptyDeep = value => {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value === 'boolean' || typeof value === 'number') return false;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.every(isEmptyDeep);
  if (typeof value === 'object') return Object.values(value).every(isEmptyDeep);
  return false;
};

const fmtScalar = value => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : safeString(value);
const sameAsTitle = (label, sid) => (label || '').trim().toLowerCase() === (SECTION_TITLES[sid] || '').trim().toLowerCase();

const unwrapRecords = data => {
  if (!data) return [];
  const initial = Array.isArray(data) ? data : [data];
  return initial.flatMap(record => {
    if (record?.toxicity_assessment) return Array.isArray(record.toxicity_assessment) ? record.toxicity_assessment : [record.toxicity_assessment];
    if (record?._records && Array.isArray(record._records)) return record._records;
    if (record?.documentData) {
      const inner = record.documentData;
      if (Array.isArray(inner)) return inner;
      if (inner?.toxicity_assessment) return Array.isArray(inner.toxicity_assessment) ? inner.toxicity_assessment : [inner.toxicity_assessment];
      return [inner];
    }
    return [record];
  }).filter(record => record && typeof record === 'object');
};

const ToxicityAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);

  const objectElements = (value, keyPrefix) => {
    const elements = [];
    Object.entries(value || {}).filter(([, child]) => !isEmptyDeep(child)).forEach(([key, child], index) => {
      elements.push(<Text key={`${keyPrefix}-${key}-${index}-label`} style={styles.subLabel}>{safeString(humanizeKey(key))}</Text>);
      if (child && typeof child === 'object' && !Array.isArray(child)) elements.push(...objectElements(child, `${keyPrefix}-${key}`));
      else if (Array.isArray(child)) child.filter(item => !isEmptyDeep(item)).forEach((item, itemIndex) => elements.push(<Text key={`${keyPrefix}-${key}-${itemIndex}`} style={styles.listItem}>{itemIndex + 1}. {fmtScalar(item)}</Text>));
      else elements.push(<Text key={`${keyPrefix}-${key}-${index}-value`} style={styles.listItem}>1. {fmtScalar(child)}</Text>);
    });
    return elements;
  };

  const fieldBody = (record, fn, sid) => {
    const value = record[fn];
    if (isEmptyDeep(value)) return [];
    const label = FIELD_LABELS[fn] || fn;
    const elements = [];
    if (!sameAsTitle(label, sid)) elements.push(<Text key={`${fn}-label`} style={styles.fieldLabel} minPresenceAhead={26}>{safeString(label)}</Text>);
    if (DATE_FIELDS.includes(fn)) {
      elements.push(<Text key={`${fn}-value`} style={styles.value}>1. {formatDate(value)}</Text>);
    } else if (OBJECT_FIELDS.includes(fn)) {
      elements.push(...objectElements(value, fn));
    } else if (OBJECT_ARRAY_FIELDS.includes(fn)) {
      value.filter(item => item && typeof item === 'object').forEach((item, itemIndex) => {
        elements.push(<Text key={`${fn}-${itemIndex}-title`} style={styles.subLabel}>Adverse Event {itemIndex + 1}</Text>);
        [['event', 'Event'], ['grade', 'Grade'], ['attribution', 'Attribution'], ['management', 'Management']].forEach(([key, subLabel]) => {
          if (isEmptyDeep(item[key])) return;
          elements.push(<Text key={`${fn}-${itemIndex}-${key}-label`} style={styles.subLabel}>{subLabel}</Text>);
          const parsedManagement = key === 'management' ? parseLabel(String(item[key])) : { isLabeled: false, label: '', value: String(item[key]) };
          if (parsedManagement.isLabeled) elements.push(<Text key={`${fn}-${itemIndex}-${key}-nested-label`} style={styles.subLabel}>{safeString(parsedManagement.label)}</Text>);
          const items = key === 'management' ? splitByComma(parsedManagement.value) : [String(item[key])];
          items.forEach((part, partIndex) => elements.push(<Text key={`${fn}-${itemIndex}-${key}-${partIndex}`} style={styles.listItem}>{partIndex + 1}. {safeString(part)}</Text>));
        });
      });
    } else if (STRING_ARRAY_FIELDS.includes(fn)) {
      value.filter(item => !isEmptyDeep(item)).forEach((item, itemIndex) => {
        let rowNumber = 1;
        splitEditableClauses(String(item), fn).forEach((clause, clauseIndex) => {
          const parsed = parseLabel(clause);
          if (parsed.isLabeled) elements.push(<Text key={`${fn}-${itemIndex}-${clauseIndex}-label`} style={styles.subLabel}>{safeString(parsed.label)}</Text>);
          elements.push(<Text key={`${fn}-${itemIndex}-${clauseIndex}-value`} style={styles.listItem}>{rowNumber++}. {safeString(parsed.isLabeled ? parsed.value : clause)}</Text>);
        });
      });
    } else {
      let number = 1;
      splitEditableClauses(value, fn).forEach((clause, clauseIndex) => {
        const parsed = parseLabel(clause);
        const items = parsed.isLabeled ? splitByComma(parsed.value) : [clause];
        if (parsed.isLabeled) elements.push(<Text key={`${fn}-${clauseIndex}-label`} style={styles.subLabel}>{safeString(parsed.label)}</Text>);
        items.forEach((item, itemIndex) => elements.push(<Text key={`${fn}-${clauseIndex}-${itemIndex}`} style={styles.listItem}>{number++}. {safeString(item)}</Text>));
      });
    }
    return elements;
  };

  const renderSection = (record, sid) => {
    let body = [];
    (SECTION_FIELDS[sid] || []).forEach(fn => { body = body.concat(fieldBody(record, fn, sid)); });
    if (!body.length) return null;
    body = body.map((element, index) => React.cloneElement(element, { key: `${sid}-${index}` }));
    const [first, ...rest] = body;
    return <View key={sid}><View wrap={false}><Text style={styles.sectionTitle}>{safeString(SECTION_TITLES[sid])}</Text>{first}</View>{rest}</View>;
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Toxicity Assessment</Text>
        {records.length === 0 && <Text style={styles.noDataText}>No toxicity assessment records available</Text>}
        {records.map((record, index) => (
          <View key={index} break={index > 0}>
            <Text style={styles.recordTitle}>{`Toxicity Assessment ${index + 1}`}</Text>
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ToxicityAssessmentDocumentPDFTemplate;
