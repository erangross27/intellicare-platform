/** Canonical box-free LETTER PDF for quality_metrics. */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 20 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { paddingBottom: 12 },
  recordHeader: { marginBottom: 12 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginTop: 12, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 7 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginTop: 7, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 5, marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  noDataText: { fontSize: 14, color: '#333333', marginTop: 40 },
});

const SECTIONS = [
  { title: 'Metric Overview', fields: [
    { key: 'metricName', label: 'Metric Name' },
    { key: 'metricCategory', label: 'Category' },
    { key: 'metricDate', label: 'Metric Date', type: 'date' },
    { key: 'metricMet', label: 'Metric Met', type: 'boolean' },
  ] },
  { title: 'Target vs Actual', fields: [
    { key: 'targetValue', label: 'Target Value' },
    { key: 'actualValue', label: 'Actual Value' },
    { key: 'variance', label: 'Variance' },
    { key: 'unit', label: 'Unit' },
  ] },
  { title: 'Barriers', fields: [{ key: 'barriers', label: 'Barriers', type: 'array' }] },
  { title: 'Improvement Plan', fields: [{ key: 'improvementPlan', label: 'Improvement Plan', type: 'commaList' }] },
  { title: 'Action Items', fields: [{ key: 'actionItems', label: 'Action Items', type: 'array' }] },
  { title: 'Responsible Party', fields: [{ key: 'responsibleParty', label: 'Responsible Party', type: 'peopleList' }] },
];

const hasVal = value => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

const safeString = value => String(value ?? '')
  .replace(/×/g, 'x').replace(/[μµ]/g, 'u')
  .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
  .replace(/[–—]/g, '-').replace(/…/g, '...')
  .replace(/\u2192/g, '->');

const formatDate = value => {
  if (!value) return '';
  const date = new Date(value.$date || value);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() <= 1970) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

const sameAsTitle = (label, title) => String(label || '').trim().toLowerCase() === String(title || '').trim().toLowerCase();

const parseLabel = text => {
  const match = String(text || '').match(/^([A-Za-z0-9%][A-Za-z0-9\s/&().#'"%<>~+=-]{0,119}?):\s+([\s\S]+)$/);
  return match ? { isLabeled: true, label: match[1].trim(), value: match[2].trim() } : { isLabeled: false, label: '', value: String(text || '') };
};

const splitBySentence = text => {
  if (!text || typeof text !== 'string') return [];
  const protectedText = text
    .replace(/\b(Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no)\./gi, '$1<prd>')
    .replace(/\b([A-Z])\.(?=\s|[A-Z]\.)/g, '$1<prd>')
    .replace(/\b(\d+)\.(?=\d)/g, '$1<prd>');
  return protectedText.split(/[.;](?:\s+|$)/)
    .map(item => item.replace(/<prd>/g, '.').trim())
    .filter(item => item && !/^[;.,!?]+$/.test(item));
};

const splitByComma = text => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '(') { depth += 1; current += char; }
    else if (char === ')') { depth = Math.max(0, depth - 1); current += char; }
    else if (char === ',' && depth === 0 && /\s/.test(text[index + 1] || '')) { if (current.trim()) result.push(current.trim()); current = ''; }
    else current += char;
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [text];
};

const splitPeople = text => String(text || '').split(/(?<=\)),\s+/).map(item => item.trim()).filter(Boolean);

const fieldRows = (record, field, sectionTitle) => {
  const value = record[field.key];
  if (!hasVal(value)) return [];
  const fieldLabel = sameAsTitle(field.label, sectionTitle) ? '' : field.label;

  if (field.type === 'date') {
    const display = formatDate(value);
    return display ? [{ fieldLabel, text: display, number: 1 }] : [];
  }
  if (field.type === 'boolean') {
    return [{ fieldLabel, text: value ? 'Yes' : 'No', number: 1 }];
  }
  if (field.type === 'array') {
    let unlabelledNumber = 0;
    return (Array.isArray(value) ? value : [value]).filter(hasVal).map((item, index) => {
      const parsed = parseLabel(item);
      return {
        fieldLabel: index === 0 ? fieldLabel : '',
        subLabel: parsed.isLabeled ? parsed.label : '',
        text: parsed.isLabeled ? parsed.value : safeString(item),
        number: parsed.isLabeled ? 1 : ++unlabelledNumber,
      };
    });
  }
  if (field.type === 'commaList' || field.type === 'peopleList') {
    const parts = field.type === 'commaList' ? splitByComma(safeString(value)) : splitPeople(safeString(value));
    return parts.map((part, index) => ({ fieldLabel: index === 0 ? fieldLabel : '', text: part, number: index + 1 }));
  }

  const sentences = splitBySentence(safeString(value));
  const parts = sentences.length ? sentences : [safeString(value)];
  return parts.map((part, index) => ({ fieldLabel: index === 0 ? fieldLabel : '', text: part, number: index + 1 }));
};

const RowContent = ({ row }) => (
  <>
    {row.fieldLabel && <Text style={styles.fieldLabel}>{safeString(row.fieldLabel)}</Text>}
    {row.subLabel && <Text style={styles.nestedSubtitle}>{safeString(row.subLabel)}</Text>}
    <Text style={styles.listItem}>{row.number}. {safeString(row.text)}</Text>
  </>
);

const renderSection = (record, section, sectionIndex) => {
  const rows = section.fields.flatMap(field => fieldRows(record, field, section.title));
  if (!rows.length) return null;
  const [first, ...rest] = rows;
  return (
    <React.Fragment key={`section-${sectionIndex}`}>
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <View style={styles.fieldBox} wrap={false}><RowContent row={first} /></View>
      </View>
      {rest.map((row, index) => (
        <View key={`section-${sectionIndex}-row-${index}`} style={styles.fieldBox} wrap={false}>
          <RowContent row={row} />
        </View>
      ))}
    </React.Fragment>
  );
};

const unwrapRecords = data => {
  if (!data) return [];
  return (Array.isArray(data) ? data : [data]).flatMap(record => {
    if (record?.quality_metrics) return Array.isArray(record.quality_metrics) ? record.quality_metrics : [record.quality_metrics];
    if (record?.documentData) {
      const nested = record.documentData;
      if (Array.isArray(nested)) return nested;
      if (nested?.quality_metrics) return Array.isArray(nested.quality_metrics) ? nested.quality_metrics : [nested.quality_metrics];
      return [nested];
    }
    if (record?.data?.quality_metrics) return Array.isArray(record.data.quality_metrics) ? record.data.quality_metrics : [record.data.quality_metrics];
    return [record];
  }).filter(record => record && typeof record === 'object');
};

const QualityMetricsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => unwrapRecords(data), [data]);
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader} wrap={false}>
          <Text style={styles.documentTitle}>Quality Metrics</Text>
        </View>
        {!records.length && <Text style={styles.noDataText}>No quality metrics records available</Text>}
        {records.map((record, recordIndex) => (
          <View key={`record-${recordIndex}`} style={styles.recordContainer} break={recordIndex > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>Quality Metric {recordIndex + 1}</Text>
            </View>
            {SECTIONS.map((section, sectionIndex) => renderSection(record, section, sectionIndex))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default QualityMetricsDocumentPDFTemplate;
