/**
 * StressTestReportsDocumentPDFTemplate.jsx
 * July 2026 — canonical 26/19/16/13/14 typography
 * Collection: stress_test_reports
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 30, paddingBottom: 36, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.35, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 14 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 10, paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 2 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 2, marginBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 1 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 1, marginBottom: 1, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.35, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.35, color: '#000000', marginBottom: 1, paddingLeft: 8 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#000000', marginTop: 40 },
});

const FIELD_LABELS = {
  testType: 'Test Type',
  protocol: 'Protocol',
  duration: 'Duration',
  maxHeartRate: 'Max Heart Rate',
  targetHeartRate: 'Target Heart Rate',
  bloodPressureResponse: 'Blood Pressure Response',
  symptoms: 'Symptoms',
  ecgChanges: 'ECG Changes',
  result: 'Result',
  interpretation: 'Interpretation',
  cardiologist: 'Cardiologist',
  date: 'Date',
};

const SECTION_CONFIGS = [
  { title: 'Test Information', fields: [{ key: 'testType' }, { key: 'protocol' }, { key: 'duration' }] },
  { title: 'Heart Rate', fields: [{ key: 'maxHeartRate', isNumber: true }, { key: 'targetHeartRate', isNumber: true }] },
  { title: 'Blood Pressure Response', fields: [{ key: 'bloodPressureResponse', hideLabel: true }] },
  { title: 'Symptoms', fields: [{ key: 'symptoms', isArray: true, hideLabel: true }] },
  { title: 'ECG & Result', fields: [{ key: 'ecgChanges' }, { key: 'result' }] },
  { title: 'Interpretation & Provider', fields: [{ key: 'interpretation', isInterpretation: true }, { key: 'cardiologist' }, { key: 'date', isDate: true }] },
];

const hasVal = value => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'boolean' || typeof value === 'number') return true;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(item => item && String(item).trim());
  return typeof value === 'object' ? Object.keys(value).length > 0 : true;
};

const formatDate = value => {
  try {
    const date = new Date(value?.$date || value);
    return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(value || ''); }
};

const splitBySentence = text => String(text || '').split(/(?:;\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+)/).map(item => item.trim()).filter(Boolean);

const splitByComma = text => {
  const source = String(text || ''); const result = []; let current = ''; let depth = 0;
  for (const char of source) {
    if (char === '(') { depth += 1; current += char; }
    else if (char === ')') { depth = Math.max(0, depth - 1); current += char; }
    else if (char === ',' && depth === 0) { if (current.trim()) result.push(current.trim()); current = ''; }
    else current += char;
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [source];
};

const parseLabel = text => {
  const match = String(text || '').match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  return match ? { label: match[1].trim(), value: match[2].trim() } : { label: '', value: String(text || '') };
};

const numberShows = (record, key) => {
  const value = record[key];
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return false;
  if (Number(value) === 0 && ['maxHeartRate', 'targetHeartRate'].includes(key)) {
    return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(key);
  }
  return true;
};

const fieldPresent = (record, field) => field.isNumber ? numberShows(record, field.key) : hasVal(record[field.key]);

const renderField = (record, field, sectionTitle) => {
  const value = record[field.key];
  if (field.isInterpretation) {
    const groups = splitBySentence(value).map(sentence => {
      const parsed = parseLabel(sentence);
      return { label: parsed.label, rows: splitByComma(parsed.value) };
    });
    return (
      <View style={styles.fieldBox} wrap={false}>
        {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
        <Text style={styles.fieldLabel}>{FIELD_LABELS[field.key]}</Text>
        {groups.map((group, groupIndex) => (
          <View key={groupIndex}>
            {group.label && <Text style={styles.fieldLabel}>{`${group.label}:`}</Text>}
            {group.rows.map((row, rowIndex) => <Text key={rowIndex} style={styles.listItem}>{`${rowIndex + 1}. ${row}`}</Text>)}
          </View>
        ))}
      </View>
    );
  }

  const rows = field.isDate
    ? [formatDate(value)]
    : field.isArray
      ? value.filter(item => item && String(item).trim()).map(String)
      : splitBySentence(String(value));
  return (
    <View style={styles.fieldBox} wrap={false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      {!field.hideLabel && <Text style={styles.fieldLabel}>{FIELD_LABELS[field.key] || field.key}</Text>}
      {rows.map((row, index) => <Text key={index} style={rows.length > 1 ? styles.listItem : styles.fieldValue}>{`${index + 1}. ${row}`}</Text>)}
    </View>
  );
};

const StressTestReportsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let array = Array.isArray(data) ? data : [data];
    array = array.flatMap(record => {
      if (record?.stress_test_reports) return Array.isArray(record.stress_test_reports) ? record.stress_test_reports : [record.stress_test_reports];
      if (record?.documentData) {
        const nested = record.documentData;
        if (Array.isArray(nested)) return nested;
        if (nested?.stress_test_reports) return Array.isArray(nested.stress_test_reports) ? nested.stress_test_reports : [nested.stress_test_reports];
        return [nested];
      }
      return [record];
    });
    return array.filter(record => record && typeof record === 'object');
  }, [data]);

  if (records.length === 0) return <Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.documentTitle}>Stress Test Reports</Text></View><Text style={styles.noDataText}>No data available</Text></Page></Document>;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Stress Test Reports</Text></View>
        {records.map((record, recordIndex) => (
          <View key={recordIndex} style={styles.recordContainer}>
            {recordIndex > 0 && <View style={styles.separator} />}
            <View style={styles.recordHeader} wrap={false}><Text style={styles.recordTitle}>{`Stress Test Report ${recordIndex + 1}`}</Text></View>
            {SECTION_CONFIGS.map((section, sectionIndex) => {
              const present = section.fields.filter(field => fieldPresent(record, field));
              if (present.length === 0) return null;
              return <View key={sectionIndex} style={styles.section}>{present.map((field, fieldIndex) => <View key={field.key}>{renderField(record, field, fieldIndex === 0 ? section.title : null)}</View>)}</View>;
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default StressTestReportsDocumentPDFTemplate;
