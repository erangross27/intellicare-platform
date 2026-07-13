/**
 * PumpDownloadAnalysisDocumentPDFTemplate.jsx
 * Canonical box-free LETTER PDF for pump_download_analysis.
 */
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

const SECTION_CONFIGS = [
  { title: 'Record Information', fields: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'provider', label: 'Provider' },
    { key: 'facility', label: 'Facility' },
    { key: 'status', label: 'Status' },
    { key: 'type', label: 'Type' },
  ] },
  { title: 'Pump Metrics', fields: [
    { key: 'bolusesPerDay', label: 'Boluses Per Day', commaSplit: true },
    { key: 'correctionBolusesPerDay', label: 'Correction Boluses Per Day' },
    { key: 'controlIQActivePercent', label: 'Control-IQ Active' },
    { key: 'autoModeExits', label: 'Auto-Mode Exits' },
    { key: 'missedBoluses', label: 'Missed Boluses' },
    { key: 'overrideBehavior', label: 'Override Behavior' },
  ] },
  { title: 'Findings', fields: [{ key: 'findings', label: 'Findings' }] },
  { title: 'Assessment', fields: [{ key: 'assessment', label: 'Assessment' }] },
  { title: 'Plan', fields: [{ key: 'plan', label: 'Plan' }] },
  { title: 'Recommendations', fields: [{ key: 'recommendations', label: 'Recommendations', type: 'array' }] },
  { title: 'Notes', fields: [{ key: 'notes', label: 'Notes', commaSplit: true }] },
];

const hasVal = (value) => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

const safeString = (value) => String(value ?? '')
  .replace(/×/g, 'x')
  .replace(/[μµ]/g, 'u')
  .replace(/[“”]/g, '"')
  .replace(/[‘’]/g, "'")
  .replace(/[–—]/g, '-')
  .replace(/…/g, '...');

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value.$date || value);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() <= 1970) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/)
    .map(item => item.trim())
    .filter(item => item && !/^[;.,!?]+$/.test(item));
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(') { depth += 1; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '')) { if (current.trim()) result.push(current.trim()); current = ''; }
    else current += ch;
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [text];
};

const parseLabel = (text) => {
  const match = String(text || '').match(/^([A-Za-z0-9][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  return match
    ? { isLabeled: true, label: match[1].trim(), value: match[2].trim() }
    : { isLabeled: false, label: '', value: String(text || '') };
};

const sameAsTitle = (label, title) => String(label || '').trim().toLowerCase() === String(title || '').trim().toLowerCase();

const fieldRows = (record, field, sectionTitle) => {
  const value = record[field.key];
  if (!hasVal(value)) return [];
  const showFieldLabel = !sameAsTitle(field.label, sectionTitle);

  if (field.type === 'date') {
    const display = formatDate(value);
    return display ? [{ fieldLabel: showFieldLabel ? field.label : '', text: display }] : [];
  }

  if (field.type === 'array') {
    return (Array.isArray(value) ? value : [value]).map((item, index) => {
      const text = typeof item === 'string' ? item : item?.recommendation || item?.text || safeString(item);
      return { fieldLabel: index === 0 && showFieldLabel ? field.label : '', text };
    }).filter(row => row.text);
  }

  const sentences = splitBySentence(safeString(value));
  const rows = [];
  sentences.forEach((sentence) => {
    const parsed = parseLabel(sentence);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      parts.forEach((part, index) => rows.push({
        fieldLabel: rows.length === 0 && showFieldLabel ? field.label : '',
        subLabel: index === 0 ? parsed.label : '',
        text: part,
      }));
    } else {
      const parts = field.commaSplit ? splitByComma(sentence) : [sentence];
      parts.forEach(part => rows.push({
        fieldLabel: rows.length === 0 && showFieldLabel ? field.label : '',
        text: part,
      }));
    }
  });
  return rows;
};

const RowContent = ({ row, number }) => (
  <>
    {row.fieldLabel && <Text style={styles.fieldLabel}>{safeString(row.fieldLabel)}</Text>}
    {row.subLabel && <Text style={styles.nestedSubtitle}>{safeString(row.subLabel)}</Text>}
    <Text style={styles.listItem}>{number}. {safeString(row.text)}</Text>
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
        <View style={styles.fieldBox} wrap={false}><RowContent row={first} number={1} /></View>
      </View>
      {rest.map((row, index) => (
        <View key={`section-${sectionIndex}-row-${index}`} style={styles.fieldBox} wrap={false}>
          <RowContent row={row} number={index + 2} />
        </View>
      ))}
    </React.Fragment>
  );
};

const unwrapRecords = (data) => {
  if (!data) return [];
  const source = Array.isArray(data) ? data : [data];
  return source.flatMap((record) => {
    if (record?.pump_download_analysis) return Array.isArray(record.pump_download_analysis) ? record.pump_download_analysis : [record.pump_download_analysis];
    if (record?.documentData) {
      const nested = record.documentData;
      if (Array.isArray(nested)) return nested;
      if (nested?.pump_download_analysis) return Array.isArray(nested.pump_download_analysis) ? nested.pump_download_analysis : [nested.pump_download_analysis];
      return [nested];
    }
    return [record];
  }).filter(record => record && typeof record === 'object');
};

const PumpDownloadAnalysisDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => unwrapRecords(data), [data]);
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader} wrap={false}>
          <Text style={styles.documentTitle}>Pump Download Analysis</Text>
        </View>
        {!records.length && <Text style={styles.noDataText}>No data available</Text>}
        {records.map((record, recordIndex) => (
          <View key={`record-${recordIndex}`} style={styles.recordContainer} break={recordIndex > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>Pump Download Analysis {recordIndex + 1}</Text>
            </View>
            {SECTION_CONFIGS.map((section, sectionIndex) => renderSection(record, section, sectionIndex))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PumpDownloadAnalysisDocumentPDFTemplate;
