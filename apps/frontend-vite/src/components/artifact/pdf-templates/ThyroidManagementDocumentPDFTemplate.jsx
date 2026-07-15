/**
 * ThyroidManagementDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER size — box-free — thyroid management
 * Collection: thyroid_management
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
  'clinical-info': 'Clinical Information',
  'medication-details': 'Medication Details',
  monitoring: 'Monitoring',
  'findings-assessment': 'Findings and Assessment',
  'plan-recommendations': 'Plan and Recommendations',
  notes: 'Notes',
};

const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility', status: 'Status',
  medication: 'Medication', dosage: 'Dosage', frequency: 'Frequency',
  monitoringSchedule: 'Monitoring Schedule', targetLevels: 'Target Levels',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan', recommendations: 'Recommendations', notes: 'Notes',
};

const SECTION_FIELDS = {
  'clinical-info': ['date', 'provider', 'facility', 'status'],
  'medication-details': ['medication', 'dosage', 'frequency'],
  monitoring: ['monitoringSchedule', 'targetLevels'],
  'findings-assessment': ['findings', 'assessment'],
  'plan-recommendations': ['plan', 'recommendations'],
  notes: ['notes'],
};

const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['recommendations'];
const COMMA_SPLIT_FIELDS = new Set(['findings', 'assessment', 'plan']);
const PERIOD_SPLIT_FIELDS = new Set(['provider', 'facility', 'status', 'medication', 'dosage', 'frequency', 'monitoringSchedule', 'targetLevels', 'findings', 'assessment', 'plan', 'notes']);

const safeString = value => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/×/g, 'x').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...');
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

const splitEditableClauses = (value, fieldPath) => {
  const source = String(value ?? '');
  const parts = [];
  let current = '';
  let depth = 0;
  const push = delimiter => { if (current.trim()) parts.push({ text: current.trim(), delimiter }); current = ''; };
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(') depth += 1;
    if (character === ')') depth = Math.max(0, depth - 1);
    const next = source[index + 1] || '';
    const previousWord = current.trim().match(/([A-Za-z]+)$/)?.[1] || '';
    const safePeriod = character === '.' && PERIOD_SPLIT_FIELDS.has(fieldPath) && depth === 0 && /\s/.test(next)
      && !['Mr', 'Mrs', 'Ms', 'Dr', 'St', 'Jr', 'Sr', 'Prof', 'Rev', 'Gen', 'Col', 'Sgt', 'vs', 'etc'].includes(previousWord)
      && !/\d$/.test(current);
    const safeComma = character === ',' && COMMA_SPLIT_FIELDS.has(fieldPath) && depth === 0;
    const safeSemicolon = character === ';' && depth === 0;
    if (safePeriod || safeComma || safeSemicolon) {
      let delimiter = character;
      while (/\s/.test(source[index + 1] || '')) { delimiter += source[index + 1]; index += 1; }
      push(delimiter);
    } else current += character;
  }
  push('');
  return parts.length ? parts : [{ text: source, delimiter: '' }];
};

const hasVal = (record, fn) => {
  const value = record[fn];
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(item => item !== null && item !== undefined && String(item).trim() !== '');
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

const sameAsTitle = (label, sid) => (label || '').trim().toLowerCase() === (SECTION_TITLES[sid] || '').trim().toLowerCase();

const unwrapRecords = data => {
  if (!data) return [];
  const initial = Array.isArray(data) ? data : [data];
  return initial.flatMap(record => {
    if (record?.thyroid_management) return Array.isArray(record.thyroid_management) ? record.thyroid_management : [record.thyroid_management];
    if (record?.documentData) {
      const inner = record.documentData;
      if (Array.isArray(inner)) return inner;
      if (inner?.thyroid_management) return Array.isArray(inner.thyroid_management) ? inner.thyroid_management : [inner.thyroid_management];
      return [inner];
    }
    return [record];
  }).filter(record => record && typeof record === 'object');
};

const ThyroidManagementDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);

  const fieldBody = (record, fn, sid) => {
    if (!hasVal(record, fn)) return [];
    const label = FIELD_LABELS[fn] || fn;
    const value = record[fn];
    const elements = [];
    if (!sameAsTitle(label, sid)) elements.push(<Text key={`${fn}-label`} style={styles.fieldLabel} minPresenceAhead={26}>{safeString(label)}</Text>);

    if (DATE_FIELDS.includes(fn)) {
      elements.push(<Text key={`${fn}-value`} style={styles.value}>1. {formatDate(value)}</Text>);
      return elements;
    }

    if (ARRAY_FIELDS.includes(fn)) {
      let number = 1;
      value.filter(Boolean).forEach((item, itemIdx) => {
        const parsed = parseLabel(String(item));
        if (parsed.isLabeled) {
          elements.push(<Text key={`${fn}-${itemIdx}-label`} style={styles.subLabel}>{safeString(parsed.label)}</Text>);
          elements.push(<Text key={`${fn}-${itemIdx}-value`} style={styles.listItem}>{number++}. {safeString(parsed.value)}</Text>);
        } else elements.push(<Text key={`${fn}-${itemIdx}`} style={styles.listItem}>{number++}. {safeString(item)}</Text>);
      });
      return elements;
    }

    splitEditableClauses(value, fn).forEach((entry, entryIdx) => {
      elements.push(<Text key={`${fn}-${entryIdx}`} style={entryIdx === 0 ? styles.value : styles.listItem}>{entryIdx + 1}. {safeString(entry.text)}</Text>);
    });
    return elements;
  };

  const renderSection = (record, sid) => {
    let body = [];
    (SECTION_FIELDS[sid] || []).forEach(fn => { body = body.concat(fieldBody(record, fn, sid)); });
    if (!body.length) return null;
    body = body.map((element, idx) => React.cloneElement(element, { key: `${sid}-${idx}` }));
    const [first, ...rest] = body;
    return (
      <View key={sid}>
        <View wrap={false}>
          <Text style={styles.sectionTitle}>{safeString(SECTION_TITLES[sid])}</Text>
          {first}
        </View>
        {rest}
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Thyroid Management</Text>
        {records.length === 0 && <Text style={styles.noDataText}>No thyroid management records available</Text>}
        {records.map((record, idx) => (
          <View key={idx} break={idx > 0}>
            <Text style={styles.recordTitle}>{record.medication || `Thyroid Management ${idx + 1}`}</Text>
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ThyroidManagementDocumentPDFTemplate;
