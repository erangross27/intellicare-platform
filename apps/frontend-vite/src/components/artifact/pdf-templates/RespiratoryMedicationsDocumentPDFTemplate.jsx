import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.35, color: '#000' },
  documentHeader: { marginBottom: 20 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 18 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000', borderBottomStyle: 'solid', marginBottom: 12 },
  block: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000', borderBottomStyle: 'solid', marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999', borderBottomStyle: 'solid', marginBottom: 3 },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  fieldValue: { fontSize: 14 },
  listItem: { fontSize: 14, paddingLeft: 10 },
  noDataText: { fontSize: 14, marginTop: 30 },
});

const SECTION_CONFIGS = [
  { title: 'Medication Information', fields: ['name', 'genericName', 'dosage', 'frequency', 'route'] },
  { title: 'Controller Medications', fields: ['controllers'] },
  { title: 'Reliever Medications', fields: ['relievers'] },
  { title: 'Biologic Therapy', fields: ['biologics'] },
  { title: 'Nebulizer Medications', fields: ['nebulizers'] },
  { title: 'Oral Corticosteroids', fields: ['oralCorticosteroids'] },
  { title: 'Additional Information', fields: ['startDate', 'endDate', 'duration', 'durationDays', 'durationUnit', 'prescriber', 'indication', 'instructions', 'refills', 'active', 'sideEffects', 'drugInteractions', 'safetyWarning'] },
];
const FIELD_LABELS = {
  name: 'Name', genericName: 'Generic Name', dosage: 'Dosage', frequency: 'Frequency', route: 'Route',
  controllers: 'Controller Medications', relievers: 'Reliever Medications', biologics: 'Biologic Therapy',
  nebulizers: 'Nebulizer Medications', oralCorticosteroids: 'Oral Corticosteroids', startDate: 'Start Date',
  endDate: 'End Date', duration: 'Duration', durationDays: 'Duration (Days)', durationUnit: 'Duration Unit',
  prescriber: 'Prescriber', indication: 'Indication', instructions: 'Instructions', refills: 'Refills',
  active: 'Status', sideEffects: 'Side Effects', drugInteractions: 'Drug Interactions', safetyWarning: 'Safety Warning',
};
const COMMA_FIELDS = ['oralCorticosteroids.duration'];
const ZERO_HIDDEN_FIELDS = ['durationDays', 'refills'];

const humanizeKey = key => String(key || '').replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/\b\w/g, char => char.toUpperCase()).trim();
const isEmptyDeep = value => value == null || value === '' || (Array.isArray(value) ? !value.some(item => !isEmptyDeep(item)) : typeof value === 'object' ? Object.values(value).every(isEmptyDeep) : false);
const isDateValue = value => Boolean(value?.$date || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)));
const fmt = value => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '');
const formatDate = value => {
  try { const date = new Date(value?.$date || value); return Number.isNaN(date.getTime()) ? fmt(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return fmt(value); }
};
const displayScalar = (fieldPath, value) => fieldPath === 'active' && typeof value === 'boolean'
  ? (value ? 'Active' : 'Discontinued')
  : isDateValue(value) ? formatDate(value) : fmt(value);
const hasVisibleValue = (path, value) => !isEmptyDeep(value) && !(ZERO_HIDDEN_FIELDS.includes(path) && Number(value) === 0);
const splitByComma = text => {
  const source = String(text || ''); const result = []; let current = ''; let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') { depth += 1; current += char; continue; }
    if (char === ')') { depth = Math.max(0, depth - 1); current += char; continue; }
    if (char === ',' && depth === 0) { if (current.trim()) result.push(current.trim()); current = ''; }
    else current += char;
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [source];
};
// Split narrative delimiters /[.;]\s+/: semicolons always split; periods retain abbreviation/number guards.
const splitSentencesWithSeparators = text => String(text || '')
  .split(/(?:;\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+)/)
  .map(value => value.replace(/^[;.,\s]+|[;.,\s]+$/g, '').trim())
  .filter(Boolean);
const splitTextRows = (path, value) => splitSentencesWithSeparators(value).flatMap(sentence => COMMA_FIELDS.includes(path) ? splitByComma(sentence) : [sentence]);

const scalarBlocks = (label, value, path, showFieldLabel = true, prefix = '') => {
  if (!hasVisibleValue(path, value)) return [];
  const rows = splitTextRows(path, displayScalar(path, value));
  return rows.map((row, index) => ({
    key: `${path}-${index}`,
    fieldLabel: index === 0 && showFieldLabel ? label : '',
    subLabel: index === 0 ? prefix : '',
    value: row,
    rowNumber: rows.length > 1 ? index + 1 : undefined,
  }));
};
const nodeBlocks = (label, value, path, showFieldLabel = true, prefix = '') => {
  if (!hasVisibleValue(path, value)) return [];
  if (isDateValue(value) || typeof value !== 'object') return scalarBlocks(label, value, path, showFieldLabel, prefix);
  const blocks = [];
  if (Array.isArray(value)) {
    value.forEach((item, itemIndex) => {
      if (isEmptyDeep(item)) return;
      const itemPath = `${path}.${itemIndex}`;
      if (isDateValue(item) || typeof item !== 'object') {
        const itemBlocks = scalarBlocks(label, item, itemPath, blocks.length === 0 && showFieldLabel, blocks.length === 0 ? prefix : '');
        itemBlocks.forEach(block => blocks.push({ ...block, rowNumber: blocks.length + 1 }));
        return;
      }
      let itemCaptionAdded = false;
      Object.entries(item).filter(([, child]) => !isEmptyDeep(child)).forEach(([key, child]) => {
        const childBlocks = nodeBlocks(label, child, `${itemPath}.${key}`, blocks.length === 0 && showFieldLabel, humanizeKey(key));
        if (childBlocks.length && !itemCaptionAdded) { childBlocks[0].itemLabel = `Item ${itemIndex + 1}`; itemCaptionAdded = true; }
        blocks.push(...childBlocks);
      });
    });
    return blocks;
  }
  Object.entries(value).filter(([key, child]) => key !== '_id' && !isEmptyDeep(child)).forEach(([key, child]) => {
    blocks.push(...nodeBlocks(label, child, `${path}.${key}`, blocks.length === 0 && showFieldLabel, prefix ? `${prefix} - ${humanizeKey(key)}` : humanizeKey(key)));
  });
  return blocks;
};
const sectionBlocks = (record, section) => section.fields.flatMap(field => {
  const value = record[field];
  const label = FIELD_LABELS[field] || humanizeKey(field);
  const showLabel = label.toLowerCase() !== section.title.toLowerCase();
  return nodeBlocks(label, value, field, showLabel);
});
const renderSection = (title, blocks, key) => {
  if (!blocks.length) return null;
  return <React.Fragment key={key}>{blocks.map((block, index) => (
    <View key={block.key} style={styles.block} wrap={false}>
      {index === 0 && <Text style={styles.sectionTitle}>{title}</Text>}
      {block.fieldLabel && block.fieldLabel !== title && <Text style={styles.fieldLabel}>{block.fieldLabel}</Text>}
      {block.itemLabel && <Text style={styles.subLabel}>{block.itemLabel}</Text>}
      {block.subLabel && <Text style={styles.subLabel}>{block.subLabel}</Text>}
      <Text style={block.rowNumber ? styles.listItem : styles.fieldValue}>{block.rowNumber ? `${block.rowNumber}. ${block.value}` : block.value}</Text>
    </View>
  ))}</React.Fragment>;
};
const unwrap = data => (Array.isArray(data) ? data : [data]).flatMap(record =>
  record?.respiratory_medications
    ? (Array.isArray(record.respiratory_medications) ? record.respiratory_medications : [record.respiratory_medications])
    : record?.documentData
      ? (Array.isArray(record.documentData) ? record.documentData : record.documentData?.respiratory_medications ? (Array.isArray(record.documentData.respiratory_medications) ? record.documentData.respiratory_medications : [record.documentData.respiratory_medications]) : [record.documentData])
      : [record]
).filter(record => record && typeof record === 'object');

export default function RespiratoryMedicationsDocumentPDFTemplate({ document: data }) {
  const records = React.useMemo(() => unwrap(data), [data]);
  return <Document><Page size="LETTER" style={styles.page}>
    <View style={styles.documentHeader} wrap={false}><Text style={styles.documentTitle}>Respiratory Medications</Text></View>
    {!records.length && <Text style={styles.noDataText}>No respiratory medications data available</Text>}
    {records.map((record, index) => <View key={index} style={styles.recordContainer} break={index > 0}>
      <View wrap={false}><Text style={styles.recordTitle}>{`Respiratory Medications ${index + 1}`}</Text></View>
      {SECTION_CONFIGS.map((section, sectionIndex) => renderSection(section.title, sectionBlocks(record, section), `section-${sectionIndex}`))}
    </View>)}
  </Page></Document>;
}
