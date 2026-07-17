import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const COLLECTION = 'assistive_devices';
const DISPLAY_FIELDS = ['date', 'facility', 'deviceType', 'deviceName', 'indication', 'prescribedBy', 'dateOrdered', 'dateReceived', 'supplier', 'insurance', 'trainingProvided', 'effectiveness', 'compliance', 'maintenanceSchedule', 'replacementNeeds', 'notes'];
const DATE_FIELDS = new Set(['date', 'dateOrdered', 'dateReceived']);
const NARRATIVE_FIELDS = new Set(['indication', 'trainingProvided', 'effectiveness', 'compliance', 'maintenanceSchedule', 'replacementNeeds', 'notes']);
const SECTIONS = [
  { title: 'Record Information', fields: [['date', 'Date'], ['facility', 'Facility']] },
  { title: 'Device Information', fields: [['deviceType', 'Device Type'], ['deviceName', 'Device Name'], ['indication', 'Indication']] },
  { title: 'Prescription Details', fields: [['prescribedBy', 'Prescribed By'], ['dateOrdered', 'Date Ordered'], ['dateReceived', 'Date Received']] },
  { title: 'Supplier & Insurance', fields: [['supplier', 'Supplier'], ['insurance', 'Insurance']] },
  { title: 'Training & Compliance', fields: [['trainingProvided', 'Training Provided'], ['effectiveness', 'Effectiveness'], ['compliance', 'Compliance']] },
  { title: 'Maintenance', fields: [['maintenanceSchedule', 'Maintenance Schedule'], ['replacementNeeds', 'Replacement Needs']] },
  { title: 'Notes', fields: [['notes', 'Notes']] },
];

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.32, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', textAlign: 'center', borderBottom: '2pt solid #000000', paddingBottom: 6, marginBottom: 14 },
  recordHeader: { marginBottom: 12 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', borderBottom: '1pt solid #000000', paddingBottom: 3 },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', borderBottom: '1pt solid #000000', paddingBottom: 2, marginBottom: 6 },
  fieldRow: { marginBottom: 7 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', borderBottom: '0.5pt solid #999999', paddingBottom: 1, marginBottom: 3 },
  fieldValue: { fontSize: 14, lineHeight: 1.32 },
  listItem: { fontSize: 14, lineHeight: 1.32, marginBottom: 4, paddingLeft: 10 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#555555' },
});

const hasValue = value => value !== null && value !== undefined && (typeof value !== 'string' || value.trim() !== '');
const safeString = value => String(value ?? '').replace(/μm|µm/g, 'um').replace(/°/g, ' deg').replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->');
const formatDate = value => {
  if (!value) return '';
  try { const date = new Date(value.$date || value); return Number.isNaN(date.getTime()) ? safeString(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return safeString(value); }
};
const splitClauses = text => {
  const source = String(text || ''); if (!source.trim()) return [];
  const clauses = []; let current = ''; let depth = 0;
  const push = () => { const value = current.trim(); if (value) clauses.push(value); current = ''; };
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') { depth += 1; current += char; continue; }
    if (char === ')') { depth = Math.max(0, depth - 1); current += char; continue; }
    if (depth === 0 && (char === '.' || char === ';') && (index + 1 === source.length || /\s/.test(source[index + 1]))) { push(); continue; }
    current += char;
  }
  push(); return clauses;
};
const unwrapRecords = source => {
  if (!source) return [];
  const queue = Array.isArray(source) ? [...source] : [source]; const records = [];
  while (queue.length) {
    const value = queue.shift(); if (!value) continue;
    if (Array.isArray(value)) { queue.unshift(...value); continue; }
    if (value[COLLECTION] !== undefined) { queue.unshift(value[COLLECTION]); continue; }
    if (value.documentData !== undefined) { queue.unshift(value.documentData); continue; }
    if (value.data !== undefined && !DISPLAY_FIELDS.some(field => hasValue(value[field]))) { queue.unshift(value.data); continue; }
    if (value.records !== undefined) { queue.unshift(value.records); continue; }
    if (typeof value === 'object') records.push(value);
  }
  return records.filter(record => DISPLAY_FIELDS.some(field => hasValue(record[field])));
};
const fieldRows = (record, section) => section.fields.flatMap(([field, label]) => {
  const value = record[field]; if (!hasValue(value)) return [];
  const display = DATE_FIELDS.has(field) ? formatDate(value) : value;
  if (NARRATIVE_FIELDS.has(field)) {
    const clauses = splitClauses(display);
    const labelRow = label !== section.title ? [<Text style={styles.fieldLabel} key={`${field}-label`}>{label}</Text>] : [];
    return [...labelRow, ...clauses.map((clause, index) => <Text style={styles.listItem} key={`${field}-${index}`}>{index + 1}. {safeString(clause)}</Text>)];
  }
  return [<View style={styles.fieldRow} key={field}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{safeString(display)}</Text></View>];
});
const renderSection = (record, section) => {
  const rows = fieldRows(record, section); if (!rows.length) return null;
  const [first, ...rest] = rows;
  return <View style={styles.section} key={section.title}><View wrap={false}><Text style={styles.sectionTitle}>{section.title}</Text>{first}</View>{rest}</View>;
};

const AssistiveDevicesDocumentPDFTemplate = ({ document: documentProp, data, templateData }) => {
  const records = unwrapRecords(documentProp || data || templateData);
  if (!records.length) return <Document><Page size="A4" style={styles.page}><Text style={styles.noData}>No assistive devices records available</Text></Page></Document>;
  return <Document><Page size="A4" style={styles.page} wrap><Text style={styles.documentTitle}>Assistive Devices</Text>{records.map((record, index) => <React.Fragment key={record._id?.$oid || String(record._id || index)}><View style={styles.recordHeader} wrap={false}><Text style={styles.recordTitle}>Assistive Device {index + 1}</Text></View>{SECTIONS.map(section => renderSection(record, section))}</React.Fragment>)}</Page></Document>;
};

export default AssistiveDevicesDocumentPDFTemplate;
