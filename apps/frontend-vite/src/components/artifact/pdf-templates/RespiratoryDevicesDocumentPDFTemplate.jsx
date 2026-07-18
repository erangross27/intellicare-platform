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
    title: 'Device Information',
    fields: [
      { key: 'type', label: 'Type', type: 'narrative' },
      { key: 'provider', label: 'Provider', type: 'narrative' },
      { key: 'facility', label: 'Facility', type: 'narrative' },
      { key: 'date', label: 'Date', type: 'date' },
    ],
  },
  {
    title: 'Devices',
    fields: [
      { key: 'homeNebulizer', label: 'Home Nebulizer', type: 'scalar' },
      { key: 'peakFlowMeter', label: 'Peak Flow Meter', type: 'scalar' },
      { key: 'spacerDevice', label: 'Spacer Device', type: 'narrative' },
      { key: 'oxygenConcentrator', label: 'Oxygen Concentrator', type: 'scalar' },
      { key: 'hepaFilter', label: 'HEPA Filter', type: 'scalar' },
      { key: 'airPurifier', label: 'Air Purifier', type: 'scalar' },
    ],
  },
  {
    title: 'CPAP / BiPAP',
    fields: [
      { key: 'cpapBipap.type', label: 'CPAP/BiPAP Type', type: 'narrative' },
      { key: 'cpapBipap.settings', label: 'CPAP/BiPAP Settings', type: 'narrative' },
      { key: 'cpapBipap.compliance', label: 'CPAP/BiPAP Compliance', type: 'narrative' },
      { key: 'cpapBipap.dataDownload', label: 'CPAP/BiPAP Data Download', type: 'object' },
    ],
  },
  {
    title: 'Clinical',
    fields: [
      { key: 'findings', label: 'Findings', type: 'narrative' },
      { key: 'assessment', label: 'Assessment', type: 'narrative' },
      { key: 'plan', label: 'Plan', type: 'narrative' },
    ],
  },
  {
    title: 'Recommendations & Notes',
    fields: [
      { key: 'recommendations', label: 'Recommendations', type: 'recommendations' },
      { key: 'results', label: 'Results', type: 'object' },
      { key: 'notes', label: 'Notes', type: 'narrative' },
      { key: 'status', label: 'Status', type: 'narrative' },
    ],
  },
];

const LABELED_NARRATIVE_FIELDS = ['findings', 'assessment', 'plan', 'notes'];
const COMMA_FIELDS = ['cpapBipap.settings', 'assessment'];
const isEmptyDeep = value => value == null || value === '' || (Array.isArray(value) ? !value.some(item => !isEmptyDeep(item)) : typeof value === 'object' ? Object.values(value).every(isEmptyDeep) : false);
const fmt = value => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '');
const getValue = (record, path) => String(path).split('.').reduce((value, key) => value?.[key], record);
const keyToLabel = key => String(key || '').replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/\b\w/g, char => char.toUpperCase()).trim();
const formatDate = value => {
  try {
    const date = new Date(value?.$date || value);
    return Number.isNaN(date.getTime()) ? fmt(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return fmt(value); }
};
const parseLabel = text => {
  const match = String(text || '').match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  return match ? { label: match[1].trim(), value: match[2].trim(), labeled: true } : { value: String(text || ''), labeled: false };
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
const splitSentences = text => String(text || '')
  .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;]\s+/)
  .map(value => value.replace(/^[;.,\s]+|[;.,\s]+$/g, '').trim())
  .filter(Boolean);

const scalarBlocks = (label, value, key, formatter = fmt) => isEmptyDeep(value) ? [] : [{ key, fieldLabel: label, value: formatter(value) }];
const narrativeBlocks = (label, value, key) => {
  const blocks = []; let rowNumber = 1;
  splitSentences(fmt(value)).forEach((sentence, sentenceIndex) => {
    const parsed = LABELED_NARRATIVE_FIELDS.includes(key) ? parseLabel(sentence) : { value: sentence, labeled: false };
    const parts = COMMA_FIELDS.includes(key) ? splitByComma(parsed.value) : [parsed.value];
    parts.forEach((part, partIndex) => blocks.push({
      key: `${key}-${sentenceIndex}-${partIndex}`,
      fieldLabel: blocks.length === 0 ? label : '',
      subLabel: parsed.labeled && partIndex === 0 ? parsed.label : '',
      value: part,
      rowNumber: rowNumber++,
    }));
  });
  return blocks;
};
const objectBlocks = (label, value, key, prefix = '', pathPrefix = '') => {
  if (!value || typeof value !== 'object') return [];
  const blocks = [];
  Object.entries(value).forEach(([childKey, childValue]) => {
    if (childKey === '_id' || isEmptyDeep(childValue)) return;
    const childLabel = prefix ? `${prefix} — ${keyToLabel(childKey)}` : keyToLabel(childKey);
    const childPath = pathPrefix ? `${pathPrefix}.${childKey}` : childKey;
    if (Array.isArray(childValue)) {
      childValue.forEach((item, itemIndex) => {
        if (isEmptyDeep(item)) return;
        if (item && typeof item === 'object') blocks.push(...objectBlocks(label, item, key, `${childLabel} ${itemIndex + 1}`, `${childPath}.${itemIndex}`));
        else blocks.push({ key: `${key}.${childPath}.${itemIndex}`, fieldLabel: blocks.length ? '' : label, subLabel: `${childLabel} ${itemIndex + 1}`, value: fmt(item) });
      });
    } else if (childValue && typeof childValue === 'object' && !childValue.$date) {
      blocks.push(...objectBlocks(label, childValue, key, childLabel, childPath));
    } else {
      blocks.push({ key: `${key}.${childPath}`, fieldLabel: blocks.length ? '' : label, subLabel: childLabel, value: childValue?.$date ? formatDate(childValue.$date) : fmt(childValue) });
    }
  });
  return blocks;
};
const recommendationBlocks = (label, value, key) => {
  const entries = (Array.isArray(value) ? value : []).map((item, index) => ({
    item: item && typeof item === 'object' ? item : { recommendation: fmt(item), date: '' }, index,
  })).filter(({ item }) => !isEmptyDeep(item));
  const groups = [];
  entries.forEach(entry => {
    const dateKey = entry.item.date ? formatDate(entry.item.date) : '';
    const previous = groups[groups.length - 1];
    if (previous && previous.dateKey === dateKey) previous.entries.push(entry);
    else groups.push({ dateKey, entries: [entry] });
  });
  return groups.map((group, groupIndex) => ({
    key: `${key}-${groupIndex}`,
    fieldLabel: groupIndex === 0 ? label : '',
    subLabel: group.dateKey,
    values: group.entries.map(({ item }) => fmt(item.recommendation)).filter(Boolean),
  })).filter(block => block.values.length || block.subLabel);
};
const sectionBlocks = (record, config) => config.fields.flatMap(field => {
  const value = getValue(record, field.key);
  if (field.type === 'date') return scalarBlocks(field.label, value, field.key, formatDate);
  if (field.type === 'narrative') return narrativeBlocks(field.label, value, field.key);
  if (field.type === 'object') return objectBlocks(field.label, value, field.key);
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
          {block.fieldLabel && <Text style={styles.fieldLabel}>{block.fieldLabel}</Text>}
          {block.subLabel && <Text style={styles.subLabel}>{block.subLabel}</Text>}
          {block.values
            ? block.values.map((value, valueIndex) => <Text key={`${block.key}-${valueIndex}`} style={styles.listItem}>{`${valueIndex + 1}. ${value}`}</Text>)
            : <Text style={block.rowNumber ? styles.listItem : styles.fieldValue}>{block.rowNumber ? `${block.rowNumber}. ${block.value}` : block.value}</Text>}
        </View>
      ))}
    </React.Fragment>
  );
};

const unwrap = data => (Array.isArray(data) ? data : [data]).flatMap(record =>
  record?.respiratory_devices
    ? (Array.isArray(record.respiratory_devices) ? record.respiratory_devices : [record.respiratory_devices])
    : record?.documentData
      ? (Array.isArray(record.documentData) ? record.documentData : record.documentData?.respiratory_devices ? (Array.isArray(record.documentData.respiratory_devices) ? record.documentData.respiratory_devices : [record.documentData.respiratory_devices]) : [record.documentData])
      : [record]
).filter(record => record && typeof record === 'object');

export default function RespiratoryDevicesDocumentPDFTemplate({ document: data }) {
  const records = React.useMemo(() => unwrap(data), [data]);
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader} wrap={false}><Text style={styles.documentTitle}>Respiratory Devices</Text></View>
        {!records.length && <Text style={styles.noDataText}>No respiratory devices data available</Text>}
        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer} break={index > 0}>
            <View wrap={false}><Text style={styles.recordTitle}>{`Respiratory Devices ${index + 1}`}</Text></View>
            {SECTION_CONFIGS.map((config, sectionIndex) => renderSection(config.title, sectionBlocks(record, config), `section-${sectionIndex}`))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
