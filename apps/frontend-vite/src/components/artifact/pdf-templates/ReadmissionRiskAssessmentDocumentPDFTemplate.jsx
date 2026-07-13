/** Canonical LETTER export for readmission_risk_assessment. */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.45, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 22 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 22 },
  recordHeader: { marginBottom: 14 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', paddingBottom: 4, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBlock: { marginBottom: 9 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', paddingBottom: 2, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 5, marginBottom: 3 },
  listItem: { fontSize: 14, lineHeight: 1.45, marginBottom: 2, paddingLeft: 8 },
  noDataText: { fontSize: 14, color: '#4b5563', marginTop: 24 },
});

const SECTION_CONFIGS = [
  { title: 'Risk Scores', fields: ['date', 'laceIndexScore', 'hospitalScore', 'readmissionProbability', 'riskStratificationLevel', 'charlsonComorbidityIndex', 'functionalStatusScore'] },
  { title: 'Utilization & Admission', fields: ['indexAdmissionDiagnosis', 'lengthOfStayDays', 'priorAdmissionsCount', 'priorEmergencyVisitsCount', 'dischargeDisposition', 'heartFailureExacerbation', 'activeCancerDiagnosis', 'chronicKidneyDiseaseStage'] },
  { title: 'Medication & Clinical Risk', fields: ['medicationCount', 'highRiskMedications', 'polypharmacyIndicator', 'cognitiveImpairmentPresent', 'nutritionalRiskIndicator', 'pendingTestResultsAtDischarge'] },
  { title: 'Social Support & Mitigation', fields: ['adequateSocialSupport', 'healthLiteracyScore', 'followUpAppointmentScheduled', 'mitigationInterventions', 'assessmentPerformedBy'] },
];

const FIELD_LABELS = {
  date: 'Date', laceIndexScore: 'LACE Index Score', hospitalScore: 'HOSPITAL Score', readmissionProbability: 'Readmission Probability (%)',
  riskStratificationLevel: 'Risk Stratification Level', charlsonComorbidityIndex: 'Charlson Comorbidity Index', functionalStatusScore: 'Functional Status Score',
  indexAdmissionDiagnosis: 'Index Admission Diagnosis', lengthOfStayDays: 'Length of Stay (days)', priorAdmissionsCount: 'Prior Admissions Count',
  priorEmergencyVisitsCount: 'Prior Emergency Visits Count', dischargeDisposition: 'Discharge Disposition', heartFailureExacerbation: 'Heart Failure Exacerbation',
  activeCancerDiagnosis: 'Active Cancer Diagnosis', chronicKidneyDiseaseStage: 'Chronic Kidney Disease Stage', medicationCount: 'Medication Count',
  highRiskMedications: 'High-Risk Medications', polypharmacyIndicator: 'Polypharmacy', cognitiveImpairmentPresent: 'Cognitive Impairment Present',
  nutritionalRiskIndicator: 'Nutritional Risk Indicator', pendingTestResultsAtDischarge: 'Pending Test Results at Discharge', adequateSocialSupport: 'Adequate Social Support',
  healthLiteracyScore: 'Health Literacy Score', followUpAppointmentScheduled: 'Follow-Up Appointment Scheduled', mitigationInterventions: 'Mitigation Interventions',
  assessmentPerformedBy: 'Assessment Performed By',
};

const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = ['laceIndexScore', 'hospitalScore', 'readmissionProbability', 'lengthOfStayDays', 'charlsonComorbidityIndex', 'priorAdmissionsCount', 'priorEmergencyVisitsCount', 'medicationCount', 'functionalStatusScore'];
const ARRAY_FIELDS = ['highRiskMedications', 'mitigationInterventions'];
const BOOLEAN_FIELDS = ['polypharmacyIndicator', 'adequateSocialSupport', 'followUpAppointmentScheduled', 'pendingTestResultsAtDischarge', 'cognitiveImpairmentPresent', 'activeCancerDiagnosis', 'heartFailureExacerbation'];
const MEANINGFUL_ZERO_FIELDS = ['laceIndexScore', 'hospitalScore', 'readmissionProbability', 'charlsonComorbidityIndex', 'priorAdmissionsCount', 'priorEmergencyVisitsCount', 'functionalStatusScore'];

const safeString = (value) => String(value ?? '')
  .replace(/\u00d7/g, 'x')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/[\u2013\u2014]/g, '-');

const formatDate = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value.$date || value);
    if (Number.isNaN(date.getTime())) return safeString(value);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return safeString(value); }
};

const hasValue = (record, field) => {
  const value = record[field];
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number') {
    if (value !== 0 || MEANINGFUL_ZERO_FIELDS.includes(field)) return true;
    return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(field);
  }
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === 'object' ? Object.keys(value).length > 0 : true;
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;]\s+/)
    .map(item => item.trim()).filter(item => item && !/^[;.,!?]+$/.test(item));
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
    } else current += character;
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

const fieldRows = (record, field) => {
  const value = record[field];
  if (DATE_FIELDS.includes(field)) return [{ type: 'item', value: formatDate(value) }];
  if (BOOLEAN_FIELDS.includes(field)) return [{ type: 'item', value: value ? 'Yes' : 'No' }];
  if (NUMBER_FIELDS.includes(field)) return [{ type: 'item', value: String(value) }];
  if (ARRAY_FIELDS.includes(field)) return value.map(item => {
    const parsed = parseLabel(safeString(item));
    return parsed.isLabeled
      ? [{ type: 'subtitle', value: parsed.label }, { type: 'item', value: parsed.value }]
      : [{ type: 'item', value: safeString(item) }];
  }).flat();
  return splitBySentence(safeString(value)).flatMap(sentence => {
    const parsed = parseLabel(sentence);
    if (!parsed.isLabeled) return [{ type: 'item', value: sentence }];
    return [{ type: 'subtitle', value: parsed.label }, ...splitByComma(parsed.value).map(item => ({ type: 'item', value: item }))];
  });
};

const renderField = (record, field) => {
  if (!hasValue(record, field)) return null;
  const rows = fieldRows(record, field);
  let number = 0;
  return (
    <View style={styles.fieldBlock} wrap={rows.length > 8}>
      <Text style={styles.fieldLabel}>{FIELD_LABELS[field] || field}</Text>
      {rows.map((row, index) => row.type === 'subtitle'
        ? <Text key={index} style={styles.nestedSubtitle}>{safeString(row.value)}</Text>
        : <Text key={index} style={styles.listItem}>{++number}. {safeString(row.value)}</Text>)}
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

const unwrapRecords = (data) => {
  if (!data) return [];
  const input = Array.isArray(data) ? data : [data];
  return input.flatMap(record => {
    if (record?.readmission_risk_assessment) return Array.isArray(record.readmission_risk_assessment) ? record.readmission_risk_assessment : [record.readmission_risk_assessment];
    if (record?.documentData) {
      const nested = record.documentData;
      if (Array.isArray(nested)) return nested;
      if (nested?.readmission_risk_assessment) return Array.isArray(nested.readmission_risk_assessment) ? nested.readmission_risk_assessment : [nested.readmission_risk_assessment];
      return [nested];
    }
    return [record];
  }).filter(record => record && typeof record === 'object');
};

const ReadmissionRiskAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader} wrap={false}>
          <Text style={styles.documentTitle}>Readmission Risk Assessment</Text>
        </View>
        {!records.length ? <Text style={styles.noDataText}>No data available</Text> : null}
        {records.map((record, recordIndex) => {
          const populatedSections = SECTION_CONFIGS.map(config => ({
            title: config.title,
            fields: config.fields.map(field => renderField(record, field)),
          })).filter(config => config.fields.some(Boolean));
          const recordTitle = `Readmission Risk Assessment ${recordIndex + 1}`;
          return (
            <View key={record._id || recordIndex} style={styles.recordContainer} break={recordIndex > 0}>
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

export default ReadmissionRiskAssessmentDocumentPDFTemplate;
