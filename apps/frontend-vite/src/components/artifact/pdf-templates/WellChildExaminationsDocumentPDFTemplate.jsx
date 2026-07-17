import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { paddingTop: 38, paddingBottom: 42, paddingHorizontal: 42, fontFamily: 'Helvetica', color: '#111827', fontSize: 14 },
  documentHeader: { marginBottom: 18 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  recordHeader: { marginBottom: 16 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold' },
  sectionBlock: { marginTop: 11 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', paddingBottom: 4, marginBottom: 7, borderBottomWidth: 1, borderBottomColor: '#000000' },
  sectionSpacer: { height: 4 },
  fieldBox: { marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', paddingBottom: 3, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 2, marginBottom: 2, color: '#1d4ed8' },
  rowBlock: { marginBottom: 2 },
  fieldValue: { fontSize: 14, lineHeight: 1.35, marginBottom: 2 },
  noDataText: { fontSize: 14, marginTop: 16, color: '#6b7280' },
});

const SECTION_CONFIGS = [
  {
    title: 'Visit Information',
    fields: [
      { key: 'visitDate', label: 'Visit Date', date: true },
      { key: 'age', label: 'Age' },
      { key: 'nextWellVisit', label: 'Next Well Visit' },
    ],
  },
  {
    title: 'Growth Parameters',
    fields: [
      { key: 'weight.value', label: 'Weight' },
      { key: 'weight.percentile', label: 'Weight Percentile' },
      { key: 'height.value', label: 'Height' },
      { key: 'height.percentile', label: 'Height Percentile' },
      { key: 'headCircumference.value', label: 'Head Circumference' },
      { key: 'headCircumference.percentile', label: 'Head Circumference Percentile' },
      { key: 'bmi.value', label: 'BMI' },
      { key: 'bmi.percentile', label: 'BMI Percentile' },
      { key: 'bmi.category', label: 'BMI Category' },
    ],
  },
  {
    title: 'Developmental Screening',
    fields: [
      { key: 'developmentalScreening.result', label: 'Result' },
      { key: 'developmentalScreening.notes', label: 'Notes' },
      { key: 'developmentalScreening.grossMotor', label: 'Gross Motor', comma: true },
      { key: 'developmentalScreening.fineMotor', label: 'Fine Motor' },
      { key: 'developmentalScreening.language', label: 'Language' },
      { key: 'developmentalScreening.socialEmotional', label: 'Social & Emotional' },
    ],
  },
  {
    title: 'Screenings',
    fields: [
      { key: 'visionScreening.result', label: 'Vision Result' },
      { key: 'visionScreening.method', label: 'Vision Method' },
      { key: 'visionScreening.acuity', label: 'Vision Acuity' },
      { key: 'hearingScreening.result', label: 'Hearing Result' },
      { key: 'hearingScreening.method', label: 'Hearing Method' },
      { key: 'leadScreening.result', label: 'Lead Screening Result' },
    ],
  },
  {
    title: 'Immunizations Given',
    fields: [{ key: 'immunizationsGiven', label: 'Immunizations Given', array: true }],
  },
  {
    title: 'Anticipatory Guidance',
    fields: [{ key: 'anticipatoryGuidance', label: 'Anticipatory Guidance', anticipatory: true }],
  },
];

const PAGE_SECTION_GROUPS = [[0], [1], [2], [3, 4], [5]];

const hasVal = value => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(hasVal);
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

const getPath = (record, path) => path.split('.').reduce((value, part) => value?.[part], record);

const formatDate = value => {
  if (!value) return '';
  try { return new Date(value.$date || value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return String(value); }
};

const splitByComma = text => {
  const rows = [];
  let current = '';
  let depth = 0;
  for (const character of String(text || '')) {
    if (character === '(') depth += 1;
    if (character === ')') depth = Math.max(0, depth - 1);
    if (character === ',' && depth === 0) {
      if (current.trim()) rows.push(current.trim());
      current = '';
    } else current += character;
  }
  if (current.trim()) rows.push(current.trim());
  return rows;
};

const splitBySentence = text => String(text || '')
  .split(/;\s+|(?<!\d)\.(?:\s+|$)/)
  .map(value => value.trim())
  .filter(value => value && !/^[;.,!?]+$/.test(value));

const splitFieldValue = (value, comma) => {
  const clauses = splitBySentence(value);
  return comma ? clauses.flatMap(splitByComma).filter(Boolean) : clauses;
};

const parseAnticipatory = value => {
  const text = String(value || '');
  const colon = text.indexOf(':');
  if (colon > 0 && colon <= 30) return { topic: text.slice(0, colon).trim(), content: text.slice(colon + 1).trim() };
  return { topic: '', content: text };
};

const fieldRows = (field, value) => {
  if (field.date) return [{ value: formatDate(value) }];
  if (field.anticipatory) {
    return (Array.isArray(value) ? value : []).flatMap(item => {
      const parsed = parseAnticipatory(item);
      return splitByComma(parsed.content).map(clause => ({ subtitle: parsed.topic, value: clause }));
    });
  }
  if (field.array) return (Array.isArray(value) ? value : []).filter(hasVal).map(item => ({ value: String(item) }));
  return splitFieldValue(String(value), field.comma).map(item => ({ value: item }));
};

const renderField = (field, value, key, sectionTitle) => {
  const rows = fieldRows(field, value);
  if (!rows.length) return null;
  let previousSubtitle = '';
  return (
    <View key={key} style={styles.fieldBox}>
      {field.label !== sectionTitle && <Text style={styles.fieldLabel}>{field.label}</Text>}
      {rows.map((row, rowIndex) => {
        const subtitleChanged = row.subtitle && row.subtitle !== previousSubtitle;
        previousSubtitle = row.subtitle || '';
        return (
          <View key={`${key}-${rowIndex}`} style={styles.rowBlock}>
            {subtitleChanged && <Text style={styles.nestedSubtitle}>{row.subtitle}</Text>}
            <Text style={styles.fieldValue}>{rowIndex + 1}. {row.value}</Text>
          </View>
        );
      })}
    </View>
  );
};

const WellChildExaminationsDocumentPDFTemplate = ({ document: documentProp, data: dataProp, templateData }) => {
  const records = React.useMemo(() => {
    const source = documentProp ?? dataProp ?? templateData;
    if (!source) return [];
    let rows = Array.isArray(source) ? source : [source];
    rows = rows.flatMap(row => {
      if (Array.isArray(row?.records)) return row.records;
      if (Array.isArray(row?._records)) return row._records;
      if (row?.well_child_examinations) return Array.isArray(row.well_child_examinations) ? row.well_child_examinations : [row.well_child_examinations];
      if (row?.documentData) {
        const nested = row.documentData;
        if (Array.isArray(nested)) return nested;
        if (nested?.well_child_examinations) return Array.isArray(nested.well_child_examinations) ? nested.well_child_examinations : [nested.well_child_examinations];
        return [nested];
      }
      return [row];
    });
    return rows.filter(row => row && typeof row === 'object');
  }, [documentProp, dataProp, templateData]);

  if (!records.length) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>Well Child Examinations</Text></View>
          <Text style={styles.noDataText}>No examination data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      {records.flatMap((record, recordIndex) => PAGE_SECTION_GROUPS.map((sectionIndexes, pageIndex) => {
        const visibleSections = sectionIndexes.map(sectionIndex => ({ sectionIndex, section: SECTION_CONFIGS[sectionIndex] }))
          .map(item => ({ ...item, presentFields: item.section.fields.filter(field => hasVal(getPath(record, field.key))) }))
          .filter(item => item.presentFields.length);
        if (!visibleSections.length) return null;
        return (
          <Page key={`${recordIndex}-${pageIndex}`} size="LETTER" style={styles.page}>
            {pageIndex === 0 && <View style={styles.documentHeader}><Text style={styles.documentTitle}>Well Child Examinations</Text></View>}
            {pageIndex === 0 && <View style={styles.recordHeader} wrap={false}><Text style={styles.recordTitle}>Well Child Examination {recordIndex + 1}</Text></View>}
            {visibleSections.map(({ sectionIndex, section, presentFields }) => (
              <View key={`${section.title}-${sectionIndex}`} style={styles.sectionBlock} wrap={false}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {presentFields.map((field, fieldIndex) => renderField(field, getPath(record, field.key), `${sectionIndex}-${fieldIndex}`, section.title))}
                <View style={styles.sectionSpacer} />
              </View>
            ))}
          </Page>
        );
      }))}
    </Document>
  );
};

export default WellChildExaminationsDocumentPDFTemplate;
