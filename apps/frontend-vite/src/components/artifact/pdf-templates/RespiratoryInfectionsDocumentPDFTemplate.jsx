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
  {
    title: 'Overview',
    fields: [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'type', label: 'Type', type: 'narrative' },
      { key: 'provider', label: 'Provider', type: 'narrative' },
      { key: 'facility', label: 'Facility', type: 'narrative' },
      { key: 'status', label: 'Status', type: 'narrative' },
    ],
  },
  { title: 'Current Infection', fields: [{ key: 'currentInfection', label: 'Current Infection', type: 'object' }] },
  {
    title: 'Infection History',
    fields: [
      { key: 'recurrentInfections', label: 'Recurrent Infections', type: 'object' },
      { key: 'pneumoniaHistory', label: 'Pneumonia History', type: 'stringArray' },
    ],
  },
  {
    title: 'Immunizations & TB Risk',
    fields: [
      { key: 'immunizations', label: 'Immunizations', type: 'object' },
      { key: 'tuberculosisRisk', label: 'Tuberculosis Risk', type: 'narrative' },
    ],
  },
  {
    title: 'Findings & Plan',
    fields: [
      { key: 'findings', label: 'Findings', type: 'narrative' },
      { key: 'assessment', label: 'Assessment', type: 'narrative' },
      { key: 'plan', label: 'Plan', type: 'narrative' },
      { key: 'notes', label: 'Notes', type: 'narrative' },
    ],
  },
  { title: 'Results', fields: [{ key: 'results', label: 'Results', type: 'object' }] },
  { title: 'Recommendations', fields: [{ key: 'recommendations', label: 'Recommendations', type: 'recommendations' }] },
];

const COMMA_FIELDS = ['status'];
const isEmptyDeep = value => value == null || value === '' || (Array.isArray(value) ? !value.some(item => !isEmptyDeep(item)) : typeof value === 'object' ? Object.values(value).every(isEmptyDeep) : false);
const fmt = value => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '');
const getValue = (record, path) => String(path).split('.').reduce((value, key) => value?.[key], record);
const keyToLabel = key => String(key || '').replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/\b\w/g, char => char.toUpperCase()).trim();
const isDateValue = value => Boolean(value?.$date || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)));
const formatDate = value => {
  try {
    const date = new Date(value?.$date || value);
    return Number.isNaN(date.getTime()) ? fmt(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return fmt(value); }
};
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
const splitSentences = text => String(text || '')
  .split(/(?:;\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+)/)
  .map(value => value.replace(/^[;.,\s]+|[;.,\s]+$/g, '').trim())
  .filter(Boolean);
const splitTextRows = (path, value) => splitSentences(value).flatMap(sentence => COMMA_FIELDS.includes(path) ? splitByComma(sentence) : [sentence]);

const scalarBlocks = (label, value, key, formatter = fmt) => isEmptyDeep(value) ? [] : [{ key, fieldLabel: label, value: formatter(value) }];
const narrativeBlocks = (label, value, key) => splitTextRows(key, fmt(value)).map((row, index) => ({
  key: `${key}-${index}`,
  fieldLabel: index === 0 ? label : '',
  value: row,
  rowNumber: index + 1,
}));
const scalarLeafBlocks = (fieldLabel, subLabel, value, path) => {
  if (isEmptyDeep(value)) return [];
  if (isDateValue(value)) return [{ key: path, fieldLabel, subLabel, value: formatDate(value) }];
  const rows = typeof value === 'string' ? splitTextRows(path, value) : [fmt(value)];
  return rows.map((row, index) => ({
    key: `${path}-${index}`,
    fieldLabel: index === 0 ? fieldLabel : '',
    subLabel: index === 0 ? subLabel : '',
    value: row,
    rowNumber: rows.length > 1 ? index + 1 : undefined,
  }));
};
const objectBlocks = (label, value, key, prefix = '', path = key, showFieldLabel = true) => {
  if (isEmptyDeep(value)) return [];
  if (isDateValue(value) || typeof value !== 'object') return scalarLeafBlocks(showFieldLabel ? label : '', prefix, value, path);
  const blocks = [];
  if (Array.isArray(value)) {
    value.forEach((item, itemIndex) => {
      if (isEmptyDeep(item)) return;
      const itemPath = `${path}.${itemIndex}`;
      if (isDateValue(item) || typeof item !== 'object') {
        const itemBlocks = scalarLeafBlocks(blocks.length === 0 && showFieldLabel ? label : '', blocks.length === 0 ? prefix : '', item, itemPath)
          .map(block => ({ ...block, rowNumber: itemIndex + 1 }));
        blocks.push(...itemBlocks);
      } else {
        const itemLabel = prefix ? `${prefix} - Item ${itemIndex + 1}` : `Item ${itemIndex + 1}`;
        Object.entries(item).filter(([, child]) => !isEmptyDeep(child)).forEach(([childKey, child]) => {
          const childLabel = `${itemLabel} - ${keyToLabel(childKey)}`;
          blocks.push(...objectBlocks(label, child, key, childLabel, `${itemPath}.${childKey}`, blocks.length === 0 && showFieldLabel));
        });
      }
    });
    return blocks;
  }
  Object.entries(value).filter(([childKey, child]) => childKey !== '_id' && !isEmptyDeep(child)).forEach(([childKey, child]) => {
    const childLabel = prefix ? `${prefix} - ${keyToLabel(childKey)}` : keyToLabel(childKey);
    blocks.push(...objectBlocks(label, child, key, childLabel, `${path}.${childKey}`, blocks.length === 0 && showFieldLabel));
  });
  return blocks;
};
const stringArrayBlocks = (label, value, key) => {
  const blocks = [];
  (Array.isArray(value) ? value : []).forEach((item, itemIndex) => {
    if (isEmptyDeep(item)) return;
    const rows = splitTextRows(`${key}.${itemIndex}`, fmt(item));
    rows.forEach((row, rowIndex) => blocks.push({
      key: `${key}-${itemIndex}-${rowIndex}`,
      fieldLabel: blocks.length === 0 ? label : '',
      value: row,
      rowNumber: blocks.length + 1,
    }));
  });
  return blocks;
};
const recommendationBlocks = (label, value, key) => {
  const entries = (Array.isArray(value) ? value : []).map((item, index) => ({ item, index })).filter(({ item }) => item && typeof item === 'object' && !isEmptyDeep(item));
  const groups = [];
  entries.forEach(entry => {
    const dateKey = entry.item.date ? formatDate(entry.item.date) : '';
    const previous = groups[groups.length - 1];
    if (previous && previous.dateKey === dateKey) previous.entries.push(entry);
    else groups.push({ dateKey, entries: [entry] });
  });
  const blocks = [];
  groups.forEach((group, groupIndex) => {
    let groupRow = 1;
    group.entries.forEach(({ item, index }) => {
      splitTextRows(`${key}.${index}.recommendation`, fmt(item.recommendation)).forEach((row, rowIndex) => blocks.push({
        key: `${key}-${index}-${rowIndex}`,
        fieldLabel: blocks.length === 0 ? label : '',
        subLabel: groupRow === 1 && rowIndex === 0 ? group.dateKey : '',
        value: row,
        rowNumber: groupRow++,
      }));
    });
    if (!group.entries.length && groupIndex === 0) return;
  });
  return blocks;
};
const sectionBlocks = (record, config) => config.fields.flatMap(field => {
  const value = getValue(record, field.key);
  if (field.type === 'date') return scalarBlocks(field.label, value, field.key, formatDate);
  if (field.type === 'narrative') return narrativeBlocks(field.label, value, field.key);
  if (field.type === 'object') return objectBlocks(field.label, value, field.key);
  if (field.type === 'stringArray') return stringArrayBlocks(field.label, value, field.key);
  if (field.type === 'recommendations') return recommendationBlocks(field.label, value, field.key);
  return scalarBlocks(field.label, value, field.key);
});

const renderSection = (title, blocks, key) => {
  if (!blocks.length) return null;
  return (
    <React.Fragment key={key}>
      {blocks.map((block, index) => (
        <View key={block.key} style={styles.block} wrap={false}>
          {index === 0 && <Text style={styles.sectionTitle}>{title}</Text>}
          {block.fieldLabel && block.fieldLabel !== title && <Text style={styles.fieldLabel}>{block.fieldLabel}</Text>}
          {block.subLabel && <Text style={styles.subLabel}>{block.subLabel}</Text>}
          <Text style={block.rowNumber ? styles.listItem : styles.fieldValue}>{block.rowNumber ? `${block.rowNumber}. ${block.value}` : block.value}</Text>
        </View>
      ))}
    </React.Fragment>
  );
};

const unwrap = data => (Array.isArray(data) ? data : [data]).flatMap(record =>
  record?.respiratory_infections
    ? (Array.isArray(record.respiratory_infections) ? record.respiratory_infections : [record.respiratory_infections])
    : record?.documentData
      ? (Array.isArray(record.documentData) ? record.documentData : record.documentData?.respiratory_infections ? (Array.isArray(record.documentData.respiratory_infections) ? record.documentData.respiratory_infections : [record.documentData.respiratory_infections]) : [record.documentData])
      : [record]
).filter(record => record && typeof record === 'object');

export default function RespiratoryInfectionsDocumentPDFTemplate({ document: data }) {
  const records = React.useMemo(() => unwrap(data), [data]);
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader} wrap={false}><Text style={styles.documentTitle}>Respiratory Infections</Text></View>
        {!records.length && <Text style={styles.noDataText}>No respiratory infections data available</Text>}
        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer} break={index > 0}>
            <View wrap={false}><Text style={styles.recordTitle}>{`Respiratory Infections ${index + 1}`}</Text></View>
            {SECTION_CONFIGS.map((config, sectionIndex) => renderSection(config.title, sectionBlocks(record, config), `section-${sectionIndex}`))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
