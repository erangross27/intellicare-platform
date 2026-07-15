/**
 * SportsMedicineEvaluationsDocumentPDFTemplate.jsx
 * Canonical LETTER PDF for sports_medicine_evaluations.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 52, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 20 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#000000', marginTop: 40 },
});

const SECTION_CONFIGS = [
  { title: 'Sport Information', fields: [['sport', 'Sport'], ['level', 'Level'], ['position', 'Position'], ['competitionLevel', 'Competition Level']] },
  { title: 'Evaluation Information', fields: [['evaluationType', 'Evaluation Type'], ['evaluationDate', 'Evaluation Date', 'date'], ['clearanceStatus', 'Clearance Status']] },
  { title: 'Cardiac Screening - Personal History', fields: [['cardiacScreening.personalHistory', 'Personal History', 'array']] },
  { title: 'Cardiac Screening - Family History', fields: [['cardiacScreening.familyHistory', 'Family History', 'array']] },
  { title: 'Cardiac Screening - Physical Exam', fields: [['cardiacScreening.physicalExam.heartMurmur', 'Heart Murmur'], ['cardiacScreening.physicalExam.marfanoidFeatures', 'Marfanoid Features'], ['cardiacScreening.physicalExam.abnormalPulses', 'Abnormal Pulses']] },
  { title: 'Cardiac Screening - Assessment', fields: [['cardiacScreening.ecgPerformed', 'ECG Performed'], ['cardiacScreening.ecgFindings', 'ECG Findings', 'sentences'], ['cardiacScreening.echoRecommended', 'Echo Recommended'], ['cardiacScreening.clearanceDecision', 'Clearance Decision']] },
  { title: 'Musculoskeletal Exam', fields: [['musculoskeletalExam.rom', 'Range of Motion', 'comma'], ['musculoskeletalExam.strength', 'Strength']] },
  { title: 'Musculoskeletal Exam - Details', fields: [['musculoskeletalExam.instability', 'Instability', 'array'], ['musculoskeletalExam.previousInjuries', 'MSK Previous Injuries', 'array'], ['musculoskeletalExam.concerns', 'Concerns', 'array']] },
  { title: 'Restrictions & Injuries', fields: [['restrictions', 'Restrictions', 'array'], ['previousInjuries', 'Previous Injuries', 'array'], ['returnToPlayCriteria', 'Return to Play Criteria', 'array']] },
  { title: 'Rehabilitation Plan', fields: [['rehabilitationPlan', 'Rehabilitation Plan', 'object']] },
  { title: 'Rehabilitation & Return to Play', fields: [['returnToPlayPlan', 'Return to Play Plan', 'sentences']] },
  { title: 'Provider Information', fields: [['provider', 'Provider'], ['facility', 'Facility']] },
];

const getNestedValue = (obj, path) => path.split('.').reduce((value, key) => value?.[key], obj);
const hasVal = (value) => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'boolean' || typeof value === 'number') return true;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(Boolean);
  if (typeof value === 'object') return Object.values(value).some(hasVal);
  return true;
};
const safeString = (value) => {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value && typeof value === 'object' && value.$date) return formatDate(value.$date);
  return String(value ?? '');
};
const formatDate = (value) => {
  if (!value) return '';
  const parsed = new Date(value.$date || value);
  if (Number.isNaN(parsed.getTime())) return safeString(value);
  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};
const humanizeKey = (key) => key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
const parseLabel = (text) => {
  const match = String(text ?? '').match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  return match ? { isLabeled: true, label: match[1].trim(), value: match[2].trim() } : { isLabeled: false, label: '', value: safeString(text) };
};
const splitBySentence = (text) => String(text ?? '').split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\d)\.\s+|;\s+/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
const splitByComma = (text) => {
  const parts = []; let current = ''; let depth = 0;
  for (const ch of String(text ?? '')) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { if (current.trim()) parts.push(current.trim()); current = ''; }
    else current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
};

const renderRows = (label, rows) => {
  if (!rows.length) return null;
  return (
    <View style={styles.fieldBox} wrap={rows.length > 8 ? true : false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map((row, index) => row.label
        ? <View key={index}><Text style={styles.nestedSubtitle}>{row.label}</Text><Text style={styles.listItem}>{index + 1}. {row.value}</Text></View>
        : <Text key={index} style={styles.listItem}>{index + 1}. {row.value}</Text>)}
    </View>
  );
};

const renderObject = (label, value) => {
  const leaves = [];
  const visit = (node, prefix = []) => {
    Object.entries(node || {}).forEach(([key, child]) => {
      if (!hasVal(child)) return;
      if (child && typeof child === 'object' && !Array.isArray(child) && !child.$date) visit(child, [...prefix, key]);
      else leaves.push({ label: humanizeKey([...prefix, key].join(' ')), value: Array.isArray(child) ? child.map(safeString).join(', ') : safeString(child) });
    });
  };
  visit(value);
  if (!leaves.length) return null;
  return <View style={styles.fieldBox} wrap={leaves.length > 8 ? true : false}><Text style={styles.fieldLabel}>{label}</Text>{leaves.map((leaf, index) => <View key={index} wrap={false}><Text style={styles.nestedSubtitle}>{leaf.label}</Text><Text style={styles.fieldValue}>{leaf.value}</Text></View>)}</View>;
};

const renderField = ([path, label, kind], record) => {
  const value = getNestedValue(record, path);
  if (!hasVal(value)) return null;
  if (kind === 'date') return <View style={styles.fieldBox} wrap={false}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{formatDate(value)}</Text></View>;
  if (kind === 'object') return renderObject(label, value);
  if (kind === 'array') return renderRows(label, value.filter(Boolean).map(item => { const parsed = parseLabel(item); return { label: parsed.isLabeled ? parsed.label : '', value: parsed.value }; }));
  if (kind === 'comma') return renderRows(label, splitByComma(value).map(item => ({ value: item })));
  if (kind === 'sentences') return renderRows(label, splitBySentence(value).map(item => { const parsed = parseLabel(item); return { label: parsed.isLabeled ? parsed.label : '', value: parsed.value }; }));
  return <View style={styles.fieldBox} wrap={false}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{safeString(value)}</Text></View>;
};

const unwrapRecords = (data) => {
  if (!data) return [];
  const input = Array.isArray(data) ? data : [data];
  return input.flatMap(record => {
    if (record?.sports_medicine_evaluations) return Array.isArray(record.sports_medicine_evaluations) ? record.sports_medicine_evaluations : [record.sports_medicine_evaluations];
    if (record?.documentData) return unwrapRecords(record.documentData);
    return [record];
  }).filter(record => record && typeof record === 'object');
};

const SportsMedicineEvaluationsDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Sports Medicine Evaluations</Text></View>
        {!records.length && <Text style={styles.noDataText}>No data available</Text>}
        {records.map((record, recordIndex) => (
          <View key={recordIndex} style={styles.recordContainer}>
            {recordIndex > 0 && <View style={styles.separator} />}
            <View style={styles.recordHeader} wrap={false}><Text style={styles.recordTitle}>{`Sports Medicine Evaluation ${recordIndex + 1}`}</Text></View>
            {SECTION_CONFIGS.map((section, sectionIndex) => {
              const present = section.fields.filter(field => hasVal(getNestedValue(record, field[0])));
              if (!present.length) return null;
              return (
                <View key={sectionIndex} style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}><Text style={styles.sectionTitle}>{section.title}</Text>{renderField(present[0], record)}</View>
                  {present.slice(1).map((field, fieldIndex) => <View key={fieldIndex}>{renderField(field, record)}</View>)}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SportsMedicineEvaluationsDocumentPDFTemplate;
