import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 36, paddingBottom: 48, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.35, color: '#000' },
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
  pageNumber: { position: 'absolute', bottom: 20, left: 36, right: 36, fontSize: 9, color: '#666', textAlign: 'center' },
});

const SECTIONS = [
  { title: 'Provider Details', fields: ['createdAt'] },
  { title: 'Primary Diagnosis', fields: ['primaryDiagnosis'] },
  { title: 'Assessment Scores', fields: ['functionalStatusScore', 'activitiesOfDailyLivingScore', 'cognitiveAssessmentScore', 'caregiverBurdenScore', 'painAssessmentScore', 'depressionScreeningScore'] },
  { title: 'Physical Status', fields: ['fallRiskAssessment', 'nutritionalStatus', 'bodyMassIndex', 'skinIntegrityAssessment', 'respiratoryStatus', 'continenceStatus', 'swallowingAssessment'] },
  { title: 'Medication List', fields: ['medicationList'] },
  { title: 'Mobility Aids', fields: ['mobilityAids'] },
  { title: 'Behavioral Symptoms', fields: ['behavioralSymptoms'] },
  { title: 'Social Support', fields: ['socialSupportNetwork', 'emergencyContactInformation'] },
  { title: 'Dietary Requirements', fields: ['specialDietaryRequirements'] },
];

const FIELD_LABELS = {
  createdAt: 'Date',
  primaryDiagnosis: 'Primary Diagnosis',
  functionalStatusScore: 'Functional Status Score',
  activitiesOfDailyLivingScore: 'Activities of Daily Living Score',
  cognitiveAssessmentScore: 'Cognitive Assessment Score',
  caregiverBurdenScore: 'Caregiver Burden Score',
  painAssessmentScore: 'Pain Assessment Score',
  depressionScreeningScore: 'Depression Screening Score',
  fallRiskAssessment: 'Fall Risk Assessment',
  nutritionalStatus: 'Nutritional Status',
  bodyMassIndex: 'Body Mass Index',
  skinIntegrityAssessment: 'Skin Integrity Assessment',
  respiratoryStatus: 'Respiratory Status',
  continenceStatus: 'Continence Status',
  swallowingAssessment: 'Swallowing Assessment',
  medicationList: 'Medication List',
  mobilityAids: 'Mobility Aids',
  behavioralSymptoms: 'Behavioral Symptoms',
  socialSupportNetwork: 'Social Support Network',
  emergencyContactInformation: 'Emergency Contact',
  specialDietaryRequirements: 'Dietary Requirements',
};

const ARRAY_FIELDS = ['medicationList', 'mobilityAids', 'behavioralSymptoms', 'specialDietaryRequirements'];
const DATE_FIELDS = ['createdAt'];
const COMMA_FIELDS = ['primaryDiagnosis', 'respiratoryStatus'];
const SEMICOLON_FIELDS = ['primaryDiagnosis', 'respiratoryStatus', 'continenceStatus', 'swallowingAssessment', 'socialSupportNetwork'];

const hasVal = (value) => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(hasVal);
  return typeof value === 'object' && Object.keys(value).length > 0;
};
const formatDate = (value) => {
  try {
    const date = new Date(value?.$date || value);
    return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(value || ''); }
};
const splitGuardedComma = (text) => {
  const source = String(text || '');
  const result = [];
  let current = '';
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') { depth += 1; current += char; continue; }
    if (char === ')') { depth = Math.max(0, depth - 1); current += char; continue; }
    if (char !== ',' || depth > 0) { current += char; continue; }
    const before = current.trim();
    const after = source.slice(index + 1);
    const trimmed = after.trimStart();
    const nextWord = (trimmed.match(/^([A-Za-z]+)/) || [])[1]?.toLowerCase();
    const previousWord = (before.match(/([A-Za-z]+)$/) || [])[1]?.toLowerCase();
    const protectedComma = (/\d$/.test(before) && /^\d{3}\b/.test(trimmed))
      || after.length === trimmed.length
      || ['and', 'or', 'then'].includes(nextWord)
      || ['and', 'or'].includes(previousWord);
    if (protectedComma) current += char;
    else { if (before) result.push(before); current = ''; }
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [source];
};
const splitBySentence = (text) => String(text || '')
  .split(/(?:;\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+)/)
  .map((part) => part.replace(/^[;.,\s]+|[;.,\s]+$/g, '').trim())
  .filter(Boolean);
const splitFieldValue = (field, value) => {
  const firstPass = SEMICOLON_FIELDS.includes(field) || String(value || '').includes('. ')
    ? splitBySentence(String(value || ''))
    : [String(value || '').trim()].filter(Boolean);
  return firstPass.flatMap((part) => COMMA_FIELDS.includes(field) ? splitGuardedComma(part) : [part]);
};
const parseLabel = (text) => {
  const match = String(text || '').match(/^([A-Za-z][A-Za-z0-9 /&()+-]{1,50}):\s+(.+)$/);
  return match ? { label: match[1].trim(), value: match[2].trim() } : null;
};

const fieldBlocks = (field, value, sectionTitle) => {
  if (!hasVal(value)) return [];
  const label = FIELD_LABELS[field] || field;
  const showFieldLabel = label.toLowerCase() !== sectionTitle.toLowerCase();
  if (ARRAY_FIELDS.includes(field)) {
    return value.filter(hasVal).map((item, index) => ({
      key: field + '-' + index,
      fieldLabel: index === 0 && showFieldLabel ? label : '',
      value: String(item),
      rowNumber: index + 1,
    }));
  }
  const rows = DATE_FIELDS.includes(field) ? [formatDate(value)] : splitFieldValue(field, value);
  return rows.map((row, index) => {
    const parsed = parseLabel(row);
    return {
      key: field + '-' + index,
      fieldLabel: index === 0 && showFieldLabel ? label : '',
      subLabel: parsed?.label || '',
      value: parsed?.value || row,
      rowNumber: rows.length > 1 ? index + 1 : undefined,
    };
  });
};

const renderSection = (section, record, sectionIndex) => {
  const blocks = section.fields.flatMap((field) => fieldBlocks(field, record[field], section.title));
  if (!blocks.length) return null;
  return <React.Fragment key={sectionIndex}>{blocks.map((block, index) => (
    <View key={block.key} style={styles.block} wrap={false}>
      {index === 0 && <Text style={styles.sectionTitle}>{section.title}</Text>}
      {block.fieldLabel && <Text style={styles.fieldLabel}>{block.fieldLabel}</Text>}
      {block.subLabel && <Text style={styles.subLabel}>{block.subLabel}</Text>}
      <Text style={block.rowNumber ? styles.listItem : styles.fieldValue}>{block.rowNumber ? block.rowNumber + '. ' + block.value : block.value}</Text>
    </View>
  ))}</React.Fragment>;
};

const unwrap = (data) => (Array.isArray(data) ? data : [data]).flatMap((record) => {
  if (record?.respite_care) return Array.isArray(record.respite_care) ? record.respite_care : [record.respite_care];
  if (record?.documentData) {
    const nested = record.documentData;
    if (Array.isArray(nested)) return nested;
    if (nested?.respite_care) return Array.isArray(nested.respite_care) ? nested.respite_care : [nested.respite_care];
    return [nested];
  }
  return [record];
}).filter((record) => record && typeof record === 'object');

export default function RespiteCareDocumentPDFTemplate({ document: data, records: recordData }) {
  const records = React.useMemo(() => unwrap(recordData || data), [recordData, data]);
  return <Document><Page size="LETTER" style={styles.page}>
    <View style={styles.documentHeader} wrap={false}><Text style={styles.documentTitle}>Respite Care</Text></View>
    {!records.length && <Text style={styles.noDataText}>No respite care data available</Text>}
    {records.map((record, recordIndex) => <View key={recordIndex} style={styles.recordContainer} break={recordIndex > 0}>
      <View wrap={false}><Text style={styles.recordTitle}>Respite Care Record {recordIndex + 1}</Text></View>
      {SECTIONS.map((section, sectionIndex) => renderSection(section, record, sectionIndex))}
    </View>)}
    <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => pageNumber + ' / ' + totalPages} fixed />
  </Page></Document>;
}
