/**
 * VisionTherapyAssessmentDocumentPDFTemplate.jsx
 * July 2026 — canonical LETTER PDF for vision therapy assessments
 * Collection: vision_therapy_assessment
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 18 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 8, marginBottom: 5, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 2, marginBottom: 2, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000', paddingLeft: 8 },
  listItem: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#333333', textAlign: 'center', marginTop: 40 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#cccccc', paddingTop: 6 },
});

const safeString = value => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

const hasVal = value => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

const numberShowsPDF = (record, key) => {
  const value = record[key];
  if (value === null || value === undefined || value === '') return false;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return false;
  if (numericValue !== 0) return true;
  return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(key);
};

const splitBySentence = text => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/;\s+|(?<!\d)\.(?:\s+)/).map(value => value.trim()).filter(value => value && !/^[;.,!?]+$/.test(value));
};

const parseLabel = text => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const match = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (!match) return { isLabeled: false, label: '', value: text };
  return { isLabeled: true, label: match[1].trim(), value: match[2].trim() };
};

const splitByComma = text => {
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
    } else current += character;
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [text];
};

const SECTION_CONFIGS = [
  { title: 'Visual Acuity', fields: [
    { key: 'patientVisualAcuityOD', label: 'Visual Acuity OD (Right Eye)', isSentence: true },
    { key: 'patientVisualAcuityOS', label: 'Visual Acuity OS (Left Eye)', isSentence: true },
  ] },
  { title: 'Convergence', fields: [
    { key: 'nearPointConvergenceBreak', label: 'Near Point of Convergence Break (cm)', isNumber: true },
    { key: 'nearPointConvergenceRecovery', label: 'Near Point of Convergence Recovery (cm)', isNumber: true },
    { key: 'convergenceInsufficiencySymptomScore', label: 'Convergence Insufficiency Symptom Score', isNumber: true },
  ] },
  { title: 'Accommodation', fields: [
    { key: 'accommodativeAmplitudeOD', label: 'Accommodative Amplitude OD (D)', isNumber: true },
    { key: 'accommodativeAmplitudeOS', label: 'Accommodative Amplitude OS (D)', isNumber: true },
    { key: 'accommodativeFacilityOD', label: 'Accommodative Facility OD (cpm)', isNumber: true },
    { key: 'accommodativeFacilityOS', label: 'Accommodative Facility OS (cpm)', isNumber: true },
    { key: 'binocularAccommodativeFacility', label: 'Binocular Accommodative Facility (cpm)', isNumber: true },
    { key: 'positiveRelativeAccommodation', label: 'Positive Relative Accommodation (D)', isNumber: true },
    { key: 'negativeRelativeAccommodation', label: 'Negative Relative Accommodation (D)', isNumber: true },
  ] },
  { title: 'Vergence & Phoria', fields: [
    { key: 'vergenceFacilityScore', label: 'Vergence Facility Score (cpm)', isNumber: true },
    { key: 'horizontalPhoriaDistance', label: 'Horizontal Phoria at Distance', isSentence: true },
    { key: 'horizontalPhoriaNear', label: 'Horizontal Phoria at Near', isSentence: true },
    { key: 'verticalPhoriaDistance', label: 'Vertical Phoria at Distance', isSentence: true },
    { key: 'positiveVergenceAtNear', label: 'Positive Vergence at Near', isSentence: true },
    { key: 'negativeVergenceAtNear', label: 'Negative Vergence at Near', isSentence: true },
  ] },
  { title: 'Binocular Vision', fields: [
    { key: 'stereopsisScore', label: 'Stereopsis Score (arc sec)', isNumber: true },
  ] },
  { title: 'Eye Movements', fields: [
    { key: 'saccadicFixationAbility', label: 'Saccadic Fixation Ability', isSentence: true, commaSplit: true },
    { key: 'pursuitMovementQuality', label: 'Pursuit Movement Quality', isSentence: true },
    { key: 'developmentalEyeMovementScore', label: 'Developmental Eye Movement Score', isNumber: true },
    { key: 'kingDevickTestTime', label: 'King-Devick Test Time (sec)', isNumber: true },
  ] },
  { title: 'Visual Processing', fields: [
    { key: 'visualMotorIntegrationPercentile', label: 'Visual Motor Integration Percentile', isNumber: true },
    { key: 'visualPerceptionPercentile', label: 'Visual Perception Percentile', isNumber: true },
  ] },
];

const fieldPresent = (record, field) => field.isNumber ? numberShowsPDF(record, field.key) : hasVal(record[field.key]);

const renderNumberField = (record, field) => (
  <View style={styles.fieldBox}>
    <Text style={styles.fieldLabel}>{field.label}</Text>
    <Text style={styles.fieldValue}>{safeString(record[field.key])}</Text>
  </View>
);

const renderSentenceField = (record, field) => {
  const rows = splitBySentence(safeString(record[field.key])).flatMap(sentence => {
    const parsed = parseLabel(sentence);
    const values = field.commaSplit ? splitByComma(parsed.value) : [parsed.value];
    return values.map(value => ({ label: parsed.isLabeled ? parsed.label : '', value }));
  });
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{field.label}</Text>
      {rows.map((row, index) => (
        <View key={index}>
          {row.label && <Text style={styles.nestedSubtitle}>{row.label}</Text>}
          <Text style={styles.listItem}>{index + 1}. {safeString(row.value)}</Text>
        </View>
      ))}
    </View>
  );
};

const VisionTherapyAssessmentDocumentPDFTemplate = ({ document: documentProp, records: recordsProp, data, templateData }) => {
  const source = documentProp ?? recordsProp ?? data ?? templateData;
  const records = React.useMemo(() => {
    if (!source) return [];
    let values = Array.isArray(source) ? source : [source];
    values = values.flatMap(record => {
      if (Array.isArray(record?.wrapRecordsIntoSingleDocument)) return record.wrapRecordsIntoSingleDocument;
      if (Array.isArray(record?.records || record?._records)) return record.records || record._records;
      if (record?.vision_therapy_assessment) return Array.isArray(record.vision_therapy_assessment) ? record.vision_therapy_assessment : [record.vision_therapy_assessment];
      if (record?.documentData) {
        const documentData = record.documentData;
        if (Array.isArray(documentData)) return documentData;
        if (documentData?.vision_therapy_assessment) return Array.isArray(documentData.vision_therapy_assessment) ? documentData.vision_therapy_assessment : [documentData.vision_therapy_assessment];
        return [documentData];
      }
      return [record];
    });
    return values.filter(record => record && typeof record === 'object');
  }, [source]);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Vision Therapy Assessment</Text>
        </View>
        {records.length === 0 && <Text style={styles.noDataText}>No data available</Text>}
        {records.map((record, recordIndex) => (
          <View key={recordIndex} style={styles.recordContainer}>
            {recordIndex > 0 && <View style={styles.separator} />}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>Vision Therapy Assessment {recordIndex + 1}</Text>
            </View>
            {SECTION_CONFIGS.map((section, sectionIndex) => {
              const presentFields = section.fields.filter(field => fieldPresent(record, field));
              if (!presentFields.length) return null;
              return (
                <View key={sectionIndex} style={styles.section} wrap={presentFields.length > 8}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  {presentFields.map((field, fieldIndex) => (
                    <View key={fieldIndex}>
                      {field.isSentence ? renderSentenceField(record, field) : renderNumberField(record, field)}
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        ))}
        <Text fixed style={styles.footer}>Vision Therapy Assessment</Text>
      </Page>
    </Document>
  );
};

export default VisionTherapyAssessmentDocumentPDFTemplate;
