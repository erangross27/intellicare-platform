/** Canonical LETTER export for radiology_reports. */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.45, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 22 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 22 },
  recordHeader: { marginBottom: 14 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 9 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 2, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.45, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.45, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 5, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#4b5563', marginTop: 24 },
});

const hasVal = (value) => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'boolean' || typeof value === 'number') return true;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue.$date || dateValue);
    if (Number.isNaN(date.getTime())) return String(dateValue);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateValue); }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;]\s+/)
    .map(sentence => sentence.trim()).filter(sentence => sentence && !/^[;.,!?]+$/.test(sentence));
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = [];
  let current = '';
  let depth = 0;
  for (const character of text) {
    if (character === '(') depth += 1;
    if (character === ')') depth = Math.max(0, depth - 1);
    if (character === ',' && depth === 0) {
      if (current.trim()) result.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [text];
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const match = text.match(/^([A-Za-z0-9][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  return match
    ? { isLabeled: true, label: match[1].trim(), value: match[2].trim() }
    : { isLabeled: false, label: '', value: text };
};

const renderValue = (label, value, { date = false, commaList = false } = {}) => {
  if (!hasVal(value)) return null;
  const text = date ? formatDate(value) : String(value);
  const sentences = splitBySentence(text);
  const rows = [];
  let number = 1;
  if (commaList) {
    splitByComma(text).forEach(item => rows.push({ type: 'item', value: item, number: number++ }));
  } else {
    sentences.forEach(sentence => {
      const parsed = parseLabel(sentence);
      if (parsed.isLabeled) {
        rows.push({ type: 'subtitle', value: parsed.label });
        splitByComma(parsed.value).forEach(item => rows.push({ type: 'item', value: item, number: number++ }));
      } else {
        rows.push({ type: 'item', value: sentence, number: number++ });
      }
    });
  }
  return (
    <View style={styles.fieldBox} wrap={rows.length > 8}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      {rows.map((row, index) => row.type === 'subtitle'
        ? <Text key={index} style={styles.nestedSubtitle}>{row.value}</Text>
        : <Text key={index} style={styles.listItem}>{row.number}. {row.value}</Text>)}
    </View>
  );
};

const renderSection = (title, fields, recordTitle = '') => {
  const populated = fields.filter(Boolean);
  if (!populated.length) return null;
  return (
    <View style={styles.section}>
      <View wrap={false}>
        {recordTitle ? (
          <View style={styles.recordHeader}>
            <Text style={styles.recordTitle}>{recordTitle}</Text>
          </View>
        ) : null}
        <Text style={styles.sectionTitle}>{title}</Text>
        {React.cloneElement(populated[0], { key: 'first' })}
      </View>
      {populated.slice(1).map((field, index) => React.cloneElement(field, { key: `field-${index + 1}` }))}
    </View>
  );
};

const SECTION_CONFIGS = [
  { title: 'Study Information', fields: [
    { key: 'studyType', label: 'Study Type' },
    { key: 'date', label: 'Date', date: true },
    { key: 'anatomicalRegion', label: 'Anatomical Region' },
  ] },
  { title: 'Clinical Details', fields: [{ key: 'indication', label: 'Indication' }] },
  { title: 'Imaging Details', fields: [
    { key: 'technique', label: 'Technique' },
    { key: 'contrast', label: 'Contrast' },
  ] },
  { title: 'Findings', fields: [{ key: 'findings', label: '', commaList: true }] },
  { title: 'Impression', fields: [{ key: 'impression', label: '' }] },
  { title: 'Comparison', fields: [{ key: 'comparison', label: '' }] },
  { title: 'Recommendations', fields: [{ key: 'recommendations', label: '' }] },
  { title: 'General Information', fields: [
    { key: 'radiologist', label: 'Radiologist' },
    { key: 'facility', label: 'Facility' },
  ] },
  { title: 'Notes', fields: [{ key: 'notes', label: '' }] },
];

const RadiologyReportsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    const input = Array.isArray(data) ? data : [data];
    return input.flatMap(record => {
      if (record?.radiology_reports) return Array.isArray(record.radiology_reports) ? record.radiology_reports : [record.radiology_reports];
      if (record?.documentData) {
        const nested = record.documentData;
        if (Array.isArray(nested)) return nested;
        if (nested?.radiology_reports) return Array.isArray(nested.radiology_reports) ? nested.radiology_reports : [nested.radiology_reports];
        return [nested];
      }
      return [record];
    }).filter(record => record && typeof record === 'object');
  }, [data]);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader} wrap={false}>
          <Text style={styles.documentTitle}>Radiology Reports</Text>
        </View>
        {!records.length ? <Text style={styles.noDataText}>No data available</Text> : null}
        {records.map((record, recordIndex) => {
          const populatedSections = SECTION_CONFIGS.map(config => {
              const fields = config.fields.map(field => renderValue(field.label, record[field.key], field));
              return { title: config.title, fields };
            }).filter(config => config.fields.some(Boolean));
          const recordTitle = `Radiology Report ${recordIndex + 1}`;
          return (
            <View key={recordIndex} style={styles.recordContainer}>
              {recordIndex > 0 ? <View style={styles.separator} /> : null}
              {populatedSections.length ? populatedSections.map((config, sectionIndex) => (
                <React.Fragment key={config.title}>
                  {renderSection(config.title, config.fields, sectionIndex === 0 ? recordTitle : '')}
                </React.Fragment>
              )) : (
                <View style={styles.recordHeader} wrap={false}>
                  <Text style={styles.recordTitle}>{recordTitle}</Text>
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default RadiologyReportsDocumentPDFTemplate;
