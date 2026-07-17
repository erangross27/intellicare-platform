import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const COLLECTION = 'autoimmune_evaluations';
const COMMA_SPLIT_FIELDS = ['physicalExam', 'inflammatoryMarkers'];
const ARRAY_FIELDS = new Set(['symptoms', 'organInvolvement', 'treatment']);
const NARRATIVE_FIELDS = new Set(['imaging', 'biopsy', 'monitoring', 'notes']);
const LABELS = {
  date: 'Date',
  rheumatologist: 'Rheumatologist',
  facility: 'Facility',
  suspectedCondition: 'Suspected Condition',
  diagnosis: 'Diagnosis',
  diseaseActivity: 'Disease Activity',
  symptoms: 'Symptoms',
  physicalExam: 'Physical Exam',
  serology: 'Serology',
  inflammatoryMarkers: 'Inflammatory Markers',
  organInvolvement: 'Organ Involvement',
  imaging: 'Imaging',
  biopsy: 'Biopsy',
  treatment: 'Treatment',
  monitoring: 'Monitoring',
  notes: 'Notes',
};
const SECTIONS = [
  { title: 'Date', fields: ['date'] },
  { title: 'Record Information', fields: ['rheumatologist', 'facility'] },
  { title: 'Clinical Information', fields: ['suspectedCondition', 'diagnosis', 'diseaseActivity'] },
  { title: 'Symptoms', fields: ['symptoms'] },
  { title: 'Physical Exam', fields: ['physicalExam'] },
  { title: 'Serology', fields: ['serology'] },
  { title: 'Inflammatory Markers', fields: ['inflammatoryMarkers'] },
  { title: 'Organ Involvement', fields: ['organInvolvement'] },
  { title: 'Imaging', fields: ['imaging'] },
  { title: 'Biopsy', fields: ['biopsy'] },
  { title: 'Treatment', fields: ['treatment'] },
  { title: 'Monitoring', fields: ['monitoring'] },
  { title: 'Notes', fields: ['notes'] },
];

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.32, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', textAlign: 'center', borderBottom: '2pt solid #000000', paddingBottom: 6, marginBottom: 14 },
  recordHeader: { marginBottom: 12 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', borderBottom: '1pt solid #000000', paddingBottom: 4 },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', borderBottom: '1pt solid #000000', paddingBottom: 2, marginBottom: 6 },
  fieldGroup: { marginBottom: 7 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', borderBottom: '0.5pt solid #999999', paddingBottom: 1, marginBottom: 3 },
  subtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', marginTop: 3, marginBottom: 2 },
  fieldValue: { fontSize: 14, lineHeight: 1.32, marginBottom: 4, paddingLeft: 10 },
  noData: { fontSize: 14, marginTop: 40, textAlign: 'center' },
});

const hasValue = value => value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.some(hasValue)) && (typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(hasValue));
const humanize = key => String(key || '').replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, character => character.toUpperCase());
const formatDate = value => {
  const raw = value?.$date || value;
  const match = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(raw || '');
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? String(raw) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};
const displayValue = value => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '');
const parseLabel = text => {
  const match = String(text || '').match(/^([A-Z][A-Za-z0-9 /&()'"-]{1,60}?):\s+([\s\S]+)$/);
  return match ? { subtitle: match[1].trim(), value: match[2].trim() } : { subtitle: '', value: String(text || '').trim() };
};
const splitClauses = (field, text, splitCommas = COMMA_SPLIT_FIELDS.includes(field)) => {
  const source = String(text || '');
  const output = [];
  let current = '';
  let depth = 0;
  const push = () => { if (current.trim()) output.push(current.trim()); current = ''; };
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(') depth += 1;
    if (character === ')') depth = Math.max(0, depth - 1);
    const sentenceBreak = depth === 0 && (character === '.' || character === ';') && (index + 1 === source.length || /\s/.test(source[index + 1]));
    const commaBreak = depth === 0 && splitCommas && character === ',';
    if (sentenceBreak || commaBreak) push();
    else current += character;
  }
  push();
  return output;
};
const nestedLeaves = (value, prefix, labelPrefix = '') => {
  if (Array.isArray(value)) return value.flatMap((child, index) => {
    const path = `${prefix}.${index}`;
    if (child && typeof child === 'object' && !child.$date) return nestedLeaves(child, path, `${labelPrefix || 'Item'} ${index + 1}`);
    return hasValue(child) ? [{ path, rowLabel: labelPrefix ? `${labelPrefix} ${index + 1}` : '', value: child }] : [];
  });
  return Object.entries(value || {}).flatMap(([key, child]) => {
    const path = `${prefix}.${key}`;
    const label = labelPrefix ? `${labelPrefix} — ${humanize(key)}` : humanize(key);
    if (child && typeof child === 'object' && !child.$date) return nestedLeaves(child, path, label);
    return hasValue(child) ? [{ path, rowLabel: label, value: child }] : [];
  });
};
const serologyGroups = value => Object.entries(value || {}).flatMap(([key, child]) => {
  if (!hasValue(child)) return [];
  const path = `serology.${key}`;
  const subtitle = humanize(key);
  if (Array.isArray(child)) return [{ subtitle, leaves: child.flatMap((item, index) => item && typeof item === 'object' && !item.$date ? nestedLeaves(item, `${path}.${index}`, `Item ${index + 1}`) : hasValue(item) ? [{ path: `${path}.${index}`, rowLabel: '', value: item }] : []) }];
  if (child && typeof child === 'object' && !child.$date) return [{ subtitle, leaves: nestedLeaves(child, path) }];
  return [{ subtitle, leaves: [{ path, rowLabel: '', value: child }] }];
});
const unwrapRecords = source => {
  if (!source) return [];
  const queue = Array.isArray(source) ? [...source] : [source];
  const records = [];
  while (queue.length) {
    const value = queue.shift();
    if (!value) continue;
    if (Array.isArray(value)) { queue.unshift(...value); continue; }
    if (value[COLLECTION] !== undefined) { queue.unshift(value[COLLECTION]); continue; }
    if (value.documentData !== undefined) { queue.unshift(value.documentData); continue; }
    if (value.data !== undefined && !Object.keys(LABELS).some(field => hasValue(value[field]))) { queue.unshift(value.data); continue; }
    if (value.records !== undefined) { queue.unshift(value.records); continue; }
    if (typeof value === 'object') records.push(value);
  }
  return records.filter(record => Object.keys(LABELS).some(field => hasValue(record[field])));
};
const rowsFor = (record, field) => {
  const value = record[field];
  if (!hasValue(value)) return [];
  if (field === 'date') return [{ subtitle: '', value: formatDate(value) }];
  if (ARRAY_FIELDS.has(field)) return value.filter(hasValue).map(item => ({ subtitle: '', value: displayValue(item) }));
  if (field === 'serology') return serologyGroups(value).flatMap(group => group.leaves.map(leaf => {
    const rendered = /(?:^|\.)(?:date|reviewDate)$/i.test(leaf.path) ? formatDate(leaf.value) : displayValue(leaf.value);
    return { subtitle: group.subtitle, value: leaf.rowLabel ? `${leaf.rowLabel} — ${rendered}` : rendered };
  }));
  if (COMMA_SPLIT_FIELDS.includes(field) || NARRATIVE_FIELDS.has(field)) return splitClauses(field, value).map(text => parseLabel(text));
  return [{ subtitle: '', value: displayValue(value) }];
};
const renderSection = (record, section, key) => {
  const fields = section.fields.filter(field => rowsFor(record, field).length);
  if (!fields.length) return null;
  const units = fields.flatMap(field => {
    const rows = rowsFor(record, field);
    const showLabel = LABELS[field] !== section.title;
    return rows.map((row, index) => {
      const priorSubtitle = index > 0 ? rows[index - 1].subtitle : null;
      return <View style={styles.fieldGroup} key={`${field}-${index}`} wrap={false}>{showLabel && index === 0 && <Text style={styles.fieldLabel}>{LABELS[field]}</Text>}{row.subtitle && row.subtitle !== priorSubtitle && <Text style={styles.subtitle}>{row.subtitle}</Text>}<Text style={styles.fieldValue}>{index + 1}. {row.value}</Text></View>;
    });
  });
  const [first, ...rest] = units;
  return <View style={styles.section} key={key}><View wrap={false}><Text style={styles.sectionTitle}>{section.title}</Text>{first}</View>{rest}</View>;
};

const AutoimmuneEvaluationsDocumentPDFTemplate = ({ document: documentProp, data, templateData }) => {
  const records = unwrapRecords(documentProp || data || templateData);
  if (!records.length) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Autoimmune Evaluations</Text><Text style={styles.noData}>No autoimmune evaluation data available</Text></Page></Document>;
  return <Document><Page size="A4" style={styles.page} wrap><Text style={styles.documentTitle}>Autoimmune Evaluations</Text>{records.map((record, index) => <React.Fragment key={record._id?.$oid || String(record._id || index)}><View style={styles.recordHeader} wrap={false}><Text style={styles.recordTitle}>Autoimmune Evaluation {index + 1}</Text></View>{SECTIONS.map((section, sectionIndex) => renderSection(record, section, sectionIndex))}</React.Fragment>)}</Page></Document>;
};

export default AutoimmuneEvaluationsDocumentPDFTemplate;
